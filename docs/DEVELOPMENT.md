# RiskMind Developer Guide

**Version:** 1.1
**Last Updated:** 2026-03-19
**Audience:** Engineers contributing to the RiskMind codebase

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup from Scratch](#setup-from-scratch)
3. [Monorepo Structure](#monorepo-structure)
4. [Development Workflow](#development-workflow)
5. [Adding a New API Endpoint](#adding-a-new-api-endpoint)
6. [Adding a New Frontend Page](#adding-a-new-frontend-page)
7. [Database Changes](#database-changes)
8. [Code Generation with Orval](#code-generation-with-orval)
9. [Generated Code Policy](#generated-code-policy)
10. [Environment Variables](#environment-variables)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20.x LTS | Runtime for all packages |
| pnpm | 9.x or later | Package manager (workspace-aware) |
| PostgreSQL | 16.x | Database |
| pgvector | 0.7.x or later | PostgreSQL extension for embeddings |
| TypeScript | 5.9.x (managed by workspace) | Language |

**Do not use npm or yarn.** The root `package.json` has a `preinstall` hook that blocks non-pnpm installs.

---

## Setup from Scratch

### Step 1: Clone and enter the repository

```bash
git clone <repo-url> RiskMind2
cd RiskMind2
```

### Step 2: Install dependencies

```bash
pnpm install
```

This installs all workspace packages. The workspace structure is declared in `pnpm-workspace.yaml`.

### Step 3: Provision the database

Ensure PostgreSQL 16 is running and accessible. Create the database and enable the pgvector extension:

```sql
CREATE DATABASE riskmind;
\c riskmind
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 4: Configure environment variables

Copy the example and fill in required values:

```bash
cp .env.example .env
```

At minimum, set the required variables before proceeding. See the [Environment Variables](#environment-variables) section for full details.

```
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/riskmind
JWT_SECRET=<random 64+ char string>
ENCRYPTION_KEY=<base64-encoded 32-byte key>
```

To generate a valid `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 5: Build shared libraries

Shared libraries must be compiled before the API server or SPA can reference them:

```bash
pnpm typecheck:libs
```

This runs `tsc --build` using the root `tsconfig.json` which references all `lib/` packages.

### Step 6: Push database schema

The project uses Drizzle's schema-push workflow (no migration files):

```bash
cd lib/db
pnpm drizzle-kit push
cd ../..
```

This creates all tables and enums in the PostgreSQL database based on the current schema in `lib/db/src/schema/`.

### Step 7: Start development servers

Open two terminal sessions:

**Terminal 1 — API server with hot reload:**
```bash
cd artifacts/api-server
pnpm dev
```

The dev script runs `tsx ./src/index.ts` with `NODE_ENV=development`. On first start with an empty database, `seedDemoDataIfEmpty()` runs automatically and populates the database with demo tenants, users, and risk data.

**Terminal 2 — React SPA with hot reload:**
```bash
cd artifacts/riskmind-app
pnpm dev
```

Vite starts at `http://localhost:5173` by default. The Vite dev proxy is configured to forward `/api/*` and `/mcp` requests to `http://localhost:4000`.

**Verify setup:**
- API health: `curl http://localhost:4000/api/v1/health`
- SPA: open `http://localhost:5173` in a browser
- Login: use the seeded demo credentials (check the seed script for defaults)

---

## Monorepo Structure

```
RiskMind2/
├── pnpm-workspace.yaml       # Declares: artifacts/**, lib/**
├── tsconfig.json             # Project references to all lib packages
├── tsconfig.base.json        # Shared TypeScript compiler options
├── ecosystem.config.cjs      # PM2 production configuration
│
├── artifacts/
│   ├── api-server/           # Express 5 backend
│   │   ├── package.json      # "name": "@workspace/api-server"
│   │   ├── src/
│   │   │   ├── index.ts      # Boot entry point
│   │   │   ├── app.ts        # Express application setup
│   │   │   ├── routes/       # Route handlers (one file per domain)
│   │   │   ├── middlewares/  # auth.ts, rbac.ts
│   │   │   └── lib/          # Services: jwt, encryption, llm-service, etc.
│   │   └── build.ts          # esbuild production bundler
│   │
│   └── riskmind-app/         # React 19 + Vite 7 SPA
│       ├── package.json      # "name": "@workspace/riskmind-app"
│       ├── vite.config.ts    # Vite configuration + dev proxy
│       └── src/
│           ├── App.tsx        # Router configuration
│           ├── pages/         # Route-level page components
│           ├── components/    # Shared UI components
│           ├── hooks/         # Custom React hooks
│           └── lib/           # Client-side utilities
│
└── lib/
    ├── api-spec/              # "name": "@workspace/api-spec"
    │   └── openapi.yaml       # OpenAPI 3.1.0 spec (source of truth)
    │
    ├── api-zod/               # "name": "@workspace/api-zod"  [GENERATED]
    │   └── src/               # Zod schemas from OpenAPI
    │
    ├── api-client-react/      # "name": "@workspace/api-client-react"  [GENERATED]
    │   └── src/               # React Query hooks from OpenAPI
    │
    └── db/                    # "name": "@workspace/db"
        ├── drizzle.config.ts  # Drizzle Kit config (schema path, dialect)
        └── src/
            ├── index.ts       # Exports: db client + all schema
            └── schema/        # One .ts file per domain table
```

### Workspace Package Names

| Package Name | Path | Consumers |
|---|---|---|
| `@workspace/db` | `lib/db` | `api-server` |
| `@workspace/api-spec` | `lib/api-spec` | Orval codegen |
| `@workspace/api-zod` | `lib/api-zod` | `api-server`, `riskmind-app` |
| `@workspace/api-client-react` | `lib/api-client-react` | `riskmind-app` |

---

## Development Workflow

### Hot Reload Behavior

| Server | Command | Reload Mechanism |
|---|---|---|
| API server | `pnpm dev` (in `artifacts/api-server`) | `tsx` restarts on file change |
| React SPA | `pnpm dev` (in `artifacts/riskmind-app`) | Vite HMR (instant) |

Changes to `lib/db` schema require:
1. Rebuild the lib: `pnpm typecheck:libs`
2. Push schema changes: `cd lib/db && pnpm drizzle-kit push`
3. Restart the API dev server

Changes to `lib/api-spec/openapi.yaml` require running Orval to regenerate client code (see [Code Generation with Orval](#code-generation-with-orval)).

### TypeScript Checking

```bash
# Check all lib packages only
pnpm typecheck:libs

# Check everything (libs + artifacts)
pnpm typecheck

# Check a single artifact
cd artifacts/api-server && pnpm typecheck
```

### Full Production Build

```bash
pnpm build
```

This runs:
1. `pnpm typecheck` (all packages)
2. `pnpm -r --if-present run build` (all packages in dependency order)

Build outputs:
- `artifacts/api-server/dist/index.cjs` — bundled Node.js server
- `artifacts/riskmind-app/dist/public/` — static SPA assets

---

## Adding a New API Endpoint

Follow this pattern to add a new endpoint to the API.

### Step 1: Define the contract in OpenAPI

Add the path to `lib/api-spec/openapi.yaml`:

```yaml
/v1/my-resource:
  get:
    operationId: listMyResources
    tags: [myResource]
    summary: List resources
    parameters:
      - name: page
        in: query
        schema: { type: integer, default: 1 }
    responses:
      "200":
        description: Success
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/MyResourceList"
```

Also add the schema definition under `components/schemas`.

### Step 2: Run Orval codegen

```bash
cd lib/api-spec
pnpm orval
```

This regenerates `lib/api-zod/` and `lib/api-client-react/`. Commit the generated files.

### Step 3: Create the route file

```
artifacts/api-server/src/routes/my-resource.ts
```

```typescript
import { Router } from "express";
import { db, myResourceTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../middlewares/rbac";

const router = Router();

router.get("/v1/my-resource", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const rows = await db
    .select()
    .from(myResourceTable)
    .where(eq(myResourceTable.tenantId, tenantId));
  res.json({ data: rows, total: rows.length });
});

router.post(
  "/v1/my-resource",
  requireRole("risk_manager", "admin"),
  async (req, res) => {
    // Validate input, insert, respond
  }
);

export default router;
```

### Step 4: Mount the router in `routes/index.ts`

```typescript
import myResourceRouter from "./my-resource";
// ...
router.use(myResourceRouter);
```

### Step 5: Use the generated hook in the frontend

After Orval regenerates `lib/api-client-react/`, import the generated hook in your page component:

```typescript
import { useListMyResources } from "@workspace/api-client-react";

function MyResourcePage() {
  const { data, isLoading } = useListMyResources();
  // ...
}
```

### Important Conventions

- Always filter by `req.user!.tenantId` — never expose cross-tenant data
- Always validate request bodies using the Zod schemas from `@workspace/api-zod`
- Return errors using the helpers in `src/lib/errors.ts`: `badRequest()`, `notFound()`, `forbidden()`
- Add RBAC guards with `requireRole()` for write operations
- Enqueue async AI work via the job queue — never run LLM calls inline in a request handler

---

## Adding a New Frontend Page

### Step 1: Create the page component

```
artifacts/riskmind-app/src/pages/my-feature/index.tsx
```

```typescript
import { useListMyResources } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export function MyFeaturePage() {
  const { data, isLoading } = useListMyResources();

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div>
      {/* page content */}
    </div>
  );
}
```

### Step 2: Register the route in `App.tsx`

```typescript
import { MyFeaturePage } from "./pages/my-feature";

// In the router:
<Route path="/my-feature" element={<MyFeaturePage />} />
```

### Step 3: Add navigation entry

Add a link to the sidebar navigation component in `src/components/nav/`.

### Conventions

- Use skeleton loaders while `isLoading` is true — no blank boxes
- Show empty states with a call-to-action when data is empty
- Show toast errors on all mutations using `react-hot-toast` or the established toast pattern
- Apply RBAC gates in the UI using `req.user.role` from the auth context
- Use shadcn/ui components for all UI primitives
- Follow the Linear/Vercel minimalist aesthetic — no heavy borders, no gradients

---

## Database Changes

The project uses Drizzle ORM with a **schema-push** workflow. There are no versioned migration files. Schema changes are applied directly to the database.

### Adding a New Table

1. Create a schema file in `lib/db/src/schema/my-table.ts`:

```typescript
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const myTable = pgTable("my_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMyTableSchema = createInsertSchema(myTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMyTable = z.infer<typeof insertMyTableSchema>;
export type MyTable = typeof myTable.$inferSelect;
```

2. Export from the schema index:

```typescript
// lib/db/src/schema/index.ts
export * from "./my-table";
```

3. Push to the database:

```bash
cd lib/db
pnpm drizzle-kit push
```

4. Rebuild the db library:

```bash
pnpm typecheck:libs
```

### Adding a Column to an Existing Table

1. Add the column to the table definition in the schema file
2. Run `pnpm drizzle-kit push` from `lib/db`

### Important Notes

- `drizzle-kit push` is destructive for column renames — it drops and re-creates columns. Use `drizzle-kit push` with caution on production. Always verify the diff with `drizzle-kit diff` first.
- All tables must include `tenant_id` referencing `tenants.id`
- Always add `createdAt` and `updatedAt` timestamp columns
- Use UUID primary keys with `.defaultRandom()`
- Use pgvector `vector("embedding", { dimensions: 1536 })` for embedding columns

---

## Code Generation with Orval

Orval generates two packages from the OpenAPI spec:

| Generated Package | Contents |
|---|---|
| `lib/api-zod` | Zod schemas for every request/response type |
| `lib/api-client-react` | React Query hooks for every endpoint |

### When to Run

Run Orval after any change to `lib/api-spec/openapi.yaml`.

### How to Run

```bash
cd lib/api-spec
pnpm orval
```

The Orval configuration is in `lib/api-spec/orval.config.ts` (or equivalent). It reads `openapi.yaml` and writes to both output packages.

### After Running Orval

1. Rebuild the lib packages: `pnpm typecheck:libs`
2. Verify the API server and SPA still type-check: `pnpm typecheck`
3. Commit the regenerated files in `lib/api-zod/` and `lib/api-client-react/`

---

## Generated Code Policy

**The following directories must never be edited manually:**

```
lib/api-zod/        — Generated by Orval from openapi.yaml
lib/api-client-react/ — Generated by Orval from openapi.yaml
```

These files are regenerated entirely on each Orval run. Any manual changes will be overwritten.

**To change a schema or hook:**
1. Edit `lib/api-spec/openapi.yaml`
2. Run Orval
3. Commit the regenerated output

This constraint is enforced by convention. A CI check that diffs regenerated output against committed output is planned for a future milestone.

---

## Environment Variables

All required variables must be present at process start. The server performs a fail-fast check and throws on any missing required variable.

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `PORT` | HTTP port for Express to listen on | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/riskmind` |
| `JWT_SECRET` | HMAC-SHA256 signing secret for JWTs | 64+ character random string |
| `ENCRYPTION_KEY` | AES-256-GCM key for LLM API key encryption | Base64-encoded 32-byte value |

### Optional Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `CORS_ORIGINS` | Additional allowed CORS origins | (see `app.ts` allowlist) |

### Generating Secrets

**JWT_SECRET** (generate a strong random string):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**ENCRYPTION_KEY** (must be exactly 32 bytes, base64-encoded):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Critical Constraint: ENCRYPTION_KEY Rotation

`ENCRYPTION_KEY` cannot be changed without re-encrypting every `llm_configs.encrypted_api_key` row in the database. Rotating this key without a migration script will cause all configured LLM providers to fail with decryption errors. Treat this key with the same care as a database master key.

### Variable Loading in Production

PM2 loads the `.env` file via Node's native `--env-file` flag (not PM2's own `env_file` option, which has known issues in PM2 6.x):

```javascript
// ecosystem.config.cjs
node_args: "--env-file /home/dante/RiskMind2/.env"
```

In development, variables are loaded by placing a `.env` file in the project root and using `tsx` which respects it automatically.

---

## Troubleshooting

### "Cannot find module '@workspace/db'"

The workspace library has not been built. Run:
```bash
pnpm typecheck:libs
```

### "Required environment variable DATABASE_URL is not set"

The `.env` file is missing or the variable is not set. Verify the file exists at the project root and contains `DATABASE_URL`.

### "pgvector extension not found"

The `vector` extension must be installed in PostgreSQL before running schema push:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Verify: `SELECT * FROM pg_extension WHERE extname = 'vector';`

### API server starts but SPA shows blank page in development

Ensure the Vite dev server (`riskmind-app pnpm dev`) is running. The Vite config proxies `/api` to port 4000. If running the production build directly on port 4000, navigate to `http://localhost:4000` instead.

### "Invalid or expired token" on every request

The `JWT_SECRET` in the `.env` may have changed since tokens were issued. Clear browser local storage (where the token is stored by the SPA) and log in again.

### drizzle-kit push says "0 changes" but table is missing

Drizzle Kit compares the schema against the live database. If the table was dropped manually, Drizzle Kit will detect it as a new table. If it still shows 0 changes, verify `DATABASE_URL` points to the correct database.

### SSE interview stream arrives all at once (buffered)

This typically means a proxy is buffering the response. In development with the Vite proxy, ensure the proxy config passes `changeOrigin: true` and does not buffer. In production, the Cloudflare tunnel is configured to not buffer SSE. The server calls `res.flushHeaders()` before the first SSE write; if tokens still arrive in bulk, check for an intermediate nginx or other proxy.

### Drizzle type errors after schema change

After modifying schema files, rebuilt the db package:
```bash
pnpm typecheck:libs
```

Then restart the API dev server so `tsx` picks up the new types.

### "ENCRYPTION_KEY must be exactly 32 bytes"

The `ENCRYPTION_KEY` environment variable was not base64-encoded, or the decoded value is not 32 bytes. Regenerate it:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Orval generates empty or incorrect output

Verify that `lib/api-spec/openapi.yaml` is valid OpenAPI 3.1.0. Run a linter such as `spectral lint openapi.yaml`. Common issues: missing `operationId`, missing response schema ref, incorrect YAML indentation.
