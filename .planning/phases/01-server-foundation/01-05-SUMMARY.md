---
phase: 01-server-foundation
plan: "05"
subsystem: infra
tags: [pm2, process-management, log-rotation, boot-persistence, node20]

# Dependency graph
requires:
  - phase: 01-server-foundation
    provides: "Built Express API server + React SPA (dist/index.cjs) with DB seeded"
provides:
  - "PM2 process supervision for riskmind (auto-restart on crash)"
  - "Log rotation via pm2-logrotate (10MB / 10 files)"
  - "Boot persistence via systemd pm2-root.service"
  - "ecosystem.config.cjs at repo root"
affects: [02-cloudflare-tunnel, deployment]

# Tech tracking
tech-stack:
  added: [pm2@6.0.10, pm2-logrotate@3.0.0]
  patterns: [Node 20 --env-file flag for .env loading instead of PM2 env_file]

key-files:
  created:
    - ecosystem.config.cjs
    - logs/.gitkeep
  modified:
    - .gitignore

key-decisions:
  - "PM2 6.x env_file option broken — use node_args: '--env-file /home/dante/RiskMind2/.env' (Node 20 native) instead"
  - "Boot persistence via systemd pm2-root.service (pm2 startup + pm2 save)"
  - "pm2-logrotate configured with 10MB max_size and 10 retained files"

patterns-established:
  - "Node 20 --env-file flag: use absolute path for reliable loading under PM2"

requirements-completed: [DEPL-05]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 1 Plan 05: PM2 Process Management Summary

**PM2 6.x process supervision with systemd boot persistence, pm2-logrotate (10MB/10 files), and Node 20 --env-file workaround for env loading**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T16:52:09Z
- **Completed:** 2026-03-17T16:57:00Z
- **Tasks:** 1 of 2 (checkpoint pending human verification)
- **Files modified:** 3

## Accomplishments
- ecosystem.config.cjs created with riskmind process config (fork mode, 1 instance, 1G memory limit)
- PM2 managing riskmind process as "online" serving on port 4000
- pm2-logrotate installed and configured (10MB max, 10 files, no compression)
- Boot persistence: systemd pm2-root.service enabled via pm2 startup + pm2 save
- All 5 Phase 1 acceptance criteria passing (health, SPA, demo login, PM2 status, env loaded)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ecosystem.config.cjs and start under PM2** - `0d32148` (feat)

**Plan metadata:** pending (after human verification)

## Files Created/Modified
- `ecosystem.config.cjs` - PM2 process config for riskmind (fork mode, node_args for env loading)
- `logs/.gitkeep` - Ensures logs/ directory tracked in git
- `.gitignore` - Added logs/*.log to exclude PM2 log files

## Decisions Made
- PM2 6.x `env_file` config option does not load `.env` file — switched to `node_args: "--env-file /home/dante/RiskMind2/.env"` using Node 20's native `--env-file` flag
- Used absolute path in `--env-file` to avoid CWD resolution issues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PM2 6.x env_file does not load .env**
- **Found during:** Task 1 (Create ecosystem.config.cjs and start under PM2)
- **Issue:** PM2 6.0.10 `env_file: ".env"` option silently fails to inject DATABASE_URL, causing server crash with "DATABASE_URL must be set"
- **Fix:** Replaced `env_file: ".env"` with `node_args: "--env-file /home/dante/RiskMind2/.env"` (Node 20.19.5 native flag)
- **Files modified:** ecosystem.config.cjs
- **Verification:** `curl -sf http://localhost:4000/api/v1/health` returns `{"status":"ok","database":"connected"}`
- **Committed in:** 0d32148 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Required to make server start at all. No scope creep.

## Issues Encountered
- PM2 6.x changed env_file behavior from earlier versions — documentation suggests it works but in practice it does not inject env vars. Node 20 native --env-file is a reliable workaround.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- riskmind process online and stable under PM2
- Boot persistence configured — process survives reboots
- Log rotation active — logs won't fill disk
- Ready for Phase 2: Cloudflare tunnel setup

## Self-Check: PASSED
- ecosystem.config.cjs: FOUND
- logs/.gitkeep: FOUND
- 01-05-SUMMARY.md: FOUND
- commit 0d32148: FOUND

---
*Phase: 01-server-foundation*
*Completed: 2026-03-17*
