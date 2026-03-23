# Phase 9: Schema Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 09-schema-foundation
**Areas discussed:** Questionnaire migration, Assessment data model, Integration credentials, Foresight tables, Vendor subprocessors, Org dependency mapping, Monitoring schedules, Signal enhancements

---

## Questionnaire Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Keep + build new | Keep existing tables untouched, build new assessment tables alongside | |
| Migrate in-place | Alter existing tables: add context_type/context_id, make vendor_id nullable | |
| Replace with view | Build new tables, create compatibility view pointing at new tables | ✓ |

**User's choice:** Replace with view
**Notes:** Clean break with backward compatibility. Existing vendor questionnaire API routes continue working via the view.

---

## Assessment Data Model — Template Storage

| Option | Description | Selected |
|--------|-------------|----------|
| JSONB in template row | Questions, branching rules, weights as JSONB array in assessment_templates | ✓ |
| Normalized question tables | Separate assessment_template_questions table with rows per question | |
| Hybrid | Template structure in JSONB, question text/weights normalized | |

**User's choice:** JSONB in template row
**Notes:** Template is a single document. Versioning via cloning.

## Assessment Data Model — Context Types

| Option | Description | Selected |
|--------|-------------|----------|
| vendor + framework | Two context types matching the two consumers | ✓ |
| vendor + framework + control | Three types including individual control-level | |
| Generic entity | Free text context_type with UUID | |

**User's choice:** vendor + framework

## Assessment Data Model — Response Storage

| Option | Description | Selected |
|--------|-------------|----------|
| One row per assessment | Responses as JSONB in assessments table, score cached on row | ✓ |
| Normalized responses | Separate assessment_responses table with one row per answer | |

**User's choice:** One row per assessment

---

## Integration Credentials — Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Single table | One integration_configs table with source_type enum and encrypted JSONB | ✓ |
| Per-source tables | Separate tables per source (nvd_configs, shodan_configs, etc.) | |
| Extend llm_configs | Add signal sources to existing llm_configs table | |

**User's choice:** Single table

## Integration Credentials — Multi-config

| Option | Description | Selected |
|--------|-------------|----------|
| One per source type | Unique constraint on (tenant_id, source_type) | ✓ |
| Multiple allowed | No unique constraint, multiple instances per source | |

**User's choice:** One per source type

---

## Foresight Tables — Simulation Results

| Option | Description | Selected |
|--------|-------------|----------|
| Summary + percentiles | Store ALE, p50/p90/p95/p99, iteration count, input params as JSONB | ✓ |
| Full distribution | Store every iteration result (10k-100k rows per sim) | |
| Summary + histogram bins | Percentiles plus 50-100 histogram bins | |

**User's choice:** Summary + percentiles

## Foresight Tables — Scenario Links

| Option | Description | Selected |
|--------|-------------|----------|
| Optional risk link | Nullable risk_id on scenarios | ✓ |
| Always linked to risk | Every scenario must reference a risk | |
| Many-to-many | Join table scenario_risks | |

**User's choice:** Optional risk link

---

## Vendor Subprocessors

| Option | Description | Selected |
|--------|-------------|----------|
| Join table | vendor_subprocessors with vendor_id and subprocessor_id both FK to vendors | ✓ |
| Separate entity | subprocessors as their own table (not vendors) | |
| JSONB on vendor | Array of subprocessor data as JSONB column | |

**User's choice:** Join table
**Notes:** Subprocessors are first-class vendors — enables full assessment and monitoring.

---

## Org Dependency Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated table | org_dependencies with category, provider_name, nullable vendor_id FK | ✓ |
| JSONB on tenant | dependencies JSONB column on tenants table | |
| Extend vendor table | Add is_dependency boolean + dependency_category to vendors | |

**User's choice:** Dedicated table

---

## Monitoring Schedules

| Option | Description | Selected |
|--------|-------------|----------|
| Config table + vendor column | monitoring_configs per tier + next_assessment_due on vendors | ✓ |
| All on vendor | monitoring_cadence_days and next_assessment_due on vendors | |
| Scheduled jobs table | Use existing jobs table with recurring type | |

**User's choice:** Config table + vendor column

---

## Signal Enhancements

All four options selected (multiSelect):
- ✓ content_hash + unique index per (tenant_id, source, content_hash)
- ✓ external_id for source-specific identifiers
- ✓ vendor_id nullable FK to vendors
- ✓ metadata JSONB for source-specific data

---

## Claude's Discretion

- Exact enum values for org_dependencies.category
- Column ordering and index naming
- Whether tables need updated_at
- Drizzle relation definitions
- Template versioning (version integer vs cloning)

## Deferred Ideas

None — discussion stayed within phase scope.
