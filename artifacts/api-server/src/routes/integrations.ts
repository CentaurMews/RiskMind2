import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  integrationConfigsTable,
  signalsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { badRequest, notFound, serverError } from "../lib/errors";
import { encrypt, decrypt } from "../lib/encryption";
import { enqueueJob } from "../lib/job-queue";
import { adapters, type DecryptedConfig } from "../adapters/types";

const router = Router();

// ─── Helper: fetch config row and return decrypted typed config ───────────────

async function getDecryptedConfig(
  id: string,
  tenantId: string
): Promise<{ row: typeof integrationConfigsTable.$inferSelect; config: DecryptedConfig } | null> {
  const [row] = await db
    .select()
    .from(integrationConfigsTable)
    .where(and(eq(integrationConfigsTable.id, id), eq(integrationConfigsTable.tenantId, tenantId)))
    .limit(1);

  if (!row || !row.encryptedConfig) return null;

  const config = JSON.parse(decrypt(row.encryptedConfig)) as DecryptedConfig;
  return { row, config };
}

// ─── GET /v1/integrations — list tenant integration configs (masked) ──────────

router.get("/v1/integrations", async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;

    const rows = await db
      .select({
        id: integrationConfigsTable.id,
        tenantId: integrationConfigsTable.tenantId,
        sourceType: integrationConfigsTable.sourceType,
        pollingSchedule: integrationConfigsTable.pollingSchedule,
        isActive: integrationConfigsTable.isActive,
        lastPolledAt: integrationConfigsTable.lastPolledAt,
        lastError: integrationConfigsTable.lastError,
        createdAt: integrationConfigsTable.createdAt,
        updatedAt: integrationConfigsTable.updatedAt,
      })
      .from(integrationConfigsTable)
      .where(eq(integrationConfigsTable.tenantId, tenantId));

    // Replace encryptedConfig with masked sentinel — raw credentials never exposed
    const masked = rows.map((r) => ({ ...r, encryptedConfig: "[encrypted]" }));
    res.json({ data: masked });
  } catch (err) {
    console.error("List integrations error:", err);
    serverError(res);
  }
});

// ─── POST /v1/integrations — upsert integration config ───────────────────────

router.post(
  "/v1/integrations",
  requireRole("admin"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { sourceType, config, isActive, pollingSchedule } = req.body as {
        sourceType: "nvd" | "shodan" | "sentinel" | "misp" | "email";
        config: Record<string, unknown>;
        isActive?: boolean;
        pollingSchedule?: string;
      };

      if (!sourceType || !config) {
        badRequest(res, "sourceType and config are required");
        return;
      }

      const encryptedConfig = encrypt(JSON.stringify(config));

      const [row] = await db
        .insert(integrationConfigsTable)
        .values({
          tenantId,
          sourceType,
          encryptedConfig,
          isActive: isActive ?? true,
          pollingSchedule: pollingSchedule ?? null,
        })
        .onConflictDoUpdate({
          target: [integrationConfigsTable.tenantId, integrationConfigsTable.sourceType],
          set: {
            encryptedConfig,
            isActive: isActive ?? true,
            pollingSchedule: pollingSchedule ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: integrationConfigsTable.id,
          tenantId: integrationConfigsTable.tenantId,
          sourceType: integrationConfigsTable.sourceType,
          pollingSchedule: integrationConfigsTable.pollingSchedule,
          isActive: integrationConfigsTable.isActive,
          lastPolledAt: integrationConfigsTable.lastPolledAt,
          lastError: integrationConfigsTable.lastError,
          createdAt: integrationConfigsTable.createdAt,
          updatedAt: integrationConfigsTable.updatedAt,
        });

      res.status(201).json({ ...row, encryptedConfig: "[encrypted]" });
    } catch (err) {
      console.error("Create/upsert integration error:", err);
      serverError(res);
    }
  }
);

// ─── PATCH /v1/integrations/:id — update config fields ───────────────────────

router.patch(
  "/v1/integrations/:id",
  requireRole("admin"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const id = req.params.id!;

      const [existing] = await db
        .select()
        .from(integrationConfigsTable)
        .where(and(eq(integrationConfigsTable.id, id), eq(integrationConfigsTable.tenantId, tenantId)))
        .limit(1);

      if (!existing) {
        notFound(res, "Integration config not found");
        return;
      }

      const { config, isActive, pollingSchedule } = req.body as {
        config?: Record<string, unknown>;
        isActive?: boolean;
        pollingSchedule?: string;
      };

      const updates: Partial<typeof integrationConfigsTable.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (config !== undefined) {
        updates.encryptedConfig = encrypt(JSON.stringify(config));
      }
      if (isActive !== undefined) {
        updates.isActive = isActive;
      }
      if (pollingSchedule !== undefined) {
        updates.pollingSchedule = pollingSchedule;
      }

      const [updated] = await db
        .update(integrationConfigsTable)
        .set(updates)
        .where(eq(integrationConfigsTable.id, id))
        .returning({
          id: integrationConfigsTable.id,
          tenantId: integrationConfigsTable.tenantId,
          sourceType: integrationConfigsTable.sourceType,
          pollingSchedule: integrationConfigsTable.pollingSchedule,
          isActive: integrationConfigsTable.isActive,
          lastPolledAt: integrationConfigsTable.lastPolledAt,
          lastError: integrationConfigsTable.lastError,
          createdAt: integrationConfigsTable.createdAt,
          updatedAt: integrationConfigsTable.updatedAt,
        });

      res.json({ ...updated, encryptedConfig: "[encrypted]" });
    } catch (err) {
      console.error("Update integration error:", err);
      serverError(res);
    }
  }
);

// ─── DELETE /v1/integrations/:id — remove integration config ─────────────────

router.delete(
  "/v1/integrations/:id",
  requireRole("admin"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const id = req.params.id!;

      const [existing] = await db
        .select({ id: integrationConfigsTable.id })
        .from(integrationConfigsTable)
        .where(and(eq(integrationConfigsTable.id, id), eq(integrationConfigsTable.tenantId, tenantId)))
        .limit(1);

      if (!existing) {
        notFound(res, "Integration config not found");
        return;
      }

      await db
        .delete(integrationConfigsTable)
        .where(eq(integrationConfigsTable.id, id));

      res.status(204).end();
    } catch (err) {
      console.error("Delete integration error:", err);
      serverError(res);
    }
  }
);

// ─── POST /v1/integrations/:id/test — test connection ────────────────────────

router.post(
  "/v1/integrations/:id/test",
  requireRole("admin"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const id = req.params.id!;

      const result = await getDecryptedConfig(id, tenantId);
      if (!result) {
        notFound(res, "Integration config not found");
        return;
      }

      const { row, config } = result;
      const adapter = adapters[row.sourceType];

      if (!adapter) {
        res.json({ ok: false, message: "Adapter not yet available" });
        return;
      }

      const outcome = await adapter.testConnection(config);
      res.json(outcome);
    } catch (err) {
      console.error("Test integration connection error:", err);
      serverError(res);
    }
  }
);

// ─── POST /v1/integrations/:id/trigger — manual poll ────────────────────────

router.post(
  "/v1/integrations/:id/trigger",
  requireRole("admin"),
  async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const id = req.params.id!;

      const result = await getDecryptedConfig(id, tenantId);
      if (!result) {
        notFound(res, "Integration config not found");
        return;
      }

      const { row, config } = result;
      const adapter = adapters[row.sourceType];

      if (!adapter) {
        res.json({ ok: false, message: "Adapter not yet available", signalsCreated: 0 });
        return;
      }

      const since = row.lastPolledAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rawSignals = await adapter.poll(config, since);

      let signalsCreated = 0;

      for (const raw of rawSignals) {
        const inserted = await db
          .insert(signalsTable)
          .values({
            tenantId,
            source: row.sourceType,
            content: raw.content,
            contentHash: raw.contentHash,
            externalId: raw.externalId,
            metadata: raw.metadata,
          })
          .onConflictDoNothing()
          .returning({ id: signalsTable.id });

        if (inserted.length > 0) {
          signalsCreated++;
          await enqueueJob("ai-triage", "classify", { signalId: inserted[0]!.id }, tenantId);
        }
      }

      await db
        .update(integrationConfigsTable)
        .set({ lastPolledAt: new Date(), updatedAt: new Date() })
        .where(eq(integrationConfigsTable.id, id));

      res.json({ signalsCreated });
    } catch (err) {
      console.error("Trigger integration poll error:", err);
      serverError(res);
    }
  }
);

export default router;
