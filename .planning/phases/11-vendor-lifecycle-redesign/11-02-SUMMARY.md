---
phase: 11-vendor-lifecycle-redesign
plan: "02"
subsystem: api
tags: [express, drizzle, postgres, vendor, subprocessors, org-dependencies, monitoring, job-queue, alerting]

# Dependency graph
requires:
  - phase: 09-schema-foundation
    provides: "vendor_subprocessors, org_dependencies, monitoring_configs tables; alertsTable; vendorTierEnum"
  - phase: 10-assessment-engine
    provides: "assessmentsTable for idempotent vendor-monitor worker"
  - phase: 11-01
    provides: "wizard onboarding endpoints, verifyVendorOwnership helper, vendor transition handler"
provides:
  - "Subprocessor CRUD endpoints (GET/POST/DELETE) on /v1/vendors/:id/subprocessors"
  - "LLM extraction endpoint /v1/vendors/:id/extract-subprocessors"
  - "Org dependencies CRUD on /v1/org-dependencies"
  - "Concentration risk endpoint /v1/org-dependencies/concentration-risk"
  - "Monitoring config upsert/delete per tier on /v1/monitoring-configs/:tier"
  - "vendor-monitor job worker with idempotent assessment creation and threshold alerting"
  - "scoreThreshold column on monitoring_configs table"
affects: [11-03, 11-04, 12-signal-integrations, 13-compliance-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "registerWorker at module scope (not in request handler) — worker lifecycle matches module"
    - "aliasedTable for self-join on vendorsTable (subprocessors use same table)"
    - "onConflictDoUpdate with composite target for upsert on unique index"
    - "Correlated subquery for count in SELECT to avoid N+1 in concentration-risk"
    - "HAVING count > 1 pattern for concentration risk detection"

key-files:
  created:
    - "artifacts/api-server/src/routes/org-dependencies.ts"
    - "artifacts/api-server/src/routes/monitoring.ts"
  modified:
    - "artifacts/api-server/src/routes/vendors.ts"
    - "artifacts/api-server/src/routes/index.ts"
    - "lib/db/src/schema/monitoring-configs.ts"

key-decisions:
  - "aliasedTable (not alias) is the correct Drizzle 0.45 API for table aliases — alias is not exported from drizzle-orm main index"
  - "vendor-monitor worker skips assessment creation when no assessmentTemplateId configured on the tier's monitoring config"
  - "concentration-risk route placed before /:id route to prevent Express path conflict"
  - "scoreThreshold nullable (no .notNull()) — null means no threshold alerting for that tier"

patterns-established:
  - "Subprocessor conflict: catch PostgreSQL 23505 unique violation and return 409 with 'already linked' message"
  - "LLM extraction returns candidate array — caller decides what to save (fire-and-suggest, not auto-save)"
  - "Monitoring trigger in transition handler checks for existing monitoring config before enqueueing first cycle"

requirements-completed: [VNDR-03, VNDR-04, VNDR-06, VNDR-07]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 11 Plan 02: Backend APIs for Subprocessors, Org Dependencies, Monitoring Summary

**Subprocessor CRUD, org dependency CRUD with concentration risk, and monitoring config CRUD with vendor-monitor job worker that performs idempotent assessments and threshold breach alerting**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-23T15:33:15Z
- **Completed:** 2026-03-23T15:37:58Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Subprocessor CRUD endpoints added to vendors.ts with LLM extraction from vendor documents
- New org-dependencies.ts route with full CRUD and concentration risk detection (HAVING count > 1)
- New monitoring.ts route with per-tier config upsert, vendor-monitor worker (idempotency guard, threshold alerting, next-cycle scheduling), and monitoring trigger in vendor transition handler
- scoreThreshold column added to monitoring_configs schema and pushed to database

## Task Commits

1. **Task 1: Subprocessor CRUD and LLM extraction** - `fabb5df` (feat)
2. **Task 2: Org dependencies CRUD and concentration risk** - `d0e5700` (feat)
3. **Task 3: scoreThreshold schema + monitoring.ts + transition trigger** - `4b54991` (feat)

## Files Created/Modified

- `artifacts/api-server/src/routes/vendors.ts` - Added subprocessor CRUD, extract-subprocessors, monitoring trigger in transition handler
- `artifacts/api-server/src/routes/org-dependencies.ts` - New: org dependency CRUD + concentration risk endpoint
- `artifacts/api-server/src/routes/monitoring.ts` - New: monitoring config CRUD + vendor-monitor worker with threshold alerting
- `artifacts/api-server/src/routes/index.ts` - Registered orgDependenciesRouter and monitoringRouter
- `lib/db/src/schema/monitoring-configs.ts` - Added scoreThreshold nullable integer column

## Decisions Made

- `aliasedTable` (not `alias`) is the Drizzle 0.45 export for table aliases — `alias` is absent from the main index
- vendor-monitor worker does not create assessment when `assessmentTemplateId` is null on the config, to avoid orphaned assessments without templates
- Concentration-risk route placed before `/:id` to prevent Express path conflict
- scoreThreshold nullable: null means the tier has no alerting threshold configured

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used aliasedTable instead of alias for vendor self-join**
- **Found during:** Task 1 (subprocessor list endpoint)
- **Issue:** Plan specified `alias` from drizzle-orm but Drizzle 0.45 exports `aliasedTable`, not `alias`; build failed with "No matching export"
- **Fix:** Changed import and usage from `alias(vendorsTable, "sub_vendor")` to `aliasedTable(vendorsTable, "sub_vendor")`
- **Files modified:** artifacts/api-server/src/routes/vendors.ts
- **Verification:** Build passed cleanly after fix
- **Committed in:** fabb5df (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - import name correction)
**Impact on plan:** Trivial correction; no scope change.

## Issues Encountered

- db:push requires DATABASE_URL env var — ran with explicit env: `DATABASE_URL=... pnpm --filter db push`

## Next Phase Readiness

- All Phase 11 backend APIs now exist: wizard (11-01), subprocessors/org-deps/monitoring (11-02)
- Phase 11-03 (UI for vendor lifecycle redesign) can consume all these endpoints
- vendor-monitor worker is registered and ready to fire when jobs are claimed by the scheduler

---
*Phase: 11-vendor-lifecycle-redesign*
*Completed: 2026-03-23*
