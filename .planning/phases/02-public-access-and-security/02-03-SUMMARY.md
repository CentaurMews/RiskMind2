---
phase: 02-public-access-and-security
plan: 03
subsystem: infra
tags: [cloudflare, cors, sse, smoke-test, verification]

# Dependency graph
requires:
  - phase: 02-01
    provides: CORS lockdown and SSE flushHeaders fix in app.ts
  - phase: 02-02
    provides: cloudflared-riskmind.service running and routing https://app.riskmind.net → localhost:4000
provides:
  - Phase 2 sign-off — app is demo-ready at https://app.riskmind.net
  - Verified: CORS whitelist enforced (authorized origins pass, unauthorized origins rejected)
  - Verified: Login, navigation, and risk data all load correctly from the public URL
affects:
  - Phase 03 (AI enrichment) — public URL confirmed accessible and CORS-correct before AI features built

# Tech tracking
tech-stack:
  added: []
  patterns: [curl smoke-test suite for CORS and tunnel health before human verification checkpoint]

key-files:
  created: []
  modified:
    - artifacts/api-server/src/app.ts  # CORS callback(null, false) fix applied during Task 1

key-decisions:
  - "Use callback(null, false) for CORS rejection (not new Error()) to avoid Express treating CORS block as unhandled error"

patterns-established:
  - "Smoke-test pattern: 5 curl tests (health, CORS allow, CORS reject, preflight, SPA root) before any human checkpoint"

requirements-completed: [NET-05]

# Metrics
duration: ~5min
completed: 2026-03-18
---

# Phase 2 Plan 03: Public Access Verification Summary

**All 5 automated CORS and tunnel smoke tests pass and user confirmed browser login, navigation, and risk data load correctly at https://app.riskmind.net**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-18T06:30:00Z
- **Completed:** 2026-03-18T06:35:00Z
- **Tasks:** 2 (Task 1: automated smoke tests, Task 2: human browser verification)
- **Files modified:** 1 (app.ts — CORS rejection bug fix)

## Accomplishments

- All 5 curl smoke tests pass: tunnel health (200), CORS allowed origin, CORS unauthorized origin rejected, OPTIONS preflight, SPA root (200)
- Browser verification confirmed: login page loads, seed-credential login succeeds, risks page loads data — no CORS errors in console
- CORS rejection bug fixed: changed `callback(new Error(...))` to `callback(null, false)` to prevent Express treating CORS block as unhandled error

## Task Commits

1. **Task 1: Run automated smoke tests** — `019fa5b` (fix: CORS callback(null, false))
2. **Task 2: Human browser verification** — approved by user (no code changes)

## Files Created/Modified

- `artifacts/api-server/src/app.ts` — CORS origin callback fixed to use `callback(null, false)` for rejection

## Decisions Made

- CORS rejection uses `callback(null, false)` not `callback(new Error(...))` — the Error variant causes Express to emit an unhandled error response with stack trace rather than a clean CORS block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CORS rejection callback signature**
- **Found during:** Task 1 (automated smoke tests)
- **Issue:** CORS origin whitelist was calling `callback(new Error('Not allowed by CORS'))` for unauthorized origins, which Express treats as an unhandled error rather than a clean rejection
- **Fix:** Changed to `callback(null, false)` — cors middleware then omits the Access-Control-Allow-Origin header cleanly
- **Files modified:** `artifacts/api-server/src/app.ts`
- **Verification:** Test 3 smoke test confirmed no CORS header present for evil.com origin
- **Committed in:** `019fa5b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix required for correct CORS rejection behavior; no scope creep.

## Issues Encountered

None beyond the CORS callback bug (auto-fixed above).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 2 complete: app publicly accessible at https://app.riskmind.net with CORS enforced and SSE streaming ready
- Login and navigation confirmed working from public URL with seed data
- Phase 3 (AI enrichment) can proceed — all NET requirements satisfied

---
*Phase: 02-public-access-and-security*
*Completed: 2026-03-18*
