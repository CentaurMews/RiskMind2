# Stack Research

**Domain:** RiskMind v2.1 — Policy Management, Evidence Collection, Audit Hub, Executive PDF Reporting, AI Governance (ISO 42001 / NIST AI RMF / EU AI Act), Multi-Entity Schema, Webhook/Event System, Approval Workflows, Task/Work Items, Notifications with Email Delivery
**Researched:** 2026-03-26
**Confidence:** HIGH for all core additions (verified against npm registry and official docs); MEDIUM for @react-pdf/renderer ESM edge cases (open issues, workaround known)

---

> **Scope note:** This document covers ONLY new dependencies required for v2.1. The existing validated stack is already installed: Express 5, React 19 + Vite 7, Drizzle ORM, Zod 3.25.76 (catalog), drizzle-zod ^0.8.3, shadcn/ui, Tailwind v4, pgvector, openai ^6.29, @anthropic-ai/sdk ^0.78, multer ^2.1.1, node-cron ^4.2.1, papaparse, imapflow/mailparser (email ingestion), PostgreSQL-backed job queue (custom, no Redis). Do not re-add or replace these.

---

## Recommended Stack

### Core Technologies (New for v2.1)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nodemailer | ^8.0.4 | Outbound email (notifications, escalations, evidence expiry) | Zero runtime deps, industry standard, SMTP + OAuth2, ships its own TypeScript types in v8. Already used pattern-side (imapflow reads, nodemailer sends). |
| @react-email/components | ^1.0.10 | Typed React components for email templates | Cross-client compatible (Gmail, Outlook). Reuses React knowledge already in the codebase. Works server-side via @react-email/render. Backed by Resend team, actively maintained. |
| @react-email/render | ^1.0.10 | Render React email components to HTML string on the API server | `renderAsync()` produces HTML string passed directly to nodemailer `html:` field. No extra template engine needed. |
| @react-pdf/renderer | ^4.3.2 | Server-side PDF generation for executive reports | Already installed in frontend. Move renderToBuffer() call to API server for generating compliance PDFs, board summaries, evidence packs. Avoids puppeteer (no headless Chrome, no 200MB binary). |

### Supporting Libraries (New for v2.1)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/nodemailer | ^7.0.11 | TypeScript types for nodemailer | Install as devDependency in api-server. Nodemailer v8 ships types, but @types/nodemailer 7.x provides supplemental DefinitelyTyped coverage for edge cases. |
| crypto (Node built-in) | built-in | HMAC-SHA256 signing for outbound webhook payloads | No installation needed. `createHmac('sha256', secret)` signs webhook body. Standard pattern used by GitHub, Stripe. Use `timingSafeEqual` for verification. |

### What is NOT Needed (Do Not Add)

| Avoid | Why | What to Use Instead |
|-------|-----|---------------------|
| BullMQ / Redis | BullMQ requires Redis, adding an entire infrastructure dependency. The existing PostgreSQL-backed job queue (`job-queue.ts`) already handles retry, exponential backoff, dead-letter, FOR UPDATE SKIP LOCKED — production-quality. | Extend existing `enqueueJob()` / `registerWorker()` pattern with new queue names: `notification`, `webhook-delivery`, `evidence-expiry-check`. |
| xstate / state machine library | The approval workflow is a simple 4-state machine (pending → approved / rejected / escalated). The codebase already uses the database-as-state-machine pattern (vendor lifecycle in `allowed-transitions.ts`). Adding XState for 4 states is over-engineering. | Store `status` as a Drizzle enum column. Write a pure `canTransition(from, to)` function (same pattern as `getAllowedTransitions`). |
| puppeteer / playwright | Spawns a 200MB headless Chromium process. Overkill for structured compliance PDFs. Deployment adds binary management complexity. | @react-pdf/renderer (already installed in frontend, move server-side use to api-server). |
| MJML / Handlebars for email | Two separate template compilation steps for a problem already solved by @react-email. The team knows React; maintaining MJML markup in parallel is unnecessary complexity. | @react-email/components + @react-email/render on the server. |
| EventEmitter2 / mitt for event bus | The webhook/event system needs persistence (audit trail, retry), not just in-memory pub/sub. An in-memory emitter loses events on restart and has no delivery guarantee. | Write events to a `domain_events` table via `enqueueJob('webhook-delivery', ...)`. Workers read and dispatch. This integrates with the existing job queue. |
| Temporal / Dapr / workflow engines | Enterprise orchestration platforms. The approval workflow is not a distributed saga — it's a single `approval_requests` row with a status column. These add enormous operational overhead. | Plain Drizzle schema with status transitions enforced in service layer. |
| @react-pdf/renderer on frontend | PDF generation is a server concern (auth, data access, file streaming). Keeping it frontend-only means the user's browser generates the PDF — impossible for scheduled/automated report delivery. | Import `@react-pdf/renderer` in api-server; stream result as `application/pdf` response. |

---

## Architecture Decisions by Feature

### Email Notifications and Escalations

**Stack:** `nodemailer ^8.0.4` + `@react-email/render ^1.0.10` + `@react-email/components ^1.0.10` + existing job queue.

**Pattern:**
1. API route or job handler calls `enqueueJob('notification', 'email', { to, templateName, data })`.
2. Notification worker renders template via `renderAsync(<SLABreachEmail {...data} />)` and calls `transporter.sendMail({ html })`.
3. SMTP config stored per-tenant in `notification_configs` table (similar to `llm_configs`, AES-256-GCM encrypted credentials).
4. Escalation chains stored as JSON array of user IDs in `escalation_policies` table. Job re-enqueues with next escalation target after SLA window.

**Why not send inline:** Email delivery must be async. Network failures and SMTP rate limits should not block API responses.

### Executive PDF Reporting

**Stack:** `@react-pdf/renderer ^4.3.2` (api-server side) — already in pnpm workspace, no new install needed.

**Pattern:**
1. POST `/reports/generate` enqueues a job.
2. Worker calls `renderToBuffer(<ComplianceReportPDF data={...} />)` and stores result in `uploads/reports/` (same disk pattern as evidence uploads).
3. GET `/reports/:id/download` serves the file with `Content-Type: application/pdf`.

**ESM caveat:** `@react-pdf/renderer` has known ESM issues when bundled with esbuild in browser mode. The api-server uses `tsx` at dev time and esbuild for production build. Import it in a file that is NOT part of the browser bundle. The api-server is server-only so this is safe. If esbuild throws on the import, add `external: ['@react-pdf/renderer']` to `build.ts`.

### Webhook / Event System

**Stack:** No new library. Database-backed event bus using existing job queue.

**Schema additions:**
- `webhook_endpoints` table: `id, tenant_id, url, events (text[]), secret (encrypted), active`.
- `domain_events` table: `id, tenant_id, event_type, entity_type, entity_id, payload (jsonb), created_at`. Insert-only audit trail.

**Pattern:**
1. Service emits an event by inserting into `domain_events` AND enqueueing `webhook-delivery` jobs for each matching `webhook_endpoints` row.
2. Webhook delivery worker POSTs to endpoint URL with HMAC-SHA256 signature header (`X-RiskMind-Signature`). Retry 5× with exponential backoff. Dead-letters after max attempts.
3. HMAC signing uses Node built-in `crypto.createHmac('sha256', secret).update(body).digest('hex')`.

### Approval Workflow Engine

**Stack:** No new library. Database state machine, same pattern as vendor lifecycle.

**Schema:** Single `approval_requests` table with `context_type` enum (`policy`, `evidence`, `vendor_onboarding`, `agent_action`) + `context_id` + `status` enum (`pending`, `approved`, `rejected`, `escalated`) + `assignee_id` + `due_at` + `resolved_by` + `resolution_note`.

**Transition function:** `canApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): boolean` — 10 lines, no library needed.

**Why not XState:** The entire state machine fits in one function with 4 states. XState adds a 41KB dependency and a new mental model for a problem that is purely persistence-driven, not UI-driven.

### Policy Management (Versioning)

**Stack:** No new library. Drizzle schema with `version integer`, `parent_id uuid` self-reference, and `status` enum (`draft`, `review`, `approved`, `superseded`, `archived`).

**Pattern:** On approval, set old version to `superseded`, create new row with incremented version. All versions retained for audit. Linked to `controls` via `policy_control_maps` join table.

### Evidence Collection (File Storage)

**Stack:** Existing `multer ^2.1.1` disk storage — already configured in `compliance.ts` with `uploads/evidence/`. No new library.

**New schema fields needed:** `evidence_records` table with `control_id`, `source_type` enum (`manual`, `auto_collected`, `api_imported`), `expires_at`, `file_path`, `mime_type`, `checksum`, `entity_id` (for multi-entity).

**No S3/MinIO for v2.1:** The platform is a single dedicated server with local disk. Adding object storage is a v3.x concern. Multer disk storage to `uploads/evidence/` is sufficient and consistent with the existing pattern.

### Multi-Entity Schema

**Stack:** No new library. Drizzle schema migration only.

**Pattern:**
- Add `entities` table: `id, tenant_id, name, type (subsidiary|branch|partner), parent_entity_id`.
- Add `entity_id uuid` nullable FK to: `risks`, `vendors`, `policies`, `evidence_records`, `tasks`.
- Null `entity_id` means tenant-root scope (backward compatible — no existing rows break).
- Add to Drizzle schema files, run `drizzle-kit push`.

### Task / Work Item System

**Stack:** No new library. Drizzle schema only.

**Schema:** `tasks` table with `id, tenant_id, entity_id, title, description, assignee_id, created_by, status` enum (`open`, `in_progress`, `blocked`, `done`, `cancelled`), `priority` enum (`low`, `medium`, `high`, `critical`), `due_at`, `context_type` (optional FK hint: `risk`, `policy`, `evidence`, `vendor`, `audit`), `context_id`, `sla_hours`.

**Why not a task library:** Tasks are domain objects with tenant/entity scoping and SLA enforcement. Any task library (Linear-style) adds UI without fitting the existing data model.

### AI Governance — Model Registry

**Stack:** No new library. Drizzle schema + existing LLM routing infrastructure.

**Schema:** `ai_model_registry` table with `id, tenant_id, entity_id, name, provider, model_id, use_cases (text[]), risk_level` enum (`minimal`, `limited`, `high`, `unacceptable` — EU AI Act Annex III tiers), `deployment_context`, `training_data_description`, `bias_assessment`, `human_oversight_required boolean`, `framework_mappings (jsonb)` (ISO 42001 control refs, NIST AI RMF functions), `last_reviewed_at`, `review_cycle_days`, `created_at`.

**Framework support:** ISO 42001 and NIST AI RMF imported as framework records in the existing `frameworks`/`framework_requirements` tables. No new framework import mechanism needed — re-use compliance framework import pipeline.

---

## Installation

```bash
# api-server (in artifacts/api-server/)
pnpm add nodemailer @react-email/render @react-email/components

# api-server dev dependencies
pnpm add -D @types/nodemailer

# @react-pdf/renderer is already in artifacts/riskmind-app/
# Import it in api-server directly (it is a workspace dep via pnpm workspace hoisting)
# If it needs to be explicit in api-server package.json:
pnpm add @react-pdf/renderer
```

**Note:** All new schema tables are pure Drizzle migrations — no package installs required.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| nodemailer ^8 | Resend / SendGrid SDK | If the team wants managed email delivery with analytics and wants to avoid managing SMTP credentials. Reasonable choice for SaaS. For self-hosted / enterprise, SMTP is simpler and has no vendor lock-in. |
| @react-email/render | MJML + Handlebars | If the team is not using React on the server and needs a purely HTML-driven template language. Not applicable here — api-server can import React. |
| @react-pdf/renderer (server) | puppeteer | If PDFs must pixel-match a web UI design or require complex CSS/JS rendering. Acceptable tradeoff if already using headless Chrome for other purposes. Not justified here. |
| Database-backed event bus (existing job queue) | BullMQ + Redis | If the platform scales to multiple API server processes needing shared queue. For the current single-server deployment, adding Redis is pure overhead. Revisit at v3.x if horizontal scaling is needed. |
| Database state machine (approval workflow) | XState v5 | If the workflow has complex parallel states, guards, or spawns child actors. Appropriate for v2.2 agentic orchestration where Paperclip-style agent state machines may warrant XState. |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| nodemailer ^8.0.4 | Node 20, TypeScript 5.9, ESM | Ships its own types; @types/nodemailer 7.x supplements. Import via `import nodemailer from 'nodemailer'` with `"esModuleInterop": true` in tsconfig (already set). |
| @react-email/render ^1.0.10 | React 19.1.0 (catalog), Node 20, ESM | renderAsync() preferred over sync render() in Node context. Returns Promise<string>. |
| @react-email/components ^1.0.10 | React 19.1.0 (catalog) | Server-side rendering — no browser APIs used. Safe to import in api-server. |
| @react-pdf/renderer ^4.3.2 | React 19.1.0 (v4.1.0+), Node 20 | Already in frontend deps. Import renderToBuffer/renderToStream in api-server. Add `external: ['@react-pdf/renderer']` in build.ts if esbuild fails on ESM resolution (known issue, documented workaround). Do NOT put in pnpm catalog — versions in frontend and api-server should remain independently pinned. |
| zod 3.25.76 (catalog) | drizzle-zod ^0.8.3 | Zod 4 is available at `zod/v4` subpath import. drizzle-zod 0.8.3 targets Zod 3. Do NOT upgrade drizzle-zod or change catalog Zod version for v2.1 — the Orval-generated `lib/api-zod/` and `lib/api-client-react/` depend on stable Zod 3. Upgrade is a future dedicated migration. |

---

## What NOT to Change

| Do Not Touch | Why |
|--------------|-----|
| `lib/api-client-react/` and `lib/api-zod/` | Orval-generated. All new API routes get added to the OpenAPI spec first, then regenerated. |
| Job queue internals (`job-queue.ts`) | Only add new queue names via `registerWorker()`. Do not restructure the polling mechanism. |
| `zod` catalog version (3.25.76) | Changing this breaks the generated client and drizzle-zod in the same release. |
| Multer configuration in `compliance.ts` | New evidence upload routes should reuse the same `diskStorage` configuration pattern, not replace it. |
| ENCRYPTION_KEY | Cannot be rotated without re-encrypting all `llm_configs` rows. New notification SMTP credentials stored in `notification_configs` use the same encryption utility (`lib/encryption.ts`). |

---

## Sources

- [nodemailer npm](https://www.npmjs.com/package/nodemailer) — version 8.0.4 confirmed, last published within 1 day of research date (HIGH confidence)
- [@types/nodemailer npm](https://www.npmjs.com/package/@types/nodemailer) — version 7.0.11 confirmed (HIGH confidence)
- [@react-email/components npm](https://www.npmjs.com/package/@react-email/components) — version 1.0.10 confirmed (HIGH confidence)
- [@react-email/render npm](https://www.npmjs.com/package/@react-email/render) — version 1.0.10 confirmed (HIGH confidence)
- [React Email + Nodemailer integration docs](https://react.email/docs/integrations/nodemailer) — renderAsync + sendMail pattern verified (HIGH confidence)
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) — version 4.3.2, React 19 support from v4.1.0 (HIGH confidence)
- [@react-pdf/renderer Node.js compatibility](https://react-pdf.org/compatibility) — server-side renderToBuffer/renderToStream supported (HIGH confidence)
- [@react-pdf/renderer ESM issue #2624](https://github.com/diegomura/react-pdf/issues/2624) — known ESM/esbuild issue, `external` workaround (MEDIUM confidence — issue open, workaround works)
- [BullMQ Redis requirement docs](https://docs.bullmq.io/) — Redis is mandatory; no PostgreSQL fallback (HIGH confidence)
- [BullMQ v5.71.1 npm](https://www.npmjs.com/package/bullmq) — confirmed Redis requirement, excluded on that basis (HIGH confidence)
- [Zod versioning / subpath import](https://zod.dev/v4/versioning) — catalog 3.25.76 ships Zod 4 at `zod/v4`, no breakage (HIGH confidence)
- [drizzle-zod Zod v4 compatibility issue #4406](https://github.com/drizzle-team/drizzle-orm/issues/4406) — v4 migration needed but not for v2.1 (MEDIUM confidence — PR merged but not in 0.8.3 release range)
- WebSearch: nodemailer 8 ESM TypeScript 2026, BullMQ v5 2026, @react-email 2025, EU AI Act Annex III risk tiers — supporting verification (MEDIUM confidence, cross-referenced with official sources above)

---
*Stack research for: RiskMind v2.1 — Policy, Evidence, Audit, Reporting, AI Governance, Webhooks, Approvals, Tasks, Notifications*
*Researched: 2026-03-26*
