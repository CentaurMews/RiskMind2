# Phase 19: Demo-Ready Seed Data - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Seed realistic demo data into the database for all pages that currently show empty states — real-named vendors, a comprehensive DPIA assessment template, completed assessment instances with full responses, security controls mapped to framework requirements, and compliance thresholds. All data as actual DB records via seed functions, not UI-level hardcoded data. Extends the existing `seedDemoDataIfEmpty()` pattern from Phase 18.

</domain>

<decisions>
## Implementation Decisions

### Vendor Data
- **D-01:** Add 5 real vendors (Microsoft, AWS, Cloudflare, Salesforce, SAP Business One) alongside the existing 5 fictional vendors. Total ~10 vendors.
- **D-02:** Full vendor profiles — name, description, tier, category, lifecycle status, contact email, risk score, realistic service descriptions. Enough to fully populate vendor detail pages.
- **D-03:** Realistic tiers: Microsoft=critical (Azure/M365), AWS=critical (cloud infra), Cloudflare=high (CDN/security), Salesforce=high (CRM/data), SAP=medium (ERP).
- **D-04:** Spread across lifecycle stages: Microsoft=monitoring, AWS=monitoring, Cloudflare=contracting, Salesforce=due_diligence, SAP=risk_assessment. Shows variety in kanban pipeline.
- **D-05:** Risk scores only for monitored vendors (Microsoft, AWS). Others get null riskScore since they haven't been assessed yet.

### DPIA Assessment Template
- **D-06:** Add as 4th prebuilt template ("Vendor Security + Privacy (DPIA)") with contextType='vendor'. Keep existing 3 templates.
- **D-07:** All 7 sections (A-G), full ~80 questions. Complete adaptation of the provided questionnaire.
- **D-08:** Natural type mapping: Yes/No → boolean, Short/Long text → text, Multi-select → multiple_choice, Acknowledgement → boolean, URL/Email → text. Conditional branching (e.g., D2→D2a) uses conditions array.
- **D-09:** Replace [Client] placeholder with 'Acme Corp' (seeded tenant name) for realistic demo feel.
- **D-10:** Claude fills realistic options for all "(choices to define)" multi-select questions: B7 business units (IT, Finance, HR, Legal, Operations), B10 critical functions (Email, ERP, Cloud hosting, Identity, Payments), B12 regulations (GDPR, PDPL, PCI-DSS, HIPAA, SOX), etc.
- **D-11:** Mark as [PREBUILT] in description field to match Phase 10 convention for built-in templates.

### Completed Assessments
- **D-12:** 3-4 completed assessment instances: 2 vendor assessments (Microsoft + AWS using DPIA template) + 1-2 compliance assessments (using Compliance Control template against ISO 27001).
- **D-13:** Varied score distribution: Microsoft ~82% (good), AWS ~71% (moderate), compliance assessment ~65% (below threshold). Demonstrates different UI states.
- **D-14:** Full response data — each assessment has realistic answers for every question in the template. Assessment detail/results pages fully populated with per-section scores.

### Controls + Compliance Linkage
- **D-15:** 15-20 security controls covering key domains: access control, encryption, incident response, backup, change management, vulnerability management, network security, logging, etc.
- **D-16:** Status distribution: ~10 active, 3-4 planned, 1-2 inactive. Shows all states and demonstrates coverage gaps.
- **D-17:** Controls mapped to ISO 27001 requirements via control_requirement_maps table. Each control links to 1-3 requirement IDs.
- **D-18:** 5-8 control_tests records with test results (pass/fail/partial) and test dates. Shows testing history on control detail pages.
- **D-19:** Compliance thresholds per framework: ISO 27001=80%, SOC 2=75%, NIST CSF=70%. Enables COMPLIANT/AT-RISK/NON-COMPLIANT status display.

### Claude's Discretion
- Exact vendor descriptions and service details
- Realistic DPIA question weights per section
- Specific assessment response values (as long as they produce the target score ranges)
- Control names, descriptions, and which ISO 27001 requirements they map to
- Control test dates and result details
- Control owner assignments (from seeded users)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Seed Infrastructure
- `scripts/src/seed.ts` — Main seed script with `seed()` function and `seedRequirements()` helper
- `lib/db/src/seed/prebuilt-templates.ts` — Assessment template seed function (`seedPrebuiltTemplates()`)
- `lib/db/src/seed-questions.ts` — Questionnaire questions seed (58 questions)

### Schema (data targets)
- `lib/db/src/schema/vendors.ts` — Vendor table with tier enum, status enum, riskScore
- `lib/db/src/schema/assessments.ts` — assessment_templates (questions JSONB), assessments table
- `lib/db/src/schema/controls.ts` — Controls table with status enum
- `lib/db/src/schema/frameworks.ts` — Frameworks table with complianceThreshold
- `lib/db/src/schema/framework-requirements.ts` — Framework requirements with hierarchy

### Framework Data
- `scripts/src/framework-data/iso27001.ts` — ISO 27001 requirement definitions
- `scripts/src/framework-data/soc2.ts` — SOC 2 requirement definitions
- `scripts/src/framework-data/nist-csf.ts` — NIST CSF requirement definitions

### Phase 18 Context (seed patterns)
- `.planning/phases/18-comprehensive-demo-seed-data/18-CONTEXT.md` — Seed strategy decisions: add-if-empty, modular functions, FK ordering

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `seedDemoDataIfEmpty()` in `scripts/src/seed.ts` — Main entry point to extend with new seed functions
- `seedPrebuiltTemplates()` in `lib/db/src/seed/prebuilt-templates.ts` — Template seed pattern to follow for DPIA template
- `seedRequirements()` helper — Handles hierarchical framework requirement insertion
- Phase 18 seed functions (risks, vendors, signals, findings, snapshots) — Pattern for modular add-if-empty guards

### Established Patterns
- Add-if-empty per table: `count(*) === 0` guard before seeding
- Modular per-table seed functions called from `seedDemoDataIfEmpty()`
- FK ordering: seed dependencies first (templates before assessments, frameworks before controls)
- `[PREBUILT]` prefix convention in template descriptions for built-in badge UI

### Integration Points
- `seedDemoDataIfEmpty()` needs new function calls for: DPIA template, assessments, controls, control maps, control tests, compliance thresholds
- Vendor insert needs to use same tenant ID and avoid conflicts with Phase 18 vendors
- Assessment responses need template question IDs — template must be seeded first
- Control-requirement maps need framework requirement IDs from existing seed

</code_context>

<specifics>
## Specific Ideas

- User provided a complete 7-section DPIA questionnaire (Sections A-G) as the source template — adapt faithfully to the assessment_templates JSONB schema
- Real vendor names (Microsoft, AWS, Cloudflare, Salesforce, SAP Business One) — not fictional
- Framework data already exists in `scripts/src/framework-data/` — controls should reference real ISO 27001 requirement codes (e.g., A.5.1, A.8.1)
- Assessment scores should trigger different UI states: 82% (passing), 71% (moderate), 65% (below 80% ISO threshold = AT-RISK)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-demo-ready-seed-data*
*Context gathered: 2026-03-24*
