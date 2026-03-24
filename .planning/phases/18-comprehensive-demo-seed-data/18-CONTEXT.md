# Phase 18: Comprehensive Demo Seed Data - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate the database with comprehensive, realistic demo data across ALL platform features so every page has meaningful content for demos. All data inserted via seed functions (database-level, not hardcoded frontend). Add-if-empty idempotent strategy — only seed when the relevant table has no data for the tenant.

</domain>

<decisions>
## Implementation Decisions

### Seed Strategy
- **D-01:** Add-if-empty per table per tenant. Check `count(*) === 0` before seeding each category. Safe, idempotent, won't destroy user data.
- **D-02:** Extend existing `seedDemoDataIfEmpty()` in `seed.ts` with new seed functions. Each data category has its own function for modularity.
- **D-03:** All data references existing seeded entities (risks, vendors, frameworks, users) via FK. Seed order matters.

### Assessment Templates + Completed Assessments
- **D-04:** Seed the 3 pre-built templates (Vendor Security, Compliance Control, Incident Assessment) using the `seedPrebuiltTemplates()` function from Phase 10.
- **D-05:** Seed 3 completed vendor assessments (one per critical/high vendor) with realistic responses and computed scores. Updates vendor `riskScore` field.
- **D-06:** Seed 1 completed compliance assessment linked to a framework.

### Expanded Risks + Treatments + KRIs + Incidents
- **D-07:** Expand from 10 to 25-30 risks across all 6 categories (technology, operational, compliance, financial, strategic, reputational). Mix of statuses (open, mitigated, draft, accepted, closed).
- **D-08:** Add 8-10 treatments linked to risks (mitigate, transfer, accept, avoid types).
- **D-09:** Add 6-8 KRIs with thresholds and current values. Some breaching threshold for dashboard alerts.
- **D-10:** Add 3-4 incidents linked to risks with timeline data.
- **D-11:** Add review cycles for 5 risks (some overdue).

### Vendor Ecosystem
- **D-12:** Add 3-5 more vendors across different lifecycle stages (identification, due_diligence, risk_assessment, contracting, onboarding, offboarding).
- **D-13:** Add subprocessor relationships: CloudScale → 2 subprocessors, PayFlow → 1 subprocessor.
- **D-14:** Add org dependencies: email=Microsoft 365, cloud=AWS, CDN=Cloudflare, identity=Okta — linked to vendors where possible.
- **D-15:** Add monitoring configs: critical=7 days, high=30 days, medium=90 days, low=180 days.
- **D-16:** Add risk appetite configs per category with realistic thresholds.

### Signals + Findings Chain
- **D-17:** Expand from 3 to 15-20 signals across all 5 source types (NVD CVEs, Shodan ports, Sentinel incidents, MISP events, email reports). Each with realistic metadata JSONB.
- **D-18:** Add 5-6 findings linked to signals, some linked to risks (completing the signal→finding→risk chain).
- **D-19:** Add content_hash and external_id on seeded signals for dedup integrity.

### Risk Snapshots (for Dashboard Trends)
- **D-20:** Seed 90 days of historical risk snapshots (one per day) with realistic composite score progression. Enables the KRI trend chart to show data immediately.

### Claude's Discretion
- Exact risk titles, descriptions, and score values
- Realistic but fictional company names for vendors
- KRI names and threshold values
- Signal content text (realistic CVE descriptions, Shodan port findings, etc.)
- Snapshot score progression curve (gradual improvement trend with a spike)

</decisions>

<canonical_refs>
## Canonical References

### Existing Seed
- `artifacts/api-server/src/lib/seed.ts` — Current seed (extend, not replace)

### Schema (data targets)
- `lib/db/src/schema/` — All schema files define the tables to populate

### Pre-built Templates
- `lib/db/src/seed/prebuilt-templates.ts` — Assessment template seed from Phase 10

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Seed Coverage
- tenants, users (6 roles), risks (10), vendors (5), signals (3), alerts (2), frameworks (3 with requirements)

### Missing Seed Coverage
- assessment_templates, assessments (with responses + scores)
- treatments, treatment_events
- kris (with thresholds)
- incidents
- review_cycles
- vendor_subprocessors
- org_dependencies
- monitoring_configs
- risk_appetite_configs
- risk_snapshots (historical)
- findings (linked to signals and risks)
- controls, control_tests
- signals with metadata JSONB, content_hash, external_id

</code_context>

<specifics>
## Specific Ideas

- Data should tell a story: "Acme Corp is a mid-size financial services company with active risk management"
- Some risks should be clearly above appetite to demonstrate the dashboard alerting
- The KRI trend should show a realistic pattern: gradual improvement with one incident spike 45 days ago
- Vendor subprocessor chains should demonstrate the concentration risk feature

</specifics>

<deferred>
## Deferred Ideas

None — all seed categories included in scope

</deferred>

---

*Phase: 18-comprehensive-demo-seed-data*
*Context gathered: 2026-03-24*
