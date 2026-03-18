---
phase: 4
slug: ai-differentiators-surfaced
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Build verification + grep for component presence |
| **Config file** | none — UI phase uses build + grep |
| **Quick run command** | `pnpm --filter @workspace/riskmind-app run build 2>&1 | tail -3` |
| **Full suite command** | `pnpm build 2>&1 | tail -5 && pm2 restart riskmind` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick build check
- **After every plan wave:** Full build + PM2 restart
- **Before `/gsd:verify-work`:** Full suite + manual browser check
- **Max feedback latency:** 20 seconds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI Enhanced badge shows on enriched risk | AI-01 | Visual + requires enriched risk data | Enrich a risk via "Enrich with AI" button, verify badge appears |
| Treatment suggestions display polished | AI-02 | Visual design check | Click "AI Recommendations" on a risk, verify clean layout |
| Signal→Finding→Risk breadcrumb navigable | AI-04 | Click interaction chain | Find a risk with sources, verify each breadcrumb link works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
