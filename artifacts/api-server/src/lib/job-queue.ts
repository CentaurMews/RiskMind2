import { db, jobsTable, pool } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

type JobHandler = (job: { id: string; tenantId: string | null; type: string; payload: unknown }) => Promise<unknown>;

const handlers = new Map<string, JobHandler>();
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function registerWorker(queue: string, handler: JobHandler) {
  handlers.set(queue, handler);
}

export async function enqueueJob(
  queue: string,
  type: string,
  payload: Record<string, unknown>,
  tenantId?: string,
  options?: { maxAttempts?: number; delayMs?: number }
) {
  const scheduledAt = options?.delayMs
    ? new Date(Date.now() + options.delayMs)
    : new Date();

  const [job] = await db.insert(jobsTable).values({
    queue,
    type,
    payload,
    tenantId: tenantId ?? null,
    maxAttempts: options?.maxAttempts ?? 3,
    scheduledAt,
  }).returning();

  return job;
}

async function claimAndProcessJob(queue: string, handler: JobHandler): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const claimResult = await client.query(
      `UPDATE jobs SET status = 'processing', started_at = NOW(), attempts = attempts + 1
       WHERE id = (
         SELECT id FROM jobs
         WHERE queue = $1 AND status = 'pending' AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, tenant_id AS "tenantId", type, payload, attempts, max_attempts AS "maxAttempts"`,
      [queue]
    );

    if (claimResult.rows.length === 0) {
      await client.query("COMMIT");
      return false;
    }

    const job = claimResult.rows[0];
    await client.query("COMMIT");

    try {
      const result = await handler({
        id: job.id,
        tenantId: job.tenantId,
        type: job.type,
        payload: job.payload,
      });

      await db.update(jobsTable).set({
        status: "completed",
        result: result as Record<string, unknown>,
        completedAt: new Date(),
      }).where(eq(jobsTable.id, job.id));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isDead = job.attempts >= job.maxAttempts;

      if (isDead) {
        await db.update(jobsTable).set({
          status: "dead",
          lastError: errorMsg,
          completedAt: new Date(),
        }).where(eq(jobsTable.id, job.id));
      } else {
        const backoffMs = Math.min(1000 * Math.pow(2, job.attempts), 60000);
        await db.update(jobsTable).set({
          status: "pending",
          lastError: errorMsg,
          scheduledAt: new Date(Date.now() + backoffMs),
        }).where(eq(jobsTable.id, job.id));
      }

      console.error(`Job ${job.id} (${queue}/${job.type}) failed attempt ${job.attempts}:`, errorMsg);
    }

    return true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function processNextJob(): Promise<boolean> {
  for (const [queue, handler] of handlers) {
    const processed = await claimAndProcessJob(queue, handler);
    if (processed) return true;
  }
  return false;
}

export function startJobProcessor(intervalMs = 5000) {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    try {
      let processed = true;
      while (processed) {
        processed = await processNextJob();
      }
    } catch (err) {
      console.error("Job processor error:", err);
    }
  }, intervalMs);
  console.log(`Job processor started (poll every ${intervalMs}ms)`);
}

export function stopJobProcessor() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
