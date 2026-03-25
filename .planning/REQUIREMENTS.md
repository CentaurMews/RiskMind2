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

- [ ] **FRST-01**: User can run Monte Carlo simulations with FAIR-labeled inputs (TEF, TC, CS, DIFF) for 10k-100k iterations, producing ALE and percentile breakdown
- [ ] **FRST-02**: User can view loss exceedance curve visualization with configurable confidence interval markers (50th, 90th, 99th percentile)
- [ ] **FRST-03**: User can create, save, clone, and compare named risk scenarios with parameter sets linked to risk register entries
- [ ] **FRST-04**: System suggests simulation parameters from real OSINT data (CVE/NVD frequency, MISP threat data, Shodan exposure) with "calibrated from real data" indicator
- [ ] **FRST-05**: Dashboard shows top-N risks by expected annual loss (ALE) widget integrated with existing KPI section

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
| FRST-01 | Phase 14 | Pending |
| FRST-02 | Phase 14 | Pending |
| FRST-03 | Phase 14 | Pending |
| FRST-04 | Phase 14 | Pending |
| FRST-05 | Phase 14 | Pending |

**Coverage:**
- v2.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 — phase mappings added for v2.0 roadmap*
