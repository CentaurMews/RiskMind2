import { Router } from "express";
import { eq, and, ne, sql } from "drizzle-orm";
import {
  db,
  monitoringConfigsTable,
  assessmentTemplatesTable,
  assessmentsTable,
  vendorsTable,
  alertsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError } from "../lib/errors";
import { registerWorker, enqueueJob } from "../lib/job-queue";

const VALID_TIERS = ["critical", "high", "medium", "low"] as const;
type MonitoringTier = typeof VALID_TIERS[number];

function isValidTier(t: string): t is MonitoringTier {
  return VALID_TIERS.includes(t as MonitoringTier);
}

// ─── Vendor-Monitor Worker ────────────────────────────────────────────────────
// Registered at module scope — fires when a scheduled vendor-monitor job is claimed

registerWorker("vendor-monitor", async (job) => {
  const { vendorId, tenantId } = job.payload as { vendorId: string; tenantId: string };

  // 1. Load vendor
  const [vendor] = await db.select()
    .from(vendorsTable)
    .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)));
  if (!vendor) return;

  // 2. Load monitoring config for vendor's tier
  const [config] = await db.select()
    .from(monitoringConfigsTable)
    .where(and(
      eq(monitoringConfigsTable.tenantId, tenantId),
      eq(monitoringConfigsTable.tier, vendor.tier),
    ));
  if (!config) return;

  // 3. Idempotency check — skip if recent pending/active assessment exists (prevents duplicate creation)
  const [recentAssessment] = await db.select({ id: assessmentsTable.id })
    .from(assessmentsTable)
    .where(and(
      eq(assessmentsTable.contextType, "vendor"),
      eq(assessmentsTable.contextId, vendorId),
      sql`${assessmentsTable.createdAt} > now() - interval '1 hour'`,
      ne(assessmentsTable.status, "completed"),
    ))
    .limit(1);

  if (!recentAssessment && config.assessmentTemplateId) {
    // 4. Create assessment
    await db.insert(assessmentsTable).values({
      tenantId,
      templateId: config.assessmentTemplateId,
      contextType: "vendor",
      contextId: vendorId,
      status: "draft",
      responses: {},
    });
  }

  // 5. Check score threshold breach and generate alert (VNDR-04)
  // vendor.riskScore is a numeric string; config.scoreThreshold is an integer or null
  if (config.scoreThreshold != null && vendor.riskScore != null) {
    const currentScore = Number(vendor.riskScore);
    if (currentScore >= config.scoreThreshold) {
      await db.insert(alertsTable).values({
        tenantId,
        type: "score_threshold_breach",
        title: `Vendor "${vendor.name}" risk score exceeds threshold`,
        description: `Risk score ${currentScore} meets or exceeds the ${vendor.tier}-tier threshold of ${config.scoreThreshold}. Immediate review recommended.`,
        severity: currentScore >= 75 ? "critical" : currentScore >= 50 ? "high" : "medium",
        status: "active",
        context: {
          vendorId,
          vendorName: vendor.name,
          riskScore: currentScore,
          threshold: config.scoreThreshold,
          tier: vendor.tier,
        },
      });
    }
  }

  // 6. Update vendor next_assessment_due
  const nextDue = new Date(Date.now() + config.cadenceDays * 86400000);
  await db.update(vendorsTable).set({
    nextAssessmentDue: nextDue,
    updatedAt: new Date(),
  }).where(eq(vendorsTable.id, vendorId));

  // 7. Enqueue next cycle
  await enqueueJob(
    "vendor-monitor",
    "schedule_assessment",
    { vendorId, tenantId },
    tenantId,
    { delayMs: config.cadenceDays * 86400000 },
  );
});

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router();

/**
 * GET /v1/monitoring-configs — List all configs for tenant
 */
router.get("/v1/monitoring-configs", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    const results = await db
      .select({
        id: monitoringConfigsTable.id,
        tenantId: monitoringConfigsTable.tenantId,
        tier: monitoringConfigsTable.tier,
        cadenceDays: monitoringConfigsTable.cadenceDays,
        scoreThreshold: monitoringConfigsTable.scoreThreshold,
        assessmentTemplateId: monitoringConfigsTable.assessmentTemplateId,
        templateTitle: assessmentTemplatesTable.title,
        createdAt: monitoringConfigsTable.createdAt,
        updatedAt: monitoringConfigsTable.updatedAt,
      })
      .from(monitoringConfigsTable)
      .leftJoin(
        assessmentTemplatesTable,
        eq(monitoringConfigsTable.assessmentTemplateId, assessmentTemplatesTable.id),
      )
      .where(eq(monitoringConfigsTable.tenantId, tenantId))
      .orderBy(monitoringConfigsTable.tier);

    res.json({ data: results });
  } catch (err) {
    console.error("List monitoring configs error:", err);
    serverError(res);
  }
});

/**
 * PUT /v1/monitoring-configs/:tier — Upsert config for a tier
 */
router.put("/v1/monitoring-configs/:tier", requireRole("admin"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const tier = String(req.params.tier);

    if (!isValidTier(tier)) {
      badRequest(res, `tier must be one of: ${VALID_TIERS.join(", ")}`);
      return;
    }

    const { cadenceDays, assessmentTemplateId, scoreThreshold } = req.body;

    if (cadenceDays === undefined || cadenceDays === null) {
      badRequest(res, "cadenceDays is required");
      return;
    }
    const cadenceDaysNum = Number(cadenceDays);
    if (!Number.isInteger(cadenceDaysNum) || cadenceDaysNum < 1 || cadenceDaysNum > 365) {
      badRequest(res, "cadenceDays must be an integer between 1 and 365");
      return;
    }

    let scoreThresholdValue: number | null = null;
    if (scoreThreshold !== undefined && scoreThreshold !== null) {
      const thresholdNum = Number(scoreThreshold);
      if (!Number.isInteger(thresholdNum) || thresholdNum < 0 || thresholdNum > 100) {
        badRequest(res, "scoreThreshold must be an integer between 0 and 100");
        return;
      }
      scoreThresholdValue = thresholdNum;
    }

    const [config] = await db.insert(monitoringConfigsTable)
      .values({
        tenantId,
        tier,
        cadenceDays: cadenceDaysNum,
        assessmentTemplateId: assessmentTemplateId ?? null,
        scoreThreshold: scoreThresholdValue,
      })
      .onConflictDoUpdate({
        target: [monitoringConfigsTable.tenantId, monitoringConfigsTable.tier],
        set: {
          cadenceDays: cadenceDaysNum,
          assessmentTemplateId: assessmentTemplateId ?? null,
          scoreThreshold: scoreThresholdValue,
          updatedAt: new Date(),
        },
      })
      .returning();

    await recordAudit(req, "upsert_monitoring_config", "monitoring_config", config.id, { tier, cadenceDays: cadenceDaysNum, scoreThreshold: scoreThresholdValue });
    res.json(config);
  } catch (err) {
    console.error("Upsert monitoring config error:", err);
    serverError(res);
  }
});

/**
 * DELETE /v1/monitoring-configs/:tier — Remove config for a tier
 */
router.delete("/v1/monitoring-configs/:tier", requireRole("admin"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const tier = String(req.params.tier);

    if (!isValidTier(tier)) {
      badRequest(res, `tier must be one of: ${VALID_TIERS.join(", ")}`);
      return;
    }

    const deleted = await db.delete(monitoringConfigsTable)
      .where(and(
        eq(monitoringConfigsTable.tenantId, tenantId),
        eq(monitoringConfigsTable.tier, tier),
      ))
      .returning({ id: monitoringConfigsTable.id });

    if (deleted.length === 0) {
      notFound(res, "Monitoring config not found for this tier");
      return;
    }

    res.status(204).send();
  } catch (err) {
    console.error("Delete monitoring config error:", err);
    serverError(res);
  }
});

export default router;
