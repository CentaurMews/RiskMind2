---
phase: 04-ai-differentiators-surfaced
plan: 01
subsystem: ui
tags: [react, typescript, ai, collapsible, date-fns, lucide-react]

# Dependency graph
requires:
  - phase: 03-dashboard-polish-and-demo-readiness
    provides: risk-detail.tsx with AI enrichment button wired to useAiEnrichRisk mutation
provides:
  - AiProvenance reusable component for surfacing AI provenance on any entity
  - risk-detail.tsx with AI Enhanced badge, description parser, and collapsible enrichment panel
affects:
  - 04-02 (AI-02 — can import AiProvenance)
  - 04-03 (AI-04 — can import AiProvenance for scoring provenance)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AiProvenance: reusable receipt component showing sparkle icon + action + model + date + confidence"
    - "parseRiskDescription: splits description on AI_ENRICHMENT_SEPARATOR into base/enrichment parts"
    - "Collapsible panel pattern (same as treatments-tab.tsx) for progressive disclosure of AI content"

key-files:
  created:
    - artifacts/riskmind-app/src/components/ai/ai-provenance.tsx
  modified:
    - artifacts/riskmind-app/src/pages/risks/risk-detail.tsx

key-decisions:
  - "AI_ENRICHMENT_SEPARATOR constant defined locally in risk-detail.tsx — matches ai-workers.ts value to avoid cross-package import"
  - "AiProvenance placed in components/ai/ (new subdirectory) to group all AI-specific shared components"
  - "enrichmentOpen state defaults to false — enrichment panel starts collapsed, user opts in to expand"

patterns-established:
  - "AI Enhanced badge: variant=outline with bg-primary/5 text-primary border-primary/20 — consistent with score panel styling"
  - "Collapsible enrichment: follows treatments-tab.tsx ChevronDown/ChevronRight toggle pattern"
  - "AiProvenance receipt placed at bottom of enrichment panel content area"

requirements-completed:
  - AI-01

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 4 Plan 01: AI Differentiators Surfaced Summary

**"AI Enhanced" badge and collapsible enrichment panel surfaced on risk detail using AiProvenance receipt component and description parser splitting on AI_ENRICHMENT_SEPARATOR**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T13:43:02Z
- **Completed:** 2026-03-18T13:51:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created new `components/ai/` directory with reusable `AiProvenance` component accepting action, model, date, and confidence props
- Extended risk-detail.tsx with `parseRiskDescription()` that splits on `AI_ENRICHMENT_SEPARATOR` to separate base description from AI enrichment content
- Enriched risks show "AI Enhanced" badge next to the title and a collapsible panel below the base description containing the enrichment text and AiProvenance receipt
- Un-enriched risks show clean description only — no badge, no empty section, no visual noise

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AiProvenance shared component** - `a439289` (feat)
2. **Task 2: Wire AI enrichment badge and collapsible panel into risk-detail.tsx** - `01dd237` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `artifacts/riskmind-app/src/components/ai/ai-provenance.tsx` - Reusable provenance receipt: sparkle icon, action text, model name (falls back to "AI"), formatted date via date-fns, optional confidence %
- `artifacts/riskmind-app/src/pages/risks/risk-detail.tsx` - Added Badge/Collapsible/AiProvenance imports, AI_ENRICHMENT_SEPARATOR, parseRiskDescription(), enrichmentOpen state, AI Enhanced badge, collapsible enrichment panel

## Decisions Made
- `AI_ENRICHMENT_SEPARATOR` defined locally in risk-detail.tsx to match the value from ai-workers.ts without creating a cross-package import
- `AiProvenance` placed in a new `components/ai/` subdirectory to group AI-specific shared components separately from generic UI components
- Enrichment panel defaults to collapsed (`enrichmentOpen = false`) so users see base description first and can expand AI content on demand

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — pre-existing TypeScript errors in unrelated files (command-palette, kri-widget, alert-list, risk-list, finding-list, signal-list) were present before this plan. Out-of-scope per deviation rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AiProvenance component is ready to be imported by Plans 02+ (AI-02 treatment suggestions, AI-04 score provenance)
- risk-detail.tsx compiles cleanly; app builds successfully (17s build, 2800 modules)
- LLM API key must be configured in tenant settings for enrichment jobs to produce output (pre-existing blocker)

---
*Phase: 04-ai-differentiators-surfaced*
*Completed: 2026-03-18*
