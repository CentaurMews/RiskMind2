---
phase: 06-bug-fixes-and-wizard-ui
plan: "02"
subsystem: ui
tags: [react, shadcn, tanstack-query, llm, wizard, routing]

# Dependency graph
requires:
  - phase: 05-llm-intelligence-backend
    provides: LLM provider CRUD, discover/benchmark/routing APIs and generated hooks
  - phase: 06-bug-fixes-and-wizard-ui
    plan: "01"
    provides: bug fixes including embeddings banner, settings validation
provides:
  - 6-step LlmConfigWizard Sheet component (provider select → credentials → discover → model select → benchmark → routing)
  - RoutingTableCard standalone component showing per-task model assignments
  - settings.tsx updated with wizard trigger button and RoutingTableCard mounted in LLM tab
affects:
  - 06-03 (polish/final phase — will see wizard in settings)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sheet-based wizard with programmatic open (no SheetTrigger) — wizard mounted as sibling to existing Sheet to avoid nesting
    - Wizard state in single WizardData object; reset on close via handleOpenChange
    - useEffect for auto-triggering discover mutation on step 2 entry
    - useEffect for pre-filling routing from suggestions on step 5 entry

key-files:
  created:
    - artifacts/riskmind-app/src/pages/settings/llm-config-wizard.tsx
    - artifacts/riskmind-app/src/pages/settings/routing-table-card.tsx
  modified:
    - artifacts/riskmind-app/src/pages/settings/settings.tsx

key-decisions:
  - "LlmConfigWizard mounted as sibling to provider Sheet (not child) to avoid nested Radix Dialog portals"
  - "RoutingTableCard inline edit changes configId per row, re-submits all entries via useUpdateLlmRouting to keep entries consistent"
  - "Wizard auto-advances from Step 1 to Step 2 on createProvider success (configId set triggers useEffect discover)"
  - "Step 4 benchmark is optional — Skip link provided; step 5 routing pre-fills from suggestions falling back to selectedModel"

patterns-established:
  - "Wizard pattern: single WizardData state + goNext/goBack helpers + completedUpTo for stepper back-navigation"
  - "RoutingTableCard: useGetLlmRouting for display, useUpdateLlmRouting for per-row inline save"

requirements-completed: [LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 6 Plan 02: LLM Config Wizard + Routing Table Card Summary

**6-step LlmConfigWizard Sheet (provider select, credentials, discover, model select, benchmark, routing) and RoutingTableCard mounted in Settings LLM tab, using all Phase 5 backend APIs via generated hooks**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T19:37:46Z
- **Completed:** 2026-03-18T19:43:40Z
- **Tasks:** 2 automated + 1 human-verify checkpoint
- **Files modified:** 3

## Accomplishments

- Created self-contained `LlmConfigWizard` with 6 fully-implemented steps, PROVIDER_CATALOG, auto-discover on step entry, benchmark with Recommended badge, routing grid with suggestions pre-fill
- Created `RoutingTableCard` with 6 task-type rows, Auto-suggested badge, inline edit (Select) per row with save/cancel
- Updated `settings.tsx`: added "Configure with Wizard" button, RoutingTableCard below provider types card, LlmConfigWizard as sibling Sheet to existing provider Sheet

## Task Commits

1. **Task 1: Create llm-config-wizard.tsx** - `92abb02` (feat)
2. **Task 2: Create routing-table-card.tsx + wire settings.tsx** - `9deddf0` (feat)
3. **Task 3: Human verification checkpoint** - approved by user

**Plan metadata:** `95849a8` (docs: complete plan)

## Files Created/Modified

- `artifacts/riskmind-app/src/pages/settings/llm-config-wizard.tsx` — 6-step wizard component, PROVIDER_CATALOG, Stepper UI, all mutations via generated hooks
- `artifacts/riskmind-app/src/pages/settings/routing-table-card.tsx` — routing grid card with inline edit
- `artifacts/riskmind-app/src/pages/settings/settings.tsx` — added wizard trigger, RoutingTableCard mount, LlmConfigWizard mount (sibling Sheet)

## Decisions Made

- LlmConfigWizard mounted as sibling to existing provider Sheet to avoid nested Radix Dialog portals
- Wizard createProvider mutation success → sets configId → useEffect triggers discover automatically
- Benchmark is optional with explicit "Skip" link (qualityScore check for Recommended badge: >= 2 AND ttftMs < 2000)
- RoutingTableCard inline edit re-submits all 6 entries to keep the routing table consistent (no partial updates)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in alert-list, risk-list, signal-list, vendor-list (15 errors) were present before this plan and are out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LLM Config Wizard and RoutingTableCard verified end-to-end by human (checkpoint approved)
- Full 6-step wizard flow confirmed working: provider select, credentials, discover, model select, benchmark, routing assignment
- Phase 6 is complete — Phase 7 (Foresight Teaser) can begin

## Self-Check: PASSED

All created files verified present. Both task commits verified in git log.

---
*Phase: 06-bug-fixes-and-wizard-ui*
*Completed: 2026-03-18*
