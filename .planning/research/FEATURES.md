# Feature Research

**Domain:** Enterprise GRC Platform — v2.1 Enterprise Parity Features
**Researched:** 2026-03-26
**Confidence:** MEDIUM-HIGH (industry patterns verified across multiple sources; Vanta/Drata/ServiceNow docs and GRC analyst research confirm table stakes; AI governance cross-referenced with ISO 42001 official guidance)

---

> **Scope note:** This document covers ONLY the eleven new feature areas for v2.1: Policy Management, Evidence Collection, Audit Hub, Cross-Framework Control Mapping, Executive Reporting, Notifications & Escalations, AI Governance (ISO 42001 + model registry), Multi-Entity Schema, Webhook/Event System, Approval Workflow Engine, and Task/Work Item System. All v2.0 features are already built and are dependencies, not deliverables.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that enterprise GRC buyers assume exist. Absence signals immaturity compared to Vanta, Drata, OneTrust, and ServiceNow GRC.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Policy document versioning** | Auditors require proof of version history; "which policy was in effect on date X" is a standard audit question | MEDIUM | Store major/minor versions; immutable past versions; diff view between versions; current-version pointer |
| **Policy lifecycle status** | DRAFT → REVIEW → APPROVED → PUBLISHED → RETIRED is the universal policy workflow; without it policies are just documents | MEDIUM | Status enum on policy record; transitions trigger notifications; approved-by and approved-at fields mandatory |
| **Policy-to-control linkage** | Controls must trace to governing policies; gap: "which policy mandates this control?" is asked by every auditor | LOW | Many-to-many: policies ↔ controls; existing controls table is the anchor; simple join table |
| **Employee policy attestation** | "Acknowledge you have read this policy" is required by SOC 2, ISO 27001, and most HR compliance frameworks | MEDIUM | Attestation request per user per policy version; read + acknowledge tracking; attestation report per policy |
| **Evidence record with control linkage** | Every GRC platform since 2015 requires evidence tied to controls; without it, audit readiness is impossible | MEDIUM | Evidence record: type, file/link, control IDs, collected_at, expiry_at, collected_by, auto_collected flag |
| **Evidence expiry and renewal tracking** | SOC 2 Type II requires continuous evidence; stale evidence fails audits; expiry tracking is non-negotiable | LOW | expiry_at field; alert N days before expiry; dashboard shows expiring evidence count |
| **Audit workspace with evidence bundles** | Auditors expect a dedicated space to request evidence and receive organized bundles; ad-hoc email is unacceptable | HIGH | Audit record → evidence requests → evidence items; auditor-facing view with structured evidence package |
| **Audit evidence request management** | Auditors create requests; internal teams fulfill them; status tracking is table stakes per Drata's Audit Hub model | MEDIUM | Request: what's needed, assigned to, due date, status (open/in-progress/fulfilled/rejected) |
| **Cross-framework control mapping** | SOC 2 + ISO 27001 share 90% of controls; paying twice (duplicate effort, duplicate evidence) is a pain point that drives GRC tool adoption | HIGH | Control-to-framework-requirement join table; one control maps to N framework requirements; evidence reuse across frameworks |
| **Email notifications for assignments and due dates** | Users cannot live in the GRC tool; they need email reminders for tasks, reviews, and expiring items | MEDIUM | Notification record model; email delivery via SMTP/nodemailer; configurable per-user preferences |
| **Executive compliance status report** | CISOs and boards require periodic compliance summaries; every mature GRC tool offers a downloadable report | HIGH | PDF generation from compliance posture data; framework coverage %, control status breakdown, open gaps |
| **Task/work item system** | GRC work needs assignable tickets (remediation, evidence collection, control testing); without this, action items live in Jira outside the platform | MEDIUM | Task: title, description, type, assignee, due_date, status, linked entity (risk/control/vendor/finding) |
| **SLA-based overdue alerts** | Compliance work has regulatory deadlines; overdue items without escalation create audit findings | LOW | SLA config per task type; overdue detection job; notification on breach; escalation chain definition |
| **Webhook outbound for state changes** | Integration teams expect webhooks to connect GRC state changes to downstream tools (Slack, Jira, SIEM); absence blocks enterprise sales | MEDIUM | Webhook subscriptions per event type; HMAC signing; retry with backoff; delivery log |
| **Generic approval workflow (approve/reject/escalate)** | Policy approvals, evidence sign-offs, and vendor onboarding all require structured approvals; ad-hoc approvals via email are an audit finding | MEDIUM | approval_requests table with context_type + context_id; state machine: pending → approved/rejected/escalated; comments |

### Differentiators (Competitive Advantage)

Features that set RiskMind apart from compliance-first tools like Vanta/Drata and give an edge for the agentic v2.2 milestone.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI policy generation from templates** | LLM generates policy drafts from framework requirements + tenant context; saves hours of writing; Vanta and Drata do not offer this | MEDIUM | Template selector → LLM call with framework control context → editable draft; existing AI enrichment pipeline is the model |
| **AI governance model registry with EU AI Act classification** | ISO 42001 + EU AI Act enforcement (August 2026) creates urgent demand; RiskMind shipping a model registry with risk classification before competitors is a genuine first-mover window | HIGH | Models table: name, version, purpose, risk_tier (EU AI Act), owner, deployment_date; linked to ISO 42001 / NIST AI RMF framework controls |
| **ISO 42001 and NIST AI RMF as native frameworks** | AI governance frameworks are not in Vanta/Drata's standard libraries; shipping them as importable frameworks with pre-mapped controls is a differentiator as demand spikes in 2026 | MEDIUM | Pre-built framework import bundles for ISO 42001 and NIST AI RMF; control sets with domain groupings; mapped to AI model registry records |
| **Agent-ready task system (foundation for v2.2 agentic layer)** | Tasks created by the approval workflow, evidence collection, and policy review flows become agent work queue items in v2.2; building this API-first now means agents can consume it without rework | HIGH | API-first task CRUD; assignee field supports both human user IDs and (future) agent IDs; status machine compatible with agent state transitions |
| **Internal event bus for agent orchestration** | The webhook/event system doubles as the internal event backbone for v2.2's agentic GRC department; events emitted today (policy_expired, assessment_due, evidence_expiring) become agent triggers tomorrow | HIGH | Internal event emitter + subscriber pattern; persistent event log table; outbound webhook delivery as layer on top |
| **Multi-entity schema foundation (forward-compatible)** | Adding entity_id to core tables now avoids a costly migration when enterprise customers with subsidiaries arrive; most SMB GRC tools skip this and pay dearly at scale | MEDIUM | entities table; entity_id on risks, controls, vendors, assessments, findings; backward-compatible (default entity = current tenant) |
| **Consolidated cross-framework evidence reuse** | When one piece of evidence satisfies a SOC 2 control AND an ISO 27001 control AND an EU AI Act requirement, surfacing that reuse reduces audit fatigue dramatically | MEDIUM | Evidence-to-control join; control-to-framework-requirement join; query: "what evidence covers requirement X?" chains through both joins |
| **Board-ready executive PDF with risk quantification** | Most PDF reports are static compliance checklists; adding Foresight ALE data (already built) to executive reports makes RiskMind's reports meaningfully different | HIGH | PDF template with: compliance posture table, open risk count + ALE summary, top 5 risks by expected loss, open gap count; puppeteer or @react-pdf/renderer |
| **Hub-and-spoke multi-entity visibility (schema enables v2.2 UI)** | 6clicks, Diligent, and enterprise GRC tools charge significant premiums for consolidated multi-entity dashboards; schema investment now enables this at no additional cost in v2.2 | MEDIUM | entities hierarchy (parent_entity_id); entity-scoped queries; v2.2 will add consolidated views — schema must not prevent rollup queries |
| **Policy AI generation from linked control requirements** | When a policy is linked to specific framework controls, LLM can generate policy language that directly addresses those control requirements — not generic boilerplate | MEDIUM | Policy creation flow: select linked controls → LLM uses control descriptions as generation context → produces requirement-specific draft |

### Anti-Features (Commonly Requested, Often Problematic)

Features that appear on GRC platform feature lists but create disproportionate complexity or conflict with RiskMind's architecture.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **External auditor portal with separate login** | "Our external auditor needs their own login to review evidence" | Requires separate authentication system, cross-tenant data isolation for auditor views, invitation/expiry flows, mobile UX for auditors — a full product track | Audit Hub with read-only share links (scoped evidence bundles with time-limited access tokens); no account creation required for auditors |
| **No-code workflow builder** | "Let compliance managers design their own approval flows with drag-and-drop" | Visual workflow builders are complex UI components with their own data model, execution engine, and debugging experience; 3–6 months of work | Generic approval_requests table with context_type covers all current workflows; v2.2 agentic layer replaces no-code automation entirely |
| **Full ITSM/ticketing replacement** | "Replace Jira for GRC tasks" | GRC teams already use Jira; a competing ticketing system creates adoption friction and duplicate work; Jira integration is what they actually want | Native task system + webhook events → Jira integration (outbound webhook triggers Jira issue creation); both coexist |
| **AI governance auto-scoring of AI systems** | "Automatically assess all our AI models and assign risk scores" | Risk scoring requires understanding business context, training data, intended use, and deployment environment — cannot be reliably automated without human input | Model registry with structured risk tier field (per EU AI Act classification) + AI-assisted assessment questionnaire; human confirms classification |
| **Real-time compliance score streaming** | "Dashboard should show live compliance % as controls are tested" | Continuous recalculation of compliance posture on every change is expensive; framework aggregations are slow at scale; real-time introduces race conditions | Scheduled recalculation (on save + background job); "last calculated" timestamp shown; manual "recalculate" button for urgency |
| **Blockchain audit trail** | "Immutable proof of evidence for regulators" | Operational overhead with no regulatory advantage over append-only hash-chained PostgreSQL audit log; regulators accept SQL-based audit logs | append-only audit_log table with row hashing; this satisfies all current regulatory requirements at zero additional infra cost |
| **SCIM / directory-sync for users** | "Auto-provision users from Azure AD for attestation assignments" | SCIM provider implementation is a significant identity engineering effort; risks creating orphaned records on de-provision | Manual user management for v2.1; SCIM is a v2.3+ feature after social auth (Microsoft OAuth) is complete |
| **Custom PDF report builder (drag-and-drop)** | "Let compliance managers design their own report layouts" | Report builders are their own product; complex rendering, variable data binding, template storage — weeks of work for marginal value | Fixed executive report template (opinionated, polished); JSON-configurable section visibility as a lighter-weight customization option |

---

## Feature Dependencies

```
[Approval Workflow Engine]
    └──required by──> [Policy Management (approval step)]
    └──required by──> [Evidence Collection (sign-off step)]
    └──required by──> [Vendor Onboarding (existing — wire to engine)]
    └──foundation for──> [v2.2 Agent human-in-the-loop approvals]

[Task/Work Item System]
    └──required by──> [Audit Hub (evidence request fulfillment tasks)]
    └──required by──> [Policy Management (review cycle tasks)]
    └──enhances──> [Notifications (tasks trigger SLA alerts)]
    └──foundation for──> [v2.2 Agent work queue]

[Webhook/Event System]
    └──required by──> [Notifications (internal event → email delivery)]
    └──required by──> [Task System (task assignment → notification event)]
    └──foundation for──> [v2.2 Agent triggers (event → agent dispatch)]

[Notifications & Escalations]
    └──requires──> [Webhook/Event System (event source)]
    └──requires──> [Task System (SLA tracking)]
    └──requires──> [Email delivery (nodemailer/SMTP)]

[Policy Management]
    └──requires──> [Approval Workflow Engine (policy approval step)]
    └──requires──> [Existing Controls table (policy-to-control linkage)]
    └──requires──> [Existing Frameworks table (policy-to-framework linkage)]
    └──enhances──> [Cross-Framework Control Mapping (policies map to controls which map to frameworks)]

[Evidence Collection]
    └──requires──> [Existing Controls table (evidence-to-control linkage)]
    └──requires──> [Task System (evidence request → fulfillment task)]
    └──enhances──> [Audit Hub (evidence records populate audit bundles)]
    └──enhances──> [Cross-Framework Control Mapping (evidence reuse across frameworks)]

[Audit Hub]
    └──requires──> [Evidence Collection (evidence records as items)]
    └──requires──> [Task System (evidence requests as tasks)]
    └──requires──> [Approval Workflow Engine (evidence sign-offs)]

[Cross-Framework Control Mapping]
    └──requires──> [Existing Controls table (pivot point)]
    └──requires──> [Existing Frameworks table (target frameworks)]
    └──enhances──> [Evidence Collection (evidence reuse visibility)]
    └──enhances──> [Audit Hub (consolidated evidence for multi-framework audits)]

[Executive Reporting (PDF)]
    └──requires──> [Existing Compliance Posture % (already built)]
    └──requires──> [Existing Foresight ALE data (already built)]
    └──requires──> [Evidence Collection (evidence pack attachments)]
    └──enhances──> [Cross-Framework Control Mapping (multi-framework coverage summary)]

[AI Governance — Model Registry]
    └──requires──> [Existing Frameworks table (ISO 42001 / NIST AI RMF as frameworks)]
    └──requires──> [Existing Controls table (AI-specific controls)]
    └──requires──> [Existing Assessment Engine (AI model risk assessments)]
    └──enhances──> [Cross-Framework Control Mapping (AI controls map to EU AI Act + ISO 42001)]

[Multi-Entity Schema]
    └──required by──> [All core tables (entity_id foreign key)]
    └──foundation for──> [v2.2 Hub-and-spoke multi-entity UI]
    └──no UI dependency in v2.1]

[Webhook/Event System] ──internal event bus──> [Notifications]
[Webhook/Event System] ──outbound delivery──> [External integrations (Slack, Jira, SIEM)]
```

### Dependency Notes

- **Webhook/Event System is the internal backbone:** Notifications, task SLA alerts, and the v2.2 agentic layer all route through it. Build first in Phase 1 so all subsequent features can emit events naturally.
- **Task/Work Item System is the action layer:** Audit evidence requests, policy review cycles, and remediation tracking all generate tasks. Must exist before Audit Hub can function correctly.
- **Approval Workflow Engine unblocks three features:** Policy approval, evidence sign-off, and vendor onboarding (existing) all need it. Generic design with context_type is essential — do not build per-feature approval systems.
- **Multi-Entity Schema must be additive-only in v2.1:** Adding entity_id columns with DEFAULT (current tenant entity) is non-breaking. The schema must be in place before any v2.2 multi-entity UI is attempted.
- **Cross-Framework Control Mapping requires no new framework data:** The existing frameworks and controls tables are the foundation. What's new is the control-to-requirement join table that enables reuse tracking.
- **AI Governance is a framework module on top of existing infrastructure:** ISO 42001 and NIST AI RMF import as framework bundles (leveraging the v2.0 framework import feature). The model registry is a new table but attaches to existing controls and assessment engine.
- **Executive PDF depends on existing data:** Compliance posture %, Foresight ALE, and control status are already computed. The PDF feature is primarily a rendering and template challenge, not a data challenge.
- **Evidence Collection is independent of Audit Hub but feeds it:** Evidence records can exist without an audit; an audit consumes existing evidence records. Ship Evidence Collection first.

---

## v2.1 Feature Definition

### Phase 1: Infrastructure Layer (Build First — Nothing Else Works Without These)

Foundation features that other v2.1 features depend on.

- [ ] **Webhook/Event System** — internal event emitter + subscriber pattern; persistent events table; outbound webhook delivery with HMAC signing, retry, and delivery log; event types: policy_published, evidence_expiring, task_overdue, assessment_due, signal_created, approval_requested, approval_decided
- [ ] **Approval Workflow Engine** — `approval_requests` table with context_type + context_id; state machine: PENDING → APPROVED / REJECTED / ESCALATED; approver assignment; comments; approval history; trigger events on state change
- [ ] **Task/Work Item System** — `tasks` table with title, description, type, assignee_id, due_date, status, priority, linked_entity_type, linked_entity_id; task CRUD API; status transitions; SLA detection job (cron); emit task_overdue events
- [ ] **Multi-Entity Schema** — `entities` table with id, name, parent_entity_id, tenant_id; entity_id column (nullable FK → entities) on: risks, controls, vendors, assessments, findings, policies, evidence; default entity seeded per tenant; backward-compatible

### Phase 2: Policy Management

Builds on Approval Workflow Engine and Webhook/Event System.

- [ ] **Policy CRUD with versioning** — title, description, content (rich text), owner, framework linkage, status (DRAFT/REVIEW/APPROVED/PUBLISHED/RETIRED); major.minor version on each publish; immutable version snapshots
- [ ] **Policy-to-control linkage** — many-to-many policies ↔ controls join table; UI: link controls from policy detail
- [ ] **Approval workflow for policies** — policy publish action creates approval_request(context_type=policy); approval triggers policy status → APPROVED; rejection returns to DRAFT with comment
- [ ] **AI policy generation** — LLM generates draft from selected framework requirements + tenant risk context; shown as editable draft; user confirms before saving
- [ ] **Policy attestation tracking** — attestation_requests table; per-policy-version, per-user; mark as read + acknowledged; attestation report (who has/hasn't attested); emit attestation_overdue events

### Phase 3: Evidence Collection

Builds on Task/Work Item System. Independent of Policy Management.

- [ ] **Evidence record CRUD** — title, description, type (document/screenshot/config/log/api_result), file_url or link, control_ids (array FK), collected_at, expiry_at, auto_collected (bool), collected_by; create/edit/archive
- [ ] **Evidence-to-control linkage** — evidence records reference N controls; control detail shows linked evidence; compliance posture considers evidence presence
- [ ] **Expiry tracking and alerts** — cron job detects evidence expiring within N days (configurable per type); emit evidence_expiring event → notification delivery
- [ ] **Manual evidence upload** — file upload to storage (local disk or S3-compatible); virus scan placeholder; stored URL in evidence record
- [ ] **Evidence status** — ACTIVE / EXPIRING / EXPIRED / ARCHIVED; auto-transition on expiry_at crossing; visible in control detail and evidence list

### Phase 4: Audit Hub

Builds on Evidence Collection and Task/Work Item System.

- [ ] **Audit record CRUD** — audit name, type (SOC 2 / ISO 27001 / internal / custom), auditor name, period_start, period_end, status (PLANNING/IN_PROGRESS/REVIEW/CLOSED)
- [ ] **Evidence request workflow** — auditor creates request: what's needed, linked control, assigned to internal user, due date; creates task(type=evidence_request); fulfillment links evidence record to request
- [ ] **Evidence bundle generation** — collect all fulfilled evidence for an audit period into a downloadable ZIP; bundle includes manifest (control → requirement → evidence mapping)
- [ ] **Audit timeline** — ordered log of audit events: request created, evidence submitted, request fulfilled, bundle generated, audit closed
- [ ] **Auditor access (share link)** — time-limited, read-only share token scoped to one audit record; token grants access to audit evidence bundle without account creation

### Phase 5: Cross-Framework Control Mapping

Builds on existing controls and frameworks tables. Independent of Audit Hub.

- [ ] **Framework requirement records** — `framework_requirements` table: framework_id, requirement_id (e.g. "CC6.1"), title, description; imported from framework bundles
- [ ] **Control-to-requirement mapping** — `control_requirement_mappings` join table: control_id ↔ framework_requirement_id; many-to-many; UI: from control detail, map to requirements across frameworks
- [ ] **Evidence reuse view** — given a framework requirement, show: which controls satisfy it + which evidence covers those controls; "covered by N pieces of evidence" indicator per requirement
- [ ] **Framework overlap summary** — for two selected frameworks, show: controls that cover both, controls unique to each; overlap % — surfaces the SOC 2 ↔ ISO 27001 90% overlap fact visually
- [ ] **Gap view** — requirements with no mapped control (uncovered gaps); requirements with mapped controls but no active evidence (evidence gaps); actionable remediation tasks

### Phase 6: Notifications & Escalations

Builds on Webhook/Event System and Task/Work Item System.

- [ ] **Notification record model** — `notifications` table: user_id, event_type, message, read, created_at, entity_type, entity_id; in-app notification bell (extend existing alert bell)
- [ ] **Email delivery pipeline** — subscribe to webhook events; render email template per event type; deliver via SMTP (nodemailer); configurable SMTP credentials per tenant
- [ ] **Notification preferences** — per-user: enable/disable per event type; digest vs immediate; delivery channel (in-app only / email / both)
- [ ] **Escalation chains** — escalation_rules table: event_type, delay_hours, escalate_to_user_id; if task not resolved within SLA, emit escalation event to next-level owner
- [ ] **Digest emails** — configurable daily/weekly digest of: overdue tasks, expiring evidence, pending approvals; reduces notification noise vs per-event email

### Phase 7: Executive Reporting (PDF)

Builds on Cross-Framework Control Mapping and Evidence Collection. Depends on existing Foresight ALE data.

- [ ] **Compliance posture PDF section** — per-framework: control count, % compliant, % with evidence, open gaps; threshold status (COMPLIANT/AT-RISK/NON-COMPLIANT)
- [ ] **Risk summary PDF section** — top 10 risks by score; top 5 risks by ALE (from Foresight); open incidents count; KRI breach count
- [ ] **Evidence pack summary** — count of evidence records by status (active/expiring/expired); coverage % per framework (requirements with evidence vs total)
- [ ] **PDF generation** — server-side rendering via @react-pdf/renderer or Puppeteer HTML→PDF; report stored as a report_run record with generated_at + download URL; configurable sections
- [ ] **Report scheduling** — optional: monthly/quarterly auto-generation; emit report_generated event → email delivery to configured recipients

### Phase 8: AI Governance

Builds on existing frameworks, controls, and assessment engine.

- [ ] **AI model registry** — `ai_models` table: name, version, description, purpose, training_data_description, owner_id, deployment_date, eu_ai_act_risk_tier (UNACCEPTABLE/HIGH/LIMITED/MINIMAL), status (ACTIVE/DECOMMISSIONED/UNDER_REVIEW)
- [ ] **EU AI Act risk classification** — risk tier field with tier definitions surfaced as tooltips; classification checklist per tier; link to relevant EU AI Act articles
- [ ] **ISO 42001 framework bundle** — pre-built framework import: ISO/IEC 42001:2023 controls (Annex A) with IDs, titles, descriptions, domain groupings; importable via existing framework import flow
- [ ] **NIST AI RMF framework bundle** — pre-built framework import: NIST AI RMF 1.0 core functions (GOVERN, MAP, MEASURE, MANAGE) with sub-categories; importable via existing framework import flow
- [ ] **AI model-to-control linkage** — AI model records link to ISO 42001 / NIST AI RMF controls; satisfies "AI system inventory" requirement of both frameworks
- [ ] **AI model risk assessment** — trigger existing assessment engine with AI governance template (questionnaire covering data lineage, bias testing, human oversight, explainability); score maps to ISO 42001 controls

### Defer to v2.2 or Later

- [ ] **External auditor account creation** — full auditor portal with separate auth (v2.2, after social auth is built in v2.3)
- [ ] **No-code workflow builder** — visual approval flow designer (deferred; agentic layer replaces this need)
- [ ] **SCIM/directory sync** — auto-provisioning from Azure AD (v2.3, after Microsoft OAuth)
- [ ] **Multi-entity UI** — consolidated dashboards across entities (v2.2, uses the schema foundation laid here)
- [ ] **Custom PDF report builder** — drag-and-drop report layout designer (v3)
- [ ] **Jira/Slack outbound webhook integrations** — built on the webhook system established here (v2.2, once webhook system is stable)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Webhook/Event System | HIGH | MEDIUM | P1 — everything else uses it |
| Approval Workflow Engine | HIGH | MEDIUM | P1 — policies + evidence need it |
| Task/Work Item System | HIGH | MEDIUM | P1 — audit hub + notifications need it |
| Multi-Entity Schema | HIGH (future) | MEDIUM | P1 — migration cost rises if deferred |
| Policy Management + versioning | HIGH | MEDIUM | P1 — table stakes for enterprise GRC |
| Policy-to-control linkage | HIGH | LOW | P1 — required for audit traceability |
| Evidence Collection + expiry | HIGH | MEDIUM | P1 — audit readiness requires it |
| Audit Hub + evidence bundles | HIGH | HIGH | P1 — closes competitive gap with Drata |
| Cross-Framework Control Mapping | HIGH | HIGH | P1 — reduces audit fatigue significantly |
| Notifications + email delivery | HIGH | MEDIUM | P1 — users cannot live in the platform |
| SLA-based escalations | MEDIUM | LOW | P2 — enhances notifications |
| Executive PDF reporting | HIGH | HIGH | P2 — board-level deliverable |
| AI Governance — model registry | MEDIUM | MEDIUM | P2 — ISO 42001 demand rising fast |
| ISO 42001 framework bundle | MEDIUM | LOW | P2 — pairs with model registry |
| NIST AI RMF framework bundle | MEDIUM | LOW | P2 — pairs with model registry |
| AI policy generation (LLM) | MEDIUM | MEDIUM | P2 — differentiator, not table stakes |
| Policy attestation tracking | MEDIUM | MEDIUM | P2 — SOC 2 requirement |
| Evidence reuse view | MEDIUM | MEDIUM | P2 — compliance efficiency win |
| Auditor share link (read-only) | MEDIUM | MEDIUM | P2 — replaces external portal need |
| Framework overlap summary | LOW | MEDIUM | P3 — nice visualization |
| Report scheduling | LOW | LOW | P3 — defer until PDF is polished |
| Digest emails | LOW | MEDIUM | P3 — defer until email is working |

**Priority key:**
- P1: Must ship in v2.1 — milestone fails without it
- P2: Should ship in v2.1 — competitive parity and differentiation
- P3: Nice to have — defer if time-constrained

---

## Competitor Feature Analysis

| Feature | Vanta | Drata | ServiceNow GRC | RiskMind v2.1 Approach |
|---------|-------|-------|----------------|------------------------|
| Policy management | Template library, version tracking, attestation | Policy management with version control, approvals | Full policy lifecycle with multi-level approvals | Versioned policies + AI generation + linked controls |
| Evidence collection | Auto-collection from 300+ integrations; manual upload | Automated + manual; expiry tracking; 200+ integrations | Full evidence lifecycle management | Manual upload + auto_collected flag; expiry tracking; integration hooks via webhook system |
| Audit hub | Auditor collaboration portal | Dedicated Audit Hub product with evidence bundles | Audit workspace with structured request management | Internal audit hub; time-limited auditor share links (no external account) |
| Cross-framework mapping | UCF-based control mapping; 200+ frameworks | Cross-framework control mapping built-in | Unified Control Framework integration | Native control-to-requirement join; evidence reuse view; overlap analysis |
| Executive reporting | Customizable compliance reports; Trust Center | Compliance reports; board-ready summaries | Configurable report builder | PDF report: posture + ALE risk summary + evidence pack |
| AI governance | Limited (not a core focus) | Limited | IBM OpenPages AI governance module | First-class: ISO 42001 + NIST AI RMF + EU AI Act model registry |
| Notifications | Email + Slack; configurable | Email + Slack + Teams; configurable | Full notification engine with escalation chains | Email + in-app; SLA-based escalation chains |
| Multi-entity | Organization hierarchy (enterprise plan) | Limited multi-org | Full enterprise hierarchy | Schema foundation in v2.1; full UI in v2.2 |
| Webhooks | Yes (enterprise) | Yes | Yes (extensive) | Built as internal event bus + outbound delivery |
| Approval workflows | Policy approvals | Evidence and policy approvals | Configurable multi-level workflows | Generic approval_requests table; reusable across all entity types |
| Task system | Tasks linked to controls | Remediation tasks | Full ITSM-style task management | Native tasks + Jira webhook bridge (v2.2) |

---

## Existing v2.0 Dependencies

The following v2.0 features are already built and are required inputs for v2.1 features. They are not rebuilt — they are consumed.

| v2.0 Feature | How v2.1 Uses It |
|--------------|-----------------|
| Compliance framework tracking + controls table | Policy-to-control linkage; cross-framework mapping pivot point |
| Assessment Engine | AI model risk assessments (AI governance); evidence collection via assessment responses |
| Framework import (CSV/JSON) | ISO 42001 and NIST AI RMF imported as framework bundles |
| Alert system | Augmented (not replaced) by new notification system; existing alerts remain |
| Foresight ALE data | Executive PDF includes ALE risk summary from existing Monte Carlo results |
| Vendor onboarding wizard | Wired to Approval Workflow Engine for vendor approval step |
| Signal pipeline | Webhook events include signal_created; downstream integrations can react |
| ECharts dashboard | Executive report PDF mirrors dashboard data; no new data computation needed |

---

## Sources

- [Vanta GRC product page](https://www.vanta.com/products/grc) — MEDIUM confidence
- [Drata Audit Hub product page](https://drata.com/product/audit-hub) — HIGH confidence (official product docs)
- [Vanta vs OneTrust vs Drata comparison — Drata blog](https://drata.com/blog/vanta-vs-onetrust-vs-drata) — MEDIUM confidence
- [GRC policy management guide — Sprinto](https://sprinto.com/blog/grc-policy-management/) — MEDIUM confidence
- [Centraleyes GRC policy management best practices](https://www.centraleyes.com/grc/10-essential-grc-policy-management-best-practices/) — MEDIUM confidence
- [ISO 42001 implementation guide 2026 — SecurePrivacy](https://secureprivacy.ai/blog/iso-42001-implementation-guide-2026) — MEDIUM confidence
- [EU AI Act and ISO 42001 pairing — ISACA](https://www.isaca.org/resources/news-and-trends/industry-news/2025/isoiec-42001-and-eu-ai-act-a-practical-pairing-for-ai-governance) — HIGH confidence
- [ISO 42001 redefining AI governance 2026 — AIGovernanceToday](https://www.aigovernancetoday.com/news/iso-42001-redefining-ai-governance-2026) — MEDIUM confidence
- [Unified compliance framework — Sprinto](https://sprinto.com/blog/unified-compliance-framework/) — MEDIUM confidence
- [Unified control frameworks — TrustCloud](https://www.trustcloud.ai/grc/how-to-build-a-unified-control-framework-for-multi-standard-compliance/) — MEDIUM confidence
- [ServiceNow evidence request workflow docs](https://www.servicenow.com/docs/bundle/yokohama-governance-risk-compliance/page/product/grc-audit/concept/evidence-request-workflow.html) — HIGH confidence (official docs)
- [Best GRC software for auditors — CyberArrow](https://www.cyberarrow.io/blog/best-grc-software-for-auditors/) — MEDIUM confidence
- [Automated evidence collection types — Anecdotes AI](https://www.anecdotes.ai/post/3-types-of-automated-compliance-evidence-which-do-you-need) — MEDIUM confidence
- [Hub and spoke multi-entity architecture — 6clicks](https://www.6clicks.com/features/hub-spoke-multi-entity-architecture) — HIGH confidence (official product docs)
- [Multi-entity GRC architecture — Risk Cognizance](https://riskcognizance.com/product/managing-a-multi-entity-grc-architecture) — MEDIUM confidence
- [GRC notifications, reminders and escalations — SAP](https://help.sap.com/docs/SUPPORT_CONTENT/grc/3362386819.html) — HIGH confidence (official docs)
- [Hyperproof GRC platforms 8 features](https://hyperproof.io/resource/grc-platforms-features-you-need/) — MEDIUM confidence
- [Top GRC tools 2026 — Sprinto](https://sprinto.com/blog/grc-tools/) — MEDIUM confidence

---
*Feature research for: RiskMind v2.1 — Policy Management, Evidence Collection, Audit Hub, Cross-Framework Mapping, Executive Reporting, Notifications, AI Governance, Multi-Entity Schema, Webhook System, Approval Workflows, Task System*
*Researched: 2026-03-26*
