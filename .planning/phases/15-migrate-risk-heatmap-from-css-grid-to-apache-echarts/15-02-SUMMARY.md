---
phase: 15-migrate-risk-heatmap-from-css-grid-to-apache-echarts
plan: 02
subsystem: ui
tags: [echarts, react, heatmap, mobile-responsive, drill-down]

# Dependency graph
requires:
  - phase: 15-01
    provides: RiskHeatmapChart ECharts component with severity coloring, tooltips, and click events
provides:
  - Full-page /risks/heatmap page using ECharts canvas on desktop with Sheet drill-down and URL deep linking
  - Mobile fallback severity summary list on md:hidden breakpoint
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Desktop-only chart via hidden md:block wrapper + mobile fallback via md:hidden sibling"
    - "Inline IIFE for computing aggregated severity counts in JSX without polluting component scope"

key-files:
  created: []
  modified:
    - artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx

key-decisions:
  - "Manual axis labels and getCellColor removed from risk-heatmap.tsx — ECharts handles axis labels natively via RiskHeatmapChart"
  - "Mobile severity summary inlined in risk-heatmap.tsx (not reusing HeatmapGrid mobile path) — keeps full-page and compact widget fully independent"

patterns-established:
  - "Pattern: Use hidden md:block / md:hidden sibling pair to toggle between chart and summary without conditional rendering"

requirements-completed: [D-01, D-02, D-03, D-11, D-12, D-13]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 15 Plan 02: Migrate Full-Page Heatmap to ECharts Summary

**Full-page /risks/heatmap rewired from CSS Grid (HeatmapGrid) to ECharts (RiskHeatmapChart) with preserved Sheet drill-down, URL deep linking, and mobile severity fallback**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-24T05:24:17Z
- **Completed:** 2026-03-24T05:29:00Z
- **Tasks:** 1 of 2 (Task 2 is checkpoint:human-verify — awaiting user sign-off)
- **Files modified:** 1

## Accomplishments
- Replaced `HeatmapGrid` CSS Grid rendering with `RiskHeatmapChart` ECharts component in the full-page view
- Added `md:hidden` severity summary list as mobile fallback inside the page component
- Removed manual axis labels and `getCellColor` helper (ECharts handles natively)
- Preserved Sheet drill-down, URL deep linking (`?l=` / `?i=`), and `selectedCell` state exactly as before
- `heatmap-grid.tsx` and `dashboard.tsx` are completely untouched
- Vite build passes cleanly (`✓ 3436 modules transformed`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire risk-heatmap.tsx to use RiskHeatmapChart with mobile fallback** - `170730f` (feat)

**Plan metadata:** pending (will be committed after Task 2 human verify)

## Files Created/Modified
- `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` - Replaced HeatmapGrid with RiskHeatmapChart, added mobile fallback, removed CSS grid rendering and manual axes

## Decisions Made
- Manual axis labels (Likelihood rotated text, Impact bottom text, Y/X label lists) removed from the page component — ECharts renders these natively in `RiskHeatmapChart`, eliminating ~30 lines of layout scaffolding.
- Mobile severity summary inlined in `risk-heatmap.tsx` rather than reusing the mobile path in `HeatmapGrid` — preserves the clean boundary between the full-page view and the compact dashboard widget.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `signal-list.tsx` and `vendor-list.tsx` (string/number type mismatches) exist but are out of scope — no errors in `risk-heatmap.tsx` or any files modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ECharts migration is complete end-to-end: Plan 01 built the chart component, Plan 02 wired it into the full-page view
- The `heatmap-grid.tsx` compact widget remains untouched for the dashboard
- After human verification (Task 2), Phase 15 is fully complete

## Self-Check: PASSED

- `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` — FOUND
- `.planning/phases/15-migrate-risk-heatmap-from-css-grid-to-apache-echarts/15-02-SUMMARY.md` — FOUND
- Commit `170730f` — FOUND

---
*Phase: 15-migrate-risk-heatmap-from-css-grid-to-apache-echarts*
*Completed: 2026-03-24*
