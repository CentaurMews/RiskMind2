# RiskMind

## Overview

AI-native multi-organization enterprise risk management platform. pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM + pgvector
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: JWT (custom HMAC-SHA256 implementation, no external library)
- **Password hashing**: bcryptjs (12 salt rounds)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
│       ├── src/lib/        # JWT, audit, password, errors utilities
│       ├── src/middlewares/ # Auth + RBAC middleware
│       └── src/routes/     # Route handlers (health, auth)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/     # 19 table definitions (tenants, users, risks, etc.)
├── scripts/                # Utility scripts
│   └── src/seed.ts         # Idempotent seed script
│   └── src/framework-data/ # Full framework requirement trees (ISO, SOC2, NIST)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

All tables use UUID primary keys, `created_at`/`updated_at` timestamps. Tenant-scoped tables have `tenant_id` NOT NULL.

### Tables
- **tenants** — Root isolation entity (name, slug, settings)
- **users** — Auth + RBAC (email, hashed_password, role enum); unique constraint on (tenant_id, email)
- **audit_events** — Immutable action log
- **risks** — Risk register with pgvector embedding, likelihood/impact scoring
- **treatments** — Treatment plans under risks (strategy, status, cost)
- **kris** — Key Risk Indicators with warning/critical thresholds
- **incidents** — Incidents linked to risks
- **review_cycles** — Periodic risk review tracking
- **signals** — Signal pipeline (pending → triaged → finding/dismissed)
- **findings** — Promoted signals linked to risks/vendors
- **vendors** — Third-party vendor profiles with lifecycle state machine
- **questionnaires** — Vendor assessment questionnaires with magic links
- **documents** — Vendor document uploads with processing status
- **frameworks** — Compliance frameworks (ISO 27001, SOC 2, NIST CSF seeded)
- **framework_requirements** — Nested requirements under frameworks (parentId for hierarchy)
- **controls** — Security/compliance controls
- **control_requirement_maps** — Many-to-many: controls ↔ requirements
- **control_tests** — Control test results with evidence
- **alerts** — System alerts with severity and acknowledgement

### pgvector
- Extension provisioned via `lib/db/src/bootstrap.ts` (runs before drizzle-kit push)
- Also provisioned on API server startup via `ensureExtensions()`
- Embedding columns (vector(1536)) on: risks, vendors, signals, framework_requirements

## Auth & Multi-Tenancy

- JWT tokens (access: 1hr, refresh: 7d) signed with HMAC-SHA256
- JWT_SECRET env var required (no fallback)
- Login requires tenantSlug for tenant-aware auth
- Tenant resolved from JWT payload on every request
- RBAC roles: admin, risk_manager, risk_owner, auditor, viewer, vendor
- All API errors use RFC 7807 format (global error handler catches all)
- Auth middleware globally applied; public exceptions: /auth/login, /auth/refresh, /health

## API Endpoints

### Public (no auth required)
- `GET /api/v1/health` — DB connectivity status
- `POST /api/v1/auth/login` — Tenant-aware login (email, password, tenantSlug)
- `POST /api/v1/auth/refresh` — Exchange refresh token for new token pair

### Protected (auth required)
- `GET /api/v1/auth/me` — Current user profile

## Seed Data

Run: `pnpm --filter @workspace/scripts run seed`

Creates:
- Tenant: Acme Corp (slug: acme)
- 6 users (one per role): admin@acme.com, riskmanager@acme.com, riskowner@acme.com, auditor@acme.com, viewer@acme.com, vendor@acme.com
- Password for all: `password123`
- 10 risks across 6 categories
- 5 vendors across 4 tiers
- 3 signals in different pipeline states
- 2 alerts (1 critical, 1 medium)
- 3 compliance frameworks with full requirement trees:
  - ISO 27001:2022 (97 controls)
  - SOC 2 Type II (81 criteria)
  - NIST CSF 2.0 (130 subcategories)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files emitted; JS bundling by esbuild/tsx/vite
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references`

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Key Commands

- DB bootstrap + push: `pnpm --filter @workspace/db run push`
- DB push (force): `pnpm --filter @workspace/db run push-force`
- API codegen: `pnpm --filter @workspace/api-spec run codegen`
- Seed: `pnpm --filter @workspace/scripts run seed`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with auth, RBAC, audit logging, and RFC 7807 errors.

- Entry: `src/index.ts` — reads `PORT`, ensures pgvector, starts Express
- App: `src/app.ts` — mounts CORS, JSON parsing, routes at `/api`, global error handler
- Routes: `src/routes/` — health, auth (more to come)
- Middleware: `src/middlewares/` — auth (JWT validation), rbac (role checks)
- Lib: `src/lib/` — jwt, password (bcryptjs), audit, errors utilities
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL + pgvector.

- `src/index.ts` — Pool + Drizzle instance + ensureExtensions()
- `src/bootstrap.ts` — Standalone pgvector extension provisioning
- `src/schema/` — 19 table definitions across domain modules
- Push: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Codegen: `pnpm --filter @workspace/api-spec run codegen`

### `scripts` (`@workspace/scripts`)

Utility scripts including seed. Run: `pnpm --filter @workspace/scripts run seed`
