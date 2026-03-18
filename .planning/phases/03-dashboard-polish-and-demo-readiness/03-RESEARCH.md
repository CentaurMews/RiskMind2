# Phase 3: Dashboard Polish and Demo Readiness - Research

**Researched:** 2026-03-18
**Domain:** React/TypeScript frontend polish — wiring existing components to live data, new API endpoints for KRI dashboard and semantic search
**Confidence:** HIGH (all findings verified directly against codebase source)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- KPI cards show counts + delta trend badges ("↑ 3 from last week") + subtle sparklines — not just raw numbers
- KPI cards must have skeleton loading states (currently show `0` while loading)
- Layout order top-to-bottom: KPIs → Heatmap + Executive Summary → KRIs → Alerts
- Mini heatmap on dashboard is clickable — clicking a cell navigates to heatmap page filtered to that cell
- Extract shared `<HeatmapGrid>` component from duplicated logic (dashboard + heatmap page)
- Executive Summary Panel: top 5 risks by score, overdue treatments count, upcoming review dates — "what needs attention"
- KRI Widget: traffic light horizontal bars — each KRI as a bar: green/amber/red based on threshold, with value label
- Alert Notification Center: bell icon with red badge count in header bar (top bar, not sidebar); click opens dropdown
- Empty States: use existing `<Empty>` component with `EmptyMedia variant="icon"` uniformly across ALL list pages
- Loading States: skeleton rows (3-5 rows of animated placeholders) for all tables; skeleton card placeholders for KPI cards
- Error Handling: destructive toast at bottom-right with error message, auto-dismiss 5 seconds; wire `toast({ variant: "destructive" })` into ALL mutation `onError` callbacks
- Vendor Scorecard: full scorecard per vendor — risk score badge, tier, last assessment date, open findings count, lifecycle stage — card-based layout or enhanced table rows
- Vendor Pipeline/Kanban: columns for each lifecycle stage; vendor cards with name, score, tier; read-only (no drag-and-drop); view toggle on vendor list page
- Command Palette (⌘K): uses existing shadcn/ui `<Command>` component; semantic search via pgvector; search across risks, vendors, frameworks, signals, findings; results grouped by category; selecting navigates to detail page; includes quick-action shortcuts
- RBAC UI: admin-only controls hidden from viewer/auditor; read-only for auditors; extend beyond Settings to create/edit buttons across risk, vendor, compliance pages
- Pagination: wire existing `<Pagination>` component to all list views; server-side; page size selector; add search to alert-list and finding-list
- Risk Sparklines: mini sparkline chart on risk cards/rows showing 30-day score trajectory; use existing `<Chart>` (Recharts wrapper)
- CSV Export: download icon button in risk list toolbar; exports current filtered view as CSV; client-side generation
- Visual Design: Apple-like vibes, minimalist, elegant, ergonomic — think Linear/Vercel; monochrome base with accent colors only for status/severity

### Claude's Discretion
- Exact card dimensions and grid breakpoints
- Skeleton row count and column width matching
- Toast positioning details
- KRI threshold values for demo data
- Sparkline data generation approach (real trend data vs synthetic)
- Command palette keyboard shortcut handling details
- Kanban column widths and card design
- Pagination page sizes (10/25/50)
- Filter component exact UI pattern per page

### Deferred Ideas (OUT OF SCOPE)
None — all discussed features are within Phase 3 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Dashboard KPI cards with proper visual hierarchy | KPI cards exist in dashboard.tsx lines 36-80; need skeleton, delta badges, sparklines; no API gap |
| DASH-02 | Risk heatmap with interactive drill-down | Heatmap exists; HeatmapGrid extraction needed; API `GET /v1/risks/heatmap` confirmed working |
| DASH-03 | Executive summary panel | Needs new component; data from existing `useListRisks`, `useListOverdueReviews` hooks |
| DASH-04 | KRI dashboard widget with traffic light | **API GAP: no tenant-wide KRI endpoint** — needs new `GET /v1/kris` endpoint; KRI schema confirmed with `warningThreshold`, `criticalThreshold`, `currentValue` |
| DASH-05 | Alert notification center with unread count badge | `useGetAlertSummary` exists (returns `active`, `bySeverity`); dropdown component needs building in header |
| UI-01 | Consistent card design and spacing across all pages | Pure frontend — audit and normalize existing cards |
| UI-02 | Empty states with CTA on all list views | `<Empty>` component confirmed in `empty.tsx`; currently unused in pages; replace all inline "No X found" text |
| UI-03 | Skeleton loading states on all data-fetching pages | `<Skeleton>` component confirmed; currently all pages use `<Loader2>` spinner — wholesale replacement |
| UI-04 | Toast error notifications | `useToast()` and `toast()` confirmed in `use-toast.ts`; `<Toaster>` confirmed mounted in `App.tsx`; zero calls in any page — wire to all `onError` |
| UI-05 | Consistent navigation — breadcrumbs, page titles | Pure frontend — audit app-layout.tsx header and add breadcrumbs to detail pages |
| UI-06 | RBAC UI enforcement | `user.role` from `useGetMe()` (returns `UserProfile`); role values: `admin`, `risk_manager`, `risk_owner`, `risk_executive`, `auditor`, `viewer`; currently only Settings nav is gated (line 79 app-layout.tsx) |
| UI-07 | Pagination, search, filter on all list views | All list APIs confirmed support `page`/`limit` params; `<Pagination>` component confirmed; not wired on any page |
| UI-08 | Risk sparklines (30-day score trajectory) | **API GAP: no risk score history endpoint** — `createdAt`/`updatedAt` exist but no `score_history` table; must use synthetic data or derive from audit events |
| UI-09 | Command palette ⌘K with semantic search | **API GAP: no `/v1/search` endpoint** — embedding columns confirmed on risks, vendors, signals, framework_requirements tables; pgvector `<=>` operator in use (agent-service.ts); new search endpoint needed; existing `<Command>` component confirmed |
| VEND-01 | Vendor scorecard summary | `useListVendors` returns `riskScore`, `tier`, `status`, `createdAt`; `useListFindings` has `vendorId` param for open findings count |
| VEND-02 | Vendor lifecycle pipeline/kanban view | `GET /v1/vendors?status=<stage>` confirmed; 7 stages: `identification`, `due_diligence`, `risk_assessment`, `contracting`, `onboarding`, `monitoring`, `offboarding`; view toggle needed on vendor-list.tsx |
| COMP-01 | Compliance posture percentage per framework | `GET /v1/frameworks/:id/compliance-score` confirmed; returns `score`, `frameworkName`, `coverageScore`, `effectivenessScore`; `useGetComplianceScore` hook exists; currently uses hardcoded `fw-default` in dashboard |
| EXP-01 | CSV export for risk register data | Client-side generation from `data?.data` array; no API change needed; button in risk-list toolbar |
</phase_requirements>

---

## Summary

Phase 3 is almost entirely a **frontend wiring** phase. All required UI components exist in the codebase already installed (`<Empty>`, `<Skeleton>`, `<Pagination>`, `<Command>`, `<Chart>`, `useToast()`). The work is systematically replacing placeholder patterns across pages and adding new dashboard widgets.

There are **three confirmed API gaps** that require new backend endpoints before the frontend can consume them:
1. **Tenant-wide KRI endpoint** (`GET /v1/kris`) — KRIs are currently scoped per-risk; the dashboard widget needs all KRIs across the tenant ordered by breach status.
2. **Semantic search endpoint** (`POST /v1/search`) — pgvector embeddings exist on risks/vendors/signals/framework_requirements; the `<=>` operator is already used in agent-service.ts; a search route needs to be exposed.
3. **Risk score history** — No `score_history` table exists; sparklines must use synthetic data (30 random points trending toward current score) or derive from audit events. Synthetic approach is fastest for demo.

The RBAC pattern is clear: `useGetMe()` returns `UserProfile` with `role: UserProfileRole` (one of 7 values). Currently only the Settings nav item gates on `user.role === "admin"`. All create/edit buttons need the same pattern with role checks for `admin` and `risk_manager`.

**Primary recommendation:** Build the 3 API gaps first (KRI list, search, note sparkline data approach), then wire all frontend gaps systematically across pages.

---

## Standard Stack

### Core (Already Installed — No New Dependencies)

| Library | Version | Purpose | Confirmed Location |
|---------|---------|---------|---------------------|
| `@workspace/api-client-react` | workspace | TanStack Query hooks for all API calls | `lib/api-client-react/src/generated/api.ts` |
| `recharts` | installed | Chart rendering for sparklines and KRI bars | `artifacts/riskmind-app/src/components/ui/chart.tsx` |
| `@tanstack/react-query` | installed | Server state management | All pages use via api-client-react |
| `shadcn/ui` | 56 components | All UI primitives | `artifacts/riskmind-app/src/components/ui/` |
| `tailwindcss` | installed | Styling | Throughout |
| `wouter` | installed | Client-side routing for command palette navigation | `App.tsx` |
| `lucide-react` | installed | Icons for empty states and command palette | All pages |
| `date-fns` | installed | Date formatting for overdue reviews, assessment dates | dashboard.tsx |

### New API Endpoints Required

| Endpoint | Method | Purpose | Implementation Basis |
|----------|--------|---------|---------------------|
| `GET /v1/kris` | GET | All KRIs for tenant with breach status | Extend risks.ts; query `krisTable WHERE tenantId = ?` |
| `POST /v1/search` | POST | Semantic search via pgvector | Adapt pattern from agent-service.ts lines 397-440 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Synthetic sparkline data | Real audit event history | Synthetic is faster for demo; real requires new DB queries and schema additions |
| `useGetAlertSummary` for badge | `useListAlerts({ status: "active" })` | Summary endpoint is lighter (returns count only); preferred |
| Client-side CSV | Server-side CSV endpoint | Client-side from loaded data is instant and requires no backend work |

---

## Architecture Patterns

### Recommended Project Structure Additions

```
artifacts/riskmind-app/src/
├── components/
│   ├── dashboard/           # NEW — extracted dashboard widgets
│   │   ├── heatmap-grid.tsx         # extracted from dashboard.tsx + risk-heatmap.tsx
│   │   ├── kpi-card.tsx             # card with skeleton + sparkline + delta badge
│   │   ├── kri-widget.tsx           # traffic light bars
│   │   ├── executive-summary.tsx    # top 5 risks, overdue count, upcoming reviews
│   │   └── alert-bell.tsx           # header bell with dropdown
│   ├── command-palette/     # NEW
│   │   └── command-palette.tsx      # ⌘K modal using shadcn Command
│   └── ui/                  # existing — no changes
artifacts/api-server/src/routes/
├── risks.ts                 # ADD: GET /v1/kris tenant-wide endpoint
└── search.ts                # NEW: POST /v1/search semantic search
```

### Pattern 1: Skeleton Table Row Replacement

Every table loading state currently uses `<Loader2>` in a single `<TableRow>`. Replace with:

```typescript
// Source: shadcn/ui Skeleton component (artifacts/riskmind-app/src/components/ui/skeleton.tsx)
{isLoading ? (
  Array.from({ length: 5 }).map((_, i) => (
    <TableRow key={i}>
      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
      <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
      <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
      <TableCell />
    </TableRow>
  ))
) : ...}
```

Pages to convert: `risk-list.tsx`, `alert-list.tsx`, `vendor-list.tsx`, `signal-list.tsx`, `finding-list.tsx`

### Pattern 2: Empty State Replacement

Current inline pattern (appears in all list pages):
```tsx
<TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
  No risks found matching criteria.
</TableCell>
```

Replace with (using existing `<Empty>` component):
```typescript
// Source: artifacts/riskmind-app/src/components/ui/empty.tsx
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia, EmptyContent } from "@/components/ui/empty";
import { ShieldAlert } from "lucide-react";

<TableCell colSpan={7}>
  <Empty className="border-0">
    <EmptyMedia variant="icon">
      <ShieldAlert />
    </EmptyMedia>
    <EmptyHeader>
      <EmptyTitle>No risks found</EmptyTitle>
      <EmptyDescription>Adjust your filters or create your first risk.</EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button size="sm"><Plus className="h-4 w-4 mr-2" />Create Risk</Button>
    </EmptyContent>
  </Empty>
</TableCell>
```

### Pattern 3: Toast Error Wiring

Current mutations have no `onError` handler. The standard pattern:

```typescript
// Source: artifacts/riskmind-app/src/hooks/use-toast.ts
// toast() is importable directly — no hook needed for imperative usage
import { toast } from "@/hooks/use-toast";

const createMutation = useCreateRisk({
  mutation: {
    onSuccess: () => { /* existing */ },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to create risk",
        description: error?.message || "An unexpected error occurred.",
      });
    },
  },
});
```

Apply to ALL mutations: `useCreateRisk`, `useCreateVendor`, `useAcknowledgeAlert`, `useResolveAlert`, `useCreateControl`, `useCreateTreatment`, `useVendorTransition`, and any others found in pages.

### Pattern 4: Pagination Wiring

All list APIs support `page` and `limit` query params (confirmed in risks.ts, vendors.ts, alerts.ts, signals.ts, findings route). Response shape is `{ data, total, page, limit }`.

```typescript
// Source: artifacts/riskmind-app/src/components/ui/pagination.tsx
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";

const [page, setPage] = useState(1);
const PAGE_SIZE = 20;

const { data } = useListRisks({ page, limit: PAGE_SIZE, ...filters });
const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

// Render below table:
<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} aria-disabled={page === 1} />
    </PaginationItem>
    {/* page number items */}
    <PaginationItem>
      <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} aria-disabled={page === totalPages} />
    </PaginationItem>
  </PaginationContent>
</Pagination>
```

### Pattern 5: RBAC Role-Gated UI

```typescript
// Source: artifacts/riskmind-app/src/components/layout/app-layout.tsx (line 79 — existing pattern)
// useGetMe() returns UserProfile with role: UserProfileRole
const { data: user } = useGetMe({ query: { queryKey: ["/api/v1/auth/me"] } });

const canEdit = user?.role === "admin" || user?.role === "risk_manager";
const isAuditor = user?.role === "auditor";
const isViewer = user?.role === "viewer";

// Usage:
{canEdit && (
  <Button onClick={openCreateSheet}>
    <Plus className="h-4 w-4 mr-2" />Create Risk
  </Button>
)}
{canEdit && (
  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(...)}>
    <Trash2 className="h-4 w-4" />
  </Button>
)}
```

**Note:** `useGetMe` is already called in `AppLayout` — the user context could be lifted to a React context or just re-called with the same query key (TanStack Query deduplicates). The simplest approach is calling `useGetMe()` in each page component with the same query key.

### Pattern 6: Sparklines (Synthetic Data Approach)

No score history table exists. Use synthetic data derived from the current risk score:

```typescript
// Synthetic 30-day trajectory ending at current score
function generateSparklineData(currentScore: number): { day: number; score: number }[] {
  const start = Math.max(0, currentScore + Math.random() * 10 - 5); // slight variance
  return Array.from({ length: 12 }, (_, i) => ({
    day: i,
    score: Math.round(start + ((currentScore - start) * i / 11) + (Math.random() * 4 - 2)),
  }));
}
```

Rendered with Recharts `<LineChart>` inside the existing `<ChartContainer>` from `chart.tsx`:

```typescript
import { ChartContainer, ChartConfig } from "@/components/ui/chart";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const sparkConfig: ChartConfig = { score: { color: "hsl(var(--primary))" } };

<ChartContainer config={sparkConfig} className="h-8 w-20">
  <LineChart data={sparklineData}>
    <Line type="monotone" dataKey="score" dot={false} strokeWidth={1.5} />
  </LineChart>
</ChartContainer>
```

### Pattern 7: Command Palette

The existing `<Command>` component is the full shadcn/ui implementation. The pattern:

```typescript
// Source: artifacts/riskmind-app/src/components/ui/command.tsx
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";

// Global keyboard listener in a wrapper component:
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen(prev => !prev);
    }
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, []);

// With debounced search → POST /v1/search { query, types: ["risk", "vendor", "signal", "framework", "finding"] }
```

The component must be mounted in `App.tsx` or `AppLayout` (above all pages). Results grouped by entity type, navigate via `useLocation` (wouter).

### Pattern 8: KRI Dashboard Widget

KRIs are stored per-risk (`GET /v1/risks/:riskId/kris`). The dashboard needs ALL KRIs for the tenant. A new endpoint is required:

**New endpoint:** `GET /v1/kris` in `risks.ts` (or new `kris.ts` route):
```typescript
router.get("/v1/kris", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { limit = "10" } = req.query;
  const kris = await db
    .select({ ...krisTable, riskTitle: risksTable.title })
    .from(krisTable)
    .leftJoin(risksTable, eq(krisTable.riskId, risksTable.id))
    .where(eq(krisTable.tenantId, tenantId))
    .limit(Number(limit))
    .orderBy(krisTable.updatedAt);
  res.json({ data: kris });
});
```

**Traffic light logic** (derived from schema fields):
- `currentValue >= criticalThreshold` → red
- `currentValue >= warningThreshold` → amber
- otherwise → green

### Pattern 9: Semantic Search Endpoint

pgvector embeddings confirmed on: `risksTable.embedding`, `vendorsTable.embedding`, `signalsTable.embedding`, `frameworkRequirementsTable.embedding` (all 1536-dimension).

The `<=>` cosine distance operator is already in use in `agent-service.ts` lines 206-240. The search endpoint pattern:

```typescript
// POST /v1/search — new route
router.post("/v1/search", async (req, res) => {
  const { query, types = ["risk", "vendor", "signal", "framework"] } = req.body;
  const tenantId = req.user!.tenantId;

  // 1. Generate embedding for query text using llm-service.ts embed()
  const embedding = await embed(tenantId, query);
  const vectorStr = `[${embedding.join(",")}]`;
  const THRESHOLD = 0.5;
  const LIMIT = 5;

  // 2. Per-type similarity queries (parallel Promise.all)
  // Uses same pattern as agent-service.ts line 178:
  // sql`1 - (embedding <=> ${vectorStr}::vector) as similarity`

  // 3. Return grouped results
  res.json({ results: { risks: [...], vendors: [...], signals: [...], frameworks: [...] } });
});
```

**Important:** The `embed()` function is in `lib/llm-service.ts` (lines ~191-212). It requires an LLM provider configured for the tenant with `useCase: "embeddings"`. If no embeddings provider is configured, fall back to keyword search (ilike) to avoid errors.

### Pattern 10: Vendor Kanban (Read-Only)

The vendor list API supports `GET /v1/vendors?status=<stage>`. For the kanban, fetch all vendors (no status filter) and group client-side:

```typescript
const { data } = useListVendors({ limit: "200" }); // get all for kanban
const STAGES = ["identification", "due_diligence", "risk_assessment", "contracting", "onboarding", "monitoring", "offboarding"];
const columns = STAGES.map(stage => ({
  stage,
  vendors: data?.data?.filter(v => v.status === stage) || [],
}));
```

View toggle state: `"table" | "kanban"` in local state; tab or button group in toolbar.

### Anti-Patterns to Avoid

- **Re-implementing pagination math elsewhere:** Always derive `totalPages = Math.ceil(total / pageSize)`; reset `page` to 1 when filters change.
- **Calling `useGetMe()` without a stable query key:** Always pass `{ query: { queryKey: ["/api/v1/auth/me"] } }` to ensure TanStack Query deduplicates and returns cached result.
- **Mounting `<CommandPalette>` inside a page:** It must be in `AppLayout` or `App.tsx` to work globally across all routes.
- **Using `toast()` inside render:** Only call in event handlers and mutation callbacks.
- **Fetching all vendors with default limit for kanban:** Default limit is `"20"` — the kanban must pass `limit: "200"` or paginate per-column.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated skeleton placeholders | Custom CSS pulse animation | `<Skeleton>` from shadcn/ui | Already installed, animate-pulse, composable |
| Command palette modal | Custom modal + input | `<CommandDialog>` from shadcn/ui | Full keyboard navigation, grouping, search built-in |
| Charts/sparklines | Raw SVG path calculation | Recharts via `<ChartContainer>` | Complex math, edge cases, animation handled |
| Toast notification queue | Custom notification state | `toast()` from `use-toast.ts` + `<Toaster>` | Queue management, auto-dismiss, variant styles done |
| Pagination component | Custom prev/next buttons | `<Pagination>` from shadcn/ui | Ellipsis, aria labels, active state built-in |
| CSV serialization | Manual string concatenation | `data.map(row => values.join(",")).join("\n")` + Blob | Simple enough to inline; don't add papaparse |
| Vendor kanban board | React DnD | Plain CSS grid + no drag | Decision: read-only — no interaction needed |

**Key insight:** Every UI primitive in this phase is already installed. The work is wiring, not building. Any time spent on a custom component for something that already exists is wasted.

---

## Common Pitfalls

### Pitfall 1: KRI Dashboard Widget Has No Tenant-Wide Endpoint
**What goes wrong:** Developer tries `useListKRIs({ riskId: "all" })` or similar — no such API exists. KRIs are per-risk.
**Why it happens:** KRI schema has `riskId` FK; API routes are `/v1/risks/:riskId/kris`.
**How to avoid:** Build `GET /v1/kris` tenant-wide endpoint first (Wave 0 backend task). The API client must be regenerated OR the component calls via `customFetch` directly until regeneration.
**Warning signs:** `useListKRIs` requires a `riskId` parameter — if you see it being called without one, the endpoint is wrong.

### Pitfall 2: Semantic Search Fails Silently When No Embedding Provider Configured
**What goes wrong:** `POST /v1/search` returns 503 or empty results when LLM provider for embeddings isn't configured. Command palette appears broken.
**Why it happens:** `embed()` in `llm-service.ts` throws `LLMUnavailableError` when no provider is configured.
**How to avoid:** Wrap search endpoint in try/catch; fall back to `ilike` keyword search across title fields if `LLMUnavailableError` is thrown.
**Warning signs:** Empty command palette results even with seed data loaded.

### Pitfall 3: Vendor Kanban Renders Empty Due to Default Limit
**What goes wrong:** Kanban shows some stages empty because `useListVendors()` defaults to `limit: "20"` and doesn't filter by stage.
**Why it happens:** Default API limit is 20; kanban fetches all vendors to group client-side.
**How to avoid:** Always pass `limit: "200"` (or a high number) when fetching for kanban grouping.

### Pitfall 4: Pagination Page Number Doesn't Reset on Filter Change
**What goes wrong:** User is on page 3, changes a filter, still shows page 3 of filtered results (which may not exist — showing empty state).
**Why it happens:** `page` state is independent of filter state.
**How to avoid:** Reset `setPage(1)` in every filter change handler (search input change, status checkbox change, etc.).

### Pitfall 5: RBAC Check Flickers on Initial Load
**What goes wrong:** Create/Edit buttons flash visible briefly before `useGetMe()` resolves, then disappear. Visible to viewers.
**Why it happens:** `user` is undefined while query is loading; component renders before the role is known.
**How to avoid:** Default to hiding admin buttons: `const canEdit = user?.role === "admin" || user?.role === "risk_manager"` — falsy while loading means buttons are hidden by default.

### Pitfall 6: useGetMe Called With Different Query Keys
**What goes wrong:** Multiple `useGetMe()` calls with different (or missing) `queryKey` cause redundant network requests.
**Why it happens:** TanStack Query deduplicates by key; inconsistent keys = separate requests.
**How to avoid:** Always use `{ query: { queryKey: ["/api/v1/auth/me"] } }` — this is the pattern in `app-layout.tsx`.

### Pitfall 7: HeatmapGrid Dashboard Link Does Not Filter Heatmap Page
**What goes wrong:** Clicking a heatmap cell on the dashboard navigates to `/risks/heatmap` but doesn't highlight/filter to that cell.
**Why it happens:** The full heatmap page uses local state for the selected cell; no query param reading.
**How to avoid:** Pass cell coordinates as query params: `/risks/heatmap?l=3&i=4`. Read `new URLSearchParams(window.location.search)` in heatmap page `useEffect` to initialize `selectedCell` state.

---

## Code Examples

### Alert Bell with Badge in Header

```typescript
// Source: artifacts/riskmind-app/src/components/layout/app-layout.tsx (extend header section)
// useGetAlertSummary returns { active, acknowledged, escalated, bySeverity }
import { useGetAlertSummary } from "@workspace/api-client-react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const { data: alertSummary } = useGetAlertSummary();
const activeCount = alertSummary?.active ?? 0;

<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="h-4 w-4" />
      {activeCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
          {activeCount > 9 ? "9+" : activeCount}
        </span>
      )}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-80 p-0" align="end">
    {/* recent alerts list */}
  </PopoverContent>
</Popover>
```

### CSV Export Button

```typescript
// Source: client-side — no API needed
// Place in risk-list.tsx toolbar alongside Filter button
import { Download } from "lucide-react";

const handleExportCSV = () => {
  const headers = ["ID", "Title", "Category", "Severity", "Status", "Likelihood", "Impact", "Created"];
  const rows = risks.map(r => [
    r.id?.split('-')[0],
    `"${r.title?.replace(/"/g, '""')}"`,
    r.category,
    computeSeverity(r.likelihood, r.impact),
    r.status,
    r.likelihood,
    r.impact,
    format(new Date(r.createdAt || ''), 'yyyy-MM-dd'),
  ].join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `risks-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

<Button variant="outline" size="sm" onClick={handleExportCSV}>
  <Download className="h-4 w-4 mr-2" />
  Export
</Button>
```

### KRI Traffic Light Bar

```typescript
// Source: No existing component — new KriBar
function KriBar({ kri }: { kri: Kri }) {
  const current = Number(kri.currentValue ?? 0);
  const warning = Number(kri.warningThreshold ?? Infinity);
  const critical = Number(kri.criticalThreshold ?? Infinity);
  const status = current >= critical ? "critical" : current >= warning ? "warning" : "ok";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0",
        status === "critical" ? "bg-red-500" : status === "warning" ? "bg-amber-500" : "bg-emerald-500"
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium truncate">{kri.name}</span>
          <span className="text-muted-foreground font-mono">{current}{kri.unit ? ` ${kri.unit}` : ""}</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all",
            status === "critical" ? "bg-red-500" : status === "warning" ? "bg-amber-500" : "bg-emerald-500"
          )} style={{ width: `${Math.min(100, (current / (critical || 100)) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
```

### Compliance Posture (COMP-01)

The existing `useGetComplianceScore` hook works but is hardcoded to `"fw-default"` in dashboard.tsx. For the compliance page it should fetch per-framework. The hook signature:

```typescript
// Source: lib/api-client-react/src/generated/api.ts line 4864
useGetComplianceScore(frameworkId: string, options?)
// Returns: { frameworkId, frameworkName, score, coverageScore, effectivenessScore, totalRequirements, coveredRequirements }
```

For COMP-01, the compliance page already shows frameworks. Add a score column/badge to each framework row using `useGetComplianceScore` per framework (or an aggregated endpoint if the list is long — 3-5 frameworks in demo data is fine for parallel queries).

---

## API Gap Summary (Critical for Planning)

| Gap | Severity | Solution | Estimated Effort |
|-----|----------|----------|-----------------|
| `GET /v1/kris` tenant-wide | BLOCKING for DASH-04 | Add route in risks.ts, join with risks for title | ~30 min |
| `POST /v1/search` semantic | BLOCKING for UI-09 | New route, use embed() + pgvector, fallback to ilike | ~90 min |
| Risk score history for sparklines | Workaround available | Synthetic data generation client-side | ~15 min |

The generated API client (`lib/api-client-react/src/generated/api.ts`) will NOT have hooks for new endpoints until regenerated. Options:
1. Use `customFetch` directly from `lib/api-client-react/src/custom-fetch.ts` until regeneration
2. Regenerate client from OpenAPI spec after adding routes (preferred if spec is maintained)

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single `<Loader2>` spinner in table | Skeleton rows per column | Better perceived performance, layout doesn't shift |
| Inline "No X found" text in table cell | `<Empty>` with icon + CTA | Actionable, visually distinct, consistent |
| No error feedback on mutations | Destructive toast `onError` | User knows what went wrong, can retry |
| No pagination (loads all) | Server-side pagination with `page`/`limit` | Required for production — APIs already support it |
| Bell icon with no badge | Bell + `useGetAlertSummary` badge | Visible count in header eliminates need to navigate |

---

## Open Questions

1. **API client regeneration cadence**
   - What we know: API client is generated from OpenAPI spec in `lib/api-spec/`
   - What's unclear: Is there a `pnpm run generate` or similar task to regenerate after adding new endpoints? The planner should verify before planning backend+frontend tasks together.
   - Recommendation: Check `lib/api-spec/` and package.json scripts. If regeneration is fast, do it after adding new routes; otherwise use `customFetch` directly for new endpoints.

2. **Compliance posture per framework vs. single score on dashboard**
   - What we know: `useGetComplianceScore` takes a frameworkId; dashboard hardcodes `"fw-default"`
   - What's unclear: Should COMP-01 show a per-framework scorecard on the compliance page, or improve the dashboard card to show per-framework?
   - Recommendation: Show per-framework badges on the `/compliance` page (list of frameworks with score column); keep dashboard card as aggregate of first/default framework. This satisfies COMP-01 without dashboard redesign.

3. **Delta badges on KPI cards ("↑ 3 from last week")**
   - What we know: No time-series or snapshot data exists; current API returns live counts
   - What's unclear: How to compute "from last week" — requires a historical baseline
   - Recommendation: Use synthetic/hardcoded delta values in demo data (e.g., seed a `lastWeekCounts` constant in dashboard.tsx). The UI requirement is visual; the data need not be dynamic for demo.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, or test files in codebase |
| Config file | None — Wave 0 must create |
| Quick run command | `pnpm --filter riskmind-app test --run` (after vitest setup) |
| Full suite command | `pnpm --filter riskmind-app test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | KPI cards render with skeleton when loading | unit | `vitest run tests/dashboard.test.tsx` | ❌ Wave 0 |
| DASH-02 | Heatmap cell click navigates to filtered heatmap | unit | `vitest run tests/heatmap-grid.test.tsx` | ❌ Wave 0 |
| DASH-03 | Executive summary shows top 5 risks | unit | `vitest run tests/executive-summary.test.tsx` | ❌ Wave 0 |
| DASH-04 | KRI widget shows traffic light status | unit | `vitest run tests/kri-widget.test.tsx` | ❌ Wave 0 |
| DASH-05 | Alert bell badge shows active count | unit | `vitest run tests/alert-bell.test.tsx` | ❌ Wave 0 |
| UI-02 | Empty component renders when data is empty | unit | `vitest run tests/empty-states.test.tsx` | ❌ Wave 0 |
| UI-04 | Toast fires on mutation error | unit | `vitest run tests/toast-errors.test.tsx` | ❌ Wave 0 |
| UI-06 | Create buttons hidden for viewer role | unit | `vitest run tests/rbac-ui.test.tsx` | ❌ Wave 0 |
| UI-07 | Pagination renders correct page count | unit | `vitest run tests/pagination.test.tsx` | ❌ Wave 0 |
| UI-09 | Command palette opens on ⌘K | unit | `vitest run tests/command-palette.test.tsx` | ❌ Wave 0 |
| VEND-02 | Vendor kanban groups by lifecycle stage | unit | `vitest run tests/vendor-kanban.test.tsx` | ❌ Wave 0 |
| EXP-01 | CSV export downloads with correct headers | unit | `vitest run tests/csv-export.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter riskmind-app test --run` (after Wave 0 framework setup)
- **Per wave merge:** `pnpm --filter riskmind-app test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `artifacts/riskmind-app/vitest.config.ts` — vitest + jsdom setup for React component tests
- [ ] `artifacts/riskmind-app/src/tests/setup.ts` — testing-library setup file
- [ ] Framework install: `pnpm --filter riskmind-app add -D vitest @testing-library/react @testing-library/user-event @vitejs/plugin-react jsdom`
- [ ] Individual test files listed in table above

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `artifacts/riskmind-app/src/pages/dashboard.tsx` — current KPI cards, alerts, mini heatmap (lines 1-163)
- `artifacts/riskmind-app/src/components/layout/app-layout.tsx` — header structure, RBAC gate, nav items
- `artifacts/api-server/src/routes/risks.ts` — pagination params, KRI sub-routes confirmed
- `artifacts/api-server/src/routes/vendors.ts` — status filter, pagination confirmed
- `artifacts/api-server/src/routes/alerts.ts` — `GET /v1/alerts/summary` endpoint confirmed
- `artifacts/api-server/src/routes/compliance.ts` — `GET /v1/frameworks/:id/compliance-score` confirmed
- `lib/api-client-react/src/generated/api.ts` — `useGetAlertSummary`, `useListKRIs`, `useGetComplianceScore`, `useListOverdueReviews` hooks confirmed
- `lib/api-client-react/src/generated/api.schemas.ts` — `AlertSummary`, `Kri`, `UserProfile`, `UserProfileRole` types confirmed
- `lib/db/src/schema/kris.ts` — KRI fields: `name`, `warningThreshold`, `criticalThreshold`, `currentValue`, `unit`
- `lib/db/src/schema/risks.ts` — `embedding: vector("embedding", { dimensions: 1536 })`
- `lib/db/src/schema/vendors.ts` — `embedding` column confirmed
- `artifacts/api-server/src/lib/agent-service.ts` — pgvector `<=>` operator pattern (lines 206-240, 397-440)
- `artifacts/api-server/src/lib/llm-service.ts` — `embed()` function, `LLMUnavailableError`
- `artifacts/riskmind-app/src/components/ui/empty.tsx` — `Empty`, `EmptyHeader`, `EmptyMedia`, etc. confirmed
- `artifacts/riskmind-app/src/components/ui/skeleton.tsx` — animate-pulse confirmed
- `artifacts/riskmind-app/src/components/ui/pagination.tsx` — full Pagination component set confirmed
- `artifacts/riskmind-app/src/components/ui/chart.tsx` — `ChartContainer`, Recharts wrapper confirmed
- `artifacts/riskmind-app/src/hooks/use-toast.ts` — `useToast()`, `toast()` exports confirmed
- `artifacts/riskmind-app/src/App.tsx` — `<Toaster>` mounted at root confirmed
- `artifacts/riskmind-app/src/pages/risks/risk-list.tsx` — no pagination, Loader2 spinner, inline empty text confirmed

### Secondary (MEDIUM confidence)

None required — all findings are direct code inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components verified in filesystem
- API gaps: HIGH — verified by absence in route files and generated client
- Architecture patterns: HIGH — verified against existing patterns in codebase
- Pitfalls: HIGH — derived from direct code inspection of current state

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (30 days — stable frontend tech)
