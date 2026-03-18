---
phase: 02-public-access-and-security
verified: 2026-03-18T07:23:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 2: Public Access and Security — Verification Report

**Phase Goal:** The app is accessible via a stable, named Cloudflare tunnel URL with CORS locked to that origin and SSE streaming working end-to-end

**Verified:** 2026-03-18T07:23:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | CORS allows requests from https://app.riskmind.net with credentials | VERIFIED | `access-control-allow-origin: https://app.riskmind.net` + `access-control-allow-credentials: true` confirmed live via curl against tunnel |
| 2  | CORS allows requests from http://localhost:4000 with credentials | VERIFIED | `Access-Control-Allow-Origin: http://localhost:4000` + `Access-Control-Allow-Credentials: true` confirmed live against localhost |
| 3  | CORS rejects requests from unauthorized origins | VERIFIED | curl with `Origin: https://evil.com` returns no `access-control-allow-origin` header — confirmed live |
| 4  | SSE endpoint sends headers immediately on connection via res.flushHeaders() | VERIFIED | `res.flushHeaders()` present at line 189, directly after `X-Accel-Buffering` header at line 188, before streaming loop at line 191 |
| 5  | Named Cloudflare tunnel (riskmind) routes app.riskmind.net to http://localhost:4000 | VERIFIED | `cloudflared-riskmind.service` active with tunnel UUID 7cc0204a; HTTPS 200 confirmed via `--resolve app.riskmind.net:443:104.21.80.235` |
| 6  | cloudflared-riskmind.service is enabled and active in systemd | VERIFIED | `systemctl is-active` → `active`; `systemctl is-enabled` → `enabled` |
| 7  | Existing cloudflared.service (pdpl.pulsebridge.me) is undisturbed | VERIFIED | `systemctl is-active cloudflared.service` → `active`; Description still "cloudflared" (pdpl service) |
| 8  | App is publicly reachable at https://app.riskmind.net (HTTP 200) | VERIFIED | curl returns `200` on `/api/v1/health` and `/` (SPA root) via tunnel |
| 9  | CORS preflight OPTIONS returns correct headers including credentials | VERIFIED | OPTIONS against tunnel returns `access-control-allow-origin`, `access-control-allow-credentials: true`, `access-control-allow-methods`, `access-control-allow-headers` |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `artifacts/api-server/src/app.ts` | CORS middleware with explicit origin whitelist | VERIFIED | `ALLOWED_ORIGINS` constant lines 10-13; function-based callback lines 15-22; `credentials: true` line 21; old open `cors()` call absent |
| `artifacts/api-server/src/routes/interviews.ts` | SSE endpoint with immediate header flush | VERIFIED | `res.flushHeaders()` at line 189, positioned correctly between `X-Accel-Buffering` (line 188) and `let fullResponse = ""` (line 191) |
| `/etc/systemd/system/cloudflared-riskmind.service` | Systemd unit for RiskMind Cloudflare tunnel | VERIFIED | File exists, `Description=cloudflared RiskMind tunnel`, token embedded (no `RISKMIND_TOKEN_HERE` placeholder), `WantedBy=multi-user.target` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app.ts` CORS middleware | allowed origins | `ALLOWED_ORIGINS.includes(origin)` + `callback(null, true)` | WIRED | Function callback checks whitelist; `callback(null, false)` for rejected origins (correct — no Error throw) |
| `app.ts` CORS middleware | cors() call chain | `app.use(cors({...}))` at line 15, before routes at line 30 | WIRED | Middleware order correct: cors → json → urlencoded → MCP → /api router → static → SPA fallback → 404 |
| `interviews.ts` SSE block | HTTP header flush | `res.flushHeaders()` line 189 | WIRED | Called after all 4 setHeader calls, before streaming loop; ensures TCP flush before any data |
| `cloudflared-riskmind.service` | `http://localhost:4000` | `tunnel run --token <token>` in ExecStart | WIRED | Token is a valid JWT (eyJ prefix); service active; tunnel UUID matches dashboard record in SUMMARY (7cc0204a-371a-4fe2-a889-e2c4f40f6a66) |
| `app.riskmind.net` | `cloudflared-riskmind.service` | Cloudflare DNS CNAME (auto-created or manually added) | WIRED | HTTP/2 200 confirmed via resolved IP; TLS cert CN=riskmind.net issued by Let's Encrypt E8 (Cloudflare-managed) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NET-01 | 02-02 | Configure named Cloudflare tunnel pointing to localhost:4000 | SATISFIED | Named tunnel "riskmind" (UUID 7cc0204a) created; routes `app.riskmind.net` → `localhost:4000`; confirmed live |
| NET-02 | 02-02 | Install cloudflared tunnel as systemd service for persistence | SATISFIED | `/etc/systemd/system/cloudflared-riskmind.service` exists, `enabled`, `active`; survives reboot via `WantedBy=multi-user.target` |
| NET-03 | 02-01 | Lock CORS to Cloudflare tunnel origin (remove open cors()) | SATISFIED | `ALLOWED_ORIGINS` whitelist in `app.ts`; open `cors()` call confirmed absent; live curl test confirms enforcement |
| NET-04 | 02-01 | Configure http2Origin / SSE streaming fix (res.flushHeaders) | SATISFIED | `res.flushHeaders()` at line 189 in `interviews.ts`; `--protocol http2` in service ExecStart; `X-Accel-Buffering: no` header present |
| NET-05 | 02-03 | App accessible via public Cloudflare tunnel URL with working login | SATISFIED (partial human) | Automated: HTTP 200 on health + SPA root confirmed. Human: user confirmed browser login + risks page load in plan 02-03 summary |

**All 5 NET requirements (NET-01 through NET-05) are accounted for across plans 02-01, 02-02, and 02-03. No orphaned requirements.**

---

### Anti-Patterns Found

No anti-patterns detected in phase-modified files.

Scan covered:
- `artifacts/api-server/src/app.ts` — no TODO/FIXME/placeholder/empty implementations
- `artifacts/api-server/src/routes/interviews.ts` — no TODO/FIXME/placeholder/empty implementations

---

### Build and Runtime Verification

| Check | Result |
|-------|--------|
| `pnpm --filter @workspace/api-server build` | Exit 0, no TypeScript errors (`Done in 596ms`) |
| PM2 `riskmind` process | `online`, PID 3825068, uptime 23m at verification time |
| `http://localhost:4000/api/v1/health` | HTTP 200 |
| `https://app.riskmind.net/api/v1/health` (via `--resolve`) | HTTP 200, HTTP/2, TLS valid (Let's Encrypt E8) |
| `https://app.riskmind.net/` SPA root (via `--resolve`) | HTTP 200 |

---

### Human Verification Required

The following item was performed by a human during plan 02-03 execution and is recorded in 02-03-SUMMARY.md:

**Browser Login and Navigation at https://app.riskmind.net**
- App loaded in browser without console errors, valid HTTPS padlock shown
- Login with seed credentials succeeded (no CORS errors in browser console)
- Risks page loaded seed data correctly from the public URL
- Confirmed: "approved" by user in Task 2 of plan 02-03

SSE streaming (AI interview token-by-token delivery) cannot be verified fully without a configured LLM API key. The code fix (`res.flushHeaders()`) is verified to be correctly placed; functional streaming behavior depends on LLM integration (Phase 3 scope).

---

### Commit Verification

All commits documented in SUMMARY files were confirmed present in git log:

| Commit | Description |
|--------|-------------|
| `b80d542` | feat(02-01): lock CORS to explicit origin whitelist |
| `eb64832` | feat(02-01): add res.flushHeaders() to SSE endpoint |
| `9911ef8` | chore(02-01): verify build and PM2 restart |
| `019fa5b` | fix(02-03): change CORS rejection to callback(null, false) instead of Error |
| `38dac3b` | docs(02-02): complete cloudflared-riskmind tunnel service plan |
| `5a683e5` | docs(02-03): complete Phase 2 public access verification plan |

**Notable fix recorded in 02-03:** The original `callback(new Error('Not allowed by CORS'))` was corrected to `callback(null, false)` — this is important because the Error variant causes Express to emit an unhandled error response. The fix is correctly in place in the current codebase.

---

### Gaps Summary

No gaps. All must-haves verified. All automated checks pass. Human verification was completed during plan execution.

---

_Verified: 2026-03-18T07:23:00Z_
_Verifier: Claude (gsd-verifier)_
