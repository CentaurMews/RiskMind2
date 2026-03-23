---
phase: 11-vendor-lifecycle-redesign
plan: "04"
subsystem: vendor-ui
tags: [subprocessors, score-badge, vendor-detail, vendor-list, kanban, 4th-party-risk]
dependency_graph:
  requires: [11-02]
  provides: [subprocessors-ui, score-badge-ui]
  affects: [vendor-detail, vendor-list]
tech_stack:
  added: []
  patterns:
    - collapsible-section-below-tabs
    - score-badge-severity-colors
    - sheet-with-link-create-modes
key_files:
  created: []
  modified:
    - artifacts/riskmind-app/src/pages/vendors/vendor-detail.tsx
    - artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx
decisions:
  - ScoreBadge stops propagation on click to avoid Link wrapper navigation conflict in kanban cards
  - "In Progress" badge shown for identification-stage vendors with null riskScore — distinguishes wizard stubs
  - ScoreBadge placed on table rows too for consistency across both view modes
metrics:
  duration: 239s
  completed: "2026-03-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase 11 Plan 04: Subprocessors Section and Score Badge Summary

**One-liner:** Collapsible 4th-party subprocessors section on vendor detail with CRUD sheet, plus assessment-driven ScoreBadge on all vendor kanban cards and table rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add collapsible subprocessors section to vendor-detail.tsx | bc77441 | vendor-detail.tsx |
| 2 | Add ScoreBadge to vendor kanban cards | d20a860 | vendor-list.tsx |

## What Was Built

### Task 1: Collapsible Subprocessors Section (vendor-detail.tsx)

- Collapsible section renders BELOW the Tabs area (not as a tab) per D-04
- Collapsed by default when count = 0; auto-opens via useEffect when subprocessors.length > 0
- Table columns: Vendor Name (link to /vendors/:id), Relationship Type, Criticality (severity badge), Discovered By (manual=outline, llm=primary-tint), Actions (X delete button)
- "Add Subprocessor" button in header with `e.stopPropagation()` to prevent collapsible toggle
- Add Subprocessor Sheet with two modes toggled by buttons:
  - Link Existing: search input + vendor select (GET /v1/vendors?search=...) + relationship type + criticality
  - Create New: name + relationship type + criticality
- POST /v1/vendors/:id/subprocessors with `discoveredBy: "manual"`
- 409 duplicate detection with specific toast: "This vendor is already linked as a subprocessor."
- Delete via DELETE /v1/vendors/:id/subprocessors/:subId with toast feedback
- Empty state: "No Subprocessors" / "Track fourth-party vendors that this vendor relies on."
- `aria-expanded` on CollapsibleTrigger for accessibility

### Task 2: ScoreBadge Component (vendor-list.tsx)

- ScoreBadge function component above VendorList
- Severity color scale: >=75=red, >=50=amber, >=25=yellow, <25=emerald
- Format: `{score}/100` in `font-mono text-xs font-semibold`
- `aria-label="Risk score: N out of 100"` for screen readers
- Click: `e.stopPropagation() + e.preventDefault()` then `navigate(/vendors/:id)`
- Null score renders nothing (no badge)
- Applied to both kanban cards (top-right via flex justify-between) and table rows (Score column)
- "In Progress" badge on identification-stage vendors with null riskScore (bg-muted text-muted-foreground)

## Deviations from Plan

### Auto-applied improvements

**1. [Rule 2 - Missing Critical] Added e.preventDefault() to ScoreBadge click handler**
- **Found during:** Task 2
- **Issue:** ScoreBadge is inside a `<Link>` wrapper in kanban cards — stopPropagation alone doesn't prevent the Link navigation
- **Fix:** Added `e.preventDefault()` alongside `e.stopPropagation()` so the badge click navigates via imperative `navigate()` rather than triggering the Link's href
- **Files modified:** vendor-list.tsx

None others — plan executed as written.

## Self-Check

### Files exist
- [x] `artifacts/riskmind-app/src/pages/vendors/vendor-detail.tsx` — modified
- [x] `artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` — modified

### Commits exist
- [x] bc77441 — feat(11-04): add collapsible subprocessors section to vendor detail
- [x] d20a860 — feat(11-04): add ScoreBadge to vendor kanban cards and table

### Build
- [x] `pnpm --filter riskmind-app build` — zero errors, 2826 modules transformed

## Self-Check: PASSED
