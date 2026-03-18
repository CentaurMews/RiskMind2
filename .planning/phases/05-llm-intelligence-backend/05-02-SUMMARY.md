---
phase: 05-llm-intelligence-backend
plan: "02"
subsystem: llm-service
tags: [llm, routing, benchmarking, discovery, task-routing]
dependency_graph:
  requires:
    - 05-01  # llmTaskRoutingTable, llmBenchmarkResultsTable schema
  provides:
    - LLMTaskType export (usable by all callers)
    - discoverModels() for wizard Step 3
    - runBenchmark() for wizard Step 3
    - suggestRouting() for wizard Step 4
    - resolveConfig() routing-aware (task-specific model selection)
  affects:
    - artifacts/api-server/src/lib/llm-service.ts (all consumers)
    - Phase 6 wizard frontend (depends on discoverModels/runBenchmark outputs)
    - Phase 5 Plan 03 (caller wiring — complete/streamComplete with taskType)
tech_stack:
  added: []
  patterns:
    - Task-type routing: (tenantId, taskType) → llm_task_routing → config + model_override
    - Provider branching: anthropic | ollama (port 11434) | openai_compat
    - Benchmark warm-up: 3 calls, discard cold call 1, median of calls 2-3
    - Quality scoring: JSON parse + key/value validation → 0-3 score
    - SDK fallback: anthropic.models.list() → ANTHROPIC_MODELS constant on error
key_files:
  modified:
    - artifacts/api-server/src/lib/llm-service.ts
decisions:
  - "ANTHROPIC_MODELS hardcoded as constant regardless of SDK availability — Plan truths honored"
  - "resolveConfig() routing priority: task routing table first, then isDefault fallback, then any active config"
  - "generateEmbedding() wraps resolveConfig with 'embeddings' taskType but keeps existing fallback to general config"
  - "suggestRouting() returns null for embeddings slot — user must explicitly select embeddings config"
  - "discoverOllamaModels() error return fixed: returns empty array (not ANTHROPIC_MODELS.slice(0,0)) for clarity"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-18"
  tasks_completed: 2
  files_modified: 1
---

# Phase 5 Plan 02: LLM Service Extension — Routing, Discovery, Benchmarking Summary

**One-liner:** Extended llm-service.ts with task-aware routing via llm_task_routing table, provider model discovery for all 7 provider types, 3-call warm benchmark with median scoring, and suggestRouting() heuristics for the wizard frontend.

## What Was Built

### New Exports from `artifacts/api-server/src/lib/llm-service.ts`

| Export | Type | Purpose |
|--------|------|---------|
| `LLMTaskType` | type union | Single source of truth for task type strings used across all callers |
| `ANTHROPIC_MODELS` | const array | 6 hardcoded Claude models — fallback when SDK `models.list()` unavailable |
| `DiscoveredModel` | interface | `{ id, displayName?, capability[], contextWindow? }` — returned by discoverModels() |
| `discoverModels(configId, tenantId)` | async function | Lists models from any provider without exposing API keys |
| `runBenchmark(configId, tenantId, modelOverride?)` | async function | 3-call warm benchmark, median of calls 2-3, persists to llm_benchmark_results |
| `suggestRouting(tenantId)` | async function | Heuristic routing suggestions from benchmark data |

### resolveConfig() Routing Resolution Logic

Resolution order (first match wins):

1. **Task routing table lookup:** `SELECT FROM llm_task_routing WHERE tenant_id = ? AND task_type = ?`
   - If found and config is active: return config + `model_override` (if set, else config.model)
2. **isDefault fallback:** `SELECT FROM llm_configs WHERE tenant_id = ? AND is_default = true AND use_case = ? AND is_active = true`
   - `useCase` derived from `taskType === "embeddings" ? "embeddings" : "general"`
3. **Any active config fallback:** Same as above without `is_default` filter

### discoverModels() Branch Logic

```
configId → resolveConfigById() → config.providerType + config.baseUrl
  anthropic         → discoverAnthropicModels()  → client.models.list() or ANTHROPIC_MODELS fallback
  baseUrl :11434 or localhost (non-openai)  → discoverOllamaModels()   → GET /api/tags
  everything else   → discoverOpenAICompatModels() → client.models.list() with prefix filtering
```

**OpenAI filtering:** When `baseUrl` is `api.openai.com` (or absent), only models matching `OPENAI_MODEL_PREFIXES` are returned. Third-party OpenAI-compat providers get all non-deprecated models.

**Anthropic fallback:** If `client.models.list()` throws, `ANTHROPIC_MODELS` constant is returned. SDK availability is not required.

### runBenchmark() Approach

1. Runs 3 streaming LLM calls with `BENCHMARK_PROMPT` (risk analyst JSON task)
2. Discards call 1 (cold-start / connection overhead)
3. Computes median TTFT and total latency from calls 2 and 3
4. Scores quality on call 3 response via `scoreQuality()`:
   - **3** — valid JSON with correct severity + category + summary
   - **2** — valid JSON with all keys but invalid values
   - **1** — parseable JSON or contains "risk"
   - **0** — unusable response
5. Persists result to `llm_benchmark_results` table

### suggestRouting() Heuristics

| Task type | Selection strategy |
|-----------|-------------------|
| `triage` | Lowest TTFT (speed matters most) |
| `enrichment` | Highest quality score (reasoning matters most) |
| `agent` | Highest quality score (same as enrichment) |
| `treatment` | Quality × 0.7 + throughput × 0.3 (balanced) |
| `general` | Lowest total latency |
| `embeddings` | Always `null` — user must select explicit embeddings config |

## Updated Function Signatures

```typescript
// New: taskType optional, defaults to "general"
export async function complete(tenantId: string, opts: CompletionOptions, taskType: LLMTaskType = "general"): Promise<string>
export async function* streamComplete(tenantId: string, opts: CompletionOptions, taskType: LLMTaskType = "general"): AsyncGenerator<StreamChunk>

// Unchanged signature — internally uses "embeddings" taskType
export async function generateEmbedding(tenantId: string, text: string): Promise<number[]>
```

All existing callers continue to work — new `taskType` parameter is optional with a `"general"` default.

## Deviations from Plan

**1. [Rule 1 - Bug] discoverOllamaModels() error return corrected**
- **Found during:** Task 2 implementation review
- **Issue:** Plan had `ANTHROPIC_MODELS.slice(0, 0)` (empty array via slice) as error return in discoverOllamaModels(). This was clearly a copy-paste artifact — an empty array is the correct error return, and `ANTHROPIC_MODELS.slice(0, 0)` has the same runtime result but was semantically misleading.
- **Fix:** Used `{ models: [], error: ... }` directly for clarity.
- **Files modified:** artifacts/api-server/src/lib/llm-service.ts
- **Commit:** b6f0b5b

**2. [Rule 3 - Blocking] db package dist rebuilt**
- **Found during:** TypeScript verification after Task 2
- **Issue:** `lib/db/dist/` did not include declaration files for the two new schema files (`llm-task-routing.d.ts`, `llm-benchmark-results.d.ts`), causing tsc errors in api-server.
- **Fix:** Ran `pnpm exec tsc --build` in `lib/db/` to regenerate declarations.
- **Files modified:** lib/db/dist/ (gitignored, not committed)

## Self-Check

Files created/modified:
- `artifacts/api-server/src/lib/llm-service.ts` — FOUND
- `.planning/phases/05-llm-intelligence-backend/05-02-SUMMARY.md` — FOUND (this file)

Commits:
- `f77c630` — Task 1: LLMTaskType, resolveConfig routing, function signatures
- `b6f0b5b` — Task 2: ANTHROPIC_MODELS, discoverModels, runBenchmark, suggestRouting

TypeScript: `pnpm exec tsc --noEmit` passes cleanly (no output = success).

## Self-Check: PASSED
