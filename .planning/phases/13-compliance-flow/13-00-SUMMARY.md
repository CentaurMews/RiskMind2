---
phase: 13-compliance-flow
plan: "00"
subsystem: testing
tags: [vitest, compliance, tdd, unit-tests, csv-parsing, json-parsing]

requires:
  - phase: 10-assessment-engine
    provides: scoring.test.ts patterns (describe/it/expect with vitest)
  - phase: 09-schema-foundation
    provides: framework_requirements, controls, frameworks schema with complianceThreshold

provides:
  - TDD RED-phase test scaffolds for compliance-import and compliance-pipeline modules
  - Behavioral contract for parseCsv, parseJson, computeDiff, resolveParentCodes
  - Behavioral contract for getComplianceStatus, computeComplianceScore, recalculateAndTriggerPipeline
  - 20 test cases defining compliance-flow correctness requirements

affects:
  - 13-01 (implements compliance-import.ts and compliance-pipeline.ts to make these tests GREEN)

tech-stack:
  added: []
  patterns:
    - "vi.mock('@workspace/db') for unit-testing DB-dependent pipeline functions"
    - "Buffer.from(csvString) to create test file buffers for CSV parsers"
    - "@/lib/* alias for test imports matching vitest.config.ts path alias"

key-files:
  created:
    - artifacts/api-server/tests/compliance-import.test.ts
    - artifacts/api-server/tests/compliance-pipeline.test.ts
  modified: []

key-decisions:
  - "DB-dependent functions (computeComplianceScore, recalculateAndTriggerPipeline) tested via vi.mock('@workspace/db') with chained mock returns"
  - "getComplianceStatus is pure function — tested without mocks; AT-RISK band is threshold-15 to threshold"
  - "computeDiff additive-only (D-05) verified: existing items absent from incoming must NOT appear in any diff category"

patterns-established:
  - "vi.mock chained mock pattern: mockDb.select.mockReturnValueOnce({ from: fn, where: fn, groupBy: fn }) for Drizzle query chain simulation"

requirements-completed: [COMP-01, COMP-02, COMP-03]

duration: 3min
completed: 2026-03-25
---

# Phase 13 Plan 00: Compliance Flow — Test Scaffolds Summary

**Vitest RED-phase scaffolds for compliance-import (CSV/JSON parsing + diff) and compliance-pipeline (scoring formula + threshold-driven findings) with 20 test cases defining the behavioral contract**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-25T13:15:00Z
- **Completed:** 2026-03-25T13:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `compliance-import.test.ts` with 16 test cases covering parseCsv, parseJson, computeDiff, resolveParentCodes — failing in RED state since compliance-import.ts does not yet exist
- Created `compliance-pipeline.test.ts` with 9 test cases covering getComplianceStatus (pure), computeComplianceScore (mocked DB), recalculateAndTriggerPipeline (mocked DB) — failing in RED state
- Verified both test files fail with correct "Cannot find package" import errors — confirms RED state is a missing module error, not a test logic error

## Task Commits

Each task was committed atomically:

1. **Task 1: Create compliance-import.test.ts test scaffold** - `729b5c4` (test)
2. **Task 2: Create compliance-pipeline.test.ts test scaffold** - `4f62e9e` (test)

## Files Created/Modified

- `artifacts/api-server/tests/compliance-import.test.ts` — Unit tests for parseCsv (5), parseJson (3), computeDiff (5), resolveParentCodes (3). 16 total test cases covering COMP-01 behaviors.
- `artifacts/api-server/tests/compliance-pipeline.test.ts` — Unit tests for getComplianceStatus (5), computeComplianceScore (2), recalculateAndTriggerPipeline (4). 11 total test cases covering COMP-02 and COMP-03 behaviors.

## Decisions Made

- Used `vi.mock("@workspace/db")` with chained `mockReturnValueOnce` to simulate Drizzle ORM query builder chains (`select().from().where().groupBy()`) without spawning a real database
- `getComplianceStatus` tested as pure function — no mocks needed; edge cases confirm AT-RISK band is `[threshold-15, threshold)` and COMPLIANT is `>= threshold`
- `computeDiff` additive-only invariant (D-05) explicitly asserted: codes present only in `existing` (not in `incoming`) must not appear in `new`, `modified`, or `unchanged`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The worktree at `/home/dante/RiskMind2/.claude/worktrees/agent-a6c59243` does not have its own `node_modules`. Vitest was verified against the main repo's vitest binary (`/home/dante/RiskMind2/artifacts/api-server/node_modules/.bin/vitest`) with test files temporarily copied to confirm RED state. This is expected for worktree-based parallel execution.

## Next Phase Readiness

- Test scaffolds are in place and in RED state
- Plan 01 can now implement `src/lib/compliance-import.ts` and `src/lib/compliance-pipeline.ts` to make these tests GREEN
- Both test files import via `@/lib/` alias which resolves to `artifacts/api-server/src/lib/` per vitest.config.ts

## Self-Check

- `artifacts/api-server/tests/compliance-import.test.ts` — FOUND
- `artifacts/api-server/tests/compliance-pipeline.test.ts` — FOUND
- Commit `729b5c4` — FOUND (compliance-import test scaffold)
- Commit `4f62e9e` — FOUND (compliance-pipeline test scaffold)

## Self-Check: PASSED

---
*Phase: 13-compliance-flow*
*Completed: 2026-03-25*
