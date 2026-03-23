# Requirements: RiskMind v1.2

**Defined:** 2026-03-19
**Core Value:** Quick UX fixes and polish before major v2.0 platform features

## v1.2 Requirements

### Login

- [ ] **LOGIN-01**: Login form detects tenant from email domain — no tenant slug field (GH #70)
- [ ] **LOGIN-02**: Social login placeholders (Microsoft, Google) with "Coming soon" toast on click (GH #71)

### Dashboard

- [ ] **DASH-06**: Dashboard KPI cards (Active Risks, Open Alerts, Active Vendors, Compliance Score) are clickable, navigating to respective list pages (GH #72)

### Mobile

- [ ] **MOB-01**: Heatmap renders readable on mobile screens (simplified layout or scroll) (GH #73)
- [ ] **MOB-02**: Tables show horizontal scroll indicator/shadow affordance on mobile (GH #73)
- [ ] **MOB-03**: Touch targets meet 44px minimum, all pages usable at 375px width (GH #73)

### Cleanup

- [ ] **CLEAN-01**: Remove Replit tenant UUID code from header bar — show tenant name instead (GH #74)

## Future Requirements (v2.0)

### Assessment Engine
- **ASSESS-01**: AI-driven non-deterministic questionnaire system with elicitation techniques (GH #75)
- **ASSESS-02**: Assessment planning workflow (objective, success criteria, question design, metrics) (GH #75)
- **ASSESS-03**: Dedicated Assessment AI Agent (GH #75)
- **ASSESS-04**: Shared engine for vendor assessment AND compliance assessment (GH #75)
- **ASSESS-05**: Guest contributor portal for external assessment respondents (GH #75)

### Vendor Lifecycle
- **VEND-03**: Vendor wizard onboarding with smart data enrichment from internet/trust centers (GH #76)
- **VEND-04**: Tiered monitoring programs (assessment cadence, types per risk tier) (GH #76)
- **VEND-05**: Vendor dependency mapping (4th party risk — sub-vendor chains) (GH #76)
- **VEND-06**: Vendor offboarding workflow (GH #76)

### Signal Integrations
- **SIG-01**: Signal source configuration and management in Settings (GH #77)
- **SIG-02**: Email signal ingestion (GH #77)
- **SIG-03**: Microsoft Sentinel SIEM integration (GH #77)
- **SIG-04**: Shodan, CVE, Group-IB, MISP threat intel integrations (GH #77)
- **SIG-05**: Finding-to-Risk pipeline with multi-select and LLM pre-population (GH #78)

### Compliance
- **COMP-02**: Framework import from international standards + custom frameworks/controls (GH #79)
- **COMP-03**: Compliance assessment workflow via shared Assessment Engine (GH #79)
- **COMP-04**: Compliance thresholds (low/normal/strict) with smart defaults and advisory text (GH #79)
- **COMP-05**: Low compliance findings auto-feed into signals pipeline (GH #79)

### Foresight v2
- **FORE-02**: Monte Carlo simulation (GH #80)
- **FORE-03**: OSINT risk horizon forecasting (GH #80)
- **FORE-04**: Agent intelligence feed with approve/dismiss (GH #80)
- **FORE-05**: What-if scenario builder (GH #80)

## Future Requirements (v2.1)

### i18n
- **I18N-01**: Multi-language support — English, Spanish, Arabic (GH #81)
- **I18N-02**: RTL layout support for Arabic (GH #81)

### Auth
- **AUTH-01**: Microsoft OAuth social login (GH #82)
- **AUTH-02**: Google OAuth social login (GH #82)
- **AUTH-03**: User self-registration workflow (GH #82)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOGIN-01 | Phase 8 | Pending |
| LOGIN-02 | Phase 8 | Pending |
| DASH-06 | Phase 8 | Pending |
| MOB-01 | Phase 8 | Pending |
| MOB-02 | Phase 8 | Pending |
| MOB-03 | Phase 8 | Pending |
| CLEAN-01 | Phase 8 | Pending |

**Coverage:**
- v1.2 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
