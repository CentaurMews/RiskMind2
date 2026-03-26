---
phase: 16-risk-heatmap-dashboard-redesign
verified: 2026-03-26T13:10:00Z
status: gaps_found
score: 9/10 must-haves verified
gaps:
  - truth: "Snapshot scheduler unit tests pass: empty-list returns 0, critical risks weighted 2x, upsert is idempotent"
    status: partial
    reason: "The 3 test cases (SNAP-01, SNAP-02, SNAP-03) are correctly written and import the right functions. The pure functions computeCompositeScore and buildCellCounts are correctly implemented. However, the test runner fails because risk-snapshot-scheduler.ts imports @workspace/db at module level, which throws 'DATABASE_URL must be set' before any test can execute. Tests cannot pass without a DB connection or a mock."
    artifacts:
      - path: "artifacts/api-server/src/lib/risk-snapshot-scheduler.ts"
        issue: "DB import is top-level (lines 2-8), triggering DATABASE_URL check at module import time, even though computeCompositeScore and buildCellCounts are pure functions with no DB dependencies"
      - path: "artifacts/api-server/tests/snapshot-scheduler.test.ts"
        issue: "Correctly imports computeCompositeScore and buildCellCounts, but the import chain reaches @workspace/db before the pure functions can be tested"
    missing:
      - "Either move computeCompositeScore and buildCellCounts to a separate pure-functions module (e.g., risk-snapshot-utils.ts) with no DB dependency, OR add a vitest.config.ts mock for @workspace/db that short-circuits the DATABASE_URL check for test environments"
---

# Phase 16: Risk Heatmap Dashboard Redesign Verification Report

**Phase Goal:** Full risk command center dashboard with KPI strip, split layout (heatmap + KRI trend), domain cards, daily snapshot system.
**Verified:** 2026-03-26T13:10:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | risk_snapshots and risk_appetite_configs tables exist in the database after drizzle push | ✓ VERIFIED | `lib/db/src/schema/risk-snapshots.ts` and `risk-appetite-configs.ts` exist; both exported from `schema/index.ts` |
| 2  | Midnight cron job captures daily snapshot of risk posture per tenant | ✓ VERIFIED | `startRiskSnapshotScheduler()` schedules `cron.schedule("0 0 * * *", ...)` and is called in `index.ts` |
| 3  | GET /v1/risks/dashboard returns posture score, above-appetite count, cells with deltas, domain summaries | ✓ VERIFIED | Route confirmed in `risks.ts`; response shape includes `postureScore`, `aboveAppetiteCount`, `aboveAppetiteDelta`, `cellDeltas`, `aboveAppetiteCells`, `domainSummaries` with sparklineData |
| 4  | GET /v1/risks/snapshots?range=6M returns time-series data for KRI trend | ✓ VERIFIED | Route confirmed; accepts `range` param (3M/6M/12M) and queries `riskSnapshotsTable` |
| 5  | GET /v1/risks/appetite returns per-category thresholds for tenant | ✓ VERIFIED | Route confirmed in `risks.ts`; queries `riskAppetiteConfigsTable` |
| 6  | PUT /v1/risks/appetite/:category upserts a threshold (admin only) | ✓ VERIFIED | Route confirmed with `requireRole("admin")` and `onConflictDoUpdate`; triggers snapshot recapture |
| 7  | Snapshot scheduler unit tests pass: empty-list returns 0, critical risks weighted 2x, upsert is idempotent | ✗ FAILED | Tests exist with correct logic (SNAP-01, SNAP-02, SNAP-03); pure functions are correctly implemented. However, top-level DB import in scheduler module causes `DATABASE_URL must be set` error before tests can execute |
| 8  | Risk heatmap page shows KPI strip, split heatmap+KRI layout, and domain cards strip | ✓ VERIFIED | `risk-heatmap.tsx` (501 lines): RiskPostureBar, KriTrendPanel, DomainCard, RiskHeatmapChart all present; `lg:grid-cols-5` + `lg:col-span-3` + `lg:col-span-2` split confirmed |
| 9  | Settings page has Risk Appetite tab for admins to configure per-category thresholds | ✓ VERIFIED | `TabsTrigger value="appetite"` and `TabsContent value="appetite"` present; admin-only gate via `user?.role === "admin"` |
| 10  | Sheet sidebar drill-down and URL deep linking still work | ✓ VERIFIED | 5 `SheetContent` instances in `risk-heatmap.tsx`; `URLSearchParams` preserved; `selectedCell` state wired |

**Score:** 9/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/db/src/schema/risk-snapshots.ts` | Daily risk posture snapshot table | ✓ VERIFIED | `riskSnapshotsTable` with uniqueIndex on (tenantId, snapshotDate) |
| `lib/db/src/schema/risk-appetite-configs.ts` | Per-category appetite threshold table | ✓ VERIFIED | `riskAppetiteConfigsTable` with uniqueIndex on (tenantId, category) |
| `artifacts/api-server/src/lib/risk-snapshot-scheduler.ts` | Midnight cron + pure functions | ✓ VERIFIED | `startRiskSnapshotScheduler`, `computeCompositeScore`, `buildCellCounts`, `onConflictDoUpdate` all present |
| `artifacts/api-server/tests/snapshot-scheduler.test.ts` | Unit tests for SNAP-01/02/03 | ✗ PARTIAL | Tests correctly written and import correct functions; cannot execute due to top-level DB import causing DATABASE_URL error |
| `artifacts/api-server/src/routes/risks.ts` | Dashboard, snapshots, appetite endpoints | ✓ VERIFIED | All 4 endpoints present; `risks/dashboard`, `risks/snapshots`, `risks/appetite`, `risks/appetite/:category` |
| `artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx` | Enhanced with cellDeltas + aboveAppetiteCells | ✓ VERIFIED | Both props added with backward compatibility; micro-trend arrows (↑ ↓) and appetite badge (!) in label formatter |
| `artifacts/riskmind-app/src/components/dashboard/kri-trend-panel.tsx` | ECharts line chart with appetite band | ✓ VERIFIED | `KriTrendPanel` exported; `ReactECharts`, `markArea`, `MutationObserver`, `Collecting trend data`, range switcher (3M/6M/12M), xAxis `type: "time"` all confirmed |
| `artifacts/riskmind-app/src/components/dashboard/risk-posture-bar.tsx` | CSS posture bar with appetite marker | ✓ VERIFIED | `RiskPostureBar` exported; `appetiteThreshold`, `aria-label`, `tabIndex` confirmed |
| `artifacts/riskmind-app/src/components/dashboard/domain-card.tsx` | Domain cards with sparkline | ✓ VERIFIED | `DomainCard` exported; `LineChart` sparkline, `aria-label`, `tabIndex` confirmed |
| `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` | Redesigned full dashboard | ✓ VERIFIED | 501 lines (min_lines: 150 passed); all 4 components imported and used; all API endpoints fetched |
| `artifacts/riskmind-app/src/pages/settings/settings.tsx` | Risk Appetite settings tab | ✓ VERIFIED | `appetite` tab with admin gate; 2 `risks/appetite` fetch calls (GET + PUT) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.ts` | `risk-snapshot-scheduler.ts` | `startRiskSnapshotScheduler()` in `start()` | ✓ WIRED | Confirmed in `index.ts` |
| `risk-snapshot-scheduler.ts` | `risk-snapshots.ts` | `import riskSnapshotsTable` | ✓ WIRED | `riskSnapshotsTable` imported and used in upsert |
| `routes/risks.ts` | `risk-appetite-configs.ts` | `import riskAppetiteConfigsTable` | ✓ WIRED | `riskAppetiteConfigsTable` imported and used in appetite endpoints |
| `tests/snapshot-scheduler.test.ts` | `risk-snapshot-scheduler.ts` | `import computeCompositeScore, buildCellCounts` | ✓ WIRED (but untestable) | Correct import; fails at DB init before tests run |
| `risk-heatmap.tsx` | `/v1/risks/dashboard` | fetch in useEffect | ✓ WIRED | `risks/dashboard` fetch with activeDomain query param |
| `risk-heatmap.tsx` | `/v1/risks/snapshots` | fetch for KRI trend | ✓ WIRED | `risks/snapshots` fetch with selectedRange param |
| `risk-heatmap.tsx` | `risk-heatmap-chart.tsx` | `RiskHeatmapChart` import with cellDeltas | ✓ WIRED | `cellDeltas` and `aboveAppetiteCells` props passed |
| `risk-heatmap.tsx` | `kri-trend-panel.tsx` | `KriTrendPanel` import | ✓ WIRED | Imported and rendered with snapshots + appetiteThreshold |
| `risk-heatmap.tsx` | `risk-posture-bar.tsx` | `RiskPostureBar` import | ✓ WIRED | Imported and rendered with score + appetiteThreshold |
| `risk-heatmap.tsx` | `domain-card.tsx` | `DomainCard` import | ✓ WIRED | Imported and rendered; onClick triggers activeDomain filter |
| `settings.tsx` | `/v1/risks/appetite` | fetch for GET and PUT | ✓ WIRED | 2 occurrences of `risks/appetite` in settings.tsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `risk-heatmap.tsx` | `dashboardData` | `GET /v1/risks/dashboard` → DB queries for risks, snapshots, appetite configs | Yes — full DB query chain with live computation | ✓ FLOWING |
| `risk-heatmap.tsx` | `snapshotData` | `GET /v1/risks/snapshots?range=X` → `riskSnapshotsTable` DB query | Yes — real DB query with date range | ✓ FLOWING |
| `kri-trend-panel.tsx` | `snapshots` prop | Passed from `snapshotData` in `risk-heatmap.tsx` | Yes — upstream data confirmed flowing | ✓ FLOWING |
| `domain-card.tsx` | `sparklineData` prop | `domainSummaries[].sparklineData` from dashboard API | Yes — last 6-month snapshot query in `risks.ts:309-333` | ✓ FLOWING |
| `risk-heatmap-chart.tsx` | `cellDeltas` prop | `dashboardData.cellDeltas` from dashboard API | Yes — diff between latest and previous snapshot cellCounts | ✓ FLOWING |
| `settings.tsx appetite tab` | `appetiteConfigs` | `GET /api/v1/risks/appetite` → `riskAppetiteConfigsTable` | Yes — real DB query | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SNAP-01: computeCompositeScore returns 0 for empty array | `npx vitest run tests/snapshot-scheduler.test.ts` | DATABASE_URL must be set — DB imported at module level | ✗ FAIL |
| SNAP-02: critical risks weighted 2x | Same | Same — cannot reach test execution | ✗ FAIL |
| SNAP-03: buildCellCounts determinism | Same | Same — cannot reach test execution | ✗ FAIL |
| Pure function correctness (manual inspection) | Grep function bodies | `computeCompositeScore` and `buildCellCounts` are pure with correct logic | ? UNCERTAIN (logic correct, untestable) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|-------------|-------------|--------|
| D-07 | 16-01 | Daily risk snapshot table with composite score, cell counts, category counts | ✓ SATISFIED |
| D-08 | 16-01 | Midnight cron scheduler for snapshot capture | ✓ SATISFIED |
| D-09 | 16-01 | Dashboard API returns posture score with deltas | ✓ SATISFIED |
| D-18 | 16-01 | risk_appetite_configs table with per-category thresholds | ✓ SATISFIED |
| D-19 | 16-01, 16-03 | PUT endpoint for appetite thresholds (admin-only) | ✓ SATISFIED |
| D-20 | 16-01 | GET /v1/risks/snapshots for time-series data | ✓ SATISFIED |
| D-21 | 16-01 | Snapshot upsert via onConflictDoUpdate (idempotent) | ✓ SATISFIED |
| D-22 | 16-01 | Unit tests for snapshot scheduler pure functions | ✗ BLOCKED — tests exist but cannot execute |
| D-03 | 16-02, 16-03 | KPI strip with posture bar and above-appetite pill | ✓ SATISFIED |
| D-04 | 16-02, 16-03 | RiskPostureBar with appetite band and click-to-explain | ✓ SATISFIED |
| D-05 | 16-03 | Above-appetite filter pill toggles heatmap filter | ✓ SATISFIED |
| D-06 | 16-02 | KRI trend panel with appetite band markArea | ✓ SATISFIED |
| D-10 | 16-02 | ECharts line chart for trend with time xAxis | ✓ SATISFIED |
| D-11 | 16-02 | Appetite band (markArea) in KRI trend | ✓ SATISFIED |
| D-12 | 16-02 | 3M/6M/12M range switcher in KRI trend | ✓ SATISFIED |
| D-15 | 16-02, 16-03 | DomainCard with sparkline and filter toggle | ✓ SATISFIED |
| D-16 | 16-03 | 6 domain cards strip at bottom of dashboard | ✓ SATISFIED |
| D-17 | 16-03 | Domain card click filters heatmap and KRI chart | ✓ SATISFIED |
| D-23 | 16-03 | Split 60%/40% heatmap+KRI layout (lg:grid-cols-5) | ✓ SATISFIED |
| D-24 | 16-03 | Generous whitespace (space-y-6, gap-6, p-6) | ✓ SATISFIED |
| D-25 | 16-03 | Consistent severity CSS variable classes | ✓ SATISFIED |
| D-28 | 16-02 | Keyboard accessibility (tabIndex, role=button, onKeyDown) | ✓ SATISFIED |
| D-29 | 16-02 | ARIA labels on interactive components | ✓ SATISFIED |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `risk-snapshot-scheduler.ts` | 2-8 | Top-level `import { db, ... } from "@workspace/db"` | ⚠️ Warning | Causes unit test failure because DATABASE_URL check fires before test execution; pure functions are correct but untestable in isolation |

### Human Verification Required

1. **Full Dashboard Layout**
   **Test:** Navigate to `/risks/heatmap` after login.
   **Expected:** 4-section layout: (1) KPI strip with posture bar + above-appetite pill, (2) split 60%/40% with heatmap left and KRI trend right, (3) 6 domain cards at bottom, (4) correct "Risk Dashboard" title.
   **Why human:** Canvas rendering, layout proportions, and visual quality require browser inspection.

2. **Interactive Filtering**
   **Test:** Click the above-appetite pill, then click a domain card.
   **Expected:** Heatmap filters to above-appetite cells only when pill is clicked. Domain card click filters both heatmap and KRI chart to that domain. Both toggled off on re-click.
   **Why human:** State-driven filter behavior requires live interaction testing.

3. **KRI Trend Chart**
   **Test:** Check the KRI trend panel on the right side. Switch between 3M, 6M, 12M.
   **Expected:** Line chart with green appetite band. Range switcher updates the chart. If no snapshots yet, shows "Collecting trend data" message.
   **Why human:** Time-series rendering requires live data and visual inspection.

4. **Posture Bar Explanation Panel**
   **Test:** Click the posture bar.
   **Expected:** Sheet slides open explaining how the Risk Posture Index is calculated (formula, appetite threshold, current score).
   **Why human:** Interactive Sheet behavior requires browser testing.

5. **Settings Risk Appetite Tab**
   **Test:** Navigate to Settings > Risk Appetite tab (admin only).
   **Expected:** Table of 6 categories (Cyber, Ops, Compliance, Financial, Strategic, Reputational) with editable threshold inputs (0-100). Saving a threshold shows toast confirmation.
   **Why human:** Toast behavior and input interaction require live testing.

### Gaps Summary

One gap found: the SNAP-01/02/03 unit tests cannot execute because `risk-snapshot-scheduler.ts` imports `@workspace/db` at module level, which triggers a `DATABASE_URL must be set` check before any test code runs.

The pure functions (`computeCompositeScore` and `buildCellCounts`) are correctly implemented and their logic is correct — the tests will pass once the import-time DB initialization is bypassed.

**Fix options (for planner):**
1. Extract `computeCompositeScore` and `buildCellCounts` into a separate `risk-snapshot-utils.ts` file with no DB imports. Both the scheduler and the tests import from there.
2. Add a `vitest.setup.ts` that sets `process.env.DATABASE_URL = "postgres://localhost/test"` (dummy URL) to bypass the check — works only if the tests don't actually query the DB.
3. Use vitest's `vi.mock("@workspace/db", ...)` to stub the DB module for tests that only need the pure functions.

All other dashboard infrastructure (schema tables, scheduler, API endpoints, frontend components, settings tab) is fully verified and correctly wired.

---

_Verified: 2026-03-26T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
