---
phase: 13-compliance-flow
plan: "04"
subsystem: frontend/compliance
tags: [pdf-export, auto-map, pgvector, react-pdf, compliance]
dependency_graph:
  requires: [13-02]
  provides: [compliance-pdf-export, auto-map-approval-ui]
  affects: [framework-detail-page, control-list-page]
tech_stack:
  added: ["@react-pdf/renderer ^4.3.2"]
  patterns: [dynamic-import-pdf, dialog-with-fetch, checkbox-approval-flow]
key_files:
  created:
    - artifacts/riskmind-app/src/components/compliance/compliance-pdf-report.tsx
    - artifacts/riskmind-app/src/components/compliance/auto-map-approval-dialog.tsx
  modified:
    - artifacts/riskmind-app/src/pages/compliance/framework-detail.tsx
    - artifacts/riskmind-app/src/pages/compliance/control-list.tsx
    - artifacts/riskmind-app/package.json
decisions:
  - "@react-pdf/renderer dynamically imported in handleExportPdf to avoid bloating initial bundle — only loaded on demand"
  - "AutoMapApprovalDialog pre-selects suggestions with similarity > 0.8 on fetch — consistent with pgvector threshold convention"
  - "Apply Selected merges approved IDs with existingRequirementIds (deduped) rather than replacing — prevents accidental unmapping of manually-added requirements"
  - "fetchError state surfaces embeddings-not-configured message to user — actionable guidance toward Settings page"
metrics:
  duration: 393s
  completed: "2026-03-25"
  tasks_completed: 2
  files_changed: 5
---

# Phase 13 Plan 04: PDF Export and Auto-Map Approval UI Summary

**One-liner:** PDF compliance report with executive summary and gap table via @react-pdf/renderer, plus pgvector auto-mapping approval dialog with similarity-scored checkboxes on control list.

## What Was Built

### Task 1: @react-pdf/renderer Install and PDF Report Component

Installed `@react-pdf/renderer ^4.3.2` as a dependency. Created `compliance-pdf-report.tsx` using `Document`, `Page`, `Text`, `View`, `StyleSheet` from the library.

**Page 1 — Executive Summary:**
- Large score number (50pt font) with status label
- Coverage and effectiveness sub-scores with progress bars
- Gap summary grid: Total / Covered / Partial / Gaps with color-coded border-left

**Page 2 — Gap Details Table:**
- Columns: Code, Requirement, Status, Controls
- Only gap and partial requirements shown (executive brevity)
- Color coding: green=covered, amber=partial, red=gap text
- `wrap={false}` on rows to prevent row splitting across pages

**Footer:** "RiskMind Compliance Report | Confidential | Page N" on each page.

Design follows Apple-like minimalist aesthetic: Helvetica, #111827 dark text, generous padding, thin `#e5e7eb` borders.

### Task 2: Auto-Map Approval Dialog + PDF Export Wiring

**`auto-map-approval-dialog.tsx`:**
- On `open`: fires `POST /api/v1/controls/${controlId}/auto-map-suggestions`
- Pre-checks suggestions with similarity > 0.8 (high-confidence auto-selection)
- Each row: checkbox + requirement code badge + title + similarity % badge (color-coded: green ≥85%, amber ≥70%, gray otherwise)
- "Already mapped" items shown as disabled/dimmed
- "Apply Selected": `POST /api/v1/controls/${controlId}/requirements` with merged IDs
- Loading spinner, fetch error state, empty state with embeddings guidance

**`framework-detail.tsx` PDF export:**
- Added `exporting` state and `FileDown` icon import
- `handleExportPdf`: dynamically imports `pdf` from `@react-pdf/renderer` and `CompliancePdfReport` (avoids bundle bloat on initial load)
- Calls `.toBlob()` → creates object URL → triggers download
- Export PDF button in header row with spinner while generating

**`control-list.tsx` auto-map wiring:**
- Replaced Link2 icon with Sparkles icon (violet) in Mapping column
- Added `autoMapOpen` / `autoMapControl` state
- `handleOpenAutoMap` sets control id + title, opens dialog
- `handleAutoMapSuccess` invalidates `["/api/v1/controls"]` query
- `AutoMapApprovalDialog` rendered at bottom of component

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `existingRequirementIds` passed to `AutoMapApprovalDialog` from `control-list.tsx` is always `[]` because the control list API response does not include currently-mapped requirement IDs. The merge logic in `handleApply` will still add new selections; it just won't prevent re-adding already-mapped ones. A future plan that adds `requirementIds` to the control list response would complete this.

## Self-Check: PASSED

- `artifacts/riskmind-app/src/components/compliance/compliance-pdf-report.tsx` — FOUND
- `artifacts/riskmind-app/src/components/compliance/auto-map-approval-dialog.tsx` — FOUND
- Commit `dce626e` — Task 1 (install + PDF component)
- Commit `5d56051` — Task 2 (auto-map dialog + PDF wiring)
