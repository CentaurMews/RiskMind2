---
phase: 16-risk-heatmap-dashboard-redesign
plan: 02
subsystem: ui
tags: [react, echarts, recharts, dashboard, heatmap, typescript, tailwind]

# Dependency graph
requires:
  - phase: 16-risk-heatmap-dashboard-redesign
    provides: Phase 15 ECharts RiskHeatmapChart foundation and Phase 16-01 backend risk dashboard API

provides:
  - RiskHeatmapChart enhanced with optional cellDeltas (micro-trend arrows) and aboveAppetiteCells (appetite badges)
  - RiskPostureBar CSS bar component with appetite band, score fill, threshold marker, keyboard/screen reader a11y
  - KriTrendPanel ECharts line chart with appetite markArea band, 3M/6M/12M range switcher, dark mode reactivity
  - DomainCard recharts sparkline card with risk level badge, high/critical count, filter toggle state

affects: [16-risk-heatmap-dashboard-redesign, risk-heatmap-page, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RiskPostureBar uses CSS-only posture bar (no charting library) following Research Pattern 8
    - DomainCard sparkline follows kpi-card.tsx ChartContainer + recharts LineChart pattern exactly
    - KriTrendPanel reuses MutationObserver dark mode pattern from risk-heatmap-chart.tsx
    - KriTrendPanel uses type:time xAxis for ECharts to handle date gaps automatically
    - All interactive divs use role=button + tabIndex + onKeyDown for WCAG AA keyboard nav

key-files:
  created:
    - artifacts/riskmind-app/src/components/dashboard/risk-posture-bar.tsx
    - artifacts/riskmind-app/src/components/dashboard/kri-trend-panel.tsx
    - artifacts/riskmind-app/src/components/dashboard/domain-card.tsx
  modified:
    - artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx

key-decisions:
  - "RiskHeatmapChart remains backward-compatible — cellDeltas and aboveAppetiteCells are optional props"
  - "Label font size reduced from 14 to 11 and overflow:truncate added to prevent cell label overflow at 60% width (Research pitfall 1)"
  - "KriTrendPanel annotation markPoints include name field required by EChartsOption MarkPointDataItemOption type"
  - "CSS posture bar chosen over ECharts gauge for RiskPostureBar — simpler, responsive, theme-compatible"
  - "totalRisks computed inside RiskHeatmapChart from cells prop for tooltip percentage — no new API call needed"

patterns-established:
  - "Pattern: WCAG AA interactive divs — role=button + tabIndex={0} + onKeyDown Enter/Space + aria-label + aria-pressed"
  - "Pattern: ECharts dark mode — MutationObserver on documentElement class + themeVersion state + useMemo recompute"
  - "Pattern: recharts sparkline in domain card — ChartContainer config with severity color + LineChart + Line dot=false"

requirements-completed: [D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16, D-17, D-23, D-24, D-25, D-26, D-27, D-28, D-29]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 16 Plan 02: Dashboard Components Summary

**Four reusable dashboard components: enhanced heatmap with micro-trend arrows and appetite badges, ECharts KRI trend panel with appetite band, CSS posture bar, and recharts domain cards with sparklines**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T06:49:19Z
- **Completed:** 2026-03-24T06:53:48Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- RiskHeatmapChart extended with backward-compatible `cellDeltas` and `aboveAppetiteCells` props rendering micro-trend arrows (up/down Unicode) and appetite badges (`!`) in cell labels; tooltips enriched with percentage of total and delta text
- Created RiskPostureBar as a CSS-only horizontal bar with appetite band (emerald tint), score fill (green/red based on threshold), dashed threshold marker line, score label, and full keyboard/screen reader accessibility
- Created KriTrendPanel as ECharts line chart with `markArea` green appetite band, `markLine` at threshold, 3M/6M/12M range switcher, MutationObserver dark mode reactivity, annotation markPoints, and collecting empty state
- Created DomainCard with recharts sparkline (following kpi-card.tsx pattern), risk level badge with severity colors, high/critical count, active toggle state via `ring-2 ring-primary`, and full WCAG AA accessibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance RiskHeatmapChart + create RiskPostureBar** - `1266b86` (feat)
2. **Task 2: Create KriTrendPanel + DomainCard components** - `4646814` (feat)

## Files Created/Modified

- `artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx` - Extended with cellDeltas, aboveAppetiteCells, enriched tooltip, aria-label wrapper
- `artifacts/riskmind-app/src/components/dashboard/risk-posture-bar.tsx` - New CSS posture bar with appetite band, score fill, threshold marker, keyboard a11y
- `artifacts/riskmind-app/src/components/dashboard/kri-trend-panel.tsx` - New ECharts line chart with appetite band, range switcher, dark mode, annotations
- `artifacts/riskmind-app/src/components/dashboard/domain-card.tsx` - New category card with recharts sparkline, risk level badge, filter toggle

## Decisions Made

- RiskHeatmapChart backward-compatible — both new props are optional so existing call sites in risk-heatmap.tsx continue working without change
- Label font size reduced from 14 to 11 and `overflow: "truncate"` added per Research pitfall 1 (labels overflow at 60% column width)
- KriTrendPanel annotation markPoints require `name` field per EChartsOption typing — added `name: a.label` to satisfy TypeScript
- CSS posture bar chosen over ECharts gauge for RiskPostureBar — simpler, responsive, dark mode friendly via CSS variables
- `totalRisks` computed from `cells` prop inside the component for tooltip `% of total` display — no extra API call needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in KriTrendPanel markPoint data**
- **Found during:** Task 2 verification (typecheck)
- **Issue:** `MarkPointDataItemOption` in ECharts requires `name` field but plan's annotationPoints object omitted it, causing TS2322 error
- **Fix:** Added `name: a.label` to each annotation point object
- **Files modified:** `artifacts/riskmind-app/src/components/dashboard/kri-trend-panel.tsx`
- **Verification:** `pnpm --filter @workspace/riskmind-app typecheck` — no errors from new files
- **Committed in:** `4646814` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug)
**Impact on plan:** Fix necessary for TypeScript correctness. Pre-existing errors in unrelated files (alert-list.tsx, risk-list.tsx, settings.tsx, finding-list.tsx, signal-list.tsx, vendor-list.tsx) are out of scope and logged to deferred items.

## Issues Encountered

- Pre-existing TypeScript errors in `alert-list.tsx`, `risk-list.tsx`, `settings.tsx`, `finding-list.tsx`, `signal-list.tsx`, `vendor-list.tsx` — none caused by this plan's changes. Deferred per deviation rule scope boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 components are self-contained with typed props and are ready to be wired into the redesigned `risk-heatmap.tsx` dashboard page in Plan 03
- RiskHeatmapChart backward-compatible — Plan 03 can start from existing call site and add new props incrementally
- No blockers

## Self-Check: PASSED

- FOUND: `artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx`
- FOUND: `artifacts/riskmind-app/src/components/dashboard/risk-posture-bar.tsx`
- FOUND: `artifacts/riskmind-app/src/components/dashboard/kri-trend-panel.tsx`
- FOUND: `artifacts/riskmind-app/src/components/dashboard/domain-card.tsx`
- FOUND: `.planning/phases/16-risk-heatmap-dashboard-redesign/16-02-SUMMARY.md`
- FOUND commit: `1266b86` (Task 1)
- FOUND commit: `4646814` (Task 2)

---
*Phase: 16-risk-heatmap-dashboard-redesign*
*Completed: 2026-03-24*
