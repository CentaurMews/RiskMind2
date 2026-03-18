---
phase: 03-dashboard-polish-and-demo-readiness
plan: "03"
subsystem: frontend-ui
tags: [ui-polish, skeleton, empty-state, pagination, rbac, csv-export, kanban, breadcrumb, toast]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [polished-list-pages, kanban-vendor-view, detail-breadcrumbs, universal-toast-errors]
  affects: [risk-list, alert-list, finding-list, signal-list, vendor-list, control-list, treatments-tab, risk-detail, vendor-detail, framework-detail, framework-list]
tech_stack:
  added: []
  patterns:
    - Skeleton table rows replacing Loader2 spinners
    - Empty component with icon and CTA for zero-data states
    - Server-side pagination with page/limit params and page reset on filter change
    - RBAC canEdit gate using useGetMe (admin or risk_manager role)
    - Destructive toast on every mutation onError
    - Client-side CSV export using Blob + URL.createObjectURL
    - Vendor kanban view using viewMode toggle and limit=200 fetch
    - Shadcn Breadcrumb on detail pages above page heading
key_files:
  created: []
  modified:
    - artifacts/riskmind-app/src/pages/risks/risk-list.tsx
    - artifacts/riskmind-app/src/pages/alerts/alert-list.tsx
    - artifacts/riskmind-app/src/pages/signals/finding-list.tsx
    - artifacts/riskmind-app/src/pages/signals/signal-list.tsx
    - artifacts/riskmind-app/src/pages/compliance/control-list.tsx
    - artifacts/riskmind-app/src/pages/risks/treatments-tab.tsx
    - artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx
    - artifacts/riskmind-app/src/pages/compliance/framework-list.tsx
    - artifacts/riskmind-app/src/pages/risks/risk-detail.tsx
    - artifacts/riskmind-app/src/pages/vendors/vendor-detail.tsx
    - artifacts/riskmind-app/src/pages/compliance/framework-detail.tsx
decisions:
  - "Client-side search filtering for alerts (ListAlertsParams has no search field — API limitation)"
  - "vendor-list shows 'Never' for lastAssessmentDate and '—' for openFindingsCount (Vendor type lacks these fields — placeholders used per plan guidance)"
  - "control-list and treatments-tab files are at compliance/ and risks/ subdirectories, not controls/ and risks/ as plan described"
metrics:
  duration: 10min
  completed: "2026-03-18"
  tasks_completed: 3
  files_modified: 11
---

# Phase 3 Plan 03: UI Polish — Skeleton, Empty, Pagination, Kanban, Breadcrumbs, RBAC Summary

Comprehensive UI polish pass applying consistent production-grade patterns across all five list pages and three detail pages: skeleton loading rows, empty states with CTAs, server-side pagination, RBAC create-button gates, destructive toast errors on all mutations, CSV export on risks, vendor kanban pipeline view, and breadcrumb navigation on detail pages.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Polish risk-list.tsx | e06e8e7 | risk-list.tsx |
| 2 | Polish alert/finding/signal lists + wire toast to control+treatment | ffd7b8b | alert-list.tsx, finding-list.tsx, signal-list.tsx, control-list.tsx, treatments-tab.tsx |
| 3 | Vendor kanban+scorecard, compliance RBAC, breadcrumbs | b204f6f | vendor-list.tsx, framework-list.tsx, risk-detail.tsx, vendor-detail.tsx, framework-detail.tsx |

## What Was Built

**Task 1 — risk-list.tsx:**
- 5 Skeleton rows (7 columns) replacing Loader2 spinner
- `<Empty>` component with ShieldAlert icon and Create Risk CTA (RBAC-gated)
- Server-side pagination: `page`/`limit` params, `setPage(1)` on every filter/search change
- CSV export button in toolbar — client-side generation with Blob + filename date
- RBAC: `useGetMe` + `canEdit = admin || risk_manager` gating Create Risk button and Empty CTA
- Destructive toast on `createMutation.onError`

**Task 2 — alert-list, finding-list, signal-list, control-list, treatments-tab:**
- alert-list: search input (client-side, API lacks search param), severity filter resets page, 5 skeleton rows, Empty Bell state, Pagination, toast on ackMutation onError
- finding-list: `page`/`limit` added to `useListFindings`, 5 skeleton rows, Empty GitMerge state, Pagination
- signal-list: `page`/`limit` added to all 3 tab queries, reset on tab/search, 5 skeleton rows, Empty Activity state, Pagination
- control-list: `toast` imported, destructive onError added to `createMutation` and `mapMutation`
- treatments-tab: `toast` imported, destructive onError added to create/update/generateMemorandum/approve/reject mutations

**Task 3 — vendor-list, framework-list, detail pages:**
- vendor-list: table/kanban view toggle (List/LayoutGrid icons), 7-column kanban pipeline (one column per lifecycle stage), full scorecard in table view (Score with color-coded value, TierBadge, Last Assessment "Never" placeholder, Findings "—" placeholder, Lifecycle), 5 skeleton rows, Empty Building2 state, Pagination (table mode only), RBAC-gated Add Vendor, toast on create error, kanban fetches `limit=200`
- framework-list: `useGetMe` RBAC pattern added (canEdit), note comment since no create buttons exist on this page yet
- risk-detail: Shadcn `<Breadcrumb>` with "Risks > {risk.title}" above the page heading
- vendor-detail: Shadcn `<Breadcrumb>` with "Vendors > {vendor.name}" above the page heading
- framework-detail: Shadcn `<Breadcrumb>` with "Compliance > {framework.name}" above the page heading

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Client-side search filtering for alerts**
- **Found during:** Task 2
- **Issue:** `ListAlertsParams` schema has no `search` field (confirmed by inspecting generated API types). The search input was planned as an API-level filter.
- **Fix:** Added search input that performs client-side filtering on the current page's alert data (title + type fields). Documented in decisions.
- **Files modified:** artifacts/riskmind-app/src/pages/alerts/alert-list.tsx
- **Impact:** Search only filters within the current page (20 results). For production, the API would need a search param added.

**2. [Rule 1 - Bug] control-list.tsx and treatments-tab.tsx paths differ from plan**
- **Found during:** Task 2
- **Issue:** Plan referenced `artifacts/riskmind-app/src/pages/controls/control-list.tsx` and `artifacts/riskmind-app/src/pages/risks/treatment-list.tsx` — neither exists. Actual paths are `compliance/control-list.tsx` and `risks/treatments-tab.tsx`.
- **Fix:** Applied toast wiring to the correct file locations.
- **Files modified:** compliance/control-list.tsx, risks/treatments-tab.tsx

**3. [Rule 2 - Missing data] Vendor scorecard fields not in Vendor type**
- **Found during:** Task 3
- **Issue:** `Vendor` interface lacks `lastAssessmentDate` and `openFindingsCount` fields.
- **Fix:** Per plan guidance ("If the Vendor schema doesn't have this field directly, show placeholder"), rendered "Never" for last assessment and "—" for findings count.
- **Files modified:** artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx

## Self-Check: PASSED

All 11 modified files present. All 3 task commits verified (e06e8e7, ffd7b8b, b204f6f). TypeScript build passes with zero errors. PM2 riskmind process online.
