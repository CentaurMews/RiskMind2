---
phase: 16
slug: risk-heatmap-dashboard-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 16 — Validation Strategy

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
| 16-01-01 | 01 | 1 | D-18,20,22 | unit + typecheck | `vitest run tests/snapshot-scheduler.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | D-03,07,19 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 16-02-01 | 02 | 1 | D-06-09 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 16-02-02 | 02 | 1 | D-10-14 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 16-03-01 | 03 | 2 | D-01,02,17 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 16-03-02 | 03 | 2 | D-19 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `artifacts/api-server/tests/snapshot-scheduler.test.ts` — unit tests for composite score calculation:
  - SNAP-01: compositeScore returns 0 for empty risk list
  - SNAP-02: critical risks weighted 2x in composite calculation
  - SNAP-03: upsert idempotency (same date + tenant = update, not duplicate)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Posture bar shows correct score vs appetite band | D-03 | Visual rendering | Load /risks/heatmap, verify posture bar reflects computed score with appetite range |
| Heatmap micro-trend arrows display correctly | D-08 | Visual rendering | Load page, compare arrows to known delta data |
| KRI trend chart shows appetite band and line | D-10,11 | Chart rendering | Load page, verify line chart with horizontal band |
| Domain cards filter heatmap on click | D-17 | Interactive behavior | Click a domain card, verify heatmap updates to show only that domain's risks |
| Dark mode colors update seamlessly | D-25 | Theme interaction | Toggle dark mode, verify all sections update colors |
| Mobile layout stacks correctly | D-02 | Responsive layout | Resize to mobile, verify stacked layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
