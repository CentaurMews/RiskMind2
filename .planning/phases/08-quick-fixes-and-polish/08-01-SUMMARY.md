---
phase: 08-quick-fixes-and-polish
plan: 01
subsystem: auth
tags: [openapi, orval, codegen, login, tenant-resolution, jwt, react]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "tenantsTable schema (id, name, slug) and usersTable with tenantId FK"
provides:
  - "Email-only login: tenant resolved from email domain (acme@acme.com → slug acme)"
  - "Microsoft and Google social login placeholders with Coming Soon toast"
  - "Real tenant name in app header (from /me response, falls back to UUID segment)"
  - "Updated OpenAPI spec: LoginRequest without tenantSlug; UserProfile with tenantName/tenantSlug"
  - "Regenerated Orval types reflecting spec changes"
affects:
  - auth
  - login-ux
  - riskmind-app

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Email domain → tenant slug resolution: email.split('@')[1].split('.')[0]"
    - "Orval codegen regeneration after OpenAPI spec change"
    - "Graceful fallback chain for tenant display: tenantName || tenantSlug || UUID-prefix"

key-files:
  created: []
  modified:
    - lib/api-spec/openapi.yaml
    - lib/api-zod/src/generated/types/loginRequest.ts
    - lib/api-zod/src/generated/types/userProfile.ts
    - lib/api-client-react/src/generated/api.schemas.ts
    - artifacts/api-server/src/routes/auth.ts
    - artifacts/riskmind-app/src/pages/login.tsx
    - artifacts/riskmind-app/src/components/layout/app-layout.tsx

key-decisions:
  - "Email domain slug extraction: only the first label of the domain (acme.com → acme) to match existing tenant slug pattern"
  - "tenantName/tenantSlug are optional fields in UserProfile to avoid breaking existing consumers"
  - "Used (user as any) cast in app-layout to handle generated type lag; fallback chain ensures no regression"
  - "Social login buttons fire Coming Soon toast — no routing or auth flow needed"

patterns-established:
  - "Email-domain-to-tenant: extract domain from email, then first label as slug, then WHERE slug = domainSlug"
  - "Orval codegen: edit openapi.yaml then run pnpm codegen in lib/api-spec"

requirements-completed: [LOGIN-01, LOGIN-02, CLEAN-01]

# Metrics
duration: 15min
completed: 2026-03-23
---

# Phase 8 Plan 01: Quick Fixes and Polish Summary

**Email-domain tenant resolution on login with social login placeholders and real tenant name in header replacing Replit UUID artifact**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-23T08:00:00Z
- **Completed:** 2026-03-23T08:15:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Login form simplified to 2 fields (email + password) — tenant slug no longer needed
- Backend auto-resolves tenant from email domain with clear error for unknown organizations
- Microsoft and Google social login buttons added with "Coming soon" toast
- Header now shows real tenant name from /me API response instead of UUID first segment
- OpenAPI spec updated and Orval codegen re-run to reflect all type changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Update OpenAPI spec, run codegen, patch backend auth** - `47294e3` (feat)
2. **Task 2: Update login page and fix header tenant name** - `09d9336` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `lib/api-spec/openapi.yaml` - Removed tenantSlug from LoginRequest required; added tenantName/tenantSlug to UserProfile
- `lib/api-zod/src/generated/types/loginRequest.ts` - Regenerated: tenantSlug removed
- `lib/api-zod/src/generated/types/userProfile.ts` - Regenerated: tenantName/tenantSlug optional fields added
- `lib/api-client-react/src/generated/api.schemas.ts` - Regenerated: LoginRequest and UserProfile updated
- `artifacts/api-server/src/routes/auth.ts` - Login derives tenant from email domain; /me returns tenantName via join
- `artifacts/riskmind-app/src/pages/login.tsx` - 2-field form, social login buttons with toast, updated subtitle
- `artifacts/riskmind-app/src/components/layout/app-layout.tsx` - Header uses tenantName with fallback chain

## Decisions Made
- Email domain slug resolution uses only the first label: `acme.com` → `acme`. This matches existing slug format in tenantsTable without requiring full-domain matching.
- tenantName and tenantSlug added as optional fields to UserProfile OpenAPI schema to avoid breaking existing API consumers.
- `(user as any)` cast used in app-layout.tsx because TypeScript type propagation may lag; fallback chain `tenantName || tenantSlug || UUID-split` ensures correctness regardless.
- Social login buttons use a Coming Soon toast — no backend OAuth flow required for v2.0.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - build passed clean on first attempt with no TypeScript errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Login flow is demo-ready: no knowledge of tenant slugs required for first-time users
- Header shows clean tenant name (e.g., "Acme Corp") not a UUID artifact
- Social login UI is in place; OAuth wiring can be added in a future phase
- No blockers for remaining plans in Phase 8

---
*Phase: 08-quick-fixes-and-polish*
*Completed: 2026-03-23*
