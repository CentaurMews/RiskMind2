---
phase: 05-llm-intelligence-backend
plan: "01"
subsystem: db-schema, api-spec, codegen
tags: [drizzle, openapi, orval, llm-routing, benchmarking]
dependency_graph:
  requires: []
  provides:
    - llmTaskRoutingTable (Drizzle table)
    - llmBenchmarkResultsTable (Drizzle table)
    - display_provider column on llm_configs
    - OpenAPI paths: /discover, /benchmark, /llm-routing, /embeddings-health
    - Generated hooks: discoverLlmModels, benchmarkLlmProvider, getLlmRouting, updateLlmRouting, deleteLlmRoutingEntry, getEmbeddingsHealth
  affects:
    - lib/api-client-react (regenerated)
    - lib/api-zod (regenerated)
tech_stack:
  added: []
  patterns:
    - Drizzle uniqueIndex on composite (tenantId, taskType) — avoids enum ALTER TYPE
    - Config indirection: (tenant, task_type) -> config_id + model_override
key_files:
  created:
    - lib/db/src/schema/llm-task-routing.ts
    - lib/db/src/schema/llm-benchmark-results.ts
  modified:
    - lib/db/src/schema/llm-configs.ts
    - lib/db/src/schema/index.ts
    - lib/api-spec/openapi.yaml
    - lib/api-client-react/src/generated/api.ts
    - lib/api-zod/src/generated/ (multiple new type files)
decisions:
  - "task_type stored as plain text in llm_task_routing — not an enum — to avoid PostgreSQL transaction trap with ALTER TYPE ADD VALUE"
  - "display_provider column added as nullable text to llm_configs for UI labeling without breaking existing rows"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-18"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 20
---

# Phase 05 Plan 01: DB Schema Foundation + OpenAPI Contracts Summary

**One-liner:** Two new Drizzle tables (llm_task_routing, llm_benchmark_results), display_provider column, 6 new OpenAPI paths with 5 component schemas, and full codegen regeneration.

## What Was Created

### New Schema Files

**lib/db/src/schema/llm-task-routing.ts**
- Table: `llm_task_routing` with `(tenantId, taskType)` unique composite index
- Fields: id, tenantId, taskType (text, not enum), configId (FK → llm_configs, SET NULL), modelOverride, createdAt, updatedAt
- Types: `LlmTaskRouting`, `InsertLlmTaskRouting`

**lib/db/src/schema/llm-benchmark-results.ts**
- Table: `llm_benchmark_results` with two performance indexes: `(configId, createdAt)` and `(tenantId, createdAt)`
- Fields: id, configId (FK → llm_configs, CASCADE), tenantId, model, ttftMs, totalLatencyMs, qualityScore, tokensPerSecond, createdAt
- Types: `LlmBenchmarkResult`, `InsertLlmBenchmarkResult`

### Modified Schema Files

**lib/db/src/schema/llm-configs.ts**
- Added `displayProvider: text("display_provider")` after `useCase` field
- No enum changes (llmProviderTypeEnum and llmUseCaseEnum untouched)

**lib/db/src/schema/index.ts**
- Appended `export * from "./llm-task-routing"` and `export * from "./llm-benchmark-results"`

### OpenAPI Changes (lib/api-spec/openapi.yaml)

**New paths (6 operationIds):**
- `POST /v1/settings/llm-providers/{id}/discover` → `discoverLlmModels`
- `POST /v1/settings/llm-providers/{id}/benchmark` → `benchmarkLlmProvider`
- `GET /v1/settings/llm-routing` → `getLlmRouting`
- `PUT /v1/settings/llm-routing` → `updateLlmRouting`
- `DELETE /v1/settings/llm-routing/{taskType}` → `deleteLlmRoutingEntry`
- `GET /v1/settings/embeddings-health` → `getEmbeddingsHealth`

**New component schemas (5):**
- `LlmDiscoveredModel` — model info from provider discovery
- `LlmDiscoverResult` — array of discovered models
- `LlmBenchmarkResult` — ttftMs, totalLatencyMs, qualityScore, tokensPerSecond
- `LlmRoutingEntry` — per-task routing row with configId + modelOverride
- `LlmRoutingTable` — routing entries array + benchmark-based suggestions

**Updated schema:** `LlmProvider` now has `displayProvider: string | null`

## Push Result

`pnpm --filter @workspace/db run push` completed without error:
- Table `llm_task_routing` created with unique index `llm_task_routing_tenant_task_idx`
- Table `llm_benchmark_results` created with indexes `llm_benchmark_config_idx` and `llm_benchmark_tenant_idx`
- Column `display_provider` added to `llm_configs`

## Codegen Result

`pnpm --filter @workspace/api-spec run codegen` ran without errors:
- `lib/api-client-react/src/generated/api.ts` — 29+ references to new operations
- `lib/api-zod/src/generated/` — 10 new type files generated (LlmRoutingEntry, LlmRoutingTable, LlmBenchmarkResult, etc.)

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `4d2b2b3` | Schema files, display_provider column, index.ts exports |
| Task 2 | `a2fe362` | DB push, OpenAPI paths + schemas, codegen |

## Self-Check: PASSED
