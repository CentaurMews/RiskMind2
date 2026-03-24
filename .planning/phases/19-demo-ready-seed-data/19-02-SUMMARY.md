---
phase: 19-demo-ready-seed-data
plan: "02"
subsystem: seed
tags: [seed, controls, assessments, iso27001, compliance]
dependency_graph:
  requires: [19-01]
  provides: [controls-seed, control-requirement-maps-seed, control-tests-seed, completed-assessments-seed]
  affects: [assessment-results-pages, control-detail-pages, compliance-posture-display]
tech_stack:
  added: []
  patterns: [idempotency-guard, multi-mapping, rotated-ownership]
key_files:
  created: []
  modified:
    - artifacts/api-server/src/lib/seed.ts
decisions:
  - controlDefs defined at module level as typed array so both seedControls and seedControlRequirementMaps share isoCode metadata without parameter duplication
  - additionalMappings record externalizes multi-mapping config separate from controlDefs for clarity
  - seedCompletedAssessments calls seedPrebuiltTemplates internally to ensure DPIA template exists before querying
  - InsertedControl type alias used for the controls return value to avoid full schema type import
metrics:
  duration: "8 minutes"
  completed: "2026-03-24"
  tasks: 2
  files: 1
---

# Phase 19 Plan 02: Controls, Control Tests, and Completed Assessments Summary

Seeded 17 security controls with ISO 27001 requirement mappings, 7 control tests with pass/fail/partial results, and 3 completed assessment instances showing varied scores for assessment results pages and compliance posture displays.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Seed controls, requirement maps, and control tests | a2358ff | artifacts/api-server/src/lib/seed.ts |
| 2 | Seed completed assessments with DPIA and compliance responses | a2358ff | artifacts/api-server/src/lib/seed.ts |

Note: Both tasks were implemented in a single atomic edit and committed together since the assessment seeding (Task 2) depends on controls being wired (same commit).

## What Was Built

### seedControls(tenantId, users)
17 security controls with correct status distribution:
- 11 active: MFA, Data Encryption at Rest/Transit, IR Plan, PAM, Vulnerability Management, Security Awareness Training, Network Segmentation, Backup and Recovery, Access Review Process, Logging and Monitoring
- 4 planned: DLP, Secure SDLC, Third-Party Risk Continuous Monitoring, Configuration Management Baseline
- 2 inactive: Legacy VPN, Manual Change Approval Board

Ownership rotates across admin, risk_manager, and risk_owner users.

### seedControlRequirementMaps(tenantId, controls)
Maps each control to its primary ISO 27001 requirement code. Additional multi-mappings:
- MFA → also A.5.17 (Authentication information)
- Data Encryption at Rest → also A.8.11 (Data masking)
- Incident Response Plan → also A.5.26 (Response) and A.5.27 (Learning from incidents)
- Vulnerability Management → also A.8.7 (Protection against malware)
- Logging and Monitoring → also A.8.16 (Monitoring activities)

### seedControlTests(tenantId, controls, users)
7 control tests:
- 4 pass: MFA (100% enforcement), Encryption at Rest (KMS audit), Vulnerability Management (0 critical), Backup/Recovery (3.5hr RTO)
- 1 fail: Access Review Process (8 terminated accounts still active)
- 2 partial: IR Plan (escalation timeout), Network Segmentation (staging/dev subnet shared)

### seedCompletedAssessments(tenantId, realVendors, isoFrameworkId)
3 completed assessments:
- **Microsoft DPIA** — score 82.40% (passing): Strong security posture, EU Data Boundary commitment, approved
- **AWS DPIA** — score 71.30% (moderate): Gaps in DR region adequacy docs and DSAR response time, conditionally approved
- **ISO 27001 Compliance Control Assessment** — score 65.20% (AT-RISK, below 80% threshold): Ad-hoc monitoring, incomplete evidence docs for 4 controls

All responses use correct DPIA question IDs (q-dp-001 through q-dp-062) and Compliance Control question IDs (q-cc-001 through q-cc-022).

## Idempotency Guards

All four functions have SQL `count(*)` idempotency guards that skip execution if rows already exist for the tenant.

## Wiring

Both `seedDemoDataIfEmpty` (new tenant path) and `seedExpandedDataForExistingTenant` (existing tenant path) call all four functions in sequence:
1. seedControls → 2. seedControlRequirementMaps → 3. seedControlTests → 4. seedCompletedAssessments

## Deviations from Plan

### Auto-fixed Issues

None.

### Adjustments

**1. [Rule 3 - Blocking] Worktree merge required**
- **Found during:** Setup
- **Issue:** Worktree was behind main by the 19-01 commits (seedRealVendors, seedComplianceThresholds not present)
- **Fix:** `git merge --no-edit main` fast-forwarded the worktree to include all 19-01 changes
- **Commit:** (merge, no code change)

**2. Task 1 and Task 2 committed together**
- Both tasks were implemented in a single edit pass since the assessment function references `realVendors` from the same call site as controls. Splitting would require a partial state. Combined commit `a2358ff` covers both tasks.

## Known Stubs

None. All seed functions produce real data with wired FKs and realistic responses.

## Self-Check

- [x] seedControls function exists in seed.ts
- [x] seedControlRequirementMaps function exists in seed.ts
- [x] seedControlTests function exists in seed.ts
- [x] seedCompletedAssessments function exists in seed.ts
- [x] Imports: controlsTable, controlRequirementMapsTable, controlTestsTable added
- [x] grep -c returns 12 for 4 function names
- [x] Score 82.40, 71.30, 65.20 all present
- [x] result: "pass" appears 4 times, "fail" 1 time, "partial" 2 times
- [x] status: "planned" appears 4+ times in controlDefs (4 planned controls)
- [x] status: "inactive" appears 2 times
- [x] q-dp- and q-cc- question IDs present in responses
- [x] TypeScript: no errors in seed.ts (tsc --noEmit)
- [x] Build: pnpm --filter api-server build passes

## Self-Check: PASSED
