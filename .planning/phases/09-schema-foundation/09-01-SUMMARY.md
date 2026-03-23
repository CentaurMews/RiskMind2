---
phase: 09-schema-foundation
plan: "01"
subsystem: database
tags: [drizzle, postgres, schema, jsonb, pgEnum, assessment, foresight, integration]

requires: []
provides:
  - "assessment_templates table — JSONB questions, context_type enum (vendor/framework), versioning"
  - "assessments table — nullable context_id (polymorphic), JSONB responses, numeric score, ai_summary"
  - "integration_configs table — AES-256-GCM encrypted_config, source_type enum (nvd/shodan/sentinel/misp/email), unique tenant+source constraint"
  - "foresight_scenarios table — nullable risk_id FK, JSONB parameters for FAIR inputs"
  - "foresight_simulations table — JSONB results (ALE/percentiles), simulation_status enum, cascade delete"
affects:
  - phase-10-assessment-engine
  - phase-12-signal-integrations
  - phase-14-foresight-v2

tech-stack:
  added: []
  patterns:
    - "Polymorphic context_type enum + nullable context_id — discriminant pattern for vendor/framework assessment sharing"
    - "JSONB on same row (questions in template, responses in assessment) — avoids separate answer rows table"
    - "uniqueIndex for one-config-per-tenant enforcement — integration_configs_tenant_source_idx"
    - "Nullable FK with onDelete set null — foresight_scenarios.risk_id for standalone scenarios"
    - "JSONB input_parameters snapshot at simulation time — decoupled from mutable scenario.parameters"

key-files:
  created:
    - lib/db/src/schema/assessments.ts
    - lib/db/src/schema/integration-configs.ts
    - lib/db/src/schema/foresight.ts
  modified: []

key-decisions:
  - "context_id is nullable (no .notNull()) — assessment can exist without a vendor/framework until contextId is known"
  - "JSONB questions on assessment_templates, not a separate questions table — simplifies template cloning and versioning"
  - "integration_configs unique index on (tenant_id, source_type) — one active config per integration per tenant"
  - "foresight_simulations.input_parameters snapshots FAIR params at run time — results remain interpretable even if scenario changes"

patterns-established:
  - "Polymorphic FK: context_type enum + nullable context_id (no separate vendor_id/framework_id columns)"
  - "JSONB with typed defaults: .default([]) for arrays, .default({}) for objects"
  - "All new schema files: UUID PK + tenant FK + timestamps + drizzle-zod insert schema + TypeScript types"

requirements-completed:
  - "Foundation for ASMT-01-07"
  - "Foundation for SGNL-01-05"
  - "Foundation for FRST-01-05"

duration: 2min
completed: "2026-03-23"
---

# Phase 9 Plan 01: Schema Foundation Summary

**Three new Drizzle schema files providing DDL for assessment engine (polymorphic context_type), signal integration configs (AES-256-GCM encrypted_config), and foresight Monte Carlo tables (JSONB FAIR parameters + percentile results)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T12:06:35Z
- **Completed:** 2026-03-23T12:07:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created assessments.ts with 2 enums (assessment_context_type, assessment_status), 2 tables (assessment_templates + assessments), nullable context_id for polymorphic vendor/framework associations, JSONB questions + responses, numeric score, ai_summary, and composite indexes
- Created integration-configs.ts with integration_source_type enum (nvd/shodan/sentinel/misp/email), encrypted_config text column (AES-256-GCM pattern identical to llm_configs), and unique (tenant_id, source_type) constraint
- Created foresight.ts with foresight_simulation_status enum, foresight_scenarios (nullable risk_id FK with set null, JSONB parameters), and foresight_simulations (JSONB results + input_parameters snapshot, cascade delete)

## Task Commits

1. **Task 1: Create assessments.ts schema file** — `55f096f` (feat)
2. **Task 2: Create integration-configs.ts and foresight.ts schema files** — `e5a5d37` (feat)

## Files Created/Modified

- `lib/db/src/schema/assessments.ts` — assessment_templates + assessments tables, 2 enums, composite indexes, insert schemas and types
- `lib/db/src/schema/integration-configs.ts` — integration_configs table, source_type enum, uniqueIndex constraint, insert schema and types
- `lib/db/src/schema/foresight.ts` — foresight_scenarios + foresight_simulations tables, simulation_status enum, nullable risk FK, JSONB results, insert schemas and types

## Decisions Made

- Used nullable `context_id` (no `.notNull()`) instead of separate `vendor_id`/`framework_id` columns — avoids the anti-pattern of hardcoded FK per domain, enables polymorphic queries via the discriminant index
- JSONB `questions` array stored on assessment_templates (not a separate rows table) — simplifies template versioning via clone-and-increment pattern
- `input_parameters` snapshot column on foresight_simulations — results remain self-contained and interpretable even if parent scenario parameters are edited later

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Schema files will be applied via `pnpm db:generate && pnpm db:migrate` in a subsequent plan.

## Next Phase Readiness

- Phase 10 (Assessment Engine): assessment_templates + assessments tables ready; can build CRUD routes, template cloning, and LLM summary generation
- Phase 12 (Signal Integrations): integration_configs table ready; can implement polling workers using encrypted credentials
- Phase 14 (Foresight v2): foresight_scenarios + foresight_simulations tables ready; can implement Monte Carlo async job queue

---
*Phase: 09-schema-foundation*
*Completed: 2026-03-23*
