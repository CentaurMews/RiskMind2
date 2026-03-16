import { runAgentForAllTenants } from "./agent-service";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startAgentScheduler(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  console.log(`[Agent Scheduler] Started (interval: ${intervalMs}ms)`);

  schedulerInterval = setInterval(async () => {
    console.log("[Agent Scheduler] Running scheduled agent cycle...");
    try {
      await runAgentForAllTenants();
      console.log("[Agent Scheduler] Scheduled cycle complete");
    } catch (err) {
      console.error("[Agent Scheduler] Error:", err instanceof Error ? err.message : err);
    }
  }, intervalMs);
}

export function stopAgentScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Agent Scheduler] Stopped");
  }
}
