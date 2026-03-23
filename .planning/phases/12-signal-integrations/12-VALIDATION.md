---
phase: 12
slug: signal-integrations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed in Phase 10) + TypeScript compilation |
| **Config file** | `artifacts/api-server/vitest.config.ts` |
| **Quick run command** | `cd artifacts/api-server && pnpm tsc --noEmit` |
| **Full suite command** | `cd artifacts/api-server && pnpm tsc --noEmit && cd ../../artifacts/riskmind-app && pnpm tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd artifacts/api-server && pnpm tsc --noEmit`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | SGNL-* | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | SGNL-01,02 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 12-02-01 | 02 | 1 | SGNL-03,04 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 12-02-02 | 02 | 1 | SGNL-05 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 12-03-01 | 03 | 2 | SGNL-* | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 12-03-02 | 03 | 2 | SGNL-* | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install imapflow, mailparser, @azure/arm-securityinsight, @azure/identity, p-ratelimit, node-cron, @types/node-cron

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NVD poll creates CVE signals with no duplicates on second run | SGNL-01 | Requires live NVD API call | Configure NVD, click Sync Now, verify signals appear, click again, verify count unchanged |
| Shodan scan surfaces ports linked to vendor | SGNL-02 | Requires Shodan API key | Configure Shodan with test domain, trigger scan, verify signals with vendor_id set |
| Sentinel ingestion deduplicates by incident ID | SGNL-03 | Requires Azure credentials | Configure Sentinel, trigger poll, verify signals, re-poll, verify no duplicates |
| Email parsed by LLM with sandboxed body | SGNL-05 | Requires IMAP mailbox | Send test email, wait for poll, verify signal with extracted fields |
| Credentials never in logs or API responses | SGNL-* | Security audit | Check server logs, API GET responses for encrypted fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
