import app from "./app";
import { ensureExtensions } from "@workspace/db";
import { startJobProcessor } from "./lib/job-queue";
import { registerAIWorkers } from "./lib/ai-workers";
import { startMonitoringScheduler } from "./lib/monitoring";
import { startAgentScheduler } from "./lib/agent-scheduler";
import { startSignalFeedPoller } from "./lib/signal-feed-poller";
import { startRiskSnapshotScheduler } from "./lib/risk-snapshot-scheduler";
import { seedDemoDataIfEmpty } from "./lib/seed";
import "./adapters/index"; // Register all signal feed adapters (NVD, Shodan, Sentinel, MISP, Email)

// Fail-fast: validate all required env vars before any other code runs
const REQUIRED_ENV = ["PORT", "DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Required environment variable ${key} is not set. Check your .env file.`);
  }
}

const rawPort = process.env["PORT"]!;
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  await ensureExtensions();
  await seedDemoDataIfEmpty();

  registerAIWorkers();
  startJobProcessor();
  startMonitoringScheduler();
  startAgentScheduler();
  startSignalFeedPoller();
  startRiskSnapshotScheduler();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
