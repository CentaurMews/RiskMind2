# Migrate Risk Heatmap from CSS Grid to Apache ECharts

## Current Implementation Analysis

The risk heatmap is built entirely with CSS Grid and Tailwind utility classes -- there is no charting library involved in the heatmap today. Recharts is used elsewhere in the app (KPI sparklines in `kpi-card.tsx`, chart primitives in `chart.tsx`, and the risk trend chart in `risk-list.tsx`), but the heatmap is a custom component. ECharts does not exist in the project.

### `components/dashboard/heatmap-grid.tsx` -- Shared Grid Component

- **Props interface:** `{ cells: HeatmapCell[], onCellClick?: (l, i) => void, compact?: boolean }`
- **Grid rendering:** 5x5 CSS Grid (`grid-cols-5 grid-rows-5`) iterating likelihood 5..1 (rows, top-down) x impact 1..5 (cols, left-right).
- **Severity color mapping:** Manual Tailwind classes based on `score = likelihood * impact`:
  - **Critical** (score >= 15): `bg-severity-critical/20 border-severity-critical/30 text-severity-critical`
  - **High** (score >= 10): `bg-severity-high/20 border-severity-high/30 text-severity-high`
  - **Medium** (score >= 5): `bg-severity-medium/20 border-severity-medium/30`
  - **Low** (score < 5): `bg-severity-low/20 border-severity-low/30`
  - **Empty** (count === 0): `bg-muted/30 border-border/50`
- **Cell content:** Displays risk count number; empty cells show nothing.
- **Compact mode:** When `compact=true`, uses smaller text (`text-[10px]`), `rounded-sm`, `gap-1`, and `aspect-ratio: 1` inline style.
- **Mobile fallback:** `md:hidden` severity summary list showing Critical/High/Medium/Low risk counts as colored badges. Full grid uses `hidden md:grid` (visible only on md+ screens). No JavaScript resize detection -- pure Tailwind responsive classes.
- **Hover/click:** Conditional `cursor-pointer hover:ring-2 hover:ring-primary/50` when `onCellClick` is provided.
- **Title attribute:** Each cell has a `title` tooltip: `Likelihood: {l}, Impact: {i} -- {count} risk(s)`.

### `pages/risks/risk-heatmap.tsx` -- Full-Page Heatmap

- Fetches data via `useGetRiskHeatmap()` hook (generated API client).
- Renders `HeatmapGrid` inside a card with axis labels:
  - Y-axis (left): "5 (Almost Certain)" through "1 (Rare)"
  - X-axis (bottom): "1 (Negligible)" through "5 (Catastrophic)"
  - Axis title labels: "LIKELIHOOD" (rotated left), "IMPACT" (centered bottom)
- **Drill-down Sheet:** Clicking a cell opens a Radix `Sheet` sidebar showing the list of risks in that cell. Each risk links to `/risks/{id}`.
- **URL deep linking:** On mount, reads `?l=` and `?i=` query params to auto-select a cell. This supports navigation from dashboard compact heatmap.
- **Loading state:** `Loader2` spinner while data loads.

### `pages/dashboard.tsx` -- Dashboard Compact Usage

- Renders `HeatmapGrid` with `compact={true}` inside a "Risk Posture" card.
- Wrapped in an `aspect-square` container with axis labels ("LIKELIHOOD", "IMPACT") and padding.
- `onCellClick` navigates to `/risks/heatmap?l={l}&i={i}` for drill-down.
- "Expand" link in the card header navigates to `/risks/heatmap`.

### `GET /api/v1/risks/heatmap` -- Backend Endpoint

- Located in `artifacts/api-server/src/routes/risks.ts`.
- Queries all risks for the tenant where `status IN ('open', 'mitigated')`.
- Selects: `id`, `title`, `likelihood`, `impact`, `status`, `category`.
- Groups risks by `{likelihood}-{impact}` key into a `cells` record.
- Returns: `{ cells: HeatmapCell[] }` where each cell is `{ likelihood: number, impact: number, risks: Risk[] }`.
- **Note:** Only cells with at least one risk are returned -- empty cells are not included in the response.

### Severity Thresholds

The severity classification is consistent across all components:

| Score (L x I) | Severity |
|---|---|
| >= 15 | Critical |
| >= 10 | High |
| >= 5 | Medium |
| < 5 | Low |

## Why Migrate

### ECharts Advantages

- **Smooth color gradients:** `visualMap` provides continuous or piecewise color interpolation rather than flat color blocks.
- **Rich built-in tooltips:** HTML-formatted tooltips with custom formatter functions -- no manual `title` attribute needed.
- **Zoom and pan:** Built-in `dataZoom` for dense datasets (future-proofing for larger risk matrices).
- **Animation transitions:** Smooth data update animations when risks are added/removed/reclassified.
- **Better accessibility:** Built-in `aria` options with auto-generated descriptions for screen readers.
- **Canvas rendering:** GPU-accelerated rendering via `<canvas>` -- better performance for frequent updates.
- **Visual map legend:** Interactive legend that doubles as a filter (click severity range to highlight/dim cells).
- **Consistent chart ecosystem:** If ECharts is adopted here, it establishes a path for consolidating other visualizations under one library.

### Current CSS Grid Limitations

- **No color gradients:** Each cell is a flat color block with no interpolation between severity levels.
- **No built-in interactivity beyond click:** Hover effects are limited to CSS ring/shadow; no rich tooltip content.
- **No animation:** Data changes cause instant re-render with no visual transition.
- **Manual accessibility:** Only a basic `title` attribute tooltip; no structured ARIA descriptions.
- **Manual color mapping:** Severity-to-color logic is duplicated in multiple places (grid component, heatmap page `getCellColor`, severity summary).

## ECharts Migration Design

### Package Dependencies

```bash
npm install echarts echarts-for-react
```

- `echarts`: Core library (~1MB minified, tree-shakeable)
- `echarts-for-react`: Lightweight React wrapper providing `<ReactECharts>` component with lifecycle management

### Component Architecture

| Component | Library | Usage |
|---|---|---|
| `RiskHeatmapChart` (NEW) | ECharts | Full-page heatmap on `/risks/heatmap` |
| `HeatmapGrid` (KEEP) | CSS Grid | Dashboard compact widget (unchanged) |

**Rationale:** The dashboard compact widget is a tiny 5x5 grid inside a small card. ECharts initialization overhead (canvas setup, theme registration) is not justified for a ~100px square preview. The CSS Grid version is lightweight and works perfectly at that scale.

### Data Transformation

The backend API response stays unchanged. The new `RiskHeatmapChart` component transforms the API data client-side:

```typescript
// Transform HeatmapCell[] to ECharts data format
function transformToEChartsData(cells: HeatmapCell[]): number[][] {
  const data: number[][] = [];
  // Fill all 25 cells (ECharts needs the full matrix)
  for (let impact = 1; impact <= 5; impact++) {
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const cell = cells.find(c => c.likelihood === likelihood && c.impact === impact);
      const count = cell?.risks?.length || 0;
      // ECharts heatmap format: [xIndex, yIndex, value]
      data.push([impact - 1, likelihood - 1, count]);
    }
  }
  return data;
}
```

### ECharts Option Configuration

```typescript
const option: EChartsOption = {
  tooltip: {
    position: 'top',
    formatter: (params: any) => {
      const [impactIdx, likelihoodIdx, count] = params.data;
      const impact = impactIdx + 1;
      const likelihood = likelihoodIdx + 1;
      const score = impact * likelihood;
      const severity = score >= 15 ? 'Critical' : score >= 10 ? 'High' : score >= 5 ? 'Medium' : 'Low';
      const impactLabels = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];
      const likelihoodLabels = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
      return `
        <div style="font-size:13px">
          <strong>${severity}</strong> (Score: ${score})<br/>
          Likelihood: ${likelihood} (${likelihoodLabels[likelihoodIdx]})<br/>
          Impact: ${impact} (${impactLabels[impactIdx]})<br/>
          <strong>${count} risk${count !== 1 ? 's' : ''}</strong>
        </div>
      `;
    },
  },
  xAxis: {
    type: 'category',
    data: ['1\nNegligible', '2\nMinor', '3\nModerate', '4\nMajor', '5\nCatastrophic'],
    name: 'Impact',
    nameLocation: 'middle',
    nameGap: 50,
    splitArea: { show: true },
  },
  yAxis: {
    type: 'category',
    data: ['1\nRare', '2\nUnlikely', '3\nPossible', '4\nLikely', '5\nAlmost Certain'],
    name: 'Likelihood',
    nameLocation: 'middle',
    nameGap: 80,
    splitArea: { show: true },
  },
  visualMap: {
    type: 'piecewise',
    pieces: [
      { min: 0, max: 0, label: 'Empty', color: 'var(--muted)' },
      // Low: score < 5 (but has risks)
      { min: 1, max: 1, label: 'Low', color: 'var(--severity-low)' },
      // Medium-High-Critical handled via custom logic or symbolSize
    ],
    // Alternative: use continuous visualMap with inRange color stops
    show: true,
    orient: 'horizontal',
    bottom: 0,
  },
  series: [
    {
      type: 'heatmap',
      data: transformedData, // [[xIdx, yIdx, count], ...]
      label: {
        show: true,
        formatter: (params: any) => params.data[2] > 0 ? String(params.data[2]) : '',
      },
      itemStyle: {
        borderRadius: 4,
        borderColor: 'var(--border)',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
        },
      },
    },
  ],
};
```

> **Note on `visualMap` and severity colors:** The `visualMap` maps the risk *count* to color, but the current design maps `score = likelihood * impact` to color. The ECharts implementation should use a custom `itemStyle.color` function per cell rather than relying solely on `visualMap.min/max`, since the color depends on the cell's position (score), not just the value (count). A callback approach:
>
> ```typescript
> series: [{
>   type: 'heatmap',
>   data: transformedData.map(([xi, yi, count]) => ({
>     value: [xi, yi, count],
>     itemStyle: {
>       color: getSeverityColor((xi + 1) * (yi + 1), count),
>     },
>   })),
> }]
> ```

### Click Handler

```typescript
chartRef.current?.getEchartsInstance().on('click', (params: any) => {
  const [impactIdx, likelihoodIdx] = params.data;
  setSelectedCell({ likelihood: likelihoodIdx + 1, impact: impactIdx + 1 });
});
```

This triggers the existing `Sheet` drill-down component -- no changes needed to the Sheet or risk list rendering.

### Mobile Strategy

Keep the existing `md:hidden` / `hidden md:grid` pattern:
- **Mobile (< md):** Show severity summary list (same as current `HeatmapGrid` mobile fallback). Can extract to a shared `SeveritySummaryList` component.
- **Desktop (md+):** Show ECharts canvas chart.

### Theme Integration

Register ECharts themes for dark/light mode using CSS variable extraction:

```typescript
// Extract computed CSS variable values at runtime
function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    critical: style.getPropertyValue('--severity-critical').trim(),
    high: style.getPropertyValue('--severity-high').trim(),
    medium: style.getPropertyValue('--severity-medium').trim(),
    low: style.getPropertyValue('--severity-low').trim(),
    muted: style.getPropertyValue('--muted').trim(),
    border: style.getPropertyValue('--border').trim(),
    foreground: style.getPropertyValue('--foreground').trim(),
  };
}
```

Re-initialize theme colors when the user toggles dark/light mode (listen for `class` attribute changes on `<html>` or use the app's theme context).

## Files to Modify

| File | Action | Description |
|---|---|---|
| `artifacts/riskmind-app/package.json` | MODIFY | Add `echarts` and `echarts-for-react` dependencies |
| `artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx` | CREATE | New ECharts-based heatmap component with data transformer, theme support, click handler |
| `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` | MODIFY | Replace `HeatmapGrid` with `RiskHeatmapChart` for the main grid; keep Sheet drill-down and URL deep linking |
| `artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx` | KEEP | Unchanged -- still used by dashboard compact mode |
| `artifacts/riskmind-app/src/pages/dashboard.tsx` | KEEP | Unchanged -- still uses `HeatmapGrid` with `compact={true}` |

## Migration Steps

1. **Install dependencies:** `npm install echarts echarts-for-react` in `artifacts/riskmind-app/`.
2. **Create `risk-heatmap-chart.tsx`:** Implement the ECharts component with:
   - Data transformation function (`HeatmapCell[]` to ECharts format)
   - Severity color function based on position score (not count)
   - ECharts option config (axes, tooltip, series, emphasis)
   - Click event handler prop
   - Mobile severity summary fallback (reuse or extract from `HeatmapGrid`)
3. **Register dark/light themes:** Create theme registration utility that reads CSS variables and registers two ECharts themes. Hook into the app's theme toggle.
4. **Update `risk-heatmap.tsx`:** Replace `<HeatmapGrid>` usage with `<RiskHeatmapChart>` in the full-page view. Keep:
   - Axis labels container layout
   - `Sheet` drill-down with `selectedCell` state
   - URL deep linking (`?l=` and `?i=` params)
   - Loading spinner
5. **Verify drill-down:** Ensure ECharts click handler correctly maps `[xIndex, yIndex]` back to `(likelihood, impact)` and opens the Sheet with the right risks.
6. **Verify URL deep linking:** Ensure `?l=3&i=4` on page load highlights the correct cell in ECharts (use `dispatchAction` to programmatically select).
7. **Test mobile fallback:** Confirm `md:hidden` summary list still renders on small screens and ECharts canvas is hidden.

## Acceptance Criteria

- [ ] ECharts heatmap renders a 5x5 grid with correct severity colors matching current thresholds (Critical >= 15, High >= 10, Medium >= 5, Low < 5)
- [ ] Clicking a cell opens the drill-down Sheet showing the correct risks for that likelihood/impact combination
- [ ] URL params `?l=` and `?i=` still trigger cell selection on page load
- [ ] Mobile screens (< md breakpoint) show the severity summary list, not the ECharts canvas
- [ ] Dashboard compact mode (`/dashboard`) still uses the CSS Grid `HeatmapGrid` component unchanged
- [ ] Dark mode renders correct colors (severity CSS variables respected)
- [ ] Tooltip on hover shows: likelihood label, impact label, risk count, severity level
- [ ] Empty cells (0 risks) render with muted/subtle color, not severity colors
- [ ] No regressions in existing Recharts sparklines (KPI cards, risk trend chart)
- [ ] ECharts canvas is responsive and fills the available container width

## Out of Scope

- **Backend API changes:** The `GET /api/v1/risks/heatmap` response format stays exactly the same. No new fields or endpoints.
- **Dashboard compact widget migration:** The dashboard's small "Risk Posture" preview keeps its CSS Grid `HeatmapGrid` -- not worth ECharts overhead for a thumbnail.
- **Replacing Recharts sparklines with ECharts:** Recharts is used for KPI sparklines and risk trend charts. Consolidating charting libraries is a separate initiative.
- **New heatmap features:** Filtering by category, time comparison views, risk velocity overlays, and other enhancements are follow-up work.

## Labels

`enhancement`, `frontend`, `visualization`
