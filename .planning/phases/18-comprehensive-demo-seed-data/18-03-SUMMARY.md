---
phase: 18-comprehensive-demo-seed-data
plan: "03"
subsystem: database
tags: [seed, drizzle, postgres, dashboard, risk-snapshots, time-series]

# Dependency graph
requires:
  - phase: 18-02
    provides: Findings, expanded signals, and assessments seeded — all FK dependencies present for snapshots
provides:
  - 90-day historical risk snapshot time series with realistic composite score progression
  - seedRiskSnapshots() function with idempotency guard
  - Complete seed.ts covering all 20 demo data decisions (D-01 through D-20)
affects:
  - dashboard KRI trend chart
  - composite risk score trend display
  - any future analytics or reporting relying on risk_snapshots table

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Deterministic time-series seed using dayIndex-keyed linear interpolation + sine noise (no Math.random())
    - Batch insert pattern for bulk historical data (single db.insert().values(array) call)
    - count(*) === 0 idempotency guard for snapshot table

key-files:
  created: []
  modified:
    - artifacts/api-server/src/lib/seed.ts

key-decisions:
  - "Deterministic sine-wave noise formula: baseScore + 2 * Math.sin(dayIndex * 0.7) — reproducible across repeated seed runs without random()"
  - "Score spike at dayOffset===45 treated as special case constant (78) to guarantee exact phishing incident peak"
  - "Batch single db.insert() for all 90 snapshots — avoids 90 round-trips"
  - "riskSnapshotsTable added as last import in block — seed function called last in seedDemoDataIfEmpty()"

patterns-established:
  - "Deterministic historical data: use dayIndex-based interpolation + Math.sin() for noise instead of Math.random()"
  - "Category breakdown varies with composite score via scale factor: (score - baseline) / range"

requirements-completed: [D-01, D-02, D-03, D-20]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 18 Plan 03: Historical Risk Snapshots Summary

**90-day deterministic composite score time series seeded with phishing incident spike at day 45, per-category breakdowns, and idempotent batch insert**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-24T11:53:23Z
- **Completed:** 2026-03-24T11:58:26Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `riskSnapshotsTable` import and `seedRiskSnapshots()` to `seed.ts`
- Implemented 90-day score progression curve: 72→58 gradual improvement, spike to 78 at day 45 (phishing campaign incident), rapid recovery 78→62 (days 44-31), gradual improvement 62→52 (days 30-1)
- Per-category breakdowns (technology, operational, compliance, financial, strategic, reputational) that correlate with composite score — technology consistently highest, jumps to 85 during spike
- Deterministic noise via `2 * Math.sin(dayIndex * 0.7)` — identical on every run
- Verified complete seed order (FK dependencies respected), idempotency guards on all 15+ table inserts, 34 `[Seed]` log lines, all imports present

## Task Commits

1. **Task 1: Seed 90 days of historical risk snapshots** - `5a4ebca` (feat)
2. **Task 2: Verify complete seed order and idempotency** - No code changes needed (review confirmed correct)

## Files Created/Modified

- `/home/dante/RiskMind2/artifacts/api-server/src/lib/seed.ts` - Added `riskSnapshotsTable` import, `seedRiskSnapshots()` function, and call as last step in `seedDemoDataIfEmpty()`

## Decisions Made

- Deterministic sine-wave noise instead of `Math.random()` — ensures repeated seeding produces identical data, which is essential for test reproducibility and idempotency verification
- Score spike at `dayOffset === 45` is a hardcoded constant (78) rather than formula-derived — guarantees exact incident peak matching plan specification
- Single batch insert of all 90 rows — more efficient than per-row inserts
- `seedRiskSnapshots()` called as the very last function in `seedDemoDataIfEmpty()` — snapshots are standalone (no FK to other seed data), so ordering is safe and clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `db.execute()` destructuring pattern**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Used `const [existing] = await db.execute<...>(...)` but `db.execute()` returns a `QueryResult` (not iterable) — required `.rows[0]` access pattern
- **Fix:** Changed to `const countResult = await db.execute(...)` then `(countResult.rows[0] as { cnt: number }).cnt` — matching the established pattern from other seed functions
- **Files modified:** `artifacts/api-server/src/lib/seed.ts`
- **Verification:** TypeScript compilation produced zero errors in seed.ts
- **Committed in:** `5a4ebca` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary for TypeScript correctness. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `email.ts`, `monitoring.ts`, and `vendors.ts` are unrelated to this plan and were present before this execution. Not fixed per scope boundary rule.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 18 (comprehensive-demo-seed-data) is fully complete: all 3 plans executed
- Dashboard KRI trend chart and composite risk score trend will show 90 days of meaningful historical data after running seed
- Complete seed covers all 20 decisions (D-01 through D-20) as specified
- Seed is idempotent — safe to run multiple times

---
*Phase: 18-comprehensive-demo-seed-data*
*Completed: 2026-03-24*
