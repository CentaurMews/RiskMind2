---
phase: 10
plan: "03"
subsystem: assessment-engine-frontend
tags: [frontend, templates, builder, drag-drop, branching, react, shadcn]
dependency_graph:
  requires: [10-02]
  provides: [template-library-ui, template-builder-ui, condition-builder-component, question-row-component, section-block-component]
  affects: [assessments-nav, app-router]
tech_stack:
  added: []
  patterns:
    - two-panel builder layout (canvas + live preview)
    - HTML5 drag-to-reorder within list
    - row-based condition editor with Select + Input + Switch
    - shared frontend types imported from components/assessments/types.ts
key_files:
  created:
    - artifacts/riskmind-app/src/pages/assessments/templates/index.tsx
    - artifacts/riskmind-app/src/pages/assessments/templates/builder.tsx
    - artifacts/riskmind-app/src/components/assessments/ConditionBuilder.tsx
    - artifacts/riskmind-app/src/components/assessments/QuestionRow.tsx
    - artifacts/riskmind-app/src/components/assessments/SectionBlock.tsx
  modified:
    - artifacts/riskmind-app/src/components/layout/app-layout.tsx
    - artifacts/riskmind-app/src/App.tsx
decisions:
  - "[PREBUILT] prefix detection used in template library to show Built-in badge and suppress delete action — consistent with Plan 02 convention"
  - "All components import shared types from components/assessments/types.ts rather than redeclaring them — single source of truth for frontend types"
  - "Preview pane hidden below lg breakpoint, accessible via Sheet overlay with Preview button — matches UI-SPEC mobile spec"
  - "SectionBlock shows confirmation AlertDialog before removing a section with questions — prevents accidental data loss"
metrics:
  duration: 531s
  completed_date: 2026-03-23
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 10 Plan 03: Template Library and Builder UI Summary

**One-liner:** Template library page with card grid and type filters, plus a two-panel template builder with drag-to-reorder questions, row-based branching conditions (equals/contains/greater_than), and live preview pane.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Template library page with card grid, filters, empty state | bd93d20 | index.tsx, app-layout.tsx |
| 2 | Template builder page with section/question editing and components | 417c4c2 | builder.tsx, ConditionBuilder.tsx, QuestionRow.tsx, SectionBlock.tsx, App.tsx |

## What Was Built

### Template Library (`/assessments/templates`)
- 3-column responsive grid (2-col tablet, 1-col mobile) of template cards
- Each card: title (text-lg font-semibold), contextType Badge, Built-in badge for pre-built templates, description (line-clamp-2), question/section count metadata
- Filter bar: All / Vendor / Compliance / Incident toggle buttons — re-fetches with `?contextType=` query param
- "Use Template" navigates to `/assessments/new?templateId={id}`, "Clone & Edit" calls POST `/v1/assessment-templates/:id/clone` then navigates to edit
- Delete action (user templates only): AlertDialog with "Delete template?" / "This template will be permanently deleted. Assessments already created from it are not affected."
- Loading: 6 Skeleton cards, Empty state: "No templates yet" heading + body + New Template CTA
- Assessments section added to sidebar nav with Library and Sessions children, ClipboardList icon

### Template Builder (`/assessments/templates/new` and `/assessments/templates/:id/edit`)
- Two-panel layout: left `lg:w-3/5` builder canvas, right `lg:w-2/5` PREVIEW pane (hidden on mobile)
- Breadcrumb: Assessments > Templates > {title | New Template}
- Left panel: template name (text-2xl font-semibold borderless input), description Textarea, contextType Select (vendor/framework), Add Section button, SectionBlock list, Save Template bottom button
- Right panel: PREVIEW label (text-xs uppercase tracking-widest muted), live read-only rendering of all sections and questions
- Mobile: Preview pane hidden; "Preview" button in header opens Sheet overlay
- Save: POST (new) / PATCH (edit) to `/v1/assessment-templates`, success toast + navigate to library, error toast on failure

### ConditionBuilder
- Row-based condition editor per question
- Each row: question Select (truncated 40 chars), operator Select (equals/contains/greater than), value Input, show/hide Switch (Hide ↔ Show labels), X remove button
- "Add Condition" ghost button; disabled when no prior questions available
- Propagates all changes via `onChange` callback

### QuestionRow
- Draggable Card with `draggable="true"`, GripVertical icon in 44px tall handle area
- Collapsed: question text (truncated), type Badge (outline), weight display `w: {n}`, ChevronDown/Up toggle, Trash2 remove
- Expanded: Question Input, type Select (text/boolean/multiple_choice/numeric), weight Input (0-10), required Checkbox
  - multiple_choice: option list with label + score (0-1) inputs, Add Option, X remove
  - numeric: numericMin and numericMax inputs
  - ConditionBuilder for branching (availableQuestions filtered to prior questions in same section)
- Drag styling: opacity-50 when dragging, 2px border-primary top drop indicator

### SectionBlock
- Section name Input (text-lg font-semibold, borderless)
- Trash2 remove button: direct click if empty, AlertDialog confirmation if has questions
- Question list with drag-to-reorder (HTML5 DnD, same-section only)
- Add Question creates `{ id: uuid, sectionId, text: "", type: "text", weight: 5, required: true, conditions: [] }`
- Empty section: dashed Alert with "No questions added yet." message

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Type Consistency] Import shared types from types.ts instead of redeclaring**
- **Found during:** Task 2
- **Issue:** A `types.ts` file already existed in `components/assessments/` with all assessment types. Initial drafts redeclared identical interfaces in each component file.
- **Fix:** Refactored all three components and builder page to import from `@/components/assessments/types` — eliminates type drift risk.
- **Files modified:** ConditionBuilder.tsx, QuestionRow.tsx, SectionBlock.tsx, builder.tsx
- **Commit:** 417c4c2

## Self-Check: PASSED

All created files confirmed to exist on disk. Both task commits (bd93d20, 417c4c2) found in git log.
