# Project Research Summary

**Project:** RiskMind v2.0
**Domain:** Enterprise Risk Management — Assessment Engine, Vendor Lifecycle Redesign, Compliance Flow, Signal Integrations, Foresight v2
**Researched:** 2026-03-23
**Confidence:** HIGH (architecture and stack verified against codebase; API patterns verified against official docs)

## Executive Summary

RiskMind v2.0 is a greenfield feature expansion on top of a proven Express 5 / React 19 / PostgreSQL 16 monolith. The five new capability areas (Assessment Engine, Vendor Lifecycle Redesign, Compliance Flow, Signal Integrations, Foresight v2) are not independent additions — they form a layered dependency graph where the Assessment Engine is the critical foundation that must be built first. The existing architecture is well-suited to absorb all v2.0 features without infrastructure changes: the job queue handles async work, the signal pipeline accepts new sources via adapters, and the encryption pattern scales to multi-tenant integration credentials. The recommended approach is additive extension of existing patterns rather than any new infrastructure, framework, or abstraction layer.

The stack additions are minimal and deliberate: 6 new backend packages handle the only genuinely new capability domains (IMAP ingestion, MIME parsing, Azure Sentinel SDK, rate limiting, statistical distributions, and cron scheduling). All other integrations (Shodan, NVD/CVE, MISP) use built-in `fetch` — no maintained Node.js wrappers exist. The most significant frontend change is upgrading recharts from v2.x to v3.8 to support histogram/density charts for Foresight's Monte Carlo output. The Monte Carlo simulation itself is pure TypeScript against `simple-statistics` and runs in approximately 200ms for 10k iterations — no worker threads required at the planned scale, though this should be revisited at 50k+ iterations.

The primary risks are architectural, not technical. The Assessment Engine must be designed as a polymorphic, shared service from day one — designing it vendor-only and forking it for compliance is the highest-likelihood failure mode in the entire v2.0 release. Signal ingestion requires deduplication via content hash before the first polling run, or LLM costs will grow unbounded on every polling cycle. Multi-tenant credential isolation is mandatory for all five external integrations; global environment variables are explicitly forbidden. The Microsoft Sentinel integration must use the Azure Log Analytics REST API — the SIEM agent was retired in November 2025 and is a dead end.

## Key Findings

### Recommended Stack

The existing stack (Express 5, React 19 + Vite 7, Drizzle ORM, Zod v4, shadcn/ui, Tailwind v4, pgvector, openai + anthropic SDKs, recharts 2.x, react-hook-form, node-cron equivalent) requires only targeted additions for v2.0. No new infrastructure components (Redis, message brokers, ML runtimes) are needed. External API integrations (Shodan, NVD/CVE, MISP) intentionally avoid npm packages — no maintained Node.js wrappers exist for any of them. The Azure Sentinel SDK is justified because Azure ARM auth is complex enough to warrant a maintained SDK.

**Core new technologies:**
- `imapflow ^1.2.9`: IMAP ingestion — actively maintained (published 2026-03-17), supports IDLE push for zero-poll email monitoring; replaces unmaintained `node-imap`
- `mailparser ^3.9.4`: MIME parsing — Nodemailer team package, patches XSS in `textToHtml()`; required companion to imapflow; use >= 3.9.3 (CVE-2026-3455)
- `@azure/arm-securityinsight ^1.0.0-beta.6`: Sentinel management SDK — perpetual beta but stable since 2022; handles Azure ARM auth token refresh; pin the version
- `@azure/identity ^4.13.0`: Azure auth — use `ClientSecretCredential` for service-principal auth; do not use `DefaultAzureCredential` (too broad for server-to-server)
- `p-ratelimit ^1.2.0`: Outbound rate limiting — wraps any async function; required for NVD (50/30s), Shodan (1/s), MISP (instance-dependent); replaces unmaintained `bottleneck` (7 years old)
- `simple-statistics ^7.8.8`: Monte Carlo sampling and distribution math — zero dependencies, inline TypeScript types, handles normal/lognormal/triangular distributions
- `recharts ^3.8.0` (upgrade from 2.x): Histogram and density chart APIs needed for Foresight loss exceedance curves; migration guide documents axis/tooltip prop changes
- Direct `fetch` for Shodan, NVD/CVE, MISP: No maintained npm wrappers exist; REST APIs are simple enough to call directly with `p-ratelimit`

**What not to add:** `shodan-client` (6 years stale), `bottleneck` (7 years stale), `BullMQ`/Redis (no Redis in deployment, signal polling is low-frequency), `jstat` (outdated TypeScript types), `SurveyJS` (deterministic form engine incompatible with AI-driven branching), `axios`/`node-fetch` (Node 20 has built-in `fetch`), `langchain`/`llamaindex` (heavy abstraction over APIs already called directly).

### Expected Features

Based on competitor analysis (ServiceNow GRC, OneTrust, Vanta, SecurityScorecard) and industry research, the v2.0 feature set is well-grounded. The AI-driven non-deterministic questionnaire and OSINT-calibrated Monte Carlo simulation are genuine differentiators — enterprise GRC tools either lack these entirely or offer them as expensive add-ons.

**Must have (table stakes — v2.0 fails without these):**
- Assessment questionnaire with conditional branching — any GRC platform since 2015 has this; its absence makes the product feel unfinished
- Pre-built templates (SIG Lite–inspired, ISO 27001–inspired, Incident) — building from scratch is a day-1 blocker for every new customer
- Numeric risk scoring from assessment responses — without this, assessments are documents, not risk intelligence
- Vendor onboarding wizard (multi-step) — enterprise buyers expect guided flows, not blank forms
- Continuous vendor monitoring with threshold alerts — mandatory for TPRM platform credibility in 2026
- Framework import (CSV/JSON) — compliance teams arrive with existing control sets; manual entry is a non-starter
- Assessment-to-control linkage — gap analysis is meaningless without it
- Compliance threshold configuration per framework — hard-coding 100% alienates every real compliance team
- CVE/NVD feed — baseline signal source; expected to be automatic, not manually entered
- Shodan external scan signals — attack surface visibility is standard TPRM in 2026
- SIEM alert ingestion (Sentinel) — enterprise Azure customers expect this
- Monte Carlo simulation with loss exceedance curve — justifies premium positioning; expected in mature ERM platforms

**Should have (differentiators — competitive quality depends on these):**
- AI-driven non-deterministic questionnaires (LLM generates follow-up questions from context window)
- Shared Assessment Engine for both vendor and compliance flows (architectural advantage competitors rarely achieve)
- AI vendor enrichment auto-triggered during onboarding wizard
- 4th party risk data model and vendor graph (GDPR/NYDFS regulatory requirement)
- MISP threat intelligence integration (de facto open-source threat sharing platform)
- Email ingestion with LLM signal extraction (unusual differentiator; no competitor offers this)
- OSINT feed calibration for Foresight simulation parameters
- Named scenario modeling (save, compare, link to risk register)
- FAIR ontology labels on Monte Carlo inputs
- ALE dashboard widget (top-N risks by expected annual loss)

**Defer to v2.1+:**
- External vendor portal — requires separate auth system; this is a full product track, not a feature
- Visual flowchart editor for branching — JSON-based conditions are sufficient for v2.0
- Automated SOAR playbooks — separate product category, 6–12 months of work
- ML risk prediction from historical data — insufficient data volume at v2.0
- Token cost analytics for LLM calls — carried forward from v1.1 deferral

### Architecture Approach

The target architecture is a pure extension of the existing monolith. All new background operations (assessment scoring, Monte Carlo, signal ingestion) route through the existing Postgres-backed job queue (`job-queue.ts`). Signal integrations follow an adapter pattern — each external source implements a common `SignalFeedAdapter` interface and writes normalized records to the existing `signals` table via the existing triage pipeline. No new infrastructure is introduced. Approximately 10 new tables are added to the existing PostgreSQL schema. The system remains a single PM2 process.

**Major new components:**
1. `assessment-engine.ts` — Session state machine, AI question generation (LLM called once at session creation, persisted, never re-generated), response scoring via async job queue; serves both vendor and compliance flows via polymorphic `context_type`
2. `signal-feed-poller.ts` — Scheduled background poller; adapter pattern routes Shodan/NVD/MISP/Sentinel/email through a common interface; deduplicates via `content_hash` before insert; per-integration resilience (transient vs. permanent error handling)
3. `integration-config.ts` — Per-tenant integration credentials; AES-256-GCM encrypted storage reusing existing `encryption.ts`; identical pattern to `llm_configs`
4. `monte-carlo.ts` — Pure TypeScript simulation engine; async via job queue (202 Accepted, client polls); `simple-statistics` for distributions; results stored as percentile buckets in `foresight_simulations`
5. `framework-importer.ts` — OSCAL/JSON/CSV framework import; additive upsert only (never DELETE + re-insert); preview diff before commit; wrapped in a rollback-capable Drizzle transaction
6. `email-ingestion.ts` — IMAP IDLE listener via `imapflow`; `mailparser` for MIME; LLM extraction with content sandboxing and 4000-char truncation

**Build order (dependency-imposed):**
Schema Foundation (Stage 1) → Assessment Engine (Stage 2) → Vendor Lifecycle (Stage 3) + Signal Integrations (Stage 4, parallel) → Compliance Flow (Stage 5) → Foresight v2 (Stage 6)

### Critical Pitfalls

1. **Assessment Engine designed vendor-only, then forked for compliance** — The existing `questionnaires` schema has `vendor_id NOT NULL`. Copying this pattern creates two diverging assessment systems within two phases. Prevention: Design a polymorphic `assessments` table with `context_type` (vendor/compliance/control) and nullable `context_id` before any feature code is written. This is the single highest-risk architectural decision in v2.0.

2. **Assessment questions regenerated on every session load** — LLM called on each `GET /assessments/:id` produces different questions mid-assessment; responses become orphaned; audit trails become meaningless. Prevention: Generate questions exactly once at session creation, persist in DB as JSONB, never call the LLM again for an in-progress session.

3. **Signal ingestion without content-hash deduplication** — Shodan and NVD return the same data on every poll. Without a `source_fingerprint` SHA256 unique index, the signals table fills with duplicates and LLM triage costs grow unbounded from the first polling run. Prevention: Add `content_hash` column and `ON CONFLICT DO NOTHING` in the Schema Foundation phase, before any polling code is written.

4. **Multi-tenant credential storage via environment variables** — Using `SHODAN_API_KEY` / `MISP_BASE_URL` as global env vars prevents per-tenant config and exposes credentials in logs/error traces. Prevention: Store all integration credentials in `integration_configs.encrypted_config` using existing AES-256-GCM `encryption.ts` — same pattern as `llm_configs.encrypted_api_key`. Never store API keys in job payloads (job table is plaintext).

5. **Microsoft Sentinel via deprecated SIEM agent** — The Defender for Cloud Apps SIEM agent was retired in November 2025. Building against it is DOA. Prevention: Use Azure Log Analytics REST API (`api.loganalytics.io/v1/workspaces/{id}/query`) with service principal OAuth2 client credentials. Config requires 4 fields: `workspaceId`, `clientId`, `clientSecret`, `azureTenantId` — all encrypted in `integration_configs`.

6. **Monte Carlo blocking the Node.js event loop** — A synchronous iteration loop in a job queue handler blocks all concurrent API requests even at modest iteration counts. Prevention: Return 202 Accepted, run simulation in job queue worker, use `setImmediate` chunking or Worker Threads for large scenarios. This is the same async pattern already established for LLM enrichment.

7. **Framework import as DELETE + re-insert destroys tenant control mappings** — An import that truncates `framework_requirements` orphans all `control_requirement_maps` the tenant has built over months. Prevention: Import must be additive only — upsert with `ON CONFLICT`, mark deprecated with `deprecated_at`, show diff preview before commit, wrap in a rollback-capable transaction.

8. **Email body prompt injection** — Inbound email content passed directly to the LLM triage prompt enables prompt injection that can tamper with signal classification and auto-escalation. Prevention: Wrap email body in `<user_content>` delimiters, strip HTML with a hardened parser (not regex), truncate at 4000 chars, require human promotion from `triaged` status (no auto-promotion for email-sourced signals).

## Implications for Roadmap

All dependency analysis from FEATURES.md and ARCHITECTURE.md converges on the same phase structure. The Assessment Engine is the critical path — Vendor Lifecycle and Compliance Flow both block on it. Signal Integrations and Vendor Lifecycle can run in parallel once the Assessment Engine ships. Foresight benefits from signal data existing in the DB before simulations run (for OSINT calibration), making it the natural final phase.

### Phase 1: Schema Foundation
**Rationale:** Every other phase requires schema to exist. This phase is pure DDL with no routes and no business logic. Running schema first unblocks all parallel work and eliminates mid-development migration conflicts.
**Delivers:** New tables: `assessments`, `assessment_sessions`, `assessment_responses`, `integration_configs`, `foresight_scenarios`, `foresight_simulations`, `vendor_fourth_party_links`. Column additions: `vendors` (website_domain, enrichment_status, onboarding_step, onboarding_data), `frameworks` (compliance_threshold, import_source), `signals` (content_hash for deduplication). Export from schema index, run `drizzle-kit push`.
**Addresses:** Foundation for all five feature areas.
**Avoids:** Pitfall 1 — polymorphic `context_type` designed here before any feature code exists. Pitfall 3 — `content_hash` column added before any polling code is written.

### Phase 2: Assessment Engine
**Rationale:** Both Vendor Lifecycle and Compliance Flow are blocked until this ships. It is the single most critical deliverable in v2.0. Building it as a shared service from day one eliminates the fork risk.
**Delivers:** `assessment-engine.ts` service (session state machine, AI question generation persisted at session creation, async scoring), `assessments.ts` routes, pre-built templates (Vendor Security, Compliance Control, Incident), `"assessment"` task type added to `LLMTaskType` in `llm-service.ts`, `score_assessment_response` job worker, OpenAPI spec entries, Orval client regeneration. Compatibility view `questionnaires_compat` created to avoid breaking existing scorecard and agent consumers.
**Addresses:** Table stakes — conditional branching (JSON rules), numeric scoring, pre-built templates; Differentiators — AI-driven non-deterministic questions, shared engine for vendor + compliance.
**Avoids:** Pitfall 1 (polymorphic context finalized in schema before any handler code), Pitfall 2 (questions generated once at session creation, persisted, never re-queried from LLM), Pitfall 16 (compatibility view protects existing `questionnaires` consumers during migration).

### Phase 3: Vendor Lifecycle Redesign
**Rationale:** Depends on Assessment Engine (Phase 2). Can run in parallel with Phase 4 (Signal Integrations). The wizard's server-side draft persistence is the key design decision to make before building any UI.
**Delivers:** Multi-step onboarding wizard with server-side `onboarding_data` JSONB draft persistence (survives navigate-away, browser crash), AI enrichment auto-triggered on status transition to `due_diligence`/`risk_assessment`, 4th party risk data model (`vendor_fourth_party_links`) + UI, continuous monitoring schedule (per-tier cadence configs, scheduled job creates new assessments, alerts on score threshold breach), vendor risk score aggregated from latest assessment.
**Addresses:** Table stakes — vendor wizard, continuous monitoring; Differentiators — 4th party risk, AI enrichment during onboarding.
**Avoids:** Pitfall 3 (wizard state persisted server-side via `onboarding_data`; `useBlocker` guard on navigate-away), Pitfall 4 (4th party monitoring uses single JOIN/CTE query, not nested loops — N+1 chain in `monitoring.ts` is a documented trap).

### Phase 4: Signal Integrations
**Rationale:** Depends only on Schema Foundation (Phase 1). Independent of Assessment Engine and Vendor Lifecycle. Signal data produced here feeds Foresight v2 OSINT calibration in Phase 6 — sequencing this before Foresight produces the best end-user experience.
**Delivers:** `integration-config.ts` (per-tenant encrypted credential CRUD), `signal-feed-poller.ts` (adapter pattern with Shodan/NVD/MISP/Sentinel/email implementations), `integrations.ts` API routes, `email-ingestion.ts` (IMAP IDLE + MIME parsing), Settings UI for integration configuration, `SIGNAL_SOURCES` registry constant replacing all hardcoded source string literals.
**Addresses:** Table stakes — CVE/NVD, Shodan, SIEM (Sentinel); Differentiators — MISP, email ingestion.
**Avoids:** Pitfall 4 (multi-tenant `integration_configs`, never env vars), Pitfall 5 (`SIGNAL_SOURCES` registry defined before first feed — grep all source string literals first), Pitfall 6 (deduplication already in schema from Phase 1; `ON CONFLICT DO NOTHING` in all adapters), Pitfall 7 (resilience layer: transient errors retry with exponential backoff; permanent errors dead + alert; `integration_health` table for circuit breaker state), Pitfall 8 (NVD pagination loop with 600ms delay; `lastSyncTimestamp` per tenant), Pitfall 9 (MISP per-tenant config; test API key permissions at config-save time), Pitfall 10 (Sentinel via Log Analytics API — verify current endpoint against official docs before writing auth code), Pitfall 11 (email prompt injection: content delimiters, HTML strip, 4000-char truncation, no auto-promotion).

### Phase 5: Compliance Flow
**Rationale:** Depends on Assessment Engine (Phase 2). Compliance assessment is the Assessment Engine with `context_type = "compliance"` — no new engine code required, just new routes and UI. Can run in parallel with Phase 4 if resourcing allows; sequencing after Phase 4 is lower risk.
**Delivers:** Framework import (`POST /api/v1/frameworks/import` — additive upsert with diff preview and rollback-capable transaction), compliance assessment sessions via shared Assessment Engine, per-framework pass/fail threshold configuration merged into the existing `checkComplianceDrift()` monitoring check.
**Addresses:** Table stakes — framework import, compliance threshold configuration, assessment-to-control linkage.
**Avoids:** Pitfall 12 (import is additive-only: upsert + `deprecated_at` + preview diff; never DELETE + re-insert), Pitfall 13 (threshold alert creation consolidated with existing `compliance_drift` check — audit all `createAlert()` call sites before writing new alert code to prevent duplicate alert types).

### Phase 6: Foresight v2
**Rationale:** Depends on Signal Integrations (Phase 4) for OSINT calibration data. Monte Carlo core can ship on manual parameter inputs first; OSINT calibration wires in when signal data exists. This is correctly the final phase — it integrates output from all previous phases.
**Delivers:** `monte-carlo.ts` simulation engine (async via job queue, 202 Accepted + client poll), named scenario builder with risk register linkage, loss exceedance curve (recharts v3.8 upgrade — histogram/density charts), OSINT calibration from CVE/MISP signals with staleness indicators, ALE dashboard widget, FAIR-labeled simulation inputs.
**Addresses:** Table stakes — Monte Carlo simulation, loss exceedance curve; Differentiators — FAIR labels, OSINT calibration, scenario modeling.
**Avoids:** Pitfall 14 (simulation runs in job queue worker; never synchronous in route handler; `setImmediate` chunking or Worker Threads for > 50k iterations), Pitfall 15 (`source_event_timestamp` stored from feed payloads; Foresight UI shows data freshness; staleness warning if data older than 7 days).

### Phase Ordering Rationale

- **Schema before everything:** All phases require schema to exist. Schema has no code dependencies — it is pure DDL that can be applied in a single migration file. Running it first eliminates mid-development migration conflicts and lets all phases use the correct table shapes.
- **Assessment Engine before Vendor and Compliance:** Both features are blocked without it. This is also the highest-risk architectural decision (polymorphic context design) — getting it wrong early is less costly than retrofitting it after two dependent phases are built.
- **Signal Integrations parallel to Vendor Lifecycle:** They share only the Schema Foundation dependency and have no mutual dependency. Teams can work these tracks simultaneously if resourcing allows.
- **Compliance Flow after Assessment Engine:** Compliance assessment is trivially `context_type = "compliance"` in the shared engine — the heavy lifting is done in Phase 2. Sequencing it after Vendor Lifecycle reduces risk (one new context_type at a time) but parallel is viable.
- **Foresight last:** Uses signal data from Phase 4 for OSINT calibration. Shipping Foresight before signals exist limits OSINT calibration to manual inputs — acceptable for an MVP cut, but Phase 4 → Phase 6 ordering produces the full feature.
- **All external integrations multi-tenant from day one.** Per-tenant encrypted credential storage is a design constraint, not an enhancement. Retrofitting it after shipping single-tenant integrations is costly.

### Research Flags

Phases likely needing deeper `/gsd:research-phase` during planning:
- **Phase 4 (Signal Integrations — Sentinel sub-feature):** Azure Log Analytics API auth scopes and KQL query shape for fetching SecurityIncident records require validation against current Microsoft docs before implementation starts. The deprecated SIEM agent documentation still appears prominently in search results — confirming the correct endpoint before writing any auth code is a day-one task.
- **Phase 4 (Signal Integrations — MISP sub-feature):** MISP instance API behavior varies between versions. Verify the correct auth header format and event/attribute endpoint shapes against the target MISP version in use.
- **Phase 6 (Foresight v2 — Worker Threads decision):** The 200ms benchmark for 10k iterations is from research, not a measured run. Validate against actual risk register data before deciding whether `setImmediate` chunking is sufficient or Worker Threads are needed at v2.0 scale.

Phases with well-documented patterns (skip research-phase):
- **Phase 1 (Schema Foundation):** Pure Drizzle schema additions following established patterns in `lib/db/src/schema/`. New tables, nullable column additions — safe migration patterns confirmed.
- **Phase 2 (Assessment Engine):** The existing `interview_sessions` pattern (`routes/interviews.ts`) is the direct model — same transcript shape, same AI streaming pattern, same async job queue for scoring.
- **Phase 3 (Vendor Lifecycle):** Multi-step wizard pattern established with React Hook Form + Zod + shadcn/ui. Server-side draft persistence via JSONB is standard Postgres. Vendor enrichment auto-trigger uses the existing `enqueueJob` pattern.
- **Phase 5 (Compliance Flow):** Framework import as additive upsert is a well-understood database pattern. The assessment integration directly reuses the Phase 2 engine.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified against npm registry with publish dates; alternatives considered and rejected with rationale; existing stack confirmed via codebase inspection; only MISP `p-ratelimit` version unconfirmed |
| Features | MEDIUM-HIGH | Industry patterns verified via multiple sources; competitor analysis grounded; AI-driven branching and OSINT Monte Carlo differentiation well-supported; specific implementation details from vendor docs |
| Architecture | HIGH | Derived from full codebase inspection + official API documentation for all external integrations; build order verified against dependency graph; anti-patterns identified with specific code locations |
| Pitfalls | HIGH (existing system) / MEDIUM (external APIs) | Pitfalls 1–4, 12–16 verified against actual codebase code paths with file references; Pitfalls 5–11 from official API docs and community evidence |

**Overall confidence:** HIGH

### Gaps to Address

- **`p-ratelimit` version confirmation:** STACK.md notes `^1.2.0` was not confirmed from npm at research time — verify before installing.
- **Monte Carlo iteration benchmark:** The ~200ms estimate for 10k iterations is from research, not a measured run on this codebase. Validate before deciding Worker Threads are unnecessary.
- **Recharts v3 migration effort:** The actual impact of v3 axis/tooltip prop changes on existing recharts usage in the codebase has not been audited — review existing charts before upgrading.
- **`questionnaires` table consumer audit:** A full `grep` of `questionnaires` references is needed at Phase 2 start to find all consumers that need the compatibility view before the source of truth migrates.
- **Shodan rate limit per tenant:** Production rate limits depend on the API plan each tenant configures. The `p-ratelimit` configuration must be per-tenant configurable, not hardcoded to free-tier limits.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `artifacts/api-server/src/`, `lib/db/src/schema/`, `docs/ARCHITECTURE.md` — existing job queue, encryption, signal pipeline, interview session patterns
- npm registry: `imapflow` (v1.2.9, published 2026-03-17), `mailparser` (v3.9.4), `@azure/identity` (v4.13.0), `simple-statistics` (v7.8.8), `recharts` (v3.8.0), `node-cron` (v4.2.1) — versions and publish dates verified
- NVD CVE API v2 official docs (`nvd.nist.gov/developers/start-here`) — rate limits, pagination, incremental sync
- Microsoft Sentinel REST API official docs (`learn.microsoft.com/en-us/rest/api/securityinsights/`) — API version 2024-09-01 confirmed current; SIEM agent retirement confirmed November 2025
- MISP OpenAPI spec (`misp-project.org/openapi/`) — REST API confirmed, no maintained Node.js client
- FAIR Institute — loss exceedance curve methodology and Monte Carlo cyber risk quantification

### Secondary (MEDIUM confidence)
- Shodan Developer API docs (`developer.shodan.io/api`) — REST endpoints confirmed; official Node.js clients page shows only stale options
- `@azure/arm-securityinsight` npm (`@1.0.0-beta.6`) — perpetual beta; stable since 2022
- ServiceNow GRC Smart Assessment Engine blog series — assessment engine feature patterns
- ISACA: AI/ML in Third-Party Risk Assessment 2025 — feature prioritization context
- TPRM lifecycle sources: ComplyJet, UpGuard, Panorays, TrustCloud — vendor lifecycle patterns
- Monte Carlo for enterprise risk: RiskImmune, Kovrr — simulation design patterns
- MISP integrations 2025: Cosive — MISP feed patterns and integration approaches
- Microsoft Sentinel custom connector guide (Microsoft Learn) + D3 Security webhook docs
- 4th party risk: SecurityScorecard, Risk Ledger — data model and regulatory context
- `p-ratelimit` GitHub — TypeScript native, version unconfirmed at research time

### Tertiary (LOW confidence — validate during implementation)
- `@azure/arm-securityinsight` SDK method signatures — verify before building Sentinel adapter; beta API surface
- Monte Carlo Node.js performance (~200ms for 10k iterations) — from training data, not a measured benchmark on this codebase

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
