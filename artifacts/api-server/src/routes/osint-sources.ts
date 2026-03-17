import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, osintSourceConfigsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError } from "../lib/errors";
import { encrypt, decrypt } from "../lib/encryption";
import {
  runPerplexity,
  runAlienVaultOTX,
  runCensys,
  runNvdCisa,
  runEmailImap,
  type PerplexityCredentials,
  type AlienVaultCredentials,
  type CensysCredentials,
  type EmailImapCredentials,
} from "../lib/osint-adapters";

const router = Router();

const SOURCE_TYPES = ["perplexity", "alienvault_otx", "censys", "nvd_cisa", "email_imap"] as const;
type SourceType = typeof SOURCE_TYPES[number];

function sanitizeSource(src: typeof osintSourceConfigsTable.$inferSelect) {
  const { encryptedCredentials, ...rest } = src;
  let credentialFields: Record<string, unknown> = {};
  if (encryptedCredentials) {
    try {
      const parsed = JSON.parse(decrypt(encryptedCredentials)) as Record<string, unknown>;
      credentialFields = maskCredentials(rest.sourceType as SourceType, parsed);
    } catch {
    }
  }
  return { ...rest, credentials: credentialFields, hasCredentials: !!encryptedCredentials };
}

function maskCredentials(sourceType: SourceType, creds: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(creds)) {
    const isSecret = ["apiKey", "apiSecret", "password"].includes(k);
    masked[k] = isSecret && typeof v === "string" && v.length > 0 ? "••••••••" : v;
  }
  return masked;
}

router.get("/v1/agent/sources", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sources = await db.select().from(osintSourceConfigsTable)
      .where(eq(osintSourceConfigsTable.tenantId, tenantId));
    const sourceMap = new Map(sources.map((s) => [s.sourceType, s]));

    const allSources = SOURCE_TYPES.map((type) => {
      const existing = sourceMap.get(type);
      if (existing) return sanitizeSource(existing);
      return {
        id: null,
        tenantId,
        sourceType: type,
        enabled: false,
        credentials: {},
        hasCredentials: false,
        lastRunAt: null,
        lastRunStatus: "never_run",
        lastRunError: null,
        lastRunSummary: {},
        createdAt: null,
        updatedAt: null,
      };
    });

    res.json(allSources);
  } catch (err) {
    console.error("List OSINT sources error:", err);
    serverError(res);
  }
});

router.get("/v1/agent/sources/:sourceType", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sourceType = req.params.sourceType as SourceType;
    if (!SOURCE_TYPES.includes(sourceType)) { badRequest(res, "Invalid source type"); return; }

    const [source] = await db.select().from(osintSourceConfigsTable)
      .where(and(eq(osintSourceConfigsTable.tenantId, tenantId), eq(osintSourceConfigsTable.sourceType, sourceType)))
      .limit(1);

    if (!source) {
      res.json({
        id: null, tenantId, sourceType, enabled: false, credentials: {}, hasCredentials: false,
        lastRunAt: null, lastRunStatus: "never_run", lastRunError: null, lastRunSummary: {}, createdAt: null, updatedAt: null,
      });
      return;
    }

    res.json(sanitizeSource(source));
  } catch (err) {
    console.error("Get OSINT source error:", err);
    serverError(res);
  }
});

router.put("/v1/agent/sources/:sourceType", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sourceType = req.params.sourceType as SourceType;
    if (!SOURCE_TYPES.includes(sourceType)) { badRequest(res, "Invalid source type"); return; }

    const { enabled, credentials } = req.body as { enabled?: boolean; credentials?: Record<string, unknown> };

    const [existing] = await db.select().from(osintSourceConfigsTable)
      .where(and(eq(osintSourceConfigsTable.tenantId, tenantId), eq(osintSourceConfigsTable.sourceType, sourceType)))
      .limit(1);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (enabled !== undefined) updates.enabled = enabled;

    if (credentials && Object.keys(credentials).length > 0) {
      let mergedCreds: Record<string, unknown> = {};
      if (existing?.encryptedCredentials) {
        try { mergedCreds = JSON.parse(decrypt(existing.encryptedCredentials)) as Record<string, unknown>; } catch { }
      }
      for (const [k, v] of Object.entries(credentials)) {
        if (v !== "••••••••" && v !== null && v !== undefined) {
          mergedCreds[k] = v;
        }
      }
      updates.encryptedCredentials = encrypt(JSON.stringify(mergedCreds));
    }

    let result: typeof osintSourceConfigsTable.$inferSelect;
    if (existing) {
      const [updated] = await db.update(osintSourceConfigsTable).set(updates)
        .where(and(eq(osintSourceConfigsTable.id, existing.id), eq(osintSourceConfigsTable.tenantId, tenantId)))
        .returning();
      result = updated;
    } else {
      const [created] = await db.insert(osintSourceConfigsTable).values({
        tenantId,
        sourceType,
        enabled: (updates.enabled as boolean) ?? false,
        encryptedCredentials: updates.encryptedCredentials as string | null ?? null,
      }).returning();
      result = created;
    }

    await recordAudit(req, "osint_source_updated", "osint_source", result.id, { sourceType, enabled });
    res.json(sanitizeSource(result));
  } catch (err) {
    console.error("Update OSINT source error:", err);
    serverError(res);
  }
});

router.delete("/v1/agent/sources/:sourceType", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sourceType = req.params.sourceType as SourceType;
    if (!SOURCE_TYPES.includes(sourceType)) { badRequest(res, "Invalid source type"); return; }

    const [existing] = await db.select().from(osintSourceConfigsTable)
      .where(and(eq(osintSourceConfigsTable.tenantId, tenantId), eq(osintSourceConfigsTable.sourceType, sourceType)))
      .limit(1);

    if (!existing) { notFound(res, "Source config not found"); return; }

    await db.delete(osintSourceConfigsTable)
      .where(and(eq(osintSourceConfigsTable.id, existing.id), eq(osintSourceConfigsTable.tenantId, tenantId)));

    await recordAudit(req, "osint_source_deleted", "osint_source", existing.id, { sourceType });
    res.status(204).send();
  } catch (err) {
    console.error("Delete OSINT source error:", err);
    serverError(res);
  }
});

router.post("/v1/agent/sources/:sourceType/test", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sourceType = req.params.sourceType as SourceType;
    if (!SOURCE_TYPES.includes(sourceType)) { badRequest(res, "Invalid source type"); return; }

    const [existing] = await db.select().from(osintSourceConfigsTable)
      .where(and(eq(osintSourceConfigsTable.tenantId, tenantId), eq(osintSourceConfigsTable.sourceType, sourceType)))
      .limit(1);

    let creds: Record<string, unknown> = {};
    if (existing?.encryptedCredentials) {
      try { creds = JSON.parse(decrypt(existing.encryptedCredentials)) as Record<string, unknown>; } catch { }
    }

    const bodyCredentials = req.body?.credentials as Record<string, unknown> | undefined;
    if (bodyCredentials) {
      for (const [k, v] of Object.entries(bodyCredentials)) {
        if (v && v !== "••••••••") creds[k] = v;
      }
    }

    let result;
    switch (sourceType) {
      case "perplexity":
        if (!creds.apiKey) { badRequest(res, "API key required for Perplexity"); return; }
        result = await runPerplexity(creds as unknown as PerplexityCredentials, "Summarize today's top cybersecurity threats in 2 sentences.");
        break;
      case "alienvault_otx":
        if (!creds.apiKey) { badRequest(res, "API key required for AlienVault OTX"); return; }
        result = await runAlienVaultOTX(creds as unknown as AlienVaultCredentials);
        break;
      case "censys":
        if (!creds.apiId || !creds.apiSecret) { badRequest(res, "API ID and API Secret required for Censys"); return; }
        result = await runCensys(creds as unknown as CensysCredentials);
        break;
      case "nvd_cisa":
        result = await runNvdCisa();
        break;
      case "email_imap":
        if (!creds.host || !creds.username || !creds.password) { badRequest(res, "Host, username, and password required for Email IMAP"); return; }
        result = await runEmailImap({ ...creds, port: Number(creds.port || 993) } as unknown as EmailImapCredentials);
        break;
      default:
        badRequest(res, "Unsupported source type");
        return;
    }

    await recordAudit(req, "osint_source_tested", "osint_source", existing?.id, { sourceType, success: result.success });
    res.json({ success: result.success, summary: result.summary, error: result.error, sampleCount: result.data.length });
  } catch (err) {
    console.error("Test OSINT source error:", err);
    serverError(res);
  }
});

export default router;
