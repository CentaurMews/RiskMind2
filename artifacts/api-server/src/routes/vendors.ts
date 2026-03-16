import { Router, type Request, type Response } from "express";
import { eq, and, sql, ilike } from "drizzle-orm";
import crypto from "crypto";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}
import {
  db,
  vendorsTable,
  questionnairesTable,
  documentsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit, recordAuditDirect } from "../lib/audit";
import { badRequest, notFound, serverError, conflict } from "../lib/errors";

async function verifyVendorOwnership(vendorId: string, tenantId: string, res: Response): Promise<boolean> {
  const [vendor] = await db.select({ id: vendorsTable.id }).from(vendorsTable)
    .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);
  if (!vendor) { notFound(res, "Vendor not found"); return false; }
  return true;
}

const router = Router();

const VENDOR_TRANSITIONS: Record<string, string[]> = {
  onboarding: ["approved"],
  approved: ["active", "offboarded"],
  active: ["suspended", "offboarded"],
  suspended: ["active", "offboarded"],
  offboarded: [],
};

router.get("/v1/vendors", async (req, res) => {
  try {
    const { status, tier, search, page = "1", limit = "20" } = req.query;
    const tenantId = req.user!.tenantId;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [eq(vendorsTable.tenantId, tenantId)];
    if (status) conditions.push(eq(vendorsTable.status, status as "onboarding" | "approved" | "active" | "suspended" | "offboarded"));
    if (tier) conditions.push(eq(vendorsTable.tier, tier as "critical" | "high" | "medium" | "low"));
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
    const { name, description, tier, category, contactEmail, contactName } = req.body;
    if (!name) { badRequest(res, "name is required"); return; }

    const [vendor] = await db.insert(vendorsTable).values({
      tenantId: req.user!.tenantId,
      name,
      description,
      tier: tier || "medium",
      category,
      contactEmail,
      contactName,
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
    const { name, description, tier, category, contactEmail, contactName } = req.body;
    const [vendor] = await db.update(vendorsTable).set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(tier !== undefined && { tier }),
      ...(category !== undefined && { category }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(contactName !== undefined && { contactName }),
      updatedAt: new Date(),
    }).where(and(eq(vendorsTable.id, p(req, "id")), eq(vendorsTable.tenantId, req.user!.tenantId))).returning();

    if (!vendor) { notFound(res, "Vendor not found"); return; }
    await recordAudit(req, "update", "vendor", vendor.id);
    res.json(vendor);
  } catch (err) {
    console.error("Update vendor error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:id/transition", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const { targetStatus } = req.body;
    if (!targetStatus) { badRequest(res, "targetStatus is required"); return; }

    const [vendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, p(req, "id")), eq(vendorsTable.tenantId, req.user!.tenantId))).limit(1);

    if (!vendor) { notFound(res, "Vendor not found"); return; }

    const allowed = VENDOR_TRANSITIONS[vendor.status] || [];
    if (!allowed.includes(targetStatus)) {
      conflict(res, `Cannot transition from '${vendor.status}' to '${targetStatus}'. Allowed: ${allowed.join(", ") || "none"}`);
      return;
    }

    const [updated] = await db.update(vendorsTable).set({
      status: targetStatus,
      updatedAt: new Date(),
    }).where(eq(vendorsTable.id, vendor.id)).returning();

    await recordAudit(req, "transition", "vendor", vendor.id, { from: vendor.status, to: targetStatus });
    res.json(updated);
  } catch (err) {
    console.error("Vendor transition error:", err);
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

    const [updated] = await db.update(vendorsTable).set({ riskScore: String(score), updatedAt: new Date() })
      .where(eq(vendorsTable.id, vendorId)).returning();

    await recordAudit(req, "calculate_risk_score", "vendor", vendorId, { score });
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
