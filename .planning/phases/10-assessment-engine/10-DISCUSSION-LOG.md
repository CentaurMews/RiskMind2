# Phase 10: Assessment Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 10-assessment-engine
**Areas discussed:** Template builder UX, Assessment session flow, Scoring & results display, Pre-built templates

---

## Template Builder UX — Editor Style

| Option | Description | Selected |
|--------|-------------|----------|
| Form-based editor | Add questions via form fields, drag to reorder, preview pane | ✓ |
| JSON editor | Raw JSON with syntax highlighting | |
| Hybrid | Form-based default with View JSON toggle | |

**User's choice:** Form-based editor

## Template Builder UX — Sections

| Option | Description | Selected |
|--------|-------------|----------|
| Sections | Questions grouped into named sections, section-level scores | ✓ |
| Flat list | All questions in one list, no section scoring | |

**User's choice:** Sections

---

## Assessment Session Flow — Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Section-by-section wizard | One section at a time, progress bar, Next/Previous | ✓ |
| Single scrollable form | All sections visible, scroll to navigate | |
| One question at a time | Chat-like, one question per screen | |

**User's choice:** Section-by-section wizard

## Assessment Session Flow — AI Follow-ups

| Option | Description | Selected |
|--------|-------------|----------|
| Inline after trigger | AI question appears below triggering question with badge | ✓ |
| Side panel | AI follow-ups in side drawer | |
| End of section | Collected and shown at section end | |

**User's choice:** Inline after trigger

---

## Scoring & Results — Visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Score card + breakdown | Gauge/donut overall, horizontal bars for sections, expandable per-question | ✓ |
| Table only | Simple table with question, response, score | |
| Full dashboard | Multiple charts (radar, bars, trends) | |

**User's choice:** Score card + breakdown

## Scoring & Results — AI Summary Position

| Option | Description | Selected |
|--------|-------------|----------|
| Above scores | AI summary as highlighted card at top with badge | ✓ |
| Below scores | Scores first, AI summary at bottom | |
| Collapsible panel | AI summary in collapsible section | |

**User's choice:** Above scores

---

## Pre-built Templates — Detail Level

| Option | Description | Selected |
|--------|-------------|----------|
| Substantial (20-30 Qs) | Real-world depth across multiple security/compliance domains | ✓ |
| Starter (8-12 Qs) | Enough to demo, expected to customize | |
| Comprehensive (40+ Qs) | Production-grade like SIG Lite | |

**User's choice:** Substantial (20-30 Qs)

## Pre-built Templates — Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Template library page | Dedicated /assessments/templates page with cards, filter, Use/Clone | ✓ |
| Inline during creation | Template picker modal during assessment creation | |
| Both | Library page AND picker modal | |

**User's choice:** Template library page

---

## Claude's Discretion

- Exact question wording for pre-built templates
- AI follow-up trigger logic
- Branching condition builder component details
- Assessment list page layout
- API route structure
- SSE vs job queue for AI follow-ups
- Chart component choice

## Deferred Ideas

None — discussion stayed within phase scope.
