# Phase 14: Foresight v2 - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete Foresight module: Monte Carlo risk simulation engine with FAIR-labeled inputs, loss exceedance curve visualization, named scenario CRUD with clone/compare, OSINT calibration from existing signal data (statistical base + async LLM enhancement), and a dashboard ALE widget. Replaces the teaser page with a fully functional simulation platform.

</domain>

<decisions>
## Implementation Decisions

### Monte Carlo Engine
- **D-01:** Standard 4-input FAIR model: TEF (Threat Event Frequency), Vulnerability (TC×CS), DIFF (Difficulty), Loss Magnitude. Each as min/mode/max triangular distribution.
- **D-02:** Results stored as percentiles (P5/P10/P25/P50/P75/P90/P95/P99) + 20-50 histogram bins in `foresight_simulations.results` JSONB. Compact, sufficient for loss exceedance curve.
- **D-03:** 50k+ iterations use Worker Thread. 10k-49k runs inline with `setImmediate` chunking. Matches prior architecture decision.
- **D-04:** Async via job queue: POST returns 202 Accepted with simulation ID. Worker processes monte-carlo task type. Client polls for completion.

### Simulation UX Flow
- **D-05:** Tab-based Foresight page replacing teaser: Scenarios | Simulations | Calibration tabs.
- **D-06:** Loss exceedance curve uses ECharts (consistent with heatmap and parallel coordinates). Area chart with percentile marker lines, dark mode support.
- **D-07:** Scenario comparison: overlay two loss exceedance curves on same chart with different colors. Parameter diff table below.
- **D-08:** Async status: inline progress indicator on scenario card, auto-poll every 2s. Chart renders automatically when complete. No page navigation needed.
- **D-09:** FAIR input form: min/mode/max sliders per input (triangular distribution). Tooltip shows resulting distribution shape.
- **D-10:** Scenario cloning copies parameters only (name + " (Copy)", description, riskId, parameters). User must re-run simulation.

### OSINT Calibration
- **D-11:** Hybrid approach: statistical aggregation as base (immediate results) + async LLM enhancement (arrives later, enriches suggestions). CVE CVSS → Loss Magnitude, event frequency → TEF, MISP threat levels → Vulnerability.
- **D-12:** All tenant signals feed calibration (full corpus, not risk-linked only). Shows sample size and data freshness badge.
- **D-13:** "Calibrate from real data" button on simulation form. Pre-fills FAIR sliders with OSINT-derived values. Shows "calibrated from real data" badge with freshness indicator.

### Dashboard ALE Widget
- **D-14:** New KPI card in existing dashboard strip: "Top Risks by ALE". Shows top 5 risks with expected annual loss values from completed simulations.
- **D-15:** Empty state: card shows "No simulations yet" + "Run First Simulation" link to /foresight. Encourages feature discovery.

### Claude's Discretion
- Seeded PRNG implementation (seedrandom or simple LCG)
- Exact histogram bin count (20-50 range)
- Calibration confidence scoring
- Distribution shape tooltip design
- Exact slider component (shadcn Slider or custom range)
- Poll interval tuning for simulation status

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Foresight Schema
- `lib/db/src/schema/foresight.ts` — foresight_scenarios + foresight_simulations tables with JSONB columns

### Existing Foresight Code
- `artifacts/api-server/src/routes/foresight.ts` — Stub routes returning 501 (replace with real implementation)
- `artifacts/riskmind-app/src/pages/foresight/foresight.tsx` — Teaser page (replace entirely)

### Job Queue
- `artifacts/api-server/src/lib/job-queue.ts` — registerWorker/enqueueJob pattern for monte-carlo task type

### Signal Data (OSINT source)
- `lib/db/src/schema/signals.ts` — Signal table with metadata JSONB, CVSS scores, threat levels

### Risk Register
- `lib/db/src/schema/risks.ts` — Risk with likelihood/impact (1-5), category, status

### Dashboard
- `artifacts/riskmind-app/src/pages/dashboard.tsx` — KPI strip where ALE widget goes

### Architecture Research
- `.planning/research/FEATURES.md` — Foresight v2 feature definition
- `.planning/research/ARCHITECTURE.md` — Monte Carlo runner architecture notes (200ms/10k iterations, seeded PRNG, Worker Threads threshold)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- ECharts already installed and used (RiskHeatmapChart, RiskParallelChart) — use for loss exceedance curve
- Job queue with registerWorker/enqueueJob — wire monte-carlo task type
- `foresight_scenarios` and `foresight_simulations` tables already exist with correct columns
- Signal data (16+ signals) with CVSS scores, threat levels in metadata JSONB
- 25+ risks with likelihood/impact scores for scenario linking

### Established Patterns
- Async job: 202 Accepted + poll (same as AI triage/enrichment)
- ECharts with dark mode: MutationObserver on documentElement.class
- Tab-based pages: existing pattern in settings.tsx, framework-detail.tsx
- KPI cards on dashboard with skeleton loaders

### Integration Points
- Register "monte-carlo" worker in ai-workers.ts or new foresight-workers.ts
- Dashboard KPI section needs new ALE card
- Foresight routes replace 501 stubs
- Foresight page replaces teaser component
- App.tsx routes may need /foresight/scenarios/:id if using multi-page

</code_context>

<specifics>
## Specific Ideas

- Loss exceedance curve should feel like a professional actuarial tool — clean axis labels, $ formatting for loss amounts
- Scenario comparison overlay should use semi-transparent fills so both curves are visible
- "Calibrate from real data" should feel like magic — one click pre-fills all sliders with smart defaults
- ALE widget on dashboard creates a bridge between daily risk management and quantitative analysis

</specifics>

<deferred>
## Deferred Ideas

- Correlation matrix between risks — future enhancement (Phase 14.2 if needed)
- What-if scenario builder (cascading impact analysis) — future milestone
- Agent intelligence feed inbox — already exists as autonomous agent, not part of Monte Carlo scope

</deferred>

---

*Phase: 14-foresight-v2*
*Context gathered: 2026-03-26*
