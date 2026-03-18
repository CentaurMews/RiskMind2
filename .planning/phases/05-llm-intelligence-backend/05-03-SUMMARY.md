---
phase: 05-llm-intelligence-backend
plan: "03"
subsystem: api-server
tags: [llm-routing, settings-api, agent-fix, tasktype-threading]
dependency_graph:
  requires: ["05-01", "05-02"]
  provides: ["ROUTE-02", "ROUTE-03", "ROUTE-04", "FIX-02"]
  affects: ["agent-service", "ai-workers", "interviews"]
tech_stack:
  added: []
  patterns: ["task-specific LLM routing via taskType string", "findings-first agent cycle ordering"]
key_files:
  created: []
  modified:
    - artifacts/api-server/src/routes/settings.ts
    - artifacts/api-server/src/lib/ai-workers.ts
    - artifacts/api-server/src/routes/interviews.ts
    - artifacts/api-server/src/lib/agent-service.ts
decisions:
  - "FIX-02: act(localFindings) called before reason() so cascade/cluster/predictive findings survive LLM errors"
  - "Agent run status is 'completed' (not 'skipped') when localFindings > 0, even if reason() throws"
  - "LLM findings persisted additively in second act() call only when llmSucceeded=true"
  - "reason() in agent-service.ts passes 'agent' taskType to complete()"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 4
---

# Phase 5 Plan 03: LLM Intelligence Wiring + FIX-02 Summary

One-liner: Wired 5 new settings API routes to the service layer, threaded task-specific LLM taskType strings through all AI callers, and fixed the critical FIX-02 agent findings persistence bug where local findings were discarded on LLM errors.

## Tasks Completed

### Task 1: Add /discover, /benchmark, /llm-routing, /embeddings-health routes to settings.ts

Commit: `73ecc5e`

Added 6 new route handlers to `artifacts/api-server/src/routes/settings.ts`:

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/settings/llm-providers/:id/discover | Calls discoverModels(), returns model list without exposing API keys |
| POST | /v1/settings/llm-providers/:id/benchmark | Calls runBenchmark(), returns TTFT/latency/qualityScore, 422 on LLM error |
| GET | /v1/settings/llm-routing | Returns all 6 task type routing entries + benchmark-based suggestions |
| PUT | /v1/settings/llm-routing | Upserts routing entries via onConflictDoUpdate |
| DELETE | /v1/settings/llm-routing/:taskType | Removes a routing entry (resets to default), returns 204 |
| GET | /v1/settings/embeddings-health | Returns { configured: true/false } |

All routes are admin-guarded via `requireRole("admin")`. Updated imports to include `discoverModels`, `runBenchmark`, `suggestRouting` from llm-service and `llmTaskRoutingTable`, `llmBenchmarkResultsTable`, `sql` from drizzle.

### Task 2: Thread taskType through AI callers + FIX-02 agent findings persistence

Commit: `65f9d37`

**Part A — ai-workers.ts:**
- Updated `callLLM()` to accept `taskType: LLMTaskType = "general"` parameter and pass it to `complete()`
- ai-triage worker: passes `"triage"`
- ai-enrich worker: passes `"enrichment"`
- doc-process worker: passes `"enrichment"`

**Part B — interviews.ts:**

| Caller | taskType |
|--------|----------|
| interview start (complete) | "general" |
| interview message stream (streamComplete) | "general" |
| suggest-treatments (complete) | "treatment" |
| score-suggestions (complete) | "enrichment" |
| gap-remediation (complete) | "enrichment" |

**Part C — agent-service.ts (FIX-02):**

The broken flow before this fix:
```
localFindings = [...cascade, ...cluster, ...predictive]
if (available) {
  try { llmFindings = await reason(...) }
  catch { → status="skipped", return  ← act() NEVER called, localFindings LOST }
} else { → status="skipped", return  ← act() NEVER called, localFindings LOST }
act(...allFindings...)  // only reached on LLM success
```

The fixed flow after FIX-02:
```
// 1. Persist local findings FIRST (before LLM)
localSavedCount = await act(tenantId, run.id, localFindings, policyTier)

// 2. Attempt LLM reasoning (failure is non-fatal)
if (available) {
  try { llmFindings = ...; llmSucceeded = true }
  catch { log error; continue (no early return) }
}

// 3. Persist LLM findings additively (only if llmSucceeded)
if (llmSucceeded && llmFindings.length > 0) {
  llmSavedCount = await act(tenantId, run.id, llmFindings, policyTier)
}

// 4. Status: "completed" if any findings saved OR LLM succeeded; "skipped" only if nothing happened
finalStatus = totalSavedCount > 0 || llmSucceeded ? "completed" : "skipped"
```

Also updated `reason()` to pass `"agent"` taskType to `complete()`.

## Verification Results

### Settings route count
```
grep -c "llm-providers.*discover|llm-providers.*benchmark|llm-routing|embeddings-health" settings.ts
# Result: 12 (6+ matches — correct)
```

### TaskType threading
- ai-triage: `], "triage")` at line 55 confirmed
- ai-enrich: `], "enrichment")` at line 142 confirmed
- doc-process: `], "enrichment")` at line 189 confirmed
- interviews.ts: "treatment" at line 410, "general" at lines 104/193, "enrichment" at lines 490/575

### FIX-02 confirmed
- `FIX-02` comment at agent-service.ts line 804
- `localSavedCount = await act(tenantId, run.id, localFindings, ...)` at line 806
- No early return inside reason() catch block

### TypeScript compilation
```
cd artifacts/api-server && pnpm exec tsc --noEmit
# Result: no output (clean compile)
```

### PM2 restart
```
pm2 restart riskmind
# riskmind online, status: online
curl http://localhost:4000/api/v1/health
# {"status":"ok","database":"connected"}
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified to exist:
- artifacts/api-server/src/routes/settings.ts: FOUND
- artifacts/api-server/src/lib/ai-workers.ts: FOUND
- artifacts/api-server/src/routes/interviews.ts: FOUND
- artifacts/api-server/src/lib/agent-service.ts: FOUND

Commits verified:
- 73ecc5e (Task 1): FOUND
- 65f9d37 (Task 2): FOUND
