---
phase: 10
slug: assessment-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + manual API testing via curl |
| **Config file** | `artifacts/api-server/vitest.config.ts` (if exists) |
| **Quick run command** | `cd artifacts/api-server && pnpm tsc --noEmit` |
| **Full suite command** | `cd artifacts/api-server && pnpm tsc --noEmit && cd ../../artifacts/web && pnpm tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd artifacts/api-server && pnpm tsc --noEmit`
- **After every plan wave:** Run full suite (both api-server and web TypeScript compilation)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | ASMT-01 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | ASMT-02 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 1 | ASMT-03 | typecheck + curl | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 1 | ASMT-04 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 10-03-01 | 03 | 2 | ASMT-05 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 10-03-02 | 03 | 2 | ASMT-06 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 10-04-01 | 04 | 3 | ASMT-07 | typecheck | `pnpm tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeScript compilation validates both backend routes and frontend components.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Branching conditions show/hide questions in real time | ASMT-02 | Client-side DOM behavior | Open assessment session, answer trigger question, verify conditional question appears/disappears |
| AI follow-up questions appear inline with badge | ASMT-05 | SSE streaming + DOM insertion | Start assessment, answer a question, verify AI follow-up renders below with "AI Generated" badge |
| Session resumes after page refresh | ASMT-03 | Browser state persistence | Start assessment, answer questions in section 1, refresh page, verify responses are preserved |
| Score gauge/donut renders correctly | ASMT-04 | Visual chart rendering | Complete assessment, verify score gauge shows overall score, section bars render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
