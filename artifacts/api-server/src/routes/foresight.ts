import { Router, type Request, type Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  foresightScenariosTable,
  foresightSimulationsTable,
  signalsTable,
} from "@workspace/db";
import { enqueueJob } from "../lib/job-queue";
import { badRequest, notFound, sendError, serverError } from "../lib/errors";
import { computeCalibration } from "../lib/monte-carlo";

function p(req: Request, name: string): string {
  return String(req.params[name]);
}

const router = Router();

// ─── Scenario CRUD ─────────────────────────────────────────────────────────────

// GET /v1/foresight/scenarios — list tenant scenarios with latest simulation status
// NOTE: This must come BEFORE /v1/foresight/scenarios/:id to avoid Express path conflict
router.get("/v1/foresight/scenarios/top-ale", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    // Get top 5 scenarios by ALE from completed simulations
    const rows = await db
      .select({
        scenarioId: foresightScenariosTable.id,
        scenarioName: foresightScenariosTable.name,
        riskId: foresightScenariosTable.riskId,
        results: foresightSimulationsTable.results,
      })
      .from(foresightScenariosTable)
      .innerJoin(
        foresightSimulationsTable,
        and(
          eq(foresightSimulationsTable.scenarioId, foresightScenariosTable.id),
          eq(foresightSimulationsTable.status, "completed")
        )
      )
      .where(eq(foresightScenariosTable.tenantId, tenantId))
      .orderBy(desc(foresightSimulationsTable.createdAt));

    // Group by scenario, take highest ALE (from most recent completed sim)
    const scenarioMap = new Map<string, { scenarioId: string; scenarioName: string; riskId: string | null; ale: number }>();
    for (const row of rows) {
      if (scenarioMap.has(row.scenarioId)) continue;
      const results = row.results as { ale?: number } | null;
      const ale = results?.ale ?? 0;
      scenarioMap.set(row.scenarioId, {
        scenarioId: row.scenarioId,
        scenarioName: row.scenarioName,
        riskId: row.riskId ?? null,
        ale,
      });
    }

    const topAle = Array.from(scenarioMap.values())
      .sort((a, b) => b.ale - a.ale)
      .slice(0, 5);

    res.json(topAle);
  } catch (err) {
    console.error("[Foresight] top-ale error:", err);
    serverError(res, "Failed to retrieve top ALE scenarios");
  }
});

router.get("/v1/foresight/scenarios", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    const scenarios = await db
      .select()
      .from(foresightScenariosTable)
      .where(eq(foresightScenariosTable.tenantId, tenantId))
      .orderBy(desc(foresightScenariosTable.createdAt));

    // Attach latest simulation status to each scenario
    const scenarioIds = scenarios.map((s) => s.id);
    let latestSimulations: Array<{
      scenarioId: string;
      id: string;
      status: string;
      createdAt: Date;
    }> = [];

    if (scenarioIds.length > 0) {
      // Get latest simulation per scenario using a subquery approach
      const allSims = await db
        .select({
          id: foresightSimulationsTable.id,
          scenarioId: foresightSimulationsTable.scenarioId,
          status: foresightSimulationsTable.status,
          createdAt: foresightSimulationsTable.createdAt,
        })
        .from(foresightSimulationsTable)
        .where(eq(foresightSimulationsTable.tenantId, tenantId))
        .orderBy(desc(foresightSimulationsTable.createdAt));

      // Take only the latest per scenario
      const seen = new Set<string>();
      for (const sim of allSims) {
        if (!seen.has(sim.scenarioId)) {
          seen.add(sim.scenarioId);
          latestSimulations.push(sim);
        }
      }
    }

    const simByScenario = new Map(latestSimulations.map((s) => [s.scenarioId, s]));

    const result = scenarios.map((scenario) => ({
      ...scenario,
      latestSimulation: simByScenario.get(scenario.id) ?? null,
    }));

    res.json(result);
  } catch (err) {
    console.error("[Foresight] list scenarios error:", err);
    serverError(res, "Failed to retrieve scenarios");
  }
});

router.post("/v1/foresight/scenarios", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, description, riskId, parameters } = req.body as {
      name?: string;
      description?: string;
      riskId?: string;
      parameters?: Record<string, unknown>;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return badRequest(res, "Scenario name is required");
    }

    const [scenario] = await db
      .insert(foresightScenariosTable)
      .values({
        tenantId,
        name: name.trim(),
        description: description ?? null,
        riskId: riskId ?? null,
        parameters: parameters ?? {},
      })
      .returning();

    res.status(201).json(scenario);
  } catch (err) {
    console.error("[Foresight] create scenario error:", err);
    serverError(res, "Failed to create scenario");
  }
});

router.get("/v1/foresight/scenarios/:id", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const scenarioId = p(req, "id");

    const [scenario] = await db
      .select()
      .from(foresightScenariosTable)
      .where(
        and(
          eq(foresightScenariosTable.id, scenarioId),
          eq(foresightScenariosTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!scenario) return notFound(res, "Scenario not found");

    const simulations = await db
      .select()
      .from(foresightSimulationsTable)
      .where(eq(foresightSimulationsTable.scenarioId, scenarioId))
      .orderBy(desc(foresightSimulationsTable.createdAt));

    res.json({ ...scenario, simulations });
  } catch (err) {
    console.error("[Foresight] get scenario error:", err);
    serverError(res, "Failed to retrieve scenario");
  }
});

router.patch("/v1/foresight/scenarios/:id", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const scenarioId = p(req, "id");

    const [existing] = await db
      .select({ id: foresightScenariosTable.id })
      .from(foresightScenariosTable)
      .where(
        and(
          eq(foresightScenariosTable.id, scenarioId),
          eq(foresightScenariosTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) return notFound(res, "Scenario not found");

    const { name, description, parameters, riskId } = req.body as {
      name?: string;
      description?: string;
      parameters?: Record<string, unknown>;
      riskId?: string | null;
    };

    const updates: Partial<typeof foresightScenariosTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (parameters !== undefined) updates.parameters = parameters;
    if (riskId !== undefined) updates.riskId = riskId ?? null;

    const [updated] = await db
      .update(foresightScenariosTable)
      .set(updates)
      .where(eq(foresightScenariosTable.id, scenarioId))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("[Foresight] update scenario error:", err);
    serverError(res, "Failed to update scenario");
  }
});

router.delete("/v1/foresight/scenarios/:id", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const scenarioId = p(req, "id");

    const [existing] = await db
      .select({ id: foresightScenariosTable.id })
      .from(foresightScenariosTable)
      .where(
        and(
          eq(foresightScenariosTable.id, scenarioId),
          eq(foresightScenariosTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) return notFound(res, "Scenario not found");

    // Simulations cascade-delete via FK
    await db
      .delete(foresightScenariosTable)
      .where(eq(foresightScenariosTable.id, scenarioId));

    res.status(204).send();
  } catch (err) {
    console.error("[Foresight] delete scenario error:", err);
    serverError(res, "Failed to delete scenario");
  }
});

router.post("/v1/foresight/scenarios/:id/clone", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const scenarioId = p(req, "id");

    const [source] = await db
      .select()
      .from(foresightScenariosTable)
      .where(
        and(
          eq(foresightScenariosTable.id, scenarioId),
          eq(foresightScenariosTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!source) return notFound(res, "Scenario not found");

    const [cloned] = await db
      .insert(foresightScenariosTable)
      .values({
        tenantId,
        name: `${source.name} (Copy)`,
        description: source.description,
        riskId: source.riskId,
        parameters: source.parameters,
        calibratedFrom: source.calibratedFrom,
      })
      .returning();

    res.status(201).json(cloned);
  } catch (err) {
    console.error("[Foresight] clone scenario error:", err);
    serverError(res, "Failed to clone scenario");
  }
});

// ─── Simulations ──────────────────────────────────────────────────────────────

// POST /v1/foresight/simulations — enqueue async job, return 202 Accepted
router.post("/v1/foresight/simulations", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const { scenarioId, iterationCount = 10_000 } = req.body as {
      scenarioId?: string;
      iterationCount?: number;
    };

    if (!scenarioId) return badRequest(res, "scenarioId is required");

    // Verify scenario belongs to tenant
    const [scenario] = await db
      .select({ id: foresightScenariosTable.id, parameters: foresightScenariosTable.parameters })
      .from(foresightScenariosTable)
      .where(
        and(
          eq(foresightScenariosTable.id, scenarioId),
          eq(foresightScenariosTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!scenario) return notFound(res, "Scenario not found");

    const iterations = Math.min(Math.max(1, Number(iterationCount) || 10_000), 500_000);

    // Create simulation record in pending state
    const [simulation] = await db
      .insert(foresightSimulationsTable)
      .values({
        tenantId,
        scenarioId,
        status: "pending",
        iterationCount: iterations,
        inputParameters: scenario.parameters as Record<string, unknown>,
      })
      .returning();

    // Enqueue the monte-carlo job
    await enqueueJob(
      "monte-carlo",
      "run-simulation",
      { simulationId: simulation.id },
      tenantId
    );

    res.status(202).json(simulation);
  } catch (err) {
    console.error("[Foresight] create simulation error:", err);
    serverError(res, "Failed to create simulation");
  }
});

router.get("/v1/foresight/simulations/:id", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const simulationId = p(req, "id");

    const [simulation] = await db
      .select()
      .from(foresightSimulationsTable)
      .where(
        and(
          eq(foresightSimulationsTable.id, simulationId),
          eq(foresightSimulationsTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!simulation) return notFound(res, "Simulation not found");

    res.json(simulation);
  } catch (err) {
    console.error("[Foresight] get simulation error:", err);
    serverError(res, "Failed to retrieve simulation");
  }
});

// ─── Calibration ─────────────────────────────────────────────────────────────

router.post("/v1/foresight/calibrate", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    // Fetch last 90 days of signals for this tenant
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const signals = await db
      .select({
        source: signalsTable.source,
        metadata: signalsTable.metadata,
        createdAt: signalsTable.createdAt,
      })
      .from(signalsTable)
      .where(
        and(
          eq(signalsTable.tenantId, tenantId),
          sql`${signalsTable.createdAt} >= ${cutoff}`
        )
      );

    const result = computeCalibration(
      signals.map((s) => ({
        source: s.source,
        metadata: s.metadata as Record<string, unknown> | null,
        createdAt: s.createdAt,
      }))
    );

    res.json(result);
  } catch (err) {
    console.error("[Foresight] calibrate error:", err);
    serverError(res, "Failed to compute calibration");
  }
});

// ─── Legacy stubs (kept as 501) ───────────────────────────────────────────────

router.get("/v1/foresight/risk-graph", (_req, res) => {
  sendError(res, 501, "Not Implemented", "Risk graph is planned for a future release.");
});

router.get("/v1/foresight/trust-circles", (_req, res) => {
  sendError(res, 501, "Not Implemented", "Trust circles is planned for a future release.");
});

export default router;
