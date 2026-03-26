# Architecture Research

**Domain:** Enterprise GRC — policy, evidence, audit, workflow, notifications, multi-entity (v2.1)
**Researched:** 2026-03-26
**Confidence:** HIGH — derived from direct codebase inspection, not training data assumptions

---

## Existing Architecture Snapshot

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    React 19 + Vite 7 SPA                        │
│  pages/  hooks/  components/  lib/api-client-react (generated)  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP/JSON (same-origin :4000)
┌───────────────────────────────▼─────────────────────────────────┐
│              Express 5 API  (artifacts/api-server)              │
│  app.ts → /api router → authMiddleware → route handlers         │
│                                                                 │
│  lib/                          routes/                          │
│  ├── job-queue.ts              ├── risks, vendors, compliance   │
│  ├── assessment-engine.ts      ├── signals, findings, alerts    │
│  ├── llm-service.ts            ├── assessments, interviews      │
│  ├── audit.ts                  ├── foresight, agent, search     │
│  ├── encryption.ts             └── monitoring, integrations     │
│  └── [schedulers]                                               │
│                                                                 │
│  POST /mcp → MCP handler (AI agent integration)                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Drizzle ORM
┌───────────────────────────────▼─────────────────────────────────┐
│          PostgreSQL 16 + pgvector  (lib/db)                     │
│  schema/  migrations/  relations.ts                             │
│                                                                 │
│  Core tables: tenants, users, risks, vendors, frameworks,       │
│  controls, framework_requirements, control_requirement_maps,    │
│  assessments, assessment_templates, jobs, audit_events,         │
│  signals, findings, alerts, documents, llm_configs,             │
│  interview_sessions, agent_*, foresight_*, monitoring_configs   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Existing Patterns (reuse in v2.1)

| Pattern | Where Used | How v2.1 Reuses It |
|---------|-----------|---------------------|
| `tenant_id` on every table | All tables | Add to all new tables — non-negotiable |
| `pgEnum` for status fields | vendors, assessments, jobs, risks | New enums: policy_status, evidence_status, etc. |
| Polymorphic context_type | assessments, audit_events | approval_requests.context_type, tasks.context_type |
| `job-queue.ts` workers | ai-triage, ai-enrich, ai-assess, vendor-monitor | Notification delivery, evidence auto-collection, webhook dispatch |
| `audit.ts` / `audit_events` | All mutating routes | All new mutations call recordAudit |
| `enqueueJob` + `registerWorker` | ai-workers.ts, signal-feed-poller.ts | New workers for notifications, webhooks |
| Drizzle barrel export via index.ts | lib/db/src/schema/index.ts | Append new schema exports at bottom |
| Orval codegen (do not touch) | lib/api-client-react/, lib/api-zod/ | Run `pnpm codegen` after OpenAPI spec updates |
| authMiddleware + RBAC | routes/index.ts | All new routes go under authMiddleware block |

---

## New Components — What to Build

### 1. Schema Layer (lib/db/src/schema/)

New files to create and export from index.ts:

```
schema/
├── entities.ts                # Multi-entity: entities table (foundation)
├── policies.ts                # Policy records + version history
├── policy-versions.ts         # Immutable version snapshots
├── policy-control-maps.ts     # Junction: policy ↔ control M:M
├── evidence.ts                # Evidence records + expiry
├── audit-requests.ts          # Audit hub: audit request workspace
├── audit-evidence-bundles.ts  # Links audit_request → evidence items
├── approval-requests.ts       # Generic approval workflow (polymorphic)
├── tasks.ts                   # Task/work item system (polymorphic)
├── notifications.ts           # Notification records (in-app + email)
├── notification-prefs.ts      # Per-user notification preferences
├── webhook-configs.ts         # Tenant webhook endpoints
├── webhook-events.ts          # Event log for webhook dispatch
└── ai-model-registry.ts       # AI governance: model/system registry
```

**Key schema decisions:**

`entities` — add `entity_id uuid nullable` to risks, vendors, controls, frameworks. NULL means "belongs to root tenant entity". This is backward-compatible with all existing queries.

`approval_requests` — polymorphic table used by policies, evidence, vendor onboarding. One table, many use cases:
```
context_type: pgEnum ["policy", "evidence", "vendor_onboarding", "agent_action"]
context_id: uuid (FK by convention, not enforced — same pattern as assessments.context_id)
status: pgEnum ["pending", "approved", "rejected", "escalated", "withdrawn"]
decision_by: uuid → users
decision_at: timestamp
escalated_to: uuid → users
```

`tasks` — work item system:
```
context_type: pgEnum ["risk", "control", "vendor", "evidence", "audit", "policy", "finding"]
context_id: uuid
status: pgEnum ["open", "in_progress", "blocked", "completed", "cancelled"]
priority: pgEnum ["critical", "high", "medium", "low"]
due_at: timestamp (SLA anchor)
assigned_to: uuid → users
```

`policies` — with FK to controls (many-to-many via policy_control_maps junction):
```
status: pgEnum ["draft", "under_review", "approved", "published", "deprecated"]
version: integer (increments on each approved revision)
approved_by: uuid → users (FK)
framework_ids: uuid[] (array — denormalized for query speed, or junction table)
```

### 2. API Routes Layer (artifacts/api-server/src/routes/)

New route files:

```
routes/
├── policies.ts            # CRUD + versioning + AI generation + approval trigger
├── evidence.ts            # CRUD + file attachment + expiry + auto-collect flag
├── audit-hub.ts           # Audit requests, evidence bundles, auditor access tokens
├── approval-workflows.ts  # Generic approve/reject/escalate endpoints
├── tasks.ts               # Task CRUD + assignment + status transitions
├── notifications.ts       # In-app notification feed + mark-read
├── webhooks.ts            # Webhook config CRUD + delivery log
├── ai-governance.ts       # AI model registry CRUD + EU AI Act classification
└── executive-reports.ts   # PDF generation triggers + download
```

Register all under `authMiddleware` block in `routes/index.ts`.

### 3. Service/Worker Layer (artifacts/api-server/src/lib/)

New lib files:

```
lib/
├── event-bus.ts             # Internal event emission (wraps enqueueJob for webhook-dispatch)
├── notification-service.ts  # Create notification records + enqueue email delivery
├── policy-engine.ts         # Policy version snapshot, AI-generate draft, approval orchestration
├── evidence-collector.ts    # Auto-collection logic (scheduled + on-demand)
├── report-generator.ts      # PDF generation (puppeteer or pdf-lib)
└── workflow-engine.ts       # Generic approval state machine
```

New workers registered via `registerWorker`:

| Queue | Handler File | Trigger |
|-------|-------------|---------|
| `notification-dispatch` | notification-service.ts | notification record created |
| `webhook-dispatch` | event-bus.ts | any tracked entity state change |
| `evidence-auto-collect` | evidence-collector.ts | scheduled via agent-scheduler pattern |
| `report-generate` | report-generator.ts | executive report requested |
| `policy-ai-draft` | policy-engine.ts | AI policy generation requested |

---

## Integration Points — Existing → New

### Controls ↔ Cross-Framework Mapping

**Existing:** `control_requirement_maps` already implements control→framework_requirement M:M. This IS the cross-framework mapping table. What v2.1 adds is UI surface and API endpoints to make this queryable.

**New (query only, no schema change):** `GET /api/controls/:id/frameworks` joins `control_requirement_maps → framework_requirements → frameworks` and returns all frameworks a control satisfies.

**Also new:** `GET /api/frameworks/control-coverage` — for a given control list, which requirements are covered vs. gap.

### Policies ↔ Controls

Many-to-many via `policy_control_maps` junction:
```
policy_id → policies.id
control_id → controls.id
tenant_id (required on all junction tables)
```

When a policy is approved, emit event `policy.approved` → webhook-dispatch → notify control owners.

### Evidence ↔ Controls + Audit

Evidence records link to controls via `control_id` FK. Evidence bundles (for audits) are M:M via `audit_evidence_bundles`. The `audit_events` table already exists for immutable audit trail writes — the new Audit Hub is a UI workspace on top of `audit_requests` + `audit_evidence_bundles`, not a replacement for the existing audit trail.

### Approval Workflow ↔ Job Queue

Approval requests that time out (SLA breach) → enqueue escalation job → `notification-dispatch` queue → notify escalation target. This follows the existing job-queue pattern exactly: `enqueueJob("notification-dispatch", "escalation", { approvalRequestId }, tenantId, { delayMs: slaMs })`.

### Webhook/Event System ↔ Existing State Machines

The event bus wraps `enqueueJob`. Route handlers that currently mutate state simply call `emitEvent(tenantId, "vendor.status_changed", { vendorId, from, to })` after their existing DB write. The event bus inserts a `webhook_events` record and enqueues a `webhook-dispatch` job. No existing route logic changes — it's an additive call.

```typescript
// Additive pattern — existing route handler gets one extra line
await db.update(vendorsTable).set({ status: newStatus }).where(...);
await recordAudit(req, "vendor.status_changed", "vendor", id, { from, to });
await emitEvent(req.user.tenantId, "vendor.status_changed", { vendorId: id, from, to }); // NEW
```

### Tasks ↔ Assessment Engine + Agent

Tasks with `context_type: "risk" | "control" | "vendor"` are assignable work units. The existing agent system (agent-service.ts, tool-registry.ts) can enqueue tasks instead of directly mutating records — this is the foundation for v2.2 agent orchestration. For v2.1, tasks are human-assigned only.

### Multi-Entity ↔ All Core Tables

`entity_id uuid nullable` added to: `risks`, `vendors`, `controls`, `frameworks`, `assessment_templates`, `policies`, `tasks`. Default NULL. All existing queries work unchanged (NULL entity = root tenant entity). `entities` table stores entity hierarchy (parent_id for tree structure).

No existing API endpoints need changes for v2.1 — `entity_id` is an optional filter param added to list endpoints.

### Notifications ↔ Alerts (Existing)

The existing `alerts` table handles system-level risk/signal alerts. `notifications` is a separate concept: user-directed, action-required messages (e.g., "Policy awaiting your approval"). Do not conflate or merge. Alert bell in UI shows alerts; notification inbox shows notifications.

---

## Data Flow Changes

### New: Policy Lifecycle Flow

```
POST /api/policies (draft)
  → insert policies record (status: draft)
  → optionally enqueue policy-ai-draft job
  → [AI worker generates content, updates policy]

POST /api/policies/:id/submit-for-approval
  → insert approval_requests record (status: pending)
  → emitEvent("policy.submitted")
  → notification-dispatch → notify approvers

POST /api/approval-requests/:id/approve
  → update approval_requests (status: approved)
  → update policies (status: approved, approved_by, version++)
  → insert policy_versions snapshot
  → emitEvent("policy.approved")
  → webhook-dispatch → notify subscribers
```

### New: Evidence Collection Flow

```
POST /api/evidence (manual)
  → insert evidence record
  → link to control_id
  → recordAudit

Scheduled worker (evidence-auto-collect):
  → query controls with auto_collect_enabled=true
  → call integration adapter (existing integration_configs)
  → insert evidence record with auto_collected=true
  → if expiry < now: enqueue notification for control owner
```

### New: Audit Hub Flow

```
POST /api/audit-hub/requests
  → insert audit_requests record
  → generate auditor_access_token (JWT scoped to audit request)

POST /api/audit-hub/requests/:id/add-evidence
  → insert audit_evidence_bundles record
  → links evidence items to audit request

GET /api/audit-hub/requests/:id/export
  → gather all linked evidence
  → enqueue report-generate job
  → return download URL when complete
```

### New: Notification + Escalation Flow

```
[Any domain event occurs]
  → emitEvent(tenantId, eventType, payload)
  → insert webhook_events record
  → enqueueJob("webhook-dispatch", ...) for tenant's webhook_configs
  → enqueueJob("notification-dispatch", ...) for relevant users

notification-dispatch worker:
  → insert notifications record (in-app)
  → if user has email pref enabled: send email via SMTP/SES
  → SLA check: if approval_request overdue → enqueue escalation
```

---

## Recommended Project Structure for New Code

```
lib/db/src/schema/
├── entities.ts               # NEW
├── policies.ts               # NEW
├── policy-versions.ts        # NEW
├── policy-control-maps.ts    # NEW (junction)
├── evidence.ts               # NEW
├── audit-requests.ts         # NEW
├── audit-evidence-bundles.ts # NEW
├── approval-requests.ts      # NEW
├── tasks.ts                  # NEW
├── notifications.ts          # NEW
├── notification-prefs.ts     # NEW
├── webhook-configs.ts        # NEW
├── webhook-events.ts         # NEW
└── ai-model-registry.ts      # NEW

artifacts/api-server/src/
├── routes/
│   ├── policies.ts            # NEW
│   ├── evidence.ts            # NEW
│   ├── audit-hub.ts           # NEW
│   ├── approval-workflows.ts  # NEW
│   ├── tasks.ts               # NEW
│   ├── notifications.ts       # NEW
│   ├── webhooks.ts            # NEW
│   ├── ai-governance.ts       # NEW
│   └── executive-reports.ts   # NEW
└── lib/
    ├── event-bus.ts             # NEW
    ├── notification-service.ts  # NEW
    ├── policy-engine.ts         # NEW
    ├── evidence-collector.ts    # NEW
    ├── report-generator.ts      # NEW
    └── workflow-engine.ts       # NEW
```

**Modified files (additive only):**

| File | Change |
|------|--------|
| `lib/db/src/schema/index.ts` | Append new schema exports |
| `lib/db/src/relations.ts` | Add relations for new tables |
| `artifacts/api-server/src/routes/index.ts` | Register new routers |
| `artifacts/api-server/src/index.ts` | Register new workers via registerWorker |
| `lib/api-spec/openapi.yaml` | Add new endpoint specs (triggers codegen) |
| Existing vendor/risk/compliance route handlers | +1 line `emitEvent(...)` per state mutation |

---

## Suggested Build Order

Order is dependency-driven. Groups can be built in parallel within each group.

### Group 1 — Foundation (no dependencies on new features)

1. **Multi-entity schema** — `entities.ts` + `entity_id nullable` migration on core tables. No API surface yet. Pure schema + migration.
2. **Webhook/Event system** — `webhook_configs.ts`, `webhook_events.ts`, `event-bus.ts` lib, `webhooks.ts` routes. Self-contained.
3. **Approval workflow schema + engine** — `approval_requests.ts`, `workflow-engine.ts`. No UI yet — just the DB + state machine lib.
4. **Task/work item system** — `tasks.ts` schema + `tasks.ts` routes. Standalone.
5. **Notification schema + service** — `notifications.ts`, `notification-prefs.ts`, `notification-service.ts`, `notifications.ts` routes.

**Rationale:** Everything else in v2.1 fires events, triggers approvals, creates tasks, and sends notifications. These must exist first.

### Group 2 — Core Domain Features (depend on Group 1)

6. **Policy management** — `policies.ts`, `policy-versions.ts`, `policy-control-maps.ts` + `policies.ts` route + `policy-engine.ts`. Depends on: approval_requests (submit-for-approval), notifications (approver alerts), event-bus (policy.approved event).
7. **Evidence collection** — `evidence.ts` schema + `evidence.ts` route + `evidence-collector.ts`. Depends on: notifications (expiry alerts), tasks (remediation tasks on expired evidence).
8. **Cross-framework control mapping** — No new schema (reuses `control_requirement_maps`). New query endpoints only. Depends on nothing new.
9. **AI governance / model registry** — `ai-model-registry.ts` + `ai-governance.ts` route. Depends on: approval_requests (model approval workflow), tasks (remediation).

### Group 3 — Composite Features (depend on Groups 1 + 2)

10. **Audit hub** — `audit-requests.ts`, `audit-evidence-bundles.ts` + `audit-hub.ts` route. Depends on: evidence (bundles reference evidence), tasks (auditor creates tasks), notifications (auditor comms), approval-requests (audit sign-off).
11. **Notifications + escalations wiring** — Wire `emitEvent` into existing vendor/risk/compliance route handlers. Depends on: event-bus, notification-service (built in Group 1).
12. **Executive reporting** — `report-generator.ts` + `executive-reports.ts` route. Depends on: evidence, policies, controls, frameworks coverage. Build last — reads from everything else.

### Group 4 — UI Layer (after all API complete)

13. Policy management UI — pages/policies/
14. Evidence collection UI — pages/evidence/
15. Audit hub UI — pages/audit-hub/
16. Task center UI — pages/tasks/ (or dashboard widget)
17. Notification inbox UI — bell icon expansion + /notifications page
18. AI governance UI — pages/ai-governance/
19. Executive reports UI — pages/reports/

---

## Architectural Patterns for New Features

### Pattern 1: Polymorphic Context (reuse from assessments)

**What:** Single table serves multiple domain contexts via `context_type` enum + `context_id` UUID. No enforced FK — application-level join.

**When to use:** approval_requests, tasks, notifications — anything that needs to attach to N domain entities without separate tables per entity type.

**Trade-offs:** Fast to build, flexible. Lose referential integrity. Acceptable for GRC audit-trail-style records.

**Example:**
```typescript
// approval_requests table — same pattern as assessmentsTable.contextType
contextType: approvalContextTypeEnum("context_type").notNull(),
contextId: uuid("context_id"), // no .references() — polymorphic
```

### Pattern 2: Event-Sourced Versioning (for policies)

**What:** On each approved revision, write an immutable snapshot to `policy_versions`. The `policies` table holds current state; `policy_versions` holds full history.

**When to use:** Policies require audit trail of content changes, not just metadata changes.

**Trade-offs:** Simple implementation. Read-heavy queries load `policy_versions` not `policies`. Snapshots grow with each revision — acceptable for GRC volumes.

**Example:**
```typescript
// On policy approval:
await db.insert(policyVersionsTable).values({
  policyId: policy.id,
  tenantId: policy.tenantId,
  version: policy.version + 1,
  content: policy.content,
  approvedBy: userId,
  approvedAt: new Date(),
  changeNote: req.body.changeNote,
});
await db.update(policiesTable).set({ version: policy.version + 1, status: "approved" });
```

### Pattern 3: Job-Queue-Backed Event Bus

**What:** `emitEvent` is a thin wrapper that inserts a `webhook_events` record and calls `enqueueJob("webhook-dispatch", ...)`. Event publishing is async and durable — if the webhook call fails, the job retries with exponential backoff (already built into job-queue.ts).

**When to use:** All state-change events that external webhook subscribers or internal notification subscribers care about.

**Trade-offs:** 5-second polling latency (job processor polls every 5s). Acceptable for GRC. If sub-second delivery needed in future: upgrade to pg_notify — but that is v2.2+.

### Pattern 4: Scoped Auditor Access Token

**What:** Audit hub issues a JWT with limited scope (`{ role: "auditor", auditRequestId: "...", tenantId: "..." }`) for external auditors. Grants read-only access to a specific evidence bundle only.

**When to use:** `POST /api/audit-hub/requests/:id/auditor-token`

**Trade-offs:** Reuses existing JWT infrastructure (no new auth provider). Token scoping validated in a new `auditorMiddleware`. Short-lived tokens (24-72h configurable).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Approval Tables Per Domain

**What people do:** Create `policy_approvals`, `vendor_approvals`, `evidence_approvals` as separate tables.

**Why it's wrong:** Duplicates the approval state machine 3+ times. Can't build a unified "pending approvals" inbox. Can't reuse the workflow engine.

**Do this instead:** Single `approval_requests` table with `context_type` enum. One workflow engine. One API endpoint family. One UI inbox.

### Anti-Pattern 2: Replacing Existing Alert System with Notifications

**What people do:** Extend `alerts` table to handle user-directed notifications (approval requests, task assignments).

**Why it's wrong:** Alerts are system-generated, risk-focused, acknowledged by the system. Notifications are user-directed, action-required, per-user read/unread state. Different consumers, different UI surfaces, different lifecycle.

**Do this instead:** New `notifications` table alongside alerts. Alert bell stays for risk alerts; notification inbox for actionable items.

### Anti-Pattern 3: Blocking PDF Generation in Request Handler

**What people do:** Call puppeteer/pdf-lib synchronously inside the HTTP route handler.

**Why it's wrong:** PDF generation takes 10-30 seconds, blocks the Node.js event loop, times out under load.

**Do this instead:** Enqueue a `report-generate` job. Return 202 Accepted with a job ID. Client polls `GET /api/executive-reports/:jobId/status` until complete, then downloads.

### Anti-Pattern 4: Eager entity_id Migration Without Backward Compatibility

**What people do:** Add `entity_id NOT NULL` immediately, requiring all existing data to be backfilled.

**Why it's wrong:** Existing rows have no entity, migration fails or requires manual intervention.

**Do this instead:** `entity_id uuid NULLABLE` in the Drizzle schema. Default NULL = root tenant context. No backfill needed. Future milestone adds the entity selector UI.

### Anti-Pattern 5: Embedding Framework Logic in Policy Routes

**What people do:** Hard-code "ISO 42001 controls require AI model registry entry" in the policy route handler.

**Why it's wrong:** Framework rules change, new frameworks are added. Hard-coded logic becomes unmaintainable.

**Do this instead:** Framework-control linkage lives entirely in `control_requirement_maps`. Policy routes are framework-agnostic. ISO 42001/NIST AI RMF is handled by the AI governance module as a separate route namespace that imports controls like any other framework.

---

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `workflow-engine.ts` | State machine for approve/reject/escalate transitions | `approval_requests` table, `notification-service.ts`, `event-bus.ts` |
| `event-bus.ts` | Translate domain events to durable job queue entries | `job-queue.ts` (enqueueJob), `webhook_events` table |
| `notification-service.ts` | Create in-app notifications, enqueue email delivery jobs | `notifications`, `notification-prefs` tables, `job-queue.ts` |
| `policy-engine.ts` | Version snapshots, AI draft generation, approval orchestration | `policies`, `policy_versions` tables, `llm-service.ts`, `workflow-engine.ts` |
| `evidence-collector.ts` | Auto-collection via integrations, expiry tracking | `evidence` table, `integration_configs`, `notification-service.ts` |
| `report-generator.ts` | Compile data, render PDF, store in `documents` | `evidence`, `policies`, `controls`, `frameworks`, `documents` table |
| New route handlers | HTTP interface, auth check, input validation, delegate to libs | Relevant schema tables, lib services, `recordAudit`, `emitEvent` |

---

## Integration Points Summary

| Boundary | Communication | Notes |
|----------|---------------|-------|
| New routes ↔ existing job-queue | `enqueueJob(...)` call | No change to job-queue.ts needed |
| New routes ↔ existing audit trail | `recordAudit(req, ...)` call | No change to audit.ts needed |
| Approval workflow ↔ policy/evidence/vendor routes | Additive: route calls `workflow-engine.createRequest(...)` | Existing vendor route gets +1 line for approval trigger |
| Event bus ↔ existing vendor/risk/compliance routes | Additive: `await emitEvent(...)` after existing DB write | One line per state change, no logic change |
| Multi-entity ↔ all list endpoints | Optional `?entityId=` query param filter | Existing queries unchanged when param absent |
| AI governance ↔ assessment engine | New `context_type: "ai_model"` added to `assessmentContextTypeEnum` | Extend existing enum via migration |
| Executive reports ↔ documents table | Reports stored in existing `documents` table | Reuses document storage pattern |
| Cross-framework mapping ↔ compliance routes | New query endpoints over existing `control_requirement_maps` | No schema change needed |

---

## Sources

- Direct inspection: `/home/dante/RiskMind2/lib/db/src/schema/` (all schema files)
- Direct inspection: `/home/dante/RiskMind2/artifacts/api-server/src/` (routes, lib, app.ts)
- Direct inspection: `/home/dante/RiskMind2/artifacts/api-server/src/lib/job-queue.ts`
- Direct inspection: `/home/dante/RiskMind2/artifacts/api-server/src/lib/audit.ts`
- Direct inspection: `/home/dante/RiskMind2/.planning/PROJECT.md` (v2.1 feature requirements)
- Confidence: HIGH — architecture derived from live codebase, not external research

---

*Architecture research for: RiskMind v2.1 — Enterprise Parity & Agent-Ready Foundation*
*Researched: 2026-03-26*
