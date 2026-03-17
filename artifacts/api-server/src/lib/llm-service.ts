import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { db, llmConfigsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { decrypt } from "./encryption";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface StreamChunk {
  type: "text" | "done" | "error";
  content: string;
}

interface ResolvedConfig {
  providerType: "openai_compat" | "anthropic";
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
}

function safeDecrypt(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch (err) {
    console.error("[LLMService] Failed to decrypt API key:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function resolveConfig(tenantId: string, useCase: "general" | "embeddings" = "general"): Promise<ResolvedConfig | null> {
  try {
    const [config] = await db.select().from(llmConfigsTable)
      .where(and(
        eq(llmConfigsTable.tenantId, tenantId),
        eq(llmConfigsTable.isDefault, true),
        eq(llmConfigsTable.useCase, useCase),
        eq(llmConfigsTable.isActive, true),
      )).limit(1);

    if (!config) {
      const [anyConfig] = await db.select().from(llmConfigsTable)
        .where(and(
          eq(llmConfigsTable.tenantId, tenantId),
          eq(llmConfigsTable.useCase, useCase),
          eq(llmConfigsTable.isActive, true),
        )).limit(1);
      if (!anyConfig) return null;
      return {
        providerType: anyConfig.providerType,
        baseUrl: anyConfig.baseUrl,
        apiKey: safeDecrypt(anyConfig.encryptedApiKey),
        model: anyConfig.model,
      };
    }

    return {
      providerType: config.providerType,
      baseUrl: config.baseUrl,
      apiKey: safeDecrypt(config.encryptedApiKey),
      model: config.model,
    };
  } catch (err) {
    console.error("[LLMService] resolveConfig error:", err);
    return null;
  }
}

async function resolveConfigById(configId: string, tenantId: string): Promise<ResolvedConfig | null> {
  try {
    const [config] = await db.select().from(llmConfigsTable)
      .where(and(eq(llmConfigsTable.id, configId), eq(llmConfigsTable.tenantId, tenantId)))
      .limit(1);
    if (!config) return null;
    return {
      providerType: config.providerType,
      baseUrl: config.baseUrl,
      apiKey: safeDecrypt(config.encryptedApiKey),
      model: config.model,
    };
  } catch (err) {
    console.error("[LLMService] resolveConfigById error:", err);
    return null;
  }
}

function buildOpenAIClient(config: ResolvedConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey || "ollama",
    baseURL: config.baseUrl || undefined,
  });
}

function buildAnthropicClient(config: ResolvedConfig): Anthropic {
  return new Anthropic({
    apiKey: config.apiKey || undefined,
  });
}

export async function complete(tenantId: string, opts: CompletionOptions): Promise<string> {
  const config = await resolveConfig(tenantId);
  if (!config) throw new LLMUnavailableError();

  const model = opts.model || config.model;

  if (config.providerType === "anthropic") {
    const client = buildAnthropicClient(config);
    const systemMsg = opts.messages.find(m => m.role === "system");
    const userMsgs = opts.messages.filter(m => m.role !== "system").map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const resp = await client.messages.create({
      model,
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.3,
      system: systemMsg?.content,
      messages: userMsgs,
    });
    const textBlock = resp.content.find(b => b.type === "text");
    return textBlock?.text || "";
  }

  const client = buildOpenAIClient(config);
  const resp = await client.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens || 1024,
  });
  return resp.choices[0]?.message?.content || "";
}

export async function* streamComplete(tenantId: string, opts: CompletionOptions): AsyncGenerator<StreamChunk> {
  const config = await resolveConfig(tenantId);
  if (!config) throw new LLMUnavailableError();

  const model = opts.model || config.model;

  if (config.providerType === "anthropic") {
    const client = buildAnthropicClient(config);
    const systemMsg = opts.messages.find(m => m.role === "system");
    const userMsgs = opts.messages.filter(m => m.role !== "system").map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const stream = client.messages.stream({
      model,
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.3,
      system: systemMsg?.content,
      messages: userMsgs,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", content: event.delta.text };
      }
    }
    yield { type: "done", content: "" };
    return;
  }

  const client = buildOpenAIClient(config);
  const stream = await client.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens || 1024,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield { type: "text", content: delta };
    }
  }
  yield { type: "done", content: "" };
}

export async function generateEmbedding(tenantId: string, text: string): Promise<number[]> {
  const config = await resolveConfig(tenantId, "embeddings");
  if (!config) {
    const generalConfig = await resolveConfig(tenantId, "general");
    if (!generalConfig || generalConfig.providerType === "anthropic") throw new LLMUnavailableError();
    const client = buildOpenAIClient(generalConfig);
    const resp = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return resp.data[0].embedding;
  }

  if (config.providerType === "anthropic") {
    throw new Error("Anthropic does not support embeddings. Configure an OpenAI-compatible provider for embeddings.");
  }

  const client = buildOpenAIClient(config);
  const resp = await client.embeddings.create({
    model: config.model,
    input: text,
  });
  return resp.data[0].embedding;
}

export async function testConnection(configId: string, tenantId: string): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const config = await resolveConfigById(configId, tenantId);
  if (!config) return { success: false, message: "Configuration not found", latencyMs: 0 };

  const start = Date.now();
  try {
    if (config.providerType === "anthropic") {
      const client = buildAnthropicClient(config);
      await client.messages.create({
        model: config.model,
        max_tokens: 5,
        messages: [{ role: "user", content: "Say hello" }],
      });
    } else {
      const client = buildOpenAIClient(config);
      await client.chat.completions.create({
        model: config.model,
        messages: [{ role: "user", content: "Say hello" }],
        max_tokens: 5,
      });
    }
    return { success: true, message: "Connection successful", latencyMs: Date.now() - start };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}

const ANTHROPIC_MODELS = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
  "claude-3-haiku-20240307",
];

export const KNOWN_VENDOR_BASE_URLS: Record<string, { baseUrl: string; providerType: "openai_compat" | "anthropic" }> = {
  openai: { baseUrl: "https://api.openai.com/v1", providerType: "openai_compat" },
  anthropic: { baseUrl: "", providerType: "anthropic" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", providerType: "openai_compat" },
  mistral: { baseUrl: "https://api.mistral.ai/v1", providerType: "openai_compat" },
  together: { baseUrl: "https://api.together.xyz/v1", providerType: "openai_compat" },
  cohere: { baseUrl: "https://api.cohere.ai/compatibility/v1", providerType: "openai_compat" },
  perplexity: { baseUrl: "https://api.perplexity.ai", providerType: "openai_compat" },
};

const LOCAL_VENDOR_KEYS = new Set(["ollama", "lmstudio", "custom"]);

export interface ProbeResult {
  success: boolean;
  message: string;
  models: string[];
  latencyMs: number;
  tokensPerSecond?: number;
}

async function runOpenAIProbe(apiKey: string | undefined, baseUrl: string | undefined): Promise<ProbeResult> {
  const start = Date.now();
  const client = new OpenAI({
    apiKey: apiKey || "ollama",
    baseURL: baseUrl || undefined,
  });

  let models: string[] = [];
  try {
    const modelsResp = await client.models.list();
    models = modelsResp.data.map((m) => m.id).sort();
  } catch {
    // model list optional; some providers don't implement it
  }

  if (models.length === 0 && !baseUrl) {
    return { success: false, message: "Model discovery returned no models — check your API key.", models: [], latencyMs: Date.now() - start };
  }

  try {
    const testModel = models[0] || "gpt-4o-mini";
    const resp = await client.chat.completions.create({
      model: testModel,
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 5,
    });
    const latencyMs = Date.now() - start;
    const totalTokens = (resp.usage?.prompt_tokens ?? 0) + (resp.usage?.completion_tokens ?? 0);
    const tokensPerSecond = latencyMs > 0 ? Math.round((totalTokens / latencyMs) * 1000) : undefined;
    return { success: true, message: "Connection successful", models, latencyMs, tokensPerSecond };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err), models, latencyMs: Date.now() - start };
  }
}

async function runAnthropicProbe(apiKey: string | undefined): Promise<ProbeResult> {
  const start = Date.now();
  const client = new Anthropic({ apiKey: apiKey || undefined });
  try {
    const resp = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 5,
      messages: [{ role: "user", content: "hi" }],
    });
    const latencyMs = Date.now() - start;
    const inputTokens = resp.usage?.input_tokens ?? 0;
    const outputTokens = resp.usage?.output_tokens ?? 0;
    const totalTokens = inputTokens + outputTokens;
    const tokensPerSecond = latencyMs > 0 ? Math.round((totalTokens / latencyMs) * 1000) : undefined;
    return { success: true, message: "Connection successful", models: ANTHROPIC_MODELS, latencyMs, tokensPerSecond };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err), models: ANTHROPIC_MODELS, latencyMs: Date.now() - start };
  }
}

export async function probeProvider(opts: {
  providerType: "openai_compat" | "anthropic";
  vendor?: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<ProbeResult> {
  const isPublicVendor = opts.vendor && KNOWN_VENDOR_BASE_URLS[opts.vendor] && !LOCAL_VENDOR_KEYS.has(opts.vendor);

  if (opts.providerType === "anthropic") {
    return runAnthropicProbe(opts.apiKey);
  }

  let canonicalBaseUrl = opts.baseUrl;
  if (isPublicVendor && opts.vendor) {
    canonicalBaseUrl = KNOWN_VENDOR_BASE_URLS[opts.vendor].baseUrl || undefined;
  }

  return runOpenAIProbe(opts.apiKey, canonicalBaseUrl);
}

export async function probeProviderById(configId: string, tenantId: string): Promise<ProbeResult> {
  const config = await resolveConfigById(configId, tenantId);
  if (!config) return { success: false, message: "Configuration not found", models: [], latencyMs: 0 };

  if (config.providerType === "anthropic") {
    return runAnthropicProbe(config.apiKey ?? undefined);
  }
  return runOpenAIProbe(config.apiKey ?? undefined, config.baseUrl ?? undefined);
}

export async function isAvailable(tenantId: string): Promise<boolean> {
  const config = await resolveConfig(tenantId);
  return config !== null;
}

export class LLMUnavailableError extends Error {
  constructor() {
    super("AI unavailable — no LLM provider configured. Manual mode active.");
    this.name = "LLMUnavailableError";
  }
}
