# RiskMind API Reference

**Version:** 0.3.0
**Specification:** OpenAPI 3.1.0
**Base URL:** `https://app.riskmind.net/api`
**Last Updated:** 2026-03-19

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL and Versioning](#base-url-and-versioning)
4. [Error Format](#error-format)
5. [Rate Limiting](#rate-limiting)
6. [Endpoint Groups](#endpoint-groups)
   - [Health](#health)
   - [Auth](#auth)
   - [Risks](#risks)
   - [Vendors](#vendors)
   - [Compliance](#compliance)
   - [Signals](#signals)
   - [Findings](#findings)
   - [Alerts](#alerts)
   - [AI Enrichment](#ai-enrichment)
   - [AI Interviews](#ai-interviews)
   - [Agent](#agent)
   - [Settings](#settings)
   - [Users](#users)
   - [Search](#search)
   - [Foresight](#foresight)
   - [MCP](#mcp)
7. [Common Data Types](#common-data-types)
8. [OpenAPI Specification](#openapi-specification)

---

## Overview

The RiskMind API is a JSON REST API built on Express 5. It uses JWT Bearer token authentication. All protected endpoints require a valid access token. The API version is embedded in the URL path (`/v1/`).

The single Express process on port 4000 serves both:
- The REST API at `/api/v1/*`
- The MCP endpoint at `/mcp`
- The React SPA at all other paths (static fallback)

All API requests and responses use `Content-Type: application/json`.

---

## Authentication

### Flow

```
1. POST /api/v1/auth/login
   Body: { email, password }
   Response: { accessToken, refreshToken, user }

2. Include accessToken in all subsequent requests:
   Authorization: Bearer <accessToken>

3. When accessToken expires (1 hour), use refreshToken:
   POST /api/v1/auth/refresh
   Body: { refreshToken }
   Response: { accessToken, refreshToken }

4. On logout:
   POST /api/v1/auth/logout
```

### Token Details

| Property | Value |
|---|---|
| Algorithm | HMAC-SHA256 (custom JWT implementation) |
| Access token expiry | 3600 seconds (1 hour) |
| Refresh token expiry | 604800 seconds (7 days) |
| Header format | `Authorization: Bearer <token>` |
| Payload fields | `sub` (user ID), `tenantId`, `email`, `role`, `type`, `iat`, `exp` |

### Token Payload Example

```json
{
  "sub": "a1b2c3d4-...",
  "tenantId": "e5f6g7h8-...",
  "email": "user@example.com",
  "role": "risk_manager",
  "type": "access",
  "iat": 1742380800,
  "exp": 1742384400
}
```

### Public Endpoints (no authentication required)

The following endpoints do not require a Bearer token:

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/vendors/portal/*` (vendor self-service portal)

All other endpoints require a valid access token.

---

## Base URL and Versioning

| Environment | Base URL |
|---|---|
| Production | `https://app.riskmind.net/api` |
| Local development | `http://localhost:4000/api` |

All versioned endpoints are prefixed with `/v1/`. Example:

```
GET https://app.riskmind.net/api/v1/risks
```

The OpenAPI spec declares `servers: [{ url: /api }]` so relative paths in the spec omit the `/api` prefix.

---

## Error Format

All API errors follow [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807) format:

```json
{
  "type": "https://riskmind.app/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Risk with ID a1b2c3d4 not found in this tenant"
}
```

### Error Response Fields

| Field | Type | Description |
|---|---|---|
| `type` | string (URI) | Machine-readable error type URI |
| `title` | string | Human-readable error title |
| `status` | integer | HTTP status code (mirrors response status) |
| `detail` | string (optional) | Specific detail about this error instance |

### Standard Error Codes

| Status | Title | Typical Cause |
|---|---|---|
| 400 | Bad Request | Invalid JSON body, Zod validation failure |
| 401 | Unauthorized | Missing, invalid, or expired Bearer token |
| 403 | Forbidden | Authenticated user's role lacks permission |
| 404 | Not Found | Resource does not exist or belongs to another tenant |
| 409 | Conflict | Duplicate resource (e.g., email already registered) |
| 500 | Internal Server Error | Unhandled server exception |
| 503 | Service Unavailable | Database connectivity failure (health check only) |

### Validation Error Example

```json
{
  "type": "https://riskmind.app/errors/bad-request",
  "title": "Bad Request",
  "status": 400,
  "detail": "likelihood must be an integer between 1 and 5"
}
```

---

## Rate Limiting

No application-level rate limiting is currently configured. Cloudflare provides network-layer DDoS protection and rate limiting at the edge. Application-level limits will be added in a future release.

---

## Endpoint Groups

### Health

Unauthenticated. Used for load balancer health checks and uptime monitoring.

| Method | Path | Description |
|---|---|---|
| GET | `/v1/health` | Returns server health and database connectivity status |

**Response (200 Healthy):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-03-19T10:00:00.000Z"
}
```

**Response (503 Degraded):**
```json
{
  "status": "degraded",
  "database": "error",
  "timestamp": "2026-03-19T10:00:00.000Z"
}
```

---

### Auth

Authentication and session management.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/v1/auth/login` | None | Authenticate with email + password, receive JWT pair |
| POST | `/v1/auth/refresh` | None | Exchange refresh token for new access token |
| GET | `/v1/auth/me` | Bearer | Return authenticated user profile and role |
| POST | `/v1/auth/logout` | Bearer | Invalidate session (client-side token disposal) |

**Login Request:**
```json
{
  "email": "admin@acme.com",
  "password": "..."
}
```

**Login Response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "admin@acme.com",
    "name": "Alice Admin",
    "role": "admin",
    "tenantId": "uuid"
  }
}
```

---

### Risks

Core risk register operations. Supports full CRUD, sub-resources (treatments, KRIs, incidents, review cycles), and AI enrichment triggering.

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/v1/risks` | Any | List risks with pagination, filter by status/category |
| POST | `/v1/risks` | risk_manager, admin | Create a new risk |
| GET | `/v1/risks/:id` | Any | Retrieve risk detail with enrichment and sources |
| PUT | `/v1/risks/:id` | risk_manager, risk_owner, admin | Update risk fields |
| DELETE | `/v1/risks/:id` | admin | Delete a risk |
| GET | `/v1/risks/:id/treatments` | Any | List treatments for a risk |
| POST | `/v1/risks/:id/treatments` | risk_manager, admin | Add a treatment |
| PUT | `/v1/risks/:id/treatments/:tid` | risk_manager, admin | Update a treatment |
| DELETE | `/v1/risks/:id/treatments/:tid` | admin | Delete a treatment |
| GET | `/v1/risks/:id/kris` | Any | List KRIs for a risk |
| POST | `/v1/risks/:id/kris` | risk_manager, admin | Add a KRI |
| GET | `/v1/risks/:id/incidents` | Any | List incidents linked to a risk |
| POST | `/v1/risks/:id/incidents` | risk_manager, admin | Record an incident |
| GET | `/v1/risks/:id/review-cycles` | Any | List review cycles |
| POST | `/v1/risks/:id/review-cycles` | risk_manager, admin | Schedule a review |
| GET | `/v1/kris` | Any | List all KRIs tenant-wide (dashboard widget) |
| GET | `/v1/risks/export` | Any | Export risk register as CSV |

**Risk Status Values:** `draft`, `open`, `mitigated`, `accepted`, `closed`

**Risk Category Values:** `operational`, `financial`, `compliance`, `strategic`, `technology`, `reputational`

**Risk Score Calculation:** `likelihood (1-5) × impact (1-5)` = raw score 1–25

---

### Vendors

Third-party risk management (TPRM) with a 7-state vendor lifecycle and a public portal for vendor self-service questionnaire responses.

| Method | Path | Auth | Required Role | Description |
|---|---|---|---|---|
| GET | `/v1/vendors` | Bearer | Any | List vendors with status/tier filter |
| POST | `/v1/vendors` | Bearer | risk_manager, admin | Create a vendor |
| GET | `/v1/vendors/:id` | Bearer | Any | Vendor detail with scorecard |
| PUT | `/v1/vendors/:id` | Bearer | risk_manager, admin | Update vendor fields or tier override |
| DELETE | `/v1/vendors/:id` | Bearer | admin | Delete a vendor |
| POST | `/v1/vendors/:id/transition` | Bearer | risk_manager, admin | Advance vendor lifecycle state |
| GET | `/v1/vendors/:id/questionnaires` | Bearer | Any | List questionnaires |
| POST | `/v1/vendors/:id/questionnaires` | Bearer | risk_manager, admin | Create questionnaire |
| GET | `/v1/vendors/:id/documents` | Bearer | Any | List uploaded documents |
| POST | `/v1/vendors/:id/documents` | Bearer | risk_manager, admin | Upload document metadata |
| POST | `/v1/vendors/:id/ai-questions` | Bearer | risk_manager, admin | AI-generate questionnaire questions |
| GET | `/v1/vendors/portal/:token` | None | — | Public portal: load questionnaire |
| POST | `/v1/vendors/portal/:token` | None | — | Public portal: submit responses |

**Vendor Lifecycle States (ordered):**

```
identification → due_diligence → risk_assessment → contracting → onboarding → monitoring → offboarding
```

**Vendor Tier Values:** `critical`, `high`, `medium`, `low`

---

### Compliance

Compliance framework tracking with controls, gap analysis, and control testing.

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/v1/compliance/frameworks` | Any | List frameworks with posture percentage |
| POST | `/v1/compliance/frameworks` | admin | Create a compliance framework |
| GET | `/v1/compliance/frameworks/:id` | Any | Framework detail with requirements |
| GET | `/v1/compliance/frameworks/:id/controls` | Any | Controls mapped to framework requirements |
| GET | `/v1/compliance/controls` | Any | List all controls tenant-wide |
| POST | `/v1/compliance/controls` | risk_manager, admin | Create a control |
| GET | `/v1/compliance/controls/:id` | Any | Control detail with test history |
| PUT | `/v1/compliance/controls/:id` | risk_manager, admin | Update control |
| POST | `/v1/compliance/controls/:id/tests` | auditor, risk_manager, admin | Record a control test result |
| GET | `/v1/compliance/gap-analysis` | Any | Gap analysis across all frameworks |

**Posture Percentage Calculation:** `(controls_passing / controls_mapped) × 100`

---

### Signals

Signal ingestion and AI-assisted triage pipeline.

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/v1/signals` | Any | List signals with status filter |
| POST | `/v1/signals` | risk_manager, admin | Ingest a new signal |
| GET | `/v1/signals/:id` | Any | Signal detail with triage result and linked finding |
| PUT | `/v1/signals/:id` | risk_manager, admin | Update signal classification or status |
| DELETE | `/v1/signals/:id` | admin | Delete a signal |
| POST | `/v1/signals/:id/triage` | risk_manager, admin | Trigger AI triage on a signal |

**Signal Status Values:** `pending`, `triaged`, `finding`, `dismissed`

**Traceability:** A triaged signal links to its derived finding via `findings.signal_id`. The finding links to the resulting risk via `risk_sources.finding_id`.

---

### Findings

Findings management — the middle layer of the Signal → Finding → Risk traceability chain.

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/v1/findings` | Any | List findings with status filter |
| POST | `/v1/findings` | risk_manager, admin | Create a finding manually |
| GET | `/v1/findings/:id` | Any | Finding detail with signal and risk links |
| PUT | `/v1/findings/:id` | risk_manager, admin | Update finding status or description |
| DELETE | `/v1/findings/:id` | admin | Delete a finding |

**Finding Status Values:** `open`, `investigating`, `resolved`, `false_positive`

---

### Alerts

Alert monitoring, acknowledgment, and resolution.

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/v1/alerts` | Any | List alerts (unread count drives dashboard bell) |
| GET | `/v1/alerts/:id` | Any | Alert detail |
| POST | `/v1/alerts/:id/acknowledge` | Any | Acknowledge an alert |
| POST | `/v1/alerts/:id/resolve` | risk_manager, admin | Mark alert resolved |

Alerts are created automatically by the monitoring scheduler when KRI thresholds are breached.

---

### AI Enrichment

Async AI enrichment jobs. Enqueues background work and returns a `job_id` for status polling.

| Method | Path | Required Role | Description |
|---|---|---|---|
| POST | `/v1/ai/enrich/risk/:id` | risk_manager, admin | Enqueue enrichment job for a risk |
| GET | `/v1/jobs/:id` | Any | Poll job status (pending, running, complete, failed) |

**Enrichment produces:**
- Augmented risk description with AI-generated narrative
- Treatment suggestions with confidence scores and rationale
- Provenance receipt: model name, provider, timestamp, token counts

Re-enriching a risk replaces the existing enrichment block exactly once (idempotent per FIX-03).

---

### AI Interviews

Streaming AI-powered interview sessions for guided risk creation and control assessment. Responses are Server-Sent Events (SSE).

| Method | Path | Required Role | Description |
|---|---|---|---|
| POST | `/v1/ai/interview/start` | risk_manager, admin | Start a new interview session |
| POST | `/v1/ai/interview/:sessionId/respond` | risk_manager, admin | Send user message, receive streamed AI response (SSE) |
| POST | `/v1/ai/interview/:sessionId/complete` | risk_manager, admin | Finalize session and extract structured data |
| GET | `/v1/ai/interview/:sessionId` | Any | Retrieve session transcript |

**SSE Stream Format:**

```
data: {"type":"text","content":"Let me assess"}
data: {"type":"text","content":" this risk..."}
data: {"type":"done","content":""}
```

The SSE stream uses `res.flushHeaders()` to ensure Cloudflare does not buffer tokens. Interview sessions are stored in `interview_sessions` table with full transcript.

---

### Agent

Autonomous Risk Intelligence Agent management. Controls runs, findings, queue, and policy configuration.

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/v1/agent/runs` | Any | List agent run history |
| POST | `/v1/agent/runs` | admin | Trigger a manual agent run |
| GET | `/v1/agent/runs/:id` | Any | Run detail with findings count |
| GET | `/v1/agent/findings` | Any | List agent-generated findings |
| GET | `/v1/agent/findings/:id` | Any | Finding detail with reasoning chain |
| PUT | `/v1/agent/findings/:id` | risk_manager, admin | Update finding status (acknowledge, dismiss, action) |
| GET | `/v1/agent/config` | admin | Get agent configuration (policy tier, schedule) |
| PUT | `/v1/agent/config` | admin | Update agent configuration |
| GET | `/v1/agent/queue` | admin | View pending items in the agent's work queue |

**Agent Finding Types:** `cascade_chain`, `cluster`, `predictive_signal`, `anomaly`, `cross_domain`, `recommendation`

**Agent Finding Severity:** `critical`, `high`, `medium`, `low`, `info`

**Policy Tiers:**

| Tier | Behavior |
|---|---|
| `observe` | Analyze and record findings only, no automated actions |
| `advisory` | Surface findings in UI with recommended actions |
| `active` | Agent may trigger enrichment and alert jobs automatically |

---

### Settings

LLM provider configuration, model routing, and platform settings. All settings endpoints require `admin` role.

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/v1/settings/llm` | admin | List configured LLM providers |
| POST | `/v1/settings/llm` | admin | Add a new LLM provider configuration |
| PUT | `/v1/settings/llm/:id` | admin | Update an LLM provider configuration |
| DELETE | `/v1/settings/llm/:id` | admin | Remove an LLM provider |
| POST | `/v1/settings/llm/:id/discover` | admin | Auto-discover available models from the provider |
| POST | `/v1/settings/llm/:id/benchmark` | admin | Run TTFT + quality benchmark on a specific model |
| GET | `/v1/settings/llm/routing` | admin | List task-to-model routing table |
| PUT | `/v1/settings/llm/routing/:taskType` | admin | Update routing assignment for a task type |
| GET | `/v1/settings/llm/embeddings-health` | admin | Check embeddings provider configuration status |

**Provider Types:** `openai_compat` (OpenAI, Ollama, Groq, Together AI, Mistral, Google Gemini via proxy), `anthropic`

**Task Types for Routing:** `enrichment`, `triage`, `treatment`, `embeddings`, `agent`, `general`

**Benchmark Response:**
```json
{
  "configId": "uuid",
  "model": "gpt-4o",
  "ttftMs": 342,
  "totalMs": 1820,
  "qualityScore": 0.91,
  "response": { "severity": "high", "category": "vendor", "summary": "..." }
}
```

---

### Users

User management within the authenticated tenant.

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/v1/users` | admin | List users in tenant |
| POST | `/v1/users` | admin | Create a user (admin sets initial password) |
| GET | `/v1/users/:id` | admin | User detail |
| PUT | `/v1/users/:id` | admin | Update user name, role |
| DELETE | `/v1/users/:id` | admin | Deactivate/remove user |

---

### Search

Semantic search powered by pgvector cosine similarity. Backs the ⌘K command palette.

| Method | Path | Required Role | Description |
|---|---|---|---|
| POST | `/v1/search` | Any | Semantic search across risks, vendors, signals, frameworks |

**Request:**
```json
{
  "query": "vendor without SOC 2 certification",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "type": "risk",
      "id": "uuid",
      "title": "Third-party vendor compliance gap",
      "score": 0.923,
      "excerpt": "Vendor XYZ lacks SOC 2 Type II..."
    },
    {
      "type": "vendor",
      "id": "uuid",
      "title": "Vendor XYZ",
      "score": 0.891,
      "excerpt": "Category: SaaS, Tier: critical"
    }
  ]
}
```

If no embeddings provider is configured for the tenant, search falls back to lexical matching and returns a degraded results set.

---

### Foresight

Preview of upcoming v2 intelligence features. Currently returns placeholder data for the teaser UI.

| Method | Path | Required Role | Description |
|---|---|---|---|
| GET | `/v1/foresight` | Any | Foresight teaser data (not yet implemented) |

---

### MCP

Model Context Protocol (MCP) Streamable HTTP endpoint for AI agent integrations.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/mcp` | Varies | MCP request handling |
| GET | `/mcp` | Varies | MCP SSE stream or capability discovery |
| DELETE | `/mcp` | Varies | MCP session teardown |

Note: `/mcp` is mounted outside the `/api` prefix and outside the standard `authMiddleware` chain. Authentication within MCP sessions is handled by the MCP protocol layer.

---

## Common Data Types

### UUID

All identifiers are UUID v4 strings. Example: `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`

### Timestamps

All timestamps use ISO 8601 format with UTC timezone: `"2026-03-19T10:00:00.000Z"`

### Pagination

List endpoints accept:
- `page` (integer, default 1)
- `limit` (integer, default 20, max 100)

Response includes:
```json
{
  "data": [...],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

### RBAC Roles

| Role | Description |
|---|---|
| `admin` | Full access to all resources and settings |
| `risk_manager` | Create, update, delete risks, vendors, compliance, signals |
| `risk_owner` | Update own risks, view all |
| `risk_executive` | Read-only with executive summary access |
| `auditor` | Read-only plus control test recording |
| `viewer` | Read-only, no mutations |
| `vendor` | Access limited to vendor portal endpoints only |

---

## OpenAPI Specification

The canonical API specification is located at:

```
lib/api-spec/openapi.yaml
```

This is the source of truth for all endpoint definitions, request/response schemas, and data types. The Orval code generator consumes this file to produce:

- `lib/api-zod/` — runtime Zod validation schemas
- `lib/api-client-react/` — React Query hooks for the frontend

When making changes to the API, update `openapi.yaml` first, then run Orval codegen. Never edit the generated files directly.

**Spec version:** OpenAPI 3.1.0
**API version:** 0.3.0
