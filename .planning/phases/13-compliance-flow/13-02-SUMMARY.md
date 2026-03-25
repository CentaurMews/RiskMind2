---
phase: 13-compliance-flow
plan: 02
subsystem: api
tags: [compliance, multer, papaparse, pgvector, express, drizzle]

requires:
  - phase: 13-compliance-flow/13-01
    provides: compliance-import.ts (parseCsv, parseJson, computeDiff, resolveParentCodes), compliance-pipeline.ts (recalculateAndTriggerPipeline, computeComplianceScore, getComplianceStatus), evidence columns on control_tests
provides:
  - POST /v1/frameworks — create framework with name validation
  - POST /v1/frameworks/:id/import/preview — diff preview without DB writes
  - POST /v1/frameworks/:id/import/apply — additive import with two-pass parent resolution
  - PUT /v1/frameworks/:id/threshold — threshold update with non-blocking pipeline trigger
  - GET /v1/frameworks/:frameworkId/export/csv — requirements export with gap analysis data
  - POST /v1/controls/:id/auto-map-suggestions — pgvector cosine similarity (threshold 0.65)
  - Extended POST /v1/controls/:controlId/tests with multer evidence upload + pipeline trigger
  - Assessment submit hook triggering compliance pipeline for framework-context assessments (D-10)
affects: [13-03-frontend-compliance-ui, 13-04-compliance-testing]

tech-stack:
  added: []
  patterns:
    - "multer.memoryStorage() for import file parsing; multer.diskStorage() for evidence persistence"
    - "Two-pass parent code resolution: insert all rows first, then query codeToIdMap, then update parentIds"
    - "Non-blocking pipeline trigger via .catch(console.error) after test insert or threshold update"
    - "Graceful LLM fallback: LLMUnavailableError caught in auto-map-suggestions returns empty array"

key-files:
  created: []
  modified:
    - artifacts/api-server/src/routes/compliance.ts
    - artifacts/api-server/src/routes/assessments.ts
    - artifacts/api-server/src/lib/compliance-import.ts
    - artifacts/api-server/tsconfig.json

key-decisions:
  - "Two-pass parent code resolution chosen over single-pass: first insert all new rows, then query code->id map, then update parentIds — avoids ordering dependency"
  - "evidenceUpload (disk) and importUpload (memory) are separate multer instances — evidence needs persistence, import needs buffer in-memory for parsing"
  - "Auto-map suggestions return empty array on LLMUnavailableError — matching search.ts graceful degradation pattern"
  - "D-10 section-to-control tests are synchronous in submit handler (not async job) — low volume, bounded by number of sections"
  - "tsconfig types array extended with papaparse and multer — required because explicit types:[node] was blocking type resolution"

patterns-established:
  - "compliance-import.ts null→undefined normalization: description from DB is string|null, computeDiff expects string|undefined — normalize at call site with ?? undefined"

requirements-completed: [COMP-01, COMP-02, COMP-03]

duration: 25min
completed: 2026-03-25
---

# Phase 13 Plan 02: Compliance Flow API Routes Summary

**~10 new compliance REST endpoints wired to compliance-import/pipeline libraries, plus assessment submit hook with D-10 section-to-control test creation**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-25T00:00:00Z
- **Completed:** 2026-03-25
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added 7 new endpoints to compliance.ts covering import preview/apply, framework create, threshold update, CSV export, auto-map suggestions, and evidence upload
- Extended existing control test creation endpoint with multer evidence upload and pipeline trigger
- Extended compliance-score endpoint with getComplianceStatus label
- Added compliance pipeline hook to assessments.ts submit handler for framework-context assessments
- Implemented D-10 assessment-to-control effectiveness linkage (section scores feed control test records)

## Task Commits

1. **Task 1: Add import, create, threshold, export, evidence, and auto-map endpoints** - `35b886a` (feat)
2. **Task 2: Add compliance recalculation hook to assessment submit** - `679ffd0` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `artifacts/api-server/src/routes/compliance.ts` — 7+ new endpoints plus extended control test with evidence upload and pipeline trigger
- `artifacts/api-server/src/routes/assessments.ts` — compliance pipeline import + framework context hook + D-10 control test creation from section scores
- `artifacts/api-server/src/lib/compliance-import.ts` — fixed implicit-any type error in Papa.parse errors.map
- `artifacts/api-server/tsconfig.json` — added papaparse and multer to types array

## Decisions Made

- Two-pass parent code resolution: insert all rows first, then build codeToIdMap, then update parentIds — avoids FK-ordering dependency in single transaction
- Separate multer instances: `importUpload` (memoryStorage for buffer parsing) and `evidenceUpload` (diskStorage for file persistence)
- Auto-map suggestions return `{ suggestions: [] }` on LLMUnavailableError — graceful degradation matching search.ts pattern
- D-10 linkage is synchronous in submit handler wrapped in try/catch — bounded by section count, not a separate job

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed implicit-any type error in compliance-import.ts**
- **Found during:** Task 1 (build verification)
- **Issue:** Papa.parse result.errors.map((e) => e.message) — `e` had implicit any type
- **Fix:** Added explicit type annotation `(e: { message: string })`
- **Files modified:** artifacts/api-server/src/lib/compliance-import.ts
- **Verification:** tsc --noEmit passes for compliance files
- **Committed in:** 35b886a (Task 1 commit)

**2. [Rule 3 - Blocking] Added papaparse and multer to tsconfig types array**
- **Found during:** Task 1 (build verification)
- **Issue:** tsconfig had `"types": ["node"]` explicitly limiting type resolution; papaparse and multer types not visible
- **Fix:** Extended types array to `["node", "papaparse", "multer"]`
- **Files modified:** artifacts/api-server/tsconfig.json
- **Verification:** No TS2307 errors for papaparse/multer imports
- **Committed in:** 35b886a (Task 1 commit)

**3. [Rule 1 - Bug] Fixed null→undefined type mismatch in computeDiff call sites**
- **Found during:** Task 1 (build verification)
- **Issue:** DB returns `description: string | null` but computeDiff expects `{ description?: string }` — type error TS2345
- **Fix:** Added normalization `existingRows.map(r => ({ ...r, description: r.description ?? undefined }))` at both call sites
- **Files modified:** artifacts/api-server/src/routes/compliance.ts
- **Verification:** No TS2345 errors on computeDiff calls
- **Committed in:** 35b886a (Task 1 commit)

**4. [Rule 3 - Blocking] Merged local main into worktree to get 13-01 files**
- **Found during:** Task 1 start
- **Issue:** Worktree was on remote-main branch, missing compliance-import.ts and compliance-pipeline.ts from 13-01
- **Fix:** `git merge main` to bring 13-01 work into worktree branch
- **Files modified:** (all 13-01 files added to worktree)
- **Verification:** compliance-import.ts and compliance-pipeline.ts now present
- **Committed in:** merge commit (pre-task)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** All auto-fixes necessary for compilation and correctness. No scope creep.

## Issues Encountered

- Worktree was created from remote-main (missing 13-01 outputs) — resolved via git merge main
- `tsconfig.json` explicit `types:["node"]` blocked papaparse/multer type resolution — not a plan oversight, pre-existing tsconfig constraint

## Known Stubs

None — all endpoints are fully implemented.

## Next Phase Readiness

- All compliance REST endpoints available for frontend (13-03)
- Import preview/apply, threshold update, CSV export, auto-map suggestions all functional
- Evidence upload stores to `uploads/evidence/` with metadata in DB
- Assessment submit triggers compliance recalculation for framework context
- Control test creation triggers compliance pipeline for all mapped frameworks

---
*Phase: 13-compliance-flow*
*Completed: 2026-03-25*
