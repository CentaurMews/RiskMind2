# Phase 15: Migrate Risk Heatmap to ECharts - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** GitHub Issue #83

<domain>
## Phase Boundary

Migrate the full-page risk heatmap (`/risks/heatmap`) from CSS Grid to Apache ECharts. Keep the dashboard compact widget as CSS Grid. No backend changes. Additive — ECharts added alongside existing Recharts (used for sparklines).

</domain>

<decisions>
## Implementation Decisions

### Migration Scope
- **D-01:** Only the full-page heatmap (`risk-heatmap.tsx`) migrates to ECharts. Dashboard compact widget (`HeatmapGrid` with `compact={true}`) stays as CSS Grid — ECharts canvas overhead not justified for ~100px thumbnail.
- **D-02:** Backend API (`GET /api/v1/risks/heatmap`) requires zero changes. Client transforms `HeatmapCell[]` to ECharts format.
- **D-03:** Recharts stays for sparklines. This is additive, not a library replacement.

### ECharts Configuration
- **D-04:** Severity color depends on cell POSITION (L×I score), not the risk count value. Must use per-cell `itemStyle.color` callback, NOT `visualMap` (which maps value→color).
- **D-05:** Colors: Critical (≥15), High (≥10), Medium (≥5), Low (<5). Empty cells (0 risks) use muted color. Extract CSS variables at runtime via `getComputedStyle()` for dark/light mode.
- **D-06:** X axis: ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'] with "Impact" label. Y axis: ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'] with "Likelihood" label.
- **D-07:** Tooltip shows: severity label, score, likelihood label, impact label, risk count.
- **D-08:** Click handler maps `[xIndex, yIndex]` back to `(likelihood, impact)` and triggers existing Sheet drill-down.
- **D-09:** Labels show risk count in each cell. Hide label for 0-risk cells.
- **D-10:** Emphasis: shadow blur on hover for interactive feel.

### Existing Functionality to Preserve
- **D-11:** Drill-down Sheet sidebar with risk list, each linking to `/risks/{id}` — keep exactly as-is.
- **D-12:** URL deep linking: reads `?l=` and `?i=` on mount to auto-select a cell via ECharts `dispatchAction`.
- **D-13:** Mobile fallback: `md:hidden` severity summary list + `hidden md:block` ECharts canvas. Same pattern as current.

### Package Dependencies
- **D-14:** Install `echarts` and `echarts-for-react` via pnpm in riskmind-app.

### Claude's Discretion
- Exact ECharts option structure and responsive sizing
- Theme change detection mechanism (MutationObserver vs media query listener)
- Cell selection visual treatment (border highlight, glow, etc.)
- Canvas aspect ratio and minimum height

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Heatmap Code
- `artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx` — Current CSS Grid component (DO NOT MODIFY — used by dashboard compact)
- `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` — Full-page heatmap to modify (Sheet drill-down, URL deep linking)
- `artifacts/riskmind-app/src/pages/dashboard.tsx` — Dashboard compact usage (DO NOT MODIFY)

### Theme/Colors
- `artifacts/riskmind-app/src/index.css` — CSS variables for severity colors, theme tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HeatmapGrid` component: severity color logic (score thresholds) — reuse color mapping
- `risk-heatmap.tsx`: Sheet drill-down, URL params handling — preserve and rewire to ECharts click
- `useGetRiskHeatmap()` TanStack React Query hook — reuse for data fetching

### Established Patterns
- Radix Sheet for drill-down sidebars
- wouter for URL params
- TanStack React Query for data fetching

### Integration Points
- `risk-heatmap.tsx` — swap `HeatmapGrid` for new `RiskHeatmapChart` component
- `package.json` — add echarts + echarts-for-react

</code_context>

<specifics>
## Specific Ideas

- The ECharts heatmap should feel like a premium data visualization — smooth hover transitions, clean typography, proper spacing
- Canvas should fill available width responsively
- Dark mode must work seamlessly — extract CSS variables at runtime

</specifics>

<deferred>
## Deferred Ideas

- Risk correlation graph (force-directed) — follow-up issue per GH #83 section 4
- KRI widget migration to ECharts gauges — Tier 1 enhancement
- Score progression animated bars — Tier 1 enhancement
- Replacing Recharts sparklines with ECharts — separate initiative
- Storybook documentation — follow-up

</deferred>

---

*Phase: 15-migrate-risk-heatmap-from-css-grid-to-apache-echarts*
*Context gathered: 2026-03-24 via GitHub Issue #83*
