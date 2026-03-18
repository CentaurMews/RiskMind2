---
phase: 06-bug-fixes-and-wizard-ui
plan: "01"
subsystem: api-server + riskmind-app
tags: [bug-fix, ai-workers, vendors, settings, frontend]
dependency_graph:
  requires: []
  provides: [doc-process-stub, enrichment-idempotency, vendor-502-error, vendor-scorecard-data, embeddings-banner, model-validation]
  affects: [ai-workers, vendor-list, settings-page]
tech_stack:
  added: []
  patterns: [sql-subquery-computed-columns, sentinel-split-idempotency, 422-model-validation]
key_files:
  created: []
  modified:
    - artifacts/api-server/src/lib/ai-workers.ts
    - artifacts/api-server/src/routes/vendors.ts
    - artifacts/api-server/src/routes/settings.ts
    - artifacts/riskmind-app/src/pages/settings/settings.tsx
    - artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx
decisions:
  - "doc-process worker stubs summary text instead of calling LLM — unblocks document upload flow without content extraction infrastructure"
  - "ENRICHMENT_SENTINEL split pattern makes re-enrichment idempotent — replaces existing block rather than stacking"
  - "Vendor AI question parse failure now returns 502 (upstream AI error) instead of 400 (bad request) — semantically correct"
  - "useDiscoverLlmModels requires an existing provider ID so Load models button shown only in edit mode"
  - "api-client-react dist rebuilt locally to expose useGetEmbeddingsHealth and useDiscoverLlmModels — dist is gitignored, rebuild needed on each dev setup"
metrics:
  duration: "12 minutes"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 5
requirements_covered: [FIX-01, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07]
---

# Phase 6 Plan 01: Bug Fixes (FIX-01, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07) Summary

**One-liner:** Six surgical fixes across three backend files and two frontend files — doc-process stub, enrichment idempotency, vendor 502 error, scorecard DB subqueries, embeddings banner, and model format validation.

## What Was Built

### Task 1: Backend fixes (ai-workers.ts + vendors.ts)

**FIX-01 — doc-process stub:** Replaced the entire `isAvailable` guard + LLM `callLLM` try/catch block in the `doc-process` worker with a direct stub update: sets `status: "processed"` and `summary: "Document content extraction coming soon. File received: [filename]"`. No LLM call is ever made.

**FIX-03 — enrichment idempotency:** In the `ai-enrich` worker, replaced direct string concatenation for description with a sentinel-split pattern. `ENRICHMENT_SENTINEL = "\n\n---AI Enrichment---\n"` is used to split the current description and take only the base (pre-enrichment) portion before appending the new block. Re-enriching the same risk now replaces the existing `---AI Enrichment---` section instead of stacking a second one.

**FIX-04 — vendor AI question 400→502:** Changed the parse error catch in the vendor AI questions endpoint from `badRequest()` (400) to `res.status(502).json()` with a user-readable message. The error is an upstream AI failure, not a bad client request.

**FIX-05 — vendor scorecard subqueries:** Added two computed columns to the `db.select()` in `GET /v1/vendors`:
- `openFindingsCount`: SQL subquery counting open findings for each vendor
- `lastAssessmentDate`: SQL subquery finding the most recent completed questionnaire date

### Task 2: Backend settings.ts + frontend settings.tsx + vendor-list.tsx

**FIX-07 backend — model format validation:** Added `validateModelFormat()` helper above the router. Called in both POST and PUT `/v1/settings/llm-providers`. Anthropic providers with model IDs not starting with `claude-` are rejected with 422 and a clear error message. PUT uses `providerType || existing.providerType` to get the effective type when only `model` is updated.

**FIX-06 — embeddings warning banner:** Added `useGetEmbeddingsHealth` hook to the Settings component. When the response has `configured: false`, an amber dismissible banner appears above the Tabs section showing "No embeddings provider configured." with an X button to dismiss.

**FIX-07 frontend — model Select:** Added `useDiscoverLlmModels` mutation and `discoveredModelsForForm` state. A "Load models" button appears only in edit mode (requires an existing provider ID for the mutation). When clicked, it populates a `<Select>` component with discovered models. Falls back to `<Input>` when no models have been discovered yet.

**FIX-05 frontend — vendor scorecard columns:** Replaced hardcoded "Never" and "—" cells in vendor-list.tsx with conditional renders reading `vendor.lastAssessmentDate` and `vendor.openFindingsCount` from the vendor API response.

## Decisions Made

1. **doc-process stub approach:** No LLM call at all — avoids unavailable-provider edge cases and makes the stub behavior unconditional and predictable.
2. **ENRICHMENT_SENTINEL split:** Simple string split on the sentinel is sufficient; no regex complexity needed.
3. **502 for AI parse failure:** Correct HTTP semantics — the API server received an invalid response from an upstream dependency (the LLM), not a bad request from the client.
4. **Load models button only in edit mode:** `useDiscoverLlmModels` requires a saved provider ID. In add mode, the user types the model directly.
5. **api-client-react dist:** The generated hooks were already in `generated/api.ts` but the dist `.d.ts` needed a local rebuild (`pnpm --filter @workspace/api-client-react exec tsc --build`) — dist is gitignored, developer must rebuild after pulling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] api-client-react dist was stale**
- **Found during:** Task 2
- **Issue:** `useGetEmbeddingsHealth` and `useDiscoverLlmModels` existed in `src/generated/api.ts` but not in the compiled `dist/` that TypeScript references were pointing at.
- **Fix:** Ran `pnpm --filter @workspace/api-client-react exec tsc --build` to regenerate `dist/generated/api.d.ts`
- **Files modified:** lib/api-client-react/dist/generated/api.d.ts (gitignored, not committed)
- **Commit:** N/A (dist is gitignored)

### Out-of-Scope Pre-existing Errors Noted

The following pre-existing TypeScript errors exist in riskmind-app but are NOT caused by this plan's changes:
- `vendor-list.tsx` lines 95, 100: `String` passed where `number` expected in `useListVendors` pagination params
- `alert-list.tsx`, `risk-list.tsx`, `signal-list.tsx`: Same `String` vs `number` pagination pattern
- `command-palette.tsx`, `kri-widget.tsx`: `customFetch` export missing
These are logged here as deferred items and not fixed.

## Verification

- api-server: `pnpm --filter api-server exec tsc --noEmit` — zero errors
- riskmind-app: errors only in pre-existing files unrelated to this plan

## Self-Check: PASSED

- `/home/dante/RiskMind2/artifacts/api-server/src/lib/ai-workers.ts` — contains "Document content extraction coming soon" stub
- `/home/dante/RiskMind2/artifacts/api-server/src/routes/vendors.ts` — contains `openFindingsCount` subquery and 502 catch
- `/home/dante/RiskMind2/artifacts/api-server/src/routes/settings.ts` — contains `validateModelFormat` function
- `/home/dante/RiskMind2/artifacts/riskmind-app/src/pages/settings/settings.tsx` — contains `useGetEmbeddingsHealth` and amber banner JSX
- `/home/dante/RiskMind2/artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` — scorecard cells read from `vendor.lastAssessmentDate` and `vendor.openFindingsCount`
- Commits: 45f7887, 5bc7f06 — both exist in git log
