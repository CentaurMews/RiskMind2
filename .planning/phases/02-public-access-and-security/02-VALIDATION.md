---
phase: 2
slug: public-access-and-security
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + curl smoke tests (networking/infra phase) |
| **Config file** | none — uses curl and systemctl commands |
| **Quick run command** | `curl -s https://app.riskmind.net/api/v1/health` |
| **Full suite command** | `curl -s https://app.riskmind.net/api/v1/health && curl -s -o /dev/null -w '%{http_code}' https://app.riskmind.net/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick health check
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds (includes DNS resolution)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | NET-01 | curl | `curl -s https://app.riskmind.net/api/v1/health` returns JSON | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | NET-02 | systemctl | `systemctl is-active cloudflared-riskmind` returns active | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | NET-03 | curl | `curl -s -H 'Origin: https://evil.com' https://app.riskmind.net/api/v1/health -I` lacks Access-Control-Allow-Origin | ✅ | ⬜ pending |
| TBD | TBD | 2 | NET-04 | grep | `grep -q 'flushHeaders' artifacts/api-server/src/routes/interviews.ts` | ✅ | ⬜ pending |
| TBD | TBD | 3 | NET-05 | curl | `curl -s -X POST https://app.riskmind.net/api/v1/auth/login -H 'Content-Type: application/json' -d '...'` returns accessToken | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Cloudflare tunnel created and token obtained from dashboard
- [ ] DNS CNAME for app.riskmind.net configured

*Infrastructure phase — Wave 0 is the tunnel creation itself.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App loads in browser at public URL | NET-05 | Requires browser rendering check | Open https://app.riskmind.net in browser, verify login page renders |
| SSE streaming token-by-token | NET-04 | Requires observing real-time stream behavior | Start AI interview, verify text appears incrementally (not all at once) |
| Full navigation works from public URL | NET-05 | Requires clicking through multiple pages | Login, navigate to risks, vendors, compliance, settings — all load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
