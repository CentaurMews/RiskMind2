---
phase: 03-dashboard-polish-and-demo-readiness
plan: "01"
subsystem: api-server
tags: [api, kri, search, pgvector, drizzle-orm, express]
dependency_graph:
  requires: []
  provides: [GET /v1/kris, POST /v1/search]
  affects: [DASH-04 KRI widget, UI-09 command palette]
tech_stack:
  added: []
  patterns: [pgvector cosine similarity, ILIKE keyword fallback, Drizzle ORM join, raw SQL via db.execute]
key_files:
  created:
    - artifacts/api-server/src/routes/search.ts
  modified:
    - artifacts/api-server/src/routes/risks.ts
    - artifacts/api-server/src/routes/index.ts
decisions:
  - "Use vendor_status (not status) in raw SQL for vendors table — pgEnum column mapping uses non-standard DB column name"
  - "Signals table has confidence column, not severity — plan template had wrong column name"
  - "Search fallback to ILIKE confirmed working — LLMUnavailableError thrown when no embedding provider configured"
metrics:
  duration: "~15 min"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 3
---

# Phase 3 Plan 01: Backend API Endpoints for KRI Widget and Command Palette Summary

**One-liner:** Two new Express routes — `GET /v1/kris` (tenant-scoped KRI list with Drizzle ORM join) and `POST /v1/search` (pgvector semantic search with ILIKE keyword fallback) — unblocking Wave 2 frontend work.

## What Was Built

### Task 1: GET /v1/kris
Appended to `artifacts/api-server/src/routes/risks.ts`. Returns all KRIs for the authenticated tenant with `riskTitle` from a left join on `risksTable`. Supports a `?limit` query parameter. Returns `{ data: Kri[] }`.

### Task 2: POST /v1/search
Created `artifacts/api-server/src/routes/search.ts`. Accepts `{ query, types? }` body. Attempts pgvector cosine similarity search (`<=>` operator, threshold 0.4) across risks, vendors, and signals. Falls back to ILIKE keyword search when `LLMUnavailableError` is thrown (no embedding provider configured). Returns `{ results: { risks?, vendors?, signals? }, usedEmbedding: bool }`. Registered in `index.ts` as a protected route.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vendor_status column name in raw SQL**
- **Found during:** Task 2 live verification (PM2 logs)
- **Issue:** `SELECT ... status FROM vendors` threw `column "status" does not exist` — the pgEnum column is mapped to DB column `vendor_status`, not `status`
- **Fix:** Changed query to `vendor_status AS status` in both embedding and ILIKE branches
- **Files modified:** `artifacts/api-server/src/routes/search.ts`
- **Commit:** 0ffcd59

**2. [Rule 1 - Bug] Fixed signals column name — confidence not severity**
- **Found during:** Task 2 (schema inspection before writing code)
- **Issue:** Plan template referenced `severity` column on signals table; actual schema has `confidence` (numeric 5,4)
- **Fix:** Changed `severity` to `confidence` in both embedding and ILIKE branches for signals
- **Files modified:** `artifacts/api-server/src/routes/search.ts`
- **Commit:** 0ffcd59

## Verification Results

- `GET /v1/kris` returns `{ data: [] }` (empty — no KRIs seeded, correct behavior)
- `POST /v1/search {"query":"supply chain"}` returns `{ results: { risks: [{...Supply Chain Disruption...}], vendors: [], signals: [] }, usedEmbedding: false }`
- `pnpm --filter api-server build` completes with zero TypeScript errors
- PM2 `riskmind` stays online after restart

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 0e9bccc | feat(03-01): add GET /v1/kris tenant-wide endpoint |
| Task 2 | 0ffcd59 | feat(03-01): add POST /v1/search semantic search endpoint |

## Self-Check: PASSED

All files confirmed present. All commits confirmed in git log.
