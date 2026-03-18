# Phase 6: Bug Fixes and Wizard UI - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all 6 remaining audit bugs (FIX-01, FIX-03 through FIX-07) and build the 6-step LLM Config Wizard frontend in Settings. The wizard uses Phase 5's backend APIs (discover, benchmark, routing) — no new backend endpoints needed. Bug fixes are backend corrections; wizard is frontend UI.

</domain>

<decisions>
## Implementation Decisions

### LLM Config Wizard (6-step flow)
- **Container**: Sheet/drawer sliding in from the right — stays in Settings context, Apple-like, routing table visible behind it
- **Navigation**: Full back/forward stepper — clickable step indicators, users can review and change earlier choices
- **Steps**:
  1. Provider select — rich cards with icons, capabilities tags, pricing tier (from PROVIDER_CATALOG constant)
  2. Credentials — API key input (+ base URL for Ollama/private), "Test Connection" button
  3. Model discovery — auto-fetches models via POST /discover, grouped by capability (Chat/Embedding/Code), loading state while fetching
  4. Model select — checkboxes to select models, save config with nickname
  5. Benchmark — run benchmarks on selected models, comparison table with TTFT/latency/quality, "Recommended" badges
  6. Routing assignment — smart defaults from suggestRouting(), visual grid showing 6 task types → model, one-click accept or manual override
- **Completion**: close sheet, routing table card on Settings page updates immediately
- **Design**: Apple-like minimalist, consistent with Phase 3 design language

### Routing Table Card (Settings page)
- Persistent card on the Settings page (not inside the wizard)
- Visual grid: 6 task type rows × assigned model column
- "Auto-suggested" badge when using benchmark recommendation
- Click any row to change model assignment
- "Add Provider" button opens the wizard sheet

### Bug Fixes

#### FIX-01: Document Processing Stub
- Replace hallucinated filename summary with honest message: "Document content extraction coming soon. File received: [filename]"
- No AI call made — just store the stub text as the summary
- The endpoint still works (file is uploaded), just the AI summary is replaced with the stub

#### FIX-03: Enrichment Idempotency
- Before appending `---AI Enrichment---` block, check if one already exists in the description
- If exists: replace the old enrichment block with the new one
- Split on separator, keep base description, append new enrichment
- Result: only ever one enrichment block, no stacking

#### FIX-04: Vendor AI Question Error
- Change the 400 "AI returned invalid format. Please try again." to a 502 with a user-friendly message
- New message: "AI response could not be processed. This is a temporary issue — please try again."
- Log the raw LLM output server-side for debugging

#### FIX-05: Vendor Scorecard Real Data
- Compute `lastAssessmentDate` and `openFindingsCount` from related tables (questionnaires, findings)
- Add computed fields to the vendor list API response (GET /v1/vendors)
- Join or subquery against questionnaires table for last completed date, findings table for count where vendorId matches
- Frontend vendor-list.tsx already has placeholder columns — wire to real data

#### FIX-06: Embeddings Health Warning
- GET /v1/settings/embeddings-health endpoint already exists (Phase 5)
- Add a warning banner at the top of the Settings page when no embeddings provider is configured
- Banner: "No embeddings provider configured. Semantic search, agent clustering, and signal correlation are degraded."
- Dismissible but reappears on Settings page reload

#### FIX-07: Model Name Validation
- Model input becomes a selection component from the discovered models list — no free-text entry
- Backend validates model name against the discovered models for that provider
- If model ID doesn't match provider format, reject with 422

### Claude's Discretion
- Wizard step transitions and animations
- Stepper component design (dots vs numbers vs text)
- Benchmark comparison table column widths and sorting
- Vendor scorecard query exact JOIN shape
- Embeddings warning banner styling
- Error message exact wording refinements

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Wizard UI
- `artifacts/riskmind-app/src/pages/settings/settings.tsx` — Current LLM provider management UI (extend with wizard + routing card)
- `artifacts/riskmind-app/src/components/ui/sheet.tsx` — shadcn Sheet component for drawer
- Phase 5 generated hooks in `lib/api-client-react/src/generated/` — discoverLlmModels, benchmarkLlmProvider, getLlmRouting, updateLlmRouting, getEmbeddingsHealth

### Bug Fix Targets
- `artifacts/api-server/src/lib/ai-workers.ts` — FIX-01 (doc-process worker), FIX-03 (enrichment stacking at line ~141)
- `artifacts/api-server/src/routes/vendors.ts` — FIX-04 (AI question 400 error at line ~440)
- `artifacts/api-server/src/routes/vendors.ts` — FIX-05 (vendor list endpoint — add computed fields)
- `artifacts/api-server/src/routes/settings.ts` — FIX-07 (model name validation on create/update)
- `artifacts/riskmind-app/src/pages/settings/settings.tsx` — FIX-06 (embeddings warning banner)
- `artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` — FIX-05 (wire real scorecard data)

### Provider Catalog Reference
- `artifacts/api-server/src/lib/llm-service.ts` — ANTHROPIC_MODELS constant, discoverModels(), runBenchmark(), suggestRouting(), LLMTaskType

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<Sheet>` component — for wizard drawer
- `<Card>`, `<Badge>`, `<Button>` — for wizard steps and routing table
- `<Skeleton>` — for model discovery loading state
- `toast()` — for wizard success/error feedback
- Generated hooks from Phase 5 codegen — all wizard API calls ready
- `SeverityBadge` pattern — reuse for provider capability badges

### Established Patterns
- Settings page uses Card-based layout with sections
- Admin-only routes already guard all Settings endpoints
- Sheet/drawer pattern not yet used in Settings but exists in vendor detail (FindingPanel)
- Multi-step forms not yet in codebase — wizard is first instance

### Integration Points
- Settings page: add "Add Provider" button + routing table card
- Sheet: mounts as child of Settings page
- Wizard completion: invalidates React Query cache for provider list + routing table
- Bug fixes: targeted edits to specific files, no cross-cutting changes

</code_context>

<specifics>
## Specific Ideas

- Wizard should feel like setting up a new integration in Vercel or Linear — clean, guided, confident
- Routing table card should be the visual centerpiece of the Settings LLM section
- Embeddings warning should feel informative, not alarming — amber, not red

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-bug-fixes-and-wizard-ui*
*Context gathered: 2026-03-18*
