---
phase: 11
phase_name: Vendor Lifecycle Redesign
status: draft
created: "2026-03-23"
design_system: shadcn/ui — new-york style, neutral base, CSS variables
---

# UI-SPEC: Phase 11 — Vendor Lifecycle Redesign

**Phase boundary:** 4-step vendor onboarding wizard, 4th-party subprocessor tracking, org dependency interview, monitoring cadence config, assessment-driven score badge.

---

## 1. Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn/ui | `components.json` — FOUND |
| Style | new-york | `components.json` |
| Base color | neutral | `components.json` |
| CSS variables | yes | `components.json` |
| Font — sans | Inter (400, 500, 600, 700) | `src/index.css` |
| Font — mono | JetBrains Mono (400, 500) | `src/index.css` |
| Radius base | 0.5rem | `src/index.css` |
| Registry | shadcn official only | No third-party blocks declared |
| Registry safety gate | not applicable | No third-party registries |

---

## 2. Spacing

8-point scale applies throughout this phase.

| Token | px | Usage |
|-------|----|-------|
| 4px | 4 | Icon gap, tight inline spacing |
| 8px | 8 | Field label → input gap, badge padding |
| 12px | 12 | Card internal padding (compact) |
| 16px | 16 | Section gap, form field spacing |
| 24px | 24 | Card padding, wizard step content padding |
| 32px | 32 | Between major sections within a page |
| 48px | 48 | Wizard step top-padding when full page |
| 64px | 64 | Page top-padding for full-page wizard layout |

**Touch targets:** All interactive controls minimum 44px height on mobile (buttons, table row actions). Score badge is read-only — no touch target requirement.

---

## 3. Typography

Exactly 3 sizes, 2 weights.

| Role | Size | Weight | Line-height | Font | Usage |
|------|------|--------|-------------|------|-------|
| Body | 14px | 400 (regular) | 1.5 | Inter | Table cells, form labels, badge text, description copy |
| UI Label | 14px | 600 (semibold) | 1.4 | Inter | Form field labels, card section titles, table headers |
| Heading | 20px | 600 (semibold) | 1.2 | Inter | Wizard step title, page section heading (e.g., "Infrastructure Dependencies") |
| Page title | 28px (text-3xl) | 700 (bold) | 1.15 | Inter | Top-level page headings — matches existing `h1` in vendor-list.tsx |
| Mono | 12px | 500 (medium) | 1 | JetBrains Mono | Score badge ("78/100"), lifecycle badge text, step counter |

Note: page title (28px bold) is pre-existing — do not change. Heading (20px semibold) is new for wizard steps and settings subsections.

---

## 4. Color

Pre-populated from `src/index.css` — existing design system tokens.

### Surface Distribution (60/30/10)

| Role | Token | Value (light) | Coverage |
|------|-------|---------------|----------|
| 60% dominant | `--background` | `hsl(0 0% 100%)` — white | Page canvas, wizard full-page body |
| 30% secondary | `--card` / `--muted` | `hsl(0 0% 100%)` / `hsl(240 4.8% 95.9%)` | Cards, sidebar, settings sections, table headers (`bg-muted/50`) |
| 10% accent | `--primary` | `hsl(240 5.9% 10%)` — near-black | CTA buttons only (primary actions) |

### Semantic Colors

| Color | Token | Reserved For |
|-------|-------|-------------|
| Primary | `--primary` | "Start Onboarding" CTA, "Save" in settings, "Complete Step" wizard nav buttons |
| Destructive | `--destructive` | "Cancel Onboarding" confirm action only (discards incomplete vendor record) |
| Muted foreground | `--muted-foreground` | Placeholder copy, disabled states, empty state descriptions |

### Severity / Risk Score Color Scale

Reuse existing `TierBadge` color classes from `vendor-list.tsx`. Apply identically for score badge:

| Score range (risk) | Class | Color |
|-------------------|-------|-------|
| 75–100 (critical) | `bg-red-100 text-red-700 border-red-200` | Red |
| 50–74 (high) | `bg-amber-100 text-amber-700 border-amber-200` | Amber |
| 25–49 (medium) | `bg-yellow-100 text-yellow-700 border-yellow-200` | Yellow |
| 0–24 (low) | `bg-emerald-100 text-emerald-700 border-emerald-200` | Emerald |

Dark mode variants: append `dark:bg-{color}-900/30 dark:text-{color}-400` per existing `TierBadge` pattern.

### Concentration Risk Warning

Use `--severity-high` (amber) background for the concentration risk summary card in Settings > Organization when at least one concentration risk is detected. Use amber `Alert` variant — not destructive — because concentration risk is a warning, not an error.

### "In Onboarding" Vendor Stub Badge

Vendors in `identification` status that are in-progress wizard creates (incomplete data) get a secondary `Badge` with `bg-muted text-muted-foreground` labeled "In Progress". This distinguishes them from vendors that legitimately sit in Identification stage.

### Discovered-by Badge (Subprocessors Table)

| Value | Style |
|-------|-------|
| `manual` | `variant="outline"` — default |
| `llm` | `bg-primary/10 text-primary border-primary/20` — blue-tinted per lifecycle badge pattern |

---

## 5. Component Inventory

All components are already installed. No new installs required.

| Component | Source | Usage in Phase 11 |
|-----------|--------|-------------------|
| `Card`, `CardContent`, `CardHeader` | shadcn | Wizard step containers, kanban cards, settings section cards, concentration risk warning card |
| `Sheet`, `SheetContent`, `SheetHeader` | shadcn | "Add Subprocessor" side panel (link existing or create new) |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | shadcn | Vendor detail page — new "Subprocessors" tab alongside existing Questionnaires/Documents tabs |
| `Progress` | shadcn | Wizard step progress bar (top of each wizard step) |
| `Badge` | shadcn | Score badge, discovered_by badge, tier badge, lifecycle badge, "In Progress" stub badge |
| `Select`, `SelectContent`, `SelectItem` | shadcn | Org dependency category dropdowns, tier selector in wizard step 1, template selector in wizard step 2 |
| `Input` | shadcn | All text fields in wizard and settings forms; `type="file"` for document upload in wizard step 3 |
| `Textarea` | shadcn | Description field in wizard step 1 |
| `Table`, `TableBody`, `TableCell` | shadcn | Subprocessors table, monitoring cadence config table, org dependencies list |
| `AlertDialog` | shadcn | "Cancel Onboarding" confirmation; SPA navigation guard when wizard has unsaved step data |
| `Alert` | shadcn | Concentration risk warning in Settings > Organization |
| `Skeleton` | shadcn | Loading states for wizard step 4 AI enrichment polling, subprocessors table |
| `Collapsible` | shadcn | Subprocessors section wrapper on vendor detail (D-04: collapsible) |
| `Separator` | shadcn | Wizard step dividers, settings section separators |
| `Empty` | local (`@/components/ui/empty`) | Empty subprocessors table state, empty org dependencies state |

### Icons (lucide-react)

| Icon | Usage |
|------|-------|
| `ChevronRight` / `ChevronLeft` | Wizard step navigation buttons |
| `ChevronDown` / `ChevronUp` | Collapsible subprocessors section toggle |
| `Plus` | "Add Subprocessor" button, "Add Dependency" button |
| `Loader2` | Spinner during AI enrichment polling (animated) |
| `Sparkles` | AI enrichment step 4 header icon |
| `Upload` | Document upload step 3 button |
| `CheckCircle2` | Completed wizard step indicator in stepper |
| `AlertTriangle` | Concentration risk warning icon |
| `Building2` | Vendor avatar placeholder (existing pattern) |
| `ShieldAlert` | Score badge click — navigates to assessment results |

---

## 6. Layout Patterns

### 6.1 Vendor Onboarding Wizard — Full Page

Route: `/vendors/onboard/:id`

Layout: Full-page (not Sheet). Uses `AppLayout` wrapper. Wizard fills page body with a two-column layout:
- Left: 240px fixed progress sidebar (step list, vendor name, cancel link)
- Right: Scrollable step content area

**Wizard progress sidebar:**
- Vertical step list: step number circle + step label + status indicator
- Circle: completed = filled `bg-primary` with `CheckCircle2`; active = filled `bg-primary` with step number in white; upcoming = `bg-muted` with step number in `text-muted-foreground`
- Step labels: 14px semibold for active, 14px regular for others
- Cancel link at bottom: `text-destructive text-sm` — "Cancel Onboarding"

**Step content area:**
- Padding: 48px top, 32px horizontal
- Step title: 20px semibold
- Progress bar: `Progress` component, 4px height, at top of content area. Value = `(currentStep / 4) * 100`
- Step counter: `text-xs font-mono text-muted-foreground` — "Step 2 of 4"
- Navigation: "Back" (ghost button, left) + "Continue" or "Complete" (primary button, right) — flex row, justify-between, at bottom of each step

**Mobile:** Sidebar collapses to top progress stepper (horizontal, icon-only). Step content takes full width.

### 6.2 Step 1 — Identity + Tier

Single column form, max-w-lg centered in content area:
- `name` (required): full-width Input
- `description`: Textarea, 3 rows
- `category`: Input with placeholder "Cloud Hosting, Payment Processor..."
- `contactEmail`: Input type="email"
- `contactName`: Input
- `tier`: Select with 4 options — Critical, High, Medium, Low. Each option shows the TierBadge color inline as a 8px colored dot.

### 6.3 Step 2 — Questionnaire Assignment

- Heading: "Assign Assessment Template"
- Description: "Select a template to create an assessment for this vendor. You can complete it after onboarding." (14px regular, muted-foreground)
- Template picker: Scrollable card grid (2 columns, desktop). Each template card: name (semibold), description (muted, 2-line clamp), question count badge. Selected state: `border-primary ring-1 ring-primary`.
- "Skip for now" link below grid: `text-sm text-muted-foreground underline` — skips step 2 without assigning a template.

### 6.4 Step 3 — Document Upload

- Upload target: `Input type="file"` wrapped in a styled dropzone region (border-dashed border-2 border-muted-foreground/25, rounded-lg, p-8, text-center). Shows Upload icon + "Upload vendor documents" label.
- Accepted types: PDF, DOCX, TXT. Show accepted types below upload area in `text-xs text-muted-foreground`.
- After upload: list of uploaded files below the upload area. Each row: filename, `text-xs text-muted-foreground` size, remove button (X icon, ghost). File rows use `Table` component.
- LLM subprocessor suggestion panel: appears after at least one document is processed. Card with `Sparkles` icon header: "Suggested Subprocessors". Shows candidate name + relationship type rows with checkboxes. "Save Selected" button at bottom — saves only checked items.

### 6.5 Step 4 — AI Enrichment Review

- Auto-triggers on step mount. Shows `Loader2` spinner + "Analyzing vendor profile..." text while polling.
- After enrichment: displays editable cards per enrichment field:
  - Industry classification
  - Known risk indicators (if any)
  - Public breach history (if any)
  - Company description enrichment
- Each card: label (14px semibold) + editable `Textarea` or `Input` with enriched value. User edits inline.
- "Confirm & Complete Onboarding" primary button at bottom — saves confirmed values and transitions vendor out of wizard.

### 6.6 Vendor Kanban Card — Score Badge

Position: top-right of card `CardContent`. Uses new `ScoreBadge` component (per RESEARCH.md pattern):
- Format: "78/100"
- Font: `font-mono text-xs font-bold`
- Padding: `px-1.5 py-0.5`
- Border-radius: `rounded`
- Color: severity scale per Section 4
- Click: navigates to `GET /vendors/:id#assessments` tab (assessment results)
- If `riskScore` is null: render nothing (no badge)

### 6.7 Vendor Detail — Subprocessors Section

Location: New `Tabs` trigger "Subprocessors" added alongside existing tabs.

Tab content:
- `Collapsible` wrapper is not needed inside a tab — the tab IS the collapsible. Use `Collapsible` only if placed as a section outside tabs.
  Per D-04, it is a collapsible section on the vendor detail page. Place it BELOW the existing tabs area as a standalone collapsible section (not a tab).
- Collapsible header: "Subprocessors" label + `ChevronDown`/`ChevronUp` icon + vendor count badge ("3") — full-width, clickable, `p-4 border-t`
- Collapsed by default if count = 0; open by default if count > 0
- Expanded content: `Table` with columns: Vendor Name | Relationship Type | Criticality | Discovered By | Actions
- "Add Subprocessor" button in section header (right side, outline size="sm")
- Add sheet: two modes selected by a `Tabs` within the sheet — "Link Existing Vendor" (searchable select) and "Create New" (name + relationship + criticality fields)

### 6.8 Settings > Organization — Infrastructure Dependencies

Section within existing Settings page, new tab "Organization" (or appended to existing Org tab if present):

Layout:
- Concentration risk summary card at top (full width). If risks detected: amber `Alert` with `AlertTriangle` icon. Lists each concentrated vendor + affected categories + open signal count. If no risks: subtle `Card` with `CheckCircle2` icon + "No concentration risks detected." (text-muted-foreground)
- Below: dependencies table or category-by-category form. Use category-section approach: each category (Email Provider, Cloud Provider, CDN, Identity Provider, Payment Processor, Communication Tools) as a labeled row with a `Select` dropdown linking to existing vendors (or "None").
- Edit mode: inline editing via "Edit" button per row; or a single "Edit All" mode that enables all selects.
- "Save Dependencies" primary button at bottom when in edit mode.

### 6.9 Settings > Monitoring — Cadence Config

Admin-only section (check user role before rendering).

Layout:
- Heading: "Monitoring Cadence" (20px semibold)
- Description: "Define how frequently vendors are re-assessed based on tier." (14px regular, muted-foreground)
- Table: 4 rows (Critical, High, Medium, Low), 3 columns: Tier | Cadence (days) | Assessment Template
- Tier column: `TierBadge` component
- Cadence column: `Input type="number"` — editable inline, min=1, max=365, suffix "days"
- Template column: `Select` pulling from assessment templates list
- "Save" button at bottom right — calls upsert per tier
- Cadence presets hint (muted text below table): "Typical: Critical=7, High=30, Medium=90, Low=180"

---

## 7. Interaction States

### Wizard Step Navigation

| State | Behavior |
|-------|----------|
| Forward (Continue) | Validates current step fields. If invalid: show field-level error messages, do not advance. If valid: call PATCH API → on success → advance step |
| Back | No validation required. Navigate to previous step. No API call. |
| Cancel | Show `AlertDialog`: "Cancel onboarding? This will delete the incomplete vendor record." Confirm = DELETE vendor (identification + no children) + navigate to `/vendors`. Dismiss = stay in wizard. |
| SPA navigation away | If wizard has unsaved step data: show `AlertDialog` before allowing navigation (wouter `useLocation` approach per RESEARCH.md Pitfall 5). Browser close/reload: `beforeunload` event fires native dialog. |
| Step resume | On page load at `/vendors/onboard/:id`: fetch vendor → infer step from data completeness → render correct step. No "restart" option shown. |

### AI Enrichment Polling (Step 4)

| Phase | UI State |
|-------|----------|
| Enqueuing | Full-width skeleton of the enrichment cards with animated pulse |
| Polling | `Loader2` spinner (24px, `animate-spin`) centered, "Analyzing vendor profile..." text below in muted |
| Complete | Enrichment cards rendered with pre-filled values. All fields editable. |
| Error | `Alert` variant="destructive": "Enrichment failed. You can complete onboarding without it." with "Skip" link |

### Subprocessor Suggestion Review (Step 3)

| State | UI |
|-------|-----|
| No suggestions | Suggestion panel hidden entirely |
| Suggestions available | Panel appears below upload list. Each candidate row: unchecked by default. |
| User selects and saves | "Save Selected" triggers API. Panel collapses after save. Shows success `toast`. |
| Duplicate detected | API returns 409 — toast: "This vendor is already linked as a subprocessor." |

### Score Badge

| State | UI |
|-------|-----|
| `riskScore` is null | No badge rendered |
| `riskScore` is present | Badge rendered per severity color scale |
| Click | Navigate to `/vendors/:id` with hash `#assessment-results` |

### Concentration Risk Card

| State | UI |
|-------|-----|
| No risks | Small muted card: "No concentration risks detected." |
| 1+ risks | Amber `Alert` with vendor name, category list, open signal count per vendor |
| Loading | `Skeleton` (1 line, full width) |

---

## 8. Copywriting Contract

All copy is prescriptive. Do not deviate.

### Primary CTAs

| Context | Label |
|---------|-------|
| Vendor list → start wizard | "Add Vendor" (existing — keep) |
| Wizard step 1–3 advance | "Continue" |
| Wizard step 4 final | "Complete Onboarding" |
| Wizard back navigation | "Back" |
| Subprocessors sheet submit (link) | "Link Subprocessor" |
| Subprocessors sheet submit (create) | "Add Subprocessor" |
| Org dependencies save | "Save Dependencies" |
| Monitoring cadence save | "Save Cadence" |

### Empty States

| Context | Title | Description |
|---------|-------|-------------|
| No subprocessors | "No Subprocessors" | "Track fourth-party vendors that this vendor relies on." |
| No org dependencies configured | "No Dependencies Configured" | "Define your organization's critical infrastructure dependencies to detect concentration risk." |
| No assessment templates (wizard step 2 picker) | "No Templates Available" | "Create an assessment template in Settings before assigning one here." |
| No monitoring configs | "Monitoring Not Configured" | "Set cadence rules for each vendor tier to schedule automatic re-assessments." |

### Error States

| Context | Message |
|---------|---------|
| Wizard step 1 — name missing | "Vendor name is required." |
| Wizard step 1 — invalid email | "Enter a valid email address." |
| Wizard step 3 — upload failure | "Upload failed. Check file type (PDF, DOCX, TXT) and try again." |
| Wizard step 4 — enrichment error | "Enrichment failed. You can skip this step and complete onboarding." |
| Subprocessor — duplicate | "This vendor is already linked as a subprocessor." |
| Monitoring cadence — invalid days | "Enter a number between 1 and 365." |
| General API error (fallback) | "Something went wrong. Please try again." |

### Destructive Action Confirmations

| Action | Dialog Title | Dialog Body | Confirm Label | Cancel Label |
|--------|-------------|-------------|---------------|--------------|
| Cancel onboarding | "Cancel Onboarding?" | "This will permanently delete the incomplete vendor record. This cannot be undone." | "Delete Vendor" (destructive) | "Keep Editing" |
| Navigate away from dirty wizard | "Leave Onboarding?" | "Your progress on this step has not been saved. Go back and click Continue to save." | "Leave Anyway" | "Stay" |

---

## 9. Accessibility

- All form inputs have associated `Label` components with `htmlFor` matching input `id`.
- `AlertDialog` traps focus when open. Cancel action receives initial focus (safer default per WCAG 3.2.2).
- Score badge includes `aria-label="Risk score: 78 out of 100"` for screen readers.
- Wizard stepper: completed steps include `aria-label="Step {n}: {label} — completed"`. Active step: `aria-current="step"`.
- Collapsible subprocessors trigger includes `aria-expanded` state.
- Concentration risk `Alert` uses `role="alert"` for live region.
- Minimum contrast: all text meets WCAG AA (existing neutral palette satisfies this; severity colors amber/yellow on white must be tested — use `text-amber-700` not `text-amber-500`).

---

## 10. Registry Safety Gate

**Third-party registries declared:** None.

**Verdict:** Not applicable. All components sourced from shadcn official or local project files.

---

## 11. Pre-Population Sources

| Field Category | Source | Notes |
|----------------|--------|-------|
| Design system (shadcn, style, base) | `components.json` (codebase) | Direct file read |
| Font family (Inter, JetBrains Mono) | `src/index.css` (codebase) | Direct file read |
| Color tokens (all CSS vars) | `src/index.css` (codebase) | Direct file read |
| Severity color scale | `vendor-list.tsx` `TierBadge` (codebase) | Reused verbatim |
| Score badge format and colors | `vendor-list.tsx` existing score display + RESEARCH.md `ScoreBadge` example | Formalized |
| Wizard visual pattern | `llm-config-wizard.tsx` (codebase) | Extended to full-page layout |
| Collapsible subprocessors | CONTEXT.md D-04 | Locked decision |
| Wizard 4 steps | CONTEXT.md D-03 | Locked decision |
| Monitoring cadence table format | CONTEXT.md D-10 | Locked decision |
| Discovered-by badge values | CONTEXT.md D-04 (manual/LLM) | Locked decision |
| Concentration risk warning card | CONTEXT.md D-09 + specifics note | Locked decision |
| Cancel onboarding guard | RESEARCH.md Pitfall 1 | Implemented as described |
| SPA navigation guard | RESEARCH.md Pitfall 5 | `AlertDialog` approach specified |
| Score convention (100-overall) | RESEARCH.md Pitfall 2 + open question 3 | Amber/red = high risk value |
| File upload component | RESEARCH.md discretion pick | `Input type="file"` — no dropzone library |

---

*Phase: 11-vendor-lifecycle-redesign*
*UI-SPEC created: 2026-03-23*
*Status: draft — awaiting checker validation*
