---
phase: 18-comprehensive-demo-seed-data
plan: "02"
subsystem: seed-data
tags: [seed, assessments, signals, findings, demo-data]
dependency_graph:
  requires: [18-01]
  provides: [assessment-seed-data, signal-seed-data, findings-seed-data]
  affects: [artifacts/api-server/src/lib/seed.ts]
tech_stack:
  added: []
  patterns: [add-if-empty guard, idempotent seeding, FK-safe insert order]
key_files:
  created: []
  modified:
    - artifacts/api-server/src/lib/seed.ts
    - lib/db/package.json
decisions:
  - "seedAssessments() calls seedPrebuiltTemplates() first to ensure templates exist before inserting assessment records with FK templateId"
  - "contentHash values use deterministic 64-char hex strings (0001...0001 pattern) for idempotent dedup without crypto dependency at seed time"
  - "seedExpandedSignals() returns externalId->id map so seedFindings() can resolve signalId FKs without extra DB queries"
  - "lib/db package.json exports extended with ./seed/prebuilt-templates entry to satisfy bundler module resolution"
metrics:
  duration: 540s
  completed: "2026-03-24"
  tasks: 2
  files: 2
---

# Phase 18 Plan 02: Assessment and Signal Seed Data Summary

Seeded assessment templates and completed assessments, expanded signals across all 5 source types with realistic metadata, and created findings completing the signal->finding->risk traceability chain.

## What Was Built

### Task 1: Assessment Templates and Completed Assessments

Added `seedAssessments(tenantId, vendors, isoFrameworkId)` function to `seed.ts`:

- Calls `seedPrebuiltTemplates(tenantId)` to ensure the 3 pre-built templates exist
- Guards with assessment count check (skips if > 0)
- Looks up "Vendor Security Assessment" template by title
- Creates 3 completed vendor assessments:
  - CloudScale Inc: score 72.50, 18 question responses, detailed aiSummary
  - DataGuard Pro: score 55.30, weaker BCP posture in responses
  - PayFlow Systems: score 81.20, strong across all sections
- Updates vendor riskScores: CloudScale 27.50, DataGuard 44.70, PayFlow 18.80 (100 - score)
- Creates 1 completed compliance assessment for ISO 27001: score 68.40 with compliance control responses

Added `@workspace/db/seed/prebuilt-templates` export to `lib/db/package.json` to satisfy bundler module resolution.

### Task 2: Expanded Signals and Findings Chain

Added `seedExpandedSignals(tenantId, vendors)` function:

- Guards with contentHash existence check (additive with existing 3 basic signals)
- Inserts 17 new signals across all 5 source types:
  - **NVD (4):** CVE-2024-21762 (FortiOS RCE), CVE-2024-3400 (PAN-OS), CVE-2024-1709 (ScreenConnect), CVE-2024-27198 (TeamCity)
  - **Shodan (3):** RDP exposure on CloudScale, MongoDB without auth on DataGuard, expired SSL on PayFlow
  - **Sentinel (4):** Brute force Azure AD, data exfiltration from finance server, privilege escalation, impossible travel
  - **MISP (3):** APT28 campaign, LockBit 4.0 IoCs, npm supply chain compromise
  - **Email (3):** External audit findings, DataGuard service disruption, anonymous insider threat tip
- Each signal has contentHash (64-char hex), externalId, and metadata JSONB
- Returns externalId->signalId map for findings linking

Added `seedFindings(tenantId, signalIdMap, risks, vendors)` function:

- Guards with findings count check
- Creates 6 findings completing the signal->finding->risk chain:
  1. Critical RDP Exposure — shodan-rdp-cloudscale signal, Data Breach risk, open
  2. FortiOS RCE — CVE-2024-21762 signal, Ransomware risk, investigating
  3. Anomalous Data Exfiltration — sentinel-exfil signal, Data Breach risk, open
  4. APT28 Campaign Indicators — misp-45821 signal, Ransomware risk, investigating
  5. Privileged Access Gaps (Audit) — email-audit signal, Regulatory risk, resolved
  6. DataGuard Service Disruption — email-vendor signal, Supply Chain risk, open

## Verification

- TypeScript compiles without errors in seed.ts
- All seed functions use add-if-empty pattern (idempotent)
- signal->finding->risk chain is complete (all 6 findings reference signalId and riskId)
- Assessment scores update vendor riskScore fields (100 - assessment score)
- 5 signal source types covered: nvd, shodan, sentinel, misp, email

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- artifacts/api-server/src/lib/seed.ts — FOUND
- lib/db/package.json — FOUND
- .planning/phases/18-comprehensive-demo-seed-data/18-02-SUMMARY.md — FOUND
- Commit c0e1f49 — FOUND
