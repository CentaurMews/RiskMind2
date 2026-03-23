---
phase: 12-signal-integrations
plan: "03"
subsystem: api
tags: [azure, sentinel, misp, threat-intelligence, signal-adapters, log-analytics, oauth2, kql]

# Dependency graph
requires:
  - phase: 12-01
    provides: SignalFeedAdapter interface, RawSignal type, computeContentHash, adapters registry in types.ts

provides:
  - sentinelAdapter — ClientSecretCredential OAuth2 + KQL against SecurityIncident table in Log Analytics
  - mispAdapter — Bearer token REST API + /events/restSearch with incremental timestamp sync + IoC attribute grouping
  - Both adapters registered in adapter barrel index.ts

affects: [12-04, 12-05, 13-signal-display]

# Tech tracking
tech-stack:
  added: ["@azure/identity ^4.13.1 (already installed from 12-01)"]
  patterns:
    - "Log Analytics REST API: POST /v1/workspaces/{id}/query with KQL, parse tables[0].columns + rows"
    - "MISP restSearch: POST /events/restSearch with Unix timestamp for incremental sync, group Attribute[] by type"
    - "Adapter registration: concrete adapter file exports named export, barrel index.ts assigns to adapters[type]"

key-files:
  created:
    - artifacts/api-server/src/adapters/sentinel.ts
    - artifacts/api-server/src/adapters/misp.ts
  modified:
    - artifacts/api-server/src/adapters/index.ts

key-decisions:
  - "Sentinel uses ClientSecretCredential.getToken('https://api.loganalytics.io/.default') — scope is .default for Log Analytics, not management.azure.com"
  - "Log Analytics row mapping: zip table.columns[].name with row values to produce Record<string, unknown>[] per result"
  - "MISP threat level filter uses numeric ID (1-4) in search body, mapped to labels for display only"
  - "MISP IoC summary built from grouped attribute counts rather than raw values to keep content concise for LLM triage"

patterns-established:
  - "Pattern: KQL row deserialization — columns array + rows[][] mapped to Record<string,unknown>[] via index zip"
  - "Pattern: MISP attribute grouping — single pass over Attribute[], categorize by type string into named buckets"

requirements-completed: [SGNL-03, SGNL-04]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 12 Plan 03: Sentinel and MISP Signal Adapters Summary

**Sentinel adapter uses ClientSecretCredential OAuth2 + KQL against SecurityIncident table; MISP adapter uses Bearer token REST API with Unix timestamp incremental sync and IoC attribute grouping by type**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-23T17:17:34Z
- **Completed:** 2026-03-23T17:21:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Sentinel adapter authenticates via service principal, queries SecurityIncident via KQL, normalizes incidents to signals with severity/status/classification metadata, deduplicates by incident number
- MISP adapter connects with per-tenant API key, searches events with incremental timestamp filter, groups IoC attributes (IPs, domains, hashes, CVEs, emails, URLs) by type, normalizes to signals with threat level labels
- Both adapters registered in adapter barrel and callable by signal feed poller; both implement testConnection for Settings UI validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement Microsoft Sentinel adapter via Log Analytics REST API** - `d7d3963` (feat)
2. **Task 2: Implement MISP REST API adapter** - `913f1a3` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `artifacts/api-server/src/adapters/sentinel.ts` — ClientSecretCredential OAuth2, KQL SecurityIncident query, row deserialization, dedup by incident number
- `artifacts/api-server/src/adapters/misp.ts` — API key Bearer auth, POST /events/restSearch with Unix timestamp, attribute grouping, IoC summary, dedup by event ID
- `artifacts/api-server/src/adapters/index.ts` — Sentinel and MISP adapters registered in barrel

## Decisions Made
- Sentinel token scope is `https://api.loganalytics.io/.default` (not management.azure.com) — required for Log Analytics workspace query access
- Log Analytics response format: `tables[0].columns[].name` zipped with `tables[0].rows[][]` to produce named-field objects — column index mapping done at parse time
- MISP threat level ID (1-4 integer from API) mapped to display label only; raw integer stored in metadata for programmatic filtering downstream
- IoC summary in signal content uses counts (e.g., "3 IP(s), 2 domain(s)") rather than raw values — keeps content concise for LLM triage without exceeding token budgets

## Deviations from Plan

None — plan executed exactly as written. Both adapters match the specification precisely including all required fields, deduplication strategy, and testConnection patterns.

## Issues Encountered

The `pnpm build` output showed pre-existing TypeScript errors in `src/routes/monitoring.ts` and `src/routes/vendors.ts` (Date type mismatches on Drizzle update calls) and Replit-specific type errors in `mockup-sandbox/vite.config.ts`. These are unrelated to the adapter changes and were present before this plan. All adapter files are error-free under `tsc --noEmit`.

## User Setup Required

None — no external service configuration required in this plan. Sentinel and MISP credentials are stored per-tenant in `integration_configs` (Phase 12-01) via the Settings Integrations UI.

## Next Phase Readiness
- Sentinel and MISP adapters complete and registered — callable by signal feed poller (Plan 12-01)
- SGNL-03 and SGNL-04 requirements fulfilled
- Plan 12-04 (Email adapter) can proceed independently — uses same adapter pattern

---
*Phase: 12-signal-integrations*
*Completed: 2026-03-23*
