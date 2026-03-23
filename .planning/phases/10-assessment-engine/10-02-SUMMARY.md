---
phase: 10-assessment-engine
plan: "02"
subsystem: assessment-engine
tags: [assessment, rest-api, sse, job-queue, seed-data, openapi]
dependency_graph:
  requires: ["10-01"]
  provides: ["assessment-api", "assessment-templates-api", "prebuilt-templates", "ai-follow-up-sse", "ai-summary-worker"]
  affects: ["vendor-lifecycle", "compliance-flow"]
tech_stack:
  added: []
  patterns: ["SSE streaming (follow-up questions)", "[PREBUILT] prefix convention", "idempotent seed with guard check"]
key_files:
  created:
    - artifacts/api-server/src/routes/assessment-templates.ts
    - artifacts/api-server/src/routes/assessments.ts
    - lib/db/src/seed/prebuilt-templates.ts
  modified:
    - artifacts/api-server/src/lib/llm-service.ts
    - artifacts/api-server/src/routes/index.ts
    - lib/api-spec/openapi.yaml
decisions:
  - "LLMTaskType extended with 'assessment' for per-task model routing on AI follow-up and summary generation"
  - "registerWorker('ai-assess') placed in assessments.ts at module load to colocate worker with its routes"
  - "[PREBUILT] prefix stripped from description in public responses; isPrebuilt flag added"
  - "seedPrebuiltTemplates() defines question types inline to avoid cross-package import from api-server"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-03-23"
  tasks_completed: 3
  files_created: 3
  files_modified: 3
---

# Phase 10 Plan 02: Assessment Engine API Routes Summary

Complete REST API for the assessment engine: template CRUD, full assessment lifecycle with scoring, AI follow-up via SSE, AI summary via job queue, and 3 pre-built templates with 67 questions seeded per-tenant.

## What Was Built

### Task 1: Assessment Template CRUD Routes + LLMTaskType Extension
**Commits:** 89afc77

Created `assessment-templates.ts` with full template management:

- `GET /v1/assessment-templates` — list with optional `contextType` filter, strips `[PREBUILT]` prefix, adds `isPrebuilt` flag
- `GET /v1/assessment-templates/:id` — single template, tenant-scoped
- `POST /v1/assessment-templates` — create with questions.sections validation
- `PATCH /v1/assessment-templates/:id` — update with pre-built guard (400 if `[PREBUILT]` prefix), auto-increments version
- `DELETE /v1/assessment-templates/:id` — delete with pre-built guard
- `POST /v1/assessment-templates/:id/clone` — creates editable copy, removes `[PREBUILT]` prefix

Extended `LLMTaskType` in `llm-service.ts` with `"assessment"` for per-task model routing. Updated `suggestRouting()` to include assessment in its return shape.

### Task 2: Assessment Lifecycle Routes with AI Endpoints
**Commits:** 7b0ec84

Created `assessments.ts` with complete lifecycle:

- `GET /v1/assessments` — list with status/contextType filters, joins template title
- `GET /v1/assessments/:id` — full assessment with template data join
- `POST /v1/assessments` — create from template; validates contextId against `vendorsTable` or `frameworksTable`
- `PATCH /v1/assessments/:id/responses` — save session progress; guards against completed/abandoned
- `POST /v1/assessments/:id/submit` — compute score via `computeScore()`, set status=completed, enqueue AI summary job
- `POST /v1/assessments/:id/follow-up` — SSE endpoint streaming AI-generated follow-up question
- `POST /v1/assessments/:id/abandon` — set status=abandoned, guard against completed
- `GET /v1/assessments/:id/results` — full score breakdown for completed assessments

AI summary worker registered via `registerWorker("ai-assess")` at module level — handles async `summarize_assessment` jobs with formatted Q&A prompt.

Wired both routers into `routes/index.ts`.

### Task 3: Pre-built Template Seeds + OpenAPI Spec
**Commits:** b832ccf

Created `lib/db/src/seed/prebuilt-templates.ts` with `seedPrebuiltTemplates(tenantId)`:

**Vendor Security Assessment** (25 questions, 5 sections):
- Access Control: MFA, password policy, privileged access review, provisioning, terminated user revocation
- Data Protection & Encryption: encryption at rest, algorithm, classification, PII, key management
- Incident Response: IR plan, testing, MTTD, breach notification, post-incident review
- Business Continuity: BCP, RPO, RTO, DR testing, geographic redundancy
- Data Privacy: published policy, GDPR compliance, retention policy, DSAR process, sub-processor disclosure

**Compliance Control Assessment** (22 questions, 4 sections):
- Control Design: objective, owner, frequency, type, automation level, design effectiveness rating
- Implementation: implemented as designed, dates, operating effectiveness, compensating controls (conditional)
- Evidence & Documentation: evidence availability, freshness, documentation completeness, audit trail
- Gaps & Remediation: gaps identified, severity, remediation plan, timeline, risk acceptance (all conditional)

**Incident Assessment** (20 questions, 4 sections):
- Incident Timeline: detection date, response time, containment time, resolution time, category
- Impact Analysis: data compromised, records affected, financial impact, regulatory/customer notification
- Response Effectiveness: IR plan followed, escalation, communication/containment effectiveness, external support
- Lessons Learned: root cause, description (conditional), preventive measures, process changes, recurrence likelihood

All templates: idempotent (title+tenant uniqueness check), `[PREBUILT]` description prefix, branching conditions, graduated `numericValue` scoring on multiple_choice options.

Updated `lib/api-spec/openapi.yaml` with 10 new paths and 8 new schemas (AssessmentTemplate, Assessment, AssessmentSummary, CreateAssessmentRequest, AssessmentResponsesUpdate, AssessmentSubmitResult, AssessmentResults, CreateAssessmentTemplateRequest).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one minor deviation:

**1. [Rule 1 - Type Fix] Rebuilt stale db library declarations**
- **Found during:** Task 1
- **Issue:** `lib/db/dist/schema/` was missing Phase 9 schema declarations — assessments, foresight, monitoring-configs etc. TypeScript reported `assessmentTemplatesTable` not exported from `@workspace/db`.
- **Fix:** Ran `npx tsc -p lib/db/tsconfig.json` to regenerate declarations. The dist/ directory is in `.gitignore` so this only affects local compilation.
- **Files modified:** lib/db/dist/ (gitignored, not committed)

**2. [Rule 2 - Design Decision] Local type alias in seed file**
- **Found during:** Task 3
- **Issue:** Importing `AssessmentTemplateQuestions` from `../../../../artifacts/api-server/src/lib/assessment-engine` would create a cross-package dependency in the db library.
- **Fix:** Defined local inline interfaces matching the canonical types. Added comment noting they must stay in sync.
- **Files modified:** lib/db/src/seed/prebuilt-templates.ts

## Self-Check: PASSED

All files exist and all commits verified:
- `artifacts/api-server/src/routes/assessment-templates.ts` — FOUND
- `artifacts/api-server/src/routes/assessments.ts` — FOUND
- `lib/db/src/seed/prebuilt-templates.ts` — FOUND
- Commit 89afc77 — FOUND
- Commit 7b0ec84 — FOUND
- Commit b832ccf — FOUND
