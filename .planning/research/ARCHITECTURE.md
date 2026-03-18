# Architecture Research

**Domain:** LLM Intelligence Layer — model auto-discovery, benchmarking, and per-task routing integrated into existing RiskMind ERM app
**Researched:** 2026-03-18
**Confidence:** HIGH (derived from direct codebase inspection)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings Page (React)                                           │
│  ┌─────────────────────┐   ┌──────────────────────────────────┐ │
│  │  LLM Config Wizard  │   │  Model Routing Table             │ │
│  │  (6-step flow)      │   │  (6 task types → model picker)   │ │
│  └──────────┬──────────┘   └──────────────┬───────────────────┘ │
└─────────────┼────────────────────────────┼──────────────────────┘
              │ POST /v1/settings/llm-*     │ PUT /v1/settings/llm-routing
              ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express API — routes/settings.ts (extended)                     │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────┐  │
│  │ POST /discover   │  │ POST /benchmark   │  │ GET /routing │  │
│  │ (proxy to vendor)│  │ (runs test prompt)│  │ PUT /routing │  │
│  └──────────────────┘  └───────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
              │                            │
              ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  lib/llm-service.ts (modified)                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  resolveConfig(tenantId, taskType)  ← extended           │    │
│  │  1. Check llm_task_routing for taskType override         │    │
│  │  2. Fall back to llm_configs (isDefault, useCase)        │    │
│  │  3. Return ResolvedConfig with model + credentials       │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  complete() / streamComplete() / generateEmbedding()    │    │
│  │  All call resolveConfig(tenantId, taskType)              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL                                                      │
│  ┌──────────────────┐  ┌─────────────────────────────────────┐  │
│  │  llm_configs     │  │  llm_task_routing (NEW)             │  │
│  │  (existing)      │  │  tenant_id, task_type, config_id    │  │
│  │  - id, tenant_id │  │  model_override (nullable)          │  │
│  │  - provider_type │  └─────────────────────────────────────┘  │
│  │  - model         │  ┌─────────────────────────────────────┐  │
│  │  - encrypted_key │  │  llm_benchmark_results (NEW)        │  │
│  │  - use_case      │  │  config_id, latency_ms              │  │
│  │  - is_default    │  │  tokens_per_sec, quality_score      │  │
│  └──────────────────┘  │  benchmark_model (for multi-model)  │  │
│                        └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries (v1.1 additions)

| Component | Location | Responsibility | New in v1.1 |
|-----------|----------|---------------|-------------|
| `llm-service.ts` | `artifacts/api-server/src/lib/` | Config resolution, provider clients, completion/stream/embeddings | Extend `resolveConfig()` to accept `taskType`; add `discoverModels()`, `runBenchmark()` |
| `routes/settings.ts` | `artifacts/api-server/src/routes/` | CRUD for LLM configs, test endpoint | Add `/discover`, `/benchmark`, `/routing` endpoints |
| `ai-workers.ts` | `artifacts/api-server/src/lib/` | Job-based AI enrichment (triage, enrich, doc-process) | Thread `taskType` into each `callLLM()` call |
| `agent-service.ts` | `artifacts/api-server/src/lib/` | Autonomous agent reasoning loop | Thread `agent_reasoning` taskType |
| `interviews.ts` | `artifacts/api-server/src/routes/` | Streaming AI interview sessions | Thread `interviews` taskType |
| `llm-task-routing` table | `lib/db/src/schema/` | Maps task types to config overrides per tenant | New table |
| `llm-benchmark-results` table | `lib/db/src/schema/` | Stores benchmark latency/quality per config+model | New table |
| `settings.tsx` | `artifacts/riskmind-app/src/pages/settings/` | Settings UI with provider list and routing table | Add wizard, routing table, benchmark display |

---

## Schema Changes

### New Table: `llm_task_routing`

```sql
CREATE TABLE llm_task_routing (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  task_type   TEXT NOT NULL,
  -- One of: risk_enrichment, signal_triage, treatment_suggestions,
  --         embeddings, agent_reasoning, interviews, general
  config_id   UUID REFERENCES llm_configs(id) ON DELETE SET NULL,
  -- NULL = use system default (falls through to existing resolveConfig logic)
  model_override TEXT,
  -- Overrides the model on the linked config without changing the config itself.
  -- Useful when one provider serves multiple models.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, task_type)
);
```

**Rationale:** One row per (tenant, task_type). A NULL `config_id` row means "use default" — this lets the UI show the current effective model without requiring an override to exist.

### New Table: `llm_benchmark_results`

```sql
CREATE TABLE llm_benchmark_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     UUID NOT NULL REFERENCES llm_configs(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  model         TEXT NOT NULL,
  -- The model used (may differ from config.model if testing a discovered model)
  latency_ms    INTEGER NOT NULL,
  tokens_per_sec NUMERIC(10, 2),
  quality_score  NUMERIC(3, 2),
  -- 0.0-1.0 derived from benchmark prompt evaluation
  benchmark_prompt TEXT,
  raw_response  TEXT,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON llm_benchmark_results (config_id, ran_at DESC);
CREATE INDEX ON llm_benchmark_results (tenant_id, ran_at DESC);
```

**Rationale:** Stores benchmark history. The UI shows the most recent result per (config, model). The routing wizard uses quality_score + latency_ms to suggest default assignments.

### Modified: `llm_use_case` enum

The existing `llm_use_case` enum in `llm_configs` currently has `general` and `embeddings`. The scope calls for 6 task types in routing, but the routing assignment lives in `llm_task_routing`, not `llm_configs`. The `llm_configs` table does not need to change — the task routing table references it by `config_id`.

The settings form already shows use-case values (`enrichment`, `triage`, `interviews`, `agent`) in its dropdown but these are NOT persisted to the DB today (the enum only accepts `general` | `embeddings`). Either:
1. Expand the enum to the 6 task types, OR
2. Keep `llm_configs.use_case` for high-level categorization and let `llm_task_routing` handle fine-grained routing

**Recommendation:** Option 2. Keep `llm_configs.use_case` as `general | embeddings` (the existing behavior). Fine-grained per-task routing is entirely handled by the new `llm_task_routing` table. This minimizes DB migration risk.

---

## `llm-service.ts` Modifications

### 1. Extend Task Types

```typescript
// Add to existing types
export type LLMTaskType =
  | "risk_enrichment"
  | "signal_triage"
  | "treatment_suggestions"
  | "embeddings"
  | "agent_reasoning"
  | "interviews"
  | "general";
```

### 2. Extend `resolveConfig()` Signature

Current signature:
```typescript
async function resolveConfig(
  tenantId: string,
  useCase: "general" | "embeddings" = "general"
): Promise<ResolvedConfig | null>
```

New signature:
```typescript
async function resolveConfig(
  tenantId: string,
  taskType: LLMTaskType = "general"
): Promise<ResolvedConfig | null>
```

**Resolution order (inside `resolveConfig`):**
1. Query `llm_task_routing` for (tenantId, taskType) — if row exists with non-null `config_id`, use that config + optional `model_override`
2. If no task routing row, fall back to existing logic: query `llm_configs` for `isDefault=true` on `useCase="general"` (or `"embeddings"` for embeddings task)
3. If no default, pick any active config (existing fallback logic)

This is backward-compatible — all existing callers pass no taskType and get "general" resolution unchanged.

### 3. New `discoverModels()` Export

```typescript
export async function discoverModels(
  configId: string,
  tenantId: string
): Promise<{ models: string[]; error?: string }>
```

Called from the wizard step 3. Fetches live model lists from provider APIs:
- `openai_compat` with no baseUrl: `GET https://api.openai.com/v1/models`
- `openai_compat` with Ollama baseUrl: `GET {baseUrl}/api/tags`
- `openai_compat` with other baseUrl: `GET {baseUrl}/models`
- `anthropic`: returns hardcoded list (Anthropic has no public list endpoint)

### 4. New `runBenchmark()` Export

```typescript
export async function runBenchmark(
  configId: string,
  tenantId: string,
  model: string
): Promise<{
  latencyMs: number;
  tokensPerSec: number | null;
  qualityScore: number;
  rawResponse: string;
}>
```

Uses a fixed benchmark prompt (e.g., "Identify the top 3 risk factors in a typical SaaS vendor relationship. Respond in JSON: [{risk, severity, mitigation}]"). Evaluates quality by checking response is valid JSON with expected fields. Persists result to `llm_benchmark_results`.

---

## New API Endpoints

All under `routes/settings.ts`, requiring `admin` role.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/settings/llm-providers/:id/discover` | Trigger model discovery for a saved config |
| `POST` | `/v1/settings/llm-providers/:id/benchmark` | Run benchmark for a specific model on a config |
| `GET` | `/v1/settings/llm-routing` | Get current routing table for tenant |
| `PUT` | `/v1/settings/llm-routing` | Update routing assignments (body: array of task→config mappings) |
| `GET` | `/v1/settings/llm-benchmarks` | Get latest benchmark results for all configs |
| `GET` | `/v1/settings/embeddings-health` | Check if embeddings provider is configured (addresses bug #6) |

The `/discover` endpoint proxies the request server-side (avoids CORS from browser, hides raw API keys).

---

## Wizard UI Flow (Settings Page)

The wizard replaces the current "Add Provider" sheet with a multi-step flow when no providers exist, or is accessible via "Add with Wizard" button alongside the existing sheet.

```
Step 1 — Provider Identity
  - Display Name (text input)
  - Provider Preset dropdown:
    OpenAI | Anthropic | Google Gemini | Mistral | Groq |
    Together AI | Ollama/Private
  - Provider preset auto-fills: providerType + baseUrl hint

Step 2 — Credentials
  - API Key (password input)
  - Base URL (shown only for openai_compat; pre-filled from preset)
  - "Continue" triggers POST /v1/settings/llm-providers to save a
    temporary config (isDefault=false, model="pending")

Step 3 — Discover Models
  - Auto-triggers POST /v1/settings/llm-providers/:id/discover
  - Shows loading spinner → model list with checkboxes
  - For Anthropic: shows hardcoded curated list
  - User selects which models to use

Step 4 — Benchmark (optional, skippable)
  - For each selected model: POST /v1/settings/llm-providers/:id/benchmark
  - Shows latency bar + quality score
  - Skippable ("Skip for now" link)

Step 5 — Routing Assignment
  - Table: 6 task types → model picker (dropdown)
  - Smart defaults suggested based on benchmarks:
    - Fast + cheap tasks (signal_triage): lowest latency model
    - Quality tasks (risk_enrichment, agent_reasoning): highest quality model
    - Embeddings: only shows openai_compat models
  - PUT /v1/settings/llm-routing to save

Step 6 — Confirmation
  - Summary card showing assignments
  - "Go to Settings" or "Add another provider"
```

**State management:** Wizard state lives in local React state (not persisted mid-wizard). Partial completion leaves a config saved in step 2 — the existing provider list handles cleanup.

---

## Routing Table UI (Settings LLM Tab)

Alongside the existing provider list card, add a second card:

```
┌─────────────────────────────────────────────────────┐
│  Model Routing                            [Edit]     │
├─────────────────────────────────────────────────────┤
│  Task Type          │  Assigned Model               │
├─────────────────────┼───────────────────────────────┤
│  Risk Enrichment    │  gpt-4o  (GPT-4o Production)  │
│  Signal Triage      │  gpt-4o-mini  (same config)   │
│  Treatment Suggest  │  claude-3-5-sonnet (Claude)   │
│  Embeddings         │  text-embedding-3-small        │
│  Agent Reasoning    │  gpt-4o                        │
│  Interviews         │  gpt-4o  (default)            │
└─────────────────────────────────────────────────────┘
```

Editing opens an inline form or sheet with dropdown pickers per task type. No wizard required for editing.

---

## Callers of `llm-service.ts` — Update Map

Every caller of `complete()` and `streamComplete()` needs to pass a `taskType`. Current callers:

| File | Current call | Required change |
|------|-------------|-----------------|
| `lib/ai-workers.ts` — `ai-triage` worker | `complete(tenantId, ...)` | `complete(tenantId, ..., "signal_triage")` |
| `lib/ai-workers.ts` — `ai-enrich` worker | `complete(tenantId, ...)` | `complete(tenantId, ..., "risk_enrichment")` |
| `lib/ai-workers.ts` — `doc-process` worker | `complete(tenantId, ...)` | `complete(tenantId, ..., "risk_enrichment")` (document analysis is enrichment-class) |
| `lib/agent-service.ts` — `reason()` | `complete(tenantId, ...)` | `complete(tenantId, ..., "agent_reasoning")` |
| `routes/interviews.ts` — interview turn | `complete()` / `streamComplete()` | `complete(tenantId, ..., "interviews")` |
| `routes/interviews.ts` — treatment suggestions | `complete(tenantId, ...)` | `complete(tenantId, ..., "treatment_suggestions")` |

**Backward compatibility:** `complete()` public signature gains an optional third parameter `taskType?: LLMTaskType`. Defaults to `"general"`. All existing callers continue to work without change; updating them is an enhancement, not a requirement for correctness.

---

## Data Flow: Wizard → Routing Resolution

### Wizard Save Flow

```
User completes wizard Step 5 (routing assignment)
    │
    ▼
PUT /v1/settings/llm-routing
  body: [
    { taskType: "risk_enrichment", configId: "uuid-A", modelOverride: "gpt-4o" },
    { taskType: "signal_triage", configId: "uuid-A", modelOverride: "gpt-4o-mini" },
    ...
  ]
    │
    ▼
settings.ts route handler
    │
    ▼ UPSERT into llm_task_routing
    (INSERT ON CONFLICT (tenant_id, task_type) DO UPDATE SET ...)
    │
    ▼
200 OK — routing saved
```

### AI Task Resolution Flow (after routing configured)

```
ai-workers.ts: "ai-enrich" job fires
    │
    ▼
complete(tenantId, messages, "risk_enrichment")
    │
    ▼
resolveConfig(tenantId, "risk_enrichment")
    │
    ├── Query llm_task_routing WHERE tenant_id=X AND task_type="risk_enrichment"
    │         Found: config_id = "uuid-A", model_override = "gpt-4o"
    │
    ▼
ResolvedConfig { providerType: "openai_compat", model: "gpt-4o", ... }
    │
    ▼
buildOpenAIClient(config) → chat.completions.create(model: "gpt-4o")
    │
    ▼
enriched response → DB update
```

### AI Task Resolution Flow (no routing configured — backward compat)

```
complete(tenantId, messages, "general")  ← existing callers unchanged
    │
    ▼
resolveConfig(tenantId, "general")
    │
    ├── Query llm_task_routing: no row found (table empty for this tenant)
    │
    ├── Fall back: query llm_configs WHERE isDefault=true AND useCase="general"
    │
    ▼
Existing behavior: pick default general config
```

---

## Architectural Patterns

### Pattern 1: Task-Type Router with Config Indirection

**What:** A separate routing table (`llm_task_routing`) maps task types to config IDs rather than embedding task type into `llm_configs`. The routing table is a pivot — it can be empty (fall through to default) or fully populated.

**When to use:** When the same physical provider config (one set of credentials) should serve multiple task types with different models. Avoids creating duplicate config rows per task type.

**Trade-offs:** Slightly more complex resolution logic in `resolveConfig()`; requires JOIN or two queries (routing lookup + config fetch). Acceptable given low query volume.

```typescript
// Resolution logic sketch
async function resolveConfig(tenantId: string, taskType: LLMTaskType): Promise<ResolvedConfig | null> {
  // Step 1: Check task-specific routing
  const [routing] = await db.select().from(llmTaskRoutingTable)
    .where(and(
      eq(llmTaskRoutingTable.tenantId, tenantId),
      eq(llmTaskRoutingTable.taskType, taskType)
    )).limit(1);

  if (routing?.configId) {
    const [config] = await db.select().from(llmConfigsTable)
      .where(and(eq(llmConfigsTable.id, routing.configId), eq(llmConfigsTable.isActive, true)))
      .limit(1);
    if (config) {
      return {
        providerType: config.providerType,
        baseUrl: config.baseUrl,
        apiKey: safeDecrypt(config.encryptedApiKey),
        model: routing.modelOverride || config.model,
      };
    }
  }

  // Step 2: Fall back to existing default resolution
  const useCase = taskType === "embeddings" ? "embeddings" : "general";
  return resolveConfigByUseCase(tenantId, useCase);
}
```

### Pattern 2: Server-Side Model Discovery Proxy

**What:** Model discovery calls (e.g., `GET /v1/models` on OpenAI) are made server-side from the Express route handler, not from the browser. The browser calls `/v1/settings/llm-providers/:id/discover`.

**When to use:** Always for this feature. API keys are stored encrypted in DB; they must never leave the server. CORS would also block direct browser-to-provider calls for many providers.

**Trade-offs:** Discovery adds latency on the API server's outbound network. Acceptable — this is an admin-only setup flow, not a hot path.

### Pattern 3: Hardcoded Anthropic Model Catalog

**What:** Anthropic has no `/models` list endpoint. The server returns a hardcoded list of known models filtered by `createdAt` date plausibility.

**When to use:** Anthropic provider type only.

**Known current models (as of March 2026):**
```typescript
const ANTHROPIC_MODELS = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
  "claude-3-haiku-20240307",
];
```

This list should live in `llm-service.ts` as a constant, not in the route handler, so it can be updated in one place.

### Pattern 4: Benchmark via Fixed Probe Prompt

**What:** A standardized benchmark prompt tests both connectivity and output quality. Quality score = 1.0 if response parses as valid JSON matching expected schema, 0.5 if text response with keywords, 0.0 if error/timeout.

**When to use:** Wizard step 4 and the `/benchmark` endpoint.

```typescript
const BENCHMARK_PROMPT = `Identify the top 3 risk factors in a typical SaaS vendor relationship.
Respond ONLY with valid JSON array: [{"risk": "string", "severity": "high|medium|low", "mitigation": "string"}]`;

function scoreQuality(response: string): number {
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].risk && parsed[0].severity) return 1.0;
    return 0.5;
  } catch {
    return response.toLowerCase().includes("risk") ? 0.3 : 0.0;
  }
}
```

---

## Build Order for v1.1 Features

Dependencies flow in this order:

```
1. DB Schema (new tables)
   lib/db/src/schema/llm-task-routing.ts   (new)
   lib/db/src/schema/llm-benchmark-results.ts  (new)
   lib/db/src/schema/index.ts              (export new tables)
   → pnpm --filter @workspace/db run push  (apply to DB)

2. API Spec update
   lib/api-spec/openapi.yaml
   → Add: POST /llm-providers/:id/discover
   → Add: POST /llm-providers/:id/benchmark
   → Add: GET/PUT /llm-routing
   → Add: GET /llm-benchmarks
   → Add: GET /embeddings-health
   → Expand LlmUseCase enum if needed
   → pnpm run codegen  (regenerates lib/api-zod + lib/api-client-react)

3. Backend — llm-service.ts modifications
   - Add LLMTaskType type
   - Extend resolveConfig() for task routing
   - Add discoverModels()
   - Add runBenchmark()
   - Export new functions

4. Backend — settings.ts route additions
   - /discover endpoint (calls discoverModels())
   - /benchmark endpoint (calls runBenchmark(), saves result)
   - GET/PUT /llm-routing endpoints

5. Backend — wire taskType into callers
   - ai-workers.ts: thread taskType into each callLLM()
   - agent-service.ts: thread "agent_reasoning"
   - interviews.ts: thread "interviews" / "treatment_suggestions"

6. Frontend — settings.tsx changes
   - Add wizard multi-step flow (replaces/augments the sheet)
   - Add routing table card
   - Add benchmark display
   - Add embeddings health warning banner
   (uses Orval-generated hooks from step 2)
```

**Critical dependency:** Steps 1-2 must complete before step 6 can compile (Orval hooks depend on spec). Steps 3-5 are backend-only and can be built + tested before the frontend in step 6.

---

## Anti-Patterns

### Anti-Pattern 1: Adding Task Types to `llm_configs.use_case`

**What people do:** Expand the `llm_use_case` enum in `llm_configs` to include all 6 task types, then create one config row per task type.

**Why it's wrong:** Forces N config rows for a single provider (one per task type), each with duplicate API key/baseUrl. When the API key rotates, you update N rows. It also doesn't handle the "same config, different model" case (e.g., using gpt-4o for enrichment and gpt-4o-mini for triage on the same OpenAI key).

**Do this instead:** Keep `llm_configs` as provider-level credentials. Use the `llm_task_routing` table to map task types to (config, model) pairs.

### Anti-Pattern 2: Model Discovery from the Browser

**What people do:** Have the React frontend call `api.openai.com/v1/models` directly with the API key passed through a query parameter or Authorization header.

**Why it's wrong:** Exposes API keys in browser network tab. Breaks for providers that set restrictive CORS headers (Anthropic blocks browser requests). Violates the security model where keys never leave the server.

**Do this instead:** Route all provider API calls through the Express server via `/v1/settings/llm-providers/:id/discover`.

### Anti-Pattern 3: Storing Benchmark Results in `llm_configs`

**What people do:** Add `latency_ms`, `quality_score` columns directly to `llm_configs`.

**Why it's wrong:** A single config may be benchmarked multiple times across multiple models. Storing only the latest result loses history. Benchmarks should be a time-series of observations, not a single value on the config.

**Do this instead:** Separate `llm_benchmark_results` table with `ran_at` timestamp. The UI always shows the most recent result but the full history is available.

### Anti-Pattern 4: Blocking the Wizard on Benchmark Completion

**What people do:** Make benchmark a required step before saving routing.

**Why it's wrong:** Benchmarks add latency and may fail for valid providers (rate limits, cold starts). Forcing users through benchmarks to configure their first provider creates friction and abandonment.

**Do this instead:** Make benchmarks optional (skippable). Routing suggestions based on benchmarks only appear if benchmark data exists. The wizard completes without benchmark data.

### Anti-Pattern 5: Separate `resolveConfig` paths for old vs. new callers

**What people do:** Create `resolveConfigForTask()` as a new function alongside the existing `resolveConfig()`, duplicating the provider client construction logic.

**Why it's wrong:** Two functions diverge over time. Bug fixes in one don't apply to the other. Provider additions require changes in both places.

**Do this instead:** Single `resolveConfig(tenantId, taskType)` function with the task routing check added at the top. The existing `useCase` logic becomes the fallback within the same function.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI `/v1/models` | Outbound GET from Express, using config's `apiKey` as `Authorization: Bearer` | Paginates; return all model IDs, filter to chat-capable |
| Ollama `/api/tags` | Outbound GET from Express, no auth header | Returns `{models: [{name, ...}]}`; extract `.name` |
| Anthropic (no list endpoint) | Return hardcoded constant `ANTHROPIC_MODELS` | Update list when new models release |
| Other openai_compat | `GET {baseUrl}/models` with bearer token | Same format as OpenAI; may 404 (handle gracefully) |

### Internal Workspace Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `settings.ts` ↔ `llm-service.ts` | Direct import: `discoverModels()`, `runBenchmark()`, `testConnection()` | All three live in llm-service |
| `ai-workers.ts` ↔ `llm-service.ts` | Direct import: `complete(tenantId, opts, taskType)` | taskType becomes optional param, defaults to "general" |
| `agent-service.ts` ↔ `llm-service.ts` | Direct import: `complete(tenantId, opts, taskType)` | Pass `"agent_reasoning"` |
| `interviews.ts` ↔ `llm-service.ts` | Direct import: `complete()`, `streamComplete()` | Pass `"interviews"` or `"treatment_suggestions"` |
| Frontend ↔ new API endpoints | Orval-generated hooks (after codegen) | Must update API spec before running codegen |
| `llm-task-routing` table ↔ `llm_configs` | Foreign key: `config_id → llm_configs.id ON DELETE SET NULL` | Deleting a config NULLs routing rows, causing fallback to default |

---

## Scaling Considerations

| Scale | Architecture | Notes |
|-------|-------------|-------|
| Current (1-20 users, 1 tenant) | Single DB lookup in resolveConfig adds ~1-2ms per AI call | Negligible; no caching needed |
| Multi-tenant growth (10+ tenants) | Add in-memory LRU cache on routing table (TTL 60s) | Routing changes infrequently; cache invalidation on PUT /llm-routing |
| High AI job volume | Routing resolution is pure DB read — no contention | Bottleneck remains LLM API latency, not routing lookup |

---

## Sources

- Direct inspection of `artifacts/api-server/src/lib/llm-service.ts`
- Direct inspection of `artifacts/api-server/src/routes/settings.ts`
- Direct inspection of `artifacts/api-server/src/lib/ai-workers.ts`
- Direct inspection of `artifacts/api-server/src/lib/agent-service.ts`
- Direct inspection of `artifacts/api-server/src/routes/interviews.ts`
- Direct inspection of `lib/db/src/schema/llm-configs.ts`
- Direct inspection of `lib/api-zod/src/generated/types/llmUseCase.ts`
- Direct inspection of `artifacts/riskmind-app/src/pages/settings/settings.tsx`
- `.planning/PROJECT.md` and `.planning/v1.1-scope.md`

---

*Architecture research for: RiskMind v1.1 — LLM model routing, auto-discovery, and benchmarking integration*
*Researched: 2026-03-18*
