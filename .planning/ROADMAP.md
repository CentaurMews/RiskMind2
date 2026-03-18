# Roadmap: RiskMind

## Milestones

- ✅ **v1.0 Demo-Ready Deployment** - Phases 1-4 (shipped 2026-03-18)
- 🚧 **v1.1 LLM Intelligence + Fixes + Polish** - Phases 5-7 (in progress)

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

### 🚧 v1.1 LLM Intelligence + Fixes + Polish (In Progress)

**Milestone Goal:** Intelligent LLM configuration with wizard-based onboarding, model auto-discovery, benchmarking, per-task routing, audit bug fixes, and demo polish

#### Phase 5: LLM Intelligence Backend
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
- [ ] 05-01-PLAN.md — Schema migrations: llm_task_routing + llm_benchmark_results tables, OpenAPI spec update, Orval codegen re-run
- [ ] 05-02-PLAN.md — llm-service.ts extensions: discoverModels(), runBenchmark(), resolveConfig(taskType), ANTHROPIC_MODELS constant
- [ ] 05-03-PLAN.md — API endpoints + caller wiring: /discover, /benchmark, routing CRUD, /embeddings-health, taskType threading through all callers; FIX-02 agent findings persistence

#### Phase 6: Bug Fixes and Wizard UI
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
- [ ] 06-01-PLAN.md — Bug fixes: FIX-01 doc processor stub, FIX-03 enrichment idempotency, FIX-04 vendor 400 error, FIX-05 scorecard real data, FIX-06 embeddings warning, FIX-07 model name validation
- [ ] 06-02-PLAN.md — LLM Config Wizard frontend: 6-step wizard in settings.tsx, routing table card, smart defaults from benchmark results, embeddings health banner

#### Phase 7: Foresight Teaser
**Goal**: The Foresight page is a polished, compelling preview that communicates the v2 vision — replacing the bare stub with an Apple-keynote-quality "coming soon" that makes the roadmap tangible
**Depends on**: Phase 6
**Requirements**: FORE-01
**Success Criteria** (what must be TRUE):
  1. Foresight page loads at its route and shows visual previews for all four planned features: Monte Carlo simulation, OSINT forecasting, agent findings inbox, and what-if scenario builder
  2. The page uses the established minimalist design language (Linear/Vercel aesthetic) with no broken layouts or placeholder text visible
**Plans**: 1 plan

Plans:
- [ ] 07-01-PLAN.md — Foresight teaser page: polished coming-soon layout with visual mockups for Monte Carlo, OSINT, agent feed, what-if builder

## Phase Details

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
- [ ] 05-01-PLAN.md — Schema migrations: llm_task_routing + llm_benchmark_results tables, OpenAPI spec update, Orval codegen re-run
- [ ] 05-02-PLAN.md — llm-service.ts extensions: discoverModels(), runBenchmark(), resolveConfig(taskType), ANTHROPIC_MODELS constant
- [ ] 05-03-PLAN.md — API endpoints + caller wiring: /discover, /benchmark, routing CRUD, /embeddings-health, taskType threading through all callers; FIX-02 agent findings persistence

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
- [ ] 06-01-PLAN.md — Bug fixes: FIX-01 doc processor stub, FIX-03 enrichment idempotency, FIX-04 vendor 400 error, FIX-05 scorecard real data, FIX-06 embeddings warning, FIX-07 model name validation
- [ ] 06-02-PLAN.md — LLM Config Wizard frontend: 6-step wizard in settings.tsx, routing table card, smart defaults from benchmark results, embeddings health banner

### Phase 7: Foresight Teaser
**Goal**: The Foresight page is a polished, compelling preview that communicates the v2 vision — replacing the bare stub with an Apple-keynote-quality "coming soon" that makes the roadmap tangible
**Depends on**: Phase 6
**Requirements**: FORE-01
**Success Criteria** (what must be TRUE):
  1. Foresight page loads at its route and shows visual previews for all four planned features: Monte Carlo simulation, OSINT forecasting, agent findings inbox, and what-if scenario builder
  2. The page uses the established minimalist design language (Linear/Vercel aesthetic) with no broken layouts or placeholder text visible
**Plans**: 1 plan

Plans:
- [ ] 07-01-PLAN.md — Foresight teaser page: polished coming-soon layout with visual mockups for Monte Carlo, OSINT, agent feed, what-if builder

## Progress

**Execution Order:**
v1.0 phases complete. v1.1 executes in order: 5 → 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Server Foundation | v1.0 | 5/5 | Complete | 2026-03-18 |
| 2. Public Access and Security | v1.0 | 3/3 | Complete | 2026-03-18 |
| 3. Dashboard Polish and Demo Readiness | v1.0 | 4/4 | Complete | 2026-03-18 |
| 4. AI Differentiators Surfaced | v1.0 | 2/2 | Complete | 2026-03-18 |
| 5. LLM Intelligence Backend | 3/3 | Complete    | 2026-03-18 | - |
| 6. Bug Fixes and Wizard UI | 2/2 | Complete    | 2026-03-18 | - |
| 7. Foresight Teaser | 1/1 | Complete    | 2026-03-18 | - |
