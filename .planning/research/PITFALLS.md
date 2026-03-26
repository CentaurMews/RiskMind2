# Pitfalls Research

**Domain:** Adding policy management, evidence collection, audit hub, cross-framework control mapping, executive reporting, notifications/escalations, AI governance (ISO 42001 + model registry), multi-entity schema, webhook/event system, approval workflow engine, and task/work item system to an existing TypeScript/Express/React/PostgreSQL GRC platform
**Researched:** 2026-03-26
**Confidence:** HIGH (codebase-verified for existing-system integration pitfalls) / MEDIUM (external patterns from official docs and community sources)

---

## Critical Pitfalls

### Pitfall 1: Multi-Entity `entity_id` Added Without Cascade-Safe Migration

**What goes wrong:**
The plan is to add an `entities` table and an `entity_id` column to all core tables (risks, vendors, controls, frameworks, policies, evidence). Developers add the column as `NOT NULL` without a default, which blocks new rows until every client provides an entity ID. Or they add it `NULL`-able but every query that joins `entities` requires a LEFT JOIN that pollutes all query paths. Either way, the Drizzle schema emits a new migration that runs in production while the app is live — failing if any transaction holds a lock on a large table.

**Why it happens:**
The "schema now, full UI later" decision (Option C, logged in PROJECT.md) creates time pressure to get `entity_id` on every table quickly. Developers run a single migration that ALTERs ten tables simultaneously, locking each for the duration of the backfill.

**How to avoid:**
Use the expand-migrate-contract pattern. First migration: add `entity_id` as `NULL`-able with no FK constraint, deploy, backfill asynchronously via job queue. Second migration: add the FK constraint and the index (not the NOT NULL yet). Third migration (future milestone): tighten to NOT NULL after all rows are populated. Add index `CONCURRENTLY` so the lock is not held. Never add NOT NULL without a DEFAULT or backfill in the same transaction.

**Warning signs:**
- Single Drizzle migration file that ALTERs more than three tables at once.
- `entity_id uuid NOT NULL` in the migration before seed data assigns values.
- Any query returning 0 rows after migration that previously returned data (backfill missed).

**Phase to address:** Multi-Entity Schema phase — must be the very first schema migration of v2.1 since every other feature will reference `entity_id`.

---

### Pitfall 2: Approval Workflow Built Per-Feature Instead of Generically

**What goes wrong:**
Three features all need approve/reject flows: policy versioning, evidence sign-off, and vendor onboarding promotion. Without a shared `approval_requests` table, each feature builds its own state machine — `policy_approvals`, `evidence_approvals`, `vendor_approval_stages`. After all three ship, agent-driven approvals (v2.2) need to interact with three separate tables. The v2.2 agentic GRC layer becomes impossible to build as a unified orchestrator.

**Why it happens:**
Policy management is built first in isolation. The developer adds `policy_status` with values `draft | pending_review | approved | rejected` and a `reviewer_id` FK directly on `policies`. This works for policies. When evidence collection needs the same pattern, the template is copied and mutated. By the time the task system needs approvals, the duplicated pattern is entrenched.

**How to avoid:**
Build the `approval_requests` table before building any feature that needs approvals. Design it as documented in PROJECT.md Key Decisions: a single table with `context_type` (text enum: `policy | evidence | vendor | task`), `context_id` (uuid), `requested_by`, `assigned_to`, `status` (pending | approved | rejected | escalated), `decided_at`, `comment`. Use a single `ApprovalService` that policy, evidence, and vendor routes call. The policies table gets `current_status` and `current_approval_id` as derived state, not the workflow logic itself.

**Warning signs:**
- Policy, evidence, and vendor schemas each contain an `approver_id` column and a `review_status` enum.
- Three separate `POST /*/approve` route handlers with independent logic.
- Approval history is not queryable across entity types from a single endpoint.

**Phase to address:** Approval Workflow Engine phase — must be a standalone phase before Policy Management, Evidence Collection, or Vendor workflow changes.

---

### Pitfall 3: Webhook/Event Bus Is Synchronous in the Request Path

**What goes wrong:**
The event bus is wired directly into route handlers — when a risk is created, the handler calls `emitEvent("risk.created", payload)` which synchronously calls all registered webhook subscribers, then returns the HTTP response. Any slow or failed subscriber delays the response to the caller. When a subscriber errors, the original write may be rolled back. Under load (signal ingestion firing 50+ events/minute), the event bus becomes the bottleneck.

**Why it happens:**
The existing `jobs` table and `enqueueJob` function in `artifacts/api-server/src/lib/job-queue.ts` already provide a durable, async queue — but developers wire event emission directly for "simplicity" before realizing the coupling. The pattern of synchronous in-request side effects is already present (AI enrichment was originally synchronous before being moved to jobs).

**How to avoid:**
Use the existing job queue as the event delivery mechanism. `emitEvent` should only write a row to `jobs` with `queue: "webhooks"`, `type: "deliver"`, and the event payload — then return immediately. The webhook delivery worker picks it up asynchronously with retry/backoff. Internal subscribers (notification triggers, SLA checkers) follow the same pattern via `queue: "internal-events"`. Never call external HTTP endpoints or heavy computation in the synchronous request path.

**Warning signs:**
- `emitEvent()` or `dispatchWebhook()` called inside a `db.transaction()` block before the transaction commits.
- Response time on `POST /risks` increases after webhooks are added.
- A subscriber throwing an error causes the original resource creation to fail.

**Phase to address:** Webhook/Event System phase — the async delivery contract must be established before any feature uses events.

---

### Pitfall 4: Policy Versioning Without Immutable History

**What goes wrong:**
Policy versions are "updated" in place: the `policies` table has a `version` integer and `content` text column, and on every edit the content is overwritten with `version++`. After a year of use, an auditor asks "what did Policy X say on this date when we accepted this risk?" — the historical content is gone. This is a direct audit failure for ISO 27001 clause 7.5 and SOC 2 CC5.2.

**Why it happens:**
Developers build the simplest thing — a single-row policy with a version counter. The append-only requirement isn't obvious until the first audit.

**How to avoid:**
Model policies as append-only with a separate `policy_versions` table: `(id, policy_id, version_number, content, status: draft|active|superseded|retired, approved_by, approved_at, effective_from, effective_to)`. The `policies` table holds only metadata (title, owner, category, framework linkages) and a `current_version_id` FK. Every edit creates a new `policy_versions` row in `draft` status; publishing sets the previous active version to `superseded` and the new row to `active`. Content is never overwritten.

**Warning signs:**
- `policies` table has a `content` column rather than a FK to `policy_versions`.
- `version` is an integer on the main `policies` row rather than a separate child table.
- No `effective_from` / `effective_to` date range on version rows.

**Phase to address:** Policy Management phase — version schema must be designed correctly from the first migration.

---

### Pitfall 5: Evidence Records Without Integrity Chain

**What goes wrong:**
Evidence is collected (screenshot, file upload, API-fetched config dump) and stored as a row in `evidence` pointing to a file in uploads. A user with write access can replace the file, update the `collected_at` timestamp, or change `auto_collected` to `true`. During an audit, the evidence is questioned and the auditor cannot verify whether it was tampered with post-collection. The GRC platform cannot assert integrity — a fatal gap for SOC 2 and ISO 27001 audits.

**Why it happens:**
The existing `documents` table in the schema uses a simple `url` column. The evidence table is modeled similarly, with no hash or tamper-evidence mechanism.

**How to avoid:**
On evidence creation (whether manual upload or auto-collection), compute SHA-256 of the file content and store it in `content_hash`. Store the hash at collection time and make the column immutable (no UPDATE allowed via API; only DELETE + re-create). For auto-collected API evidence, store the raw JSON response alongside the hash. Write a verification endpoint (`GET /evidence/:id/verify`) that re-computes the hash and compares. Never allow PATCH on `content_hash`, `collected_at`, or `auto_collected` columns via the API.

**Warning signs:**
- No `content_hash` column on the evidence schema.
- `PATCH /evidence/:id` allows updating `collected_at` or `file_url`.
- Auto-collected evidence and manually uploaded evidence share identical API write paths with no distinction.

**Phase to address:** Evidence Collection phase — integrity model must be in the initial migration.

---

### Pitfall 6: Cross-Framework Control Mapping Causes Compliance Score Double-Counting

**What goes wrong:**
A single control (e.g., "Encrypt data at rest") is mapped to SOC 2 CC6.1 and ISO 27001 A.8.24. When the control is tested and passes, the compliance pipeline counts it as passing for both frameworks. However, ISO 27001 A.8.24 has additional implementation requirements that SOC 2 CC6.1 does not. The ISO 27001 score shows 100% because the shared control passed, but a real ISO auditor would reject the control test as insufficient. This produces false compliance confidence.

**Why it happens:**
The existing `control_requirement_maps` table maps `control_id` → `requirement_id` (one-to-many). The compliance posture query (`services/compliance-pipeline.ts`) counts passing controls per requirement. When one control satisfies five requirements, all five are counted as passed. There is no concept of requirement-specific implementation depth or evidence sufficiency.

**How to avoid:**
Add an `implementation_note` and `sufficiency_override` column to `control_requirement_maps`. When a control is mapped to a requirement, a human (or AI suggestion) must confirm the control meets that specific requirement's depth — not just mark it as mapped. The compliance pipeline should only count a requirement as met if the control test has a `scope: requirement_id` annotation or if the mapping has `sufficiency_override: true`. Warn in the UI when a control is shared across 3+ frameworks without per-framework sufficiency confirmation.

**Warning signs:**
- `control_requirement_maps` has no `implementation_note` or `sufficiency_status` column.
- Compliance score for ISO 27001 rises to 100% the moment any mapped control passes a SOC 2 test.
- No UI indicator showing a control is shared across N frameworks.

**Phase to address:** Cross-Framework Control Mapping phase — sufficiency model must be designed before the compliance pipeline is updated to use the new mapping table.

---

### Pitfall 7: Task System Orphans From Parent Entity Deletes

**What goes wrong:**
Tasks are created linked to a risk, vendor, control, or policy (the `context_type` / `context_id` pattern). When the parent entity is deleted, the task rows remain with a dangling `context_id` pointing to nothing. Task list queries either error (FK violation during JOIN) or silently return tasks with no context. The task inbox becomes polluted with orphaned items the owner cannot navigate to.

**Why it happens:**
The `context_id` column is intentionally not a hard FK (because it is a polymorphic reference to multiple tables). Without FK enforcement, ON DELETE CASCADE does not fire.

**How to avoid:**
Add a `DELETE` trigger (or application-level hook) on each parent table that either deletes linked tasks or marks them `context_deleted: true` with the last-known context title cached in `context_snapshot`. The task schema should include `context_title text` (denormalized snapshot) so the UI can still display "Task from: Vendor Acme Corp (deleted)". Never expose orphaned tasks as navigable items in the UI.

**Warning signs:**
- `tasks` table has no `context_snapshot` or `context_deleted` column.
- Deleting a risk leaves rows in `tasks` with a UUID that resolves to nothing.
- Task detail page throws 404 when the parent entity no longer exists.

**Phase to address:** Task/Work Item System phase — the orphan-handling contract must be decided before the schema is finalized.

---

### Pitfall 8: Notification System Polls the Database Instead of Subscribing to Events

**What goes wrong:**
SLA-based notifications are implemented as a cron job that runs every 5 minutes and queries all open tasks, policies, evidence records, and vendor assessments for overdue items — then sends emails. With 20 frameworks, 500 controls, 2000 evidence records, and 300 tasks, this query scans millions of rows every 5 minutes. Database load spikes periodically. At 10 tenants, it becomes a serious performance issue. Worse, SLA breaches can be missed for up to 5 minutes.

**Why it happens:**
Polling is the simplest starting point. The existing `risk-snapshot-scheduler.ts` and `agent-scheduler.ts` use `setInterval` polling patterns — developers copy this approach for notifications.

**How to avoid:**
Design notifications as event-driven from the start. When a task is created with a due date, enqueue a delayed job (`queue: "notifications"`, `scheduledAt: dueDate - warningLeadTime`). When a policy is published with a review date, enqueue a notification job for 30 days before expiry. The notification worker fires once at the right time rather than polling continuously. Use `scheduledAt` on the existing `jobs` table — it already supports future scheduling via `delayMs`. Reserve polling only for backfill (catching items that existed before the event system was wired up).

**Warning signs:**
- `setInterval` or `cron.schedule` calling a query that touches more than 3 tables.
- `SELECT ... WHERE due_date < NOW() AND notification_sent IS NULL` on a large table every N minutes.
- Notification volume correlates with cron frequency rather than actual SLA events.

**Phase to address:** Notifications & Escalations phase — event-driven delivery contract must be decided first; the job queue integration pattern is already established.

---

### Pitfall 9: AI Governance Registry Conflates the AI System with the Model

**What goes wrong:**
The registry is designed as a list of LLM model configs (GPT-4o, Claude 3.5, Gemini Pro) linked to the existing `llm_configs` table. EU AI Act and ISO 42001 compliance requires registering AI *systems* (the business application of AI with a defined purpose, risk classification, and data inputs) — not the underlying model. A "Vendor Risk Scoring" AI system might use different models over time; retiring GPT-4o should not remove the system from the registry. Conflating model with system makes the registry useless for EU AI Act Article 49 obligations.

**Why it happens:**
The existing `llm_configs` and `llm_task_routing` tables are the obvious starting point. Developers extend them with risk classification fields rather than building a separate `ai_systems` table.

**How to avoid:**
Build a distinct `ai_systems` table with fields: `name`, `purpose`, `eu_ai_act_risk_class` (unacceptable | high | limited | minimal), `data_inputs`, `output_type`, `deployed_in_production: boolean`, `human_oversight_mechanism`, `framework_mappings` (JSON). Separately, `ai_system_model_history` links systems to the `llm_configs` rows that powered them over time (with date ranges). The registry UI shows systems, not models. Models are an implementation detail. This separation means the registry remains valid as models are swapped.

**Warning signs:**
- `ai_systems` table has a `model_id` FK rather than a time-series model history join table.
- EU AI Act risk classification is stored on `llm_configs` instead of on an application-level entity.
- Deleting an LLM provider config removes the AI system from governance view.

**Phase to address:** AI Governance phase — the system-vs-model separation must be established in the initial schema design.

---

### Pitfall 10: Audit Hub Treats Audit Events as the Audit Trail

**What goes wrong:**
The existing `audit_events` table (in `lib/db/src/schema/audit-events.ts`) records user actions with `action`, `entity_type`, `entity_id`, and `payload`. When the Audit Hub is built, developers reuse this table as the audit-facing evidence trail. The problem: `audit_events` is a system-internal changelog designed for debugging and accountability — it captures every API call including low-signal noise like dashboard loads, filter changes, and pagination events. Auditors reviewing 50,000 rows of noise cannot locate the 20 material events relevant to their inquiry. The table also has no `tenant_id` index, making cross-tenant audit queries slow.

**Why it happens:**
`audit_events` already exists and looks like it does the job. Reusing it avoids a new table and migration.

**How to avoid:**
Keep `audit_events` as the system changelog (unchanged). Build a separate `audit_records` (or `compliance_events`) table for the Audit Hub that only captures compliance-material events: policy approvals, evidence submissions, control test results, framework assessments, and risk acceptance decisions. `audit_records` should have: `event_type` (typed enum), `entity_type`, `entity_id`, `actor_id`, `outcome`, `evidence_ids[]` (array FK), `framework_id`, `timestamp`, and a `narrative` text field for AI-generated summaries. The Audit Hub queries `audit_records` only. Add a composite index `(tenant_id, entity_type, timestamp DESC)` from the start.

**Warning signs:**
- Audit Hub UI queries the existing `audit_events` table directly.
- Auditor-facing timeline includes entries like `action: "GET /dashboard"`.
- No `(tenant_id, entity_type, timestamp)` composite index on the audit trail table.

**Phase to address:** Audit Hub phase — the distinction between system changelog and compliance audit trail must be established before any audit views are built.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store policy content on `policies` row instead of `policy_versions` child table | One migration, simpler queries | History is gone; audit failure at first external audit | Never |
| Use `audit_events` as the Audit Hub data source | Zero new tables | Noise drowns signal; no compliance-relevant filtering | Never |
| Add `approver_id` + `review_status` directly to each feature table | Faster per-feature delivery | Three incompatible approval models; blocks v2.2 agent approvals | Never |
| Poll database for SLA notifications rather than event-driven scheduling | Simple cron, easy to debug | DB load spike every N minutes; scales badly beyond 5 tenants | Only for initial backfill catch-up |
| Add `entity_id NOT NULL` in one migration without backfill | Enforces constraint immediately | Blocks deploy if any existing row is missed | Never |
| Reuse `llm_configs` for AI governance registry | No new table | System-vs-model conflation; EU AI Act non-compliance | Never |
| Synchronous webhook delivery in request path | Simpler to reason about | Couples response time to subscriber health | Never |
| Skip `content_hash` on evidence records | Faster upload flow | Cannot assert tamper-evidence; audit integrity gap | Never |
| Build notification as email-only | Covers immediate need | Hard to add Slack/Teams later; channel abstraction missing | Only if email is the only channel for v2.1 |
| Generic `tasks.context_id` with no orphan handling | Flexible polymorphic reference | Dangling orphans pollute inbox; deletes cause silent data rot | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Existing `jobs` table for webhook delivery | Writing a new event queue table instead of reusing jobs | Use `enqueueJob()` from `lib/job-queue.ts` with `queue: "webhooks"`; the infrastructure is already there |
| Existing `control_requirement_maps` for cross-framework mapping | Treating the existing junction table as sufficient | Extend with `sufficiency_status` and `implementation_note`; do not replace the table |
| Existing `assessments` table for policy/evidence approval flows | Reusing `assessment_context_type` enum for approvals | Approvals are a different domain; build `approval_requests` with its own `context_type` enum |
| Existing `vendor_status_events` pattern for policy version history | Copying the event log pattern to policy versions | Policy versions need the full content stored, not just state transitions; `policy_versions` requires content columns |
| Existing `alerts` table for SLA notifications | Using `alerts` as the notification delivery mechanism | `alerts` is for signal-based operational alerts; notifications is a separate delivery channel with its own recipient/channel model |
| Orval-generated `lib/api-client-react/` and `lib/api-zod/` | Editing generated files to add new endpoints | Add to OpenAPI spec and regenerate; never edit generated files directly |
| Drizzle ORM with `pgvector` | Attempting vector similarity on `embedding` columns in new tables without `CREATE EXTENSION IF NOT EXISTS vector` | Verify pgvector is initialized before adding vector columns to new tables like `ai_systems` |
| PDF generation for executive reports | Blocking the Express request thread with synchronous PDF rendering | Enqueue PDF generation as a job; return a `202 Accepted` with a job ID; poll or webhook when done |
| `llm_configs` encrypted API keys (AES-256-GCM) | Copying key storage pattern to AI governance registry without encryption | AI system metadata (model assignment history) does not need encryption, but any API key fields added to `ai_systems` must use the same `encrypt()`/`decrypt()` service |
| Multi-tenant RBAC middleware | New routes (policies, evidence, tasks) bypassing tenant-scoping middleware | Every new route must apply `requireTenant` middleware; auditing reveals missing tenant isolation quickly under multi-tenant load |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Compliance score recalculated on every request | `/compliance/frameworks/:id` is slow; CPU spikes on dashboard load | Cache score in `frameworks.cached_compliance_score` + invalidate on control test change events | ~50 controls per framework |
| Evidence table full-scanned for expiry checks | Notification cron is slow; DB load spikes every 5 min | Add index `(tenant_id, expires_at)` where `expires_at IS NOT NULL`; use scheduled jobs at creation time | ~1000 evidence records |
| `audit_events` table unbounded growth | Dashboard queries slow; storage grows ~10 MB/day per active tenant | Add `created_at` index; implement a rolling archive/purge for low-signal events (reads, list requests) after 90 days | ~100K rows |
| Policy version content stored as text blobs in main query | Policy list page loads all version content unnecessarily | `policy_versions.content` should only be fetched on detail view; list query JOINs metadata only | ~500 policy versions |
| Cross-framework mapping query traverses all requirements for score | Compliance posture page is slow for tenants with 3+ frameworks | Denormalize passing/total counts per framework into a `framework_posture_cache` table; invalidate on test result changes | 3+ frameworks × 200+ requirements each |
| Webhook delivery retries with no backoff | Database is hammered with UPDATE retries on failed deliveries | Exponential backoff in the webhook worker; max 3 attempts with 30s, 5min, 30min delays using `scheduledAt` on re-enqueued jobs | Any subscriber that is temporarily down |
| Approval workflow state polling from frontend | UI polls `GET /approval-requests/:id` every 2 seconds | Use existing alert/notification mechanism to push state changes; frontend should use optimistic updates + refetch-on-focus | Any approval that takes > 30 seconds |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Policy content accessible cross-tenant via `GET /policies/:id` without tenant check | Tenant A reads Tenant B's policy documents | Every policy query must include `WHERE tenant_id = req.tenantId`; use the existing `requireTenant` middleware pattern consistently |
| Evidence files stored with predictable public URLs | Anyone with the URL can access evidence (SOC 2 report, security scan) | Store evidence files with signed URLs or behind a `GET /evidence/:id/download` endpoint that checks authorization before redirecting |
| Approval workflow allows self-approval | A user approves their own policy draft | `approval_requests` must validate that `requested_by !== assigned_to`; enforce at the service layer, not just UI |
| Audit records mutable via API | Compliance event history can be altered post-facto | `audit_records` rows must be insert-only; no UPDATE endpoint; DELETE requires ADMIN role + a reason logged in a separate `audit_deletions` table |
| AI model registry exposes model API keys in governance view | AI governance dashboard leaks LLM credentials | `ai_systems` joins `llm_configs` for display but never returns raw `api_key`; use the existing `decrypt()` only in the LLM service, not in governance API responses |
| Webhook endpoint registration without secret verification | Any caller can impersonate a registered webhook consumer | Webhook registrations must store a `signing_secret`; outgoing webhook payloads must include an HMAC signature header; receiving systems can verify |
| Task assignee is not validated as a user in the same tenant | Tasks can be assigned to users from other tenants | `tasks.assignee_id` FK must point to `users` table and the assigned user's `tenant_id` must match; validate at service layer |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Policy version history shown as a raw diff of text fields | Compliance managers cannot quickly understand what changed between v2 and v3 of a 10-page policy | AI-generated change summary on version publish: "Section 3 updated to require MFA; Section 7 scope narrowed to EU customers only" |
| Evidence expiry warnings only on the evidence list page | Evidence expires silently; control gap discovered at audit time | Emit expiry warning events 30 days and 7 days before `expires_at`; surface on dashboard KPI as "Expiring Evidence" count |
| Approval requests shown only to the assigned approver | Requester does not know status; escalation is invisible | Requester sees live status on the original object (policy, evidence); escalation history visible to ADMIN role |
| Cross-framework mapping shown only as a data table | Compliance managers cannot see which controls are over-mapped (creating false confidence) or under-mapped (creating gaps) | Heatmap visualization: controls on one axis, frameworks on the other; color shows coverage depth |
| Audit Hub requires manually assembling evidence bundles | Auditors wait days for evidence to be collected and formatted | Auto-bundle: when an audit is created, pre-populate the bundle from evidence records mapped to the in-scope controls/framework |
| Task inbox mixed with system-generated and human-assigned tasks | Users cannot prioritize; agent-generated tasks overwhelm human-created ones | Separate tabs or filter: "Human assigned" vs "System generated (agent)"; agent tasks have a distinct visual badge |
| Notification emails sent with no unsubscribe or digest option | Users ignore all notification emails after first week; SLA breaches go unnoticed | Offer daily digest option in user settings; always include one-click unsubscribe in email footer |

---

## "Looks Done But Isn't" Checklist

- [ ] **Policy Management:** Policy appears "active" in UI — verify that the previous version status was set to `superseded` and `effective_to` was written.
- [ ] **Evidence Collection:** Evidence row created — verify `content_hash` was computed and stored; verify `expires_at` is set for evidence with a known expiry; verify auto-collect flag cannot be toggled post-creation via API.
- [ ] **Approval Workflow:** Approval request shows "Approved" — verify the parent entity's status was actually updated (not just the approval row); verify an `audit_record` was written capturing the decision.
- [ ] **Cross-Framework Mapping:** Control mapped to 3 frameworks — verify each mapping has `sufficiency_status` set; verify compliance score is not auto-incrementing for frameworks where the control was mapped without per-framework evidence.
- [ ] **Webhook/Event System:** Webhook fires on risk creation — verify delivery is asynchronous (not blocking the POST response); verify the delivery job is retried on failure; verify a failed delivery does not roll back the risk creation.
- [ ] **Notifications:** SLA email sends — verify the notification job was created at task creation time (not by a polling cron); verify idempotency key prevents duplicate sends if the job is retried.
- [ ] **AI Governance Registry:** AI system record created — verify it references a system-level entity, not just a model config; verify EU AI Act risk class is set; verify the record persists if the underlying LLM config is deleted or rotated.
- [ ] **Multi-Entity Schema:** `entity_id` column added to `risks` — verify existing rows have a non-null `entity_id` after backfill; verify no queries broke due to the new column in SELECTs.
- [ ] **Task System:** Task created with due date — verify a scheduled notification job was enqueued at creation time with correct `scheduledAt`; verify task is orphan-safe (has `context_snapshot` populated).
- [ ] **Audit Hub:** Audit created with scope — verify the evidence bundle was auto-populated from mapped evidence; verify the audit record is insert-only (no PATCH endpoint exposed).
- [ ] **Executive Reporting:** PDF report generated — verify generation is async (202 response with job ID); verify the PDF contains real data, not seed/demo data for production tenants.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Policy content stored in-place (no version table) | HIGH | Create `policy_versions` table; write migration to copy existing content into a v1 record; redirect all reads to version table; rebuild approval history from `audit_events` |
| Approval workflow built per-feature (3 separate tables) | HIGH | Extract a unified `approval_requests` table; write adapters that read/write both old tables and new during transition; deprecate old tables over 2 sprints |
| Webhook delivery synchronous | MEDIUM | Move `emitEvent` calls out of request handlers into a post-commit hook; add delivery job queue; accept 1 sprint of temporary inconsistency during migration |
| Evidence without `content_hash` | MEDIUM | Add column as NULL-able; backfill hash from existing files (re-hash upload content); set NOT NULL after backfill; cannot recover hash for files whose content was already modified |
| `audit_events` used as audit trail | MEDIUM | Build `audit_records` table; write a migration to classify and copy material events from `audit_events`; new compliance events write to both tables initially; deprecate `audit_events` reads in Audit Hub |
| `entity_id NOT NULL` migration broke production | HIGH | Rollback migration; add as NULL-able; backfill via background job; re-run migration with soft constraint first |
| Notification polling causing DB load | LOW | Replace cron with scheduled job creation at entity-creation time; cron becomes a backfill-only safety net with reduced frequency |
| AI governance conflated with model configs | MEDIUM | Add `ai_systems` table; migrate risk classification fields from `llm_configs`; update UI to show system-level view; `llm_configs` remains for operational use |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Multi-entity migration without expand-migrate-contract | Multi-Entity Schema (Phase 1) | Run migration against a copy of prod data; verify zero existing rows have NULL entity_id after backfill job completes |
| Approval workflow built per-feature | Approval Workflow Engine (must precede Policy and Evidence) | Single `approval_requests` table; policy and evidence routes call `ApprovalService`; no `approver_id` column on `policies` or `evidence` rows |
| Synchronous webhook delivery | Webhook/Event System | Integration test: POST /risks returns < 100ms even with a slow registered subscriber; subscriber failure does not error the POST |
| Policy versioning in-place | Policy Management | `policy_versions` child table exists; PUT/PATCH on policy content creates new version row; old content remains queryable |
| Evidence without integrity hash | Evidence Collection | SHA-256 hash stored on every evidence row; `PATCH /evidence/:id` returns 400 if attempting to update `content_hash` or `collected_at` |
| Cross-framework score double-counting | Cross-Framework Control Mapping | Compliance score does not increase for ISO 27001 when a SOC 2-only control test passes; sufficiency_status must be confirmed per mapping |
| Task orphan pollution | Task/Work Item System | Deleting a risk removes or tombstones linked tasks; task inbox shows no broken-link items |
| Notification DB polling | Notifications & Escalations | No setInterval query touching 3+ tables; notification delivery latency < 2 minutes of scheduled time |
| AI governance vs model conflation | AI Governance | `ai_systems` table exists independently of `llm_configs`; EU AI Act risk class on system row; model history is a join table |
| Audit Hub using audit_events | Audit Hub | Audit Hub queries `audit_records` only; `audit_events` not joined in any auditor-facing view |
| Self-approval in workflow | Approval Workflow Engine | Service layer returns 403 when `requested_by === assigned_to`; test exists for this case |
| Evidence files without auth-gated download | Evidence Collection | `GET /evidence/:id/download` checks tenant + role before returning signed URL; direct file URL is not publicly accessible |

---

## Sources

- Codebase analysis: `lib/db/src/schema/` (controls, frameworks, assessments, jobs, audit-events, agent, tenants, alerts, vendors)
- Codebase analysis: `artifacts/api-server/src/lib/job-queue.ts` (async job queue pattern already in place)
- Codebase analysis: `artifacts/api-server/src/lib/allowed-transitions.ts` (vendor state machine pattern to generalize)
- PROJECT.md Key Decisions: generic approval_requests table (logged), multi-entity Option C, API-first for v2.1
- [GRC Policy Management Best Practices — Sprinto](https://sprinto.com/blog/grc-policy-management/)
- [Policy Version Management in GRC — ServiceNow Community](https://www.servicenow.com/community/grc-forum/grc-policy-version-management/m-p/1342319)
- [Backward Compatible Database Changes — PlanetScale](https://planetscale.com/blog/backward-compatible-databases-changes)
- [Designing a Workflow Engine Database — Exception Not Found](https://exceptionnotfound.net/designing-a-workflow-engine-database-part-1-introduction-and-purpose/)
- [We Hit 200K Webhook Events per Hour and PostgreSQL Just Gave Up — Medium](https://techpreneurr.medium.com/we-hit-200k-webhook-events-per-hour-and-postgresql-just-gave-up-34aaeb67b19f)
- [Cross-Framework Control Mapping — Vanta](https://www.vanta.com/collection/grc/multi-framework-cross-mapping)
- [ISO/IEC 42001 and EU AI Act — ISACA](https://www.isaca.org/resources/news-and-trends/industry-news/2025/isoiec-42001-and-eu-ai-act-a-practical-pairing-for-ai-governance)
- [Audit Trail Requirements for Compliance — Inscope HQ](https://www.inscopehq.com/post/audit-trail-requirements-guidelines-for-compliance-and-best-practices)
- [Approval Workflow Design Patterns — Cflow](https://www.cflowapps.com/approval-workflow-design-patterns/)

---
*Pitfalls research for: RiskMind v2.1 — Enterprise Parity & Agent-Ready Foundation*
*Researched: 2026-03-26*
