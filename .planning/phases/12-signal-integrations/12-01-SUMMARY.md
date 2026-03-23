---
phase: 12-signal-integrations
plan: "01"
subsystem: api
tags: [node-cron, imapflow, mailparser, azure-identity, p-ratelimit, encryption, signals, integration, cron]

requires:
  - phase: 09-schema-foundation
    provides: integrationConfigsTable schema with AES-256-GCM encrypted_config, signalsTable with content_hash dedup index
  - phase: 12-signal-integrations
    provides: 12-CONTEXT.md and 12-RESEARCH.md with adapter interface design and source-specific API details

provides:
  - SignalFeedAdapter interface and per-source config types (NvdConfig, ShodanConfig, SentinelConfig, MispConfig, EmailConfig) in src/adapters/types.ts
  - adapters registry (Record<string, SignalFeedAdapter>) for runtime adapter registration by Plans 02-04
  - computeContentHash(content) SHA-256 utility
  - 6 REST endpoints under /v1/integrations (GET list masked, POST upsert, PATCH, DELETE, POST /test, POST /trigger)
  - Credential encryption on create/update — GET never returns raw encryptedConfig
  - startSignalFeedPoller() cron scheduler for all 5 source types wired into server startup
  - pollSourceForAllTenants(sourceType) exported for ad-hoc polling
  - Signal dedup via onConflictDoNothing() in both trigger endpoint and poller
  - ai-triage job enqueue for each newly inserted signal

affects:
  - 12-02-PLAN.md (NVD adapter)
  - 12-03-PLAN.md (Shodan + Sentinel adapters)
  - 12-04-PLAN.md (MISP + email adapters)
  - 12-05-PLAN.md (Settings UI — consumes GET /v1/integrations, POST /v1/integrations/:id/test)

tech-stack:
  added:
    - imapflow ^1.2.16 (IMAP client for email adapter)
    - mailparser ^3.9.4 (email parsing)
    - "@azure/identity" ^4.13.1 (Azure token acquisition for Sentinel)
    - p-ratelimit ^1.0.1 (rate limiting for external API calls)
    - node-cron ^4.2.1 (cron scheduler)
    - "@types/node-cron" ^3.0.11
    - "@types/mailparser" ^3.4.6
  patterns:
    - Adapter registry pattern — adapters: Record<string, SignalFeedAdapter> populated by concrete adapter modules
    - Credential masking in GET responses — select all columns except encryptedConfig, append "[encrypted]" sentinel
    - Cron-per-source-type — one scheduled job per source type in DEFAULT_SCHEDULES
    - Per-tenant error isolation — pollSingleConfig errors caught, written to lastError, do not stop other tenants
    - p() helper for Express params — String(req.params[name]) to satisfy TypeScript string | string[] type

key-files:
  created:
    - artifacts/api-server/src/adapters/types.ts
    - artifacts/api-server/src/routes/integrations.ts
    - artifacts/api-server/src/lib/signal-feed-poller.ts
  modified:
    - artifacts/api-server/src/routes/index.ts (integrationsRouter registered)
    - artifacts/api-server/src/index.ts (startSignalFeedPoller wired)
    - artifacts/api-server/package.json (5 deps + 2 devDeps added)
    - pnpm-lock.yaml

key-decisions:
  - "adapters registry is a plain mutable object in types.ts — concrete adapters import and register themselves at module load, no DI framework needed"
  - "trigger endpoint returns { ok, message, signalsCreated: 0 } when adapter not yet registered — graceful degradation while Plans 02-04 build adapters"
  - "p() helper used for all Express params to satisfy TypeScript string | string[] type — consistent with signals.ts pattern"
  - "pollSourceForAllTenants filters isActive in JS after DB query (not SQL) — simpler and the number of integration configs per source type is small"

patterns-established:
  - "Adapter pattern: implement SignalFeedAdapter interface, import adapters registry, set adapters['type'] = implementation"
  - "Signal insertion: onConflictDoNothing on (tenantId, source, contentHash) unique index, then enqueue ai-triage only for inserted rows"
  - "Credential encryption: encrypt(JSON.stringify(configObj)) on write, decrypt + JSON.parse on read — never expose raw encryptedConfig in responses"

requirements-completed: [SGNL-01, SGNL-02, SGNL-03, SGNL-04, SGNL-05]

duration: 7min
completed: "2026-03-23"
---

# Phase 12 Plan 01: Signal Integrations Foundation Summary

**Integration config CRUD with AES-256-GCM credential encryption, adapter interface for 5 threat feed sources, and node-cron scheduler polling all active integrations on per-source schedules**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-23T16:41:31Z
- **Completed:** 2026-03-23T16:48:56Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed all Phase 12 npm dependencies (imapflow, mailparser, @azure/identity, p-ratelimit, node-cron) and type packages
- Created SignalFeedAdapter interface + per-source config types + adapters registry + computeContentHash utility — the shared contract all 5 adapter plans (02-04) implement against
- Built 6-endpoint integrations router: GET (creds masked), POST upsert (encrypted), PATCH, DELETE, POST /test (dispatches to adapter), POST /trigger (polls + deduplicates + enqueues ai-triage)
- Built signal-feed-poller with DEFAULT_SCHEDULES cron jobs for all 5 source types, per-tenant error isolation, and lastPolledAt/lastError bookkeeping

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, create adapter types, and build integrations route** - `9e3671c` (feat)
2. **Task 2: Build signal feed poller scheduler and wire into server startup** - `1bd05d7` (feat)

## Files Created/Modified
- `artifacts/api-server/src/adapters/types.ts` - SignalFeedAdapter interface, RawSignal, per-source config types, adapters registry, computeContentHash
- `artifacts/api-server/src/routes/integrations.ts` - 6-endpoint CRUD + test + trigger router with credential encryption
- `artifacts/api-server/src/lib/signal-feed-poller.ts` - Cron scheduler for all 5 source types, pollSingleConfig, per-tenant error isolation
- `artifacts/api-server/src/routes/index.ts` - Added integrationsRouter after monitoringRouter
- `artifacts/api-server/src/index.ts` - Added startSignalFeedPoller() call after startAgentScheduler()
- `artifacts/api-server/package.json` - Added 5 prod deps + 2 dev type deps
- `pnpm-lock.yaml` - Lock file updated

## Decisions Made
- adapters registry is a plain mutable Record in types.ts — concrete adapter modules register at import time, no DI framework needed
- trigger endpoint returns graceful `{ ok: false, message: "Adapter not yet available", signalsCreated: 0 }` when adapter not yet registered — allows Plans 02-04 to be deployed incrementally
- p() helper for Express params follows the existing signals.ts pattern to satisfy TypeScript `string | string[]` type constraint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Express req.params type error in integrations.ts**
- **Found during:** Task 2 verification (TypeScript check)
- **Issue:** `req.params.id` is typed as `string | string[]` in Express 5 types, causing TS2345/TS2769 errors on all `eq(integrationConfigsTable.id, id)` calls
- **Fix:** Added `p(req, name)` helper using `String(req.params[name])` — same pattern used in signals.ts
- **Files modified:** artifacts/api-server/src/routes/integrations.ts
- **Verification:** `pnpm --filter @workspace/api-server typecheck` reports zero integrations.ts errors
- **Committed in:** 1bd05d7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix necessary for correct TypeScript compilation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in monitoring.ts (line 93) and vendors.ts (line 633) related to `Date` not assignable to Drizzle column type — these are out of scope and were not touched.

## Next Phase Readiness
- Adapter interface and registry ready for Plans 02-04 to implement concrete adapters
- Integration CRUD endpoints ready for Settings UI (Plan 05)
- Cron scheduler will auto-start on server boot — adapters registered during startup will be immediately active

---
*Phase: 12-signal-integrations*
*Completed: 2026-03-23*
