import { Router, type Request, type Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, agentRunsTable, agentFindingsTable, tenantsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, sendError } from "../lib/errors";
import { runAgentCycle, getTenantAgentConfig } from "../lib/agent-service";

const router = Router();

router.get("/v1/agent/runs", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const [runs, countResult] = await Promise.all([
      db.select().from(agentRunsTable)
        .where(eq(agentRunsTable.tenantId, tenantId))
        .orderBy(desc(agentRunsTable.createdAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(agentRunsTable)
        .where(eq(agentRunsTable.tenantId, tenantId)),
    ]);

    res.json({ data: runs, total: countResult[0].count, page, limit });
  } catch (err) {
    console.error("List agent runs error:", err);
    serverError(res);
  }
});

router.get("/v1/agent/findings", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const conditions = [eq(agentFindingsTable.tenantId, tenantId)];

    const typeFilter = req.query.type as string | undefined;
    if (typeFilter && ["cascade_chain", "cluster", "predictive_signal", "anomaly", "cross_domain", "recommendation"].includes(typeFilter)) {
      conditions.push(eq(agentFindingsTable.type, typeFilter as "cascade_chain" | "cluster" | "predictive_signal" | "anomaly" | "cross_domain" | "recommendation"));
    }

    const severityFilter = req.query.severity as string | undefined;
    if (severityFilter && ["critical", "high", "medium", "low", "info"].includes(severityFilter)) {
      conditions.push(eq(agentFindingsTable.severity, severityFilter as "critical" | "high" | "medium" | "low" | "info"));
    }

    const statusFilter = req.query.status as string | undefined;
    if (statusFilter && ["pending_review", "dismissed", "actioned"].includes(statusFilter)) {
      conditions.push(eq(agentFindingsTable.status, statusFilter as "pending_review" | "dismissed" | "actioned"));
    }

    const [findings, countResult] = await Promise.all([
      db.select().from(agentFindingsTable)
        .where(and(...conditions))
        .orderBy(desc(agentFindingsTable.createdAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(agentFindingsTable)
        .where(and(...conditions)),
    ]);

    res.json({ data: findings, total: countResult[0].count, page, limit });
  } catch (err) {
    console.error("List agent findings error:", err);
    serverError(res);
  }
});

router.get("/v1/agent/queue", requireRole("admin", "risk_manager", "auditor"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const [findings, countResult] = await Promise.all([
      db.select().from(agentFindingsTable)
        .where(and(
          eq(agentFindingsTable.tenantId, tenantId),
          eq(agentFindingsTable.status, "pending_review"),
        ))
        .orderBy(desc(agentFindingsTable.createdAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(agentFindingsTable)
        .where(and(
          eq(agentFindingsTable.tenantId, tenantId),
          eq(agentFindingsTable.status, "pending_review"),
        )),
    ]);

    res.json({ data: findings, total: countResult[0].count, page, limit });
  } catch (err) {
    console.error("Get agent queue error:", err);
    serverError(res);
  }
});

router.post("/v1/agent/runs", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const [tenant] = await db.select({ settings: tenantsTable.settings }).from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId)).limit(1);

    const config = getTenantAgentConfig(tenant?.settings);
    const policyTier = config.agentPolicyTier || "observe";

    await recordAudit(req, "agent_run_triggered", "agent_run", undefined, { policyTier, manual: true });

    const runId = await runAgentCycle(tenantId, policyTier);

    const [run] = await db.select().from(agentRunsTable)
      .where(eq(agentRunsTable.id, runId)).limit(1);

    res.status(201).json(run);
  } catch (err) {
    console.error("Trigger agent run error:", err);
    serverError(res);
  }
});

router.post("/v1/agent/findings/:id/approve", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const findingId = String(req.params.id);

    const [finding] = await db.select().from(agentFindingsTable)
      .where(and(eq(agentFindingsTable.id, findingId), eq(agentFindingsTable.tenantId, tenantId)))
      .limit(1);

    if (!finding) { notFound(res, "Finding not found"); return; }
    if (finding.status !== "pending_review") { badRequest(res, "Finding is not pending review"); return; }

    const [updated] = await db.update(agentFindingsTable).set({
      status: "actioned",
      actionedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(agentFindingsTable.id, findingId)).returning();

    await recordAudit(req, "agent_finding_approved", "agent_finding", findingId, {
      type: finding.type,
      severity: finding.severity,
    });

    res.json(updated);
  } catch (err) {
    console.error("Approve finding error:", err);
    serverError(res);
  }
});

router.post("/v1/agent/findings/:id/dismiss", requireRole("admin", "risk_manager"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const findingId = String(req.params.id);
    const { reason } = req.body as { reason?: string };

    const [finding] = await db.select().from(agentFindingsTable)
      .where(and(eq(agentFindingsTable.id, findingId), eq(agentFindingsTable.tenantId, tenantId)))
      .limit(1);

    if (!finding) { notFound(res, "Finding not found"); return; }
    if (finding.status !== "pending_review") { badRequest(res, "Finding is not pending review"); return; }

    const [updated] = await db.update(agentFindingsTable).set({
      status: "dismissed",
      dismissedReason: reason || null,
      updatedAt: new Date(),
    }).where(eq(agentFindingsTable.id, findingId)).returning();

    await recordAudit(req, "agent_finding_dismissed", "agent_finding", findingId, {
      type: finding.type,
      severity: finding.severity,
      reason,
    });

    res.json(updated);
  } catch (err) {
    console.error("Dismiss finding error:", err);
    serverError(res);
  }
});

router.get("/v1/agent/config", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const [tenant] = await db.select({ settings: tenantsTable.settings }).from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId)).limit(1);

    const config = getTenantAgentConfig(tenant?.settings);

    const [lastRun] = await db.select().from(agentRunsTable)
      .where(eq(agentRunsTable.tenantId, tenantId))
      .orderBy(desc(agentRunsTable.createdAt))
      .limit(1);

    const [tokenUsage] = await db.select({
      totalTokens: sql<number>`COALESCE(SUM(token_count), 0)::int`,
      totalRuns: sql<number>`count(*)::int`,
    }).from(agentRunsTable)
      .where(eq(agentRunsTable.tenantId, tenantId));

    res.json({
      enabled: config.agentEnabled ?? true,
      policyTier: config.agentPolicyTier || "observe",
      schedule: config.agentSchedule || "0 6 * * *",
      lastRun: lastRun || null,
      tokenUsage: {
        totalTokens: tokenUsage?.totalTokens || 0,
        totalRuns: tokenUsage?.totalRuns || 0,
      },
    });
  } catch (err) {
    console.error("Get agent config error:", err);
    serverError(res);
  }
});

router.put("/v1/agent/config", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { enabled, policyTier, schedule } = req.body as {
      enabled?: boolean;
      policyTier?: string;
      schedule?: string;
    };

    if (policyTier !== undefined && !["observe", "advisory", "active"].includes(policyTier)) {
      badRequest(res, "policyTier must be 'observe', 'advisory', or 'active'");
      return;
    }

    if (schedule !== undefined && typeof schedule !== "string") {
      badRequest(res, "schedule must be a cron expression string");
      return;
    }

    const [tenant] = await db.select({ settings: tenantsTable.settings }).from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId)).limit(1);

    const currentSettings = (tenant?.settings || {}) as Record<string, unknown>;
    const updatedSettings = { ...currentSettings };

    if (enabled !== undefined) updatedSettings.agentEnabled = enabled;
    if (policyTier !== undefined) updatedSettings.agentPolicyTier = policyTier;
    if (schedule !== undefined) updatedSettings.agentSchedule = schedule;

    await db.update(tenantsTable).set({
      settings: updatedSettings,
      updatedAt: new Date(),
    }).where(eq(tenantsTable.id, tenantId));

    await recordAudit(req, "agent_config_updated", "tenant", tenantId, {
      enabled, policyTier, schedule,
    });

    const config = getTenantAgentConfig(updatedSettings);
    res.json({
      enabled: config.agentEnabled ?? true,
      policyTier: config.agentPolicyTier || "observe",
      schedule: config.agentSchedule || "0 6 * * *",
    });
  } catch (err) {
    console.error("Update agent config error:", err);
    serverError(res);
  }
});

export default router;
