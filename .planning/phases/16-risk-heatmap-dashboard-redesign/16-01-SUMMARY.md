---
phase: 16-risk-heatmap-dashboard-redesign
plan: 01
subsystem: backend
tags: [schema, cron, api, risk-dashboard, snapshot, appetite]
dependency_graph:
  requires: []
  provides:
    - risk_snapshots table (daily posture history)
    - risk_appetite_configs table (per-category thresholds)
    - GET /v1/risks/dashboard
    - GET /v1/risks/snapshots
    - GET /v1/risks/appetite
    - PUT /v1/risks/appetite/:category
    - Midnight cron snapshot scheduler
  affects:
    - artifacts/api-server/src/index.ts
    - lib/db/src/schema/index.ts
tech_stack:
  added:
    - riskSnapshotsTable (Drizzle, PostgreSQL)
    - riskAppetiteConfigsTable (Drizzle, PostgreSQL)
  patterns:
    - onConflictDoUpdate for idempotent daily upserts
    - Pure function exports (computeCompositeScore, buildCellCounts) for TDD
    - node-cron midnight UTC scheduler (same pattern as signal-feed-poller.ts)
key_files:
  created:
    - lib/db/src/schema/risk-snapshots.ts
    - lib/db/src/schema/risk-appetite-configs.ts
    - artifacts/api-server/src/lib/risk-snapshot-scheduler.ts
    - artifacts/api-server/tests/snapshot-scheduler.test.ts
  modified:
    - lib/db/src/schema/index.ts
    - artifacts/api-server/src/index.ts
    - artifacts/api-server/src/routes/risks.ts
decisions:
  - computeCompositeScore exported as pure function to enable unit testing without DB dependencies
  - buildCellCounts exported as pure function (determinism tested by SNAP-03)
  - captureSnapshotForTenant uses inArray(['open','mitigated']) for active risk filter
  - categoryCounts JSONB stores per-category score, count, highCriticalCount for domain summary API
  - dashboard endpoint computes live values (collecting:true) when no snapshot rows exist yet
  - appetite PUT triggers non-blocking snapshot recapture via .catch() to keep response fast
  - All 4 new routes placed before /:id route to prevent Express path conflict
metrics:
  duration: 392s
  completed: "2026-03-24"
  tasks_completed: 3
  files_created: 4
  files_modified: 3
---

# Phase 16 Plan 01: Backend Risk Dashboard Foundation Summary

**One-liner:** Daily risk posture snapshot engine with composite scoring, critical-risk 2x weighting, per-category appetite thresholds, and four dashboard API endpoints backed by pre-computed snapshot data.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0 — Snapshot scheduler unit tests (RED) | 36e8dee | tests/snapshot-scheduler.test.ts |
| 2 | Schema tables + snapshot scheduler + drizzle push | 8e96b21 | risk-snapshots.ts, risk-appetite-configs.ts, schema/index.ts, risk-snapshot-scheduler.ts, index.ts |
| 3 | Dashboard, snapshots, and appetite API endpoints | 0a58a57 | artifacts/api-server/src/routes/risks.ts |

## Verification Results

- `vitest run tests/snapshot-scheduler.test.ts` — 3/3 tests pass (SNAP-01, SNAP-02, SNAP-03)
- `pnpm --filter @workspace/db push` — `[✓] Changes applied` (risk_snapshots + risk_appetite_configs tables created)
- `grep -c riskSnapshotsTable lib/db/src/schema/risk-snapshots.ts` — 3 (schema, insert type, select type)
- `grep -c riskAppetiteConfigsTable lib/db/src/schema/risk-appetite-configs.ts` — 3
- `grep -c "risk-snapshots" lib/db/src/schema/index.ts` — 1
- `grep -c "risk-appetite-configs" lib/db/src/schema/index.ts` — 1
- `grep -c "computeCompositeScore" artifacts/api-server/src/lib/risk-snapshot-scheduler.ts` — 3
- `grep -c "buildCellCounts" artifacts/api-server/src/lib/risk-snapshot-scheduler.ts` — 2
- `grep -c "onConflictDoUpdate" artifacts/api-server/src/lib/risk-snapshot-scheduler.ts` — 1
- `grep -c "startRiskSnapshotScheduler" artifacts/api-server/src/index.ts` — 2 (import + call)
- All 4 new routes placed before `/:id` route (lines 180, 368, 411, 431 vs 484)

## Decisions Made

1. **Pure function exports for TDD** — `computeCompositeScore` and `buildCellCounts` are exported standalone pure functions. This allows unit tests to run without a database connection. The test imports from the scheduler module but only exercises these two functions.

2. **DATABASE_URL required for tests** — Since `@workspace/db` validates `DATABASE_URL` at module load time (not lazily), unit tests require `DATABASE_URL=...` env var even for pure function tests. Tests pass with `DATABASE_URL=postgresql://riskmind:riskmind@localhost:5432/riskmind npx vitest run`.

3. **collecting: true flag** — Dashboard endpoint returns `{ collecting: true, ...liveComputedValues }` when no snapshot rows exist for a tenant. Frontend can render a banner explaining that trend data is being collected.

4. **Appetite PUT triggers async recapture** — After upsert, `captureSnapshotForTenant(tenantId).catch(...)` is called without await to avoid blocking the 200 response. This ensures the new threshold is reflected in the next snapshot query immediately.

5. **aboveAppetiteCells computation** — Cells are marked above-appetite based on the average threshold across all configured appetite categories. This is a simplification; the frontend dashboard can apply more precise per-category logic using the full `domainSummaries` array.

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing TypeScript errors in `email.ts`, `monitoring.ts`, and `vendors.ts` are out of scope (existed before this plan). They do not affect the new files introduced here.

## Self-Check: PASSED

All 4 created files exist on disk. All 3 task commits found in git log:
- 36e8dee: test(16-01) — snapshot-scheduler.test.ts
- 8e96b21: feat(16-01) — schema tables, scheduler, server registration
- 0a58a57: feat(16-01) — dashboard/snapshots/appetite routes
