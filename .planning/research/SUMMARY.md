# Project Research Summary

**Project:** RiskMind v2.1 — Enterprise Parity & Agent-Ready Foundation
**Domain:** Enterprise GRC Platform (Governance, Risk & Compliance)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

RiskMind v2.1 is an enterprise GRC platform expansion adding eleven features to close competitive gaps with Vanta, Drata, and ServiceNow GRC while simultaneously laying the agent-ready foundation for the v2.2 agentic GRC department milestone. The research makes clear that these eleven features are not independent modules — they form a strict dependency graph where four infrastructure primitives (webhook/event bus, approval workflow engine, task system, multi-entity schema) must be built before any domain feature ships. The recommended approach is to treat v2.1 as two concentric layers: a durable infrastructure layer that every domain feature routes through, followed by domain features (policy, evidence, audit, AI governance) that consume that infrastructure cleanly.

The stack decision is conservative by design: no new infrastructure dependencies are required. All new capabilities are built on the existing Express 5 / React 19 / Drizzle / PostgreSQL stack. The only net-new packages are `nodemailer ^8.0.4`, `@react-email/components ^1.0.10`, and `@react-email/render ^1.0.10` for email delivery — everything else (PDF generation, event bus, approval state machine, task storage) is achieved by extending existing patterns. The existing PostgreSQL-backed job queue already handles retry, backoff, and dead-letter queuing at production quality. Adding Redis, a workflow engine, or a message broker for this problem scale would be over-engineering with no benefit.

The central risk in v2.1 is schema design errors that are expensive to recover from: policy content stored in-place without a version table, per-feature approval tables instead of a generic engine, and `entity_id NOT NULL` migration without expand-migrate-contract. Each of these is a "never acceptable" shortcut per PITFALLS.md — the recovery cost is HIGH once live data exists. The mitigation is to build the correct schema from the first migration and verify against the "looks done but isn't" checklist in PITFALLS.md before each phase ships.

## Key Findings

### Recommended Stack

The existing stack (Express 5, React 19, Vite 7, Drizzle ORM, Zod 3.25.76, shadcn/ui, Tailwind v4, PostgreSQL 16 + pgvector, the custom job queue) is unchanged for v2.1. Only email delivery libraries are net-new. PDF generation uses `@react-pdf/renderer ^4.3.2` which is already installed in the frontend workspace — it needs to be imported server-side in `api-server` only (not browser-side), with `external: ['@react-pdf/renderer']` in `build.ts` if esbuild fails on ESM resolution. Zod 3.25.76 and drizzle-zod must not be upgraded — the Orval-generated client depends on stable Zod 3.

**Core technologies (new for v2.1):**
- `nodemailer ^8.0.4`: Outbound SMTP email for notifications and escalations — zero runtime deps, industry standard, ships its own TypeScript types in v8
- `@react-email/components ^1.0.10` + `@react-email/render ^1.0.10`: React-based email templates rendered server-side via `renderAsync()`; reuses team's existing React knowledge; backed by Resend team; cross-client compatible
- `@react-pdf/renderer ^4.3.2` (server-side only): Executive PDF generation without headless Chrome; already in the workspace; import in `api-server` via workspace hoisting

**What not to add:** BullMQ/Redis (job queue already handles this), XState (4-state approval machine is 10 lines of pure function), puppeteer (no 200MB headless Chrome binary for structured PDFs), MJML/Handlebars (React email solves this without a second template engine), EventEmitter2/mitt (in-memory pub/sub has no persistence or delivery guarantee).

See `.planning/research/STACK.md` for full version compatibility, installation commands, and "what not to change" constraints.

### Expected Features

All eleven v2.1 features are table stakes or competitive differentiators for enterprise GRC. Fifteen features are P1 (milestone fails without them) or P2 (competitive parity and differentiation). Three are P3 (defer if time-constrained).

**Must have (table stakes — enterprise GRC buyers assume these exist):**
- Policy document versioning with immutable history and lifecycle status (DRAFT → REVIEW → APPROVED → PUBLISHED → RETIRED)
- Policy-to-control linkage (many-to-many)
- Employee policy attestation tracking
- Evidence records with control linkage, expiry tracking, and SHA-256 integrity hash
- Audit workspace with evidence request management and bundle generation
- Cross-framework control mapping with evidence reuse and sufficiency confirmation
- Email notifications for assignments and due dates with SLA escalation chains
- Executive compliance status PDF with ALE risk quantification
- Task/work item system with SLA alerts
- Webhook outbound for state changes (HMAC-signed, async, retry with backoff)
- Generic approval workflow (approve/reject/escalate) across all entity types

**Should have (competitive differentiators):**
- AI policy generation from linked control requirements (LLM draft from framework context — primary v2.1 differentiator)
- AI governance model registry with EU AI Act risk classification (first-mover window before August 2026 enforcement deadline)
- ISO 42001 and NIST AI RMF as native framework bundles (not in Vanta/Drata standard libraries)
- Agent-ready task system (assignee field supports future agent IDs — foundation for v2.2)
- Internal event bus as agent orchestration backbone (domain events become agent triggers in v2.2)
- Multi-entity schema foundation (avoids costly migration when enterprise customers with subsidiaries arrive)

**Defer to v2.2 or later:**
- External auditor portal with separate login (requires full auth product track)
- No-code workflow builder (agentic layer replaces this need in v2.2)
- SCIM/directory sync (after Microsoft OAuth in v2.3)
- Multi-entity consolidated UI dashboards (schema laid in v2.1; UI in v2.2)
- Custom PDF report builder drag-and-drop (v3)
- Jira/Slack outbound webhook integrations (v2.2 once webhook system is stable)

See `.planning/research/FEATURES.md` for the full dependency graph, competitor analysis table, and prioritization matrix.

### Architecture Approach

V2.1 is a purely additive expansion to the existing system. All new code consists of 14 new schema files, 9 new route files, 6 new lib service files, and 5 new workers registered via the existing `registerWorker` pattern. Existing files receive at most one new line each (`await emitEvent(...)` after state mutations in vendor/risk/compliance routes). The architecture deliberately extends four existing patterns: polymorphic `context_type/context_id` (from assessments), job-queue-backed async work (from ai-workers), Drizzle enum state machines (from vendor lifecycle `allowed-transitions.ts`), and `recordAudit` for immutable audit trail writes (from all mutating routes).

**Major new components:**
1. `event-bus.ts` — Translates domain events to durable job queue entries; all state-change notifications and webhook deliveries route through here; `emitEvent()` is a thin wrapper that writes to `jobs` and returns immediately
2. `workflow-engine.ts` — Generic approve/reject/escalate state machine; single `approval_requests` table serves all entity types via `context_type` enum; `canApprovalTransition()` is 10 lines of pure function
3. `notification-service.ts` — Creates in-app notification records and enqueues email delivery jobs; event-driven (scheduled jobs at entity creation time, not polling cron)
4. `policy-engine.ts` — Version snapshots into separate `policy_versions` table (append-only), AI draft generation via existing `llm-service.ts`, approval orchestration via `workflow-engine.ts`
5. `evidence-collector.ts` — Auto-collection via integration adapters, expiry tracking, SHA-256 integrity hash at collection time
6. `report-generator.ts` — Async PDF generation via `@react-pdf/renderer`; returns 202 Accepted with job ID; never blocks the request thread

**Key architectural constraints:**
- `notifications` table is distinct from the existing `alerts` table — different consumers, different lifecycle, different UI surfaces
- `audit_records` table for Audit Hub is distinct from the existing `audit_events` changelog — auditors see compliance-material events only, not every API call
- `ai_systems` table is distinct from `llm_configs` — AI governance registers business applications, not model configurations

See `.planning/research/ARCHITECTURE.md` for the full component diagram, data flow sequences, build groups, and anti-patterns.

### Critical Pitfalls

1. **Multi-entity migration without expand-migrate-contract** — Never add `entity_id NOT NULL` in a single migration against live tables. Use nullable first, backfill via job queue, add FK constraint and index second, tighten to NOT NULL only after all rows are populated. ALTER on ten tables simultaneously holds locks; use `ADD COLUMN` with a nullable default to avoid it. Recovery cost: HIGH.

2. **Approval workflow built per-feature** — Building `policy_approvals`, `evidence_approvals`, and `vendor_approval_stages` as separate tables is unrecoverable debt that blocks v2.2 agent approvals. The single `approval_requests` table with `context_type` enum must exist and be wired before any feature that needs approvals starts. Recovery cost: HIGH.

3. **Synchronous webhook delivery in request path** — `emitEvent()` must only write a row to `jobs` and return immediately. Never call external HTTP endpoints inside a `db.transaction()` block. A slow or failing subscriber must not delay the API response or roll back the resource creation. Recovery cost: MEDIUM.

4. **Policy versioning in-place** — Storing policy content as a column on the `policies` row (overwritten on edit) permanently loses audit history. `policy_versions` as a separate append-only child table must be in the first migration. This is a direct ISO 27001 clause 7.5 / SOC 2 CC5.2 requirement. Recovery cost: HIGH.

5. **Evidence without integrity hash** — SHA-256 `content_hash` must be computed and stored at collection time and made immutable via the API (`PATCH /evidence/:id` returns 400 if attempting to update `content_hash` or `collected_at`). Without it the platform cannot assert tamper-evidence during audits. Recovery cost: MEDIUM (cannot recover hash for files whose content was already modified).

6. **AI governance registry conflating AI system with model** — The `ai_systems` table must be distinct from `llm_configs`. EU AI Act Article 49 compliance requires registering AI *systems* (business applications with purpose, risk class, data inputs) — not the underlying models. A system persists through model rotations; an `ai_system_model_history` join table tracks which `llm_configs` powered a system over time. Recovery cost: MEDIUM.

7. **Notification polling instead of event-driven scheduling** — Never implement SLA notifications as a cron job scanning all open tasks/evidence/policies. Create a scheduled job at entity creation time using the existing `scheduledAt` field on the `jobs` table. Polling scales badly beyond 5 tenants and causes periodic DB load spikes. Recovery cost: LOW (refactoring is straightforward but requires touching all entity creation paths).

See `.planning/research/PITFALLS.md` for the full 10-pitfall catalog, technical debt table, security mistakes, performance traps, "looks done but isn't" verification checklist, and recovery strategies.

## Implications for Roadmap

Based on combined research, the recommended phase structure follows the feature dependency graph strictly. Infrastructure primitives must be complete before domain features start. Several domain features can be built in parallel within their dependency layer. The UI layer is a single final phase after all APIs are complete.

### Phase 1: Infrastructure Primitives
**Rationale:** Four features form the foundation that every subsequent feature depends on. The webhook/event bus is the internal backbone — notifications, SLA alerts, and v2.2 agent triggers all route through it. The approval engine must precede policy management and evidence collection to prevent per-feature workflow tables (the single most expensive pitfall). The task system must precede the Audit Hub. Multi-entity schema must be first because `entity_id` columns must exist on all core tables before any new table references them, and the expand-migrate-contract pattern requires time for backfill to complete.
**Delivers:** Durable job-queue-backed event bus, generic approval state machine (single `approval_requests` table), task/work item CRUD with SLA-scheduled notification jobs, entity hierarchy schema with backward-compatible nullable `entity_id` on all core tables
**Features addressed:** Webhook/Event System, Approval Workflow Engine, Task/Work Item System, Multi-Entity Schema
**Pitfalls avoided:** 1 (entity migration), 2 (per-feature approvals), 3 (synchronous events), 7 (task orphans), 8 (notification polling)
**Research flag:** Standard patterns — all four patterns exist in the codebase already; no additional research needed

### Phase 2: Policy Management
**Rationale:** Depends on the approval engine and event bus from Phase 1. Policy versioning is the highest-risk schema decision in v2.1 — immutable history via a child table is unrecoverable if skipped. AI policy generation is the primary v2.1 differentiator and builds directly on the existing `llm-service.ts`.
**Delivers:** Versioned policy lifecycle (draft → approved → published) with immutable `policy_versions` child table, policy-to-control linkage, approval flow wired to Phase 1 engine, AI-generated policy drafts, employee attestation tracking with overdue events
**Stack used:** `workflow-engine.ts` (approval step), `event-bus.ts` (policy.approved event), `llm-service.ts` (AI draft), `notification-service.ts` (approver alerts)
**Pitfalls avoided:** 4 (in-place policy versioning)
**Research flag:** Standard patterns — policy versioning is well-documented in GRC literature; AI generation reuses existing `llm-service.ts` pattern

### Phase 3: Evidence Collection
**Rationale:** Independent of Policy Management (can be built in parallel with Phase 2 if resourcing allows). Depends only on Phase 1 infrastructure. Must ship before Audit Hub (Phase 4) because audit bundles consume evidence records. The integrity hash requirement must be in the initial migration.
**Delivers:** Evidence records with control linkage, file upload with SHA-256 `content_hash` integrity at collection time, expiry tracking with scheduled notification jobs, auto-collection flag, evidence status lifecycle (ACTIVE/EXPIRING/EXPIRED/ARCHIVED)
**Stack used:** Existing `multer ^2.1.1` disk storage pattern, `notification-service.ts` (expiry alerts), `tasks.ts` routes (remediation tasks on expired evidence)
**Pitfalls avoided:** 5 (evidence without integrity hash)
**Research flag:** Standard patterns — follows existing multer/uploads disk storage convention exactly

### Phase 4: Audit Hub
**Rationale:** Requires both evidence records (Phase 3) and tasks (Phase 1). The critical architecture decision is to use a separate `audit_records` table for compliance-material events, not the existing `audit_events` system changelog. Scoped JWT pattern for auditor tokens needs confirmation before schema finalization.
**Delivers:** Audit workspaces with evidence request management (requests as tasks), evidence bundle generation (ZIP with manifest), compliance event audit trail in separate `audit_records` table, time-limited auditor share tokens (scoped JWT, no account creation required)
**Pitfalls avoided:** 10 (audit_events used as Audit Hub data source)
**Research flag:** Needs review — scoped JWT token claims, expiry enforcement, and scope validation logic should be prototyped before Phase 4 schema is finalized; multi-evidence ZIP assembly approach should be confirmed

### Phase 5: Cross-Framework Control Mapping
**Rationale:** No new schema required (reuses existing `control_requirement_maps` which already exists in the codebase). New API query endpoints and UI surfaces only, plus `sufficiency_status` and `implementation_note` columns added to the existing join table. Can be built in parallel with Phase 4 if resourcing allows.
**Delivers:** Evidence reuse view across frameworks, framework overlap analysis (SOC 2 ↔ ISO 27001 overlap visualization), gap view (uncovered requirements, evidence gaps), sufficiency confirmation per mapping to prevent compliance score double-counting
**Pitfalls avoided:** 6 (cross-framework score double-counting)
**Research flag:** Standard patterns — query layer over existing schema; no novel infrastructure needed

### Phase 6: Notifications and Escalations
**Rationale:** The event bus from Phase 1 handles emission; this phase wires the notification consumer side. Builds email delivery pipeline, in-app notification inbox, per-user preferences, and escalation chains. Must be explicitly event-driven — scheduled jobs at entity creation time, never polling cron scanning large tables.
**Delivers:** In-app notification inbox (separate from existing `alerts` bell), SMTP email delivery via nodemailer + React Email templates, per-user notification preferences (channel + digest), SLA escalation chains (escalation_rules table with delay_hours and escalate_to_user_id), optional daily/weekly digest emails
**Stack used:** `nodemailer ^8.0.4`, `@react-email/render ^1.0.10`, `@react-email/components ^1.0.10`, existing job queue `scheduledAt` field
**Pitfalls avoided:** 8 (notification polling causing DB load spikes)
**Research flag:** Standard patterns — nodemailer + React Email integration is officially documented; event-driven scheduling pattern is established in codebase

### Phase 7: Executive Reporting (PDF)
**Rationale:** Depends on all domain data being available (policies approved, evidence collected, Foresight ALE already computed). Build last among domain features so the PDF template has real data. PDF generation must be async (202 Accepted pattern) — synchronous PDF rendering in the request handler blocks Node.js and times out under load.
**Delivers:** Async PDF generation (202 + job ID + poll endpoint), compliance posture section (per-framework control coverage %, open gaps), risk summary section (top risks by score + ALE from existing Foresight data), evidence pack summary, report scheduling (monthly/quarterly auto-generation with email delivery)
**Stack used:** `@react-pdf/renderer ^4.3.2` (server-side), existing Foresight ALE data, reports stored in existing `documents` table
**Pitfalls avoided:** Blocking PDF generation in request handler (documented in ARCHITECTURE.md anti-patterns)
**Research flag:** One known issue — `@react-pdf/renderer` ESM/esbuild compatibility; add `external: ['@react-pdf/renderer']` to `build.ts` if needed; if workaround fails, isolate PDF generation in a separate Node.js worker process. Validate in a Phase 7 spike before full implementation.

### Phase 8: AI Governance
**Rationale:** Builds on existing frameworks/controls/assessment engine. The EU AI Act enforcement deadline (August 2026) makes this a time-sensitive differentiator — shipping a compliant AI governance registry before competitors is a genuine first-mover window. The critical schema decision (`ai_systems` distinct from `llm_configs`) must be established in the initial migration.
**Delivers:** AI system registry (`ai_systems` table, distinct from `llm_configs`) with EU AI Act risk classification (UNACCEPTABLE/HIGH/LIMITED/MINIMAL), `ai_system_model_history` join table for model rotation tracking, ISO 42001 framework bundle (pre-built Annex A control set), NIST AI RMF framework bundle (GOVERN/MAP/MEASURE/MANAGE), AI model-to-control linkage, AI risk assessment via existing assessment engine with AI governance template
**Pitfalls avoided:** 9 (AI governance conflated with model configs)
**Research flag:** Needs review — ISO 42001 Annex A control IDs and titles + NIST AI RMF 1.0 sub-category content must be verified against the published standards before the framework bundles are authored; content errors in pre-built bundles are hard to fix after customer import

### Phase 9: UI Layer
**Rationale:** All API surfaces from Phases 1-8 complete before UI starts. Orval codegen runs once after all OpenAPI specs are updated, generating a clean, complete client for all new endpoints simultaneously. Building UI after APIs avoids repeatedly regenerating the client as new endpoints are added across phases.
**Delivers:** All new frontend pages — policy management (list, detail, version history, attestation), evidence collection (list, upload, expiry dashboard), audit hub (workspace, request management, bundle download), task center (inbox, kanban or list view), notification inbox (bell expansion + /notifications page), AI governance registry (system list, EU AI Act classification), executive reports (generate, download, schedule), cross-framework mapping (heatmap + gap view)
**Stack used:** Existing shadcn/ui, Tailwind v4, React Query (via Orval-generated hooks), ECharts for mapping heatmap visualization
**Research flag:** Standard patterns — follows existing page/component conventions throughout; Orval regeneration is well-established in the codebase

### Phase Ordering Rationale

- **Infrastructure before domain is mandatory:** The event bus, approval engine, and task system are consumed by every subsequent phase. Building any domain feature before these forces per-feature workarounds that require HIGH-cost refactoring.
- **Policy and Evidence can be parallelized:** They share only Phase 1 infrastructure as a dependency and have no mutual dependency. If two engineers are available, Phases 2 and 3 can be worked simultaneously.
- **Audit Hub after Evidence is required:** Audit bundles consume existing evidence records; the sequence cannot be reversed.
- **Cross-Framework Mapping can run in parallel with Audit Hub:** It requires no new schema and no Phase 3/4 output.
- **Notifications after first domain features:** Ensures there are real events to test when the email delivery pipeline is validated.
- **Executive Reporting last among domain features:** Requires real data from policies, evidence, and Foresight ALE to be meaningful.
- **UI after all API:** Prevents repeated Orval codegen cycles as new endpoints are added phase by phase.
- **AI Governance is independent:** If the EU AI Act timeline creates urgency, Phase 8 can be moved to run in parallel with Phase 3 or 4 — it depends only on existing frameworks/controls/assessment engine, not on any other v2.1 feature.

### Research Flags

Phases requiring deeper research during planning:
- **Phase 4 (Audit Hub):** Scoped JWT token claims, expiry enforcement, and scope validation against `audit_request_id` should be prototyped before schema finalization. Multi-evidence ZIP assembly approach (streaming vs in-memory) should be confirmed for evidence bundles with large file counts.
- **Phase 8 (AI Governance):** ISO 42001 Annex A control IDs/titles and NIST AI RMF 1.0 sub-category content must be sourced from the published standards text before the pre-built framework bundle JSON is authored. EU AI Act Article 49 obligation specifics (registration, transparency obligations by risk tier) should be confirmed against the current regulation text.
- **Phase 7 (Executive Reporting):** `@react-pdf/renderer` ESM/esbuild compatibility should be validated in a one-day spike before committing to the full implementation; fallback to a separate worker process if needed.

Phases with well-documented, standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** All four patterns exist in the live codebase — job queue for async work, polymorphic `context_type` from assessments, Drizzle enum state machines from `allowed-transitions.ts`, nullable column migrations
- **Phase 2 (Policy Management):** Policy versioning is well-documented in GRC literature; approval wiring reuses Phase 1 engine; AI generation reuses `llm-service.ts`
- **Phase 3 (Evidence Collection):** Follows existing multer/`uploads/evidence/` disk storage pattern exactly
- **Phase 5 (Cross-Framework Mapping):** Query layer over existing `control_requirement_maps`; adds two columns to an existing join table
- **Phase 6 (Notifications):** Nodemailer + React Email integration is officially documented with `renderAsync` + `sendMail` pattern verified
- **Phase 9 (UI Layer):** Follows existing page/hook/component conventions; Orval codegen is established

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified against npm registry on 2026-03-26; existing stack constraints verified by direct codebase inspection; one MEDIUM exception: @react-pdf/renderer ESM/esbuild issue has a documented workaround (add `external` flag) but the GitHub issue #2624 remains open |
| Features | MEDIUM-HIGH | Table stakes verified against Vanta, Drata, ServiceNow official docs and GRC analyst sources; AI governance differentiators cross-referenced with ISO 42001 official guidance and ISACA; competitor gaps are well-established; AI governance framework content (ISO 42001 Annex A, NIST AI RMF sub-categories) needs validation against published standard text |
| Architecture | HIGH | Derived entirely from direct codebase inspection of live schema files, route handlers, lib services, and job queue — not from external training data assumptions; integration points verified against actual file paths and function signatures; build groups derived from the actual dependency graph |
| Pitfalls | HIGH (codebase-specific) / MEDIUM (external standards compliance) | Pitfalls 1–4, 7–8, 10 verified against actual code patterns with specific file references; pitfalls 5–6, 9 from official compliance docs, regulatory text, and community research |

**Overall confidence:** HIGH

### Gaps to Address

- **ISO 42001 Annex A and NIST AI RMF sub-category content:** The research confirms framework structure and risk tier taxonomy but does not enumerate every control ID and description. A dedicated research sub-task during Phase 8 planning must source the full control set from the published standard texts before the framework bundle JSON is authored.
- **EU AI Act Article 49 registration obligations by risk tier:** The regulation's specific transparency and registration requirements for HIGH and LIMITED risk AI systems should be confirmed against the current regulation text before the AI governance UI labels and tooltips are written.
- **Evidence auto-collection integration adapters:** FEATURES.md marks evidence as `auto_collected` via existing `integration_configs`, but the specific adapter interfaces for pulling evidence from external sources (cloud config APIs, SSO audit logs) are not fully specified. For v2.1, manual upload + `auto_collected` flag satisfies the schema requirement; full auto-collection adapters are a v2.2 concern.
- **Auditor share token validation logic:** The scoped JWT pattern for time-limited auditor access is architecturally clear but the `auditorMiddleware` validation logic (token claims structure, expiry enforcement, scope check against `audit_request_id`) should be prototyped before Phase 4 schema is finalized.
- **@react-pdf/renderer server-side build:** The known ESM issue (#2624) has a workaround but remains open upstream. Validate the `external` flag approach in a Phase 7 spike before full implementation. Fallback: isolate PDF generation in a separate Node.js subprocess.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `/home/dante/RiskMind2/lib/db/src/schema/` — all existing schema files, table shapes, enum definitions
- Direct codebase inspection: `/home/dante/RiskMind2/artifacts/api-server/src/` — routes, lib services, app.ts, job-queue.ts, allowed-transitions.ts
- Direct codebase inspection: `/home/dante/RiskMind2/.planning/PROJECT.md` — v2.1 feature requirements and key architectural decisions
- `nodemailer` npm v8.0.4 — official package, confirmed current on 2026-03-26
- `@react-email/components` and `@react-email/render` npm v1.0.10 — official packages confirmed
- `@react-pdf/renderer` npm v4.3.2 — official package; React 19 support confirmed from v4.1.0
- React Email + Nodemailer integration docs — `renderAsync()` + `sendMail()` pattern verified
- Drata Audit Hub product page — evidence bundle and request management patterns (official product docs)
- ServiceNow evidence request workflow docs — official ServiceNow GRC documentation
- 6clicks hub-and-spoke multi-entity architecture — official product documentation
- SAP GRC notifications, reminders and escalations — official SAP documentation
- ISO/IEC 42001 and EU AI Act pairing — ISACA (2025), HIGH confidence

### Secondary (MEDIUM confidence)
- Vanta GRC product page — feature comparison and UCF-based cross-framework mapping
- GRC policy management guides (Sprinto, Centraleyes) — industry lifecycle patterns
- ISO 42001 implementation guide 2026 (SecurePrivacy) — framework structure overview
- Drata blog: Vanta vs OneTrust vs Drata comparison — competitive feature landscape
- Backward compatible database changes (PlanetScale) — expand-migrate-contract pattern
- Workflow engine database design patterns (Exception Not Found) — approval table design
- Webhook delivery at scale (Medium/techpreneurr) — async delivery requirement
- Approval workflow design patterns (Cflow) — state machine design
- Hub-and-spoke multi-entity GRC architecture (Risk Cognizance) — schema pattern
- Top GRC tools 2026 (Sprinto) — feature expectations

### Tertiary (referenced but needs validation)
- `@react-pdf/renderer` ESM issue #2624 — open GitHub issue; workaround documented but not resolved upstream; validate before committing to server-side PDF approach
- drizzle-zod Zod v4 compatibility issue #4406 — merged PR but not in 0.8.3 release range; not relevant for v2.1

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
