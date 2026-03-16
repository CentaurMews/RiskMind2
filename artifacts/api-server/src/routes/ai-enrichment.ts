import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}

import { db, risksTable, documentsTable, vendorsTable, jobsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError } from "../lib/errors";
import { enqueueJob } from "../lib/job-queue";

const router = Router();

router.post("/v1/risks/:riskId/enrich", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    const tenantId = req.user!.tenantId;

    const [risk] = await db.select().from(risksTable)
      .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId)))
      .limit(1);

    if (!risk) { notFound(res, "Risk not found"); return; }

    const job = await enqueueJob("ai-enrich", "enrich_risk", { riskId }, tenantId);
    await recordAudit(req, "enrich_request", "risk", riskId, { jobId: job.id });

    res.status(202).json({ jobId: job.id, status: "queued", message: "Risk enrichment job queued" });
  } catch (err) {
    console.error("Enrich risk error:", err);
    serverError(res);
  }
});

router.post("/v1/vendors/:vendorId/documents/:documentId/summarize", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const vendorId = p(req, "vendorId");
    const documentId = p(req, "documentId");
    const tenantId = req.user!.tenantId;

    const [vendor] = await db.select({ id: vendorsTable.id }).from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.tenantId, tenantId)))
      .limit(1);
    if (!vendor) { notFound(res, "Vendor not found"); return; }

    const [doc] = await db.select().from(documentsTable)
      .where(and(eq(documentsTable.id, documentId), eq(documentsTable.vendorId, vendorId), eq(documentsTable.tenantId, tenantId)))
      .limit(1);
    if (!doc) { notFound(res, "Document not found"); return; }

    const job = await enqueueJob("doc-process", "summarize_document", { documentId }, tenantId);
    await recordAudit(req, "summarize_request", "document", documentId, { jobId: job.id, vendorId });

    res.status(202).json({ jobId: job.id, status: "queued", message: "Document summarization job queued" });
  } catch (err) {
    console.error("Summarize document error:", err);
    serverError(res);
  }
});

router.get("/v1/jobs/:id", async (req, res) => {
  try {
    const [job] = await db.select().from(jobsTable)
      .where(and(eq(jobsTable.id, p(req, "id")), eq(jobsTable.tenantId, req.user!.tenantId)))
      .limit(1);

    if (!job) { notFound(res, "Job not found"); return; }
    res.json(job);
  } catch (err) {
    console.error("Get job error:", err);
    serverError(res);
  }
});

export default router;
