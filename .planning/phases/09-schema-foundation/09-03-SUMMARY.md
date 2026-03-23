---
phase: 09-schema-foundation
plan: "03"
subsystem: database
tags: [drizzle, postgres, schema, relations, pgvector, views]

# Dependency graph
requires:
  - phase: 09-01
    provides: assessments, integration-configs, foresight schema files
  - phase: 09-02
    provides: vendor-subprocessors, org-dependencies, monitoring-configs schema files

provides:
  - Drizzle barrel exports for all 6 new v2.0 schema files
  - relations.ts with 8 Drizzle relation objects for relational queries
  - db instance merged with relations for db.query.* access
  - questionnaires_v2 compatibility view mapping new assessments to legacy columns
  - All 8 new v2.0 tables live in PostgreSQL (applied via drizzle-kit push)
  - New columns on signals (content_hash), vendors (next_assessment_due), frameworks (compliance_threshold) applied

affects: [10-assessment-engine, 11-vendor-lifecycle, 12-signal-integrations, 13-compliance-flow, 14-foresight-v2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Drizzle relations defined in separate relations.ts file and merged into db instance schema
    - Named relations required for dual FK to same table (vendorSubprocessorRelations)
    - Bootstrap guards view creation on table existence check for first-run safety
    - questionnaires_v2 view uses a.assessment_status (not a.status) — enum column keeps full name

key-files:
  created:
    - lib/db/src/relations.ts
  modified:
    - lib/db/src/schema/index.ts
    - lib/db/src/index.ts
    - lib/db/src/bootstrap.ts

key-decisions:
  - "questionnaires_v2 named with _v2 suffix to avoid conflict with existing questionnaires table — Phase 10 renames after old table drop"
  - "bootstrap.ts guards view creation with table existence check so pnpm push works on first run without failing"
  - "assessment_status column name (not 'status') discovered during view creation — Drizzle uses the pgEnum call name as the column name"

patterns-established:
  - "Relations separated from schema files into lib/db/src/relations.ts for clean organization"
  - "db instance always uses { ...schema, ...relations } spread pattern"
  - "Bootstrap guards dependent SQL with table presence checks for idempotent first-run safety"

requirements-completed:
  - "Foundation for ASMT-01-07"
  - "Foundation for VNDR-01-07"
  - "Foundation for COMP-01-03"
  - "Foundation for SGNL-01-05"
  - "Foundation for FRST-01-05"

# Metrics
duration: 4min
completed: "2026-03-23"
---

# Phase 9 Plan 03: Schema Wiring and Database Push Summary

**Drizzle barrel exports, 8 relation objects, questionnaires_v2 compatibility view, and all v2.0 schema applied to PostgreSQL via drizzle-kit push**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-23T12:13:32Z
- **Completed:** 2026-03-23T12:17:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Updated schema/index.ts to export all 6 new v2.0 schema files (35 total exports)
- Created relations.ts with 8 Drizzle relation objects covering all v2.0 table relationships with proper self-referential naming for vendorSubprocessors
- Wired db instance to merge relations into schema enabling db.query.* relational queries
- Added questionnaires_v2 compatibility view to bootstrap.ts mapping assessments to legacy questionnaire column names
- Applied all 8 new tables, 8 new columns, and partial unique index via drizzle-kit push with zero errors
- TypeScript compilation clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Update barrel exports, create relations.ts, wire db instance** - `45ec5e0` (feat)
2. **Task 2: Add compatibility view to bootstrap.ts, push schema, verify** - `bfae5d7` (feat)

## Files Created/Modified

- `lib/db/src/schema/index.ts` - Added 6 v2.0 schema barrel exports after existing 29 exports
- `lib/db/src/relations.ts` - New file: 8 Drizzle relation objects for all v2.0 tables
- `lib/db/src/index.ts` - Added relations import, merged into db schema spread
- `lib/db/src/bootstrap.ts` - Added questionnaires_v2 view with table existence guard

## Decisions Made

- Named the view `questionnaires_v2` (not `questionnaires`) to avoid conflict with the still-existing questionnaires table — Phase 10 will rename after dropping the old table
- Added a table existence guard in bootstrap.ts so the first `pnpm push` succeeds without failing on a missing table reference; a second push (or pnpm bootstrap) creates the view
- Discovered the status column in assessments is named `assessment_status` in the DB (Drizzle uses the pgEnum call name, not the TypeScript property name) — corrected in view SQL

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] View creation sequencing in bootstrap.ts**
- **Found during:** Task 2 (Add compatibility view to bootstrap.ts)
- **Issue:** bootstrap.ts runs BEFORE drizzle-kit push, so the CREATE VIEW failed with "relation assessments does not exist" on first run
- **Fix:** Added table existence check — view only created if both assessments and assessment_templates tables exist; prints deferred message otherwise
- **Files modified:** lib/db/src/bootstrap.ts
- **Verification:** First pnpm push succeeded without error; second run (or pnpm bootstrap) created the view cleanly
- **Committed in:** bfae5d7 (Task 2 commit)

**2. [Rule 1 - Bug] Wrong column name in view SQL**
- **Found during:** Task 2 (second push attempt after tables created)
- **Issue:** View used `a.status` but the actual DB column is `a.assessment_status` (Drizzle uses the pgEnum second argument as the column name)
- **Fix:** Updated view SQL to use `a.assessment_status::text AS questionnaire_status`
- **Files modified:** lib/db/src/bootstrap.ts
- **Verification:** View created successfully, queryable with `SELECT * FROM questionnaires_v2 LIMIT 0`
- **Committed in:** bfae5d7 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs in generated view SQL)
**Impact on plan:** Both auto-fixes necessary for correctness. Column name discovery was a schema inspection artifact. No scope creep.

## Issues Encountered

- Drizzle's pgEnum column naming: when defining `status: assessmentStatusEnum("assessment_status")`, the DB column name is `assessment_status`, not `status`. This matters when writing raw SQL views or queries referencing the column directly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 9 schema is live in PostgreSQL with zero errors
- Drizzle query builder has full relational access to all v2.0 tables via db.query.*
- questionnaires_v2 compatibility view exists for legacy route support during Phase 10 migration
- Phase 10 (Assessment Engine) can proceed — all foundational tables, enums, and indexes are in place
- Pending: Phase 10 should update the INSERT path at vendors.ts:437 to use assessmentsTable, then drop the old questionnaires table and rename questionnaires_v2 → questionnaires

---
*Phase: 09-schema-foundation*
*Completed: 2026-03-23*
