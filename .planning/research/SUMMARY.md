# Project Research Summary

**Project:** RiskMind — Enterprise Risk Management Platform
**Domain:** ERM SaaS — Replit-to-server migration + Cloudflare tunnel deployment + demo-ready polish
**Researched:** 2026-03-17
**Confidence:** HIGH (codebase inspected directly; server environment verified; tools confirmed installed)

## Executive Summary

RiskMind is a functioning TypeScript monorepo ERM platform that needs to be migrated from Replit to a dedicated Linux server and polished to demo-ready state. The codebase already contains a mature backend (risk register, TPRM vendor lifecycle, compliance frameworks, AI enrichment, autonomous agent, MCP endpoint) and a React frontend. The primary challenge is not building features from scratch but deploying correctly and surfacing what already exists in a visually polished, credible way. The recommended deployment pattern is simple: Express serves both the REST API and the built React SPA from a single port (4000), with a Cloudflare tunnel providing HTTPS and public access — no nginx, no separate frontend process, no load balancer.

The greatest risk in this project is not technical complexity but migration debt. The codebase was built on Replit and carries Replit-specific packages, environment assumptions, and configuration that will break or degrade silently on a bare Linux server. Resolving these upfront — removing `@replit/*` packages, setting all required environment variables, provisioning pgvector correctly, configuring CORS — is the prerequisite to everything else. Skipping this phase produces hard-to-diagnose failures that look like feature bugs.

For demo readiness, the decisive factor is the combination of realistic seed data plus visual polish plus AI features that visibly work. Competitors (Riskonnect, LogicManager, MetricStream) offer standard ERM features; RiskMind's differentiators are its autonomous risk intelligence agent, AI enrichment pipeline, and MCP endpoint. These features exist in the backend but are not fully surfaced in the frontend. The roadmap should treat infrastructure stabilization as a hard prerequisite, then prioritize the features that demonstrate these differentiators before polishing secondary UX concerns.

---

## Key Findings

### Recommended Stack

The production stack requires almost no new installations — the server already has all necessary components. PM2 6.0.10 is installed globally (latest is 6.0.14, upgrade optional). cloudflared 2026.3.0 is installed and running. PostgreSQL 16.13 is running on localhost:5432. The only missing piece is the pgvector extension (`postgresql-16-pgvector` is in apt but not yet installed). The Vite, esbuild, and pnpm build tooling are already configured and working.

The single most important architectural decision for deployment is: Express (port 4000) is the sole HTTP listener. It serves `/api/v1/*` and `/mcp` routes directly, serves the built React SPA as static files from `artifacts/riskmind-app/dist/public/`, and falls back to `index.html` for all other paths. The Cloudflare tunnel routes to this single port. Do not add nginx — it adds operational overhead with zero benefit for this deployment.

**Core technologies:**
- PM2: Process manager — auto-restart on crash, `pm2 startup` for boot persistence, monorepo-aware via `ecosystem.config.cjs`
- cloudflared: Public access — outbound-only tunnel, HTTPS termination at Cloudflare edge, already installed
- PostgreSQL 16 + pgvector: Primary database + semantic similarity — pgvector needed for AI embedding features (install via apt)
- Express 5 + `express.static`: Single HTTP listener — serves API and built SPA from one port, eliminating nginx
- esbuild + Vite: Build tooling — already configured; produces `dist/index.cjs` (API) and `dist/public/` (SPA)
- Node.js 20 `--env-file`: Environment injection — no dotenv package needed; PM2 ecosystem config handles production env vars

**Avoid:** nginx, `vite preview` in production, quick cloudflared tunnels (`--url`), PM2 cluster mode (breaks in-memory job queue state), `@replit/*` packages.

### Expected Features

RiskMind's MVP backend is complete. The roadmap is about deployment, polish, and surfacing existing functionality — not building new core features.

**Must have before demo (P1 — table stakes):**
- Deployment working at Cloudflare tunnel URL, accessible from browser
- Seed data populated — realistic risks, vendors, frameworks, alerts, signals
- Dashboard visually polished — consistent card layout, proper spacing, visual hierarchy
- Risk heatmap functional — correct rendering, clickable drill-down
- Empty states, loading states, error states — no blank boxes or raw error text anywhere
- Role-based UI enforcement — admin/risk_manager/auditor views behave differently
- Vendor scorecard summary — score, tier, last assessment date, open findings visible at a glance
- Compliance posture percentage — "73% compliant with ISO 27001" style display per framework
- Navigation consistency — sidebar active states, breadcrumbs, page titles all correct

**Should have for strong demo (P2 — differentiators visible):**
- AI enrichment visible on risk detail — "AI-enriched" badge, summary, suggested treatments
- Foresight page shows autonomous agent work — findings with confidence and rationale
- Signal-to-finding traceability — signal detail links to derived findings and risks
- Risk trend sparklines — mini charts showing score trajectory on risk cards
- Alert notification center — unread count badge, prioritized list, acknowledge flow
- KRI dashboard widget — top KRIs with threshold status (green/amber/red)
- Vendor pipeline/kanban view — vendors visualized by lifecycle stage
- CSV export for risk register

**Defer to v2+ (P3 or post-demo):**
- Cross-framework control mapping (one control satisfies multiple frameworks)
- Risk clustering via pgvector semantic similarity surfaced in UI
- Board-ready PDF report generation
- Risk appetite configuration UI
- SSO/SAML/OIDC, mobile native app, real-time collaborative editing, vendor self-service portal

**Feature dependencies that constrain sequencing:**
- Seed data is a prerequisite for all demo features — nothing is demoable without it
- AI enrichment jobs must run before AI UI features show content
- Signal pipeline must have processed signals before traceability UI is meaningful
- Risk appetite configuration must exist before KRI threshold display makes sense

### Architecture Approach

The codebase uses same-origin relative API URLs (`/api/v1/...` with no `VITE_API_URL` env variable), which locks the deployment to a single-origin pattern: Express must serve both the SPA and the API from the same port. This is a constraint, not a flaw — it eliminates cross-origin complexity and means the deployment is genuinely simpler than a typical two-server setup. Build order is strictly linear: `lib/db` → `lib/api-spec` → `lib/api-zod` → `lib/api-client-react` → `artifacts/api-server` → `artifacts/riskmind-app`. AI enrichment jobs run in-process using a PostgreSQL-backed polling queue — no Redis or external broker needed for demo-scale workloads.

**Major components:**
1. cloudflared daemon — TLS termination, public URL, forwards plain HTTP to Express on port 4000
2. Express API server (`artifacts/api-server`) — REST API, MCP endpoint, static file serving, JWT auth, AI job queue
3. React SPA (`artifacts/riskmind-app`) — built to `dist/public/`, served by Express; communicates via same-origin `/api/v1/` fetch calls
4. PostgreSQL + pgvector — persistent data store and semantic similarity engine; localhost-only, not exposed externally
5. `lib/db` — shared Drizzle schema, migration management, database bootstrap
6. `lib/api-client-react` / `lib/api-zod` — Orval-generated code (do not edit directly; change `lib/api-spec` and regenerate)

**Key patterns to follow:**
- Express static middleware + SPA fallback catch-all — required by same-origin URL architecture
- In-process PostgreSQL job queue — acceptable for demo scale, no external infrastructure needed
- Tenant-scoped Drizzle queries (application-layer, not DB-level RLS) — sufficient for internal deployment

### Critical Pitfalls

1. **Replit SDK left in production build** — Remove `@replit/connectors-sdk` from workspace `package.json` and all `@replit/vite-plugin-*` from `riskmind-app/package.json` before first build. Verify with `pnpm install --frozen-lockfile`. Phase 1 blocker.

2. **Missing environment variables cause silent failures** — `ENCRYPTION_KEY` is checked lazily (per-request, not at startup). The server starts fine then crashes mid-demo when the first AI feature runs. Add a startup validation function that checks `PORT`, `DATABASE_URL`, `JWT_SECRET`, and `ENCRYPTION_KEY` before `start()`. Phase 1 blocker.

3. **pgvector extension not installed as superuser** — `ensureExtensions()` silently swallows the error if the app user lacks `SUPERUSER`. Install as postgres superuser before running migrations: `psql -U postgres -d riskmind -c "CREATE EXTENSION IF NOT EXISTS vector;"`. Phase 1 blocker.

4. **Cloudflare tunnel buffers SSE streams** — AI interview feature uses SSE. Cloudflare buffers by default; client receives all tokens at once at the end instead of streaming. Fix: set `http2Origin: true` in cloudflared config YAML and add `res.flushHeaders()` immediately after setting SSE headers. Phase 2 critical.

5. **Open CORS in production** — `app.use(cors())` with no config sets `Access-Control-Allow-Origin: *`. Lock down to the specific Cloudflare tunnel hostname in Phase 2. Also: no Cloudflare Access policy on the tunnel by default means the app is publicly internet-accessible with only JWT auth standing between it and the world.

6. **ENCRYPTION_KEY loss is unrecoverable** — If `ENCRYPTION_KEY` is lost after tenant LLM API keys are saved, all stored keys become permanently undecryptable. Document this value in a secure location before configuring any LLM provider. Never rotate it.

---

## Implications for Roadmap

Based on research, the natural phase structure follows hard dependencies: infrastructure must work before features can be developed, features must work before they can be polished, and the demo checklist gates everything.

### Phase 1: Server Setup and Migration

**Rationale:** All subsequent work depends on a clean, stable server deployment. Replit migration debt (packages, env vars, port conflicts) will cause confusing failures in every later phase if not resolved first. This phase has clear completion criteria and no external dependencies.

**Delivers:** Working server at Cloudflare tunnel URL with clean build, database provisioned, process supervisor running, all environment variables validated, seed data loading successfully.

**Addresses:**
- Remove `@replit/*` packages from build
- Establish PM2 ecosystem config with correct port (4000), env vars, log paths
- PostgreSQL + pgvector provisioned; `drizzle-kit push` succeeds
- Seed data loads on fresh DB; demo login works
- Express serves static SPA files + API from same port

**Avoids pitfalls:** Replit SDK in production build, missing environment variables, port conflicts, pgvector not installed as superuser, demo seed not idempotent, no process supervisor.

**Research flag:** Standard patterns — skip phase-level research. The deployment sequence is fully documented in ARCHITECTURE.md and STACK.md with exact commands.

---

### Phase 2: Cloudflare Tunnel and Security Configuration

**Rationale:** Once the server runs locally, the tunnel must be correctly configured before any demo can happen. SSE buffering and CORS are correctness issues that break visible features (AI interview), not just security hygiene. Security hardening (Cloudflare Access policy, CORS lockdown) is also required before sharing any demo URL externally.

**Delivers:** Named Cloudflare tunnel routing to Express port 4000; SSE streaming working through tunnel; CORS locked to tunnel hostname; Cloudflare Access policy applied; cloudflared running as systemd service.

**Addresses:**
- `cloudflared tunnel create riskmind` + DNS record
- `http2Origin: true` in config YAML for SSE support
- `cors({ origin: 'https://riskmind.yourdomain.com' })` replacing open CORS
- Cloudflare Access application policy restricting tunnel to intended users
- Cloudflared credentials file permissions (600)

**Avoids pitfalls:** SSE buffering breaking AI interview, tunnel publicly exposed with no access control, open CORS, cloudflared credentials world-readable.

**Research flag:** Cloudflare Access policy configuration may need targeted research during planning — options vary by Cloudflare plan (Free vs Teams).

---

### Phase 3: Dashboard Polish and P1 Feature Completeness

**Rationale:** With infrastructure stable, the focus shifts to the demo-critical UI quality bar. P1 features (empty states, loading states, visual polish, role enforcement) are table stakes that make the difference between a demo that reads as professional versus one that reads as unfinished. Seed data must be in place to see the effects of polish work.

**Delivers:** Polished dashboard with consistent card layout and visual hierarchy; risk heatmap functional with drill-down; empty/loading/error states on all pages; RBAC-correct UI for admin/risk_manager/auditor roles; vendor scorecard summary and compliance posture percentage visible; navigation consistent throughout.

**Addresses:** All P1 features from FEATURES.md must-have list; seed data for all demo scenarios (3-5 vendors, 2 compliance frameworks, 10+ risks, alerts, signals).

**Avoids pitfalls:** Risk heatmap blank on empty data, vendor lifecycle not visible, JWT expiry mid-demo without friendly handling.

**Research flag:** Standard patterns — shadcn/ui component library is already in the stack; visual polish work does not require external research.

---

### Phase 4: AI Features Surfaced (Differentiator Visibility)

**Rationale:** The autonomous agent, AI enrichment pipeline, and signal traceability are what distinguish RiskMind from generic ERM tools. These features exist in the backend but are not fully visible in the UI. Making them visible is the difference between "a risk register with AI" and "an AI-native risk intelligence platform." This phase requires the AI backend to be running with a valid LLM API key configured.

**Delivers:** AI enrichment visible on risk detail pages (badge, summary, treatment suggestions); Foresight page shows autonomous agent findings with confidence and rationale; signal-to-finding-to-risk traceability chain visible in UI; alert notification center functional; KRI dashboard widget showing threshold status.

**Addresses:** All P2 features from FEATURES.md; MCP session expiry logic (prevents memory leak in long-running process).

**Avoids pitfalls:** MCP session Map growing unbounded, AI enrichment visible only in DB but not in frontend, signal pipeline invisible to demo audience.

**Research flag:** Signal-to-finding-to-risk traceability UI may need targeted research during planning if the data model relationships are not already exposed via existing API endpoints.

---

### Phase 5: Secondary Differentiators and Demo Hardening

**Rationale:** Phase 5 elevates an already functional demo to an impressive one. Risk trend sparklines, vendor pipeline view, and CSV export are all P2 features with medium complexity. Demo hardening (credential rotation, ENCRYPTION_KEY backup verification, final security checklist) ensures the demo does not fail in front of evaluators for preventable reasons.

**Delivers:** Risk trend sparklines on risk cards/list; vendor kanban/pipeline view; CSV export for risk register; demo credentials rotated from `password123`; pre-demo checklist verified end-to-end.

**Addresses:** Remaining P2 features; pre-demo security checklist from PITFALLS.md.

**Research flag:** Risk trend sparklines require chart component selection — recommend verifying recharts or similar is already in the React stack before planning implementation approach.

---

### Phase Ordering Rationale

- **Phases 1-2 are strictly sequential prerequisites.** No UI work matters until the server runs cleanly at the tunnel URL with SSE working.
- **Phase 3 requires seed data**, which is part of Phase 1 deliverables. This ordering is load-bearing.
- **Phase 4 requires a valid LLM API key configured** in the tenant settings. This is a human action that must happen before AI enrichment jobs produce output for the UI to display. Flag this as a dependency in Phase 4 planning.
- **Phase 5 is additive.** It does not block a successful demo — it makes a good demo excellent.
- **P3 features (cross-framework mapping, pgvector clustering, PDF report, risk appetite UI)** are deliberately excluded from this roadmap. They are post-demo improvements with high implementation cost relative to demo value.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2:** Cloudflare Access policy options vary by plan — verify which Zero Trust features are available on the current Cloudflare account before planning specific access control implementation.
- **Phase 4:** Signal-to-finding-to-risk traceability — verify existing API endpoints expose the relational chain before planning frontend implementation; may require new endpoints.
- **Phase 5:** Chart library availability — confirm recharts or an equivalent is available in the React workspace before planning sparklines implementation.

Phases with standard, well-documented patterns (skip dedicated research):
- **Phase 1:** Deployment sequence fully documented in ARCHITECTURE.md with exact commands and verified tool versions.
- **Phase 3:** shadcn/ui component patterns are well-documented and already in use in the codebase.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools verified on server directly; versions confirmed; no speculative recommendations |
| Features | MEDIUM-HIGH | Table stakes grounded in competitor analysis and codebase inspection; P2/P3 priorities are opinionated estimates, not validated with end users |
| Architecture | HIGH | Derived from direct codebase inspection of running code; same-origin URL constraint confirmed in `custom-fetch.ts`; port inventory verified with `ss -tlnp` |
| Pitfalls | HIGH | Pitfalls derived from actual code analysis (Replit packages found in `package.json`, lazy `ENCRYPTION_KEY` check confirmed in `encryption.ts`, open CORS confirmed in `app.ts`), not hypothetical |

**Overall confidence:** HIGH

### Gaps to Address

- **Cloudflare account tier:** The Cloudflare Access policy options and WAF rules available depend on the account plan. This must be verified against the actual Cloudflare account before Phase 2 planning finalizes access control approach.
- **LLM API key availability:** Phase 4 requires a working OpenAI or Anthropic API key configured in tenant settings to produce AI enrichment output. This is a human dependency — must be flagged as a pre-Phase-4 action in the roadmap.
- **Existing API endpoint coverage for traceability:** The signal → finding → risk chain exists in the data model, but it is unconfirmed whether existing API endpoints expose the full relational chain needed for the traceability UI in Phase 4. This should be verified during Phase 4 planning before implementation begins.
- **Tunnel subdomain / domain name:** The cloudflared config and CORS lockdown both require a known hostname. The actual domain/subdomain choice is an operational decision not yet made; Phase 2 planning must start with this decision.

---

## Sources

### Primary (HIGH confidence)
- Direct server environment inspection — `pm2 --version`, `cloudflared version`, `psql --version`, `node --version`, `ss -tlnp`, `apt-cache search pgvector`
- Direct codebase inspection — `artifacts/api-server/src/`, `artifacts/riskmind-app/vite.config.ts`, `lib/api-client-react/src/custom-fetch.ts`, `lib/db/src/bootstrap.ts`, `artifacts/api-server/src/mcp/handler.ts`
- PM2 official docs — ecosystem config format, process management
- cloudflared Linux service docs — config.yml format, systemd install, ingress rules
- PostgreSQL pgvector — extension privilege requirements, installation procedure

### Secondary (MEDIUM confidence)
- Riskonnect, MetricStream, LogicManager, Tracker Networks 2026 buyers guide — ERM feature landscape and competitor positioning
- Cloudflare documentation on HTTP/2 tunnel buffering — SSE streaming behavior (behavior confirmed from known Cloudflare proxy characteristics)
- CyberSierra AI-powered GRC platforms 2025 — AI/ML feature expectations in ERM market

### Tertiary (LOW confidence — needs validation during implementation)
- Signal-to-finding-to-risk API endpoint coverage — assumed from data model; not confirmed by endpoint inventory

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
