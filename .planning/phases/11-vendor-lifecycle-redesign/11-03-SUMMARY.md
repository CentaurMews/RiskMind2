---
phase: 11-vendor-lifecycle-redesign
plan: "03"
subsystem: tprm-frontend
tags: [vendors, wizard, onboarding, enrichment, frontend]
dependency_graph:
  requires: [11-01-vendor-wizard-api, 11-02-vendor-monitoring]
  provides: [vendor-onboard-wizard-page, wizard-route, updated-vendor-list]
  affects:
    - artifacts/riskmind-app/src/pages/vendors/vendor-onboard.tsx
    - artifacts/riskmind-app/src/App.tsx
    - artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx
tech_stack:
  added: []
  patterns:
    - Full-page wizard with left progress sidebar (desktop) and horizontal stepper (mobile)
    - Step inference on mount via GET /v1/vendors/onboard/:id with redirect if status !== identification
    - AI enrichment auto-trigger via useEffect on step 4 mount + setInterval poll every 2s
    - beforeunload + AlertDialog dual guard for dirty wizard state
    - fetch-based API calls (not Orval) for wizard endpoints not yet in generated client
key_files:
  created:
    - artifacts/riskmind-app/src/pages/vendors/vendor-onboard.tsx
  modified:
    - artifacts/riskmind-app/src/App.tsx
    - artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx
decisions:
  - fetch() used directly for wizard API calls since Orval generated client does not yet include wizard endpoints (added in Phase 11-01)
  - Step components defined as separate functions in same file for co-location without cross-file coupling
  - Subprocessor extraction (POST extract-subprocessors) is optional — failure is silently swallowed since endpoint may not exist yet in API
metrics:
  duration: 272s
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 3
---

# Phase 11 Plan 03: Vendor Onboarding Wizard Frontend Summary

**One-liner:** 4-step full-page vendor onboarding wizard with AI enrichment polling, cancel guard, resume-from-saved-step, and wizard route replacing old Sheet form in vendor-list.tsx.

## What Was Built

### Task 1: vendor-onboard.tsx — 4-step wizard page (1297 lines)

**Route:** `/vendors/onboard/:id` — receives `id` param; `"new"` triggers create flow, any other value triggers resume flow.

**Layout:**
- Left 240px fixed progress sidebar (desktop) with step circles, step labels, and "Cancel Onboarding" link
- Horizontal mobile stepper at top (collapsed sidebar)
- Right: scrollable step content with Progress bar (h-1) and step counter "Step N of 4"

**Step 1 — Identity + Tier:**
- Form: name (required), description (Textarea 3 rows), category, contactEmail, contactName, tier (Select with colored dot per tier)
- Inline validation: "Vendor name is required." and "Enter a valid email address."
- New vendor: POST /v1/vendors/onboard → navigate to /vendors/onboard/:id (replace) + advance to step 2
- Resuming: PATCH /v1/vendors/onboard/:id with step=1 data

**Step 2 — Questionnaire Assignment:**
- Fetches GET /v1/assessment-templates on mount
- 2-column card grid with name, description (line-clamp-2), question count badge
- Selected card: `border-primary ring-1 ring-primary`
- "Skip for now" link skips without template assignment
- PATCH step=2 with assessmentTemplateId (or null)

**Step 3 — Document Upload:**
- Styled dropzone (border-dashed) wrapping hidden `Input type="file"` for PDF/DOCX/TXT
- Drag-and-drop support via onDrop handler
- POST /v1/vendors/:vendorId/documents after file selection
- Uploaded file list in Table with filename, size, remove button
- POST /v1/vendors/:vendorId/extract-subprocessors after each upload (optional — silently ignored on failure)
- Subprocessor suggestions panel with checkboxes + "Save Selected" button

**Step 4 — AI Enrichment Review:**
- useEffect auto-triggers POST /v1/vendors/onboard/:id/enrich on mount
- Skeleton loading state during enqueuing/polling phases
- setInterval(poll, 2000) against GET /v1/jobs/:jobId until status=completed or failed
- On complete: editable cards for industry, riskIndicators, breachHistory, descriptionEnrichment
- On error: Alert variant=destructive with inline "Skip" link
- "Complete Onboarding" PATCH step=4 → navigate to /vendors/:id

**Cancel Onboarding AlertDialog:**
- Title: "Cancel Onboarding?" / Body: "This will permanently delete the incomplete vendor record."
- Confirm "Delete Vendor" (destructive) → DELETE /v1/vendors/onboard/:id → navigate /vendors
- Cancel: "Keep Editing"

**Leave Onboarding AlertDialog:**
- Shown when isDirty and user navigates away
- beforeunload handler when isDirty for browser close/reload

**Resume flow:**
- GET /v1/vendors/onboard/:id on mount
- Sets currentStep from wizardStep, pre-fills step1Data
- Redirects to /vendors/:id if status !== 'identification'

### Task 2: App.tsx + vendor-list.tsx

**App.tsx:**
- Added `import VendorOnboard from "@/pages/vendors/vendor-onboard"`
- Added route `/vendors/onboard/:id` BEFORE `/vendors/:id` (critical order)

**vendor-list.tsx:**
- Removed `useCreateVendor`, `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetTrigger`, `SheetDescription`, `Label`, `Loader2`, `toast` imports
- Removed `isOpen`, `formData` state
- Removed `createMutation` mutation
- Removed `handleSubmit` function
- Removed entire Sheet block (lines 142-173 in original)
- Added `useLocation` import from wouter
- Added `const [, navigate] = useLocation()`
- Replaced `onClick={() => setIsOpen(true)}` with `onClick={() => navigate("/vendors/onboard/new")}` on both Add Vendor buttons (header + empty state)

## Commits

| Task | Commit | Description |
|---|---|---|
| Task 1 | ec4b100 | feat(11-03): create 4-step vendor onboarding wizard page |
| Task 2 | f6841ff | feat(11-03): register wizard route and remove old vendor creation Sheet |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. The subprocessor extraction call (POST /v1/vendors/:vendorId/extract-subprocessors) was added as optional per the plan's requirement for step 3, with silent failure to guard against endpoint absence.

## Self-Check: PASSED

- `artifacts/riskmind-app/src/pages/vendors/vendor-onboard.tsx` — FOUND (1297 lines)
- `artifacts/riskmind-app/src/App.tsx` — modified (route registered)
- `artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` — modified (Sheet removed, navigate added)
- Commit ec4b100 — FOUND
- Commit f6841ff — FOUND
- `pnpm --filter riskmind-app build` — zero TypeScript/build errors
- `/vendors/onboard/:id` route placed before `/vendors/:id` in App.tsx — CONFIRMED
- `Register New Vendor` not in vendor-list.tsx — CONFIRMED
- `SheetTrigger` not in vendor-list.tsx — CONFIRMED
