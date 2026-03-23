---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Core Platform Features
status: Ready to execute
stopped_at: Completed 11-03-PLAN.md
last_updated: "2026-03-23T15:46:01.001Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 12
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** A working, demo-ready enterprise risk management platform powered by intelligent AI routing at https://app.riskmind.net
**Current focus:** Phase 11 — vendor-lifecycle-redesign

## Current Position

Phase: 11 (vendor-lifecycle-redesign) — EXECUTING
Plan: 4 of 5

## Performance Metrics

**Velocity (v2.0):**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 9. Schema Foundation | - | - | - |
| 10. Assessment Engine | - | - | - |
| 11. Vendor Lifecycle Redesign | - | - | - |
| 12. Signal Integrations | - | - | - |
| 13. Compliance Flow | - | - | - |
| 14. Foresight v2 | - | - | - |

*Updated after each plan completion*
| Phase 09-schema-foundation P01 | 2 | 2 tasks | 3 files |
| Phase 09-schema-foundation P02 | 117s | 2 tasks | 6 files |
| Phase 09-schema-foundation P03 | 217s | 2 tasks | 4 files |
| Phase 10-assessment-engine P01 | 228 | 2 tasks | 4 files |
| Phase 10-assessment-engine P02 | 720 | 3 tasks | 6 files |
| Phase 10-assessment-engine P03 | 531 | 2 tasks | 7 files |
| Phase 10-assessment-engine P04 | 561 | 3 tasks | 11 files |
| Phase 11-vendor-lifecycle-redesign P01 | 162 | 2 tasks | 2 files |
| Phase 11-vendor-lifecycle-redesign P02 | 283 | 3 tasks | 5 files |
| Phase 11 P03 | 272 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 Architecture]: Assessment Engine built as polymorphic shared service — `context_type` (vendor/compliance/control) designed in Phase 9 schema before any feature code; no `vendor_id NOT NULL` pattern
- [v2.0 Architecture]: Schema Foundation (Phase 9) is pure DDL — no routes, no business logic — applied first to eliminate mid-development migration conflicts across all parallel tracks
- [v2.0 Architecture]: Signal deduplication via `content_hash` SHA256 unique index added in Phase 9 before any polling code is written — prevents unbounded LLM triage costs
- [v2.0 Architecture]: All signal integration credentials stored in `integration_configs` with AES-256-GCM encryption (same pattern as `llm_configs`) — never environment variables
- [v2.0 Architecture]: Microsoft Sentinel integration uses Azure Log Analytics REST API (`api.loganalytics.io/v1`) — SIEM agent retired November 2025
- [v2.0 Architecture]: Monte Carlo runs async via job queue (202 Accepted + poll) — never synchronous in route handler; `setImmediate` chunking or Worker Threads for >50k iterations
- [v2.0 Architecture]: Framework import is additive-only (upsert + `deprecated_at`) — never DELETE + re-insert; wrapped in rollback-capable Drizzle transaction with diff preview
- [v2.0 Scope]: All signal integrations use real API feeds (Sentinel, Shodan, CVE/NVD, MISP, email)
- [v2.0 Scope]: Foresight v2 uses real OSINT data feeds, not simulated
- [v2.0 Scope]: No deadline — build it right
- [Phase 09-schema-foundation]: Polymorphic context_type enum + nullable context_id chosen over separate vendor_id/framework_id columns — enables shared assessment engine across vendor and compliance domains without schema branching
- [Phase 09-schema-foundation]: JSONB questions stored on assessment_templates (not separate rows table) — simplifies template versioning via clone-and-increment pattern
- [Phase 09-schema-foundation]: foresight_simulations.input_parameters snapshots FAIR params at run time — results remain self-contained even if parent scenario is edited
- [Phase 09-schema-foundation]: Signals deduplication uses partial unique index WHERE content_hash IS NOT NULL — allows nullable hash on existing rows while enforcing uniqueness when hash is present
- [Phase 09-schema-foundation]: monitoring-configs reuses vendorTierEnum from vendors.ts rather than defining a new text column — maintains enum consistency across tables
- [Phase 09-schema-foundation]: vendor-subprocessors uses dual FK to same vendorsTable — subprocessors are vendors in the system enabling 4th-party risk tracking without a separate concept
- [Phase 09-schema-foundation]: questionnaires_v2 named with _v2 suffix to avoid conflict with existing questionnaires table — Phase 10 renames after old table drop
- [Phase 09-schema-foundation]: bootstrap.ts guards view creation with table existence check so pnpm push works on first run without failing
- [Phase 09-schema-foundation]: assessment_status is the DB column name (not 'status') — Drizzle uses pgEnum call argument as column name in raw SQL
- [Phase 10-assessment-engine]: text questions normalize to 1.0 (qualitative — no numeric penalty)
- [Phase 10-assessment-engine]: empty sections excluded from overall score average to avoid denominator inflation
- [Phase 10-assessment-engine]: LLMTaskType extended with 'assessment' for per-task model routing on AI follow-up and summary generation
- [Phase 10-assessment-engine]: registerWorker('ai-assess') colocated in assessments.ts route file to keep worker logic near its triggering routes
- [Phase 10-assessment-engine]: [PREBUILT] prefix convention in description field guards pre-built templates from modification/deletion without schema changes
- [Phase 10-assessment-engine]: [PREBUILT] prefix detection used in template library to show Built-in badge and suppress delete — consistent with Plan 02 convention
- [Phase 10-assessment-engine]: All components import shared types from components/assessments/types.ts — single source of truth for frontend types
- [Phase 10-assessment-engine]: types.ts created as shared module for frontend assessment types — mirrors assessment-engine.ts without importing backend, avoids cross-package import issues in Vite
- [Phase 10-assessment-engine]: SectionScoreBar uses CSS transitions instead of recharts BarChart — simpler, more style control
- [Phase 10-assessment-engine]: AI follow-up SSE read via fetch ReadableStream (not EventSource constructor) — POST required, EventSource only supports GET
- [Phase 11-vendor-lifecycle-redesign]: Wizard step inferred from data completeness (assessment + documents existence) — no wizardCompletedAt column added to vendors schema
- [Phase 11-vendor-lifecycle-redesign]: riskScore = 100 - assessment.overall (higher = worse risk) — inverts compliance score to risk score
- [Phase 11-vendor-lifecycle-redesign]: overrideTier respected in risk score hook — tier auto-updated only when no manual override is set
- [Phase 11-vendor-lifecycle-redesign]: aliasedTable (not alias) is the Drizzle 0.45 export for table aliases — alias is absent from the main drizzle-orm index
- [Phase 11-vendor-lifecycle-redesign]: concentration-risk route placed before /:id route pattern to prevent Express path conflict in org-dependencies router
- [Phase 11-vendor-lifecycle-redesign]: scoreThreshold nullable in monitoring_configs — null means no threshold alerting for that tier; vendor-monitor worker skips alert insertion when null
- [Phase 11]: fetch() used directly for wizard API calls since Orval generated client does not yet include wizard endpoints added in Phase 11-01
- [Phase 11]: Step components defined as separate functions in same file for co-location without cross-file coupling in vendor-onboard.tsx

### Pending Todos

- Verify `p-ratelimit ^1.2.0` version on npm registry before Phase 12 install
- Measure actual Monte Carlo benchmark (10k iterations) on this codebase before Phase 14 — research estimate is ~200ms, not a measured run
- Audit existing recharts v2.x usage before Phase 14 upgrade to v3.8 — review axis/tooltip prop changes
- Grep all `questionnaires` table consumers before Phase 10 — create compatibility view before migrating source of truth

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260323-hyb | Analyze GitHub issue 83 and update with migration design | 2026-03-23 | pending | [260323-hyb-analyze-github-issue-83-and-update-with-](./quick/260323-hyb-analyze-github-issue-83-and-update-with-/) |

## Session Continuity

Last session: 2026-03-23T15:46:00.989Z
Stopped at: Completed 11-03-PLAN.md
Resume file: None
Next step: `/gsd:plan-phase 9`
