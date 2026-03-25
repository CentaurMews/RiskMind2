import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { db, llmConfigsTable, llmTaskRoutingTable, llmBenchmarkResultsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { decrypt } from "./encryption";

export type LLMTaskType =
  | "enrichment"
  | "triage"
  | "treatment"
  | "embeddings"
  | "agent"
  | "general"
  | "assessment";

// Hardcoded Anthropic models — used as fallback when anthropic.models.list() is unavailable or errors
export const ANTHROPIC_MODELS = [
  { id: "claude-opus-4-5", displayName: "Claude Opus 4.5", capability: ["chat"] },
  { id: "claude-sonnet-4-5", displayName: "Claude Sonnet 4.5", capability: ["chat"] },
  { id: "claude-haiku-3-5", displayName: "Claude Haiku 3.5", capability: ["chat"] },
  { id: "claude-opus-4", displayName: "Claude Opus 4", capability: ["chat"] },
  { id: "claude-sonnet-4", displayName: "Claude Sonnet 4", capability: ["chat"] },
  { id: "claude-haiku-3", displayName: "Claude Haiku 3", capability: ["chat"] },
];

const BENCHMARK_PROMPT = `You are a risk analyst. Respond ONLY with valid JSON.
Assess this risk: "Vendor XYZ lacks SOC 2 certification."
Return: {"severity":"high|medium|low","category":"vendor|compliance|operational","summary":"one sentence"}`;

// OpenAI model IDs allowed through the discovery filter
const OPENAI_MODEL_PREFIXES = ["gpt-4", "gpt-3.5", "o1", "o3", "text-embedding-", "gpt-4o"];

export interface DiscoveredModel {
  id: string;
  displayName?: string;
  capability: string[];       // "chat" | "embeddings" | "code"
  contextWindow?: number;
}

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

/**
 * Sanitize user-controlled strings before interpolating into LLM prompts.
 * Wraps content in XML delimiters to prevent prompt injection, strips control
 * characters, and truncates to a max length.
 */
export function sanitizeForPrompt(value: string, tag: string, maxLength = 2000): string {
  const cleaned = value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, maxLength);
  return `<${tag}>${cleaned}</${tag}>`;
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

async function resolveConfig(tenantId: string, taskType: LLMTaskType = "general"): Promise<ResolvedConfig | null> {
  try {
    // Step 1: Task-specific routing lookup
    const [routing] = await db.select().from(llmTaskRoutingTable)
      .where(and(
        eq(llmTaskRoutingTable.tenantId, tenantId),
        eq(llmTaskRoutingTable.taskType, taskType)
      )).limit(1);

    if (routing?.configId) {
      const [routedConfig] = await db.select().from(llmConfigsTable)
        .where(and(
          eq(llmConfigsTable.id, routing.configId),
          eq(llmConfigsTable.isActive, true)
        )).limit(1);
      if (routedConfig) {
        return {
          providerType: routedConfig.providerType,
          baseUrl: routedConfig.baseUrl,
          apiKey: safeDecrypt(routedConfig.encryptedApiKey),
          model: routing.modelOverride || routedConfig.model,
        };
      }
    }

    // Step 2: Existing fallback logic (preserved exactly)
    const useCase = taskType === "embeddings" ? "embeddings" : "general";
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

function scoreQuality(response: string): number {
  try {
    const parsed = JSON.parse(response);
    const hasAllKeys = parsed.severity && parsed.category && parsed.summary;
    const validSeverity = ["high", "medium", "low"].includes(parsed.severity);
    const validCategory = ["vendor", "compliance", "operational"].includes(parsed.category);
    if (hasAllKeys && validSeverity && validCategory) return 3;
    if (hasAllKeys) return 2;
    return 1;
  } catch {
    return response.toLowerCase().includes("risk") ? 1 : 0;
  }
}

async function discoverOllamaModels(baseUrl: string): Promise<{ models: DiscoveredModel[]; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { models: [], error: `Ollama returned ${res.status}` };
    const data = await res.json() as { models: Array<{ name: string; details?: { family?: string } }> };
    return {
      models: data.models.map((m) => ({
        id: m.name,
        displayName: m.name,
        capability: m.details?.family?.toLowerCase().includes("bert") ? ["embeddings"] : ["chat"],
      })),
    };
  } catch (err) {
    return { models: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function discoverAnthropicModels(config: ResolvedConfig): Promise<{ models: DiscoveredModel[]; error?: string }> {
  try {
    const client = buildAnthropicClient(config);
    const page = await client.models.list({ limit: 100 });
    if (page.data.length > 0) {
      return {
        models: page.data.map((m) => ({
          id: m.id,
          displayName: m.display_name,
          capability: ["chat"],
        })),
      };
    }
  } catch (err) {
    console.warn("[LLMService] anthropic.models.list() failed, using hardcoded fallback:", err instanceof Error ? err.message : err);
  }
  // Fallback to hardcoded constant
  return { models: ANTHROPIC_MODELS };
}

async function discoverOpenAICompatModels(config: ResolvedConfig): Promise<{ models: DiscoveredModel[]; error?: string }> {
  try {
    const client = buildOpenAIClient(config);
    const list = await client.models.list();
    const allModels = list.data || [];

    // Filter to relevant models only
    const isOpenAI = !config.baseUrl || config.baseUrl.includes("api.openai.com");
    const filtered = isOpenAI
      ? allModels.filter((m) => OPENAI_MODEL_PREFIXES.some((prefix) => m.id.startsWith(prefix)))
      : allModels.filter((m) => !m.id.includes("deprecated") && !m.id.includes("instruct-0"));

    return {
      models: filtered.map((m) => ({
        id: m.id,
        displayName: m.id,
        capability: m.id.includes("embedding") ? ["embeddings"] : ["chat"],
      })),
    };
  } catch (err) {
    return { models: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function complete(tenantId: string, opts: CompletionOptions, taskType: LLMTaskType = "general"): Promise<string> {
  const config = await resolveConfig(tenantId, taskType);
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

export async function* streamComplete(tenantId: string, opts: CompletionOptions, taskType: LLMTaskType = "general"): AsyncGenerator<StreamChunk> {
  const config = await resolveConfig(tenantId, taskType);
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
    const generalConfig = await resolveConfig(tenantId, "general" as LLMTaskType);
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

export async function isAvailable(tenantId: string): Promise<boolean> {
  const config = await resolveConfig(tenantId);
  return config !== null;
}

export async function discoverModels(
  configId: string,
  tenantId: string,
): Promise<{ models: DiscoveredModel[]; error?: string }> {
  const config = await resolveConfigById(configId, tenantId);
  if (!config) return { models: [], error: "Configuration not found" };

  const isOllama =
    config.baseUrl?.includes(":11434") ||
    (config.baseUrl?.includes("localhost") && !config.baseUrl?.includes("openai"));

  if (config.providerType === "anthropic") {
    return discoverAnthropicModels(config);
  }
  if (isOllama) {
    return discoverOllamaModels(config.baseUrl!);
  }
  return discoverOpenAICompatModels(config);
}

export async function runBenchmark(
  configId: string,
  tenantId: string,
  modelOverride?: string,
): Promise<{ ttftMs: number; totalLatencyMs: number; qualityScore: number; tokensPerSecond?: number; model: string }> {
  const config = await resolveConfigById(configId, tenantId);
  if (!config) throw new Error("Configuration not found");

  const model = modelOverride || config.model;

  type CallResult = { ttftMs: number; totalLatencyMs: number; response: string };
  const results: CallResult[] = [];

  for (let i = 0; i < 3; i++) {
    const startMs = Date.now();
    let ttft = 0;
    let fullResponse = "";

    try {
      if (config.providerType === "anthropic") {
        const client = buildAnthropicClient(config);
        const stream = await client.messages.stream({
          model,
          max_tokens: 50,
          temperature: 0,
          messages: [{ role: "user", content: BENCHMARK_PROMPT }],
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            if (!ttft) ttft = Date.now() - startMs;
            fullResponse += event.delta.text;
          }
        }
      } else {
        const client = buildOpenAIClient({ ...config, model });
        const stream = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: BENCHMARK_PROMPT }],
          max_tokens: 50,
          temperature: 0,
          stream: true,
        });
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            if (!ttft) ttft = Date.now() - startMs;
            fullResponse += delta;
          }
        }
      }
    } catch (err) {
      throw new Error(`Benchmark call ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    results.push({ ttftMs: ttft || (Date.now() - startMs), totalLatencyMs: Date.now() - startMs, response: fullResponse });
  }

  // Discard call 1 (cold start), use calls 2 and 3
  const warmResults = results.slice(1);
  const ttftMedian = Math.round((warmResults[0].ttftMs + warmResults[1].ttftMs) / 2);
  const latencyMedian = Math.round((warmResults[0].totalLatencyMs + warmResults[1].totalLatencyMs) / 2);
  const qualityScore = scoreQuality(warmResults[1].response); // Use last call for quality check

  // Persist to llm_benchmark_results
  await db.insert(llmBenchmarkResultsTable).values({
    configId,
    tenantId,
    model,
    ttftMs: ttftMedian,
    totalLatencyMs: latencyMedian,
    qualityScore,
  });

  return { ttftMs: ttftMedian, totalLatencyMs: latencyMedian, qualityScore, model };
}

export async function suggestRouting(
  tenantId: string,
): Promise<Record<LLMTaskType, { configId: string; model: string } | null>> {
  // Read latest benchmark results per config
  const recent = await db
    .select()
    .from(llmBenchmarkResultsTable)
    .where(eq(llmBenchmarkResultsTable.tenantId, tenantId))
    .orderBy(desc(llmBenchmarkResultsTable.createdAt))
    .limit(50);

  if (recent.length === 0) {
    return { enrichment: null, triage: null, treatment: null, embeddings: null, agent: null, general: null, assessment: null };
  }

  // Group by configId, pick best per task heuristic:
  // triage: lowest TTFT (speed matters most)
  // enrichment, agent: highest quality score (reasoning matters most)
  // treatment: best quality + reasonable latency
  // embeddings: pick embedding-capable config if available
  // general: lowest total latency
  const byConfig = new Map<string, typeof recent[0]>();
  for (const r of recent) {
    const existing = byConfig.get(r.configId);
    if (!existing || r.createdAt > existing.createdAt) {
      byConfig.set(r.configId, r);
    }
  }

  const all = [...byConfig.values()];
  const fastest = all.sort((a, b) => (a.ttftMs ?? 9999) - (b.ttftMs ?? 9999))[0];
  const bestQuality = all.sort((a, b) => b.qualityScore - a.qualityScore)[0];
  const balanced = all.sort((a, b) => b.qualityScore * 0.7 + (1 / ((a.totalLatencyMs || 1) / 1000)) * 0.3 - (b.qualityScore * 0.7 + (1 / ((b.totalLatencyMs || 1) / 1000)) * 0.3))[0];

  const toEntry = (r: typeof recent[0] | undefined) => r ? { configId: r.configId, model: r.model } : null;

  return {
    triage: toEntry(fastest),
    enrichment: toEntry(bestQuality),
    agent: toEntry(bestQuality),
    treatment: toEntry(balanced),
    general: toEntry(fastest),
    assessment: toEntry(balanced),
    embeddings: null, // User should pick explicit embeddings config
  };
}

export class LLMUnavailableError extends Error {
  constructor() {
    super("AI unavailable — no LLM provider configured. Manual mode active.");
    this.name = "LLMUnavailableError";
  }
}
