import { Router, type Request, type Response } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";

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

async function verifyControlOwnership(controlId: string, tenantId: string, res: Response): Promise<boolean> {
  const [control] = await db.select({ id: controlsTable.id }).from(controlsTable)
    .where(and(eq(controlsTable.id, controlId), eq(controlsTable.tenantId, tenantId))).limit(1);
  if (!control) { notFound(res, "Control not found"); return false; }
  return true;
}

const router = Router();

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

router.post("/v1/controls/:controlId/tests", requireRole("admin", "auditor"), async (req, res) => {
  try {
    const controlId = p(req, "controlId");
    if (!(await verifyControlOwnership(controlId, req.user!.tenantId, res))) return;
    const { result, evidence, evidenceUrl, notes } = req.body;
    if (!result) { badRequest(res, "result is required"); return; }

    const [test] = await db.insert(controlTestsTable).values({
      tenantId: req.user!.tenantId,
      controlId,
      testerId: req.user!.id,
      result,
      evidence,
      evidenceUrl,
      notes,
      testedAt: new Date(),
    }).returning();

    await recordAudit(req, "create", "control_test", test.id);
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
      res.json({ frameworkId, frameworkName: framework.name, totalRequirements: 0, coveredRequirements: 0, score: 0 });
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
          sql`${controlTestsTable.controlId} = ANY(${controlIds})`,
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
