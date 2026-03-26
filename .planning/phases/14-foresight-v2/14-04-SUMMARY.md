---
phase: 14-foresight-v2
plan: 04
subsystem: ui
tags: [react, echarts, foresight, ale, dashboard, orval]

# Dependency graph
requires:
  - phase: 14-foresight-v2 (plans 01-03)
    provides: Monte Carlo backend, Orval hooks including useGetForesightScenariosTopAle, full Foresight page with tabs
provides:
  - Top Risks by ALE dashboard widget (ale-widget.tsx) showing top-5 scenarios by expected annual loss
  - Dashboard integration with AleWidget placed alongside KriWidget in responsive 3-column grid
affects: [dashboard, foresight, 14-foresight-v2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ALE formatting: USD compact notation (e.g. $1.2M/yr) using manual thresholds ($1M, $1K)"
    - "Empty state with CTA link pattern: 'No simulations yet.' + 'Run First Simulation' href=/foresight"
    - "Error state graceful fallback: treat isError same as empty (no crash, show empty state)"

key-files:
  created:
    - artifacts/riskmind-app/src/components/dashboard/ale-widget.tsx
  modified:
    - artifacts/riskmind-app/src/pages/dashboard.tsx

key-decisions:
  - "AleWidget placed in 3-column grid row alongside KriWidget (2-col) rather than separate row — co-locates quantitative widgets"
  - "Error state falls back to empty state (not error message) — ALE widget is supplementary; silent fallback is friendlier"
  - "formatAle uses manual thresholds ($1M/$1K) not Intl.NumberFormat compact — avoids locale-dependent output for financial values"

patterns-established:
  - "Dashboard widget: Card with CardHeader title + icon, CardContent with loading/empty/data states"
  - "Empty state: centered flex column, muted text, primary-colored Link CTA"

requirements-completed: [FRST-05]

# Metrics
duration: 8min
completed: 2026-03-26
---

# Phase 14 Plan 04: Dashboard ALE Widget Summary

**ALE dashboard widget with top-5 scenario rankings, USD compact formatting, and empty state linking to Foresight — deployed via PM2**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-26T06:23:50Z
- **Completed:** 2026-03-26T06:31:XX Z
- **Tasks:** 1 completed, 1 checkpoint (human-verify)
- **Files modified:** 2

## Accomplishments
- Created `ale-widget.tsx` using the Orval `useGetForesightScenariosTopAle` hook to display top-5 risks by expected annual loss
- Empty state shows "No simulations yet." with "Run First Simulation" link to `/foresight`
- Integrated AleWidget into `dashboard.tsx` in a responsive 3-column grid alongside KriWidget
- Deployed via `pnpm run deploy` — frontend and backend rebuilt, PM2 restarted (riskmind process online)

## Task Commits

Each task was committed atomically:

1. **Task 1: ALE widget + dashboard integration + deploy** - `05755fd` (feat)

**Plan metadata:** (pending — docs commit after checkpoint)

## Files Created/Modified
- `artifacts/riskmind-app/src/components/dashboard/ale-widget.tsx` - New widget: top-5 ALE ranking card with loading/empty/error/data states
- `artifacts/riskmind-app/src/pages/dashboard.tsx` - Added AleWidget import and placement in 3-column grid with KriWidget

## Decisions Made
- AleWidget placed alongside KriWidget in a 2+1 column split (KriWidget takes 2/3, AleWidget takes 1/3) — both are quantitative secondary widgets
- formatAle() uses manual thresholds ($1M, $1K) for consistent compact formatting regardless of browser locale

## Deviations from Plan

None - plan executed exactly as written. Merge of main branch into worktree was required first (worktree-agent-a721cd38 was behind by phase 14 commits), handled transparently.

## Issues Encountered
- Worktree `agent-a721cd38` was branched from phase 13 end-point and missing all phase 14 code. Resolved by merging `main` into worktree branch before implementing.

## User Setup Required
None - no external service configuration required.

## Checkpoint: Task 2 — End-to-end Foresight v2 Verification

**Status:** Awaiting human verification.

**App deployed at:** https://app.riskmind.net

**Verification steps:**
1. Navigate to https://app.riskmind.net/foresight — verify three tabs visible (Scenarios, Simulations, Calibration)
2. Click "New Scenario" — verify FAIR parameter form with TEF/Vulnerability/Loss Magnitude sliders
3. Set TEF: 5/15/30, Vulnerability: 0.2/0.4/0.6, Loss Magnitude: 50000/200000/500000, name it "Test Scenario"
4. Click Run Simulation — verify 202 accepted, status shows pending -> running -> completed
5. View completed simulation — verify loss exceedance curve with P50/P90/P99 markers
6. Clone the scenario — verify "Test Scenario (Copy)" appears
7. Edit clone parameters, run another simulation
8. Try "Compare" — select both scenarios, verify overlaid curves and parameter diff table
9. Go to Calibration tab — click "Calibrate from Real Data" — verify results or "insufficient data" message
10. Navigate to Dashboard (https://app.riskmind.net/) — verify "Top Risks by ALE" card appears
11. Check dark mode toggle — verify charts render correctly in both themes

## Next Phase Readiness
- Phase 14 Foresight v2 feature-complete pending human end-to-end verification
- ALE widget, Monte Carlo engine, scenario CRUD, loss exceedance chart, calibration, comparison all implemented
- Ready to mark FRST-01 through FRST-05 complete after human approval

---
*Phase: 14-foresight-v2*
*Completed: 2026-03-26*
