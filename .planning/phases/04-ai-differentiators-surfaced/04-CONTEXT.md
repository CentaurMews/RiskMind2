# Phase 4: AI Differentiators Surfaced - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface RiskMind's AI-native identity in the UI: enrichment badges with AI provenance on risk detail, polished treatment suggestions, and signal-to-finding-to-risk traceability chain. Foresight page (agent findings inbox, Monte Carlo, OSINT) is deferred to v2. This phase makes existing AI features visible and auditable — not building new AI capabilities.

</domain>

<decisions>
## Implementation Decisions

### AI Enrichment Display (AI-01)
- Parse the existing `---AI Enrichment---` separator in the risk description field to detect enrichment
- Display enrichment section separately from the base description — collapsible "AI Enrichment" panel
- Subtle "AI Enhanced" badge with sparkle icon next to the risk title (Apple-like, not shouty)
- Use `updatedAt` as proxy for enrichment date (no schema change needed)
- No new columns (enrichedAt, enrichmentSummary) — parse from existing data for demo
- AI Provenance display: show model name, date, and context on the enrichment panel

### AI Treatment Suggestions (AI-02)
- Keep ephemeral — button triggers AI suggestions, they appear inline
- Already mostly works — polish the display for demo readiness
- Ensure the recommendation cards show: strategy, description, rationale, estimated cost, ROI, expected score reduction
- Apply the Apple-like minimalist design established in Phase 3

### Signal → Finding → Risk Traceability (AI-04)
- Breadcrumb chain on risk detail: "Originated from: Signal #X → Finding #Y → This Risk" (clickable links)
- Call existing `GET /v1/risks/:riskId/sources` endpoint (exists but unused) to get source data
- Show "Sources" section on risk detail listing where the risk originated (signal, finding, agent detection)
- On signal list: the existing FindingPanel side-sheet already shows "View Risk" link — ensure it's polished
- AI Provenance at each decision point: show which model triaged the signal, which model linked the finding

### AI Provenance Trail
- Every AI-touched entity shows a provenance receipt
- On enriched risks: "Enriched by [model] on [date] · Added [context summary]"
- On treatment suggestions: "Suggested by [model] · Confidence: [level]"
- On signal triage: "Triaged by [model] · Confidence: [score]"
- Consistent `<AiProvenance>` component reused across pages
- Data comes from: jobs table (enrichment results), inline API responses (treatment/scoring), signal confidence field

### Foresight — DEFERRED to v2
- Full Foresight page with Monte Carlo simulation, OSINT enrichment, scenario modeling, agent findings inbox → separate milestone
- Phase 4 does NOT touch the Foresight page — it stays as "Coming Soon" stub
- AI-03 requirement moved to v2 (FORE-01 through FORE-04)

### Claude's Discretion
- Exact parsing logic for `---AI Enrichment---` separator
- AiProvenance component design details
- How to handle risks that have no enrichment (no badge, clean description)
- Treatment suggestion card layout refinements
- Whether to add a "Re-enrich" button on already-enriched risks
- Sources section layout on risk detail

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Risk Detail (enrichment + treatments + sources)
- `artifacts/riskmind-app/src/pages/risks/risk-detail.tsx` — Current risk detail: "Enrich with AI" button, ephemeral AI rationale banner, score sections
- `artifacts/riskmind-app/src/pages/risks/treatments-tab.tsx` — Treatment display with AI recommendations panel, approval workflow
- `artifacts/api-server/src/routes/risks.ts` — Risk CRUD, `POST /:id/ai-treatment-recommendations`, `GET /:riskId/sources`
- `artifacts/api-server/src/routes/ai-enrichment.ts` — `POST /v1/risks/:riskId/enrich` (queues job)
- `artifacts/api-server/src/lib/ai-workers.ts` — `ai-enrich` worker appends `---AI Enrichment---` section to description (line 117-150)

### Signal → Finding → Risk Chain
- `lib/db/src/schema/findings.ts` — `signalId` FK to signals, `riskId` FK to risks
- `lib/db/src/schema/risks.ts` — `riskSourcesTable` with sourceType (signal | finding | agent_detection) + sourceId
- `artifacts/riskmind-app/src/pages/signals/signal-list.tsx` — FindingPanel side-sheet with "View Risk" link
- `artifacts/api-server/src/routes/findings.ts` — Finding promotion from signal

### Agent System (reference, not modifying in Phase 4)
- `artifacts/api-server/src/routes/agent.ts` — Agent runs, findings CRUD, approve/dismiss/create-risk
- `lib/db/src/schema/agent.ts` — Agent findings with narrative, severity, type, proposedAction (no confidence column)

### LLM Infrastructure
- `lib/db/src/schema/llm-configs.ts` — Provider types: openai_compat (covers OpenAI + Ollama), anthropic
- `lib/db/src/schema/jobs.ts` — Job queue with result field (enrichment output stored here)

### Foresight (NOT modifying — deferred to v2)
- `artifacts/riskmind-app/src/pages/foresight/foresight.tsx` — "Coming Soon" stub, leave as-is

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SeverityBadge` + `StatusBadge` — reuse pattern for "AI Enhanced" badge
- `Card`, `Collapsible` — for enrichment panel
- `Breadcrumb` components (added in Phase 3) — for traceability chain
- `toast()` (wired in Phase 3) — for AI operation feedback
- `Skeleton` (wired in Phase 3) — for loading states on AI sections

### Established Patterns
- Apple-like minimalist design (Phase 3)
- Empty states with icon + CTA
- Skeleton loading on all data-fetching sections
- Toast errors on all mutations
- `customFetch` for direct API calls (established in Phase 3 for KRI/search)

### Integration Points
- `risk-detail.tsx` — add enrichment parsing, AiProvenance component, Sources section
- `treatments-tab.tsx` — polish AI recommendations display
- `signal-list.tsx` FindingPanel — ensure "View Risk" link is styled consistently
- New `<AiProvenance>` component to create and reuse across pages

</code_context>

<specifics>
## Specific Ideas

- "AI Enhanced" badge should feel subtle and premium — sparkle icon, muted color, not a loud banner
- Provenance receipts should be dismissible/collapsible — not overwhelming the main content
- Treatment suggestions already work well — this is a polish pass, not a rebuild
- Sources section on risk detail should link back to the originating signal/finding with one click

</specifics>

<deferred>
## Deferred Ideas

### Foresight v2 (separate milestone)
- FORE-01: Agent findings inbox with approve/dismiss/create-risk workflow
- FORE-02: Monte Carlo simulation for risk scenario modeling
- FORE-03: OSINT/external data enrichment for risk horizon forecasting
- FORE-04: LLM observability dashboard (token usage, cost analytics, model performance)
- Full "Risk Radar" — semantic risk landscape visualization using pgvector

</deferred>

---

*Phase: 04-ai-differentiators-surfaced*
*Context gathered: 2026-03-18*
