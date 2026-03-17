# Phase 1: Server Foundation - Research

**Researched:** 2026-03-17
**Domain:** Node.js/Express deployment, PostgreSQL/pgvector provisioning, PM2 process management, pnpm monorepo build
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Static File Serving**
- Catch-all SPA fallback: `express.static` for built assets from `artifacts/riskmind-app/dist/public/`, then any non-`/api` non-`/mcp` path returns `index.html`
- SPA served at root `/` (no subpath)
- In development, run Vite dev server separately on its own port with HMR; production builds are served through Express
- Static middleware must be added to `artifacts/api-server/src/app.ts` — it currently has none

**Seed Data Strategy**
- Use the rich seed script (`scripts/src/seed.ts`) — creates tenant "Acme Corp", 6 users, 10 risks, 5 vendors, 3 frameworks, alerts, signals
- Trigger: auto at server startup (check if empty, seed if so) — integrate rich seed into the startup flow
- Keep simple credentials: `*@acme.com / password123` for all demo users
- The minimal in-process seed (`api-server/src/lib/seed.ts`) should be replaced or enhanced with the rich seed logic

**Environment Variable Management**
- Create `.env.example` with all required vars (documented placeholders)
- Create `.env` with actual values, add `.env` to `.gitignore`
- Required vars: `DATABASE_URL`, `PORT=4000`, `JWT_SECRET`, `ENCRYPTION_KEY`
- Add upfront startup validation: check ALL required env vars exist before server starts — fail fast with clear error messages (ENCRYPTION_KEY currently fails silently at call time, not at startup)
- Auto-generate `JWT_SECRET` and `ENCRYPTION_KEY` if missing on first run — generate random secrets and save to `.env`

**PM2 Configuration**
- Single instance only — no cluster mode (the PostgreSQL-backed job queue is stateful/in-process)
- `ecosystem.config.cjs` with `script: "artifacts/api-server/dist/index.cjs"`, env vars loaded from `.env`
- PM2 log rotation via `pm2-logrotate` module: 10MB max file size, 10 files retained
- No watch mode — production behavior, restart only on crash or manual deploy
- `pm2 startup` + `pm2 save` for boot persistence

**Replit Dependency Stripping**
- Remove `@replit/connectors-sdk` from root `package.json` (not imported anywhere in source — safe to remove)
- Remove `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal` from:
  - `pnpm-workspace.yaml` catalog entries
  - `artifacts/riskmind-app/package.json` devDependencies
  - `artifacts/mockup-sandbox/package.json` devDependencies
- Clean up `artifacts/riskmind-app/vite.config.ts`: remove all `@replit/*` imports and the `REPL_ID` conditional block, remove `runtimeErrorOverlay()` plugin usage
- Remove `.replit` and `.replitignore` files

**Database Provisioning**
- Create fresh PostgreSQL database (e.g., `riskmind`)
- Install pgvector extension as superuser BEFORE running drizzle-kit push
- Use `drizzle-kit push` (not migrate) as the primary schema management approach
- Apply the manual SQL migration `0001_risk_executive_role_and_acceptance_memoranda.sql` after push
- Run bootstrap script: `pnpm --filter @workspace/db run bootstrap`

### Claude's Discretion
- Exact order of operations in the build/deploy script
- Database name choice
- `.env.example` formatting and comments
- PM2 log rotation timing configuration
- How to integrate rich seed into startup flow (call the scripts package seed from api-server, or merge logic)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPL-01 | Strip all Replit-specific dependencies (@replit/connectors-sdk, @replit/vite-plugin-*) | Exact files and lines identified; safe removal confirmed (no runtime imports found) |
| DEPL-02 | Configure environment variables (JWT_SECRET, ENCRYPTION_KEY, DATABASE_URL, PORT) with startup validation | Current validation gap in encryption.ts identified; auto-generation pattern documented |
| DEPL-03 | Install pnpm dependencies and build all workspace packages successfully | Build pipeline understood (esbuild for API, Vite for SPA); no dist exists yet |
| DEPL-04 | Express serves both REST API and built React SPA from single port (4000) | app.ts has no static middleware yet; insertion point confirmed (before 404 handler) |
| DEPL-05 | PM2 process management with ecosystem.config.cjs, auto-restart, boot persistence | PM2 6.0.10 already installed; no ecosystem.config.cjs exists yet; pm2-logrotate needed |
| DB-01 | Create fresh PostgreSQL database for RiskMind | PostgreSQL 16.13 running; no riskmind database exists; postgres superuser accessible via sudo |
| DB-02 | Install pgvector extension as superuser before migrations | pgvector NOT installed yet (apt package available: postgresql-16-pgvector); must install before push |
| DB-03 | Run Drizzle migrations successfully | drizzle-kit push workflow understood; manual SQL migration file exists and ready |
| DB-04 | Run seed scripts to populate demo data (risks, vendors, frameworks, alerts, signals, users) | Rich seed script at scripts/src/seed.ts is complete and verified; integration approach needed |
</phase_requirements>

---

## Summary

This phase is a deployment/infrastructure phase, not a feature phase. All required source code already exists — the work is wiring, stripping, configuring, and deploying. There are no greenfield implementations; every task is either removing something (Replit deps), adding a small amount of glue code (static serving, env validation, seed integration), or running configuration commands (database provisioning, PM2 setup).

The most critical dependency ordering constraint: **pgvector must be installed at the OS level before the database is created or drizzle-kit push is run.** The `apt` package `postgresql-16-pgvector` is available but not yet installed. Skipping this causes `CREATE EXTENSION vector` to fail silently (the function exists but the shared library is missing), and `drizzle-kit push` may succeed but leave vector columns in a broken state.

The second important insight: the current `seedDemoDataIfEmpty()` in `api-server/src/lib/seed.ts` only creates 5 users with no risks/vendors/frameworks. The rich seed in `scripts/src/seed.ts` creates the full demo dataset. The integration approach (how to call the scripts package from api-server at runtime, or how to merge logic) is at Claude's discretion — the simplest approach is extracting seed logic into a shared function or calling the scripts package's seed module directly since it's a workspace dependency candidate.

**Primary recommendation:** Execute in strict order — OS packages first, then database, then pgvector extension, then schema push, then manual migration, then build, then PM2 config. Getting the order wrong is the primary failure mode for this phase.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PM2 | 6.0.10 (installed) | Process management, restart-on-crash, boot persistence | Industry standard for Node.js production; already installed on server |
| PostgreSQL | 16.13 (installed) | Primary database | Already running; no change needed |
| postgresql-16-pgvector | latest apt | Vector similarity extension | Required by schema (embedding columns); must install before schema push |
| drizzle-kit | ^0.31.9 (in lib/db) | Schema push to database | Already in workspace; project standard |
| esbuild | 0.27.3 (pinned) | API server bundler | Already configured in build.ts; pinned version in workspace overrides |
| Vite | ^7.3.0 (catalog) | Frontend build | Already configured; just needs Replit plugins stripped |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pm2-logrotate | latest | PM2 log rotation | Install as PM2 module; keeps logs bounded at 10MB/10 files |
| dotenv / `--env-file` | Node 20+ built-in | Load .env at startup | PM2 ecosystem.config.cjs `env_file` or `node --env-file` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| drizzle-kit push | drizzle-kit migrate | Decisions locked — push is the project standard |
| PM2 single instance | PM2 cluster | Locked — stateful in-process job queue requires single instance |
| Express static serving | nginx | Locked — requirements explicitly exclude nginx |

**Installation (new packages only):**
```bash
# OS-level — must run as root or with sudo
sudo apt-get install -y postgresql-16-pgvector

# PM2 module
pm2 install pm2-logrotate
```

---

## Architecture Patterns

### Recommended Project Structure (additions this phase only)
```
/
├── .env                          # NEW: actual secrets (gitignored)
├── .env.example                  # NEW: documented placeholders
├── ecosystem.config.cjs          # NEW: PM2 config at repo root
├── artifacts/
│   ├── api-server/
│   │   ├── src/
│   │   │   ├── app.ts            # MODIFY: add static middleware + SPA fallback
│   │   │   ├── index.ts          # MODIFY: expand env validation, integrate rich seed
│   │   │   └── lib/
│   │   │       └── seed.ts       # REPLACE/ENHANCE: call rich seed logic
│   │   └── dist/
│   │       └── index.cjs         # GENERATED by build
│   └── riskmind-app/
│       ├── vite.config.ts        # MODIFY: strip Replit plugins
│       └── dist/public/          # GENERATED by vite build
```

### Pattern 1: Express Static + SPA Fallback
**What:** Serve built React assets from Express, with catch-all returning index.html for any unmatched non-API routes
**When to use:** Any single-binary Node.js deployment where frontend and backend share a port
**Example:**
```typescript
// In artifacts/api-server/src/app.ts
// INSERT before the 404 handler, AFTER /api and /mcp routes

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve built SPA assets
const distPath = path.resolve(__dirname, "../../../riskmind-app/dist/public");
app.use(express.static(distPath));

// SPA fallback — any non-API, non-MCP path returns index.html
app.get(/^(?!\/api|\/mcp).*$/, (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, "index.html"));
});
```
Note: The `__dirname` path must resolve correctly from the compiled `dist/index.cjs` location. The relative path `../../../riskmind-app/dist/public` works when the api-server dist is at `artifacts/api-server/dist/` and the SPA dist is at `artifacts/riskmind-app/dist/public/`. Verify this path at runtime.

### Pattern 2: Fail-Fast Environment Validation
**What:** Validate all required env vars at process startup before any other code runs
**When to use:** Production servers where silent misconfiguration causes runtime errors
**Example:**
```typescript
// In artifacts/api-server/src/index.ts — BEFORE any imports that consume env vars

const REQUIRED_ENV = ["PORT", "DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
}
```
The current code only validates PORT at startup. JWT_SECRET throws at module load (acceptable). ENCRYPTION_KEY throws at call time (problem — silent until first encrypted operation).

### Pattern 3: PM2 ecosystem.config.cjs
**What:** CJS format PM2 config with env_file support for .env loading
**When to use:** Any PM2-managed Node.js app that reads from .env
**Example:**
```javascript
// ecosystem.config.cjs — at repo root
module.exports = {
  apps: [
    {
      name: "riskmind",
      script: "artifacts/api-server/dist/index.cjs",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env_file: ".env",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      error_file: "./logs/riskmind-error.log",
      out_file: "./logs/riskmind-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
```
Note: PM2 v5+ supports `env_file` natively. PM2 6.0.10 is installed — this is confirmed supported.

### Pattern 4: Rich Seed Integration
**What:** Call the scripts package rich seed logic from within the startup flow
**Options at Claude's discretion:**

Option A (recommended — simpler): Add `@workspace/scripts` as a dependency to `@workspace/api-server` and import the seed function directly. Problem: `scripts/src/seed.ts` calls `pool.end()` at the end which would kill the shared pool. The seed function needs to be extracted without the `pool.end()` call.

Option B (clean separation): Copy the seed logic into `api-server/src/lib/seed.ts`, replacing the minimal 5-user version with the rich version. No cross-package dependency, no pool.end() issue.

Option C (subprocess): Spawn `pnpm --filter @workspace/scripts run seed` as a child process from startup, wait for completion. Heavier but keeps scripts fully isolated.

**Recommendation: Option B** — copy the rich seed logic into `api-server/src/lib/seed.ts`. This avoids the `pool.end()` issue, keeps the startup flow synchronous/in-process, and the seed function is small enough to maintain in one place.

### Anti-Patterns to Avoid
- **Running drizzle-kit push before pgvector is installed at OS level:** Push succeeds but vector columns are non-functional. Always `apt-get install postgresql-16-pgvector` first.
- **Calling `pool.end()` inside seedDemoDataIfEmpty:** The scripts/src/seed.ts calls `pool.end()` — this terminates the shared pool. If integrating that code, strip `pool.end()`.
- **Using absolute paths in ecosystem.config.cjs:** PM2 resolves script paths relative to cwd where `pm2 start` is invoked. Use paths relative to the repo root or use `__dirname` equivalent in CJS config.
- **Starting PM2 before the build exists:** `artifacts/api-server/dist/index.cjs` must exist before `pm2 start`. Build first, then PM2.
- **Using PM2 watch mode in production:** Watch mode restarts on any file change, including log files, causing restart loops.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Log rotation | Custom log trimming script | `pm2 install pm2-logrotate` | PM2 module handles size limits, file rotation, compression — one command |
| Secret generation | Anything custom | `crypto.randomBytes(32).toString('base64')` (Node built-in) | For ENCRYPTION_KEY (must be exactly 32 bytes base64-encoded per encryption.ts) |
| Boot persistence | Custom systemd unit for Node | `pm2 startup` + `pm2 save` | Generates correct init system config for the current OS automatically |
| SPA route handling | Complex route pattern matching | Single regex `/^(?!\/api|\/mcp).*$/` + `res.sendFile` | Express regex route is sufficient; no routing library needed |

**Key insight:** Every sub-problem in this phase has a one-liner solution. The risk is over-engineering. The entire phase is about correctly sequencing existing tools.

---

## Common Pitfalls

### Pitfall 1: pgvector Missing at Schema Push Time
**What goes wrong:** `drizzle-kit push` completes with exit 0, but any query touching vector columns fails at runtime with `type "vector" does not exist`.
**Why it happens:** The `CREATE EXTENSION IF NOT EXISTS vector` in `ensureExtensions()` requires the shared library to be installed at the OS level. If `postgresql-16-pgvector` is not installed, the extension cannot be created.
**How to avoid:** `sudo apt-get install -y postgresql-16-pgvector` BEFORE creating the database or running any drizzle commands.
**Warning signs:** `ensureExtensions()` completes without error but vector operations fail; check `SELECT * FROM pg_available_extensions WHERE name = 'vector';`

### Pitfall 2: Stale pnpm Lockfile After Removing Replit Packages
**What goes wrong:** `pnpm install` succeeds but leaves phantom entries or fails with integrity errors because removed packages still appear in `pnpm-lock.yaml`.
**Why it happens:** pnpm lockfile references catalog entries that were deleted.
**How to avoid:** After removing Replit entries from `pnpm-workspace.yaml` catalog and all `package.json` files, run `pnpm install` (not `pnpm install --frozen-lockfile`). The lockfile will be regenerated.
**Warning signs:** pnpm install errors about missing catalog entries; `pnpm-lock.yaml` still references `@replit/*`.

### Pitfall 3: Static File Path Wrong in Compiled CJS Bundle
**What goes wrong:** Express serves API routes correctly but all non-API paths return 404 or serve wrong files.
**Why it happens:** The `__dirname` equivalent in ESM (`fileURLToPath(import.meta.url)`) resolves to the source file location during dev but to `artifacts/api-server/dist/` in the compiled CJS bundle. The relative path to `riskmind-app/dist/public` must be correct from the compiled output location.
**How to avoid:** Compute the static path relative to the dist file: from `artifacts/api-server/dist/index.cjs`, the SPA dist is at `../../riskmind-app/dist/public`. Test with `curl http://localhost:4000/` after building.
**Warning signs:** `GET /` returns 404 or returns API error format; `GET /api/v1/health` works but `GET /` does not.

### Pitfall 4: pool.end() Kills the Shared DB Connection
**What goes wrong:** Server starts, seeds data successfully, then all subsequent DB queries fail with "pool has ended" error.
**Why it happens:** The scripts/src/seed.ts calls `await pool.end()` at the end (designed to terminate a standalone script). If this code runs inline in the server startup, it terminates the shared pool used by Express routes.
**How to avoid:** When copying seed logic into api-server, remove the `pool.end()` call. The api-server's pool is long-lived and managed by the process lifecycle, not the seed function.
**Warning signs:** Server starts and logs seed completion, then first API request fails with pool/connection error.

### Pitfall 5: .env Not Loaded by PM2
**What goes wrong:** PM2 starts the process but env vars are undefined; server throws immediately.
**Why it happens:** PM2 does not automatically load `.env` files unless configured. The `env_file` key in ecosystem.config.cjs must point to the `.env` file path (relative to where `pm2 start` is run, i.e., the repo root).
**How to avoid:** Use `env_file: ".env"` in ecosystem.config.cjs and always run `pm2 start ecosystem.config.cjs` from the repo root.
**Warning signs:** `pm2 logs riskmind` shows "PORT environment variable is required" immediately after start.

### Pitfall 6: ENCRYPTION_KEY Format
**What goes wrong:** Server starts but any route that triggers `encrypt()` or `decrypt()` throws "ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded)".
**Why it happens:** The encryption.ts validates that `Buffer.from(key, 'base64').length === 32`. A random 32-character string is NOT the same as a 32-byte base64-encoded value. The correct generation is `crypto.randomBytes(32).toString('base64')` which produces a 44-character base64 string representing 32 bytes.
**How to avoid:** Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. The result is ~44 chars, not 32.
**Warning signs:** 500 errors on any endpoint that touches vendor API keys or other encrypted fields.

---

## Code Examples

### Adding Static Middleware to app.ts
```typescript
// Source: Express 5 official docs + project's existing app.ts pattern
// Add AFTER app.use("/api", router); and BEFORE the 404 handler

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve from compiled dist/index.cjs location: artifacts/api-server/dist/
// SPA dist is at: artifacts/riskmind-app/dist/public/
const spaDistPath = path.resolve(__dirname, "../../riskmind-app/dist/public");

app.use(express.static(spaDistPath));

app.get(/^(?!\/api|\/mcp).*$/, (_req: Request, res: Response) => {
  res.sendFile(path.join(spaDistPath, "index.html"));
});
```

### Generating Required Secrets
```bash
# JWT_SECRET — any random base64 string works (used as HMAC key)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# ENCRYPTION_KEY — MUST be exactly 32 bytes base64-encoded (per encryption.ts validation)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Database Provisioning Sequence
```bash
# 1. Install pgvector OS package
sudo apt-get install -y postgresql-16-pgvector

# 2. Create database and app user (as postgres superuser)
sudo -u postgres psql -c "CREATE DATABASE riskmind;"
sudo -u postgres psql -c "CREATE USER riskmind WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE riskmind TO riskmind;"
sudo -u postgres psql -d riskmind -c "GRANT ALL ON SCHEMA public TO riskmind;"

# 3. Install pgvector in the database (superuser required)
sudo -u postgres psql -d riskmind -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Set DATABASE_URL and run drizzle push
export DATABASE_URL="postgresql://riskmind:your_password@localhost:5432/riskmind"
pnpm --filter @workspace/db run push

# 5. Apply manual migration
psql "$DATABASE_URL" -f lib/db/migrations/0001_risk_executive_role_and_acceptance_memoranda.sql
```

### PM2 Log Rotation Setup
```bash
# Install pm2-logrotate module
pm2 install pm2-logrotate

# Configure retention
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 10
pm2 set pm2-logrotate:compress false
```

### PM2 Boot Persistence
```bash
# Run from repo root after first successful start
pm2 startup          # generates and prints systemd command — run that command
pm2 save             # saves current process list for restoration on boot
```

### Vite Config After Replit Stripping
```typescript
// artifacts/riskmind-app/vite.config.ts — clean version
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT || "5173";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true, deny: ["**/.*"] },
  },
  preview: { port, host: "0.0.0.0", allowedHosts: true },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PM2 ecosystem.config.js (ESM) | ecosystem.config.cjs (CJS) | PM2 v5+ | PM2 itself runs in CJS; ESM ecosystem files need special handling; use .cjs to be safe |
| Manual .env loading in Node | `--env-file` flag (Node 20.6+) / `env_file` in PM2 | Node 20.6 / PM2 v5 | No dotenv package needed; Node loads .env natively |
| `drizzle-kit generate` + `migrate` | `drizzle-kit push` | Drizzle Kit 0.20+ | Push for development/small teams; project uses push by decision |

**Deprecated/outdated:**
- `@replit/connectors-sdk`: Replit-specific, not available in npm public registry outside Replit environment. Safe to remove — confirmed no runtime imports.
- `@replit/vite-plugin-*`: Three plugins only activate conditionally on `process.env.REPL_ID !== undefined`, which is never set outside Replit. They add install weight and may fail to resolve packages.

---

## Open Questions

1. **Rich seed integration approach**
   - What we know: scripts/src/seed.ts calls `pool.end()` at the end (standalone script design)
   - What's unclear: whether Option B (copy logic) or Option C (subprocess) is preferred
   - Recommendation: Claude's discretion — Option B (copy without pool.end()) is simplest and keeps startup synchronous

2. **Database user vs postgres superuser for app**
   - What we know: The app only needs DML permissions; pgvector extension requires superuser to CREATE
   - What's unclear: Whether to run app as `postgres` user or create a dedicated `riskmind` user
   - Recommendation: Create dedicated `riskmind` user for least-privilege; use postgres superuser only for initial `CREATE EXTENSION` step

3. **.env auto-generation on first run**
   - What we know: CONTEXT.md says auto-generate JWT_SECRET and ENCRYPTION_KEY if missing on first run
   - What's unclear: Whether this generation should happen in a setup script or in the server startup code itself
   - Recommendation: Separate `scripts/setup.ts` or shell script that generates .env if it doesn't exist; avoid mutating .env from within the running server

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in project (no jest.config, vitest.config, pytest.ini) |
| Config file | Wave 0 — none exists |
| Quick run command | `curl -s http://localhost:4000/api/v1/health` (smoke test) |
| Full suite command | Manual verification checklist (no automated suite for this phase) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPL-01 | No @replit/* packages in node_modules | smoke | `pnpm ls --depth 0 2>&1 \| grep -c replit && echo FAIL \|\| echo PASS` | ❌ Wave 0 |
| DEPL-02 | Server fails fast on missing env vars | smoke | `PORT="" node artifacts/api-server/dist/index.cjs 2>&1 \| grep "environment variable"` | ❌ Wave 0 |
| DEPL-03 | Build completes successfully | smoke | `ls artifacts/api-server/dist/index.cjs && ls artifacts/riskmind-app/dist/public/index.html && echo PASS` | ❌ Wave 0 |
| DEPL-04 | Express serves API + SPA on port 4000 | smoke | `curl -sf http://localhost:4000/api/v1/health && curl -sf http://localhost:4000/ \| grep -q "<!DOCTYPE html" && echo PASS` | ❌ Wave 0 |
| DEPL-05 | PM2 shows riskmind online | smoke | `pm2 list \| grep riskmind \| grep -q online && echo PASS` | ❌ Wave 0 |
| DB-01 | riskmind database exists | smoke | `psql "$DATABASE_URL" -c "SELECT 1" && echo PASS` | ❌ Wave 0 |
| DB-02 | pgvector extension installed | smoke | `psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname='vector'" \| grep -q vector && echo PASS` | ❌ Wave 0 |
| DB-03 | Schema pushed successfully | smoke | `psql "$DATABASE_URL" -c "\dt" \| grep -q tenants && echo PASS` | ❌ Wave 0 |
| DB-04 | Seed data present | smoke | `curl -sf -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"admin@acme.com","password":"password123","tenantSlug":"acme"}' \| grep -q token && echo PASS` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `curl -sf http://localhost:4000/api/v1/health`
- **Per wave merge:** Full smoke test sequence from the requirement map above
- **Phase gate:** All smoke tests green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/verify-phase1.sh` — shell script running all smoke tests sequentially with pass/fail output
- [ ] No test framework installation needed — all phase-1 validation is operational smoke tests, not unit tests

---

## Sources

### Primary (HIGH confidence)
- Direct source code inspection of all canonical files listed in CONTEXT.md
- `artifacts/api-server/src/app.ts` — confirmed no static middleware
- `artifacts/api-server/src/index.ts` — confirmed PORT-only validation, seedDemoDataIfEmpty hook location
- `artifacts/api-server/src/lib/seed.ts` — confirmed minimal 5-user seed
- `scripts/src/seed.ts` — confirmed rich seed + pool.end() call
- `artifacts/api-server/src/lib/encryption.ts` — confirmed lazy validation (call-time only)
- `artifacts/api-server/src/lib/jwt.ts` — confirmed module-load validation
- `artifacts/riskmind-app/vite.config.ts` — confirmed 3 Replit plugin imports
- `package.json` — confirmed @replit/connectors-sdk in root dependencies
- `pnpm-workspace.yaml` — confirmed 3 Replit entries in catalog
- `lib/db/src/index.ts` — confirmed ensureExtensions() pattern
- `lib/db/package.json` — confirmed `push` and `bootstrap` scripts
- PostgreSQL 16.13 running, PM2 6.0.10 installed, no riskmind database, no dist builds

### Secondary (MEDIUM confidence)
- PM2 `env_file` support confirmed in PM2 v5+ documentation pattern; PM2 6.0.10 installed
- pgvector package available via `apt-cache search pgvector` returning `postgresql-16-pgvector`
- Express 5 static file serving — standard documented API (express.static + sendFile)

### Tertiary (LOW confidence)
- None — all critical claims are based on direct code inspection or confirmed system state

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already installed and configured; versions confirmed
- Architecture: HIGH — insertion points identified by direct code inspection
- Pitfalls: HIGH — identified from actual code gaps (encryption.ts lazy validation, seed pool.end(), missing pgvector)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable infrastructure tools)
