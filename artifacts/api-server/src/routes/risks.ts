import { Router, type Request, type Response } from "express";
import { eq, and, sql, ilike, inArray } from "drizzle-orm";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}
import {
  db,
  risksTable,
  riskSourcesTable,
  treatmentsTable,
  treatmentStatusEventsTable,
  usersTable,
  krisTable,
  incidentsTable,
  reviewCyclesTable,
  acceptanceMemorandaTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError } from "../lib/errors";
import { complete, isAvailable, LLMUnavailableError } from "../lib/llm-service";

async function verifyRiskOwnership(riskId: string, tenantId: string, res: Response): Promise<boolean> {
  const [risk] = await db.select({ id: risksTable.id }).from(risksTable)
    .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId))).limit(1);
  if (!risk) { notFound(res, "Risk not found"); return false; }
  return true;
}

const router = Router();

router.get("/v1/risks", async (req, res) => {
  try {
    const { status, category, ownerId, severity, search, treatmentStrategy, page = "1", limit = "20" } = req.query;
    const tenantId = req.user!.tenantId;
    const offset = (Number(page) - 1) * Number(limit);

    const validStatuses = ["draft", "open", "mitigated", "accepted", "closed"] as const;
    type RiskStatusType = typeof validStatuses[number];

    const conditions = [eq(risksTable.tenantId, tenantId)];

    if (status) {
      const statusList = String(status).split(",").filter(s => validStatuses.includes(s as RiskStatusType)) as RiskStatusType[];
      if (statusList.length === 1) {
        conditions.push(eq(risksTable.status, statusList[0]));
      } else if (statusList.length > 1) {
        conditions.push(inArray(risksTable.status, statusList));
      }
    }

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

    const validStrategies = ["treat", "transfer", "tolerate", "terminate"] as const;
    type StrategyType = typeof validStrategies[number];
    const strategyList = treatmentStrategy
      ? String(treatmentStrategy).split(",").filter(s => validStrategies.includes(s as StrategyType)) as StrategyType[]
      : [];

    if (strategyList.length > 0) {
      const subquery = db
        .selectDistinct({ riskId: treatmentsTable.riskId })
        .from(treatmentsTable)
        .where(and(
          eq(treatmentsTable.tenantId, tenantId),
          inArray(treatmentsTable.strategy, strategyList),
        ));

      conditions.push(sql`${risksTable.id} IN (${subquery})`);
    }

    const whereClause = and(...conditions);

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
          targetLikelihood: risksTable.targetLikelihood,
          targetImpact: risksTable.targetImpact,
          createdAt: risksTable.createdAt,
          updatedAt: risksTable.updatedAt,
        })
        .from(risksTable)
        .where(whereClause)
        .limit(Number(limit))
        .offset(offset)
        .orderBy(risksTable.createdAt),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(risksTable)
        .where(whereClause),
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
        targetLikelihood: risksTable.targetLikelihood,
        targetImpact: risksTable.targetImpact,
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
    const { title, description, category, status, ownerId, likelihood, impact, sources } = req.body;
    if (!title || !category) { badRequest(res, "title and category are required"); return; }

    const validSourceTypes = ["signal", "finding", "agent_detection"];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let sourceRows: { riskId: string; sourceType: "signal" | "finding" | "agent_detection"; sourceId: string }[] = [];

    if (sources && Array.isArray(sources)) {
      for (const s of sources) {
        if (!s.sourceType || !validSourceTypes.includes(s.sourceType)) {
          badRequest(res, `Invalid source type: ${s.sourceType}`); return;
        }
        if (!s.sourceId || !uuidRegex.test(s.sourceId)) {
          badRequest(res, `Invalid source ID: ${s.sourceId}`); return;
        }
      }
      sourceRows = sources.map((s: { sourceType: "signal" | "finding" | "agent_detection"; sourceId: string }) => ({
        riskId: "",
        sourceType: s.sourceType,
        sourceId: s.sourceId,
      }));
    }

    const risk = await db.transaction(async (tx) => {
      const [newRisk] = await tx.insert(risksTable).values({
        tenantId: req.user!.tenantId,
        title,
        description,
        category,
        status: status || "draft",
        ownerId,
        likelihood: likelihood || 1,
        impact: impact || 1,
      }).returning();

      if (sourceRows.length > 0) {
        await tx.insert(riskSourcesTable).values(
          sourceRows.map(s => ({ ...s, riskId: newRisk.id }))
        );
      }

      return newRisk;
    });

    await recordAudit(req, "create", "risk", risk.id);
    res.status(201).json(risk);
  } catch (err) {
    console.error("Create risk error:", err);
    serverError(res);
  }
});

router.get("/v1/risks/:riskId/sources", async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    if (!(await verifyRiskOwnership(riskId, req.user!.tenantId, res))) return;
    const sources = await db.select().from(riskSourcesTable)
      .where(eq(riskSourcesTable.riskId, riskId));
    res.json({ data: sources });
  } catch (err) {
    console.error("List risk sources error:", err);
    serverError(res);
  }
});

router.put("/v1/risks/:id", requireRole("admin", "risk_manager", "risk_owner"), async (req, res) => {
  try {
    const { title, description, category, status, ownerId, likelihood, impact, residualLikelihood, residualImpact, targetLikelihood, targetImpact } = req.body;
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
        ...(targetLikelihood !== undefined && { targetLikelihood }),
        ...(targetImpact !== undefined && { targetImpact }),
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
    const { strategy, description, status, ownerId, dueDate, cost, benefit, effectivenessScore, progressNotes } = req.body;
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
      benefit,
      effectivenessScore,
      progressNotes,
    }).returning();

    await db.insert(treatmentStatusEventsTable).values({
      tenantId: req.user!.tenantId,
      treatmentId: treatment.id,
      fromStatus: null,
      toStatus: treatment.status,
      changedBy: req.user!.id,
    });

    await recordAudit(req, "create", "treatment", treatment.id);
    res.status(201).json(treatment);
  } catch (err) {
    console.error("Create treatment error:", err);
    serverError(res);
  }
});

router.put("/v1/risks/:riskId/treatments/:id", requireRole("admin", "risk_manager", "risk_owner"), async (req, res) => {
  try {
    const { strategy, description, status, ownerId, dueDate, cost, benefit, effectivenessScore, progressNotes } = req.body;

    let previousStatus: string | undefined;
    if (status !== undefined) {
      const [existing] = await db.select({ status: treatmentsTable.status })
        .from(treatmentsTable)
        .where(and(
          eq(treatmentsTable.id, p(req, "id")),
          eq(treatmentsTable.tenantId, req.user!.tenantId),
        ))
        .limit(1);
      previousStatus = existing?.status;
    }

    const [treatment] = await db
      .update(treatmentsTable)
      .set({
        ...(strategy !== undefined && { strategy }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(ownerId !== undefined && { ownerId }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(cost !== undefined && { cost }),
        ...(benefit !== undefined && { benefit }),
        ...(effectivenessScore !== undefined && { effectivenessScore }),
        ...(progressNotes !== undefined && { progressNotes }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(treatmentsTable.id, p(req, "id")),
        eq(treatmentsTable.riskId, p(req, "riskId")),
        eq(treatmentsTable.tenantId, req.user!.tenantId),
      ))
      .returning();

    if (!treatment) { notFound(res, "Treatment not found"); return; }

    if (status !== undefined && previousStatus !== undefined && previousStatus !== status) {
      await db.insert(treatmentStatusEventsTable).values({
        tenantId: req.user!.tenantId,
        treatmentId: treatment.id,
        fromStatus: previousStatus as "planned" | "in_progress" | "completed" | "cancelled",
        toStatus: status,
        changedBy: req.user!.id,
      });

      if (status === "completed" && treatment.benefit) {
        const [risk] = await db.select({
          likelihood: risksTable.likelihood,
          impact: risksTable.impact,
          residualLikelihood: risksTable.residualLikelihood,
          residualImpact: risksTable.residualImpact,
        }).from(risksTable).where(eq(risksTable.id, p(req, "riskId"))).limit(1);

        if (risk) {
          const inherentScore = (risk.likelihood || 1) * (risk.impact || 1);
          const residualScore = (risk.residualLikelihood && risk.residualImpact)
            ? risk.residualLikelihood * risk.residualImpact
            : inherentScore;
          const predictedReduction = parseFloat(treatment.benefit) || 0;
          const actualReduction = inherentScore - residualScore;
          const effectiveness = predictedReduction > 0
            ? Math.min(100, Math.round((actualReduction / predictedReduction) * 100))
            : 0;

          const [updated] = await db.update(treatmentsTable)
            .set({ effectivenessScore: effectiveness, updatedAt: new Date() })
            .where(eq(treatmentsTable.id, treatment.id))
            .returning();
          if (updated) {
            Object.assign(treatment, updated);
          }
        }
      }
    }

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

router.get("/v1/risks/:riskId/treatments/:id/status-events", async (req, res) => {
  try {
    const events = await db
      .select({
        id: treatmentStatusEventsTable.id,
        treatmentId: treatmentStatusEventsTable.treatmentId,
        fromStatus: treatmentStatusEventsTable.fromStatus,
        toStatus: treatmentStatusEventsTable.toStatus,
        changedBy: treatmentStatusEventsTable.changedBy,
        changedByName: usersTable.name,
        changedByEmail: usersTable.email,
        note: treatmentStatusEventsTable.note,
        createdAt: treatmentStatusEventsTable.createdAt,
      })
      .from(treatmentStatusEventsTable)
      .innerJoin(treatmentsTable, eq(treatmentStatusEventsTable.treatmentId, treatmentsTable.id))
      .leftJoin(usersTable, eq(treatmentStatusEventsTable.changedBy, usersTable.id))
      .where(and(
        eq(treatmentStatusEventsTable.treatmentId, p(req, "id")),
        eq(treatmentsTable.riskId, p(req, "riskId")),
        eq(treatmentStatusEventsTable.tenantId, req.user!.tenantId),
      ))
      .orderBy(treatmentStatusEventsTable.createdAt);
    res.json({ data: events });
  } catch (err) {
    console.error("List treatment status events error:", err);
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

router.post("/v1/risks/:id/ai-treatment-recommendations", requireRole("admin", "risk_manager"), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const riskId = p(req, "id");

    const available = await isAvailable(tenantId);
    if (!available) {
      res.status(422).json({ error: "AI unavailable", message: "No LLM provider configured." });
      return;
    }

    const [risk] = await db.select().from(risksTable)
      .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId)))
      .limit(1);

    if (!risk) { notFound(res, "Risk not found"); return; }

    const existingTreatments = await db.select().from(treatmentsTable)
      .where(and(eq(treatmentsTable.riskId, riskId), eq(treatmentsTable.tenantId, tenantId)));

    const existingInfo = existingTreatments.length > 0
      ? `\nExisting treatments:\n${existingTreatments.map(t => `- ${t.strategy}: ${t.description} (status: ${t.status}, cost: ${t.cost || 'N/A'})`).join('\n')}`
      : "\nNo existing treatments.";

    const inherentScore = (risk.likelihood || 1) * (risk.impact || 1);

    const response = await complete(tenantId, {
      messages: [
        {
          role: "system",
          content: `You are a risk management expert using the 4T framework (Treat, Transfer, Tolerate, Terminate). Analyze the given risk and recommend 2-4 treatment options ranked by ROI. For each recommendation provide: strategy (treat/transfer/tolerate/terminate), description (actionable treatment plan), estimatedCost (numeric dollar amount), expectedResidualScoreReduction (numeric score points reduced from inherent score of ${inherentScore}), roi (ratio of risk reduction benefit to cost, higher is better), rationale (plain-English explanation of why this treatment is recommended and its expected effectiveness). Respond ONLY in valid JSON: {"recommendations":[{"strategy":"...","description":"...","estimatedCost":N,"expectedResidualScoreReduction":N,"roi":N,"rationale":"..."}]}`,
        },
        {
          role: "user",
          content: `Risk: ${risk.title}\nDescription: ${risk.description || "N/A"}\nCategory: ${risk.category}\nLikelihood: ${risk.likelihood}/5\nImpact: ${risk.impact}/5\nInherent Score: ${inherentScore}/25\nResidual Likelihood: ${risk.residualLikelihood || 'Not set'}\nResidual Impact: ${risk.residualImpact || 'Not set'}${existingInfo}`,
        },
      ],
    });

    const validStrategies = ["treat", "transfer", "tolerate", "terminate"];

    interface RawRecommendation {
      strategy?: string;
      description?: string;
      estimatedCost?: number;
      expectedResidualScoreReduction?: number;
      roi?: number;
      rationale?: string;
    }

    let recommendations: Array<{
      strategy: string;
      description: string;
      estimatedCost: number;
      expectedResidualScoreReduction: number;
      roi: number;
      rationale: string;
    }> = [];

    try {
      const parsed = JSON.parse(response);
      const raw: RawRecommendation[] = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

      recommendations = raw
        .filter((r): r is RawRecommendation & { strategy: string; description: string } =>
          typeof r.strategy === "string" &&
          validStrategies.includes(r.strategy) &&
          typeof r.description === "string" &&
          r.description.length > 0
        )
        .map(r => ({
          strategy: r.strategy,
          description: r.description,
          estimatedCost: typeof r.estimatedCost === "number" && r.estimatedCost >= 0 ? r.estimatedCost : 0,
          expectedResidualScoreReduction: typeof r.expectedResidualScoreReduction === "number" ? Math.max(0, Math.min(r.expectedResidualScoreReduction, inherentScore)) : 0,
          roi: typeof r.roi === "number" && r.roi >= 0 ? Math.round(r.roi * 10) / 10 : 0,
          rationale: typeof r.rationale === "string" ? r.rationale : "",
        }));

      recommendations.sort((a, b) => b.roi - a.roi);

      if (recommendations.length < 2) {
        const fallback = {
          strategy: "tolerate" as const,
          description: "Accept the current risk level and monitor through existing KRI thresholds.",
          estimatedCost: 0,
          expectedResidualScoreReduction: 0,
          roi: 0,
          rationale: "Baseline option: no additional investment required; risk is monitored passively.",
        };
        while (recommendations.length < 2) {
          recommendations.push(fallback);
        }
      }

      if (recommendations.length > 4) {
        recommendations = recommendations.slice(0, 4);
      }
    } catch {
      recommendations = [
        {
          strategy: "treat",
          description: "Implement controls to reduce risk likelihood and impact.",
          estimatedCost: 0,
          expectedResidualScoreReduction: Math.floor(inherentScore * 0.3),
          roi: 1,
          rationale: "AI response could not be parsed; this is a default recommendation.",
        },
        {
          strategy: "tolerate",
          description: "Accept the current risk level and monitor through existing KRI thresholds.",
          estimatedCost: 0,
          expectedResidualScoreReduction: 0,
          roi: 0,
          rationale: "Baseline option: no additional investment required.",
        },
      ];
    }

    await recordAudit(req, "ai_treatment_recommendations", "risk", riskId, { count: recommendations.length });
    res.json({ riskId, recommendations });
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      res.status(422).json({ error: "AI unavailable", message: "No LLM provider configured." });
      return;
    }
    console.error("AI treatment recommendations error:", err);
    serverError(res);
  }
});

router.get("/v1/risks/:riskId/acceptance-memoranda", async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    if (!(await verifyRiskOwnership(riskId, req.user!.tenantId, res))) return;

    const memoranda = await db
      .select({
        id: acceptanceMemorandaTable.id,
        riskId: acceptanceMemorandaTable.riskId,
        treatmentId: acceptanceMemorandaTable.treatmentId,
        memorandumText: acceptanceMemorandaTable.memorandumText,
        status: acceptanceMemorandaTable.status,
        requestedById: acceptanceMemorandaTable.requestedById,
        approverId: acceptanceMemorandaTable.approverId,
        approvedAt: acceptanceMemorandaTable.approvedAt,
        rejectedById: acceptanceMemorandaTable.rejectedById,
        rejectedAt: acceptanceMemorandaTable.rejectedAt,
        rejectionReason: acceptanceMemorandaTable.rejectionReason,
        createdAt: acceptanceMemorandaTable.createdAt,
        updatedAt: acceptanceMemorandaTable.updatedAt,
        requesterName: sql<string | null>`req_user.name`,
        requesterEmail: sql<string | null>`req_user.email`,
        approverName: sql<string | null>`appr_user.name`,
        approverEmail: sql<string | null>`appr_user.email`,
        rejectorName: sql<string | null>`rej_user.name`,
        rejectorEmail: sql<string | null>`rej_user.email`,
      })
      .from(acceptanceMemorandaTable)
      .leftJoin(sql`users req_user`, sql`req_user.id = ${acceptanceMemorandaTable.requestedById}`)
      .leftJoin(sql`users appr_user`, sql`appr_user.id = ${acceptanceMemorandaTable.approverId}`)
      .leftJoin(sql`users rej_user`, sql`rej_user.id = ${acceptanceMemorandaTable.rejectedById}`)
      .where(and(
        eq(acceptanceMemorandaTable.riskId, riskId),
        eq(acceptanceMemorandaTable.tenantId, req.user!.tenantId),
      ))
      .orderBy(acceptanceMemorandaTable.createdAt);

    res.json({ data: memoranda });
  } catch (err) {
    console.error("List memoranda error:", err);
    serverError(res);
  }
});

router.post("/v1/risks/:riskId/acceptance-memoranda/generate", requireRole("admin", "risk_manager", "risk_owner"), async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    const tenantId = req.user!.tenantId;
    if (!(await verifyRiskOwnership(riskId, tenantId, res))) return;

    const { treatmentId } = req.body;

    const [risk] = await db.select().from(risksTable)
      .where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId)))
      .limit(1);
    if (!risk) { notFound(res, "Risk not found"); return; }

    let treatment = null;
    if (treatmentId) {
      const [t] = await db.select().from(treatmentsTable)
        .where(and(eq(treatmentsTable.id, treatmentId), eq(treatmentsTable.riskId, riskId), eq(treatmentsTable.tenantId, tenantId)))
        .limit(1);
      treatment = t;
    }

    const available = await isAvailable(tenantId);
    let memorandumText: string;

    if (!available) {
      const inherentScore = (risk.likelihood || 1) * (risk.impact || 1);
      memorandumText = `RISK ACCEPTANCE MEMORANDUM

Risk: ${risk.title}
Category: ${risk.category}
Date: ${new Date().toLocaleDateString()}

EXECUTIVE SUMMARY
This memorandum documents the formal acceptance of the risk "${risk.title}" by the designated Risk Executive.

RISK DESCRIPTION
${risk.description || "No description provided."}

RISK SCORES
- Inherent Risk Score: ${inherentScore}/25 (Likelihood: ${risk.likelihood}/5, Impact: ${risk.impact}/5)
- Residual Risk Score: ${risk.residualLikelihood && risk.residualImpact ? `${risk.residualLikelihood * risk.residualImpact}/25` : "Not assessed"}

BUSINESS JUSTIFICATION
${treatment ? `Treatment Strategy: ${treatment.strategy}\n${treatment.description || ""}` : "The organization has evaluated this risk and determined it falls within acceptable risk tolerance thresholds."}

RESIDUAL RISK STATEMENT
After evaluating available treatment options, the residual risk is deemed acceptable given current business constraints and the organization's risk appetite.

APPROVAL
By approving this memorandum, the Risk Executive acknowledges awareness of this risk and formally accepts it on behalf of the organization.`;
    } else {
      const inherentScore = (risk.likelihood || 1) * (risk.impact || 1);
      const residualScore = risk.residualLikelihood && risk.residualImpact ? risk.residualLikelihood * risk.residualImpact : null;

      const prompt = `Draft a formal Risk Acceptance Memorandum for the following risk. The document should be professional, concise, and suitable for executive review and sign-off.

Risk: ${risk.title}
Category: ${risk.category}
Description: ${risk.description || "N/A"}
Inherent Risk Score: ${inherentScore}/25 (Likelihood: ${risk.likelihood}/5, Impact: ${risk.impact}/5)
Residual Risk Score: ${residualScore !== null ? `${residualScore}/25` : "Not assessed"}
${treatment ? `Treatment Strategy: ${treatment.strategy}\nTreatment Description: ${treatment.description || "N/A"}` : "No specific treatment on record."}

The memorandum must include: Executive Summary, Risk Description, Risk Scores, Business Justification for Acceptance, Residual Risk Statement, and an Approval section.`;

      memorandumText = await complete(tenantId, {
        messages: [
          { role: "system", content: "You are a risk management professional drafting formal risk acceptance memoranda for enterprise organizations. Write in clear, authoritative language suitable for C-suite executives." },
          { role: "user", content: prompt },
        ],
        maxTokens: 1500,
      });
    }

    const [memorandum] = await db.insert(acceptanceMemorandaTable).values({
      tenantId,
      riskId,
      treatmentId: treatmentId || null,
      memorandumText,
      status: "pending_approval",
      requestedById: req.user!.id,
    }).returning();

    await recordAudit(req, "generate_acceptance_memorandum", "risk", riskId, { memorandumId: memorandum.id });
    res.status(201).json(memorandum);
  } catch (err) {
    if (err instanceof LLMUnavailableError) {
      res.status(422).json({ error: "AI unavailable", message: "No LLM provider configured." });
      return;
    }
    console.error("Generate memorandum error:", err);
    serverError(res);
  }
});

router.post("/v1/risks/:riskId/acceptance-memoranda/:memorandumId/approve", requireRole("admin", "risk_executive"), async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    const memorandumId = p(req, "memorandumId");
    const tenantId = req.user!.tenantId;

    const [memorandum] = await db.select().from(acceptanceMemorandaTable)
      .where(and(
        eq(acceptanceMemorandaTable.id, memorandumId),
        eq(acceptanceMemorandaTable.riskId, riskId),
        eq(acceptanceMemorandaTable.tenantId, tenantId),
      )).limit(1);

    if (!memorandum) { notFound(res, "Memorandum not found"); return; }
    if (memorandum.status !== "pending_approval") {
      badRequest(res, "Memorandum is not in pending_approval state"); return;
    }

    const [updated] = await db.transaction(async (tx) => {
      const [updatedMemo] = await tx.update(acceptanceMemorandaTable).set({
        status: "approved",
        approverId: req.user!.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(acceptanceMemorandaTable.id, memorandumId)).returning();

      await tx.update(risksTable).set({
        status: "accepted",
        updatedAt: new Date(),
      }).where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId)));

      return [updatedMemo];
    });

    await recordAudit(req, "approve_acceptance_memorandum", "risk", riskId, { memorandumId });
    res.json(updated);
  } catch (err) {
    console.error("Approve memorandum error:", err);
    serverError(res);
  }
});

router.post("/v1/risks/:riskId/acceptance-memoranda/:memorandumId/reject", requireRole("admin", "risk_executive"), async (req, res) => {
  try {
    const riskId = p(req, "riskId");
    const memorandumId = p(req, "memorandumId");
    const tenantId = req.user!.tenantId;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !String(rejectionReason).trim()) {
      badRequest(res, "rejectionReason is required"); return;
    }

    const [memorandum] = await db.select().from(acceptanceMemorandaTable)
      .where(and(
        eq(acceptanceMemorandaTable.id, memorandumId),
        eq(acceptanceMemorandaTable.riskId, riskId),
        eq(acceptanceMemorandaTable.tenantId, tenantId),
      )).limit(1);

    if (!memorandum) { notFound(res, "Memorandum not found"); return; }
    if (memorandum.status !== "pending_approval") {
      badRequest(res, "Memorandum is not in pending_approval state"); return;
    }

    const [updated] = await db.transaction(async (tx) => {
      const [updatedMemo] = await tx.update(acceptanceMemorandaTable).set({
        status: "rejected",
        rejectedById: req.user!.id,
        rejectedAt: new Date(),
        rejectionReason: String(rejectionReason).trim(),
        updatedAt: new Date(),
      }).where(eq(acceptanceMemorandaTable.id, memorandumId)).returning();

      await tx.update(risksTable).set({
        status: "open",
        updatedAt: new Date(),
      }).where(and(eq(risksTable.id, riskId), eq(risksTable.tenantId, tenantId)));

      return [updatedMemo];
    });

    await recordAudit(req, "reject_acceptance_memorandum", "risk", riskId, { memorandumId, rejectionReason });
    res.json(updated);
  } catch (err) {
    console.error("Reject memorandum error:", err);
    serverError(res);
  }
});

export default router;
