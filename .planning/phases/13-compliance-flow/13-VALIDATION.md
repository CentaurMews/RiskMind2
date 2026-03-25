# Phase 13: Compliance Flow - Validation

**Created:** 2026-03-25
**Source:** 13-RESEARCH.md Validation Architecture

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 (installed) |
| Config file | artifacts/api-server/vitest.config.ts (exists) |
| Quick run command | `cd artifacts/api-server && pnpm test --reporter=verbose --run` |
| Full suite command | `cd artifacts/api-server && pnpm test --run` |

---

## Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | CSV parsing with valid input returns correct RawRequirement[] | unit | `pnpm test --run tests/compliance-import.test.ts` | No - Wave 0 |
| COMP-01 | CSV parsing with missing required columns throws error | unit | `pnpm test --run tests/compliance-import.test.ts` | No - Wave 0 |
| COMP-01 | computeDiff returns correct new/modified/unchanged sets | unit | `pnpm test --run tests/compliance-import.test.ts` | No - Wave 0 |
| COMP-01 | Two-pass parentCode resolution correctly sets parentId | unit | `pnpm test --run tests/compliance-import.test.ts` | No - Wave 0 |
| COMP-02 | recalculateAndTriggerPipeline creates finding when score < threshold | unit | `pnpm test --run tests/compliance-pipeline.test.ts` | No - Wave 0 |
| COMP-02 | recalculateAndTriggerPipeline resolves finding when score >= threshold | unit | `pnpm test --run tests/compliance-pipeline.test.ts` | No - Wave 0 |
| COMP-02 | recalculateAndTriggerPipeline is idempotent (no duplicate findings) | unit | `pnpm test --run tests/compliance-pipeline.test.ts` | No - Wave 0 |
| COMP-03 | getComplianceStatus returns correct label based on score vs threshold | unit | `pnpm test --run tests/compliance-pipeline.test.ts` | No - Wave 0 |
| COMP-03 | PUT /v1/frameworks/:id/threshold updates complianceThreshold in DB | integration | manual | No |

---

## Wave 0 Gaps

Test files that must be created before TDD tasks in Plan 01 can run:

- [ ] `artifacts/api-server/tests/compliance-import.test.ts` -- covers COMP-01 (parseCsv, parseJson, computeDiff, resolveParentCodes)
- [ ] `artifacts/api-server/tests/compliance-pipeline.test.ts` -- covers COMP-02, COMP-03 (pipeline logic, idempotency, getComplianceStatus)

vitest.config.ts already exists and is configured for `tests/**/*.test.ts`.

---

## Sampling Rate

- **Per task commit:** `cd artifacts/api-server && pnpm test --run tests/compliance-import.test.ts tests/compliance-pipeline.test.ts`
- **Per wave merge:** `cd artifacts/api-server && pnpm test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`
