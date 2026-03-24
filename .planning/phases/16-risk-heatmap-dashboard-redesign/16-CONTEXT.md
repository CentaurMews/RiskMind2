# Phase 16: Risk Heatmap Dashboard Redesign - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** User design specification

<domain>
## Phase Boundary

Redesign the `/risks/heatmap` page into a full risk dashboard with 4 sections: top KPI strip (posture bar + above-appetite pill), resized ECharts heatmap (left) with enriched cells (micro-trend arrows, above-appetite badges, richer tooltips), KRI trend panel (right) with composite risk index line chart and appetite band, and domain cards strip (bottom) with per-category sparklines. Includes backend: daily snapshot system for historical trends, per-category risk appetite thresholds, and domain-grouped risk aggregation queries.

</domain>

<decisions>
## Implementation Decisions

### Page Layout
- **D-01:** Replaces current `/risks/heatmap` page in-place. Same URL, richer content. Not a new page.
- **D-02:** Desktop layout: Top bar (full width KPIs) → Split main content (left: heatmap, right: KRI trend) → Bottom strip (domain cards). Mobile: stacked vertically.

### Top KPI Strip
- **D-03:** Horizontal bar above heatmap with: (1) Overall posture bar (0-100 scale) with appetite band highlighted, current value marker. (2) "X risks above appetite" pill with trend indicator. (3) Optional alerts summary.
- **D-04:** Clicking posture bar opens explanation panel showing how index is calculated.
- **D-05:** Clicking "Above Appetite" filters heatmap to show only above-appetite risks.

### Heatmap Enhancements
- **D-06:** Heatmap takes left portion of split layout (roughly 60% width on desktop). Uses existing ECharts component from Phase 15 but resized smaller.
- **D-07:** Enriched tooltips: cell label (Likelihood × Impact), count of risks with "X% of total", change vs previous period ("+2 since last month").
- **D-08:** Micro-trend indicators in cells: small up/down arrow or dot for stable. Subtle, low-saturation to avoid clutter.
- **D-09:** Above-appetite badge on cells where risk score exceeds category appetite threshold.

### KRI Trend Panel (Right Side)
- **D-10:** Vertical panel on the right (~40% width) showing composite risk index trend line over time.
- **D-11:** Appetite/tolerance as horizontal band on the chart. Color change when line crosses the band.
- **D-12:** Time range switcher: 3M / 6M / 12M. Default: 6M.
- **D-13:** Annotations: small dots where significant events occurred (incidents, control changes).
- **D-14:** Minimal flat line chart. ECharts line series. Single primary color, muted for forecast.

### Domain Cards Strip
- **D-15:** Use existing risk.category values as domains. Map: technology→Cyber, operational→Ops, compliance→Compliance, financial→Financial, strategic→Strategic, reputational→Reputational.
- **D-16:** Each card shows: domain name, current risk level (Low/Medium/High/Critical), tiny sparkline (last 6 months), count of high/critical risks.
- **D-17:** Clicking a domain card filters the heatmap and KRI chart to show only that domain's risks.

### Risk Appetite
- **D-18:** Per-category appetite thresholds (e.g., Cyber: 60, Vendor: 70, Compliance: 50). Stored in a new `risk_appetite_configs` table or as JSONB on tenants.
- **D-19:** Configurable in Settings by admin. Simple table: category → threshold (0-100).

### Snapshot System
- **D-20:** Daily cron job captures heatmap state: risk counts per cell, per category, total composite score. Stored in a new `risk_snapshots` table.
- **D-21:** Snapshots enable: 3M/6M/12M trend views, delta calculations for micro-trends, historical composite risk index.
- **D-22:** node-cron job running at midnight daily. Captures snapshot for each tenant.

### Visual Style (Apple-like)
- **D-23:** Single primary hero: the heatmap. Secondary: KRI trend. Tertiary: top KPIs and domain cards.
- **D-24:** Generous whitespace. No decorative gradients or unnecessary shadows.
- **D-25:** Consistent severity colors across all sections. Same semantic ramp (pale yellow → orange → deep red).
- **D-26:** Cell text: integer count, medium weight, center-aligned. Same app system font.

### Accessibility
- **D-27:** WCAG AA color contrast on all text. Combine color with shape/value for color-blind support.
- **D-28:** Keyboard navigation: tab through heatmap cells and domain cards. Enter/Space to open drill-down.
- **D-29:** Screen reader labels: "Heatmap cell: Likely × Major. 4 risks, increased by 2 since last month."

### Claude's Discretion
- Exact composite risk index calculation formula
- Sparkline chart implementation for domain cards (recharts mini or ECharts mini)
- Posture bar component implementation (CSS bar vs ECharts gauge)
- Exact snapshot table schema columns
- How to handle tenants with no historical data (show "collecting data" state)
- Annotation data source for KRI trend dots
- Mobile breakpoint layout details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Heatmap (Phase 15 output)
- `artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx` — ECharts heatmap component (resize and extend)
- `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` — Current heatmap page to redesign
- `artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx` — CSS Grid compact widget (DO NOT MODIFY)

### Backend
- `artifacts/api-server/src/routes/risks.ts` — Risk CRUD + heatmap endpoint
- `artifacts/api-server/src/lib/signal-feed-poller.ts` — node-cron pattern for daily snapshot job
- `lib/db/src/schema/risks.ts` — Risk schema with category, likelihood, impact

### Theme
- `artifacts/riskmind-app/src/index.css` — Severity CSS variables, theme tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `risk-heatmap-chart.tsx` (Phase 15): ECharts heatmap — resize and extend with micro-trends
- `signal-feed-poller.ts`: node-cron pattern — reuse for daily snapshot cron
- `kpi-card.tsx`: KPI card with sparklines — pattern for domain cards
- ECharts (just installed): use for KRI trend line chart
- Recharts (existing): alternative for sparklines in domain cards

### Integration Points
- `risk-heatmap.tsx` — redesign into full dashboard
- `risks.ts` routes — add snapshot and aggregation endpoints
- Schema — add risk_snapshots table and risk_appetite_configs
- Settings page — add Risk Appetite tab
- node-cron scheduler in server startup — add daily snapshot job

</code_context>

<specifics>
## Specific Ideas

- The heatmap should feel like a "command center" — everything you need to understand risk posture on one screen
- Posture bar should be immediately scannable — green/yellow/red indicator with appetite band
- Domain cards should act as interactive filters, not just decorative summaries
- Trends should answer "are we getting better or worse?" without needing to drill into data
- Empty state for new tenants: "Collecting trend data — first snapshot in X hours"

</specifics>

<deferred>
## Deferred Ideas

- Risk correlation graph (force-directed visualization) — follow-up to GH #83
- Animated transitions between domain filters on heatmap
- Forecast line on KRI trend (predicted trajectory)
- Custom time range picker beyond 3M/6M/12M
- Export dashboard as PDF report

</deferred>

---

*Phase: 16-risk-heatmap-dashboard-redesign*
*Context gathered: 2026-03-24*
