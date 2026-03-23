---
phase: 12-signal-integrations
plan: "05"
subsystem: ui
tags: [react, settings, signals, lucide, badge, sheet]

# Dependency graph
requires:
  - phase: 12-signal-integrations
    provides: /api/v1/integrations CRUD endpoints (Plans 01-04)
provides:
  - Settings Integrations tab with 5 source config cards (NVD, Shodan, Sentinel, MISP, Email)
  - SourceBadge component for source-typed colored icon badges
  - Signal detail Sheet panel with per-source structured metadata display
affects: [signal-list, settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - IntegrationCard inline component pattern with expandable form, test/sync/toggle actions
    - SourceBadge lookup-table pattern for source-typed Badge display
    - SignalDetailPanel with lazy fetch of full signal (with metadata) on open
    - SourceMetadataDisplay switch-case render per source type

key-files:
  created:
    - artifacts/riskmind-app/src/components/signals/source-badge.tsx
  modified:
    - artifacts/riskmind-app/src/pages/settings/settings.tsx
    - artifacts/riskmind-app/src/pages/signals/signal-list.tsx

key-decisions:
  - "IntegrationCard defined inline in settings.tsx for co-location — same pattern as other settings components"
  - "SignalDetailPanel fetches /api/v1/signals/:id on open — metadata not in list response (Signal Orval type excludes it)"
  - "SourceBadge uses React.ElementType for icon type — avoids verbose typeof ShieldCheck pattern"

patterns-established:
  - "Source badge: SOURCE_CONFIG lookup table with icon/label/color per source string key"
  - "Signal detail: fetch full record on panel open when list response lacks fields"
  - "Integration cards: POST /v1/integrations for upsert, PATCH /:id for toggle, DELETE /:id with confirm"

requirements-completed: [SGNL-01, SGNL-02, SGNL-03, SGNL-04, SGNL-05]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 12 Plan 05: Signal Integrations UI Summary

**Settings Integrations tab with 5 encrypted-credential config cards, SourceBadge icon badges on signal list, and signal detail Sheet with per-source structured metadata (CVSS, ports/services, incident severity, IoC attributes, email entities)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-23T17:07:16Z
- **Completed:** 2026-03-23T17:11:41Z
- **Tasks:** 3 (stopped at checkpoint 4 for human verification)
- **Files modified:** 3

## Accomplishments

- Settings page gains an Integrations tab visible to admins with 5 collapsible source cards (NVD, Shodan, Sentinel, MISP, Email) — each with masked password fields, Test Connection, Sync Now, active/inactive toggle, and Remove
- Sentinel card includes Azure App Registration helper text with link to Microsoft docs
- SourceBadge component renders colored icon badges (ShieldCheck/Globe/Cloud/Bug/Mail) for all 5 source types with gray fallback
- Signal list table rows are now clickable, opening a detail Sheet that fetches the full signal record and renders a Source Details card with structured metadata per source

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Integrations tab to Settings** - `c4d302c` (feat)
2. **Task 2: Create SourceBadge component and add to signal list** - `e68794e` (feat)
3. **Task 3: Add signal detail Sheet with Source Details card** - `9b8cfdf` (feat)

## Files Created/Modified

- `artifacts/riskmind-app/src/components/signals/source-badge.tsx` — SourceBadge component with SOURCE_CONFIG lookup table
- `artifacts/riskmind-app/src/pages/settings/settings.tsx` — Added Integrations tab, INTEGRATION_SOURCES constant, IntegrationCard inline component
- `artifacts/riskmind-app/src/pages/signals/signal-list.tsx` — SourceBadge in source column, clickable rows, SignalDetailPanel, SourceMetadataDisplay

## Decisions Made

- IntegrationCard defined inline in settings.tsx for co-location — consistent with existing settings component patterns (TierBadge, RunStatusBadge, etc.)
- SignalDetailPanel fetches `/api/v1/signals/:id` on open because the Orval-generated `Signal` type excludes `metadata` from list responses; full fetch is needed to get JSONB metadata
- SourceBadge uses `React.ElementType` for icon type to avoid the verbose `typeof ShieldCheck` pattern used elsewhere

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for the UI layer. Integration credentials are configured at runtime via the Settings UI.

## Next Phase Readiness

Phase 12 (signal-integrations) is now fully complete:
- API routes (Plan 01), NVD adapter (Plan 02), Shodan adapter (Plan 03), Sentinel + MISP adapters (Plan 04), Email adapter (Plan 04), and this UI plan (Plan 05) are all done.
- Awaiting human verification (Task 4 checkpoint) before the phase is formally closed.

## Self-Check: PASSED

All created files exist on disk. All task commits (c4d302c, e68794e, 9b8cfdf) verified in git log.

---
*Phase: 12-signal-integrations*
*Completed: 2026-03-23*
