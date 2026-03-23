# Phase 12: Signal Integrations - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Build 5 external signal source adapters (NVD, Shodan, Sentinel, MISP, Email) that poll on configurable schedules, write to the existing signals table with content_hash deduplication, and store encrypted credentials via integration_configs. Add Settings UI for credential management and enhance signal display with source-specific metadata.

</domain>

<decisions>
## Implementation Decisions

### Settings UI for Credentials
- **D-01:** New "Integrations" tab in Settings page. Each source displayed as a card: NVD, Shodan, Sentinel, MISP, Email. Click to expand config form. Status indicator (active/inactive/error) per card. "Test Connection" button validates credentials before saving. Last polled timestamp shown.
- **D-02:** Sentinel OAuth2 setup uses guided fields: Tenant ID, Client ID, Client Secret inputs with helper text explaining Azure app registration. Link to Microsoft docs. Test Connection validates the credentials against the Log Analytics API.
- **D-03:** Credentials encrypted with AES-256-GCM before storage (same pattern as `llm_configs`). Never appear in logs, job payloads, or API responses.

### Polling & Scheduling
- **D-04:** Scheduled polling via node-cron on configurable intervals. Defaults: NVD hourly, Shodan daily, Sentinel every 15 min, MISP hourly, Email every 5 min. Plus a "Sync Now" button per source in Settings that triggers an immediate poll.
- **D-05:** Each poll run updates `lastPolledAt` on `integration_configs`. Errors update `lastError` field. Polling skipped for inactive sources.
- **D-06:** Content hash deduplication via SHA256 of normalized signal content. Unique index on `(tenant_id, source, content_hash)` prevents duplicate inserts. Second poll of same data creates zero new signals.

### Signal Display Enhancements
- **D-07:** Source icon badge on signal list: shield icon for NVD/CVE, globe for Shodan, cloud for Sentinel, bug for MISP, mail for Email. Badge color matches source type.
- **D-08:** Signal detail page shows a "Source Details" card with structured metadata from the `metadata` JSONB column: CVSS score + vector for NVD, port list + services for Shodan, incident severity + status for Sentinel, IoC type + attributes for MISP, sender + subject for Email.

### Email Ingestion Safety
- **D-09:** Strip HTML from email body, extract plain text only. LLM extracts: subject line as signal title, sender, key entities (CVE IDs, domains, IPs), severity assessment. Email body stored in `metadata` JSONB but never used as signal classification directly.
- **D-10:** Attachments ignored in v2.0. Only email subject + plain text body parsed.
- **D-11:** IMAP connection uses imapflow library. Polls configured mailbox at 5-minute intervals. Deduplicates by message-id stored as `external_id`.

### Claude's Discretion
- Exact node-cron schedule syntax and configuration
- NVD API v2 pagination and rate limiting approach
- Shodan query construction per vendor domain
- MISP event attribute type filtering
- Signal content normalization for hash generation
- Whether to use `p-ratelimit` or a simpler approach for API rate limiting
- Adapter pattern structure (shared base class vs per-source modules)
- IMAP IDLE vs polling approach for email

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema (Phase 9 output)
- `lib/db/src/schema/integration-configs.ts` — integration_configs table with encrypted_config, source_type enum, unique per tenant+source
- `lib/db/src/schema/signals.ts` — signals table with content_hash, external_id, vendor_id, metadata columns

### Existing Signal Code
- `artifacts/api-server/src/routes/signals.ts` — Signal CRUD, triage transitions, AI triage job queue
- `artifacts/api-server/src/lib/job-queue.ts` — Job queue for async tasks (used for AI triage after signal creation)

### Encryption Pattern
- `artifacts/api-server/src/lib/llm-service.ts` — AES-256-GCM encrypt/decrypt functions for API keys

### Research
- `.planning/research/STACK.md` — imapflow, mailparser, p-ratelimit recommendations
- `.planning/research/ARCHITECTURE.md` — Signal feed adapter pattern, integration points
- `.planning/research/PITFALLS.md` — Sentinel SIEM agent retired Nov 2025 (use Log Analytics API), Shodan dedup, content_hash strategy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `llm-service.ts`: AES-256-GCM encrypt/decrypt — reuse for integration credential encryption
- `job-queue.ts`: `enqueueJob()` / `registerWorker()` — use for async signal processing after poll
- `signals.ts` route: existing signal creation pattern — adapters create signals through this pipeline
- Settings page: existing tab structure (LLM Providers, Agent Config, Users & Roles, Organization, Monitoring) — add Integrations tab

### Established Patterns
- Routes in `artifacts/api-server/src/routes/` with Express Router
- Encrypted config stored as text, decrypted at runtime
- Job workers registered in `ai-workers.ts` or route modules

### Integration Points
- `artifacts/api-server/src/routes/index.ts` — register integration routes
- `artifacts/api-server/src/server.ts` — initialize node-cron scheduler on startup
- `artifacts/riskmind-app/src/pages/settings/settings.tsx` — add Integrations tab
- Signal list page — add source badge component

</code_context>

<specifics>
## Specific Ideas

- Each adapter should be a self-contained module (e.g., `adapters/nvd.ts`, `adapters/shodan.ts`) with a common interface: `poll(config) → Signal[]`
- Test Connection should do a minimal API call (e.g., NVD: fetch 1 CVE, Shodan: /api-info, Sentinel: list workspaces)
- Source badges should use the same minimalist icon style as the rest of the app (Lucide icons)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-signal-integrations*
*Context gathered: 2026-03-23*
