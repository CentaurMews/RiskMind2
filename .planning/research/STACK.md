# Stack Research

**Domain:** RiskMind v2.0 — Assessment Engine, Vendor Lifecycle Redesign, Compliance Flow, Signal Integrations (Sentinel/Shodan/CVE/MISP/Email), Foresight v2 (Monte Carlo + OSINT)
**Researched:** 2026-03-23
**Confidence:** HIGH for most areas (verified against official docs and npm registry); MEDIUM for Sentinel SDK (perpetual beta); LOW for MISP Node.js (no maintained package exists)

---

> **Scope note:** This document covers ONLY new dependencies and integration patterns required for v2.0. The existing validated stack (Express 5, React 19 + Vite 7, Drizzle ORM, Zod v4, shadcn/ui, Tailwind v4, pgvector, openai ^6.29, @anthropic-ai/sdk ^0.78, recharts ^2.x, react-hook-form, node-cron equivalent via in-process polling) is already installed and not re-documented here.

---

## New Dependencies Required

### Signal Integrations

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `imapflow` | ^1.2.9 | IMAP email ingestion — connect to inbox, idle for new messages, fetch/parse raw emails | Actively maintained (last published 6 days ago), TypeScript-native, supports IDLE push for zero-poll email monitoring. node-imap is unmaintained. |
| `mailparser` | ^3.9.4 | Parse raw MIME email into structured object (subject, from, body, attachments) | Maintained by Nodemailer team, 3.9.3+ patches XSS in `textToHtml()`. Handles 100MB+ messages as stream. 782 dependents. |
| `@azure/arm-securityinsight` | ^1.0.0-beta.6 | Microsoft Sentinel management plane — read incidents, alerts, security events | Official Azure SDK. Still beta but stable since 2022; no GA release planned. Pair with `@azure/identity` for auth. |
| `@azure/identity` | ^4.13.0 | Azure credential management — `ClientSecretCredential` for service principal auth to Sentinel | Required by all Azure SDKs. `DefaultAzureCredential` is overkill for server-to-server; use `ClientSecretCredential` directly. |

**Shodan:** Do NOT add a package. `shodan-client` npm is 6 years unmaintained (v3.2.0, 2019). Use Node.js built-in `fetch` directly against `https://api.shodan.io/` — the REST API is simple enough (3-4 endpoints used: `/shodan/host/{ip}`, `/shodan/host/search`, `/dns/resolve`).

**NVD/CVE:** Do NOT add a package. No maintained Node.js wrapper exists for NVD API v2. Use built-in `fetch` with a rate limiter (see below). NVD API v2 base URL: `https://services.nvd.nist.gov/rest/json/cves/2.0`. Rate limit: 50 req/30 sec with API key.

**MISP:** Do NOT add a package. No maintained Node.js MISP client exists on npm. MISP exposes a documented REST API (`/events`, `/attributes/restSearch`) with Bearer token auth. Use built-in `fetch`. MISP has an OpenAPI spec available for reference.

### Rate Limiting (for External API Calls)

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `p-ratelimit` | ^1.2.0 | Throttle outbound HTTP calls to rate-limited APIs (NVD: 50/30s, Shodan: varies by plan, MISP: configurable) | TypeScript-native, wraps any async function, configurable interval + concurrency. Avoid `bottleneck` — last updated 2019, maintenance inactive. |

### Scheduled Polling (Signal Feeds)

**node-cron is already available** — confirm before adding. The existing `ai-enrichment` service uses in-process scheduling. If `node-cron` is not already installed: add `node-cron@^4.2.1` with `@types/node-cron`. This handles cron-style polling for Shodan, CVE/NVD, MISP, and Sentinel feeds.

**Do NOT add BullMQ or Redis** — the existing pattern of in-process scheduled jobs (proven by the enrichment queue) is sufficient. BullMQ requires Redis, adding a new infrastructure dependency that the deployment does not have. Signal polling jobs are low-frequency (hourly to daily) and do not require distributed queue semantics.

### Foresight v2 — Monte Carlo

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `simple-statistics` | ^7.8.8 | Statistical distributions (normal, lognormal, PERT, triangular), random sampling, percentile calculations | Zero dependencies, includes TypeScript types, runs in Node and browser. Version 7.8.8 is current. Purpose-built for exactly these distribution functions. |

**No other Monte Carlo library needed.** Monte Carlo simulation for risk is straightforward: sample N times from `simple-statistics` distributions, compute loss distribution, extract P50/P90/P99 percentiles. This is custom business logic, not a pre-packaged simulation framework.

### Frontend Additions

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `recharts` | ^3.8.0 | Upgrade from 2.x (already installed at ^2.15.4) — histogram / density charts for Monte Carlo loss distribution | v3 brings improved TypeScript types and composable API. Already used; upgrade is low-risk. Check 3.0 migration guide for breaking changes in axis/tooltip props. |

**Assessment Engine (wizard stepper):** No new packages needed. React Hook Form (already installed) + Zod v4 + shadcn/ui Dialog/Stepper primitives handle multi-step questionnaire flows. The AI branching logic is server-side (LLM decides next question), so the frontend is a simple step renderer, not a declarative form engine like SurveyJS.

---

## Recommended Stack — Full Picture

### New Backend Packages

| Package | Version | Install In | Notes |
|---------|---------|-----------|-------|
| `imapflow` | ^1.2.9 | `artifacts/api-server` | IMAP ingestion. Has built-in TypeScript types. |
| `mailparser` | ^3.9.4 | `artifacts/api-server` | MIME parsing. Patch CVE-2026-3455 — use >=3.9.3. |
| `@azure/arm-securityinsight` | ^1.0.0-beta.6 | `artifacts/api-server` | Sentinel SDK. Beta but stable since 2022. |
| `@azure/identity` | ^4.13.0 | `artifacts/api-server` | Azure auth. Already used by Azure SDKs ecosystem. |
| `p-ratelimit` | ^1.2.0 | `artifacts/api-server` | Rate limit NVD/Shodan/MISP outbound calls. |
| `simple-statistics` | ^7.8.8 | `artifacts/api-server` | Monte Carlo sampling + distribution math. |
| `node-cron` | ^4.2.1 | `artifacts/api-server` | Cron scheduling for signal feed polling (if not already present). |

### New Frontend Packages

| Package | Version | Install In | Notes |
|---------|---------|-----------|-------|
| `recharts` | ^3.8.0 | `artifacts/riskmind-app` | Upgrade from 2.x. Required for histogram/density charts in Foresight v2. |

---

## Installation

```bash
# Backend — api-server
cd /home/dante/RiskMind2/artifacts/api-server
pnpm add imapflow mailparser @azure/arm-securityinsight @azure/identity p-ratelimit simple-statistics node-cron

# Backend dev types
pnpm add -D @types/node-cron

# Frontend — riskmind-app (upgrade recharts)
cd /home/dante/RiskMind2/artifacts/riskmind-app
pnpm add recharts@^3.8.0
```

---

## Integration Patterns by Feature Area

### Assessment Engine

No new packages. Architecture is:
- Server: New `assessment-engine` service. LLM generates next question based on prior answers (`complete()` from existing `llm-service.ts`). State stored in new `assessments` + `assessment_responses` DB tables.
- Frontend: Step-by-step renderer. React Hook Form handles input. TanStack Query polls for AI-generated next question. shadcn/ui Progress + Dialog cover the shell.
- Shared between Vendor onboarding and Compliance control assessment — parameterized by `assessmentType` enum.

### Vendor Lifecycle Redesign

No new packages. Wizard onboarding uses existing multi-step form pattern (React Hook Form + Zod + shadcn/ui). 4th party risk uses a graph query on the existing vendor relationships schema. Continuous monitoring hooks into the signal polling scheduler already established for Signal Integrations.

### Compliance Flow

No new packages. Framework import is a JSON/CSV upload parsed with built-in `JSON.parse` or existing CSV-to-JSON logic. Assessment uses the shared Assessment Engine. Thresholds are stored config values evaluated server-side.

### Signal Integrations

**Microsoft Sentinel:**
- Auth: `ClientSecretCredential` from `@azure/identity` — tenants configure `tenantId`, `clientId`, `clientSecret`, `subscriptionId`, `resourceGroup`, `workspaceName` in settings.
- Fetch: Use `@azure/arm-securityinsight` `SecurityInsights` client → `incidents.list()` / `incidents.listAlerts()` — or fall back to direct HTTP against Management API (`management.azure.com/subscriptions/.../providers/Microsoft.SecurityInsights/incidents?api-version=2024-09-01`) if SDK coverage is inadequate.
- Polling: `node-cron` job per tenant with Sentinel configured, every 15 minutes.

**Shodan:**
- Auth: API key stored per-tenant in existing `signal_source_configs` (or new `integration_configs` table), AES-256-GCM encrypted (same pattern as LLM API keys).
- Fetch: `fetch('https://api.shodan.io/shodan/host/{ip}?key={apiKey}')` — JSON response, no SDK.
- Rate limit: Wrap calls with `p-ratelimit` — Shodan free tier: 1 req/sec, paid varies.
- Trigger: On-demand (vendor enrichment) + daily scheduled sweep of monitored vendor IPs.

**NVD/CVE:**
- Auth: Optional API key (50 req/30s with key vs 5 req/30s without) — configure via environment variable `NVD_API_KEY`.
- Fetch: `fetch('https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch={vendor}')` — paginated.
- Rate limit: `p-ratelimit` with `{ interval: 30000, rate: 45 }` (leave headroom below 50 limit).
- Polling: Daily cron, incremental via `lastModStartDate` / `lastModEndDate` query params.

**MISP:**
- Auth: Bearer token (`Authorization: key {apikey}` header) — per-tenant config, encrypted.
- Fetch: `fetch('https://{mispUrl}/events/index', { headers: { 'Authorization': 'key {token}', 'Accept': 'application/json' } })`
- Polling: Configurable interval (default: hourly) via `node-cron`. Filter by `timestamp` to fetch only new events.

**Email Ingestion:**
- Connect: `imapflow` with IMAP credentials (host, port, user, password/OAuth2 token) — per-tenant config, encrypted.
- Strategy: IDLE-based push when mailbox supports it (zero polling overhead), fallback to `node-cron` poll every 5 minutes.
- Parse: `mailparser` `simpleParser(rawEmail)` → extract subject, from, body, attachments.
- Extract signals: Pass parsed email body through existing LLM triage pipeline (`complete()`) to extract risk signals.

### Foresight v2 — Monte Carlo

- Simulation engine lives in a new `foresight-simulation.ts` service (server-side).
- Input: Risk register entries with `likelihood` and `impact` fields + scenario parameters (distribution type, iterations).
- Distributions: `simple-statistics` provides `randomNormal()`, `randomLogNormal()` via seeded sampling. For triangular distribution (PERT), implement manually — formula is trivial (2 lines).
- Iterations: 10,000 default, 100,000 max. Node.js handles synchronously in ~50ms for 10k iterations — no worker thread needed.
- Output: Array of simulated total loss values → compute P50/P90/P99 with `simple-statistics` `quantile()`.
- Storage: Persist simulation run metadata + percentile results in new `foresight_simulations` table. Raw iteration arrays are NOT stored (too large).
- Chart: Upgrade recharts to v3.8 for histogram / AreaChart showing loss distribution curve.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `imapflow` | `node-imap` | node-imap last committed 2020, unmaintained. imapflow is its spiritual successor from the same ecosystem (Nodemailer team). |
| `imapflow` | EmailEngine (SaaS) | SaaS dependency, cost, vendor lock-in. imapflow gives full control. |
| Direct `fetch` for Shodan | `shodan-client` npm | shodan-client v3.2.0, last published 6 years ago. Dead package. |
| Direct `fetch` for NVD | `nvdlib` Python wrapper | Python library, wrong language. No maintained Node.js equivalent exists. |
| Direct `fetch` for MISP | PyMISP | Python only. No Node.js official client. |
| `@azure/arm-securityinsight` | Direct HTTP to Sentinel API | SDK handles auth token refresh and retry logic. Worth the dependency given the complexity of Azure ARM auth. |
| `p-ratelimit` | `bottleneck` | Bottleneck is v2.19.5, last published 2019 (7 years ago). Maintenance inactive. Same result, better maintenance posture with p-ratelimit. |
| `simple-statistics` | `jstat` | jStat last major update 2020, TypeScript types are external and outdated. simple-statistics has inline types and active maintenance. |
| `simple-statistics` | Custom statistical code | Re-implementing normal distribution CDF and inverse CDF is error-prone. Use the library. |
| `recharts` upgrade to v3 | Stay on v2.15.4 | v3 adds histogram-friendly APIs and better TypeScript types needed for Foresight distribution charts. Migration effort is low — axis and tooltip prop changes documented in migration guide. |
| `node-cron` | BullMQ + Redis | BullMQ requires Redis. No Redis in current deployment. Signal polling is low-frequency (15min–daily). node-cron in-process is proven (used by existing enrichment jobs). Adding Redis is infrastructure overkill for this use case. |
| In-process Monte Carlo (Node.js) | Worker threads | 10k iterations in simple-statistics takes ~50ms synchronously. No blocking concern. Worker threads add complexity for no measurable benefit at this scale. |
| Assessment Engine custom-built | SurveyJS | SurveyJS is a full platform with its own form builder UI, rendering engine, and data model. RiskMind's assessment engine needs AI-driven dynamic branching where the LLM decides question order — SurveyJS's deterministic branching logic doesn't fit. Build the engine; use shadcn/ui for rendering. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `shodan-client` | 6 years unmaintained, npm health score poor | Built-in `fetch` against `api.shodan.io` |
| `bottleneck` | 7 years unmaintained (last release 2019) | `p-ratelimit` |
| `BullMQ` / `bull` | Requires Redis infrastructure not present in deployment | `node-cron` in-process scheduling |
| `Redis` | No Redis in current deployment; adds ops burden | Not needed — see BullMQ above |
| `jstat` | Outdated TypeScript types, infrequent updates | `simple-statistics` |
| `SurveyJS` | Deterministic form engine doesn't support AI-driven branching | Custom assessment engine + shadcn/ui components |
| `axios` | Node.js 20 has `fetch` built-in | `globalThis.fetch` |
| `node-fetch` | Same as above | `globalThis.fetch` |
| Any Python MISP/NVD wrappers | Wrong runtime | Direct `fetch` with `p-ratelimit` |
| `langchain` / `llamaindex` | Heavy abstraction over APIs already called directly | Existing `llm-service.ts` with openai + anthropic SDKs |
| `@microsoft/microsoft-graph-client` | Graph API requires different permission scope from ARM API; adds auth complexity for minimal gain | `@azure/arm-securityinsight` + ARM API |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `imapflow` | ^1.2.9 | Node.js 20, TypeScript 5.9 | Built-in types, no `@types/` needed |
| `mailparser` | ^3.9.4 | Node.js 20, TypeScript 5.9 | Requires `@types/mailparser` from npm (separate package) — check if bundled |
| `@azure/arm-securityinsight` | ^1.0.0-beta.6 | Node.js 20, `@azure/identity` ^4.x | Beta API — no breaking changes expected but pin the version |
| `@azure/identity` | ^4.13.0 | Node.js 20, Express 5 | Use `ClientSecretCredential` for server-to-server; not `DefaultAzureCredential` (which chain-tries many envs) |
| `p-ratelimit` | ^1.2.0 | Node.js 20, TypeScript 5.9, ESM | Pure promise wrapper, ESM-compatible |
| `simple-statistics` | ^7.8.8 | Node.js 20, TypeScript 5.9, browser | Zero dependencies, includes TypeScript definitions |
| `recharts` | ^3.8.0 | React 19, TypeScript 5.9 | v3 migration guide documents axis/tooltip prop changes from v2. Check `recharts/recharts/wiki/3.0-migration-guide` before upgrading. |
| `node-cron` | ^4.2.1 | Node.js 20, TypeScript 5.9, ESM | v4 changed the import path — use `import cron from 'node-cron'` not named import |

---

## Schema Additions Required (for Implementers)

These are not library decisions but are stack-adjacent enough to note here:

| Area | New Tables |
|------|-----------|
| Assessment Engine | `assessments`, `assessment_questions`, `assessment_responses` |
| Signal Integrations | `integration_configs` (per-tenant connector config with encrypted credentials), `signal_source_type` enum expansion |
| Foresight v2 | `foresight_simulations`, `foresight_scenarios` |
| Vendor Lifecycle | Extend existing `vendors` table + new `vendor_monitoring_config` |
| Compliance Flow | Extend existing `compliance_frameworks` + `compliance_thresholds` |

All encrypted credentials (Sentinel service principal secrets, Shodan API keys, IMAP passwords, MISP tokens) use the existing AES-256-GCM pattern from `llm_configs`. Do not invent a new encryption scheme.

---

## Sources

- [imapflow npm](https://www.npmjs.com/package/imapflow) — v1.2.9 confirmed, published 2026-03-17 (HIGH confidence)
- [mailparser npm](https://www.npmjs.com/package/mailparser) — v3.9.4 confirmed, CVE-2026-3455 patched in 3.9.3 (HIGH confidence)
- [@azure/arm-securityinsight npm](https://www.npmjs.com/package/@azure/arm-securityinsight) — v1.0.0-beta.6 latest (MEDIUM confidence — perpetual beta)
- [@azure/identity npm](https://www.npmjs.com/package/@azure/identity) — v4.13.0 confirmed (HIGH confidence)
- [Microsoft Sentinel REST API docs](https://learn.microsoft.com/en-us/rest/api/securityinsights/) — API version 2024-09-01 confirmed stable (HIGH confidence)
- [NVD Developers Start Here](https://nvd.nist.gov/developers/start-here) — API v2 rate limits confirmed, no Node.js SDK endorsed (HIGH confidence)
- [Shodan Developer API](https://developer.shodan.io/api) — REST API endpoints confirmed, official clients page lists only stale Node.js options (HIGH confidence)
- [MISP OpenAPI spec](https://www.misp-project.org/openapi/) — REST API confirmed, no maintained Node.js client (HIGH confidence)
- [shodan-client npm](https://www.npmjs.com/package/shodan-client) — v3.2.0, 6 years stale — confirmed DO NOT USE (HIGH confidence)
- [bottleneck npm](https://www.npmjs.com/package/bottleneck) — v2.19.5, 7 years stale — confirmed DO NOT USE (HIGH confidence)
- [simple-statistics npm](https://www.npmjs.com/package/simple-statistics) — v7.8.8 confirmed (HIGH confidence)
- [recharts releases](https://github.com/recharts/recharts/releases) — v3.8.0 confirmed current (HIGH confidence)
- [node-cron npm](https://www.npmjs.com/package/node-cron) — v4.2.1 confirmed (HIGH confidence)
- [p-ratelimit GitHub](https://github.com/natesilva/p-ratelimit) — TypeScript native, concurrency + interval control (MEDIUM confidence — version not confirmed from npm; check before install)
- Codebase inspection (`artifacts/api-server/package.json`, `artifacts/api-server/src/services/`, `artifacts/riskmind-app/package.json`) — existing stack confirmed (HIGH confidence)

---
*Stack research for: RiskMind v2.0 — Assessment Engine, Vendor Lifecycle, Compliance Flow, Signal Integrations, Foresight v2*
*Researched: 2026-03-23*
