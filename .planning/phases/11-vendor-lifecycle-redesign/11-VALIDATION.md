---
phase: 11
slug: vendor-lifecycle-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 11 — Validation Strategy

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
- **After every plan wave:** Run full suite (both api-server and riskmind-app TypeScript compilation)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | VNDR-01 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 11-01-02 | 01 | 1 | VNDR-02,03 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 11-02-01 | 02 | 1 | VNDR-04,05 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 11-02-02 | 02 | 1 | VNDR-06,07 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 11-03-01 | 03 | 2 | VNDR-01 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 11-03-02 | 03 | 2 | VNDR-03,05 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. vitest installed in Phase 10. TypeScript compilation validates both api-server and riskmind-app.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wizard resumes from saved step after navigate-away | VNDR-01 | Browser navigation behavior | Start wizard, complete step 1, navigate away, return to /vendors/onboard/:id, verify step 2 loads |
| AI enrichment auto-triggers at step 4 | VNDR-02 | SSE streaming + DOM rendering | Complete wizard steps 1-3, verify enrichment cards appear at step 4 without clicking |
| LLM-extracted subprocessors appear from uploaded docs | VNDR-03 | LLM integration + UI rendering | Upload vendor doc with subcontractor mentions, verify suggested subprocessors appear |
| Score badge colors match severity on kanban | VNDR-05 | Visual color rendering | Complete vendor assessment, verify kanban card shows colored score badge |
| Monitoring alert fires on schedule | VNDR-04 | Time-based scheduler | Configure monitoring, advance time or trigger manually, verify alert created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
