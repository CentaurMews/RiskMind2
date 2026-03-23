---
phase: 01-server-foundation
plan: "01"
subsystem: infra
tags: [pnpm, vite, replit, monorepo, build-config]

# Dependency graph
requires: []
provides:
  - Clean monorepo package manifests with no @replit/* references
  - Regenerated pnpm-lock.yaml with 471 packages and zero Replit entries
  - Clean vite.config.ts using only react() and tailwindcss() plugins
  - Deleted .replit and .replitignore files
affects: [02-database-layer, 03-api-server, all-subsequent-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vite.config.ts uses react() + tailwindcss() only — no environment-specific plugins"
    - "pnpm workspace catalog for shared dependency versions"

key-files:
  created: []
  modified:
    - package.json
    - pnpm-workspace.yaml
    - artifacts/riskmind-app/package.json
    - artifacts/mockup-sandbox/package.json
    - artifacts/riskmind-app/vite.config.ts
    - pnpm-lock.yaml

key-decisions:
  - "Remove @replit/* packages entirely rather than conditionally disabling them — clean install path on server"
  - "Use plugins: [react(), tailwindcss()] only in vite.config.ts — no runtime conditionals"

patterns-established:
  - "No Replit-specific plugins or config anywhere in the monorepo"

requirements-completed: [DEPL-01]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 1 Plan 01: Strip Replit Dependencies Summary

**Removed all @replit/* packages from monorepo manifests and lockfile, producing a clean pnpm workspace that installs and builds on a standard Linux server**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T16:32:19Z
- **Completed:** 2026-03-17T16:34:53Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Removed @replit/connectors-sdk from root package.json (entire dependencies block removed)
- Removed 3 @replit/vite-plugin-* catalog entries from pnpm-workspace.yaml
- Removed Replit devDependencies from both frontend packages (riskmind-app and mockup-sandbox)
- Replaced vite.config.ts with clean version: only react() + tailwindcss() plugins, no REPL_ID conditional
- Deleted .replit and .replitignore config files
- Regenerated pnpm-lock.yaml via `pnpm install` — 471 packages, zero @replit references

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Replit packages from all manifests** - `b6a47a5` (chore)
2. **Task 2: Clean vite.config.ts and delete Replit config files** - `0c8e6bb` (chore)
3. **Task 3: Run pnpm install to regenerate lockfile** - `cddb56d` (chore)

## Files Created/Modified
- `package.json` - Removed @replit/connectors-sdk and the entire dependencies block
- `pnpm-workspace.yaml` - Removed 3 @replit/vite-plugin-* catalog entries
- `artifacts/riskmind-app/package.json` - Removed 3 @replit devDependencies
- `artifacts/mockup-sandbox/package.json` - Removed 2 @replit devDependencies
- `artifacts/riskmind-app/vite.config.ts` - Clean version with react() + tailwindcss() only
- `pnpm-lock.yaml` - Regenerated without any @replit packages

## Decisions Made
- Removed entire `dependencies` block from root package.json rather than leaving an empty object — cleaner manifest
- vite.config.ts uses compact inline plugin array `plugins: [react(), tailwindcss()]` — matches plan spec exactly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all three tasks completed without errors. `pnpm install` resolved 473 packages and added 471 in ~54 seconds.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Monorepo is now dependency-clean and installs successfully on any standard Linux server
- Ready for Phase 1 Plan 02 (database layer setup)
- No blockers

---
## Self-Check: PASSED

All files verified present, all commits verified in git log.

*Phase: 01-server-foundation*
*Completed: 2026-03-17*
