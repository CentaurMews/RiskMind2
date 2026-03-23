# Phase 8: Quick Fixes & Polish - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Login UX improvements (tenant auto-detection from email domain, social login placeholders), clickable dashboard KPI cards, mobile responsiveness (mobile-specific views for complex components), and Replit tenant UUID cleanup from header. Small, targeted fixes — no new backend features.

</domain>

<decisions>
## Implementation Decisions

### Login — Tenant Auto-Detection (LOGIN-01)
- Remove the tenant slug input field from the login form
- Backend resolves tenant from email domain: extract domain from email (e.g., `admin@acme.com` → `acme.com`), look up tenant by matching domain or slug
- If no tenant matches the domain, return a clear error: "No organization found for this email domain"
- Login form becomes: email + password only (2 fields instead of 3)
- Claude's discretion: exact backend lookup logic (domain column on tenants table vs slug match vs email domain pattern)

### Login — Social Login Placeholders (LOGIN-02)
- Position: below the email/password form
- Divider: "Or continue with" text separator between form and social buttons
- Two full-width outlined buttons: "Continue with Microsoft" and "Continue with Google" with provider icons
- On click: show "Coming soon" toast notification (not functional yet)
- Style: outlined/ghost variant, full-width, provider icon on left

### Dashboard — Clickable KPI Cards (DASH-06)
- All 4 KPI cards become clickable links:
  - Active Risks → /risks
  - Open Alerts → /alerts
  - Active Vendors → /vendors
  - Compliance Score → /compliance
- Hover state: pointer cursor + subtle elevation/shadow increase
- Wrap cards in Link or make them clickable with `onClick` + `useLocation`

### Mobile — Strategy (MOB-01, MOB-02, MOB-03)
- Mobile-specific views for complex components (not just responsive tweaks)
- Heatmap: on mobile (< 768px), show a simplified list of risk counts by severity level instead of the 5x5 grid — "Critical: 3, High: 5, Medium: 8, Low: 2"
- Tables: add horizontal scroll shadow indicators (gradient fade on right edge when content overflows)
- Touch targets: ensure all interactive elements are at least 44px
- Dashboard: stack cards vertically on mobile, simplify executive summary
- All pages must be usable at 375px width (iPhone SE)

### Cleanup — Replit UUID (CLEAN-01)
- `app-layout.tsx` line 84: `tenantId.split('-')[0]` shows UUID segment (e.g., "B8b8fed4")
- Replace with the actual tenant name from the user profile
- The `useGetMe` hook already returns user data — check if tenant name is available in the response, or fall back to tenant slug

### Claude's Discretion
- Backend tenant lookup implementation details
- Microsoft/Google icon sources (lucide or SVG)
- Mobile breakpoint exact values
- Scroll shadow CSS technique
- KPI card hover animation timing
- Whether to use Next.js-style Link or onClick navigation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Login
- `artifacts/riskmind-app/src/pages/login.tsx` — Current login form with tenantSlug state (line 14), email/password fields
- `artifacts/api-server/src/routes/auth.ts` — Login endpoint, tenant resolution logic

### Dashboard
- `artifacts/riskmind-app/src/pages/dashboard.tsx` — KPI cards (KpiCard component usage)
- `artifacts/riskmind-app/src/components/dashboard/kpi-card.tsx` — KpiCard component to extend with click

### Mobile / Heatmap
- `artifacts/riskmind-app/src/components/dashboard/heatmap-grid.tsx` — Shared heatmap component (needs mobile variant)
- `artifacts/riskmind-app/src/pages/risks/risk-heatmap.tsx` — Full heatmap page

### Layout / Cleanup
- `artifacts/riskmind-app/src/components/layout/app-layout.tsx` — Line 84: `tenantId.split('-')[0]` (Replit UUID), line 196: font-mono display

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `KpiCard` component — extend with onClick/href prop
- `HeatmapGrid` — add mobile-specific rendering mode
- `toast()` — for social login "Coming soon" feedback
- `useGetMe()` — already returns user profile data

### Established Patterns
- Apple-like minimalist design (Phase 3)
- shadcn/ui components for all UI
- Wouter for routing (`useLocation`)

### Integration Points
- Login form: remove tenantSlug state + field, update login mutation call
- Auth endpoint: add tenant-from-email resolution
- KpiCard: add optional onClick/href prop
- app-layout.tsx line 84: replace UUID split with tenant name

</code_context>

<specifics>
## Specific Ideas

- Social login buttons should look like Google's own sign-in button style — recognized, trusted
- Mobile heatmap as severity list should still use the same color coding (red/amber/green)
- KPI cards should feel like big interactive buttons, not just passive displays

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-quick-fixes-and-polish*
*Context gathered: 2026-03-19*
