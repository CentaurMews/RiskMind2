---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Core Platform Features
status: Ready to execute
stopped_at: Completed 18-01-PLAN.md
last_updated: "2026-03-24T11:41:45.028Z"
progress:
  total_phases: 10
  completed_phases: 7
  total_plans: 27
  completed_plans: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** A working, demo-ready enterprise risk management platform powered by intelligent AI routing at https://app.riskmind.net
**Current focus:** Phase 18 — comprehensive-demo-seed-data

## Current Position

Phase: 18 (comprehensive-demo-seed-data) — EXECUTING
Plan: 2 of 3

## Performance Metrics

**Velocity (v2.0):**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 9. Schema Foundation | - | - | - |
| 10. Assessment Engine | - | - | - |
| 11. Vendor Lifecycle Redesign | - | - | - |
| 12. Signal Integrations | - | - | - |
| 13. Compliance Flow | - | - | - |
| 14. Foresight v2 | - | - | - |

*Updated after each plan completion*
| Phase 09-schema-foundation P01 | 2 | 2 tasks | 3 files |
| Phase 09-schema-foundation P02 | 117s | 2 tasks | 6 files |
| Phase 09-schema-foundation P03 | 217s | 2 tasks | 4 files |
| Phase 10-assessment-engine P01 | 228 | 2 tasks | 4 files |
| Phase 10-assessment-engine P02 | 720 | 3 tasks | 6 files |
| Phase 10-assessment-engine P03 | 531 | 2 tasks | 7 files |
| Phase 10-assessment-engine P04 | 561 | 3 tasks | 11 files |
| Phase 11-vendor-lifecycle-redesign P01 | 162 | 2 tasks | 2 files |
| Phase 11-vendor-lifecycle-redesign P02 | 283 | 3 tasks | 5 files |
| Phase 11 P03 | 272 | 2 tasks | 3 files |
| Phase 11-vendor-lifecycle-redesign P04 | 239 | 2 tasks | 2 files |
| Phase 11-vendor-lifecycle-redesign P05 | 2 | 2 tasks | 1 files |
| Phase 12-signal-integrations P01 | 405 | 2 tasks | 7 files |
| Phase 12-signal-integrations P02 | 300 | 2 tasks | 4 files |
| Phase 12-signal-integrations P03 | 191 | 2 tasks | 3 files |
| Phase 12-signal-integrations P04 | 100 | 1 tasks | 4 files |
| Phase 12-signal-integrations P05 | 265 | 3 tasks | 3 files |
| Phase 15-migrate-risk-heatmap-from-css-grid-to-apache-echarts P01 | 120 | 2 tasks | 3 files |
| Phase 15-migrate-risk-heatmap-from-css-grid-to-apache-echarts P02 | 300 | 1 tasks | 1 files |
| Phase 16-risk-heatmap-dashboard-redesign P01 | 392 | 3 tasks | 7 files |
| Phase 16-risk-heatmap-dashboard-redesign P02 | 269 | 2 tasks | 4 files |
| Phase 17-parallel-coordinates-risk-explorer P01 | 3508 | 1 tasks | 1 files |
| Phase 17-parallel-coordinates-risk-explorer P02 | 438 | 1 tasks | 1 files |
| Phase 18-comprehensive-demo-seed-data P01 | 434 | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 Architecture]: Assessment Engine built as polymorphic shared service — `context_type` (vendor/compliance/control) designed in Phase 9 schema before any feature code; no `vendor_id NOT NULL` pattern
- [v2.0 Architecture]: Schema Foundation (Phase 9) is pure DDL — no routes, no business logic — applied first to eliminate mid-development migration conflicts across all parallel tracks
- [v2.0 Architecture]: Signal deduplication via `content_hash` SHA256 unique index added in Phase 9 before any polling code is written — prevents unbounded LLM triage costs
- [v2.0 Architecture]: All signal integration credentials stored in `integration_configs` with AES-256-GCM encryption (same pattern as `llm_configs`) — never environment variables
- [v2.0 Architecture]: Microsoft Sentinel integration uses Azure Log Analytics REST API (`api.loganalytics.io/v1`) — SIEM agent retired November 2025
- [v2.0 Architecture]: Monte Carlo runs async via job queue (202 Accepted + poll) — never synchronous in route handler; `setImmediate` chunking or Worker Threads for >50k iterations
- [v2.0 Architecture]: Framework import is additive-only (upsert + `deprecated_at`) — never DELETE + re-insert; wrapped in rollback-capable Drizzle transaction with diff preview
- [v2.0 Scope]: All signal integrations use real API feeds (Sentinel, Shodan, CVE/NVD, MISP, email)
- [v2.0 Scope]: Foresight v2 uses real OSINT data feeds, not simulated
- [v2.0 Scope]: No deadline — build it right
- [Phase 09-schema-foundation]: Polymorphic context_type enum + nullable context_id chosen over separate vendor_id/framework_id columns — enables shared assessment engine across vendor and compliance domains without schema branching
- [Phase 09-schema-foundation]: JSONB questions stored on assessment_templates (not separate rows table) — simplifies template versioning via clone-and-increment pattern
- [Phase 09-schema-foundation]: foresight_simulations.input_parameters snapshots FAIR params at run time — results remain self-contained even if parent scenario is edited
- [Phase 09-schema-foundation]: Signals deduplication uses partial unique index WHERE content_hash IS NOT NULL — allows nullable hash on existing rows while enforcing uniqueness when hash is present
- [Phase 09-schema-foundation]: monitoring-configs reuses vendorTierEnum from vendors.ts rather than defining a new text column — maintains enum consistency across tables
- [Phase 09-schema-foundation]: vendor-subprocessors uses dual FK to same vendorsTable — subprocessors are vendors in the system enabling 4th-party risk tracking without a separate concept
- [Phase 09-schema-foundation]: questionnaires_v2 named with _v2 suffix to avoid conflict with existing questionnaires table — Phase 10 renames after old table drop
- [Phase 09-schema-foundation]: bootstrap.ts guards view creation with table existence check so pnpm push works on first run without failing
- [Phase 09-schema-foundation]: assessment_status is the DB column name (not 'status') — Drizzle uses pgEnum call argument as column name in raw SQL
- [Phase 10-assessment-engine]: text questions normalize to 1.0 (qualitative — no numeric penalty)
- [Phase 10-assessment-engine]: empty sections excluded from overall score average to avoid denominator inflation
- [Phase 10-assessment-engine]: LLMTaskType extended with 'assessment' for per-task model routing on AI follow-up and summary generation
- [Phase 10-assessment-engine]: registerWorker('ai-assess') colocated in assessments.ts route file to keep worker logic near its triggering routes
- [Phase 10-assessment-engine]: [PREBUILT] prefix convention in description field guards pre-built templates from modification/deletion without schema changes
- [Phase 10-assessment-engine]: [PREBUILT] prefix detection used in template library to show Built-in badge and suppress delete — consistent with Plan 02 convention
- [Phase 10-assessment-engine]: All components import shared types from components/assessments/types.ts — single source of truth for frontend types
- [Phase 10-assessment-engine]: types.ts created as shared module for frontend assessment types — mirrors assessment-engine.ts without importing backend, avoids cross-package import issues in Vite
- [Phase 10-assessment-engine]: SectionScoreBar uses CSS transitions instead of recharts BarChart — simpler, more style control
- [Phase 10-assessment-engine]: AI follow-up SSE read via fetch ReadableStream (not EventSource constructor) — POST required, EventSource only supports GET
- [Phase 11-vendor-lifecycle-redesign]: Wizard step inferred from data completeness (assessment + documents existence) — no wizardCompletedAt column added to vendors schema
- [Phase 11-vendor-lifecycle-redesign]: riskScore = 100 - assessment.overall (higher = worse risk) — inverts compliance score to risk score
- [Phase 11-vendor-lifecycle-redesign]: overrideTier respected in risk score hook — tier auto-updated only when no manual override is set
- [Phase 11-vendor-lifecycle-redesign]: aliasedTable (not alias) is the Drizzle 0.45 export for table aliases — alias is absent from the main drizzle-orm index
- [Phase 11-vendor-lifecycle-redesign]: concentration-risk route placed before /:id route pattern to prevent Express path conflict in org-dependencies router
- [Phase 11-vendor-lifecycle-redesign]: scoreThreshold nullable in monitoring_configs — null means no threshold alerting for that tier; vendor-monitor worker skips alert insertion when null
- [Phase 11]: fetch() used directly for wizard API calls since Orval generated client does not yet include wizard endpoints added in Phase 11-01
- [Phase 11]: Step components defined as separate functions in same file for co-location without cross-file coupling in vendor-onboard.tsx
- [Phase 11-vendor-lifecycle-redesign]: ScoreBadge uses e.preventDefault() + e.stopPropagation() to override Link wrapper navigation in kanban cards
- [Phase 11-vendor-lifecycle-redesign]: In Progress badge shown for identification-stage vendors with null riskScore to distinguish wizard stubs from complete vendors
- [Phase 11-vendor-lifecycle-redesign]: Both Organization and Monitoring tabs added to settings.tsx — co-location avoids new route/file, consistent with existing settings pattern
- [Phase 11-vendor-lifecycle-redesign]: Timer icon used for Monitoring tab trigger — ShieldAlert already used for access-denied heading; TierBadge recreated inline in settings.tsx to avoid cross-package import
- [Phase 12-signal-integrations]: adapters registry is a plain mutable Record in types.ts — concrete adapter modules register at import time, no DI framework needed
- [Phase 12-signal-integrations]: trigger endpoint returns graceful response when adapter not yet registered — allows Plans 02-04 to be deployed incrementally
- [Phase 12-signal-integrations]: Domain extraction uses vendor contactEmail — vendors table has no website column; email domain is the available domain signal for Shodan scanning
- [Phase 12-signal-integrations]: Adapter barrel index.ts preferred over direct import in types.ts — avoids circular dependency risk and keeps types.ts as pure interface definitions
- [Phase 12-signal-integrations]: Shodan adapter treats every poll as a full snapshot (since param unused) — Shodan host queries return current state; deduplication handles no-change via content hash
- [Phase 12-signal-integrations]: Sentinel token scope is api.loganalytics.io/.default — required for Log Analytics workspace query, not management.azure.com
- [Phase 12-signal-integrations]: Log Analytics row deserialization: zip columns[].name with rows[][] per table to produce Record<string,unknown>[] at parse time
- [Phase 12-signal-integrations]: MISP IoC summary uses attribute counts (e.g., '3 IP(s)') not raw values — keeps signal content concise for LLM triage
- [Phase 12-signal-integrations]: EmailConfig extended with optional tenantId (injected at poll time, not stored) so complete() can route LLM calls per-tenant without changing SignalFeedAdapter interface
- [Phase 12-signal-integrations]: Email LLM fallback: if complete() throws or returns unparseable JSON, signal still created with subject as title and info severity — never silently drops emails
- [Phase 12-signal-integrations]: IntegrationCard defined inline in settings.tsx for co-location — consistent with existing settings component patterns
- [Phase 12-signal-integrations]: SignalDetailPanel fetches /api/v1/signals/:id on open — metadata not in Orval-generated Signal list response type
- [Phase Phase 15-01]: Position-based severity coloring via itemStyle.color callback (L*I score from indices) — no visualMap
- [Phase Phase 15-01]: MutationObserver on documentElement.class triggers useMemo recompute for CSS variable extraction on dark mode toggle
- [Phase Phase 15-01]: heatmapData format is [impactIndex, likelihoodIndex, count] — x-axis=Impact, y-axis=Likelihood per ECharts convention
- [Phase 15-02]: Manual axis labels and getCellColor removed from risk-heatmap.tsx — ECharts handles axis labels natively via RiskHeatmapChart
- [Phase 15-02]: Mobile severity summary inlined in risk-heatmap.tsx — keeps full-page and compact widget fully independent
- [Phase 16-risk-heatmap-dashboard-redesign]: computeCompositeScore and buildCellCounts exported as pure functions for unit testing without DB dependency
- [Phase 16-risk-heatmap-dashboard-redesign]: Dashboard endpoint returns collecting:true with live-computed values when no snapshot rows exist yet
- [Phase 16-risk-heatmap-dashboard-redesign]: Appetite PUT triggers non-blocking async snapshot recapture via .catch() to avoid blocking HTTP response
- [Phase 16-risk-heatmap-dashboard-redesign]: RiskHeatmapChart backward-compatible — cellDeltas and aboveAppetiteCells are optional props; label font 14→11 with overflow:truncate prevents cell label overflow at 60% width
- [Phase 16-risk-heatmap-dashboard-redesign]: CSS posture bar chosen over ECharts gauge for RiskPostureBar — simpler, responsive, theme-compatible
- [Phase 16-risk-heatmap-dashboard-redesign]: KriTrendPanel annotation markPoints require name field per EChartsOption MarkPointDataItemOption type — added name:a.label
- [Phase 17-parallel-coordinates-risk-explorer]: inactiveOpacity/activeOpacity on parallel series for vivid brush-selected vs near-invisible unselected lines — no custom event handling needed
- [Phase 17-parallel-coordinates-risk-explorer]: riskIdMap array maintained parallel to seriesData rows for O(1) dataIndex -> risk.id lookup on click
- [Phase 17-parallel-coordinates-risk-explorer]: fontWeight must be numeric (600 not '600') for ECharts ZRFontWeight type compatibility
- [Phase 17-parallel-coordinates-risk-explorer]: viewMode state in risk-heatmap.tsx — ephemeral toggle, no URL param needed
- [Phase 17-parallel-coordinates-risk-explorer]: allRisks derived from filteredCells so domain card and above-appetite filters flow to Explorer automatically without extra wiring
- [Phase 18-comprehensive-demo-seed-data]: Modular per-table seed functions with add-if-empty guards (count > N) allow base data + extended data separation in idempotent seeding pattern
- [Phase 18-comprehensive-demo-seed-data]: Akamai CDN Services added as vendor row to satisfy vendorSubprocessors dual-FK constraint — all subprocessors must be full vendor records

### Roadmap Evolution

- Phase 15 added: Migrate Risk Heatmap from CSS Grid to Apache ECharts (GH #83)

### Pending Todos

- Verify `p-ratelimit ^1.2.0` version on npm registry before Phase 12 install
- Measure actual Monte Carlo benchmark (10k iterations) on this codebase before Phase 14 — research estimate is ~200ms, not a measured run
- Audit existing recharts v2.x usage before Phase 14 upgrade to v3.8 — review axis/tooltip prop changes
- Grep all `questionnaires` table consumers before Phase 10 — create compatibility view before migrating source of truth

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260323-hyb | Analyze GitHub issue 83 and update with migration design | 2026-03-23 | pending | [260323-hyb-analyze-github-issue-83-and-update-with-](./quick/260323-hyb-analyze-github-issue-83-and-update-with-/) |

## Session Continuity

Last session: 2026-03-24T11:41:45.020Z
Stopped at: Completed 18-01-PLAN.md
Resume file: None
Next step: `/gsd:plan-phase 9`
