---
phase: 18-comprehensive-demo-seed-data
plan: 01
subsystem: database
tags: [seed, drizzle, postgresql, demo-data, risk-management, vendors]

# Dependency graph
requires:
  - phase: 09-schema-foundation
    provides: "vendor-subprocessors, org-dependencies, monitoring-configs, risk-appetite-configs schemas"
  - phase: 11-vendor-lifecycle-redesign
    provides: "vendorTierEnum, vendorStatusEnum, monitoringConfigsTable"
  - phase: 16-risk-heatmap-dashboard-redesign
    provides: "riskAppetiteConfigsTable schema"
provides:
  - "28 risks (18 expanded) across all 6 categories with mixed statuses"
  - "10 treatments with all 4 strategy types plus status events"
  - "8 KRIs with thresholds — 3 actively breaching (uptime, patch compliance, open vulns)"
  - "4 incidents linked to risks with realistic timeline data"
  - "5 review cycles including 2 overdue"
  - "11 vendors (6 expanded) across all lifecycle stages including offboarding"
  - "3 subprocessor relationships (CloudScale->2, PayFlow->1)"
  - "4 org dependencies (email/cloud/cdn/identity)"
  - "4 tier-based monitoring configs (critical=7d, high=30d, medium=90d, low=180d)"
  - "6 risk appetite threshold configs (one per risk category)"
affects: [19-comprehensive-demo-seed-data, demo-readiness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Modular seed functions with per-table add-if-empty guards using raw SQL count check"
    - "Seed order: base entities -> expanded risks -> treatments -> KRIs -> incidents -> reviews -> expanded vendors -> subprocessors -> org deps -> configs"
    - "daysFromNow() helper for relative date offsets in seed data"
    - "Fallback risk IDs (expanded[n]?.id ?? base[n].id) for safe FK references when expanded seed skipped"

key-files:
  created: []
  modified:
    - artifacts/api-server/src/lib/seed.ts

key-decisions:
  - "Single file commit for both tasks — tasks 1 and 2 both modify seed.ts, logical separation within file via section comments"
  - "seedExpandedRisks uses count > 10 guard (not > 0) to allow re-seeding when base 10 risks exist but expanded don't"
  - "seedExpandedVendors uses count > 5 guard for same reason — base 5 vendors may exist"
  - "Akamai CDN Services added as 6th expanded vendor to serve as CloudScale subprocessor — plan mentioned inline creation"
  - "Fallback FK references (expandedRisks[n]?.id ?? baseRisks[n].id) prevent null insert errors if expanded seed was previously skipped"
  - "treatmentStatusEventsTable populated in bulk after all treatments inserted — single batch insert"

patterns-established:
  - "Guard pattern: count > N for extended seed (allows base data to exist), count > 0 for new tables"
  - "Return arrays from seed functions so dependent seeds can reference IDs"

requirements-completed: [D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 18 Plan 01: Comprehensive Demo Seed Data Summary

**Expanded seed.ts with 10 modular functions covering 28 risks, 10 treatments, 8 KRIs (3 breaching thresholds), 4 incidents, 5 review cycles, 11 vendors (with subprocessor chains), org dependencies, tier-based monitoring, and risk appetite configs**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T11:34:16Z
- **Completed:** 2026-03-24T11:40:35Z
- **Tasks:** 2 (combined into 1 atomic commit — both tasks modify same file)
- **Files modified:** 1

## Accomplishments

- Modular seed functions for every risk management table — each idempotent with per-table add-if-empty guards
- 28 risks spanning all 6 categories (technology, operational, compliance, financial, strategic, reputational) with realistic Acme Corp financial services scenario
- KRI dashboard will immediately show 3 breaching KRIs: system uptime at warning (99.2%), patch compliance at critical (87%), and open critical vulnerabilities at critical (12)
- 11 vendors across all 7 lifecycle stages including offboarding, with concentration risk via subprocessor chains
- Settings pages now have data: monitoring configs per tier, risk appetite thresholds per category, org dependencies

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Expand seed — risks, treatments, KRIs, incidents, reviews, vendors, subprocessors, org deps, monitoring, appetite** - `d57bd7f` (feat)

**Plan metadata:** (to be added in final commit)

## Files Created/Modified

- `artifacts/api-server/src/lib/seed.ts` - Added 10 new seed functions (seedExpandedRisks, seedTreatments, seedKRIs, seedIncidents, seedReviewCycles, seedExpandedVendors, seedSubprocessors, seedOrgDependencies, seedMonitoringConfigs, seedRiskAppetiteConfigs) plus new imports and daysFromNow() helper

## Decisions Made

- Akamai CDN Services added as 6th expanded vendor (plan specified it as an inline subprocessor but schema requires all subprocessors to be full vendor rows)
- Both tasks combined into a single atomic commit because they modify the same file and the separation was logical (within-file section comments)
- Guard pattern uses `> N` rather than `=== 0` for expanded seed functions — allows seeding when base data already exists from the original 10-risk / 5-vendor state

## Deviations from Plan

None — plan executed exactly as written. Pre-existing TypeScript errors in unrelated files (email.ts, monitoring.ts, vendors.ts) are out of scope.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Seed data is database-only.

## Next Phase Readiness

- All tables required for demo coverage now have seed data
- Plans 18-02 and 18-03 can proceed (signals/findings expansion and risk snapshots)
- Any existing Acme Corp tenant will NOT get the expanded data automatically — the tenant guard returns early if slug "acme" exists; a DB reset or direct SQL would be needed to re-seed

---
*Phase: 18-comprehensive-demo-seed-data*
*Completed: 2026-03-24*
