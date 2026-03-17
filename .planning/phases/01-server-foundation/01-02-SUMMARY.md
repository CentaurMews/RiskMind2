---
phase: "01"
plan: "02"
subsystem: api-server
tags: [env-validation, seed-data, configuration, security]
dependency_graph:
  requires: []
  provides: [fail-fast-env-validation, rich-demo-seed, env-template]
  affects: [artifacts/api-server/src/index.ts, artifacts/api-server/src/lib/seed.ts]
tech_stack:
  added: []
  patterns: [fail-fast-startup-validation, inline-framework-data, idempotent-seed-check]
key_files:
  created:
    - .env.example
  modified:
    - artifacts/api-server/src/index.ts
    - artifacts/api-server/src/lib/seed.ts
    - .gitignore
decisions:
  - "Inline framework requirement data in seed.ts rather than importing from @workspace/scripts — avoids cross-package dependency in the api-server artifact"
  - "Check tenantsTable for slug 'acme' (not usersTable) to detect existing seed — matches scripts/src/seed.ts pattern and is more semantically correct"
  - "Use hashPassword from ./password (existing utility) rather than inlining bcryptjs import — consistent with server codebase conventions"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-17"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
---

# Phase 1 Plan 02: Env Validation and Rich Seed Summary

**One-liner:** Fail-fast startup validation for all 4 required env vars, plus rich Acme Corp demo dataset (6 users, 10 risks, 5 vendors, 3 frameworks, alerts, signals) replacing the minimal 5-user seed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add fail-fast env validation to index.ts | f9c22f0 | artifacts/api-server/src/index.ts |
| 2 | Replace minimal seed with rich demo seed | 81574a5 | artifacts/api-server/src/lib/seed.ts |
| 3 | Create .env.example and .env, update .gitignore | b98a4ff | .env.example, .gitignore |

## What Was Built

### Task 1: Fail-fast env validation

`artifacts/api-server/src/index.ts` now checks all four required vars (`PORT`, `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`) as the very first executable code before any imports are used. If any are missing, the process throws with a clear error message pointing to `.env`. Previously only `PORT` was validated at startup; `ENCRYPTION_KEY` only errored at first encrypt/decrypt call.

### Task 2: Rich demo seed

`artifacts/api-server/src/lib/seed.ts` now creates the full Acme Corp dataset:
- 1 tenant (`acme` slug, checked idempotently)
- 6 users: admin, risk_manager, risk_owner, auditor, viewer, vendor — all with password `password123`
- 10 risks across technology, compliance, operational, financial, reputational, and strategic categories
- 5 vendors with tier classifications (critical through low)
- 3 signals (SIEM, threat intel, manual report)
- 2 alerts (KRI breach, overdue review)
- 3 compliance frameworks with full requirements: ISO 27001:2022 (98 reqs), SOC 2 Type II (83 reqs), NIST CSF 2.0 (108 reqs)

`pool.end()` is NOT called — the server's long-lived connection pool stays alive after seeding.

### Task 3: Env configuration

`.env.example` documents all 4 vars with placeholder values and generation instructions. `.env` was created with actual generated secrets (gitignored). `.gitignore` updated to exclude `.env`.

## Decisions Made

1. **Inline framework data in seed.ts** — The framework requirement arrays (iso27001, soc2, nistCsf) are copied inline into `seed.ts` rather than importing from `@workspace/scripts`. This avoids introducing a cross-package dependency in the api-server artifact that would complicate build isolation.

2. **Tenant slug check for idempotency** — Uses `tenantsTable.slug = "acme"` to detect existing seed data, matching the scripts version and being semantically cleaner than checking usersTable.

3. **Reuse existing hashPassword utility** — Uses the `./password` module already in the api-server rather than duplicating bcryptjs logic, consistent with server conventions.

## Verification Results

All 6 plan verification checks pass:
- `REQUIRED_ENV` present in index.ts before `rawPort`
- No `pool.end()` in server seed.ts
- `risksTable` used in seed.ts
- `.env.example` has exactly 3 `CHANGE_ME` placeholders
- `.env` has 0 `CHANGE_ME` entries
- `.gitignore` contains exact `.env` line

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files exist:
- artifacts/api-server/src/index.ts — modified
- artifacts/api-server/src/lib/seed.ts — replaced
- .env.example — created
- .gitignore — modified

Commits verified:
- f9c22f0 — Task 1
- 81574a5 — Task 2
- b98a4ff — Task 3

## Self-Check: PASSED
