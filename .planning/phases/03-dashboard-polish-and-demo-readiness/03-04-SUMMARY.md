---
phase: 03-dashboard-polish-and-demo-readiness
plan: "04"
subsystem: frontend-ui
tags: [command-palette, sparklines, compliance, search, ui-polish]
dependency_graph:
  requires: [03-01, 03-02, 03-03]
  provides: [command-palette, risk-sparklines, compliance-posture-labels]
  affects: [App.tsx, risk-list.tsx, framework-list.tsx]
tech_stack:
  added: [cmdk (via shadcn CommandDialog)]
  patterns: [global-keyboard-shortcut, debounced-search, synthetic-sparkline, posture-label-badge]
key_files:
  created:
    - artifacts/riskmind-app/src/components/command-palette/command-palette.tsx
  modified:
    - artifacts/riskmind-app/src/App.tsx
    - artifacts/riskmind-app/src/pages/risks/risk-list.tsx
    - artifacts/riskmind-app/src/pages/compliance/framework-list.tsx
decisions:
  - CommandPalette mounted inside WouterRouter (not outside) to provide wouter useLocation context
  - customFetch imported from @workspace/api-client-react index (not subpath) per prior Phase 3 decision
  - generateSparkline uses synthetic data ending at likelihood*impact score for visual trajectory
  - Compliance posture label (Compliant/Partial/At Risk) added below existing ScoreRing rather than replacing it
metrics:
  duration: "3 min"
  completed: "2026-03-18"
  tasks_completed: 2
  files_modified: 4
---

# Phase 3 Plan 04: Command Palette, Sparklines, and Compliance Posture Summary

**One-liner:** Global Cmd+K command palette with debounced semantic search, risk sparkline trend column, and compliance posture labels completing Phase 3.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build CommandPalette and mount in App.tsx | 30f4663 | command-palette.tsx, App.tsx |
| 2 | Add sparklines to risk list and compliance posture labels | a040095 | risk-list.tsx, framework-list.tsx |

## What Was Built

### Task 1: CommandPalette Component

Created `/artifacts/riskmind-app/src/components/command-palette/command-palette.tsx`:

- `CommandDialog` (shadcn/ui) modal toggled by Cmd+K / Ctrl+K global keyboard shortcut
- `useEffect` registers `keydown` listener; cleanup on unmount
- Debounced (300ms) `POST /api/v1/search` via `customFetch` with `{ query, types: ["risk","vendor","signal"] }`
- Results grouped: Risks (ShieldAlert), Vendors (Building2), Signals (Activity)
- Quick Actions group shown when no query: Dashboard, Risks, Vendors, Signals, Alerts, Compliance
- Graceful empty state: `CommandEmpty` renders "No results found for..." when search returns nothing
- Loading spinner (Loader2) shown during debounced search flight
- Selecting any result navigates via wouter `useLocation` and closes the palette
- Mounted inside `<WouterRouter>` in App.tsx so wouter context is available

### Task 2: Risk Sparklines and Compliance Posture

**risk-list.tsx:**
- Added `generateSparkline(score)` — 12-point synthetic trajectory array ending at `likelihood * impact`
- Added `ChartContainer + LineChart + Line` imports (recharts via shadcn chart)
- New "Trend" `<TableHead>` between Severity and Status columns
- Each risk row gets a `h-8 w-16` `ChartContainer` sparkline in the Trend column
- Skeleton `<TableCell><Skeleton className="h-8 w-16" /></TableCell>` added to loading state rows
- Empty state `colSpan` updated from 7 to 8

**framework-list.tsx:**
- `cn` utility import added
- `FrameworkCard` wraps `ScoreRing` in a flex column with a new posture label beneath it
- Label text: "Compliant" (≥80%, emerald-600) / "Partial" (≥50%, amber-600) / "At Risk" (<50%, destructive)

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript build: `pnpm --filter riskmind-app build` passes with zero errors (2799 modules)
- PM2 process `riskmind` restarted and online (pid 3880640)
- App available at https://app.riskmind.net

## Self-Check

- [x] `command-palette.tsx` file exists
- [x] `CommandPalette` imported and rendered in App.tsx
- [x] `v1/search` POST called in command-palette.tsx
- [x] `metaKey || ctrlKey` keyboard shortcut present
- [x] `QUICK_ACTIONS` / "Quick Actions" group present
- [x] `ChartContainer` and `LineChart` used in risk-list.tsx
- [x] `generateSparkline` function present in risk-list.tsx
- [x] `ScoreRing` + `Compliant/Partial/At Risk` labels in framework-list.tsx
- [x] Commits 30f4663 and a040095 exist in git log
