# Phase 13: Compliance Flow - Research

**Researched:** 2026-03-25
**Domain:** Compliance framework management, CSV/JSON import, pgvector auto-mapping, PDF export, assessment-to-control linkage, threshold-driven findings pipeline
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** When compliance score drops below threshold → auto-create finding linked to framework, alert in alert bell, AND risk suggestion in risk register. Full pipeline.
- **D-02:** Recalculation triggers: framework-linked assessment completion AND control test creation/update.
- **D-03:** Idempotent — one active finding per framework per threshold breach. Update if exists. Auto-resolve when score recovers above threshold.
- **D-04:** CSV columns: code, title, description, parentCode. JSON supports nested hierarchy natively. Both show diff preview before applying.
- **D-05:** Import is additive-only — existing controls and mappings preserved, never deleted.
- **D-06:** Import UI lives on framework list page as "Import Framework" button. Opens sheet/dialog with file upload, format selection, diff preview.
- **D-07:** "Create Framework" button alongside Import on framework list page. Manual entry of name/version/type/description, then add requirements one by one or paste in bulk.
- **D-08:** Compliance threshold as inline editable field on framework detail page, next to compliance score ring. Admin/risk_manager can edit.
- **D-09:** Control auto-mapping uses AI-powered pgvector embedding similarity between control descriptions and requirement descriptions. Shows suggested mappings for user approval before applying.
- **D-10:** When a framework assessment completes, each section score updates mapped control effectiveness. Low section scores trigger control test creation with 'fail' result.
- **D-11:** PDF export for executive summary (score rings, gap highlights, audit trail). CSV export for raw data (all requirements with compliance status, mapped controls, test results).
- **D-12:** Export buttons on framework detail page.
- **D-13:** Keep existing evidenceUrl field, add file upload capability (local storage). Evidence expiry date field on control_tests with alerts when evidence goes stale.

### Claude's Discretion

- Diff preview UI layout and interaction pattern
- PDF report template design
- Evidence storage location (local vs S3 — local fine for single server)
- Exact embedding similarity threshold for auto-mapping suggestions
- Risk suggestion format and default severity for compliance breach risks

### Deferred Ideas (OUT OF SCOPE)

- Guest contributor access for assessments — deferred to v2.1 (requires auth changes: token-based link access)
- Multi-framework crosswalk engine (#57) — future milestone
- Evidence decay and renewal tracking (#63) — future milestone (basic expiry covered in Phase 13)
- Automated evidence collection (#60) — future milestone
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | User can import compliance framework controls via CSV or JSON with validation and duplicate detection | CSV parsing via papaparse (server-side); JSON schema validation via Zod; diff preview algorithm using code-based upsert with before/after sets; additive-only via Drizzle transaction |
| COMP-02 | User can assign assessment templates to a compliance framework, mapping questions to control IDs, with responses updating control compliance status | assessments.ts already supports contextType="framework" and contextId=frameworkId; submit hook needs extension to call recalculation; section scores map via requirement linkage to control tests |
| COMP-03 | User can configure per-framework compliance thresholds (0-100%) with dashboard showing COMPLIANT/AT-RISK/NON-COMPLIANT status | complianceThreshold column already exists on frameworksTable; PUT endpoint needed; threshold-driven findings pipeline uses checkComplianceDrift pattern from monitoring.ts; status labels map from score vs threshold |
</phase_requirements>

---

## Summary

Phase 13 builds on a solid foundation. Twelve compliance endpoints already exist across frameworks, controls, control tests, gap analysis, and compliance score. The schema is ready: `frameworksTable.complianceThreshold`, `frameworkRequirementsTable.embedding` (1536-dim pgvector), and the full `findings`/`alerts`/`risks` pipeline tables are all in place. The compliance score formula (coverage × 0.6 + effectiveness × 0.4) is implemented and tested by the seed data.

The three core work streams are: (1) framework import and creation UI with diff preview and CSV/JSON parsing, (2) threshold-driven findings pipeline that auto-creates/updates/resolves findings and alerts when compliance score crosses the threshold, and (3) compliance reporting (PDF executive summary and CSV data export). Secondary work streams add assessment-to-control effectiveness linkage, AI-powered auto-mapping with approval UI, and evidence file upload with expiry tracking.

No multer or papaparse is currently installed in `artifacts/api-server/package.json` — they need to be added. Multer is already allowlisted in `build.ts` (line 25), indicating it was anticipated. `@react-pdf/renderer` is not installed on either side. The findings table does not have a `frameworkId` column — the compliance findings pipeline must use the existing nullable `riskId`/`signalId` nullable FK pattern and store `frameworkId` in the `context` JSONB column on the alert, and in the finding title/description for idempotency lookup (matching the `createAlert` dedup pattern in monitoring.ts which uses title+type+status).

**Primary recommendation:** Use papaparse for CSV parsing on the backend, @react-pdf/renderer for PDF export on the frontend (rendered in-browser to avoid Puppeteer's Chromium dependency), and extend the assessment submit hook to trigger compliance recalculation for framework-context assessments.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | 5.5.3 | CSV parsing on backend (Node-compatible) | Zero-dependency, handles quoted fields, parentCode lookups, streaming large files |
| multer | 2.1.1 | Multipart file upload middleware for Express 5 | Already in build.ts allowlist; standard Express upload solution; pre-anticipated |
| @react-pdf/renderer | 4.3.2 | PDF generation in-browser (React components → PDF) | No Chromium required; React component model matches existing UI style; runs on client |
| zod | catalog: (already installed) | JSON import schema validation | Already project-standard; validates imported JSON structure before DB write |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/multer | ~2.1.x | TypeScript types for multer | Added alongside multer install |
| @types/papaparse | ~5.3.x | TypeScript types for papaparse | Added alongside papaparse install |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | pdfkit | pdfkit runs server-side (Node), requires piped stream endpoint; @react-pdf/renderer avoids server file temp storage and fits the React component model better |
| @react-pdf/renderer | puppeteer | Puppeteer requires Chromium binary (~300MB); not appropriate for a production single-server setup |
| papaparse | csv-parse | Both work in Node; papaparse has simpler synchronous API for the import preview use case |

**Installation (api-server):**
```bash
pnpm add multer papaparse
pnpm add -D @types/multer @types/papaparse
```

**Installation (riskmind-app):**
```bash
pnpm add @react-pdf/renderer
```

**Version verification:** Versions confirmed from npm registry on 2026-03-25:
- multer: 2.1.1 (published)
- papaparse: 5.5.3 (published)
- @react-pdf/renderer: 4.3.2 (published)

---

## Architecture Patterns

### Recommended Project Structure

New files added in this phase:

```
artifacts/api-server/src/
├── routes/compliance.ts           — extend with 8 new endpoints
├── lib/compliance-pipeline.ts     — NEW: recalculation + findings pipeline logic
├── lib/compliance-import.ts       — NEW: CSV/JSON parse, validate, diff, upsert

artifacts/riskmind-app/src/
├── pages/compliance/
│   ├── framework-list.tsx         — add Import + Create Framework buttons/dialogs
│   └── framework-detail.tsx       — add threshold editor, export buttons, assessment tab
├── components/compliance/
│   ├── import-framework-dialog.tsx — NEW: file upload, format picker, diff preview
│   ├── create-framework-dialog.tsx — NEW: manual framework creation form
│   ├── auto-map-approval-dialog.tsx — NEW: pgvector suggestions approval UI
│   └── compliance-pdf-report.tsx  — NEW: @react-pdf/renderer document template

lib/db/src/schema/
├── control-tests.ts               — ADD: evidenceExpiry timestamp column
├── findings.ts                    — no column change needed (frameworkId via context JSONB)
```

### Pattern 1: Additive Import with Diff Preview

**What:** Parse CSV/JSON, resolve parentCode to parentId, compute diff (new/modified/unchanged), show diff in UI before committing. Apply via Drizzle transaction with `onConflictDoUpdate`.

**When to use:** Framework import endpoint (`POST /v1/frameworks/:id/import`).

**Code sketch (backend):**
```typescript
// artifacts/api-server/src/lib/compliance-import.ts
import Papa from "papaparse";

interface RawRequirement {
  code: string;
  title: string;
  description?: string;
  parentCode?: string;
}

export function parseCsv(fileBuffer: Buffer): RawRequirement[] {
  const result = Papa.parse<RawRequirement>(fileBuffer.toString("utf-8"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (result.errors.length > 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }
  return result.data;
}

export function computeDiff(
  existing: { code: string; title: string }[],
  incoming: RawRequirement[]
) {
  const existingMap = new Map(existing.map((r) => [r.code, r]));
  return {
    new: incoming.filter((r) => !existingMap.has(r.code)),
    modified: incoming.filter((r) => {
      const e = existingMap.get(r.code);
      return e && e.title !== r.title;
    }),
    unchanged: incoming.filter((r) => {
      const e = existingMap.get(r.code);
      return e && e.title === r.title;
    }),
  };
}
```

**Two-step API contract:**
- `POST /v1/frameworks/:id/import/preview` — parses file, returns diff (no DB write)
- `POST /v1/frameworks/:id/import/apply` — applies the diff (DB write, wrapped in transaction)

### Pattern 2: Threshold-Driven Findings Pipeline

**What:** Extract compliance recalculation into a shared function. Called from (a) assessment submit hook for framework assessments, and (b) control test create/update routes. Creates finding + alert + risk draft when score < threshold; auto-resolves when score >= threshold.

**When to use:** Any event that changes compliance posture (D-02).

```typescript
// artifacts/api-server/src/lib/compliance-pipeline.ts

export async function recalculateAndTriggerPipeline(
  frameworkId: string,
  tenantId: string
): Promise<void> {
  // 1. Compute compliance score (reuse existing score logic)
  const score = await computeComplianceScore(frameworkId, tenantId);

  const [framework] = await db.select({
    id: frameworksTable.id,
    name: frameworksTable.name,
    complianceThreshold: frameworksTable.complianceThreshold,
  }).from(frameworksTable)
    .where(and(eq(frameworksTable.id, frameworkId), eq(frameworksTable.tenantId, tenantId)))
    .limit(1);

  if (!framework?.complianceThreshold) return; // no threshold configured

  const threshold = Number(framework.complianceThreshold);
  const isBreached = score.score < threshold;

  if (isBreached) {
    // Idempotent: upsert finding by title pattern
    const findingTitle = `Compliance gap: ${framework.name}`;
    const [existing] = await db.select({ id: findingsTable.id, status: findingsTable.status })
      .from(findingsTable)
      .where(and(
        eq(findingsTable.tenantId, tenantId),
        eq(findingsTable.title, findingTitle),
        inArray(findingsTable.status, ["open", "investigating"]),
      )).limit(1);

    if (!existing) {
      // Create finding + alert + risk draft
      await db.insert(findingsTable).values({ tenantId, title: findingTitle, ... });
      await createAlert(tenantId, "compliance_threshold_breach", findingTitle, "high", ...);
      await db.insert(risksTable).values({ tenantId, status: "draft", category: "compliance", ... });
    }
  } else {
    // Auto-resolve: update open findings for this framework to resolved
    await db.update(findingsTable)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(and(
        eq(findingsTable.tenantId, tenantId),
        eq(findingsTable.title, `Compliance gap: ${framework.name}`),
        inArray(findingsTable.status, ["open", "investigating"]),
      ));
  }
}
```

**Note on idempotency:** The findings table has no `frameworkId` column. Use finding `title` as the correlation key (`"Compliance gap: ${framework.name}"`) combined with `tenantId` and open/investigating status — matches how `createAlert` deduplicates by `type + title + status = active` in monitoring.ts.

### Pattern 3: Assessment-to-Control Effectiveness Linkage

**What:** When a framework assessment completes, for each template section that has a low score: find requirements linked to that section's questions, then find controls mapped to those requirements, and create control tests with `result='fail'`.

**Section → Requirement mapping:** Template questions have IDs like `q-iso-001`. The mapping must be established when a compliance framework assessment template is created — questions reference requirement codes in their metadata (or a `requirementCode` field on the question object). The assessment submit hook for `contextType='framework'` calls `recalculateAndTriggerPipeline` after updating control tests.

**Score threshold for low section:** Section score < 50% triggers a 'fail' control test (Claude's discretion per CONTEXT.md). The section score is already computed by `computeScore()` in `assessment-engine.ts`.

### Pattern 4: pgvector Auto-Mapping with Approval UI

**What:** For a given control, generate its embedding, then query `framework_requirements` for cosine-similar requirements. Return suggestions (requirementId, code, title, similarity score). User approves/rejects before applying.

```typescript
// In compliance.ts route: POST /v1/controls/:id/auto-map-suggestions
const controlEmbedding = await generateEmbedding(tenantId, control.description || control.title);
const vectorStr = `[${controlEmbedding.join(",")}]`;
const THRESHOLD = 0.65; // Claude's discretion — higher than search (0.4) for precision

const suggestions = await db.execute(sql`
  SELECT id, code, title, framework_id,
         1 - (embedding <=> ${vectorStr}::vector) AS similarity
  FROM framework_requirements
  WHERE tenant_id = ${tenantId}
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> ${vectorStr}::vector) > ${THRESHOLD}
  ORDER BY similarity DESC
  LIMIT 10
`);
```

After user approves selections, POST to existing `PUT /v1/controls/:id/requirements` endpoint.

**Embedding generation for import:** When importing requirements, generate embeddings for each requirement's description in background (enqueue job via `enqueueJob`) — same pattern as `ai-assess` worker.

### Pattern 5: Evidence File Upload

**What:** Add multer middleware to control test creation endpoint. Store files locally under `uploads/evidence/`. Add `evidenceExpiry` timestamp column to `control_tests`.

```typescript
import multer from "multer";

const evidenceStorage = multer.diskStorage({
  destination: "uploads/evidence/",
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const uploadEvidence = multer({
  storage: evidenceStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "text/plain"];
    cb(null, allowed.includes(file.mimetype));
  },
});
```

### Schema Migrations Required

Two schema changes needed (Drizzle migration):

1. **`control_tests` — add `evidenceExpiry` column:**
```typescript
// lib/db/src/schema/control-tests.ts
evidenceExpiry: timestamp("evidence_expiry", { withTimezone: true }),
evidenceFileName: text("evidence_file_name"),
evidenceMimeType: text("evidence_mime_type"),
```

2. **No `frameworkId` on `findings`** — findings table already has nullable `riskId` and `vendorId`. Correlation uses `title` matching pattern. This avoids a migration and stays consistent with existing finding lookup patterns.

3. **`framework_requirements` embeddings** — column already exists (`vector(1536)`). Just needs population during import.

### Anti-Patterns to Avoid

- **DELETE + re-insert on import:** Violates D-05 (additive-only). Use `onConflictDoUpdate` (upsert by `frameworkId + code + tenantId`).
- **Synchronous PDF generation in route handler:** Use `@react-pdf/renderer` on the client side (triggers download via `pdf().toBlob()` in browser). This avoids blocking the server and temp file cleanup.
- **Re-computing compliance score from scratch in pipeline:** Extract the score computation to a shared function called from both the existing compliance-score endpoint AND the pipeline function — single source of truth.
- **Calling `recalculateAndTriggerPipeline` without threshold guard:** Always check `framework.complianceThreshold !== null` before running threshold logic.
- **pgvector suggestions without graceful fallback:** `generateEmbedding` can throw `LLMUnavailableError` — return empty suggestions array (no error) when embeddings are not configured, same as search.ts pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom line-split parser | papaparse | Handles quoted fields, escaped commas, BOM, encoding variations |
| File upload | Raw request body Buffer parsing | multer | Handles multipart boundaries, file type checking, disk streaming |
| PDF generation | HTML-to-string + print stylesheet | @react-pdf/renderer | Consistent cross-browser PDF layout with React component primitives |
| Embedding cosine similarity | Manual dot-product in TypeScript | pgvector `<=>` operator | Already in DB, indexed, sub-millisecond on existing data sizes |
| Import diff algorithm | Set intersection from scratch | Map-based lookups (code → existing record) | O(n) with Map vs O(n²) with nested loops; use `computeDiff()` shared function |

**Key insight:** The embedding and alert/finding pipelines are already wired in the codebase — this phase extends them, it does not build them from scratch.

---

## Runtime State Inventory

> This is not a rename/refactor phase. Skipped.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL with pgvector | Auto-mapping suggestions | Assumed available (already used by search.ts) | pgvector installed | Skip embedding generation if LLMUnavailableError |
| multer | Evidence file upload | Not in package.json | — | Must install: `pnpm add multer @types/multer` |
| papaparse | CSV import parsing | Not in package.json | — | Must install: `pnpm add papaparse @types/papaparse` |
| @react-pdf/renderer | PDF export | Not in riskmind-app | — | Must install: `pnpm add @react-pdf/renderer` |
| uploads/ directory | Evidence file storage | Not verified | — | Create at startup or in multer diskStorage destination config |

**Missing dependencies with no fallback:**
- multer, papaparse, @react-pdf/renderer — must be installed before implementation begins

**Missing dependencies with fallback:**
- pgvector embeddings: if LLM embeddings not configured, auto-map returns empty suggestions gracefully (matching search.ts pattern)

---

## Common Pitfalls

### Pitfall 1: Import Creates Duplicate Requirements on Re-run

**What goes wrong:** Running import twice creates duplicate rows for the same `code`.
**Why it happens:** INSERT without conflict handling.
**How to avoid:** Use Drizzle's `onConflictDoUpdate` with unique constraint on `(frameworkId, code, tenantId)`. If the unique constraint doesn't exist, add it in the migration.
**Warning signs:** `SELECT count(*) FROM framework_requirements WHERE framework_id = X` grows on each import.

### Pitfall 2: parentCode Resolution Fails for Out-of-Order CSV Rows

**What goes wrong:** A row's `parentCode` refers to a code that hasn't been inserted yet (because CSV rows are not ordered by hierarchy depth).
**Why it happens:** CSV format doesn't guarantee parent-before-child ordering.
**How to avoid:** Two-pass strategy — first insert all requirements with `parentId = null`, then update `parentId` by resolving `parentCode` to the newly-inserted IDs.
**Warning signs:** Requirements appear as root nodes even when parentCode is set.

### Pitfall 3: Compliance Pipeline Fires on Every Control Test, Creating Duplicate Findings

**What goes wrong:** Every control test update triggers the pipeline, and if threshold logic isn't idempotent, duplicates appear.
**Why it happens:** Missing dedup check before insert.
**How to avoid:** Implement D-03 exactly — query for existing open/investigating finding with matching title+tenantId before inserting. Use `LIMIT 1` check before inserting.
**Warning signs:** Multiple open findings with identical title for same framework.

### Pitfall 4: @react-pdf/renderer Version Incompatibility with React 18/19

**What goes wrong:** `@react-pdf/renderer` uses its own internal React renderer — it may conflict with React version or Vite HMR.
**Why it happens:** `@react-pdf/renderer` bundles its own reconciler.
**How to avoid:** Import PDF components only in the export component file. Use dynamic `import()` to avoid loading the PDF renderer on initial page load. Keep PDF Document/Page/Text/View imports isolated.
**Warning signs:** Build errors about duplicate React or reconciler conflicts.

### Pitfall 5: Assessment Section-to-Control Mapping Without Template Metadata

**What goes wrong:** Completion hook tries to map sections to controls but no question-to-requirementCode binding exists in the template.
**Why it happens:** The existing assessment template schema stores `questions` as JSONB without a mandatory `requirementCode` field on questions.
**How to avoid:** The compliance assessment template (pre-built, `[PREBUILT]` prefix) must include `requirementCode` on each question. When the submit hook fires for `contextType='framework'`, iterate sections, check for `requirementCode` presence per question, and only create control tests for questions that have it. Silently skip questions without it.
**Warning signs:** Hook completes with zero control tests created even for low-scoring sections.

### Pitfall 6: Multer Express 5 Compatibility

**What goes wrong:** Multer's default error handler uses Express 3/4 `next(err)` pattern and may behave differently with Express 5's changed error propagation.
**Why it happens:** Express 5 changed error handling for async routes.
**How to avoid:** multer 2.1.1 was released after Express 5 GA — it supports Express 5. Wrap `upload.single()` in a try/catch or use the `cb(err)` pattern within multer's fileFilter. Confirmed: multer is in `build.ts` allowlist at line 25.

---

## Code Examples

Verified patterns from existing codebase:

### Existing Compliance Score Computation (compliance.ts lines 270-343)
The score formula is already implemented and can be extracted to a shared function:
```typescript
// Formula (from compliance.ts lines 325-327):
const coverageScore = Math.round((coveredRequirements / totalRequirements) * 100);
const effectivenessScore = controlIds.length > 0 ? Math.round((passedControls / controlIds.length) * 100) : 0;
const score = Math.round((coverageScore * 0.6 + effectivenessScore * 0.4));
```

### Existing pgvector Query Pattern (search.ts lines 38-48)
```typescript
const vectorStr = `[${embedding.join(",")}]`;
const rows = await db.execute(sql`
  SELECT id, title, category, status,
         1 - (embedding <=> ${vectorStr}::vector) AS similarity
  FROM risks
  WHERE tenant_id = ${tenantId}
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> ${vectorStr}::vector) > ${THRESHOLD}
  ORDER BY similarity DESC
  LIMIT ${LIMIT}
`);
```

### Existing Alert Dedup Pattern (monitoring.ts lines 14-33)
```typescript
async function createAlert(tenantId, type, title, severity, description, context = {}) {
  const [existing] = await db.select({ id: alertsTable.id }).from(alertsTable)
    .where(and(
      eq(alertsTable.tenantId, tenantId),
      eq(alertsTable.type, type),
      eq(alertsTable.title, title),
      eq(alertsTable.status, "active"),
    )).limit(1);
  if (existing) return existing; // idempotent
  // ... insert new alert
}
```

### Existing Assessment Submit Hook Point (assessments.ts lines 424-425)
```typescript
// After score computation and status update, line 424-425:
await updateVendorRiskScoreFromAssessment(assessment, tenantId);
// ADD: await updateComplianceFromAssessment(assessment, tenantId);
```

### PDF Client-Side Download Pattern (@react-pdf/renderer)
```typescript
// In framework-detail.tsx export button handler:
import { pdf } from "@react-pdf/renderer";
import { CompliancePdfReport } from "@/components/compliance/compliance-pdf-report";

const handleExportPdf = async () => {
  const blob = await pdf(<CompliancePdfReport framework={framework} score={score} gaps={gaps} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${framework.name}-compliance-report.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pdfkit (server-side streaming) | @react-pdf/renderer (client-side) | ~2022 onwards | No server temp files, React component model, no Chromium dependency |
| multer 1.x (Express 4 only) | multer 2.x | 2024 | Express 5 compatible, maintained |
| Manual CSV split | papaparse | Established | BOM handling, quoted field support, type coercion |

---

## Open Questions

1. **Assessment template question-to-requirementCode binding (D-10)**
   - What we know: The [PREBUILT] compliance template for ISO 27001 exists in seed.ts. Assessment questions are JSONB with no enforced `requirementCode` field.
   - What's unclear: Do the existing pre-built compliance templates already include `requirementCode` on each question?
   - Recommendation: Read `artifacts/api-server/src/lib/seed.ts` (specifically the pre-built compliance template section) before implementing the assessment-to-control linkage. If `requirementCode` is absent, add it to the template's question structure when seeding.

2. **unique constraint on `(framework_id, code, tenant_id)` in framework_requirements**
   - What we know: No explicit unique constraint visible in the Drizzle schema file — only a `code` NOT NULL and `framework_id` FK.
   - What's unclear: Whether the DB has this constraint from a prior migration.
   - Recommendation: Add the unique constraint in the Phase 13 migration if not present. Needed for `onConflictDoUpdate` to work correctly.

3. **`uploads/` directory persistence**
   - What we know: The server is Express 5 with local storage (D-13 says "local fine for single server").
   - What's unclear: Whether `uploads/evidence/` directory exists or needs creation on startup.
   - Recommendation: Auto-create with `fs.mkdirSync("uploads/evidence", { recursive: true })` in the compliance route initialization.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (installed, no config file found) |
| Config file | none — Wave 0 creates vitest.config.ts |
| Quick run command | `cd artifacts/api-server && pnpm test --reporter=verbose --run` |
| Full suite command | `cd artifacts/api-server && pnpm test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | CSV parsing with valid input returns correct RawRequirement[] | unit | `pnpm test --run tests/compliance-import.test.ts` | No - Wave 0 |
| COMP-01 | CSV parsing with missing required columns throws error | unit | `pnpm test --run tests/compliance-import.test.ts` | No - Wave 0 |
| COMP-01 | computeDiff returns correct new/modified/unchanged sets | unit | `pnpm test --run tests/compliance-import.test.ts` | No - Wave 0 |
| COMP-01 | Two-pass parentCode resolution correctly sets parentId | unit | `pnpm test --run tests/compliance-import.test.ts` | No - Wave 0 |
| COMP-02 | recalculateAndTriggerPipeline creates finding when score < threshold | unit | `pnpm test --run tests/compliance-pipeline.test.ts` | No - Wave 0 |
| COMP-02 | recalculateAndTriggerPipeline resolves finding when score >= threshold | unit | `pnpm test --run tests/compliance-pipeline.test.ts` | No - Wave 0 |
| COMP-02 | recalculateAndTriggerPipeline is idempotent (no duplicate findings) | unit | `pnpm test --run tests/compliance-pipeline.test.ts` | No - Wave 0 |
| COMP-03 | PUT /v1/frameworks/:id/threshold updates complianceThreshold in DB | integration | manual | No |
| COMP-03 | Framework list returns COMPLIANT/AT-RISK/NON-COMPLIANT label based on score vs threshold | unit | `pnpm test --run tests/compliance-pipeline.test.ts` | No - Wave 0 |

### Sampling Rate

- **Per task commit:** `cd artifacts/api-server && pnpm test --run tests/compliance-import.test.ts tests/compliance-pipeline.test.ts`
- **Per wave merge:** `cd artifacts/api-server && pnpm test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `artifacts/api-server/tests/compliance-import.test.ts` — covers COMP-01 (parseCsv, computeDiff, parentCode resolution)
- [ ] `artifacts/api-server/tests/compliance-pipeline.test.ts` — covers COMP-02, COMP-03 (pipeline logic, idempotency, threshold label)
- [ ] `artifacts/api-server/vitest.config.ts` — test framework configuration

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `artifacts/api-server/src/routes/compliance.ts` — 12 existing endpoints, score formula
- Direct code inspection: `artifacts/api-server/src/lib/monitoring.ts` — createAlert dedup pattern, checkComplianceDrift reference
- Direct code inspection: `artifacts/api-server/src/routes/search.ts` — pgvector query pattern, THRESHOLD=0.4, generateEmbedding usage
- Direct code inspection: `artifacts/api-server/src/routes/assessments.ts` — submit hook, contextType='framework' support, vendor risk score hook pattern
- Direct code inspection: `lib/db/src/schema/` — all relevant tables: frameworksTable (complianceThreshold exists), frameworkRequirementsTable (embedding col 1536-dim exists), controlTestsTable (no evidenceExpiry yet), findingsTable (no frameworkId col)
- Direct code inspection: `artifacts/api-server/build.ts` line 25 — multer in allowlist
- npm registry (2026-03-25): multer 2.1.1, papaparse 5.5.3, @react-pdf/renderer 4.3.2

### Secondary (MEDIUM confidence)

- `artifacts/api-server/package.json` — confirmed multer/papaparse not yet installed
- `artifacts/riskmind-app/package.json` — confirmed @react-pdf/renderer not yet installed
- `.planning/config.json` — nyquist_validation: true

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm registry; multer pre-anticipated in build.ts
- Architecture: HIGH — all patterns derived from existing codebase code, not from training assumptions
- Pitfalls: HIGH — derived from actual schema gaps (no frameworkId on findings, no unique constraint on requirements, no evidenceExpiry column) and established Express 5/multer compatibility facts
- pgvector threshold (0.65): MEDIUM — derived from search.ts THRESHOLD=0.4 as lower bound; 0.65 is Claude's discretion per CONTEXT.md

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable libraries; schema is project-internal so no expiry)
