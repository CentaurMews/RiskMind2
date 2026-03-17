import { Router, type Request, type Response } from "express";
import { eq, and, sql, ilike } from "drizzle-orm";
import crypto from "crypto";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}
import {
  db,
  vendorsTable,
  vendorStatusEventsTable,
  questionnairesTable,
  documentsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit, recordAuditDirect } from "../lib/audit";
import { badRequest, notFound, serverError, conflict } from "../lib/errors";
import {
  getAllowedTransitions,
  checkPrerequisites,
  computeTierFromRiskScore,
  getLifecycleFlow,
} from "../lib/allowed-transitions";
import type { VendorStatus, VendorTier } from "../lib/allowed-transitions";

const VALID_STATUSES: VendorStatus[] = ["identification", "due_diligence", "risk_assessment", "contracting", "onboarding", "monitoring", "offboarding"];
const VALID_TIERS: VendorTier[] = ["critical", "high", "medium", "low"];

function isValidStatus(s: string): s is VendorStatus {
  return VALID_STATUSES.includes(s as VendorStatus);
}

function isValidTier(t: string): t is VendorTier {
  return VALID_TIERS.includes(t as VendorTier);
}

async function verifyVendorOwnership(vendorId: string, tenantId: string, res: Response): Promise<boolean> {
  const [vendor] = await db.select({ id: vendorsTable.id }).from(vendorsTable)
    .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);
  if (!vendor) { notFound(res, "Vendor not found"); return false; }
  return true;
}

const router = Router();

router.get("/v1/vendors", async (req, res) => {
  try {
    const { status, tier, search, page = "1", limit = "20" } = req.query;
    const tenantId = req.user!.tenantId;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [eq(vendorsTable.tenantId, tenantId)];
    if (typeof status === "string" && isValidStatus(status)) {
      conditions.push(eq(vendorsTable.status, status));
    }
    if (typeof tier === "string" && isValidTier(tier)) {
      conditions.push(eq(vendorsTable.tier, tier));
    }
    if (search) conditions.push(ilike(vendorsTable.name, `%${search}%`));

    const [vendors, countResult] = await Promise.all([
      db.select({
        id: vendorsTable.id,
        name: vendorsTable.name,
        description: vendorsTable.description,
        tier: vendorsTable.tier,
        status: vendorsTable.status,
        category: vendorsTable.category,
        contactEmail: vendorsTable.contactEmail,
        contactName: vendorsTable.contactName,
        riskScore: vendorsTable.riskScore,
        overrideTier: vendorsTable.overrideTier,
        overrideReason: vendorsTable.overrideReason,
        createdAt: vendorsTable.createdAt,
        updatedAt: vendorsTable.updatedAt,
      }).from(vendorsTable).where(and(...conditions)).limit(Number(limit)).offset(offset).orderBy(vendorsTable.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(vendorsTable).where(and(...conditions)),
    ]);

    res.json({ data: vendors, total: countResult[0].count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("List vendors error:", err);
    serverError(res);
  }
});

router.get("/v1/vendors/:id", async (req, res) => {
  try {
    const [vendor] = await db.select({
      id: vendorsTable.id,
      name: vendorsTable.name,
      description: vendorsTable.description,
      tier: vendorsTable.tier,
      status: vendorsTable.status,
      category: vendorsTable.category,
      contactEmail: vendorsTable.contactEmail,
      contactName: vendorsTable.contactName,
      riskScore: vendorsTable.riskScore,
      overrideTier: vendorsTable.overrideTier,
      overrideReason: vendorsTable.overrideReason,
      createdAt: vendorsTable.createdAt,
      updatedAt: vendorsTable.updatedAt,
    }).from(vendorsTable).where(and(eq(vendorsTable.id, p(req, "id")), eq(vendorsTable.tenantId, req.user!.tenantId))).limit(1);

    if (!vendor) { notFound(res, "Vendor not found"); return; }
    res.json(vendor);
  } catch (err) {
    console.error("Get vendor error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const { name, description, category, contactEmail, contactName, riskScore } = req.body;
    if (!name) { badRequest(res, "name is required"); return; }

    let computedTier: VendorTier = "medium";
    if (riskScore !== undefined && riskScore !== null) {
      computedTier = computeTierFromRiskScore(Number(riskScore));
    }

    const [vendor] = await db.insert(vendorsTable).values({
      tenantId: req.user!.tenantId,
      name,
      description,
      tier: computedTier,
      category,
      contactEmail,
      contactName,
      ...(riskScore !== undefined && { riskScore: String(riskScore) }),
    }).returning();

    await recordAudit(req, "create", "vendor", vendor.id);
    res.status(201).json(vendor);
  } catch (err) {
    console.error("Create vendor error:", err);
    serverError(res);
  }
});

router.put("/v1/vendors/:id", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const { name, description, category, contactEmail, contactName, riskScore, overrideTier, overrideReason } = req.body;

    const vendorId = p(req, "id");
    const tenantId = req.user!.tenantId;

    const [existingVendor] = await db.select({
      id: vendorsTable.id,
      status: vendorsTable.status,
      overrideTier: vendorsTable.overrideTier,
      riskScore: vendorsTable.riskScore,
    }).from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)))
      .limit(1);

    if (!existingVendor) { notFound(res, "Vendor not found"); return; }

    const updates: Partial<{
      name: string;
      description: string | null;
      category: string | null;
      contactEmail: string | null;
      contactName: string | null;
      riskScore: string;
      tier: VendorTier;
      overrideTier: VendorTier | null;
      overrideReason: string | null;
      updatedAt: Date;
    }> = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(contactName !== undefined && { contactName }),
      updatedAt: new Date(),
    };

    if (overrideTier !== undefined) {
      if (overrideTier !== null && !isValidTier(overrideTier)) {
        badRequest(res, `Invalid overrideTier: ${overrideTier}`);
        return;
      }
      if (overrideTier !== null && !overrideReason) {
        badRequest(res, "overrideReason is required when setting overrideTier");
        return;
      }
      updates.overrideTier = overrideTier;
      updates.overrideReason = overrideTier !== null ? overrideReason : null;
      if (overrideTier !== null) {
        updates.tier = overrideTier;
      } else if (riskScore !== undefined && riskScore !== null) {
        updates.tier = computeTierFromRiskScore(Number(riskScore));
      } else if (existingVendor.riskScore) {
        updates.tier = computeTierFromRiskScore(Number(existingVendor.riskScore));
      }
    }

    if (riskScore !== undefined && riskScore !== null) {
      updates.riskScore = String(riskScore);
      const effectiveOverride = overrideTier !== undefined ? overrideTier : existingVendor.overrideTier;
      if (!effectiveOverride) {
        updates.tier = computeTierFromRiskScore(Number(riskScore));
      }
    }

    const [vendor] = await db.update(vendorsTable).set(updates)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).returning();

    if (!vendor) { notFound(res, "Vendor not found"); return; }

    if (overrideTier !== undefined && overrideTier !== null) {
      await db.insert(vendorStatusEventsTable).values({
        vendorId: vendor.id,
        actorId: req.user!.id,
        fromStatus: vendor.status,
        toStatus: vendor.status,
        notes: `Tier manually overridden to '${overrideTier}'. Reason: ${overrideReason}`,
      });
    }

    await recordAudit(req, "update", "vendor", vendor.id);
    res.json(vendor);
  } catch (err) {
    console.error("Update vendor error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:id/transition", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const { targetStatus, notes } = req.body;
    if (!targetStatus) { badRequest(res, "targetStatus is required"); return; }
    if (!isValidStatus(targetStatus)) { badRequest(res, `Invalid targetStatus: ${targetStatus}`); return; }

    const [vendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, p(req, "id")), eq(vendorsTable.tenantId, req.user!.tenantId))).limit(1);

    if (!vendor) { notFound(res, "Vendor not found"); return; }

    const effectiveTier: VendorTier = vendor.overrideTier || vendor.tier;
    const currentStatus: VendorStatus = vendor.status;
    const allowed = getAllowedTransitions(effectiveTier, currentStatus);
    if (!allowed.includes(targetStatus)) {
      const flow = getLifecycleFlow(effectiveTier);
      conflict(res, `Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed next states: ${allowed.join(", ") || "none"}. This vendor follows the ${flow.length}-state lifecycle.`);
      return;
    }

    const completedQ = await db.select({ id: questionnairesTable.id }).from(questionnairesTable)
      .where(and(
        eq(questionnairesTable.vendorId, vendor.id),
        eq(questionnairesTable.tenantId, req.user!.tenantId),
        eq(questionnairesTable.status, "completed"),
      )).limit(1);

    const prereq = await checkPrerequisites(
      vendor.id,
      currentStatus,
      targetStatus,
      { hasCompletedQuestionnaire: completedQ.length > 0 },
    );

    if (!prereq.allowed) {
      conflict(res, prereq.reason || "Prerequisites not met for this transition.");
      return;
    }

    await db.insert(vendorStatusEventsTable).values({
      vendorId: vendor.id,
      actorId: req.user!.id,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      notes: notes || null,
    });

    const [updated] = await db.update(vendorsTable).set({
      status: targetStatus,
      updatedAt: new Date(),
    }).where(eq(vendorsTable.id, vendor.id)).returning();

    await recordAudit(req, "transition", "vendor", vendor.id, { from: currentStatus, to: targetStatus });
    res.json(updated);
  } catch (err) {
    console.error("Vendor transition error:", err);
    serverError(res);
  }
});

router.get("/v1/vendors/:id/status-events", async (req, res) => {
  try {
    const [vendor] = await db.select({ id: vendorsTable.id }).from(vendorsTable)
      .where(and(eq(vendorsTable.id, p(req, "id")), eq(vendorsTable.tenantId, req.user!.tenantId))).limit(1);
    if (!vendor) { notFound(res, "Vendor not found"); return; }

    const events = await db.select().from(vendorStatusEventsTable)
      .where(eq(vendorStatusEventsTable.vendorId, vendor.id))
      .orderBy(vendorStatusEventsTable.createdAt);

    res.json({ data: events });
  } catch (err) {
    console.error("List vendor status events error:", err);
    serverError(res);
  }
});

router.delete("/v1/vendors/:id", requireRole("admin"), async (req, res) => {
  try {
    const [vendor] = await db.delete(vendorsTable)
      .where(and(eq(vendorsTable.id, p(req, "id")), eq(vendorsTable.tenantId, req.user!.tenantId))).returning();

    if (!vendor) { notFound(res, "Vendor not found"); return; }
    await recordAudit(req, "delete", "vendor", vendor.id);
    res.json({ deleted: true, id: vendor.id });
  } catch (err) {
    console.error("Delete vendor error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:id/risk-score", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "id");
    const tenantId = req.user!.tenantId;

    const [vendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);
    if (!vendor) { notFound(res, "Vendor not found"); return; }

    const questionnaires = await db.select().from(questionnairesTable)
      .where(and(eq(questionnairesTable.vendorId, vendorId), eq(questionnairesTable.tenantId, tenantId)));
    const documents = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.vendorId, vendorId), eq(documentsTable.tenantId, tenantId)));

    const tierWeights: Record<string, number> = { critical: 40, high: 30, medium: 20, low: 10 };
    let score = 50;

    const completedQ = questionnaires.filter(q => q.status === "completed").length;
    const totalQ = questionnaires.length;
    if (totalQ > 0) score -= (completedQ / totalQ) * 20;

    const processedD = documents.filter(d => d.status === "processed").length;
    const totalD = documents.length;
    if (totalD > 0) score -= (processedD / totalD) * 10;

    score += (tierWeights[vendor.tier] || 20) / 2;

    score = Math.max(0, Math.min(100, Math.round(score * 100) / 100));

    const newTier: VendorTier = vendor.overrideTier ? vendor.tier : computeTierFromRiskScore(score);

    const [updated] = await db.update(vendorsTable).set({
      riskScore: String(score),
      ...(!vendor.overrideTier && { tier: newTier }),
      updatedAt: new Date(),
    }).where(eq(vendorsTable.id, vendorId)).returning();

    await recordAudit(req, "calculate_risk_score", "vendor", vendorId, { score, tier: newTier });
    res.json({ riskScore: score, vendor: updated });
  } catch (err) {
    console.error("Risk score error:", err);
    serverError(res);
  }
});

router.get("/v1/vendors/:vendorId/questionnaires", async (req, res) => {
  try {
    const questionnaires = await db.select().from(questionnairesTable)
      .where(and(eq(questionnairesTable.vendorId, p(req, "vendorId")), eq(questionnairesTable.tenantId, req.user!.tenantId)))
      .orderBy(questionnairesTable.createdAt);
    res.json({ data: questionnaires });
  } catch (err) {
    console.error("List questionnaires error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:vendorId/questionnaires", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "vendorId");
    if (!(await verifyVendorOwnership(vendorId, req.user!.tenantId, res))) return;
    const { title, template } = req.body;
    if (!title) { badRequest(res, "title is required"); return; }

    const [q] = await db.insert(questionnairesTable).values({
      tenantId: req.user!.tenantId,
      vendorId,
      title,
      template: template || [],
    }).returning();

    await recordAudit(req, "create", "questionnaire", q.id);
    res.status(201).json(q);
  } catch (err) {
    console.error("Create questionnaire error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:vendorId/questionnaires/:id/magic-link", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const { expiresInHours = 72 } = req.body;

    const [q] = await db.select().from(questionnairesTable)
      .where(and(
        eq(questionnairesTable.id, p(req, "id")),
        eq(questionnairesTable.vendorId, p(req, "vendorId")),
        eq(questionnairesTable.tenantId, req.user!.tenantId),
      )).limit(1);

    if (!q) { notFound(res, "Questionnaire not found"); return; }

    const secret = process.env.JWT_SECRET;
    if (!secret) { serverError(res, "Server misconfiguration: signing secret not set"); return; }
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const payload = `${q.id}:${expiresAt.getTime()}`;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const token = Buffer.from(`${payload}:${signature}`).toString("base64url");

    await db.update(questionnairesTable).set({
      magicLinkToken: token,
      magicLinkExpiresAt: expiresAt,
      status: "sent",
      updatedAt: new Date(),
    }).where(eq(questionnairesTable.id, q.id));

    await recordAudit(req, "generate_magic_link", "questionnaire", q.id);
    res.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error("Magic link error:", err);
    serverError(res);
  }
});

router.get("/v1/vendors/:vendorId/documents", async (req, res) => {
  try {
    const documents = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.vendorId, p(req, "vendorId")), eq(documentsTable.tenantId, req.user!.tenantId)))
      .orderBy(documentsTable.createdAt);
    res.json({ data: documents });
  } catch (err) {
    console.error("List documents error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:vendorId/documents", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "vendorId");
    if (!(await verifyVendorOwnership(vendorId, req.user!.tenantId, res))) return;
    const { fileName, fileUrl, mimeType, expiresAt } = req.body;
    if (!fileName) { badRequest(res, "fileName is required"); return; }

    const [doc] = await db.insert(documentsTable).values({
      tenantId: req.user!.tenantId,
      vendorId,
      fileName,
      fileUrl,
      mimeType,
      ...(expiresAt && { expiresAt: new Date(expiresAt) }),
    }).returning();

    await recordAudit(req, "create", "document", doc.id);
    res.status(201).json(doc);
  } catch (err) {
    console.error("Create document error:", err);
    serverError(res);
  }
});

router.put("/v1/vendors/:vendorId/documents/:id", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const { status, summary, extractedData, expiresAt } = req.body;
    const [doc] = await db.update(documentsTable).set({
      ...(status !== undefined && { status }),
      ...(summary !== undefined && { summary }),
      ...(extractedData !== undefined && { extractedData }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      updatedAt: new Date(),
    }).where(and(
      eq(documentsTable.id, p(req, "id")),
      eq(documentsTable.vendorId, p(req, "vendorId")),
      eq(documentsTable.tenantId, req.user!.tenantId),
    )).returning();

    if (!doc) { notFound(res, "Document not found"); return; }
    await recordAudit(req, "update", "document", doc.id);
    res.json(doc);
  } catch (err) {
    console.error("Update document error:", err);
    serverError(res);
  }
});

export const publicVendorRouter = Router();

publicVendorRouter.post("/v1/questionnaires/respond", async (req, res) => {
  try {
    const { token, responses } = req.body;
    if (!token || !responses) { badRequest(res, "token and responses are required"); return; }

    let decoded: string;
    try { decoded = Buffer.from(token, "base64url").toString(); } catch { badRequest(res, "Invalid token format"); return; }

    const parts = decoded.split(":");
    if (parts.length !== 3) { badRequest(res, "Invalid token format"); return; }

    const [qId, expiresTs, signature] = parts;
    const secret = process.env.JWT_SECRET;
    if (!secret) { serverError(res, "Server misconfiguration: signing secret not set"); return; }
    const expectedSig = crypto.createHmac("sha256", secret).update(`${qId}:${expiresTs}`).digest("hex");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) { badRequest(res, "Invalid token signature"); return; }
    if (Date.now() > Number(expiresTs)) { badRequest(res, "Token has expired"); return; }

    const [q] = await db.select().from(questionnairesTable)
      .where(and(eq(questionnairesTable.id, qId), eq(questionnairesTable.magicLinkToken, token))).limit(1);

    if (!q) { notFound(res, "Questionnaire not found"); return; }
    if (q.status === "completed") { badRequest(res, "Questionnaire has already been completed"); return; }

    const [updated] = await db.update(questionnairesTable).set({
      responses,
      status: "completed",
      magicLinkToken: null,
      magicLinkExpiresAt: null,
      updatedAt: new Date(),
    }).where(eq(questionnairesTable.id, qId)).returning();

    await recordAuditDirect(q.tenantId, null, "respond", "questionnaire", q.id, { vendorId: q.vendorId });
    res.json(updated);
  } catch (err) {
    console.error("Respond to questionnaire error:", err);
    serverError(res);
  }
});

export default router;
