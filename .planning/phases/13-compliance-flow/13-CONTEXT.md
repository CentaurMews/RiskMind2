# Phase 13: Compliance Flow - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the compliance lifecycle: framework import (CSV/JSON + custom creation), threshold-driven findings pipeline with risk suggestions, assessment-to-control effectiveness linkage, AI-powered control auto-mapping, compliance reporting (PDF/CSV), evidence file upload with expiry tracking, and UI refinements (inline threshold config, import dialog). Builds on existing 12 endpoints, 3 frontend pages, and seeded data from prior phases.

</domain>

<decisions>
## Implementation Decisions

### Compliance Threshold → Findings Pipeline
- **D-01:** When compliance score drops below a framework's threshold, auto-create a finding linked to the framework, an alert visible in the alert bell, AND a risk suggestion for the risk register. Full pipeline.
- **D-02:** Recalculation triggers: on framework-linked assessment completion AND on control test creation/update. These are the two events that change compliance posture.
- **D-03:** Idempotent — one active finding per framework per threshold breach. If a finding already exists for this framework's compliance gap, update it. Auto-resolve when score recovers above threshold.

### Framework Import
- **D-04:** Support CSV and JSON import formats. CSV columns: code, title, description, parentCode. JSON supports nested hierarchy natively. Both show diff preview before applying.
- **D-05:** Import is additive-only (existing controls and mappings preserved, not deleted) — matches ROADMAP success criteria.
- **D-06:** Import UI lives on the framework list page as an "Import Framework" button. Opens a sheet/dialog with file upload, format selection, and diff preview.

### Custom Framework Creation
- **D-07:** "Create Framework" button alongside Import on framework list page. Manual entry of name, version, type, description, then add requirements one by one or paste in bulk.

### Compliance UI Refinements
- **D-08:** Compliance threshold configuration as inline editable field on each framework's detail page — next to the compliance score ring. Admin/risk_manager can click to edit.
- **D-09:** Control auto-mapping uses AI-powered pgvector embedding similarity between control descriptions and requirement descriptions. Shows suggested mappings for user approval before applying.

### Assessment-to-Compliance Linkage
- **D-10:** When a framework assessment completes, each section score updates the mapped control's effectiveness. Low section scores trigger control test creation with 'fail' result, which feeds back into compliance scoring.

### Compliance Reporting
- **D-11:** PDF export for executive summary (score rings, gap highlights, audit trail). CSV export for raw data (all requirements with compliance status, mapped controls, test results).
- **D-12:** Export buttons on framework detail page.

### Evidence Management
- **D-13:** Keep existing evidenceUrl field, add file upload capability (local storage). Evidence expiry date field on control_tests with alerts when evidence goes stale.

### Claude's Discretion
- Diff preview UI layout and interaction pattern
- PDF report template design
- Evidence storage location (local vs S3 — local fine for single server)
- Exact embedding similarity threshold for auto-mapping suggestions
- Risk suggestion format and default severity for compliance breach risks

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Compliance Backend
- `artifacts/api-server/src/routes/compliance.ts` — All 12 existing endpoints (frameworks, controls, tests, gap analysis, compliance score)
- `artifacts/api-server/src/lib/monitoring.ts` — Monitoring scheduler with checkComplianceDrift (line 137-171)

### Compliance Frontend
- `artifacts/riskmind-app/src/pages/compliance/framework-list.tsx` — Framework list with ScoreRing, stats
- `artifacts/riskmind-app/src/pages/compliance/framework-detail.tsx` — Detail page with requirements tree, test results tab, gap analysis tab
- `artifacts/riskmind-app/src/pages/compliance/control-list.tsx` — Control library with auto-map button

### Schema
- `lib/db/src/schema/frameworks.ts` — complianceThreshold, importSource, importReference columns
- `lib/db/src/schema/framework-requirements.ts` — Hierarchical requirements with embedding column
- `lib/db/src/schema/controls.ts` — Control status enum (active/inactive/planned)
- `lib/db/src/schema/control-tests.ts` — Test results with evidence fields
- `lib/db/src/schema/control-requirement-maps.ts` — Control-to-requirement mapping

### Assessment Engine (linkage)
- `artifacts/api-server/src/routes/assessments.ts` — Assessment with contextType="framework" support
- `lib/db/src/schema/assessments.ts` — Assessment schema with contextType enum

### Seed Data
- `artifacts/api-server/src/lib/seed.ts` — Phase 19 seed: 3 frameworks, 308 requirements, 17 controls, 23 maps, 7 tests, compliance thresholds

### Framework Data
- `scripts/src/framework-data/iso27001.ts` — ISO 27001 requirements
- `scripts/src/framework-data/soc2.ts` — SOC 2 requirements
- `scripts/src/framework-data/nist-csf.ts` — NIST CSF requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGetComplianceScore(frameworkId)` — Orval hook for compliance score (60% coverage + 40% effectiveness)
- `useGetGapAnalysis(frameworkId)` — Orval hook for requirement-level gap status
- `useAiGapRemediation()` — Orval hook for AI remediation suggestions
- `ScoreRing` component in framework-list.tsx — compliance score visualization
- `InterviewDialog` — AI assessment dialog reusable for compliance assessments
- `createAlert()` in monitoring.ts — alert creation with dedup check

### Established Patterns
- Compliance score formula: (coverage × 0.6) + (effectiveness × 0.4)
- Framework requirements use parentId hierarchy with code-based sorting
- Control-to-requirement mapping is many-to-many via control_requirement_maps
- [PREBUILT] prefix convention for system-provided templates
- `seedPrebuiltTemplates()` pattern for idempotent template seeding
- Assessment contextType enum: "vendor" | "framework" | "control"

### Integration Points
- Compliance score recalculation hooks into: assessment submit route, control test create route
- Findings creation via existing findings table (signalId nullable, riskId nullable)
- Alert creation via existing alerts table
- Risk suggestion via existing risks table (status="draft")
- Evidence upload needs multer middleware (already used? check)
- pgvector embeddings for auto-mapping — embedding column exists on framework_requirements

</code_context>

<specifics>
## Specific Ideas

- Assessment section scores should flow back to control effectiveness — section maps to controls via requirement linkage
- Auto-resolve compliance findings when score recovers (not just create on breach)
- Import diff preview should show: new requirements, modified requirements, unchanged requirements
- PDF report should match the Apple-like minimalist design language (Linear/Vercel aesthetic)

</specifics>

<deferred>
## Deferred Ideas

- Guest contributor access for assessments — deferred to v2.1 (requires auth changes: token-based link access)
- Multi-framework crosswalk engine (#57) — future milestone
- Evidence decay and renewal tracking (#63) — future milestone (basic expiry covered in Phase 13)
- Automated evidence collection (#60) — future milestone

</deferred>

---

*Phase: 13-compliance-flow*
*Context gathered: 2026-03-25*
