---
phase: 5
slug: llm-intelligence-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Build verification + curl API tests |
| **Config file** | none — backend phase uses build + curl |
| **Quick run command** | `pnpm --filter @workspace/api-server run build 2>&1 | tail -3` |
| **Full suite command** | `pnpm build 2>&1 | tail -5 && pm2 restart riskmind && sleep 2 && curl -s http://localhost:4000/api/v1/health` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick build check
- **After every plan wave:** Full build + PM2 restart + health check
- **Before `/gsd:verify-work`:** Full suite + manual API tests
- **Max feedback latency:** 10 seconds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Model discovery returns models from a live provider | LLM-03 | Requires live API key | POST /v1/settings/llm-providers/:id/discover with configured provider |
| Benchmark returns TTFT and latency from a live model | LLM-05 | Requires live LLM call | POST /v1/settings/llm-providers/:id/benchmark |
| Agent run persists findings despite LLM error | FIX-02 | Requires triggering LLM failure | Misconfigure LLM key, trigger agent run, verify findings saved |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
