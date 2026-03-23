# RiskMind

AI-native enterprise risk management platform with autonomous intelligence, semantic search, and multi-tenant RBAC.

**Live:** https://app.riskmind.net

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Overview

RiskMind is an enterprise risk management platform built for organizations that need more than a spreadsheet and less than a six-figure GRC suite. It covers the full risk lifecycle — identification, assessment, treatment, monitoring, and reporting — in a single coherent product, with AI woven into the workflow rather than bolted on as an afterthought.

The platform manages risk registers, key risk indicators, incidents, and treatment plans alongside a complete third-party risk management (TPRM) pipeline with a 7-state vendor lifecycle. Compliance teams track controls against frameworks including ISO 27001, SOC 2, and NIST CSF, with gap analysis and posture percentages updated in real time as controls are assessed.

What separates RiskMind from conventional GRC tools is the AI intelligence layer. Every risk can be enriched with AI-generated context, referenced threats, and treatment suggestions that carry full provenance receipts showing exactly which model produced the output and when. An autonomous risk intelligence agent monitors signals continuously, triages findings, and surfaces actionable intelligence without requiring manual curation. The ⌘K command palette combines conventional navigation with pgvector-powered semantic search, letting users find risks, vendors, and controls using natural language.

### Key Differentiators

- **AI-native architecture** — AI enrichment, interview-driven risk creation, and autonomous agent are first-class features, not integrations
- **Autonomous risk agent** — configurable policy tiers that monitor signals, cluster findings, and generate predictive intelligence continuously
- **Semantic search via pgvector** — ⌘K command palette performs vector similarity search across the entire risk corpus
- **MCP endpoint** — exposes platform data and actions to external AI agents via the Model Context Protocol
- **Multi-tenant isolation** — full data isolation per organization with tenant-scoped RBAC across 7 roles
- **Intelligent LLM routing** — per-task model assignment with multi-provider support, auto-discovery, and benchmarking

---

## Architecture

### Monorepo Structure

The repository is a pnpm workspace organized into `artifacts/` (deployable applications) and `lib/` (shared libraries).

```
RiskMind2/
├── artifacts/
│   ├── api-server/          Express 5 REST API and MCP endpoint
│   └── riskmind-app/        React 19 + Vite 7 single-page application
├── lib/
│   ├── db/                  Drizzle ORM schema, migrations, pgvector config
│   ├── api-spec/            OpenAPI specification (source of truth for codegen)
│   ├── api-client-react/    Generated React Query hooks (Orval — do not edit)
│   └── api-zod/             Generated Zod schemas (Orval — do not edit)
├── scripts/                 Seed data utilities and post-merge hooks
├── package.json             Workspace root — pnpm, TypeScript composite build
└── pnpm-workspace.yaml      Package catalog with pinned shared dependency versions
```

#### Package Descriptions

| Package | Path | Purpose |
|---------|------|---------|
| `@workspace/api-server` | `artifacts/api-server` | Express 5 REST API serving all platform resources plus the MCP endpoint. Compiles to `dist/` and runs under PM2 at port 4000. Also serves the compiled SPA in production. |
| `@workspace/riskmind-app` | `artifacts/riskmind-app` | React 19 + Vite 7 frontend. Single-page application with shadcn/ui components, Tailwind CSS v4, Recharts dashboards, and the ⌘K command palette. |
| `@workspace/db` | `lib/db` | Drizzle ORM schema definitions, pgvector extension bootstrap, and drizzle-kit configuration. Exposes all table types to the API server. |
| `@workspace/api-spec` | `lib/api-spec` | Hand-authored OpenAPI 3.1 specification. The canonical contract between frontend and backend. Drives code generation for both `api-client-react` and `api-zod`. |
| `@workspace/api-client-react` | `lib/api-client-react` | Orval-generated TanStack Query hooks for every API endpoint. Consumed by the frontend. Do not edit directly. |
| `@workspace/api-zod` | `lib/api-zod` | Orval-generated Zod v4 request and response schemas. Consumed by both frontend and server for runtime validation. Do not edit directly. |
| `scripts` | `scripts/` | Seed data scripts for frameworks (ISO 27001, SOC 2, NIST CSF), risks, vendors, and controls. Also contains the post-merge deployment hook. |

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.9 |
| Runtime | Node.js | 20+ |
| Package manager | pnpm | 9+ |
| API framework | Express | 5 |
| Frontend framework | React | 19.1 |
| Build tool | Vite | 7 |
| ORM | Drizzle ORM | 0.45+ |
| Database | PostgreSQL | 16+ |
| Vector extension | pgvector | latest |
| Validation | Zod | 3.25 |
| UI components | shadcn/ui + Radix UI | latest |
| Styling | Tailwind CSS | 4 |
| Data fetching | TanStack Query | 5 |
| Routing (frontend) | Wouter | 3 |
| Charts | Recharts | 2 |
| Animations | Framer Motion | 12 |
| Command palette | cmdk | 1 |
| AI (OpenAI-compat) | openai SDK | 6 |
| AI (Anthropic) | @anthropic-ai/sdk | 0.78+ |
| MCP | @modelcontextprotocol/sdk | 1.27+ |
| Code generation | Orval | 8 |
| Process manager | PM2 | 6 |

### Database Schema Overview

The schema is defined in `lib/db/src/schema/` using Drizzle ORM with pgvector support. All tables carry a `tenant_id` foreign key enforcing multi-tenant isolation at the data layer.

**Core identity**

| Table | Description |
|-------|-------------|
| `tenants` | Top-level organizational units. Each tenant is a fully isolated namespace. |
| `users` | Platform users with bcrypt-hashed passwords and role assignment. |
| `audit_events` | Immutable audit log of all mutations, scoped to tenant. |

**Risk management**

| Table | Description |
|-------|-------------|
| `risks` | Central risk register entries with likelihood, impact, owner, and AI-enriched description. Carries a pgvector embedding column for semantic search. |
| `treatments` | Mitigation plans linked to risks with status tracking. |
| `treatment_events` | Timestamped history of treatment state transitions. |
| `acceptance_memoranda` | Formal risk acceptance records with justification and expiry. |
| `kris` | Key Risk Indicators with threshold values and current readings. |
| `incidents` | Incident records linked to parent risks. |
| `review_cycles` | Scheduled and completed risk review records. |

**Third-party risk (TPRM)**

| Table | Description |
|-------|-------------|
| `vendors` | Vendor master records with risk tier and 7-state lifecycle status. |
| `vendor_status_events` | Audit trail of vendor lifecycle state transitions. |
| `questionnaires` | Security questionnaires assigned to vendors. |
| `questionnaire_questions` | Individual questions within questionnaires, supporting AI generation. |
| `documents` | Uploaded vendor documents pending analysis. |

**Compliance**

| Table | Description |
|-------|-------------|
| `frameworks` | Compliance framework definitions (ISO 27001, SOC 2, NIST CSF). |
| `framework_requirements` | Individual framework requirements (controls/clauses). |
| `controls` | Internal controls mapped to one or more framework requirements. |
| `control_requirement_maps` | Many-to-many mapping between controls and framework requirements. |
| `control_tests` | Test evidence records for individual controls. |

**AI and signals**

| Table | Description |
|-------|-------------|
| `signals` | External signals (threat intel, news, advisories) ingested for triage. |
| `findings` | AI-generated or human findings derived from signal analysis. |
| `alerts` | Active alerts requiring acknowledgment or resolution. |
| `jobs` | Background job queue for enrichment, embedding, and agent tasks. |
| `interview_sessions` | Conversational AI sessions for risk creation and control assessment. |
| `llm_configs` | Per-tenant LLM provider configurations with AES-256-GCM encrypted API keys. |
| `llm_task_routing` | Per-tenant routing table assigning models to specific task types. |
| `llm_benchmark_results` | Stored benchmark results (latency, throughput, quality) per model. |

---

## Features

### Risk Management

- **Risk register** — Create, update, and retire risks with likelihood/impact scoring, risk owner assignment, and category classification.
- **Risk heatmap** — Visual 5×5 likelihood-impact matrix with drill-down to individual risks per cell.
- **Key Risk Indicators (KRIs)** — Define threshold-based indicators linked to risks; dashboard bars show current vs. threshold values with breach highlighting.
- **Treatment management** — Full treatment plan lifecycle (proposed, in-progress, completed, accepted) with event history.
- **Risk acceptance** — Formal acceptance memoranda with justification, approver, and expiry date.
- **Review cycles** — Scheduled review tracking with overdue detection.
- **Incidents** — Incident records linked to parent risks for traceability.
- **CSV export** — Bulk export of the risk register with all fields for external reporting.
- **Risk trend sparklines** — Per-risk score trend visualization on the dashboard.

### Third-Party Risk Management (TPRM)

- **Vendor lifecycle** — Seven-state pipeline: Identified, Screening, Due Diligence, Contract Review, Active, Under Review, Offboarded.
- **Kanban pipeline view** — Drag-to-advance vendor pipeline with visual stage counts.
- **Risk-tiered routing** — Vendors classified as Critical, High, Medium, or Low risk, driving questionnaire depth and review frequency.
- **Questionnaires** — Assign security questionnaires to vendors with per-question tracking.
- **AI question generation** — Generate contextually relevant questionnaire questions based on vendor profile and risk tier using the configured LLM.
- **Vendor scorecard** — Computed scorecard drawing from assessment history, open findings, and lifecycle state.
- **Document management** — Upload and associate documents with vendor records.

### Compliance

- **Framework support** — ISO 27001:2022, SOC 2 Type II, and NIST Cybersecurity Framework included out of the box via seed data.
- **Controls library** — Internal controls with implementation status and owner assignment.
- **Control-to-requirement mapping** — Many-to-many mapping allows a single control to satisfy requirements across multiple frameworks.
- **Control testing** — Attach test evidence with pass/fail/not-tested status and tester identification.
- **Gap analysis** — Per-framework view of unmapped and failing controls.
- **Posture percentage** — Real-time compliance posture score per framework based on passing control tests.

### AI Intelligence

- **Risk enrichment** — AI-generated context, referenced threats, and impact analysis appended to risk records with full provenance: model ID, provider, timestamp, and input hash.
- **Treatment suggestions** — AI-generated treatment options with provenance receipts tied to the specific enrichment run.
- **AI interview sessions** — Conversational AI guides users through risk creation and control assessment, turning a dialogue into structured data.
- **Autonomous risk agent** — Configurable-tier agent that monitors the signal feed, clusters related findings, generates predictive intelligence, and surfaces actionable recommendations without manual curation.
- **Signal triage** — Ingested signals are automatically triaged by the AI against the existing risk register to identify relevance and create findings.
- **Signal-to-risk traceability** — Full chain from raw signal through AI finding to risk register entry.
- **Semantic search** — pgvector embeddings on risk records enable cosine-similarity search across the entire corpus, surfaced through the ⌘K command palette.
- **MCP endpoint** — Exposes platform resources and actions via the Model Context Protocol, allowing external AI agents and tools to interact with RiskMind programmatically.

### LLM Management

- **Multi-provider wizard** — Guided onboarding for seven provider types: OpenAI, Anthropic, Google Gemini, Mistral, Groq, Together AI, and Ollama/private endpoints.
- **Model auto-discovery** — Wizard connects to the provider API and fetches available models automatically (OpenAI: `/v1/models`; Anthropic: curated list; Ollama: `/api/tags`).
- **Benchmarking** — Connection test measures latency and tokens-per-second; quality score via standardized prompt. Results stored per model for comparison.
- **Intelligent per-task routing** — Six task types each have an independently assigned model: Risk Enrichment, Signal Triage, Treatment Suggestions, Embeddings, Agent Reasoning, and General. Routing table is user-configurable in Settings.
- **Encrypted key storage** — Provider API keys stored with AES-256-GCM encryption in the database; the encryption key never leaves the server environment.

### Platform

- **Multi-tenant architecture** — Organizations are fully isolated namespaces. All queries are tenant-scoped at the ORM layer; cross-tenant data leakage is structurally prevented.
- **RBAC with 7 roles** — `admin`, `risk_manager`, `risk_owner`, `risk_executive`, `auditor`, `viewer`, and `vendor` (portal access for external vendor contacts).
- **JWT authentication** — HMAC-SHA256 tokens: 1-hour access tokens, 7-day refresh tokens. Tenant context embedded in the token payload.
- **⌘K command palette** — Keyboard-first navigation combining quick links, recent items, and semantic vector search across risks, vendors, and controls.
- **Alert system** — Alerts generated from KRI breaches, agent findings, and signal matches. Supports acknowledgment and resolution workflows.
- **Skeleton loaders and empty states** — All list and detail pages show progressive loading states with contextual empty states for new tenants.
- **Toast notifications** — Non-blocking error and success feedback on all mutations.
- **Breadcrumbs** — Consistent breadcrumb navigation on all detail pages.
- **Responsive design** — Tailwind CSS v4 responsive layout; designed for desktop-first enterprise use with mobile compatibility.

---

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | LTS recommended |
| pnpm | 9+ | `npm install -g pnpm` |
| PostgreSQL | 16+ | Must be running locally or accessible via connection string |
| pgvector | latest | PostgreSQL extension; see install notes below |

#### Installing pgvector

On Ubuntu/Debian:
```bash
sudo apt install postgresql-16-pgvector
```

On macOS with Homebrew:
```bash
brew install pgvector
```

The database bootstrap script activates the extension automatically when you push the schema.

### Clone and Install

```bash
git clone <repository-url> RiskMind2
cd RiskMind2
pnpm install
```

### Database Setup

**1. Create the database**

```bash
psql -U postgres -c "CREATE DATABASE riskmind;"
```

**2. Configure the connection**

Copy the environment template and set your database URL:

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL
```

**3. Push the schema**

The push command bootstraps the pgvector extension then applies all table definitions:

```bash
pnpm --filter @workspace/db run push
```

**4. Seed reference data**

```bash
pnpm --filter scripts run seed
```

The seed script creates compliance frameworks (ISO 27001, SOC 2, NIST CSF), sample risks, vendors, and controls, and a default admin user for the demo tenant.

### Environment Variables

Create a `.env` file in the repository root. Required variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/riskmind` |
| `JWT_SECRET` | Secret for signing access tokens (min 32 chars) | `<random-64-char-hex>` |
| `REFRESH_TOKEN_SECRET` | Secret for signing refresh tokens (min 32 chars) | `<random-64-char-hex>` |
| `ENCRYPTION_KEY` | AES-256-GCM key for LLM API key encryption (64-char hex) | `<random-64-char-hex>` |
| `CORS_ORIGIN` | Allowed frontend origin for CORS | `https://app.riskmind.net` |
| `PORT` | Port the API server listens on | `4000` |
| `NODE_ENV` | Runtime environment | `production` |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Warning:** The `ENCRYPTION_KEY` cannot be rotated without re-encrypting all stored LLM provider API keys in the database. Set it once and store it securely.

### Build

```bash
pnpm build
```

This runs TypeScript composite type-checking across all packages, then builds the API server (esbuild) and the frontend (Vite). Output lands in `artifacts/api-server/dist/` and `artifacts/riskmind-app/dist/`.

### Run with PM2

```bash
pm2 start artifacts/api-server/dist/index.js \
  --name riskmind \
  --node-args="--env-file=.env"

pm2 save
```

Access the application at `http://localhost:4000`.

The API server serves the compiled React SPA from `artifacts/riskmind-app/dist/` at the root path, so a single port handles both the API and the frontend in production.

---

## API Reference

All API endpoints are prefixed with `/api`. The server distinguishes public routes (no authentication required) from protected routes (JWT Bearer token required).

### Endpoint Groups

| Router | Mount path | Description |
|--------|-----------|-------------|
| `health` | `GET /health` | Liveness check; returns server status and timestamp. |
| `auth` (public) | `/api/auth/*` | Login, token refresh. Tenant-aware login resolves the tenant from subdomain or request body. |
| `auth` (protected) | `/api/auth/*` | Logout, current user profile, password change. |
| `risks` | `/api/risks/*` | Risk register CRUD, KRIs, treatments, incidents, review cycles, acceptance memoranda, CSV export, enrichment trigger. |
| `vendors` | `/api/vendors/*` | Vendor CRUD, lifecycle transitions, questionnaires, AI question generation, scorecard. |
| `vendors` (public) | `/api/vendor-portal/*` | Vendor portal routes accessible with vendor-role tokens (external contacts). |
| `compliance` | `/api/compliance/*` | Frameworks, requirements, controls, control tests, gap analysis, posture scoring. |
| `signals` | `/api/signals/*` | Signal ingestion, listing, and status management. |
| `findings` | `/api/findings/*` | AI and human findings linked to signals and risks. |
| `alerts` | `/api/alerts/*` | Alert listing, acknowledgment, and resolution. |
| `ai-enrichment` | `/api/ai/*` | Enrichment job queue, job status, embedding operations. |
| `interviews` | `/api/interviews/*` | AI interview session creation and message exchange. |
| `agent` | `/api/agent/*` | Autonomous agent configuration, run history, and findings. |
| `search` | `/api/search/*` | Semantic vector search and global keyword search powering ⌘K. |
| `settings` | `/api/settings/*` | LLM provider configuration, model routing table, benchmark results, user management. |
| `foresight` | `/api/foresight/*` | Foresight module placeholder (v2). |
| `users` | `/api/users/*` | User CRUD and role assignment (admin only). |

### OpenAPI Specification

The full OpenAPI 3.1 specification is located at `lib/api-spec/`. It is the source of truth for all request/response shapes and drives automatic code generation for both the frontend client and Zod schemas.

### MCP Endpoint

RiskMind exposes a Model Context Protocol endpoint that allows external AI agents and tools (such as Claude Desktop or custom agents) to interact with the platform. The MCP server is integrated into the API server process and exposes platform resources and actions as MCP tools and resources. Refer to `artifacts/api-server/src/routes/agent.ts` for the endpoint configuration.

### Authentication

All protected endpoints require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Obtain tokens via `POST /api/auth/login` with `{ email, password, tenantSlug }`. The response contains `accessToken` (1-hour lifetime) and `refreshToken` (7-day lifetime). Use `POST /api/auth/refresh` to rotate tokens before expiry.

---

## Development

### Local Development Workflow

Run the API server and frontend development server concurrently in separate terminals:

```bash
# Terminal 1 — API server with hot reload via tsx
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Vite dev server with HMR
pnpm --filter @workspace/riskmind-app run dev
```

The Vite dev server proxies API requests to `localhost:4000`, so no CORS configuration is needed during development.

### Build Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Full monorepo build: typecheck all packages, then compile API server and frontend. |
| `pnpm typecheck` | TypeScript composite typecheck without emitting output. |
| `pnpm --filter @workspace/api-server run build` | Build only the API server (esbuild). |
| `pnpm --filter @workspace/riskmind-app run build` | Build only the frontend (Vite). |

### Code Generation (Orval)

The frontend client and Zod schemas are generated from the OpenAPI spec. After modifying `lib/api-spec/`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `lib/api-client-react/src/` and `lib/api-zod/src/`. Do not edit these directories manually — changes will be overwritten on the next codegen run.

### Database Management

| Command | Description |
|---------|-------------|
| `pnpm --filter @workspace/db run push` | Bootstrap pgvector extension and push schema to the database (no migration files generated). |
| `pnpm --filter @workspace/db run push-force` | Force push with conflict resolution (`--force` flag). Use with caution on shared databases. |
| `pnpm --filter scripts run seed` | Populate the database with seed data (frameworks, sample risks, vendors, demo user). |

### Project Conventions

**Generated code policy** — `lib/api-client-react/` and `lib/api-zod/` are fully managed by Orval. Never edit these packages directly. If generated output is incorrect, fix the OpenAPI spec and regenerate.

**TypeScript composite projects** — The monorepo uses TypeScript project references. Each package has a `tsconfig.json` with `composite: true`. The root `pnpm build` runs `tsc --build` which resolves the dependency graph automatically.

**Single port in production** — The Express server serves the compiled Vite output at `/` for all non-API routes (SPA fallback). Development uses separate ports with Vite proxy.

**Tenant scoping** — All database queries in the API server must include `tenantId` from the authenticated request context. The Drizzle ORM schema enforces tenant columns, but query-level scoping is the responsibility of each route handler.

**LLM provider abstraction** — The AI enrichment layer supports OpenAI-compatible providers (OpenAI, Ollama, Groq, Together AI, Mistral, Google Gemini via OpenAI-compat shim) and the Anthropic SDK as a separate code path. Embeddings are only available through OpenAI-compatible providers.

---

## Deployment

### Server Deployment with PM2

RiskMind runs as a single Node.js process under PM2 on a dedicated Linux server.

```bash
# Build the monorepo
pnpm build

# Start with PM2, loading environment from .env
pm2 start artifacts/api-server/dist/index.js \
  --name riskmind \
  --node-args="--env-file=.env"

# Persist across reboots
pm2 startup
pm2 save
```

> **PM2 env_file note:** PM2 6.x has a known issue with the `env_file` ecosystem config option. Use Node's native `--env-file` flag via `--node-args` as shown above.

### Cloudflare Tunnel

Production traffic is routed through a Cloudflare Tunnel, providing zero-config HTTPS without opening inbound firewall ports.

```bash
# Install cloudflared (Ubuntu)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Authenticate and create tunnel
cloudflared tunnel login
cloudflared tunnel create riskmind

# Configure tunnel (~/.cloudflared/config.yml)
# tunnel: <tunnel-id>
# credentials-file: /home/<user>/.cloudflared/<tunnel-id>.json
# ingress:
#   - hostname: app.riskmind.net
#     service: http://localhost:4000
#   - service: http_status:404

# Route DNS
cloudflared tunnel route dns riskmind app.riskmind.net

# Run as system service
sudo cloudflared service install
sudo systemctl start cloudflared
```

Set `CORS_ORIGIN=https://app.riskmind.net` in your `.env` to restrict API access to the tunnel origin.

### PM2 Process Management

| Command | Description |
|---------|-------------|
| `pm2 status` | Show running processes and memory/CPU usage. |
| `pm2 logs riskmind` | Tail the API server log stream. |
| `pm2 restart riskmind` | Restart the process (zero-downtime where possible). |
| `pm2 reload riskmind` | Graceful reload for zero-downtime restarts. |
| `pm2 stop riskmind` | Stop the process. |

---

## Security

### Multi-Tenant Data Isolation

Each tenant is a separate organizational namespace. The `tenantId` is embedded in the JWT payload at login and attached to all authenticated requests. All Drizzle ORM queries are scoped to the authenticated `tenantId` — there is no shared data pool and no cross-tenant query path in the application code.

### Authentication

- **Token type:** JSON Web Tokens (JWT) signed with HMAC-SHA256
- **Access token lifetime:** 1 hour
- **Refresh token lifetime:** 7 days
- **Payload:** Contains `userId`, `tenantId`, `role`, and standard `iat`/`exp` claims
- **Rotation:** Refresh endpoint issues new token pair and invalidates the presented refresh token

### Password Handling

Passwords are hashed with `bcryptjs` at 12 cost rounds. Plaintext passwords are never stored or logged. Password comparison uses the constant-time bcrypt compare function.

### LLM API Key Encryption

Provider API keys entered through the LLM configuration wizard are encrypted with AES-256-GCM before database storage. The encryption key is supplied via the `ENCRYPTION_KEY` environment variable and never stored in the database. The IV and authentication tag are stored alongside the ciphertext. Keys are decrypted in memory only at the moment they are needed for an API call.

### CORS

The API server enforces an origin whitelist via the `CORS_ORIGIN` environment variable. Requests from unlisted origins receive a CORS rejection before reaching any route handler. In production this is set to `https://app.riskmind.net`.

### Role-Based Access Control

Seven roles govern access to platform resources:

| Role | Description |
|------|-------------|
| `admin` | Full platform administration including user management, tenant settings, and LLM configuration. |
| `risk_manager` | Create and manage risks, treatments, incidents, and KRIs across the organization. |
| `risk_owner` | Manage risks assigned to them; limited visibility on unassigned risks. |
| `risk_executive` | Read-only access to dashboards, heatmap, KRI trends, and executive summary. |
| `auditor` | Read-only access to risks, compliance controls, control tests, and audit events. |
| `viewer` | Read-only access to risk register and basic dashboards. |
| `vendor` | Portal access for external vendor contacts; scoped to their own vendor record and questionnaires. |

Role enforcement is applied at the route handler level using middleware that reads the `role` claim from the verified JWT.

### SSRF Protection

LLM provider base URLs entered by administrators (for Ollama and private endpoint configurations) are validated against an allowlist of URL schemes and blocked from targeting internal network ranges (loopback, RFC 1918 private ranges, link-local addresses) to prevent server-side request forgery attacks against the internal network.

---

## License

MIT — see `package.json`.
