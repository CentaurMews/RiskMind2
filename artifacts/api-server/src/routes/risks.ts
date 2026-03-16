import { Router, type Request, type Response } from "express";
import { eq, and, sql, ilike, inArray } from "drizzle-orm";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}
import {
  db,
  risksTable,
  treatmentsTable,
  krisTable,
  incidentsTable,
  reviewCyclesTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError } from "../lib/errors";

async function verifyRiskOwnership(riskId: string, tenantId: string, res: Response): Promise<boolean> {
  const [risk] = await db.select({ id: risksTable.id }).from(risksTable)
    .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId))).limit(1);
  if (!risk) { notFound(res, "Risk not found"); return false; }
  return true;
}

const router = Router();

router.get("/v1/risks", async (req, res) => {
  try {
    const { status, category, ownerId, severity, search, page = "1", limit = "20" } = req.query;
    const tenantId = req.user!.tenantId;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [eq(risksTable.tenantId, tenantId)];
    if (status) conditions.push(eq(risksTable.status, status as "draft" | "open" | "mitigated" | "accepted" | "closed"));
    if (category) conditions.push(eq(risksTable.category, category as "operational" | "financial" | "compliance" | "strategic" | "technology" | "reputational"));
    if (ownerId) conditions.push(eq(risksTable.ownerId, String(ownerId)));
    if (search) conditions.push(ilike(risksTable.title, `%${search}%`));
    if (severity) {
      const severityRanges: Record<string, [number, number]> = {
        low: [1, 4],
        medium: [5, 9],
        high: [10, 16],
        critical: [17, 25],
      };
      const range = severityRanges[String(severity)];
      if (range) {
        conditions.push(sql`(${risksTable.likelihood} * ${risksTable.impact}) >= ${range[0]}`);
        conditions.push(sql`(${risksTable.likelihood} * ${risksTable.impact}) <= ${range[1]}`);
      }
    }

    const [risks, countResult] = await Promise.all([
      db
        .select({
          id: risksTable.id,
          title: risksTable.title,
          description: risksTable.description,
          category: risksTable.category,
          status: risksTable.status,
          ownerId: risksTable.ownerId,
          likelihood: risksTable.likelihood,
          impact: risksTable.impact,
          residualLikelihood: risksTable.residualLikelihood,
          residualImpact: risksTable.residualImpact,
          createdAt: risksTable.createdAt,
          updatedAt: risksTable.updatedAt,
        })
        .from(risksTable)
        .where(and(...conditions))
        .limit(Number(limit))
        .offset(offset)
        .orderBy(risksTable.createdAt),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(risksTable)
        .where(and(...conditions)),
    ]);

    res.json({ data: risks, total: countResult[0].count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("List risks error:", err);
    serverError(res);
  }
});

router.get("/v1/risks/heatmap", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const risks = await db
      .select({
        id: risksTable.id,
        title: risksTable.title,
        likelihood: risksTable.likelihood,
        impact: risksTable.impact,
        status: risksTable.status,
        category: risksTable.category,
      })
      .from(risksTable)
      .where(and(eq(risksTable.tenantId, tenantId), inArray(risksTable.status, ["open", "mitigated"])));

    const cells: Record<string, { likelihood: number; impact: number; risks: typeof risks }> = {};
    for (const r of risks) {
      const key = `${r.likelihood}-${r.impact}`;
      if (!cells[key]) cells[key] = { likelihood: r.likelihood, impact: r.impact, risks: [] };
      cells[key].risks.push(r);
    }

    res.json({ cells: Object.values(cells) });
  } catch (err) {
    console.error("Heatmap error:", err);
    serverError(res);
  }
});

router.get("/v1/risks/:id", async (req, res) => {
  try {
    const [risk] = await db
      .select({
        id: risksTable.id,
        title: risksTable.title,
        description: risksTable.description,
        category: risksTable.category,
        status: risksTable.status,
        ownerId: risksTable.ownerId,
        likelihood: risksTable.likelihood,
        impact: risksTable.impact,
        residualLikelihood: risksTable.residualLikelihood,
        residualImpact: risksTable.residualImpact,
        createdAt: risksTable.createdAt,
        updatedAt: risksTable.updatedAt,
      })
      .from(risksTable)
      .where(and(eq(risksTable.id, p(req, "id")), eq(risksTable.tenantId, req.user!.tenantId)))
      .limit(1);

    if (!risk) { notFound(res, "Risk not found"); return; }
    res.json(risk);
  } catch (err) {
    console.error("Get risk error:", err);
    serverError(res);
  }
});

router.post("/v1/risks", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const { title, description, category, status, ownerId, likelihood, impact } = req.body;
    if (!title || !category) { badRequest(res, "title and category are required"); return; }

    const [risk] = await db.insert(risksTable).values({
      tenantId: req.user!.tenantId,
      title,
      description,
      category,
      status: status || "draft",
      ownerId,
      likelihood: likelihood || 1,
      impact: impact || 1,
    }).returning();

    await recordAudit(req, "create", "risk", risk.id);
    res.status(201).json(risk);
  } catch (err) {
    console.error("Create risk error:", err);
    serverError(res);
  }
});

router.put("/v1/risks/:id", requireRole("admin", "risk_manager", "risk_owner"), async (req, res) => {
  try {
    const { title, description, category, status, ownerId, likelihood, impact, residualLikelihood, residualImpact } = req.body;
    const [risk] = await db
      .update(risksTable)
      .set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(status !== undefined && { status }),
        ...(ownerId !== undefined && { ownerId }),
        ...(likelihood !== undefined && { likelihood }),
        ...(impact !== undefined && { impact }),
        ...(residualLikelihood !== undefined && { residualLikelihood }),
        ...(residualImpact !== undefined && { residualImpact }),
        updatedAt: new Date(),
      })
      .where(and(eq(risksTable.id, p(req, "id")), eq(risksTable.tenantId, req.user!.tenantId)))
      .returning();

    if (!risk) { notFound(res, "Risk not found"); return; }
    await recordAudit(req, "update", "risk", risk.id);
    res.json(risk);
  } catch (err) {
    console.error("Update risk error:", err);
    serverError(res);
  }
});

router.delete("/v1/risks/:id", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const [risk] = await db
      .delete(risksTable)
      .where(and(eq(risksTable.id, p(req, "id")), eq(risksTable.tenantId, req.user!.tenantId)))
      .returning();

    if (!risk) { notFound(res, "Risk not found"); return; }
    await recordAudit(req, "delete", "risk", risk.id);
    res.json({ deleted: true, id: risk.id });
  } catch (err) {
    console.error("Delete risk error:", err);
    serverError(res);
  }
});

router.get("/v1/risks/:riskId/treatments", async (req, res) => {
  try {
    const treatments = await db
      .select()
      .from(treatmentsTable)
      .where(and(eq(treatmentsTable.riskId, p(req, "riskId")), eq(treatmentsTable.tenantId, req.user!.tenantId)));

    res.json({ data: treatments });
  } catch (err) {
    console.error("List treatments error:", err);
    serverError(res);
  }
});

router.post("/v1/risks/:riskId/treatments", requireRole("admin", "risk_manager", "risk_owner"), async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    if (!(await verifyRiskOwnership(riskId, req.user!.tenantId, res))) return;
    const { strategy, description, status, ownerId, dueDate, cost } = req.body;
    if (!strategy) { badRequest(res, "strategy is required"); return; }

    const [treatment] = await db.insert(treatmentsTable).values({
      tenantId: req.user!.tenantId,
      riskId,
      strategy,
      description,
      status: status || "planned",
      ownerId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      cost,
    }).returning();

    await recordAudit(req, "create", "treatment", treatment.id);
    res.status(201).json(treatment);
  } catch (err) {
    console.error("Create treatment error:", err);
    serverError(res);
  }
});

router.put("/v1/risks/:riskId/treatments/:id", requireRole("admin", "risk_manager", "risk_owner"), async (req, res) => {
  try {
    const { strategy, description, status, ownerId, dueDate, cost } = req.body;
    const [treatment] = await db
      .update(treatmentsTable)
      .set({
        ...(strategy !== undefined && { strategy }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(ownerId !== undefined && { ownerId }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(cost !== undefined && { cost }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(treatmentsTable.id, p(req, "id")),
        eq(treatmentsTable.riskId, p(req, "riskId")),
        eq(treatmentsTable.tenantId, req.user!.tenantId),
      ))
      .returning();

    if (!treatment) { notFound(res, "Treatment not found"); return; }
    await recordAudit(req, "update", "treatment", treatment.id);
    res.json(treatment);
  } catch (err) {
    console.error("Update treatment error:", err);
    serverError(res);
  }
});

router.delete("/v1/risks/:riskId/treatments/:id", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const [treatment] = await db
      .delete(treatmentsTable)
      .where(and(
        eq(treatmentsTable.id, p(req, "id")),
        eq(treatmentsTable.riskId, p(req, "riskId")),
        eq(treatmentsTable.tenantId, req.user!.tenantId),
      ))
      .returning();

    if (!treatment) { notFound(res, "Treatment not found"); return; }
    await recordAudit(req, "delete", "treatment", treatment.id);
    res.json({ deleted: true, id: treatment.id });
  } catch (err) {
    console.error("Delete treatment error:", err);
    serverError(res);
  }
});

router.get("/v1/risks/:riskId/kris", async (req, res) => {
  try {
    const kris = await db
      .select()
      .from(krisTable)
      .where(and(eq(krisTable.riskId, p(req, "riskId")), eq(krisTable.tenantId, req.user!.tenantId)));
    res.json({ data: kris });
  } catch (err) {
    console.error("List KRIs error:", err);
    serverError(res);
  }
});

router.post("/v1/risks/:riskId/kris", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    if (!(await verifyRiskOwnership(riskId, req.user!.tenantId, res))) return;
    const { name, description, warningThreshold, criticalThreshold, currentValue, unit } = req.body;
    if (!name) { badRequest(res, "name is required"); return; }

    const [kri] = await db.insert(krisTable).values({
      tenantId: req.user!.tenantId,
      riskId,
      name,
      description,
      warningThreshold,
      criticalThreshold,
      currentValue,
      unit,
    }).returning();

    await recordAudit(req, "create", "kri", kri.id);
    res.status(201).json(kri);
  } catch (err) {
    console.error("Create KRI error:", err);
    serverError(res);
  }
});

router.put("/v1/risks/:riskId/kris/:id", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const { name, description, warningThreshold, criticalThreshold, currentValue, unit } = req.body;
    const [kri] = await db
      .update(krisTable)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(warningThreshold !== undefined && { warningThreshold }),
        ...(criticalThreshold !== undefined && { criticalThreshold }),
        ...(currentValue !== undefined && { currentValue }),
        ...(unit !== undefined && { unit }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(krisTable.id, p(req, "id")),
        eq(krisTable.riskId, p(req, "riskId")),
        eq(krisTable.tenantId, req.user!.tenantId),
      ))
      .returning();

    if (!kri) { notFound(res, "KRI not found"); return; }

    let breach: string | null = null;
    if (kri.currentValue && kri.criticalThreshold && Number(kri.currentValue) >= Number(kri.criticalThreshold)) {
      breach = "critical";
    } else if (kri.currentValue && kri.warningThreshold && Number(kri.currentValue) >= Number(kri.warningThreshold)) {
      breach = "warning";
    }

    await recordAudit(req, "update", "kri", kri.id, { breach });

    if (currentValue !== undefined && kri.currentValue) {
      await recordAudit(req, "kri_updated", "kri", kri.id, {
        kriId: kri.id,
        value: kri.currentValue,
        breach,
      });

      if (breach) {
        await recordAudit(req, "kri_breach", "kri", kri.id, {
          kriId: kri.id,
          value: kri.currentValue,
          level: breach,
          threshold: breach === "critical" ? kri.criticalThreshold : kri.warningThreshold,
        });
      }
    }

    res.json({ ...kri, breach });
  } catch (err) {
    console.error("Update KRI error:", err);
    serverError(res);
  }
});

router.delete("/v1/risks/:riskId/kris/:id", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const [kri] = await db
      .delete(krisTable)
      .where(and(
        eq(krisTable.id, p(req, "id")),
        eq(krisTable.riskId, p(req, "riskId")),
        eq(krisTable.tenantId, req.user!.tenantId),
      ))
      .returning();

    if (!kri) { notFound(res, "KRI not found"); return; }
    await recordAudit(req, "delete", "kri", kri.id);
    res.json({ deleted: true, id: kri.id });
  } catch (err) {
    console.error("Delete KRI error:", err);
    serverError(res);
  }
});

router.get("/v1/risks/:riskId/incidents", async (req, res) => {
  try {
    const incidents = await db
      .select()
      .from(incidentsTable)
      .where(and(eq(incidentsTable.riskId, p(req, "riskId")), eq(incidentsTable.tenantId, req.user!.tenantId)))
      .orderBy(incidentsTable.createdAt);
    res.json({ data: incidents });
  } catch (err) {
    console.error("List incidents error:", err);
    serverError(res);
  }
});

router.post("/v1/risks/:riskId/incidents", requireRole("admin", "risk_manager", "risk_owner"), async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    if (!(await verifyRiskOwnership(riskId, req.user!.tenantId, res))) return;
    const { title, description, severity, occurredAt } = req.body;
    if (!title) { badRequest(res, "title is required"); return; }

    const [incident] = await db.insert(incidentsTable).values({
      tenantId: req.user!.tenantId,
      riskId,
      title,
      description,
      severity: severity || "medium",
      reportedBy: req.user!.id,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    }).returning();

    await recordAudit(req, "create", "incident", incident.id);
    res.status(201).json(incident);
  } catch (err) {
    console.error("Create incident error:", err);
    serverError(res);
  }
});

router.put("/v1/risks/:riskId/incidents/:id", requireRole("admin", "risk_manager", "risk_owner"), async (req, res) => {
  try {
    const { title, description, severity, resolvedAt } = req.body;
    const [incident] = await db
      .update(incidentsTable)
      .set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(severity !== undefined && { severity }),
        ...(resolvedAt !== undefined && { resolvedAt: resolvedAt ? new Date(resolvedAt) : null }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(incidentsTable.id, p(req, "id")),
        eq(incidentsTable.riskId, p(req, "riskId")),
        eq(incidentsTable.tenantId, req.user!.tenantId),
      ))
      .returning();

    if (!incident) { notFound(res, "Incident not found"); return; }
    await recordAudit(req, "update", "incident", incident.id);
    res.json(incident);
  } catch (err) {
    console.error("Update incident error:", err);
    serverError(res);
  }
});

router.delete("/v1/risks/:riskId/incidents/:id", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const [incident] = await db
      .delete(incidentsTable)
      .where(and(
        eq(incidentsTable.id, p(req, "id")),
        eq(incidentsTable.riskId, p(req, "riskId")),
        eq(incidentsTable.tenantId, req.user!.tenantId),
      ))
      .returning();

    if (!incident) { notFound(res, "Incident not found"); return; }
    await recordAudit(req, "delete", "incident", incident.id);
    res.json({ deleted: true, id: incident.id });
  } catch (err) {
    console.error("Delete incident error:", err);
    serverError(res);
  }
});

router.get("/v1/risks/:riskId/reviews", async (req, res) => {
  try {
    const reviews = await db
      .select()
      .from(reviewCyclesTable)
      .where(and(eq(reviewCyclesTable.riskId, p(req, "riskId")), eq(reviewCyclesTable.tenantId, req.user!.tenantId)))
      .orderBy(reviewCyclesTable.dueDate);
    res.json({ data: reviews });
  } catch (err) {
    console.error("List reviews error:", err);
    serverError(res);
  }
});

router.post("/v1/risks/:riskId/reviews", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    if (!(await verifyRiskOwnership(riskId, req.user!.tenantId, res))) return;
    const { reviewerId, dueDate, notes } = req.body;
    if (!dueDate) { badRequest(res, "dueDate is required"); return; }

    const [review] = await db.insert(reviewCyclesTable).values({
      tenantId: req.user!.tenantId,
      riskId,
      reviewerId,
      dueDate: new Date(dueDate),
      notes,
    }).returning();

    await recordAudit(req, "create", "review_cycle", review.id);
    res.status(201).json(review);
  } catch (err) {
    console.error("Create review error:", err);
    serverError(res);
  }
});

router.put("/v1/risks/:riskId/reviews/:id/complete", requireRole("admin", "risk_manager", "risk_owner"), async (req, res) => {
  try {
    const { notes } = req.body;
    const [existing] = await db.select().from(reviewCyclesTable)
      .where(and(
        eq(reviewCyclesTable.id, p(req, "id")),
        eq(reviewCyclesTable.riskId, p(req, "riskId")),
        eq(reviewCyclesTable.tenantId, req.user!.tenantId),
      )).limit(1);
    if (!existing) { notFound(res, "Review not found"); return; }
    if (existing.status === "completed") { badRequest(res, "Review is already completed"); return; }

    const [review] = await db
      .update(reviewCyclesTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        notes: notes || undefined,
        updatedAt: new Date(),
      })
      .where(eq(reviewCyclesTable.id, existing.id))
      .returning();

    await recordAudit(req, "complete", "review_cycle", review.id);
    res.json(review);
  } catch (err) {
    console.error("Complete review error:", err);
    serverError(res);
  }
});

router.get("/v1/reviews/overdue", async (req, res) => {
  try {
    const overdue = await db
      .select()
      .from(reviewCyclesTable)
      .where(and(
        eq(reviewCyclesTable.tenantId, req.user!.tenantId),
        inArray(reviewCyclesTable.status, ["scheduled", "in_progress"]),
        sql`${reviewCyclesTable.dueDate} < now()`,
      ))
      .orderBy(reviewCyclesTable.dueDate);
    res.json({ data: overdue });
  } catch (err) {
    console.error("Overdue reviews error:", err);
    serverError(res);
  }
});

export default router;
