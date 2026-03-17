import { Router, type Request } from "express";
import { eq, and, sql, ilike } from "drizzle-orm";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}

import { db, signalsTable, findingsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, conflict } from "../lib/errors";
import { enqueueJob } from "../lib/job-queue";
import { RiskSourceAggregator } from "../services/risk-source-aggregator";

const SIGNAL_TRANSITIONS: Record<string, string[]> = {
  pending: ["triaged"],
  triaged: ["finding", "dismissed"],
  finding: [],
  dismissed: [],
};

const router = Router();

router.get("/v1/signals", async (req, res) => {
  try {
    const { status, source, search, page = "1", limit = "20" } = req.query;
    const tenantId = req.user!.tenantId;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [eq(signalsTable.tenantId, tenantId)];
    if (status) conditions.push(eq(signalsTable.status, status as "pending" | "triaged" | "finding" | "dismissed"));
    if (source) conditions.push(eq(signalsTable.source, String(source)));
    if (search) conditions.push(ilike(signalsTable.content, `%${search}%`));

    const [signals, countResult] = await Promise.all([
      db.select().from(signalsTable)
        .where(and(...conditions))
        .limit(Number(limit))
        .offset(offset)
        .orderBy(signalsTable.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(signalsTable)
        .where(and(...conditions)),
    ]);

    res.json({ data: signals, total: countResult[0].count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("List signals error:", err);
    serverError(res);
  }
});

router.post("/v1/signals", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const body = req.body;
    const tenantId = req.user!.tenantId;

    if (Array.isArray(body)) {
      if (body.length === 0) { badRequest(res, "At least one signal is required"); return; }
      if (body.length > 100) { badRequest(res, "Maximum 100 signals per batch"); return; }

      const values = body.map((s: { source?: string; content?: string }) => {
        if (!s.source || !s.content) throw new Error("Each signal requires source and content");
        return { tenantId, source: s.source, content: s.content };
      });

      const inserted = await db.insert(signalsTable).values(values).returning();

      for (const signal of inserted) {
        await enqueueJob("ai-triage", "classify", { signalId: signal.id }, tenantId);
      }

      await recordAudit(req, "bulk_create", "signal", undefined, { count: inserted.length });
      res.status(201).json({ data: inserted, count: inserted.length });
      return;
    }

    const { source, content } = body;
    if (!source || !content) { badRequest(res, "source and content are required"); return; }

    const [signal] = await db.insert(signalsTable).values({ tenantId, source, content }).returning();

    await enqueueJob("ai-triage", "classify", { signalId: signal.id }, tenantId);
    await recordAudit(req, "create", "signal", signal.id);
    res.status(201).json(signal);
  } catch (err) {
    if (err instanceof Error && err.message.includes("requires source and content")) {
      badRequest(res, err.message);
      return;
    }
    console.error("Create signal error:", err);
    serverError(res);
  }
});

router.get("/v1/signals/:id", async (req, res) => {
  try {
    const [signal] = await db.select().from(signalsTable)
      .where(and(eq(signalsTable.id, p(req, "id")), eq(signalsTable.tenantId, req.user!.tenantId)))
      .limit(1);

    if (!signal) { notFound(res, "Signal not found"); return; }
    res.json(signal);
  } catch (err) {
    console.error("Get signal error:", err);
    serverError(res);
  }
});

router.patch("/v1/signals/:id/status", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const { status, classification, confidence } = req.body;
    if (!status) { badRequest(res, "status is required"); return; }

    const [existing] = await db.select().from(signalsTable)
      .where(and(eq(signalsTable.id, p(req, "id")), eq(signalsTable.tenantId, req.user!.tenantId)))
      .limit(1);

    if (!existing) { notFound(res, "Signal not found"); return; }

    const allowed = SIGNAL_TRANSITIONS[existing.status];
    if (!allowed || !allowed.includes(status)) {
      conflict(res, `Cannot transition from '${existing.status}' to '${status}'. Allowed: ${(allowed || []).join(", ") || "none"}`);
      return;
    }

    const [updated] = await db.update(signalsTable).set({
      status,
      ...(classification !== undefined && { classification }),
      ...(confidence !== undefined && { confidence: String(confidence) }),
      updatedAt: new Date(),
    }).where(eq(signalsTable.id, p(req, "id"))).returning();

    await recordAudit(req, "transition", "signal", updated.id, { from: existing.status, to: status });
    res.json(updated);
  } catch (err) {
    console.error("Update signal status error:", err);
    serverError(res);
  }
});

router.post("/v1/signals/:id/triage", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const signalId = p(req, "id");
    const aggregator = new RiskSourceAggregator(tenantId);
    const result = await aggregator.triageSignal(signalId);

    await recordAudit(req, "triage", "signal", signalId, { findingId: result.finding.id });
    res.status(201).json({ signal: result.signal, finding: result.finding });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Signal not found") { notFound(res, err.message); return; }
      if (err.message.includes("expected 'pending' or 'triaged'")) { conflict(res, err.message); return; }
      if (err.message.includes("changed concurrently")) { conflict(res, err.message); return; }
    }
    console.error("Triage signal error:", err);
    serverError(res);
  }
});

router.get("/v1/signals/:id/finding", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const signalId = p(req, "id");

    const [signal] = await db.select().from(signalsTable)
      .where(and(eq(signalsTable.id, signalId), eq(signalsTable.tenantId, tenantId)))
      .limit(1);
    if (!signal) { notFound(res, "Signal not found"); return; }

    const [finding] = await db.select().from(findingsTable)
      .where(and(eq(findingsTable.signalId, signalId), eq(findingsTable.tenantId, tenantId)))
      .limit(1);
    if (!finding) { notFound(res, "No finding linked to this signal"); return; }

    res.json(finding);
  } catch (err) {
    console.error("Get signal finding error:", err);
    serverError(res);
  }
});

router.post("/v1/signals/:id/retrigger-triage", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const signalId = p(req, "id");

    const [signal] = await db.select().from(signalsTable)
      .where(and(eq(signalsTable.id, signalId), eq(signalsTable.tenantId, tenantId)))
      .limit(1);

    if (!signal) { notFound(res, "Signal not found"); return; }
    if (signal.status !== "pending") {
      badRequest(res, "Only pending signals can be retriggered for AI triage");
      return;
    }

    const job = await enqueueJob("ai-triage", "classify", { signalId }, tenantId);
    await recordAudit(req, "retrigger_triage", "signal", signalId, { jobId: job.id });

    res.json({ jobId: job.id, status: "queued", message: "AI triage job re-queued" });
  } catch (err) {
    console.error("Retrigger triage error:", err);
    serverError(res);
  }
});

export default router;
