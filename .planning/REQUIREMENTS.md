# Requirements: RiskMind

**Defined:** 2026-03-23
**Core Value:** A working, demo-ready enterprise risk management platform that an internal organization can use to manage real risks, vendors, and compliance — powered by intelligent AI routing and accessible via https://app.riskmind.net.

## v2.0 Requirements

Requirements for Core Platform Features milestone. Each maps to roadmap phases.

### Assessment Engine

- [x] **ASMT-01**: User can create, edit, and delete assessment templates with questions of various types (text, boolean, multiple choice, numeric) and configurable weights
- [x] **ASMT-02**: User can define conditional branching rules on questions (IF answer to Q equals/contains/greater-than value THEN show/hide question) via JSON condition editor
- [x] **ASMT-03**: User can create an assessment from a template, assign it to a subject (vendor or compliance framework), track responses, and mark it complete
- [x] **ASMT-04**: System computes weighted numeric scores per question, section, and overall assessment with configurable scoring mode
- [x] **ASMT-05**: LLM generates contextual follow-up questions based on prior responses during an active assessment session
- [x] **ASMT-06**: System provides pre-built assessment templates (Vendor Security/SIG Lite-inspired, Compliance Control/ISO 27001-inspired, Incident Assessment)
- [x] **ASMT-07**: After assessment submission, LLM analyzes response set to highlight anomalies, inconsistencies, and gaps stored as ai_summary

### Vendor Lifecycle

- [x] **VNDR-01**: User can onboard a vendor through a 4-step wizard: identity+tier, questionnaire assignment, document upload, AI enrichment review
- [x] **VNDR-02**: AI enrichment triggers during onboarding wizard to auto-populate vendor profile with industry, risk indicators, and known breaches
- [x] **VNDR-03**: User can add and view 4th-party subprocessors per vendor, with LLM extraction from uploaded vendor documents
- [x] **VNDR-04**: User can configure per-tier continuous monitoring cadence (Critical: weekly, High: monthly, etc.) with scheduled re-assessments and alerts on score threshold breach
- [x] **VNDR-05**: Vendor risk score aggregates from latest assessment score, displayed on scorecard and kanban card
- [x] **VNDR-06**: User can complete an org-level dependency interview identifying core vendor dependencies (email provider, cloud environment, CDN, etc.) to detect vendor concentration risk
- [x] **VNDR-07**: System cross-references org dependency data with signals (OSINT, Shodan, assessments, breach reports) to calibrate vendor risk and flag concentration risks

### Compliance Flow

- [x] **COMP-01**: User can import compliance framework controls via CSV or JSON with validation and duplicate detection
- [x] **COMP-02**: User can assign assessment templates to a compliance framework, mapping questions to control IDs, with responses updating control compliance status
- [x] **COMP-03**: User can configure per-framework compliance thresholds (0-100%) with dashboard showing COMPLIANT/AT-RISK/NON-COMPLIANT status

### Signal Integrations

- [x] **SGNL-01**: System polls NVD API v2 on configurable schedule, filters by tenant-configured product/vendor tags, and auto-creates signals with CVE ID, CVSS score, and description
- [x] **SGNL-02**: System queries Shodan API by domain/IP for vendor records, surfacing open ports, exposed services, and CVE matches as signals
- [x] **SGNL-03**: System ingests Microsoft Sentinel alerts/incidents via Log Analytics API with OAuth2 credentials, normalizing to signal schema and deduplicating by incident ID
- [x] **SGNL-04**: System connects to MISP instances via API key, pulling events and attributes (IP, domain, hash, CVE) normalized to signals with configurable feed selection
- [x] **SGNL-05**: System polls configured IMAP mailbox, using LLM to extract signal fields from email subject and body, with deduplication by message-id

### Foresight

- [x] **FRST-01**: User can run Monte Carlo simulations with FAIR-labeled inputs (TEF, TC, CS, DIFF) for 10k-100k iterations, producing ALE and percentile breakdown
- [x] **FRST-02**: User can view loss exceedance curve visualization with configurable confidence interval markers (50th, 90th, 99th percentile)
- [x] **FRST-03**: User can create, save, clone, and compare named risk scenarios with parameter sets linked to risk register entries
- [x] **FRST-04**: System suggests simulation parameters from real OSINT data (CVE/NVD frequency, MISP threat data, Shodan exposure) with "calibrated from real data" indicator
- [x] **FRST-05**: Dashboard shows top-N risks by expected annual loss (ALE) widget integrated with existing KPI section

## Future Requirements

### i18n & Social Auth (v2.1)

- **I18N-01**: Multi-language support (EN, ES, AR with RTL)
- **AUTH-01**: Social login implementation (Microsoft, Google OAuth)
- **AUTH-02**: User self-registration workflow

### Deferred from v2.0

- **ASMT-08**: Visual flowchart editor for assessment branching rules (drag-and-drop canvas)
- **VNDR-08**: External vendor portal for direct questionnaire submission
- **LLM-01**: LLM observability dashboard with token cost analytics
- **RISK-01**: Risk clustering UI via pgvector similarity

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native app | Responsive web covers mobile needs |
| SOAR playbook execution | Separate product category; treatment suggestions close the loop |
| Blockchain audit trail | Append-only audit log with hash chaining sufficient for compliance |
| ML risk prediction from historical data | Requires data volume not present at v2.0; Monte Carlo achieves similar value |
| Quantitative scoring from Shodan port scans alone | Misleading without full context; Shodan findings feed into assessment-based scoring |
| Real-time SIEM streaming (WebSocket) | Batch polling sufficient; sub-second streaming adds infrastructure complexity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ASMT-01 | Phase 10 | Complete |
| ASMT-02 | Phase 10 | Complete |
| ASMT-03 | Phase 10 | Complete |
| ASMT-04 | Phase 10 | Complete |
| ASMT-05 | Phase 10 | Complete |
| ASMT-06 | Phase 10 | Complete |
| ASMT-07 | Phase 10 | Complete |
| VNDR-01 | Phase 11 | Complete |
| VNDR-02 | Phase 11 | Complete |
| VNDR-03 | Phase 11 | Complete |
| VNDR-04 | Phase 11 | Complete |
| VNDR-05 | Phase 11 | Complete |
| VNDR-06 | Phase 11 | Complete |
| VNDR-07 | Phase 11 | Complete |
| COMP-01 | Phase 13 | Complete |
| COMP-02 | Phase 13 | Complete |
| COMP-03 | Phase 13 | Complete |
| SGNL-01 | Phase 12 | Complete |
| SGNL-02 | Phase 12 | Complete |
| SGNL-03 | Phase 12 | Complete |
| SGNL-04 | Phase 12 | Complete |
| SGNL-05 | Phase 12 | Complete |
| FRST-01 | Phase 14 | Complete |
| FRST-02 | Phase 14 | Complete |
| FRST-03 | Phase 14 | Complete |
| FRST-04 | Phase 14 | Complete |
| FRST-05 | Phase 14 | Complete |

**Coverage:**
- v2.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

## v2.1 Requirements

Requirements for Enterprise Parity & Agent-Ready Foundation milestone. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: System emits events on state changes (policy published, evidence expiring, task overdue, assessment due, signal created, approval requested/decided) to a persistent event log with subscriber dispatch
- [ ] **INFRA-02**: Admin can register outbound webhook subscriptions per event type with HMAC-signed payloads, retry with backoff, and a delivery log
- [ ] **INFRA-03**: User can create, view, and resolve approval requests with context_type (policy/evidence/vendor) and status transitions (PENDING → APPROVED/REJECTED/ESCALATED) with approver assignment and comments
- [ ] **INFRA-04**: User can create, assign, and track tasks with title, type, assignee, due date, priority, status, and linked entity (risk/control/vendor/finding/policy/evidence)
- [ ] **INFRA-05**: System detects overdue tasks based on SLA configuration and emits task_overdue events
- [ ] **INFRA-06**: Multi-entity schema exists with entities table (id, name, parent_entity_id, tenant_id) and entity_id nullable FK on risks, controls, vendors, assessments, findings, policies, evidence, and tasks — backward-compatible with default entity per tenant

### Policy Management

- [ ] **POL-01**: User can create, edit, and delete policies with title, content (rich text), owner, status (DRAFT/REVIEW/APPROVED/PUBLISHED/RETIRED), and framework linkage
- [ ] **POL-02**: System creates immutable version snapshots (major.minor) on each publish, with diff view between versions and "which policy was in effect on date X" queryable
- [ ] **POL-03**: User can link policies to controls (many-to-many) and view linked controls from policy detail and linked policies from control detail
- [ ] **POL-04**: Publishing a policy triggers an approval request; approval transitions status to APPROVED; rejection returns to DRAFT with comment
- [ ] **POL-05**: User can generate a policy draft via LLM from selected framework requirements and tenant risk context, shown as editable draft before saving
- [ ] **POL-06**: Admin can request policy attestation per policy version per user; system tracks read + acknowledge status with timestamp and cryptographic hash (content + user + timestamp) for tamper-evident attestation records
- [ ] **POL-07**: Admin can view attestation reports showing who has/hasn't attested per policy version, with overdue attestation events emitted

### Evidence Collection

- [ ] **EVID-01**: User can create, edit, and archive evidence records with title, type (document/screenshot/config/log/api_result), file or link, linked control IDs, collected_at, expiry_at, auto_collected flag, and SHA-256 content hash for integrity verification
- [ ] **EVID-02**: User can upload evidence files (local disk storage) with evidence record creation
- [ ] **EVID-03**: System tracks evidence status (ACTIVE/EXPIRING/EXPIRED/ARCHIVED) with auto-transition on expiry_at and emits evidence_expiring events N days before expiry
- [ ] **EVID-04**: User can view evidence linked to controls, and control detail shows linked evidence with status indicators

### Audit Hub

- [ ] **AUDIT-01**: User can create, edit, and close audit records with name, type (SOC 2/ISO 27001/internal/custom), auditor name, audit period (start/end), and status (PLANNING/IN_PROGRESS/REVIEW/CLOSED)
- [ ] **AUDIT-02**: User can create evidence requests within an audit specifying what's needed, linked control, assigned internal user, and due date — request creates a task (type=evidence_request) for the assignee
- [ ] **AUDIT-03**: Assignee can fulfill evidence requests by linking existing evidence records; request status tracks (OPEN/IN_PROGRESS/FULFILLED/REJECTED)
- [ ] **AUDIT-04**: User can generate a downloadable evidence bundle (ZIP) for an audit containing all fulfilled evidence with a manifest mapping controls → requirements → evidence
- [ ] **AUDIT-05**: User can generate a time-limited, read-only share link scoped to one audit record, granting access to the audit evidence bundle without account creation

### Cross-Framework Control Mapping

- [ ] **XMAP-01**: User can map a single control to requirements across multiple frameworks via a control-to-framework-requirement join table
- [ ] **XMAP-02**: User can view which evidence satisfies requirements across multiple frameworks (evidence reuse view) showing "covered by N pieces of evidence" per requirement
- [ ] **XMAP-03**: User can select two frameworks and see shared controls, unique controls, and overlap percentage
- [ ] **XMAP-04**: User can view gap analysis: requirements with no mapped control (uncovered) and requirements with mapped controls but no active evidence (evidence gaps)

### Notifications & Escalations

- [ ] **NOTIF-01**: System delivers in-app notifications (extending existing alert bell) and email notifications via SMTP/nodemailer with per-event-type templates
- [ ] **NOTIF-02**: User can configure notification preferences per event type: enable/disable, delivery channel (in-app only/email/both), immediate vs digest
- [ ] **NOTIF-03**: System auto-escalates unresolved tasks to next-level owner based on configurable escalation rules (event_type, delay_hours, escalate_to)
- [ ] **NOTIF-04**: System sends configurable daily/weekly digest emails summarizing overdue tasks, expiring evidence, and pending approvals

### Executive Reporting

- [ ] **REPORT-01**: User can generate a compliance posture PDF report showing per-framework control count, % compliant, evidence coverage %, open gaps, and threshold status
- [ ] **REPORT-02**: PDF report includes risk summary section with top 10 risks by score and top 5 risks by expected annual loss (ALE from Foresight)
- [ ] **REPORT-03**: PDF report includes evidence pack summary with evidence counts by status and coverage % per framework
- [ ] **REPORT-04**: Admin can schedule monthly/quarterly auto-generation of reports with email delivery to configured recipients

### AI Governance

- [ ] **AIGOV-01**: User can register AI models/systems in a registry with name, version, purpose, training data description, owner, deployment date, EU AI Act risk tier, and status (ACTIVE/DECOMMISSIONED/UNDER_REVIEW)
- [ ] **AIGOV-02**: EU AI Act risk classification field (UNACCEPTABLE/HIGH/LIMITED/MINIMAL) with tier definitions, classification checklist, and relevant article references
- [ ] **AIGOV-03**: Pre-built ISO 42001 (Annex A) and NIST AI RMF 1.0 framework bundles importable via existing compliance framework import flow
- [ ] **AIGOV-04**: User can link AI model records to ISO 42001/NIST AI RMF controls, satisfying "AI system inventory" requirements
- [ ] **AIGOV-05**: User can trigger AI governance risk assessment via existing assessment engine with a pre-built AI governance template covering data lineage, bias testing, human oversight, and explainability

## Future Requirements

### Agentic GRC Department (v2.2)

- **AGENT-01**: Paperclip-inspired, RiskMind-native agent orchestration with heartbeat model
- **AGENT-02**: Agent roles (CISO, Compliance Manager, TPRM Manager, Risk Analyst, Reporting)
- **AGENT-03**: External communication channels (email, Teams, WhatsApp)
- **AGENT-04**: Human-in-the-loop approval flows via RiskMind approval engine
- **AGENT-05**: Budget enforcement and audit trail per agent
- **ENTITY-01**: Multi-entity management UI with consolidated group dashboards
- **ENTITY-02**: Policy inheritance across entity hierarchy
- **ENTITY-03**: Cross-entity risk correlation and contagion analysis
- **ENTITY-04**: Entity-scoped RBAC (admin in one entity, viewer in another)

### i18n & Social Auth (v2.3)

- **I18N-01**: Multi-language support (EN, ES, AR with RTL)
- **AUTH-01**: Social login implementation (Microsoft, Google OAuth)
- **AUTH-02**: User self-registration workflow

### Deferred from v2.1

- **CRYPTO-01**: HSM support for cryptographic attestation assurances
- **ASMT-08**: Visual flowchart editor for assessment branching rules (drag-and-drop canvas)
- **VNDR-08**: External vendor portal for direct questionnaire submission
- **LLM-01**: LLM observability dashboard with token cost analytics
- **RISK-01**: Risk clustering UI via pgvector similarity
- **SCIM-01**: SCIM/directory sync for auto-provisioning from Azure AD
- **JIRA-01**: Jira/Slack outbound webhook integrations

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native app | Responsive web covers mobile needs |
| External auditor portal with separate login | Time-limited share links cover auditor access without a full auth track |
| No-code workflow builder | Deferred — agentic layer (v2.2) replaces this need entirely |
| Blockchain audit trail | Append-only hash-chained PostgreSQL audit log provides same guarantees |
| SOAR playbook execution | Treatment suggestions close the loop; separate product category |
| Custom PDF report builder | Fixed opinionated template; JSON-configurable section visibility as lighter alternative |
| AI governance auto-scoring | Requires human context; assessment questionnaire + human confirmation is more reliable |
| Real-time compliance score streaming | Scheduled recalculation on save + background job; "last calculated" timestamp shown |
| Full ITSM/ticketing replacement | Native task system + webhook bridge to Jira; both coexist |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 20 | Pending |
| INFRA-02 | Phase 20 | Pending |
| INFRA-03 | Phase 20 | Pending |
| INFRA-04 | Phase 20 | Pending |
| INFRA-05 | Phase 20 | Pending |
| INFRA-06 | Phase 20 | Pending |
| POL-01 | Phase 21 | Pending |
| POL-02 | Phase 21 | Pending |
| POL-03 | Phase 21 | Pending |
| POL-04 | Phase 21 | Pending |
| POL-05 | Phase 21 | Pending |
| POL-06 | Phase 21 | Pending |
| POL-07 | Phase 21 | Pending |
| EVID-01 | Phase 22 | Pending |
| EVID-02 | Phase 22 | Pending |
| EVID-03 | Phase 22 | Pending |
| EVID-04 | Phase 22 | Pending |
| AUDIT-01 | Phase 23 | Pending |
| AUDIT-02 | Phase 23 | Pending |
| AUDIT-03 | Phase 23 | Pending |
| AUDIT-04 | Phase 23 | Pending |
| AUDIT-05 | Phase 23 | Pending |
| XMAP-01 | Phase 24 | Pending |
| XMAP-02 | Phase 24 | Pending |
| XMAP-03 | Phase 24 | Pending |
| XMAP-04 | Phase 24 | Pending |
| NOTIF-01 | Phase 25 | Pending |
| NOTIF-02 | Phase 25 | Pending |
| NOTIF-03 | Phase 25 | Pending |
| NOTIF-04 | Phase 25 | Pending |
| REPORT-01 | Phase 26 | Pending |
| REPORT-02 | Phase 26 | Pending |
| REPORT-03 | Phase 26 | Pending |
| REPORT-04 | Phase 26 | Pending |
| AIGOV-01 | Phase 27 | Pending |
| AIGOV-02 | Phase 27 | Pending |
| AIGOV-03 | Phase 27 | Pending |
| AIGOV-04 | Phase 27 | Pending |
| AIGOV-05 | Phase 27 | Pending |

**Coverage:**
- v2.1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 — v2.1 traceability updated with phase assignments (Phases 20-27)*
