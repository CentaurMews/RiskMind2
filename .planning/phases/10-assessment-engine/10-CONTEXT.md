# Phase 10: Assessment Engine - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the shared Assessment Engine: template CRUD with form-based editor, assessment session flow with section-by-section wizard navigation, AI-generated follow-up questions inline, weighted scoring with section rollup, AI post-submission analysis, pre-built templates, and template library page. This engine serves both vendor and compliance flows (Phases 11 and 13).

</domain>

<decisions>
## Implementation Decisions

### Template Builder UX
- **D-01:** Form-based editor for creating/editing templates. Users add questions via form fields: pick type (text/boolean/multiple-choice/numeric), enter question text, set weight, add branching conditions. Drag to reorder. Preview pane shows how the assessment will look to the respondent.
- **D-02:** Templates support named sections (e.g., "Security Controls", "Data Privacy"). Questions are grouped into sections. Section-level scores roll up to overall score. Matches how SIG Lite and ISO questionnaires are structured.
- **D-03:** Branching conditions defined per question via a condition builder UI (not raw JSON). IF answer to Q equals/contains/greater-than value THEN show/hide target question(s). Evaluated client-side for instant UX.

### Assessment Session Flow
- **D-04:** Section-by-section wizard navigation. One section at a time with progress bar showing current section and completion %. Next/Previous buttons. Branching hides/shows questions within the current section.
- **D-05:** AI-generated follow-up questions appear inline below the triggering question with an "AI Generated" badge. Appears after the user answers a question that warrants deeper exploration. Doesn't break the flow — feels natural.
- **D-06:** Session persistence: assessment state saved to DB on each section navigation (responses JSONB updated). Refreshing the page resumes from the current section with all prior responses intact. AI follow-up questions also persisted so they reappear on refresh.

### Scoring & Results Display
- **D-07:** Overall score shown as a prominent gauge/donut chart. Section scores as horizontal bar charts below. Per-question scores viewable by expanding a section. Clean score hierarchy from overall → section → question.
- **D-08:** AI summary appears above scores as a highlighted card with "AI Analysis" badge at the top of the results page. User sees narrative analysis first, then digs into numbers. Consistent with how risk detail shows AI enrichment.
- **D-09:** Score computation is deterministic: same responses always produce same score. Weighted average: each question's score × weight, rolled up to section average, then overall weighted average of sections.

### Pre-built Templates
- **D-10:** Three substantial pre-built templates with 20-30 questions each:
  - Vendor Security (SIG Lite-inspired): access control, encryption, incident response, business continuity, data privacy
  - Compliance Control Assessment (ISO 27001-inspired): control effectiveness, evidence quality, gap identification, remediation status
  - Incident Assessment: timeline, impact analysis, response effectiveness, lessons learned
- **D-11:** Dedicated template library page at /assessments/templates showing available templates as cards. Filter by type (vendor/compliance). "Use Template" creates a new assessment from it. "Clone & Edit" creates a custom copy for modification.

### Claude's Discretion
- Exact question wording for pre-built templates
- Which responses trigger AI follow-up questions (LLM decides based on context)
- Branching condition builder component implementation details
- Assessment list page layout and filtering
- API route structure (likely /api/v1/assessments and /api/v1/assessment-templates)
- Whether to use SSE streaming (like interviews) or async job queue for AI follow-ups
- Gauge/donut chart component choice (recharts already installed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema (Phase 9 output — source of truth)
- `lib/db/src/schema/assessments.ts` — assessment_templates + assessments tables, context_type enum, JSONB questions/responses, score column, ai_summary
- `lib/db/src/relations.ts` — Drizzle relations for assessments

### Existing Patterns (model implementations)
- `artifacts/api-server/src/routes/interviews.ts` — AI interview session pattern: SSE streaming, transcript JSONB, session lifecycle (active/committed/abandoned). Model for assessment AI follow-ups.
- `artifacts/api-server/src/lib/llm-service.ts` — LLM service with `complete()`, `streamComplete()`, `resolveConfig()`. Use for AI follow-ups and post-submission analysis.
- `artifacts/api-server/src/lib/job-queue.ts` — Job queue pattern for async AI tasks. Use for post-submission AI summary generation.
- `artifacts/api-server/src/routes/ai-enrichment.ts` — AI enrichment pattern with provenance. Model for AI summary provenance.

### Research
- `.planning/research/FEATURES.md` — Feature landscape: table stakes, differentiators, anti-features for assessment engine
- `.planning/research/ARCHITECTURE.md` — Integration architecture for assessment engine
- `.planning/research/PITFALLS.md` — Pitfalls specific to assessment engine (polymorphic context, non-determinism)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `interviews.ts` route: SSE streaming pattern for AI conversations — reuse for AI follow-up question generation
- `llm-service.ts`: `complete()` and `streamComplete()` — use for both AI follow-ups and post-submission analysis
- `job-queue.ts`: `enqueueJob()` / `registerWorker()` — use for async AI summary generation after submission
- shadcn/ui form components: existing form patterns across the app for template builder
- recharts (installed): use for score gauge/donut and section bar charts

### Established Patterns
- Route files in `artifacts/api-server/src/routes/` with Express Router, `requireRole()` middleware, `recordAudit()`
- RBAC: `requireRole("admin")` for mutations, `requireRole("viewer")` for reads
- Error handling: `badRequest()`, `notFound()`, `serverError()`, `sendError()`
- Frontend pages in `artifacts/web/src/pages/` with React components
- Orval-generated API clients in `lib/api-client-react/` — OpenAPI spec must be updated for new routes, then regenerate

### Integration Points
- `artifacts/api-server/src/routes/index.ts` — route registration (add assessment routes)
- `artifacts/web/src/App.tsx` or router config — add assessment pages/routes
- OpenAPI spec — add assessment endpoints, then run Orval codegen
- Navigation sidebar — add Assessments section

</code_context>

<specifics>
## Specific Ideas

- AI follow-ups should feel like the existing interview experience — conversational, not mechanical
- Template library page should match the Linear/Vercel aesthetic established across the app
- Score visualization should be clean and minimal — gauge + bars, not a complex dashboard
- Pre-built templates should be realistic enough to use in a real vendor assessment demo

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-assessment-engine*
*Context gathered: 2026-03-23*
