# Pitfalls Research

**Domain:** LLM integration, model routing, async job queue bugs — RiskMind v1.1 (existing ERM platform)
**Researched:** 2026-03-18
**Confidence:** HIGH (5 pitfalls code-verified by direct inspection; 5 from provider docs + community evidence)

---

## Critical Pitfalls

### Pitfall 1: Agent Local Findings Discarded When LLM Throws

**What goes wrong:**
In `runAgentCycle()`, local findings (cascade chains, pgvector clusters, predictive KRI trends) are computed and stored in `localFindings` before `reason()` is called. If `reason()` throws — network error, rate limit, model error, bad JSON — the catch block sets run status to `skipped` and returns early **without ever calling `act()`**. All local findings are silently discarded and never written to `agent_findings`.

This is Bug #2 from the v1.0 audit. The local detection logic runs correctly. The results are lost.

Specific code location: `agent-service.ts` lines 798–844. The structure is:
```
localFindings = [...cascade, ...cluster, ...predictive]  // computed
llmFindings = await reason(...)                           // if this throws:
  → catch: status = "skipped", return run.id             // act() is never called
```

**Why it happens:**
The original design assumed LLM reasoning was required to produce meaningful findings. Local analysis was added later without restructuring the persistence flow. The catch block was written for the "LLM unavailable" case, not for partial success.

**How to avoid:**
Persist local findings **before** calling `reason()`. Refactor the flow:
1. `await act(tenantId, run.id, localFindings, policyTier)` — always runs.
2. Attempt `reason()` in a separate try/catch.
3. On `reason()` success: `await act(tenantId, run.id, llmFindings, policyTier)`.
4. On `reason()` failure: update run status to `completed` (not `skipped`), with `findingCount = localFindings.length`.

**Warning signs:**
- Agent runs consistently show `status: "skipped"` when LLM is occasionally unavailable.
- `agent_findings` table is empty despite observable cascade conditions (breached KRIs, vendor concentration).
- Run context shows `localFindingsDetected: N` but no corresponding rows in `agent_findings`.

**Phase to address:** Phase 2 (Bug Fixes) — fix before routing changes that affect LLM availability.

---

### Pitfall 2: Duplicate Enrichment Stacking on Re-Enrich

**What goes wrong:**
The `ai-enrich` worker appends a new `---AI Enrichment---` block to `risk.description` on every call. If a user triggers enrichment twice, or if the job retries after a partial DB write, the description accumulates multiple stacked blocks.

Specific code in `ai-workers.ts` line 141:
```typescript
description: `${risk.description || ""}\n\n---AI Enrichment---\n${response}`,
```

There is no check for whether enrichment already exists. The job queue retries up to `maxAttempts` (default: 3) with exponential backoff, so a single user click can produce up to 3 stacked blocks if the job fails after the DB write.

**Why it happens:**
The append pattern is the simplest write. Idempotency was not considered because the original job design assumed one enrichment per risk lifecycle. The retry mechanism creates a window for duplication even without user action.

**How to avoid:**
Before writing, check if the description already contains the enrichment separator. Replace instead of append:
```typescript
const baseDescription = (risk.description || "").split("\n\n---AI Enrichment---")[0];
description: `${baseDescription}\n\n---AI Enrichment---\n${response}`
```
This is idempotent: any number of retries produces one enrichment block. Optionally add an `enrichedAt` timestamp to the `risks` table to gate job execution (skip if already enriched within N hours).

**Warning signs:**
- Risk descriptions containing two or more `---AI Enrichment---` separators.
- Risk detail view shows duplicated content sections.
- Database `risks.description` length growing on each job execution for the same `riskId`.

**Phase to address:** Phase 2 (Bug Fixes) — data quality and demo readiness blocker.

---

### Pitfall 3: Anthropic Has No Model List Endpoint — Wizard Step 3 Will Fail Silently

**What goes wrong:**
The LLM Config Wizard Step 3 auto-fetches available models from the provider API. OpenAI (`GET /v1/models`), Ollama (`GET /api/tags`), Groq, Mistral, and Together AI all expose model listing endpoints. **Anthropic does not.** Any attempt to dynamically fetch Anthropic models will result in a 404 or `TypeError` because the Anthropic SDK has no `client.models.list()` method (verified against Anthropic API docs and SDK).

**Why it happens:**
Anthropic's API design treats model enumeration as documentation, not a runtime capability. Developers building a "fetch models" flow test with OpenAI first, assume parity, then get a runtime error when trying Anthropic.

**How to avoid:**
The backend route for `GET /llm/providers/:providerId/models` (or equivalent wizard fetch endpoint) must branch on provider type:
- `openai_compat`: call provider's `/v1/models` endpoint, filter to chat-capable models.
- `anthropic`: return a hardcoded constant maintained in the backend:
```typescript
const ANTHROPIC_MODELS = [
  { id: "claude-opus-4-20251001", name: "Claude Opus 4" },
  { id: "claude-sonnet-4-20251001", name: "Claude Sonnet 4" },
  { id: "claude-haiku-4-20251001", name: "Claude Haiku 4" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
];
```
- `ollama`: call `GET /api/tags` on the configured `baseUrl`, parse the `models` array.

**Warning signs:**
- Wizard Step 3 shows a fetch error only for Anthropic providers.
- Backend logs show Anthropic SDK throwing `TypeError: client.models is not a function`.
- Integration tests pass for OpenAI but fail for Anthropic in the model discovery path.

**Phase to address:** Phase 1 (LLM Config Wizard) — design the model-fetch route with provider branching from day one.

---

### Pitfall 4: Model Name Validation Gap — The "Haiku" Bug

**What goes wrong:**
Bug #7 from the audit: users can save a model name like `"Haiku"` instead of `"claude-haiku-4-20251001"`. The current `llm_configs` table schema has `model: text("model").notNull()` with no format constraint. This bad value propagates silently: `resolveConfig()` returns it, the LLM client uses it, and the provider returns a 404 or 400 error deep inside a background job — not at config save time. The user sees no feedback.

Compound risk: the job queue retries on failure. A bad model name causes every job for that tenant to fail, consume all retries, and enter `dead` status. The `ai-triage` and `ai-enrich` queues will dead-letter all jobs until the model name is corrected.

**Why it happens:**
The Drizzle/Zod schema inherits only the `notNull()` constraint, which allows any non-empty string. Free-text model entry in the wizard (if implemented without a selection list) removes the last guard.

**How to avoid:**
At the wizard UI layer: after Step 3 fetches the model list, Step 4 must use a **selection component**, not a free-text input. Never allow arbitrary model name entry.

At the backend layer: the `testConnection()` function in `llm-service.ts` already makes a real API call against the configured model — **wire this as a required pre-save validation step** in the wizard save route. If `testConnection` returns `success: false`, reject the save with the provider's error message.

For Anthropic: validate the model ID against the hardcoded list before saving.

**Warning signs:**
- Jobs entering `dead` status with `lastError` containing "model not found" or similar provider error.
- AI features broken for a tenant after wizard configuration but `testConnection` was never called.
- User reports that re-entering settings "fixes" AI — indicating they corrected the model name on retry.

**Phase to address:** Phase 1 (Wizard Step 4 and save flow) + Phase 2 (Bug #7 validation fix).

---

### Pitfall 5: Extending the `llm_use_case` Enum Risks Migration Failure

**What goes wrong:**
The v1.1 routing feature requires routing to specific models per task type (Risk Enrichment, Signal Triage, Agent Reasoning, etc.). The current schema uses a PostgreSQL enum `llm_use_case` with values `general` and `embeddings`. If task types are implemented by extending this enum, Drizzle's migration generator will produce `ALTER TYPE llm_use_case ADD VALUE '...'`.

PostgreSQL rejects `ALTER TYPE ADD VALUE` inside a transaction block (versions < 16, and with edge cases in 16+). Drizzle wraps all migrations in a transaction by default. The migration fails with `ERROR: cannot add a usable enum value in a transaction`.

**Why it happens:**
Drizzle ORM's migration generator does not automatically handle the enum transaction restriction. Developers extending enums discover this at migration time in production.

**How to avoid:**
Do **not** extend the `llm_use_case` enum. Add a separate nullable `taskType` text column to `llm_configs`:
```sql
ALTER TABLE llm_configs ADD COLUMN task_type text DEFAULT NULL;
```
Adding a nullable column with a constant default is instant in PostgreSQL 11+ (no table rewrite, no lock). The `resolveConfig()` function then accepts an optional `taskType` parameter and queries for task-specific configs first, falling back to `useCase = 'general'` if none found. Existing configs are fully backward-compatible.

**Warning signs:**
- Drizzle-generated migration file contains `ALTER TYPE llm_use_case ADD VALUE`.
- Migration fails in staging with enum transaction error.
- Need to manually edit migration SQL or split into multiple files.

**Phase to address:** Phase 1 (Model Router schema design) — decide this before writing any routing code or running any migrations.

---

### Pitfall 6: Document Processor Hallucinating Summaries From Filename Only (Bug #1)

**What goes wrong:**
The `doc-process` worker calls the LLM with only the document filename and MIME type — it never reads actual file content:
```typescript
content: `Document: ${doc.fileName}\nType: ${doc.mimeType}\nVendor ID: ${doc.vendorId}`
```
The LLM generates a plausible-sounding vendor risk summary from the filename alone. This summary is saved to `documents.summary` and displayed to users as if it were extracted from the document's content. This is a fabrication, not an analysis.

**Why it happens:**
File parsing was deferred. The LLM call was stubbed in with filename-as-content as a placeholder. The placeholder produces output that looks correct (no errors), so it was never flagged as broken during development.

**How to avoid:**
Two options — pick one, do not ship the current behavior:

Option A (implement real parsing): Add `pdf-parse` for PDFs and `mammoth` for DOCX. Call the appropriate parser based on `mimeType`, extract text, then send the text to the LLM. Store parsed text in a new `content` column or pass it directly.

Option B (honest stub): Replace the LLM call with a status update to `"uploaded"` and return `{ status: "not_implemented" }`. Show "Document processing not yet available" in the UI instead of a hallucinated summary. This is Option B from the scope.

Option B is lower risk for Phase 2. Option A is the correct long-term fix.

**Warning signs:**
- Documents showing detailed summaries for files with generic names like `contract.pdf` or `soc2-report.docx` that are suspiciously generic.
- LLM summaries that don't match actual document content when verified.
- No file reading code anywhere near the `doc-process` worker.

**Phase to address:** Phase 2 (Bug Fixes, Bug #1) — must resolve before any demo involving document upload.

---

### Pitfall 7: Vendor AI Question Returns 400 Instead of 502 on Parse Failure (Bug #4)

**What goes wrong:**
When the LLM returns an unparseable response for vendor AI interview questions, the backend returns `400 Bad Request` with message `"AI returned invalid format. Please try again."`. A 400 status code means "client error" — the user did something wrong. But this is a server-side LLM failure, a 502 or 503 is semantically correct. Users seeing 400 try to change their input, which doesn't help.

**Why it happens:**
The error handling conflates "bad request from client" (400) with "upstream AI service failure" (502). The original error handler used a catch-all 400 for all validation failures including LLM parse errors.

**How to avoid:**
In the vendor AI question route, catch LLM parse/format errors specifically and return 502:
```typescript
if (err instanceof LLMParseError || err.message.includes("invalid format")) {
  return res.status(502).json({
    error: "AI returned an unexpected response. This is a temporary issue — please try again."
  });
}
```
Never return 400 for errors that the user cannot fix by changing their input.

**Warning signs:**
- User testing produces feedback like "the form is broken" or "it keeps saying my request is invalid."
- Browser DevTools shows 400 responses on vendor AI question submissions that were structurally correct.
- No change in behavior between correct and incorrect user inputs — always 400.

**Phase to address:** Phase 2 (Bug Fixes, Bug #4).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode Anthropic model list in backend | Fast wizard implementation, no API call needed | Stale when Anthropic releases models (typically quarterly) | MVP only — add an admin-updatable config in v2 |
| Use `useCase: "general"` for all 6 task types at launch | No migration needed | Routing table UI is cosmetic — all tasks use same model | Acceptable for Phase 1 scaffold if routing table clearly shows "No override" state |
| Benchmark with `max_tokens: 5` call (current `testConnection`) | Fast, cheap, catches bad API keys | Measures connection latency only, not inference quality or speed at real token counts | Connection test only — add separate benchmark route with a 50-token quality prompt |
| Keep enrichment as text append (current code) | No schema change needed | Creates stacking bug (already exists); hard to update without parsing the separator | Never — fix in Phase 2 |
| Skip real document parsing in Phase 2, use honest stub | Eliminates hallucination risk immediately | Document feature remains incomplete | Acceptable for v1.1 if stub message is honest and not misleading |
| Rate-limit model discovery calls with no retry | Avoids accidental provider spam | Users see failures if provider is under temporary load during wizard | Add a single retry with 1s delay for model fetch — minimal effort, significant UX improvement |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI `GET /v1/models` | Treating all returned models as chat models | Filter the list: only models with IDs starting with `gpt-` or `o1`/`o3` are chat models; embedding models (`text-embedding-*`) will also appear |
| Anthropic SDK | Calling `client.models.list()` — method does not exist | Return hardcoded list from backend constant; do not make any API call for model listing |
| Ollama `GET /api/tags` | Assuming all tags are LLM chat models | Some tags are embedding models (e.g., `nomic-embed-text`); distinguish by `details.families` field — embedding models typically show `bert` family |
| OpenAI-compat providers (Groq, Mistral, Together AI) | Using OpenAI model IDs directly | These providers have their own model name formats; always fetch from their `/v1/models` endpoint and display the returned IDs, never substitute OpenAI IDs |
| AES-256-GCM key rotation | Assuming `ENCRYPTION_KEY` can be changed freely | All stored `encryptedApiKey` values are bound to the current key; rotating requires a migration script to decrypt and re-encrypt all rows with the new key |
| pgvector queries in job queue context | Running `<=>` similarity queries inside the `FOR UPDATE SKIP LOCKED` transaction | pgvector queries are read-heavy; execute them outside the claim transaction to avoid lock contention — the current `ai-workers.ts` `findSimilarRisks` call happens after `COMMIT`, which is correct; preserve this pattern |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Benchmark cold-start inflating latency | First call to a provider appears 3–5x slower than subsequent calls; benchmarks consistently look bad for freshly configured providers | Run a warm-up call (or discard the first result) before reporting benchmark latency; report median of 3 calls, not first call | Every single benchmark run if not addressed |
| Model discovery rate limits during rapid wizard use | `429 Too Many Requests` from provider during Step 3; appears as "Failed to fetch models" | Cache model list per provider per session; add 500ms delay between discovery calls if user is configuring multiple providers | When user attempts wizard for 3+ providers in rapid succession |
| Agent `observe()` loading all tenant data with no limit | `Promise.all` of 7 parallel queries; KRIs and vendors have no LIMIT clauses; grows with tenant data volume | Add LIMIT clauses to all agent observation queries; current code passes to `invokeTool` which may or may not have limits — verify | At ~500+ risks or ~1,000+ KRIs per tenant |
| Job processor `while(processed)` tight loop | CPU spikes during high-volume job periods; can consume entire poll interval processing jobs without yielding | The loop in `startJobProcessor` drains all available jobs per tick — add a maximum iteration count per tick (e.g., 10 jobs) to avoid starvation of other operations | At 50+ concurrent jobs from multiple tenants |
| Hardcoded `text-embedding-3-small` fallback in `generateEmbedding` | Embeddings silently use a model the user did not configure; cost attributed to wrong provider | Make the fallback model configurable or remove the hardcoded fallback and throw `LLMUnavailableError` instead — currently falls back to `text-embedding-3-small` if no embeddings config exists | If OpenAI deprecates `text-embedding-3-small` or if tenant uses Ollama-only setup |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Returning provider API keys in LLM config API responses | API key exposed in browser network tab, frontend logs, React Query cache | `resolveConfig()` already decrypts internally — audit every `GET /llm-configs` response shape to ensure neither `encryptedApiKey` nor any decrypted key is serialized to the client |
| Storing provider `baseUrl` without SSRF validation | Attacker configures `baseUrl: "http://169.254.169.254/"` to probe internal metadata services | Validate `baseUrl` at save time: only allow `https://` schemes or `http://localhost` (for Ollama); reject RFC1918 addresses and link-local addresses in production |
| Benchmark and test-connection routes without tenant isolation | If route accepts `configId` without verifying caller's `tenantId`, Tenant A can test Tenant B's API keys | `resolveConfigById()` already scopes by `tenantId` parameter — ensure wizard routes pass the authenticated user's `tenantId`, not a client-supplied one |
| Model name injection through wizard | Malicious model name with special characters passed to provider | OpenAI and Anthropic pass model as a JSON field (no filesystem risk), but Ollama resolves local model names — validate Ollama model IDs against alphanumeric, colon, and slash characters only; reject path traversal sequences |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Vendor AI question error shows 400 to user (Bug #4) | Users think they submitted invalid input; they retry with different text, which never helps | Return 502 for LLM failures; message should say "AI returned an unexpected response — this is temporary, please try again" not "invalid format" |
| No embeddings provider warning (Bug #6) | Semantic search, agent clustering, and signal correlation silently degrade; users think features are broken | Show a persistent yellow banner in Settings when `resolveConfig(tenantId, "embeddings")` returns null |
| Benchmark latency shown as raw milliseconds only | `180ms` means nothing to a non-technical operator choosing between models | Label as qualitative tiers: "Very Fast (< 300ms)", "Fast (300ms–800ms)", "Moderate (800ms–2s)", "Slow (> 2s)" alongside raw ms |
| Wizard closes on navigation before save (6-step wizard) | User fills 5 steps, navigates away accidentally, loses all configuration | Add React Router `useBlocker` or `beforeunload` guard in the wizard when `isDirty` is true |
| Routing table shows task types but all resolve to same model | Sophisticated-looking UI but AI behavior is identical — feels fake in a demo | If per-task model assignment is not yet implemented in the backend, each routing table row must clearly show "Using default model" rather than implying unique routing |

---

## "Looks Done But Isn't" Checklist

- [ ] **LLM Wizard Step 3 (Anthropic):** Wizard shows a model list for Anthropic — verify it comes from the hardcoded constant, not an API call. Wizard must not show a "Failed to fetch" error for Anthropic.
- [ ] **LLM Wizard Step 3 (Ollama):** Model list populates from the Ollama instance at the user-provided `baseUrl`. Embedding models are distinguishable from chat models.
- [ ] **Model Router backend:** Visual routing table renders — verify `resolveConfig()` actually queries by task type (not just the first `isDefault: true` record).
- [ ] **Benchmark quality:** Shows a latency number — verify it represents inference time (time from request to first token), not just TCP handshake time.
- [ ] **Agent findings fix (Bug #2):** Agent run shows `status: "completed"` — verify `agent_findings` table has cascade/cluster/predictive rows even when LLM throws during `reason()`.
- [ ] **Enrichment idempotency fix (Bug #3):** Trigger enrichment twice on same risk — verify description has exactly one `---AI Enrichment---` block afterward.
- [ ] **Document processor fix (Bug #1):** Upload a document — verify either real content is parsed or a clear "not available" stub is shown; no hallucinated summaries.
- [ ] **Vendor scorecard real data (Bug #5):** `lastAssessmentDate` and `openFindingsCount` show live values — verify they are queried from `questionnaires` or `review_cycles`, not fixture data.
- [ ] **Embeddings health check (Bug #6):** Remove embeddings config from Settings — verify a warning banner appears without page reload.
- [ ] **Model name validation (Bug #7):** Attempt to save `"Haiku"` as model name — verify the save route rejects it with a clear error.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Agent findings discarded on LLM error | LOW | Fix `runAgentCycle()` ordering (no data migration needed); future runs will persist correctly |
| Enrichment stacking already in production data | MEDIUM | Write a one-time SQL script: for each risk with multiple `---AI Enrichment---` occurrences, keep only the last block; run as an idempotent migration |
| Bad model name saved to `llm_configs` | LOW | Fix the wizard save validation; existing bad configs correctable via the wizard edit flow without data migration |
| PostgreSQL enum migration failure (`ADD VALUE` in transaction) | MEDIUM | Roll back the migration; rewrite the routing schema using the nullable `task_type` text column approach instead |
| Provider API key exposed in a response | HIGH | Rotate all affected tenant API keys immediately via provider dashboard; audit server access logs for the exposure window; add contract tests asserting no key fields appear in response schemas |
| Document processor showing hallucinated summaries | MEDIUM | Deploy Option B (honest stub) immediately to stop hallucinations; clear any existing `documents.summary` values generated from filename-only; plan Option A (real parsing) for v1.2 |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Agent local findings lost on LLM error (Bug #2) | Phase 2 — Bug Fixes | `agent_findings` rows exist after agent run with simulated LLM error |
| Duplicate enrichment stacking (Bug #3) | Phase 2 — Bug Fixes | Trigger enrichment twice; exactly one `---AI Enrichment---` block in description |
| Document processor hallucination (Bug #1) | Phase 2 — Bug Fixes | Upload a document; no AI-generated summary unless real content was parsed |
| Vendor AI 400 on LLM parse failure (Bug #4) | Phase 2 — Bug Fixes | Simulate LLM parse failure; response is 502, not 400 |
| Vendor scorecard placeholder data (Bug #5) | Phase 2 — Bug Fixes | `lastAssessmentDate` and `openFindingsCount` populated from real DB tables |
| Embeddings health check missing (Bug #6) | Phase 2 — Bug Fixes (or Phase 1 Settings) | Remove embeddings config; Settings shows a warning banner |
| Model name validation (Bug #7) | Phase 1 — Wizard save + Phase 2 | Attempt to save `"Haiku"` as model name; route rejects it |
| Anthropic has no model list endpoint | Phase 1 — LLM Config Wizard | Wizard completes Step 3 for Anthropic and shows hardcoded model list |
| Router schema: avoid enum extension | Phase 1 — Model Router schema | Drizzle migration uses `ADD COLUMN task_type text` not `ALTER TYPE ADD VALUE` |
| Benchmark cold-start inflating latency | Phase 1 — Benchmark implementation | Reported benchmark is median of calls 2–3, not call 1 |
| SSRF via baseUrl | Phase 1 — Wizard save validation | Attempt to save RFC1918 baseUrl; route rejects it |

---

## Sources

- Code-verified (HIGH): `/artifacts/api-server/src/lib/agent-service.ts` lines 798–844 — `runAgentCycle()` discards local findings on LLM error
- Code-verified (HIGH): `/artifacts/api-server/src/lib/ai-workers.ts` line 141 — enrichment append without idempotency guard
- Code-verified (HIGH): `/artifacts/api-server/src/lib/llm-service.ts` — `resolveConfig()` takes `useCase` only, no task type parameter
- Code-verified (HIGH): `/lib/db/src/schema/llm-configs.ts` — `llm_use_case` enum has only `general` and `embeddings`
- Anthropic API (no model list endpoint): https://platform.claude.com/docs/en/about-claude/models/overview — HIGH confidence, official docs
- LLM benchmark cold start and measurement accuracy: https://acecloud.ai/blog/cold-start-latency-llm-inference/ and https://www.newline.co/@zaoyang/best-practices-for-llm-latency-benchmarking--257f132d — MEDIUM confidence
- PostgreSQL zero-downtime column addition (PG11+ instant ADD COLUMN): https://www.bytebase.com/blog/postgres-schema-migration-without-downtime/ — HIGH confidence
- PostgreSQL enum in transaction restriction: https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/ — HIGH confidence
- LLM model routing implementation mistakes: https://portkey.ai/blog/task-based-llm-routing/ and https://dev.to/richardbaxter/making-a-local-llm-mcp-server-deterministic-model-routing-think-block-stripping-and-the-problems-5bmj — MEDIUM confidence
- LLM rate limits and provider discovery: https://www.truefoundry.com/blog/rate-limiting-in-llm-gateway — MEDIUM confidence
- Drizzle nullable column safe migration pattern: https://github.com/drizzle-team/drizzle-orm/issues/2694 — MEDIUM confidence

---
*Pitfalls research for: RiskMind v1.1 — LLM integration, model routing, async job queue bug fixes*
*Researched: 2026-03-18*
