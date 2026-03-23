# Phase 10: Assessment Engine — Research

**Researched:** 2026-03-23
**Domain:** Assessment Engine — template CRUD, session wizard, AI follow-up questions, weighted scoring, pre-built templates, AI post-submission analysis
**Confidence:** HIGH — based on full codebase inspection; all patterns are verified against existing implementation files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Form-based editor for creating/editing templates. Users add questions via form fields: pick type (text/boolean/multiple-choice/numeric), enter question text, set weight, add branching conditions. Drag to reorder. Preview pane shows how the assessment will look to the respondent.
- **D-02:** Templates support named sections. Questions grouped into sections. Section-level scores roll up to overall score.
- **D-03:** Branching conditions defined per question via a condition builder UI (not raw JSON). IF answer to Q equals/contains/greater-than value THEN show/hide target question(s). Evaluated client-side for instant UX.
- **D-04:** Section-by-section wizard navigation. One section at a time with progress bar. Next/Previous buttons. Branching hides/shows questions within current section.
- **D-05:** AI-generated follow-up questions appear inline below the triggering question with an "AI Generated" badge. Appears after the user answers. Doesn't break flow.
- **D-06:** Session persistence: assessment state saved to DB on each section navigation (responses JSONB updated). Refreshing the page resumes from current section with all prior responses. AI follow-up questions also persisted.
- **D-07:** Overall score as prominent gauge/donut chart. Section scores as horizontal bar charts. Per-question scores viewable by expanding a section.
- **D-08:** AI summary appears above scores as a highlighted card with "AI Analysis" badge.
- **D-09:** Score computation is deterministic: same responses always produce same score. Weighted average: question score × weight, rolled up to section, then overall.
- **D-10:** Three pre-built templates with 20–30 questions each: Vendor Security (SIG Lite-inspired), Compliance Control Assessment (ISO 27001-inspired), Incident Assessment.
- **D-11:** Dedicated template library page at /assessments/templates. Filter by type. "Use Template" / "Clone & Edit" actions. Built-in templates cannot be deleted.

### Claude's Discretion

- Exact question wording for pre-built templates
- Which responses trigger AI follow-up questions (LLM decides based on context)
- Branching condition builder component implementation details
- Assessment list page layout and filtering
- API route structure (likely /api/v1/assessments and /api/v1/assessment-templates)
- Whether to use SSE streaming (like interviews) or async job queue for AI follow-ups
- Gauge/donut chart component choice (recharts already installed)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ASMT-01 | User can create, edit, and delete assessment templates with questions of various types (text, boolean, multiple choice, numeric) and configurable weights | Template CRUD via Express route + Drizzle; questions stored as JSONB on assessment_templates table (Phase 9 schema confirmed) |
| ASMT-02 | User can define conditional branching rules on questions (IF answer to Q equals/contains/greater-than value THEN show/hide question) | Branching rules stored inside questions JSONB; client-side evaluation confirmed feasible; ConditionBuilder UI component pattern identified in UI-SPEC |
| ASMT-03 | User can create an assessment from a template, assign it to a subject (vendor or compliance framework), track responses, and mark it complete | assessments table with context_type + context_id polymorphic FK; responses JSONB; status enum (draft/active/completed/abandoned) — all Phase 9 schema |
| ASMT-04 | System computes weighted numeric scores per question, section, and overall assessment with configurable scoring mode | Pure TypeScript scoring function; deterministic weighted average; no external library needed; score written to assessments.score column |
| ASMT-05 | LLM generates contextual follow-up questions based on prior responses during an active assessment session | SSE streaming pattern from interviews.ts; complete()/streamComplete() from llm-service.ts; follow-ups stored in responses JSONB for persistence |
| ASMT-06 | System provides pre-built assessment templates (Vendor Security/SIG Lite-inspired, Compliance Control/ISO 27001-inspired, Incident Assessment) | Seed script inserts pre-built templates at boot; isPrebuilt flag distinguishes built-in from user-created; tenantId=NULL for global pre-built templates is the right pattern |
| ASMT-07 | After assessment submission, LLM analyzes response set to highlight anomalies, inconsistencies, and gaps stored as ai_summary | Async job pattern from job-queue.ts; enqueueJob("ai-assess", "summarize_assessment", { assessmentId }); result written to assessments.ai_summary |
</phase_requirements>

---

## Summary

Phase 10 builds the Assessment Engine as a shared service consumed by Phase 11 (Vendor Lifecycle) and Phase 13 (Compliance Flow). The schema foundation was laid in Phase 9: `assessment_templates` and `assessments` tables exist in `lib/db/src/schema/assessments.ts`, with the polymorphic `context_type` enum (`vendor` | `framework`) and nullable `context_id` already in place. This phase adds all runtime logic — routes, AI integration, scoring engine, frontend UI, and pre-built template seeds.

The most important architectural pattern to preserve is the separation between the **static questions structure** (stored as JSONB on the template) and the **runtime responses** (stored as JSONB on the assessment, updated on each section navigation). Branching logic is evaluated entirely client-side using the conditions embedded in each question object. AI follow-up questions are generated via the existing SSE streaming pattern from `interviews.ts`, persisted in the responses JSONB, and replayed on page refresh — preventing the "follow-up question disappears on reload" pitfall.

The scoring engine is a pure deterministic TypeScript function: `(answer normalized to 0–1) × question.weight`, aggregated to section averages, then a weighted average of section scores. Post-submission AI analysis is an async job that calls `complete()` from `llm-service.ts` with the full response context and writes the narrative to `assessments.ai_summary`.

**Primary recommendation:** Build the scoring engine as a standalone pure function in `lib/assessment-engine.ts` first (no I/O, fully testable), then wire it into the route. Model all AI interactions on the existing `interviews.ts` SSE pattern — do not invent new patterns.

---

## Standard Stack

### Core (already installed — no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | catalog: | ORM for all DB access | Already used project-wide; assessment tables added in Phase 9 |
| express 5 | ^5 | HTTP routes | Existing API server |
| recharts | already installed | ScoreGauge (RadialBarChart) + SectionScoreBar (BarChart) | Confirmed installed; UI-SPEC mandates it |
| shadcn/ui | initialized | All form, card, badge components | new-york preset already configured |
| lucide-react | installed | Icons (ClipboardList, Sparkles, GripVertical) | Existing icon library |
| @workspace/db | workspace:* | Database access + schema types | All routes use this import |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod / drizzle-zod | catalog: | Input validation on API routes | All POST/PATCH route bodies |
| HTML5 draggable API | native | Drag-to-reorder questions in template builder | UI-SPEC D-01 mandates this; no external DnD library |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SSE for AI follow-ups | Async job queue (polling) | SSE gives instant inline appearance; job queue adds polling complexity. CONTEXT.md leaves this as Claude's discretion — SSE matches interview pattern and is recommended. |
| HTML5 draggable | @dnd-kit or react-beautiful-dnd | External DnD library is more robust but adds bundle weight. UI-SPEC explicitly calls for HTML5 draggable. Use HTML5 native. |
| recharts RadialBarChart | Custom SVG gauge | recharts already installed; RadialBarChart matches UI-SPEC donut requirement. |

**Installation:** No new npm packages required for this phase.

---

## Architecture Patterns

### Recommended Project Structure

```
artifacts/api-server/src/
├── lib/
│   └── assessment-engine.ts    [NEW] Scoring logic + question JSONB types
├── routes/
│   ├── assessment-templates.ts [NEW] Template CRUD
│   └── assessments.ts          [NEW] Assessment lifecycle + AI endpoints

artifacts/riskmind-app/src/
├── pages/
│   └── assessments/
│       ├── index.tsx                    [NEW] Assessment list /assessments
│       ├── templates/
│       │   ├── index.tsx                [NEW] Template library /assessments/templates
│       │   ├── new.tsx                  [NEW] Template builder /assessments/templates/new
│       │   └── [id]/edit.tsx            [NEW] Template editor
│       └── [id]/
│           ├── session.tsx              [NEW] Assessment session wizard
│           └── results.tsx              [NEW] Results page
└── components/
    └── assessments/
        ├── ConditionBuilder.tsx         [NEW]
        ├── QuestionRow.tsx              [NEW]
        ├── SectionBlock.tsx             [NEW]
        ├── WizardStepper.tsx            [NEW]
        ├── ScoreGauge.tsx               [NEW]
        ├── SectionScoreBar.tsx          [NEW]
        ├── AiFollowUpQuestion.tsx       [NEW]
        └── AiAnalysisCard.tsx           [NEW]

lib/db/src/schema/
└── assessments.ts              [EXISTS] assessment_templates + assessments tables (Phase 9)
```

### Pattern 1: JSONB Question Schema (ASMT-01, ASMT-02)

The questions JSONB on `assessment_templates` is the source of truth for template structure. Define TypeScript types that the API validates on write and the frontend reads on render.

```typescript
// Source: assessments.ts schema + CONTEXT.md D-01, D-02, D-03
export interface BranchCondition {
  questionId: string;          // which prior question to evaluate
  operator: "equals" | "contains" | "greater_than";
  value: string | number;
  action: "show" | "hide";     // what to do with THIS question
}

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  numericValue?: number;       // normalized 0–1 for scoring
}

export interface AssessmentQuestion {
  id: string;                  // stable UUID, set on creation
  sectionId: string;           // which section this belongs to
  text: string;
  type: "text" | "boolean" | "multiple_choice" | "numeric";
  weight: number;              // 0–10, default 5
  required: boolean;
  options?: QuestionOption[];  // multiple_choice only
  numericMin?: number;         // numeric only
  numericMax?: number;         // numeric only
  conditions: BranchCondition[]; // show/hide rules for THIS question
  isAiGenerated?: boolean;     // true for LLM follow-up questions
  triggeredByQuestionId?: string; // which question triggered this AI follow-up
}

export interface AssessmentSection {
  id: string;
  name: string;
  order: number;
  questions: AssessmentQuestion[];
}

export interface AssessmentTemplateQuestions {
  sections: AssessmentSection[];
  version: number;             // incremented on each save
}
```

### Pattern 2: Responses JSONB Structure (ASMT-03, ASMT-05, ASMT-06)

The `responses` JSONB on the `assessments` table stores all runtime state: user answers, AI-generated follow-up questions, and current section index.

```typescript
// Source: CONTEXT.md D-06; interviews.ts pattern
export interface QuestionResponse {
  questionId: string;
  answer: string | boolean | number | string[];
  answeredAt: string;          // ISO timestamp
}

export interface AiFollowUpRecord {
  id: string;                  // stable UUID generated on creation
  triggeredByQuestionId: string;
  sectionId: string;
  question: AssessmentQuestion; // full question object, persisted
  generatedAt: string;
}

export interface AssessmentResponses {
  currentSectionIndex: number;
  responses: Record<string, QuestionResponse>; // keyed by questionId
  aiFollowUps: AiFollowUpRecord[];             // all generated follow-ups
  completedSections: string[];                 // sectionIds already submitted
}
```

**Critical:** On each "Next Section" click, the frontend PATCHes the assessment with the updated `responses` JSONB. On page refresh, the frontend reads this JSONB and restores the exact state — current section, all answers, all AI follow-ups. This is the persistence guarantee from D-06.

### Pattern 3: Scoring Engine (ASMT-04)

Pure deterministic TypeScript function — no LLM involved. Lives in `lib/assessment-engine.ts`.

```typescript
// Source: CONTEXT.md D-09; computed at submission time
export function computeScore(
  template: AssessmentTemplateQuestions,
  responses: AssessmentResponses
): AssessmentScore {
  const sectionScores: SectionScore[] = template.sections.map(section => {
    const visibleQuestions = section.questions.filter(q =>
      !isHiddenByBranching(q, responses.responses, section.questions)
    );
    const questionScores = visibleQuestions.map(q => {
      const response = responses.responses[q.id];
      const rawScore = normalizeAnswer(q, response?.answer);  // 0.0–1.0
      return { questionId: q.id, score: rawScore * q.weight, weight: q.weight };
    });
    const totalWeight = questionScores.reduce((sum, qs) => sum + qs.weight, 0);
    const weightedSum = questionScores.reduce((sum, qs) => sum + qs.score, 0);
    const sectionScore = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
    return { sectionId: section.id, name: section.name, score: sectionScore, questionScores };
  });

  const totalWeight = sectionScores.reduce((_, __) => 1, 0); // equal section weights
  const overall = sectionScores.reduce((sum, s) => sum + s.score, 0) / sectionScores.length;

  return { overall: Math.round(overall * 100) / 100, sections: sectionScores };
}
```

**Key insight:** Hidden (branched-out) questions are excluded from scoring. Same response set always yields same score.

### Pattern 4: AI Follow-up Generation (ASMT-05) — SSE Pattern

Model directly on `interviews.ts`. Client POSTs current section answers; backend streams a follow-up question (or empty signal if none warranted).

```typescript
// Source: artifacts/api-server/src/routes/interviews.ts (streamComplete pattern)
router.post("/v1/assessments/:id/follow-up", requireRole("admin", "risk_manager", "auditor"),
  async (req: Request, res: Response) => {
    const { sectionResponses, questionId } = req.body;
    // ...
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    for await (const chunk of streamComplete(tenantId, { messages }, "general")) {
      if (chunk.type === "text") {
        res.write(`data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`);
      } else if (chunk.type === "done") {
        // Parse generated question JSON from fullResponse
        // Persist follow-up to responses JSONB via PATCH
        res.write(`data: ${JSON.stringify({ type: "done", followUp: parsedQuestion })}\n\n`);
      }
    }
    res.end();
  }
);
```

### Pattern 5: Post-Submission AI Summary (ASMT-07) — Job Queue Pattern

Model on `ai-enrichment.ts`. On assessment submission: enqueue job, return 202. Worker calls `complete()` and writes result to `assessments.ai_summary`.

```typescript
// Source: artifacts/api-server/src/lib/job-queue.ts + ai-enrichment.ts pattern
// On POST /v1/assessments/:id/submit:
const job = await enqueueJob("ai-assess", "summarize_assessment", { assessmentId }, tenantId);
res.status(202).json({ assessmentId, jobId: job.id, status: "queued" });

// Worker registered in ai-workers.ts:
registerWorker("ai-assess", async (job) => {
  const { assessmentId } = job.payload as { assessmentId: string };
  // Load assessment + template
  // Build full prompt with all Q&A pairs
  const summary = await complete(tenantId, { messages }, "general");
  await db.update(assessmentsTable).set({ aiSummary: summary }).where(eq(assessmentsTable.id, assessmentId));
});
```

### Pattern 6: Pre-built Template Seeding (ASMT-06)

Pre-built templates need a `isPrebuilt` boolean column (add to schema) and a global `tenantId = NULL` pattern OR a seed script that inserts them per-tenant on first access. The simpler approach is a seed script in `lib/db/src/seed/prebuilt-templates.ts` that runs at server boot via a guarded check (similar to `bootstrap.ts` pattern already in the codebase).

**Important:** CONTEXT.md D-11 says "Built-in templates have no delete action." The API must guard `DELETE /v1/assessment-templates/:id` to reject deletion of pre-built templates.

### Pattern 7: LLMTaskType Extension

The `complete()` and `streamComplete()` functions accept a `LLMTaskType` parameter. Currently: `"enrichment" | "triage" | "treatment" | "embeddings" | "agent" | "general"`. Add `"assessment"` to this union in `lib/llm-service.ts` so tenants can route AI follow-up and summary tasks to a specific model.

```typescript
// Source: artifacts/api-server/src/lib/llm-service.ts line 7
export type LLMTaskType =
  | "enrichment" | "triage" | "treatment" | "embeddings" | "agent" | "general"
  | "assessment";   // ADD THIS
```

### Anti-Patterns to Avoid

- **Calling the AI synchronously during session navigation:** Follow-up generation must be a separate endpoint, not blocking the section-save PATCH. The PATCH saves responses immediately; AI generation is fire-and-forget (SSE stream or async).
- **Storing branching conditions separately from questions:** Keep conditions inside the `questions` JSONB on the template. Splitting them to a separate table creates a join-heavy pattern with no benefit at this scale.
- **Computing score in the frontend only:** Score must be computed server-side at submission time and written to `assessments.score`. The frontend can preview scores locally but the authoritative score comes from the backend.
- **Hard-wiring `tenantId` on pre-built templates:** Use a guarded seed approach. Pre-built templates are inserted per-tenant (or with `tenantId = NULL` + tenant join on read). Do NOT store them in code constants only — they need to be queryable via the normal template API.
- **Allowing deletion of assessments with completed scores:** Once `status = "completed"`, assessments should be read-only. Enforce this in the route.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming AI responses | Custom HTTP chunked transfer | `streamComplete()` from `llm-service.ts` | Already handles Anthropic and OpenAI_compat providers, error recovery, done signal |
| Async background jobs | `setTimeout` or in-process queue | `enqueueJob()` from `job-queue.ts` | SKIP LOCKED, exponential backoff, survives restarts — already battle-tested in codebase |
| Score gauge visualization | Custom SVG | recharts `RadialBarChart` | Already installed; UI-SPEC mandates it; animation props built in |
| Section bar chart | Custom SVG bars | recharts `BarChart` | Same reason |
| Drag-to-reorder | react-beautiful-dnd / @dnd-kit | HTML5 draggable API | UI-SPEC explicitly mandates HTML5 native; no new packages |
| Per-tenant LLM routing | Direct model calls | `complete(tenantId, ..., "assessment")` | Handles provider routing, key decryption, fallback — never call providers directly |
| Audit logging | Custom log statements | `recordAudit(req, action, entity, id)` | Every mutation in this codebase uses this pattern; required for compliance |

**Key insight:** This codebase has a rich set of reusable infrastructure. The assessment engine is primarily wiring together existing pieces (streaming, job queue, LLM service, audit) with new business logic (scoring, branching evaluation).

---

## Common Pitfalls

### Pitfall 1: AI Follow-up Questions Disappear on Refresh

**What goes wrong:** Follow-up questions are generated by the LLM and displayed inline. If they are only stored in React state and not persisted to the DB, refreshing the page loses them — breaking the D-06 guarantee.

**Why it happens:** Developer generates the follow-up, renders it in the UI, but only writes the user's *answer* (not the generated follow-up question itself) to the DB on section navigation.

**How to avoid:** When a follow-up question arrives from the SSE stream, immediately PATCH the assessment with the new `aiFollowUps` array entry in the `responses` JSONB. On page load, read `responses.aiFollowUps` and render them all in their correct positions. The question object (full `AssessmentQuestion`) must be persisted — not just the answer.

**Warning signs:** Follow-up questions work in the happy path but fail to reappear after F5.

### Pitfall 2: Branching Logic Evaluates Hidden Questions in Score

**What goes wrong:** Score computation iterates all questions and sums weights. A question that is hidden by a branching condition (e.g., "Q7 is shown only if Q3 = 'Yes', but Q3 was answered 'No'") still contributes to the denominator, dragging down the overall score.

**Why it happens:** The scoring function uses `template.sections[].questions.length` as the denominator without filtering by visibility.

**How to avoid:** The `computeScore()` function MUST call `isHiddenByBranching()` for each question before including it in the weighted average. Only visible questions count. This is the "configurable scoring mode" implied by ASMT-04.

**Warning signs:** Two assessments with identical visible-question answers produce different scores because one triggered branching conditions.

### Pitfall 3: Pre-built Templates Editable / Deletable

**What goes wrong:** A user edits or deletes a pre-built template. Phase 11 (Vendor Lifecycle) expects the "Vendor Security" template to exist by ID. If it was deleted, vendor onboarding fails.

**Why it happens:** DELETE and PATCH handlers don't check `isPrebuilt`.

**How to avoid:** Add a guard in the template PATCH and DELETE routes:
```typescript
if (template.isPrebuilt) {
  badRequest(res, "Pre-built templates cannot be modified. Clone it to customize.");
  return;
}
```
"Clone & Edit" (CONTEXT.md D-11) creates a new user-owned template — it is never a mutation of the original.

**Warning signs:** Template library shows no built-in templates after a user accidentally deleted them.

### Pitfall 4: Score Non-Determinism from Floating-Point Accumulation

**What goes wrong:** Two identical response sets produce slightly different scores (e.g., 84.00000001 vs 84.0) due to floating-point arithmetic order-dependency.

**Why it happens:** JavaScript `reduce()` order on floating-point numbers is not always associative.

**How to avoid:** Round to 2 decimal places at the section level before rolling up to overall:
```typescript
sectionScore = Math.round(sectionScore * 100) / 100;
overall = Math.round(overall * 100) / 100;
```
Store as `numeric(5,2)` in Postgres — already defined in Phase 9 schema.

**Warning signs:** ASMT-04 test "same responses always yield same score" flakes.

### Pitfall 5: Assessment Created Without Context Assignment

**What goes wrong:** An assessment is created with `contextId = null` and `contextType = "vendor"`. It floats unattached. Phase 11 queries `assessments WHERE context_type = 'vendor' AND context_id = :vendorId` and never finds it.

**Why it happens:** The API allows `contextId` to be optional (nullable in Phase 9 schema) for flexibility, but vendor/compliance flows require it.

**How to avoid:** The `POST /v1/assessments` route should validate that `contextId` is provided and that the referenced entity (`vendorId` or `frameworkId`) exists in the tenant before creating the assessment.

**Warning signs:** Assessment list page shows assessments that don't appear under any vendor or framework detail page.

### Pitfall 6: Questionnaires Table Conflict

**What goes wrong:** Phase 9 notes that `questionnaires_v2` was named with `_v2` suffix to avoid conflict with the existing `questionnaires` table. The old `questionnaires` table is still consumed by existing code. If Phase 10 routes reference either table incorrectly, it will break existing vendor questionnaire display.

**Why it happens:** Two similarly-named table concepts for similar-sounding features.

**How to avoid:** Phase 10 uses ONLY `assessment_templates` and `assessments` tables. The old `questionnaires` / `questionnaire_questions` tables are legacy — read-only compatibility view. Do not mix the two. STATE.md Pending Todos confirms: "Grep all `questionnaires` table consumers before Phase 10 — create compatibility view before migrating source of truth."

**Warning signs:** Existing vendor detail pages that show questionnaire history break after Phase 10 route registration.

---

## Code Examples

Verified patterns from the codebase:

### Express Route Structure (matches all existing routes)

```typescript
// Source: artifacts/api-server/src/routes/interviews.ts — standard route pattern
import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, assessmentTemplatesTable, assessmentsTable } from "@workspace/db";
import { requireRole } from "../middlewares/rbac";
import { recordAudit } from "../lib/audit";
import { badRequest, notFound, serverError, sendError } from "../lib/errors";
import { enqueueJob } from "../lib/job-queue";
import { complete, streamComplete, isAvailable, LLMUnavailableError } from "../lib/llm-service";

const router = Router();

// RBAC: admin + risk_manager for mutations; auditor for reads
router.get("/v1/assessment-templates", requireRole("admin", "risk_manager", "auditor"), async (req, res) => { /* ... */ });
router.post("/v1/assessment-templates", requireRole("admin", "risk_manager"), async (req, res) => { /* ... */ });
router.patch("/v1/assessment-templates/:id", requireRole("admin", "risk_manager"), async (req, res) => { /* ... */ });
router.delete("/v1/assessment-templates/:id", requireRole("admin"), async (req, res) => { /* ... */ });

export default router;
```

### SSE Streaming (AI Follow-up Pattern)

```typescript
// Source: artifacts/api-server/src/routes/interviews.ts lines 185–225
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.setHeader("X-Accel-Buffering", "no");  // CRITICAL for Cloudflare/nginx buffering
res.flushHeaders();

let fullResponse = "";
try {
  for await (const chunk of streamComplete(tenantId, { messages }, "general")) {
    if (chunk.type === "text") {
      fullResponse += chunk.content;
      res.write(`data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`);
    } else if (chunk.type === "done") {
      // parse fullResponse, persist result, send done event
      res.write(`data: ${JSON.stringify({ type: "done", result: parsedResult })}\n\n`);
    }
  }
} catch (err) {
  res.write(`data: ${JSON.stringify({ type: "error", content: String(err) })}\n\n`);
}
res.end();
```

### Async Job Enqueue (AI Summary Pattern)

```typescript
// Source: artifacts/api-server/src/routes/ai-enrichment.ts lines 16–34
const job = await enqueueJob("ai-assess", "summarize_assessment", { assessmentId }, tenantId);
await recordAudit(req, "summarize_request", "assessment", assessmentId, { jobId: job.id });
res.status(202).json({ jobId: job.id, status: "queued", message: "AI summary job queued" });
```

### Client-Side Branching Evaluation

```typescript
// Source: CONTEXT.md D-03 + D-04 (client-side evaluation)
function isQuestionVisible(
  question: AssessmentQuestion,
  responses: Record<string, QuestionResponse>,
  allSectionQuestions: AssessmentQuestion[]
): boolean {
  if (question.conditions.length === 0) return true;
  // All conditions must pass (AND logic)
  return question.conditions.every(condition => {
    const response = responses[condition.questionId];
    if (!response) return condition.action === "show" ? false : true;
    const answer = response.answer;
    switch (condition.operator) {
      case "equals": return String(answer) === String(condition.value);
      case "contains": return String(answer).includes(String(condition.value));
      case "greater_than": return Number(answer) > Number(condition.value);
      default: return true;
    }
  });
  // Note: if action="hide" and condition passes → question is hidden
  // If action="show" and condition passes → question is visible
}
```

### ScoreGauge (recharts RadialBarChart)

```typescript
// Source: UI-SPEC Phase 10 + recharts RadialBarChart documentation pattern
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

function ScoreGauge({ score, tier }: { score: number; tier: "critical"|"high"|"medium"|"low" }) {
  const color = {
    critical: "hsl(0 84.2% 60.2%)",
    high: "var(--severity-high)",
    medium: "var(--severity-medium)",
    low: "var(--severity-low)",
  }[tier];

  return (
    <RadialBarChart width={200} height={200} innerRadius={70} outerRadius={90}
      data={[{ value: score }]} startAngle={90} endAngle={-270}>
      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
      <RadialBar dataKey="value" fill={color} isAnimationActive animationDuration={800} />
      {/* Center text via absolute positioning or SVG foreignObject */}
    </RadialBarChart>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static JSON questionnaire (questionnaires table) | Dynamic assessment engine with JSONB questions + AI follow-ups | Phase 9 schema foundation | New assessment engine is polymorphic and AI-capable; old questionnaires table is legacy read-only |
| All questionnaires vendor-scoped (vendor_id NOT NULL) | Polymorphic context_type + nullable context_id | Phase 9 decision | Same engine for vendor and compliance assessments |
| Synchronous LLM calls in route handlers | SSE streaming for interactive, job queue for async | Established in Phase 1–8 | Never blocks event loop; survives timeouts |
| LLMTaskType union without "assessment" | Needs "assessment" added in Phase 10 | Phase 10 | Enables per-task model routing for assessment AI calls |

**Deprecated/outdated:**
- `questionnaires` + `questionnaire_questions` tables: Legacy, kept for backward compat only. Phase 10 does not write to them. A compatibility view (`questionnaires_v2_compat`) may be needed — check STATE.md Pending Todos.

---

## Open Questions

1. **Pre-built template tenantId strategy**
   - What we know: `assessment_templates.tenantId` is `NOT NULL` (Phase 9 schema). Pre-built templates need to be available to all tenants.
   - What's unclear: Two options: (a) insert pre-built templates per-tenant on first access (idempotent seed), or (b) add `isPrebuilt boolean` + relax `tenantId` NOT NULL for a NULL = "global" pattern (requires schema migration).
   - Recommendation: Option (a) — per-tenant seed on first template list request (or at tenant creation time). No schema change needed. Simpler. Consistent with the existing `tenantId NOT NULL` invariant.

2. **questionnaires compatibility view**
   - What we know: STATE.md Pending Todos says "Grep all `questionnaires` table consumers before Phase 10 — create compatibility view before migrating source of truth."
   - What's unclear: Which routes/pages currently display questionnaire data that would break.
   - Recommendation: Wave 0 task: grep for `questionnaires` in route and page files. If found, create a DB view `questionnaires_v2_compat` before any assessment routes go live.

3. **AI follow-up trigger timing**
   - What we know: UI-SPEC says "triggered after user answers a question and moves focus away (onBlur for text; onChange for radio/checkbox/slider)." CONTEXT.md D-05 leaves triggering to "Claude's Discretion."
   - What's unclear: Should the backend always return a follow-up question or sometimes return empty (no follow-up warranted)?
   - Recommendation: Backend always returns a response — either a `followUp` question object or `{ followUp: null }`. LLM decides based on whether the answer warrants deeper exploration. Client renders follow-up only if non-null.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — Wave 0 must install vitest |
| Config file | None — Wave 0 creates `artifacts/api-server/vitest.config.ts` |
| Quick run command | `pnpm --filter @workspace/api-server test -- --run` |
| Full suite command | `pnpm --filter @workspace/api-server test -- --run --reporter=verbose` |
| TypeScript check | `pnpm --filter @workspace/api-server typecheck` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASMT-01 | Template CRUD creates/reads/updates/deletes correctly | unit | `pnpm --filter @workspace/api-server test -- --run tests/assessment-engine.test.ts` | Wave 0 |
| ASMT-02 | `isQuestionVisible()` evaluates all 3 operators correctly | unit | same file | Wave 0 |
| ASMT-03 | Assessment creation with valid contextType/contextId accepted; invalid contextId rejected | unit | same file | Wave 0 |
| ASMT-04 | `computeScore()` deterministic: same inputs → same output across 100 runs | unit | same file | Wave 0 |
| ASMT-04 | Hidden questions excluded from score denominator | unit | same file | Wave 0 |
| ASMT-05 | AI follow-up persisted to responses JSONB; reappears on re-read | integration | manual smoke | N/A |
| ASMT-06 | Pre-built templates present after seed; cannot be deleted | unit | same file | Wave 0 |
| ASMT-07 | AI summary job enqueued on submission; job payload contains assessmentId | unit | same file | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @workspace/api-server typecheck`
- **Per wave merge:** `pnpm --filter @workspace/api-server test -- --run`
- **Phase gate:** TypeScript compilation clean + unit tests green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `artifacts/api-server/vitest.config.ts` — test framework config
- [ ] `artifacts/api-server/tests/assessment-engine.test.ts` — covers ASMT-01 through ASMT-07 unit tests
- [ ] Install vitest: `pnpm --filter @workspace/api-server add -D vitest`
- [ ] `artifacts/api-server/tests/scoring.test.ts` — pure scoring function determinism tests (ASMT-04)

---

## Sources

### Primary (HIGH confidence)

- `lib/db/src/schema/assessments.ts` — Phase 9 schema: assessment_templates + assessments tables, enums, JSONB fields, indexes
- `lib/db/src/relations.ts` — Drizzle relations confirming template-to-assessment relationship
- `artifacts/api-server/src/routes/interviews.ts` — SSE streaming pattern (source of truth for AI follow-up implementation)
- `artifacts/api-server/src/lib/llm-service.ts` — `complete()`, `streamComplete()`, `LLMTaskType`, task routing
- `artifacts/api-server/src/lib/job-queue.ts` — `enqueueJob()`, `registerWorker()`, SKIP LOCKED pattern
- `artifacts/api-server/src/routes/ai-enrichment.ts` — 202 async job pattern for AI analysis
- `.planning/phases/10-assessment-engine/10-CONTEXT.md` — locked implementation decisions D-01 to D-11
- `.planning/phases/10-assessment-engine/10-UI-SPEC.md` — component inventory, page specs, interaction contracts
- `.planning/research/ARCHITECTURE.md` — system architecture, component boundaries, new file locations
- `.planning/research/PITFALLS.md` — domain-specific pitfalls for assessment engine

### Secondary (MEDIUM confidence)

- `.planning/research/FEATURES.md` — feature landscape, table stakes vs. differentiators for assessment engine
- `.planning/STATE.md` — pending todos including questionnaires compat view task
- `artifacts/riskmind-app/src/components/ui/` — confirmed component inventory (all shadcn components listed in UI-SPEC are present)

### Tertiary (LOW confidence)

- None — all findings verified against codebase or CONTEXT.md decisions.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified against package.json and existing imports; no new packages required
- Architecture: HIGH — all patterns traced to existing implementation files in the codebase
- Pitfalls: HIGH — branching/scoring pitfalls derived from CONTEXT.md constraints and PITFALLS.md research; questionnaires conflict confirmed in STATE.md
- Pre-built template seeding: MEDIUM — two viable approaches; recommendation made but executor should verify schema constraints at implementation time

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (stable tech stack; 90-day validity)
