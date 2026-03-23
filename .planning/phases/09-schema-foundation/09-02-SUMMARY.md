---
phase: 09-schema-foundation
plan: 02
subsystem: database-schema
tags: [drizzle, schema, vendor-lifecycle, signal-integrations, compliance-flow]
dependency_graph:
  requires: [09-01]
  provides: [vendor-subprocessors-table, org-dependencies-table, monitoring-configs-table, signals-content-hash, vendors-next-assessment-due, frameworks-compliance-threshold]
  affects: [phase-11-vendor-lifecycle, phase-12-signal-integrations, phase-13-compliance-flow]
tech_stack:
  added: []
  patterns: [drizzle-pgTable-with-index-callback, partial-unique-index, enum-reuse-across-files, dual-FK-same-table]
key_files:
  created:
    - lib/db/src/schema/vendor-subprocessors.ts
    - lib/db/src/schema/org-dependencies.ts
    - lib/db/src/schema/monitoring-configs.ts
  modified:
    - lib/db/src/schema/signals.ts
    - lib/db/src/schema/vendors.ts
    - lib/db/src/schema/frameworks.ts
decisions:
  - "Signals deduplication uses partial unique index WHERE content_hash IS NOT NULL — allows nullable hash on existing rows while enforcing uniqueness when hash is present"
  - "monitoring-configs reuses vendorTierEnum from vendors.ts rather than defining a new text column — maintains enum consistency and prevents drift"
  - "vendor-subprocessors uses dual FK to same vendorsTable (vendor_id + subprocessor_id) — subprocessors are vendors in the system, not a separate concept"
metrics:
  duration: 117s
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 09 Plan 02: Vendor Lifecycle Schema Extensions Summary

One-liner: Three new schema files (vendor-subprocessors with dual vendor FK, org-dependencies with nullable vendor FK, monitoring-configs reusing vendorTierEnum) plus column additions to signals (content_hash + partial dedup index), vendors (next_assessment_due date), and frameworks (compliance_threshold, import_source, import_reference).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create vendor-subprocessors.ts, org-dependencies.ts, monitoring-configs.ts | c74eddd | lib/db/src/schema/vendor-subprocessors.ts, lib/db/src/schema/org-dependencies.ts, lib/db/src/schema/monitoring-configs.ts |
| 2 | Add columns to signals.ts, vendors.ts, frameworks.ts | 51bcd4b | lib/db/src/schema/signals.ts, lib/db/src/schema/vendors.ts, lib/db/src/schema/frameworks.ts |

## What Was Built

### New Tables

**vendor_subprocessors** — Links two vendor records as parent/child for 4th-party risk tracking. Dual FK to the same `vendorsTable` (`vendor_id` = parent, `subprocessor_id` = child). Unique pair index prevents duplicate relationships. `criticality` and `discovered_by` enums enable AI-assisted 4th-party discovery tracking.

**org_dependencies** — Captures tenant-level infrastructure dependencies (email, cloud, CDN, identity, payment, communication). Nullable `vendor_id` FK links to the vendor record if one exists. Supports both tracked and untracked dependencies via `provider_name` text field.

**monitoring_configs** — Per-tier assessment cadence configuration. Reuses `vendorTierEnum` from `vendors.ts` to define one monitoring schedule per vendor tier per tenant. `cadence_days` integer drives scheduler logic. Optional `assessment_template_id` FK ties automated re-assessments to a specific template.

### Column Additions

**signals.ts** — Added `content_hash` (nullable text for SHA-256), `external_id` (feed-specific dedup key), `vendor_id` (nullable FK to vendors with SET NULL), `metadata` (JSONB for feed-specific data). Partial unique index `signals_dedup_idx` on `(tenant_id, source, content_hash) WHERE content_hash IS NOT NULL` enforces deduplication only when hash is present, preventing unbounded LLM triage costs from duplicate ingest.

**vendors.ts** — Added `next_assessment_due` (nullable date). Scheduler queries `WHERE next_assessment_due <= now()` to identify vendors needing reassessment. Populated by monitoring config engine in Phase 11.

**frameworks.ts** — Added `compliance_threshold` (numeric 5,2), `import_source` (text), `import_reference` (text). Threshold drives pass/fail in compliance assessments. Import columns track provenance for framework import feature in Phase 13.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All 6 schema files verified present on disk. Both task commits (c74eddd, 51bcd4b) verified in git log.
