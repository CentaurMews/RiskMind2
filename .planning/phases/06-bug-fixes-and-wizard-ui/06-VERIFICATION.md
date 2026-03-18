---
phase: 06-bug-fixes-and-wizard-ui
verified: 2026-03-18T20:00:00Z
status: human_needed
score: 15/15 must-haves verified (automated)
human_verification:
  - test: "Open Settings page in browser — confirm amber warning banner appears when no embeddings provider is configured and that it is dismissible via the X button"
    expected: "Amber banner with 'No embeddings provider configured.' text appears above the Tabs section; clicking X dismisses it for the session"
    why_human: "FIX-06 renders conditionally on embeddingsHealth.configured === false — requires a live browser with no embeddings provider set up"
  - test: "Click 'Configure with Wizard' button in Settings LLM section — confirm 6-step wizard Sheet slides in"
    expected: "Sheet opens from right, stepper shows 6 steps (Provider, Credentials, Discover, Select Model, Benchmark, Routing), Step 0 shows provider card grid with all 7 providers"
    why_human: "Wizard open/close state and Sheet animation require visual confirmation"
  - test: "Complete wizard Steps 0-1 (select Anthropic, enter API key, Save & Continue) — confirm auto-advance to Step 2 Model Discovery"
    expected: "After Save & Continue, Step 2 shows Skeleton rows while discovery runs, then groups models by capability"
    why_human: "Auto-advance on createProvider success involves live API calls and React state transitions not verifiable by grep"
  - test: "On Step 2, click 'Test Connection' button — confirm it only appears after configId is set (provider saved) and shows green/red result"
    expected: "Test Connection button visible only after Save & Continue in Step 1; shows 'Connection successful' or red error box"
    why_human: "Test Connection is gated on configId — requires live session verification"
  - test: "On Step 4 (Benchmark), click 'Run Benchmark' — confirm Skeleton loading state, then TTFT/latency/quality table; 'Recommended' badge if qualityScore >= 2 AND ttftMs < 2000"
    expected: "Benchmark table renders with 3 rows (TTFT, Total latency, Quality); green 'Recommended' badge shown when threshold met"
    why_human: "Requires live LLM provider configured to trigger benchmark; Recommended badge logic depends on real response values"
  - test: "Complete Step 5 (Routing), click Finish — confirm Sheet closes and RoutingTableCard in Settings updates with new assignments immediately"
    expected: "Sheet closes; RoutingTableCard shows updated model assignments; no page reload required"
    why_human: "Query invalidation and UI update on onComplete require live end-to-end flow to verify"
  - test: "Visit Vendors list — confirm Last Assessment and Open Findings columns show real data (or 'Never'/'0' for new vendors)"
    expected: "Last Assessment column shows a formatted date or 'Never'; Findings column shows a count or '0' in amber for non-zero values"
    why_human: "FIX-05 requires a vendor with completed questionnaires or open findings to visually confirm real data vs hardcoded fallbacks"
---

# Phase 6: Bug Fixes and Wizard UI — Verification Report

**Phase Goal:** All remaining audit bugs are corrected and the 6-step LLM Config Wizard is live in Settings — admins can onboard providers, discover models, benchmark, and assign per-task routing without leaving the UI
**Verified:** 2026-03-18T20:00:00Z
**Status:** human_needed (all automated checks pass; 7 items require browser confirmation)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths — Plan 01 (FIX-01 through FIX-07)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | doc-process sets stub summary with filename, no LLM call | VERIFIED | `ai-workers.ts` lines 173-180: `stubSummary = "Document content extraction coming soon. File received: ${doc.fileName}"`, direct DB update, no `callLLM` anywhere in doc-process worker |
| 2  | Re-enriching a risk replaces existing `---AI Enrichment---` block | VERIFIED | `ai-workers.ts` lines 144-146: `ENRICHMENT_SENTINEL` split takes `[0]` before appending new block |
| 3  | Vendor AI question generation returns 502 on LLM parse failure | VERIFIED | `vendors.ts` line 508-510: `catch (parseErr)` with `res.status(502).json({ error: "AI response could not be processed..." })` |
| 4  | Vendor list response includes `openFindingsCount` and `lastAssessmentDate` from DB | VERIFIED | `vendors.ts` lines 78-89: both SQL subquery columns in `db.select()` |
| 5  | Settings page shows amber banner when no embeddings provider configured | VERIFIED (automated) | `settings.tsx` lines 129-132, 338-344: hook call + conditional render — requires human for live test |
| 6  | Model field on provider create/update validated — invalid Anthropic format rejected with 422 | VERIFIED | `settings.ts` lines 10-16: `validateModelFormat()` function; lines 91-92 (POST) and lines 154-158 (PUT): 422 response |

**Plan 01 Score:** 6/6 truths verified

### Observable Truths — Plan 02 (LLM-01 through LLM-06)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 7  | Admin can open LLM Config Wizard from Settings via 'Configure with Wizard' button | VERIFIED | `settings.tsx` lines 376-377: `onClick={() => setWizardOpen(true)}` button; line 134: `wizardOpen` state |
| 8  | Step 1 (0-indexed) shows provider cards (7 providers) with capability tags | VERIFIED | `llm-config-wizard.tsx` lines 42-106: PROVIDER_CATALOG with all 7 entries; lines 426-471: grid render with Badge capability tags |
| 9  | Step 2 shows API key + base URL for Ollama, with Test Connection button | VERIFIED | `llm-config-wizard.tsx` lines 483-621: credentials step; Test Connection button at lines 550-581; base URL conditional on `requiresBaseUrl` or pre-filled |
| 10 | Step 3 auto-fetches models via discover after Step 2, shows Skeleton while loading | VERIFIED | `llm-config-wizard.tsx` lines 370-375: `useEffect` fires `discoverMutation.mutate` when `step === 2`; lines 638-644: Skeleton while `isPending` |
| 11 | Step 4 lets user select model; Save & Continue persists via PUT | VERIFIED | `llm-config-wizard.tsx` lines 712-826: radio-style model selection; `updateProviderMutation.mutate({ id: configId, data: { model: selectedModel } })` |
| 12 | Step 5 runs benchmark, shows TTFT/latency/quality table with Recommended badge | VERIFIED | `llm-config-wizard.tsx` lines 828-932: Run Benchmark button; benchmark table; Recommended badge at line 874 (qualityScore >= 2 AND ttftMs < 2000) |
| 13 | Step 6 shows routing grid (6 task types x model selects) pre-filled by suggestions | VERIFIED | `llm-config-wizard.tsx` lines 386-397: `useEffect` pre-fills from `suggestions`; lines 934-1031: routing grid with Select per task type |
| 14 | Completing Step 6 calls `useUpdateLlmRouting`, closes sheet, RoutingTableCard updates | VERIFIED | `llm-config-wizard.tsx` lines 357-366: `onSuccess` calls `queryClient.invalidateQueries` + `onComplete()`; `settings.tsx` lines 792-801: `onComplete` closes wizard and invalidates both query keys |
| 15 | RoutingTableCard shows 6 task type rows, Auto-suggested badge, click-to-edit per row | VERIFIED | `routing-table-card.tsx`: 6 TASK_TYPES rendered; Auto-suggested badge at lines 144-151; Pencil edit button with inline Select at lines 156-229 |

**Plan 02 Score:** 9/9 truths verified

**Overall Score:** 15/15 truths verified

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `artifacts/api-server/src/lib/ai-workers.ts` | VERIFIED | Doc-process stub + enrichment sentinel pattern both present and wired |
| `artifacts/api-server/src/routes/vendors.ts` | VERIFIED | `openFindingsCount`/`lastAssessmentDate` subqueries present; 502 catch wired |
| `artifacts/api-server/src/routes/settings.ts` | VERIFIED | `validateModelFormat()` defined and called in both POST and PUT handlers |
| `artifacts/riskmind-app/src/pages/settings/settings.tsx` | VERIFIED | `useGetEmbeddingsHealth` imported and wired; `wizardOpen` state; both `LlmConfigWizard` and `RoutingTableCard` mounted |
| `artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` | VERIFIED | Scorecard cells read `vendor.lastAssessmentDate` and `vendor.openFindingsCount` with null-coalesce fallbacks |
| `artifacts/riskmind-app/src/pages/settings/llm-config-wizard.tsx` | VERIFIED | File exists, exports `LlmConfigWizard`, 6 steps implemented, PROVIDER_CATALOG defined, all mutations use generated hooks |
| `artifacts/riskmind-app/src/pages/settings/routing-table-card.tsx` | VERIFIED | File exists, exports `RoutingTableCard`, uses `useGetLlmRouting` + `useUpdateLlmRouting` + `useListLlmProviders` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `settings.tsx` | `GET /api/v1/settings/embeddings-health` | `useGetEmbeddingsHealth` hook at component mount | WIRED | Line 129: `const { data: embeddingsHealth } = useGetEmbeddingsHealth(...)` |
| `vendor-list.tsx` | `vendor.lastAssessmentDate / vendor.openFindingsCount` | Destructure from vendor object returned by `useListVendors` | WIRED | Lines 281-293: conditional renders using `vendor.lastAssessmentDate` and `vendor.openFindingsCount` |
| `settings.ts POST /v1/settings/llm-providers` | Model format validation | `validateModelFormat()` before insert | WIRED | Lines 91-92: `modelErr` check with 422 response |
| `settings.tsx` | `LlmConfigWizard` | `open={wizardOpen} onOpenChange={setWizardOpen}` | WIRED | Lines 792-801: wizard mounted as sibling to provider Sheet (not nested) |
| `LlmConfigWizard Step 2` | `useCreateLlmProvider` / `useTestLlmProvider` | `onSuccess` sets `configId` and calls `goNext()` | WIRED | Lines 293-302: `createProviderMutation` sets `configId` on success |
| `LlmConfigWizard Step 3` | `useDiscoverLlmModels` | `useEffect` on `step === 2` with `wizardData.configId` | WIRED | Lines 370-375 |
| `LlmConfigWizard Step 6` | `useUpdateLlmRouting` | Finish button calls mutation then `onComplete` prop | WIRED | Lines 1051-1059 |
| `RoutingTableCard` | `useGetLlmRouting` | Query fetches `entries[]` + `suggestions{}` and renders task type grid | WIRED | Lines 48-50: `useGetLlmRouting` + lines 70-71: `entries` + `suggestions` destructured |

---

## Requirements Coverage

| Requirement | Phase | REQUIREMENTS.md Description | Plan | Status | Evidence |
|-------------|-------|------------------------------|------|--------|----------|
| FIX-01 | 6 | Doc processing shows stub instead of hallucinated summaries | 06-01 | SATISFIED | `ai-workers.ts`: stub text, no `callLLM` in doc-process |
| FIX-03 | 6 | Re-enriching replaces existing AI enrichment section | 06-01 | SATISFIED | `ai-workers.ts`: ENRICHMENT_SENTINEL split pattern |
| FIX-04 | 6 | Vendor AI questions returns clear error on LLM parse failure | 06-01 | SATISFIED | `vendors.ts`: 502 with user-readable message |
| FIX-05 | 6 | Vendor scorecard shows real last assessment date and open findings count | 06-01 | SATISFIED | `vendors.ts` subqueries + `vendor-list.tsx` conditional renders |
| FIX-06 | 6 | Settings warns when no embeddings provider configured | 06-01 | SATISFIED | `settings.tsx`: `useGetEmbeddingsHealth` + amber banner JSX |
| FIX-07 | 6 | Model name validation prevents saving invalid model IDs | 06-01 | SATISFIED | `settings.ts`: `validateModelFormat()` + 422 on POST and PUT; `settings.tsx`: Select component with "Load models" |
| LLM-01 | 5* | Admin adds provider from dropdown (7 provider types) | 06-02 | SATISFIED | `llm-config-wizard.tsx`: PROVIDER_CATALOG + Step 0 card grid |
| LLM-02 | 5* | Admin enters API key/base URL, system validates connection | 06-02 | SATISFIED | `llm-config-wizard.tsx`: Step 1 credentials form + Test Connection |
| LLM-03 | 5* | System auto-discovers models from provider API | 06-02 | SATISFIED | `llm-config-wizard.tsx`: Step 2 with `useDiscoverLlmModels` useEffect |
| LLM-04 | 5* | Admin selects model from discovered list and saves | 06-02 | SATISFIED | `llm-config-wizard.tsx`: Step 3 radio model selection + `useUpdateLlmProvider` |
| LLM-05 | 5* | Admin tests connection and runs benchmark | 06-02 | SATISFIED | `llm-config-wizard.tsx`: Step 2 Test Connection + Step 4 benchmark table |
| LLM-06 | 5* | System suggests optimal model assignment per task type | 06-02 | SATISFIED | `llm-config-wizard.tsx`: Step 5 routing grid pre-filled from `suggestions` |

**Note on LLM-01 through LLM-06 traceability:** REQUIREMENTS.md Traceability table maps LLM-01 to LLM-06 to "Phase 5" (the backend API implementation). Phase 6 Plan 02 claims these same requirement IDs for the frontend wizard UI. Both are correct — Phase 5 built the API layer, Phase 6 built the UI that exposes these capabilities to end users. The requirements describe end-to-end behaviors; Phase 6 completes them. No orphaned requirements exist.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `llm-config-wizard.tsx` | 1072 | `return null` | Info | `default` case in `switch(step)` — correct behavior for unreachable state (steps 0-5 are fully handled) |
| `vendor-list.tsx` | 95, 100 | Pre-existing TS errors: `String` passed as `number` | Warning (pre-existing) | `useListVendors` pagination type mismatch — documented as pre-existing in SUMMARY; not caused by phase 6 changes |

No placeholder implementations, no TODO/FIXME stubs, no empty API handlers. All critical paths have substantive implementations.

---

## TypeScript Compilation

- **api-server:** Zero errors — `pnpm --filter api-server exec tsc --noEmit` exits clean
- **riskmind-app:** 15 pre-existing errors in `alert-list.tsx`, `risk-list.tsx`, `signal-list.tsx`, `vendor-list.tsx` (pagination `String` vs `number`) — none in phase 6 files (`llm-config-wizard.tsx`, `routing-table-card.tsx`, `settings.tsx`)
- **Phase 6 files:** Zero TypeScript errors introduced

---

## Human Verification Required

### 1. Embeddings Warning Banner (FIX-06)

**Test:** Open Settings in browser as admin when no embeddings provider is configured
**Expected:** Amber banner "No embeddings provider configured. Semantic search, agent clustering, and signal correlation are degraded." appears above the Tabs section with a dismissible X button
**Why human:** Renders conditionally on `embeddingsHealth.configured === false` — requires live session with no embeddings provider

### 2. Wizard Opens and Step 0 Provider Grid

**Test:** Click "Configure with Wizard" button in Settings LLM section
**Expected:** Sheet slides in from right; stepper shows 6 numbered steps; 7 provider cards in 2-column grid with capability badges
**Why human:** Sheet animation and visual layout require browser confirmation

### 3. Wizard Step 1 Credentials + Test Connection Flow

**Test:** Select a provider (e.g. Anthropic), verify Step 1 shows API key input, base URL input (pre-filled for known providers, editable for Ollama), and Test Connection button only visible after Save & Continue
**Expected:** Test Connection button appears after provider is saved; shows green success or red error with message
**Why human:** Test Connection is gated on `wizardData.configId` being set — requires live state tracking

### 4. Wizard Step 2-3 Discovery and Model Selection

**Test:** After Step 1 completes, confirm Step 2 shows Skeleton → then model list grouped by capability; Step 3 shows radio buttons for single model selection
**Expected:** Auto-advance to Step 2 on `createProvider` success; Skeleton during discovery; grouped results; radio-style selection in Step 3
**Why human:** Auto-advance requires live API flow; discovery results depend on provider

### 5. Wizard Step 4 Benchmark + Recommended Badge

**Test:** On Step 4, click "Run Benchmark"; confirm Skeleton loading, then results table with TTFT/latency/quality; Recommended badge if appropriate
**Expected:** Three-row benchmark table; green Recommended badge if qualityScore >= 2 AND ttftMs < 2000; Skip link works
**Why human:** Requires real LLM provider; badge condition depends on live response values

### 6. Wizard Step 5 Routing Completes — Sheet Closes, RoutingTableCard Updates

**Test:** Complete Step 5, click Finish; confirm sheet closes without page reload and RoutingTableCard reflects new routing assignments
**Expected:** Sheet closes; RoutingTableCard shows 6 task type rows with assigned models; query invalidation works without page reload
**Why human:** End-to-end flow requires live session; query cache invalidation timing not verifiable by grep

### 7. Vendor Scorecard Real Data (FIX-05)

**Test:** Open Vendors list with at least one vendor that has completed questionnaires or open findings
**Expected:** Last Assessment column shows formatted date (e.g. "Mar 15, 2026"); Open Findings column shows count in amber for non-zero, or "0" for zero
**Why human:** Requires DB state with real vendor data to confirm subquery columns are used

---

## Gaps Summary

No gaps found in automated verification. All 15 must-haves are implemented, wired, and substantive. The 7 human verification items above are confirmations of live UI behavior — the code correctly implements all required behaviors, but visual/interactive patterns require browser-based spot-checks to sign off completely.

---

_Verified: 2026-03-18T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
