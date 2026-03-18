---
phase: 02-public-access-and-security
plan: 01
subsystem: api
tags: [cors, express, sse, cloudflare, security]

# Dependency graph
requires:
  - phase: 01-server-foundation
    provides: Express server on port 4000 with PM2 process management
provides:
  - CORS middleware locked to explicit origin whitelist (app.riskmind.net + localhost:4000)
  - SSE endpoint with immediate header flush via res.flushHeaders()
affects: [03-ai-and-integrations, 04-production-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: [function-based CORS origin whitelist with credentials support, res.flushHeaders() before SSE streaming loop]

key-files:
  created: []
  modified:
    - artifacts/api-server/src/app.ts
    - artifacts/api-server/src/routes/interviews.ts

key-decisions:
  - "Function-based CORS origin whitelist (not string/regex) required because credentials: true is incompatible with origin: '*'"
  - "res.flushHeaders() inserted after X-Accel-Buffering header to prevent Cloudflare from buffering SSE until stream close"

patterns-established:
  - "CORS Pattern: ALLOWED_ORIGINS constant + function callback — use this pattern for any future CORS-restricted endpoints"
  - "SSE Pattern: setHeader block → res.flushHeaders() → streaming loop — mandatory for proxy-traversing SSE"

requirements-completed: [NET-03, NET-04]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 2 Plan 01: CORS Lockdown and SSE Header Flush Summary

**Express CORS locked to two-origin whitelist (app.riskmind.net + localhost:4000) and SSE endpoint fixed with res.flushHeaders() to prevent Cloudflare buffering**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-18T06:07:00Z
- **Completed:** 2026-03-18T06:15:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Replaced open `cors()` call with ALLOWED_ORIGINS whitelist and function-based origin validator
- Added `credentials: true` to CORS config — required for JWT Authorization header support
- Inserted `res.flushHeaders()` immediately after SSE header block in interviews.ts
- Verified build compiles cleanly and PM2 restarts with "Server listening on port 4000"
- Confirmed CORS enforcement: localhost:4000 returns Access-Control-Allow-Origin, evil.com gets none

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock CORS to explicit origin whitelist** - `b80d542` (feat)
2. **Task 2: Add res.flushHeaders() to SSE endpoint** - `eb64832` (feat)
3. **Task 3: Rebuild api-server and verify TypeScript compiles cleanly** - `9911ef8` (chore)

## Files Created/Modified

- `artifacts/api-server/src/app.ts` - Added ALLOWED_ORIGINS constant, replaced open cors() with function-based whitelist + credentials: true
- `artifacts/api-server/src/routes/interviews.ts` - Inserted res.flushHeaders() after X-Accel-Buffering header, before SSE streaming loop

## Decisions Made

- Function-based CORS origin callback required (not `origin: ALLOWED_ORIGINS` array) because Express cors middleware with `credentials: true` requires either a function or explicit origin value — however the array form also works; the function form was chosen per plan specification to allow future conditional logic.
- res.flushHeaders() positioned strictly after all four setHeader calls and strictly before `let fullResponse = ""` — this ensures HTTP/1.1 200 and all headers flush over TCP before any data is buffered.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CORS secured — API is safe to expose via Cloudflare tunnel
- SSE streaming will work progressively through Cloudflare proxy (tokens arrive token-by-token, not buffered until close)
- Ready for Phase 2 Plan 02 (Cloudflare tunnel configuration and public DNS setup)

---
*Phase: 02-public-access-and-security*
*Completed: 2026-03-18*
