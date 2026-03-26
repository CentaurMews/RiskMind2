# Milestones

## v2.0 Core Platform Features (Shipped: 2026-03-26)

**Phases completed:** 6 phases, 26 plans, 44 tasks

**Key accomplishments:**

- Three new Drizzle schema files providing DDL for assessment engine (polymorphic context_type), signal integration configs (AES-256-GCM encrypted_config), and foresight Monte Carlo tables (JSONB FAIR parameters + percentile results)
- vendor_subprocessors
- Drizzle barrel exports, 8 relation objects, questionnaires_v2 compatibility view, and all v2.0 schema applied to PostgreSQL via drizzle-kit push
- RED phase:
- Commits:
- One-liner:
- One-liner:
- One-liner:
- Subprocessor CRUD, org dependency CRUD with concentration risk, and monitoring config CRUD with vendor-monitor job worker that performs idempotent assessments and threshold breach alerting
- One-liner:
- One-liner:
- Settings page extended with Organization tab (concentration risk alert + per-category infrastructure dependency form with vendor linking) and admin-only Monitoring tab (per-tier cadence days, score threshold 0-100, assessment template picker backed by /v1/monitoring-configs API)
- Integration config CRUD with AES-256-GCM credential encryption, adapter interface for 5 threat feed sources, and node-cron scheduler polling all active integrations on per-source schedules
- NVD CVE v2 adapter with 2000/page pagination + Shodan adapter with DNS-resolve-first, both using p-ratelimit and content-hash deduplication, registered in shared adapter registry
- Sentinel adapter uses ClientSecretCredential OAuth2 + KQL against SecurityIncident table; MISP adapter uses Bearer token REST API with Unix timestamp incremental sync and IoC attribute grouping by type
- `artifacts/api-server/src/adapters/email.ts`
- Settings Integrations tab with 5 encrypted-credential config cards, SourceBadge icon badges on signal list, and signal detail Sheet with per-source structured metadata (CVSS, ports/services, incident severity, IoC attributes, email entities)
- Vitest RED-phase scaffolds for compliance-import (CSV/JSON parsing + diff) and compliance-pipeline (scoring formula + threshold-driven findings) with 20 test cases defining the behavioral contract
- compliance-import.ts:
- ~10 new compliance REST endpoints wired to compliance-import/pipeline libraries, plus assessment submit hook with D-10 section-to-control test creation
- Framework import sheet with diff preview, create dialog, inline threshold editor, and compliance status badges on list and detail pages.
- One-liner:
- monte-carlo.ts
- Tab-based Foresight page with FAIR triangular-distribution scenario builder, auto-polling simulation status, and ECharts loss exceedance curve with P50/P90/P99 percentile markers.
- OSINT calibration panel with sample-size/freshness badge and one-click FAIR pre-fill, plus two-scenario comparison with overlaid loss exceedance curves and parameter delta table
- ALE dashboard widget with top-5 scenario rankings, USD compact formatting, and empty state linking to Foresight — deployed via PM2

---

## v1.0 — Demo-Ready Deployment (2026-03-18)

**Goal:** Deploy RiskMind to a dedicated server, expose via Cloudflare tunnel, polish UI for demo readiness, surface AI features.

**Phases:** 4 (all complete)

- Phase 1: Server Foundation (5 plans)
- Phase 2: Public Access & Security (3 plans)
- Phase 3: Dashboard Polish & Demo Readiness (4 plans)
- Phase 4: AI Differentiators Surfaced (2 plans)

**Delivered:** 14 plans, 35 requirements

- Server deployment with PM2 at https://app.riskmind.net
- Dashboard with KPI trends, heatmap, KRI bars, executive summary, alert bell
- ⌘K command palette with semantic search (pgvector)
- All list pages with skeleton loaders, empty states, pagination, RBAC
- Vendor kanban pipeline + scorecard
- AI enrichment badges, treatment provenance, signal traceability
- CSV export, breadcrumbs, toast errors

**Last phase number:** 4

## v1.1 — LLM Intelligence + Fixes + Polish (2026-03-18)

**Goal:** Intelligent LLM configuration with wizard-based onboarding, model auto-discovery, benchmarking, per-task routing, bug fixes, and Foresight teaser.

**Phases:** 3 (all complete)

- Phase 5: LLM Intelligence Backend (3 plans)
- Phase 6: Bug Fixes and Wizard UI (2 plans)
- Phase 7: Foresight Teaser (1 plan)

**Delivered:** 6 plans, 18 requirements

- LLM Config Wizard (6-step, 7 providers, model auto-discovery, benchmark)
- Intelligent per-task model routing (6 task types)
- 7 bug fixes (doc processor, enrichment idempotency, vendor errors, scorecard data, embeddings warning, model validation)
- Foresight teaser page (4-card preview)

**Last phase number:** 7

## v1.2 — Quick Fixes & Mobile Polish (2026-03-23)

**Goal:** Login UX improvements, dashboard interactivity, mobile responsiveness, and Replit artifact cleanup.

**Phases:** 1 (complete)

- Phase 8: Quick Fixes & Polish (2 plans)

**Delivered:** 2 plans, 7 requirements

- 2-field login with email domain slug detection
- Social login button placeholders (Microsoft, Google)
- Clickable KPI cards navigating to list pages
- Mobile responsive heatmap, scroll shadows, 44px touch targets
- Real tenant name in header (removed Replit UUID)

**Last phase number:** 8
