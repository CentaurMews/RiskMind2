# Stack Research

**Domain:** LLM provider model auto-discovery, benchmarking, and intelligent per-task routing — v1.1 additions to RiskMind ERM platform
**Researched:** 2026-03-18
**Confidence:** HIGH (provider APIs verified via official docs; existing codebase inspected directly)

---

> **Scope note:** This document covers ONLY the new capabilities required for v1.1 (provider wizard, model listing, benchmarking, routing). The existing validated stack (Express 5, React + Vite, Drizzle ORM, PostgreSQL, OpenAI SDK ^6.29, Anthropic SDK ^0.78, AES-256-GCM encryption) is already installed and not re-documented here.

---

## New Dependencies Required

**Short answer: zero new npm packages.** The existing `openai` and `@anthropic-ai/sdk` SDKs expose every API method needed. Model listing, connection testing, and structured routing can be implemented entirely within the existing stack using Node.js `fetch` for providers not covered by the SDKs.

### Core Technologies (Existing — Leveraged for New Features)

| Technology | Version | New Usage | Why Sufficient |
|------------|---------|-----------|----------------|
| `openai` | ^6.29.0 | `client.models.list()` covers OpenAI, Gemini (compat), Groq, Mistral, Together, Ollama | OpenAI Node SDK supports any OpenAI-compatible base URL; the same `GET /v1/models` call works for all these providers |
| `@anthropic-ai/sdk` | ^0.78.0 | `client.models.list()` — Anthropic added a real `/v1/models` endpoint (not hardcoded anymore) | SDK exposes `anthropic.models.list()` returning paginated `ModelInfo[]` with `id`, `display_name`, `created_at` |
| `drizzle-orm` | catalog | New `llm_routing_rules` table, schema migration | Already in use; add one table for routing config |
| `zod` | catalog | New Zod schemas for wizard steps, benchmark results, routing table | Already in use |
| Node.js `fetch` | Node 20 built-in | Fallback for providers with non-OpenAI-compat list endpoints (Google Gemini native API) | Avoids adding `node-fetch` or `axios` — built-in since Node 18 |

---

## Provider Model Listing — API Reference

This is the critical technical reference for implementing the wizard's "auto-fetch models" step.

### OpenAI

| Field | Value |
|-------|-------|
| Endpoint | `GET /v1/models` |
| Base URL | `https://api.openai.com/v1` |
| Auth | `Authorization: Bearer {apiKey}` |
| SDK method | `client.models.list()` → async iterable of `Model` objects |
| Response field | `id` (e.g. `"gpt-4o"`, `"text-embedding-3-small"`) |
| Filter needed | Exclude fine-tuned IDs (contain `:`) and deprecated (`-0301`, `-0314` suffixes) for cleaner display |

```typescript
const client = new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
const models = await client.models.list();
// models.data is Model[] with .id field
```

### Anthropic

| Field | Value |
|-------|-------|
| Endpoint | `GET /v1/models` |
| Base URL | `https://api.anthropic.com` |
| Auth | `X-Api-Key: {apiKey}`, `anthropic-version: 2023-06-01` |
| SDK method | `anthropic.models.list()` → paginated `ModelInfo[]` |
| Response fields | `id`, `display_name`, `created_at`, `type: "model"` |
| Notes | Returns only production models; no fine-tunes. Pagination via `after_id`/`before_id`. `has_more` flag for multi-page. |

```typescript
const client = new Anthropic({ apiKey });
const page = await client.models.list({ limit: 100 });
// page.data is ModelInfo[] with .id and .display_name
```

### Google Gemini (OpenAI-compatible mode)

| Field | Value |
|-------|-------|
| Base URL for OpenAI SDK | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| Model list endpoint | `GET /v1/models` (via OpenAI SDK with above base URL) |
| Auth | `Authorization: Bearer {geminiApiKey}` |
| Notes | Google added OpenAI-compat in late 2024. Use `openai_compat` provider type. The compat endpoint supports `GET /v1/models` — reuse `client.models.list()`. |

```typescript
const client = new OpenAI({
  apiKey: geminiApiKey,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});
const models = await client.models.list();
// Returns gemini-2.0-flash, gemini-2.5-pro, etc.
```

### Groq

| Field | Value |
|-------|-------|
| Base URL | `https://api.groq.com/openai/v1` |
| Model list endpoint | `GET /openai/v1/models` |
| Auth | `Authorization: Bearer {apiKey}` |
| SDK method | `client.models.list()` via OpenAI SDK with Groq base URL |
| Notes | Full OpenAI-compat. Use `openai_compat` provider type with `baseUrl = "https://api.groq.com/openai/v1"` |

### Mistral

| Field | Value |
|-------|-------|
| Base URL | `https://api.mistral.ai/v1` |
| Model list endpoint | `GET /v1/models` |
| Auth | `Authorization: Bearer {apiKey}` |
| SDK method | `client.models.list()` via OpenAI SDK with Mistral base URL |
| Notes | OpenAI-compatible. Returns `id`, `object: "model"`, `owned_by`. Use `openai_compat` provider type. |

### Together AI

| Field | Value |
|-------|-------|
| Base URL | `https://api.together.xyz/v1` |
| Model list endpoint | `GET /v1/models` |
| Auth | `Authorization: Bearer {apiKey}` |
| SDK method | `client.models.list()` via OpenAI SDK with Together base URL |
| Notes | 200+ open-source models. Response is verbose — filter by `type: "chat"` or `type: "language"` to surface relevant completions models. |

### Ollama / Private

| Field | Value |
|-------|-------|
| Endpoint | `GET /api/tags` |
| Base URL | User-provided (e.g. `http://localhost:11434`) |
| Auth | None (local) |
| SDK method | Cannot use OpenAI SDK for listing. Use `fetch` directly. |
| Response | `{ models: [{ name, model, modified_at, size, details: { family, parameter_size } }] }` |

```typescript
// Ollama model listing — native API only, not OpenAI-compat
const res = await fetch(`${baseUrl}/api/tags`);
const data = await res.json();
const modelIds = data.models.map((m: { name: string }) => m.name);
```

Note: Ollama also exposes `GET /v1/models` via its OpenAI-compat layer, but `/api/tags` is more reliable and returns richer metadata (size, family, quantization).

---

## Provider Type Mapping

The existing `llm_provider_type` enum only has `openai_compat` and `anthropic`. The wizard needs to present named providers to users but internally route them to the correct client strategy:

| Wizard Provider Label | Internal `providerType` | `baseUrl` |
|----------------------|------------------------|-----------|
| OpenAI | `openai_compat` | `null` (SDK default) |
| Google Gemini | `openai_compat` | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| Groq | `openai_compat` | `https://api.groq.com/openai/v1` |
| Mistral | `openai_compat` | `https://api.mistral.ai/v1` |
| Together AI | `openai_compat` | `https://api.together.xyz/v1` |
| Ollama / Private | `openai_compat` | User-provided URL |
| Anthropic | `anthropic` | `null` (SDK default) |

No schema change needed to `llm_provider_type` enum. The `baseUrl` field already distinguishes providers within `openai_compat`.

Add a new optional `displayProvider` text column to `llm_configs` to store the human-readable provider label (e.g. `"Groq"`, `"Google Gemini"`) for display purposes only.

---

## Benchmark Approach

### What to Measure

| Metric | How to Measure | Use |
|--------|---------------|-----|
| Time to first token (TTFT) | `Date.now()` before call, capture time of first streamed chunk | Indicates responsiveness for streaming UIs |
| Total latency | `Date.now()` before and after full `complete()` call | Simpler fallback for non-streaming benchmark |
| Estimated tokens/sec | `(output_token_count / elapsed_ms) * 1000` | Throughput proxy |
| Quality score | Structured scoring prompt (see below) | Capability proxy |

### Standard Benchmark Prompt

Use a short, deterministic prompt that tests instruction-following and JSON output — a capability needed by RiskMind's risk enrichment and triage tasks:

```
You are a risk analyst. Respond ONLY with valid JSON.
Assess this risk: "Vendor XYZ lacks SOC 2 certification."
Return: { "severity": "high|medium|low", "category": "vendor|compliance|operational", "summary": "one sentence" }
```

**Quality scoring:** After calling the model, parse the JSON. Award:
- 3 pts: Valid JSON with all three required keys and valid enum values
- 2 pts: Valid JSON but missing a key or invalid enum
- 1 pt: Text response with some structure
- 0 pts: Error or completely unstructured output

This avoids needing an external evaluator LLM. Scoring is deterministic and fast.

### Benchmark Implementation

No new packages needed. Use the existing `testConnection()` function pattern from `llm-service.ts` as the base, extend it for benchmark:

```typescript
// New function signature — extend llm-service.ts
export async function benchmarkConfig(
  configId: string,
  tenantId: string
): Promise<BenchmarkResult>

interface BenchmarkResult {
  success: boolean;
  latencyMs: number;        // full round-trip
  ttftMs: number | null;    // time to first token (streaming only)
  tokensPerSec: number | null;
  qualityScore: number;     // 0–3
  error?: string;
}
```

Run via streaming (`streamComplete`) to capture TTFT. Count output tokens by character estimate (÷ 4) if the provider does not return usage data.

### Benchmark Storage

Do NOT store benchmark results in the database permanently (over-engineering). Store them transiently:

- Return results inline to the wizard UI via the existing `/api/settings/llm-configs/:id/test` endpoint (extend this endpoint, or add `/benchmark` sibling)
- Optionally cache last benchmark result in the `llm_configs` row itself with two new nullable columns: `lastBenchmarkAt` (timestamp) and `lastBenchmarkResult` (jsonb)

---

## Routing Table Design

### New Database Table

Add `llm_routing_rules` to store per-tenant per-task model assignments:

```sql
CREATE TABLE llm_routing_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  task_type   TEXT NOT NULL,   -- 'risk_enrichment' | 'signal_triage' | 'treatment_suggestions' | 'embeddings' | 'agent_reasoning' | 'general'
  config_id   UUID REFERENCES llm_configs(id) ON DELETE SET NULL,
  model       TEXT,            -- override model within the config (optional)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, task_type)
);
```

### Task Types (Enum)

```typescript
type TaskType =
  | "risk_enrichment"       // AI enrichment badges, description enhancement
  | "signal_triage"         // Signal severity classification (fast, cheap)
  | "treatment_suggestions" // Risk treatment generation (quality matters)
  | "embeddings"            // Vector embeddings (openai_compat only)
  | "agent_reasoning"       // Autonomous risk agent (best reasoning model)
  | "general"               // Fallback / catch-all
```

### `resolveConfig()` Extension

Extend the existing `resolveConfig(tenantId, useCase)` signature to accept `taskType`:

```typescript
// Extended signature
async function resolveConfig(
  tenantId: string,
  taskType: TaskType = "general"
): Promise<ResolvedConfig | null>
```

Resolution priority:
1. Check `llm_routing_rules` for `(tenantId, taskType)` — use that `config_id`
2. If no rule, fall back to current logic: `isDefault = true` for `useCase = "general"` (or `"embeddings"`)
3. If still nothing, pick any active config

This is backward-compatible — all existing callers that pass `"general"` or `"embeddings"` continue to work.

### Smart Defaults from Benchmark

After benchmarking, suggest routing assignments based on observed metrics:

| Task Type | Suggestion Logic |
|-----------|-----------------|
| `signal_triage` | Fastest model (lowest `latencyMs`) |
| `agent_reasoning` | Highest `qualityScore`, then lowest latency as tiebreak |
| `risk_enrichment` | Highest `qualityScore` |
| `treatment_suggestions` | Highest `qualityScore` |
| `embeddings` | Only offer `openai_compat` configs; prefer models with `embedding` in name |
| `general` | Balanced (quality ≥ 2, latency ≤ 3000ms) |

Suggestions are presented in the wizard UI — user can accept or override before saving.

---

## Schema Additions Summary

Two Drizzle migrations needed:

**Migration 1: `llm_configs` additions**

```typescript
// Add to llm-configs.ts schema
displayProvider: text("display_provider"),           // "Groq", "Google Gemini", etc.
lastBenchmarkAt: timestamp("last_benchmark_at"),
lastBenchmarkResult: jsonb("last_benchmark_result"),
```

**Migration 2: New `llm_routing_rules` table**

```typescript
// New file: lib/db/src/schema/llm-routing-rules.ts
export const llmTaskTypeEnum = pgEnum("llm_task_type", [
  "risk_enrichment",
  "signal_triage",
  "treatment_suggestions",
  "embeddings",
  "agent_reasoning",
  "general",
]);

export const llmRoutingRulesTable = pgTable("llm_routing_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  taskType: llmTaskTypeEnum("task_type").notNull(),
  configId: uuid("config_id").references(() => llmConfigsTable.id, { onDelete: "set null" }),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("llm_routing_rules_tenant_task_idx").on(t.tenantId, t.taskType)]);
```

---

## New API Endpoints

Add to the existing `routes/settings.ts`:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/settings/llm-configs/discover-models` | Accept `{providerType, baseUrl, apiKey}`, return model list — used in wizard step 3 |
| `POST` | `/api/settings/llm-configs/:id/benchmark` | Run benchmark on saved config, return `BenchmarkResult` |
| `GET` | `/api/settings/llm-routing` | Return current routing table for tenant |
| `PUT` | `/api/settings/llm-routing` | Save full routing table (bulk upsert) |

The `discover-models` endpoint takes raw credentials (never persisted in this call) and proxies the provider's model list. This avoids CORS issues — the frontend cannot call provider APIs directly due to CORS policies on most providers.

---

## Frontend Additions

No new frontend libraries required. Implement the wizard using:

| Existing Tool | New Usage |
|--------------|-----------|
| `@radix-ui/react-dialog` | Already installed — use for wizard modal |
| React state (`useState`) | Step tracking (steps 1–6) |
| `@tanstack/react-query` | Already installed — `useMutation` for discover-models, benchmark, save |
| `recharts` | Already installed — optional sparkline for benchmark latency result |
| `react-hook-form` | Already installed — form validation for API key and base URL inputs |
| shadcn/ui Select | Provider dropdown (step 1) |
| shadcn/ui Combobox / multi-select | Model picker (step 4) |

The routing table UI (step 6 / Settings page) is a plain table with Select dropdowns per task type — fully covered by existing shadcn/ui components.

---

## Installation

```bash
# No new packages required.
# Run migrations after schema changes:
cd /home/dante/RiskMind2 && pnpm drizzle-kit generate && pnpm drizzle-kit migrate
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Reuse `openai` SDK for all OpenAI-compat providers | Add `@mistralai/mistralai`, `groq-sdk`, `@google/generative-ai` SDKs | Each SDK is 50–200 kB; OpenAI SDK already handles all these via `baseURL`. No capability gap justifies the extra deps. |
| Native `fetch` for Ollama `/api/tags` | Use OpenAI SDK with Ollama's `/v1/models` compat endpoint | `/api/tags` returns richer metadata (size, family, quantization) useful for display. Worth the 5-line fetch call. |
| `llm_routing_rules` table | Add routing columns to `llm_configs` | Routing is a separate concern — one config can be assigned to multiple task types, and the routing table is tenant-level, not config-level. Separate table is cleaner. |
| Deterministic JSON quality score | LLM-as-judge scoring | LLM-as-judge requires a second API call and costs money. Deterministic scoring is instant and good enough for comparing models in a wizard. |
| Inline benchmark results (transient) | Full benchmark history table | Over-engineering for v1.1. A `lastBenchmarkResult` jsonb column on `llm_configs` is sufficient. History dashboard deferred to v2. |
| Keep `useCase` enum as-is, add `llm_routing_rules` | Expand `useCase` enum with 6 task types | The existing `useCase` enum (`general`, `embeddings`) is fine as a coarse fallback. Fine-grained routing belongs in a separate table with its own task type enum, not the configs table. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `langchain`, `llamaindex`, `ai` (Vercel AI SDK) | Heavy abstraction layers over APIs we already call directly. LangChain in particular adds 10+ transitive deps and its own patterns that conflict with the existing service layer. | Direct SDK calls (`openai`, `@anthropic-ai/sdk`) + `fetch` |
| `@google/generative-ai` (Google AI SDK) | Gemini is fully OpenAI-compatible at `generativelanguage.googleapis.com/v1beta/openai/`. No separate SDK needed. | OpenAI SDK with Gemini base URL |
| `groq-sdk` | Groq is fully OpenAI-compatible at `api.groq.com/openai/v1`. No separate SDK needed. | OpenAI SDK with Groq base URL |
| Separate benchmark microservice / queue | Benchmark is a short interactive operation (< 5 seconds) triggered by the user during wizard setup. It does not need a job queue. | Inline HTTP call from the wizard, await result synchronously |
| Redis for routing cache | Routing rules change rarely (only when user saves wizard). DB lookup is fast (indexed). Cache adds operational complexity. | Postgres query on every request (fast with index on `tenant_id, task_type`) |
| `node-fetch` or `axios` | Node 20 has `fetch` built-in. | `globalThis.fetch` |
| LLM observability / token cost tracking | Explicitly out of scope for v1.1 per PROJECT.md | Deferred to v2 LLM observability dashboard |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `openai` | ^6.29.0 | Node.js 20, all OpenAI-compat providers | `client.models.list()` returns `AsyncPage<Model>` — iterate with `for await` or `.data` array |
| `@anthropic-ai/sdk` | ^0.78.0 | Node.js 20 | `anthropic.models.list()` added in recent versions — confirmed available in 0.78.x |
| Drizzle ORM | catalog | PostgreSQL 16 | `jsonb` column type available via `import { jsonb } from "drizzle-orm/pg-core"` |
| Zod | catalog (v4) | TypeScript 5.9 | Use `z.enum()` for task type validation |

---

## Sources

- Anthropic API docs — `platform.claude.com/docs/en/api/models/list` — confirmed `/v1/models` endpoint, response format with `id`, `display_name`, `has_more` (HIGH confidence)
- OpenAI API docs — `platform.openai.com/docs/api-reference/models/list` — confirmed `GET /v1/models`, Bearer auth (HIGH confidence)
- Google Gemini OpenAI compat docs — `ai.google.dev/gemini-api/docs/openai` — confirmed base URL `generativelanguage.googleapis.com/v1beta/openai/`, OpenAI SDK compatibility (HIGH confidence)
- Groq API docs — `console.groq.com/docs/api-reference` — confirmed `https://api.groq.com/openai/v1/models` endpoint (HIGH confidence)
- Mistral API docs — `docs.mistral.ai/api/endpoint/models` — confirmed `GET https://api.mistral.ai/v1/models`, Bearer auth (HIGH confidence)
- Together AI docs — `docs.together.ai/reference/models-1` — confirmed `GET https://api.together.xyz/v1/models` (HIGH confidence)
- Ollama API docs — `docs.ollama.com/api/tags` — confirmed `GET /api/tags`, response `models[]` array (HIGH confidence)
- Codebase inspection — `artifacts/api-server/src/lib/llm-service.ts`, `lib/db/src/schema/llm-configs.ts`, `artifacts/api-server/package.json` — existing SDK versions and patterns (HIGH confidence)

---
*Stack research for: RiskMind v1.1 — LLM provider wizard, model auto-discovery, benchmarking, intelligent routing*
*Researched: 2026-03-18*
