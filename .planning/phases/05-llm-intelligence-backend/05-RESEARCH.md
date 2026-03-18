# Phase 5: LLM Intelligence Backend - Research

**Researched:** 2026-03-18
**Domain:** LLM service extension, schema migrations, API endpoints, agent service restructuring
**Confidence:** HIGH (all findings code-verified by direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Provider Catalog**
- Rich card display: provider name + icon/logo + capabilities tags (chat, embeddings, vision) + pricing tier indicator (free/paid)
- 7 providers: OpenAI, Anthropic, Google Gemini, Mistral, Groq, Together AI, Ollama/Private
- Provider metadata stored as a static constant (not in DB) — includes display name, logo URL, base URL template, capabilities, model list endpoint pattern
- Google Gemini uses OpenAI-compatible endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/` — provider type remains `openai_compat`
- Groq, Mistral, Together AI all use `openai_compat` with their respective base URLs
- Add `display_provider` text column to `llm_configs` to store human-readable provider name (separate from `provider_type` enum)

**Model Discovery**
- Server-side only — API keys never leave Express
- `POST /v1/settings/llm-providers/:id/discover` endpoint
- OpenAI-compat: `GET /v1/models` via existing OpenAI SDK with custom baseURL
- Anthropic: use `anthropic.models.list()` if available in SDK ^0.78.x, fallback to hardcoded `ANTHROPIC_MODELS` constant
- Ollama: `fetch("${baseUrl}/api/tags")` — 5-line native fetch
- Models grouped by capability: Chat, Embedding, Code — with model ID, context window where available, and "recommended for" tags
- Filter out deprecated/internal models (OpenAI returns many irrelevant models)

**Benchmark**
- `POST /v1/settings/llm-providers/:id/benchmark` endpoint
- Deterministic: structured JSON prompt at temperature 0, max 50 tokens
- Measure: TTFT (via streaming first token), total latency, quality (JSON parseability 0-3 score)
- Run 3 calls, report median of calls 2-3 (skip cold start)
- Results stored in `llm_benchmark_results` table with timestamp
- Comparison table display: side-by-side models with TTFT, latency, quality, cost tier, "Recommended" badge on best-for-task

**Routing Table**
- New `llm_task_routing` table: `(tenant_id, task_type, config_id, model_override)` with unique index on `(tenant_id, task_type)`
- 6 task types as text values (not enum): `enrichment`, `triage`, `treatment`, `embeddings`, `agent`, `general`
- `resolveConfig()` extended with optional `taskType` parameter — checks routing table first, falls back to tenant default
- Visual grid in Settings: 6 task type rows × assigned model column, click to change, "Auto-suggested" badge when using benchmark recommendation
- Smart defaults: after benchmarks, system suggests cheapest fast model for triage, best reasoning for enrichment/agent, embedding model for embeddings
- CRUD endpoints: `GET/PUT /v1/settings/routing` (read/update full table), `DELETE /v1/settings/routing/:taskType` (reset to default)

**Agent Findings Fix (FIX-02)**
- Restructure `runAgentCycle()`: persist local findings (cascade, cluster, predictive) BEFORE calling LLM `reason()`
- If `reason()` throws, run still completes with local findings — status reflects actual findings count, not "skipped"
- LLM-generated cross-domain findings are additive (added after local findings if LLM succeeds)

**Schema Decisions**
- `llm_task_routing` table: `id uuid PK, tenant_id FK, task_type text NOT NULL, config_id FK to llm_configs, model_override text, created_at, updated_at` — unique on `(tenant_id, task_type)`
- `llm_benchmark_results` table: `id uuid PK, config_id FK to llm_configs, model text, ttft_ms int, total_latency_ms int, quality_score int (0-3), tokens_per_second numeric, created_at`
- Add `display_provider text` column to existing `llm_configs` table
- Use drizzle-kit push for schema changes (consistent with v1.0 approach)
- NO enum changes — task_type is text, provider display is text

### Claude's Discretion
- Exact provider metadata constant structure (icons, capabilities, URLs)
- Model filtering logic per provider (which models to show vs hide)
- Benchmark prompt exact content
- TTFT measurement implementation (streaming first token timing)
- Quality score heuristic details
- Routing suggestion algorithm (how to pick "best" per task type)
- Error handling for provider API failures during discovery
- Thread-safe routing resolution caching (if needed)

### Deferred Ideas (OUT OF SCOPE)
- Automatic model failover on provider errors — v2 (easy to misconfigure)
- Cost tracking per LLM operation — v2 (LLM observability dashboard)
- Provider health monitoring — v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LLM-01 | Admin can add a new LLM provider by selecting from a dropdown (7 providers) | Provider metadata constant + `POST /v1/settings/llm-providers` (already exists) + new `display_provider` column |
| LLM-02 | Admin enters API key (and base URL for private providers) and system validates the connection | `testConnection()` already exists in `llm-service.ts`; extend settings POST route to call it before saving |
| LLM-03 | System auto-discovers available models from the provider API | New `discoverModels()` in `llm-service.ts` + `POST /v1/settings/llm-providers/:id/discover` endpoint |
| LLM-04 | Admin can select one or more models from the discovered list and save the configuration | Settings PATCH/PUT route already exists; wizard UI passes selected model to existing save |
| LLM-05 | Admin can test connection and run a benchmark (TTFT, total latency, quality heuristic) against any configured model | New `runBenchmark()` in `llm-service.ts` + `POST /v1/settings/llm-providers/:id/benchmark` + new `llm_benchmark_results` table |
| LLM-06 | System suggests optimal model assignment per task type based on benchmark results | Suggestion logic in routing endpoint reading from `llm_benchmark_results`; smart defaults per task type |
| ROUTE-01 | Routing table maps 6 task types to specific model configurations | New `llm_task_routing` table + schema migration via drizzle-kit push |
| ROUTE-02 | Admin can view and override the routing table in Settings | `GET /v1/settings/llm-routing` + `PUT /v1/settings/llm-routing` + `DELETE /v1/settings/routing/:taskType` endpoints |
| ROUTE-03 | Each AI operation uses its routed model (not just the tenant default) | Extend `resolveConfig()` with `taskType` param + wire `taskType` through all 6 callers |
| ROUTE-04 | Routing falls back to tenant default when no task-specific assignment exists | `resolveConfig()` fallback chain: routing row → `isDefault` query → any active config |
| FIX-02 | Autonomous agent persists local findings before LLM reasoning call — findings survive LLM errors | Restructure `runAgentCycle()`: call `act()` with localFindings before `reason()`, then call `act()` again with llmFindings if reason() succeeds |
</phase_requirements>

---

## Summary

Phase 5 extends the existing LLM service layer with three new capabilities: model auto-discovery, benchmarking, and per-task routing. All work is backend-only — frontend wizard is Phase 6. The codebase already has the core infrastructure (`llm-service.ts` with client builders, `settings.ts` with CRUD routes, `agent-service.ts` with the broken detection flow), so this phase is extension work rather than greenfield.

The most consequential decision is the `resolveConfig()` refactor. The current function signature is `resolveConfig(tenantId, useCase)` where `useCase` is the `llm_use_case` enum (`"general" | "embeddings"`). The extension changes the second parameter to `taskType: string` defaulting to `"general"`, adds a routing table lookup at the top of the function, and preserves all existing fallback logic. All 6 callers currently pass no second argument (defaulting to `"general"`) and will continue to work unchanged after the refactor. Threading explicit `taskType` strings through the callers is the enhancement, not a prerequisite.

FIX-02 has a concrete code location: `runAgentCycle()` lines 798-844 in `agent-service.ts`. The bug is that the `catch` block for `reason()` returns early with `status: "skipped"` before `act()` is ever called, discarding all local findings. The fix requires calling `act(tenantId, run.id, localFindings, policyTier)` before entering the `reason()` try/catch, then calling `act()` again with `llmFindings` if `reason()` succeeds.

**Primary recommendation:** Build in this order: (1) schema push, (2) OpenAPI spec additions + codegen, (3) `llm-service.ts` extensions, (4) `settings.ts` route additions, (5) caller wiring + FIX-02. Each step is independently testable before the next.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | ^6.29.0 | Model discovery for OpenAI + all openai_compat providers | Single SDK handles OpenAI, Google Gemini, Groq, Mistral, Together AI via `baseURL` override |
| `@anthropic-ai/sdk` | ^0.78.0 | Anthropic model discovery + completions | `anthropic.models.list()` confirmed available in 0.78.0 (direct SDK inspection); returns paginated `ModelInfo[]` |
| `drizzle-orm` | catalog | New tables: `llm_task_routing`, `llm_benchmark_results` | Already in use; all schema in Drizzle conventions |
| `drizzle-kit` | ^0.31.9 | Schema push to DB | `pnpm --filter @workspace/db run push` is the established command |
| Node.js built-in `fetch` | Node 20 | Ollama `/api/tags` discovery | 5-line fetch, no new dependency needed |

**Installation:**
```bash
# No new packages. Schema push command:
pnpm --filter @workspace/db run push
# OpenAPI codegen command:
pnpm --filter @workspace/api-spec run codegen
```

**Codegen output locations:**
- React Query hooks: `lib/api-client-react/src/generated/`
- Zod schemas: `lib/api-zod/src/generated/`
- Config file: `lib/api-spec/orval.config.ts` (mode: split, client: react-query)

---

## Architecture Patterns

### Recommended File Structure

New files to create:
```
lib/db/src/schema/
├── llm-task-routing.ts      (new table)
└── llm-benchmark-results.ts (new table)

artifacts/api-server/src/lib/
└── llm-service.ts           (extend — add discoverModels, runBenchmark, extend resolveConfig)

artifacts/api-server/src/routes/
└── settings.ts              (extend — add /discover, /benchmark, /routing endpoints)
```

Files to modify (not new):
```
lib/db/src/schema/
└── llm-configs.ts           (add display_provider column)
lib/db/src/schema/
└── index.ts                 (export new tables)
lib/api-spec/
└── openapi.yaml             (add 6 new endpoint stubs + 4 new component schemas)
```

### Pattern 1: Extend `resolveConfig()` with Routing Table Lookup

**What:** Add routing table as the first lookup in the resolution chain. Backward-compatible: all existing callers continue to work with no changes.

**When to use:** Always — this is the central change that enables ROUTE-01 through ROUTE-04.

**Current signature (exact from `llm-service.ts` line 41):**
```typescript
async function resolveConfig(
  tenantId: string,
  useCase: "general" | "embeddings" = "general"
): Promise<ResolvedConfig | null>
```

**New signature:**
```typescript
export type LLMTaskType =
  | "enrichment"
  | "triage"
  | "treatment"
  | "embeddings"
  | "agent"
  | "general";

async function resolveConfig(
  tenantId: string,
  taskType: LLMTaskType = "general"
): Promise<ResolvedConfig | null> {
  // Step 1: Task-specific routing lookup (NEW)
  const [routing] = await db.select().from(llmTaskRoutingTable)
    .where(and(
      eq(llmTaskRoutingTable.tenantId, tenantId),
      eq(llmTaskRoutingTable.taskType, taskType)
    )).limit(1);

  if (routing?.configId) {
    const [config] = await db.select().from(llmConfigsTable)
      .where(and(
        eq(llmConfigsTable.id, routing.configId),
        eq(llmConfigsTable.isActive, true)
      )).limit(1);
    if (config) {
      return {
        providerType: config.providerType,
        baseUrl: config.baseUrl,
        apiKey: safeDecrypt(config.encryptedApiKey),
        model: routing.modelOverride || config.model,
      };
    }
  }

  // Step 2: Existing fallback logic (UNCHANGED)
  const useCase = taskType === "embeddings" ? "embeddings" : "general";
  // ... rest of existing resolveConfig body
}
```

**Important:** `complete()`, `streamComplete()`, and `generateEmbedding()` all call `resolveConfig()` internally. Adding `taskType` as an optional parameter to these public functions threads routing through to the resolution.

### Pattern 2: `discoverModels()` — Provider Branching

**What:** Server-side proxy for model listing. Each provider requires a different approach.

```typescript
export async function discoverModels(
  configId: string,
  tenantId: string
): Promise<{ models: DiscoveredModel[]; error?: string }> {
  const config = await resolveConfigById(configId, tenantId);
  if (!config) return { models: [], error: "Configuration not found" };

  // Branch on provider type + baseUrl
  const isOllama = config.baseUrl?.includes("11434") ||
                   config.baseUrl?.includes("localhost");

  if (config.providerType === "anthropic") {
    // Use SDK models.list() with hardcoded fallback
    return discoverAnthropicModels(config);
  }

  if (isOllama) {
    // Native fetch to /api/tags
    return discoverOllamaModels(config.baseUrl!);
  }

  // OpenAI + all openai_compat providers
  return discoverOpenAICompatModels(config);
}
```

**Provider-specific details:**

| Provider | Method | Filter |
|----------|--------|--------|
| OpenAI | `client.models.list()` | Keep only IDs starting with `gpt-`, `o1`, `o3`, `text-embedding-` |
| Anthropic | `client.models.list()` with ANTHROPIC_MODELS fallback | All returned models are production-valid |
| Google Gemini | `client.models.list()` (openai_compat mode) | Filter to `gemini-*` IDs |
| Groq | `client.models.list()` via OpenAI SDK | `type === "chat"` filter |
| Mistral | `client.models.list()` via OpenAI SDK | All returned models |
| Together AI | `client.models.list()` via OpenAI SDK | Filter `type: "chat"` or `"language"` |
| Ollama | `fetch(${baseUrl}/api/tags)` | Separate by `details.family` for embedding vs chat |

**Anthropic SDK confirmed:** `anthropic.models.list()` exists in SDK 0.78.0 (verified by inspecting `/node_modules/@anthropic-ai/sdk/src/resources/models.ts`). Returns `PagePromise<ModelInfosPage, ModelInfo>` with `id` and `display_name` fields. Still maintain `ANTHROPIC_MODELS` constant as fallback in case of API error.

### Pattern 3: `runBenchmark()` — 3-call TTFT Measurement

**What:** Run 3 calls, skip call 1 (cold start), return median of calls 2-3 for TTFT + latency + quality.

**TTFT measurement using streaming:**
```typescript
// TTFT via streaming
async function measureTTFT(config: ResolvedConfig, model: string): Promise<number> {
  const startMs = Date.now();
  let ttft = 0;

  for await (const chunk of streamCompleteWithConfig(config, BENCHMARK_OPTS)) {
    if (chunk.type === "text" && !ttft) {
      ttft = Date.now() - startMs;
      break; // Only need first token time
    }
  }
  return ttft;
}
```

**Quality score (0-3, deterministic):**
```typescript
const BENCHMARK_PROMPT = `You are a risk analyst. Respond ONLY with valid JSON.
Assess this risk: "Vendor XYZ lacks SOC 2 certification."
Return: {"severity":"high|medium|low","category":"vendor|compliance|operational","summary":"one sentence"}`;

function scoreQuality(response: string): number {
  try {
    const parsed = JSON.parse(response);
    const hasAllKeys = parsed.severity && parsed.category && parsed.summary;
    const validSeverity = ["high","medium","low"].includes(parsed.severity);
    const validCategory = ["vendor","compliance","operational"].includes(parsed.category);
    if (hasAllKeys && validSeverity && validCategory) return 3;
    if (hasAllKeys) return 2;
    return 1;
  } catch {
    return response.toLowerCase().includes("risk") ? 1 : 0;
  }
}
```

**Median calculation:** Sort 2 values (calls 2 and 3), take middle. With exactly 2 values, use `Math.round((v1 + v2) / 2)`.

### Pattern 4: FIX-02 — `runAgentCycle()` Restructure

**Current broken flow (agent-service.ts lines 793-844):**
```
localFindings = [...cascade, ...cluster, ...predictive]
llmFindings = await reason(...)   ← if this throws:
  catch: status = "skipped", return   ← act() NEVER called, localFindings LOST
allFindings = [...local, ...llm]
act(allFindings)                  ← never reached on LLM error
```

**Fixed flow:**
```typescript
// Always persist local findings first
const localSavedCount = await act(tenantId, run.id, localFindings, policyTier);

// Then attempt LLM reasoning (additive)
let llmFindings: Finding[] = [];
let llmSucceeded = false;
if (available) {
  try {
    llmFindings = await reason(tenantId, data, localFindings);
    llmSucceeded = true;
  } catch (err) {
    console.error("[Agent] LLM reasoning failed, local findings already persisted:", err);
    // Do NOT return early — run completes with local findings
  }
}

if (llmSucceeded && llmFindings.length > 0) {
  const llmSavedCount = await act(tenantId, run.id, llmFindings, policyTier);
}

// Mark completed (not skipped) — local findings are real findings
await db.update(agentRunsTable).set({
  status: "completed",
  findingCount: localSavedCount + (llmSucceeded ? llmFindings.length : 0),
  // ...
})
```

**Key rule:** The `status: "skipped"` path should ONLY be used when `available === false` (no LLM provider configured at all) AND when there are zero local findings. If local findings exist, the run is `"completed"` regardless of LLM availability.

### Pattern 5: OpenAPI Spec + Codegen Flow

**New paths to add to `openapi.yaml`:**
```yaml
/v1/settings/llm-providers/{id}/discover:
  post:
    operationId: discoverLlmModels
    tags: [settings]

/v1/settings/llm-providers/{id}/benchmark:
  post:
    operationId: benchmarkLlmProvider
    tags: [settings]

/v1/settings/llm-routing:
  get:
    operationId: getLlmRouting
    tags: [settings]
  put:
    operationId: updateLlmRouting
    tags: [settings]

/v1/settings/llm-routing/{taskType}:
  delete:
    operationId: deleteLlmRoutingEntry
    tags: [settings]
```

**New component schemas to add:**
- `LlmDiscoverResult` — `{ models: LlmDiscoveredModel[] }`
- `LlmDiscoveredModel` — `{ id: string, displayName?: string, capability: string[] }`
- `LlmBenchmarkResult` — `{ latencyMs: number, ttftMs: number, qualityScore: number, tokensPerSec?: number }`
- `LlmRoutingEntry` — `{ taskType: string, configId?: string, modelOverride?: string, effectiveModel?: string }`
- `LlmRoutingTable` — `{ entries: LlmRoutingEntry[] }`

**Also modify `LlmProvider` schema** to include `displayProvider?: string` new field.

**Codegen command:**
```bash
pnpm --filter @workspace/api-spec run codegen
```
This regenerates `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/`.

### Anti-Patterns to Avoid

- **Extending `llm_use_case` enum:** PostgreSQL rejects `ALTER TYPE ADD VALUE` in a transaction (Drizzle wraps migrations in transactions). Use text column for `task_type` in the routing table. The `llm_use_case` enum stays as `general | embeddings` only.
- **Separate `resolveConfigForTask()` function:** Duplicates client-builder logic. One `resolveConfig()` function with routing check at the top. Existing callers keep working unchanged.
- **Benchmarking in a background job queue:** Benchmark is a wizard-blocking UI operation (user waits). Run synchronously in the HTTP handler, return results inline.
- **Returning `status: "skipped"` when local findings exist:** The skipped status means "nothing happened." If localFindings > 0, the run has value — mark it `"completed"`.
- **Calling `discoverModels()` with raw API key from request body:** Always load credentials from the DB via `resolveConfigById()`. Never accept raw API keys in discovery/benchmark request bodies.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI-compat model listing for Groq/Mistral/Together | Custom HTTP client per provider | `new OpenAI({ baseURL: providerUrl }).models.list()` | The OpenAI Node SDK handles all OpenAI-compatible providers with a `baseURL` override |
| Anthropic client construction | New client factory | `buildAnthropicClient(config)` already in `llm-service.ts` line 104 | Already handles key + options; reuse |
| Streaming first-token timing | External library | `Date.now()` before call + capture on first `"text"` chunk from `streamComplete()` | Streaming already implemented; TTFT is 2 lines |
| Config decryption | New decrypt logic | `safeDecrypt()` already in `llm-service.ts` line 31 | Already handles null, errors gracefully |
| Routing upsert | Manual INSERT + UPDATE | Drizzle `insert().onConflictDoUpdate()` with `(tenantId, taskType)` as conflict target | One-line Drizzle query |
| OpenAPI spec validation | Custom validator | Orval codegen fails loudly if spec is malformed | Codegen is the validator |

---

## Common Pitfalls

### Pitfall 1: Task Type Name Mismatch Between Routing Table and Callers

**What goes wrong:** CONTEXT.md locks 6 task type values: `enrichment, triage, treatment, embeddings, agent, general`. ARCHITECTURE.md uses longer names: `risk_enrichment, signal_triage, treatment_suggestions, agent_reasoning`. If the routing table stores `"enrichment"` but callers pass `"risk_enrichment"`, no routing row is ever found and all calls silently fall back to the default config.

**How to avoid:** The `LLMTaskType` TypeScript type is the single source of truth. Define it once in `llm-service.ts`:
```typescript
export type LLMTaskType = "enrichment" | "triage" | "treatment" | "embeddings" | "agent" | "general";
```
All callers import this type. The routing table uses the same string values. No magic strings in any caller file.

**Canonical mapping:**
| Caller | Task Type String |
|--------|----------------|
| `ai-workers.ts` ai-triage worker | `"triage"` |
| `ai-workers.ts` ai-enrich worker | `"enrichment"` |
| `ai-workers.ts` doc-process worker | `"enrichment"` |
| `agent-service.ts` reason() | `"agent"` |
| `interviews.ts` interview start/message | `"general"` (interviews not in routing table) |
| `interviews.ts` suggest-treatments | `"treatment"` |
| `interviews.ts` score-suggestions | `"enrichment"` |
| `interviews.ts` gap-remediation | `"enrichment"` |

### Pitfall 2: Cold-Start Inflating Benchmark TTFT

**What goes wrong:** First call to a freshly configured provider is 2-5x slower than subsequent calls (connection pooling, model loading on provider side). Reporting call 1 makes all providers look slow and makes relative comparisons meaningless.

**How to avoid:** Run 3 calls. Discard call 1. Report median of calls 2-3. This is a locked decision in CONTEXT.md. Implementation: collect `[call2Result, call3Result]`, sort numerically, take `Math.round((r[0] + r[1]) / 2)`.

### Pitfall 3: Benchmark Request Body Accepting Raw API Keys

**What goes wrong:** If the benchmark endpoint accepts `{ apiKey, model }` in the request body instead of just `{ configId, model }`, API keys appear in browser network traffic.

**How to avoid:** `POST /v1/settings/llm-providers/:id/benchmark` takes only `{ model?: string }` in the body (model override for testing a specific discovered model). Credentials are always loaded from DB via `resolveConfigById(configId, tenantId)`. The `:id` comes from the URL path, `tenantId` from `req.user!.tenantId`.

### Pitfall 4: FIX-02 Run Status After Local-Only Completion

**What goes wrong:** After fixing the agent, if `reason()` fails, the run ends with `findingCount = localFindings.length` but status might still be set to `"skipped"` if the existing `isAvailable` early-return path is not also updated.

**How to avoid:** The `isAvailable` check should only skip if both:
1. LLM is not available AND
2. Local findings count is 0

If local findings were found AND LLM is unavailable, still mark the run as `"completed"` with the local findings count. The `"skipped"` status means "nothing happened at all" — not "LLM was unavailable."

### Pitfall 5: OpenAPI Spec Update Before Codegen

**What goes wrong:** Adding routes to `settings.ts` before updating `openapi.yaml` causes the frontend to have no generated hooks for the new endpoints. Phase 6 (wizard frontend) depends on these hooks existing.

**How to avoid:** Step 2 in the build order is always: update `openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`. This is backend-only work that must complete before Phase 6 can begin. Include codegen as a task within this phase even though the frontend work is deferred.

### Pitfall 6: Anthropic SDK `models.list()` Pagination

**What goes wrong:** `anthropic.models.list()` returns a paginated `PagePromise`. Calling `.data` directly only returns the first page (typically 20 items). With only a handful of Claude models, this is not currently an issue, but the pattern should be correct.

**How to avoid:**
```typescript
const page = await anthropicClient.models.list({ limit: 100 });
// page.data is ModelInfo[] — sufficient for all current Claude models
// If pagination needed: use page.has_more + page.getNextPage()
```
For the hardcoded fallback, always maintain `ANTHROPIC_MODELS` constant in `llm-service.ts` regardless of whether the SDK call succeeds.

---

## Code Examples

### Schema: `llm_task_routing` Table (Drizzle)

```typescript
// lib/db/src/schema/llm-task-routing.ts
import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { llmConfigsTable } from "./llm-configs";

export const llmTaskRoutingTable = pgTable("llm_task_routing", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  taskType: text("task_type").notNull(),
  configId: uuid("config_id").references(() => llmConfigsTable.id, { onDelete: "set null" }),
  modelOverride: text("model_override"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("llm_task_routing_tenant_task_idx").on(t.tenantId, t.taskType),
]);
```

### Schema: `llm_benchmark_results` Table (Drizzle)

```typescript
// lib/db/src/schema/llm-benchmark-results.ts
import { pgTable, uuid, text, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { llmConfigsTable } from "./llm-configs";

export const llmBenchmarkResultsTable = pgTable("llm_benchmark_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  configId: uuid("config_id").notNull().references(() => llmConfigsTable.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  model: text("model").notNull(),
  ttftMs: integer("ttft_ms"),
  totalLatencyMs: integer("total_latency_ms").notNull(),
  qualityScore: integer("quality_score").notNull(),  // 0-3
  tokensPerSecond: numeric("tokens_per_second", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("llm_benchmark_config_idx").on(t.configId, t.createdAt),
  index("llm_benchmark_tenant_idx").on(t.tenantId, t.createdAt),
]);
```

### Schema: Add `display_provider` to `llm_configs`

```typescript
// In lib/db/src/schema/llm-configs.ts — add one field to existing llmConfigsTable:
displayProvider: text("display_provider"),
// e.g. "OpenAI", "Anthropic", "Google Gemini", "Groq", "Mistral", "Together AI", "Ollama"
```

### Ollama Discovery (5-line fetch)

```typescript
// Source: Ollama API docs + STACK.md
async function discoverOllamaModels(baseUrl: string): Promise<{ models: DiscoveredModel[] }> {
  const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return { models: [] };
  const data = await res.json() as { models: Array<{ name: string; details?: { family?: string } }> };
  return {
    models: data.models.map(m => ({
      id: m.name,
      capability: m.details?.family?.toLowerCase().includes("bert") ? ["embeddings"] : ["chat"],
    })),
  };
}
```

### Routing Upsert (Drizzle onConflictDoUpdate)

```typescript
// In settings.ts route handler for PUT /v1/settings/llm-routing
await db.insert(llmTaskRoutingTable).values({
  tenantId,
  taskType: entry.taskType,
  configId: entry.configId || null,
  modelOverride: entry.modelOverride || null,
  updatedAt: new Date(),
}).onConflictDoUpdate({
  target: [llmTaskRoutingTable.tenantId, llmTaskRoutingTable.taskType],
  set: {
    configId: sql`excluded.config_id`,
    modelOverride: sql`excluded.model_override`,
    updatedAt: sql`excluded.updated_at`,
  },
});
```

### Caller Wiring Pattern (ai-workers.ts)

Current `callLLM` wrapper in `ai-workers.ts`:
```typescript
// Current (line 23-25)
async function callLLM(tenantId: string, messages: ...): Promise<string> {
  return complete(tenantId, { messages, temperature: 0.3, maxTokens: 1024 });
}
```

After wiring `taskType`:
```typescript
async function callLLM(
  tenantId: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  taskType: LLMTaskType = "general"
): Promise<string> {
  return complete(tenantId, { messages, temperature: 0.3, maxTokens: 1024 }, taskType);
}
// Then each worker passes its taskType:
// ai-triage: callLLM(tenantId, messages, "triage")
// ai-enrich: callLLM(tenantId, messages, "enrichment")
// doc-process: callLLM(tenantId, messages, "enrichment")
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `resolveConfig(tenantId, useCase)` with `"general" | "embeddings"` | `resolveConfig(tenantId, taskType)` with routing table first | Phase 5 | All 6 callers get task-specific model routing |
| `runAgentCycle()` discards local findings on LLM error | Persist local findings before `reason()` call | Phase 5 (FIX-02) | Agent runs always produce findings; `"skipped"` status eliminated when local findings exist |
| No model discovery (user types model name manually) | Server-side `discoverModels()` proxies provider API | Phase 5 | Eliminates "Haiku" model name bug; wizard Step 3 shows real model list |
| `llm_configs` table only (no routing) | `llm_task_routing` pivot table | Phase 5 | One config can serve multiple task types at different models |

**Deprecated/outdated within this phase:**
- `useCase` parameter on `resolveConfig()` — replaced by `taskType`. The `useCase` column on `llm_configs` table remains but is not used in routing resolution (it's only used for the embeddings fallback within the new logic).

---

## Open Questions

1. **`interviews` task type not in CONTEXT.md routing table**
   - What we know: CONTEXT.md lists 6 task types: `enrichment, triage, treatment, embeddings, agent, general`. ARCHITECTURE.md lists `interviews` as a 7th type.
   - What's unclear: Should interview callers pass `"general"` (routes to default) or `"treatment"` (shares treatment model)?
   - Recommendation: Map both interview callers to `"general"` — the interviews feature is a user-facing flow where latency matters less than quality, and the default general config is appropriate. This keeps the routing table at exactly 6 rows.

2. **Benchmark body parameter for model override**
   - What we know: CONTEXT.md says benchmark tests "a specific model on a config" — implying the wizard may test models from the discovery list that differ from the config's saved `model` field.
   - What's unclear: Does `POST /v1/settings/llm-providers/:id/benchmark` accept `{ model: string }` in the body to override the config's model for testing?
   - Recommendation: Yes — accept optional `{ model?: string }` in the request body. If provided, use that model for the benchmark run (store it as `model` in the `llm_benchmark_results` row). If not provided, use `config.model`.

3. **`DELETE /v1/settings/routing/:taskType` vs `DELETE /v1/settings/llm-routing/:taskType`**
   - What we know: CONTEXT.md specifies `DELETE /v1/settings/routing/:taskType` but all existing endpoints use the prefix `/v1/settings/llm-*`.
   - Recommendation: Use `DELETE /v1/settings/llm-routing/:taskType` for path consistency with other settings endpoints.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test files, no jest/vitest config in repo |
| Config file | Wave 0 gap — needs creation |
| Quick run command | `pnpm --filter @workspace/api-server exec vitest run --reporter=dot` |
| Full suite command | `pnpm --filter @workspace/api-server exec vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LLM-03 | `discoverModels()` returns model list for openai_compat provider | unit | `vitest run src/lib/llm-service.test.ts -t "discoverModels"` | Wave 0 gap |
| LLM-03 | `discoverModels()` returns hardcoded list for anthropic provider | unit | `vitest run src/lib/llm-service.test.ts -t "anthropic fallback"` | Wave 0 gap |
| LLM-05 | `runBenchmark()` runs 3 calls and returns median of calls 2-3 | unit | `vitest run src/lib/llm-service.test.ts -t "benchmark median"` | Wave 0 gap |
| LLM-06 | Benchmark suggestion returns fastest model for triage | unit | `vitest run src/lib/llm-service.test.ts -t "routing suggestion"` | Wave 0 gap |
| ROUTE-03 | `resolveConfig()` checks routing table before tenant default | unit | `vitest run src/lib/llm-service.test.ts -t "resolveConfig routing"` | Wave 0 gap |
| ROUTE-04 | `resolveConfig()` falls back to isDefault when no routing row | unit | `vitest run src/lib/llm-service.test.ts -t "resolveConfig fallback"` | Wave 0 gap |
| FIX-02 | `runAgentCycle()` persists local findings even when `reason()` throws | integration | `vitest run src/lib/agent-service.test.ts -t "local findings persist"` | Wave 0 gap |
| FIX-02 | Agent run status is "completed" (not "skipped") when local findings > 0 | integration | `vitest run src/lib/agent-service.test.ts -t "run status"` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `pnpm --filter @workspace/api-server exec vitest run --reporter=dot`
- **Per wave merge:** `pnpm --filter @workspace/api-server exec vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `artifacts/api-server/src/lib/llm-service.test.ts` — covers LLM-03, LLM-05, LLM-06, ROUTE-03, ROUTE-04
- [ ] `artifacts/api-server/src/lib/agent-service.test.ts` — covers FIX-02
- [ ] `artifacts/api-server/vitest.config.ts` — test runner config
- [ ] Framework install: `pnpm --filter @workspace/api-server add -D vitest @vitest/coverage-v8`

---

## Sources

### Primary (HIGH confidence)
- Direct inspection: `artifacts/api-server/src/lib/llm-service.ts` — exact current `resolveConfig()` signature, `complete()`, `streamComplete()`, `generateEmbedding()`, `testConnection()`, `buildOpenAIClient()`, `buildAnthropicClient()`, `safeDecrypt()`
- Direct inspection: `artifacts/api-server/src/lib/agent-service.ts` lines 763-953 — full `runAgentCycle()` with exact bug location (lines 798-844)
- Direct inspection: `artifacts/api-server/src/lib/ai-workers.ts` — `callLLM()` wrapper, all 3 call sites (ai-triage, ai-enrich, doc-process)
- Direct inspection: `artifacts/api-server/src/routes/settings.ts` — existing CRUD endpoints, `validateBaseUrl()` SSRF guard, `sanitizeConfig()` pattern
- Direct inspection: `artifacts/api-server/src/routes/interviews.ts` — 3 call sites: `complete()` at interview start (line 99), `streamComplete()` at message (line 193), `complete()` at suggest-treatments (line 399)
- Direct inspection: `lib/db/src/schema/llm-configs.ts` — exact table definition, enum values (`general | embeddings`), Drizzle column types
- Direct inspection: `lib/db/src/schema/index.ts` — export list (confirms new tables must be added here)
- Direct inspection: `lib/db/drizzle.config.ts` — schema path, push command
- Direct inspection: `lib/db/package.json` — push script: `tsx ./src/bootstrap.ts && drizzle-kit push`
- Direct inspection: `lib/api-spec/openapi.yaml` lines 4725-4803 — `LlmProviderType`, `LlmUseCase`, `LlmProvider`, `CreateLlmProvider`, `UpdateLlmProvider` schemas
- Direct inspection: `lib/api-spec/orval.config.ts` — codegen output locations, client type (react-query), mode (split)
- Direct inspection: `node_modules/.pnpm/@anthropic-ai+sdk@0.78.0.../sdk/src/resources/models.ts` — `Models.list()` confirmed present, returns `PagePromise<ModelInfosPage, ModelInfo>`
- Direct inspection: `.planning/research/STACK.md` — provider API endpoints, model list patterns per provider
- Direct inspection: `.planning/research/PITFALLS.md` — FIX-02 exact code location, enum migration trap, benchmark cold-start pattern
- Direct inspection: `.planning/research/ARCHITECTURE.md` — full integration architecture, data flow diagrams, anti-pattern catalog

### Secondary (MEDIUM confidence)
- `.planning/phases/05-llm-intelligence-backend/05-CONTEXT.md` — locked decisions for this phase
- `.planning/REQUIREMENTS.md` — requirement IDs and descriptions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified by direct package.json and node_modules inspection
- Architecture: HIGH — all patterns derived from direct code inspection, not assumptions
- Pitfalls: HIGH — FIX-02 bug location code-verified line-by-line; other pitfalls from pre-existing PITFALLS.md research
- Schema: HIGH — Drizzle column types verified against existing schema files

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain, no fast-moving dependencies)

---

*Phase: 05-llm-intelligence-backend*
*Research completed: 2026-03-18*
