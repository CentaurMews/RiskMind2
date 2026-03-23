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
  questionnaireQuestionsTable,
  assessmentsTable,
  vendorSubprocessorsTable,
  jobsTable,
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
import { complete, LLMUnavailableError } from "../lib/llm-service";
import { enqueueJob } from "../lib/job-queue";

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
        openFindingsCount: sql<number>`COALESCE((
          SELECT count(*)::int FROM findings
          WHERE findings.vendor_id = ${vendorsTable.id}
          AND findings.status = 'open'
          AND findings.tenant_id = ${tenantId}
        ), 0)`,
        lastAssessmentDate: sql<string | null>`(
          SELECT max(q.updated_at)::text FROM questionnaires q
          WHERE q.vendor_id = ${vendorsTable.id}
          AND q.status = 'completed'
          AND q.tenant_id = ${tenantId}
        )`,
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

// ─── Vendor Onboarding Wizard Endpoints ───────────────────────────────────────
// Risk score convention: 0 = low risk (best), 100 = critical risk (worst)
// Assessment Engine overall: 0-100 where 100 = perfect compliance
// Conversion: riskScore = 100 - assessment.overall

/**
 * POST /v1/vendors/onboard — Create a vendor in identification status (step 1).
 */
router.post("/v1/vendors/onboard", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, description, category, contactEmail, contactName, tier } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      badRequest(res, "name is required");
      return;
    }

    const vendorTier: VendorTier = tier && isValidTier(tier) ? tier : "medium";

    const [vendor] = await db.insert(vendorsTable).values({
      tenantId,
      name: name.trim(),
      description: description ?? null,
      category: category ?? null,
      contactEmail: contactEmail ?? null,
      contactName: contactName ?? null,
      tier: vendorTier,
      status: "identification",
    }).returning();

    await recordAudit(req, "start_onboarding", "vendor", vendor.id);
    res.status(201).json({ ...vendor, wizardStep: 1 });
  } catch (err) {
    console.error("Create onboard vendor error:", err);
    serverError(res);
  }
});

/**
 * GET /v1/vendors/onboard/:id — Get vendor wizard state with inferred step.
 */
router.get("/v1/vendors/onboard/:id", async (req, res) => {
  try {
    const vendorId = p(req, "id");
    const tenantId = req.user!.tenantId;

    if (!(await verifyVendorOwnership(vendorId, tenantId, res))) return;

    const [vendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)))
      .limit(1);

    if (!vendor) { notFound(res, "Vendor not found"); return; }

    // Check if assessment exists for this vendor
    const [assessment] = await db.select({ id: assessmentsTable.id })
      .from(assessmentsTable)
      .where(and(
        eq(assessmentsTable.contextType, "vendor"),
        eq(assessmentsTable.contextId, vendorId),
        eq(assessmentsTable.tenantId, tenantId),
      ))
      .limit(1);
    const hasAssessment = !!assessment;

    // Check if any document exists for this vendor
    const [doc] = await db.select({ id: documentsTable.id })
      .from(documentsTable)
      .where(and(
        eq(documentsTable.vendorId, vendorId),
        eq(documentsTable.tenantId, tenantId),
      ))
      .limit(1);
    const hasDocuments = !!doc;

    // Infer wizard step from data completeness
    let wizardStep: number;
    if (vendor.status !== "identification") {
      wizardStep = 4; // Completed — vendor has progressed beyond identification
    } else if (hasDocuments) {
      wizardStep = 3; // Has docs, ready for enrichment review
    } else if (hasAssessment) {
      wizardStep = 2; // Template assigned, no docs yet
    } else {
      wizardStep = 1; // Just created
    }

    res.json({ ...vendor, wizardStep, hasAssessment, hasDocuments });
  } catch (err) {
    console.error("Get onboard vendor error:", err);
    serverError(res);
  }
});

/**
 * PATCH /v1/vendors/onboard/:id — Update vendor per wizard step.
 */
router.patch("/v1/vendors/onboard/:id", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "id");
    const tenantId = req.user!.tenantId;

    if (!(await verifyVendorOwnership(vendorId, tenantId, res))) return;

    const [existingVendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)))
      .limit(1);
    if (!existingVendor) { notFound(res, "Vendor not found"); return; }

    const { step, data } = req.body;
    if (!step || typeof step !== "number") {
      badRequest(res, "step (number) is required");
      return;
    }

    let wizardStep = step;

    if (step === 1) {
      // Update basic vendor info
      const { name, description, category, contactEmail, contactName, tier } = data ?? {};
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (contactEmail !== undefined) updates.contactEmail = contactEmail;
      if (contactName !== undefined) updates.contactName = contactName;
      if (tier !== undefined && isValidTier(tier)) updates.tier = tier;

      await db.update(vendorsTable).set(updates)
        .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)));

      await recordAudit(req, "onboard_step1_update", "vendor", vendorId);
      wizardStep = 2;
    } else if (step === 2) {
      // Assign assessment template — create assessment record
      const { assessmentTemplateId } = data ?? {};
      if (!assessmentTemplateId) {
        badRequest(res, "assessmentTemplateId is required for step 2");
        return;
      }

      // Check if assessment already exists
      const [existingAssessment] = await db.select({ id: assessmentsTable.id })
        .from(assessmentsTable)
        .where(and(
          eq(assessmentsTable.contextType, "vendor"),
          eq(assessmentsTable.contextId, vendorId),
          eq(assessmentsTable.tenantId, tenantId),
        ))
        .limit(1);

      if (!existingAssessment) {
        await db.insert(assessmentsTable).values({
          tenantId,
          templateId: assessmentTemplateId,
          contextType: "vendor",
          contextId: vendorId,
          status: "active",
        });
      }

      await recordAudit(req, "onboard_step2_assign_template", "vendor", vendorId, { assessmentTemplateId });
      wizardStep = 3;
    } else if (step === 3) {
      // Step 3: documents are uploaded via document endpoint — just acknowledge
      await recordAudit(req, "onboard_step3_docs_reviewed", "vendor", vendorId);
      wizardStep = 4;
    } else if (step === 4) {
      // Step 4: confirm enrichment and advance to due_diligence
      const { enrichmentData } = data ?? {};
      const updates: Record<string, unknown> = {
        status: "due_diligence" as VendorStatus,
        updatedAt: new Date(),
      };
      if (enrichmentData?.description) updates.description = enrichmentData.description;
      if (enrichmentData?.category) updates.category = enrichmentData.category;

      await db.update(vendorsTable).set(updates)
        .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)));

      await db.insert(vendorStatusEventsTable).values({
        vendorId,
        actorId: req.user!.id,
        fromStatus: "identification",
        toStatus: "due_diligence",
        notes: "Wizard onboarding completed",
      });

      await recordAudit(req, "onboard_step4_complete", "vendor", vendorId);
      wizardStep = 5; // completed
    } else {
      badRequest(res, `Invalid wizard step: ${step}`);
      return;
    }

    const [updatedVendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)))
      .limit(1);

    res.json({ ...updatedVendor, wizardStep });
  } catch (err) {
    console.error("Update onboard vendor error:", err);
    serverError(res);
  }
});

/**
 * POST /v1/vendors/onboard/:id/enrich — Trigger AI enrichment job.
 */
router.post("/v1/vendors/onboard/:id/enrich", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "id");
    const tenantId = req.user!.tenantId;

    if (!(await verifyVendorOwnership(vendorId, tenantId, res))) return;

    // Check for an existing running enrichment job for this vendor
    // Fetch pending/processing jobs and filter by vendorId payload in-memory
    const runningEnrichJobs = await db.select({ id: jobsTable.id, payload: jobsTable.payload, status: jobsTable.status })
      .from(jobsTable)
      .where(and(
        eq(jobsTable.queue, "ai-enrich"),
        eq(jobsTable.tenantId, tenantId),
      ));

    const hasRunning = runningEnrichJobs.some(
      (j) =>
        (j.status === "pending" || j.status === "processing") &&
        typeof j.payload === "object" &&
        j.payload !== null &&
        (j.payload as Record<string, unknown>).vendorId === vendorId,
    );

    if (hasRunning) {
      conflict(res, "An enrichment job is already running for this vendor");
      return;
    }

    const job = await enqueueJob("ai-enrich", "enrich_vendor", { vendorId, tenantId }, tenantId);

    await recordAudit(req, "trigger_enrichment", "vendor", vendorId, { jobId: job.id });
    res.status(202).json({ jobId: job.id, status: "queued" });
  } catch (err) {
    console.error("Enrich vendor error:", err);
    serverError(res);
  }
});

/**
 * DELETE /v1/vendors/onboard/:id — Cancel onboarding (delete incomplete vendor).
 */
router.delete("/v1/vendors/onboard/:id", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "id");
    const tenantId = req.user!.tenantId;

    const [vendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)))
      .limit(1);

    if (!vendor) { notFound(res, "Vendor not found"); return; }

    if (vendor.status !== "identification") {
      conflict(res, "Cannot cancel onboarding: vendor has already progressed beyond identification");
      return;
    }

    // Check for linked assessments
    const [linkedAssessment] = await db.select({ id: assessmentsTable.id })
      .from(assessmentsTable)
      .where(and(
        eq(assessmentsTable.contextType, "vendor"),
        eq(assessmentsTable.contextId, vendorId),
        eq(assessmentsTable.tenantId, tenantId),
      ))
      .limit(1);

    // Check for linked documents
    const [linkedDoc] = await db.select({ id: documentsTable.id })
      .from(documentsTable)
      .where(and(
        eq(documentsTable.vendorId, vendorId),
        eq(documentsTable.tenantId, tenantId),
      ))
      .limit(1);

    // Check for linked subprocessors
    const [linkedSubprocessor] = await db.select({ id: vendorSubprocessorsTable.id })
      .from(vendorSubprocessorsTable)
      .where(and(
        eq(vendorSubprocessorsTable.vendorId, vendorId),
        eq(vendorSubprocessorsTable.tenantId, tenantId),
      ))
      .limit(1);

    if (linkedAssessment || linkedDoc || linkedSubprocessor) {
      conflict(res, "Cannot cancel onboarding: vendor has linked assessments, documents, or subprocessors. Remove them first.");
      return;
    }

    await db.delete(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)));

    await recordAudit(req, "cancel_onboarding", "vendor", vendorId);
    res.status(204).send();
  } catch (err) {
    console.error("Cancel onboarding error:", err);
    serverError(res);
  }
});

// ─── Standard Vendor CRUD Endpoints ───────────────────────────────────────────

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
    const tenantId = req.user!.tenantId;
    if (!(await verifyVendorOwnership(vendorId, tenantId, res))) return;
    const { title } = req.body;
    if (!title) { badRequest(res, "title is required"); return; }

    const [vendor] = await db.select({ category: vendorsTable.category }).from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);

    const tenantOrGlobal = sql`(${questionnaireQuestionsTable.tenantId} = ${tenantId} OR ${questionnaireQuestionsTable.tenantId} IS NULL)`;

    const coreQuestions = await db.select().from(questionnaireQuestionsTable)
      .where(and(eq(questionnaireQuestionsTable.isCore, true), tenantOrGlobal));

    let categoryQuestions: typeof coreQuestions = [];
    if (vendor?.category) {
      categoryQuestions = await db.select().from(questionnaireQuestionsTable)
        .where(and(
          eq(questionnaireQuestionsTable.isCore, false),
          eq(questionnaireQuestionsTable.vendorCategory, vendor.category),
          tenantOrGlobal,
        ));
    }

    const NEGATIVE_INDICATOR_PATTERNS = [
      /breach/i, /incident/i, /violation/i, /compromise/i, /failure/i, /lawsuit/i,
    ];

    const templateQuestions = [...coreQuestions, ...categoryQuestions].map(q => {
      const isNegativeIndicator = NEGATIVE_INDICATOR_PATTERNS.some(p => p.test(q.text));
      return {
        questionId: q.id,
        text: q.text,
        category: q.category,
        answerType: q.answerType,
        weight: parseFloat(q.weight),
        isCore: q.isCore,
        isAiGenerated: false,
        isNegativeIndicator,
      };
    });

    const [q] = await db.insert(questionnairesTable).values({
      tenantId,
      vendorId,
      title,
      template: templateQuestions,
    }).returning();

    await recordAudit(req, "create", "questionnaire", q.id);
    res.status(201).json(q);
  } catch (err) {
    console.error("Create questionnaire error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:vendorId/questionnaires/:qId/ai-questions", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "vendorId");
    const qId = p(req, "qId");
    const tenantId = req.user!.tenantId;

    const [vendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);
    if (!vendor) { notFound(res, "Vendor not found"); return; }

    const [questionnaire] = await db.select().from(questionnairesTable)
      .where(and(eq(questionnairesTable.id, qId), eq(questionnairesTable.vendorId, vendorId), eq(questionnairesTable.tenantId, tenantId))).limit(1);
    if (!questionnaire) { notFound(res, "Questionnaire not found"); return; }

    const template = (questionnaire.template as any[]) || [];
    const responses = (questionnaire.responses as Record<string, any>) || {};

    const existingQuestions = template.map((q: any) => q.text).join("\n- ");
    const answeredSummary = Object.entries(responses).map(([qid, val]) => {
      const q = template.find((t: any) => t.questionId === qid);
      return q ? `Q: ${q.text}\nA: ${val}` : "";
    }).filter(Boolean).join("\n\n");

    const prompt = `You are a vendor risk assessment expert. Given the following vendor profile and existing questionnaire, generate 3-5 contextual follow-up questions that dig deeper into potential risk areas.

Vendor: ${vendor.name}
Category: ${vendor.category || "General"}
Description: ${vendor.description || "N/A"}

Existing questions:
- ${existingQuestions}

${answeredSummary ? `Responses so far:\n${answeredSummary}` : "No responses yet."}

Generate 3-5 follow-up questions. For each question provide:
- text: the question text
- category: one of security, privacy, operational
- answerType: one of text, boolean, scale
- weight: a number between 0.5 and 2.0

Respond ONLY with a JSON array of objects with keys: text, category, answerType, weight. No other text.`;

    const result = await complete(tenantId, {
      messages: [
        { role: "system", content: "You are a vendor risk assessment expert. Respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 1024,
    });

    let aiQuestions: any[];
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      aiQuestions = JSON.parse(cleaned);
      if (!Array.isArray(aiQuestions)) throw new Error("Expected array");
    } catch (parseErr) {
      console.error("[Vendor AI Questions] LLM returned unparseable response:", result);
      res.status(502).json({ error: "AI response could not be processed. This is a temporary issue — please try again." });
      return;
    }

    const newQuestions = aiQuestions
      .slice(0, 5)
      .filter((q: any) => q.text && String(q.text).trim().length > 5)
      .map((q: any) => ({
        questionId: crypto.randomUUID(),
        text: String(q.text).trim(),
        category: ["security", "privacy", "operational"].includes(q.category) ? q.category : "general",
        answerType: ["text", "boolean", "scale"].includes(q.answerType) ? q.answerType : "text",
        weight: Math.min(2.0, Math.max(0.5, parseFloat(q.weight) || 1.0)),
        isCore: false,
        isAiGenerated: true,
        isNegativeIndicator: false,
      }));

    const updatedTemplate = [...template, ...newQuestions];

    const [updated] = await db.update(questionnairesTable).set({
      template: updatedTemplate,
      updatedAt: new Date(),
    }).where(eq(questionnairesTable.id, qId)).returning();

    await recordAudit(req, "ai_generate_questions", "questionnaire", qId, { count: newQuestions.length });
    res.json(updated);
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error("AI questions error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:vendorId/questionnaires/:qId/validate-answers", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "vendorId");
    const qId = p(req, "qId");
    const tenantId = req.user!.tenantId;

    const [vendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);
    if (!vendor) { notFound(res, "Vendor not found"); return; }

    const [questionnaire] = await db.select().from(questionnairesTable)
      .where(and(eq(questionnairesTable.id, qId), eq(questionnairesTable.vendorId, vendorId), eq(questionnairesTable.tenantId, tenantId))).limit(1);
    if (!questionnaire) { notFound(res, "Questionnaire not found"); return; }

    const template = (questionnaire.template as any[]) || [];
    const responses = (questionnaire.responses as Record<string, any>) || {};

    if (Object.keys(responses).length === 0) {
      badRequest(res, "No responses to validate");
      return;
    }

    const qaPairs = Object.entries(responses).map(([qid, val]) => {
      const q = template.find((t: any) => t.questionId === qid);
      return q ? { questionId: qid, question: q.text, answer: val } : null;
    }).filter(Boolean);

    const prompt = `You are a vendor risk assessment validator. Given the following vendor and their questionnaire responses, identify any answers that seem inconsistent with publicly known information or industry norms.

Vendor: ${vendor.name}
Category: ${vendor.category || "General"}

Responses:
${qaPairs.map((qa: any) => `[${qa.questionId}] Q: ${qa.question}\nA: ${qa.answer}`).join("\n\n")}

For each flagged answer, provide:
- questionId: the question ID in brackets above
- flagReason: why this answer seems inconsistent
- confidence: a number 0.0 to 1.0 indicating how confident you are

Respond ONLY with a JSON array of flag objects. If nothing seems inconsistent, return an empty array []. No other text.`;

    const result = await complete(tenantId, {
      messages: [
        { role: "system", content: "You are a vendor risk assessment validator. Respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 1024,
    });

    let flags: any[];
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      flags = JSON.parse(cleaned);
      if (!Array.isArray(flags)) throw new Error("Expected array");
    } catch {
      flags = [];
    }

    const validatedFlags = flags.map((f: any) => ({
      questionId: String(f.questionId || ""),
      flagReason: String(f.flagReason || ""),
      confidence: Math.min(1.0, Math.max(0.0, parseFloat(f.confidence) || 0.5)),
    }));

    await recordAudit(req, "validate_answers", "questionnaire", qId, { flagCount: validatedFlags.length });
    res.json({ flags: validatedFlags });
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error("Validate answers error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:vendorId/questionnaires/:qId/score", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "vendorId");
    const qId = p(req, "qId");
    const tenantId = req.user!.tenantId;

    const [vendor] = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId))).limit(1);
    if (!vendor) { notFound(res, "Vendor not found"); return; }

    const [questionnaire] = await db.select().from(questionnairesTable)
      .where(and(eq(questionnairesTable.id, qId), eq(questionnairesTable.vendorId, vendorId), eq(questionnairesTable.tenantId, tenantId))).limit(1);
    if (!questionnaire) { notFound(res, "Questionnaire not found"); return; }

    const template = (questionnaire.template as any[]) || [];
    const responses = (questionnaire.responses as Record<string, any>) || {};

    if (template.length === 0) {
      badRequest(res, "Questionnaire has no questions");
      return;
    }

    let totalWeightedScore = 0;
    let totalWeight = 0;
    const breakdown: Array<{ questionId: string; text: string; rawScore: number; weight: number; weightedScore: number }> = [];

    for (const q of template) {
      const weight = parseFloat(q.weight) || 1.0;
      const response = responses[q.questionId];
      let rawScore = 0;

      if (response !== undefined && response !== null && response !== "") {
        switch (q.answerType) {
          case "boolean": {
            const isYes = (response === true || response === "true" || response === "yes");
            if (q.isNegativeIndicator) {
              rawScore = isYes ? 0 : 100;
            } else {
              rawScore = isYes ? 100 : 0;
            }
            break;
          }
          case "scale":
            rawScore = Math.min(100, Math.max(0, parseFloat(response) || 0));
            if (rawScore <= 10) rawScore = rawScore * 10;
            break;
          case "text":
            rawScore = (typeof response === "string" && response.trim().length > 20) ? 80 : (response ? 50 : 0);
            break;
          default:
            rawScore = response ? 50 : 0;
        }
      }

      const weightedScore = rawScore * weight;
      totalWeightedScore += weightedScore;
      totalWeight += weight;

      breakdown.push({
        questionId: q.questionId,
        text: q.text,
        rawScore,
        weight,
        weightedScore,
      });
    }

    const riskScore = totalWeight > 0
      ? Math.round((100 - (totalWeightedScore / (totalWeight * 100)) * 100) * 100) / 100
      : 50;

    const normalizedScore = Math.max(0, Math.min(100, riskScore));

    let tier: "critical" | "high" | "medium" | "low";
    if (normalizedScore >= 75) tier = "critical";
    else if (normalizedScore >= 50) tier = "high";
    else if (normalizedScore >= 25) tier = "medium";
    else tier = "low";

    const [updatedVendor] = await db.update(vendorsTable).set({
      riskScore: String(normalizedScore),
      updatedAt: new Date(),
    }).where(eq(vendorsTable.id, vendorId)).returning();

    await db.update(questionnairesTable).set({
      status: "completed",
      updatedAt: new Date(),
    }).where(eq(questionnairesTable.id, qId));

    await recordAudit(req, "score_questionnaire", "questionnaire", qId, { riskScore: normalizedScore, tier });
    res.json({
      riskScore: normalizedScore,
      tier,
      breakdown,
      totalQuestions: template.length,
      answeredQuestions: Object.keys(responses).length,
      vendor: updatedVendor,
    });
  } catch (err) {
    console.error("Score questionnaire error:", err);
    serverError(res);
  }
});

router.put("/v1/vendors/:vendorId/questionnaires/:qId/responses", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const vendorId = p(req, "vendorId");
    const qId = p(req, "qId");
    const tenantId = req.user!.tenantId;

    const [questionnaire] = await db.select().from(questionnairesTable)
      .where(and(eq(questionnairesTable.id, qId), eq(questionnairesTable.vendorId, vendorId), eq(questionnairesTable.tenantId, tenantId))).limit(1);
    if (!questionnaire) { notFound(res, "Questionnaire not found"); return; }

    const { responses } = req.body;
    if (!responses || typeof responses !== "object") { badRequest(res, "responses object is required"); return; }

    const template = (questionnaire.template as any[]) || [];
    const validQuestionIds = new Set(template.map((q: any) => q.questionId));
    const filteredResponses: Record<string, any> = {};
    for (const [key, val] of Object.entries(responses)) {
      if (validQuestionIds.has(key)) filteredResponses[key] = val;
    }

    const existingResponses = (questionnaire.responses as Record<string, any>) || {};
    const mergedResponses = { ...existingResponses, ...filteredResponses };

    const [updated] = await db.update(questionnairesTable).set({
      responses: mergedResponses,
      status: "in_progress",
      updatedAt: new Date(),
    }).where(eq(questionnairesTable.id, qId)).returning();

    await recordAudit(req, "update_responses", "questionnaire", qId);
    res.json(updated);
  } catch (err) {
    console.error("Update responses error:", err);
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
