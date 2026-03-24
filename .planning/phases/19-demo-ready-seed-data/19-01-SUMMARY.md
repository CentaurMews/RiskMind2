---
phase: 19-demo-ready-seed-data
plan: 01
subsystem: seed
tags: [seed, vendors, compliance, dpia, assessment-templates]
dependency_graph:
  requires: [18-comprehensive-demo-seed-data]
  provides: [dpia-template, real-vendors, compliance-thresholds]
  affects: [template-library, vendor-pipeline, compliance-posture]
tech_stack:
  added: []
  patterns: [add-if-empty idempotency guard, modular seed functions]
key_files:
  created: []
  modified:
    - lib/db/src/seed/prebuilt-templates.ts
    - artifacts/api-server/src/lib/seed.ts
decisions:
  - DPIA template uses sec-dp-xxx/q-dp-xxx ID convention matching existing templates
  - Idempotency check uses Microsoft vendor name presence as the guard signal
  - complianceThreshold only set when value is null (does not overwrite existing thresholds)
  - realVendors return value kept for potential use by downstream plans (Plan 02)
metrics:
  duration: "4 minutes"
  completed: "2026-03-24"
  tasks: 2
  files: 2
---

# Phase 19 Plan 01: DPIA Template, Real Vendors, and Compliance Thresholds Summary

DPIA 7-section assessment template (62 questions) seeded as 4th prebuilt template, 5 real-named vendors added to vendor pipeline across lifecycle stages, and ISO/SOC2/NIST compliance thresholds set for RAG status display.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add DPIA template to prebuilt-templates.ts | 0056ab9 | lib/db/src/seed/prebuilt-templates.ts |
| 2 | Add real vendors and compliance thresholds to seed.ts | 79128bf | artifacts/api-server/src/lib/seed.ts |

## What Was Built

### Task 1: DPIA Template

Added a 4th prebuilt assessment template "Vendor Security + Privacy (DPIA)" to `lib/db/src/seed/prebuilt-templates.ts` with:

- 7 sections (sec-dp-001 through sec-dp-007)
- 62 questions (q-dp-001 through q-dp-062)
- Section A: General Information (8 questions)
- Section B: Data Processing Details (12 questions)
- Section C: Data Transfers (8 questions)
- Section D: Rights of Data Subjects (8 questions)
- Section E: Security Measures (12 questions)
- Section F: Risk Assessment (8 questions)
- Section G: Approval and Sign-Off (6 questions)
- Conditional branching throughout (consent question shows only when legal basis = consent, etc.)
- [Client] replaced with "Acme Corp" per D-09
- All "(choices to define)" options filled with realistic values per D-10
- [PREBUILT] prefix in description per D-11
- contextType: "vendor"

### Task 2: Real Vendors and Compliance Thresholds

Added to `artifacts/api-server/src/lib/seed.ts`:

**seedRealVendors()**: 5 real-named vendors across lifecycle stages:
- Microsoft (critical tier, monitoring, riskScore: 25.50)
- Amazon Web Services (critical tier, monitoring, riskScore: 22.00)
- Cloudflare (high tier, contracting, riskScore: null)
- Salesforce (high tier, due_diligence, riskScore: null)
- SAP Business One (medium tier, risk_assessment, riskScore: null)

**seedComplianceThresholds()**: Sets compliance thresholds for existing frameworks:
- ISO 27001: 80%
- SOC 2: 75%
- NIST CSF: 70%

Both functions wired into `seedDemoDataIfEmpty()` and `seedExpandedDataForExistingTenant()`.

## Verification

- grep "Vendor Security + Privacy (DPIA)" returns match: PASS
- grep -c "seedRealVendors" returns 3: PASS
- grep -c "seedComplianceThresholds" returns 3: PASS
- grep -c 'id: "sec-dp-' returns 7: PASS
- grep -c "q-dp-" returns 170 (62 questions + sectionId references): PASS
- npx tsc --noEmit --skipLibCheck: no errors: PASS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to actual DB inserts via seed functions.

## Self-Check: PASSED

- lib/db/src/seed/prebuilt-templates.ts modified: FOUND
- artifacts/api-server/src/lib/seed.ts modified: FOUND
- Commit 0056ab9 (Task 1): FOUND
- Commit 79128bf (Task 2): FOUND
