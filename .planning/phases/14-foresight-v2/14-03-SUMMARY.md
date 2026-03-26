---
phase: 14-foresight-v2
plan: "03"
subsystem: ui
tags: [foresight, monte-carlo, fair, calibration, scenario-compare, echarts, orval, react-query]

requires:
  - phase: 14-01
    provides: foresight backend API, usePostForesightCalibrate, useListForesightScenarios, CalibrationResult types
  - phase: 14-02
    provides: LossExceedanceChart, ComparisonChart ECharts components (parallel plan — scaffold placeholder created)
provides:
  - CalibrationPanel component with OSINT calibration UI and apply-to-form action
  - ScenarioCompare component with two-scenario picker, overlaid ComparisonChart, ALE delta, parameter diff table
  - ScenarioForm with FAIR triangular sliders and "Calibrate from Real Data" button
  - ScenarioList with run/clone/delete scenario cards and ALE display
  - Tab-based foresight.tsx (Scenarios / Compare / Calibration) replacing teaser page
affects: [14-02-parallel-merge, dashboard-ale-widget]

tech-stack:
  added: []
  patterns:
    - CalibrationResult → pre-fill FAIR sliders via clamped TriangularParam (clampTriangular helper)
    - calibratedFields Set<string> tracks which sliders are OSINT-derived for per-field Calibrated badge
    - Sheet slide-over for scenario create/edit form (consistent with other forms in codebase)
    - ScenarioCompare builds diff rows from scenario.parameters JSONB via getTriangular helper

key-files:
  created:
    - artifacts/riskmind-app/src/pages/foresight/calibration-panel.tsx
    - artifacts/riskmind-app/src/pages/foresight/scenario-compare.tsx
    - artifacts/riskmind-app/src/pages/foresight/scenario-form.tsx
    - artifacts/riskmind-app/src/pages/foresight/scenario-list.tsx
    - artifacts/riskmind-app/src/components/foresight/loss-exceedance-chart.tsx
  modified:
    - artifacts/riskmind-app/src/pages/foresight/foresight.tsx

key-decisions:
  - "CalibrationPanel uses wouter Link (not react-router-dom) for Settings integrations navigation — app uses wouter"
  - "loss-exceedance-chart.tsx scaffold created by Plan 14-03 to unblock parallel builds — Plan 14-02 replaces with full ECharts implementation"
  - "clampTriangular() helper constrains CalibrationResult TriangularParam to slider domain before pre-filling to prevent out-of-range slider state"
  - "calibratedFields Set<string> persists which fields were calibrated so individual parameter badges survive slider adjustments"
  - "ComparisonChart import in scenario-compare.tsx matches Plan 14-02's export contract exactly — zero-change merge expected"
  - "deltaPercent shows + prefix for increases (orange) and - prefix for decreases (green) in parameter diff table — risk-aware color coding"

patterns-established:
  - "Pre-filled form state via callback prop: onApplyToNewScenario(CalibrationResult) → foresight.tsx switches tab + opens Sheet"
  - "FAIR slider group component with min/mode/max constrained to prevent invalid triangular distributions"

requirements-completed: [FRST-04, FRST-03]

duration: 8min
completed: "2026-03-26"
---

# Phase 14 Plan 03: Foresight v2 Calibration & Comparison Summary

**OSINT calibration panel with sample-size/freshness badge and one-click FAIR pre-fill, plus two-scenario comparison with overlaid loss exceedance curves and parameter delta table**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-26T05:51:13Z
- **Completed:** 2026-03-26T05:59:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- CalibrationPanel: calls `usePostForesightCalibrate`, displays TEF/Vulnerability/LossMagnitude suggestions in min/mode/max cards with source description, shows sample size and data freshness badge, handles insufficient data with Settings integrations link
- ScenarioCompare: two-scenario dropdown picker (only completed simulations), overlaid `ComparisonChart`, ALE comparison with percentage delta, FAIR parameter diff table with color-coded delta badges
- ScenarioForm: FAIR triangular sliders with domain-clamped calibration pre-fill, "Calibrate from Real Data" button, "Calibrated from real data" badge + freshness indicator when values are OSINT-derived
- foresight.tsx: full tab-based layout (Scenarios / Compare / Calibration) replacing teaser, Sheet slide-over for create/edit, state flow from CalibrationPanel "Apply" → pre-fills scenario form

## Task Commits

1. **Task 1: CalibrationPanel and ScenarioCompare components** - `fe235ee` (feat)
2. **Task 2: Wire into foresight page tabs + scenario form** - `ab1588d` (feat)

## Files Created/Modified

- `artifacts/riskmind-app/src/pages/foresight/calibration-panel.tsx` — OSINT calibration tab content with usePostForesightCalibrate hook
- `artifacts/riskmind-app/src/pages/foresight/scenario-compare.tsx` — Two-scenario comparison with ComparisonChart and diff table
- `artifacts/riskmind-app/src/pages/foresight/scenario-form.tsx` — FAIR sliders with calibration pre-fill and badge
- `artifacts/riskmind-app/src/pages/foresight/scenario-list.tsx` — Scenario cards with run/clone/delete and ALE display
- `artifacts/riskmind-app/src/pages/foresight/foresight.tsx` — Tab-based page replacing teaser
- `artifacts/riskmind-app/src/components/foresight/loss-exceedance-chart.tsx` — Scaffold with ComparisonChart/LossExceedanceChart interface (Plan 14-02 replaces)

## Decisions Made

- **wouter vs react-router-dom**: App uses `wouter` for routing. Initial `Link` import from `react-router-dom` in calibration-panel.tsx caused build failure. Fixed to `wouter`. (Rule 1 auto-fix)
- **Scaffold placeholder**: `loss-exceedance-chart.tsx` created as a build-unblocking scaffold since Plan 14-02 runs in parallel and had not yet created the file. Plan 14-02 will replace with full ECharts implementation.
- **clampTriangular helper**: CalibrationResult CVSS-derived values can exceed slider domain bounds. Clamping prevents NaN/stuck slider state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed react-router-dom import to wouter**
- **Found during:** Task 2 build verification
- **Issue:** `calibration-panel.tsx` imported `Link` from `react-router-dom` which is not installed — app uses `wouter`
- **Fix:** Changed import to `from "wouter"`
- **Files modified:** `artifacts/riskmind-app/src/pages/foresight/calibration-panel.tsx`
- **Verification:** Build passed (`✓ built in 38.65s`)
- **Committed in:** ab1588d (Task 2 commit)

**2. [Rule 3 - Blocking] Created loss-exceedance-chart.tsx scaffold to unblock parallel build**
- **Found during:** Task 1 — `scenario-compare.tsx` imports `ComparisonChart` from `@/components/foresight/loss-exceedance-chart`
- **Issue:** Plan 14-02 runs in parallel and hadn't created that file yet, causing a module resolution failure
- **Fix:** Created scaffold file with matching `ComparisonChart` and `LossExceedanceChart` export signatures; Plan 14-02 replaces with full ECharts implementation
- **Files modified:** `artifacts/riskmind-app/src/components/foresight/loss-exceedance-chart.tsx` (created)
- **Verification:** Build passed after scaffold creation
- **Committed in:** fe235ee (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for build to pass. No scope creep — scaffold matches Plan 14-02's export contract exactly.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Known Stubs

- `loss-exceedance-chart.tsx` — `LossExceedanceChart` and `ComparisonChart` render placeholder divs instead of real ECharts. This is intentional: Plan 14-02 provides the full implementation. The stub prevents the build from failing during parallel execution.

## Next Phase Readiness

- CalibrationPanel, ScenarioCompare, ScenarioForm, ScenarioList, and foresight.tsx tab layout are complete
- Plan 14-02 merge will replace the `loss-exceedance-chart.tsx` scaffold with real ECharts charts
- After merge, all Foresight UI tabs are fully functional end-to-end

---
*Phase: 14-foresight-v2*
*Completed: 2026-03-26*
