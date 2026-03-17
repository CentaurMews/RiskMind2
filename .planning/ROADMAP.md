# Roadmap: RiskMind

## Overview

RiskMind is a functioning ERM platform being migrated from Replit to a dedicated Linux server and polished for demo-ready use. The journey is: deploy cleanly → expose publicly → make the UI credible → make the AI differentiators visible. Four phases follow the hard dependency chain. Nothing in Phase 3 is demoable without Phase 1 and 2 complete, and AI visibility in Phase 4 requires the full stack running.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Server Foundation** - Strip Replit dependencies, provision database, build and run the app locally on port 4000 with PM2
- [ ] **Phase 2: Public Access and Security** - Configure named Cloudflare tunnel, lock CORS, enable SSE streaming, expose app via public URL
- [ ] **Phase 3: Dashboard Polish and Demo Readiness** - Visual polish, empty/loading/error states, RBAC UI enforcement, vendor and compliance views
- [ ] **Phase 4: AI Differentiators Surfaced** - AI enrichment badges, treatment suggestions, Foresight page, signal traceability visible in UI

## Phase Details

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
- [ ] 01-01-PLAN.md — Strip Replit dependencies from all manifests and vite.config.ts
- [ ] 01-02-PLAN.md — Env validation, rich seed integration, .env setup
- [ ] 01-03-PLAN.md — Database provisioning (pgvector, drizzle push, manual migration)
- [ ] 01-04-PLAN.md — Build workspace packages and wire Express static serving + SPA fallback
- [ ] 01-05-PLAN.md — PM2 config, log rotation, boot persistence, end-to-end verification

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
**Plans**: TBD

### Phase 3: Dashboard Polish and Demo Readiness
**Goal**: The dashboard and all list views look professional — consistent card design, populated with seed data, RBAC-correct, with empty/loading/error states everywhere
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, VEND-01, VEND-02, COMP-01, EXP-01
**Success Criteria** (what must be TRUE):
  1. Dashboard shows KPI cards, risk heatmap with clickable drill-down, executive summary, KRI threshold indicators, and alert badge — all populated with seed data
  2. Every list view has pagination, search, and filter controls; every empty list shows a friendly empty state with a CTA
  3. All pages show skeleton loaders while fetching and toast notifications on error — no blank boxes or raw error text anywhere
  4. Vendor scorecard shows score, tier, assessment date, and open findings; vendor pipeline shows lifecycle stages visually
  5. Compliance posture percentage displays per framework; admin-only controls are hidden from viewer/auditor roles
**Plans**: TBD

### Phase 4: AI Differentiators Surfaced
**Goal**: RiskMind's AI-native identity is visible — enrichment badges on risk detail, treatment suggestions, Foresight page with agent findings, and signal-to-finding-to-risk traceability chain
**Depends on**: Phase 3
**Requirements**: AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):
  1. Risk detail page shows "AI-enriched" badge, enrichment summary, and the date enrichment ran
  2. AI-generated treatment suggestions appear on the risk detail page
  3. Foresight page displays autonomous agent findings with confidence level and rationale for each finding
  4. Signal detail links to the derived finding, and finding links to the resulting risk — full traceability chain navigable in the UI
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Server Foundation | 3/5 | In Progress|  |
| 2. Public Access and Security | 0/TBD | Not started | - |
| 3. Dashboard Polish and Demo Readiness | 0/TBD | Not started | - |
| 4. AI Differentiators Surfaced | 0/TBD | Not started | - |
