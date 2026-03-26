---
phase: 14-foresight-v2
plan: "02"
subsystem: ui
tags: [foresight, monte-carlo, echarts, fair, scenario, simulation, react-query, loss-exceedance]
dependency_graph:
  requires:
    - phase: 14-01
      provides: Orval-generated foresight hooks and ForesightScenario/SimulationResults types
  provides:
    - foresight-page-with-tabs
    - scenario-list-with-crud
    - scenario-form-fair-sliders
    - loss-exceedance-chart
    - comparison-chart
  affects: [14-03-calibration, 14-04-dashboard-widget]
tech_stack:
  added: []
  patterns:
    - refetchInterval as function to conditionally poll when pending/running simulations exist
    - MutationObserver dark mode pattern for ECharts theme reactivity (consistent with risk-heatmap-chart)
    - buildExceedanceCurve: histogram bins → 1-CDF exceedance curve for loss exceedance charts
    - Inline chart expansion in card using ChevronDown/TrendingUp toggle
    - TriangularInput: three-slider min/mode/max group with auto-clamp constraints
key_files:
  created:
    - artifacts/riskmind-app/src/pages/foresight/foresight.tsx
    - artifacts/riskmind-app/src/pages/foresight/scenario-list.tsx
    - artifacts/riskmind-app/src/pages/foresight/scenario-form.tsx
    - artifacts/riskmind-app/src/components/foresight/loss-exceedance-chart.tsx
  modified: []
key_decisions:
  - "Foresight page fully replaces teaser — no backward compatibility needed"
  - "Auto-polling uses refetchInterval as function checking latestSimulation.status — no separate polling state needed"
  - "TEF slider range 0-365/yr (daily events), Vulnerability 0-1 (percentage), Loss Magnitude $0-10M"
  - "TriangularInput clamps min/mode/max on each slider change to enforce min<=mode<=max invariant"
  - "ScenarioCard inline chart expansion (ChevronUp/TrendingUp toggle) avoids dialog/sheet overhead"
  - "buildExceedanceCurve produces two points per bin (start/end) for accurate step-wise curve shape"
  - "ComparisonChart uses opacity:0.15 fills vs LossExceedanceChart opacity:0.2 — overlap visibility"
requirements-completed: [FRST-01, FRST-02, FRST-03]

# Metrics
duration: 50s
completed: "2026-03-26"
---

# Phase 14 Plan 02: Foresight v2 Frontend Summary

**Tab-based Foresight page with FAIR triangular-distribution scenario builder, auto-polling simulation status, and ECharts loss exceedance curve with P50/P90/P99 percentile markers.**

## Performance

- **Duration:** ~50s (post-merge)
- **Started:** 2026-03-26T05:57:21Z
- **Completed:** 2026-03-26T05:58:11Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced the "Coming in v2" teaser with a fully functional tab-based Foresight page
- Scenario list with CRUD (create/clone/delete), auto-poll at 2s intervals while simulations run, inline chart expansion
- ScenarioForm with FAIR sliders for TEF, Vulnerability, and Loss Magnitude (triangular distribution: min/mode/max)
- LossExceedanceChart rendering smooth area curve from histogram bins, P50/P90/P99 dashed markLines, dark mode support
- ComparisonChart for multi-scenario overlay (Plan 03 integration-ready)

## Task Commits

1. **Task 1: Foresight page shell + scenario list + scenario form** — `be5ab6c` (feat)
2. **Task 2: Loss exceedance chart + simulation detail view** — `774d1bf` (feat)

## Files Created/Modified

- `artifacts/riskmind-app/src/pages/foresight/foresight.tsx` — Tab-based page replacing teaser (Scenarios/Simulations/Calibration tabs)
- `artifacts/riskmind-app/src/pages/foresight/scenario-list.tsx` — ScenarioList with polling, CRUD, card-level chart expansion
- `artifacts/riskmind-app/src/pages/foresight/scenario-form.tsx` — FAIR parameter form with TriangularInput sliders and create/edit modes
- `artifacts/riskmind-app/src/components/foresight/loss-exceedance-chart.tsx` — LossExceedanceChart + ComparisonChart ECharts components

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `refetchInterval` as function | Query result available inside function — no external state for detecting active simulations |
| TriangularInput clamps adjacent sliders | Prevents invalid min>mode or mode>max state without requiring form-level validation |
| Inline chart expansion in card | Avoids dialog/sheet overhead for scenario result preview; P/click on TrendingUp icon |
| `buildExceedanceCurve` two points per bin | Produces accurate step-wise curve shape matching the histogram's piecewise-constant density |
| Merge main before building | Plan 01 Orval hooks (foresight scenarios/simulations) were in main but not in this worktree branch |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged main branch to obtain Plan 01 foresight hooks**
- **Found during:** Start of Task 1
- **Issue:** Worktree branch `worktree-agent-a638ea26` was forked from an older commit that predated Plan 01's Orval codegen. The hooks `useListForesightScenarios`, `useCreateForesightScenario` etc. were absent.
- **Fix:** `git merge main --no-edit --no-verify` to bring in commits up through `d44a293` (Plan 01 summary)
- **Files modified:** lib/api-client-react/src/generated/api.ts and api.schemas.ts (via merge)
- **Verification:** Hook exports confirmed present post-merge; build passed
- **Committed in:** merge commit (pre-task)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Essential prerequisite fix. No scope creep.

## Issues Encountered

None — after the merge, the build passed first try with no TypeScript errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 03 (Calibration) can use `usePostForesightCalibrate` hook and the "Calibrate from Real Data" button placeholder already in ScenarioForm
- Plan 04 dashboard widget can use `useGetForesightScenariosTopAle` and `LossExceedanceChart` from this plan
- ComparisonChart is export-ready for Plan 03 scenario comparison view

## Known Stubs

- **Calibration tab** — placeholder text "coming in Plan 03". `ScenarioForm` has a disabled "Calibrate from Real Data" button. Both are intentional; Plan 03 wires these.
- **Simulations tab** — placeholder "Select a scenario to view simulations". Deep simulation history view is deferred to Plan 03+.

These stubs do not block the plan's goal (FRST-01/02/03): scenarios can be created, simulations run, and loss exceedance curves displayed.

## Self-Check: PASSED

- `artifacts/riskmind-app/src/pages/foresight/foresight.tsx` — exists, contains TabsTrigger, Scenarios, Calibration
- `artifacts/riskmind-app/src/pages/foresight/scenario-list.tsx` — exists, contains ScenarioList, refetchInterval
- `artifacts/riskmind-app/src/pages/foresight/scenario-form.tsx` — exists, contains Slider, tef, vulnerability, lossMagnitude
- `artifacts/riskmind-app/src/components/foresight/loss-exceedance-chart.tsx` — exists, contains LossExceedanceChart, ReactECharts, areaStyle, markLine, P50/P90/P99, MutationObserver, ComparisonChart
- Build: `pnpm --filter @workspace/riskmind-app build` passes
- Commits: be5ab6c (Task 1), 774d1bf (Task 2)

---
*Phase: 14-foresight-v2*
*Completed: 2026-03-26*
