import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, llmConfigsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, conflict } from "../lib/errors";
import { encrypt } from "../lib/encryption";
import { testConnection, probeProvider, probeProviderById } from "../lib/llm-service";

const router = Router();

const BLOCKED_HOSTS = ["metadata.google.internal", "169.254.169.254"];
const LOCAL_ALLOWED_PORTS = [11434, 8080, 1234, 4891, 5001];

function validateBaseUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return "baseUrl must use http or https protocol";
    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_HOSTS.includes(hostname)) return "baseUrl cannot target cloud metadata endpoints";

    const isLocal = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(hostname);
    if (isLocal) {
      const port = parsed.port ? parseInt(parsed.port) : (parsed.protocol === "https:" ? 443 : 80);
      if (!LOCAL_ALLOWED_PORTS.includes(port)) {
        return `Local base URLs are only allowed on ports: ${LOCAL_ALLOWED_PORTS.join(", ")} (for Ollama, LM Studio, etc.)`;
      }
    }

    return null;
  } catch {
    return "baseUrl is not a valid URL";
  }
}

function sanitizeConfig(config: typeof llmConfigsTable.$inferSelect) {
  const { encryptedApiKey, ...rest } = config;
  return { ...rest, hasApiKey: !!encryptedApiKey };
}

router.get("/v1/settings/llm-providers", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const configs = await db.select().from(llmConfigsTable)
      .where(eq(llmConfigsTable.tenantId, tenantId));
    res.json(configs.map(sanitizeConfig));
  } catch (err) {
    console.error("List LLM providers error:", err);
    serverError(res);
  }
});

router.get("/v1/settings/llm-providers/:id", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const [config] = await db.select().from(llmConfigsTable)
      .where(and(eq(llmConfigsTable.id, String(req.params.id)), eq(llmConfigsTable.tenantId, tenantId)))
      .limit(1);
    if (!config) { notFound(res, "LLM provider not found"); return; }
    res.json(sanitizeConfig(config));
  } catch (err) {
    console.error("Get LLM provider error:", err);
    serverError(res);
  }
});

router.post("/v1/settings/llm-providers", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, providerType, baseUrl, apiKey, model, isDefault, useCase } = req.body;

    if (!name || !providerType || !model) {
      badRequest(res, "name, providerType, and model are required");
      return;
    }

    if (!["openai_compat", "anthropic"].includes(providerType)) {
      badRequest(res, "providerType must be 'openai_compat' or 'anthropic'");
      return;
    }

    if (baseUrl) {
      const urlError = validateBaseUrl(baseUrl);
      if (urlError) { badRequest(res, urlError); return; }
    }

    if (isDefault) {
      await db.update(llmConfigsTable).set({ isDefault: false, updatedAt: new Date() })
        .where(and(
          eq(llmConfigsTable.tenantId, tenantId),
          eq(llmConfigsTable.useCase, useCase || "general"),
          eq(llmConfigsTable.isDefault, true),
        ));
    }

    const [created] = await db.insert(llmConfigsTable).values({
      tenantId,
      name,
      providerType,
      baseUrl: baseUrl || null,
      encryptedApiKey: apiKey ? encrypt(apiKey) : null,
      model,
      isDefault: isDefault ?? false,
      useCase: useCase || "general",
    }).returning();

    await recordAudit(req, "llm_provider_created", "llm_config", created.id, { name, providerType, model });
    res.status(201).json(sanitizeConfig(created));
  } catch (err) {
    console.error("Create LLM provider error:", err);
    serverError(res);
  }
});

router.put("/v1/settings/llm-providers/:id", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const configId = String(req.params.id);

    const [existing] = await db.select().from(llmConfigsTable)
      .where(and(eq(llmConfigsTable.id, configId), eq(llmConfigsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { notFound(res, "LLM provider not found"); return; }

    const { name, providerType, baseUrl, apiKey, model, isDefault, useCase, isActive } = req.body;

    if (baseUrl) {
      const urlError = validateBaseUrl(baseUrl);
      if (urlError) { badRequest(res, urlError); return; }
    }

    if (isDefault) {
      const uc = useCase || existing.useCase;
      await db.update(llmConfigsTable).set({ isDefault: false, updatedAt: new Date() })
        .where(and(
          eq(llmConfigsTable.tenantId, tenantId),
          eq(llmConfigsTable.useCase, uc),
          eq(llmConfigsTable.isDefault, true),
        ));
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (providerType !== undefined) updates.providerType = providerType;
    if (baseUrl !== undefined) updates.baseUrl = baseUrl || null;
    if (apiKey !== undefined) updates.encryptedApiKey = apiKey ? encrypt(apiKey) : null;
    if (model !== undefined) updates.model = model;
    if (isDefault !== undefined) updates.isDefault = isDefault;
    if (useCase !== undefined) updates.useCase = useCase;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db.update(llmConfigsTable).set(updates)
      .where(and(eq(llmConfigsTable.id, configId), eq(llmConfigsTable.tenantId, tenantId)))
      .returning();

    await recordAudit(req, "llm_provider_updated", "llm_config", configId, { changes: Object.keys(updates).filter(k => k !== "updatedAt") });
    res.json(sanitizeConfig(updated));
  } catch (err) {
    console.error("Update LLM provider error:", err);
    serverError(res);
  }
});

router.delete("/v1/settings/llm-providers/:id", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const configId = String(req.params.id);

    const [existing] = await db.select().from(llmConfigsTable)
      .where(and(eq(llmConfigsTable.id, configId), eq(llmConfigsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { notFound(res, "LLM provider not found"); return; }

    await db.delete(llmConfigsTable)
      .where(and(eq(llmConfigsTable.id, configId), eq(llmConfigsTable.tenantId, tenantId)));

    await recordAudit(req, "llm_provider_deleted", "llm_config", configId, { name: existing.name });
    res.status(204).send();
  } catch (err) {
    console.error("Delete LLM provider error:", err);
    serverError(res);
  }
});

router.post("/v1/settings/llm-providers/probe", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { providerType, vendor, apiKey, baseUrl } = req.body;

    if (!providerType || !["openai_compat", "anthropic"].includes(providerType)) {
      badRequest(res, "providerType must be 'openai_compat' or 'anthropic'");
      return;
    }

    if (baseUrl) {
      const urlError = validateBaseUrl(baseUrl);
      if (urlError) { badRequest(res, urlError); return; }
    }

    const result = await probeProvider({ providerType, vendor, apiKey, baseUrl });
    res.json(result);
  } catch (err) {
    console.error("Probe LLM provider error:", err);
    serverError(res);
  }
});

router.post("/v1/settings/llm-providers/:id/probe", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const configId = String(req.params.id);

    const result = await probeProviderById(configId, tenantId);
    res.json(result);
  } catch (err) {
    console.error("Probe LLM provider by ID error:", err);
    serverError(res);
  }
});

router.post("/v1/settings/llm-providers/:id/test", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const configId = String(req.params.id);

    const result = await testConnection(configId, tenantId);
    await recordAudit(req, "llm_provider_test", "llm_config", configId, { success: result.success });
    res.json(result);
  } catch (err) {
    console.error("Test LLM provider error:", err);
    serverError(res);
  }
});

export default router;
