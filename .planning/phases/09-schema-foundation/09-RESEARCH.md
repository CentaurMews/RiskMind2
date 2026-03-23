# Phase 9: Schema Foundation — Research

**Researched:** 2026-03-23
**Domain:** Drizzle ORM schema authoring — PostgreSQL DDL for v2.0 tables, enums, indexes, column additions, compatibility views, and Drizzle relations
**Confidence:** HIGH (all findings verified against actual codebase files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** — Build new assessment tables (`assessment_templates`, `assessments`) as the v2.0 engine. Create a `questionnaires` compatibility view pointing at the new tables so existing vendor questionnaire API routes continue to work without code changes.

**D-02** — The existing `questionnaires` and `questionnaire_questions` tables will be dropped after the compatibility view is verified. The view must expose the same column names and types as the current tables.

**D-03** — Assessment templates store questions, branching rules, and weights as a JSONB array in the `assessment_templates` table. Template is a single document. Versioning via template cloning (not in-place edits to active templates).

**D-04** — Context types: `vendor` and `framework` enum values on `assessments.context_type`. Two context types matching the two Assessment Engine consumers.

**D-05** — Assessment responses stored as JSONB in the `assessments` table (one row per assessment). Score computed and cached on the same row. No normalized responses table.

**D-06** — Single `integration_configs` table for all signal sources: `tenant_id`, `source_type` enum (nvd/shodan/sentinel/misp/email), `encrypted_config` JSONB (AES-256-GCM, same pattern as `llm_configs`), `polling_schedule`, `is_active`, `last_polled_at`.

**D-07** — Unique constraint on `(tenant_id, source_type)` — one configuration per source type per tenant.

**D-08** — Simulation results store summary + percentiles only: ALE, p50, p90, p95, p99, iteration count, and input parameters as JSONB. ~500 bytes per run. No full iteration data stored.

**D-09** — Scenarios have nullable `risk_id` — can model a specific risk or run standalone what-if scenarios without a risk context.

**D-10** — `vendor_subprocessors` join table: `vendor_id` (parent), `subprocessor_id` (child, FK to vendors), `relationship_type`, `criticality`, `discovered_by` (manual/llm). Both sides reference the `vendors` table.

**D-11** — Dedicated `org_dependencies` table: `tenant_id`, `category` (email/cloud/cdn/identity/other), `provider_name`, `vendor_id` (nullable FK to vendors), `criticality`, `notes`.

**D-12** — `monitoring_configs` table: `tenant_id`, `tier` (references vendor_tier enum), `cadence_days` integer, `assessment_template_id` (FK to assessment_templates).

**D-13** — Add `next_assessment_due` date column to `vendors` table.

**D-14** — Add `content_hash` text column with unique index per `(tenant_id, source, content_hash)` on signals.

**D-15** — Add `external_id` text column to signals for source-specific identifiers.

**D-16** — Add `vendor_id` nullable FK to vendors table on signals.

**D-17** — Add `metadata` JSONB column to signals for source-specific data.

### Claude's Discretion

- Exact enum values for `org_dependencies.category` beyond the core set
- Column ordering and index naming conventions
- Whether to add `updated_at` to tables that may not need it
- Drizzle relation definitions and their exact shape
- Whether `assessment_templates` needs a `version` integer column or if cloning suffices

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| Foundation for ASMT-01–07 | Assessment Engine tables (`assessment_templates`, `assessments`) with polymorphic `context_type` enum and JSONB responses | D-03, D-04, D-05: JSONB template document + `context_type` (vendor/framework) + response + score on same row |
| Foundation for VNDR-01–07 | Vendor table columns for monitoring + subprocessors + org dependencies + monitoring configs | D-10, D-11, D-12, D-13: `vendor_subprocessors`, `org_dependencies`, `monitoring_configs`, `vendors.next_assessment_due` |
| Foundation for COMP-01–03 | Frameworks table column additions; assessments `context_type = 'framework'` handles compliance | D-04: `framework` in context_type enum; frameworks table gets `compliance_threshold`, `import_source`, `import_reference` |
| Foundation for SGNL-01–05 | `integration_configs` table + signal table column additions (content_hash, external_id, vendor_id, metadata) | D-06, D-07, D-14–D-17 |
| Foundation for FRST-01–05 | `foresight_scenarios` and `foresight_simulations` tables | D-08, D-09: JSONB results with percentiles, nullable `risk_id` on scenarios |

</phase_requirements>

---

## Summary

Phase 9 is pure DDL — create all tables, columns, enums, indexes, compatibility views, and Drizzle relation definitions that v2.0 features require. No routes, no business logic, no UI. Every subsequent phase (10–14) writes feature code against a final, stable schema with no migration conflicts mid-development.

The project uses **Drizzle ORM** with `drizzle-kit push` as the migration strategy (confirmed from `lib/db/package.json` scripts). There are no migration files to generate — `push` compares the Drizzle schema against the live database and applies the diff. This means every schema file change is immediately reflected by running `pnpm push` from `lib/db/`.

The project has well-established Drizzle patterns across all 29 existing schema files: UUID PKs via `defaultRandom()`, `tenant_id` FK on every table, `created_at`/`updated_at` timestamps, `pgEnum` + export, `createInsertSchema` with `drizzle-zod`, and `$inferSelect` / `$inferInsert` type exports. Phase 9 must follow all these patterns exactly.

**Primary recommendation:** Write one schema file per logical domain (assessments, integration-configs, foresight, vendor-subprocessors, org-dependencies, monitoring-configs), add column alterations to existing files in-place, create the `questionnaires` compatibility view as a raw SQL bootstrap step, add Drizzle relations to a new `lib/db/src/relations.ts`, and export everything from `lib/db/src/schema/index.ts`.

---

## Standard Stack

### Core (already installed — no installs needed for Phase 9)

| Library | Version | Purpose | Confirmed |
|---------|---------|---------|-----------|
| `drizzle-orm` | catalog (latest) | Schema definition, query builder | `lib/db/package.json` — `catalog:` alias |
| `drizzle-kit` | ^0.31.9 | `drizzle-kit push` applies schema diff to PostgreSQL | Confirmed in `lib/db/package.json` |
| `drizzle-zod` | ^0.8.3 | `createInsertSchema` for Zod validation schemas | Confirmed in `lib/db/package.json` |
| `pg` | ^8.20.0 | PostgreSQL client driver | Confirmed in `lib/db/package.json` |
| `zod` | catalog | Validation — `z.infer<>` for TypeScript types | Used in every existing schema file with `zod/v4` import |

**Installation:** None required. Phase 9 is schema-file authoring only.

**Push command:**

```bash
cd /home/dante/RiskMind2/lib/db
pnpm push
# Equivalent to: tsx ./src/bootstrap.ts && drizzle-kit push --config ./drizzle.config.ts
```

**Force push (to drop columns/tables — needed for questionnaires removal later):**

```bash
pnpm push-force
# Equivalent to: tsx ./src/bootstrap.ts && drizzle-kit push --force --config ./drizzle.config.ts
```

---

## Architecture Patterns

### Recommended Project Structure for Phase 9

New schema files belong in `lib/db/src/schema/`. Existing files get in-place column additions.

```
lib/db/src/schema/
├── assessments.ts              [NEW] assessment_templates + assessments tables + enums
├── integration-configs.ts      [NEW] integration_configs table + source_type enum
├── foresight.ts                [NEW] foresight_scenarios + foresight_simulations tables
├── vendor-subprocessors.ts     [NEW] vendor_subprocessors join table + enums
├── org-dependencies.ts         [NEW] org_dependencies table + category enum
├── monitoring-configs.ts       [NEW] monitoring_configs table
├── signals.ts                  [MODIFY] add content_hash, external_id, vendor_id, metadata columns
├── vendors.ts                  [MODIFY] add next_assessment_due column
├── frameworks.ts               [MODIFY] add compliance_threshold, import_source, import_reference columns
└── index.ts                    [MODIFY] export all new tables
lib/db/src/
└── relations.ts                [NEW] Drizzle relations for all v2.0 tables
```

The `questionnaires` compatibility view is NOT a Drizzle schema file — it is raw SQL executed at bootstrap time. Drizzle does not support views natively via `pgTable`, so the view must be created in `lib/db/src/bootstrap.ts` (the existing bootstrap script already runs before `drizzle-kit push`).

### Pattern 1: pgTable with UUID PK + Tenant FK (established across all 29 tables)

**What:** Every table follows the same structural template.
**When to use:** All new tables in Phase 9.

```typescript
// Source: established pattern — lib/db/src/schema/llm-configs.ts, vendors.ts, signals.ts, etc.
import { pgTable, uuid, text, timestamp, jsonb, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const exampleTable = pgTable("example", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  // ... domain columns ...
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertExampleSchema = createInsertSchema(exampleTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExample = z.infer<typeof insertExampleSchema>;
export type Example = typeof exampleTable.$inferSelect;
```

### Pattern 2: pgEnum export alongside table

**What:** All enums defined with `pgEnum`, exported, and used inline in the table definition.
**When to use:** Every enum in Phase 9.

```typescript
// Source: lib/db/src/schema/vendors.ts (vendorTierEnum, vendorStatusEnum pattern)
export const contextTypeEnum = pgEnum("context_type", [
  "vendor",
  "framework",
]);
```

### Pattern 3: Composite Unique Index (confirmed pattern from llm-task-routing.ts)

**What:** Unique constraint across multiple columns using the table callback form.
**When to use:** `integration_configs` unique on `(tenant_id, source_type)` per D-07; `signals` unique index on `(tenant_id, source, content_hash)` per D-14.

```typescript
// Source: lib/db/src/schema/llm-task-routing.ts
import { uniqueIndex } from "drizzle-orm/pg-core";

export const integrationConfigsTable = pgTable("integration_configs", {
  // ... columns ...
}, (t) => [
  uniqueIndex("integration_configs_tenant_source_idx").on(t.tenantId, t.sourceType),
]);
```

### Pattern 4: Non-Unique Composite Index (confirmed pattern from llm-benchmark-results.ts)

**What:** Index for query performance without uniqueness enforcement.
**When to use:** Any table expected to be filtered by `(tenant_id, some_field)` at query time.

```typescript
// Source: lib/db/src/schema/llm-benchmark-results.ts
import { index } from "drizzle-orm/pg-core";

export const someTable = pgTable("some_table", {
  // ... columns ...
}, (t) => [
  index("some_table_tenant_idx").on(t.tenantId, t.createdAt),
]);
```

### Pattern 5: In-Place Column Addition (ALTER TABLE via drizzle-kit push)

**What:** Add new columns directly to existing schema file. `drizzle-kit push` detects the diff and issues `ALTER TABLE ... ADD COLUMN` automatically.
**When to use:** `signals.ts`, `vendors.ts`, `frameworks.ts` all need new columns.

```typescript
// Source: lib/db/src/schema/signals.ts — current state (lines 13-24)
// Add these columns to the existing signalsTable definition:
contentHash: text("content_hash"),
externalId: text("external_id"),
vendorId: uuid("vendor_id").references(() => vendorsTable.id, { onDelete: "set null" }),
metadata: jsonb("metadata"),
```

**Important:** `content_hash` must be nullable (not `.notNull()`) to allow existing rows to remain without a hash value until backfill.

### Pattern 6: Compatibility View via Bootstrap SQL

**What:** PostgreSQL `CREATE OR REPLACE VIEW` executed in `bootstrap.ts` before `drizzle-kit push`. The view wraps the new `assessments` table to expose the same column names as the legacy `questionnaires` table.
**When to use:** Required before D-02 (drop questionnaires) to prevent breaking `vendors.ts` route.

The current `questionnaires` table columns that the route consumes (verified from `vendors.ts` grep):
- `id`, `tenant_id`, `vendor_id`, `title`, `questionnaire_status`, `template`, `responses`, `magic_link_token`, `magic_link_expires_at`, `created_at`, `updated_at`

The compatibility view query shape:

```sql
-- Source: verified against lib/db/src/schema/questionnaires.ts columns
CREATE OR REPLACE VIEW questionnaires AS
  SELECT
    a.id,
    a.tenant_id,
    a.context_id AS vendor_id,
    at.title,
    a.status::text AS questionnaire_status,
    at.questions AS template,
    a.responses,
    NULL::text AS magic_link_token,
    NULL::timestamptz AS magic_link_expires_at,
    a.created_at,
    a.updated_at
  FROM assessments a
  JOIN assessment_templates at ON at.id = a.template_id
  WHERE a.context_type = 'vendor';
```

**Note:** `magic_link_token` and `magic_link_expires_at` are legacy portal features not used in v2.0 — NULL placeholders are acceptable. If any route writes to these columns, a writable view or separate handling is required. From the route inspection, these columns appear to be read-only in existing code (magic link generation creates them directly, not via the questionnaires insert path used by the ORM).

### Pattern 7: Drizzle Relations Definition

**What:** Defines foreign key relationships for Drizzle's `with` relational query API. Goes in a separate `relations.ts` file — the existing codebase has no `relations.ts` yet (confirmed: glob returned no results).
**When to use:** Create `lib/db/src/relations.ts` as part of Phase 9.

```typescript
// Source: Drizzle ORM relations documentation pattern
import { relations } from "drizzle-orm";
import { assessmentsTable } from "./schema/assessments";
import { assessmentTemplatesTable } from "./schema/assessments";
import { tenantsTable } from "./schema/tenants";
import { vendorsTable } from "./schema/vendors";

export const assessmentRelations = relations(assessmentsTable, ({ one }) => ({
  tenant: one(tenantsTable, {
    fields: [assessmentsTable.tenantId],
    references: [tenantsTable.id],
  }),
  template: one(assessmentTemplatesTable, {
    fields: [assessmentsTable.templateId],
    references: [assessmentTemplatesTable.id],
  }),
}));
```

**Important for the `db` instance:** The `relations.ts` definitions must be imported and passed to `drizzle()` in `lib/db/src/index.ts` for relational queries to work:

```typescript
// lib/db/src/index.ts — add import and merge into schema
import * as schema from "./schema";
import * as relations from "./relations";

export const db = drizzle(pool, { schema: { ...schema, ...relations } });
```

### Anti-Patterns to Avoid

- **`vendor_id NOT NULL` on assessments table:** D-04 requires polymorphic `context_type` + nullable `context_id`. A hard `vendor_id` FK breaks compliance flow. Every new table that references assessments should use `context_type` + `context_id` not a direct vendor FK.
- **Creating a separate `assessment_responses` table:** D-05 is explicit: responses as JSONB on the `assessments` row. No normalized responses table.
- **Calling `drizzle-kit generate` instead of `drizzle-kit push`:** The project uses `push` (schema-to-DB diff), not `generate` (SQL migration file generation). Do not add migration files.
- **Storing compatibility view definition in a Drizzle schema file:** Drizzle's `pgTable` API does not create views. The view must be raw SQL in `bootstrap.ts`.
- **Circular imports:** `vendor-subprocessors.ts` references `vendorsTable` from `vendors.ts`. Always import from peer files, never from `index.ts`, to avoid circular dependency issues.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID primary keys | Custom ID generation | `uuid().primaryKey().defaultRandom()` | Established pattern in all 29 existing tables — generates at DB level |
| Zod validation schemas from table definition | Manual Zod schema mirroring DB columns | `createInsertSchema(table).omit({id, createdAt, updatedAt})` | `drizzle-zod` derives the schema from the Drizzle table definition — zero drift |
| TypeScript types from table | Manual interface definitions | `typeof table.$inferSelect` / `typeof table.$inferInsert` | Drizzle's type inference is exact — manual types cause drift when columns change |
| Composite unique constraints | Application-level deduplication checks | `uniqueIndex(...).on(col1, col2)` in table callback | DB-level enforcement is the only reliable dedup guard (race conditions exist at app level) |
| Schema diff computation | Custom ALTER TABLE scripts | `drizzle-kit push` | drizzle-kit computes the diff, handles column type changes, and applies in correct order |

**Key insight:** Drizzle's type inference and `drizzle-zod` integration mean every schema change automatically propagates correct TypeScript types to all consumers of `@workspace/db`. Manual type casting after schema changes is never correct — it hides drift.

---

## Common Pitfalls

### Pitfall 1: assessments.context_id Without a Discriminant Index

**What goes wrong:** Queries filtering by `context_type = 'vendor' AND context_id = :id` do a full table scan when tenant has many assessments.
**Why it happens:** `context_id` is a nullable UUID with no index — queries that filter by vendor ID or framework ID across assessments are slow.
**How to avoid:** Add a composite index on `(tenant_id, context_type, context_id)` in the table callback.
**Warning signs:** Slow vendor scorecard queries once assessments volume grows.

### Pitfall 2: Compatibility View Breaks on INSERT

**What goes wrong:** The `vendors.ts` route inserts into `questionnairesTable` using Drizzle's insert API. A plain read-only view causes `ERROR: cannot insert into view`.
**Why it happens:** PostgreSQL views are read-only by default unless they have `INSTEAD OF` triggers or are simple enough for auto-updatable view rules.
**How to avoid:** Audit the `vendors.ts` routes before Phase 10. The route at line 437 (`db.insert(questionnairesTable).values(...)`) will fail against a view. The compatibility view is safe only for read routes. The INSERT route must be updated in Phase 10 to use `assessmentsTable` directly.
**Warning signs:** `ERROR: cannot insert into view "questionnaires"` when creating a questionnaire.

### Pitfall 3: Unique Index on signals.content_hash Without Partial Filter

**What goes wrong:** `NULL` content_hash values on existing rows conflict with the unique index. PostgreSQL considers all NULLs distinct for unique indexes — this is actually safe, but a large backfill could be required if content_hash is set to NOT NULL later.
**Why it happens:** The column is added as nullable (correct) but the index spans `(tenant_id, source, content_hash)`. When `content_hash IS NULL`, existing rows do not conflict.
**How to avoid:** Keep `content_hash` nullable. Unique index on `(tenant_id, source, content_hash)` where `content_hash IS NOT NULL` as a partial index is the safest approach for deduplication without blocking existing NULL rows.

```typescript
// Partial unique index — only enforces uniqueness when content_hash is set
index("signals_dedup_idx")
  .on(t.tenantId, t.source, t.contentHash)
  .where(sql`content_hash IS NOT NULL`)
  .unique()
```

### Pitfall 4: vendor_subprocessors Self-Referential FK Import Order

**What goes wrong:** `vendor_subprocessors.ts` imports `vendorsTable` from `vendors.ts`. If `index.ts` exports in the wrong order, TypeScript circular dependency or runtime `undefined` reference error.
**Why it happens:** Both `vendor_id` and `subprocessor_id` FK reference `vendorsTable`. The `vendors.ts` file must be loaded before `vendor-subprocessors.ts`.
**How to avoid:** In `index.ts`, ensure `export * from "./vendors"` appears before `export * from "./vendor-subprocessors"`. Drizzle resolves FKs lazily with `() => table.col` arrow functions — always use arrow function form for FK references.

```typescript
// Correct: arrow function form avoids hoisting/circular issues
vendorId: uuid("vendor_id").notNull().references(() => vendorsTable.id),
subprocessorId: uuid("subprocessor_id").notNull().references(() => vendorsTable.id),
```

### Pitfall 5: drizzle-kit push Drops the questionnaires Table Before the View Exists

**What goes wrong:** If the compatibility view is not created before `drizzle-kit push` runs, and push drops the old `questionnaires` table (because it is no longer in the Drizzle schema), then the `vendors.ts` route immediately breaks.
**Why it happens:** Phase 9 removes `questionnaires.ts` from the schema (to tell drizzle-kit the old table should be dropped) but the view must already exist before the table is dropped.
**How to avoid:** Phase 9 does NOT drop the questionnaires table. It only adds new tables and columns. The questionnaires table remains in the schema until Phase 10, when the route is rewritten and the compatibility view is confirmed working. D-02 (drop tables) is a Phase 10 action, not Phase 9.

### Pitfall 6: Forgetting to Export New Tables from index.ts

**What goes wrong:** TypeScript compilation succeeds, but `db` (from `lib/db/src/index.ts`) does not include the new tables in its schema object. `db.query.assessmentsTable.findMany()` throws a runtime error: `relation "assessments" does not exist in schema`.
**Why it happens:** `drizzle()` is initialized with `schema` that is imported from `./schema` (the index). New table files not exported from `index.ts` are invisible to the query builder.
**How to avoid:** Every new `*.ts` file in `lib/db/src/schema/` MUST get a corresponding `export * from "./filename"` in `index.ts` before running `drizzle-kit push`.

### Pitfall 7: monitoring_configs tier Column Type Mismatch

**What goes wrong:** `monitoring_configs.tier` stores vendor tier values but the column type is defined as plain `text` instead of referencing `vendorTierEnum`. Downstream TypeScript code fails type-check when comparing tier values.
**Why it happens:** Developer creates a new text column not realizing the enum already exists.
**How to avoid:** Import and reuse `vendorTierEnum` from `vendors.ts` for the tier column in `monitoring_configs`:

```typescript
import { vendorTierEnum } from "./vendors";
// ...
tier: vendorTierEnum("tier").notNull(),
```

---

## Code Examples

Verified patterns from codebase inspection:

### New Table: assessments.ts (template for the most complex new file)

```typescript
// lib/db/src/schema/assessments.ts
import { pgTable, uuid, text, timestamp, jsonb, numeric, integer, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

// Enums — exported alongside tables per project convention
export const assessmentContextTypeEnum = pgEnum("assessment_context_type", [
  "vendor",
  "framework",
]);

export const assessmentStatusEnum = pgEnum("assessment_status", [
  "draft",
  "active",
  "completed",
  "abandoned",
]);

// assessment_templates: the reusable template document
export const assessmentTemplatesTable = pgTable("assessment_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  questions: jsonb("questions").notNull().default([]),  // JSONB array per D-03
  contextType: assessmentContextTypeEnum("context_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("assessment_templates_tenant_idx").on(t.tenantId, t.createdAt),
]);

// assessments: one row per assessment instance (D-05: responses + score on same row)
export const assessmentsTable = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  templateId: uuid("template_id").notNull().references(() => assessmentTemplatesTable.id),
  contextType: assessmentContextTypeEnum("context_type").notNull(),   // D-04
  contextId: uuid("context_id"),  // nullable — vendor_id or framework_id (D-04 anti-pattern: NOT NULL)
  status: assessmentStatusEnum("assessment_status").notNull().default("draft"),
  responses: jsonb("responses").notNull().default({}),  // D-05: JSONB on same row
  score: numeric("score", { precision: 5, scale: 2 }),  // D-05: cached score
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("assessments_tenant_context_idx").on(t.tenantId, t.contextType, t.contextId),
  index("assessments_tenant_status_idx").on(t.tenantId, t.status),
]);

export const insertAssessmentTemplateSchema = createInsertSchema(assessmentTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssessmentTemplate = z.infer<typeof insertAssessmentTemplateSchema>;
export type AssessmentTemplate = typeof assessmentTemplatesTable.$inferSelect;

export const insertAssessmentSchema = createInsertSchema(assessmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessmentsTable.$inferSelect;
```

### Column Addition: signals.ts (partial diff)

```typescript
// lib/db/src/schema/signals.ts — ADD these columns to signalsTable definition
// Source: D-14, D-15, D-16, D-17 from CONTEXT.md + codebase pattern
import { ..., jsonb, uniqueIndex, sql } from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";

// In signalsTable column list, add after embedding:
contentHash: text("content_hash"),           // D-14: dedup hash
externalId: text("external_id"),             // D-15: CVE ID, Sentinel incident ID, etc.
vendorId: uuid("vendor_id").references(() => vendorsTable.id, { onDelete: "set null" }),  // D-16
metadata: jsonb("metadata"),                 // D-17: source-specific data

// Add table-level indexes (second argument to pgTable):
}, (t) => [
  // Partial unique index — only enforces when hash is present (safe for existing NULL rows)
  uniqueIndex("signals_dedup_idx")
    .on(t.tenantId, t.source, t.contentHash)
    .where(sql`content_hash IS NOT NULL`),
]);
```

### New Table: integration-configs.ts

```typescript
// lib/db/src/schema/integration-configs.ts
import { pgTable, uuid, text, timestamp, boolean, integer, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const integrationSourceTypeEnum = pgEnum("integration_source_type", [
  "nvd",
  "shodan",
  "sentinel",
  "misp",
  "email",
]);

export const integrationConfigsTable = pgTable("integration_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  sourceType: integrationSourceTypeEnum("source_type").notNull(),  // D-06
  encryptedConfig: text("encrypted_config"),  // D-06: AES-256-GCM, same as llm_configs pattern
  pollingSchedule: text("polling_schedule"),  // D-06: cron expression or interval string
  isActive: boolean("is_active").notNull().default(true),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("integration_configs_tenant_source_idx").on(t.tenantId, t.sourceType),  // D-07
]);

export const insertIntegrationConfigSchema = createInsertSchema(integrationConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationConfig = z.infer<typeof insertIntegrationConfigSchema>;
export type IntegrationConfig = typeof integrationConfigsTable.$inferSelect;
```

### Compatibility View Bootstrap

```typescript
// lib/db/src/bootstrap.ts — ADD after pgvector extension creation
// Source: D-01 decision — view must expose same columns as questionnaires table

await client.query(`
  CREATE OR REPLACE VIEW questionnaires AS
    SELECT
      a.id,
      a.tenant_id,
      a.context_id AS vendor_id,
      at.title,
      a.status::text AS questionnaire_status,
      at.questions AS template,
      a.responses,
      NULL::text AS magic_link_token,
      NULL::timestamptz AS magic_link_expires_at,
      a.created_at,
      a.updated_at
    FROM assessments a
    JOIN assessment_templates at ON at.id = a.template_id
    WHERE a.context_type = 'vendor'
`);
console.log("questionnaires compatibility view ensured");
```

### index.ts barrel additions

```typescript
// lib/db/src/schema/index.ts — ADD these exports
export * from "./assessments";
export * from "./integration-configs";
export * from "./foresight";
export * from "./vendor-subprocessors";
export * from "./org-dependencies";
export * from "./monitoring-configs";
// Existing exports remain unchanged — questionnaires.ts stays until Phase 10
```

---

## Complete Table Inventory for Phase 9

This is the definitive list of every schema change. The planner must produce a task for each item.

### New Schema Files

| File | Tables/Enums Created | Key Constraints |
|------|---------------------|-----------------|
| `assessments.ts` | `assessment_context_type` enum, `assessment_status` enum, `assessment_templates`, `assessments` | `assessments(tenant_id, context_type, context_id)` composite index; nullable `context_id` (NO vendor_id NOT NULL) |
| `integration-configs.ts` | `integration_source_type` enum, `integration_configs` | Unique on `(tenant_id, source_type)` per D-07 |
| `foresight.ts` | `foresight_simulation_status` enum, `foresight_scenarios`, `foresight_simulations` | `scenarios.risk_id` nullable FK to risks per D-09; `simulations.results` JSONB with ALE+percentiles per D-08 |
| `vendor-subprocessors.ts` | `subprocessor_criticality` enum, `subprocessor_discovered_by` enum, `vendor_subprocessors` | Both `vendor_id` AND `subprocessor_id` FK to `vendors` table per D-10 |
| `org-dependencies.ts` | `org_dependency_category` enum, `org_dependencies` | Nullable `vendor_id` FK to vendors per D-11 |
| `monitoring-configs.ts` | `monitoring_configs` | Uses `vendorTierEnum` from `vendors.ts`; FK to `assessment_templates` per D-12 |

### Existing Schema File Modifications

| File | Columns Added | Notes |
|------|--------------|-------|
| `signals.ts` | `content_hash text`, `external_id text`, `vendor_id uuid` (nullable FK), `metadata jsonb` | Add partial unique index on `(tenant_id, source, content_hash) WHERE content_hash IS NOT NULL` per D-14 |
| `vendors.ts` | `next_assessment_due date` | Simple nullable date column per D-13 |
| `frameworks.ts` | `compliance_threshold numeric(5,2)`, `import_source text`, `import_reference text` | From ARCHITECTURE.md: compliance flow foundation |

### New Infrastructure Files

| File | Purpose |
|------|---------|
| `lib/db/src/relations.ts` | Drizzle relations definitions for all v2.0 tables (and backfill existing table relations) |
| `lib/db/src/bootstrap.ts` (MODIFY) | Add `CREATE OR REPLACE VIEW questionnaires` SQL for compatibility view |

### Drizzle Relations to Define

Relations needed in `lib/db/src/relations.ts` for TypeScript query inference:

| Table | Relations |
|-------|----------|
| `assessmentTemplatesTable` | `many(assessments)` |
| `assessmentsTable` | `one(assessmentTemplates)`, `one(tenants)` |
| `integrationConfigsTable` | `one(tenants)` |
| `foresightScenariosTable` | `one(tenants)`, `one(risks)` (nullable), `many(foresightSimulations)` |
| `foresightSimulationsTable` | `one(foresightScenarios)`, `one(tenants)` |
| `vendorSubprocessorsTable` | `one(vendors, vendor)`, `one(vendors, subprocessor)` (named relations — self-referential) |
| `orgDependenciesTable` | `one(tenants)`, `one(vendors)` (nullable) |
| `monitoringConfigsTable` | `one(tenants)`, `one(assessmentTemplates)` |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Drizzle `relations` in same file as table | `relations.ts` as separate file | Better organization when relations span multiple files |
| `uniqueIndex` without `.where()` | Partial unique index with `sql\`...\`` | Allows NULL values to coexist while enforcing uniqueness on non-NULL rows |
| `pgTable` first arg only | `pgTable` with callback `(t) => [...]` for indexes | Required for composite indexes — confirmed pattern in `llm-task-routing.ts` and `llm-benchmark-results.ts` |

**Drizzle-kit push vs generate:** The project uses `push` (not `generate`). This means there are no SQL migration files to write — only schema file changes. The `migrations/` directory has one legacy SQL file (`0001_...`) that appears to be from before push was adopted. Do not add new files there.

---

## Open Questions

1. **Questionnaire INSERT route compatibility**
   - What we know: `vendors.ts` line 437 does `db.insert(questionnairesTable).values(...)`. A read-only PostgreSQL view will reject INSERTs.
   - What's unclear: Whether any Phase 9 plan task should include updating the INSERT path, or whether Phase 10 owns that entirely.
   - Recommendation: Phase 9 creates the view as read-only. A note/comment in the bootstrap SQL should document that the INSERT path at `vendors.ts:437` must be updated in Phase 10 before the questionnaires table can be dropped. The view does not break anything in Phase 9 because the old `questionnaires` table still exists alongside it — the view is just an additive alias.

2. **`assessment_templates` version column**
   - What we know: D-03 says "versioning via template cloning." Claude's discretion allows adding a `version integer` column.
   - Recommendation: Add `version integer default 1` — it costs nothing and lets queries identify which generation of a template an assessment used. Cloning increments the version on the clone.

3. **`boolean` import in assessments.ts**
   - What we know: `boolean` is used in the code example above but the import list from `drizzle-orm/pg-core` does not include it in the existing patterns.
   - Recommendation: Add `boolean` to the import. All existing tables that use boolean (e.g., `llm-configs.ts`) import it from `drizzle-orm/pg-core`. This is not a real gap.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — schema-only phase, pure DDL |
| Config file | n/a |
| Quick run command | `cd /home/dante/RiskMind2/lib/db && pnpm push 2>&1` |
| Full suite command | `cd /home/dante/RiskMind2/lib/db && pnpm push 2>&1 && psql $DATABASE_URL -c "\dt"` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| Schema push applies cleanly | `drizzle-kit push` exits 0 | smoke | `cd lib/db && pnpm push` | n/a — runtime check |
| assessments table created | `assessments` and `assessment_templates` visible in psql | smoke | `psql $DATABASE_URL -c "\d assessments"` | n/a — runtime check |
| signals.content_hash with unique index | unique index on `(tenant_id, source, content_hash)` present | smoke | `psql $DATABASE_URL -c "\di signals_dedup_idx"` | n/a — runtime check |
| integration_configs unique constraint | unique index on `(tenant_id, source_type)` present | smoke | `psql $DATABASE_URL -c "\di integration_configs_tenant_source_idx"` | n/a — runtime check |
| TypeScript compiles | No type errors after schema changes + index.ts updates | compile | `cd lib/db && pnpm tsc --noEmit` | ❌ Wave 0: confirm tsc script |
| questionnaires view exists | View accessible in psql | smoke | `psql $DATABASE_URL -c "SELECT * FROM questionnaires LIMIT 1"` | n/a — runtime check |
| No vendor_id NOT NULL on assessments | `assessments.context_id` is nullable | smoke | `psql $DATABASE_URL -c "\d assessments" \| grep context_id` | n/a — runtime check |

### Sampling Rate

- **Per task commit:** `cd /home/dante/RiskMind2/lib/db && pnpm push`
- **Per wave merge:** Full suite — push + psql spot checks above
- **Phase gate:** All psql spot checks pass + TypeScript compiles with 0 errors before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Confirm `pnpm tsc --noEmit` script exists in `lib/db/package.json` or use `tsc -p tsconfig.json --noEmit` directly
- [ ] Verify `DATABASE_URL` is accessible in the dev environment before running push commands

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `lib/db/src/schema/*.ts` (all 29 files) — established patterns confirmed directly
- `lib/db/drizzle.config.ts` — schema path and dialect confirmed
- `lib/db/package.json` — drizzle-kit version ^0.31.9, push script, versions confirmed
- `lib/db/src/index.ts` — `drizzle(pool, { schema })` init pattern confirmed
- `lib/db/src/bootstrap.ts` — bootstrap pattern confirmed (run before push)
- `artifacts/api-server/src/routes/vendors.ts` — questionnaire column usage confirmed (48 references)
- `.planning/phases/09-schema-foundation/09-CONTEXT.md` — all decisions D-01 through D-17

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` — v2.0 table designs, component map, anti-patterns — HIGH confidence (codebase-grounded)
- `.planning/research/PITFALLS.md` — polymorphic assessment anti-pattern, dedup risks — HIGH confidence (codebase-grounded)
- `.planning/research/STACK.md` — stack additions, version confirmations — HIGH confidence (npm registry verified 2026-03-23)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions confirmed from `lib/db/package.json`
- Architecture: HIGH — all patterns verified from actual codebase files
- Table designs: HIGH — directly derived from locked decisions D-01 through D-17 and ARCHITECTURE.md
- Compatibility view: MEDIUM — column mapping is correct but INSERT behavior needs Phase 10 validation
- Pitfalls: HIGH — verified against actual route code (vendors.ts grep confirms exact line numbers)

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (Drizzle APIs are stable; no fast-moving concerns)
