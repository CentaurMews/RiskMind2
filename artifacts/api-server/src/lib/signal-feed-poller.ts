import cron from "node-cron";
import { db, integrationConfigsTable, signalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { IntegrationConfig } from "@workspace/db";
import { decrypt } from "./encryption";
import { enqueueJob } from "./job-queue";
import { adapters, type DecryptedConfig } from "../adapters/types";

// ─── Default polling schedules per source type ────────────────────────────────

const DEFAULT_SCHEDULES: Record<string, string> = {
  nvd: "0 * * * *",        // hourly
  shodan: "0 0 * * *",     // daily
  sentinel: "*/15 * * * *", // every 15 min
  misp: "0 * * * *",       // hourly
  email: "*/5 * * * *",    // every 5 min (fallback for IDLE)
};

const POLL_TIMEOUT_MS = 30_000; // 30s max per adapter poll

// ─── Start scheduler ──────────────────────────────────────────────────────────

export async function startSignalFeedPoller(): Promise<void> {
  for (const sourceType of Object.keys(DEFAULT_SCHEDULES)) {
    const schedule = DEFAULT_SCHEDULES[sourceType]!;
    cron.schedule(schedule, () => {
      pollSourceForAllTenants(sourceType).catch((err) => {
        console.error(`[SignalPoller] Unhandled error polling ${sourceType}:`, err);
      });
    });
  }

  console.log(
    `[SignalPoller] Scheduler started for: ${Object.keys(DEFAULT_SCHEDULES).join(", ")}`
  );
}

// ─── Poll a single source type across all tenants ─────────────────────────────

export async function pollSourceForAllTenants(sourceType: string): Promise<void> {
  const configs = await db
    .select()
    .from(integrationConfigsTable)
    .where(
      eq(integrationConfigsTable.sourceType, sourceType as IntegrationConfig["sourceType"])
    )
    .then((rows) => rows.filter((r) => r.isActive));

  for (const config of configs) {
    try {
      await pollSingleConfig(config);
    } catch (err) {
      console.error(
        `[SignalPoller] Error polling ${sourceType} for tenant ${config.tenantId}:`,
        err
      );
      // Update lastError but do NOT throw — other tenants must continue
      try {
        await db
          .update(integrationConfigsTable)
          .set({
            lastError: err instanceof Error ? err.message : String(err),
            updatedAt: new Date(),
          })
          .where(eq(integrationConfigsTable.id, config.id));
      } catch (updateErr) {
        console.error("[SignalPoller] Failed to persist lastError:", updateErr);
      }
    }
  }
}

// ─── Timeout wrapper ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[SignalPoller] Timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ─── Poll a single integration config row ────────────────────────────────────

async function pollSingleConfig(config: IntegrationConfig): Promise<void> {
  if (!config.encryptedConfig) {
    console.warn(
      `[SignalPoller] No encryptedConfig for integration ${config.id} (tenant ${config.tenantId}), skipping.`
    );
    return;
  }

  const raw = JSON.parse(decrypt(config.encryptedConfig));
  const decryptedConfig = { ...raw, type: config.sourceType } as DecryptedConfig;
  // Inject tenantId for adapters that need it for LLM calls (e.g., email)
  if (decryptedConfig.type === "email") {
    (decryptedConfig as import("../adapters/types.js").EmailConfig).tenantId = config.tenantId;
  }

  const adapter = adapters[config.sourceType];
  if (!adapter) {
    console.warn(
      `[SignalPoller] No adapter registered for source type "${config.sourceType}", skipping.`
    );
    return;
  }

  const since = config.lastPolledAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rawSignals = await withTimeout(
    adapter.poll(decryptedConfig, since),
    POLL_TIMEOUT_MS,
    `${config.sourceType} tenant ${config.tenantId}`
  );

  for (const raw of rawSignals) {
    const inserted = await db
      .insert(signalsTable)
      .values({
        tenantId: config.tenantId,
        source: config.sourceType,
        content: raw.content,
        contentHash: raw.contentHash,
        externalId: raw.externalId,
        metadata: raw.metadata,
      })
      .onConflictDoNothing()
      .returning({ id: signalsTable.id });

    if (inserted.length > 0) {
      await enqueueJob(
        "ai-triage",
        "classify",
        { signalId: inserted[0]!.id },
        config.tenantId
      );
    }
  }

  // Update lastPolledAt and clear lastError on success
  await db
    .update(integrationConfigsTable)
    .set({
      lastPolledAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(integrationConfigsTable.id, config.id));
}
