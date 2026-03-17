---
phase: 1
slug: server-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + shell commands (infrastructure phase — no unit test framework needed) |
| **Config file** | none — infrastructure phase uses CLI verification |
| **Quick run command** | `curl -s http://localhost:4000/api/v1/health | jq .` |
| **Full suite command** | `curl -s http://localhost:4000/api/v1/health && curl -s http://localhost:4000/ | head -1 && pm2 status` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `curl -s http://localhost:4000/api/v1/health | jq .`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | DEPL-01 | cli | `grep -r "@replit" package.json pnpm-workspace.yaml` returns empty | ✅ | ⬜ pending |
| TBD | TBD | 1 | DEPL-02 | cli | `node -e "require('./artifacts/api-server/dist/index.cjs')"` starts without env error | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | DEPL-03 | cli | `pnpm -r build` exits 0 | ✅ | ⬜ pending |
| TBD | TBD | 2 | DEPL-04 | curl | `curl -s http://localhost:4000/ | grep -q '<div id="root">'` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | DEPL-05 | cli | `pm2 status | grep -q online` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | DB-01 | psql | `psql -d riskmind -c '\dt' | grep -q users` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | DB-02 | psql | `psql -d riskmind -c 'SELECT extname FROM pg_extension' | grep -q vector` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | DB-03 | psql | `psql -d riskmind -c '\dt' | wc -l` returns >10 | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | DB-04 | psql | `psql -d riskmind -c 'SELECT count(*) FROM risks'` returns >0 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] PostgreSQL database `riskmind` created
- [ ] pgvector extension installed
- [ ] `.env` file created with required variables

*Infrastructure phase — Wave 0 is the DB/env provisioning itself.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Demo login works and loads dashboard | DEPL-04 | Requires browser interaction | Open http://localhost:4000, login with admin@acme.com / password123, verify dashboard renders |
| PM2 survives reboot | DEPL-05 | Requires system reboot | Run `pm2 startup`, `pm2 save`, then reboot and verify `pm2 status` shows online |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
