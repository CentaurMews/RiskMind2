# Phase 11: Vendor Lifecycle Redesign - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the vendor onboarding flow with a 4-step wizard (replacing the old "New Vendor" form), add 4th-party subprocessor tracking, org-level dependency interview for concentration risk, continuous monitoring cadence configuration, and assessment-driven vendor risk scores on kanban cards and scorecard.

</domain>

<decisions>
## Implementation Decisions

### Onboarding Wizard
- **D-01:** The wizard replaces the existing "New Vendor" creation flow entirely. Clicking "New Vendor" anywhere opens the wizard. The old simple form is removed.
- **D-02:** Wizard creates the vendor record with `status='identification'` at step 1 completion. Each subsequent step PATCHes the vendor record. Returning to `/vendors/onboard/:id` resumes from the saved step. Works across sessions/devices.
- **D-03:** 4 steps: (1) Identity + tier selection, (2) Questionnaire assignment (select from Assessment Engine templates), (3) Document upload, (4) AI enrichment review (auto-triggered, shows editable draft of enrichment results).

### 4th-Party Subprocessors
- **D-04:** Collapsible "Subprocessors" section on vendor detail page with a table: name, relationship type, criticality, discovered_by badge (manual/LLM). "Add Subprocessor" button links to existing vendors or creates new.
- **D-05:** Tier-1 depth only — track direct subprocessors of each vendor. No recursive sub-sub-processors. Covers GDPR/NYDFS regulatory requirements.
- **D-06:** LLM extraction from uploaded vendor documents surfaces suggested subprocessors during wizard step 3 (document upload). User reviews and confirms before saving.

### Org Dependency Interview
- **D-07:** Lives in Settings > Organization as an "Infrastructure Dependencies" section. One-time setup per org. Shows current dependencies with edit/add capability. Concentration risk summary card at the top.
- **D-08:** Structured form approach (not AI-driven interview). Category-based: select email provider, cloud provider, CDN, identity provider, payment processor, communication tools, etc. from dropdowns. Link to existing vendors when possible via vendor_id FK.
- **D-09:** Concentration risk flagged when multiple org-critical dependencies point to the same vendor (or vendor group), especially when that vendor has active signals (OSINT, assessment failures, breach reports).

### Monitoring & Score Display
- **D-10:** Global monitoring cadence config in Settings > Monitoring. Table format: tier → cadence days → assessment template. Applies to all vendors of that tier. Admin-only access.
- **D-11:** Small colored score badge on each vendor kanban card showing latest assessment score (e.g., "78/100" in severity color). Click navigates to assessment results. Vendor scorecard shows full score breakdown.
- **D-12:** Vendor `risk_score` field updated from latest completed assessment's overall score. Kanban card and scorecard read from this field.

### Claude's Discretion
- Document upload component implementation (dropzone vs file input)
- AI enrichment review layout details
- Exact monitoring scheduler implementation (node-cron job vs job queue recurring task)
- Concentration risk calculation algorithm details
- Subprocessor LLM extraction prompt design
- How "Add Subprocessor" links to existing vendors vs creates new

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema (Phase 9 output)
- `lib/db/src/schema/vendor-subprocessors.ts` — Dual FK join table for 4th-party relationships
- `lib/db/src/schema/org-dependencies.ts` — Org dependency categories and vendor FK
- `lib/db/src/schema/monitoring-configs.ts` — Per-tier cadence with assessment template FK
- `lib/db/src/schema/vendors.ts` — `next_assessment_due` date column, `risk_score` numeric

### Existing Vendor Code (must integrate with)
- `artifacts/api-server/src/routes/vendors.ts` — Current vendor CRUD, lifecycle transitions, AI questions
- `artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` — Kanban pipeline display
- `artifacts/riskmind-app/src/pages/vendors/vendor-detail.tsx` — Vendor scorecard
- `artifacts/api-server/src/lib/allowed-transitions.ts` — Lifecycle state machine

### Assessment Engine (Phase 10 output — consumed by wizard)
- `artifacts/api-server/src/routes/assessment-templates.ts` — Template listing for wizard step 2
- `artifacts/api-server/src/routes/assessments.ts` — Assessment creation for vendor context
- `artifacts/api-server/src/lib/assessment-engine.ts` — Scoring function for vendor risk score

### AI Enrichment (existing pattern)
- `artifacts/api-server/src/routes/ai-enrichment.ts` — Enrichment pattern for wizard step 4

### Research
- `.planning/research/FEATURES.md` — Vendor lifecycle feature landscape
- `.planning/research/PITFALLS.md` — Vendor wizard state, 4th-party N+1 queries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ai-enrichment.ts` route: enrichment pipeline pattern — reuse for wizard step 4 auto-trigger
- `allowed-transitions.ts`: vendor lifecycle state machine — wizard step 1 creates vendor in `identification` state
- `vendor-detail.tsx`: existing scorecard layout — extend with subprocessors section and assessment score
- Assessment Engine (Phase 10): template listing, assessment creation — consumed by wizard step 2

### Established Patterns
- Vendor routes use `verifyVendorOwnership()` guard for tenant isolation
- Kanban pipeline reads from vendor list with status grouping
- Settings page has sections for LLM Config, Routing — extend with Monitoring and Org Dependencies sections

### Integration Points
- `vendors.ts` routes: add wizard endpoints (create draft, update step, complete onboarding)
- `vendor-list.tsx`: add score badge to kanban cards
- `vendor-detail.tsx`: add subprocessors section, update scorecard with assessment score
- `settings.tsx`: add Monitoring and Org Dependencies sections
- Sidebar navigation: existing "Vendors" section — wizard accessible from kanban "New Vendor" button

</code_context>

<specifics>
## Specific Ideas

- Wizard should feel like the LLM Config Wizard (Phase 6) — clean multi-step flow with progress indicator
- AI enrichment in wizard step 4 should auto-trigger without manual click — results appear as editable cards
- Concentration risk should be visually prominent in the Settings org dependencies section — a warning card when risks are detected
- Score badge on kanban cards should use the same severity color scale as the Assessment Engine results

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-vendor-lifecycle-redesign*
*Context gathered: 2026-03-23*
