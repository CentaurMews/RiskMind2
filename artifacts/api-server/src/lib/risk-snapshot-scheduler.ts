import cron from "node-cron";
import {
  db,
  risksTable,
  riskSnapshotsTable,
  riskAppetiteConfigsTable,
  tenantsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

// ─── Pure functions (exported for unit tests) ─────────────────────────────────

/**
 * Compute a composite risk score from an array of risks.
 * - Empty input returns 0.
 * - Each risk: raw = likelihood * impact (1–25), normalized = (raw / 25) * 100.
 * - Critical risks (raw >= 15) weighted 2x; others weighted 1x.
 * - Result = Math.round(weightedSum / weightTotal).
 */
export function computeCompositeScore(
  risks: Array<{ likelihood: number; impact: number }>
): number {
  if (risks.length === 0) return 0;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const risk of risks) {
    const raw = risk.likelihood * risk.impact;
    const normalized = (raw / 25) * 100;
    const weight = raw >= 15 ? 2 : 1;
    weightedSum += normalized * weight;
    weightTotal += weight;
  }

  return Math.round(weightedSum / weightTotal);
}

/**
 * Build a cell-count record keyed by "likelihood-impact".
 * E.g. [{ likelihood: 3, impact: 4 }, { likelihood: 3, impact: 4 }] → { "3-4": 2 }
 */
export function buildCellCounts(
  risks: Array<{ likelihood: number; impact: number }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const risk of risks) {
    const key = `${risk.likelihood}-${risk.impact}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// ─── Snapshot capture ─────────────────────────────────────────────────────────

const RISK_CATEGORIES = [
  "operational",
  "financial",
  "compliance",
  "strategic",
  "technology",
  "reputational",
] as const;

export async function captureSnapshotForTenant(tenantId: string): Promise<void> {
  // Query all active risks (open + mitigated) for tenant
  const activeRisks = await db
    .select({
      likelihood: risksTable.likelihood,
      impact: risksTable.impact,
      category: risksTable.category,
    })
    .from(risksTable)
    .where(
      and(
        eq(risksTable.tenantId, tenantId),
        inArray(risksTable.status, ["open", "mitigated"])
      )
    );

  // Query appetite configs for tenant
  const appetiteConfigs = await db
    .select()
    .from(riskAppetiteConfigsTable)
    .where(eq(riskAppetiteConfigsTable.tenantId, tenantId));

  const appetiteMap: Record<string, number> = {};
  for (const config of appetiteConfigs) {
    appetiteMap[config.category] = config.threshold;
  }

  // Compute composite score
  const compositeScore = computeCompositeScore(activeRisks);

  // Build cell counts
  const cellCounts = buildCellCounts(activeRisks);

  // Build per-category counts
  const categoryCounts: Record<
    string,
    { score: number; count: number; highCriticalCount: number }
  > = {};

  for (const cat of RISK_CATEGORIES) {
    const catRisks = activeRisks.filter((r) => r.category === cat);
    if (catRisks.length > 0) {
      const score = computeCompositeScore(catRisks);
      const highCriticalCount = catRisks.filter(
        (r) => r.likelihood * r.impact >= 15
      ).length;
      categoryCounts[cat] = { score, count: catRisks.length, highCriticalCount };
    }
  }

  // Compute above-appetite count (categories where composite score > threshold)
  let aboveAppetiteCount = 0;
  for (const [cat, data] of Object.entries(categoryCounts)) {
    const threshold = appetiteMap[cat] ?? 60;
    if (data.score > threshold) {
      aboveAppetiteCount++;
    }
  }

  // Derive snapshot date (UTC-safe)
  const snapshotDate = new Date().toISOString().split("T")[0]!;

  // Upsert snapshot row (idempotent — same tenant+date overwrites)
  await db
    .insert(riskSnapshotsTable)
    .values({
      tenantId,
      snapshotDate,
      compositeScore: String(compositeScore),
      totalRisks: activeRisks.length,
      aboveAppetiteCount,
      cellCounts,
      categoryCounts,
    })
    .onConflictDoUpdate({
      target: [riskSnapshotsTable.tenantId, riskSnapshotsTable.snapshotDate],
      set: {
        compositeScore: String(compositeScore),
        totalRisks: activeRisks.length,
        aboveAppetiteCount,
        cellCounts,
        categoryCounts,
      },
    });
}

export async function captureSnapshotForAllTenants(): Promise<void> {
  const tenants = await db.select({ id: tenantsTable.id }).from(tenantsTable);

  for (const tenant of tenants) {
    try {
      await captureSnapshotForTenant(tenant.id);
    } catch (err) {
      console.error(
        `[RiskSnapshot] Error capturing snapshot for tenant ${tenant.id}:`,
        err
      );
      // Do NOT throw — other tenants must continue
    }
  }
}

// ─── Scheduler startup ────────────────────────────────────────────────────────

export function startRiskSnapshotScheduler(): void {
  cron.schedule("0 0 * * *", () => {
    captureSnapshotForAllTenants().catch((err) => {
      console.error("[RiskSnapshot] Unhandled error:", err);
    });
  });

  console.log("[RiskSnapshot] Scheduler started - daily at 00:00 UTC");
}
