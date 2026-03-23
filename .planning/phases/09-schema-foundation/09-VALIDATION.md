---
phase: 9
slug: schema-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + drizzle-kit push (schema validation) |
| **Config file** | `lib/db/tsconfig.json` (TypeScript compilation) |
| **Quick run command** | `cd lib/db && pnpm tsc --noEmit` |
| **Full suite command** | `cd lib/db && pnpm tsc --noEmit && pnpm drizzle-kit push --dry-run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd lib/db && pnpm tsc --noEmit`
- **After every plan wave:** Run `cd lib/db && pnpm tsc --noEmit && pnpm drizzle-kit push --dry-run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | ASMT-* | typecheck | `cd lib/db && pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | SGNL-* | typecheck | `cd lib/db && pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 1 | VNDR-* | typecheck | `cd lib/db && pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 09-02-02 | 02 | 1 | FRST-* | typecheck | `cd lib/db && pnpm tsc --noEmit` | ✅ | ⬜ pending |
| 09-03-01 | 03 | 2 | ALL | drizzle push | `cd lib/db && pnpm drizzle-kit push --dry-run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeScript compilation and drizzle-kit push are already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Compatibility view returns same shape as old questionnaires table | ASMT-* | View correctness requires psql inspection | `psql -c "SELECT * FROM questionnaires LIMIT 1"` and compare columns |
| Unique index on (tenant_id, source, content_hash) prevents duplicates | SGNL-* | Index constraint requires INSERT test | `psql -c "\d signals"` and verify index exists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
