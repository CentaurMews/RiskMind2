# Feature Research

**Domain:** Enterprise Risk Management (ERM) Platform — MVP to Demo-Ready
**Researched:** 2026-03-17
**Confidence:** MEDIUM-HIGH (web research + domain analysis of existing codebase)

---

## Context: What Already Exists

RiskMind already has a functioning MVP with:
- Risk register (CRUD, treatments, KRIs, incidents, review cycles)
- TPRM vendor management (7-state lifecycle, risk-tiered routing)
- Compliance frameworks (controls, gap analysis, control testing)
- Signal + findings pipeline
- Alert system
- AI enrichment job queue (OpenAI + Anthropic)
- AI interview sessions
- Autonomous risk intelligence agent
- MCP endpoint
- React frontend (dashboard, heatmap, vendor detail, compliance, alerts, foresight, settings)
- Multi-tenant RBAC (admin, risk_manager, risk_owner, auditor, viewer, vendor)

This research focuses on what elevates the existing MVP to a **polished, demo-ready state** that would impress enterprise evaluators.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that enterprise stakeholders assume exist. Missing these makes the product feel unfinished or amateur.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Responsive, polished dashboard UI** | Executives judge software by visual quality in first 30 seconds | MEDIUM | shadcn/ui + Tailwind already in stack — needs visual hierarchy, card layout consistency, color system |
| **Risk heatmap (5x5 likelihood/impact)** | Universal ERM standard — no serious platform lacks one | LOW | Backend exists; ensure smooth interactivity, color bands, drill-down on click |
| **Executive summary / risk overview panel** | C-suite needs a single glance view of risk posture | MEDIUM | Top risks by score, trend lines, open treatments count, overdue items |
| **KRI (Key Risk Indicator) tracking** | Standard ERM concept — auditors/CROs look for this | MEDIUM | Data model exists; needs visible dashboard widget and threshold alerts |
| **Risk appetite / tolerance display** | Organizations must demonstrate they set and monitor limits | MEDIUM | Should show current exposure vs defined thresholds visually |
| **Audit trail / activity log** | Compliance and auditors require evidence of changes | MEDIUM | Who changed what and when — per risk, per vendor, per control |
| **Role-based UI enforcement** | Viewers should not see admin controls; auditors read-only | LOW | RBAC exists in backend — verify UI hides/disables appropriately |
| **Empty state messaging** | Demo with no data must still look intentional and guided | LOW | Placeholder illustrations + "Get started" CTAs instead of blank tables |
| **Loading states and error states** | Skeleton screens, spinners, toast notifications for errors | LOW | Critical for perceived quality during demo — janky loading breaks trust |
| **Vendor risk scorecard summary** | TPRM standard — vendors need a risk score at a glance | MEDIUM | Score, tier (critical/high/medium/low), last assessment date, open findings |
| **Compliance posture percentage** | "You are 73% compliant with ISO 27001" is a table-stakes display | LOW | Aggregate control pass/fail % per framework |
| **Alert / notification center** | Users need to know what requires attention | LOW | Backend exists; ensure UI surfaces unread count and prioritized list |
| **Pagination + search + filter on all lists** | Enterprise data volumes require navigation tools | MEDIUM | Every list view (risks, vendors, controls, signals) needs filter + search |
| **Export / download (PDF or CSV)** | Compliance teams and auditors always need exports | MEDIUM | Risk register CSV export is minimum; board report PDF is the stretch goal |
| **Consistent navigation structure** | Users must orient themselves within 10 seconds | LOW | Fixed sidebar, active state, breadcrumbs on detail pages |
| **Login / tenant-aware access** | Must work from a public Cloudflare URL without friction | LOW | Login page already exists — ensure demo credentials are seeded |
| **Seed data for demo** | A demo with empty database is not demoable | LOW | Seed realistic risk scenarios, 3-5 vendors, 2 compliance frameworks, sample alerts |

### Differentiators (Competitive Advantage)

Features that distinguish RiskMind from generic ERM tools and create "wow" moments in demos.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI-powered risk enrichment (visible)** | Shows AI isn't decoration — enriched risks have more context, better treatment suggestions | MEDIUM | Surface the AI enrichment result visibly on risk detail: "AI-enriched on [date]" with summary |
| **Autonomous risk intelligence agent** | No other ERM tool has an agent that proactively monitors and creates risks | HIGH | The foresight page needs to make the agent's work visible — what it found, why, confidence level |
| **AI interview for risk creation** | Guided conversational risk intake is a UX leap over forms | MEDIUM | The interview session flow needs polish — clear progress, good default prompts, result preview |
| **Risk-to-signal linkage** | Show how external signals (news, threat feeds) flow into risk creation | HIGH | The signal → finding → risk pipeline needs visual traceability — not just separate lists |
| **MCP endpoint (AI agent integration)** | Unique positioning: "Claude/GPT can query your risk register" | LOW | Surface this in settings or docs; show a sample query result; this is a differentiator for tech-savvy demos |
| **Real-time risk score trend** | Show how risk scores change over time, not just current snapshot | MEDIUM | Sparkline or mini chart on risk cards showing 30-day trend |
| **Vendor lifecycle visualization** | The 7-state vendor lifecycle is a differentiator vs basic vendor lists | MEDIUM | Kanban-style board or pipeline view of vendors moving through states |
| **Multi-framework compliance overlap** | Show how one control satisfies ISO 27001, SOC 2, and NIST simultaneously | HIGH | Cross-framework control mapping is rare and impressive to compliance teams |
| **AI-generated risk treatment suggestions** | "Based on similar risks, we recommend..." | MEDIUM | Requires AI enrichment output to include suggested treatments — surface these in the UI |
| **Risk clustering / semantic grouping** | pgvector is already in stack — use it to surface "similar risks" | HIGH | "Risks like this one" panel on risk detail is both useful and demonstrably AI-native |
| **Configurable risk intelligence policy tiers** | Shows enterprise-grade configurability vs one-size-fits-all | MEDIUM | Policy tier settings page must be clear and demo-friendly |
| **Tenant-scoped LLM configuration** | Each tenant uses their own AI keys and model preferences | MEDIUM | Settings page showing per-tenant LLM configuration shows mature multi-tenant design |

### Anti-Features (Explicitly Avoid at This Stage)

Features that seem good but add scope, complexity, or maintenance burden without enough demo value.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time collaborative editing** | "Like Google Docs for risk registers" | WebSocket complexity, conflict resolution, significantly increases testing surface | Single-user editing with optimistic updates and refresh is fine for ERM use cases |
| **Mobile native app** | Risk managers work on phones | Already out of scope; responsive web covers mobile needs adequately at this stage | Ensure responsive Tailwind layout works on mobile browser |
| **Custom report builder (drag/drop)** | "Let users build their own dashboards" | High complexity, low demo value vs pre-built executive dashboards | Build 2-3 well-designed fixed report views instead |
| **Integrations with external SIEM/ERP** | "We need to pull data from Splunk / SAP" | Integration surface is enormous; each connector is its own project | Focus on manual signal ingestion + API; mention integrations as roadmap |
| **Advanced Monte Carlo simulation** | "We need quantitative risk analysis" | High complexity, requires actuarial-style models, niche audience | Show qualitative risk scoring with trend visualization instead |
| **Blockchain audit trail** | "Immutable evidence for regulators" | Unnecessary for demo; adds infrastructure complexity | Standard database audit log with timestamp + user is sufficient for all realistic compliance needs |
| **SSO / SAML / OIDC federation** | "Our IT requires SSO" | Complex to implement and test; blocks demo if misconfigured | Seed demo accounts with JWT login; mention SSO as post-launch integration |
| **Vendor self-service portal** | "Vendors fill out their own questionnaires" | Requires separate auth, different UX flow, complex workflow orchestration | Show vendor risk management from the risk manager's perspective; vendor portal is a v2 feature |
| **Multi-cloud / high-availability deployment** | "What's the uptime SLA?" | Out of scope per PROJECT.md; single-server deployment is the goal | Cloudflare tunnel provides reliable public access; HA is post-demo infrastructure work |

---

## Feature Dependencies

```
[Seed Data]
    └──required by──> [Executive Dashboard]
    └──required by──> [Risk Heatmap Drill-Down]
    └──required by──> [Demo Credibility]

[AI Enrichment (backend)]
    └──enables──> [AI-Enriched Risk Detail Display]
    └──enables──> [AI Treatment Suggestions]
    └──enables──> [Risk Clustering / Similar Risks]

[Signal Pipeline (backend)]
    └──enables──> [Signal → Finding → Risk Traceability UI]
    └──enables──> [Autonomous Agent Visible Work Trail]

[Risk Score Calculation]
    └──required by──> [Risk Heatmap]
    └──required by──> [Risk Trend Sparklines]
    └──required by──> [Executive Summary Panel]

[Risk Appetite Definition]
    └──required by──> [Risk Appetite vs Exposure Display]
    └──required by──> [KRI Threshold Alerts]

[RBAC Roles (backend)]
    └──required by──> [Role-Based UI Enforcement]
    └──required by──> [Demo User Seeding (multiple roles)]

[Compliance Controls (backend)]
    └──required by──> [Compliance Posture Percentage]
    └──required by──> [Cross-Framework Control Mapping]

[Vendor Lifecycle (7-state, backend)]
    └──enables──> [Vendor Pipeline/Kanban View]
    └──required by──> [Vendor Risk Scorecard]
```

### Dependency Notes

- **Seed data required by all demo features:** Without realistic seed data, no UI feature can be demonstrated. This must be the first thing established post-deployment.
- **AI enrichment must have run before AI UI features show value:** The enrichment jobs must be triggered and completed for risk detail pages to show AI output.
- **Signal pipeline must produce findings for traceability to be visible:** The autonomous agent + signal pipeline must have processed at least a few signals to demonstrate the flow.
- **Risk appetite must be configured before KRI thresholds make sense:** The settings for risk appetite thresholds drive the alert/KRI display; without them, the feature looks empty.

---

## Demo-Ready Definition

### Must Have Before Demo (P1)

These are the blockers. The demo fails or looks amateurish without them.

- [ ] **Deployment working** — app running at Cloudflare tunnel URL, accessible from browser
- [ ] **Seed data populated** — realistic risks, vendors, frameworks, alerts, signals loaded
- [ ] **Dashboard visually polished** — clean layout, proper spacing, consistent card design
- [ ] **Risk heatmap functional** — renders correctly, clickable cells drill down to risk list
- [ ] **Empty states handled** — no blank white boxes on any page
- [ ] **Loading and error states** — no broken spinners or raw error messages in UI
- [ ] **Role-based UI working** — demo accounts for admin, risk_manager, auditor roles behave differently
- [ ] **Navigation consistent** — sidebar active states, breadcrumbs, page titles all correct
- [ ] **Vendor list + detail functional** — vendor scorecard summary visible, lifecycle state shown
- [ ] **Compliance posture visible** — framework list shows % completion, framework detail shows control status

### Should Have for Strong Demo (P2)

These elevate from "functional" to "impressive."

- [ ] **AI enrichment visible on risk detail** — "AI-enriched" badge, summary, suggested treatments displayed
- [ ] **Foresight page shows agent work** — autonomous agent findings visible with confidence + rationale
- [ ] **Signal → finding traceability** — signal detail links to derived findings and risks
- [ ] **Risk trend sparklines** — mini charts showing score trajectory on risk cards or list
- [ ] **Export/download working** — at minimum CSV export for risk register
- [ ] **Alert notification center** — unread count badge, prioritized list, acknowledge flow works
- [ ] **KRI dashboard widget** — top KRIs shown with threshold status (green/amber/red)
- [ ] **Vendor pipeline view** — vendors visualized by lifecycle stage

### Nice to Have (P3 — Post Demo)

- [ ] **Cross-framework control mapping** — one control → multiple frameworks
- [ ] **Risk clustering / similar risks panel** — pgvector semantic similarity surfaced in UI
- [ ] **MCP endpoint documentation / demo** — settings page explaining integration capability
- [ ] **Board-ready PDF report** — generated summary document
- [ ] **Risk appetite configuration UI** — settings page for defining thresholds
- [ ] **Tenant LLM configuration UI** — per-tenant AI provider settings visible and editable

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Seed data for demo | HIGH | LOW | P1 |
| Dashboard visual polish | HIGH | MEDIUM | P1 |
| Risk heatmap drill-down | HIGH | LOW | P1 |
| Empty / loading / error states | HIGH | LOW | P1 |
| Role-based UI enforcement | HIGH | LOW | P1 |
| Vendor scorecard summary | HIGH | LOW | P1 |
| Compliance posture % | HIGH | LOW | P1 |
| AI enrichment visible on risk | HIGH | MEDIUM | P2 |
| Foresight / agent work visible | HIGH | MEDIUM | P2 |
| Signal → finding traceability | MEDIUM | MEDIUM | P2 |
| Risk trend sparklines | MEDIUM | MEDIUM | P2 |
| Export CSV | MEDIUM | LOW | P2 |
| KRI dashboard widget | MEDIUM | MEDIUM | P2 |
| Vendor pipeline/kanban view | MEDIUM | MEDIUM | P2 |
| Cross-framework control mapping | HIGH | HIGH | P3 |
| Risk clustering (pgvector) | MEDIUM | HIGH | P3 |
| MCP endpoint surfaced in UI | LOW | LOW | P3 |
| Board PDF report | MEDIUM | HIGH | P3 |
| Risk appetite config UI | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for demo — deployment blocker if missing
- P2: Should have — makes demo impressive, not just functional
- P3: Nice to have — differentiating, but can defer without harming demo

---

## Competitor Feature Analysis

| Feature | Riskonnect | LogicManager | MetricStream | RiskMind Approach |
|---------|------------|--------------|--------------|-------------------|
| Risk register | Yes | Yes | Yes | Existing — needs polish |
| TPRM / vendor mgmt | Yes | Yes (via ripple) | Yes | Existing 7-state lifecycle — strong differentiator |
| Compliance frameworks | Yes | Yes | Yes | Existing — needs posture % display |
| AI/ML features | Basic analytics | LMX AI assistant | Limited | Autonomous agent is a genuine differentiator |
| Real-time monitoring | Yes | Continuous | Yes | Signal pipeline exists — needs traceability UI |
| Executive dashboards | Yes | Yes (RMM) | Yes | Needs polish and summary panel |
| Multi-tenant RBAC | Yes | Yes | Yes | Existing — needs UI enforcement verification |
| API / integrations | REST API | Connectors | REST API | MCP endpoint is a unique positioning story |

---

## Sources

- [Riskonnect: 10 Best ERM Software Platforms](https://riskonnect.com/the-10-best-enterprise-risk-management-erm-software-platforms/) — MEDIUM confidence (current article)
- [MetricStream: Top 5 ERM Tools](https://www.metricstream.com/blog/top-5-erm-tools.html) — MEDIUM confidence
- [Tracker Networks: ERM Buyers Guide 2026](https://www.trackernetworks.com/blog/best-enterprise-risk-management-tools-2026-buyers-guide) — MEDIUM confidence
- [LogicManager Platform](https://www.logicmanager.com/platform/) — HIGH confidence (vendor documentation)
- [Continuity2: ERM Software Guide](https://continuity2.com/blog/erm-software) — MEDIUM confidence
- [CyberSierra: AI-Powered GRC Platforms 2025](https://cybersierra.co/blog/ai-grc-platforms-2025/) — MEDIUM confidence
- [DigitalXForce: Modern TPRM 2025](https://digitalxforce.com/blogs/modern-tprm-2025-ai-powered-vendor-risk-management/) — MEDIUM confidence
- [Pathlock: Top GRC Tools 2025](https://pathlock.com/blog/grc/list-of-top-grc-tools-and-softwares/) — MEDIUM confidence
- RiskMind codebase analysis (existing pages, routes, components) — HIGH confidence

---
*Feature research for: Enterprise Risk Management Platform (RiskMind)*
*Researched: 2026-03-17*
