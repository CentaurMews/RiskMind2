# Migrate Risk Heatmap from CSS Grid to Apache ECharts

## Analysis & Design Review

> This issue has been analyzed against the actual codebase. The original proposal assumed the heatmap was built on Recharts — it is not. The heatmap is **pure CSS Grid + Tailwind**. Recharts is only used for sparklines (KPI cards, risk list trends). This updated issue corrects the premise and provides a precise migration design.

---

### #1 Viability Assessment

**The migration is viable and recommended**, with one key correction: we're migrating from **CSS Grid to ECharts**, not from Recharts to ECharts. The scope is smaller than originally proposed because:

- Only 2 files need modification (`risk-heatmap.tsx`, `package.json`) + 1 new file (`risk-heatmap-chart.tsx`)
- The backend API requires **zero changes** — the `GET /api/v1/risks/heatmap` response format works as-is
- The dashboard compact widget should **keep CSS Grid** (ECharts canvas initialization overhead is not justified for a ~100px thumbnail)
- Recharts stays for sparklines — this is additive, not a library replacement

**Risk:** Low. The heatmap is a self-contained component with a clear data contract. Rollback = revert to CSS Grid.

### #2 Design Adequacy

The original design needs these adjustments:

| Original Proposal | Adjustment | Reason |
|---|---|---|
| "Replace Recharts-based heatmap" | Replace **CSS Grid** heatmap | Recharts is not used for the heatmap |
| Use `visualMap` for color mapping | Use **per-cell `itemStyle.color` callback** | Severity color depends on cell *position* (L x I score), not the *value* (risk count). `visualMap` maps value→color, which is wrong here |
| Replace heatmap everywhere | Keep CSS Grid for **dashboard compact mode** | ECharts canvas overhead not worth it for a 100px widget |
| Add Storybook docs | Defer to follow-up | Keep scope focused on the migration |

### #3 ECharts Leverage Across RiskMind

Beyond the heatmap, ECharts can be leveraged across the platform:

#### Tier 1 — High Impact (recommend bundling with or immediately after this issue)

| Screen | Current | ECharts Upgrade | Value |
|---|---|---|---|
| **KRI Widget** (`kri-widget.tsx`) | Custom CSS horizontal bars | ECharts **gauge** or **animated bar** charts with threshold markers | Real-time animation, interactive threshold display, richer visual density |
| **Score Progression** (`score-progression-bar.tsx`) | Custom CSS 3-segment bars | ECharts **custom series** with animated transitions between Inherent → Residual → Target | Animated flow showing risk reduction journey, visual impact for executive views |
| **Risk Distribution** (not yet built) | N/A | ECharts **sunburst** or **treemap** for risk breakdown by category/severity | Hierarchical risk view that doesn't exist today — high value for executives |

#### Tier 2 — Medium Impact (future phases)

| Screen | Current | ECharts Upgrade | Value |
|---|---|---|---|
| **KPI Sparklines** (`kpi-card.tsx`) | Recharts LineChart | ECharts line with micro-interactions | Consolidates charting libraries under one ecosystem |
| **Compliance Coverage** (`framework-detail.tsx`) | CSS progress bar | ECharts **radial gauge** per framework | Visual compliance posture at a glance |
| **Alert Timeline** (`alert-list.tsx`) | Table only | ECharts **calendar heatmap** or **timeline** | Alert frequency patterns become visible |
| **Vendor Lifecycle Flow** (`vendor-list.tsx` kanban) | DOM cards | ECharts **sankey diagram** | Vendor progression visualization |

#### Tier 3 — Enhancement (Foresight v2)

| Screen | Current | ECharts Upgrade | Value |
|---|---|---|---|
| **Monte Carlo Distribution** (Phase 14) | Not built yet | ECharts **histogram + box plot** | Native to Foresight — loss distribution curves |
| **Risk Correlation Matrix** (future) | N/A | ECharts **heatmap** (reuse pattern from this issue) | Cross-risk dependency visualization |
| **OSINT Signal Feed** (Phase 12) | Not built yet | ECharts **scatter + timeline** | Signal clustering and temporal patterns |

### #4 Single Smartest ECharts Addition

**Interactive Risk Correlation Heatmap + Drill-Down Graph**

Build a second ECharts view on the risk heatmap page: a **risk-to-risk correlation matrix** that shows which risks are connected (shared controls, shared vendors, cascading impact). When a user clicks a cell in the L×I heatmap, instead of just listing risks, show an ECharts **graph/force** visualization of how that risk connects to others.

Why this is the most accretive addition:
- **No competitor has it** — most TPRM tools show flat risk lists. A visual correlation graph is a genuine differentiator
- **Uses data we already have** — risks share vendors, controls, and categories. The connections exist in the DB
- **Compounds the heatmap value** — the heatmap becomes a *navigation surface* into a dependency graph, not just a colored grid
- **Executive wow factor** — "click any cell to see risk cascades" is a demo-winning feature
- **ECharts graph series** supports this natively with force-directed layout, zoom, drag, and tooltip

This should be a follow-up issue, not part of this migration. But it's the reason to invest in ECharts now — it unlocks visualizations CSS Grid never could.

---

## Current Implementation (As-Built)

The risk heatmap is built entirely with **CSS Grid and Tailwind utility classes** — no charting library. Recharts is used elsewhere (KPI sparklines in `kpi-card.tsx`, trend sparklines in `risk-list.tsx`), but not for the heatmap. ECharts does not exist in the project yet.

### `components/dashboard/heatmap-grid.tsx` — Shared Grid Component

- **Props:** `{ cells: HeatmapCell[], onCellClick?: (l, i) => void, compact?: boolean }`
- **Grid:** 5x5 CSS Grid (`grid-cols-5 grid-rows-5`), likelihood 5→1 (rows top-down), impact 1→5 (cols left-right)
- **Severity colors:** Tailwind classes based on `score = likelihood * impact`:
  - Critical (≥15): `bg-severity-critical/20 border-severity-critical/30 text-severity-critical`
  - High (≥10): `bg-severity-high/20 border-severity-high/30 text-severity-high`
  - Medium (≥5): `bg-severity-medium/20 border-severity-medium/30`
  - Low (<5): `bg-severity-low/20 border-severity-low/30`
  - Empty (0 risks): `bg-muted/30 border-border/50`
- **Mobile fallback:** `md:hidden` severity summary list; full grid `hidden md:grid`
- **Compact mode:** `text-[10px]`, `rounded-sm`, `gap-1`, `aspect-ratio: 1`

### `pages/risks/risk-heatmap.tsx` — Full-Page Heatmap

- Fetches data via `useGetRiskHeatmap()` (TanStack React Query)
- Axis labels: Y = "1 (Rare)" through "5 (Almost Certain)", X = "1 (Negligible)" through "5 (Catastrophic)"
- **Drill-down:** Click cell → Radix `Sheet` sidebar with risk list, each linking to `/risks/{id}`
- **URL deep linking:** Reads `?l=` and `?i=` on mount to auto-select a cell

### `GET /api/v1/risks/heatmap` — Backend

- Queries risks where `status IN ('open', 'mitigated')` for tenant
- Groups by `{likelihood}-{impact}` key
- Returns `{ cells: HeatmapCell[] }` — only cells with ≥1 risk are returned

### `pages/dashboard.tsx` — Dashboard Compact

- `HeatmapGrid` with `compact={true}` in a "Risk Posture" card
- `onCellClick` navigates to `/risks/heatmap?l={l}&i={i}`

---

## Migration Design

### Package Dependencies

```bash
pnpm add echarts echarts-for-react
```

- `echarts` — Core library (~1MB minified, tree-shakeable)
- `echarts-for-react` — React wrapper with `<ReactECharts>` lifecycle management

### Component Architecture

| Component | Library | Usage | Change |
|---|---|---|---|
| `RiskHeatmapChart` | ECharts | Full-page heatmap on `/risks/heatmap` | **NEW** |
| `HeatmapGrid` | CSS Grid | Dashboard compact widget | **KEEP** (unchanged) |

**Rationale:** Dashboard compact widget is a tiny preview. ECharts canvas initialization overhead is not worth it for a ~100px square.

### Data Transformation

Backend API stays unchanged. Client transforms `HeatmapCell[]` → ECharts format:

```typescript
function transformToEChartsData(cells: HeatmapCell[]): number[][] {
  const data: number[][] = [];
  for (let impact = 1; impact <= 5; impact++) {
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const cell = cells.find(c => c.likelihood === likelihood && c.impact === impact);
      const count = cell?.risks?.length || 0;
      data.push([impact - 1, likelihood - 1, count]);
    }
  }
  return data;
}
```

### ECharts Configuration

Key design decision: **severity color depends on cell position (L×I score), not risk count**. Must use per-cell `itemStyle.color` callback:

```typescript
series: [{
  type: 'heatmap',
  data: transformedData.map(([xi, yi, count]) => ({
    value: [xi, yi, count],
    itemStyle: {
      color: getSeverityColor((xi + 1) * (yi + 1), count),
    },
  })),
  label: {
    show: true,
    formatter: (params) => params.data.value[2] > 0 ? String(params.data.value[2]) : '',
  },
  emphasis: {
    itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
  },
}]
```

**Axes:**
```typescript
xAxis: {
  type: 'category',
  data: ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'],
  name: 'Impact', nameLocation: 'middle', nameGap: 40,
},
yAxis: {
  type: 'category',
  data: ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'],
  name: 'Likelihood', nameLocation: 'middle', nameGap: 80,
}
```

**Tooltip:**
```typescript
tooltip: {
  formatter: (params) => {
    const [impactIdx, likelihoodIdx, count] = params.data.value;
    const score = (impactIdx + 1) * (likelihoodIdx + 1);
    const severity = score >= 15 ? 'Critical' : score >= 10 ? 'High' : score >= 5 ? 'Medium' : 'Low';
    return `<strong>${severity}</strong> (Score: ${score})<br/>
            Likelihood: ${likelihoodIdx + 1} | Impact: ${impactIdx + 1}<br/>
            <strong>${count} risk${count !== 1 ? 's' : ''}</strong>`;
  }
}
```

**Click handler:** Maps `[xIndex, yIndex]` back to `(likelihood, impact)` and triggers existing Sheet drill-down.

**Mobile:** Keep `md:hidden` severity summary list + `hidden md:block` ECharts canvas.

**Theme:** Extract CSS variables at runtime via `getComputedStyle()` for dark/light mode colors. Re-initialize on theme toggle.

---

## Files to Modify

| File | Action | Description |
|---|---|---|
| `artifacts/riskmind-app/package.json` | MODIFY | Add `echarts` + `echarts-for-react` |
| `artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx` | CREATE | ECharts heatmap component with data transformer, severity colors, click handler, theme support |
| `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` | MODIFY | Swap `HeatmapGrid` for `RiskHeatmapChart`; keep Sheet drill-down + URL deep linking |
| `artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx` | KEEP | Still used by dashboard compact mode |
| `artifacts/riskmind-app/src/pages/dashboard.tsx` | KEEP | Still uses `HeatmapGrid` compact |

## Migration Steps

1. Install `echarts` + `echarts-for-react` via pnpm
2. Create `risk-heatmap-chart.tsx` with data transformer + ECharts config + per-cell severity colors
3. Add dark/light theme color extraction utility
4. Update `risk-heatmap.tsx` to use new component (keep Sheet + URL params)
5. Verify drill-down Sheet works via ECharts click handler
6. Verify URL deep linking (`?l=3&i=4`) selects correct cell via `dispatchAction`
7. Test mobile fallback still shows severity summary list

## Acceptance Criteria

- [ ] ECharts heatmap renders 5x5 grid with correct severity colors (Critical ≥15, High ≥10, Medium ≥5, Low <5)
- [ ] Clicking a cell opens drill-down Sheet with correct risks for that L×I combination
- [ ] URL params `?l=` and `?i=` trigger cell selection on page load
- [ ] Mobile (< md breakpoint) shows severity summary list, not ECharts canvas
- [ ] Dashboard compact mode still uses CSS Grid `HeatmapGrid` unchanged
- [ ] Dark mode renders correct severity colors (CSS variables respected)
- [ ] Tooltip shows: severity, score, likelihood label, impact label, risk count
- [ ] Empty cells (0 risks) render with muted color
- [ ] No regressions in existing Recharts sparklines
- [ ] ECharts canvas is responsive and fills container width

## Out of Scope

- Backend API changes (response format unchanged)
- Dashboard compact widget migration (keep CSS Grid)
- Replacing Recharts sparklines with ECharts (separate initiative)
- New heatmap features (filtering, time comparison, velocity overlays)
- Risk correlation graph (follow-up issue — see #4 above)
- Storybook documentation (follow-up)

## Labels

`enhancement`, `frontend`, `visualization`
