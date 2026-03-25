---
phase: 13-compliance-flow
plan: 03
subsystem: ui
tags: [react, compliance, dialog, sheet, framework-import, framework-create, threshold]

# Dependency graph
requires:
  - phase: 13-02
    provides: POST /v1/frameworks, POST /v1/frameworks/:id/import/preview, POST /v1/frameworks/:id/import/apply, PUT /v1/frameworks/:id/threshold, GET /v1/frameworks with compliancePercentage+complianceThreshold

provides:
  - ImportFrameworkDialog: Sheet side panel with file upload, diff preview (new/modified/unchanged), apply flow
  - CreateFrameworkDialog: modal form with name validation for creating new frameworks
  - framework-list.tsx: Create Framework button, per-card Import Controls button, client-side compliance status badges (COMPLIANT/AT-RISK/NON-COMPLIANT), no N+1 API calls
  - framework-detail.tsx: inline threshold editor, compliance status badge, Export CSV button

affects: [13-04, compliance-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - fetch() directly for Plan 02 endpoints not yet in Orval spec (same pattern as Phase 11 wizard)
    - FrameworkWithCompliance type extension for compliancePercentage/complianceThreshold not in generated types
    - ComplianceScoreExtended type extension for status field not in generated types
    - deriveComplianceStatus client-side function from list response fields — avoids N+1 calls to /compliance-score per card
    - Threshold editor as inline input+save pattern in detail page card

key-files:
  created:
    - artifacts/riskmind-app/src/components/compliance/import-framework-dialog.tsx
    - artifacts/riskmind-app/src/components/compliance/create-framework-dialog.tsx
  modified:
    - artifacts/riskmind-app/src/pages/compliance/framework-list.tsx
    - artifacts/riskmind-app/src/pages/compliance/framework-detail.tsx

key-decisions:
  - "Client-side status derivation in FrameworkCard from list response fields — avoids N+1 compliance-score API calls per card"
  - "Local type extensions (FrameworkWithCompliance, ComplianceScoreExtended) for Plan 02 additions not yet in Orval-generated types"
  - "Import dialog uses Sheet (side panel) for file upload->diff->apply flow; Create uses Dialog (modal) for simple form"

patterns-established:
  - "Compliance status derivation: score >= threshold=COMPLIANT, score >= threshold-15=AT-RISK, else=NON-COMPLIANT, null threshold=no badge"

requirements-completed: [COMP-01, COMP-03]

# Metrics
duration: 7min
completed: 2026-03-25
---

# Phase 13 Plan 03: Compliance Flow Frontend — Import, Create, and Threshold UI

**Framework import sheet with diff preview, create dialog, inline threshold editor, and compliance status badges on list and detail pages.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-25T00:42:12Z
- **Completed:** 2026-03-25T00:49:00Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- Created `ImportFrameworkDialog` as a Sheet side panel: file upload step with CSV/JSON format toggle, diff preview step showing new (green), modified (amber), and collapsed unchanged requirements, and apply step with success count display
- Created `CreateFrameworkDialog` as a modal form: name/version/type/description fields, name validation (required, min 3, max 100 chars), POST to /api/v1/frameworks
- Updated `framework-list.tsx`: removed N+1 useGetComplianceScore per card, added client-side `deriveComplianceStatus` from list response fields, added colored status badges (COMPLIANT/AT-RISK/NON-COMPLIANT), added Create Framework and per-card Import Controls buttons (canEdit gated)
- Updated `framework-detail.tsx`: inline threshold editor in Compliance Score card (canEdit gated), compliance status badge, Export CSV button, uses extended local types for Plan 02 fields not yet in generated Orval types

## Task Commits

1. **Task 1: Create import and create framework dialog components** - `8e8f8cd` (feat)
2. **Task 2: Wire dialogs into framework-list.tsx and add threshold editor** - `935840a` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `artifacts/riskmind-app/src/components/compliance/import-framework-dialog.tsx` — Sheet side panel: upload, diff preview, apply steps
- `artifacts/riskmind-app/src/components/compliance/create-framework-dialog.tsx` — Modal form with name validation
- `artifacts/riskmind-app/src/pages/compliance/framework-list.tsx` — Create/Import buttons, status badges, no N+1
- `artifacts/riskmind-app/src/pages/compliance/framework-detail.tsx` — Threshold editor, status badge, CSV export

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `artifacts/riskmind-app/src/components/compliance/import-framework-dialog.tsx` — FOUND
- `artifacts/riskmind-app/src/components/compliance/create-framework-dialog.tsx` — FOUND
- `artifacts/riskmind-app/src/pages/compliance/framework-list.tsx` — FOUND (modified)
- `artifacts/riskmind-app/src/pages/compliance/framework-detail.tsx` — FOUND (modified)
- Commit `8e8f8cd` — FOUND
- Commit `935840a` — FOUND
- TypeScript: 0 errors in compliance files
