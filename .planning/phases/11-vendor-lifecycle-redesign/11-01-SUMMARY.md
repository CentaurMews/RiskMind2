---
phase: 11-vendor-lifecycle-redesign
plan: "01"
subsystem: tprm-backend
tags: [vendors, wizard, onboarding, assessments, risk-score]
dependency_graph:
  requires: [phase-09-schema-foundation, phase-10-assessment-engine]
  provides: [vendor-wizard-api, assessment-risk-score-hook]
  affects: [vendors.ts, assessments.ts]
tech_stack:
  added: []
  patterns:
    - Wizard step inference from data completeness (no DB column needed)
    - Risk score inversion: riskScore = 100 - assessment.overall
    - Early-return guard for non-vendor assessment context
key_files:
  created: []
  modified:
    - artifacts/api-server/src/routes/vendors.ts
    - artifacts/api-server/src/routes/assessments.ts
decisions:
  - Wizard step inferred from data completeness (identification status + assessment + documents) — no wizardCompletedAt column added to schema
  - riskScore stored as String(100 - score.overall) to match existing numeric column convention
  - overrideTier respected — tier only auto-updated when no manual override is set
  - Duplicate enrichment job detection done in-memory (payload JSONB filter) for simplicity
metrics:
  duration: 162s
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase 11 Plan 01: Vendor Onboarding Wizard API + Risk Score Hook Summary

**One-liner:** Five wizard onboard endpoints in vendors.ts plus auto-updating vendor riskScore (100 - assessment.overall) on assessment completion.

## What Was Built

### Task 1: Wizard Onboard Endpoints (vendors.ts)

Five new endpoints placed above the existing `POST /v1/vendors` route:

| Endpoint | Purpose |
|---|---|
| `POST /v1/vendors/onboard` | Create vendor in `identification` status, return with `wizardStep: 1` |
| `GET /v1/vendors/onboard/:id` | Return vendor + `wizardStep` (inferred) + `hasAssessment` + `hasDocuments` |
| `PATCH /v1/vendors/onboard/:id` | Update vendor per step (1=profile, 2=template assign, 3=docs ack, 4=enrich/advance) |
| `POST /v1/vendors/onboard/:id/enrich` | Enqueue `ai-enrich/enrich_vendor` job, return 202 + jobId |
| `DELETE /v1/vendors/onboard/:id` | Cancel onboarding — guards on `identification` status and absence of children |

**Wizard step inference logic:**
- `status !== 'identification'` → step 4 (completed)
- `hasDocuments` → step 3
- `hasAssessment` → step 2
- Default → step 1

**Step 4 (PATCH)** automatically transitions vendor to `due_diligence` and records a status event.

**New imports:** `assessmentsTable`, `vendorSubprocessorsTable`, `jobsTable`, `enqueueJob`

### Task 2: Assessment Completion → Risk Score Hook (assessments.ts)

Added `updateVendorRiskScoreFromAssessment()` helper called in `POST /v1/assessments/:id/submit`:

- Returns early if `contextType !== 'vendor'` or `contextId` is null
- Loads template questions, calls `computeScore()`, computes `riskScore = 100 - score.overall`
- Loads vendor to check `overrideTier` — only auto-updates tier if no override
- Updates `vendorsTable.riskScore` and (conditionally) `tier`

**New import:** `computeTierFromRiskScore` from `../lib/allowed-transitions`

## Commits

| Task | Commit | Description |
|---|---|---|
| Task 1 | d9a7204 | feat(11-01): add vendor onboarding wizard API endpoints |
| Task 2 | 992aedf | feat(11-01): wire assessment completion to vendor risk score update |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed redundant double-query in enrich endpoint**
- **Found during:** Task 1
- **Issue:** Plan's action template had a first `existingJobs` query followed by an unused `runningJob` variable, then a second full query. Would not compile cleanly and had dead code.
- **Fix:** Collapsed to a single query returning `id`, `payload`, and `status`; in-memory filter for pending/processing jobs with matching vendorId payload.
- **Files modified:** `artifacts/api-server/src/routes/vendors.ts`
- **Commit:** d9a7204

None other — plan executed cleanly.

## Self-Check: PASSED

- `artifacts/api-server/src/routes/vendors.ts` — modified (317 lines added)
- `artifacts/api-server/src/routes/assessments.ts` — modified (54 lines added)
- Commit d9a7204 exists
- Commit 992aedf exists
- `pnpm --filter api-server build` completes with zero errors
