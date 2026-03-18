# Phase 3: Dashboard Polish and Demo Readiness - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the dashboard and all list views professional and demo-ready. Consistent card design, skeleton loading states, empty states with CTAs, toast error notifications, RBAC UI enforcement, vendor scorecard + kanban pipeline, compliance posture %, KRI widget, alert badge, risk sparklines, CSV export, and a ⌘K command palette with semantic search. The UI should feel like a clean enterprise tool with Apple-like vibes — minimalist, elegant, ergonomic.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Layout
- KPI cards show counts + delta trend badges ("↑ 3 from last week") + subtle sparklines — not just raw numbers
- KPI cards must have skeleton loading states (currently show `0` while loading)
- Layout order top-to-bottom: KPIs → Heatmap + Executive Summary → KRIs → Alerts
- Mini heatmap on dashboard is clickable — clicking a cell navigates to the heatmap page filtered to that cell
- Extract shared `<HeatmapGrid>` component from duplicated logic (dashboard + heatmap page)

### Executive Summary Panel
- Risk posture summary: top 5 risks by score, overdue treatments count, upcoming review dates
- A "what needs attention" quick-reference view
- Lives in the dashboard between heatmap and KRI widget

### KRI Widget
- Traffic light horizontal bars — each KRI as a bar: green/amber/red based on threshold, with value label
- Shows top KRIs with threshold status

### Alert Notification Center
- Bell icon with red badge count in the header bar (top bar, not sidebar)
- Click opens a dropdown with recent alerts
- Separate from the Alerts page in sidebar nav

### Empty States
- Use the existing `<Empty>` component (with `EmptyMedia variant="icon"`) uniformly across ALL list pages
- Pattern: relevant lucide icon + descriptive title ("No risks found") + CTA button ("Create your first risk")
- Replace all current inline "No X found" text in table rows

### Loading States
- Skeleton rows (3-5 rows of animated placeholders matching table column layout) for all tables
- Use existing `<Skeleton>` component from shadcn/ui
- Replace current single `<Loader2>` spinners in table rows
- KPI cards on dashboard get skeleton card placeholders while data loads

### Error Handling
- Destructive toast (red) at bottom-right with error message, auto-dismiss after 5 seconds
- Wire `toast({ variant: "destructive" })` into `onError` callbacks of ALL mutations across the app
- Use existing `useToast()` hook and `<Toaster>` (already mounted in App.tsx)

### Vendor Scorecard
- Full scorecard per vendor: risk score badge (colored by severity), tier (critical/high/medium/low), last assessment date, open findings count, lifecycle stage
- Shown in the vendor list view as card-based layout or enhanced table rows

### Vendor Pipeline / Kanban
- Kanban board with columns for each lifecycle stage: identification → due_diligence → risk_assessment → contracting → onboarding → monitoring → offboarding
- Vendor cards in each column showing name, score, tier
- No drag-and-drop required — read-only visualization for demo
- Accessible as a view toggle on the vendor list page (table view / pipeline view)

### Command Palette (⌘K)
- Global command palette triggered by ⌘K (Cmd+K on Mac, Ctrl+K on Windows)
- Uses existing shadcn/ui `<Command>` component (already installed in the codebase)
- Semantic search via pgvector — "supply chain exposure" finds related risks even without exact keyword match
- Search across: risks, vendors, frameworks, signals, findings
- Results grouped by category with icons
- Selecting a result navigates to its detail page
- Also includes quick actions: "Go to Dashboard", "Go to Risks", etc.

### RBAC UI Enforcement
- Admin-only controls (Settings nav, create/edit actions) hidden from viewer and auditor roles
- Read-only view for auditors — edit/delete buttons hidden
- Currently only Settings is gated — extend to create/edit buttons across risk, vendor, compliance pages

### Pagination, Search & Filter
- Wire existing `<Pagination>` component to all list views
- Server-side pagination with page size selector
- Add search to alert-list and finding-list (risks + vendors already have it)
- Consistent filter pattern: Popover with checkboxes for multi-select filters

### Risk Sparklines
- Mini sparkline chart on risk cards/rows showing 30-day score trajectory
- Use existing `<Chart>` component (Recharts wrapper already installed)

### CSV Export
- Download icon button in the risk list toolbar (next to search/filter)
- Exports current filtered view as CSV
- Client-side generation from loaded data

### Visual Design Direction
- Clean enterprise with Apple-like vibes — minimalist, elegant, ergonomic
- Think Linear/Vercel dashboard aesthetic
- Monochrome base with accent colors only for status/severity (green/amber/red/blue)
- Spacious layout — generous padding, clear visual hierarchy
- Precise typography — consistent heading sizes, muted secondary text

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard
- `artifacts/riskmind-app/src/pages/dashboard.tsx` — Current KPI cards (lines 36-80), alerts table, mini heatmap (lines 120-158)
- `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` — Full heatmap with drill-down sheet (share logic into HeatmapGrid)

### UI Components (existing, wire up)
- `artifacts/riskmind-app/src/components/ui/empty.tsx` — Full composable empty-state system (Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia)
- `artifacts/riskmind-app/src/components/ui/skeleton.tsx` — Skeleton animate-pulse component
- `artifacts/riskmind-app/src/components/ui/pagination.tsx` — Full Pagination component set
- `artifacts/riskmind-app/src/components/ui/chart.tsx` — Recharts wrapper for sparklines
- `artifacts/riskmind-app/src/components/ui/command.tsx` — shadcn/ui Command palette component
- `artifacts/riskmind-app/src/hooks/use-toast.ts` — useToast() hook + toast() imperative API
- `artifacts/riskmind-app/src/components/ui/toaster.tsx` — Toaster already mounted in App.tsx

### List Pages (all need polish)
- `artifacts/riskmind-app/src/pages/risks/risk-list.tsx` — Has search + filter popover, no pagination, inline empty text
- `artifacts/riskmind-app/src/pages/alerts/alert-list.tsx` — Has severity filter, no search, no pagination
- `artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx` — Has search, no filter, no pagination
- `artifacts/riskmind-app/src/pages/signals/signal-list.tsx` — Has search + tab filters, no pagination
- `artifacts/riskmind-app/src/pages/signals/finding-list.tsx` — No search, no filter, no pagination

### Navigation / Layout
- `artifacts/riskmind-app/src/components/layout/app-layout.tsx` — Sidebar nav (line 50-80), header bar (add alert bell here), RBAC gate for Settings (line 79)

### Vendor Lifecycle
- `artifacts/api-server/src/lib/allowed-transitions.ts` — 7 vendor lifecycle stages and transition rules

### API Hooks (generated — read-only reference)
- `lib/api-client-react/` — Generated React Query hooks for all API endpoints

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<Empty>` component: Full composable system with icon media variant — use for all list pages
- `<Skeleton>`: animate-pulse — use for table rows and KPI cards
- `<Pagination>`: Full set (Previous, Next, Ellipsis) — wire to all lists
- `<Command>`: shadcn/ui command palette — foundation for ⌘K search
- `<Chart>`: Recharts wrapper — use for sparklines and KRI bars
- `useToast()`: Hook + imperative `toast()` — wire to all mutation onError
- `<Toaster>`: Already mounted in App.tsx root
- `SeverityBadge` + `StatusBadge`: Existing badges for risk/alert severity display

### Established Patterns
- shadcn/ui + Tailwind CSS for all components
- React Query (TanStack) for data fetching via generated hooks
- Monochrome enterprise theme with dark sidebar
- `AppLayout` wraps all authenticated pages
- Table-based list views with sticky headers
- Client-side filtering via query params passed to API hooks

### Integration Points
- Dashboard KPIs: Replace `|| 0` fallbacks with skeleton loading
- All list pages: Replace inline "No X found" with `<Empty>` component
- All list pages: Replace `<Loader2>` with `<Skeleton>` rows
- All mutations: Add `onError: () => toast({ variant: "destructive", ... })`
- Header bar in `app-layout.tsx`: Add alert bell icon with badge
- Vendor list page: Add pipeline/kanban view toggle
- Risk list page: Add CSV export button + sparklines on cards

</code_context>

<specifics>
## Specific Ideas

- "Clean enterprise with Apple-like vibes, minimalist, elegant, ergonomic" — think Linear/Vercel
- Command palette (⌘K) with semantic search via pgvector is the standout feature
- Vendor kanban is read-only visualization, no drag-and-drop
- Alert badge in header bar with dropdown, not sidebar
- KRI widget uses traffic light horizontal bars

</specifics>

<deferred>
## Deferred Ideas

None — all discussed features are within Phase 3 scope (UI-09 added to requirements for command palette)

</deferred>

---

*Phase: 03-dashboard-polish-and-demo-readiness*
*Context gathered: 2026-03-18*
