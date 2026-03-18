---
phase: 6
slug: bug-fixes-and-wizard-ui
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-18
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Build verification + grep for code changes |
| **Config file** | none — uses pnpm build + grep |
| **Quick run command** | `pnpm build 2>&1 | tail -5` |
| **Full suite command** | `pnpm build 2>&1 | tail -5 && pm2 restart riskmind && sleep 2 && curl -s http://localhost:4000/api/v1/health` |
| **Estimated runtime** | ~20 seconds |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Doc processor shows honest stub | FIX-01 | Requires triggering doc upload | Upload a document, verify summary says "content extraction coming soon" |
| Re-enrichment replaces block | FIX-03 | Requires two sequential enrichment calls | Enrich a risk, enrich again, verify only one block |
| Vendor AI error is clear | FIX-04 | Requires triggering LLM parse failure | Vendor AI questions with bad LLM response shows 502 message |
| Vendor scorecard shows real data | FIX-05 | Visual check | Open vendor list, verify assessment date and findings count are real |
| Embeddings warning shows | FIX-06 | Visual check | Open Settings without embeddings provider, verify amber banner |
| Model selection prevents free text | FIX-07 | Interaction check | Add/edit provider, verify model is a dropdown not text input |
| Full wizard completes | LLM-01..06 | Multi-step interaction | Run through all 6 wizard steps, verify routing table updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
