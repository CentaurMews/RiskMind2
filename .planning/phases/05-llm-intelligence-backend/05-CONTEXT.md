# Phase 5: LLM Intelligence Backend - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the LLM routing system server-side: new schema tables (llm_task_routing, llm_benchmark_results), extend llm-service.ts with model discovery + benchmarking + per-task routing, create API endpoints for discovery/benchmark/routing CRUD, wire taskType through all AI callers, and fix the agent findings persistence bug (FIX-02). This phase is backend-only — the wizard frontend is Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Provider Catalog
- Rich card display: provider name + icon/logo + capabilities tags (chat, embeddings, vision) + pricing tier indicator (free/paid)
- 7 providers: OpenAI, Anthropic, Google Gemini, Mistral, Groq, Together AI, Ollama/Private
- Provider metadata stored as a static constant (not in DB) — includes display name, logo URL, base URL template, capabilities, model list endpoint pattern
- Google Gemini uses OpenAI-compatible endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/` — provider type remains `openai_compat`
- Groq, Mistral, Together AI all use `openai_compat` with their respective base URLs
- Add `display_provider` text column to `llm_configs` to store human-readable provider name (separate from `provider_type` enum)

### Model Discovery
- Server-side only — API keys never leave Express
- `POST /v1/settings/llm-providers/:id/discover` endpoint
- OpenAI-compat: `GET /v1/models` via existing OpenAI SDK with custom baseURL
- Anthropic: use `anthropic.models.list()` if available in SDK ^0.78.x, fallback to hardcoded `ANTHROPIC_MODELS` constant
- Ollama: `fetch("${baseUrl}/api/tags")` — 5-line native fetch
- Models grouped by capability: Chat, Embedding, Code — with model ID, context window where available, and "recommended for" tags
- Filter out deprecated/internal models (OpenAI returns many irrelevant models)

### Benchmark
- `POST /v1/settings/llm-providers/:id/benchmark` endpoint
- Deterministic: structured JSON prompt at temperature 0, max 50 tokens
- Measure: TTFT (via streaming first token), total latency, quality (JSON parseability 0-3 score)
- Run 3 calls, report median of calls 2-3 (skip cold start)
- Results stored in `llm_benchmark_results` table with timestamp
- Comparison table display: side-by-side models with TTFT, latency, quality, cost tier, "Recommended" badge on best-for-task

### Routing Table
- New `llm_task_routing` table: `(tenant_id, task_type, config_id, model_override)` with unique index on `(tenant_id, task_type)`
- 6 task types as text values (not enum): `enrichment`, `triage`, `treatment`, `embeddings`, `agent`, `general`
- `resolveConfig()` extended with optional `taskType` parameter — checks routing table first, falls back to tenant default
- Visual grid in Settings: 6 task type rows × assigned model column, click to change, "Auto-suggested" badge when using benchmark recommendation
- Smart defaults: after benchmarks, system suggests cheapest fast model for triage, best reasoning for enrichment/agent, embedding model for embeddings
- CRUD endpoints: `GET/PUT /v1/settings/routing` (read/update full table), `DELETE /v1/settings/routing/:taskType` (reset to default)

### Agent Findings Fix (FIX-02)
- Restructure `runAgentCycle()`: persist local findings (cascade, cluster, predictive) BEFORE calling LLM `reason()`
- If `reason()` throws, run still completes with local findings — status reflects actual findings count, not "skipped"
- LLM-generated cross-domain findings are additive (added after local findings if LLM succeeds)

### Schema Decisions
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### LLM Service (extend)
- `artifacts/api-server/src/lib/llm-service.ts` — Current `resolveConfig(tenantId, useCase)`, `complete()`, `streamComplete()`, `generateEmbedding()`, `testConnection()`, `isAvailable()`
- `artifacts/api-server/src/lib/encryption.ts` — `encrypt()`, `safeDecrypt()` for API keys

### Schema (modify/create)
- `lib/db/src/schema/llm-configs.ts` — Current `llm_configs` table, `llmProviderTypeEnum` (openai_compat, anthropic), `llmUseCaseEnum` (general, embeddings)
- `lib/db/drizzle.config.ts` — Drizzle-kit config for push

### Settings Routes (extend)
- `artifacts/api-server/src/routes/settings.ts` — Current LLM provider CRUD, test connection, SSRF validation

### AI Callers (wire taskType)
- `artifacts/api-server/src/lib/ai-workers.ts` — 3 call sites: ai-enrich, ai-triage, doc-process
- `artifacts/api-server/src/lib/agent-service.ts` — 1 call site: reason() + the FIX-02 restructuring
- `artifacts/api-server/src/routes/interviews.ts` — 2 call sites: interview start, interview message

### Research
- `.planning/research/ARCHITECTURE.md` — Detailed integration architecture, schema design, build order
- `.planning/research/STACK.md` — Provider API endpoints for model discovery
- `.planning/research/PITFALLS.md` — Agent findings bug details, enum migration trap

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- OpenAI SDK client creation in `llm-service.ts` — reuse for all openai_compat providers with custom baseURL
- `testConnection()` — foundation for benchmark (extend with TTFT measurement)
- `safeDecrypt()` — already handles key decryption for all providers
- Drizzle schema patterns from existing tables — follow for new tables

### Established Patterns
- Per-tenant scoping via `tenantId` on all tables
- `resolveConfig()` with fallback chain (default → any active)
- `LLMUnavailableError` for graceful 422 responses
- Settings routes with `admin` role guard

### Integration Points
- `resolveConfig()` — add optional `taskType` parameter, check routing table first
- `settings.ts` — add `/discover`, `/benchmark`, `/routing` endpoints
- All 6 AI callers — add `taskType` string to `complete()`/`streamComplete()` calls
- `agent-service.ts` `runAgentCycle()` — restructure to persist findings before LLM call

</code_context>

<specifics>
## Specific Ideas

- Provider catalog should feel premium — think of how Vercel shows integrations
- Model discovery should filter out noise (OpenAI returns 100+ models, most irrelevant)
- Benchmark comparison table should make it obvious which model to pick for each task
- Routing grid should be one of the most visually impressive parts of Settings

</specifics>

<deferred>
## Deferred Ideas

- Automatic model failover on provider errors — v2 (easy to misconfigure)
- Cost tracking per LLM operation — v2 (LLM observability dashboard)
- Provider health monitoring — v2

</deferred>

---

*Phase: 05-llm-intelligence-backend*
*Context gathered: 2026-03-18*
