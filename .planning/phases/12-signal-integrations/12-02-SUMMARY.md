---
phase: 12-signal-integrations
plan: "02"
subsystem: api
tags: [nvd, cve, shodan, adapters, rate-limiting, content-hash, deduplication, signal-feeds]

requires:
  - phase: 12-signal-integrations/12-01
    provides: SignalFeedAdapter interface in types.ts, adapter registry, signal-feed-poller, integrations CRUD routes

provides:
  - NVD CVE API v2 adapter with pagination (2000/page), rate limiting (45 req/30s), incremental sync via lastModStartDate
  - Shodan REST API adapter with DNS-resolve-first pattern, vendor linking, rate limiting (1 req/sec)
  - Adapter barrel index.ts that registers both adapters in the shared registry at import time
  - Both adapters implement testConnection for Settings UI validation

affects:
  - 12-signal-integrations/12-03 (Sentinel adapter will follow same patterns)
  - 12-signal-integrations/12-04 (MISP and Email adapters same)
  - signal-feed-poller (now has nvd and shodan adapters to dispatch to)

tech-stack:
  added: []
  patterns:
    - "p-ratelimit wraps every fetch call in adapter poll loops — no raw fetch calls bypass rate limiting"
    - "Content hash computed from JSON.stringify of normalized (sorted) fields — deterministic across polls"
    - "Adapter barrel index.ts registers concrete adapters — importing it populates the registry side-effect-free"
    - "DNS resolution before Shodan IP query — always /dns/resolve first, then /shodan/host/{ip}"
    - "Domain extracted from vendor contactEmail — skip generic free-tier providers (gmail, outlook, etc)"

key-files:
  created:
    - artifacts/api-server/src/adapters/nvd.ts
    - artifacts/api-server/src/adapters/shodan.ts
    - artifacts/api-server/src/adapters/index.ts
  modified:
    - artifacts/api-server/src/adapters/types.ts

key-decisions:
  - "Domain extraction uses vendor contactEmail — vendors table has no website column; email domain is the available domain signal"
  - "Adapter barrel index.ts preferred over direct import in types.ts — avoids circular dependency risk and keeps types.ts as pure interface definitions"
  - "Shodan adapter uses _since param but does not filter by it — Shodan host queries return current state, not deltas; every poll is a full snapshot"

patterns-established:
  - "SignalFeedAdapter.poll returns RawSignal[] — caller (signal-feed-poller) handles DB insert with onConflictDoNothing"
  - "testConnection validates real API credentials with minimal network call before returning ok/message"
  - "normalizedContent = JSON.stringify({sorted fields}) then computeContentHash — never hash raw response strings"

requirements-completed: [SGNL-01, SGNL-02]

duration: 5min
completed: 2026-03-23
---

# Phase 12 Plan 02: NVD and Shodan Signal Feed Adapters Summary

**NVD CVE v2 adapter with 2000/page pagination + Shodan adapter with DNS-resolve-first, both using p-ratelimit and content-hash deduplication, registered in shared adapter registry**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-23T16:51:23Z
- **Completed:** 2026-03-23T16:55:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- NVD adapter fetches CVE feeds with full pagination (startIndex loop), 45 req/30s rate limiting, incremental sync via lastModStartDate/lastModEndDate, CVSS v3.1/v3.0/v2 extraction with fallback chain, and content hash deduplication
- Shodan adapter resolves vendor contact email domains to IPs via Shodan /dns/resolve, queries /shodan/host/{ip} per IP, sorts ports and vulns for deterministic hashing, links signals to vendor IDs, and rate-limits at 1 req/sec
- Adapter barrel index.ts registers nvdAdapter and shodanAdapter in the adapters registry — imported once at startup, populates registry as a side effect

## Task Commits

1. **Task 1: NVD CVE API v2 adapter** - `3eb0a41` (feat)
2. **Task 2: Shodan REST API adapter** - `1cf6204` (feat)

**Plan metadata:** (created after this summary)

## Files Created/Modified

- `artifacts/api-server/src/adapters/nvd.ts` - NVD CVE API v2 adapter: pagination, rate limiting, CVSS extraction, content hash, testConnection
- `artifacts/api-server/src/adapters/shodan.ts` - Shodan REST API adapter: DNS resolve, host query, vendor linking, content hash, testConnection
- `artifacts/api-server/src/adapters/index.ts` - Barrel module that registers both adapters in the shared registry
- `artifacts/api-server/src/adapters/types.ts` - Added comment clarifying barrel registration pattern (no structural change)

## Decisions Made

- **Domain from contactEmail:** The vendors table has no `website` or `domain` column. Domain is extracted from vendor `contactEmail` (e.g., `security@acme.com` → `acme.com`). Generic free-tier providers (gmail, outlook, etc.) are skipped to avoid noisy results. Vendors without email are not scanned by Shodan.
- **Barrel over direct import:** `index.ts` barrel handles registration rather than importing adapters from `types.ts` — avoids potential circular dependency and keeps `types.ts` as a pure interface/utility module.
- **Shodan is a snapshot adapter:** The `since` parameter is accepted but not used — Shodan host queries return current state, not event deltas. Every poll is a full fingerprint refresh; deduplication handles "no change" via content hash.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `artifacts/api-server/src/routes/monitoring.ts` (line 93), `vendors.ts` (line 633), and `artifacts/riskmind-app/src/pages/signals/signal-list.tsx` / `vendor-list.tsx` were found during build verification. These are out of scope for Plan 02 (none are in adapter files). Logged to `.planning/phases/12-signal-integrations/deferred-items.md`.

## Next Phase Readiness

- Both adapters are callable by the signal-feed-poller's `pollSingleConfig` dispatch
- The adapter registry has `adapters["nvd"]` and `adapters["shodan"]` populated
- Plans 03 and 04 will add Sentinel, MISP, and Email adapters following the same patterns
- Pre-existing TS errors in non-adapter files should be addressed in a cleanup task before final phase gate

---
*Phase: 12-signal-integrations*
*Completed: 2026-03-23*
