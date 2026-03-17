import { Router, type Request, type Response } from "express";
import { eq, and, sql } from "drizzle-orm";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}

import { db, findingsTable, signalsTable, risksTable, riskSourcesTable, vendorsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, conflict } from "../lib/errors";
import { complete, isAvailable, LLMUnavailableError } from "../lib/llm-service";

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

    if (signalId) {
      const [s] = await db.select({ id: signalsTable.id }).from(signalsTable)
        .where(and(eq(signalsTable.id, signalId), eq(signalsTable.tenantId, tenantId))).limit(1);
      if (!s) { notFound(res, "Signal not found in this tenant"); return; }
    }
    if (riskId) {
      const [r] = await db.select({ id: risksTable.id }).from(risksTable)
        .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId))).limit(1);
      if (!r) { notFound(res, "Risk not found in this tenant"); return; }
    }
    if (vendorId) {
      const [v] = await db.select({ id: vendorsTable.id }).from(vendorsTable)
        .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);
      if (!v) { notFound(res, "Vendor not found in this tenant"); return; }
    }

    const [finding] = await db.insert(findingsTable).values({
      tenantId,
      signalId: signalId || null,
      riskId: riskId || null,
      vendorId: vendorId || null,
      title,
      description: description || null,
    }).returning();

    if (signalId) {
      const [sig] = await db.select({ status: signalsTable.status }).from(signalsTable)
        .where(and(eq(signalsTable.id, signalId), eq(signalsTable.tenantId, tenantId))).limit(1);
      if (sig && sig.status === "triaged") {
        await db.update(signalsTable).set({
          status: "finding",
          updatedAt: new Date(),
        }).where(and(eq(signalsTable.id, signalId), eq(signalsTable.tenantId, tenantId)));
      }
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

    if (riskId) {
      const [r] = await db.select({ id: risksTable.id }).from(risksTable)
        .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId))).limit(1);
      if (!r) { notFound(res, "Risk not found in this tenant"); return; }
    }
    if (vendorId) {
      const [v] = await db.select({ id: vendorsTable.id }).from(vendorsTable)
        .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);
      if (!v) { notFound(res, "Vendor not found in this tenant"); return; }
    }

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

    if (riskId) {
      const [r] = await db.select({ id: risksTable.id }).from(risksTable)
        .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId))).limit(1);
      if (!r) { notFound(res, "Risk not found in this tenant"); return; }
    }
    if (vendorId) {
      const [v] = await db.select({ id: vendorsTable.id }).from(vendorsTable)
        .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);
      if (!v) { notFound(res, "Vendor not found in this tenant"); return; }
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

router.post("/v1/findings/:id/suggest-risk", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const findingId = p(req, "id");

    const [finding] = await db.select().from(findingsTable)
      .where(and(eq(findingsTable.id, findingId), eq(findingsTable.tenantId, tenantId)))
      .limit(1);
    if (!finding) { notFound(res, "Finding not found"); return; }

    let signalContent = "";
    if (finding.signalId) {
      const [signal] = await db.select().from(signalsTable)
        .where(and(eq(signalsTable.id, finding.signalId), eq(signalsTable.tenantId, tenantId))).limit(1);
      if (signal) signalContent = signal.content;
    }

    const available = await isAvailable(tenantId);
    if (!available) {
      res.json({
        title: finding.title,
        description: finding.description || "",
        category: "operational",
        likelihood: 3,
        impact: 3,
        confidence: 0,
        source: "fallback",
      });
      return;
    }

    const raw = await complete(tenantId, {
      messages: [
        {
          role: "system",
          content: `You are a risk analyst. Given a finding (and optionally its source signal), suggest a risk entry.
Respond ONLY with JSON:
{
  "title": "short risk title",
  "description": "detailed risk description",
  "category": "one of: operational, financial, compliance, strategic, technology, reputational",
  "likelihood": 1-5,
  "impact": 1-5,
  "confidence": 0.0-1.0
}`,
        },
        {
          role: "user",
          content: `Finding title: ${finding.title}\nFinding description: ${finding.description || "N/A"}\n${signalContent ? `Signal content: ${signalContent}` : ""}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 500,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      res.json({
        title: finding.title,
        description: finding.description || "",
        category: "operational",
        likelihood: 3,
        impact: 3,
        confidence: 0,
        source: "fallback",
      });
      return;
    }
    const validCategories = ["operational", "financial", "compliance", "strategic", "technology", "reputational"];

    res.json({
      title: (parsed.title as string) || finding.title,
      description: (parsed.description as string) || finding.description || "",
      category: validCategories.includes(parsed.category as string) ? parsed.category : "operational",
      likelihood: Math.max(1, Math.min(5, parseInt(String(parsed.likelihood)) || 3)),
      impact: Math.max(1, Math.min(5, parseInt(String(parsed.impact)) || 3)),
      confidence: Math.max(0, Math.min(1, parseFloat(String(parsed.confidence)) || 0.5)),
      source: "ai",
    });
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      badRequest(res, err.message);
      return;
    }
    console.error("Suggest risk error:", err);
    serverError(res);
  }
});

router.post("/v1/findings/:id/convert-to-risk", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const findingId = p(req, "id");
    const { title, description, category, likelihood, impact } = req.body;

    const validCategories = ["operational", "financial", "compliance", "strategic", "technology", "reputational"];
    const resolvedCategory = category && validCategories.includes(category) ? category : "operational";
    const resolvedLikelihood = Math.max(1, Math.min(5, parseInt(likelihood) || 3));
    const resolvedImpact = Math.max(1, Math.min(5, parseInt(impact) || 3));

    const risk = await db.transaction(async (tx) => {
      const [finding] = await tx.select().from(findingsTable)
        .where(and(eq(findingsTable.id, findingId), eq(findingsTable.tenantId, tenantId)))
        .limit(1);
      if (!finding) throw new Error("FINDING_NOT_FOUND");
      if (finding.riskId) throw new Error("ALREADY_LINKED");

      const [newRisk] = await tx.insert(risksTable).values({
        tenantId,
        title: title || finding.title,
        description: description || finding.description || "",
        category: resolvedCategory,
        status: "draft",
        likelihood: resolvedLikelihood,
        impact: resolvedImpact,
      }).returning();

      await tx.insert(riskSourcesTable).values({
        riskId: newRisk.id,
        sourceType: "finding",
        sourceId: findingId,
      });

      const [updatedFinding] = await tx.update(findingsTable).set({
        riskId: newRisk.id,
        updatedAt: new Date(),
      }).where(
        and(eq(findingsTable.id, findingId), sql`${findingsTable.riskId} IS NULL`)
      ).returning();

      if (!updatedFinding) throw new Error("ALREADY_LINKED");

      return newRisk;
    });

    await recordAudit(req, "convert_to_risk", "finding", findingId, { riskId: risk.id });
    res.status(201).json(risk);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "FINDING_NOT_FOUND") { notFound(res, "Finding not found"); return; }
      if (err.message === "ALREADY_LINKED") { conflict(res, "Finding is already linked to a risk"); return; }
    }
    console.error("Convert finding to risk error:", err);
    serverError(res);
  }
});

export default router;
