# RiskMind System Architecture

**Version:** 1.1
**Last Updated:** 2026-03-19
**Status:** Production

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Component Boundaries and Responsibilities](#component-boundaries-and-responsibilities)
4. [Monorepo Structure](#monorepo-structure)
5. [Data Flow: Request Lifecycle](#data-flow-request-lifecycle)
6. [AI Pipeline](#ai-pipeline)
7. [LLM Routing Architecture](#llm-routing-architecture)
8. [Build Pipeline](#build-pipeline)
9. [Deployment Topology](#deployment-topology)
10. [Database Schema Overview](#database-schema-overview)
11. [Background Processing](#background-processing)
12. [Multi-Tenancy Architecture](#multi-tenancy-architecture)

---

## System Overview

RiskMind is an AI-native, multi-tenant enterprise risk management platform. It is implemented as a TypeScript monorepo using pnpm workspaces. A single Express 5 process serves both the REST API and the compiled React SPA from port 4000. All public traffic is routed through a Cloudflare tunnel to `https://app.riskmind.net`.

The platform provides risk registers, third-party risk management (TPRM), compliance framework tracking, AI-driven signal triage, an autonomous risk intelligence agent, and a command palette with pgvector-backed semantic search.

---

## High-Level Architecture

```
                          Internet
                             |
                    ┌────────▼────────┐
                    │  Cloudflare CDN  │
                    │  (SSL/TLS, DDoS) │
                    │  app.riskmind.net│
                    └────────┬────────┘
                             │ HTTPS
                    ┌────────▼────────┐
                    │   cloudflared   │
                    │  (Tunnel Agent) │
                    │  systemd svc    │
                    └────────┬────────┘
                             │ HTTP → localhost:4000
                    ┌────────▼────────────────────────┐
                    │          PM2 Process             │
                    │  name: riskmind                  │
                    │  script: dist/index.cjs          │
                    │  node_args: --env-file .env      │
                    └────────┬────────────────────────┘
                             │
            ┌────────────────▼────────────────────┐
            │          Express 5 Application       │
            │               port 4000              │
            │                                      │
            │   ┌──────────────┐  ┌─────────────┐ │
            │   │  REST API    │  │  React SPA  │ │
            │   │  /api/v1/*   │  │  /          │ │
            │   └──────┬───────┘  └─────────────┘ │
            │          │          (static files)    │
            │   ┌──────▼───────┐                   │
            │   │  /mcp        │                   │
            │   │  (MCP HTTP)  │                   │
            │   └──────────────┘                   │
            └────────────┬────────────────────────┘
                         │
            ┌────────────▼────────────────────────┐
            │       Drizzle ORM (PostgreSQL)       │
            └────────────┬────────────────────────┘
                         │
            ┌────────────▼────────────────────────┐
            │   PostgreSQL 16 + pgvector           │
            │   (local Unix socket)                │
            └─────────────────────────────────────┘

            Background Subsystems (same process):
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │  Job Queue   │ │  Monitoring  │ │    Agent     │
            │  Processor   │ │  Scheduler   │ │  Scheduler   │
            └──────────────┘ └──────────────┘ └──────────────┘

            External AI Providers (outbound only):
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │   OpenAI /   │ │  Anthropic   │ │  Ollama /    │
            │   Compatible │ │     API      │ │  Private LLM │
            └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Component Boundaries and Responsibilities

### Express Application (`artifacts/api-server`)

| Layer | Location | Responsibility |
|---|---|---|
| Entry point | `src/index.ts` | Env validation, extension check, seed, subsystem boot, listen |
| App setup | `src/app.ts` | CORS, body parsing, route mounting, error handler, SPA fallback |
| Routes | `src/routes/` | HTTP method + path registration per domain |
| Middlewares | `src/middlewares/` | Auth (JWT verification), RBAC (role checking) |
| Services / lib | `src/lib/` | Business logic: JWT, encryption, LLM service, job queue, agent |
| MCP handler | `src/mcp/handler.ts` | Model Context Protocol Streamable HTTP endpoint |

### React SPA (`artifacts/riskmind-app`)

| Layer | Location | Responsibility |
|---|---|---|
| Pages | `src/pages/` | Route-level components: dashboard, risks, vendors, compliance, etc. |
| Components | `src/components/` | Shared UI: command palette, data tables, forms, provenance badges |
| Hooks | `src/hooks/` | Data-fetching hooks (wrapping Orval-generated queries) |
| API client | `lib/api-client-react/` | Orval-generated React Query hooks — do not edit manually |

### Database (`lib/db`)

| Area | Responsibility |
|---|---|
| Schema | Drizzle table definitions for all 30+ domain tables |
| Migrations | Managed via `drizzle-kit push` (schema-push workflow, not versioned migration files) |
| Extensions | `pgvector` for 1536-dimensional embeddings; initialized via `ensureExtensions()` on boot |

### Shared Libraries

| Package | Path | Purpose |
|---|---|---|
| `@workspace/db` | `lib/db` | Drizzle schema, db client, Zod types |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI 3.1.0 YAML — source of truth for API contract |
| `@workspace/api-zod` | `lib/api-zod` | Orval-generated Zod schemas — do not edit |
| `@workspace/api-client-react` | `lib/api-client-react` | Orval-generated React Query hooks — do not edit |

---

## Monorepo Structure

```
RiskMind2/
├── artifacts/
│   ├── api-server/          # Express 5 backend
│   │   ├── src/
│   │   │   ├── app.ts       # Express app (CORS, middleware, routing)
│   │   │   ├── index.ts     # Server entry (env check, boot sequence)
│   │   │   ├── routes/      # One file per domain
│   │   │   ├── middlewares/ # auth.ts, rbac.ts
│   │   │   ├── lib/         # jwt, encryption, llm-service, job-queue, etc.
│   │   │   └── mcp/         # MCP protocol handler
│   │   ├── build.ts         # esbuild bundler script
│   │   └── dist/            # Compiled output (index.cjs)
│   │
│   └── riskmind-app/        # React 19 + Vite 7 SPA
│       ├── src/
│       │   ├── pages/       # Route pages
│       │   ├── components/  # Shared UI components
│       │   ├── hooks/       # Custom React hooks
│       │   └── lib/         # Client utilities
│       └── dist/public/     # Vite build output (served by Express)
│
├── lib/
│   ├── api-spec/            # openapi.yaml — API contract
│   ├── api-zod/             # [GENERATED] Zod schemas from OpenAPI
│   ├── api-client-react/    # [GENERATED] React Query hooks from OpenAPI
│   └── db/                  # Drizzle ORM schema + client
│       └── src/schema/      # One file per domain table
│
├── ecosystem.config.cjs     # PM2 process configuration
├── pnpm-workspace.yaml      # Workspace package declarations
├── tsconfig.base.json       # Shared TypeScript base config
└── .env                     # Environment variables (not committed)
```

---

## Data Flow: Request Lifecycle

### Standard Authenticated API Request

```
Browser / API Client
        │
        │  HTTP request with Bearer token
        ▼
┌──────────────────────────────────────────┐
│  CORS Middleware                          │
│  Checks origin against ALLOWED_ORIGINS   │
│  [https://app.riskmind.net,              │
│   http://localhost:4000]                 │
└──────────────────┬───────────────────────┘
                   │ (origin approved)
                   ▼
┌──────────────────────────────────────────┐
│  express.json() body parser              │
│  limit: 10mb                             │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  authMiddleware                           │
│  1. Extract Bearer token from header     │
│  2. verifyAccessToken() → HMAC-SHA256    │
│  3. Attach req.user = { id, tenantId,   │
│     email, role }                        │
│  4. Reject with 401 if invalid/expired  │
└──────────────────┬───────────────────────┘
                   │ (token valid)
                   ▼
┌──────────────────────────────────────────┐
│  Domain Router (e.g., risksRouter)       │
│  Route handler matched by method + path  │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  requireRole() RBAC guard (if present)   │
│  Checks req.user.role ∈ allowed roles    │
│  Rejects with 403 if not authorized     │
└──────────────────┬───────────────────────┘
                   │ (role authorized)
                   ▼
┌──────────────────────────────────────────┐
│  Route Handler                           │
│  1. Zod schema validation on body/params │
│  2. db.select/insert/update/delete       │
│     WHERE tenant_id = req.user.tenantId  │
│  3. Build response payload               │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Drizzle ORM                             │
│  Generates parameterized SQL             │
│  Executes against PostgreSQL             │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  PostgreSQL 16 + pgvector                │
│  Returns rows                            │
└──────────────────┬───────────────────────┘
                   │
                   ▼
        JSON response to client
```

### Semantic Search Request (`POST /api/v1/search`)

```
Query string from ⌘K palette
        │
        ▼
  Embed query text via LLM embeddings provider
        │
        ▼
  pgvector cosine similarity search across:
  risks.embedding, vendors.embedding,
  signals.embedding, frameworks (future)
        │
        ▼
  Rank and merge results by similarity score
        │
        ▼
  Return ranked list to command palette
```

---

## AI Pipeline

### Signal → Triage → Finding → Risk Chain

```
External Source / Manual Submission
        │
        ▼
┌───────────────────┐
│  Signal Ingested  │  status: "pending"
│  (text content,   │  embedding: null initially
│   source label)   │
└────────┬──────────┘
         │
         │  AI Triage Job enqueued
         ▼
┌───────────────────────────────────┐
│  LLM Triage                       │
│  Task type: "triage"              │
│  Classifies signal severity,      │
│  category, confidence score       │
│  Generates vector embedding       │
└────────┬──────────────────────────┘
         │
         │  Signal status → "triaged" or "dismissed"
         │  High-confidence signals promoted to Finding
         ▼
┌───────────────────────────────────┐
│  Finding Created                  │  status: "open"
│  Links back to source signal_id   │
│  May link to vendor_id            │
└────────┬──────────────────────────┘
         │
         │  Risk escalation (manual or agent)
         ▼
┌───────────────────────────────────┐
│  Risk Created / Updated           │
│  Links to finding via             │
│  risk_sources table               │
│  source_type: "finding"           │
└───────────────────────────────────┘
         │
         │  AI Enrichment Job enqueued
         ▼
┌───────────────────────────────────┐
│  LLM Enrichment                   │
│  Task type: "enrichment"          │
│  Augments risk description        │
│  Generates treatment suggestions  │
│  Attaches provenance receipt      │
│  (model, timestamp, token count)  │
└───────────────────────────────────┘
```

### Autonomous Agent Pipeline

```
Agent Scheduler (cron interval)
        │
        ▼
┌──────────────────────────────────────┐
│  Agent Run Started                   │
│  agentRunsTable: status = "running"  │
│  policyTier: observe | advisory |    │
│              active                  │
└────────┬─────────────────────────────┘
         │
         ▼
Phase 1: Local Analysis (no LLM, persisted first)
┌──────────────────────────────────────┐
│  Cascade Chain Detection             │
│  Cluster Analysis (pgvector)         │
│  Predictive Signal Scoring           │
│  → agent_findings rows written       │
└────────┬─────────────────────────────┘
         │
         ▼
Phase 2: LLM Reasoning (optional, may fail)
┌──────────────────────────────────────┐
│  Task type: "agent"                  │
│  LLM synthesizes narrative summary   │
│  Anomaly detection reasoning         │
│  Cross-domain correlation            │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Run Completed                       │
│  status = "completed"                │
│  findingsCount = actual rows written │
│  (survives LLM errors — FIX-02)      │
└──────────────────────────────────────┘
```

---

## LLM Routing Architecture

### Routing Resolution Order

```
AI Operation called with (tenantId, taskType)
        │
        ▼
┌─────────────────────────────────────────────┐
│  Step 1: Task-Specific Routing Lookup        │
│                                             │
│  llm_task_routing WHERE                     │
│    tenant_id = tenantId                     │
│    AND task_type = taskType                 │
│                                             │
│  If found AND config.isActive:              │
│    use routing.modelOverride ?? config.model│
│    → Return resolved config                 │
└────────┬────────────────────────────────────┘
         │ (no task-specific route)
         ▼
┌─────────────────────────────────────────────┐
│  Step 2: Tenant Default Lookup               │
│                                             │
│  llm_configs WHERE                          │
│    tenant_id = tenantId                     │
│    AND is_default = true                    │
│    AND use_case = (embeddings|general)      │
│    AND is_active = true                     │
└────────┬────────────────────────────────────┘
         │ (no default found)
         ▼
┌─────────────────────────────────────────────┐
│  Step 3: Any Active Config Fallback          │
│                                             │
│  llm_configs WHERE                          │
│    tenant_id = tenantId                     │
│    AND use_case = ...                       │
│    AND is_active = true                     │
│  LIMIT 1                                    │
└────────┬────────────────────────────────────┘
         │ (none found)
         ▼
     Return null → operation skipped / error surfaced to user
```

### Task Type Routing Table

| Task Type | Purpose | Typical Model Characteristic |
|---|---|---|
| `enrichment` | Risk description augmentation | High quality, strong reasoning |
| `triage` | Signal classification | Fast, structured JSON output |
| `treatment` | Control/treatment suggestions | Balanced quality + speed |
| `embeddings` | Vector generation for semantic search | Embedding-capable only (`openai_compat`) |
| `agent` | Autonomous agent reasoning | Highest capability |
| `general` | Default / unclassified operations | Balanced |

### Provider Configuration

| Provider Type | SDK | Embedding Support | Key Storage |
|---|---|---|---|
| `openai_compat` | `openai` npm package | Yes | AES-256-GCM encrypted |
| `anthropic` | `@anthropic-ai/sdk` | No | AES-256-GCM encrypted |

API keys are encrypted at rest using AES-256-GCM (12-byte IV, 16-byte auth tag). The `ENCRYPTION_KEY` environment variable must be a base64-encoded 32-byte value. Rotating this key requires re-encrypting all stored `llm_configs.encrypted_api_key` rows.

---

## Build Pipeline

### API Server (esbuild)

```
TypeScript source (artifacts/api-server/src/)
        │
        │  pnpm build (in api-server package)
        ▼
build.ts (tsx script)
        │
        │  esbuild.build()
        │  - platform: node
        │  - format: cjs
        │  - target: node20
        │  - bundle: partial (allowlist of safe deps)
        │  - outfile: dist/index.cjs
        ▼
artifacts/api-server/dist/index.cjs
        │
        │  PM2 executes this file
        ▼
Running process on port 4000
```

Shared workspace libraries (`@workspace/db`, `@workspace/api-zod`) are compiled via `tsc --build` before the artifact build runs. The root `pnpm build` script runs `typecheck` then `pnpm -r --if-present run build` which executes workspace builds in dependency order.

### React SPA (Vite)

```
TypeScript + React source (artifacts/riskmind-app/src/)
        │
        │  pnpm build (in riskmind-app package)
        ▼
vite build --config vite.config.ts
        │
        │  - Bundles React 19 + all imports
        │  - Tailwind CSS v4 via PostCSS
        │  - Code splitting
        │  - Asset hashing
        │  - outDir: dist/public
        ▼
artifacts/riskmind-app/dist/public/
        │
        │  Express serves this directory via express.static()
        │  SPA fallback: any non-/api non-/mcp path → index.html
        ▼
Browser loads SPA from port 4000
```

### Code Generation (Orval)

```
lib/api-spec/openapi.yaml  (source of truth)
        │
        │  orval (run manually when spec changes)
        ▼
lib/api-zod/               [GENERATED — DO NOT EDIT]
  - Zod schemas for every request/response type
  - Used by api-server for runtime validation

lib/api-client-react/      [GENERATED — DO NOT EDIT]
  - React Query hooks for every endpoint
  - Used by riskmind-app for data fetching
```

---

## Deployment Topology

```
Ubuntu Linux Server
│
├── PostgreSQL 16 (system service, local socket)
│   └── Database: riskmind
│       └── Extensions: pgvector, uuid-ossp
│
├── cloudflared (systemd service: cloudflared-riskmind)
│   └── Tunnel: app.riskmind.net → localhost:4000
│
├── PM2 (process manager)
│   └── App: riskmind
│       └── script: artifacts/api-server/dist/index.cjs
│       └── node_args: --env-file /home/dante/RiskMind2/.env
│       └── max_memory_restart: 1G
│       └── error_file: ./logs/riskmind-error.log
│       └── out_file: ./logs/riskmind-out.log
│
└── pm2-logrotate (module)
    └── Rotates logs on size/time threshold
```

### Port and Path Summary

| Surface | Binding | Public URL |
|---|---|---|
| Express (API + SPA) | `0.0.0.0:4000` | `https://app.riskmind.net` |
| REST API | `/api/v1/*` | `https://app.riskmind.net/api/v1/*` |
| MCP endpoint | `/mcp` | `https://app.riskmind.net/mcp` |
| SPA | `/` (static fallback) | `https://app.riskmind.net/*` |
| Health check | `/api/v1/health` | — |

---

## Database Schema Overview

The database contains 30+ tables organized by domain. All tables include `tenant_id` for multi-tenancy and `created_at` / `updated_at` timestamps.

### Domain Table Map

| Domain | Tables |
|---|---|
| Identity | `tenants`, `users`, `audit_events` |
| Risk Register | `risks`, `risk_sources`, `treatments`, `treatment_events`, `acceptance_memoranda`, `kris`, `incidents`, `review_cycles` |
| TPRM | `vendors`, `vendor_status_events`, `questionnaires`, `questionnaire_questions`, `documents` |
| Compliance | `frameworks`, `framework_requirements`, `controls`, `control_requirement_maps`, `control_tests` |
| Signals & Intelligence | `signals`, `findings` |
| Alerts | `alerts` |
| AI / LLM | `llm_configs`, `llm_task_routing`, `llm_benchmark_results`, `jobs`, `interview_sessions` |
| Agent | `agent_runs`, `agent_findings`, `agent_config` |

### Vector Columns

The following tables carry 1536-dimensional `vector` columns for pgvector similarity search:

- `risks.embedding`
- `vendors.embedding`
- `signals.embedding`

These are populated by the embeddings job worker using the tenant's configured `embeddings` use-case LLM provider. If no embeddings provider is configured, semantic search degrades to lexical fallback.

---

## Background Processing

Three background subsystems are started on process boot alongside the HTTP listener:

### Job Queue Processor (`startJobProcessor`)

Polls the `jobs` table at a configured interval. Workers are registered per job type:

| Job Type | Worker | LLM Task Type |
|---|---|---|
| `enrich_risk` | AI enrichment worker | `enrichment` |
| `triage_signal` | Signal triage worker | `triage` |
| `embed_entity` | Embedding worker | `embeddings` |
| `summarize_document` | Document processor | `enrichment` |
| `generate_vendor_questions` | Vendor questionnaire AI | `general` |

### Monitoring Scheduler (`startMonitoringScheduler`)

Evaluates KRI thresholds on a schedule. Creates `alerts` records when thresholds are breached.

### Agent Scheduler (`startAgentScheduler`)

Runs the autonomous risk intelligence agent on a configured cadence. Executes in three policy tiers:

- `observe` — analyze and record findings, no automated actions
- `advisory` — findings surface in UI with recommendations
- `active` — agent may trigger enrichment jobs automatically

---

## Multi-Tenancy Architecture

All data access is scoped to the authenticated user's `tenantId`. This is enforced at the ORM layer — every query includes a `WHERE tenant_id = req.user.tenantId` clause. There is no shared cross-tenant data path.

### Isolation Guarantees

- JWT payload carries `tenantId`; the middleware attaches it to `req.user`
- Route handlers use `req.user.tenantId` exclusively — no tenant override from request body
- LLM configurations are per-tenant; API keys are per-tenant encrypted
- Agent runs, findings, and routing tables are all tenant-scoped
- Audit events record `tenant_id` for every mutation

### Tenant-Scoped Resources

| Resource | Isolation Mechanism |
|---|---|
| Risk data | `tenant_id` foreign key on all tables |
| LLM API keys | Stored encrypted, queried by `tenant_id` |
| Agent configuration | `agent_config.tenant_id` |
| Embeddings | Per-entity, queryable only within tenant context |
| Audit log | `audit_events.tenant_id` |
