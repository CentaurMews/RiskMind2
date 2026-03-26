# Phase 14: foresight-v2 - Research

**Researched:** 2026-03-26
**Domain:** Monte Carlo risk simulation (FAIR model), ECharts visualization, async job queue, OSINT signal calibration
**Confidence:** HIGH — based on full codebase inspection with live benchmarks

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Standard 4-input FAIR model: TEF (Threat Event Frequency), Vulnerability (TC×CS), DIFF (Difficulty), Loss Magnitude. Each as min/mode/max triangular distribution.
- **D-02:** Results stored as percentiles (P5/P10/P25/P50/P75/P90/P95/P99) + 20-50 histogram bins in `foresight_simulations.results` JSONB. Compact, sufficient for loss exceedance curve.
- **D-03:** 50k+ iterations use Worker Thread. 10k-49k runs inline with `setImmediate` chunking. Matches prior architecture decision. *(Note: benchmark shows 100k iterations = 132ms inline — Worker Thread threshold may not be needed at all. See Pitfall 2.)*
- **D-04:** Async via job queue: POST returns 202 Accepted with simulation ID. Worker processes monte-carlo task type. Client polls for completion.
- **D-05:** Tab-based Foresight page replacing teaser: Scenarios | Simulations | Calibration tabs.
- **D-06:** Loss exceedance curve uses ECharts (consistent with heatmap and parallel coordinates). Area chart with percentile marker lines, dark mode support.
- **D-07:** Scenario comparison: overlay two loss exceedance curves on same chart with different colors. Parameter diff table below.
- **D-08:** Async status: inline progress indicator on scenario card, auto-poll every 2s. Chart renders automatically when complete. No page navigation needed.
- **D-09:** FAIR input form: min/mode/max sliders per input (triangular distribution). Tooltip shows resulting distribution shape.
- **D-10:** Scenario cloning copies parameters only (name + " (Copy)", description, riskId, parameters). User must re-run simulation.
- **D-11:** Hybrid calibration: statistical aggregation as base (immediate) + async LLM enhancement (arrives later). CVE CVSS → Loss Magnitude, event frequency → TEF, MISP threat levels → Vulnerability.
- **D-12:** All tenant signals feed calibration (full corpus, not risk-linked only). Shows sample size and data freshness badge.
- **D-13:** "Calibrate from real data" button on simulation form. Pre-fills FAIR sliders with OSINT-derived values. Shows "calibrated from real data" badge with freshness indicator.
- **D-14:** New KPI card in existing dashboard strip: "Top Risks by ALE". Shows top 5 risks with expected annual loss values from completed simulations.
- **D-15:** Empty state: card shows "No simulations yet" + "Run First Simulation" link to /foresight.

### Claude's Discretion

- Seeded PRNG implementation (seedrandom or simple LCG)
- Exact histogram bin count (20-50 range)
- Calibration confidence scoring
- Distribution shape tooltip design
- Exact slider component (shadcn Slider or custom range)
- Poll interval tuning for simulation status

### Deferred Ideas (OUT OF SCOPE)

- Correlation matrix between risks — future enhancement (Phase 14.2 if needed)
- What-if scenario builder (cascading impact analysis) — future milestone
- Agent intelligence feed inbox — already exists as autonomous agent, not part of Monte Carlo scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FRST-01 | User can run Monte Carlo simulations with FAIR-labeled inputs (TEF, TC, CS, DIFF) for 10k-100k iterations, producing ALE and percentile breakdown | Triangular distribution math verified by benchmark; job queue pattern established; foresight schema already deployed |
| FRST-02 | User can view loss exceedance curve visualization with configurable confidence interval markers (50th, 90th, 99th percentile) | ECharts already installed; `line` series with `areaStyle` is the correct chart type; percentile markLines are native ECharts features |
| FRST-03 | User can create, save, clone, and compare named risk scenarios with parameter sets linked to risk register entries | `foresight_scenarios` table exists with `riskId`, `parameters` JSONB; clone = insert with name+" (Copy)"; compare = multi-series ECharts overlay |
| FRST-04 | System suggests simulation parameters from real OSINT data (CVE/NVD frequency, MISP threat data, Shodan exposure) with "calibrated from real data" indicator | `signals` table has `source`, `metadata` (CVSS scores), `createdAt`; statistical aggregation query pattern documented; LLM enhancement adds `foresight` task type |
| FRST-05 | Dashboard shows top-N risks by expected annual loss (ALE) widget integrated with existing KPI section | `KpiCard` component available; dashboard grid has 4-column layout; new endpoint queries `foresight_simulations` joined to `foresight_scenarios` for top ALE values |
</phase_requirements>

---

## Summary

Phase 14 replaces the Foresight teaser page and 501 stub routes with a complete Monte Carlo simulation platform. The schema foundation is already deployed: `foresight_scenarios` and `foresight_simulations` tables exist with the correct columns. The job queue infrastructure, ECharts library, and Radix Slider component are all installed and battle-tested in this codebase.

**Live benchmark results (measured on this machine):**
- 10k iterations: 29ms
- 50k iterations: 115ms
- 100k iterations: 132ms

All iteration counts run comfortably within the 30-second job timeout. The D-03 Worker Thread threshold (50k+) is a safe conservative choice but not strictly required for correctness. The FAIR triangular distribution math is straightforward pure TypeScript — no native dependencies needed.

The main complexity areas are: (1) the ECharts loss exceedance curve requires computing a cumulative distribution from the histogram bins, (2) the OSINT calibration stat aggregation needs careful query design to produce useful FAIR ranges from raw CVSS scores and signal counts, and (3) the OpenAPI spec must be updated for all new foresight routes and Orval regenerated before the frontend can use typed hooks.

**Primary recommendation:** Build in this order — monte-carlo.ts engine → foresight routes → OpenAPI+Orval → Foresight page (tabs) → Dashboard ALE widget. The calibration endpoint can use the same route file.

---

## Standard Stack

### Core (All Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| echarts | ^6.0.0 | Loss exceedance curve + scenario comparison | Already used for heatmap and parallel chart; dark mode pattern established |
| echarts-for-react | ^3.0.6 | React wrapper for ECharts | Same wrapper used throughout; `ReactECharts` + `EChartsOption` types |
| @radix-ui/react-slider | ^1.2.4 | FAIR parameter min/mode/max sliders | Already installed; shadcn `slider.tsx` component exists in `components/ui/` |
| @radix-ui/react-tabs | ^1.1.4 | Scenarios/Simulations/Calibration tab navigation | Already used in settings.tsx with established pattern |

### New Backend Dependency (Optional)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| seedrandom | 3.0.5 | Seeded PRNG for reproducible simulations | Claude's discretion — only needed if scenario replay is a goal; Math.random() is sufficient for production use without reproducibility |

**Version verified:** `npm view seedrandom version` → 3.0.5 (2026-03-26)

### No New Frontend Packages Needed

ECharts, Radix Slider, and Radix Tabs are already installed. The shadcn Slider component (`components/ui/slider.tsx`) already exists.

**Installation (backend only, if seedrandom chosen):**
```bash
pnpm add seedrandom --filter @workspace/api-server
pnpm add -D @types/seedrandom --filter @workspace/api-server
```

---

## Architecture Patterns

### Recommended File Structure

```
artifacts/api-server/src/
├── lib/
│   └── monte-carlo.ts              [NEW] FAIR engine: triangular sampling, percentile aggregation
├── routes/
│   └── foresight.ts                [REPLACE 501 stubs] Full scenario + simulation + calibration routes
│
artifacts/riskmind-app/src/
├── pages/foresight/
│   ├── foresight.tsx               [REPLACE teaser] Tab container: Scenarios | Simulations | Calibration
│   ├── scenario-list.tsx           [NEW] Scenario cards with status indicator + clone/delete actions
│   ├── scenario-form.tsx           [NEW] FAIR parameter form with min/mode/max sliders
│   ├── simulation-detail.tsx       [NEW] Loss exceedance curve + percentile table
│   └── calibration-panel.tsx       [NEW] OSINT calibration results + "Apply to Form" action
├── components/foresight/
│   └── loss-exceedance-chart.tsx   [NEW] ECharts area chart with percentile markLines
└── components/dashboard/
    └── ale-widget.tsx               [NEW] Top-5 ALE KPI card for dashboard
```

### Pattern 1: Monte Carlo Engine (Pure TypeScript)

**What:** Triangular distribution sampler producing ALE values, then aggregating to percentiles + histogram.

**FAIR Math (verified):**
```
ALE per iteration = TEF_sample × Vulnerability_sample × LossMagnitude_sample

Where:
  TEF = Threat Event Frequency (times/year)
  Vulnerability = P(threat succeeds) = Capability / Resistance, bounded [0,1]
  Loss Magnitude = $ cost per event (primary + secondary loss)

Vulnerability is often expressed as P(LoC) = P(TC > DIFF) — this simplifies to a
single vulnerability parameter in the triangular model.
```

**Triangular distribution CDF inverse (exact formula):**
```typescript
// Source: standard triangular distribution inverse CDF
function sampleTriangular(min: number, mode: number, max: number): number {
  const u = Math.random();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}
```

**Percentile extraction from sorted array:**
```typescript
function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

// Results JSONB shape (D-02):
const results = {
  ale: mean,
  percentiles: { p5, p10, p25, p50, p75, p90, p95, p99 },
  histogram: bins, // Array<{ min: number; max: number; count: number }> — 30 bins
  iterations: N,
  durationMs: elapsed,
};
```

**Benchmark (measured on this machine):**
| Iterations | Time |
|------------|------|
| 10k | 29ms |
| 50k | 115ms |
| 100k | 132ms |

All well within the 30-second `JOB_TIMEOUT_MS`. No Worker Thread is needed for correctness, though D-03 permits it.

### Pattern 2: Job Queue Registration (Existing Pattern)

**What:** Register "monte-carlo" worker in `ai-workers.ts` (or new `foresight-workers.ts`).

```typescript
// Source: artifacts/api-server/src/lib/ai-workers.ts — registerWorker pattern
registerWorker("monte-carlo", async (job) => {
  const { simulationId } = job.payload as { simulationId: string };

  // 1. Load simulation + scenario from DB
  // 2. Update status → "running"
  // 3. Run Monte Carlo engine
  // 4. Update status → "completed", write results JSONB
  // 5. Return { status: "completed", ale, durationMs }
});
```

**Route pattern (202 Accepted):**
```typescript
// POST /api/v1/foresight/simulations
router.post("/v1/foresight/simulations", requireAuth, async (req, res) => {
  const { scenarioId, iterationCount = 50000 } = req.body;
  // validate scenario belongs to tenant...
  const [sim] = await db.insert(foresightSimulationsTable).values({
    tenantId, scenarioId, iterationCount,
    status: "pending",
    inputParameters: scenario.parameters,
  }).returning();
  await enqueueJob("monte-carlo", "run", { simulationId: sim.id }, tenantId);
  res.status(202).json({ id: sim.id, status: "pending" });
});
```

### Pattern 3: ECharts Loss Exceedance Curve

**What:** Line + area chart where X-axis = loss amount ($), Y-axis = probability of exceedance (1 - CDF).

**Computed from histogram bins:**
```typescript
// Convert histogram bins to exceedance curve points
// Exceedance(x) = P(loss > x) = 1 - CDF(x)
// CDF built by cumulative sum of bin counts / total

function buildExceedanceCurve(
  histogram: Array<{ min: number; max: number; count: number }>,
  total: number
): Array<[number, number]> {
  let cumulative = 0;
  const points: Array<[number, number]> = [];
  for (const bin of histogram) {
    points.push([bin.min, 1 - cumulative / total]);
    cumulative += bin.count;
  }
  points.push([histogram[histogram.length - 1].max, 0]);
  return points;
}
```

**ECharts option skeleton (dark mode pattern from existing charts):**
```typescript
// Source: components/dashboard/risk-heatmap-chart.tsx — MutationObserver + useMemo pattern
const option: EChartsOption = {
  tooltip: { trigger: "axis", formatter: (p) => `$${formatUSD(p[0].value[0])}: ${(p[0].value[1] * 100).toFixed(1)}% chance` },
  xAxis: {
    type: "value",
    name: "Annual Loss ($)",
    axisLabel: { formatter: (v: number) => formatUSD(v), color: colors.mutedForeground },
    axisLine: { show: false },
  },
  yAxis: {
    type: "value",
    name: "Prob. of Exceedance",
    min: 0, max: 1,
    axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%`, color: colors.mutedForeground },
  },
  series: [{
    type: "line",
    data: exceedanceCurve,
    smooth: true,
    areaStyle: { opacity: 0.2 },
    lineStyle: { width: 2 },
    // Percentile markLines:
    markLine: {
      silent: true,
      data: [
        { xAxis: p50, label: { formatter: "P50" } },
        { xAxis: p90, label: { formatter: "P90" } },
        { xAxis: p99, label: { formatter: "P99" } },
      ],
    },
  }],
};
```

**Scenario comparison (D-07):** Two `series` entries with different colors + `areaStyle.opacity: 0.15`. ECharts handles multi-series overlap natively.

### Pattern 4: OSINT Calibration Query

**What:** Statistical aggregation of signals table to produce FAIR parameter suggestions.

**Signal→FAIR mapping (D-11):**

| Signal Source | Field | FAIR Parameter | Logic |
|--------------|-------|----------------|-------|
| nvd | metadata.cvssScore (0-10) | Loss Magnitude | CVSS 7-10 → high loss, scale to $ range |
| nvd, misp | count per 30/90 days | TEF (min/mode/max) | event frequency → annual rate |
| misp | metadata.threatLevel | Vulnerability | 1=High→0.7, 2=Med→0.4, 3=Low→0.2 |
| shodan | metadata.openPorts count | Vulnerability | more exposed ports → higher vuln |

**Calibration query pattern:**
```typescript
// Statistical base — no LLM required
const signals = await db.select({
  source: signalsTable.source,
  metadata: signalsTable.metadata,
  createdAt: signalsTable.createdAt,
}).from(signalsTable)
  .where(and(
    eq(signalsTable.tenantId, tenantId),
    gte(signalsTable.createdAt, subDays(new Date(), 90)),
  ));

// Aggregate by source for FAIR inputs
const cvssScores = signals
  .filter(s => s.source === "nvd" && s.metadata?.cvssScore)
  .map(s => s.metadata.cvssScore as number);

const tef = {
  min: Math.round(signals.length / 12),      // monthly events * 12 / 12
  mode: Math.round(signals.length / 3),       // quarterly events scaled to annual
  max: Math.round(signals.length * 1.5),      // optimistic upper bound
};
```

### Pattern 5: Dashboard ALE Widget

**What:** New card in the existing 4-column KPI grid on `dashboard.tsx`.

**Query:** New endpoint `GET /api/v1/foresight/scenarios/top-ale` returns top-5 scenarios by ALE (from `results->>'ale'` in completed simulations).

**Component:** Custom Card (not KpiCard — needs list format, not single value).

```typescript
// Empty state matching D-15
<Card>
  <CardHeader><CardTitle>Top Risks by ALE</CardTitle></CardHeader>
  <CardContent>
    {isEmpty ? (
      <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg border-dashed">
        No simulations yet.{" "}
        <Link href="/foresight" className="text-primary">Run First Simulation</Link>
      </div>
    ) : (
      <ol className="space-y-2">
        {topAle.map((item, i) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>{i + 1}. {item.scenarioName}</span>
            <span className="font-mono text-muted-foreground">{formatUSD(item.ale)}/yr</span>
          </li>
        ))}
      </ol>
    )}
  </CardContent>
</Card>
```

### Anti-Patterns to Avoid

- **Running simulation synchronously in route handler:** Returns 202 immediately, never block. (Established pattern from ai-triage/ai-enrich.)
- **Calling `/calibrate` during a simulation run:** Calibration is a separate UI action (D-13 "Calibrate from real data" button), not an automatic step in every simulation.
- **Using a `visualMap` for the loss exceedance curve:** Use `itemStyle.color` callback or fixed series colors. The parallel chart and heatmap both avoid `visualMap`.
- **Hardcoding LLM call in the monte-carlo job worker:** The worker is pure computation — any LLM enhancement for calibration should be a separate "foresight-calibrate" job type registered independently.
- **Adding `foresight` to `LLMTaskType` without a route:** If LLM calibration enhancement is added, it needs a registered worker and the `LLMTaskType` union extended in `llm-service.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Triangular distribution sampling | Custom PRNG math | Standard CDF inverse formula (5 lines, see Pattern 1) | The inverse CDF formula is exact and standard; no library needed |
| Seeded PRNG | LCG implementation | `seedrandom` (3.0.5, already available in npm) | seedrandom is battle-tested, handles edge cases, multiple algorithms |
| Area chart | Custom SVG | ECharts `line` series with `areaStyle` | Already installed; `areaStyle: { opacity: 0.2 }` is one property |
| Percentile computation | Sort + index formula | Sort array once, index with `Math.floor(p * n)` | No library needed; the math is 2 lines |
| Slider component | Custom `<input type="range">` | `components/ui/slider.tsx` (Radix, already installed) | Already exists; supports min/max/step/value props |
| Tabs | Custom state + CSS | `components/ui/tabs.tsx` (Radix, already used in settings) | Pattern established in settings.tsx |
| Dark mode detection | Window.matchMedia | MutationObserver on `documentElement.class` | Established pattern in `risk-heatmap-chart.tsx` and `risk-parallel-chart.tsx` |
| USD formatting | Custom formatter | `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact" })` | Browser API, no library needed |

**Key insight:** Monte Carlo simulation at this scale (100k iterations) is pure arithmetic. The value is in the FAIR model design and the visualization — not in the simulation engine complexity.

---

## Common Pitfalls

### Pitfall 1: Job Timeout vs Iteration Count

**What goes wrong:** D-03 specifies Worker Thread for 50k+ iterations, but the job queue has `JOB_TIMEOUT_MS = 30_000`. A 50k iteration sim takes ~115ms inline — far within the timeout. Worker Threads add complexity without benefit at this scale.

**Why it happens:** The prior architecture note estimated 200ms/10k iterations. Live benchmark shows 29ms/10k (7x faster than estimated). The threshold was set conservatively.

**How to avoid:** Run all simulations inline within the job worker handler. The 30s timeout provides a 250x safety margin at 100k iterations. Add a guard: `if (iterationCount > 500_000) throw new Error("iterationCount exceeds 500k limit")`.

**Warning signs:** If a simulation job times out, the status stays "running" forever. Add a DB-level fallback: a cron or scheduler that marks stale "running" simulations as "failed" after 2 minutes.

### Pitfall 2: Triangular Distribution Edge Cases

**What goes wrong:** `sampleTriangular(min, mode, max)` throws or produces NaN if `min === max` or `min === mode === max` (degenerate distribution).

**Why it happens:** CVSS score could produce `min=7, mode=7, max=7` from a narrow dataset.

**How to avoid:** Validate and expand: `if (min === max) { min = max * 0.9; max = max * 1.1; }`. If `mode < min` or `mode > max`, clamp to `(min + max) / 2`.

### Pitfall 3: Loss Exceedance Curve from Histogram (Not Raw Array)

**What goes wrong:** Building the exceedance curve from the sorted raw simulation array (50k values) instead of the stored histogram bins.

**Why it happens:** The raw array is not stored — only the histogram is (per D-02). The frontend receives the histogram JSONB.

**How to avoid:** The curve must be reconstructed from histogram bins server-side or client-side. The Pattern 3 code above shows the correct bin-to-exceedance-point transformation. Store histogram bins as `{ min, max, count }` objects, not just counts.

### Pitfall 4: OpenAPI Spec Not Updated Before Orval

**What goes wrong:** Frontend uses `fetch()` directly instead of Orval-generated hooks because the hooks don't exist yet.

**Why it happens:** The existing foresight OpenAPI spec only has 3 stub routes (`listSimulations`, `createSimulation`, `getSimulation`). Scenarios CRUD, calibration endpoint, and top-ALE endpoint are missing.

**How to avoid:** The OpenAPI spec must be updated with full request/response schemas for all new routes before running `orval` to regenerate `lib/api-client-react/`. This is a mandatory step before frontend work. Current stubs to replace/extend:
```
GET  /v1/foresight/scenarios         [ADD]
POST /v1/foresight/scenarios         [ADD]
GET  /v1/foresight/scenarios/:id     [ADD]
PATCH /v1/foresight/scenarios/:id    [ADD]
DELETE /v1/foresight/scenarios/:id   [ADD]
POST /v1/foresight/scenarios/:id/clone [ADD]
POST /v1/foresight/simulations       [UPDATE — add request body schema]
GET  /v1/foresight/simulations/:id   [UPDATE — add response schema]
GET  /v1/foresight/scenarios/top-ale [ADD]
POST /v1/foresight/calibrate         [ADD]
```

### Pitfall 5: Calibration with Empty Signal Corpus

**What goes wrong:** If a tenant has no NVD/MISP signals yet, the calibration endpoint returns zeros or NaN, which pre-fills sliders with invalid values.

**Why it happens:** Statistical aggregation on empty arrays.

**How to avoid:** Return `null` for each parameter range when `sampleSize === 0`. The UI shows "Insufficient data (0 signals in last 90 days)" instead of attempting to pre-fill. Default fallback values (e.g., TEF min=1, mode=5, max=20) should be defined in constants for first-time users.

### Pitfall 6: ALE Widget Query Performance

**What goes wrong:** The top-ALE dashboard endpoint scans all `foresight_simulations` rows without filtering on `status = 'completed'`, or does a `results->>'ale'` cast without a supporting index.

**Why it happens:** JSONB field queries without indexes are full table scans.

**How to avoid:** Filter: `WHERE simulation_status = 'completed' AND results IS NOT NULL`. If the table grows large, add `CREATE INDEX ON foresight_simulations ((results->>'ale')::numeric DESC)` — but for MVP with <1000 simulations, the query will be fast without it.

---

## Code Examples

### Monte Carlo Engine (monte-carlo.ts)

```typescript
// Source: verified against triangular distribution CDF inverse formula
// Benchmark: 100k iterations = 132ms on this machine

export interface FAIRParams {
  tef: { min: number; mode: number; max: number };      // Threat Event Frequency (events/year)
  vulnerability: { min: number; mode: number; max: number }; // P(loss of control) [0,1]
  lossMagnitude: { min: number; mode: number; max: number }; // $ loss per event
}

export interface SimulationResults {
  ale: number;
  percentiles: Record<string, number>;  // p5, p10, p25, p50, p75, p90, p95, p99
  histogram: Array<{ min: number; max: number; count: number }>;
  iterations: number;
  durationMs: number;
}

function sampleTriangular(min: number, mode: number, max: number): number {
  // Guard against degenerate distributions
  if (min >= max) {
    min = max * 0.9;
    max = max * 1.1 || 1;
  }
  const safeMode = Math.min(max, Math.max(min, mode));
  const u = Math.random();
  const fc = (safeMode - min) / (max - min);
  if (u < fc) return min + Math.sqrt(u * (max - min) * (safeMode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - safeMode));
}

export function runSimulation(params: FAIRParams, iterations: number): SimulationResults {
  const start = Date.now();
  const losses: number[] = new Array(iterations);

  for (let i = 0; i < iterations; i++) {
    const tef = sampleTriangular(params.tef.min, params.tef.mode, params.tef.max);
    const vuln = Math.min(1, Math.max(0, sampleTriangular(
      params.vulnerability.min, params.vulnerability.mode, params.vulnerability.max
    )));
    const lm = sampleTriangular(params.lossMagnitude.min, params.lossMagnitude.mode, params.lossMagnitude.max);
    losses[i] = tef * vuln * lm;
  }

  losses.sort((a, b) => a - b);
  const ale = losses.reduce((s, v) => s + v, 0) / iterations;

  // Percentiles
  const pctAt = (p: number) => losses[Math.min(losses.length - 1, Math.floor(p * losses.length))];
  const percentiles = { p5: pctAt(0.05), p10: pctAt(0.1), p25: pctAt(0.25), p50: pctAt(0.5),
                        p75: pctAt(0.75), p90: pctAt(0.9), p95: pctAt(0.95), p99: pctAt(0.99) };

  // 30-bin histogram
  const minL = losses[0], maxL = losses[losses.length - 1];
  const binCount = 30;
  const binWidth = (maxL - minL) / binCount || 1;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    min: minL + i * binWidth,
    max: minL + (i + 1) * binWidth,
    count: 0,
  }));
  for (const v of losses) {
    const idx = Math.min(binCount - 1, Math.floor((v - minL) / binWidth));
    bins[idx].count++;
  }

  return { ale, percentiles, histogram: bins, iterations, durationMs: Date.now() - start };
}
```

### ECharts Dark Mode Pattern (from existing charts)

```typescript
// Source: components/dashboard/risk-heatmap-chart.tsx — verified pattern
// Use this exact pattern for LossExceedanceChart

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

const colors = useMemo(() => {
  void themeVersion; // dependency for re-run on theme change
  return getThemeColors();
}, [themeVersion]);
```

### Tab Page Pattern (from settings.tsx)

```typescript
// Source: pages/settings/settings.tsx — established pattern
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs defaultValue="scenarios" className="w-full">
  <TabsList className="bg-muted/50 p-1 w-full justify-start h-12 rounded-lg">
    <TabsTrigger value="scenarios" className="data-[state=active]:shadow-sm rounded-md">
      Scenarios
    </TabsTrigger>
    <TabsTrigger value="simulations" className="data-[state=active]:shadow-sm rounded-md">
      Simulations
    </TabsTrigger>
    <TabsTrigger value="calibration" className="data-[state=active]:shadow-sm rounded-md">
      Calibration
    </TabsTrigger>
  </TabsList>
  <TabsContent value="scenarios">...</TabsContent>
  <TabsContent value="simulations">...</TabsContent>
  <TabsContent value="calibration">...</TabsContent>
</Tabs>
```

### Job Worker Registration Pattern

```typescript
// Source: artifacts/api-server/src/lib/ai-workers.ts — established registerWorker pattern
// Register in registerAIWorkers() or a new registerForesightWorkers() called from index.ts

registerWorker("monte-carlo", async (job) => {
  const { simulationId } = job.payload as { simulationId: string };

  const [sim] = await db.select({
    id: foresightSimulationsTable.id,
    iterationCount: foresightSimulationsTable.iterationCount,
    inputParameters: foresightSimulationsTable.inputParameters,
    scenarioId: foresightSimulationsTable.scenarioId,
  }).from(foresightSimulationsTable)
    .where(eq(foresightSimulationsTable.id, simulationId))
    .limit(1);

  if (!sim) return { status: "not_found" };

  await db.update(foresightSimulationsTable)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(foresightSimulationsTable.id, simulationId));

  const params = sim.inputParameters as FAIRParams;
  const results = runSimulation(params, sim.iterationCount);

  await db.update(foresightSimulationsTable).set({
    status: "completed",
    results: results as unknown as Record<string, unknown>,
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(foresightSimulationsTable.id, simulationId));

  return { status: "completed", ale: results.ale, durationMs: results.durationMs };
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Loss exceedance curve via recharts | ECharts area chart | Phase 14 (now) | ECharts already installed and used; recharts still in KPI sparklines |
| Foresight returning 501 | Full implementation | Phase 14 (now) | Replaces 3 stub routes + 2 legacy stub routes (risk-graph, trust-circles can stay 501) |
| Manual FAIR parameter entry only | Hybrid: manual + OSINT calibration | Phase 14 (now) | "Calibrate from real data" button provides one-click intelligence |

**Deprecated/outdated in this phase:**
- The legacy stub routes `/v1/foresight/risk-graph` and `/v1/foresight/trust-circles` in the current `foresight.ts` are deferred concepts — leave as 501, do not implement.

---

## Open Questions

1. **Worker Thread for D-03**
   - What we know: Benchmark shows 100k iterations = 132ms inline, well within 30s job timeout
   - What's unclear: D-03 says "50k+ uses Worker Thread" — this was a precautionary decision made before benchmarking
   - Recommendation: Skip Worker Thread for Phase 14. All counts run inline in the job worker. Add iteration cap at 100k. Revisit only if a future scenario type (correlation matrices, multi-risk portfolio) changes the performance profile.

2. **LLM calibration enhancement timing**
   - What we know: D-11 calls for async LLM enhancement arriving "later" after statistical base
   - What's unclear: Does the LLM enhancement require a second job type ("foresight-calibrate") with its own worker, or is it a synchronous LLM call within the calibration route?
   - Recommendation: Synchronous LLM call in the calibration route using `complete()` with `"general"` task type. No second job needed. The calibration endpoint can take 2-5s (user expects it, it's a button action not a page load). This avoids adding another registered worker.

3. **`foresight_scenarios.parameters` schema**
   - What we know: Column is `jsonb` with `default({})`. The FAIR params shape needs definition.
   - What's unclear: Whether `parameters` stores only FAIR inputs or also `calibratedFrom` metadata.
   - Recommendation: `parameters` stores `{ tef, vulnerability, lossMagnitude }` (FAIRParams shape). `calibratedFrom` (already a text column on the table) stores the calibration source label ("osint-90d", "manual", etc.).

---

## Environment Availability

Step 2.6: SKIPPED for simulation engine and frontend work — no external dependencies beyond what's already installed.

**Backend worker thread check (relevant for D-03):**

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js worker_threads | D-03 (50k+ iterations) | Built-in | Node 18+ (built-in) | Not needed — 100k inline = 132ms |
| seedrandom (npm) | Seeded PRNG (discretion) | Available (3.0.5) | 3.0.5 | Use Math.random() — sufficient for production |
| echarts | Loss exceedance chart | Installed (^6.0.0) | 6.0.0 | — |
| @radix-ui/react-slider | FAIR sliders | Installed (^1.2.4) | 1.2.4 | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | `artifacts/api-server/vitest.config.ts` |
| Quick run command | `pnpm --filter @workspace/api-server test --run` |
| Full suite command | `pnpm --filter @workspace/api-server test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FRST-01 | `runSimulation()` produces correct ALE and percentiles | unit | `pnpm --filter @workspace/api-server test --run tests/monte-carlo.test.ts` | ❌ Wave 0 |
| FRST-01 | Triangular sampler handles degenerate distributions (min=max) | unit | same | ❌ Wave 0 |
| FRST-01 | Results JSONB shape matches schema (percentiles + histogram + ale) | unit | same | ❌ Wave 0 |
| FRST-02 | Histogram bins produce valid exceedance curve (monotone decreasing) | unit | same | ❌ Wave 0 |
| FRST-03 | Scenario clone produces correct name suffix and copies parameters | unit | `pnpm --filter @workspace/api-server test --run tests/foresight-routes.test.ts` | ❌ Wave 0 |
| FRST-04 | Calibration with empty signal corpus returns null ranges (not NaN) | unit | same | ❌ Wave 0 |
| FRST-04 | CVSS→LossMagnitude mapping produces expected range for CVSS=9.0 | unit | same | ❌ Wave 0 |
| FRST-05 | Top-ALE query returns at most 5 items sorted descending | unit | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @workspace/api-server test --run`
- **Per wave merge:** `pnpm --filter @workspace/api-server test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `artifacts/api-server/tests/monte-carlo.test.ts` — covers FRST-01, FRST-02
- [ ] `artifacts/api-server/tests/foresight-routes.test.ts` — covers FRST-03, FRST-04, FRST-05 (unit tests for pure functions; route integration tests use fetch-mock or vi.mock)

---

## Sources

### Primary (HIGH confidence)

- Full codebase inspection: `artifacts/api-server/src/lib/`, `lib/db/src/schema/foresight.ts`, `components/dashboard/risk-heatmap-chart.tsx` — direct code read
- Live benchmark: node -e triangular sampling at 10k/50k/100k iterations — measured on this machine (2026-03-26)
- `artifacts/api-server/src/lib/job-queue.ts` — JOB_TIMEOUT_MS = 30,000ms confirmed
- `artifacts/riskmind-app/package.json` — echarts ^6.0.0, echarts-for-react ^3.0.6, @radix-ui/react-slider ^1.2.4 confirmed installed
- `components/ui/slider.tsx` — shadcn Slider component confirmed present
- `artifacts/api-server/vitest.config.ts` — test framework and paths confirmed
- FAIR Institute methodology — triangular distribution inverse CDF is the standard FAIR implementation

### Secondary (MEDIUM confidence)

- `npm view seedrandom version` → 3.0.5 (verified 2026-03-26)
- FAIR model math: triangular distribution CDF inverse is well-documented in actuarial and risk quantification literature
- ECharts `line` series with `areaStyle` for exceedance curves: consistent with ECharts documentation patterns

### Tertiary (LOW confidence)

- OSINT calibration parameter mapping (CVSS → Loss Magnitude, signal frequency → TEF): based on FAIR methodology interpretation; specific scaling factors are Claude's discretion per D-11

---

## Metadata

**Confidence breakdown:**
- Monte Carlo engine: HIGH — benchmarked live, formula verified, all dependencies confirmed installed
- ECharts loss exceedance curve: HIGH — pattern directly derived from existing `RiskHeatmapChart` in codebase
- Job queue integration: HIGH — pattern directly from `ai-workers.ts` registerWorker
- OSINT calibration: MEDIUM — stat aggregation pattern is sound; FAIR parameter scaling is interpretive
- Dashboard ALE widget: HIGH — KpiCard and dashboard grid patterns confirmed from existing code

**Research date:** 2026-03-26
**Valid until:** 2026-05-26 (stable dependencies; ECharts API unlikely to change at patch level)
