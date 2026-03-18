---
phase: 03-dashboard-polish-and-demo-readiness
plan: "02"
subsystem: frontend/dashboard
tags: [dashboard, widgets, kpi, heatmap, kri, alerts, components]
dependency_graph:
  requires: [03-01]
  provides: [dashboard-widgets, heatmap-grid-shared, alert-bell-header]
  affects: [dashboard-page, heatmap-page, app-layout]
tech_stack:
  added: []
  patterns: [skeleton-loading, traffic-light-bars, delta-badges, popover-alerts, shared-grid-component]
key_files:
  created:
    - artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx
    - artifacts/riskmind-app/src/components/dashboard/kpi-card.tsx
    - artifacts/riskmind-app/src/components/dashboard/kri-widget.tsx
    - artifacts/riskmind-app/src/components/dashboard/executive-summary.tsx
    - artifacts/riskmind-app/src/components/dashboard/alert-bell.tsx
  modified:
    - artifacts/riskmind-app/src/pages/dashboard.tsx
    - artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx
    - artifacts/riskmind-app/src/components/layout/app-layout.tsx
    - lib/api-client-react/src/index.ts
decisions:
  - "HeatmapGrid accepts compact prop — same component in dashboard (compact=true) and heatmap page (compact=false)"
  - "customFetch exported from api-client-react index instead of subpath — avoids package.json exports config change"
  - "KRI data fetched via useQuery + customFetch (no generated hook for tenant-wide /v1/kris endpoint)"
metrics:
  duration: 25min
  completed: "2026-03-18"
  tasks: 2
  files_modified: 9
---

# Phase 03 Plan 02: Dashboard Widget Components Summary

Five dashboard widget components built and fully wired into dashboard and layout — delivering skeleton KPIs with delta badges, clickable heatmap, KRI traffic lights, executive summary, and alert bell badge in header.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create shared HeatmapGrid component | a12e31b | heatmap-grid.tsx, dashboard.tsx, risk-heatmap.tsx |
| 2 | Build KpiCard, KriWidget, ExecutiveSummary, AlertBell | 23cb267 | 4 new components, dashboard.tsx, app-layout.tsx, api index |

## What Was Built

### HeatmapGrid (shared component)
- 5x5 grid with color-coded cells by risk score (critical/high/medium/low)
- `compact` prop controls cell size and font for dashboard vs full heatmap page
- `onCellClick` prop for navigation with cursor-pointer + ring hover styling
- Dashboard cells navigate to `/risks/heatmap?l=N&i=N`
- Heatmap page reads `?l=&i=` query params on mount to initialize `selectedCell`

### KpiCard
- Skeleton loading state via `Skeleton` component (no raw 0 values while loading)
- Delta badge: `↑ N from last week` (emerald) / `↓ N from last week` (destructive)
- Optional mini sparkline using Recharts LineChart
- Active Risks: delta=+3, Open Alerts: delta=-1, Active Vendors: subtitle only

### KriWidget
- Traffic light horizontal bars: red (critical), amber (warning), green (ok)
- Threshold logic: `current >= criticalThreshold → red`, `>= warningThreshold → amber`, else green
- Bar width proportional to current value relative to max
- Skeleton loading with 4 placeholder rows
- Data from `GET /v1/kris?limit=8` via `useQuery + customFetch`

### ExecutiveSummary
- Top 5 open risks sorted by score (likelihood × impact) descending
- Overdue count banner with destructive styling when overdues exist
- Severity badge + risk title + score per row
- Skeleton loading for risk list

### AlertBell
- Bell icon button in AppLayout header
- Red badge with active count (shows "9+" when > 9)
- Popover dropdown with recent 5 active alerts (severity badge + title + timestamp)
- "View all" link to `/alerts`

### Dashboard Layout Refactored
New order: KPIs row → Heatmap (1 col) + ExecutiveSummary (2 cols) → KriWidget (full) → Recent Alerts table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `custom-fetch` subpath export in api-client-react**
- **Found during:** Task 2 build
- **Issue:** `@workspace/api-client-react/custom-fetch` subpath not declared in package.json exports, causing Vite build failure
- **Fix:** Exported `customFetch` from `lib/api-client-react/src/index.ts` main entry; updated import in kri-widget.tsx to use `@workspace/api-client-react`
- **Files modified:** `lib/api-client-react/src/index.ts`, `kri-widget.tsx`
- **Commit:** 23cb267

## Self-Check

Files created:
- [x] artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx
- [x] artifacts/riskmind-app/src/components/dashboard/kpi-card.tsx
- [x] artifacts/riskmind-app/src/components/dashboard/kri-widget.tsx
- [x] artifacts/riskmind-app/src/components/dashboard/executive-summary.tsx
- [x] artifacts/riskmind-app/src/components/dashboard/alert-bell.tsx

Commits verified:
- [x] a12e31b (Task 1)
- [x] 23cb267 (Task 2)

Build: Passed — zero TypeScript errors
App: Running at https://app.riskmind.net

## Self-Check: PASSED
