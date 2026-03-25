---
phase: 13-compliance-flow
plan: "01"
subsystem: compliance
tags: [compliance, import, pipeline, schema, tdd]
dependency_graph:
  requires: [13-00]
  provides: [compliance-import, compliance-pipeline, control-tests-evidence-schema]
  affects: [artifacts/api-server/src/lib, lib/db/src/schema/control-tests]
tech_stack:
  added: [papaparse, multer, "@types/multer", "@types/papaparse"]
  patterns: [TDD-red-green, idempotent-pipeline, threshold-driven-findings]
key_files:
  created:
    - artifacts/api-server/src/lib/compliance-import.ts
    - artifacts/api-server/src/lib/compliance-pipeline.ts
    - artifacts/api-server/tests/compliance-import.test.ts
    - artifacts/api-server/tests/compliance-pipeline.test.ts
  modified:
    - lib/db/src/schema/control-tests.ts
    - artifacts/api-server/package.json
    - pnpm-lock.yaml
decisions:
  - papaparse default import lacks TS default export — project's skipLibCheck=true resolves at build time; import works correctly at runtime
  - compliance-pipeline uses inArray for multi-status filtering (open/investigating) to stay compatible with pgEnum constraints
  - recalculateAndTriggerPipeline checks existing finding before inserting; also deduplicates alert via title+type+active check
  - computeComplianceScore extracted from compliance.ts with identical formula so routes and pipeline stay in sync
metrics:
  duration: 567s
  completed: "2026-03-25"
  tasks_completed: 3
  files_changed: 7
---

# Phase 13 Plan 01: Deps, Schema, and Core Library Files Summary

Installed papaparse+multer, extended control_tests schema with evidence tracking columns, and created the two foundation library files — compliance-import.ts and compliance-pipeline.ts — that all subsequent compliance flow plans depend on.

## Tasks Completed

| # | Name | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Install deps, extend control_tests schema, push migration | 3690837 | papaparse+multer installed, 3 evidence columns added to control_tests, schema pushed |
| 2 | Create compliance-import.ts (TDD GREEN) | 9d59cfb | parseCsv, parseJson, computeDiff, resolveParentCodes — 15 unit tests pass |
| 3 | Create compliance-pipeline.ts (TDD GREEN) | 8c77002 | computeComplianceScore, getComplianceStatus, recalculateAndTriggerPipeline — 11 unit tests pass |

## Acceptance Criteria Met

- [x] `lib/db/src/schema/control-tests.ts` contains `evidenceExpiry`, `evidenceFileName`, `evidenceMimeType`
- [x] `artifacts/api-server/package.json` contains `papaparse` and `multer` in dependencies
- [x] `pnpm db:push` completed without error
- [x] `compliance-import.ts` exports `parseCsv`, `parseJson`, `computeDiff`, `resolveParentCodes`
- [x] `compliance-pipeline.ts` exports `computeComplianceScore`, `getComplianceStatus`, `recalculateAndTriggerPipeline`
- [x] Contains `coverageScore * 0.6` and `effectivenessScore * 0.4` (exact formula)
- [x] Contains `"Compliance gap: "` title pattern for idempotency
- [x] Contains `"compliance_threshold_breach"` alert type
- [x] Contains `status: "draft"` (risk draft creation)
- [x] Contains `status: "resolved"` (auto-resolve on recovery)
- [x] 26/26 unit tests pass GREEN

## Key Design Details

**compliance-import.ts:**
- `parseCsv`: PapaParse with BOM stripping, header normalization (`toLowerCase + trim`), validates required `code`/`title` columns with descriptive errors
- `parseJson`: Zod-validated recursive flattening — children inherit `parentCode` from parent's `code`
- `computeDiff`: additive-only (no "deleted") — preserves existing requirements not in incoming
- `resolveParentCodes`: two-pass resolution maps string `parentCode` to UUID `parentId`

**compliance-pipeline.ts:**
- Score formula exactly matches compliance.ts: `Math.round(coverageScore * 0.6 + effectivenessScore * 0.4)`
- Threshold classification: COMPLIANT (≥ threshold), AT-RISK (≥ threshold−15), NON-COMPLIANT (< threshold−15)
- Idempotency on breach: checks `findingsTable` for open/investigating finding with same title before inserting
- Alert deduplication: same pattern as `monitoring.ts` — checks active alert with matching type+title
- Auto-resolve on recovery: bulk-updates findings and alerts matching title pattern to `resolved`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both library files are fully implemented pure-logic modules with no UI rendering.

## Self-Check: PASSED

- compliance-import.ts: FOUND
- compliance-pipeline.ts: FOUND
- compliance-import.test.ts: FOUND
- compliance-pipeline.test.ts: FOUND
- SUMMARY.md: FOUND
- Commit 3690837: FOUND
- Commit 9d59cfb: FOUND
- Commit 8c77002: FOUND
