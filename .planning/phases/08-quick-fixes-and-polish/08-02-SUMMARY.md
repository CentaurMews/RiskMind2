---
phase: 08-quick-fixes-and-polish
plan: "02"
subsystem: frontend-ux
tags: [mobile, ux, navigation, accessibility, dashboard]
dependency_graph:
  requires: []
  provides: [clickable-kpi-cards, mobile-heatmap-fallback, scroll-shadow-utility, 44px-touch-targets]
  affects: [dashboard, heatmap-grid, risk-list, alert-list, vendor-list, app-layout, login]
tech_stack:
  added: []
  patterns: [wouter-link-wrapping, tailwind-responsive-hidden, css-pseudo-element-gradient]
key_files:
  created: []
  modified:
    - artifacts/riskmind-app/src/components/dashboard/kpi-card.tsx
    - artifacts/riskmind-app/src/pages/dashboard.tsx
    - artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx
    - artifacts/riskmind-app/src/index.css
    - artifacts/riskmind-app/src/components/layout/app-layout.tsx
    - artifacts/riskmind-app/src/pages/login.tsx
    - artifacts/riskmind-app/src/pages/risks/risk-list.tsx
    - artifacts/riskmind-app/src/pages/alerts/alert-list.tsx
    - artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx
decisions:
  - "KpiCard wraps Card in wouter Link when href prop provided; card-level hover styles conditioned on href presence"
  - "HeatmapGrid uses Tailwind md:hidden / hidden md:grid for responsive toggle — no JS resize detection needed"
  - "scroll-shadow-x uses CSS ::after pseudo-element gradient overlay — no JS scroll listener needed"
  - "Compliance Score card wrapped in Link at dashboard level rather than converting to KpiCard — preserves custom progress bar markup"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 9
---

# Phase 8 Plan 02: Mobile UX Polish and KPI Navigation Summary

**One-liner:** Clickable KPI cards via wouter Link wrapping, mobile heatmap severity-list fallback with Tailwind responsive classes, CSS scroll-shadow utility applied to three table pages, and 44px touch targets on hamburger/collapse/social-login buttons.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Make KPI cards clickable and wire hrefs in dashboard | 9e538fa |
| 2 | Mobile heatmap fallback, scroll shadows, and touch target audit | 0e0316d |

## What Was Built

### Task 1 — KPI Card Navigation (DASH-06)

- Added `href?: string` to `KpiCardProps` interface in `kpi-card.tsx`
- Imported `Link` from `wouter` and conditionally wraps Card in `<Link href={href} className="block">` when prop is set
- Card hover classes switch from `hover:shadow-md` to `hover:shadow-lg hover:-translate-y-0.5 cursor-pointer` when href is present
- Dashboard wired: Active Risks → `/risks`, Open Alerts → `/alerts`, Active Vendors → `/vendors`
- Compliance Score raw Card wrapped in `<Link href="/compliance">` at dashboard level with matching hover styles

### Task 2 — Mobile Heatmap, Scroll Shadows, Touch Targets (MOB-01, MOB-02, MOB-03)

**HeatmapGrid mobile fallback:**
- Computes `severitySummary` (critical/high/medium/low risk counts) from cells data
- Renders `<div className="md:hidden space-y-2">` with four severity rows, each color-coded using severity CSS vars
- Original grid wrapped in `<div className="hidden md:grid grid-cols-5 grid-rows-5">` — invisible on mobile, visible at md+

**Scroll shadow utility:**
- `.scroll-shadow-x` in `index.css` sets `overflow-x: auto` + `::after` pseudo-element with right-edge gradient using `hsl(var(--background))`
- Applied to the `flex-1 overflow-auto` table wrapper div in `risk-list.tsx`, `alert-list.tsx`, and `vendor-list.tsx`

**44px touch targets:**
- Mobile hamburger `<Button>` in `app-layout.tsx`: added `h-11 w-11` (44px)
- Sidebar collapse `<button>` in `app-layout.tsx`: changed to `h-11 w-11 flex items-center justify-center`
- Social login buttons in `login.tsx`: `py-2.5` → `py-3` to reach 44px height

## Verification

All smoke checks pass:
1. `grep "href.*risks|href.*alerts|href.*vendors|href.*compliance"` — 4 matches in dashboard.tsx
2. `grep "md:hidden"` in heatmap-grid.tsx — matches
3. `grep "scroll-shadow-x"` in index.css — matches
4. `grep "h-11 w-11"` in app-layout.tsx — 2 matches (hamburger + collapse)
5. Build: `pnpm --filter riskmind-app build` — completed without errors (17.71s)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified present:
- artifacts/riskmind-app/src/components/dashboard/kpi-card.tsx — FOUND
- artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx — FOUND
- artifacts/riskmind-app/src/index.css — FOUND

Commits verified:
- 9e538fa (Task 1) — FOUND
- 0e0316d (Task 2) — FOUND
