---
phase: quick
plan: 260323-hyb
subsystem: documentation
tags: [issue-analysis, echarts, heatmap, migration-design]
dependency_graph:
  requires: []
  provides: [issue-83-updated-body]
  affects: [risk-heatmap, dashboard]
tech_stack:
  added: []
  patterns: [issue-analysis, migration-design-document]
key_files:
  created:
    - .planning/quick/260323-hyb-analyze-github-issue-83-and-update-with-/260323-hyb-ISSUE-83-UPDATED.md
  modified: []
decisions:
  - Keep CSS Grid HeatmapGrid for dashboard compact mode -- ECharts overhead not justified for thumbnail
  - Use itemStyle.color callback per cell rather than visualMap min/max since color depends on position score not count
  - Extract severity summary list as shared component for mobile fallback
metrics:
  duration: 2 minutes
  completed: 2026-03-23T13:02:25Z
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Quick Task 260323-hyb: Analyze GitHub Issue #83 and Update with ECharts Migration Design

Comprehensive updated issue #83 body covering CSS Grid to Apache ECharts heatmap migration with component architecture, data transformation design, ECharts config shape, and ordered implementation steps.

## Task Summary

### Task 1: Write comprehensive updated issue #83 markdown
- **Commit:** `0c53f49`
- **Output:** `.planning/quick/260323-hyb-analyze-github-issue-83-and-update-with-/260323-hyb-ISSUE-83-UPDATED.md` (304 lines)
- **Sections covered:** Current Implementation Analysis (4 source files), Why Migrate, ECharts Migration Design (package, architecture, data transform, config, click handler, mobile, theme), Files to Modify, Migration Steps (7 ordered), Acceptance Criteria (10 checkboxes), Out of Scope, Labels

## Key Findings from Source Analysis

- **HeatmapGrid** is pure CSS Grid + Tailwind (not Recharts as issue #83 originally implied)
- Recharts is used only for KPI sparklines (`kpi-card.tsx`) and risk trend chart (`risk-list.tsx`)
- ECharts does not exist in the project yet
- Backend returns only populated cells (not all 25) -- client must fill empty cells for ECharts
- Severity coloring is based on `score = likelihood * impact` (position-dependent), not risk count -- this means `visualMap` alone is insufficient; per-cell `itemStyle.color` callback needed
- Mobile fallback uses pure Tailwind responsive classes (`md:hidden` / `hidden md:grid`), no JS resize detection

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- this plan produces documentation only, no application code.

## Self-Check: PASSED
