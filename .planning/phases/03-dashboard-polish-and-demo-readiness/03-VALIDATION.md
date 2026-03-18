---
phase: 3
slug: dashboard-polish-and-demo-readiness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser verification + grep/curl for code changes |
| **Config file** | none — UI phase uses visual verification |
| **Quick run command** | `pnpm --filter @workspace/riskmind-app run build 2>&1 | tail -3` |
| **Full suite command** | `pnpm build 2>&1 | tail -5 && curl -s https://app.riskmind.net/api/v1/health` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick build check
- **After every plan wave:** Run full suite + visual spot check
- **Before `/gsd:verify-work`:** Full suite + manual browser walkthrough
- **Max feedback latency:** 20 seconds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard KPIs with trends render correctly | DASH-01 | Visual layout | Open /dashboard, verify KPI cards show counts + delta badges |
| Heatmap drill-down works | DASH-02 | Click interaction | Click a heatmap cell, verify filtered view opens |
| Skeleton loaders appear during loading | UI-03 | Timing-dependent visual | Throttle network in devtools, verify skeletons show |
| Empty states show icon + CTA | UI-02 | Visual design check | Filter list to 0 results, verify Empty component renders |
| ⌘K command palette opens and searches | UI-09 | Keyboard interaction | Press ⌘K, type query, verify results appear |
| Vendor kanban shows lifecycle stages | VEND-02 | Visual layout | Navigate to vendors, switch to pipeline view |
| RBAC hides admin controls for viewers | UI-06 | Role-dependent | Login as viewer@acme.com, verify create buttons hidden |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
