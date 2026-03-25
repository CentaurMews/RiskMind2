---
phase: 13-compliance-flow
verified: 2026-03-25T13:56:00Z
status: gaps_found
score: 11/12 must-haves verified
re_verification: false
gaps:
  - truth: "TypeScript compiles cleanly across all compliance frontend files"
    status: partial
    reason: "framework-detail.tsx line 257 uses base `score` variable (typed as ComplianceScore) instead of `scoreExt` (typed as ComplianceScoreExtended) when building scoreData for PDF export. ComplianceScore generated type does not include `status` field. Causes TS2339 error."
    artifacts:
      - path: "artifacts/riskmind-app/src/pages/compliance/framework-detail.tsx"
        issue: "Line 257: `status: score.status` — should be `status: scoreExt?.status` since `score` is typed as `ComplianceScore` which lacks the `status` field added in Plan 02. Fix: replace `score.status` with `scoreExt?.status`."
    missing:
      - "Change line 257 from `status: score.status,` to `status: scoreExt?.status,`"
human_verification:
  - test: "Framework import dialog end-to-end"
    expected: "Upload a CSV with code,title,description columns; click Preview Changes; see new/modified/unchanged counts; click Apply Import; verify requirements appear in framework detail requirements tree"
    why_human: "Full round-trip requires browser + live API + database — cannot be verified programmatically without a running server"
  - test: "Compliance threshold triggers pipeline"
    expected: "Set threshold above current score on a framework; verify a finding and alert appear in the findings list and alert bell; set threshold below current score; verify finding auto-resolves"
    why_human: "Requires live server, authenticated session, and observable UI state changes"
  - test: "Auto-map approval dialog shows AI suggestions"
    expected: "On control list, click Auto-Map on a control with a description; dialog opens and shows requirement suggestions with similarity percentages; select suggestions; click Apply Selected; control-requirement mappings update"
    why_human: "Requires live pgvector embeddings and a running LLM embedding provider"
  - test: "PDF export download"
    expected: "On framework detail, click Export PDF; browser downloads a PDF file named {framework}-compliance-report.pdf with executive summary page and gap details table"
    why_human: "PDF rendering via @react-pdf/renderer must be visually inspected; download behavior cannot be tested headlessly"
---

# Phase 13: Compliance Flow Verification Report

**Phase Goal:** Users can import compliance framework controls, run assessments that update control compliance status, and configure per-framework pass/fail thresholds that drive dashboard status
**Verified:** 2026-03-25T13:56:00Z
**Status:** gaps_found (1 TypeScript compilation error in frontend)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | CSV/JSON parsing returns structured requirement objects | VERIFIED | `compliance-import.ts` exports `parseCsv`, `parseJson` — 26 unit tests GREEN |
| 2  | Diff computation correctly categorizes requirements as new/modified/unchanged | VERIFIED | `computeDiff` in `compliance-import.ts` lines 158-185; additive-only per D-05 |
| 3  | Import preview endpoint returns diff without DB writes | VERIFIED | `POST /v1/frameworks/:id/import/preview` at compliance.ts line 153 — no DB writes, returns diff JSON |
| 4  | Import apply endpoint writes requirements additively | VERIFIED | `POST /v1/frameworks/:id/import/apply` at compliance.ts line 201 — uses `computeDiff`, never deletes |
| 5  | Pipeline creates finding + alert + draft risk when score drops below threshold | VERIFIED | `recalculateAndTriggerPipeline` in `compliance-pipeline.ts` lines 204-244 — inserts finding, alert, risk draft |
| 6  | Pipeline auto-resolves open findings and alerts when score recovers | VERIFIED | `compliance-pipeline.ts` lines 250-287 — bulk update to `status: "resolved"` |
| 7  | Pipeline is idempotent — no duplicate findings for same framework breach | VERIFIED | `compliance-pipeline.ts` lines 189-201 — checks for existing open finding before inserting |
| 8  | Assessment completion for framework context triggers compliance recalculation | VERIFIED | `assessments.ts` line 432-435 — `if (assessment.contextType === "framework")` calls `recalculateAndTriggerPipeline` |
| 9  | Control test creation triggers compliance recalculation | VERIFIED | `compliance.ts` lines 699-716 — finds framework via requirement map chain, calls pipeline per framework |
| 10 | Dashboard shows COMPLIANT/AT-RISK/NON-COMPLIANT status per framework | VERIFIED | `framework-list.tsx` — `deriveComplianceStatus()` derives status client-side from `compliancePercentage + complianceThreshold`; colored badges rendered per framework card |
| 11 | Inline threshold editor on framework detail updates per-framework threshold | VERIFIED | `framework-detail.tsx` lines 203-230 — `PUT /api/v1/frameworks/${id}/threshold` wired to save button |
| 12 | TypeScript compiles cleanly across all compliance files | FAILED | `framework-detail.tsx` line 257: `score.status` references base `ComplianceScore` type which lacks `status` — TS2339 error |

**Score:** 11/12 truths verified

---

### Required Artifacts

| Artifact | Provided By | Status | Details |
|----------|-------------|--------|---------|
| `artifacts/api-server/tests/compliance-import.test.ts` | Plan 00 | VERIFIED | 12+ test cases, all GREEN |
| `artifacts/api-server/tests/compliance-pipeline.test.ts` | Plan 00 | VERIFIED | 8+ test cases covering `getComplianceStatus`, pipeline idempotency, auto-resolve |
| `artifacts/api-server/src/lib/compliance-import.ts` | Plan 01 | VERIFIED | Exports `parseCsv`, `parseJson`, `computeDiff`, `resolveParentCodes`, `RawRequirement`, `DiffResult` |
| `artifacts/api-server/src/lib/compliance-pipeline.ts` | Plan 01 | VERIFIED | Exports `computeComplianceScore`, `getComplianceStatus`, `recalculateAndTriggerPipeline`; exact formula `coverageScore * 0.6 + effectivenessScore * 0.4` confirmed |
| `lib/db/src/schema/control-tests.ts` | Plan 01 | VERIFIED | Contains `evidenceExpiry`, `evidenceFileName`, `evidenceMimeType` columns; `insertControlTestSchema` omits server-side fields |
| `artifacts/api-server/src/routes/compliance.ts` | Plan 02 | VERIFIED | All 7 new endpoints present: `POST /v1/frameworks`, import preview/apply, threshold PUT, CSV export, auto-map-suggestions; `recalculateAndTriggerPipeline` called in control test handler |
| `artifacts/api-server/src/routes/assessments.ts` | Plan 02 | VERIFIED | `recalculateAndTriggerPipeline` imported and called on framework-context assessment submit; D-10 section-score-to-control-test linkage implemented |
| `artifacts/riskmind-app/src/components/compliance/import-framework-dialog.tsx` | Plan 03 | VERIFIED | Calls `import/preview` on file upload, `import/apply` on confirm; shows new/modified/unchanged diff with color-coded sections |
| `artifacts/riskmind-app/src/components/compliance/create-framework-dialog.tsx` | Plan 03 | VERIFIED | `POST /api/v1/frameworks` wired; name validation (required, 3-100 chars) present |
| `artifacts/riskmind-app/src/pages/compliance/framework-list.tsx` | Plan 03 | VERIFIED | Imports both dialogs; `deriveComplianceStatus` function present; compliance status badges on cards; Create/Import buttons visible to `canEdit` users |
| `artifacts/riskmind-app/src/pages/compliance/framework-detail.tsx` | Plan 03/04 | STUB (TS error) | Threshold editor wired; CSV export button wired; PDF export via dynamic import wired — but TS2339 on `score.status` at line 257 |
| `artifacts/riskmind-app/src/components/compliance/compliance-pdf-report.tsx` | Plan 04 | VERIFIED | `@react-pdf/renderer` imports; `CompliancePdfReportProps` interface; executive summary + gap table sections; footer text present |
| `artifacts/riskmind-app/src/components/compliance/auto-map-approval-dialog.tsx` | Plan 04 | VERIFIED | Calls `auto-map-suggestions` endpoint; checkbox UI for approval; similarity percentage badges; merges with `existingRequirementIds` on apply |
| `artifacts/riskmind-app/src/pages/compliance/control-list.tsx` | Plan 04 | VERIFIED | `AutoMapApprovalDialog` imported and wired; auto-map state per control; dialog rendered at bottom of tree |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tests/compliance-import.test.ts` | `src/lib/compliance-import.ts` | import | VERIFIED | `from.*compliance-import` present; all 26 tests pass |
| `tests/compliance-pipeline.test.ts` | `src/lib/compliance-pipeline.ts` | import | VERIFIED | `from.*compliance-pipeline` present; tests GREEN |
| `compliance.ts POST /import/apply` | `compliance-import.ts parseCsv/parseJson/computeDiff` | function calls | VERIFIED | Lines 217/232 — `parseJson`/`parseCsv` + `computeDiff` called |
| `compliance.ts POST /tests` | `compliance-pipeline.ts recalculateAndTriggerPipeline` | async call | VERIFIED | Lines 712-715 — pipeline called for all mapped frameworks after test insert |
| `assessments.ts submit handler` | `compliance-pipeline.ts recalculateAndTriggerPipeline` | hook call | VERIFIED | Lines 432-435 — non-blocking `.catch` call for framework context |
| `compliance.ts compliance-score endpoint` | `compliance-pipeline.ts getComplianceStatus` | function call | VERIFIED | Line 789 — `getComplianceStatus(score, threshold)` added to response |
| `import-framework-dialog.tsx` | `POST /v1/frameworks/:id/import/preview` | fetch | VERIFIED | Line 79 — `fetch(\`/api/v1/frameworks/${frameworkId}/import/preview?format=${format}\`)` |
| `import-framework-dialog.tsx` | `POST /v1/frameworks/:id/import/apply` | fetch | VERIFIED | Line 104 — `fetch(\`/api/v1/frameworks/${frameworkId}/import/apply?format=${format}\`)` |
| `framework-detail.tsx threshold editor` | `PUT /v1/frameworks/:id/threshold` | fetch | VERIFIED | Line 211 — `fetch(\`/api/v1/frameworks/${id}/threshold\`, { method: "PUT" })` |
| `framework-detail.tsx Export PDF button` | `compliance-pdf-report.tsx` | dynamic import | VERIFIED | Lines 246-247 — `import("@react-pdf/renderer")` + `import("@/components/compliance/compliance-pdf-report")` |
| `auto-map-approval-dialog.tsx` | `POST /v1/controls/:id/auto-map-suggestions` | fetch | VERIFIED | Line 50 — `fetch(\`/api/v1/controls/${controlId}/auto-map-suggestions\`)` |
| `control-list.tsx` | `AutoMapApprovalDialog` | render | VERIFIED | Lines 187-194 — dialog rendered with controlId, controlTitle, existingRequirementIds |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `compliance-pipeline.ts computeComplianceScore` | `requirements`, `mappings`, `latestTests` | Drizzle DB queries on `frameworkRequirementsTable`, `controlRequirementMapsTable`, `controlTestsTable` | Yes | FLOWING |
| `compliance-pipeline.ts recalculateAndTriggerPipeline` | `finding`, `alert`, `risk` | Inserts to `findingsTable`, `alertsTable`, `risksTable` with real framework name and score values | Yes | FLOWING |
| `framework-list.tsx FrameworkCard` | `compliancePercentage`, `complianceThreshold` | `useGetFrameworks` Orval hook → `GET /v1/frameworks` list endpoint (returns pre-computed fields) | Yes — list endpoint enriches with both values | FLOWING |
| `framework-detail.tsx scoreExt` | `score`, `coverageScore`, `effectivenessScore`, `status` | `useGetComplianceScore` → `GET /v1/frameworks/:id/compliance-score` — calls `computeComplianceScore` from pipeline | Yes | FLOWING |
| `import-framework-dialog.tsx diffResult` | `diff.new`, `diff.modified`, `diff.unchanged` | `POST /import/preview` → `parseCsv/parseJson` + `computeDiff` against existing DB requirements | Yes | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| compliance-import tests GREEN | `cd artifacts/api-server && npx vitest run tests/compliance-import.test.ts` | 13 tests passed | PASS |
| compliance-pipeline tests GREEN | `cd artifacts/api-server && npx vitest run tests/compliance-pipeline.test.ts` | 13 tests passed | PASS |
| API server TypeScript compiles | `cd artifacts/api-server && tsc -p tsconfig.json --noEmit` | Errors only in pre-existing `email.ts` and `monitoring.ts`/`vendors.ts` (unrelated to phase 13) — all compliance files pass | PASS |
| Frontend compliance files TypeScript | `cd artifacts/riskmind-app && tsc -p tsconfig.json --noEmit` (compliance paths) | 1 error: `framework-detail.tsx:257` TS2339 on `score.status` | FAIL |
| Module exports present: compliance-import | `grep "export function\|export interface" compliance-import.ts` | 6 exports (parseCsv, parseJson, computeDiff, resolveParentCodes, RawRequirement, DiffResult) | PASS |
| Module exports present: compliance-pipeline | `grep "export" compliance-pipeline.ts` | 4 exports (computeComplianceScore, getComplianceStatus, recalculateAndTriggerPipeline, ComplianceScoreResult) | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COMP-01 | Plans 00, 01, 02, 03 | User can import compliance framework controls via CSV or JSON with validation and duplicate detection | SATISFIED | `parseCsv`/`parseJson` with Zod validation + BOM handling; `computeDiff` for duplicate detection; `POST /import/preview` + `/import/apply` routes; `ImportFrameworkDialog` with diff preview UI |
| COMP-02 | Plans 00, 01, 02, 04 | User can assign assessment templates to a compliance framework, mapping questions to control IDs, with responses updating control compliance status | SATISFIED | Assessment submit hook (`assessments.ts` line 432) calls `recalculateAndTriggerPipeline`; D-10 section-score → control test creation implemented (lines 437-487); auto-map dialog with pgvector similarity for control-requirement mapping; `POST /v1/controls/:id/auto-map-suggestions` endpoint |
| COMP-03 | Plans 00, 01, 02, 03, 04 | User can configure per-framework compliance thresholds (0-100%) with dashboard showing COMPLIANT/AT-RISK/NON-COMPLIANT status | SATISFIED | `PUT /v1/frameworks/:id/threshold` endpoint; `getComplianceStatus` pure function; inline threshold editor in `framework-detail.tsx`; `deriveComplianceStatus` on framework list cards with color-coded badges |

No orphaned requirements: REQUIREMENTS.md maps COMP-01, COMP-02, COMP-03 to Phase 13 only — all three are claimed by plans in this phase.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `artifacts/riskmind-app/src/pages/compliance/framework-detail.tsx` | 257 | `score.status` — accesses `.status` on `ComplianceScore` base type which lacks the field; should use `scoreExt?.status` | Warning | TypeScript compilation error; runtime works because the API actually returns `status` and JS ignores type constraints at runtime. Fix is a 1-character change. |

No stubs or TODO placeholders found in any phase 13 deliverable files. No empty handler implementations. No hardcoded empty arrays passed as props to rendering components. All API calls handle response/error paths.

---

### Human Verification Required

#### 1. Framework Import Dialog End-to-End

**Test:** Log in as admin/risk_manager. Navigate to Compliance > Frameworks. Click "Import Controls" on an existing framework. Upload a CSV file with columns `code,title,description`. Click "Preview Changes". Verify new/modified/unchanged badge counts appear. Click "Apply Import". Verify requirements appear in framework detail requirements tree.
**Expected:** Requirements tree updates; toast shows "Import complete: N new, M modified."
**Why human:** Full round-trip requires browser, live API, and database — cannot be verified without a running server.

#### 2. Compliance Threshold Pipeline

**Test:** Log in as admin. Open a framework with a compliance score below 100%. Set threshold to a value above the current score. Save. Navigate to Findings and Alerts.
**Expected:** A new finding titled "Compliance gap: {framework name}" appears with status "open". An alert appears in the alert bell with type "compliance_threshold_breach". Then lower threshold below current score — finding and alert auto-resolve.
**Why human:** Requires live server, authenticated session, and database state verification.

#### 3. Auto-Map Approval Dialog with AI Suggestions

**Test:** Log in as admin. Navigate to Compliance > Controls. Click "Auto-Map" on a control that has a non-trivial description. Dialog opens. Verify requirement suggestions appear with similarity percentage badges. Select some suggestions. Click "Apply Selected". Verify control now maps to those requirements.
**Expected:** Suggestions list is non-empty (requires working embedding provider); selected mappings are applied.
**Why human:** Requires live pgvector embeddings, running LLM provider, and observable state.

#### 4. PDF Export Download

**Test:** Open a framework detail page. Click "Export PDF". Verify browser downloads a file named `{framework-name}-compliance-report.pdf`. Open the PDF and verify it contains an executive summary page with score ring data and a gap details table.
**Expected:** PDF file is valid, contains framework name, compliance score, coverage/effectiveness breakdown, and gap requirement rows.
**Why human:** PDF rendering via @react-pdf/renderer requires visual inspection; download behavior cannot be tested headlessly.

---

### Gaps Summary

One gap blocks clean TypeScript compilation in the frontend. The gap is cosmetic in nature — the runtime behavior is unaffected because JavaScript does not enforce TypeScript types at runtime and the API does return the `status` field. However, it represents an incorrect type usage that should be fixed.

**Root cause:** `handleExportPdf` in `framework-detail.tsx` builds `scoreData` using the base `score` variable (from `useGetComplianceScore`, typed as the generated `ComplianceScore` which lacks `status`) rather than `scoreExt` (the cast `ComplianceScoreExtended` that includes `status`). The fix is a single character change on line 257: replace `score.status` with `scoreExt?.status`.

All other phase 13 deliverables are fully implemented, substantive, and correctly wired:
- Both core library modules pass 26 unit tests
- All 7 new backend endpoints are present and use the library functions
- Assessment submit and control test create both trigger the pipeline
- All 4 frontend components are non-trivial with real fetch calls and full UI state management
- Requirements COMP-01, COMP-02, COMP-03 are all satisfied by the implementation

---

_Verified: 2026-03-25T13:56:00Z_
_Verifier: Claude (gsd-verifier)_
