# Phase 1: Server Foundation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Strip all Replit-specific dependencies, provision a fresh PostgreSQL database with pgvector and seed data, build all workspace packages, configure Express to serve both the REST API and the React SPA from port 4000, and manage the process with PM2. The app must be accessible locally with working login before Phase 2 (Cloudflare tunnel) begins.

</domain>

<decisions>
## Implementation Decisions

### Static File Serving
- Catch-all SPA fallback: `express.static` for built assets from `artifacts/riskmind-app/dist/public/`, then any non-`/api` non-`/mcp` path returns `index.html`
- SPA served at root `/` (no subpath)
- In development, run Vite dev server separately on its own port with HMR; production builds are served through Express
- Static middleware must be added to `artifacts/api-server/src/app.ts` — it currently has none

### Seed Data Strategy
- Use the rich seed script (`scripts/src/seed.ts`) — creates tenant "Acme Corp", 6 users, 10 risks, 5 vendors, 3 frameworks, alerts, signals
- Trigger: auto at server startup (check if empty, seed if so) — integrate rich seed into the startup flow
- Keep simple credentials: `*@acme.com / password123` for all demo users
- The minimal in-process seed (`api-server/src/lib/seed.ts`) should be replaced or enhanced with the rich seed logic

### Environment Variable Management
- Create `.env.example` with all required vars (documented placeholders)
- Create `.env` with actual values, add `.env` to `.gitignore`
- Required vars: `DATABASE_URL`, `PORT=4000`, `JWT_SECRET`, `ENCRYPTION_KEY`
- Add upfront startup validation: check ALL required env vars exist before server starts — fail fast with clear error messages (ENCRYPTION_KEY currently fails silently at call time, not at startup)
- Auto-generate `JWT_SECRET` and `ENCRYPTION_KEY` if missing on first run — generate random secrets and save to `.env`

### PM2 Configuration
- Single instance only — no cluster mode (the PostgreSQL-backed job queue is stateful/in-process)
- `ecosystem.config.cjs` with `script: "artifacts/api-server/dist/index.cjs"`, env vars loaded from `.env`
- PM2 log rotation via `pm2-logrotate` module: 10MB max file size, 10 files retained
- No watch mode — production behavior, restart only on crash or manual deploy
- `pm2 startup` + `pm2 save` for boot persistence

### Replit Dependency Stripping
- Remove `@replit/connectors-sdk` from root `package.json` (not imported anywhere in source — safe to remove)
- Remove `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal` from:
  - `pnpm-workspace.yaml` catalog entries
  - `artifacts/riskmind-app/package.json` devDependencies
  - `artifacts/mockup-sandbox/package.json` devDependencies
- Clean up `artifacts/riskmind-app/vite.config.ts`: remove all `@replit/*` imports and the `REPL_ID` conditional block, remove `runtimeErrorOverlay()` plugin usage
- Remove `.replit` and `.replitignore` files

### Database Provisioning
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Express app and server entry
- `artifacts/api-server/src/app.ts` — Express middleware chain, CORS config (currently open), route mounting, no static middleware yet
- `artifacts/api-server/src/index.ts` — Server startup, PORT validation, current seedDemoDataIfEmpty() call

### Build system
- `artifacts/api-server/build.ts` — esbuild config producing `dist/index.cjs`
- `artifacts/riskmind-app/vite.config.ts` — Vite config with Replit plugins to strip, output to `dist/public/`

### Database
- `lib/db/src/index.ts` — Pool creation, `ensureExtensions()` for pgvector
- `lib/db/src/bootstrap.ts` — Standalone bootstrap script for pgvector extension
- `lib/db/drizzle.config.ts` — Drizzle-kit config
- `lib/db/migrations/0001_risk_executive_role_and_acceptance_memoranda.sql` — Manual migration

### Seed scripts
- `scripts/src/seed.ts` — Rich seed: tenant, users, risks, vendors, frameworks, alerts, signals
- `artifacts/api-server/src/lib/seed.ts` — Minimal startup seed: tenant + 5 users only

### Environment and encryption
- `artifacts/api-server/src/lib/jwt.ts` — JWT_SECRET validation (throws at module load)
- `artifacts/api-server/src/lib/encryption.ts` — ENCRYPTION_KEY validation (throws at call time, NOT module load)

### Replit files to remove
- `package.json` — root `@replit/connectors-sdk` dependency
- `pnpm-workspace.yaml` — catalog entries for 3 Replit Vite plugins
- `artifacts/riskmind-app/package.json` — devDependencies for Replit plugins
- `artifacts/mockup-sandbox/package.json` — devDependencies for Replit plugins
- `.replit`, `.replitignore` — Replit config files

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ensureExtensions()` in `lib/db/src/index.ts` — handles pgvector CREATE EXTENSION
- `seedDemoDataIfEmpty()` in `api-server/src/lib/seed.ts` — existing startup seed hook (to be enhanced)
- Rich seed script at `scripts/src/seed.ts` — comprehensive demo data creation
- `build.ts` in api-server — esbuild bundler already configured

### Established Patterns
- esbuild for API server → `dist/index.cjs` (CJS output)
- Vite for frontend → `dist/public/` (static assets)
- drizzle-kit push for schema management (not migrate)
- Environment validation at module load for critical vars (JWT_SECRET)

### Integration Points
- `app.ts` line ~end: before 404 handler is where static middleware + SPA fallback goes
- `index.ts` line ~26: `seedDemoDataIfEmpty()` call is the hook for enhanced seeding
- `index.ts` lines 9-15: PORT validation is the hook for env var validation expansion

</code_context>

<specifics>
## Specific Ideas

- Rich seed auto-runs at startup — check if empty, seed if so
- Auto-generate JWT_SECRET and ENCRYPTION_KEY on first run if missing
- Port 4000 for the Express server (avoiding conflicts with 3000, 5173, 9323)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-server-foundation*
*Context gathered: 2026-03-17*
