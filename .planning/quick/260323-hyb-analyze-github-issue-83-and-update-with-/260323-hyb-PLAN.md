---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260323-hyb-analyze-github-issue-83-and-update-with-/260323-hyb-ISSUE-83-UPDATED.md
autonomous: true
requirements: [ISSUE-83]
must_haves:
  truths:
    - "Issue body accurately describes current CSS Grid implementation (not Recharts)"
    - "ECharts migration design covers component architecture, data transformation, and chart config"
    - "Migration steps are ordered and actionable"
    - "Acceptance criteria are testable"
  artifacts:
    - path: ".planning/quick/260323-hyb-analyze-github-issue-83-and-update-with-/260323-hyb-ISSUE-83-UPDATED.md"
      provides: "Complete updated GitHub issue #83 body"
      min_lines: 80
  key_links: []
---

<objective>
Produce a comprehensive updated GitHub issue #83 body as a local markdown file, covering the migration from the current CSS Grid risk heatmap to Apache ECharts.

Purpose: Provide a well-analyzed, implementation-ready issue that a developer (or Claude) can execute against without ambiguity.
Output: `.planning/quick/260323-hyb-analyze-github-issue-83-and-update-with-/260323-hyb-ISSUE-83-UPDATED.md`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key source files (already analyzed — read these for exact details during execution):
@artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx
@artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx
@artifacts/riskmind-app/src/pages/dashboard.tsx
@artifacts/api-server/src/routes/risks.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write comprehensive updated issue #83 markdown</name>
  <files>.planning/quick/260323-hyb-analyze-github-issue-83-and-update-with-/260323-hyb-ISSUE-83-UPDATED.md</files>
  <action>
Read the four source files listed in context to extract exact implementation details, then write a comprehensive GitHub issue body markdown file. The document must include these sections:

**1. Title line:** `# Migrate Risk Heatmap from CSS Grid to Apache ECharts`

**2. Current Implementation Analysis:**
- Describe the CSS Grid approach in `heatmap-grid.tsx`: 5x5 grid, severity color classes, mobile fallback (severity summary list), props interface (cells[], onCellClick, compact)
- Describe `risk-heatmap.tsx`: full page with axis labels, drill-down Sheet, URL param deep linking (?l=&i=)
- Describe backend `GET /api/v1/risks/heatmap`: groups risks by likelihood-impact into HeatmapCell[]
- Describe dashboard compact usage in `dashboard.tsx`
- Note severity thresholds: score = likelihood * impact. Critical >= 15, High >= 10, Medium >= 5, Low < 5
- Note what Recharts is used for (KPI sparklines only) and that ECharts does not exist in the project yet

**3. Why Migrate:**
- ECharts native heatmap provides: smooth color gradients, built-in tooltips with rich HTML, zoom/pan for dense data, animation transitions, better accessibility (aria labels), canvas rendering for performance, visual map legend
- Current CSS Grid limitations: manual color mapping, no gradients, no built-in interactivity beyond click, no animation, manual accessibility

**4. ECharts Migration Design:**
- **Package:** `echarts` + `echarts-for-react` (React wrapper)
- **New component:** `RiskHeatmapChart` replacing `HeatmapGrid` for the full page; keep `HeatmapGrid` CSS version for dashboard compact mode (ECharts overhead not worth it for tiny widget)
- **Data transformation:** Backend response stays unchanged. Client transforms `HeatmapCell[]` into ECharts dataset format: `[[impact, likelihood, riskCount], ...]` for all 25 cells (fill empty cells with 0)
- **ECharts option config:** Specify the key config shape:
  - `xAxis`/`yAxis`: category type, data = ["1","2","3","4","5"], axis labels matching current (Negligible..Catastrophic / Rare..Almost Certain)
  - `visualMap`: piecewise matching existing severity thresholds (colors from CSS vars: severity-critical, severity-high, severity-medium, severity-low)
  - `series`: type 'heatmap', data array, label showing risk count, itemStyle with borderRadius
  - `tooltip`: rich HTML formatter showing likelihood label, impact label, risk count, severity level
  - Click handler: `chart.on('click', ...)` triggers the existing Sheet drill-down
- **Mobile:** Keep existing severity summary list fallback (md:hidden), show ECharts chart only on md+ screens
- **Theme integration:** Use CSS variable extraction for colors to respect dark/light mode. ECharts supports `echarts.registerTheme()`.

**5. Files to Modify:**
- `package.json` — add `echarts`, `echarts-for-react`
- NEW `components/dashboard/risk-heatmap-chart.tsx` — ECharts-based heatmap component
- MODIFY `pages/risks/risk-heatmap.tsx` — swap HeatmapGrid for RiskHeatmapChart, keep Sheet drill-down
- KEEP `components/dashboard/heatmap-grid.tsx` — unchanged, still used by dashboard compact mode
- KEEP `pages/dashboard.tsx` — unchanged, still uses HeatmapGrid compact

**6. Migration Steps (ordered):**
1. Install echarts + echarts-for-react
2. Create `risk-heatmap-chart.tsx` with data transformer + ECharts config
3. Add dark/light theme registration
4. Update `risk-heatmap.tsx` to use new component
5. Verify drill-down Sheet still works with click handler
6. Verify URL deep linking still works
7. Test mobile fallback still shows severity list

**7. Acceptance Criteria:**
- [ ] ECharts heatmap renders 5x5 grid with correct severity colors
- [ ] Clicking a cell opens the drill-down Sheet with correct risks
- [ ] URL params ?l=&i= still trigger cell selection on load
- [ ] Mobile shows severity summary list (not ECharts)
- [ ] Dashboard compact mode still uses CSS Grid HeatmapGrid
- [ ] Dark mode colors are correct
- [ ] Tooltip shows likelihood label, impact label, risk count, severity
- [ ] Empty cells render with muted color
- [ ] No regressions in existing Recharts sparklines

**8. Out of Scope:**
- Backend API changes (data format stays the same)
- Dashboard compact widget migration (keep CSS Grid)
- Replacing Recharts sparklines with ECharts
- Adding new heatmap features (filtering, time comparison, etc.)

**9. Labels suggestion:** `enhancement`, `frontend`, `visualization`

Format as clean GitHub issue markdown (use ## headings, checkboxes for acceptance criteria, code blocks for config examples).
  </action>
  <verify>
    <automated>test -f .planning/quick/260323-hyb-analyze-github-issue-83-and-update-with-/260323-hyb-ISSUE-83-UPDATED.md && wc -l .planning/quick/260323-hyb-analyze-github-issue-83-and-update-with-/260323-hyb-ISSUE-83-UPDATED.md | awk '{if ($1 >= 80) print "PASS: " $1 " lines"; else print "FAIL: only " $1 " lines"}'</automated>
  </verify>
  <done>Markdown file exists with 80+ lines covering all 9 sections: current analysis, motivation, ECharts design with config shape, file list, migration steps, acceptance criteria, scope notes</done>
</task>

</tasks>

<verification>
- File exists at expected path
- Contains all required sections (current impl, design, steps, acceptance criteria, scope)
- Accurately describes CSS Grid (not Recharts) as current implementation
- ECharts config is realistic and matches the existing data model
</verification>

<success_criteria>
A developer reading the issue can implement the ECharts migration without needing to explore the codebase first. All current features (drill-down, deep linking, mobile fallback, compact dashboard) are accounted for in the design.
</success_criteria>

<output>
After completion, create `.planning/quick/260323-hyb-analyze-github-issue-83-and-update-with-/260323-hyb-SUMMARY.md`
</output>
