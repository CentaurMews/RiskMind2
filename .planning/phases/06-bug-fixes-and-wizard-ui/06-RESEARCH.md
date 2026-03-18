# Phase 6: Bug Fixes and Wizard UI - Research

**Researched:** 2026-03-18
**Domain:** React multi-step wizard (Sheet/drawer), Express bug fixes, Drizzle ORM subquery patterns
**Confidence:** HIGH — all findings are drawn directly from the existing codebase; no external library research required

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Wizard container**: Sheet/drawer sliding in from the right — stays in Settings context, Apple-like
- **Navigation**: Full back/forward stepper — clickable step indicators, users can review and change earlier choices
- **Steps**: 6 fixed steps (provider select, credentials, model discovery, model select, benchmark, routing assignment)
- **Completion**: Close sheet, routing table card on Settings page updates immediately
- **Design**: Apple-like minimalist, consistent with Phase 3 design language
- **Routing table card**: Persistent card on Settings page (not inside wizard), visual grid of 6 task types × assigned model
- **FIX-01**: Replace LLM call with honest stub — "Document content extraction coming soon. File received: [filename]" — no AI call made
- **FIX-03**: Replace existing enrichment block, never stack — split on `---AI Enrichment---`, keep base, append new
- **FIX-04**: Change 400 "AI returned invalid format" to 502 "AI response could not be processed. This is a temporary issue — please try again." + server-side log of raw LLM output
- **FIX-05**: Compute `lastAssessmentDate` and `openFindingsCount` from DB — join against `questionnaires` (last completed) and `findings` tables — add to GET /v1/vendors response — wire in vendor-list.tsx
- **FIX-06**: Call `GET /v1/settings/embeddings-health` at top of Settings page — amber warning banner if `configured: false` — dismissible but reappears on reload
- **FIX-07**: Model input becomes a Select component driven by discovered models list — backend validates model against provider format, rejects with 422

### Claude's Discretion
- Wizard step transitions and animations
- Stepper component design (dots vs numbers vs text)
- Benchmark comparison table column widths and sorting
- Vendor scorecard query exact JOIN shape
- Embeddings warning banner styling
- Error message exact wording refinements

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-01 | Document processing worker extracts real file content or shows clear "coming soon" instead of hallucinated summaries | `doc-process` worker located at `ai-workers.ts` lines 156-205; LLM call is lines 179-188; stub replaces the entire LLM call + status update; sets status to `"processed"` with stub summary |
| FIX-03 | Re-enriching a risk replaces existing AI enrichment section instead of appending duplicate blocks | `ai-enrich` worker at `ai-workers.ts` lines 121-154; enrichment append is line 145: `${risk.description}\n\n---AI Enrichment---\n${response}`; idempotency fix: check for `---AI Enrichment---` in existing description before writing |
| FIX-04 | Vendor AI question generation returns clear error on LLM parse failure | `vendors.ts` line 497: `badRequest(res, "AI returned invalid format. Please try again.")`; change to `res.status(502).json(...)` + `console.error` the raw `result` value |
| FIX-05 | Vendor scorecard displays real data (last assessment date + open findings count) | `GET /v1/vendors` at `vendors.ts` lines 48-87; current select has no joins; needs subqueries against `questionnairesTable` (filter `status = 'completed'`, group by `vendorId`, max `updatedAt`) and `findingsTable` (filter `status = 'open'`, group by `vendorId`, count); `vendor-list.tsx` lines 281-285 have hardcoded "Never" and "—" placeholders ready to wire |
| FIX-06 | Settings page shows warning when no embeddings provider is configured | `GET /v1/settings/embeddings-health` endpoint exists at `settings.ts` lines 370-394, returns `{ configured: boolean }`; hook `useGetEmbeddingsHealth` available in generated client; banner goes above tabs in `settings.tsx` |
| FIX-07 | Model name validation prevents saving invalid model IDs | `POST /v1/settings/llm-providers` and `PUT /:id` in `settings.ts`; currently accept free-text `model` field; backend needs to call `discoverModels(configId, tenantId)` then check submitted model against discovered list; frontend model `<Input>` in provider sheet (lines 786-798 in `settings.tsx`) becomes `<Select>` |
| LLM-01 | Admin can add a new LLM provider from a provider dropdown | Wizard Step 1 — provider select cards using `PROVIDER_CATALOG` constant (to be defined) with icons, capabilities, pricing tier |
| LLM-02 | Admin enters API key (and base URL) and validates connection | Wizard Step 2 — credentials form + "Test Connection" button using `useTestLlmProvider` mutation; config created here then used for discovery |
| LLM-03 | System auto-discovers available models and displays for selection | Wizard Step 3 — auto-fetches via `useDiscoverLlmModels` mutation after Step 2 completes; `LlmDiscoverResult.models` is `DiscoveredModel[]` grouped by `capability` ("chat" / "embeddings" / "code") |
| LLM-04 | Admin selects one or more models and saves configuration | Wizard Step 4 — checkboxes from discovered models; saving calls `useUpdateLlmProvider` to persist `model` field + nickname |
| LLM-05 | Admin can test connection and run benchmark (TTFT, latency, quality) | Wizard Step 5 — `useBenchmarkLlmProvider` mutation per selected model; result shape: `{ ttftMs, totalLatencyMs, qualityScore, model }` |
| LLM-06 | System suggests optimal model assignment per task type | Wizard Step 6 — routing assignment; `suggestRouting()` exposed via `useGetLlmRouting` response (`suggestions` field maps each task type to recommended model); `useUpdateLlmRouting` saves final routing |
</phase_requirements>

---

## Summary

Phase 6 is split into two independent work streams: six backend/frontend bug fixes (FIX-01, FIX-03 through FIX-07) and a 6-step LLM Config Wizard frontend built over Phase 5's fully operational backend APIs. All required backend endpoints and generated React hooks already exist. No new API endpoints or database migrations are needed for the wizard. Bug fixes are surgical, contained changes to three backend files and two frontend files.

The wizard is the most complex UI deliverable. The `<Sheet>` component already exists (`sheet.tsx`) and is already used in `vendor-list.tsx` (SheetTrigger pattern) and `settings.tsx` (programmatic `open` state pattern). The current "Add Provider" flow in `settings.tsx` uses a single-page form inside a Sheet; the wizard replaces this with a stateful multi-step flow inside the same sheet drawer. Multi-step state management is pure React (`useState` for step index and wizard data), with no external form library required given the project's existing patterns.

**Primary recommendation:** Implement bug fixes first (low risk, verifiable immediately), then build the wizard as a self-contained component (`LlmConfigWizard`) imported into `settings.tsx` as a sibling to the existing provider list card.

---

## Standard Stack

### Core (all pre-installed, no new installs required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React / useState | project default | Multi-step wizard state | Sufficient for linear step flow |
| @radix-ui/react-dialog | project default | Drives `<Sheet>` component | Already wrapped in `sheet.tsx` |
| shadcn/ui components | project default | Card, Badge, Button, Skeleton, Select, Checkbox, Table, Switch | Already used throughout codebase |
| @tanstack/react-query | project default | useDiscoverLlmModels, useBenchmarkLlmProvider, useGetLlmRouting, useUpdateLlmRouting | All hooks generated and exported |
| lucide-react | project default | Icons (Server, Zap, CheckCircle2, Loader2, etc.) | Already imported in settings.tsx |
| drizzle-orm / eq / sql / and | project default | Backend vendor list subquery enhancements | Already imported in vendors.ts |
| date-fns | project default | Formatting lastAssessmentDate | Already imported in settings.tsx |

### No New Dependencies
No `npm install` step is required for this phase. Every library and pattern needed is already present in the monorepo.

---

## Architecture Patterns

### Recommended Project Structure (new files)
```
artifacts/riskmind-app/src/pages/settings/
├── settings.tsx                     # Modified — add wizard trigger, routing card, embeddings banner
├── llm-config-wizard.tsx            # NEW — self-contained wizard component
└── routing-table-card.tsx           # NEW — standalone routing table card component

artifacts/api-server/src/lib/
└── ai-workers.ts                    # Modified — FIX-01 (doc-process), FIX-03 (ai-enrich)

artifacts/api-server/src/routes/
├── vendors.ts                       # Modified — FIX-04 (ai-questions 400→502), FIX-05 (scorecard subqueries)
└── settings.ts                      # Modified — FIX-07 (model validation on create/update)
```

### Pattern 1: Sheet with Programmatic Open (existing pattern in settings.tsx)
**What:** `<Sheet open={bool} onOpenChange={fn}>` without SheetTrigger — open state controlled by parent
**When to use:** When the trigger is outside the Sheet (e.g., "Add Provider" button in card header)
**Example (from settings.tsx line 747):**
```tsx
<Sheet open={providerSheet !== "closed"} onOpenChange={(o) => { if (!o) { setProviderSheet("closed"); setEditingProvider(null); } }}>
  <SheetContent className="sm:max-w-md w-full border-l overflow-y-auto">
    ...
  </SheetContent>
</Sheet>
```

### Pattern 2: SheetTrigger (existing pattern in vendor-list.tsx)
**What:** `<SheetTrigger asChild>` wraps the button that opens the sheet
**When to use:** When trigger is co-located with the sheet (not needed for wizard — use Pattern 1)

### Pattern 3: Multi-Step Wizard State (recommended)
**What:** Single `useState` for `wizardStep: number` (0–5) + one `useState` for accumulated wizard data
**When to use:** Linear 6-step flow with back/forward navigation
**Example:**
```tsx
const [step, setStep] = useState(0);
const [wizardData, setWizardData] = useState<WizardData>({
  selectedProvider: null,
  configId: null,           // created at Step 2
  credentials: null,
  discoveredModels: [],
  selectedModels: [],
  benchmarkResults: [],
  routing: {},
});

// Step navigation
const goNext = () => setStep(s => Math.min(5, s + 1));
const goBack = () => setStep(s => Math.max(0, s - 1));
```

### Pattern 4: React Query Cache Invalidation on Wizard Complete (existing pattern)
**What:** After wizard completion, invalidate provider list and routing table queries
**Example (from settings.tsx lines 147-148):**
```tsx
queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/llm-providers"] });
// Also add:
queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/llm-routing"] });
```

### Pattern 5: FIX-03 Enrichment Idempotency
**What:** Split description on sentinel, keep base, append new enrichment
**Example:**
```typescript
// In ai-enrich worker (ai-workers.ts)
const ENRICHMENT_SENTINEL = "\n\n---AI Enrichment---\n";
const baseDescription = risk.description?.split(ENRICHMENT_SENTINEL)[0] || "";
const newDescription = `${baseDescription}${ENRICHMENT_SENTINEL}${response}`;

await db.update(risksTable).set({
  description: newDescription,
  updatedAt: new Date(),
}).where(eq(risksTable.id, riskId));
```

### Pattern 6: FIX-05 Vendor Scorecard Subqueries
**What:** Drizzle ORM SQL subquery pattern to compute aggregate fields for vendor list
**Exact columns available in `findingsTable`:** `id`, `tenantId`, `signalId`, `riskId`, `vendorId`, `title`, `description`, `status` (enum: open/investigating/resolved/false_positive), `createdAt`, `updatedAt`
**Exact columns in `questionnairesTable`:** `id`, `tenantId`, `vendorId`, `title`, `status` (enum: draft/sent/in_progress/completed), `updatedAt`, etc.
**Query shape:**
```typescript
// In GET /v1/vendors (vendors.ts)
import { findingsTable } from "@workspace/db";

const vendors = await db.select({
  // ...existing columns...
  openFindingsCount: sql<number>`(
    SELECT count(*)::int FROM findings
    WHERE findings.vendor_id = ${vendorsTable.id}
    AND findings.status = 'open'
    AND findings.tenant_id = ${tenantId}
  )`,
  lastAssessmentDate: sql<string | null>`(
    SELECT max(q.updated_at)::text FROM questionnaires q
    WHERE q.vendor_id = ${vendorsTable.id}
    AND q.status = 'completed'
    AND q.tenant_id = ${tenantId}
  )`,
}).from(vendorsTable)
  .where(and(...conditions))
  .limit(Number(limit))
  .offset(offset)
  .orderBy(vendorsTable.createdAt);
```

### Pattern 7: FIX-07 Model Validation Flow
**What:** On POST/PUT to llm-providers, if a model was submitted, verify it against discovered models list
**Implementation note:** `discoverModels()` requires an existing `configId`. For create (POST), insert the record first, then validate; if validation fails, delete the just-inserted record (or validate before insert using a temporary in-memory check based on providerType). Simplest approach: validate after creation, delete on failure.
**Alternative:** Since FIX-07 is about preventing invalid free-text, the backend can use a lighter pattern — check model against `ANTHROPIC_MODELS` for anthropic providerType, or call `discoverModels` for openai_compat. The decision on exact shape is Claude's discretion.

### Anti-Patterns to Avoid
- **Putting wizard state in settings.tsx directly:** Extracts into `llm-config-wizard.tsx` as a dedicated component to avoid bloating the already 860-line settings.tsx
- **Using SheetTrigger for wizard:** The "Add Provider" button is in the card header — use programmatic open (Pattern 1)
- **Stacking SheetContent for different Sheet states:** The wizard uses a single Sheet instance with step-based content switching inside
- **Calling suggestRouting() in Step 6 with a separate API call:** Use the `suggestions` field already returned by `useGetLlmRouting` (GET /v1/settings/llm-routing returns both `entries` and `suggestions`)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drawer/overlay animation | Custom CSS drawer | `<Sheet side="right">` from `sheet.tsx` | Radix Dialog manages focus trap, escape key, animation, backdrop — all free |
| Step progress indicator | Custom stepper component | Simple `flex` row of numbered/labeled divs with active state class | No library needed; project has no Stepper library and the design is bespoke |
| API polling during benchmark | Manual setTimeout polling | useBenchmarkLlmProvider mutation with `onSuccess`/`onError` callbacks | Benchmark is synchronous (3 calls, returns result); no polling needed |
| Model list grouping | Custom groupBy | `Array.prototype.reduce` | `DiscoveredModel.capability` is string[] — group by first capability with reduce |
| Cache invalidation on wizard complete | Manual state refresh | `queryClient.invalidateQueries(...)` | Already used throughout settings.tsx; zero new patterns needed |

---

## Common Pitfalls

### Pitfall 1: FIX-03 Sentinel String Already Contains Leading Newlines
**What goes wrong:** `risk.description` may be null, and `split("\n\n---AI Enrichment---\n")` on null throws
**Why it happens:** Not all risks have descriptions; the enrichment worker uses `risk.description || ""`
**How to avoid:** Always coerce: `const base = (risk.description || "").split(ENRICHMENT_SENTINEL)[0]`
**Warning signs:** TypeScript error on `.split()` call if description is typed as `string | null`

### Pitfall 2: FIX-05 Subquery Returns Null, Not 0, for Vendors With No Findings
**What goes wrong:** `openFindingsCount` is `null` for new vendors with no findings; frontend renders "null" instead of "0"
**Why it happens:** SQL `count(*)` in a correlated subquery returns NULL when no rows match in some DB configurations
**How to avoid:** Use `COALESCE(count(*)::int, 0)` in the SQL subquery; on frontend, `vendor.openFindingsCount ?? 0`

### Pitfall 3: Wizard Step 3 Auto-Fetch Fires Before Config is Persisted
**What goes wrong:** `useDiscoverLlmModels` mutation fires with the new configId from Step 2, but the config row hasn't been created yet
**Why it happens:** `onSuccess` callback from `useCreateLlmProvider` may be called before the DB write is fully committed in some race conditions
**How to avoid:** Only set the `configId` in wizard state inside the `onSuccess` handler, and only advance to Step 3 after state is confirmed. Use `useEffect` that fires on configId change to trigger discovery.

### Pitfall 4: SheetContent Width for 6-Step Wizard
**What goes wrong:** Default `sm:max-w-sm` on SheetContent is too narrow for benchmark comparison table and routing grid
**Why it happens:** The `sheetVariants` right side default is `sm:max-w-sm` (line 43 in sheet.tsx)
**How to avoid:** Use `className="sm:max-w-2xl w-full border-l overflow-y-auto"` for the wizard's SheetContent — overrides the CVA default

### Pitfall 5: FIX-07 Model Validation for Edit (PUT) Without New API Key
**What goes wrong:** On PUT /v1/settings/llm-providers/:id, the existing encrypted API key is not re-sent; `discoverModels()` needs a live API key to call provider APIs
**Why it happens:** Edit flow intentionally omits API key field unless changed (see settings.tsx line 813)
**How to avoid:** For FIX-07 backend validation on PUT, use the stored encrypted key (already in DB) via `resolveConfigById(configId, tenantId)` — this is exactly what `discoverModels()` already does internally

### Pitfall 6: Routing Table Card Query Key Mismatch
**What goes wrong:** After wizard completes and calls `queryClient.invalidateQueries`, the routing table card doesn't refresh
**Why it happens:** Query key for `useGetLlmRouting` must exactly match what was registered; from generated client it is `["/api/v1/settings/llm-routing"]`
**How to avoid:** Use the generated `getGetLlmRoutingQueryKey()` function or hardcode `["/api/v1/settings/llm-routing"]` for invalidation

---

## Code Examples

### FIX-01: Document Processing Stub
Source: `artifacts/api-server/src/lib/ai-workers.ts` lines 156-205

**Before (lines 179-195):**
```typescript
const response = await callLLM(tenantId, [
  { role: "system", content: "..." },
  { role: "user", content: `Document: ${doc.fileName}...` },
], "enrichment");

await db.update(documentsTable).set({
  status: "processed",
  summary: response,
  updatedAt: new Date(),
}).where(eq(documentsTable.id, documentId));
```

**After:**
```typescript
// FIX-01: Honest stub — no LLM call made, just store informational message
const stubSummary = `Document content extraction coming soon. File received: ${doc.fileName}`;

await db.update(documentsTable).set({
  status: "processed",
  summary: stubSummary,
  updatedAt: new Date(),
}).where(eq(documentsTable.id, documentId));

return { status: "processed" };
// Note: remove the try/catch error handler and the callLLM + isAvailable check above
```

Note: The `isAvailable` check (lines 170-177) and LLM availability guard should also be removed — the stub always succeeds regardless of LLM configuration.

### FIX-04: Vendor AI Question Error — 400 to 502
Source: `artifacts/api-server/src/routes/vendors.ts` lines 491-498

**Before:**
```typescript
} catch {
  badRequest(res, "AI returned invalid format. Please try again.");
  return;
}
```

**After:**
```typescript
} catch (parseErr) {
  console.error("[Vendor AI Questions] LLM returned unparseable response:", result);
  res.status(502).json({ error: "AI response could not be processed. This is a temporary issue — please try again." });
  return;
}
```

### FIX-06: Embeddings Warning Banner in Settings
Source: extend `artifacts/riskmind-app/src/pages/settings/settings.tsx`

```tsx
// Add hook at top of component
const { data: embeddingsHealth } = useGetEmbeddingsHealth({
  query: { queryKey: ["/api/v1/settings/embeddings-health"] }
});

// Add state for dismissal
const [embeddingsBannerDismissed, setEmbeddingsBannerDismissed] = useState(false);

// Render above Tabs (after the h1/p block)
{embeddingsHealth && !embeddingsHealth.configured && !embeddingsBannerDismissed && (
  <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
    <div className="flex-1 text-sm">
      <span className="font-medium">No embeddings provider configured.</span>{" "}
      Semantic search, agent clustering, and signal correlation are degraded.
    </div>
    <Button variant="ghost" size="icon" className="h-6 w-6 -mt-0.5 -mr-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
      onClick={() => setEmbeddingsBannerDismissed(true)}>
      <X className="h-4 w-4" />
    </Button>
  </div>
)}
```

### Wizard: useGetLlmRouting Response Shape
Source: `artifacts/api-server/src/routes/settings.ts` lines 242-282

The `GET /v1/settings/llm-routing` endpoint returns:
```typescript
{
  entries: Array<{
    taskType: string;          // "enrichment" | "triage" | "treatment" | "embeddings" | "agent" | "general"
    configId: string | null;
    modelOverride: string | null;
    effectiveModel: string | null;
    providerName: string | null;
  }>;
  suggestions: Record<string, string | null>;  // taskType → suggested model name
}
```

### Wizard: DiscoveredModel Shape
Source: `artifacts/api-server/src/lib/llm-service.ts` lines 32-37

```typescript
interface DiscoveredModel {
  id: string;
  displayName?: string;
  capability: string[];    // ["chat"] | ["embeddings"] | ["chat", "code"]
  contextWindow?: number;
}
```

Group by first capability:
```typescript
const grouped = models.reduce((acc, m) => {
  const cap = m.capability[0] || "chat";
  (acc[cap] = acc[cap] || []).push(m);
  return acc;
}, {} as Record<string, DiscoveredModel[]>);
```

### Wizard: Benchmark Result Shape
Source: `artifacts/api-server/src/lib/llm-service.ts` lines 399-472

```typescript
// useBenchmarkLlmProvider mutation variables: { id: configId, data: { model?: string } }
// Returns:
{
  ttftMs: number;          // time-to-first-token in milliseconds
  totalLatencyMs: number;  // total round-trip time in milliseconds
  qualityScore: number;    // 0-3 integer (0=no JSON, 1=partial JSON, 2=all keys, 3=all keys + valid enums)
  model: string;
}
```

### Vendor List Frontend — Scorecard Columns
Source: `artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` lines 280-285

**Before (placeholder values):**
```tsx
<TableCell>
  <span className="text-muted-foreground text-xs">Never</span>   {/* Last Assessment */}
</TableCell>
<TableCell>
  <span className="text-muted-foreground text-xs">—</span>       {/* Findings */}
</TableCell>
```

**After (wired to real data):**
```tsx
<TableCell>
  {vendor.lastAssessmentDate ? (
    <span className="text-xs">{format(new Date(vendor.lastAssessmentDate), "MMM d, yyyy")}</span>
  ) : (
    <span className="text-muted-foreground text-xs">Never</span>
  )}
</TableCell>
<TableCell>
  {(vendor.openFindingsCount ?? 0) > 0 ? (
    <span className="text-xs font-mono text-amber-600">{vendor.openFindingsCount}</span>
  ) : (
    <span className="text-muted-foreground text-xs">0</span>
  )}
</TableCell>
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Single-page add/edit provider form in Sheet | 6-step guided wizard in Sheet | Wizard replaces the existing form flow; the existing form is still needed for simple edits |
| Model field is free-text Input | Model field is Select from discovered list | FIX-07 — both frontend component and backend validation |
| Enrichment blindly appends to description | Enrichment replaces existing block | FIX-03 — idempotent re-enrichment |
| Doc-process worker makes hallucinated LLM summary | Doc-process sets honest stub with filename | FIX-01 |

---

## Open Questions

1. **FIX-07: Edit flow — does the model Select need to pre-populate discovered models?**
   - What we know: The edit sheet currently has no API key (it's stored encrypted). `discoverModels()` uses the stored encrypted key internally, so calling discovery from the edit sheet via the backend works.
   - What's unclear: Should the edit form trigger model discovery automatically on open, or only show a "Re-discover models" button?
   - Recommendation: On edit sheet open, auto-trigger `useDiscoverLlmModels` mutation and show loading state; this matches the wizard Step 3 pattern and avoids the user needing to take extra action.

2. **FIX-07: Backend — validate model on create before or after insert?**
   - What we know: `discoverModels()` needs a `configId` that exists in DB. Validation before insert is not possible without the ID.
   - What's unclear: Is the create-then-validate-then-maybe-delete pattern acceptable for this project's style?
   - Recommendation: For Phase 6, backend validation on create is Claude's discretion. A lightweight approach is to validate only the format/prefix (e.g., Anthropic model IDs must start with `claude-`) without calling the live API — this avoids the create-then-delete complexity.

3. **PROVIDER_CATALOG constant — where to define?**
   - What we know: The wizard Step 1 needs provider cards with icons, capabilities, and pricing tier. This is frontend-only data.
   - Recommendation: Define `PROVIDER_CATALOG` as a TypeScript constant in `llm-config-wizard.tsx` itself (not shared); it maps provider types to display metadata.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — RiskMind has no test files in the repo |
| Config file | None — Wave 0 must establish if any testing is desired |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | doc-process worker sets stub summary without LLM call | unit | N/A | ❌ Wave 0 |
| FIX-03 | ai-enrich replaces existing block, not stacks | unit | N/A | ❌ Wave 0 |
| FIX-04 | ai-questions returns 502 on parse failure | integration | N/A | ❌ Wave 0 |
| FIX-05 | vendor list endpoint includes openFindingsCount and lastAssessmentDate | integration | N/A | ❌ Wave 0 |
| FIX-06 | Settings page renders warning banner when embeddings not configured | manual | visual verify | N/A |
| FIX-07 | Invalid model ID rejected with 422 | integration | N/A | ❌ Wave 0 |
| LLM-01 through LLM-06 | Wizard step flow, discovery, benchmark, routing assignment | manual (E2E) | visual verify | N/A |

### Sampling Rate
- **Per task commit:** No automated tests — manual spot-check per feature
- **Per wave merge:** Manual regression: Settings page renders, wizard opens/closes, vendor list shows real scorecard data
- **Phase gate:** All 6 bug fix behaviors and wizard flow verified manually before `/gsd:verify-work`

### Wave 0 Gaps
- No test infrastructure exists in this project — no framework, no test files, no CI test runner
- Per project convention (config.json `mode: "yolo"`) testing is manual
- "None — existing test infrastructure covers all phase requirements" does NOT apply; this project has no automated tests

---

## Sources

### Primary (HIGH confidence)
All findings are from direct code inspection of the live codebase:

- `artifacts/api-server/src/lib/ai-workers.ts` — FIX-01 (doc-process worker lines 156-205), FIX-03 (ai-enrich worker lines 121-154)
- `artifacts/api-server/src/routes/vendors.ts` — FIX-04 (ai-questions error line 497), FIX-05 (GET /v1/vendors select shape lines 63-78)
- `artifacts/api-server/src/routes/settings.ts` — FIX-06 (embeddings-health endpoint lines 370-394), FIX-07 (model field validation gap lines 68-113)
- `artifacts/api-server/src/lib/llm-service.ts` — LLM-03/04/05/06 (discoverModels, runBenchmark, suggestRouting, DiscoveredModel interface)
- `artifacts/riskmind-app/src/pages/settings/settings.tsx` — Wizard integration point; existing Sheet usage lines 747-860; existing Add Provider form lines 757-858
- `artifacts/riskmind-app/src/components/ui/sheet.tsx` — Sheet component shape; sheetVariants default width (sm:max-w-sm right side)
- `artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` — FIX-05 frontend; hardcoded "Never" and "—" at lines 281-285
- `lib/api-client-react/src/generated/api.ts` — useDiscoverLlmModels, useBenchmarkLlmProvider, useGetLlmRouting, useUpdateLlmRouting, useGetEmbeddingsHealth hook signatures confirmed
- `lib/db/src/schema/questionnaires.ts` — questionnairesTable shape (status enum: draft/sent/in_progress/completed, vendorId FK)
- `lib/db/src/schema/findings.ts` — findingsTable shape (status enum: open/investigating/resolved/false_positive, vendorId FK)

### Secondary (MEDIUM confidence)
None — all research done from direct code inspection, no external sources consulted.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed all libraries exist in project
- Architecture patterns: HIGH — extracted directly from live code
- Pitfalls: HIGH — identified from code inspection; FIX-05 null/coalesce issue is a common SQL pattern confirmed from schema
- Bug fix targets: HIGH — exact file names, line numbers, and current code captured

**Research date:** 2026-03-18
**Valid until:** Stable — no external dependencies; valid until codebase changes
