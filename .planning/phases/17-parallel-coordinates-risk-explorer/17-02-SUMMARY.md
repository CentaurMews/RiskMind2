---
phase: 17-parallel-coordinates-risk-explorer
plan: "02"
subsystem: ui
tags: [react, echarts, parallel-coordinates, dashboard, vite]

# Dependency graph
requires:
  - phase: 17-parallel-coordinates-risk-explorer
    plan: "01"
    provides: RiskParallelChart component with props interface and ECharts parallel coordinates
provides:
  - Heatmap/Explorer view toggle in Risk Dashboard header
  - Explorer view rendering RiskParallelChart full-width with filtered risk data
  - allRisks derived from filteredCells for Explorer data binding
  - Mobile fallback message for Explorer view
  - Line click navigation to /risks/{id} via wouter
affects: [risk-heatmap, dashboard, parallel-coordinates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "viewMode state pattern for toggling between chart types in same page"
    - "useMemo flatMap to derive flat risk list from nested cell structure for downstream components"
    - "useLocation from wouter for programmatic navigation in event handlers"
    - "Conditional lg:col-span-5 vs lg:col-span-3+2 grid layout based on view mode"

key-files:
  created: []
  modified:
    - artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx

key-decisions:
  - "viewMode state in risk-heatmap.tsx rather than URL param — keeps toggle ephemeral and avoids routing complexity"
  - "allRisks derived from filteredCells (not dashboardData.cells) — ensures domain card and above-appetite filters automatically apply to Explorer without extra logic"
  - "Explorer hides KRI trend panel (col-span-5) — parallel coordinates needs full width for legibility across 6 axes"
  - "Mobile fallback renders md:hidden message, desktop renders hidden md:block chart — same container, CSS-driven responsive split"

patterns-established:
  - "View toggle: pill-shaped rounded-full button group with bg-primary/text-primary-foreground active state"
  - "Mobile fallback for data-heavy desktop charts: md:hidden message with link back to simpler view"

requirements-completed: [D-06, D-07, D-08, D-12]

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 17 Plan 02: Risk Explorer Dashboard Integration Summary

**Pill-toggle Heatmap/Explorer view switch in Risk Dashboard wiring RiskParallelChart with shared filter state and mobile fallback**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T10:26:35Z
- **Completed:** 2026-03-24T10:33:53Z
- **Tasks:** 1 of 2 completed (Task 2 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments
- Added `viewMode` state ("heatmap" | "explorer") with pill-shaped toggle in dashboard header
- Wired `RiskParallelChart` into Explorer view with full-width `lg:col-span-5` layout
- Derived `allRisks` via `useMemo` from `filteredCells.flatMap` — domain card and above-appetite filters automatically apply to both views without extra wiring
- Mobile fallback (`md:hidden`) shows "Risk Explorer requires a wider screen" with link back to heatmap
- Click navigation via `useLocation` from wouter: `onRiskClick={(id) => navigate('/risks/${id}')}`
- Built frontend and confirmed app serving updated assets at https://app.riskmind.net

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Heatmap/Explorer view toggle and wire RiskParallelChart into dashboard page** - `52f3578` (feat)

_Task 2 is a human-verify checkpoint — awaiting browser verification._

## Files Created/Modified
- `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` - Added view toggle, RiskParallelChart import, allRisks memo, conditional section 2 rendering, mobile fallback

## Decisions Made
- `allRisks` derived from `filteredCells` (not raw `dashboardData.cells`) — both domain card refetch and client-side above-appetite filter already applied, so Explorer automatically inherits them
- KRI trend panel hidden in Explorer view — full 5-column width needed for parallel coordinates readability across 6 axes
- Used `useLocation` (not `Link`) for click navigation since `onRiskClick` is a callback prop with just the ID string, not a React element context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript compiled cleanly for the modified file. Pre-existing TS errors in `alert-list.tsx`, `risk-list.tsx`, and `settings.tsx` are out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Risk Explorer integration complete and live at https://app.riskmind.net/risks/heatmap
- Human verification (Task 2 checkpoint) required before plan is fully closed
- Phase 17 will be complete after human approval

---
*Phase: 17-parallel-coordinates-risk-explorer*
*Completed: 2026-03-24*
