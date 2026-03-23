# Phase 11: Vendor Lifecycle Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 11-vendor-lifecycle-redesign
**Areas discussed:** Onboarding wizard flow, 4th-party subprocessors, Org dependency interview, Monitoring & score display

---

## Onboarding Wizard — Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Replace 'New Vendor' | Wizard IS the new creation flow, old form removed | ✓ |
| Separate entry point | Keep old form + add wizard as separate option | |
| Wizard with quick mode | Wizard with skip-to-create link | |

**User's choice:** Replace 'New Vendor'

## Onboarding Wizard — State Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side draft | Vendor created at step 1, each step PATCHes record | ✓ |
| Local storage | Browser localStorage, no partial DB records | |
| URL state | State in URL query params | |

**User's choice:** Server-side draft

---

## 4th-Party Subprocessors — Display

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible list | Table on vendor detail: name, type, criticality, discovered_by badge | ✓ |
| Visual graph | Interactive graph/tree visualization | |
| Tab on vendor detail | Separate 'Supply Chain' tab | |

**User's choice:** Collapsible list

## 4th-Party Subprocessors — Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Tier-1 only | Direct subprocessors only, depth = 1 | ✓ |
| Recursive (2 levels) | Sub-sub-processors tracked | |

**User's choice:** Tier-1 only

---

## Org Dependency Interview — Location

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page | Settings > Organization > Infrastructure Dependencies | ✓ |
| Dedicated page | Standalone /org-dependencies page | |
| Dashboard widget | Concentration risk widget on dashboard | |

**User's choice:** Settings page

## Org Dependency Interview — Method

| Option | Description | Selected |
|--------|-------------|----------|
| Structured form | Category-based dropdowns, link to existing vendors | ✓ |
| AI-driven interview | LLM asks questions conversationally | |
| Import from config | Parse from cloud provider API | |

**User's choice:** Structured form

---

## Monitoring — Cadence Config

| Option | Description | Selected |
|--------|-------------|----------|
| Settings > Monitoring | Global tier→cadence table, admin-only | ✓ |
| Per-vendor override | Global defaults + per-vendor override | |
| Vendor detail only | Configure per vendor, no global defaults | |

**User's choice:** Settings > Monitoring

## Monitoring — Kanban Score

| Option | Description | Selected |
|--------|-------------|----------|
| Score badge on card | Colored badge (78/100) on kanban card | ✓ |
| Score column | Add score column to kanban layout | |
| Tooltip only | Score on hover | |

**User's choice:** Score badge on card

---

## Claude's Discretion

- Document upload component choice
- AI enrichment review layout
- Monitoring scheduler implementation
- Concentration risk algorithm
- Subprocessor LLM extraction prompt
- Add Subprocessor vendor linking UX

## Deferred Ideas

None — discussion stayed within phase scope.
