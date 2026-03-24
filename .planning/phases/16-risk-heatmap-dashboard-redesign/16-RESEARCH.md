# Phase 16: Risk Heatmap Dashboard Redesign - Research

**Researched:** 2026-03-24
**Domain:** ECharts dashboard composition, PostgreSQL snapshot schema, node-cron, composite risk scoring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page Layout**
- D-01: Replaces current `/risks/heatmap` page in-place. Same URL, richer content. Not a new page.
- D-02: Desktop layout: Top bar (full width KPIs) → Split main content (left: heatmap ~60%, right: KRI trend ~40%) → Bottom strip (domain cards). Mobile: stacked vertically.

**Top KPI Strip**
- D-03: Horizontal bar: (1) Overall posture bar (0-100 scale) with appetite band + current value marker. (2) "X risks above appetite" pill with trend indicator. (3) Optional alerts summary.
- D-04: Clicking posture bar opens explanation panel showing how index is calculated.
- D-05: Clicking "Above Appetite" filters heatmap to show only above-appetite risks.

**Heatmap Enhancements**
- D-06: Heatmap takes ~60% left side of split layout. Resize existing `RiskHeatmapChart` component from Phase 15.
- D-07: Enriched tooltips: cell label (Likelihood × Impact), count with "X% of total", change vs previous period.
- D-08: Micro-trend indicators in cells: small up/down arrow or stable dot. Subtle, low-saturation.
- D-09: Above-appetite badge on cells where risk score exceeds category appetite threshold.

**KRI Trend Panel (Right Side)**
- D-10: Vertical panel ~40% width. Composite risk index trend line over time.
- D-11: Appetite/tolerance as horizontal band. Color change when line crosses band.
- D-12: Time range switcher: 3M / 6M / 12M. Default: 6M.
- D-13: Annotations: small dots where significant events occurred.
- D-14: Minimal flat ECharts line series. Single primary color, muted for forecast.

**Domain Cards Strip**
- D-15: Use existing `risk.category` values. Map: technology→Cyber, operational→Ops, compliance→Compliance, financial→Financial, strategic→Strategic, reputational→Reputational.
- D-16: Each card: domain name, current risk level, tiny sparkline (last 6 months), count of high/critical risks.
- D-17: Clicking domain card filters heatmap and KRI chart to that domain.

**Risk Appetite**
- D-18: Per-category thresholds stored in a new `risk_appetite_configs` table or JSONB on tenants.
- D-19: Configurable in Settings by admin. Table: category → threshold (0-100).

**Snapshot System**
- D-20: Daily cron captures heatmap state: risk counts per cell, per category, total composite score. Stored in `risk_snapshots` table.
- D-21: Snapshots enable 3M/6M/12M trend views, delta calculations, historical composite risk index.
- D-22: node-cron at midnight daily, per-tenant.

**Visual Style**
- D-23: Heatmap is primary hero. KRI trend secondary. KPIs and domain cards tertiary.
- D-24: Generous whitespace. No decorative gradients or unnecessary shadows.
- D-25: Consistent severity colors: pale yellow → orange → deep red.
- D-26: Cell text: integer count, medium weight, center-aligned.

**Accessibility**
- D-27: WCAG AA color contrast. Color + shape/value for color-blind support.
- D-28: Keyboard navigation through heatmap cells and domain cards. Enter/Space for drill-down.
- D-29: Screen reader labels: "Heatmap cell: Likely × Major. 4 risks, increased by 2 since last month."

### Claude's Discretion
- Exact composite risk index calculation formula
- Sparkline chart implementation for domain cards (recharts mini or ECharts mini)
- Posture bar component implementation (CSS bar vs ECharts gauge)
- Exact snapshot table schema columns
- How to handle tenants with no historical data (show "collecting data" state)
- Annotation data source for KRI trend dots
- Mobile breakpoint layout details

### Deferred Ideas (OUT OF SCOPE)
- Risk correlation graph (force-directed visualization)
- Animated transitions between domain filters on heatmap
- Forecast line on KRI trend
- Custom time range picker beyond 3M/6M/12M
- Export dashboard as PDF report
</user_constraints>

---

## Summary

Phase 16 transforms the `/risks/heatmap` page into a full-screen risk command center. The existing ECharts `RiskHeatmapChart` component (Phase 15) provides the foundation — it renders a 5×5 grid with position-based severity coloring via `itemStyle.color` callback, theme-reactive via `MutationObserver`, and supports click events. The core extension work is: (1) enriching the heatmap series label formatter to embed micro-trend arrows and above-appetite badge overlays, (2) adding an ECharts line chart for the KRI trend panel with a `markArea` appetite band, (3) building two new Drizzle schema tables (`risk_snapshots`, `risk_appetite_configs`), and (4) wiring a midnight node-cron job following the established `signal-feed-poller.ts` pattern.

The composite risk index is derived from the active risk register using a weighted sum of inherent scores normalized to 0-100. The snapshot system freezes this value plus per-cell and per-category counts daily, enabling the KRI trend panel to plot historical data without live re-computation. For tenants with fewer than 1 snapshot, an "Collecting trend data" empty state is shown.

The domain cards strip uses `recharts` (already installed at v2.15.4) for sparklines — consistent with the existing `kpi-card.tsx` pattern — avoiding a second charting bundle split. The posture bar is implemented as a CSS gradient bar with an absolute-positioned marker, which is simpler and more theme-compatible than an ECharts gauge.

**Primary recommendation:** Extend `RiskHeatmapChart` props for trend deltas and appetite flags, build the two schema tables first, implement the snapshot cron, then add the three UI sections in a single redesigned `risk-heatmap.tsx`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| echarts | ^6.0.0 | KRI trend line chart, heatmap extensions | Already installed; Phase 15 ECharts foundation |
| echarts-for-react | ^3.0.6 | React wrapper for ECharts | Already installed; used in Phase 15 |
| recharts | ^2.15.4 | Domain card sparklines | Already installed; used in `kpi-card.tsx` |
| node-cron | ^4.2.1 | Daily snapshot cron job | Already installed; used in signal-feed-poller |
| drizzle-orm | catalog: | New schema tables | Project-wide ORM |
| drizzle-zod | (via db package) | Insert schema validation | Established pattern in all schema files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^3.6.0 | Snapshot date bucketing, time range filtering | Already installed for date formatting |
| @tanstack/react-query | catalog: | Dashboard data fetching, invalidation | Already used project-wide |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts sparklines | ECharts mini chart | ECharts is heavier for 6-point sparklines; recharts already present |
| CSS posture bar | ECharts gauge | Gauge adds complexity; CSS bar is responsive and theme-friendly |
| JSONB on tenants.settings | Separate `risk_appetite_configs` table | Table is queryable per-category, easier to extend with per-tenant admin UI |

**Installation:** No new packages required. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

New and modified files:

```
lib/db/src/schema/
├── risk-snapshots.ts         # NEW — daily posture snapshot table
├── risk-appetite-configs.ts  # NEW — per-category appetite thresholds
└── index.ts                  # ADD exports for new tables

artifacts/api-server/src/
├── lib/risk-snapshot-scheduler.ts   # NEW — midnight cron job
├── routes/risks.ts                  # EXTEND — add snapshot + dashboard endpoints
└── index.ts                         # ADD startRiskSnapshotScheduler() call

artifacts/riskmind-app/src/
├── pages/risks/risk-heatmap.tsx          # REDESIGN — full dashboard layout
├── components/dashboard/
│   ├── risk-heatmap-chart.tsx            # EXTEND — micro-trends, appetite badges
│   ├── kri-trend-panel.tsx               # NEW — ECharts line chart component
│   ├── risk-posture-bar.tsx              # NEW — CSS posture bar component
│   └── domain-card.tsx                   # NEW — per-category card with sparkline
└── pages/settings/settings.tsx           # EXTEND — Risk Appetite tab
```

### Pattern 1: Snapshot Table Schema

**What:** Immutable daily snapshot of tenant risk posture captured by cron.
**When to use:** Any time historical trend data is needed without re-querying live data.

```typescript
// lib/db/src/schema/risk-snapshots.ts
import { pgTable, uuid, integer, numeric, jsonb, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const riskSnapshotsTable = pgTable("risk_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  snapshotDate: date("snapshot_date").notNull(),          // YYYY-MM-DD, one row per tenant per day
  compositeScore: numeric("composite_score", { precision: 6, scale: 2 }).notNull(), // 0.00–100.00
  totalRisks: integer("total_risks").notNull(),
  aboveAppetiteCount: integer("above_appetite_count").notNull().default(0),
  // JSONB columns for per-cell and per-category counts
  // cellCounts: { "3-4": 5, "5-5": 2, ... } keyed by "likelihood-impact"
  cellCounts: jsonb("cell_counts").notNull().default({}),
  // categoryCounts: { "technology": { score: 72, count: 8 }, ... }
  categoryCounts: jsonb("category_counts").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("risk_snapshots_tenant_date_idx").on(t.tenantId, t.snapshotDate),
]);
```

**Key decision:** Use `date` type (not `timestamp`) for `snapshot_date` — one row per tenant per day enforced by unique index. JSONB for cell and category counts avoids schema branching when categories change.

### Pattern 2: Risk Appetite Configs Table

**What:** Per-category appetite threshold (0-100 composite score).
**When to use:** Checked by snapshot job and heatmap rendering.

```typescript
// lib/db/src/schema/risk-appetite-configs.ts
import { pgTable, uuid, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { riskCategoryEnum } from "./risks";

export const riskAppetiteConfigsTable = pgTable("risk_appetite_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  category: riskCategoryEnum("category").notNull(),
  threshold: integer("threshold").notNull().default(60), // 0-100; above = over appetite
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("risk_appetite_tenant_category_idx").on(t.tenantId, t.category),
]);
```

**Key decision:** Reuse `riskCategoryEnum` from `risks.ts` — no string duplication, category changes propagate automatically.

### Pattern 3: Composite Risk Index Formula (Claude's Discretion)

**Recommended formula:**

```typescript
// Composite Risk Index: weighted average of active risk inherent scores, normalized 0-100
// Inherent score = likelihood × impact (1-25 range)
// Normalized cell score = (likelihood × impact) / 25 × 100
// Composite = weighted average where high/critical risks count 2x

function computeCompositeScore(risks: Array<{ likelihood: number; impact: number; status: string }>): number {
  const active = risks.filter(r => ["open", "mitigated"].includes(r.status));
  if (active.length === 0) return 0;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of active) {
    const raw = r.likelihood * r.impact; // 1-25
    const normalized = (raw / 25) * 100; // 0-100
    const weight = raw >= 15 ? 2 : 1;   // critical/high risks weighted 2x
    weightedSum += normalized * weight;
    weightTotal += weight;
  }
  return Math.round(weightedSum / weightTotal);
}
```

**Rationale:** Simple, transparent (shown in D-04 explanation panel), consistent with existing `likelihood × impact` severity thresholds (score >= 15 = critical, >= 10 = high).

### Pattern 4: node-cron Snapshot Job (following signal-feed-poller.ts pattern)

**What:** Midnight daily snapshot job per tenant.
**When to use:** Server startup via `index.ts`.

```typescript
// artifacts/api-server/src/lib/risk-snapshot-scheduler.ts
import cron from "node-cron";
import { db, risksTable, riskSnapshotsTable, riskAppetiteConfigsTable, tenantsTable } from "@workspace/db";

export function startRiskSnapshotScheduler(): void {
  // Midnight UTC daily
  cron.schedule("0 0 * * *", () => {
    captureSnapshotForAllTenants().catch((err) => {
      console.error("[RiskSnapshot] Unhandled error:", err);
    });
  });
  console.log("[RiskSnapshot] Scheduler started — daily at 00:00 UTC");
}

async function captureSnapshotForAllTenants(): Promise<void> {
  const tenants = await db.selectDistinct({ id: tenantsTable.id }).from(tenantsTable);
  for (const tenant of tenants) {
    try {
      await captureSnapshotForTenant(tenant.id);
    } catch (err) {
      console.error(`[RiskSnapshot] Failed for tenant ${tenant.id}:`, err);
      // Continue to next tenant — same pattern as signal-feed-poller
    }
  }
}
```

**Key decision:** Iterate all tenants from `tenantsTable` (not from risks — new tenants with no risks still get a zero snapshot). Use `onConflictDoUpdate` with `set` to replace same-day snapshot if job re-runs.

### Pattern 5: ECharts KRI Trend Line Chart with Appetite Band

**What:** Line chart with `markArea` for appetite band and `markPoint`/`markLine` for annotations.

```typescript
// Source: ECharts documentation — markArea for bands
const kriTrendOption: EChartsOption = {
  xAxis: { type: "time" },
  yAxis: { type: "value", min: 0, max: 100 },
  series: [
    {
      type: "line",
      data: snapshotPoints, // [timestamp, compositeScore]
      smooth: false,
      lineStyle: { color: "hsl(var(--primary))", width: 2 },
      areaStyle: undefined,
      markArea: {
        silent: true,
        itemStyle: { color: "rgba(0, 200, 0, 0.08)" },
        data: [[{ yAxis: 0 }, { yAxis: appetiteThreshold }]], // green = below appetite
      },
      markPoint: {
        data: annotations.map(a => ({
          coord: [a.date, a.score],
          symbol: "circle",
          symbolSize: 8,
          label: { formatter: a.label, show: false }, // show on hover only
        })),
      },
    },
  ],
};
```

**Key decisions:**
- Use `type: "time"` on xAxis — ECharts natively handles date gaps without artificial zero-filling.
- `markArea` covers 0→appetiteThreshold in green, not an explicit red band above.
- Color change above appetite: use `visualMap` piece-based coloring on the line segment (see Anti-Patterns).

### Pattern 6: ECharts Heatmap Cell Micro-Trends (Label Formatter Extension)

**What:** Extend the Phase 15 `RiskHeatmapChart` to accept delta data and render arrows inside cell labels.

```typescript
// Extended props
interface RiskHeatmapChartProps {
  cells: Array<{
    likelihood: number;
    impact: number;
    risks: Array<{ id: string; title: string; status: string; category: string }>;
  }>;
  // NEW: delta map keyed by "likelihood-impact"
  cellDeltas?: Record<string, number>; // positive = more risks, negative = fewer
  // NEW: above-appetite set (cell keys where score > category threshold)
  aboveAppetiteCells?: Set<string>;
  onCellClick?: (likelihood: number, impact: number) => void;
  selectedCell?: { likelihood: number; impact: number } | null;
}

// Inside series label formatter:
formatter: (params: any) => {
  const [iIdx, lIdx, count] = params.value;
  const key = `${lIdx + 1}-${iIdx + 1}`;
  const delta = cellDeltas?.[key] ?? 0;
  const isAboveAppetite = aboveAppetiteCells?.has(key) ?? false;
  const arrow = delta > 0 ? " ↑" : delta < 0 ? " ↓" : "";
  const badge = isAboveAppetite ? " !" : "";
  return count > 0 ? `${count}${arrow}${badge}` : "";
}
```

**Key decision:** Delta arrows and appetite badge are rendered as plain text inside the existing label. No custom SVG overlays needed — ECharts label formatter handles Unicode arrows natively.

### Pattern 7: Domain Card Sparkline (Recharts, following kpi-card.tsx)

**What:** Tiny sparkline using the same `recharts` `LineChart` + `ChartContainer` pattern as `kpi-card.tsx`.

```typescript
// Same pattern as kpi-card.tsx
import { ChartContainer } from "@/components/ui/chart";
import { LineChart, Line, ResponsiveContainer } from "recharts";

// domain card sparkline — 6 monthly composite scores
<ChartContainer config={sparkConfig} className="h-10 w-24">
  <LineChart data={monthlyScores}>
    <Line type="monotone" dataKey="score" dot={false} strokeWidth={1.5} stroke={severityColor} />
  </LineChart>
</ChartContainer>
```

### Pattern 8: Posture Bar (CSS, Claude's Discretion)

**What:** Horizontal progress bar with appetite band highlight and current value marker.

```tsx
// CSS-only, no charting library needed
function PostureBar({ score, appetiteThreshold }: { score: number; appetiteThreshold: number }) {
  return (
    <div className="relative h-4 rounded-full bg-muted overflow-hidden">
      {/* Appetite band: green region */}
      <div
        className="absolute inset-y-0 left-0 bg-emerald-500/20 rounded-full"
        style={{ width: `${appetiteThreshold}%` }}
      />
      {/* Score fill */}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{
          width: `${score}%`,
          backgroundColor: score > appetiteThreshold
            ? "hsl(var(--severity-critical))"
            : "hsl(var(--severity-low))"
        }}
      />
      {/* Appetite line marker */}
      <div
        className="absolute inset-y-0 w-0.5 bg-foreground/40"
        style={{ left: `${appetiteThreshold}%` }}
      />
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **ECharts `visualMap` for heatmap cell color**: Phase 15 deliberately avoided this — use the `itemStyle.color` callback instead (established pattern, confirmed working).
- **Synchronous composite score calculation in route handler**: Compute snapshot async in cron job; route returns pre-computed snapshot values.
- **Storing appetite thresholds on `tenants.settings` JSONB**: Hard to query per-category; use dedicated table (D-18).
- **ECharts line series with `type: "category"` x-axis for time data**: Use `type: "time"` for correct gap handling when days are missing from snapshot history.
- **Re-computing deltas on every API request**: Compute `previous_period_count` at snapshot capture time and store in JSONB, not in the route handler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom setInterval | node-cron (already installed ^4.2.1) | Handles timezone, DST, missed-run recovery |
| Sparklines | Custom SVG | recharts LineChart (v2.15.4, installed) | ChartContainer already provides accessible wrapper |
| Time-series gaps | Manual zero-fill | ECharts `type: "time"` xAxis | Handles missing dates automatically |
| Per-category enum | Text column | Re-use `riskCategoryEnum` from risks.ts | Type safety, migration consistency |
| Schema validation | Manual Zod schemas | drizzle-zod `createInsertSchema` | Established pattern in all existing schema files |

---

## Common Pitfalls

### Pitfall 1: ECharts Canvas vs DOM — Label Overflow on Small Heatmap
**What goes wrong:** When the heatmap is resized to ~60% width, cells become narrower and the label formatter text (e.g., `12 ↑ !`) overflows the cell boundary.
**Why it happens:** ECharts canvas labels don't clip; the renderer places text at center regardless of cell width.
**How to avoid:** Set `label.overflow: "truncate"` and `label.fontSize: 11` (down from 14 in Phase 15). Also verify `minHeight` on the chart container scales with the 60% column constraint.
**Warning signs:** Labels visually overlap adjacent cells in narrow viewports.

### Pitfall 2: Snapshot Unique Constraint Conflict on Re-Run
**What goes wrong:** If the cron job fires twice in the same day (server restart at 00:01), the second run throws a unique constraint violation on `(tenant_id, snapshot_date)`.
**Why it happens:** The unique index enforces one row per tenant per day.
**How to avoid:** Use Drizzle's `.onConflictDoUpdate({ target: [...], set: { ...updatedFields } })` instead of plain `.insert()`. This makes the snapshot idempotent.

### Pitfall 3: `date` Column Time Zone Drift
**What goes wrong:** A midnight UTC cron captures `new Date()` which may be previous calendar day in the server's local time zone.
**Why it happens:** JavaScript `new Date().toISOString().split("T")[0]` is UTC-safe; `new Date().toLocaleDateString()` is not.
**How to avoid:** Always derive snapshot date as `new Date().toISOString().split("T")[0]` (UTC) in the cron function.

### Pitfall 4: ECharts `markArea` Ignored When `visualMap` Is Present
**What goes wrong:** Adding a `visualMap` component to color the line above the appetite threshold silently overrides `markArea` styling.
**Why it happens:** ECharts applies `visualMap` color mapping over series styles including `markArea`.
**How to avoid:** For the appetite band, use `markArea` only. For line color change at threshold, use two separate line series (below threshold = primary color, above = critical color) with `connectNulls: false`. Do NOT use `visualMap`.

### Pitfall 5: Domain Filter State Causing Stale Heatmap Data
**What goes wrong:** Clicking a domain card should filter heatmap cells to only show risks from that category. If the filter is applied client-side from the full dataset but the above-appetite badges are pre-computed server-side for all categories, the badge count becomes inconsistent.
**Why it happens:** Mismatch between client filter and server-computed aggregates.
**How to avoid:** Pass `categoryFilter` as a query param to both the dashboard endpoint and the heatmap cells computation, so the server returns filtered cell counts and filtered above-appetite flags. Alternatively, derive both client-side from the full risk list (simpler).

### Pitfall 6: New Tables Not Exported from `@workspace/db`
**What goes wrong:** `risk-snapshot-scheduler.ts` imports `riskSnapshotsTable` from `@workspace/db` but it throws a module resolution error.
**Why it happens:** New schema files must be added to `lib/db/src/schema/index.ts` exports AND Drizzle `push` must be run.
**How to avoid:** The plan should include explicit steps: (1) add schema file, (2) export from index.ts, (3) run `pnpm --filter @workspace/db push`.

---

## Code Examples

Verified patterns from existing codebase:

### Drizzle Table with Unique Index (from monitoring-configs.ts)
```typescript
// Source: lib/db/src/schema/monitoring-configs.ts
export const monitoringConfigsTable = pgTable("monitoring_configs", {
  ...columns
}, (t) => [
  uniqueIndex("monitoring_configs_tenant_tier_idx").on(t.tenantId, t.tier),
]);
```

### node-cron Per-Tenant Loop (from signal-feed-poller.ts)
```typescript
// Source: artifacts/api-server/src/lib/signal-feed-poller.ts
cron.schedule("0 0 * * *", () => {
  captureSnapshotForAllTenants().catch((err) => {
    console.error(`[RiskSnapshot] Unhandled error:`, err);
  });
});
// Per-tenant error isolation: catch per tenant, never rethrow, continue loop
for (const tenant of tenants) {
  try {
    await captureSnapshotForTenant(tenant.id);
  } catch (err) {
    console.error(`[RiskSnapshot] Failed for tenant ${tenant.id}:`, err);
  }
}
```

### Server Startup Registration (from index.ts)
```typescript
// Source: artifacts/api-server/src/index.ts
// Add alongside existing scheduler registrations:
startRiskSnapshotScheduler();
```

### recharts Sparkline in KPI Card (from kpi-card.tsx)
```typescript
// Source: artifacts/riskmind-app/src/components/dashboard/kpi-card.tsx
<ChartContainer config={sparkConfig} className="h-8 w-20 mb-1">
  <LineChart data={sparkData}>
    <Line type="monotone" dataKey="score" dot={false} strokeWidth={1.5} stroke="hsl(var(--primary))" />
  </LineChart>
</ChartContainer>
```

### ECharts MutationObserver Theme Reactivity (from risk-heatmap-chart.tsx)
```typescript
// Source: artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx
// KriTrendPanel must reuse this same pattern for dark mode support
useEffect(() => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "class") {
        setThemeVersion((v) => v + 1);
        break;
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}, []);
```

### Existing Heatmap Data Format (confirmed from Phase 15)
```typescript
// heatmapData format: [impactIndex, likelihoodIndex, count]
// x-axis = Impact (0-4), y-axis = Likelihood (0-4)
// Score = (likelihoodIndex+1) × (impactIndex+1) → severity thresholds: >=15 critical, >=10 high, >=5 medium
data.push([i - 1, l - 1, count]); // i=impact (1-5), l=likelihood (1-5)
```

---

## Existing Data Model — Key Facts

### Risk Schema (confirmed from lib/db/src/schema/risks.ts)
- `likelihood`: integer 1-5
- `impact`: integer 1-5
- `category`: `riskCategoryEnum` → `operational | financial | compliance | strategic | technology | reputational`
- `status`: `riskStatusEnum` → `draft | open | mitigated | accepted | closed`
- Active risks for heatmap = `status IN ('open', 'mitigated')` (confirmed from `/v1/risks/heatmap` route)

### Domain Card Category Mapping (from D-15)
| DB value | Display label |
|----------|--------------|
| technology | Cyber |
| operational | Ops |
| compliance | Compliance |
| financial | Financial |
| strategic | Strategic |
| reputational | Reputational |

### Current Heatmap API Response (confirmed from risks.ts route)
```json
{ "cells": [{ "likelihood": 3, "impact": 4, "risks": [{ "id": "...", "title": "...", "status": "open", "category": "technology" }] }] }
```

### KRI Schema (confirmed from lib/db/src/schema/kris.ts)
- Linked 1:1 to `riskId`
- Has `warningThreshold`, `criticalThreshold`, `currentValue` (numeric)
- These are per-KRI thresholds, different from the per-category appetite thresholds in Phase 16

---

## New API Endpoints Required

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/risks/dashboard` | Returns full dashboard payload: posture score, above-appetite count, cells with deltas, snapshots for KRI trend, domain summaries |
| GET | `/v1/risks/snapshots?range=6M` | Returns time-series of `compositeScore` + `aboveAppetiteCount` for KRI trend panel |
| GET | `/v1/risks/appetite` | Returns all appetite configs for tenant |
| PUT | `/v1/risks/appetite/:category` | Upsert appetite threshold for a category (admin only) |

**Note:** These must be added BEFORE the `/:id` route in `risks.ts` to avoid Express path conflict (established pattern from Phase 11 — "concentration-risk route placed before /:id").

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS Grid heatmap (heatmap-grid.tsx) | ECharts canvas heatmap | Phase 15 | DO NOT modify heatmap-grid.tsx (compact dashboard widget) |
| No historical snapshots | Daily cron + snapshot table | Phase 16 | Enables 3M/6M/12M trend views |
| Global risk appetite (undefined) | Per-category appetite configs | Phase 16 | Enables above-appetite badges and KRI band |

---

## Open Questions

1. **Annotation data source for KRI trend dots (D-13)**
   - What we know: Annotations mark "significant events (incidents, control changes)"
   - What's unclear: Should annotations query `incidentsTable` createdAt, or a separate annotation store?
   - Recommendation: Query `incidentsTable` and `controlTestsTable` for events in the selected time range; join by tenantId. No new table needed. Low implementation cost.

2. **Empty state for tenants with 0 snapshots**
   - What we know: Dashboard API returns an empty array for KRI trend if no snapshots exist
   - What's unclear: UI threshold — show "collecting" state after 0 snapshots, or after < 7 days?
   - Recommendation: Show "Collecting trend data — first snapshot in ~{hours} hours" if `snapshots.length === 0`. Show chart if 1+ snapshots exist (even a single point).

3. **OpenAPI spec update for new endpoints**
   - What we know: The project uses Orval to generate typed API clients from `lib/api-spec/openapi.yaml`
   - What's unclear: Whether Phase 16 plan should include OpenAPI spec updates or use `fetch()` directly (as done in Phase 11 for wizard endpoints)
   - Recommendation: Use direct `fetch()` for new Phase 16 endpoints (consistent with Phase 11 precedent for new routes not yet in spec). Add to OpenAPI spec in a follow-up.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | `artifacts/api-server/vitest.config` (inferred from package.json `"test": "vitest"`) |
| Quick run command | `pnpm --filter @workspace/api-server test` |
| Full suite command | `pnpm --filter @workspace/api-server test --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SNAP-01 | `computeCompositeScore` returns 0 for empty risk list | unit | `vitest run src/lib/risk-snapshot-scheduler.test.ts` | ❌ Wave 0 |
| SNAP-02 | `computeCompositeScore` weights critical risks 2x | unit | `vitest run src/lib/risk-snapshot-scheduler.test.ts` | ❌ Wave 0 |
| SNAP-03 | Snapshot job is idempotent (re-run same day → upsert) | unit | `vitest run src/lib/risk-snapshot-scheduler.test.ts` | ❌ Wave 0 |
| API-01 | `GET /v1/risks/appetite` returns 200 with tenant configs | integration/smoke | manual | ❌ Wave 0 |
| API-02 | `PUT /v1/risks/appetite/:category` rejects non-admin | integration/smoke | manual | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @workspace/api-server test --run`
- **Per wave merge:** `pnpm --filter @workspace/api-server test --run && pnpm --filter @workspace/riskmind-app typecheck`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `artifacts/api-server/src/lib/risk-snapshot-scheduler.test.ts` — covers SNAP-01, SNAP-02, SNAP-03
- [ ] Vitest config check: confirm `artifacts/api-server/vitest.config.*` exists or create minimal one

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `lib/db/src/schema/risks.ts` — category enum, likelihood/impact columns, status enum
- Direct file read: `artifacts/api-server/src/lib/signal-feed-poller.ts` — node-cron pattern, per-tenant loop
- Direct file read: `artifacts/api-server/src/routes/risks.ts` — heatmap endpoint, active risk filter
- Direct file read: `artifacts/riskmind-app/src/components/dashboard/risk-heatmap-chart.tsx` — ECharts data format, label formatter, MutationObserver pattern
- Direct file read: `artifacts/riskmind-app/src/components/dashboard/kpi-card.tsx` — recharts sparkline pattern
- Direct file read: `artifacts/api-server/src/index.ts` — scheduler registration pattern
- Direct file read: `artifacts/riskmind-app/package.json` — echarts ^6.0.0, echarts-for-react ^3.0.6, recharts ^2.15.4 installed
- Direct file read: `artifacts/api-server/package.json` — node-cron ^4.2.1 installed
- Direct file read: `lib/db/src/schema/monitoring-configs.ts` — uniqueIndex pattern for new tables
- Direct file read: `artifacts/riskmind-app/src/index.css` — severity CSS variables (--severity-critical, --severity-high, --severity-medium, --severity-low)

### Secondary (MEDIUM confidence)
- ECharts documentation (training data, Aug 2025): `markArea` for chart bands, `type: "time"` xAxis, label formatter Unicode support
- node-cron v4 documentation (training data): cron expression syntax, timezone parameter available

### Tertiary (LOW confidence)
- ECharts `visualMap` interaction with `markArea` behavior — derived from general ECharts conflict knowledge; should be verified against ECharts v6 docs if line color-change above threshold is required

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed from package.json files
- Architecture: HIGH — patterns derived directly from existing working code
- Schema design: HIGH — follows established Drizzle patterns with uniqueIndex
- Composite score formula: MEDIUM — Claude's discretion, formula is reasonable but not sourced from external standard
- ECharts KRI trend config: MEDIUM — label formatter and markArea from training data, verified against Phase 15 patterns
- Pitfalls: HIGH — pitfalls 1-3 derived from code inspection; pitfalls 4-6 from ECharts/Express known behaviors

**Research date:** 2026-03-24
**Valid until:** 2026-04-23 (stable stack — all packages already installed)
