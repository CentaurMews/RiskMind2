# Phase 4: AI Differentiators Surfaced - Research

**Researched:** 2026-03-18
**Domain:** React UI polish — surfacing existing AI features as visible, auditable UI elements
**Confidence:** HIGH (all findings from direct codebase inspection)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Parse the existing `---AI Enrichment---` separator in the risk description field to detect enrichment
- Display enrichment section separately from the base description — collapsible "AI Enrichment" panel
- Subtle "AI Enhanced" badge with sparkle icon next to the risk title (Apple-like, not shouty)
- Use `updatedAt` as proxy for enrichment date (no schema change needed)
- No new columns (enrichedAt, enrichmentSummary) — parse from existing data for demo
- AI Provenance display: show model name, date, and context on the enrichment panel
- Keep treatment suggestions ephemeral — button triggers AI suggestions, they appear inline
- Treatment suggestions are already mostly working — polish the display for demo readiness
- Ensure recommendation cards show: strategy, description, rationale, estimated cost, ROI, expected score reduction
- Breadcrumb chain on risk detail: "Originated from: Signal #X → Finding #Y → This Risk" (clickable links)
- Call existing `GET /v1/risks/:riskId/sources` endpoint (exists but unused) to get source data
- Show "Sources" section on risk detail listing where the risk originated (signal, finding, agent detection)
- On signal list: the existing FindingPanel side-sheet already shows "View Risk" link — ensure it's polished
- AI Provenance at each decision point: show which model triaged the signal, which model linked the finding
- Every AI-touched entity shows a provenance receipt
- On enriched risks: "Enriched by [model] on [date] · Added [context summary]"
- On treatment suggestions: "Suggested by [model] · Confidence: [level]"
- On signal triage: "Triaged by [model] · Confidence: [score]"
- Consistent `<AiProvenance>` component reused across pages
- Data comes from: jobs table (enrichment results), inline API responses (treatment/scoring), signal confidence field

### Claude's Discretion
- Exact parsing logic for `---AI Enrichment---` separator
- AiProvenance component design details
- How to handle risks that have no enrichment (no badge, clean description)
- Treatment suggestion card layout refinements
- Whether to add a "Re-enrich" button on already-enriched risks
- Sources section layout on risk detail

### Deferred Ideas (OUT OF SCOPE)
- FORE-01: Foresight page with autonomous agent findings inbox
- FORE-02: Monte Carlo simulation for risk scenario modeling
- FORE-03: OSINT/external data enrichment for risk horizon forecasting
- FORE-04: LLM observability dashboard
- Full "Risk Radar" — semantic risk landscape visualization using pgvector
- Foresight page at `artifacts/riskmind-app/src/pages/foresight/foresight.tsx` — leave as "Coming Soon" stub
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | AI enrichment visible on risk detail — "AI-enriched" badge, enrichment summary, date | Description field uses `---AI Enrichment---` separator (confirmed in ai-workers.ts line 141); `useListRiskSources` hook exists; `updatedAt` serves as enrichment date proxy |
| AI-02 | AI-generated treatment suggestions surfaced on risk detail page | `useAiTreatmentRecommendations` hook + `Collapsible` panel already exists in treatments-tab.tsx; needs polish pass for strategy/rationale/cost/ROI/score-reduction display |
| AI-04 | Signal-to-finding-to-risk traceability — visual chain showing how signals become risks | `riskSourcesTable` schema confirmed with sourceType (signal/finding/agent_detection) + sourceId; `useListRiskSources` hook exported; FindingPanel in signal-list.tsx has "View Risk" button |
</phase_requirements>

---

## Summary

Phase 4 is a pure UI polish and surfacing phase. No new backend capabilities are needed — every API endpoint, hook, and data structure already exists and works. The work is entirely about making AI-generated content visible, readable, and auditable in the frontend.

The three requirements map to three independent UI areas: the risk detail description card (AI-01), the treatments tab collapsible panel (AI-02), and a new Sources section plus breadcrumb chain on risk detail (AI-04). A single shared `<AiProvenance>` component will reduce duplication across all three.

The critical parsing task for AI-01 is string-splitting `risk.description` on `\n\n---AI Enrichment---\n`. The enrichment content is the substring after that separator. Risks without enrichment show nothing (no badge, clean description). The `updatedAt` field serves as the enrichment date without any schema change.

**Primary recommendation:** Build the `<AiProvenance>` component first in a shared location, then wire AI-01, AI-02, and AI-04 in sequence. Each is self-contained and can be a separate plan.

---

## Standard Stack

### Core (confirmed from codebase inspection)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x (existing) | Component framework | Project standard |
| `@workspace/api-client-react` | workspace | Generated hooks | All hooks are pre-generated |
| shadcn/ui `Collapsible` | existing | Collapsible enrichment panel | Already used in treatments-tab.tsx |
| shadcn/ui `Badge` | existing | "AI Enhanced" badge | `SeverityBadge`/`StatusBadge` pattern established |
| shadcn/ui `Breadcrumb` | existing | Signal→Finding→Risk chain | Already imported in risk-detail.tsx |
| `lucide-react` `Sparkles` | existing | AI icon for badge/panels | Already used throughout |
| `date-fns` `format` | existing | Format enrichment date | Already used in risk-detail.tsx |

### Pre-generated hooks (from `@workspace/api-client-react`)
| Hook | What it fetches | Status |
|------|----------------|--------|
| `useListRiskSources(riskId)` | `GET /v1/risks/:riskId/sources` → `RiskSource[]` | EXISTS, not yet called in risk-detail.tsx |
| `useAiTreatmentRecommendations` | `POST /v1/risks/:id/ai-treatment-recommendations` | EXISTS, already used in treatments-tab.tsx |
| `useGetRisk(id)` | Full risk object including `description`, `updatedAt` | EXISTS, already used in risk-detail.tsx |

### No new packages required
All dependencies are already installed. This phase adds zero new npm packages.

---

## Architecture Patterns

### Recommended Project Structure
```
artifacts/riskmind-app/src/
├── components/
│   └── ai/
│       └── ai-provenance.tsx      # New shared component (AI-01, AI-02, AI-04)
├── pages/risks/
│   ├── risk-detail.tsx            # Modify: enrichment parsing, badge, sources section
│   └── treatments-tab.tsx         # Modify: polish AI recommendations cards
└── pages/signals/
    └── signal-list.tsx            # Modify: polish FindingPanel "View Risk" link
```

### Pattern 1: Description Parsing (AI-01)
**What:** Split `risk.description` on the separator to extract base description and enrichment content.
**When to use:** Whenever displaying risk description — at read time, not stored separately.
**Example:**
```typescript
// Parse enrichment from existing description field
const AI_ENRICHMENT_SEPARATOR = "\n\n---AI Enrichment---\n";

function parseRiskDescription(description: string | null | undefined) {
  if (!description) return { base: null, enrichment: null };
  const idx = description.indexOf(AI_ENRICHMENT_SEPARATOR);
  if (idx === -1) return { base: description, enrichment: null };
  return {
    base: description.slice(0, idx),
    enrichment: description.slice(idx + AI_ENRICHMENT_SEPARATOR.length),
  };
}
```

### Pattern 2: AiProvenance Component
**What:** Reusable receipt component — model name, date, confidence or action label.
**When to use:** Wherever AI touched data: enrichment panel, treatment card, signal triage row.
**Props interface:**
```typescript
interface AiProvenanceProps {
  action: string;           // e.g. "Enriched by", "Suggested by", "Triaged by"
  model?: string;           // e.g. "gpt-4o" or "AI" if model name unavailable
  date?: string | Date;     // enrichment/triage date
  confidence?: number;      // 0.0–1.0, shown as percentage
  collapsible?: boolean;    // defaults false; wrap in Collapsible if true
  className?: string;
}
```

### Pattern 3: Sources Section (AI-04)
**What:** Call `useListRiskSources(riskId)` and render a section listing originating sources with clickable links and source-type badges.
**When to use:** On risk-detail.tsx, below the description card or in a new card.
**Data shape confirmed:**
```typescript
interface RiskSource {
  id?: string;
  riskId?: string;
  sourceType?: "signal" | "finding" | "agent_detection";
  sourceId?: string;
  createdAt?: string;
}
```
**Navigation targets:**
- `sourceType === "signal"` → `/signals` (no individual signal detail page; link to list)
- `sourceType === "finding"` → finding.riskId exists, link available via signal-list FindingPanel or `/risks/:id`
- `sourceType === "agent_detection"` → no dedicated page currently; show label only (no link)

### Pattern 4: "AI Enhanced" Badge
**What:** Subtle badge inline with risk title using existing `Badge` component and `Sparkles` icon.
**When to use:** Only when `parseRiskDescription(risk.description).enrichment !== null`.
**Style:** Follow `SeverityBadge` pattern — `variant="outline"`, muted primary color, small text.
```typescript
// Badge placement: inline next to h1 in risk-detail.tsx header
{enrichment && (
  <Badge variant="outline" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5
    bg-primary/5 text-primary border-primary/20 font-medium">
    <Sparkles className="h-3 w-3" />
    AI Enhanced
  </Badge>
)}
```

### Anti-Patterns to Avoid
- **Storing parsed enrichment in state:** Parse inline from `risk.description` on every render — no useState for this.
- **Showing "AI Enhanced" badge before data loads:** Gate on `!isLoading && risk` before parsing.
- **Blocking on job polling:** Enrichment result is already written to `description` — just display what's there. No need to poll jobs table from the frontend for AI-01.
- **Touching the Foresight page:** `foresight.tsx` is explicitly out of scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sources API fetch | `fetch('/api/v1/risks/...')` | `useListRiskSources(riskId)` | Hook already generated, handles auth headers, caching, loading state |
| Treatment recs fetch | Custom fetch | `useAiTreatmentRecommendations` | Already wired in treatments-tab.tsx |
| Collapsible panel | Custom toggle state component | shadcn `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` | Already used in treatments-tab.tsx; consistent look |
| Breadcrumb chain | Manual `<span>` links | shadcn `Breadcrumb` components | Already imported and used in risk-detail.tsx |
| Date formatting | `new Date().toLocaleDateString()` | `format(new Date(date), 'MMM d, yyyy')` from `date-fns` | Consistent with rest of codebase |

**Key insight:** Every API capability needed already exists and has a generated React hook. This phase adds zero backend code.

---

## Common Pitfalls

### Pitfall 1: Separator Variant Mismatch
**What goes wrong:** The enrichment panel shows nothing even for enriched risks, or crashes with incorrect string slicing.
**Why it happens:** The exact separator written by `ai-workers.ts` line 141 is `\n\n---AI Enrichment---\n` (two leading newlines, one trailing). Using `---AI Enrichment---` without the surrounding newlines in `indexOf()` will fail to split correctly.
**How to avoid:** Use the separator constant exactly as written in ai-workers.ts: `` `\n\n---AI Enrichment---\n` ``.
**Warning signs:** `enrichment` is always null even for known-enriched risks.

### Pitfall 2: useListRiskSources Not Exported from Package Index
**What goes wrong:** TypeScript import error: "Module '@workspace/api-client-react' has no exported member 'useListRiskSources'".
**Why it happens:** `index.ts` does `export * from "./generated/api"` — hook IS exported. But if there's a cached build, it may not reflect the generated file.
**How to avoid:** Verify the import works; if stale, run `pnpm build` in `lib/api-client-react`.
**Warning signs:** TypeScript compile error on import, not a runtime error.

### Pitfall 3: Sources Section Shows No Data (Empty riskSourcesTable)
**What goes wrong:** `GET /v1/risks/:riskId/sources` returns `{ data: [] }` for all demo risks.
**Why it happens:** `riskSourcesTable` is only populated when risks are created via `POST /v1/risks` with a `sources` array, or when the aggregator writes findings. Demo seed data may not have populated sources rows.
**How to avoid:** Check the seed data. If sources table is empty for seeded risks, the Sources section should show a graceful empty state ("No linked sources") rather than hiding the section entirely. This demonstrates the feature exists.
**Warning signs:** Section renders but is always empty in demo.

### Pitfall 4: Model Name Not Available in UI
**What goes wrong:** AiProvenance component can't display model name because the risk/signal objects don't carry a `modelName` field.
**Why it happens:** The `ai-enrich` worker just writes the enrichment text to `description` — it doesn't store which model was used anywhere on the risk row. The `llmConfigsTable` has the model name, but linking it back to a specific enrichment would require querying the jobs table.
**How to avoid:** Avoid querying the jobs table from the frontend for model provenance — it's complex and adds a query. Instead, use "AI" as a placeholder or query `GET /v1/jobs` for the most recent completed `ai-enrich` job for this risk if a simpler endpoint exists. For demo purposes, showing "AI · [date]" is acceptable. Mark as Claude's Discretion.
**Warning signs:** Provenance receipt looks sparse or shows "unknown".

### Pitfall 5: Signal sourceType Links to Nonexistent Route
**What goes wrong:** Clicking a signal source link navigates to `/signals/:id` which doesn't exist (only `/signals` list exists).
**Why it happens:** There is no signal detail page in the app.
**How to avoid:** For `sourceType === "signal"`, link to `/signals` (the list) or render as non-clickable text with a signal icon. Do not generate `/signals/${sourceId}` links.
**Warning signs:** 404 or blank page when clicking signal source link.

---

## Code Examples

### Exact Separator (from ai-workers.ts line 141)
```typescript
// Source: artifacts/api-server/src/lib/ai-workers.ts line 141
description: `${risk.description || ""}\n\n---AI Enrichment---\n${response}`,
```
This confirms the separator is `\n\n---AI Enrichment---\n`.

### useListRiskSources hook usage
```typescript
// Source: lib/api-client-react/src/generated/api.ts lines 982-1054
import { useListRiskSources } from "@workspace/api-client-react";

const { data: sourcesData, isLoading: sourcesLoading } = useListRiskSources(riskId);
const sources = sourcesData?.data ?? [];
```

### RiskSource shape (from api.schemas.ts)
```typescript
// Source: lib/api-client-react/src/generated/api.schemas.ts lines 166-176
interface RiskSource {
  id?: string;
  riskId?: string;
  sourceType?: "signal" | "finding" | "agent_detection";
  sourceId?: string;
  createdAt?: string;
}
```

### Existing "View Risk" link in FindingPanel (already works)
```typescript
// Source: artifacts/riskmind-app/src/pages/signals/signal-list.tsx lines 155-167
{finding.riskId ? (
  <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 p-4">
    <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
      This finding is already linked to a risk.
    </p>
    <Button size="sm" variant="outline" className="mt-2"
      onClick={() => { onClose(); setLocation(`/risks/${finding.riskId}`); }}>
      View Risk
    </Button>
  </div>
) : ...}
```

### Existing Collapsible pattern from treatments-tab.tsx
```typescript
// Source: artifacts/riskmind-app/src/pages/risks/treatments-tab.tsx lines 336-419
<Collapsible open={aiOpen} onOpenChange={setAiOpen}>
  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors">
    {aiOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    <Sparkles className="h-4 w-4 text-primary" />
    AI Recommendations
  </CollapsibleTrigger>
  <CollapsibleContent className="mt-4">
    {/* content */}
  </CollapsibleContent>
</Collapsible>
```

### AiProvenance component skeleton (to create)
```typescript
// New file: artifacts/riskmind-app/src/components/ai/ai-provenance.tsx
import { Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AiProvenanceProps {
  action: string;
  model?: string;
  date?: string | Date;
  confidence?: number;
  className?: string;
}

export function AiProvenance({ action, model, date, confidence, className }: AiProvenanceProps) {
  return (
    <div className={cn("flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <Sparkles className="h-3 w-3 text-primary/60" />
      <span>{action} <span className="font-medium text-foreground/70">{model ?? "AI"}</span></span>
      {date && <span>· {format(new Date(date), "MMM d, yyyy")}</span>}
      {confidence != null && (
        <span>· <span className="font-medium">{Math.round(confidence * 100)}% confidence</span></span>
      )}
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Full description shown as-is | Parse `---AI Enrichment---` separator, show base + collapsible enrichment | AI enrichment becomes visible and auditable |
| Treatment suggestions collapsed by default, unlabeled | Collapsible with AI attribution header, already partially works | Demonstrates AI capability clearly |
| `GET /v1/risks/:riskId/sources` endpoint exists but is never called from UI | Call it, render Sources section with source-type badges | Closes the traceability story |
| "View Risk" link in FindingPanel functional but unstyled | Polish to match Phase 3 Apple-like design | Consistent premium look |

---

## Open Questions

1. **Model name for provenance receipt**
   - What we know: `ai-workers.ts` writes enrichment text to `description` but does not store which model was used on the risk row. The model is on `llmConfigsTable`.
   - What's unclear: Is there a simple way to fetch the model name used for a specific enrichment job? The `GET /v1/jobs/:id` endpoint exists and returns the full job row, but we'd need the jobId from the enrich response.
   - Recommendation: For demo, show "AI" as model placeholder. Optionally show the default configured model name by fetching `GET /v1/llm-configs` (if that endpoint exists) — but this is Claude's Discretion and not required for the badge/panel to work.

2. **Sources table population for demo data**
   - What we know: `riskSourcesTable` has the right schema. The `POST /v1/risks` endpoint accepts `sources` array and populates the table. The `RiskSourceAggregator` also populates it.
   - What's unclear: Do the seeded demo risks have entries in `risk_sources`?
   - Recommendation: The implementer should check with `SELECT * FROM risk_sources LIMIT 5;`. If empty, the Sources section still ships with graceful empty state — it proves the feature works when the chain is complete.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No automated test framework detected in project |
| Config file | None |
| Quick run command | Manual browser inspection |
| Full suite command | Manual smoke test via https://app.riskmind.net |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | "AI Enhanced" badge appears on enriched risk | manual-only | N/A — visual inspection on risk detail page | N/A |
| AI-01 | Base description and enrichment section split correctly | manual-only | N/A — verify with a known-enriched risk in demo DB | N/A |
| AI-01 | No badge or enrichment panel on un-enriched risk | manual-only | N/A — verify with a risk that was never enriched | N/A |
| AI-02 | Treatment AI recommendations panel shows strategy/rationale/cost/ROI | manual-only | N/A — click "Get Recommendations" on risk with LLM configured | N/A |
| AI-04 | Sources section renders on risk detail | manual-only | N/A — visual inspection on risk with sources rows | N/A |
| AI-04 | FindingPanel "View Risk" link navigates to correct risk | manual-only | N/A — click through on signal with status=finding | N/A |

### Sampling Rate
- **Per task commit:** Open risk detail in browser, confirm badge + panel render correctly
- **Per wave merge:** Full smoke test across risk detail, treatments tab, and signal list
- **Phase gate:** All three requirements visible and functional before `/gsd:verify-work`

### Wave 0 Gaps
None — no test infrastructure needed. This phase is UI-only with manual verification.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `artifacts/api-server/src/lib/ai-workers.ts` — exact `---AI Enrichment---` separator format (line 141)
- `artifacts/riskmind-app/src/pages/risks/risk-detail.tsx` — current enrichment button, description display, existing breadcrumb imports
- `artifacts/riskmind-app/src/pages/risks/treatments-tab.tsx` — existing Collapsible AI recommendations pattern, recommendation card fields
- `artifacts/api-server/src/routes/risks.ts` — `GET /v1/risks/:riskId/sources` endpoint confirmed (lines 240-251), returns `{ data: RiskSource[] }`
- `lib/api-client-react/src/generated/api.ts` — `useListRiskSources` hook confirmed generated and exported
- `lib/api-client-react/src/generated/api.schemas.ts` — `RiskSource` shape confirmed
- `lib/db/src/schema/risks.ts` — `riskSourcesTable` schema with sourceType enum
- `lib/db/src/schema/findings.ts` — `signalId` FK and `riskId` FK confirmed
- `lib/db/src/schema/signals.ts` — `confidence` field (numeric) confirmed
- `artifacts/riskmind-app/src/pages/signals/signal-list.tsx` — FindingPanel "View Risk" link confirmed at line 160-167

### Secondary (MEDIUM confidence)
- `artifacts/riskmind-app/src/components/risk-creation/ai-intelligence-panel.tsx` — SourceCard and ConfidenceBadge pattern useful as reference for `<AiProvenance>` styling
- `artifacts/riskmind-app/src/components/ui/severity-badge.tsx` — badge pattern to follow for "AI Enhanced" badge

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all hooks, components, and APIs verified by direct file inspection
- Architecture: HIGH — separator format confirmed from source, RiskSource shape confirmed from generated schema
- Pitfalls: HIGH — pitfalls derived from specific code findings (separator format, missing source rows, absent model name field)

**Research date:** 2026-03-18
**Valid until:** 2026-05-18 (stable codebase, no external dependencies introduced)
