import { Router, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}

import { db, findingsTable, signalsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, conflict } from "../lib/errors";

const FINDING_TRANSITIONS: Record<string, string[]> = {
  open: ["investigating", "resolved", "false_positive"],
  investigating: ["resolved", "false_positive"],
  resolved: [],
  false_positive: [],
};

const router = Router();

router.get("/v1/findings", async (req, res) => {
  try {
    const { status, riskId, vendorId, page = "1", limit = "20" } = req.query;
    const tenantId = req.user!.tenantId;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [eq(findingsTable.tenantId, tenantId)];
    if (status) conditions.push(eq(findingsTable.status, status as "open" | "investigating" | "resolved" | "false_positive"));
    if (riskId) conditions.push(eq(findingsTable.riskId, String(riskId)));
    if (vendorId) conditions.push(eq(findingsTable.vendorId, String(vendorId)));

    const [findings, countResult] = await Promise.all([
      db.select().from(findingsTable)
        .where(and(...conditions))
        .limit(Number(limit))
        .offset(offset)
        .orderBy(findingsTable.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(findingsTable)
        .where(and(...conditions)),
    ]);

    res.json({ data: findings, total: countResult[0].count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("List findings error:", err);
    serverError(res);
  }
});

router.post("/v1/findings", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const { signalId, riskId, vendorId, title, description } = req.body;
    if (!title) { badRequest(res, "title is required"); return; }
    const tenantId = req.user!.tenantId;

    const [finding] = await db.insert(findingsTable).values({
      tenantId,
      signalId: signalId || null,
      riskId: riskId || null,
      vendorId: vendorId || null,
      title,
      description: description || null,
    }).returning();

    if (signalId) {
      await db.update(signalsTable).set({
        status: "finding",
        updatedAt: new Date(),
      }).where(and(eq(signalsTable.id, signalId), eq(signalsTable.tenantId, tenantId)));
    }

    await recordAudit(req, "create", "finding", finding.id, { signalId, riskId, vendorId });
    res.status(201).json(finding);
  } catch (err) {
    console.error("Create finding error:", err);
    serverError(res);
  }
});

router.post("/v1/signals/:signalId/promote", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const signalId = p(req, "signalId");
    const tenantId = req.user!.tenantId;

    const [signal] = await db.select().from(signalsTable)
      .where(and(eq(signalsTable.id, signalId), eq(signalsTable.tenantId, tenantId)))
      .limit(1);

    if (!signal) { notFound(res, "Signal not found"); return; }
    if (signal.status === "finding") { conflict(res, "Signal has already been promoted to a finding"); return; }
    if (signal.status === "dismissed") { conflict(res, "Cannot promote a dismissed signal"); return; }
    if (signal.status === "pending") { conflict(res, "Signal must be triaged before promotion. Current status: pending"); return; }

    const { title, description, riskId, vendorId } = req.body;

    const [finding] = await db.insert(findingsTable).values({
      tenantId,
      signalId,
      riskId: riskId || null,
      vendorId: vendorId || null,
      title: title || `Finding from signal: ${signal.content.substring(0, 100)}`,
      description: description || signal.content,
    }).returning();

    await db.update(signalsTable).set({
      status: "finding",
      updatedAt: new Date(),
    }).where(eq(signalsTable.id, signalId));

    await recordAudit(req, "promote", "signal", signalId, { findingId: finding.id });
    res.status(201).json(finding);
  } catch (err) {
    console.error("Promote signal error:", err);
    serverError(res);
  }
});

router.get("/v1/findings/:id", async (req, res) => {
  try {
    const [finding] = await db.select().from(findingsTable)
      .where(and(eq(findingsTable.id, p(req, "id")), eq(findingsTable.tenantId, req.user!.tenantId)))
      .limit(1);

    if (!finding) { notFound(res, "Finding not found"); return; }
    res.json(finding);
  } catch (err) {
    console.error("Get finding error:", err);
    serverError(res);
  }
});

router.patch("/v1/findings/:id", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const { status, riskId, vendorId, title, description } = req.body;
    const tenantId = req.user!.tenantId;

    if (status) {
      const [existing] = await db.select().from(findingsTable)
        .where(and(eq(findingsTable.id, p(req, "id")), eq(findingsTable.tenantId, tenantId)))
        .limit(1);

      if (!existing) { notFound(res, "Finding not found"); return; }

      const allowed = FINDING_TRANSITIONS[existing.status];
      if (!allowed || !allowed.includes(status)) {
        conflict(res, `Cannot transition from '${existing.status}' to '${status}'. Allowed: ${(allowed || []).join(", ") || "none"}`);
        return;
      }
    }

    const [updated] = await db.update(findingsTable).set({
      ...(status !== undefined && { status }),
      ...(riskId !== undefined && { riskId }),
      ...(vendorId !== undefined && { vendorId }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      updatedAt: new Date(),
    }).where(and(eq(findingsTable.id, p(req, "id")), eq(findingsTable.tenantId, tenantId))).returning();

    if (!updated) { notFound(res, "Finding not found"); return; }

    await recordAudit(req, "update", "finding", updated.id);
    res.json(updated);
  } catch (err) {
    console.error("Update finding error:", err);
    serverError(res);
  }
});

export default router;
