---
phase: 02-public-access-and-security
plan: 02
subsystem: infra
tags: [cloudflare, cloudflared, tunnel, systemd, tls]

# Dependency graph
requires:
  - phase: 01-server-foundation
    provides: Express API running on localhost:4000
provides:
  - cloudflared-riskmind.service (systemd) — persists RiskMind Cloudflare tunnel across reboots
  - Named Cloudflare tunnel "riskmind" (7cc0204a-371a-4fe2-a889-e2c4f40f6a66) connected to app.riskmind.net
affects:
  - All phases that depend on https://app.riskmind.net being publicly accessible

# Tech tracking
tech-stack:
  added: [cloudflared tunnel token, systemd service unit]
  patterns: [Separate named systemd unit per tunnel (cloudflared-riskmind.service vs cloudflared.service)]

key-files:
  created:
    - /etc/systemd/system/cloudflared-riskmind.service
  modified: []

key-decisions:
  - "Separate systemd unit (cloudflared-riskmind.service) coexists with existing cloudflared.service without disrupting pdpl.pulsebridge.me"
  - "Tunnel token embedded directly in ExecStart — no separate config file needed for single-tunnel service"

patterns-established:
  - "Named tunnel pattern: one systemd unit per Cloudflare tunnel, named cloudflared-{project}.service"

requirements-completed: [NET-01, NET-02]

# Metrics
duration: 10min
completed: 2026-03-18
---

# Phase 2 Plan 02: Cloudflare Tunnel Service Summary

**Dedicated cloudflared-riskmind systemd service installed and running, connecting Cloudflare tunnel 7cc0204a to app.riskmind.net → localhost:4000**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-18T06:20:00Z
- **Completed:** 2026-03-18T06:28:00Z
- **Tasks:** 2 (Task 1: human checkpoint, Task 2: auto)
- **Files modified:** 1 (system file outside git repo)

## Accomplishments

- Named Cloudflare tunnel "riskmind" (UUID 7cc0204a-371a-4fe2-a889-e2c4f40f6a66) connected with 4 registered edge connections (mad05 + lis01)
- cloudflared-riskmind.service installed at /etc/systemd/system, enabled for boot, active and running
- Existing cloudflared.service (pdpl.pulsebridge.me → localhost:3000) confirmed undisturbed and still active
- Local app health confirmed: localhost:4000/api/v1/health returns {"status":"ok","database":"connected"}

## Task Commits

Task 2 installed a system file outside the git repository (/etc/systemd/system/cloudflared-riskmind.service). No in-repo files were modified by this plan.

1. **Task 1: Create Cloudflare tunnel in dashboard** — human action (completed by user, token provided)
2. **Task 2: Install cloudflared-riskmind.service** — service file written, daemon-reloaded, enabled, started

## Files Created/Modified

- `/etc/systemd/system/cloudflared-riskmind.service` — Systemd unit for cloudflared RiskMind tunnel (outside git repo)

## Decisions Made

- Separate named systemd unit per tunnel: `cloudflared-riskmind.service` coexists with existing `cloudflared.service` with no shared config
- Token embedded directly in ExecStart line (same pattern as existing cloudflared.service)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

**DNS CNAME not yet resolving:** After the service started and tunnel connected successfully, `dig app.riskmind.net` returns NXDOMAIN. The Cloudflare dashboard tunnel creation should have auto-created the CNAME `app.riskmind.net → 7cc0204a-371a-4fe2-a889-e2c4f40f6a66.cfargotunnel.com`. As of plan completion, the DNS record had not yet appeared.

**Status of acceptance criteria:**
- `systemctl is-active cloudflared-riskmind.service` → `active` (PASS)
- `systemctl is-enabled cloudflared-riskmind.service` → `enabled` (PASS)
- `grep "Description=cloudflared RiskMind"` → matches (PASS)
- Token placeholder not present in service file (PASS)
- `systemctl is-active cloudflared.service` → `active` (PASS — pdpl tunnel undisturbed)
- `curl https://app.riskmind.net/api/v1/health` → DNS NXDOMAIN (PENDING — DNS record missing)

**Resolution required:** The Cloudflare dashboard operator needs to verify the public hostname route was saved correctly for the riskmind tunnel, or manually add a CNAME record in the riskmind.net Cloudflare DNS zone:
- Name: `app`
- Type: `CNAME`
- Target: `7cc0204a-371a-4fe2-a889-e2c4f40f6a66.cfargotunnel.com`
- Proxy: Proxied (orange cloud)

Once this CNAME is created, `https://app.riskmind.net/api/v1/health` will return 200.

## Next Phase Readiness

- Tunnel infrastructure is ready — cloudflared-riskmind.service is active and connected to Cloudflare edge
- App is healthy on localhost:4000
- DNS CNAME must be verified/created in Cloudflare dashboard before the public URL is accessible
- Once DNS resolves, full public access via https://app.riskmind.net is operational

---
*Phase: 02-public-access-and-security*
*Completed: 2026-03-18*
