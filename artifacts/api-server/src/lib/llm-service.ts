import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { db, llmConfigsTable, llmTaskRoutingTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { decrypt } from "./encryption";

export type LLMTaskType =
  | "enrichment"
  | "triage"
  | "treatment"
  | "embeddings"
  | "agent"
  | "general";

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

export class LLMUnavailableError extends Error {
  constructor() {
    super("AI unavailable — no LLM provider configured. Manual mode active.");
    this.name = "LLMUnavailableError";
  }
}
