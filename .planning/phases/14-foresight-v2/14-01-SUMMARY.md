---
phase: 14-foresight-v2
plan: "01"
subsystem: backend
tags: [monte-carlo, foresight, simulation, fair, job-queue, openapi, orval]
dependency_graph:
  requires: [09-schema-foundation, 12-signal-integrations]
  provides: [foresight-backend-api, monte-carlo-engine, orval-foresight-hooks]
  affects: [frontend-foresight-page, dashboard-ale-widget]
tech_stack:
  added: []
  patterns:
    - FAIR triangular distribution simulation (sampleTriangular inverse CDF)
    - Async 202 job queue pattern for long-running simulations
    - OSINT calibration: CVE CVSS → lossMagnitude, signal frequency → TEF, MISP → vulnerability
key_files:
  created:
    - artifacts/api-server/src/lib/monte-carlo.ts
    - artifacts/api-server/tests/monte-carlo.test.ts
  modified:
    - artifacts/api-server/src/routes/foresight.ts
    - artifacts/api-server/src/lib/ai-workers.ts
    - lib/api-spec/openapi.yaml
    - lib/api-client-react/src/generated/api.ts
    - lib/api-client-react/src/generated/api.schemas.ts
    - lib/api-zod/src/generated/api.ts
    - lib/api-zod/src/generated/types/ (55+ new type files)
decisions:
  - "sampleTriangular uses inverse CDF with degenerate guard (min===max returns min without NaN)"
  - "ALE = mean of all N annualized loss samples (events * vulnerability * loss_magnitude per iteration)"
  - "30-bin histogram with contiguous bins; last bin absorbs max value to prevent out-of-bounds"
  - "top-ale route defined before /:id to prevent Express path conflict"
  - "computeCalibration returns null for each param when insufficient signal data — no NaN"
  - "CVSS → lossMagnitude uses exponential mapping: base = 10000 * 10^(cvss/5)"
  - "MISP threatLevel strings map to probability scores via lookup table"
  - "monte-carlo worker registered in ai-workers.ts for co-location with other AI job workers"
metrics:
  duration: 317s
  tasks_completed: 2
  files_changed: 65
  completed_date: "2026-03-26"
requirements: [FRST-01, FRST-03, FRST-04, FRST-05]
---

# Phase 14 Plan 01: Foresight v2 Backend Summary

## One-Liner

FAIR Monte Carlo engine with triangular distribution sampling, full scenario CRUD + 202 async simulation lifecycle, OSINT calibration from signal corpus, and Orval-generated typed React Query hooks.

## What Was Built

### Task 1: Monte Carlo Engine + Foresight Routes + Job Worker

**monte-carlo.ts** — Pure FAIR simulation engine (no DB/external deps):
- `FAIRParams` interface: `{ tef, vulnerability, lossMagnitude }` each as `{ min, mode, max }`
- `SimulationResults`: ALE, percentiles (p5-p99), 30-bin histogram, iterations, durationMs
- `sampleTriangular(min, mode, max)` — inverse CDF with degenerate guard for min===max
- `runSimulation(params, iterations)` — rejects >500k iterations, returns sorted+computed results
- `buildExceedanceCurve(histogram, total)` — produces `[loss, prob_exceedance]` pairs for loss exceedance curve charts
- `computeCalibration(signals)` — aggregates 90-day signal corpus: CVE CVSS → lossMagnitude, signal frequency → TEF, MISP threatLevel → vulnerability; returns null for each param when no relevant signals

**foresight.ts** — Replaced all 501 stubs with real routes:
- `GET /v1/foresight/scenarios/top-ale` — top 5 by ALE from completed simulations (placed before /:id)
- `GET /v1/foresight/scenarios` — list with latest simulation status attached
- `POST /v1/foresight/scenarios` — create with name validation
- `GET /v1/foresight/scenarios/:id` — get with full simulations array
- `PATCH /v1/foresight/scenarios/:id` — partial update
- `DELETE /v1/foresight/scenarios/:id` — delete (simulations cascade via FK)
- `POST /v1/foresight/scenarios/:id/clone` — copies params, name + " (Copy)"
- `POST /v1/foresight/simulations` — creates DB record, enqueues monte-carlo job, returns 202
- `GET /v1/foresight/simulations/:id` — poll for status/results
- `POST /v1/foresight/calibrate` — queries 90-day signal window, runs computeCalibration
- Legacy stubs retained: `/v1/foresight/risk-graph`, `/v1/foresight/trust-circles`

**ai-workers.ts** — Added monte-carlo worker:
- `registerWorker("monte-carlo", handler)` — loads simulation, marks running, calls runSimulation, saves JSONB results + completedAt, updates status to completed/failed

**monte-carlo.test.ts** — 17 TDD tests (full RED→GREEN cycle):
- runSimulation outputs: ale>0, iterations, durationMs, histogram sum, percentile keys
- monotonically non-decreasing percentiles
- sampleTriangular degenerate case, range bounds
- histogram contiguity
- buildExceedanceCurve non-increasing y-values, boundary probabilities
- computeCalibration empty array, CVSS proportionality, MISP vulnerability, sampleSize

### Task 2: OpenAPI Spec + Orval Codegen

Added schemas: `TriangularParam`, `FAIRParams`, `HistogramBin`, `SimulationResults`, `ForesightScenario`, `ForesightSimulation`, `CalibrationResult`, `TopAleItem`, `CreateForesightScenarioRequest`, `UpdateForesightScenarioRequest`, `CreateForesightSimulationRequest`

Added all 10 foresight paths with full request/response typing.

Regenerated Orval hooks including:
- `useListForesightScenarios`, `useCreateForesightScenario`, `useGetForesightScenario`
- `useUpdateForesightScenario`, `useDeleteForesightScenario`, `useCloneForesightScenario`
- `useCreateForesightSimulation`, `useGetForesightSimulation`
- `usePostForesightCalibrate`, `useGetForesightScenariosTopAle`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| sampleTriangular inverse CDF with min===max guard | Prevents NaN in degenerate distribution; returns constant value |
| 30 histogram bins with clamped last bin | Ensures contiguity + handles max values without floating point gaps |
| top-ale route before /:id | Express route matching order — static path must precede param path |
| ALE = arithmetic mean of all iterations | Standard actuarial mean; percentiles give full distribution picture |
| CVSS → lossMagnitude exponential mapping | Linear mapping fails to capture severity gap between CVSS 5 and 9 |
| monte-carlo worker in ai-workers.ts | Co-location with ai-triage/ai-enrich; single import point in index.ts |

## Deviations from Plan

None — plan executed exactly as written. TDD cycle followed: RED commit (39dc300) → GREEN implementation (edf44c7) → Task 2 codegen (99f9e85).

## Known Stubs

None. All implemented routes return real data from DB. computeCalibration returns null params (with message "Insufficient data") when no signals available — this is correct behavior, not a stub.

## Self-Check: PASSED

- `artifacts/api-server/src/lib/monte-carlo.ts` — exists and exports required symbols
- `artifacts/api-server/src/routes/foresight.ts` — exists with real route implementations
- `artifacts/api-server/src/lib/ai-workers.ts` — registerWorker("monte-carlo") present
- `artifacts/api-server/tests/monte-carlo.test.ts` — 17 passing tests
- `lib/api-spec/openapi.yaml` — ForesightScenario, SimulationResults, CalibrationResult, top-ale present
- `lib/api-client-react/src/generated/` — foresight hooks generated
- Commits: 39dc300 (test), edf44c7 (feat engine+routes), 99f9e85 (feat openapi+orval)
