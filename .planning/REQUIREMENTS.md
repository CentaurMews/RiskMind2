# Requirements: RiskMind

**Defined:** 2026-03-17
**Core Value:** A working, demo-ready enterprise risk management platform accessible via Cloudflare tunnel, with AI features visibly surfaced

## v1 Requirements

Requirements for demo-ready release. Each maps to roadmap phases.

### Deployment

- [ ] **DEPL-01**: Strip all Replit-specific dependencies (@replit/connectors-sdk, @replit/vite-plugin-*)
- [ ] **DEPL-02**: Configure environment variables (JWT_SECRET, ENCRYPTION_KEY, DATABASE_URL, PORT) with startup validation
- [ ] **DEPL-03**: Install pnpm dependencies and build all workspace packages successfully
- [ ] **DEPL-04**: Express serves both REST API and built React SPA from single port (4000)
- [ ] **DEPL-05**: PM2 process management with ecosystem.config.cjs, auto-restart, boot persistence

### Database

- [ ] **DB-01**: Create fresh PostgreSQL database for RiskMind
- [ ] **DB-02**: Install pgvector extension as superuser before migrations
- [ ] **DB-03**: Run Drizzle migrations successfully
- [ ] **DB-04**: Run seed scripts to populate demo data (risks, vendors, frameworks, alerts, signals, users)

### Network & Security

- [ ] **NET-01**: Configure named Cloudflare tunnel pointing to localhost:4000
- [ ] **NET-02**: Install cloudflared tunnel as systemd service for persistence
- [ ] **NET-03**: Lock CORS to Cloudflare tunnel origin (remove open cors())
- [ ] **NET-04**: Configure http2Origin in cloudflared for SSE streaming (AI interviews)
- [ ] **NET-05**: App accessible via public Cloudflare tunnel URL with working login

### Dashboard

- [ ] **DASH-01**: Dashboard displays KPI cards with proper visual hierarchy (top risks, open treatments, overdue items)
- [ ] **DASH-02**: Risk heatmap renders correctly with interactive drill-down on click
- [ ] **DASH-03**: Executive summary panel showing risk posture at a glance
- [ ] **DASH-04**: KRI dashboard widget with threshold status indicators (green/amber/red)
- [ ] **DASH-05**: Alert notification center with unread count badge and prioritized list

### UI Polish

- [ ] **UI-01**: Consistent card design and spacing across all pages
- [ ] **UI-02**: Empty state messaging with placeholder illustrations and "Get started" CTAs on all list views
- [ ] **UI-03**: Loading states (skeleton screens/spinners) on all data-fetching pages
- [ ] **UI-04**: Error states with toast notifications instead of raw error text
- [ ] **UI-05**: Consistent navigation — sidebar active states, breadcrumbs on detail pages, page titles
- [ ] **UI-06**: Role-based UI enforcement — admin controls hidden for viewers, read-only for auditors
- [ ] **UI-07**: Pagination, search, and filter controls on all list views (risks, vendors, controls, signals)
- [ ] **UI-08**: Risk trend sparklines on risk cards showing 30-day score trajectory

### Vendor Management

- [ ] **VEND-01**: Vendor scorecard summary — risk score, tier, last assessment date, open findings at a glance
- [ ] **VEND-02**: Vendor lifecycle pipeline/kanban view — vendors visualized by lifecycle stage

### Compliance

- [ ] **COMP-01**: Compliance posture percentage per framework ("73% compliant with ISO 27001")

### AI Features

- [ ] **AI-01**: AI enrichment visible on risk detail — "AI-enriched" badge, enrichment summary, date
- [ ] **AI-02**: AI-generated treatment suggestions surfaced on risk detail page
- [ ] **AI-03**: Foresight page displays autonomous agent findings with confidence level and rationale
- [ ] **AI-04**: Signal-to-finding-to-risk traceability — visual chain showing how signals become risks

### Export

- [ ] **EXP-01**: CSV export for risk register data

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Analytics

- **ADV-01**: Cross-framework control mapping (one control satisfies ISO 27001, SOC 2, NIST simultaneously)
- **ADV-02**: Risk clustering via pgvector semantic similarity surfaced in UI ("Risks like this one")
- **ADV-03**: Board-ready PDF report generation

### Configuration

- **CONF-01**: Risk appetite / tolerance configuration UI with visual threshold display
- **CONF-02**: Configurable dashboard layouts per role

### Enterprise

- **ENT-01**: SSO/SAML/OIDC authentication
- **ENT-02**: Audit trail / activity log (who changed what and when)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native app | Responsive web covers mobile; not worth scope for demo |
| Real-time collaborative editing | WebSocket complexity, conflict resolution — overkill for ERM |
| Vendor self-service portal | Significant scope, low demo value |
| Multi-cloud deployment | Single server deployment only |
| Custom domain/SSL management | Cloudflare tunnel handles this |
| nginx reverse proxy | Express serves everything; adds unnecessary operational overhead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPL-01 | — | Pending |
| DEPL-02 | — | Pending |
| DEPL-03 | — | Pending |
| DEPL-04 | — | Pending |
| DEPL-05 | — | Pending |
| DB-01 | — | Pending |
| DB-02 | — | Pending |
| DB-03 | — | Pending |
| DB-04 | — | Pending |
| NET-01 | — | Pending |
| NET-02 | — | Pending |
| NET-03 | — | Pending |
| NET-04 | — | Pending |
| NET-05 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| DASH-05 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
| UI-04 | — | Pending |
| UI-05 | — | Pending |
| UI-06 | — | Pending |
| UI-07 | — | Pending |
| UI-08 | — | Pending |
| VEND-01 | — | Pending |
| VEND-02 | — | Pending |
| COMP-01 | — | Pending |
| AI-01 | — | Pending |
| AI-02 | — | Pending |
| AI-03 | — | Pending |
| AI-04 | — | Pending |
| EXP-01 | — | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 0
- Unmapped: 35 ⚠️

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after initial definition*
