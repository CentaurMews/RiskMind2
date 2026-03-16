import { db, jobsTable } from "@workspace/db";
import { eq, and, sql, lte } from "drizzle-orm";

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

async function processNextJob(): Promise<boolean> {
  for (const [queue, handler] of handlers) {
    const [job] = await db
      .update(jobsTable)
      .set({ status: "processing", startedAt: new Date(), attempts: sql`${jobsTable.attempts} + 1` })
      .where(and(
        eq(jobsTable.queue, queue),
        eq(jobsTable.status, "pending"),
        lte(jobsTable.scheduledAt, new Date()),
      ))
      .returning();

    if (!job) continue;

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

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const newAttempts = job.attempts + 1;
      const isDead = newAttempts >= job.maxAttempts;

      if (isDead) {
        await db.update(jobsTable).set({
          status: "dead",
          lastError: errorMsg,
          completedAt: new Date(),
        }).where(eq(jobsTable.id, job.id));
      } else {
        const backoffMs = Math.min(1000 * Math.pow(2, newAttempts), 60000);
        await db.update(jobsTable).set({
          status: "pending",
          lastError: errorMsg,
          scheduledAt: new Date(Date.now() + backoffMs),
        }).where(eq(jobsTable.id, job.id));
      }

      console.error(`Job ${job.id} (${queue}/${job.type}) failed attempt ${newAttempts}:`, errorMsg);
      return true;
    }
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
