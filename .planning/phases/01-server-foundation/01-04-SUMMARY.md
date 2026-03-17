---
phase: 01-server-foundation
plan: "04"
subsystem: infra
tags: [express, static-serving, spa, vite, esbuild, react]

# Dependency graph
requires:
  - phase: 01-01
    provides: Express app skeleton with /api router and basic middleware
  - phase: 01-03
    provides: Database provisioned with schema and demo seed data
provides:
  - Express serves built React SPA on all non-API routes via static middleware + catch-all fallback
  - api-server dist/index.cjs bundle (esbuild CJS output)
  - riskmind-app dist/public/ Vite bundle (React SPA)
  - Single-process full-stack serving: API + SPA on port 4000
affects: [02-cloudflare-tunnel, 03-auth, 04-ai-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - express.static middleware pointing to Vite build output directory
    - SPA fallback regex route excluding /api and /mcp prefixes
    - Native CJS __dirname for path resolution (esbuild CJS output compatible)

key-files:
  created: []
  modified:
    - artifacts/api-server/src/app.ts

key-decisions:
  - "Use native __dirname instead of fileURLToPath(import.meta.url) — esbuild CJS output makes import.meta empty, __dirname is natively available in CJS runtime"
  - "SPA fallback uses regex /^(?!\\/api|\\/mcp).*$/ to preserve API 404 handler for unmatched /api/* routes"
  - "Build mockup-sandbox separately excluded — pre-existing Replit imports cause typecheck failure, not related to deployment"

patterns-established:
  - "Static serving: express.static(spaDistPath) BEFORE SPA fallback, AFTER API router"
  - "Path resolution: path.resolve(__dirname, '../../riskmind-app/dist/public') from compiled CJS location"

requirements-completed: [DEPL-03, DEPL-04]

# Metrics
duration: 15min
completed: 2026-03-17
---

# Phase 1 Plan 04: Static Serving + Full-Stack Build Summary

**Express serves built React SPA via express.static + catch-all fallback, full-stack running on port 4000 with esbuild CJS bundle and Vite production assets**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-17T16:45:00Z
- **Completed:** 2026-03-17T17:00:00Z
- **Tasks:** 3
- **Files modified:** 1 (app.ts)

## Accomplishments

- Added `express.static` middleware to serve built React SPA assets from `artifacts/riskmind-app/dist/public/`
- Added SPA fallback route (regex catch-all for non-API/non-MCP paths) that sends `index.html`
- Built both workspace packages: api-server (esbuild CJS 1.6mb) and riskmind-app (Vite 641kb JS + 121kb CSS)
- Verified full-stack: API health 200, SPA root returns `<!DOCTYPE html`, dashboard fallback returns `<!DOCTYPE html`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add static file serving and SPA fallback to app.ts** - `b76e60b` (feat)
2. **Task 1 (deviation fix): CJS compatibility fix** - `024ab06` (fix)
3. **Task 2: Build workspace packages** - no separate commit (dist/ is gitignored)
4. **Task 3: Server verification** - no code changes (runtime only)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `artifacts/api-server/src/app.ts` - Added path import, express.static middleware, SPA fallback regex route

## Decisions Made

- Used native `__dirname` instead of `fileURLToPath(import.meta.url)` — esbuild CJS output makes `import.meta` an empty object, so `import.meta.url` would be `undefined` at runtime and throw a TypeError. Native CJS `__dirname` works correctly in the compiled bundle.
- SPA fallback uses negative lookahead regex `(?!\/api|\/mcp)` so the existing 404 handler still catches unmatched `/api/*` routes (returns 401 due to auth middleware — auth fires before route matching resolution).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import.meta.url CJS incompatibility**
- **Found during:** Task 2 (Build all workspace packages)
- **Issue:** Plan specified using `fileURLToPath(import.meta.url)` for path resolution. esbuild's CJS output makes `import.meta` an empty object `{}`, so `import.meta.url` is `undefined`. `fileURLToPath(undefined)` throws `TypeError` at server startup.
- **Fix:** Removed `fileURLToPath`/`import.meta.url` pattern, replaced with native `__dirname` which is available as a CJS global in the compiled output. Removed `fileURLToPath` import from `"url"` module.
- **Files modified:** `artifacts/api-server/src/app.ts`
- **Verification:** esbuild rebuilds with no warnings (previously: `"import.meta" is not available with the "cjs" output format`). Server started and served correctly.
- **Committed in:** `024ab06` (fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential correctness fix — without it, the server would crash on startup with a TypeError. No scope creep.

## Issues Encountered

- `pnpm run build` (workspace-wide) fails due to `mockup-sandbox` package having pre-existing `@replit/vite-plugin-*` import errors. Per plan guidance, built the two critical packages individually: `@workspace/api-server` and `@workspace/riskmind-app`. Both build successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full stack is running: API + React SPA served from single Express process on port 4000
- Database seeded with demo data (Acme Corp tenant, 6 users, 10 risks, frameworks)
- Ready for Phase 2: Cloudflare tunnel exposure and HTTPS access

---
*Phase: 01-server-foundation*
*Completed: 2026-03-17*
