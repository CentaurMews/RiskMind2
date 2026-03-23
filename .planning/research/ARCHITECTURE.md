# Architecture Research

**Domain:** Enterprise Risk Management Platform — v2.0 Integration Architecture
**Researched:** 2026-03-23
**Confidence:** HIGH (based on full codebase inspection + external API documentation)

---

## Standard Architecture

### System Overview: Current State (v1.2)

```
Internet → Cloudflare → cloudflared → localhost:4000
                                            │
                               ┌────────────▼────────────────────┐
                               │        Express 5 (PM2)           │
                               │   ┌──────────┐ ┌─────────────┐  │
                               │   │ REST API │ │ React SPA   │  │
                               │   │ /api/v1/ │ │ /           │  │
                               │   └─────┬────┘ └─────────────┘  │
                               │   ┌─────▼────┐                  │
                               │   │   /mcp   │  (MCP handler)  │
                               │   └──────────┘                  │
                               │                                  │
                               │  Background (same process):      │
                               │  ┌──────────┐ ┌────────────┐    │
                               │  │Job Queue │ │ Monitoring │    │
                               │  │Processor │ │ Scheduler  │    │
                               │  └──────────┘ └────────────┘    │
                               │  ┌──────────┐                   │
                               │  │  Agent   │                   │
                               │  │Scheduler │                   │
                               │  └──────────┘                   │
                               └────────────┬────────────────────┘
                                            │ Drizzle ORM
                               ┌────────────▼────────────────────┐
                               │   PostgreSQL 16 + pgvector       │
                               │   30+ tables, all tenant-scoped  │
                               └─────────────────────────────────┘
```

### System Overview: Target State (v2.0)

```
Internet → Cloudflare → cloudflared → localhost:4000
                                            │
                               ┌────────────▼────────────────────────────┐
                               │           Express 5 (PM2)                │
                               │   ┌──────────┐ ┌─────────────┐          │
                               │   │ REST API │ │ React SPA   │          │
                               │   │ /api/v1/ │ │ /           │          │
                               │   └─────┬────┘ └─────────────┘          │
                               │         │  [NEW routes added]            │
                               │         │  /assessments                  │
                               │         │  /foresight (implemented)      │
                               │         │  /integrations                 │
                               │                                          │
                               │  Background (same process):              │
                               │  ┌──────────┐ ┌────────────┐            │
                               │  │Job Queue │ │ Monitoring │            │
                               │  │Processor │ │ Scheduler  │            │
                               │  └──────────┘ └────────────┘            │
                               │  ┌──────────┐ ┌──────────────────────┐  │
                               │  │  Agent   │ │ Signal Feed Poller   │  │
                               │  │Scheduler │ │ [NEW] Shodan/NVD/    │  │
                               │  └──────────┘ │ MISP/Sentinel/Email  │  │
                               │               └──────────────────────┘  │
                               └────────────┬────────────────────────────┘
                                            │
                               ┌────────────▼────────────────────────────┐
                               │   PostgreSQL 16 + pgvector               │
                               │   30+ tables → ~40+ tables after v2.0   │
                               │   [NEW] assessments, assessment_sessions  │
                               │   [NEW] assessment_responses             │
                               │   [NEW] integration_configs              │
                               │   [NEW] foresight_simulations            │
                               │   [NEW] foresight_scenarios              │
                               │   [NEW] vendor_fourth_party_links        │
                               │   [MODIFIED] vendors (enrichment fields) │
                               │   [MODIFIED] frameworks (import fields)  │
                               │   [MODIFIED] signals (content_hash col)  │
                               └─────────────────────────────────────────┘
```

---

## Component Boundaries and Responsibilities

### Existing Components (unchanged or minimally modified)

| Component | Location | Responsibility | v2.0 Change |
|-----------|----------|---------------|-------------|
| Job Queue | `artifacts/api-server/src/lib/job-queue.ts` | Postgres-backed, SKIP LOCKED, exponential backoff, multi-queue | Add new job types; no structural change |
| LLM Service | `artifacts/api-server/src/lib/llm-service.ts` | Resolves tenant LLM config, routes by task type, openai_compat + anthropic SDKs | Add new task type: `assessment` |
| AI Workers | `artifacts/api-server/src/lib/ai-workers.ts` | Registers handlers for ai-triage, enrich-risk, embed-entity queues | Add handlers for assessment scoring, simulation enrichment |
| Monitoring Scheduler | `artifacts/api-server/src/lib/monitoring.ts` | KRI threshold evaluation, creates alerts | Add compliance posture threshold checks |
| Agent Scheduler | `artifacts/api-server/src/lib/agent-scheduler.ts` | Autonomous risk intelligence, policy tiers | Feed real signal data (from new feeds) into agent context |
| Risk Source Aggregator | `artifacts/api-server/src/services/risk-source-aggregator.ts` | Triage signals → findings, cluster by pgvector | New signal sources route through same path unchanged |

### New Components (v2.0)

| Component | Location | Responsibility |
|-----------|----------|---------------|
| Assessment Engine | `artifacts/api-server/src/lib/assessment-engine.ts` | Session state machine, AI question generation, response scoring |
| Signal Feed Poller | `artifacts/api-server/src/lib/signal-feed-poller.ts` | Scheduled polling of external feeds (Shodan, NVD, MISP, Sentinel) |
| Integration Config Manager | `artifacts/api-server/src/lib/integration-config.ts` | Per-tenant integration credentials, encrypted storage, enable/disable |
| Monte Carlo Runner | `artifacts/api-server/src/lib/monte-carlo.ts` | CPU-bound simulation, 10k iterations, risk propagation calculations |
| Framework Importer | `artifacts/api-server/src/lib/framework-importer.ts` | Parse OSCAL/JSON/CSV framework definitions, bulk-insert requirements |
| Email Ingestion Handler | `artifacts/api-server/src/lib/email-ingestion.ts` | IMAP IDLE listener, extract signal content, route to job queue |

---

## Monorepo Structure: v2.0 Additions

```
artifacts/api-server/src/
├── lib/
│   ├── assessment-engine.ts      [NEW] Session state, AI Q-gen, scoring
│   ├── signal-feed-poller.ts     [NEW] External feed polling scheduler
│   ├── integration-config.ts     [NEW] Encrypted integration credentials
│   ├── monte-carlo.ts            [NEW] Simulation engine
│   ├── framework-importer.ts     [NEW] OSCAL/JSON framework import parser
│   └── email-ingestion.ts        [NEW] IMAP listener + signal routing
├── routes/
│   ├── assessments.ts            [NEW] Assessment CRUD + session endpoints
│   ├── foresight.ts              [REPLACE stub] Monte Carlo + OSINT routes
│   └── integrations.ts           [NEW] Integration config CRUD + trigger
├── services/
│   ├── risk-source-aggregator.ts [EXISTING — no changes needed]
│   └── vendor-enrichment.ts      [NEW] Scheduled enrichment for monitoring
│
lib/db/src/schema/
├── assessments.ts                [NEW] Core assessment tables
├── integration-configs.ts        [NEW] External integration credentials
├── foresight.ts                  [NEW] Simulation + scenario tables
└── vendor-fourth-party.ts        [NEW] 4th party vendor relationship table
```

---

## Feature-to-Component Mapping

### Assessment Engine

**What it is:** A shared service that both Vendor Lifecycle and Compliance Flow consume for AI-driven questionnaires. Manages a multi-turn session: generate question → collect answer → AI scores answer → generate next question → produce final report.

**New tables:**

```
assessments
  id, tenant_id, type (vendor | compliance | control),
  subject_id (vendor_id or framework_id or control_id),
  status (draft | active | completed | abandoned),
  template_config jsonb,   -- question config / scoring criteria
  final_score numeric,
  created_at, updated_at

assessment_sessions
  id, tenant_id, assessment_id, user_id,
  status (active | committed | abandoned),
  transcript jsonb,        -- [{role, content, timestamp}] same shape as interview_sessions
  responses jsonb,         -- {question_id: {answer, score, rationale}}
  current_question_index int,
  created_at, updated_at

assessment_responses
  id, tenant_id, session_id, question_key text,
  answer text, ai_score numeric, ai_rationale text,
  created_at
```

**Integration points:**
- Extends the existing `interview_sessions` pattern (same transcript shape, same AI streaming pattern from `interviews.ts`)
- Reuses `complete()` from `llm-service.ts` with new task type `"assessment"`
- Enqueues `score_assessment_response` job for async AI scoring after each answer commit
- Vendor flow: assessment linked to `vendor_id`; compliance flow: linked to `framework_id` or `control_id`
- On session completion: writes aggregate score back to the parent entity (vendor `risk_score` updated, or control `status` updated + `control_test` record created)

**New LLM task type:** Add `"assessment"` to the `LLMTaskType` union in `llm-service.ts`. No structural change to routing — it becomes one more routable task type tenants can assign a model to.

---

### Vendor Lifecycle Redesign

**What changes:**

| Area | Current | v2.0 |
|------|---------|-------|
| Onboarding | Manual field entry | Multi-step wizard with progress state |
| Enrichment | On-demand only | Auto-triggered on status transitions |
| Monitoring | None beyond KRIs | Scheduled signal feed queries by vendor domain |
| Questionnaires | Static JSON template | Replaced by Assessment Engine sessions |
| 4th party risk | Not present | Vendor-to-vendor relationship table + risk propagation |

**Schema changes:**

```
-- vendors table: add columns
website_domain text,            -- for Shodan/signal feed targeting
enrichment_status text,         -- idle | queued | enriching | done | failed
last_enriched_at timestamp,
onboarding_step int default 0,  -- wizard progress
onboarding_data jsonb,          -- draft data before final commit

-- new table
vendor_fourth_party_links
  id, tenant_id,
  primary_vendor_id uuid → vendors.id,
  subvendor_id uuid → vendors.id,
  relationship_type text,       -- subprocessor | hosting | saas | other
  data_access_scope text,
  risk_inherit boolean,
  created_at
```

**Integration points:**
- Onboarding wizard: purely frontend multi-step form writing to `vendor.onboarding_data`; final step commits all fields and triggers enrichment job
- Enrichment auto-trigger: `vendors.ts` route patches status, calls `enqueueJob("vendor-enrich", ...)` when transitioning to `due_diligence` or `risk_assessment`
- Monitoring: `signal-feed-poller.ts` queries Shodan/NVD with `vendor.website_domain` as lookup key; creates `signals` rows with `source = "shodan"` / `source = "nvd"`, which flow through the existing triage pipeline unchanged
- Assessment Engine replaces `questionnaires`/`questionnaire_questions` tables for new vendor assessments (old tables kept for backwards compatibility)

**Existing code that stays unchanged:** `allowed-transitions.ts` (7-state lifecycle), `vendor-status-events.ts` schema, kanban pipeline route handlers.

---

### Compliance Flow

**What changes:**

| Area | Current | v2.0 |
|------|---------|-------|
| Framework creation | Manual CRUD only | Manual CRUD + bulk import from JSON/OSCAL/CSV |
| Control assessment | Basic `control_tests` records | Assessment Engine sessions per control |
| Compliance thresholds | Posture % only (computed) | Configurable pass/fail thresholds per framework + alerts |

**Schema changes:**

```
-- frameworks table: add columns
import_source text,            -- manual | oscal | json | csv
import_reference text,         -- original file name or URL
compliance_threshold numeric,  -- 0-100, creates alert when posture drops below

-- Reuse existing alerts table with alert_type = "compliance_threshold"
-- Add to alertTypeEnum or use metadata jsonb field on alerts table
```

**Integration points:**
- Framework importer: new `POST /api/v1/frameworks/import` endpoint; `framework-importer.ts` parses structure and bulk-inserts `framework_requirements` and stub `controls` in a single Drizzle transaction
- Threshold monitoring: `monitoring.ts` gains a compliance posture check alongside existing KRI checks; when posture drops below `compliance_threshold`, creates an `alerts` row (reusing existing alerts infrastructure)
- Assessment Engine usage: `POST /api/v1/assessments` with `type = "compliance"` and `subject_id = control_id`; on completion, creates a `control_test` record and updates control status

---

### Signal Integrations

**Architecture pattern:** All external signals funnel into the **existing** `signals` table via the **existing** triage pipeline. The signal feed poller is purely an ingestion adapter layer. No changes to the core Signal → Finding → Risk chain.

**New scheduler: `signal-feed-poller.ts`**

```
startSignalFeedPoller()
  ├── runs on configurable interval (per integration)
  ├── reads integration_configs (active integrations per tenant)
  ├── for each active integration:
  │     adapter = getAdapter(integration.type)   // shodan|nvd|misp|sentinel|email
  │     rawItems = await adapter.fetch(integration.config, lastPolledAt)
  │     signals = rawItems.map(toSignal)
  │     bulk-insert into signals WHERE NOT EXISTS (dedup by content hash)
  │     update integration_configs.last_polled_at
  │     enqueue ai-triage job for each new signal
  └── logs errors per-integration without killing other feeds
```

**New table:**

```
integration_configs
  id, tenant_id,
  type text,                 -- shodan | nvd | misp | sentinel | email
  name text,
  encrypted_config text,     -- AES-256-GCM (reuse existing encryption.ts)
  is_active boolean,
  poll_interval_minutes int,
  last_polled_at timestamp,
  last_error text,
  created_at, updated_at
```

**Deduplication strategy:** Add `content_hash text` column to `signals` table. Hash `SHA256(content)` before insert; skip if `(tenant_id, source, content_hash)` already exists. Prevents re-ingesting the same CVE or Shodan host record on subsequent polls.

**Per-adapter integration points:**

| Feed | Auth | Data Shape → Signal Mapping | Rate Limits |
|------|------|----------------------------|-------------|
| Shodan | API key (encrypted) | host data → `source: "shodan"`, `content: JSON.stringify(host)` | 1 req/sec free tier; paid removes limit |
| NVD CVE API 2.0 | Optional API key | CVE items → `source: "nvd"`, content = CVE description + CVSS score | 5 req/30s no key; 50 req/30s with key |
| MISP | API key + instance URL | events/attributes → `source: "misp"`, content = event info | No hard limit; instance-dependent |
| Microsoft Sentinel | Azure OAuth2 client credentials | SecurityIncident → `source: "sentinel"`, content = incident details | Azure rate limits; use continuation tokens for pagination |
| Email (IMAP) | IMAP host/user/password | message body → `source: "email"`, content = parsed text | Poll interval configurable; IDLE command preferred |

**Email ingestion specifics:** Use `imapflow` npm package (modern, supports IDLE, actively maintained in 2025). IDLE avoids constant polling overhead. IMAP credentials stored in `integration_configs.encrypted_config` using existing `encryption.ts`.

**Sentinel specifics:** Requires Azure OAuth2 client credentials flow. Store Azure `tenantId`, `clientId`, `clientSecret` encrypted in `integration_configs`. API endpoint: `https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.OperationalInsights/workspaces/{ws}/providers/Microsoft.SecurityInsights/incidents`. This is the most complex integration; requires an Azure app registration by the customer before configuration.

---

### Foresight v2

**What changes:** Replace the stub `foresight.ts` (currently returns 501 for all routes) with a full implementation.

**New tables:**

```
foresight_scenarios
  id, tenant_id,
  name text,
  description text,
  risk_ids uuid[],           -- which risks to include in the simulation
  threat_factors jsonb,      -- custom probability adjustments per risk
  created_at, updated_at

foresight_simulations
  id, tenant_id, scenario_id uuid → foresight_scenarios.id,
  status text,               -- queued | running | completed | failed
  iterations int default 10000,
  results jsonb,             -- percentile buckets: p5, p25, p50, p75, p95, histogram
  osint_snapshot jsonb,      -- cached signal data used in this run
  duration_ms int,
  error text,
  created_at, completed_at
```

**Monte Carlo runner architecture:**

```
POST /api/v1/foresight/simulations
  → validate scenario exists + belongs to tenant
  → create foresight_simulations row (status: queued)
  → enqueueJob("monte-carlo", "run", { simulationId })
  → return 202 Accepted with simulationId

Job worker: "monte-carlo" queue
  → load risks from scenario.risk_ids
  → query recent signals from signals table for risks in scope (OSINT snapshot)
  → build probability distributions per risk (likelihood × impact with uncertainty)
  → run N iterations: for each, sample from distributions, compute portfolio impact
  → aggregate results into percentile buckets
  → update foresight_simulations: status = completed, results = { p5, p25, p50, p75, p95 }
```

**OSINT data feeds for Foresight:** Reuse signal data already in the `signals` table (populated by `signal-feed-poller.ts`). Foresight simulation queries recent signals linked to simulation risks rather than calling external APIs inline. This avoids rate limit issues during simulation runs and keeps results deterministic from a snapshot.

**Monte Carlo implementation:** Pure TypeScript, no native dependencies. 10k iterations on 10-20 risks runs in ~200ms in Node.js — no worker threads required at this scale. Use a seeded PRNG for reproducible runs (`seedrandom` npm package or a simple LCG implementation). If scenarios grow to 100+ risks with complex correlation matrices, move simulation math to `worker_threads`.

---

## Data Flow Changes

### New: Assessment Session Flow

```
Client starts assessment session
        │
        ▼
POST /api/v1/assessments/:id/sessions
  → Creates assessment_sessions row (status: active)
        │
        ▼
GET /api/v1/assessments/sessions/:id/next-question
  → Assessment Engine: LLM generates next question (task: "assessment")
  → Fallback: static question from template_config if LLM unavailable
        │
        ▼
Client submits answer
        │
POST /api/v1/assessments/sessions/:id/responses
  → Stores response in assessment_responses
  → Enqueues score_assessment_response job
        │
        ▼
Async: Job worker scores answer via AI
  → updates assessment_responses.ai_score + ai_rationale
        │
        ▼
On session commit:
  → aggregate scores → write to parent entity
  → vendor.risk_score updated (triggers monitoring re-evaluation)
  → OR control.status updated + control_test record created
```

### New: Signal Feed Ingestion Flow

```
Signal Feed Poller (scheduled background, same process)
  → reads active integration_configs per tenant
  → calls external API adapter
  → deduplicates via content_hash
        │
        ▼
signals table INSERT
  source: "shodan" | "nvd" | "misp" | "sentinel" | "email"
        │
        ▼
enqueueJob("ai-triage", "classify", { signalId })
        │
        ▼ [EXISTING PIPELINE — NO CHANGES]
AI Triage Worker → signal.status = "triaged"
        │
        ▼
Manual or automated promotion to Finding
        │
        ▼
Finding → Risk linkage via risk_sources table
```

### New: Foresight Simulation Flow

```
User configures scenario (risk IDs + threat factor adjustments)
        │
        ▼
POST /api/v1/foresight/simulations → 202 Accepted + simulationId
        │
        ▼
Job Queue: "monte-carlo" worker
  1. Load risks from scenario.risk_ids
  2. Query recent signals for these risks (OSINT snapshot)
  3. Build probability distributions per risk
  4. Run 10k iterations (sample, compute portfolio impact)
  5. Compute percentile buckets: p5, p25, p50, p75, p95
        │
        ▼
foresight_simulations.status = "completed"
foresight_simulations.results = { percentiles, histogram }
        │
        ▼
GET /api/v1/foresight/simulations/:id
  (client polls until status = completed)
```

---

## Architectural Patterns

### Pattern 1: Existing Job Queue as Universal Async Bus

**What:** Every new background operation (assessment scoring, signal ingestion, Monte Carlo, vendor enrichment) routes through the existing `job-queue.ts`. No new messaging infrastructure needed.

**When to use:** Any operation that: (a) takes >200ms, (b) involves an LLM, (c) calls external APIs, or (d) should survive process restarts.

**Trade-offs:** Simple, proven, tenant-scoped. Limitation: single-process, no horizontal scaling. Acceptable for the current single PM2 instance deployment.

```typescript
// Adding a new job type: just register a handler in ai-workers.ts at boot
registerWorker("monte-carlo", async (job) => {
  const { simulationId } = job.payload as { simulationId: string };
  // ... simulation logic
});
```

### Pattern 2: Adapter Pattern for Signal Feeds

**What:** Each external signal source is an adapter implementing a common interface. The poller calls the interface; the concrete class handles auth, pagination, and data mapping.

**When to use:** When integrating N external APIs with different auth/data shapes that all produce the same output type.

```typescript
interface SignalFeedAdapter {
  type: string;
  fetch(config: IntegrationConfig, since: Date): Promise<RawSignal[]>;
}

const adapters: Record<string, SignalFeedAdapter> = {
  shodan: new ShodanAdapter(),
  nvd: new NVDAdapter(),
  misp: new MISPAdapter(),
  sentinel: new SentinelAdapter(),
  email: new EmailAdapter(),
};
```

### Pattern 3: Assessment Engine as Shared Service (Not Microservice)

**What:** Assessment Engine is a TypeScript class within the API server, not a separate service. Both vendor and compliance routes import it directly.

**When to use:** When two features share identical business logic but different subjects (vendor vs. control). Avoids copy-paste, avoids over-engineering into microservices.

**Trade-offs:** Zero network overhead, single deployment. Tight coupling within the monolith — acceptable at this scale.

### Pattern 4: Encryption Reuse for Integration Credentials

**What:** Reuse existing `encryption.ts` (AES-256-GCM) for `integration_configs.encrypted_config`. Integration credentials stored identically to how LLM API keys are stored.

**When to use:** Always. Consistent encryption approach, single key management concern (`ENCRYPTION_KEY` env var). No new secrets management infrastructure needed.

---

## Integration Points

### New Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Assessment Engine ↔ LLM Service | Direct call: `complete(tenantId, ..., "assessment")` | Adds `"assessment"` to `LLMTaskType` union |
| Signal Feed Poller ↔ Job Queue | `enqueueJob("ai-triage", ...)` per new signal | Existing queue, no structural change |
| Signal Feed Poller ↔ Integration Configs | DB read on scheduler tick | Reads `integration_configs` to find active feeds per tenant |
| Monte Carlo Runner ↔ Job Queue | Registered as `"monte-carlo"` queue worker | New queue name, same `registerWorker` pattern |
| Monte Carlo Runner ↔ signals table | DB read for OSINT snapshot | Queries existing signals by tenant + source + recency |
| Vendor Enrichment ↔ Assessment Engine | Vendor route triggers assessment session creation | Route-level coordination, no circular deps |
| Compliance Monitoring ↔ Monitoring Scheduler | New check added to existing scheduler loop | Reuses existing alerts table |
| Framework Importer ↔ DB | Bulk insert via Drizzle transaction | New service, existing ORM, existing tables |

### External Service Integration Points

| Service | Auth Method | Credential Storage | Notes |
|---------|------------|-------------------|-------|
| Shodan API | API key per tenant | `integration_configs.encrypted_config` | REST: `api.shodan.io`; 1 req/sec free tier |
| NVD CVE API 2.0 | Optional API key | `integration_configs.encrypted_config` | `services.nvd.nist.gov`; 50 req/30s with key |
| MISP | API key + instance URL | `integration_configs.encrypted_config` | Customer-hosted; URL varies per tenant |
| Microsoft Sentinel | Azure OAuth2 client credentials | `integration_configs.encrypted_config` | Requires Azure app registration by customer |
| Email IMAP | IMAP host/user/password | `integration_configs.encrypted_config` | Use `imapflow` npm package; supports IDLE |

### OpenAPI and Orval Touch Points

All new endpoints must be added to `lib/api-spec/openapi.yaml` before running Orval to regenerate `lib/api-client-react/` and `lib/api-zod/`. This is the **mandatory last step** of any backend route addition.

New API surface required:

```
# Assessment Engine
POST   /api/v1/assessments
GET    /api/v1/assessments
GET    /api/v1/assessments/:id
POST   /api/v1/assessments/:id/sessions
GET    /api/v1/assessments/sessions/:id
POST   /api/v1/assessments/sessions/:id/responses
POST   /api/v1/assessments/sessions/:id/commit
GET    /api/v1/assessments/sessions/:id/report

# Integration Configs
GET    /api/v1/integrations
POST   /api/v1/integrations
PATCH  /api/v1/integrations/:id
DELETE /api/v1/integrations/:id
POST   /api/v1/integrations/:id/test        -- verify credentials
POST   /api/v1/integrations/:id/trigger     -- manual poll

# Foresight (replaces stub)
GET    /api/v1/foresight/scenarios
POST   /api/v1/foresight/scenarios
GET    /api/v1/foresight/scenarios/:id
PATCH  /api/v1/foresight/scenarios/:id
DELETE /api/v1/foresight/scenarios/:id
POST   /api/v1/foresight/simulations
GET    /api/v1/foresight/simulations/:id

# Vendor additions
POST   /api/v1/vendors/:id/assessments      -- trigger assessment session
GET    /api/v1/vendors/:id/fourth-party     -- list subvendors
POST   /api/v1/vendors/:id/fourth-party     -- link subvendor

# Framework additions
POST   /api/v1/frameworks/import            -- bulk import
PATCH  /api/v1/frameworks/:id/threshold     -- set compliance threshold
```

---

## Recommended Build Order

Dependencies determine order. Each item unlocks the next.

### Stage 1: Schema Foundation (unblocks everything)

Add all new Drizzle table files to `lib/db/src/schema/`. Export from `index.ts`. Run `drizzle-kit push`. No routes yet.

Tables to add:
1. `assessments` + `assessment_sessions` + `assessment_responses` (only existing-table foreign deps)
2. `integration_configs` (standalone)
3. `foresight_scenarios` + `foresight_simulations` (depends on `risks`)
4. `vendor_fourth_party_links` (depends on `vendors`)

Column additions:
- `vendors`: `website_domain`, `enrichment_status`, `last_enriched_at`, `onboarding_step`, `onboarding_data`
- `frameworks`: `compliance_threshold`, `import_source`, `import_reference`
- `signals`: `content_hash` (for deduplication)

### Stage 2: Assessment Engine (unblocks Vendor + Compliance)

Build `assessment-engine.ts` service + `assessments.ts` route + OpenAPI spec entries. Register `"assessment"` task type in `llm-service.ts`. Register `score_assessment_response` job worker in `ai-workers.ts`. Run Orval to regenerate clients.

Deliverable: Standalone assessment API that vendor and compliance routes can call.

### Stage 3: Vendor Lifecycle Redesign (depends on Stage 2)

- Update `vendors.ts` route: onboarding_data endpoints, 4th party endpoints, enrichment auto-trigger on status transitions
- Build `vendor-enrichment.ts` service: queries signals already in DB for this vendor's domain, synthesizes enrichment
- Wire Assessment Engine into vendor flow: `POST /api/v1/vendors/:id/assessments`
- Frontend: wizard UX, monitoring dashboard, 4th party panel

### Stage 4: Signal Integrations (depends on Stage 1 only — no other stage deps)

- Build `integration-config.ts` (encrypted credential CRUD)
- Build `signal-feed-poller.ts` with all 5 adapter implementations
- Register `startSignalFeedPoller()` in `index.ts` alongside existing schedulers
- Build `integrations.ts` route
- Build `email-ingestion.ts` (IMAP + IDLE)
- OpenAPI spec additions + Orval regeneration

### Stage 5: Compliance Flow (depends on Stage 2)

- Build `framework-importer.ts` (OSCAL/JSON/CSV parser, bulk insert)
- Add `POST /api/v1/frameworks/import` endpoint to `compliance.ts` route
- Add compliance threshold check to `monitoring.ts` scheduler
- Wire Assessment Engine into control assessment flow
- Frontend: import UI, threshold configuration, assessment session UI

### Stage 6: Foresight v2 (depends on Stage 4 for OSINT signal data)

- Build `monte-carlo.ts` simulation engine (pure TS, seeded PRNG, percentile aggregation)
- Register `"monte-carlo"` job worker in `ai-workers.ts`
- Replace stub `foresight.ts` with full scenario + simulation implementation
- OpenAPI spec + Orval regeneration
- Frontend: scenario builder, simulation polling UI, percentile visualization

---

## Anti-Patterns

### Anti-Pattern 1: Calling External APIs Synchronously in Route Handlers

**What people do:** Place Shodan/NVD HTTP calls directly inside Express route handlers.

**Why it's wrong:** External APIs have unpredictable latency (100-2000ms), hard rate limits, and failure modes. Synchronous calls block the event loop and cause cascading request timeouts.

**Do this instead:** Route handlers only enqueue jobs or trigger the background poller. All external API calls run in the job queue workers or the signal feed poller.

### Anti-Pattern 2: Creating a New Database Pool for New Features

**What people do:** Instantiate a new `pg.Pool` or `drizzle()` instance inside a new service file.

**Why it's wrong:** PostgreSQL default max connections is 100. Multiple pools waste connections. The existing `@workspace/db` export already provides a configured pool.

**Do this instead:** Import `{ db }` from `@workspace/db`. New tables only need schema files in `lib/db/src/schema/` exported from `index.ts`.

### Anti-Pattern 3: Storing External API Credentials in Environment Variables

**What people do:** Add `SHODAN_API_KEY`, `MISP_API_KEY` etc. to `.env`.

**Why it's wrong:** RiskMind is multi-tenant. Each tenant may have different Shodan API keys, different MISP instance URLs. Global env vars cannot handle per-tenant configuration.

**Do this instead:** Store in `integration_configs.encrypted_config` using existing `encryption.ts` — same pattern as `llm_configs.encrypted_api_key`. Per-tenant, per-integration, encrypted at rest.

### Anti-Pattern 4: Duplicating the Questionnaire System for Assessments

**What people do:** Create separate tables and routes for compliance assessments with a second static JSON template model.

**Why it's wrong:** Missing the AI-driven, non-deterministic nature of the feature requirement. Doubles maintenance surface. The existing `questionnaires` pattern is static and does not support multi-turn AI scoring.

**Do this instead:** Build the Assessment Engine once. Route both vendor assessments and compliance control assessments through it. Keep `questionnaires` table only for historical data.

### Anti-Pattern 5: Running Monte Carlo Inline on the HTTP Request

**What people do:** Run 10k iterations synchronously when `POST /foresight/simulations` is called, return results in the response body.

**Why it's wrong:** Even at 200ms, this blocks the Node.js event loop. Multiple concurrent requests saturate the server. Users experience timeouts on large scenarios.

**Do this instead:** Return 202 Accepted with a `simulationId`. Run simulation in job queue worker. Client polls `GET /foresight/simulations/:id`. This is the established pattern already used for AI enrichment in the codebase.

### Anti-Pattern 6: Bypassing the Signal → Finding → Risk Pipeline for New Signal Sources

**What people do:** Create direct Shodan → Risk or NVD → Finding shortcuts to "simplify" new integrations.

**Why it's wrong:** Destroys the Signal → Finding → Risk traceability chain that is a core architectural invariant. Breaks provenance tracking. Undermines the existing triage/confidence filtering that prevents noise from becoming risks.

**Do this instead:** All external signal sources write to the `signals` table. The existing triage pipeline handles promotion to findings and risks.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (1-10 tenants) | All background work in same PM2 process; 15-60 minute polling intervals are fine |
| 10-100 tenants | Signal feed poller may hit external rate limits if all tenants share one IP; stagger per-tenant polling windows with jitter |
| 100+ tenants | Extract signal feed poller and Monte Carlo runner to separate PM2 processes; consider pg-boss or BullMQ for job queue to support multiple workers |

**First bottleneck:** Signal feed poller with many active tenants polling the same external APIs from the same IP address. Mitigation: per-adapter rate limiter + jittered polling start times per tenant.

**Second bottleneck:** Monte Carlo simulations if many tenants run large scenarios simultaneously — CPU saturation on single process. Mitigation: `worker_threads` for simulation math, job queue concurrency cap.

---

## Sources

- Codebase inspection: `artifacts/api-server/`, `lib/db/src/schema/`, `docs/ARCHITECTURE.md` — HIGH confidence
- Shodan REST API: [https://developer.shodan.io/api](https://developer.shodan.io/api) — MEDIUM confidence (official docs, REST patterns stable)
- NVD CVE API 2.0: [https://nvd.nist.gov/developers/vulnerabilities](https://nvd.nist.gov/developers/vulnerabilities) — HIGH confidence (official NIST docs)
- Microsoft Sentinel REST API: [https://learn.microsoft.com/en-us/rest/api/securityinsights/](https://learn.microsoft.com/en-us/rest/api/securityinsights/) — HIGH confidence (official Microsoft docs, 2025-09-01 API version confirmed current)
- MISP REST API: [https://www.misp-project.org/features/](https://www.misp-project.org/features/) — HIGH confidence (official MISP docs)
- ImapFlow: [https://blog.nodemailer.com/](https://blog.nodemailer.com/) — MEDIUM confidence (actively maintained, modern IMAP library for Node.js 2025)
- Monte Carlo in Node.js: training data + WebSearch — MEDIUM confidence (pure JS is viable at 10k iterations / ~20 risks)

---

*Architecture research for: RiskMind v2.0 — Assessment Engine, Vendor Lifecycle, Compliance Flow, Signal Integrations, Foresight v2*
*Researched: 2026-03-23*
