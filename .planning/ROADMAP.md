# Roadmap: RiskMind

## Milestones

- ✅ **v1.0 Demo-Ready Deployment** - Phases 1-4 (shipped 2026-03-18)
- ✅ **v1.1 LLM Intelligence + Fixes + Polish** - Phases 5-7 (shipped 2026-03-18)
- ✅ **v1.2 Quick Fixes & Mobile Polish** - Phase 8 (shipped 2026-03-23)
- 🚧 **v2.0 Core Platform Features** - Phases 9-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 Demo-Ready Deployment (Phases 1-4) - SHIPPED 2026-03-18</summary>

### Phase 1: Server Foundation
**Goal**: The app runs cleanly on the dedicated server — dependencies stripped, database provisioned with seed data, Express serving both API and SPA on port 4000, PM2 managing the process
**Depends on**: Nothing (first phase)
**Requirements**: DEPL-01, DEPL-02, DEPL-03, DEPL-04, DEPL-05, DB-01, DB-02, DB-03, DB-04
**Success Criteria** (what must be TRUE):
  1. `pnpm install` and full workspace build complete with no Replit packages present
  2. PostgreSQL database exists with pgvector extension installed, migrations applied, and seed data loaded
  3. Express API returns 200 on `/api/v1/health` and serves the React SPA from port 4000
  4. Demo login with seeded credentials works and loads the dashboard
  5. PM2 shows the process as online; `pm2 startup` survives a reboot
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Strip Replit dependencies from all manifests and vite.config.ts
- [x] 01-02-PLAN.md — Env validation, rich seed integration, .env setup
- [x] 01-03-PLAN.md — Database provisioning (pgvector, drizzle push, manual migration)
- [x] 01-04-PLAN.md — Build workspace packages and wire Express static serving + SPA fallback
- [x] 01-05-PLAN.md — PM2 config, log rotation, boot persistence, end-to-end verification

### Phase 2: Public Access and Security
**Goal**: The app is accessible via a stable, named Cloudflare tunnel URL with CORS locked to that origin and SSE streaming working end-to-end
**Depends on**: Phase 1
**Requirements**: NET-01, NET-02, NET-03, NET-04, NET-05
**Success Criteria** (what must be TRUE):
  1. App loads in a browser at the Cloudflare tunnel public URL without errors
  2. Login, navigation, and data loading all work correctly from the public URL
  3. AI interview SSE stream arrives token-by-token (not buffered until completion)
  4. CORS rejects cross-origin requests from unauthorized origins
  5. cloudflared runs as a systemd service and survives a reboot
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Lock CORS to explicit origin whitelist and add SSE res.flushHeaders()
- [x] 02-02-PLAN.md — Create Cloudflare tunnel in dashboard and install as cloudflared-riskmind systemd service
- [x] 02-03-PLAN.md — End-to-end smoke tests and human browser verification at public URL

### Phase 3: Dashboard Polish and Demo Readiness
**Goal**: The dashboard and all list views look professional — consistent card design, populated with seed data, RBAC-correct, with empty/loading/error states everywhere
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, VEND-01, VEND-02, COMP-01, EXP-01
**Success Criteria** (what must be TRUE):
  1. Dashboard shows KPI cards with trends, risk heatmap with clickable drill-down, executive summary, KRI threshold indicators, and alert badge — all populated with seed data
  2. Every list view has pagination, search, and filter controls; every empty list shows a friendly empty state with a CTA
  3. All pages show skeleton loaders while fetching and toast notifications on error — no blank boxes or raw error text anywhere
  4. Vendor scorecard shows score, tier, assessment date, and open findings; vendor pipeline shows lifecycle stages visually
  5. Compliance posture percentage displays per framework; admin-only controls are hidden from viewer/auditor roles
  6. ⌘K command palette provides semantic search across risks, vendors, frameworks, and signals via pgvector
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Backend API gaps: GET /v1/kris tenant-wide endpoint and POST /v1/search semantic search
- [x] 03-02-PLAN.md — Dashboard widgets: KPI skeletons + delta badges, HeatmapGrid, executive summary, KRI widget, alert bell
- [x] 03-03-PLAN.md — List page polish: skeleton rows, empty states, pagination, CSV export, RBAC gates, vendor kanban
- [x] 03-04-PLAN.md — Command palette (⌘K), risk sparklines, compliance posture display

### Phase 4: AI Differentiators Surfaced
**Goal**: RiskMind's AI-native identity is visible — enrichment badges with provenance on risk detail, polished treatment suggestions, and signal-to-finding-to-risk traceability chain with AI decision transparency
**Depends on**: Phase 3
**Requirements**: AI-01, AI-02, AI-04
**Success Criteria** (what must be TRUE):
  1. Risk detail page shows "AI Enhanced" badge, parsed enrichment section with provenance (model, date, tokens), separate from raw description
  2. AI-generated treatment suggestions display polished on risk detail with confidence and rationale
  3. Signal detail links to derived finding, finding links to resulting risk — full traceability chain navigable in the UI with AI provenance at each decision point
  4. Risk detail shows "Sources" section listing where the risk originated (signal, finding, agent detection)
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — AiProvenance component + risk detail enrichment badge, parsed description, collapsible AI Enrichment panel (AI-01)
- [x] 04-02-PLAN.md — Treatment suggestions provenance receipt, Sources traceability section, FindingPanel polish (AI-02, AI-04)

</details>

<details>
<summary>✅ v1.1 LLM Intelligence + Fixes + Polish (Phases 5-7) - SHIPPED 2026-03-18</summary>

### Phase 5: LLM Intelligence Backend
**Goal**: The LLM routing system is fully operational server-side — new schema tables in place, service layer can discover models and run benchmarks, per-task routing resolves correctly, and the critical agent findings bug is fixed before caller wiring lands
**Depends on**: Phase 4
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, FIX-02
**Success Criteria** (what must be TRUE):
  1. Admin can add a provider via the API (or directly) and the system validates the connection, fetches available models, and saves the configuration
  2. Calling the benchmark endpoint against a configured model returns TTFT, total latency, and a quality score
  3. Any AI operation that specifies a task type receives the model assigned to that task type in the routing table, falling back to the tenant default when no assignment exists
  4. Agent run completes with local findings persisted even when the LLM call throws an error — run status reflects actual findings count, not "skipped"
  5. Routing table entries can be read and updated via API, and the routing table UI card in Settings shows current assignments
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Schema migrations: llm_task_routing + llm_benchmark_results tables, OpenAPI spec update, Orval codegen re-run
- [x] 05-02-PLAN.md — llm-service.ts extensions: discoverModels(), runBenchmark(), resolveConfig(taskType), ANTHROPIC_MODELS constant
- [x] 05-03-PLAN.md — API endpoints + caller wiring: /discover, /benchmark, routing CRUD, /embeddings-health, taskType threading through all callers; FIX-02 agent findings persistence

### Phase 6: Bug Fixes and Wizard UI
**Goal**: All remaining audit bugs are corrected and the 6-step LLM Config Wizard is live in Settings — admins can onboard providers, discover models, benchmark, and assign per-task routing without leaving the UI
**Depends on**: Phase 5
**Requirements**: FIX-01, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07, LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06
**Success Criteria** (what must be TRUE):
  1. Document processing returns honest "content extraction not yet supported" stub instead of a hallucinated filename summary — no misleading AI output surfaces from the doc processor
  2. Re-enriching a risk replaces the existing AI enrichment block exactly once — opening risk detail after two enrichment runs shows one block, not two stacked
  3. Vendor AI question generation returns a clear, user-readable error message on LLM parse failure instead of a confusing 400 "invalid format" response
  4. Vendor scorecard displays real last-assessment date and open findings count pulled from the database — no more placeholder dashes
  5. Settings shows a visible warning banner when no embeddings provider is configured, explaining that semantic search and agent clustering will degrade
  6. Model name input in provider configuration uses a selection component from the discovered list — free-text entry is blocked, and the backend rejects configs with model IDs that fail provider validation
  7. Admin can complete the full 6-step LLM Config Wizard (provider select → API key → model discovery → model select → benchmark → routing assignment) and have the resulting config and routing assignments active without leaving Settings
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Bug fixes: FIX-01 doc processor stub, FIX-03 enrichment idempotency, FIX-04 vendor 400 error, FIX-05 scorecard real data, FIX-06 embeddings warning, FIX-07 model name validation
- [x] 06-02-PLAN.md — LLM Config Wizard frontend: 6-step wizard in settings.tsx, routing table card, smart defaults from benchmark results, embeddings health banner

### Phase 7: Foresight Teaser
**Goal**: The Foresight page is a polished, compelling preview that communicates the v2 vision — replacing the bare stub with an Apple-keynote-quality "coming soon" that makes the roadmap tangible
**Depends on**: Phase 6
**Requirements**: FORE-01
**Success Criteria** (what must be TRUE):
  1. Foresight page loads at its route and shows visual previews for all four planned features: Monte Carlo simulation, OSINT forecasting, agent findings inbox, and what-if scenario builder
  2. The page uses the established minimalist design language (Linear/Vercel aesthetic) with no broken layouts or placeholder text visible
**Plans**: 1 plan

Plans:
- [x] 07-01-PLAN.md — Foresight teaser page: polished coming-soon layout with visual mockups for Monte Carlo, OSINT, agent feed, what-if builder

</details>

<details>
<summary>✅ v1.2 Quick Fixes & Mobile Polish (Phase 8) - SHIPPED 2026-03-23</summary>

### Phase 8: Quick Fixes & Polish
**Goal**: Login detects tenant from email, social login placeholders, clickable KPI cards, mobile-friendly heatmap/tables, Replit code removed from header
**Depends on**: Phase 7
**Requirements**: LOGIN-01, LOGIN-02, DASH-06, MOB-01, MOB-02, MOB-03, CLEAN-01
**Success Criteria** (what must be TRUE):
  1. Login works with just email + password — no tenant slug field, org detected from email domain
  2. Social login buttons (Microsoft, Google) visible on login page with "Coming soon" toast
  3. Dashboard KPI cards navigate to respective list pages on click
  4. Heatmap renders readable on mobile, tables show scroll indicators
  5. No Replit UUID visible in header — shows tenant name instead
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — Login: tenant-from-email resolution, social login placeholders, header tenant name fix
- [x] 08-02-PLAN.md — Dashboard: clickable KPI cards, mobile heatmap fallback, scroll shadows, touch targets

</details>

### 🚧 v2.0 Core Platform Features (In Progress)

**Milestone Goal:** Transform RiskMind from a demo-ready platform into a full-featured enterprise risk management system with AI-driven assessments, redesigned vendor lifecycle, compliance workflows, real signal integrations, and predictive foresight capabilities.

- [x] **Phase 9: Schema Foundation** - Polymorphic assessment schema, integration config, foresight tables, signal deduplication column (completed 2026-03-23)
- [x] **Phase 10: Assessment Engine** - AI-driven shared questionnaire engine with templates, scoring, and LLM follow-up (completed 2026-03-23)
- [ ] **Phase 11: Vendor Lifecycle Redesign** - Wizard onboarding, 4th party risk, continuous monitoring, AI enrichment
- [ ] **Phase 12: Signal Integrations** - NVD, Shodan, Sentinel, MISP, email ingestion with per-tenant encrypted credentials
- [ ] **Phase 13: Compliance Flow** - Framework import, assessment-to-control linkage, per-framework thresholds
- [ ] **Phase 14: Foresight v2** - Monte Carlo simulation, loss exceedance curve, OSINT calibration, named scenarios

## Phase Details

### Phase 9: Schema Foundation
**Goal**: Every table and column required by v2.0 exists in the database — all subsequent phases can write feature code against correct, final schema without mid-development migration conflicts
**Depends on**: Phase 8
**Requirements**: (Foundation for ASMT-01–07, VNDR-01–07, COMP-01–03, SGNL-01–05, FRST-01–05)
**Success Criteria** (what must be TRUE):
  1. `drizzle-kit push` applies cleanly with zero errors and all new tables visible in psql
  2. `assessments` table exists with `context_type` enum (vendor/compliance/control) and nullable `context_id` — no `vendor_id NOT NULL` anti-pattern present
  3. `signals` table has a `content_hash` column with a unique index per tenant and source — duplicate poll data can never insert
  4. `integration_configs` table exists with encrypted_config JSONB — no signal API key is stored in any environment variable
  5. All new tables export from the schema index and Drizzle relations are defined — TypeScript inference works without manual type casts
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md -- Assessment engine + integration configs + foresight schema files
- [x] 09-02-PLAN.md -- Vendor subprocessors, org dependencies, monitoring configs + column additions
- [x] 09-03-PLAN.md -- Barrel exports, Drizzle relations, compatibility view, drizzle-kit push

### Phase 10: Assessment Engine
**Goal**: Users can create assessment templates, run assessment sessions against any subject (vendor or compliance framework), receive AI-generated follow-up questions mid-session, and see a computed risk score on completion
**Depends on**: Phase 9
**Requirements**: ASMT-01, ASMT-02, ASMT-03, ASMT-04, ASMT-05, ASMT-06, ASMT-07
**Success Criteria** (what must be TRUE):
  1. User can create an assessment template with text, boolean, multiple-choice, and numeric questions — each with a weight — and define conditional branching rules that show or hide questions based on prior answers
  2. User can start an assessment session, answer questions with branching logic applied in real time, and see AI-generated follow-up questions appear based on responses given so far — the same questions persist if the page is refreshed mid-session
  3. On submission, the system computes and displays weighted scores at the question, section, and overall level — score is deterministic for the same response set
  4. Pre-built templates (Vendor Security, Compliance Control, Incident Assessment) are available from a template library and can be used without any manual setup
  5. Completed assessment shows an AI-generated summary highlighting anomalies, inconsistencies, and gaps in the response set
**Plans**: 4 plans

Plans:
- [x] 10-01-PLAN.md -- Assessment engine types, scoring logic, and test infrastructure
- [x] 10-02-PLAN.md -- Backend API routes, AI endpoints, pre-built template seeds, OpenAPI spec
- [x] 10-03-PLAN.md -- Frontend template library page and template builder with components
- [x] 10-04-PLAN.md -- Frontend session wizard, results page, assessment list, and navigation wiring

### Phase 11: Vendor Lifecycle Redesign
**Goal**: Users can onboard a new vendor through a guided wizard with AI enrichment auto-triggered, track 4th-party subprocessors, configure continuous monitoring cadence per risk tier, and see vendor risk scores driven by assessment results
**Depends on**: Phase 10
**Requirements**: VNDR-01, VNDR-02, VNDR-03, VNDR-04, VNDR-05, VNDR-06, VNDR-07
**Success Criteria** (what must be TRUE):
  1. User can start vendor onboarding via a 4-step wizard (identity + tier, questionnaire assignment, document upload, AI enrichment review) — navigating away mid-wizard and returning resumes from the saved step without data loss
  2. AI enrichment auto-populates the vendor profile with industry classification, risk indicators, and known breach history during wizard step 4 — no manual trigger required
  3. User can view and add 4th-party subprocessors on a vendor detail page, with LLM-extracted subprocessors surfaced automatically from uploaded vendor documents
  4. User can complete the org dependency interview and see vendor concentration risks flagged when org-critical vendors have active OSINT or assessment signals
  5. Vendor kanban card and scorecard display a risk score derived from the latest assessment — not a placeholder or static value
  6. Vendor receives a scheduled re-assessment alert when its continuous monitoring cadence fires (based on tier: Critical weekly, High monthly, etc.)
**Plans**: 5 plans

Plans:
- [x] 11-01-PLAN.md -- Wizard onboard API endpoints + assessment-to-risk-score update hook
- [x] 11-02-PLAN.md -- Subprocessor, org-dependency, monitoring-config API routes + vendor-monitor worker
- [x] 11-03-PLAN.md -- Wizard frontend page (vendor-onboard.tsx) + route registration
- [ ] 11-04-PLAN.md -- Vendor detail subprocessors section + kanban score badge
- [ ] 11-05-PLAN.md -- Settings Organization tab (dependencies + concentration risk) + Monitoring tab

### Phase 12: Signal Integrations
**Goal**: All five external signal sources are live and polling — NVD CVE feeds, Shodan scan results, Microsoft Sentinel alerts, MISP threat events, and inbound email — each deduplicated by content hash and isolated per tenant with encrypted credentials
**Depends on**: Phase 9
**Requirements**: SGNL-01, SGNL-02, SGNL-03, SGNL-04, SGNL-05
**Success Criteria** (what must be TRUE):
  1. Admin can configure integration credentials for each source (NVD product tags, Shodan API key + targets, Sentinel workspace ID + service principal, MISP base URL + API key, IMAP mailbox) in Settings — credentials are stored encrypted and never appear in logs or job payloads
  2. After configuring NVD and triggering a poll, matching CVE signals appear in the signal list with CVE ID, CVSS score, and description — running the same poll again creates no duplicate signals
  3. After configuring Shodan, scanning a vendor domain surfaces open ports, exposed services, and CVE matches as signals linked to that vendor
  4. Sentinel alerts ingested via the Log Analytics API appear as normalized signals — re-ingesting the same incident ID does not create a duplicate
  5. An email sent to the configured IMAP mailbox is parsed by the LLM and appears as a signal with extracted fields — message body is sandboxed and cannot override signal classification
**Plans**: TBD

### Phase 13: Compliance Flow
**Goal**: Users can import compliance framework controls, run assessments that update control compliance status, and configure per-framework pass/fail thresholds that drive dashboard status
**Depends on**: Phase 10
**Requirements**: COMP-01, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. User can upload a CSV or JSON file of framework controls and see a diff preview before committing — import is additive (existing controls and mappings are preserved, not deleted)
  2. User can assign an assessment template to a compliance framework with questions mapped to control IDs — completing the assessment updates the compliance status of mapped controls
  3. User can set a compliance threshold (0–100%) per framework and the dashboard shows COMPLIANT, AT-RISK, or NON-COMPLIANT status based on current control scores against that threshold
**Plans**: TBD

### Phase 14: Foresight v2
**Goal**: Users can run Monte Carlo risk simulations with FAIR-labeled inputs, view loss exceedance curves, save and compare named scenarios, and see simulation parameters calibrated from real OSINT data already in the system
**Depends on**: Phase 12
**Requirements**: FRST-01, FRST-02, FRST-03, FRST-04, FRST-05
**Success Criteria** (what must be TRUE):
  1. User can run a Monte Carlo simulation by entering FAIR-labeled inputs (TEF, TC, CS, DIFF) for 10k to 100k iterations — the system accepts the request immediately (202 Accepted) and the results appear when the job completes, without blocking other UI interactions
  2. Completed simulation shows a loss exceedance curve with configurable confidence interval markers at the 50th, 90th, and 99th percentiles
  3. User can save a simulation as a named scenario, clone it with modified parameters, and view a side-by-side comparison of two scenarios — each scenario can be linked to a risk register entry
  4. When CVE/NVD or MISP signal data exists in the system, the simulation parameter form offers "Calibrate from real data" — accepting the suggestion pre-fills inputs with OSINT-derived values and displays a "calibrated from real data" badge with a data freshness indicator
  5. Dashboard KPI section shows a top-N risks by expected annual loss (ALE) widget derived from saved simulation results
**Plans**: TBD

## Progress

**Execution Order:**
v1.0 complete. v1.1 complete. v1.2 complete. v2.0 executes: Phases 9-14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Server Foundation | v1.0 | 5/5 | Complete | 2026-03-18 |
| 2. Public Access and Security | v1.0 | 3/3 | Complete | 2026-03-18 |
| 3. Dashboard Polish and Demo Readiness | v1.0 | 4/4 | Complete | 2026-03-18 |
| 4. AI Differentiators Surfaced | v1.0 | 2/2 | Complete | 2026-03-18 |
| 5. LLM Intelligence Backend | v1.1 | 3/3 | Complete | 2026-03-18 |
| 6. Bug Fixes and Wizard UI | v1.1 | 2/2 | Complete | 2026-03-18 |
| 7. Foresight Teaser | v1.1 | 1/1 | Complete | 2026-03-18 |
| 8. Quick Fixes & Polish | v1.2 | 2/2 | Complete | 2026-03-23 |
| 9. Schema Foundation | v2.0 | 3/3 | Complete   | 2026-03-23 |
| 10. Assessment Engine | v2.0 | 4/4 | Complete    | 2026-03-23 |
| 11. Vendor Lifecycle Redesign | v2.0 | 3/5 | In Progress|  |
| 12. Signal Integrations | v2.0 | 0/? | Not started | - |
| 13. Compliance Flow | v2.0 | 0/? | Not started | - |
| 14. Foresight v2 | v2.0 | 0/? | Not started | - |
