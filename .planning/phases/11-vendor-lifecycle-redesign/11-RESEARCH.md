# Phase 11: Vendor Lifecycle Redesign - Research

**Researched:** 2026-03-23
**Domain:** Vendor onboarding wizard, 4th-party subprocessor tracking, org dependency interview, continuous monitoring cadence, assessment-driven vendor risk scoring
**Confidence:** HIGH — all findings grounded in direct codebase inspection of Phase 9 schema and Phase 10 Assessment Engine output

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Onboarding Wizard**
- D-01: The wizard replaces the existing "New Vendor" creation flow entirely. Clicking "New Vendor" anywhere opens the wizard. The old simple form is removed.
- D-02: Wizard creates the vendor record with `status='identification'` at step 1 completion. Each subsequent step PATCHes the vendor record. Returning to `/vendors/onboard/:id` resumes from the saved step. Works across sessions/devices.
- D-03: 4 steps: (1) Identity + tier selection, (2) Questionnaire assignment (select from Assessment Engine templates), (3) Document upload, (4) AI enrichment review (auto-triggered, shows editable draft of enrichment results).

**4th-Party Subprocessors**
- D-04: Collapsible "Subprocessors" section on vendor detail page with a table: name, relationship type, criticality, discovered_by badge (manual/LLM). "Add Subprocessor" button links to existing vendors or creates new.
- D-05: Tier-1 depth only — track direct subprocessors of each vendor. No recursive sub-sub-processors. Covers GDPR/NYDFS regulatory requirements.
- D-06: LLM extraction from uploaded vendor documents surfaces suggested subprocessors during wizard step 3 (document upload). User reviews and confirms before saving.

**Org Dependency Interview**
- D-07: Lives in Settings > Organization as an "Infrastructure Dependencies" section. One-time setup per org. Shows current dependencies with edit/add capability. Concentration risk summary card at the top.
- D-08: Structured form approach (not AI-driven interview). Category-based: select email provider, cloud provider, CDN, identity provider, payment processor, communication tools, etc. from dropdowns. Link to existing vendors when possible via vendor_id FK.
- D-09: Concentration risk flagged when multiple org-critical dependencies point to the same vendor (or vendor group), especially when that vendor has active signals (OSINT, assessment failures, breach reports).

**Monitoring & Score Display**
- D-10: Global monitoring cadence config in Settings > Monitoring. Table format: tier → cadence days → assessment template. Applies to all vendors of that tier. Admin-only access.
- D-11: Small colored score badge on each vendor kanban card showing latest assessment score (e.g., "78/100" in severity color). Click navigates to assessment results. Vendor scorecard shows full score breakdown.
- D-12: Vendor `risk_score` field updated from latest completed assessment's overall score. Kanban card and scorecard read from this field.

### Claude's Discretion
- Document upload component implementation (dropzone vs file input)
- AI enrichment review layout details
- Exact monitoring scheduler implementation (node-cron job vs job queue recurring task)
- Concentration risk calculation algorithm details
- Subprocessor LLM extraction prompt design
- How "Add Subprocessor" links to existing vendors vs creates new

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VNDR-01 | User can onboard a vendor through a 4-step wizard: identity+tier, questionnaire assignment, document upload, AI enrichment review | Wizard route pattern from Phase 6 LLM wizard; server-side draft state via vendorsTable (D-02); Assessment Engine templates for step 2 |
| VNDR-02 | AI enrichment triggers during onboarding wizard to auto-populate vendor profile with industry, risk indicators, and known breaches | Existing `enqueueJob("ai-enrich", "enrich_risk", ...)` pattern in `ai-enrichment.ts`; same job queue, new vendor-context worker |
| VNDR-03 | User can add and view 4th-party subprocessors per vendor, with LLM extraction from uploaded vendor documents | `vendorSubprocessorsTable` (Phase 9) with dual FK; `discoveredBy` enum (manual/llm); LLM prompt over `documentsTable.extractedData` |
| VNDR-04 | User can configure per-tier continuous monitoring cadence with scheduled re-assessments and alerts on score threshold breach | `monitoringConfigsTable` (Phase 9) with tier + cadenceDays + assessmentTemplateId; scheduler uses `enqueueJob` with delayMs |
| VNDR-05 | Vendor risk score aggregates from latest assessment score, displayed on scorecard and kanban card | `vendorsTable.riskScore` (Phase 9 column); `computeScore()` in `assessment-engine.ts`; kanban card already renders `v.riskScore` |
| VNDR-06 | User can complete an org-level dependency interview identifying core vendor dependencies to detect vendor concentration risk | `orgDependenciesTable` (Phase 9) with category enum + vendorId FK; Settings > Organization tab extension |
| VNDR-07 | System cross-references org dependency data with signals to calibrate vendor risk and flag concentration risks | Cross-reference query: join `org_dependencies` → `vendors` → `signals`; concentration = multiple dependencies sharing same vendorId |
</phase_requirements>

---

## Summary

Phase 11 builds squarely on top of the Phase 9 schema foundation and Phase 10 Assessment Engine. All three new database tables are already migrated and exported: `vendor_subprocessors`, `org_dependencies`, and `monitoring_configs`. The `vendors` table already has `next_assessment_due` and `risk_score` columns. No schema migrations are needed for Phase 11 — this is a pure API + UI implementation phase.

The central engineering challenge is the 4-step onboarding wizard with server-side state persistence (D-02). The wizard must create a vendor record at step 1 and PATCH it through subsequent steps, resuming cleanly from `/vendors/onboard/:id`. The LLM config wizard in Phase 6 (`llm-config-wizard.tsx`) provides the exact visual pattern: Sheet-based multi-step flow with progress indicators and step-local state.

The risk score update path (VNDR-05) requires care: the old `POST /v1/vendors/:vendorId/questionnaires/:qId/score` endpoint (legacy questionnaire scoring) still writes to `vendorsTable.riskScore`, but Phase 11 must route score updates through the Assessment Engine's `computeScore()` function. The new path is: assessment completed → `computeScore()` → update `vendorsTable.riskScore` + set `next_assessment_due` based on tier cadence.

**Primary recommendation:** Implement in four parallel tracks: (A) wizard API + UI, (B) subprocessors API + detail page section, (C) org dependencies + settings section, (D) monitoring cadence config + scheduler + score badge.

---

## Standard Stack

### Core (already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | (workspace) | DB queries for new tables | Already used everywhere; all new tables exported from `@workspace/db` |
| React + wouter | (workspace) | Wizard routing `/vendors/onboard/:id` | Project router; route already following `Route path="/vendors/:id"` pattern |
| @tanstack/react-query | (workspace) | Data fetching + mutation invalidation | All existing pages use this pattern |
| shadcn/ui | (workspace) | Card, Sheet, Tabs, Progress, Badge, Select | All components already imported; consistent with existing wizard pattern |
| lucide-react | (workspace) | Icons | All existing pages use this |
| date-fns | (workspace) | `format()` for next_assessment_due display | Already imported in vendor-list.tsx |

### Discretion Pick: Monitoring Scheduler

The scheduler for re-assessment triggers is under Claude's discretion. **Use the existing job queue** (`enqueueJob` in `job-queue.ts`) rather than introducing `node-cron` or an external scheduler. The existing job queue pattern is:
1. A polling interval (`setInterval`) runs `claimAndProcessJob` every N seconds
2. Jobs have a `scheduled_at` field — `enqueueJob` with `delayMs` schedules future execution

This means monitoring triggers work by: at vendor transition to `monitoring` state, compute `next_assessment_due` based on tier cadence config, and enqueue a `monitor-vendor` job with `delayMs = msUntilDueDate`. When the job fires, create the assessment and enqueue the next cycle.

**No `node-cron` needed.** The existing scheduler already handles deferred jobs.

### Discretion Pick: Document Upload Component

Use `<Input type="file">` with an `onChange` handler — same pattern as the existing `vendor-detail.tsx` upload Sheet. The existing upload flow accepts `fileName` and `mimeType` on the API side (no actual file bytes stored server-side — the document metadata is the record). Keep consistent. Do not introduce a dropzone library.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
artifacts/api-server/src/routes/
├── vendors.ts              # EXTEND: wizard endpoints + subprocessors + risk score update
├── monitoring.ts           # NEW: monitoring config CRUD + scheduler registration
├── org-dependencies.ts     # NEW: org dependencies CRUD + concentration risk endpoint

artifacts/riskmind-app/src/pages/
├── vendors/
│   ├── vendor-list.tsx     # EXTEND: "New Vendor" button → wizard, score badge on kanban card
│   ├── vendor-detail.tsx   # EXTEND: Subprocessors tab/section, assessment score display
│   ├── vendor-onboard.tsx  # NEW: 4-step wizard page at /vendors/onboard/:id
│
├── settings/
│   └── settings.tsx        # EXTEND: add Monitoring tab + Organization/Dependencies tab
```

### Pattern 1: Server-Side Wizard State (D-02)

The wizard creates the vendor record at step 1 and persists step progress server-side. This is the critical pattern preventing wizard state loss on browser crash or navigation.

**How it works:**
- `POST /v1/vendors/onboard` → creates vendor with `status='identification'` + `wizardStep=1` → returns `{ id, wizardStep }`
- `PATCH /v1/vendors/onboard/:id` with `{ step, data }` → validates ownership, updates vendor fields for that step
- `GET /v1/vendors/onboard/:id` → returns vendor + current wizard state (step number inferred from data completeness)
- Wizard page at `/vendors/onboard/:id` mounts → fetches vendor → determines current step → renders correct step

**Step 1 data:** `{ name, description, category, contactEmail, tier }`
**Step 2 data:** `{ assignedAssessmentTemplateId }` (PATCH vendor with this FK; create the assessment from template)
**Step 3 data:** document upload (existing document create endpoint unchanged)
**Step 4 data:** trigger AI enrichment job via `enqueueJob("ai-enrich", ...)` → poll `GET /v1/jobs/:id` until done → show enrichment result as editable form → PATCH vendor with confirmed enrichment data

**Wizard persistence field:** Add `wizardStep: integer` column to `vendorsTable` OR infer step from data completeness (no schema change needed if inferring: step=1 if name set, step=2 if template assigned, step=3 if documents exist, step=4 otherwise). **Infer from data to avoid migration.**

### Pattern 2: Risk Score Update via Assessment Engine (VNDR-05)

The existing `POST /v1/vendors/:vendorId/questionnaires/:qId/score` uses the old scoring logic. Phase 11 adds a new path through the Assessment Engine:

```typescript
// In assessments.ts route — after assessment status set to 'completed':
// 1. Load template + responses
// 2. Call computeScore(template.questions, assessment.responses)
// 3. PATCH vendors SET risk_score = score.overall, next_assessment_due = computeNextDue(tier)
// 4. Compute tier from score unless overrideTier is set
```

The `computeScore()` function already exists in `assessment-engine.ts`. It returns `{ overall: number, sections: SectionScore[] }`. The `overall` value (0–100) maps directly to `vendorsTable.riskScore`.

### Pattern 3: Subprocessors Section (VNDR-03)

The subprocessors table (`vendor_subprocessors`) has a unique constraint on `(vendor_id, subprocessor_id)`. The "Add Subprocessor" interaction has two modes:
- **Link existing vendor:** `SELECT` from existing `vendorsTable` filtered by tenant; insert row into `vendor_subprocessors`
- **Create new vendor:** `POST /v1/vendors` (simplified — no wizard required for subprocessors discovered manually), then insert subprocessor link

LLM extraction during wizard step 3 (document upload): after a document is uploaded and processed (`documentsTable.extractedData` is populated by the `doc-process` worker), a secondary LLM call parses the extracted text for company names that look like third-party providers. Returns a list of candidate `{ name, relationshipType }` objects. The user reviews the list and selects which ones to save. This is a fire-and-suggest pattern, not auto-save.

### Pattern 4: Monitoring Scheduler

```typescript
// New route: monitoring-configs.ts
// CRUD for monitoringConfigsTable

// Worker registered in monitoring.ts or vendors.ts:
registerWorker("vendor-monitor", async (job) => {
  const { vendorId, tenantId } = job.payload;

  // 1. Load vendor + monitoring config for its tier
  // 2. Load assigned assessment template from config
  // 3. Create new assessment: POST /v1/assessments (programmatically)
  // 4. Create alert: "Scheduled re-assessment triggered for {vendor}"
  // 5. Compute next_assessment_due = now + cadenceDays
  // 6. Update vendor.next_assessment_due
  // 7. Enqueue next cycle: enqueueJob("vendor-monitor", {...}, { delayMs: cadenceDays * 86400000 })
});

// Trigger at vendor status transition to 'monitoring':
// In vendors.ts transition handler, after status update:
if (targetStatus === 'monitoring') {
  const config = await getMonitoringConfig(tier, tenantId);
  if (config) {
    await enqueueJob("vendor-monitor", "schedule_assessment",
      { vendorId, tenantId }, tenantId,
      { delayMs: config.cadenceDays * 86400000 });
    await db.update(vendorsTable).set({
      nextAssessmentDue: new Date(Date.now() + config.cadenceDays * 86400000)
    });
  }
}
```

### Pattern 5: Concentration Risk (VNDR-07)

A concentration risk exists when: multiple `org_dependencies` rows for the same tenant share the same `vendor_id`. Additional signal: that vendor has active signals (risk signals in the last 30 days).

```typescript
// GET /v1/org-dependencies/concentration-risk
// Returns: vendors appearing in multiple dependency categories with open signal counts

const concentrationQuery = db
  .select({
    vendorId: orgDependenciesTable.vendorId,
    vendorName: vendorsTable.name,
    dependencyCount: sql<number>`count(*)::int`,
    categories: sql<string[]>`array_agg(distinct category)`,
    openSignalCount: sql<number>`coalesce((
      SELECT count(*)::int FROM signals
      WHERE signals.vendor_id = ${orgDependenciesTable.vendorId}
      AND signals.tenant_id = ${tenantId}
      AND signals.status != 'dismissed'
      AND signals.created_at > now() - interval '30 days'
    ), 0)`,
  })
  .from(orgDependenciesTable)
  .leftJoin(vendorsTable, eq(orgDependenciesTable.vendorId, vendorsTable.id))
  .where(and(
    eq(orgDependenciesTable.tenantId, tenantId),
    isNotNull(orgDependenciesTable.vendorId)
  ))
  .groupBy(orgDependenciesTable.vendorId, vendorsTable.name)
  .having(sql`count(*) > 1`);
```

### Anti-Patterns to Avoid

- **Do not re-trigger AI enrichment on every wizard mount:** The enrichment job must be idempotent. Check if a job is already running for this vendor before enqueueing another. Use `GET /v1/jobs/:id` to poll status from the wizard step 4 component.
- **Do not write vendor risk score from the old questionnaire scoring path in step 2:** Step 2 only _assigns_ a template (creates an assessment record). Scoring happens when the assessment is later completed, not during onboarding.
- **Do not fetch all vendors to power the subprocessor "link existing" picker without filtering:** Always pass `tenantId` and apply a search filter. The vendor list already has search support.
- **Do not put monitoring scheduler startup logic in the route handler:** Register the worker at server boot (in `server.ts` or the route file's module scope), not inside a request handler.
- **Do not store wizard step as a separate DB column if it can be inferred:** Inferring step from data completeness avoids a migration. Only add a `wizardStep` column if the inference logic becomes complex.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job scheduling for monitoring cadence | Custom cron or setTimeout loop | `enqueueJob` with `delayMs` + existing poll loop | Already handles retries, persistence, multi-tenant isolation |
| Assessment scoring for vendor risk score | Custom scoring function | `computeScore()` from `assessment-engine.ts` | Pure function, already handles branching exclusion, section averaging, empty section exclusion |
| Subprocessor uniqueness enforcement | Application-level check | `uniqueIndex("vendor_subprocessors_pair_idx")` already on `(vendor_id, subprocessor_id)` | DB constraint handles concurrent inserts; catch unique violation at API layer |
| Tier color mapping for score badges | New color scale | Existing `getTierColor()` in `vendor-detail.tsx` and `TierBadge` in `vendor-list.tsx` | Both use the same critical/high/medium/low CSS classes — reuse for score badge |
| Multi-step form state persistence | localStorage wizard state | Server-side PATCH to vendor record (D-02) | Survives browser crash, cross-device, auditable |

---

## Common Pitfalls

### Pitfall 1: Wizard Navigation Creates Orphan Vendor Records

**What goes wrong:** User clicks "New Vendor," fills step 1 (creates vendor record), then hits Back. The vendor now exists in `status='identification'` with no further data. Over time, the kanban accumulates orphan stubs.

**Why it happens:** D-02 correctly creates the record at step 1 for persistence, but there is no cleanup path.

**How to avoid:** Add a "Cancel Onboarding" action in the wizard that deletes the vendor record if it has `status='identification'` AND no assessments, documents, or subprocessors. Only allow deletion via this path — not via the standard vendor delete. Show a confirmation dialog: "This will discard the incomplete onboarding. Continue?" The kanban Identification column should visually distinguish "in onboarding" vendors (those created via wizard, e.g., those lacking a `contactEmail` or description) from fully-onboarded ones via a subtle badge.

**Warning signs:** Growing number of vendors stuck in `identification` status with empty descriptions.

### Pitfall 2: Score Badge Displays Old Questionnaire Score, Not Assessment Engine Score

**What goes wrong:** `vendorsTable.riskScore` is written by BOTH the old `POST /questionnaires/:qId/score` route AND the new assessment completion path. If a vendor has old questionnaire data, its `riskScore` reflects the legacy scoring algorithm (inverted scale: high score = high risk). The Assessment Engine uses 0–100 where 100 = best. These scales are opposite. Mixing them makes the kanban badge meaningless.

**Why it happens:** Phase 11 adds assessment-driven scoring without removing the old path. Both write to the same `riskScore` column.

**How to avoid:** The old questionnaire score route computes `riskScore` as an inverse (high score = high risk: score ≥ 75 → critical). The Assessment Engine `computeScore()` returns 0–100 where higher = better (then the caller can invert to `riskScore = 100 - overall` for risk representation, OR adopt a consistent "higher = better" convention throughout). Decide the convention at the start of Phase 11 and document it. The simplest fix: **always store risk score as "higher = worse risk"** (matching the existing `computeTierFromRiskScore` logic: score ≥ 75 = critical). Assessment Engine `overall` returns "higher = better compliance", so when writing to `vendorsTable.riskScore`, store `100 - overall`.

**Warning signs:** Kanban badge shows "95/100" in red for a vendor that passed every assessment question.

### Pitfall 3: Monitoring Job Creates Duplicate Assessments on Server Restart

**What goes wrong:** The monitoring job enqueues the next cycle at the end of each run. If the server restarts before the job completes, the job is retried (up to `maxAttempts: 3`). Each retry creates a new assessment AND enqueues a new next-cycle job. A single monitoring trigger can cascade into 3 assessments and 3 scheduled next cycles.

**Why it happens:** The job queue uses `FOR UPDATE SKIP LOCKED` for claim safety, but if the job fails after creating the assessment but before updating its own status, the retry path reruns the assessment creation.

**How to avoid:** Make the monitoring worker idempotent. Before creating an assessment, check: `SELECT count(*) FROM assessments WHERE vendor_id = $1 AND created_at > NOW() - INTERVAL '1 hour' AND status != 'completed'`. If a recent pending assessment exists, skip creation and just re-enqueue the next cycle. Use a `deduplication_key` on the monitoring job payload: `{ vendorId, cycleDate: startOfDay(nextDueDate) }` and store it in `job.payload`. On retry, check if an assessment for this `cycleDate` already exists before creating.

**Warning signs:** Vendor accumulates multiple identical pending assessments created within seconds of each other.

### Pitfall 4: 4th-Party Subprocessor N+1 in Concentration Risk Query

**What goes wrong:** The concentration risk calculation queries all org_dependencies, then for each dependency with a vendor_id, separately queries that vendor's subprocessors and their signal counts. With 10 dependencies × 5 subprocessors each = 50+ sequential queries.

**How to avoid:** Use the CTE/JOIN pattern described in Architecture Pattern 5. A single query aggregates dependency count and open signal count per vendor. Phase 11 subprocessors are tier-1 only (D-05), so no recursive graph traversal needed — the join is flat.

### Pitfall 5: Wouter Does Not Support `useBlocker`

**What goes wrong:** The wizard needs to warn users before navigating away with unsaved changes (standard UX). React Router v6 has `useBlocker`. Wouter does not.

**Why it happens:** The project uses wouter (visible in App.tsx). Developers assume `useBlocker` is available.

**How to avoid:** Use the browser's `beforeunload` event directly: `window.addEventListener('beforeunload', handler)` inside a `useEffect` when the wizard has unsaved step data. This fires on page reload/close. For SPA navigation (clicking sidebar links), use a custom approach: the wizard tracks `isDirty` state, and clicking a non-wizard route shows a shadcn `AlertDialog` confirmation before proceeding. The wouter `useLocation` hook can be used to intercept navigation by comparing the current location change.

---

## Code Examples

### Wizard Step 1 API — Create Vendor in Identification State

```typescript
// Source: vendors.ts route pattern + D-02 decision
router.post("/v1/vendors/onboard", requireRole("admin", "risk_manager"), async (req, res) => {
  const { name, description, category, contactEmail, contactName, tier } = req.body;
  if (!name) { badRequest(res, "name is required"); return; }

  const [vendor] = await db.insert(vendorsTable).values({
    tenantId: req.user!.tenantId,
    name,
    description: description || null,
    category: category || null,
    contactEmail: contactEmail || null,
    contactName: contactName || null,
    tier: tier || "medium",
    status: "identification",
  }).returning();

  await recordAudit(req, "start_onboarding", "vendor", vendor.id);
  res.status(201).json({ ...vendor, wizardStep: 1 });
});
```

### Risk Score Update After Assessment Completion

```typescript
// Source: assessment-engine.ts computeScore() + D-12 decision
// Called after assessments.ts marks assessment status='completed'
import { computeScore } from "../lib/assessment-engine";
import type { AssessmentTemplateQuestions, AssessmentResponses } from "../lib/assessment-engine";

async function updateVendorRiskScoreFromAssessment(
  assessment: typeof assessmentsTable.$inferSelect,
  template: typeof assessmentTemplatesTable.$inferSelect,
  tenantId: string,
): Promise<void> {
  if (assessment.contextType !== "vendor" || !assessment.contextId) return;

  const score = computeScore(
    template.questions as AssessmentTemplateQuestions,
    assessment.responses as AssessmentResponses,
  );

  // Convention: riskScore stored as "higher = worse risk"
  // Assessment engine "overall" is "higher = better compliance"
  const riskScore = Math.round((100 - score.overall) * 100) / 100;

  const vendor = await db.select({ tier: vendorsTable.tier, overrideTier: vendorsTable.overrideTier })
    .from(vendorsTable)
    .where(eq(vendorsTable.id, assessment.contextId))
    .limit(1);

  if (!vendor[0]) return;

  const newTier = vendor[0].overrideTier ?? computeTierFromRiskScore(riskScore);

  await db.update(vendorsTable).set({
    riskScore: String(riskScore),
    ...(!vendor[0].overrideTier && { tier: newTier }),
    updatedAt: new Date(),
  }).where(eq(vendorsTable.id, assessment.contextId!));
}
```

### Subprocessor LLM Extraction Prompt Pattern

```typescript
// Source: existing vendor ai-questions prompt pattern in vendors.ts
const subprocessorExtractionPrompt = `You are a third-party risk analyst extracting vendor relationships from a document.

Document content (excerpt):
${extractedText.slice(0, 4000)}

Identify any third-party service providers, cloud infrastructure vendors, payment processors, CDN providers,
identity/authentication services, data processors, or technology partners mentioned.

For each identified third party, provide:
- name: company name (required)
- relationshipType: brief description (e.g., "cloud hosting", "payment processing", "CDN")
- criticality: one of critical, high, medium, low

Respond ONLY with a JSON array. If none found, return []. No other text.`;
```

### Score Badge for Kanban Card (vendor-list.tsx extension)

```typescript
// Source: existing TierBadge + riskScore display pattern in vendor-list.tsx
// D-11: small colored badge showing "78/100" in severity color
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  return (
    <span className={cn(
      "font-mono text-xs font-bold px-1.5 py-0.5 rounded",
      score >= 75 ? "bg-red-100 text-red-700" :
      score >= 50 ? "bg-amber-100 text-amber-700" :
      score >= 25 ? "bg-yellow-100 text-yellow-700" :
      "bg-emerald-100 text-emerald-700"
    )}>
      {score}/100
    </span>
  );
}
```

### Monitoring Config API Pattern

```typescript
// Source: monitoringConfigsTable schema — uniqueIndex on (tenantId, tier)
// Upsert pattern for per-tier config
router.put("/v1/monitoring-configs/:tier", requireRole("admin"), async (req, res) => {
  const { cadenceDays, assessmentTemplateId } = req.body;
  const tier = p(req, "tier") as VendorTier;
  if (!isValidTier(tier)) { badRequest(res, "Invalid tier"); return; }

  const [config] = await db
    .insert(monitoringConfigsTable)
    .values({ tenantId: req.user!.tenantId, tier, cadenceDays, assessmentTemplateId })
    .onConflictDoUpdate({
      target: [monitoringConfigsTable.tenantId, monitoringConfigsTable.tier],
      set: { cadenceDays, assessmentTemplateId, updatedAt: new Date() },
    })
    .returning();

  res.json(config);
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple Sheet form for new vendor | 4-step wizard with server-side state | Phase 11 | Entire `isOpen` Sheet + `handleSubmit` in vendor-list.tsx replaced by `navigate('/vendors/onboard/new')` |
| Old questionnaire scoring (inverted scale) | Assessment Engine `computeScore()` (0–100, higher=better) | Phase 11 | `riskScore` stored as `100 - overall` for consistency with `computeTierFromRiskScore` |
| Manual risk score button (`RefreshCw`) | Auto-update on assessment completion | Phase 11 | The manual "Recalculate" button in vendor-detail.tsx can be removed or kept as a fallback |
| No subprocessor tracking | `vendor_subprocessors` table + UI section | Phase 11 | Satisfies GDPR Article 28 / NYDFS 500.11 requirement for sub-service provider tracking |
| No monitoring schedule | `monitoring_configs` + job queue scheduler | Phase 11 | Replaces purely manual lifecycle; vendors in `monitoring` state get scheduled re-assessments |

**Deprecated patterns:**
- `POST /v1/vendors` (old simple create) — replaced by wizard. Keep the endpoint but mark internal. The wizard uses `/v1/vendors/onboard` to semantically distinguish.
- Old `POST /v1/vendors/:id/risk-score` (heuristic scoring from questionnaire completion %) — superseded by assessment engine path. Keep for backward compatibility but the wizard no longer uses it.

---

## Open Questions

1. **wizardStep persistence strategy**
   - What we know: D-02 says resume from `/vendors/onboard/:id` works; inferring step from data completeness is feasible
   - What's unclear: If a user uploads a document in step 3 but doesn't advance, does the wizard know they're on step 3 or step 4? Inference may be ambiguous for step 3/4 boundary.
   - Recommendation: Use inference for steps 1-3 (name set → ≥1, template assigned → ≥2, documents > 0 → ≥3), but add a `wizardCompletedAt` timestamp to `vendorsTable` to mark step 4 completion. This avoids a dedicated `wizardStep` integer column while handling the ambiguous step 3/4 boundary.

2. **Assessment creation at wizard step 2**
   - What we know: Step 2 assigns an assessment template; the Assessment Engine creates assessments via `POST /v1/assessments`
   - What's unclear: Should the wizard create the full assessment at step 2, or just record the template assignment and let the vendor complete it later outside the wizard?
   - Recommendation: Create the assessment at step 2 in `pending` status. This anchors the questionnaire to the vendor before enrichment. The assessment can be completed any time after onboarding.

3. **Score convention documentation**
   - What we know: `computeTierFromRiskScore` (in allowed-transitions.ts and vendor-detail.tsx) treats score ≥75 as `critical` (high risk). The Assessment Engine `computeScore()` returns higher = better compliance.
   - What's unclear: No single document currently declares the canonical convention.
   - Recommendation: Add a comment at the top of the `updateVendorRiskScoreFromAssessment` helper: "Risk score convention: 0 = best (low risk), 100 = worst (critical risk). Assessment Engine returns 0–100 where 100 = perfect compliance, so we store (100 - overall)."

---

## Validation Architecture

`workflow.nyquist_validation: true` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in project (no jest.config, vitest.config, or test/ directory outside node_modules) |
| Config file | None — Wave 0 must create |
| Quick run command | `pnpm --filter api-server test` (after Wave 0 setup) |
| Full suite command | `pnpm test` (workspace root) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VNDR-01 | Wizard creates vendor at step 1 with status='identification' | unit/integration | `pnpm --filter api-server test -- --grep "vendor onboard"` | Wave 0 |
| VNDR-01 | PATCH step 2 assigns assessment template | unit/integration | same suite | Wave 0 |
| VNDR-01 | Resume from `/vendors/onboard/:id` returns correct step | unit/integration | same suite | Wave 0 |
| VNDR-02 | AI enrichment job enqueued at step 4 | unit | same suite | Wave 0 |
| VNDR-03 | Subprocessor insert with duplicate pair returns 409 | unit/integration | same suite | Wave 0 |
| VNDR-04 | monitoring-config upsert per tier | unit/integration | same suite | Wave 0 |
| VNDR-05 | `updateVendorRiskScoreFromAssessment` stores 100-overall | unit (pure fn) | same suite | Wave 0 |
| VNDR-05 | Score badge renders correct color class for score=80 | manual smoke | — | manual |
| VNDR-06 | org-dependency CRUD with vendor FK | unit/integration | same suite | Wave 0 |
| VNDR-07 | concentration risk query returns vendors with count>1 | unit/integration | same suite | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter api-server test -- --grep "vendor"` (vendor-scoped tests only)
- **Per wave merge:** `pnpm test` (full workspace)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `artifacts/api-server/src/routes/__tests__/vendor-onboard.test.ts` — covers VNDR-01, VNDR-02
- [ ] `artifacts/api-server/src/routes/__tests__/subprocessors.test.ts` — covers VNDR-03
- [ ] `artifacts/api-server/src/routes/__tests__/monitoring-configs.test.ts` — covers VNDR-04
- [ ] `artifacts/api-server/src/lib/__tests__/vendor-risk-score.test.ts` — covers VNDR-05 pure fn
- [ ] `artifacts/api-server/src/routes/__tests__/org-dependencies.test.ts` — covers VNDR-06, VNDR-07
- [ ] Test framework setup: `pnpm add -D vitest @vitest/coverage-v8 --filter api-server` + `vitest.config.ts`

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `lib/db/src/schema/vendor-subprocessors.ts` — dual FK join table, unique constraint, enums
- `lib/db/src/schema/monitoring-configs.ts` — tier + cadenceDays + assessmentTemplateId FK
- `lib/db/src/schema/org-dependencies.ts` — category enum, vendor_id FK (nullable, set null on delete)
- `lib/db/src/schema/vendors.ts` — riskScore numeric, nextAssessmentDue date column
- `artifacts/api-server/src/lib/assessment-engine.ts` — `computeScore()`, `AssessmentTemplateQuestions`, `AssessmentResponses` interfaces
- `artifacts/api-server/src/lib/allowed-transitions.ts` — `computeTierFromRiskScore()` scale definition
- `artifacts/api-server/src/routes/vendors.ts` — `verifyVendorOwnership()`, existing create/update/transition patterns
- `artifacts/api-server/src/routes/ai-enrichment.ts` — `enqueueJob` pattern, 202 Accepted + job polling
- `artifacts/api-server/src/lib/job-queue.ts` — `registerWorker`, `enqueueJob` with delayMs, scheduled_at mechanism
- `artifacts/riskmind-app/src/pages/settings/llm-config-wizard.tsx` — multi-step wizard visual pattern
- `artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` — kanban card structure, existing score display
- `artifacts/riskmind-app/src/App.tsx` — wouter routing, no useBlocker

### Secondary (MEDIUM confidence)

- `.planning/research/FEATURES.md` — vendor lifecycle feature landscape, 4th-party risk regulatory context
- `.planning/research/PITFALLS.md` (Pitfalls 3 & 4) — wizard state loss, N+1 subprocessor queries

### Tertiary (LOW confidence)

None — all findings are codebase-grounded.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions from workspace
- Architecture: HIGH — all schema tables verified, patterns traced from existing routes
- Pitfalls: HIGH — all pitfalls derived from direct code inspection of existing patterns
- Validation: MEDIUM — no test framework exists; commands are planned, not confirmed

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (stable codebase; schema already migrated)
