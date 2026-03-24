---
phase: 17-parallel-coordinates-risk-explorer
plan: 01
subsystem: ui
tags: [echarts, parallel-coordinates, risk-explorer, visualization, dark-mode, echarts-for-react]

# Dependency graph
requires:
  - phase: 15-migrate-risk-heatmap-from-css-grid-to-apache-echarts
    provides: echarts-for-react installed, hslStringToColor helper, MutationObserver dark mode pattern
  - phase: 16-risk-heatmap-dashboard-redesign
    provides: risk heatmap page and dashboard data structure with cells/risks arrays
provides:
  - ECharts parallel coordinates RiskParallelChart component with 6 axes
  - Severity-colored line rendering via CSS variable extraction
  - Interactive axis brushing via ECharts areaSelectStyle
  - Click-to-navigate riskIdMap pattern
affects: [risk-heatmap.tsx integration in phase 17-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "inactiveOpacity/activeOpacity on parallel series for vivid brush-selected vs near-invisible unselected lines"
    - "riskIdMap array parallel to seriesData for O(1) dataIndex -> risk.id lookup on click"
    - "Client-side category count aggregation for derived Risk Count per Category axis"
    - "fontWeight as numeric (600 not '600') for ECharts ZRFontWeight compatibility"

key-files:
  created:
    - artifacts/riskmind-app/src/components/dashboard/risk-parallel-chart.tsx
  modified: []

key-decisions:
  - "inactiveOpacity:0.05 / activeOpacity:0.9 on parallel series — built-in ECharts brush filter, no custom event handling needed"
  - "riskIdMap array maintained parallel to seriesData rows — O(1) index lookup on click without searching risks array"
  - "Category count grouped client-side at render time — derived dimension without any new backend endpoint"
  - "fontWeight must be numeric (600) not string ('600') for ECharts ZRFontWeight type — caught by TypeScript compilation"

patterns-established:
  - "Parallel coordinates: seriesData with per-item lineStyle.color for severity encoding"
  - "ECharts parallel type: parallelAxisDefault.areaSelectStyle for brush selection styling"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-09, D-10, D-11]

# Metrics
duration: 58min
completed: 2026-03-24
---

# Phase 17 Plan 01: RiskParallelChart Component Summary

**ECharts parallel coordinates Risk Explorer component with 6 axes, severity-colored lines, axis brushing, tooltip, click navigation, and dark mode via CSS variable extraction**

## Performance

- **Duration:** ~58 min
- **Started:** 2026-03-24T09:25:04Z
- **Completed:** 2026-03-24T10:23:32Z
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments

- Created `RiskParallelChart` component (323 lines) exporting a fully-featured ECharts parallel coordinates visualization
- Implemented 6 parallel axes: Likelihood (1-5), Impact (1-5), Score (1-25), Category (6 labels), Status (Open/Mitigated), Risk Count per Category
- Severity-colored lines using `--severity-critical/high/medium/low` CSS variables via `getThemeColors()` helper
- Axis brushing with `areaSelectStyle` and `inactiveOpacity:0.05` / `activeOpacity:0.9` for vivid brush-selected vs near-invisible unselected behavior
- Hover tooltip showing risk title, score, severity label, category, status
- Click handler using `riskIdMap` array for O(1) dataIndex → risk.id lookup, calls `onRiskClick(riskId)` prop
- MutationObserver dark mode pattern from `risk-heatmap-chart.tsx` — watches `document.documentElement` class changes, bumps `themeVersion` state, triggers `useMemo` recompute of theme colors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RiskParallelChart component with 6-axis parallel coordinates** - `e6efecb` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `artifacts/riskmind-app/src/components/dashboard/risk-parallel-chart.tsx` - ECharts parallel coordinates component with 6 axes, severity coloring, axis brushing, tooltip, click navigation, dark mode

## Decisions Made

- **inactiveOpacity/activeOpacity on series**: Used ECharts built-in brush filter parameters (`inactiveOpacity: 0.05`, `activeOpacity: 0.9`) rather than manual event-based line styling — simpler, performant, zero custom event handling
- **riskIdMap parallel array**: Maintained alongside `parallelData` rows so `click` event `dataIndex` maps to `riskId` in O(1) without searching the `risks` array
- **Client-side category count**: Counted risks per category in one pass at render time — the "Risk Count per Category" axis is a derived dimension with no backend endpoint needed
- **fontWeight: 600 (not '600')**: ECharts `ZRFontWeight` type requires numeric weight — TypeScript caught the string vs number mismatch during compilation check

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fontWeight string to number**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** `fontWeight: "600"` is not assignable to `ZRFontWeight` in ECharts types — string instead of number
- **Fix:** Changed to `fontWeight: 600` (numeric)
- **Files modified:** `artifacts/riskmind-app/src/components/dashboard/risk-parallel-chart.tsx`
- **Verification:** `npx tsc --noEmit` reports no errors for this file
- **Committed in:** `e6efecb` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug)
**Impact on plan:** Trivial fix required for TypeScript compilation. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `alert-list.tsx`, `risk-list.tsx`, and `settings.tsx` were detected during compilation check but are out of scope (pre-existing, not caused by this plan's changes). Documented here for awareness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `RiskParallelChart` component is standalone and ready for integration
- Phase 17 Plan 02 should wire it into `risk-heatmap.tsx` as a toggle/tab alongside the existing heatmap
- The component accepts `risks` (flat array) and `onRiskClick` props — the dashboard page needs to flatten cells into a flat risks array before passing

---
*Phase: 17-parallel-coordinates-risk-explorer*
*Completed: 2026-03-24*
