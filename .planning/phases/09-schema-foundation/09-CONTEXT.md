# Phase 9: Schema Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Create all database tables, columns, enums, indexes, and Drizzle relations needed by v2.0 features. Pure DDL — no routes, no business logic, no UI. After this phase, all subsequent phases (10-14) can write feature code against the final schema without mid-development migration conflicts.

</domain>

<decisions>
## Implementation Decisions

### Questionnaire Migration Strategy
- **D-01:** Build new assessment tables (assessment_templates, assessments) as the v2.0 engine. Create a `questionnaires` compatibility view pointing at the new tables so existing vendor questionnaire API routes continue to work without code changes.
- **D-02:** The existing `questionnaires` and `questionnaire_questions` tables will be dropped after the compatibility view is verified. The view must expose the same column names and types as the current tables.

### Assessment Data Model
- **D-03:** Assessment templates store questions, branching rules, and weights as a JSONB array in the `assessment_templates` table. Template is a single document. Versioning via template cloning (not in-place edits to active templates).
- **D-04:** Context types: `vendor` and `framework` enum values on `assessments.context_type`. Two context types matching the two Assessment Engine consumers.
- **D-05:** Assessment responses stored as JSONB in the `assessments` table (one row per assessment). Score computed and cached on the same row. No normalized responses table.

### Integration Credentials
- **D-06:** Single `integration_configs` table for all signal sources: `tenant_id`, `source_type` enum (nvd/shodan/sentinel/misp/email), `encrypted_config` JSONB (AES-256-GCM, same pattern as `llm_configs`), `polling_schedule`, `is_active`, `last_polled_at`.
- **D-07:** Unique constraint on `(tenant_id, source_type)` — one configuration per source type per tenant. No multi-instance support for v2.0.

### Foresight Tables
- **D-08:** Simulation results store summary + percentiles only: ALE, p50, p90, p95, p99, iteration count, and input parameters as JSONB. ~500 bytes per run. No full iteration data stored.
- **D-09:** Scenarios have nullable `risk_id` — can model a specific risk or run standalone what-if scenarios without a risk context.

### Vendor Subprocessors
- **D-10:** `vendor_subprocessors` join table: `vendor_id` (parent), `subprocessor_id` (child, FK to vendors), `relationship_type`, `criticality`, `discovered_by` (manual/llm). Both sides reference the `vendors` table — subprocessors are vendors themselves.

### Org Dependency Mapping
- **D-11:** Dedicated `org_dependencies` table: `tenant_id`, `category` (email/cloud/cdn/identity/other), `provider_name`, `vendor_id` (nullable FK to vendors), `criticality`, `notes`. Enables concentration risk queries across categories.

### Monitoring Schedules
- **D-12:** `monitoring_configs` table: `tenant_id`, `tier` (references vendor_tier enum), `cadence_days` integer, `assessment_template_id` (FK to assessment_templates). Defines per-tier monitoring policy.
- **D-13:** Add `next_assessment_due` date column to `vendors` table. Scheduler queries `WHERE next_assessment_due <= now()` to trigger re-assessments.

### Signal Table Enhancements
- **D-14:** Add `content_hash` text column with unique index per `(tenant_id, source, content_hash)` for deduplication.
- **D-15:** Add `external_id` text column for source-specific identifiers (CVE ID, Sentinel incident ID, MISP event UUID).
- **D-16:** Add `vendor_id` nullable FK to vendors table — links signals to specific vendors (e.g., Shodan scan results).
- **D-17:** Add `metadata` JSONB column for source-specific data (CVSS score, Shodan port list, MISP attributes) without adding per-source columns.

### Claude's Discretion
- Exact enum values for `org_dependencies.category` beyond the core set
- Column ordering and index naming conventions
- Whether to add `updated_at` to tables that may not need it
- Drizzle relation definitions and their exact shape
- Whether `assessment_templates` needs a `version` integer column or if cloning suffices

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Schema (migration targets)
- `lib/db/src/schema/questionnaires.ts` — Current questionnaires table with vendor_id NOT NULL (must be replaced by compatibility view)
- `lib/db/src/schema/questionnaire-questions.ts` — Current question types (text/boolean/scale) and categories
- `lib/db/src/schema/signals.ts` — Current signals table (needs content_hash, external_id, vendor_id, metadata columns)
- `lib/db/src/schema/vendors.ts` — Current vendors table (needs next_assessment_due column)
- `lib/db/src/schema/interview-sessions.ts` — Pattern model for assessment sessions (transcript JSONB, status enum)
- `lib/db/src/schema/llm-configs.ts` — AES-256-GCM encryption pattern model for integration_configs
- `lib/db/src/schema/index.ts` — Schema barrel export (new tables must be added here)

### Research
- `.planning/research/ARCHITECTURE.md` — Integration architecture, component map, data flows
- `.planning/research/PITFALLS.md` — 16 critical pitfalls including polymorphic schema and dedup risks
- `.planning/research/STACK.md` — Stack additions needed for v2.0

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/db/src/schema/llm-configs.ts` — AES-256-GCM encrypted column pattern (reuse for integration_configs)
- `lib/db/src/schema/interview-sessions.ts` — JSONB transcript + status enum pattern (model for assessment sessions)
- Drizzle `pgTable`, `pgEnum`, `createInsertSchema` patterns established across all existing tables

### Established Patterns
- All tables use UUID PKs with `defaultRandom()`
- All tables have `tenant_id` FK for multi-tenant isolation
- All tables have `createdAt`/`updatedAt` timestamps
- Enums defined with `pgEnum` and exported alongside tables
- Insert schemas created with `drizzle-zod` `createInsertSchema` omitting id/timestamps
- Types exported as `Insert*` and `*` (select) inference types

### Integration Points
- `lib/db/src/schema/index.ts` — barrel export, all new tables must be added here
- `lib/db/src/relations.ts` (if exists) — Drizzle relations definitions
- `drizzle.config.ts` — schema path for `drizzle-kit push`
- Orval-generated code in `lib/api-client-react/` and `lib/api-zod/` — compatibility view must maintain OpenAPI contract

</code_context>

<specifics>
## Specific Ideas

- Compatibility view for questionnaires ensures zero disruption to existing vendor questionnaire flows during v2.0 migration
- Subprocessors are first-class vendors (not a separate entity) — enables full assessment and monitoring of 4th-party relationships
- Org dependencies link to vendors when possible via nullable FK, enabling automated concentration risk detection

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-schema-foundation*
*Context gathered: 2026-03-23*
