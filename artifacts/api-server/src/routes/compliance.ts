import { Router, type Request, type Response } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import multer from "multer";
import fs from "fs";
import path from "path";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}
import {
  db,
  frameworksTable,
  frameworkRequirementsTable,
  controlsTable,
  controlTestsTable,
  controlRequirementMapsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, conflict } from "../lib/errors";
import { parseCsv, parseJson, computeDiff, resolveParentCodes } from "../lib/compliance-import";
import { recalculateAndTriggerPipeline, computeComplianceScore, getComplianceStatus } from "../lib/compliance-pipeline";
import { generateEmbedding, LLMUnavailableError } from "../lib/llm-service";
import { enqueueJob } from "../lib/job-queue";

// Create uploads directory at module load time
fs.mkdirSync(path.join(process.cwd(), "uploads/evidence"), { recursive: true });

const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), "uploads/evidence"),
    filename: (req, file, cb) => {
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "text/plain"];
    cb(null, allowed.includes(file.mimetype));
  },
}).single("evidence");

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("file");

async function verifyControlOwnership(controlId: string, tenantId: string, res: Response): Promise<boolean> {
  const [control] = await db.select({ id: controlsTable.id }).from(controlsTable)
    .where(and(eq(controlsTable.id, controlId), eq(controlsTable.tenantId, tenantId))).limit(1);
  if (!control) { notFound(res, "Control not found"); return false; }
  return true;
}

const router = Router();

// Serve uploaded evidence files
router.use("/uploads/evidence", (req, res, next) => {
  // Basic path traversal guard
  const filePath = path.join(process.cwd(), "uploads/evidence", path.basename(req.path));
  res.sendFile(filePath, (err) => {
    if (err) notFound(res, "File not found");
  });
});

router.get("/v1/frameworks", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const frameworks = await db.select({
      id: frameworksTable.id,
      name: frameworksTable.name,
      version: frameworksTable.version,
      type: frameworksTable.type,
      description: frameworksTable.description,
      complianceThreshold: frameworksTable.complianceThreshold,
      createdAt: frameworksTable.createdAt,
    }).from(frameworksTable).where(eq(frameworksTable.tenantId, tenantId)).orderBy(frameworksTable.name);

    // Enrich with compliance stats via separate queries to avoid correlated subquery ambiguity
    const enriched = await Promise.all(frameworks.map(async (f) => {
      const reqResult = await db.execute(sql`SELECT count(*)::int AS cnt FROM framework_requirements WHERE framework_id = ${f.id} AND tenant_id = ${tenantId}`);
      const ctrlResult = await db.execute(sql`SELECT count(DISTINCT crm.control_id)::int AS cnt FROM control_requirement_maps crm JOIN framework_requirements fr ON crm.requirement_id = fr.id WHERE fr.framework_id = ${f.id} AND crm.tenant_id = ${tenantId}`);
      const activeResult = await db.execute(sql`SELECT count(DISTINCT crm.control_id)::int AS cnt FROM control_requirement_maps crm JOIN framework_requirements fr ON crm.requirement_id = fr.id JOIN controls c ON crm.control_id = c.id WHERE fr.framework_id = ${f.id} AND crm.tenant_id = ${tenantId} AND c.control_status = 'active'`);

      const reqs = (reqResult.rows[0] as { cnt: number }).cnt;
      const ctrls = (ctrlResult.rows[0] as { cnt: number }).cnt;
      const active = (activeResult.rows[0] as { cnt: number }).cnt;
      const compliancePct = active > 0 && ctrls > 0 ? Math.round((active / ctrls) * 100) : 0;

      return { ...f, requirementCount: reqs, controlCount: ctrls, activeControlCount: active, compliancePercentage: Math.min(compliancePct, 100) };
    }));

    res.json({ data: enriched });
  } catch (err) {
    console.error("List frameworks error:", err);
    serverError(res);
  }
});

// POST /v1/frameworks — create a new framework (D-07)
router.post("/v1/frameworks", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, version, type, description } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 3 || name.trim().length > 100) {
      badRequest(res, "name is required and must be 3-100 characters");
      return;
    }

    const [framework] = await db.insert(frameworksTable).values({
      tenantId,
      name: name.trim(),
      version: version ?? null,
      type: type ?? null,
      description: description ?? null,
    }).returning();

    await recordAudit(req, "create", "framework", framework.id);
    res.status(201).json(framework);
  } catch (err) {
    console.error("Create framework error:", err);
    serverError(res);
  }
});

router.get("/v1/frameworks/:id", async (req, res) => {
  try {
    const [framework] = await db.select().from(frameworksTable)
      .where(and(eq(frameworksTable.id, p(req, "id")), eq(frameworksTable.tenantId, req.user!.tenantId))).limit(1);

    if (!framework) { notFound(res, "Framework not found"); return; }

    const requirements = await db.select({
      id: frameworkRequirementsTable.id,
      parentId: frameworkRequirementsTable.parentId,
      code: frameworkRequirementsTable.code,
      title: frameworkRequirementsTable.title,
      description: frameworkRequirementsTable.description,
    }).from(frameworkRequirementsTable)
      .where(and(eq(frameworkRequirementsTable.frameworkId, framework.id), eq(frameworkRequirementsTable.tenantId, req.user!.tenantId)))
      .orderBy(frameworkRequirementsTable.code);

    res.json({ ...framework, requirements });
  } catch (err) {
    console.error("Get framework error:", err);
    serverError(res);
  }
});

// POST /v1/frameworks/:id/import/preview — parse file and return diff without writing (D-04, D-06)
router.post("/v1/frameworks/:id/import/preview", requireRole("admin", "risk_manager"), importUpload, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const frameworkId = p(req, "id");

    const [framework] = await db.select({ id: frameworksTable.id })
      .from(frameworksTable)
      .where(and(eq(frameworksTable.id, frameworkId), eq(frameworksTable.tenantId, tenantId)))
      .limit(1);
    if (!framework) { notFound(res, "Framework not found"); return; }

    if (!req.file) { badRequest(res, "file is required"); return; }

    const format = (req.query["format"] as string) || "csv";
    let incoming;
    try {
      incoming = format === "json" ? parseJson(req.file.buffer) : parseCsv(req.file.buffer);
    } catch (err) {
      badRequest(res, (err as Error).message);
      return;
    }

    const existingRows = await db.select({
      code: frameworkRequirementsTable.code,
      title: frameworkRequirementsTable.title,
      description: frameworkRequirementsTable.description,
    }).from(frameworkRequirementsTable)
      .where(and(eq(frameworkRequirementsTable.frameworkId, frameworkId), eq(frameworkRequirementsTable.tenantId, tenantId)));

    const existingNormalized = existingRows.map((r) => ({ ...r, description: r.description ?? undefined }));
    const diff = computeDiff(existingNormalized, incoming);

    res.json({
      diff: {
        new: diff.new,
        modified: diff.modified,
        unchanged: diff.unchanged,
      },
      warnings: diff.warnings,
      totalIncoming: incoming.length,
    });
  } catch (err) {
    console.error("Import preview error:", err);
    serverError(res);
  }
});

// POST /v1/frameworks/:id/import/apply — parse file and write requirements additively (D-04, D-05)
router.post("/v1/frameworks/:id/import/apply", requireRole("admin", "risk_manager"), importUpload, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const frameworkId = p(req, "id");

    const [framework] = await db.select({ id: frameworksTable.id, name: frameworksTable.name })
      .from(frameworksTable)
      .where(and(eq(frameworksTable.id, frameworkId), eq(frameworksTable.tenantId, tenantId)))
      .limit(1);
    if (!framework) { notFound(res, "Framework not found"); return; }

    if (!req.file) { badRequest(res, "file is required"); return; }

    const format = (req.query["format"] as string) || "csv";
    let incoming;
    try {
      incoming = format === "json" ? parseJson(req.file.buffer) : parseCsv(req.file.buffer);
    } catch (err) {
      badRequest(res, (err as Error).message);
      return;
    }

    const existingRows = await db.select({
      id: frameworkRequirementsTable.id,
      code: frameworkRequirementsTable.code,
      title: frameworkRequirementsTable.title,
      description: frameworkRequirementsTable.description,
    }).from(frameworkRequirementsTable)
      .where(and(eq(frameworkRequirementsTable.frameworkId, frameworkId), eq(frameworkRequirementsTable.tenantId, tenantId)));

    const existingNormalized = existingRows.map((r) => ({ ...r, description: r.description ?? undefined }));
    const diff = computeDiff(existingNormalized, incoming);
    const allWarnings: string[] = [...diff.warnings];
    let newCount = 0;
    let modifiedCount = 0;

    // Execute in a transaction
    await db.transaction(async (tx) => {
      // Insert new requirements (parentId resolved in second pass)
      if (diff.new.length > 0) {
        await tx.insert(frameworkRequirementsTable).values(
          diff.new.map((r) => ({
            tenantId,
            frameworkId,
            code: r.code,
            title: r.title,
            description: r.description ?? null,
            parentId: null as string | null,
          }))
        );
        newCount = diff.new.length;
      }

      // Update modified requirements
      for (const { incoming: mod } of diff.modified) {
        await tx.update(frameworkRequirementsTable)
          .set({ title: mod.title, description: mod.description ?? null, updatedAt: new Date() })
          .where(and(
            eq(frameworkRequirementsTable.frameworkId, frameworkId),
            eq(frameworkRequirementsTable.tenantId, tenantId),
            eq(frameworkRequirementsTable.code, mod.code),
          ));
        modifiedCount++;
      }

      // Second pass: resolve parent codes after all inserts
      const allRequirements = await tx.select({
        id: frameworkRequirementsTable.id,
        code: frameworkRequirementsTable.code,
      }).from(frameworkRequirementsTable)
        .where(and(eq(frameworkRequirementsTable.frameworkId, frameworkId), eq(frameworkRequirementsTable.tenantId, tenantId)));

      const codeToIdMap = new Map(allRequirements.map((r) => [r.code, r.id]));
      const withParentCodes = incoming.filter((r) => r.parentCode);

      const { resolved, warnings: resolveWarnings } = resolveParentCodes(withParentCodes, codeToIdMap);
      allWarnings.push(...resolveWarnings);

      for (const r of resolved) {
        if (r.parentId) {
          await tx.update(frameworkRequirementsTable)
            .set({ parentId: r.parentId, updatedAt: new Date() })
            .where(and(
              eq(frameworkRequirementsTable.frameworkId, frameworkId),
              eq(frameworkRequirementsTable.tenantId, tenantId),
              eq(frameworkRequirementsTable.code, r.code),
            ));
        }
      }
    });

    // Enqueue embedding generation for new/modified requirements (best-effort)
    if (newCount > 0 || modifiedCount > 0) {
      enqueueJob("embed", "generate_framework_requirement_embeddings", {
        frameworkId,
        tenantId,
      }, tenantId).catch((err) => console.error("Embedding enqueue error:", err));
    }

    await recordAudit(req, "import", "framework", frameworkId, { newCount, modifiedCount });

    res.json({
      imported: {
        new: newCount,
        modified: modifiedCount,
        unchanged: diff.unchanged.length,
      },
      warnings: allWarnings,
    });
  } catch (err) {
    console.error("Import apply error:", err);
    serverError(res);
  }
});

// PUT /v1/frameworks/:id/threshold — update compliance threshold (D-08)
router.put("/v1/frameworks/:id/threshold", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const frameworkId = p(req, "id");
    const { threshold } = req.body;

    if (threshold === undefined || threshold === null) {
      badRequest(res, "threshold is required");
      return;
    }
    const thresholdNum = Number(threshold);
    if (isNaN(thresholdNum) || thresholdNum < 0 || thresholdNum > 100) {
      badRequest(res, "threshold must be a number between 0 and 100");
      return;
    }

    const [framework] = await db.update(frameworksTable)
      .set({ complianceThreshold: String(thresholdNum), updatedAt: new Date() })
      .where(and(eq(frameworksTable.id, frameworkId), eq(frameworksTable.tenantId, tenantId)))
      .returning();

    if (!framework) { notFound(res, "Framework not found"); return; }

    // Trigger pipeline non-blocking
    recalculateAndTriggerPipeline(frameworkId, tenantId).catch((err) =>
      console.error("Pipeline error after threshold update:", err)
    );

    await recordAudit(req, "update_threshold", "framework", frameworkId, { threshold: thresholdNum });
    res.json(framework);
  } catch (err) {
    console.error("Update threshold error:", err);
    serverError(res);
  }
});

// GET /v1/frameworks/:frameworkId/export/csv — export all requirements with compliance data (D-11, D-12)
router.get("/v1/frameworks/:frameworkId/export/csv", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const frameworkId = p(req, "frameworkId");

    const [framework] = await db.select().from(frameworksTable)
      .where(and(eq(frameworksTable.id, frameworkId), eq(frameworksTable.tenantId, tenantId))).limit(1);
    if (!framework) { notFound(res, "Framework not found"); return; }

    // Reuse gap-analysis query logic
    const requirements = await db.select({
      id: frameworkRequirementsTable.id,
      code: frameworkRequirementsTable.code,
      title: frameworkRequirementsTable.title,
      description: frameworkRequirementsTable.description,
      parentId: frameworkRequirementsTable.parentId,
    }).from(frameworkRequirementsTable)
      .where(and(eq(frameworkRequirementsTable.frameworkId, frameworkId), eq(frameworkRequirementsTable.tenantId, tenantId)))
      .orderBy(frameworkRequirementsTable.code);

    const reqIds = requirements.map((r) => r.id);
    const mappings = reqIds.length > 0
      ? await db.select({
          requirementId: controlRequirementMapsTable.requirementId,
          controlId: controlRequirementMapsTable.controlId,
        }).from(controlRequirementMapsTable)
          .where(and(eq(controlRequirementMapsTable.tenantId, tenantId), inArray(controlRequirementMapsTable.requirementId, reqIds)))
      : [];

    const controlIdSet = new Set<string>();
    for (const m of mappings) controlIdSet.add(m.controlId);
    const controlIds = Array.from(controlIdSet);

    const controls = controlIds.length > 0
      ? await db.select({ id: controlsTable.id, title: controlsTable.title, status: controlsTable.status })
          .from(controlsTable)
          .where(and(eq(controlsTable.tenantId, tenantId), sql`${controlsTable.id} = ANY(${controlIds})`))
      : [];

    const latestTests = controlIds.length > 0
      ? await db.select({ controlId: controlTestsTable.controlId, result: controlTestsTable.result })
          .from(controlTestsTable)
          .where(and(eq(controlTestsTable.tenantId, tenantId), sql`${controlTestsTable.controlId} = ANY(${controlIds})`))
          .orderBy(controlTestsTable.testedAt)
      : [];

    const latestResultByControl: Record<string, string> = {};
    for (const t of latestTests) {
      latestResultByControl[t.controlId] = t.result;
    }

    const controlMap = new Map(controls.map((c) => [c.id, c]));
    const reqMappings = new Map<string, string[]>();
    for (const m of mappings) {
      if (!reqMappings.has(m.requirementId)) reqMappings.set(m.requirementId, []);
      reqMappings.get(m.requirementId)!.push(m.controlId);
    }

    // Build CSV rows
    const header = ["code", "title", "description", "parent_id", "status", "mapped_controls", "latest_test_result"];
    const rows = requirements.map((req) => {
      const cIds = reqMappings.get(req.id) || [];
      let gapStatus = "gap";
      let latestResult = "not_tested";

      if (cIds.length > 0) {
        const allPassed = cIds.every((cid) => latestResultByControl[cid] === "pass");
        gapStatus = allPassed ? "covered" : "partial";
        // Get the most recent test result across mapped controls
        const results = cIds.map((cid) => latestResultByControl[cid]).filter(Boolean);
        if (results.length > 0) latestResult = results[results.length - 1];
      }

      const mappedControlTitles = cIds.map((cid) => controlMap.get(cid)?.title ?? cid).join(" | ");

      return [
        req.code,
        req.title,
        req.description ?? "",
        req.parentId ?? "",
        gapStatus,
        mappedControlTitles,
        latestResult,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [header.join(","), ...rows].join("\n");
    const filename = `${framework.name.replace(/[^a-z0-9]/gi, "-")}-compliance.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error("Export CSV error:", err);
    serverError(res);
  }
});

router.get("/v1/controls", async (req, res) => {
  try {
    const { status, page = "1", limit = "50" } = req.query;
    const tenantId = req.user!.tenantId;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [eq(controlsTable.tenantId, tenantId)];
    if (status) conditions.push(eq(controlsTable.status, status as "active" | "inactive" | "planned"));

    const [controls, countResult] = await Promise.all([
      db.select({
        id: controlsTable.id,
        title: controlsTable.title,
        description: controlsTable.description,
        status: controlsTable.status,
        ownerId: controlsTable.ownerId,
        createdAt: controlsTable.createdAt,
        updatedAt: controlsTable.updatedAt,
      }).from(controlsTable).where(and(...conditions)).limit(Number(limit)).offset(offset).orderBy(controlsTable.title),
      db.select({ count: sql<number>`count(*)::int` }).from(controlsTable).where(and(...conditions)),
    ]);

    res.json({ data: controls, total: countResult[0].count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("List controls error:", err);
    serverError(res);
  }
});

router.get("/v1/controls/:id", async (req, res) => {
  try {
    const [control] = await db.select().from(controlsTable)
      .where(and(eq(controlsTable.id, p(req, "id")), eq(controlsTable.tenantId, req.user!.tenantId))).limit(1);
    if (!control) { notFound(res, "Control not found"); return; }

    const mappings = await db.select({
      requirementId: controlRequirementMapsTable.requirementId,
    }).from(controlRequirementMapsTable)
      .where(and(eq(controlRequirementMapsTable.controlId, control.id), eq(controlRequirementMapsTable.tenantId, req.user!.tenantId)));

    const tests = await db.select().from(controlTestsTable)
      .where(and(eq(controlTestsTable.controlId, control.id), eq(controlTestsTable.tenantId, req.user!.tenantId)))
      .orderBy(controlTestsTable.createdAt);

    res.json({ ...control, requirementIds: mappings.map(m => m.requirementId), tests });
  } catch (err) {
    console.error("Get control error:", err);
    serverError(res);
  }
});

router.post("/v1/controls", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const { title, description, status, ownerId, requirementIds } = req.body;
    if (!title) { badRequest(res, "title is required"); return; }

    const [control] = await db.insert(controlsTable).values({
      tenantId: req.user!.tenantId,
      title,
      description,
      status: status || "planned",
      ownerId,
    }).returning();

    if (requirementIds && Array.isArray(requirementIds) && requirementIds.length > 0) {
      await db.insert(controlRequirementMapsTable).values(
        requirementIds.map((rid: string) => ({
          tenantId: req.user!.tenantId,
          controlId: control.id,
          requirementId: rid,
        }))
      );
    }

    await recordAudit(req, "create", "control", control.id);
    res.status(201).json(control);
  } catch (err) {
    console.error("Create control error:", err);
    serverError(res);
  }
});

router.put("/v1/controls/:id", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const { title, description, status, ownerId } = req.body;
    const [control] = await db.update(controlsTable).set({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(ownerId !== undefined && { ownerId }),
      updatedAt: new Date(),
    }).where(and(eq(controlsTable.id, p(req, "id")), eq(controlsTable.tenantId, req.user!.tenantId))).returning();

    if (!control) { notFound(res, "Control not found"); return; }
    await recordAudit(req, "update", "control", control.id);
    res.json(control);
  } catch (err) {
    console.error("Update control error:", err);
    serverError(res);
  }
});

router.delete("/v1/controls/:id", requireRole("admin"), async (req, res) => {
  try {
    await db.delete(controlRequirementMapsTable)
      .where(and(eq(controlRequirementMapsTable.controlId, p(req, "id")), eq(controlRequirementMapsTable.tenantId, req.user!.tenantId)));
    const [control] = await db.delete(controlsTable)
      .where(and(eq(controlsTable.id, p(req, "id")), eq(controlsTable.tenantId, req.user!.tenantId))).returning();
    if (!control) { notFound(res, "Control not found"); return; }
    await recordAudit(req, "delete", "control", control.id);
    res.json({ deleted: true, id: control.id });
  } catch (err) {
    console.error("Delete control error:", err);
    serverError(res);
  }
});

router.post("/v1/controls/:id/requirements", requireRole("admin", "risk_manager", "auditor"), async (req, res) => {
  try {
    const { requirementIds } = req.body;
    if (!requirementIds || !Array.isArray(requirementIds)) { badRequest(res, "requirementIds array is required"); return; }

    const controlId = p(req, "id");
    const tenantId = req.user!.tenantId;

    const [control] = await db.select().from(controlsTable)
      .where(and(eq(controlsTable.id, controlId), eq(controlsTable.tenantId, tenantId))).limit(1);
    if (!control) { notFound(res, "Control not found"); return; }

    await db.delete(controlRequirementMapsTable)
      .where(and(eq(controlRequirementMapsTable.controlId, controlId), eq(controlRequirementMapsTable.tenantId, tenantId)));

    if (requirementIds.length > 0) {
      await db.insert(controlRequirementMapsTable).values(
        requirementIds.map((rid: string) => ({ tenantId, controlId, requirementId: rid }))
      );
    }

    await recordAudit(req, "map_requirements", "control", controlId, { requirementIds });
    res.json({ controlId, requirementIds });
  } catch (err) {
    console.error("Map requirements error:", err);
    serverError(res);
  }
});

// POST /v1/controls/:id/auto-map-suggestions — pgvector similarity match (D-09)
router.post("/v1/controls/:id/auto-map-suggestions", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const controlId = p(req, "id");

    const [control] = await db.select({ id: controlsTable.id, title: controlsTable.title, description: controlsTable.description })
      .from(controlsTable)
      .where(and(eq(controlsTable.id, controlId), eq(controlsTable.tenantId, tenantId)))
      .limit(1);
    if (!control) { notFound(res, "Control not found"); return; }

    const queryText = control.description || control.title;
    let embedding: number[];
    try {
      embedding = await generateEmbedding(tenantId, queryText);
    } catch (err) {
      if (err instanceof LLMUnavailableError) {
        res.json({ suggestions: [] });
        return;
      }
      throw err;
    }

    const vectorStr = `[${embedding.join(",")}]`;
    const THRESHOLD = 0.65;
    const result = await db.execute(sql`
      SELECT id, code, title, framework_id,
             1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM framework_requirements
      WHERE tenant_id = ${tenantId}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorStr}::vector) > ${THRESHOLD}
      ORDER BY similarity DESC
      LIMIT 10
    `);

    const suggestions = (result.rows as { id: string; code: string; title: string; framework_id: string; similarity: number }[]).map((r) => ({
      requirementId: r.id,
      code: r.code,
      title: r.title,
      frameworkId: r.framework_id,
      similarity: Number(r.similarity),
    }));

    res.json({ suggestions });
  } catch (err) {
    console.error("Auto-map suggestions error:", err);
    serverError(res);
  }
});

router.get("/v1/controls/:controlId/tests", async (req, res) => {
  try {
    const tests = await db.select().from(controlTestsTable)
      .where(and(eq(controlTestsTable.controlId, p(req, "controlId")), eq(controlTestsTable.tenantId, req.user!.tenantId)))
      .orderBy(controlTestsTable.createdAt);
    res.json({ data: tests });
  } catch (err) {
    console.error("List control tests error:", err);
    serverError(res);
  }
});

// POST /v1/controls/:controlId/tests — create control test with optional evidence upload (D-02, D-13)
router.post("/v1/controls/:controlId/tests", requireRole("admin", "auditor"), evidenceUpload, async (req, res) => {
  try {
    const controlId = p(req, "controlId");
    const tenantId = req.user!.tenantId;
    if (!(await verifyControlOwnership(controlId, tenantId, res))) return;

    const { result, evidence, notes, evidenceExpiry } = req.body;
    if (!result) { badRequest(res, "result is required"); return; }

    let evidenceUrl: string | null = null;
    let evidenceFileName: string | null = null;
    let evidenceMimeType: string | null = null;

    if (req.file) {
      evidenceUrl = `/uploads/evidence/${req.file.filename}`;
      evidenceFileName = req.file.originalname;
      evidenceMimeType = req.file.mimetype;
    }

    const [test] = await db.insert(controlTestsTable).values({
      tenantId,
      controlId,
      testerId: req.user!.id,
      result,
      evidence: evidence ?? null,
      evidenceUrl: evidenceUrl ?? (req.body.evidenceUrl ?? null),
      evidenceFileName,
      evidenceMimeType,
      evidenceExpiry: evidenceExpiry ? new Date(evidenceExpiry) : null,
      notes: notes ?? null,
      testedAt: new Date(),
    }).returning();

    await recordAudit(req, "create", "control_test", test.id);

    // Trigger compliance pipeline for all frameworks this control maps to (D-02)
    const mappings = await db.select({
      requirementId: controlRequirementMapsTable.requirementId,
    }).from(controlRequirementMapsTable)
      .where(and(eq(controlRequirementMapsTable.controlId, controlId), eq(controlRequirementMapsTable.tenantId, tenantId)));

    if (mappings.length > 0) {
      const reqIds = mappings.map((m) => m.requirementId);
      const frameworks = await db.select({ frameworkId: frameworkRequirementsTable.frameworkId })
        .from(frameworkRequirementsTable)
        .where(and(eq(frameworkRequirementsTable.tenantId, tenantId), inArray(frameworkRequirementsTable.id, reqIds)));

      const uniqueFrameworkIds = [...new Set(frameworks.map((f) => f.frameworkId))];
      for (const fwId of uniqueFrameworkIds) {
        recalculateAndTriggerPipeline(fwId, tenantId).catch((err) =>
          console.error("Pipeline error after control test:", err)
        );
      }
    }

    res.status(201).json(test);
  } catch (err) {
    console.error("Create control test error:", err);
    serverError(res);
  }
});

router.get("/v1/frameworks/:frameworkId/compliance-score", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const frameworkId = p(req, "frameworkId");

    const [framework] = await db.select().from(frameworksTable)
      .where(and(eq(frameworksTable.id, frameworkId), eq(frameworksTable.tenantId, tenantId))).limit(1);
    if (!framework) { notFound(res, "Framework not found"); return; }

    const requirements = await db.select({ id: frameworkRequirementsTable.id })
      .from(frameworkRequirementsTable)
      .where(and(eq(frameworkRequirementsTable.frameworkId, frameworkId), eq(frameworkRequirementsTable.tenantId, tenantId)));

    const totalRequirements = requirements.length;
    if (totalRequirements === 0) {
      res.json({
        frameworkId, frameworkName: framework.name, totalRequirements: 0,
        coveredRequirements: 0, score: 0,
        status: framework.complianceThreshold !== null ? getComplianceStatus(0, Number(framework.complianceThreshold)) : null,
      });
      return;
    }

    const reqIds = requirements.map(r => r.id);

    const mappings = await db.select({
      requirementId: controlRequirementMapsTable.requirementId,
      controlId: controlRequirementMapsTable.controlId,
    }).from(controlRequirementMapsTable)
      .where(and(
        eq(controlRequirementMapsTable.tenantId, tenantId),
        inArray(controlRequirementMapsTable.requirementId, reqIds),
      ));

    const coveredReqIds = new Set(mappings.map(m => m.requirementId));

    const controlIdSet = new Set<string>();
    for (const m of mappings) controlIdSet.add(m.controlId);
    const controlIds: string[] = Array.from(controlIdSet);
    let passedControls = 0;
    if (controlIds.length > 0) {
      const latestTests = await db.select({
        controlId: controlTestsTable.controlId,
        result: controlTestsTable.result,
      }).from(controlTestsTable)
        .where(and(
          eq(controlTestsTable.tenantId, tenantId),
          inArray(controlTestsTable.controlId, controlIds),
        ))
        .orderBy(controlTestsTable.testedAt);

      const latestByControl: Record<string, string> = {};
      for (const t of latestTests) {
        latestByControl[t.controlId] = t.result;
      }
      passedControls = Object.values(latestByControl).filter(r => r === "pass").length;
    }

    const coveredRequirements = coveredReqIds.size;
    const coverageScore = totalRequirements > 0 ? Math.round((coveredRequirements / totalRequirements) * 100) : 0;
    const effectivenessScore = controlIds.length > 0 ? Math.round((passedControls / controlIds.length) * 100) : 0;
    const score = Math.round((coverageScore * 0.6 + effectivenessScore * 0.4));

    const threshold = framework.complianceThreshold !== null ? Number(framework.complianceThreshold) : null;
    const status = threshold !== null ? getComplianceStatus(score, threshold) : null;

    res.json({
      frameworkId,
      frameworkName: framework.name,
      totalRequirements,
      coveredRequirements,
      coverageScore,
      effectivenessScore,
      score,
      totalControls: controlIds.length,
      passedControls,
      status,
    });
  } catch (err) {
    console.error("Compliance score error:", err);
    serverError(res);
  }
});

router.get("/v1/frameworks/:frameworkId/gap-analysis", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const frameworkId = p(req, "frameworkId");

    const [framework] = await db.select().from(frameworksTable)
      .where(and(eq(frameworksTable.id, frameworkId), eq(frameworksTable.tenantId, tenantId))).limit(1);
    if (!framework) { notFound(res, "Framework not found"); return; }

    const requirements = await db.select({
      id: frameworkRequirementsTable.id,
      code: frameworkRequirementsTable.code,
      title: frameworkRequirementsTable.title,
      parentId: frameworkRequirementsTable.parentId,
    }).from(frameworkRequirementsTable)
      .where(and(eq(frameworkRequirementsTable.frameworkId, frameworkId), eq(frameworkRequirementsTable.tenantId, tenantId)))
      .orderBy(frameworkRequirementsTable.code);

    const reqIds = requirements.map(r => r.id);
    const mappings = reqIds.length > 0
      ? await db.select({
          requirementId: controlRequirementMapsTable.requirementId,
          controlId: controlRequirementMapsTable.controlId,
        }).from(controlRequirementMapsTable)
          .where(and(eq(controlRequirementMapsTable.tenantId, tenantId), inArray(controlRequirementMapsTable.requirementId, reqIds)))
      : [];

    const controlIdSet = new Set<string>();
    for (const m of mappings) controlIdSet.add(m.controlId);
    const controlIds: string[] = Array.from(controlIdSet);
    const controls = controlIds.length > 0
      ? await db.select({
          id: controlsTable.id,
          title: controlsTable.title,
          status: controlsTable.status,
        }).from(controlsTable)
          .where(and(eq(controlsTable.tenantId, tenantId), sql`${controlsTable.id} = ANY(${controlIds})`))
      : [];

    const latestTests = controlIds.length > 0
      ? await db.select({
          controlId: controlTestsTable.controlId,
          result: controlTestsTable.result,
        }).from(controlTestsTable)
          .where(and(eq(controlTestsTable.tenantId, tenantId), sql`${controlTestsTable.controlId} = ANY(${controlIds})`))
          .orderBy(controlTestsTable.testedAt)
      : [];

    const latestResultByControl: Record<string, string> = {};
    for (const t of latestTests) {
      latestResultByControl[t.controlId] = t.result;
    }

    const controlMap = new Map(controls.map(c => [c.id, c]));
    const reqMappings = new Map<string, string[]>();
    for (const m of mappings) {
      if (!reqMappings.has(m.requirementId)) reqMappings.set(m.requirementId, []);
      reqMappings.get(m.requirementId)!.push(m.controlId);
    }

    type GapStatus = "covered" | "partial" | "gap";
    const gaps = requirements.map(req => {
      const cIds = reqMappings.get(req.id) || [];
      let gapStatus: GapStatus = "gap";
      const controlDetails = cIds.map(cid => {
        const c = controlMap.get(cid);
        return { id: cid, title: c?.title, status: c?.status, testResult: latestResultByControl[cid] || "not_tested" };
      });

      if (cIds.length > 0) {
        const allPassed = controlDetails.every(c => c.testResult === "pass");
        gapStatus = allPassed ? "covered" : "partial";
      }

      return { requirementId: req.id, code: req.code, title: req.title, parentId: req.parentId, status: gapStatus, controls: controlDetails };
    });

    const summary = {
      total: gaps.length,
      covered: gaps.filter(g => g.status === "covered").length,
      partial: gaps.filter(g => g.status === "partial").length,
      gap: gaps.filter(g => g.status === "gap").length,
    };

    res.json({ frameworkId, frameworkName: framework.name, summary, requirements: gaps });
  } catch (err) {
    console.error("Gap analysis error:", err);
    serverError(res);
  }
});

export default router;
