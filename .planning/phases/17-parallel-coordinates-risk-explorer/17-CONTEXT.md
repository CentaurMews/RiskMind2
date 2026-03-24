# Phase 17: Parallel Coordinates Risk Explorer - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build an interactive ECharts Parallel Coordinates visualization as a "Risk Explorer" view on the risk dashboard page. Users can see all active risks plotted across 5-7 parallel axes (likelihood, impact, velocity, control effectiveness, category, residual score) and use interactive axis brushing to filter and discover patterns. No backend changes needed — uses existing risk data with client-side computed dimensions.

</domain>

<decisions>
## Implementation Decisions

### Visualization Design
- **D-01:** ECharts `parallel` series type with 6 axes: Likelihood (1-5), Impact (1-5), Score (1-25), Category (categorical), Status (categorical), Risk Count per Owner (derived). Each risk is a line flowing across all axes.
- **D-02:** Lines colored by severity: Critical (red), High (orange), Medium (yellow), Low (green). Uses the same `--severity-*` CSS variables as the rest of the app.
- **D-03:** Interactive axis brushing: drag on any axis to select a range. All other axes highlight only matching risks. Multiple axes can be brushed simultaneously for compound filtering.
- **D-04:** Hover on a line highlights it and shows a tooltip with risk title, score, category, status.
- **D-05:** Click on a line navigates to `/risks/{id}` risk detail page.

### Integration with Dashboard
- **D-06:** Lives on the same `/risks/heatmap` page as a toggle/tab. Two views: "Heatmap" (default) and "Explorer". Both share the same filter state (domain cards, above-appetite filter).
- **D-07:** The domain card filter applies to the parallel coordinates view too — clicking "Cyber" filters both heatmap and explorer to technology-category risks.

### Data Source
- **D-08:** Uses existing `GET /api/v1/risks/heatmap` response (cells with risk arrays) — flatten all risks from all cells. No new backend endpoint needed.
- **D-09:** Client-side computed dimensions: Score = likelihood × impact. Other axes come directly from risk fields.

### Visual Style
- **D-10:** Minimal chrome. Axis labels at top, no heavy gridlines. Muted line opacity (0.3-0.5) with highlighted lines at full opacity. Dark mode via CSS variable extraction.
- **D-11:** When no brush is active, all lines show at low opacity. When brushing, selected lines become vivid, unselected fade to near-invisible.
- **D-12:** Responsive: fills container width. On mobile, show a message "Risk Explorer requires a wider screen" with a link to the heatmap view instead.

### Claude's Discretion
- Exact axis ordering for maximum visual insight
- Whether to add a "Velocity" computed axis (based on how fast risk score changed recently — requires snapshot data)
- Animation transitions when brushing
- Whether axes are draggable to reorder

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard Page
- `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` — Current dashboard page (add Explorer tab/toggle)
- `artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx` — Existing ECharts usage pattern

### Risk Data
- `artifacts/api-server/src/routes/risks.ts` — Risk heatmap endpoint (data source)

### ECharts Parallel
- ECharts parallel coordinate docs: https://echarts.apache.org/examples/en/index.html#chart-type-parallel

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `risk-heatmap-chart.tsx`: ECharts pattern with MutationObserver dark mode, CSS variable extraction — reuse for parallel component
- `risk-heatmap.tsx`: Dashboard page with filter state (activeDomain, aboveAppetiteFilter) — extend with view toggle
- ECharts already installed (Phase 15)

### Integration Points
- `risk-heatmap.tsx` — add Heatmap/Explorer toggle, render parallel chart when Explorer active
- Filter state already exists — pass to parallel component as props

</code_context>

<specifics>
## Specific Ideas

- The parallel coordinates should feel like a "power tool" — sophisticated but not intimidating
- Brushing interaction is the killer feature: it should feel fluid and immediate
- Line colors should be the ONLY visual encoding of severity — avoid redundant icons or labels on lines
- When all filters are cleared, the full risk universe should be visible as a beautiful flowing pattern of lines

</specifics>

<deferred>
## Deferred Ideas

- Risk correlation graph (force-directed) — separate phase
- Axis reordering via drag — future enhancement
- Saved brush presets ("Show me all critical risks with low control effectiveness") — future
- Export brushed selection as filtered risk list — future

</deferred>

---

*Phase: 17-parallel-coordinates-risk-explorer*
*Context gathered: 2026-03-24*
