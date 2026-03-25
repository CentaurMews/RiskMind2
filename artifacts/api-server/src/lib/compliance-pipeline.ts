import {
  db,
  frameworksTable,
  frameworkRequirementsTable,
  controlRequirementMapsTable,
  controlTestsTable,
  findingsTable,
  alertsTable,
  risksTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ComplianceScoreResult {
  score: number;
  coverageScore: number;
  effectivenessScore: number;
  totalRequirements: number;
  coveredRequirements: number;
  totalControls: number;
  passedControls: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// computeComplianceScore
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the compliance score for a framework+tenant combination.
 * Uses the exact formula from compliance.ts:
 *   score = Math.round(coverageScore * 0.6 + effectivenessScore * 0.4)
 */
export async function computeComplianceScore(
  frameworkId: string,
  tenantId: string,
): Promise<ComplianceScoreResult> {
  // Fetch all requirements for this framework+tenant
  const requirements = await db
    .select({ id: frameworkRequirementsTable.id })
    .from(frameworkRequirementsTable)
    .where(
      and(
        eq(frameworkRequirementsTable.frameworkId, frameworkId),
        eq(frameworkRequirementsTable.tenantId, tenantId),
      ),
    );

  const totalRequirements = requirements.length;

  if (totalRequirements === 0) {
    return {
      score: 0,
      coverageScore: 0,
      effectivenessScore: 0,
      totalRequirements: 0,
      coveredRequirements: 0,
      totalControls: 0,
      passedControls: 0,
    };
  }

  const reqIds = requirements.map((r) => r.id);

  // Fetch control-requirement mappings
  const mappings = await db
    .select({
      requirementId: controlRequirementMapsTable.requirementId,
      controlId: controlRequirementMapsTable.controlId,
    })
    .from(controlRequirementMapsTable)
    .where(
      and(
        eq(controlRequirementMapsTable.tenantId, tenantId),
        inArray(controlRequirementMapsTable.requirementId, reqIds),
      ),
    );

  const coveredReqIds = new Set(mappings.map((m) => m.requirementId));

  const controlIdSet = new Set<string>();
  for (const m of mappings) controlIdSet.add(m.controlId);
  const controlIds = Array.from(controlIdSet);

  let passedControls = 0;
  if (controlIds.length > 0) {
    const latestTests = await db
      .select({
        controlId: controlTestsTable.controlId,
        result: controlTestsTable.result,
      })
      .from(controlTestsTable)
      .where(
        and(
          eq(controlTestsTable.tenantId, tenantId),
          inArray(controlTestsTable.controlId, controlIds),
        ),
      )
      .orderBy(controlTestsTable.testedAt);

    // Keep only the latest test per control
    const latestByControl: Record<string, string> = {};
    for (const t of latestTests) {
      latestByControl[t.controlId] = t.result;
    }
    passedControls = Object.values(latestByControl).filter((r) => r === "pass").length;
  }

  const coveredRequirements = coveredReqIds.size;
  const coverageScore = Math.round((coveredRequirements / totalRequirements) * 100);
  const effectivenessScore =
    controlIds.length > 0 ? Math.round((passedControls / controlIds.length) * 100) : 0;
  const score = Math.round(coverageScore * 0.6 + effectivenessScore * 0.4);

  return {
    score,
    coverageScore,
    effectivenessScore,
    totalRequirements,
    coveredRequirements,
    totalControls: controlIds.length,
    passedControls,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// getComplianceStatus
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Classify a compliance score relative to the configured threshold.
 * - COMPLIANT:      score >= threshold
 * - AT-RISK:        score >= threshold - 15 (within 15% of failing)
 * - NON-COMPLIANT:  score < threshold - 15
 */
export function getComplianceStatus(
  score: number,
  threshold: number,
): "COMPLIANT" | "AT-RISK" | "NON-COMPLIANT" {
  if (score >= threshold) return "COMPLIANT";
  if (score >= threshold - 15) return "AT-RISK";
  return "NON-COMPLIANT";
}

// ──────────────────────────────────────────────────────────────────────────────
// recalculateAndTriggerPipeline
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Recalculate compliance score for a framework and trigger threshold-driven
 * findings/alerts/risks pipeline.
 *
 * - If score drops below threshold: creates finding + alert + draft risk (idempotently)
 * - If score recovers above threshold: auto-resolves open findings and alerts
 * - If no threshold is configured: returns early with action "none"
 */
export async function recalculateAndTriggerPipeline(
  frameworkId: string,
  tenantId: string,
): Promise<{ score: number; status: string; action: "none" | "created" | "resolved" }> {
  // 1. Compute score
  const scoreResult = await computeComplianceScore(frameworkId, tenantId);
  const { score } = scoreResult;

  // 2. Fetch framework to get name + threshold
  const [framework] = await db
    .select({
      id: frameworksTable.id,
      name: frameworksTable.name,
      complianceThreshold: frameworksTable.complianceThreshold,
    })
    .from(frameworksTable)
    .where(and(eq(frameworksTable.id, frameworkId), eq(frameworksTable.tenantId, tenantId)))
    .limit(1);

  // 3. Early return if no threshold configured
  if (!framework || framework.complianceThreshold === null || framework.complianceThreshold === undefined) {
    return { score, status: "UNKNOWN", action: "none" };
  }

  const threshold = Number(framework.complianceThreshold);
  const status = getComplianceStatus(score, threshold);
  const findingTitle = `Compliance gap: ${framework.name}`;

  // 4a. Breach: score < threshold
  if (score < threshold) {
    // Check for existing open/investigating finding (idempotency)
    const [existingFinding] = await db
      .select({ id: findingsTable.id })
      .from(findingsTable)
      .where(
        and(
          eq(findingsTable.tenantId, tenantId),
          eq(findingsTable.title, findingTitle),
          inArray(findingsTable.status, ["open", "investigating"] as const),
        ),
      )
      .limit(1);

    if (!existingFinding) {
      // Create finding
      await db.insert(findingsTable).values({
        tenantId,
        title: findingTitle,
        description: `Framework "${framework.name}" compliance score (${score}%) is below configured threshold (${threshold}%).`,
        status: "open",
      });

      // Create alert (dedup by type+title+active status, same as monitoring.ts pattern)
      const [existingAlert] = await db
        .select({ id: alertsTable.id })
        .from(alertsTable)
        .where(
          and(
            eq(alertsTable.tenantId, tenantId),
            eq(alertsTable.type, "compliance_threshold_breach"),
            eq(alertsTable.title, findingTitle),
            eq(alertsTable.status, "active"),
          ),
        )
        .limit(1);

      if (!existingAlert) {
        await db.insert(alertsTable).values({
          tenantId,
          type: "compliance_threshold_breach",
          title: findingTitle,
          description: `Compliance score ${score}% is below threshold ${threshold}% for framework "${framework.name}".`,
          severity: "high",
        });
      }

      // Create draft risk
      await db.insert(risksTable).values({
        tenantId,
        title: `Risk: ${framework.name} compliance below threshold`,
        description: `Compliance score for "${framework.name}" has dropped to ${score}%, below configured threshold of ${threshold}%.`,
        category: "compliance",
        status: "draft",
        likelihood: 3,
        impact: 3,
      });
    }

    return { score, status, action: "created" };
  }

  // 4b. Recovery: score >= threshold — resolve open findings + alerts
  const openFindings = await db
    .select({ id: findingsTable.id })
    .from(findingsTable)
    .where(
      and(
        eq(findingsTable.tenantId, tenantId),
        eq(findingsTable.title, findingTitle),
        inArray(findingsTable.status, ["open", "investigating"] as const),
      ),
    );

  if (openFindings.length > 0) {
    const findingIds = openFindings.map((f) => f.id);
    await db
      .update(findingsTable)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(inArray(findingsTable.id, findingIds));
  }

  const openAlerts = await db
    .select({ id: alertsTable.id })
    .from(alertsTable)
    .where(
      and(
        eq(alertsTable.tenantId, tenantId),
        eq(alertsTable.title, findingTitle),
        inArray(alertsTable.status, ["active"] as const),
      ),
    );

  if (openAlerts.length > 0) {
    const alertIds = openAlerts.map((a) => a.id);
    await db
      .update(alertsTable)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(inArray(alertsTable.id, alertIds));
  }

  return { score, status, action: "resolved" };
}
