import { db, tenantsTable } from "@workspace/db";
import { runAgentCycle, getTenantAgentConfig } from "./agent-service";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

const CHECK_INTERVAL_MS = 60 * 1000;
const AGENT_CYCLE_TIMEOUT_MS = 120_000; // 2 min max per tenant agent cycle

const lastRunTimestamps = new Map<string, number>();

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Agent cycle timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function cronMatchesNow(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const now = new Date();
  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const dayOfMonth = now.getUTCDate();
  const month = now.getUTCMonth() + 1;
  const dayOfWeek = now.getUTCDay();

  return (
    fieldMatches(parts[0], minute) &&
    fieldMatches(parts[1], hour) &&
    fieldMatches(parts[2], dayOfMonth) &&
    fieldMatches(parts[3], month) &&
    fieldMatches(parts[4], dayOfWeek)
  );
}

function fieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;

  if (field.includes("/")) {
    const [base, stepStr] = field.split("/");
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step <= 0) return false;
    const start = base === "*" ? 0 : parseInt(base, 10);
    return (value - start) % step === 0 && value >= start;
  }

  if (field.includes(",")) {
    return field.split(",").some(v => parseInt(v, 10) === value);
  }

  if (field.includes("-")) {
    const [low, high] = field.split("-").map(v => parseInt(v, 10));
    return value >= low && value <= high;
  }

  return parseInt(field, 10) === value;
}

async function checkAndRunTenants(): Promise<void> {
  try {
    const tenants = await db.select({ id: tenantsTable.id, settings: tenantsTable.settings }).from(tenantsTable);

    for (const tenant of tenants) {
      const config = getTenantAgentConfig(tenant.settings);

      if (config.agentEnabled === false) continue;

      const schedule = config.agentSchedule || "0 6 * * *";
      if (!cronMatchesNow(schedule)) continue;

      const lastRun = lastRunTimestamps.get(tenant.id) || 0;
      const minutesSinceLastRun = (Date.now() - lastRun) / (60 * 1000);
      if (minutesSinceLastRun < 55) continue;

      const policyTier = config.agentPolicyTier || "observe";
      console.log(`[Agent Scheduler] Running for tenant ${tenant.id} (policy: ${policyTier}, schedule: ${schedule})`);

      try {
        lastRunTimestamps.set(tenant.id, Date.now());
        await withTimeout(
          runAgentCycle(tenant.id, policyTier, { schedule, triggeredBy: "scheduler" }),
          AGENT_CYCLE_TIMEOUT_MS,
          `tenant ${tenant.id}`
        );
      } catch (err) {
        console.error(`[Agent Scheduler] Error for tenant ${tenant.id}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error("[Agent Scheduler] Check error:", err instanceof Error ? err.message : err);
  }
}

export function startAgentScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  console.log("[Agent Scheduler] Started (checking every 60s for tenant cron matches)");

  schedulerInterval = setInterval(checkAndRunTenants, CHECK_INTERVAL_MS);
}

export function stopAgentScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Agent Scheduler] Stopped");
  }
}
