import app from "./app";
import { ensureExtensions, pool } from "@workspace/db";
import { startJobProcessor, stopJobProcessor } from "./lib/job-queue";
import { registerAIWorkers } from "./lib/ai-workers";
import { startMonitoringScheduler, stopMonitoringScheduler } from "./lib/monitoring";
import { startAgentScheduler, stopAgentScheduler } from "./lib/agent-scheduler";
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

// ─── Process error handlers ──────────────────────────────────────────────────

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Process] Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Process] Uncaught exception:", err);
  // Give time for logs to flush, then exit — PM2 will restart
  setTimeout(() => process.exit(1), 1000);
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────

let isShuttingDown = false;
let server: ReturnType<typeof app.listen> | null = null;

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Process] ${signal} received, shutting down gracefully...`);

  // Stop accepting new requests
  if (server) {
    server.close(() => {
      console.log("[Process] HTTP server closed");
    });
  }

  // Stop all schedulers
  stopJobProcessor();
  stopMonitoringScheduler();
  stopAgentScheduler();

  // Drain DB pool and exit
  pool.end().then(() => {
    console.log("[Process] DB pool drained");
    process.exit(0);
  }).catch((err) => {
    console.error("[Process] Error draining pool:", err);
    process.exit(1);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error("[Process] Forced exit after 10s timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Start ───────────────────────────────────────────────────────────────────

async function start() {
  await ensureExtensions();
  await seedDemoDataIfEmpty();

  registerAIWorkers();
  startJobProcessor();
  startMonitoringScheduler();
  startAgentScheduler();
  startSignalFeedPoller();
  startRiskSnapshotScheduler();

  server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
