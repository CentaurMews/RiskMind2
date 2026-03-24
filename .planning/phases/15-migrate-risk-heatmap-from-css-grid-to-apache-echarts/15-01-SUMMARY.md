---
phase: 15-migrate-risk-heatmap-from-css-grid-to-apache-echarts
plan: 01
subsystem: ui
tags: [echarts, echarts-for-react, heatmap, risk-visualization, dark-mode, css-variables]

# Dependency graph
requires: []
provides:
  - echarts and echarts-for-react installed as runtime dependencies in riskmind-app
  - RiskHeatmapChart component with position-based severity colors, dark mode, click handler
affects:
  - 15-02 (will wire RiskHeatmapChart into risk-heatmap.tsx page)

# Tech tracking
tech-stack:
  added:
    - echarts ^6.0.0 (runtime dependency)
    - echarts-for-react ^3.0.6 (runtime dependency)
  patterns:
    - getComputedStyle() CSS variable extraction for ECharts theme colors at runtime
    - MutationObserver on document.documentElement watching class attribute for dark mode toggle
    - itemStyle.color callback for position-based (L*I score) severity coloring — not visualMap

key-files:
  created:
    - artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx
  modified:
    - artifacts/riskmind-app/package.json

key-decisions:
  - "Position-based severity coloring: itemStyle.color callback computes L*I score from cell coordinates — no visualMap (which colors by value, not position)"
  - "echarts added to dependencies (not devDependencies) since it runs in the browser bundle"
  - "MutationObserver on documentElement.class triggers useMemo recompute for color recalculation on dark mode toggle"
  - "heatmapData format is [impactIndex, likelihoodIndex, count] to align x-axis with Impact and y-axis with Likelihood"

patterns-established:
  - "CSS variable extraction pattern: getComputedStyle(document.documentElement).getPropertyValue('--var-name') + hslStringToColor() helper for HSL format conversion"
  - "Theme-reactive ECharts: MutationObserver state counter + useMemo([themeVersion]) ensures option object updates on dark/light toggle without full remount"

requirements-completed: [D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-14]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 15 Plan 01: Install ECharts and Create RiskHeatmapChart Component Summary

**ECharts heatmap component with position-based severity colors, runtime CSS variable extraction, dark/light mode reactivity, and drill-down click handler — ready for page integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T05:00:33Z
- **Completed:** 2026-03-24T05:02:29Z
- **Tasks:** 2
- **Files modified:** 3 (package.json, pnpm-lock.yaml, risk-heatmap-chart.tsx)

## Accomplishments

- Installed echarts and echarts-for-react as runtime dependencies in the riskmind-app workspace package
- Created RiskHeatmapChart component (218 lines) with all D-04 through D-14 decisions implemented
- Component is fully self-contained — no imports from risk-heatmap.tsx or heatmap-grid.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Install echarts and echarts-for-react** - `d995719` (chore)
2. **Task 2: Create RiskHeatmapChart ECharts component** - `993e98b` (feat)

## Files Created/Modified

- `artifacts/riskmind-app/package.json` - Added echarts ^6.0.0 and echarts-for-react ^3.0.6 to dependencies
- `artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx` - ECharts heatmap component with position-based severity, dark mode, click handler

## Decisions Made

- **No visualMap:** Severity is determined by cell position (likelihood * impact score), not by the count value. The `itemStyle.color` callback receives `[impactIdx, likelihoodIdx, count]` and computes score from indices. This is a critical distinction from typical ECharts heatmap examples.
- **HSL conversion helper:** CSS variables store HSL as `"0 84% 60%"` (space-separated without `hsl()`). The `hslStringToColor()` helper converts to `"hsl(0, 84%, 60%)"` format that ECharts understands.
- **Axis orientation:** x-axis = Impact (0-4), y-axis = Likelihood (0-4). Data format is `[impactIndex, likelihoodIndex, count]` to match ECharts convention where `data[i] = [xValue, yValue, value]`.
- **Dark mode detection:** MutationObserver watches the `class` attribute on `document.documentElement`. When `.dark` is toggled, state counter increments, triggering `useMemo` recomputation of theme colors and the full option object.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RiskHeatmapChart is ready to be wired into the risk-heatmap.tsx page (Plan 15-02)
- The component accepts the same `cells` prop shape as the existing HeatmapGrid
- selectedCell prop enables highlight dispatch for pre-selected cells from URL params
- No blockers.

---
*Phase: 15-migrate-risk-heatmap-from-css-grid-to-apache-echarts*
*Completed: 2026-03-24*

## Self-Check: PASSED

- risk-heatmap-chart.tsx: FOUND
- 15-01-SUMMARY.md: FOUND
- Commit d995719: FOUND
- Commit 993e98b: FOUND
