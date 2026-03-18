---
phase: 04-ai-differentiators-surfaced
plan: "02"
subsystem: riskmind-app/ai-ui
tags: [ai, provenance, treatments, sources, signals, traceability]
dependency_graph:
  requires: [04-01]
  provides: [treatments-ai-provenance, risk-sources-section, signal-confidence-display]
  affects: [riskmind-app-ui]
tech_stack:
  added: []
  patterns: [AiProvenance receipt, useListRiskSources hook, source type badges]
key_files:
  modified:
    - artifacts/riskmind-app/src/pages/risks/treatments-tab.tsx
    - artifacts/riskmind-app/src/pages/risks/risk-detail.tsx
    - artifacts/riskmind-app/src/pages/signals/signal-list.tsx
decisions:
  - "Omit finding.confidence from AiProvenance in FindingPanel — Finding type has no confidence field"
  - "Parse signal.confidence as string (Signal.confidence is string | null) using parseFloat for safe display"
metrics:
  duration: 5min
  completed_date: "2026-03-18"
  tasks: 2
  files_changed: 3
---

# Phase 4 Plan 02: AI Differentiators Wire-up Summary

**One-liner:** AI provenance receipts wired to treatments tab, risk sources traceability section added to risk detail, and signal confidence display added to table rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add AiProvenance to treatments-tab + Sources section on risk-detail | 8a5f265 | treatments-tab.tsx, risk-detail.tsx |
| 2 | Polish FindingPanel with AiProvenance receipt + confidence in signal rows | bdcd35d | signal-list.tsx |

## What Was Built

**Task 1 — treatments-tab.tsx (AI-02):**
- Added `AiProvenance` import from `@/components/ai/ai-provenance`
- Renders `<AiProvenance action="Suggested by" className="justify-end" />` after the recommendations grid when recommendations exist, giving users clear AI attribution

**Task 1 — risk-detail.tsx (AI-04 Sources traceability):**
- Added `useListRiskSources` import from `@workspace/api-client-react`
- Calls `useListRiskSources(id)` to fetch sources for the current risk
- New Sources card placed between the description/scores grid and the Tabs block
- Shows: sourceType badge (signal/finding/agent_detection), sourceId in monospace, "View Signals" link for signal sources, creation date
- Graceful empty state: "No linked sources recorded for this risk."
- Loading state with spinner

**Task 2 — signal-list.tsx (AI-04 signal panel polish):**
- Added `AiProvenance` import
- FindingPanel "View Risk" section enhanced: `space-y-3`, `AiProvenance action="Triaged by"` receipt added
- Signal table AI Classification column: confidence percentage shown below badge when `signal.confidence` is set (parsed from string safely via `parseFloat`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] signal.confidence is string, not number**
- **Found during:** Task 2
- **Issue:** Signal type has `confidence?: string | null` not `number`; `Math.round(signal.confidence * 100)` would fail TypeScript
- **Fix:** Used `parseFloat(signal.confidence)` with `isNaN` guard: `!isNaN(parseFloat(signal.confidence)) && Math.round(parseFloat(signal.confidence) * 100)`
- **Files modified:** signal-list.tsx
- **Commit:** bdcd35d

**2. [Rule 2 - Missing critical guard] Omit finding.confidence from AiProvenance**
- **Found during:** Task 2
- **Issue:** `Finding` type has no `confidence` field; plan noted to omit if not present
- **Fix:** AiProvenance in FindingPanel renders with action and className only (no confidence prop)
- **Files modified:** signal-list.tsx
- **Commit:** bdcd35d

## Self-Check: PASSED

Files confirmed present:
- artifacts/riskmind-app/src/pages/risks/treatments-tab.tsx — FOUND
- artifacts/riskmind-app/src/pages/risks/risk-detail.tsx — FOUND
- artifacts/riskmind-app/src/pages/signals/signal-list.tsx — FOUND

Commits confirmed:
- 8a5f265 — feat(04-02): add AiProvenance receipt to treatments tab and Sources section to risk detail
- bdcd35d — feat(04-02): polish FindingPanel with AiProvenance receipt and add confidence display to signal rows

Build: passed (✓ built in 16.89s, 2800 modules transformed)
TypeScript: no errors in modified files (pre-existing errors in other files only)
