# Project Research Summary

**Project:** RiskMind v1.1 — LLM Intelligence Layer
**Domain:** LLM provider auto-discovery, model benchmarking, per-task routing, and targeted bug fixes for an existing ERM (Enterprise Risk Management) SaaS platform
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

RiskMind v1.1 adds an intelligent LLM configuration layer on top of an already-working ERM platform. The core challenge is not building from scratch — it is extending an existing, opinionated system without breaking it. Research confirms that **zero new npm packages are required**: the existing `openai` SDK (^6.29) handles all OpenAI-compatible providers via `baseURL` overrides, `@anthropic-ai/sdk` (^0.78) now exposes a real `/v1/models` endpoint (previously undocumented), and Node 20's built-in `fetch` covers Ollama's native `GET /api/tags` endpoint. The recommended build is a 6-step in-app wizard for provider onboarding, backed by a new `llm_task_routing` database table that decouples routing assignment from credential storage.

The recommended architecture uses a **task-type router with config indirection**: a separate `llm_task_routing` table maps (tenant, task_type) pairs to existing `llm_configs` rows, with an optional per-row model override. This avoids the naive anti-pattern of duplicating credential rows per task type and keeps the existing `resolveConfig()` function as a single authoritative resolution path with a graceful fallback to existing behavior. All 7 callers of `llm-service.ts` (`ai-workers.ts`, `agent-service.ts`, `interviews.ts`) need a `taskType` parameter threaded through — this is backward-compatible since the parameter defaults to `"general"`.

The most critical risks are all code-verified in the existing codebase: agent local findings are silently discarded when the LLM throws (agent-service.ts lines 798–844), AI enrichment stacks duplicate blocks on retry (ai-workers.ts line 141), and a PostgreSQL enum migration trap exists if anyone attempts to extend `llm_use_case` via `ALTER TYPE ADD VALUE` (which Drizzle wraps in a transaction, causing the migration to fail). All three have clear, low-effort resolutions that must be implemented before v1.1 ships. The 7 audit bugs from v1.0 are correctness issues, not polish — they must all ship in v1.1.

## Key Findings

### Recommended Stack

No new dependencies. The v1.1 surface area is entirely covered by existing packages. The `openai` SDK's `baseURL` option makes it the universal client for OpenAI, Gemini (via compatibility layer at `generativelanguage.googleapis.com/v1beta/openai/`), Groq, Mistral, and Together AI. Anthropic's SDK now has `anthropic.models.list()` returning `id`, `display_name`, and `created_at` — though PITFALLS.md and ARCHITECTURE.md take the conservative position of maintaining a hardcoded `ANTHROPIC_MODELS` constant regardless. Two Drizzle migrations are needed for the new `llm_task_routing` and `llm_benchmark_results` tables; both use safe patterns (new tables and nullable columns, never `ALTER TYPE ADD VALUE`).

**Core technologies:**
- `openai` ^6.29.0: universal provider client for all OpenAI-compat providers — `baseURL` overrides eliminate the need for provider-specific SDKs
- `@anthropic-ai/sdk` ^0.78.0: Anthropic-specific client — `models.list()` confirmed available; hardcoded fallback list also maintained
- `drizzle-orm` (catalog): two new tables (`llm_task_routing`, `llm_benchmark_results`) — safe migration patterns documented
- `Node.js fetch` (built-in, Node 20): Ollama `GET /api/tags` model listing — avoids adding `node-fetch` or `axios`
- `zod` (catalog): new schemas for wizard steps, benchmark results, and routing table validation

**Avoid adding:** `langchain`, `llamaindex`, `@google/generative-ai`, `groq-sdk`, Redis (routing lookup is fast with a DB index), any benchmark microservice or job queue.

### Expected Features

**Must have (table stakes — P1, milestone fails without):**
- Provider dropdown (7 named providers) with API key masking and base URL input
- Test connection + auto-fetch available models (wizard Step 3)
- Model selection from fetched list — selection component only, never free-text (prevents the "Haiku" model name bug)
- Save configuration with backend model name validation via `testConnection()` pre-save
- Visual routing table in Settings (6 task types with dropdown per task)
- Backend `resolveConfig()` extended to accept `taskType` and route to the assigned model
- All 7 v1.0 audit bug fixes: doc processor, agent findings persistence, duplicate enrichment, vendor 400→502, vendor scorecard real data, embeddings health warning, model name validation

**Should have (competitive differentiators — P2):**
- Model benchmarking in wizard Step 5: TTFT + total latency + deterministic quality score (valid JSON = 3pts, partial = 2pts, text = 1pt, error = 0pts); skip benchmark cold-start inflation by discarding first call and reporting median of calls 2–3
- Smart routing defaults: post-benchmark, pre-fill routing table (fastest model for `signal_triage`, highest quality for `agent_reasoning` and `risk_enrichment`)
- Foresight teaser page: polished "coming soon" replacing bare stub; previews of Monte Carlo, OSINT, agent feed, what-if builder
- Model display names (map raw IDs to human-readable labels in wizard and routing table)

**Defer (v2+):**
- Token cost tracking and LLM observability dashboard
- Automatic model failover between providers
- API key rotation with re-encryption migration
- LLM-as-judge quality scoring for benchmarks
- Cross-tenant routing defaults (admin-level)

### Architecture Approach

The architecture is an incremental extension of the existing monorepo. The build order has a critical compile-time constraint: **DB schema and OpenAPI spec must be updated before the frontend can compile**, because the frontend uses Orval-generated hooks from the API spec. Backend changes to `llm-service.ts`, new endpoints in `settings.ts`, and taskType threading through callers are all independent of the frontend and should be built and verified first. The wizard UI is a multi-step React state machine using the existing Radix UI Dialog, react-hook-form, and TanStack Query — no new frontend libraries required.

**Major components:**
1. `llm-service.ts` (extended): adds `LLMTaskType`, extends `resolveConfig(tenantId, taskType)` with routing table lookup, exports `discoverModels()` and `runBenchmark()`
2. `routes/settings.ts` (extended): adds `/discover`, `/benchmark`, `GET /llm-routing`, `PUT /llm-routing`, `GET /llm-benchmarks`, `GET /embeddings-health` endpoints
3. `llm_task_routing` table (new): maps (tenant_id, task_type) → (config_id, model_override); NULL config_id = use system default; UNIQUE constraint on (tenant_id, task_type)
4. `llm_benchmark_results` table (new): time-series benchmark observations per (config, model); UI shows most recent result; full history preserved
5. Wizard UI in `settings.tsx` (extended): 6-step flow using existing shadcn/ui components; wizard state in local React state

**Key patterns:**
- Task-type router with config indirection: routing table is a pivot between task types and credential configs; one config row can serve multiple task types with different model overrides
- Server-side model discovery proxy: all provider API calls go through Express (avoids CORS, protects API keys); browser never calls provider APIs directly
- Single `resolveConfig()` function: task routing check at top, existing useCase logic as fallback — no parallel code paths

### Critical Pitfalls

1. **Agent local findings discarded on LLM error** — Fix: persist local findings via `act()` before calling `reason()`; on LLM error, mark run `completed` with local findings count rather than `skipped`. Code location: `agent-service.ts` lines 798–844.

2. **Duplicate enrichment stacking on retry** — Fix: use `split("\n\n---AI Enrichment---")[0]` to strip any existing enrichment block before writing the new one. Makes the write idempotent across any number of retries. Code location: `ai-workers.ts` line 141.

3. **PostgreSQL enum migration trap** — Fix: implement routing via a new `llm_task_routing` table (safe) rather than extending `llm_use_case` enum via `ALTER TYPE ADD VALUE` (which Drizzle wraps in a transaction that PostgreSQL rejects for enum additions). This decision must be locked in before any schema work begins.

4. **Anthropic model listing inconsistency** — FEATURES.md reports Anthropic now has `GET /v1/models`; PITFALLS.md and ARCHITECTURE.md recommend a hardcoded `ANTHROPIC_MODELS` constant. Use the hardcoded list as the implementation; treat the live endpoint as an optional enhancement. This prevents wizard Step 3 failing silently for Anthropic users.

5. **Model name validation gap ("Haiku" bug)** — Fix: wizard Step 4 must use a selection component from the fetched model list, never free-text input. Backend save route must call `testConnection()` as a required pre-save validation and reject configs where the model ID fails provider validation.

## Implications for Roadmap

Based on research, the natural phase structure follows the build order dependency graph: schema and spec first (compile-time dependency), then backend service layer, then API endpoints and caller wiring, then frontend wizard, then bug fixes and polish.

### Phase 1: Schema and API Spec Foundation
**Rationale:** The `llm_task_routing` and `llm_benchmark_results` tables must exist before routing logic can be written. The OpenAPI spec update must happen before Orval regenerates frontend hooks — this is a hard compile-time dependency. This phase has no user-visible output but unblocks everything downstream.
**Delivers:** Two Drizzle migrations applied, `llm_task_type` enum defined, OpenAPI spec updated with 6 new endpoints, Orval codegen re-run, `LLMTaskType` type exported from `llm-service.ts`
**Addresses:** Routing table design (STACK.md), provider type mapping, task type enum definition
**Avoids:** PostgreSQL enum migration trap (PITFALLS.md Pitfall 5) — schema uses new table + nullable text column, never `ALTER TYPE ADD VALUE`

### Phase 2: Backend Service Layer (llm-service.ts)
**Rationale:** `discoverModels()` and `runBenchmark()` are pure service functions with no UI dependency. Extending `resolveConfig()` is the most risk-sensitive change (it affects all AI job flows). Build and test these service functions in isolation before wiring them to API endpoints or the frontend.
**Delivers:** Extended `resolveConfig(tenantId, taskType)` with routing table lookup and fallback chain; `discoverModels()` with per-provider branching (OpenAI-compat vs Anthropic hardcoded vs Ollama native); `runBenchmark()` with deterministic quality scoring; hardcoded `ANTHROPIC_MODELS` constant
**Implements:** ARCHITECTURE.md Pattern 1 (task-type router with config indirection), Pattern 2 (server-side discovery proxy), Pattern 4 (benchmark via fixed probe prompt)
**Avoids:** Split resolveConfig paths (ARCHITECTURE.md Anti-Pattern 5), model discovery from browser (ARCHITECTURE.md Anti-Pattern 2), benchmark cold-start inflation (warm-up call strategy)

### Phase 3: API Endpoints and Caller Wiring
**Rationale:** With service functions ready, the API layer is straightforward. Threading `taskType` through all 6 callers (`ai-workers.ts`, `agent-service.ts`, `interviews.ts`) is a focused, testable backend change that unlocks the actual routing behavior before the wizard UI exists.
**Delivers:** All 6 new endpoints in `settings.ts` (discover, benchmark, routing CRUD, benchmarks, embeddings-health); taskType threading in all callers; routing table saves and resolves correctly end-to-end
**Uses:** Orval-generated types from Phase 1 spec update; service functions from Phase 2
**Avoids:** SSRF via unvalidated baseUrl (validate `https://` scheme or `http://localhost` only; reject RFC1918 addresses); tenant isolation on discover/benchmark routes (scope all config lookups by authenticated tenantId)

### Phase 4: LLM Config Wizard Frontend
**Rationale:** The wizard depends on all Phase 1–3 deliverables being in place (schema, endpoints, Orval hooks). Building the frontend last means it can use real endpoints from day one rather than mocks that may diverge.
**Delivers:** Working 6-step wizard in `settings.tsx` — provider selection (Step 1), API key entry (Step 2), model auto-discovery (Step 3), model selection from fetched list (Step 4), optional benchmarking with latency/quality display (Step 5), routing assignment with smart defaults (Step 6); routing table card in Settings; embeddings health warning banner
**Implements:** ARCHITECTURE.md wizard flow; smart routing defaults from benchmark results; skippable benchmark step (never block wizard completion)
**Avoids:** Free-text model name input (use selection component only — PITFALLS.md Pitfall 4), wizard navigation loss (React Router useBlocker or beforeunload guard when isDirty), benchmark blocking wizard completion (always skippable — ARCHITECTURE.md Anti-Pattern 4)

### Phase 5: Bug Fixes (All 7 v1.0 Audit Items)
**Rationale:** Bug fixes are independent of each other and independent of the routing feature work. Grouping them into one phase keeps feature PRs reviewable and focused. All 7 are correctness issues — they must ship in v1.1, not be deferred.
**Delivers:** Agent findings persistence fix, enrichment idempotency fix, doc processor honest stub (or real parsing), vendor 400→502 HTTP status fix, vendor scorecard real data from DB, embeddings health warning (if not already shipped in Phase 4), model name validation
**Avoids:** Agent findings lost on LLM error (PITFALLS.md Pitfall 1 — fix ordering in runAgentCycle), enrichment stacking (PITFALLS.md Pitfall 2 — idempotent replace pattern), vendor 400 UX confusion (PITFALLS.md Pitfall 7)

### Phase 6: Foresight Teaser Page
**Rationale:** Lowest technical risk, no backend dependencies, high marketing value. Build last to avoid polish work blocking functional features.
**Delivers:** Polished "coming soon" page replacing the bare stub; Apple keynote aesthetic; visual previews for Monte Carlo simulation, OSINT forecasting, agent feed, and what-if scenario builder
**Implements:** New route/page in React frontend only; no backend changes required

### Phase Ordering Rationale

- Phase 1 before everything: DB schema and API spec are compile-time dependencies for the frontend via Orval. Nothing else compiles correctly without them.
- Phase 2 before Phase 3: Service functions must exist before endpoints can call them. Verifying `resolveConfig()` behavior in isolation reduces the risk of a silent regression in all AI job flows.
- Phase 3 before Phase 4: The wizard frontend should use real endpoints from day one. Building the frontend against mocks creates divergence that wastes debugging time.
- Phase 5 is grouped separately from Phase 4 (not interleaved) so that each PR has a clear scope. Bug fixes for agent findings (Phase 5, Pitfall 1) should be fixed before Phase 3 routing changes that affect LLM availability, since the bug means LLM errors silently discard work.
- Phase 6 is always last — zero functional dependencies, pure UX.

### Research Flags

Phases likely needing verification during planning:
- **Phase 2 (Anthropic model listing):** FEATURES.md and PITFALLS.md conflict on whether `anthropic.models.list()` works in SDK ^0.78.x. Verify against the installed SDK before implementing wizard Step 3 for Anthropic. Maintain hardcoded list regardless.
- **Phase 2 (Together AI filtering):** The correct filter field for chat-capable models in Together AI's 200+ model list (`type: "chat"` vs `type: "language"`) needs a live API call to verify. Low risk — trivially adjustable.
- **Phase 4 (Benchmark UX):** The warm-up strategy (discard first call, report median of calls 2–3) adds a multi-call flow to the wizard. The exact UX (spinner for 3 calls? progress bar?) is unresolved — decide during Phase 4 planning.

Phases with standard patterns (skip dedicated research):
- **Phase 1 (Schema migrations):** Safe migration patterns fully documented in PITFALLS.md and STACK.md. New tables only, no enum extensions. No research needed.
- **Phase 3 (Caller wiring):** All 6 callers are identified by file and function in ARCHITECTURE.md. Mechanical threading of an optional parameter with a default. No research needed.
- **Phase 5 (Bug fixes):** Each bug has a specific code location, root cause, and documented fix in PITFALLS.md. Execution only.
- **Phase 6 (Foresight teaser):** Frontend-only UI work with no new patterns. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All provider API endpoints verified against official docs; existing codebase inspected directly; SDK versions confirmed from package.json; zero new package requirement is high confidence |
| Features | HIGH | Feature set grounded in v1.1 scope document + competitor analysis (LiteLLM, OpenRouter, Open WebUI); P1/P2/P3 prioritization is coherent and internally consistent |
| Architecture | HIGH | Derived entirely from direct codebase inspection of all relevant files; build order dependencies are concrete (Orval codegen chain); all 6 callers identified by file and line reference |
| Pitfalls | HIGH | 5 of 10+ pitfalls are code-verified with line references; remaining pitfalls from official provider docs and high-confidence PostgreSQL migration sources |

**Overall confidence:** HIGH

### Gaps to Address

- **Anthropic `/v1/models` endpoint availability:** FEATURES.md reports it now exists; PITFALLS.md and ARCHITECTURE.md say use hardcoded list. Resolve by checking `anthropic.models` in the installed SDK (^0.78.x) at implementation time. The hardcoded fallback list must be maintained regardless of the outcome.
- **Together AI model list filter field:** The correct filter for chat-capable models needs a live API verification. Low risk — the filtering logic is 2 lines and trivially adjustable during Phase 2 implementation.
- **Benchmark warm-up UX:** The strategy (discard call 1, report median of calls 2–3) is defined but the wizard interaction design for a 3-call sequence is not. Decide: show progress for all 3 calls, or only show final result after all 3 complete silently. Resolve during Phase 4 planning.
- **Vendor scorecard real data (Bug #5):** The fix direction is documented (query `questionnaires` or `review_cycles` tables) but the exact query shape is not researched. Will require brief table inspection during Phase 5 implementation.

## Sources

### Primary (HIGH confidence)
- Anthropic API docs (`platform.claude.com/docs/en/api/models/list`) — `/v1/models` endpoint, response format with `id`, `display_name`, `has_more`
- OpenAI API docs (`platform.openai.com/docs/api-reference/models/list`) — `GET /v1/models`, Bearer auth, `Model` response type
- Google Gemini OpenAI compat docs (`ai.google.dev/gemini-api/docs/openai`) — base URL `generativelanguage.googleapis.com/v1beta/openai/`, SDK compatibility
- Groq API docs (`console.groq.com/docs/api-reference`) — `https://api.groq.com/openai/v1/models`
- Mistral API docs (`docs.mistral.ai/api/endpoint/models`) — `GET https://api.mistral.ai/v1/models`, Bearer auth
- Together AI docs (`docs.together.ai/reference/models-1`) — `GET https://api.together.xyz/v1/models`
- Ollama API docs (`docs.ollama.com/api/tags`) — `GET /api/tags`, `models[]` response array with `name`, `details`
- Direct codebase inspection: `artifacts/api-server/src/lib/llm-service.ts`, `ai-workers.ts` line 141, `agent-service.ts` lines 798–844, `routes/settings.ts`, `routes/interviews.ts`, `lib/db/src/schema/llm-configs.ts`, `lib/api-zod/src/generated/types/llmUseCase.ts`, `artifacts/riskmind-app/src/pages/settings/settings.tsx`
- PostgreSQL enum transaction restriction (`gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/`)
- PostgreSQL instant ADD COLUMN in PG11+ (`bytebase.com/blog/postgres-schema-migration-without-downtime/`)

### Secondary (MEDIUM confidence)
- RouteLLM: Learning to Route LLMs with Preference Data (ICLR 2025) — per-task routing strategy research
- AWS Multi-LLM Routing Strategies (`aws.amazon.com/blogs/machine-learning/`) — routing pattern validation
- LLM benchmark cold start and measurement (`acecloud.ai/blog/cold-start-latency-llm-inference/`) — warm-up strategy rationale
- LiteLLM vs OpenRouter comparison (`truefoundry.com/blog/litellm-vs-openrouter`) — competitor feature analysis
- Multi-Model Routing 2026 (`dasroot.net/posts/2026/03/`) — current state of the art for task-based routing
- Beyond Tokens-per-Second (`bentoml.com/blog/`) — TTFT and quality metric selection

### Tertiary (context, not load-bearing)
- `.planning/PROJECT.md` and `.planning/v1.1-scope.md` — authoritative project spec (HIGH confidence as project artifacts, secondary as external research)

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
