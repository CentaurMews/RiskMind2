import { Router, type Request } from "express";
import { eq, and, sql } from "drizzle-orm";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}

import { db, alertsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, conflict } from "../lib/errors";

const router = Router();

router.get("/v1/alerts", async (req, res) => {
  try {
    const { severity, status, type, page = "1", limit = "20" } = req.query;
    const tenantId = req.user!.tenantId;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [eq(alertsTable.tenantId, tenantId)];
    if (severity) conditions.push(eq(alertsTable.severity, severity as "critical" | "high" | "medium" | "low"));
    if (status) conditions.push(eq(alertsTable.status, status as "active" | "acknowledged" | "resolved" | "escalated"));
    if (type) conditions.push(eq(alertsTable.type, String(type)));

    const [alerts, countResult] = await Promise.all([
      db.select().from(alertsTable)
        .where(and(...conditions))
        .limit(Number(limit))
        .offset(offset)
        .orderBy(alertsTable.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(alertsTable)
        .where(and(...conditions)),
    ]);

    res.json({ data: alerts, total: countResult[0].count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("List alerts error:", err);
    serverError(res);
  }
});

router.get("/v1/alerts/summary", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    const [activeCount] = await db.select({ count: sql<number>`count(*)::int` }).from(alertsTable)
      .where(and(eq(alertsTable.tenantId, tenantId), eq(alertsTable.status, "active")));
    const [acknowledgedCount] = await db.select({ count: sql<number>`count(*)::int` }).from(alertsTable)
      .where(and(eq(alertsTable.tenantId, tenantId), eq(alertsTable.status, "acknowledged")));
    const [escalatedCount] = await db.select({ count: sql<number>`count(*)::int` }).from(alertsTable)
      .where(and(eq(alertsTable.tenantId, tenantId), eq(alertsTable.status, "escalated")));

    const bySeverity = await db.select({
      severity: alertsTable.severity,
      count: sql<number>`count(*)::int`,
    }).from(alertsTable)
      .where(and(eq(alertsTable.tenantId, tenantId), eq(alertsTable.status, "active")))
      .groupBy(alertsTable.severity);

    const severityMap: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const row of bySeverity) {
      severityMap[row.severity] = row.count;
    }

    res.json({
      active: activeCount.count,
      acknowledged: acknowledgedCount.count,
      escalated: escalatedCount.count,
      bySeverity: severityMap,
    });
  } catch (err) {
    console.error("Alert summary error:", err);
    serverError(res);
  }
});

router.get("/v1/alerts/:id", async (req, res) => {
  try {
    const [alert] = await db.select().from(alertsTable)
      .where(and(eq(alertsTable.id, p(req, "id")), eq(alertsTable.tenantId, req.user!.tenantId)))
      .limit(1);

    if (!alert) { notFound(res, "Alert not found"); return; }
    res.json(alert);
  } catch (err) {
    console.error("Get alert error:", err);
    serverError(res);
  }
});

router.patch("/v1/alerts/:id/acknowledge", requireRole("admin", "risk_manager", "auditor", "risk_owner"), async (req, res) => {
  try {
    const [existing] = await db.select().from(alertsTable)
      .where(and(eq(alertsTable.id, p(req, "id")), eq(alertsTable.tenantId, req.user!.tenantId)))
      .limit(1);

    if (!existing) { notFound(res, "Alert not found"); return; }
    if (existing.status === "resolved") { conflict(res, "Alert is already resolved"); return; }
    if (existing.status === "acknowledged") { conflict(res, "Alert is already acknowledged"); return; }

    const [updated] = await db.update(alertsTable).set({
      status: "acknowledged",
      acknowledgedBy: req.user!.id,
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(alertsTable.id, p(req, "id"))).returning();

    await recordAudit(req, "acknowledge", "alert", updated.id);
    res.json(updated);
  } catch (err) {
    console.error("Acknowledge alert error:", err);
    serverError(res);
  }
});

router.patch("/v1/alerts/:id/resolve", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const [existing] = await db.select().from(alertsTable)
      .where(and(eq(alertsTable.id, p(req, "id")), eq(alertsTable.tenantId, req.user!.tenantId)))
      .limit(1);

    if (!existing) { notFound(res, "Alert not found"); return; }
    if (existing.status === "resolved") { conflict(res, "Alert is already resolved"); return; }

    const [updated] = await db.update(alertsTable).set({
      status: "resolved",
      updatedAt: new Date(),
    }).where(eq(alertsTable.id, p(req, "id"))).returning();

    await recordAudit(req, "resolve", "alert", updated.id);
    res.json(updated);
  } catch (err) {
    console.error("Resolve alert error:", err);
    serverError(res);
  }
});

export default router;
