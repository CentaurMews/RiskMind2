# RiskMind Changelog

All notable changes to RiskMind are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions. Versions are listed in reverse chronological order.

---

## [1.1.0] — 2026-03-18

**Milestone: LLM Intelligence + Fixes + Polish**

This release introduces a fully-capable intelligent LLM configuration layer with guided wizard onboarding, per-task model routing, and model auto-discovery. It also resolves seven bugs identified in the v1.0 audit and adds the Foresight teaser page.

### Added

#### LLM Configuration Wizard
- Six-step wizard in Settings for onboarding LLM providers without leaving the UI:
  1. Provider selection (OpenAI, Anthropic, Google Gemini, Mistral, Groq, Together AI, Ollama/Private)
  2. API key and base URL entry with live connection validation
  3. Automatic model discovery from the provider's models API
  4. Model selection from the discovered list
  5. TTFT, total latency, and quality score benchmarking
  6. Per-task routing assignment with smart defaults from benchmark results
- New `llm_task_routing` table maps six task types (`enrichment`, `triage`, `treatment`, `embeddings`, `agent`, `general`) to specific model configurations
- New `llm_benchmark_results` table stores benchmark history per model

#### Model Auto-Discovery
- `discoverModels()` service method fetches live model lists from OpenAI-compatible endpoints and Anthropic API
- OpenAI model list filtered to relevant prefixes: `gpt-4`, `gpt-4o`, `gpt-3.5`, `o1`, `o3`, `text-embedding-`
- `ANTHROPIC_MODELS` constant provides a hardcoded fallback for Anthropic models (API does not support model listing in all SDK versions)
- Model name input in provider configuration uses the discovered list — free-text entry blocked

#### Model Benchmarking
- `runBenchmark()` service method executes a standardized prompt and measures:
  - TTFT (time to first token)
  - Total latency (full response)
  - Quality heuristic score (structured JSON adherence)
- Benchmark results surface in the LLM Config Wizard to guide routing decisions

#### Intelligent Model Router
- `resolveConfig(tenantId, taskType)` implements a three-tier routing resolution:
  1. Task-specific routing table lookup
  2. Tenant default config fallback
  3. Any active config fallback
- All AI operations now thread `taskType` through the call chain
- Routing table card in Settings shows current assignments and allows admin overrides

#### Embeddings Health Warning
- Settings page displays a visible warning banner when no embeddings-capable provider is configured
- Warning explains that semantic search (⌘K) and agent clustering will degrade
- New API endpoint: `GET /v1/settings/llm/embeddings-health`

#### Foresight Teaser Page
- Polished "Coming Soon" page at the Foresight route replacing the bare stub
- Visual mockups for four planned v2 features:
  - Monte Carlo risk simulation
  - OSINT/external data forecasting
  - Agent findings inbox with approve/dismiss workflow
  - What-if scenario builder
- Uses the established minimalist design language (Linear/Vercel aesthetic)

### Fixed

#### FIX-01: Document Processor Hallucination
- Document processing worker previously returned an AI-generated summary using only the filename as input, producing hallucinated content that appeared legitimate
- Worker now returns an honest "content extraction not yet supported" stub
- No misleading AI output will surface from the document processor in this release

#### FIX-02: Agent Findings Persistence on LLM Error
- Autonomous agent previously persisted local findings (cascade chain, cluster, predictive signal) after the LLM reasoning call
- If the LLM call threw an error, the entire run was marked "skipped" with zero findings, discarding valid locally-computed detections
- Local findings are now written to `agent_findings` before the LLM call
- Run status and `findingsCount` now reflect actual persisted findings even when LLM reasoning fails

#### FIX-03: Enrichment Idempotency
- Re-enriching a risk appended a duplicate AI enrichment block to the risk detail, resulting in two or more stacked enrichment sections after multiple enrichment runs
- Re-enrichment now replaces the existing enrichment block exactly once — the risk detail always shows a single enrichment section regardless of how many times the job has run

#### FIX-04: Vendor AI Question Generation Error Message
- Vendor AI question generation returned HTTP 400 "invalid format" when the LLM returned a response that failed the JSON structure parse
- Error message was opaque and confusing for end users
- Now returns a clear, user-readable error message explaining that the AI could not generate questions in the expected format, with a prompt to retry

#### FIX-05: Vendor Scorecard Real Data
- Vendor scorecard displayed placeholder dashes for "Last Assessment Date" and "Open Findings Count"
- Both fields now computed from the database: last assessment date from the most recent control test or questionnaire completion, open findings count from `findings` linked to the vendor
- No placeholder content remains in the vendor scorecard

#### FIX-06: Embeddings Health Warning
- When no embeddings provider was configured, semantic search and agent clustering degraded silently with no indication to administrators
- Settings now shows an explicit warning banner when the embeddings health check returns no active embeddings-capable provider

#### FIX-07: Model Name Validation
- Provider configuration accepted arbitrary free-text model IDs that failed validation when the LLM was actually called
- Model name input now populated from the auto-discovered model list
- Backend rejects LLM config saves where the model ID fails provider-specific format validation

---

## [1.0.0] — 2026-03-18

**Milestone: Demo-Ready Deployment**

Initial production release. Deploys RiskMind to a dedicated Linux server, exposes via Cloudflare tunnel, and surfaces AI-native features. All core risk management, vendor, and compliance workflows are operational.

### Added

#### Server Deployment and Infrastructure
- Production deployment on dedicated Ubuntu Linux server
- PM2 process management with `ecosystem.config.cjs`
- `--env-file` loading via Node.js 20 native flag (avoids PM2 6.x `env_file` bug)
- PM2 `startup` hook for boot persistence
- `pm2-logrotate` module for log rotation
- Log files at `logs/riskmind-out.log` and `logs/riskmind-error.log`
- `1G` memory restart threshold

#### Cloudflare Tunnel
- Cloudflare tunnel at `https://app.riskmind.net`
- `cloudflared` installed as `cloudflared-riskmind` systemd service with boot persistence
- CORS locked to explicit origin allowlist (`https://app.riskmind.net`, `http://localhost:4000`)
- `res.flushHeaders()` added to SSE endpoints to prevent Cloudflare tunnel buffering

#### PostgreSQL and pgvector
- PostgreSQL 16 with `pgvector` and `uuid-ossp` extensions
- Drizzle ORM schema push — all 30+ domain tables created
- Demo seed data loaded automatically on first boot via `seedDemoDataIfEmpty()`
- Full monorepo build verified: `pnpm install`, `pnpm typecheck:libs`, `pnpm build`

#### Dashboard
- KPI cards with trend deltas (risk count, open vendors, compliance posture, active alerts)
- Risk heatmap (5x5 likelihood × impact grid) with clickable drill-down to filtered risk list
- KRI threshold indicator bars with breach highlighting
- Executive summary AI narrative panel
- Alert bell badge with unread count in navigation header

#### All List Pages
- Skeleton loaders on initial fetch for all list views
- Empty states with contextual call-to-action on all lists
- Pagination controls on all paginated endpoints (risks, vendors, signals, findings, alerts)
- Search and filter controls on all list pages
- Toast error notifications on all mutations
- RBAC-gated controls (admin-only and risk_manager-only elements hidden from viewer/auditor)
- Breadcrumb navigation on all detail pages

#### Vendor Kanban Pipeline
- Vendor pipeline page visualizes the 7-stage lifecycle as a kanban board: Identification, Due Diligence, Risk Assessment, Contracting, Onboarding, Monitoring, Offboarding
- Drag-and-drop stage transitions (with role check)
- Vendor scorecard showing risk score, tier, assessment date, and open findings count

#### Compliance Framework Tracking
- Compliance posture percentage displayed per framework
- Controls gap analysis view
- Control test recording (auditor role)

#### Command Palette (⌘K)
- Global command palette accessible via `⌘K` (Mac) / `Ctrl+K` (Windows/Linux)
- Semantic search powered by pgvector cosine similarity
- Search scope: risks, vendors, compliance frameworks, signals
- Query embedding generated via tenant's configured embeddings provider
- Fallback to lexical search when no embeddings provider is configured

#### AI Enrichment Display
- "AI Enhanced" badge on risk detail when enrichment data is present
- Collapsible AI Enrichment panel showing augmented description and treatment suggestions
- Provenance receipt on enrichment: model name, provider type, timestamp, prompt tokens, completion tokens
- Treatment suggestions displayed with confidence score and rationale

#### Signal Traceability
- Signal detail links to derived finding
- Finding detail links to resulting risk
- Risk detail shows "Sources" section listing origin (signal, finding, or agent detection)
- AI provenance displayed at each decision point in the chain

#### CSV Export
- Risk register CSV export at `GET /api/v1/risks/export`
- Includes all risk fields, owner, category, status, likelihood, impact, and risk score

#### Risk Trend Sparklines
- 90-day risk score trend sparkline on risk list and risk detail
- Per-risk trend computed from historical snapshot data

#### API Infrastructure
- Single Express 5 process serves REST API (`/api/v1/*`), MCP endpoint (`/mcp`), and React SPA (`/`)
- JWT authentication with HMAC-SHA256 custom implementation
- RFC 7807 error responses on all error paths
- Drizzle ORM with parameterized queries throughout
- Background subsystems: job queue processor, monitoring scheduler, agent scheduler
- `GET /api/v1/health` endpoint with database connectivity check

---

## Unreleased (Planned — v2.0)

Items tracked but not scheduled. See `REQUIREMENTS.md` for full future requirements.

### Planned Features
- **Monte Carlo simulation** (FORE-02) — Probabilistic risk scenario modeling
- **OSINT enrichment** (FORE-03) — External data feeds for risk horizon forecasting
- **Agent findings inbox** (FORE-04) — Approve/dismiss workflow for agent detections
- **LLM observability dashboard** (FORE-05) — Token usage, cost analytics, model performance
- **Cross-framework control mapping** (ADV-01)
- **Risk clustering UI** (ADV-02) — pgvector similarity-based grouping
- **Board-ready PDF reports** (ADV-03)
- **Automatic model failover** (ADV-04) — Provider error recovery

---

*Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)*
