---
phase: 11-vendor-lifecycle-redesign
plan: "05"
subsystem: ui
tags: [react, settings, tprm, vendor-lifecycle, shadcn, tanstack-query]

# Dependency graph
requires:
  - phase: 11-vendor-lifecycle-redesign
    provides: "Org dependencies API (GET/POST/PUT/DELETE /v1/org-dependencies, concentration-risk) and monitoring configs API (GET/PUT /v1/monitoring-configs/:tier) from Plan 02"

provides:
  - "Settings > Organization tab: concentration risk amber Alert card + Infrastructure Dependencies category-form with provider name + vendor link"
  - "Settings > Monitoring tab (admin-only): per-tier cadence config table with cadenceDays, scoreThreshold (0-100), assessment template selector, Save Cadence"
  - "RBAC gate: Monitoring tab hidden from non-admin users via user.role === 'admin' check"

affects: [phase-12-signal-integrations, phase-13-compliance-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useQuery with direct fetch() for wizard-era endpoints not in Orval-generated client"
    - "useEffect to merge API data into local state (cadenceData initialized from monitoringConfigs)"
    - "Edit-all pattern for multi-row forms: editingDeps boolean + editData Record state"

key-files:
  created: []
  modified:
    - artifacts/riskmind-app/src/pages/settings/settings.tsx

key-decisions:
  - "Both Organization and Monitoring tabs added to same settings.tsx file — co-location avoids new route/file; consistent with existing settings pattern"
  - "Monitoring tab admin gate applied both to TabsTrigger and TabsContent wrapper for defense-in-depth"
  - "Empty state for organization tab shows when dependencies array is empty AND editingDeps is false — clicking Configure or Edit All always shows the form rows"
  - "Timer icon used instead of ShieldAlert for Monitoring tab trigger (ShieldAlert already used for access-denied page heading)"
  - "TierBadge recreated inline in settings.tsx — avoids cross-package import from vendor-list.tsx while matching exact color classes"

patterns-established:
  - "Category-row form pattern: CATEGORIES.map with conditional edit/read-only rendering driven by single editingDeps boolean"
  - "Cadence defaults seeded in useState initializer; useEffect merges loaded API data — clean initial render without flicker"

requirements-completed: [VNDR-04, VNDR-06, VNDR-07]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 11 Plan 05: Settings Organization + Monitoring Tabs Summary

**Settings page extended with Organization tab (concentration risk alert + per-category infrastructure dependency form with vendor linking) and admin-only Monitoring tab (per-tier cadence days, score threshold 0-100, assessment template picker backed by /v1/monitoring-configs API)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T15:54:02Z
- **Completed:** 2026-03-23T15:56:54Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Organization tab: amber Alert concentration risk card (vendorName, dependencyCount, categories, openSignalCount badge) with CheckCircle2 fallback when no risks, plus Infrastructure Dependencies 7-category form with Edit All / Save Dependencies flow calling POST/PUT /v1/org-dependencies per category
- Monitoring tab (admin-only): table with 4 tiers, editable cadenceDays (1-365), scoreThreshold (0-100, empty=no alert), assessment template Select — saves via PUT /v1/monitoring-configs/:tier; validates ranges before save with toast errors
- Admin-only gate on both the tab trigger and tab content; non-admins never see or load monitoring configs
- useEffect syncs loaded monitoringConfigs into cadenceData state including scoreThreshold field

## Task Commits

Both tasks modified the single settings.tsx file in one cohesive implementation:

1. **Task 1: Organization tab with dependencies and concentration risk** — `1908f73` (feat)
2. **Task 2: Monitoring tab with per-tier cadence config and score threshold** — `1908f73` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `artifacts/riskmind-app/src/pages/settings/settings.tsx` — Added Organization and Monitoring tabs, new imports (Alert, AlertTitle, AlertDescription, Building2, Timer, useQuery, toast), type definitions, CATEGORIES constant, TierBadge inline component, state management, and tab content JSX

## Decisions Made

- Timer icon used for Monitoring tab (ShieldAlert was already used for the access-denied heading, would be confusing)
- TierBadge recreated inline in settings.tsx to avoid cross-package/cross-file import from vendor-list.tsx
- Both tab trigger and tab content gated on `user?.role === "admin"` — defense-in-depth so even if tab value is manually set, content is hidden
- Edit-all pattern (single editingDeps boolean) chosen over per-row edit to match the plan spec exactly

## Deviations from Plan

None — plan executed exactly as written. All API patterns, copy, validation ranges, and component choices match the plan spec and UI-SPEC.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 11 (vendor-lifecycle-redesign) plans are now complete
- Settings page has 5 tabs: LLM Providers, Agent Config, Users & Roles, Organization, Monitoring
- Organization and Monitoring tabs fully wired to APIs established in Plan 02
- Phase 12 (Signal Integrations) can proceed

## Self-Check: PASSED

- settings.tsx: FOUND
- 11-05-SUMMARY.md: FOUND
- commit 1908f73: FOUND

---
*Phase: 11-vendor-lifecycle-redesign*
*Completed: 2026-03-23*
