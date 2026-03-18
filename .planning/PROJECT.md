# RiskMind

## What This Is

RiskMind is an AI-native multi-organization enterprise risk management platform deployed at https://app.riskmind.net. It features risk registers, third-party risk management (TPRM) with a 7-state vendor lifecycle, compliance framework tracking, AI-driven signal triage and enrichment, an autonomous risk intelligence agent, and a ⌘K command palette with semantic search. Built as a TypeScript monorepo with Express 5 API, React + Vite frontend, PostgreSQL with pgvector, and multi-tenant RBAC. Running on a dedicated Linux server with PM2 process management and Cloudflare tunnel for public HTTPS access.

## Core Value

A working, demo-ready enterprise risk management platform that an internal organization can use to manage real risks, vendors, and compliance — powered by intelligent AI routing and accessible via https://app.riskmind.net.

## Current Milestone: v1.1 — LLM Intelligence + Fixes + Polish

**Goal:** Intelligent LLM configuration with wizard-based onboarding, model auto-discovery, benchmarking, per-task routing, plus fixing audit bugs and polishing placeholder content.

**Target features:**
- LLM Config Wizard: provider dropdown, auto-fetch models, test/benchmark, smart per-task routing
- Intelligent Model Router: 6 task types → optimal model assignment
- Bug fixes: doc processor, agent findings persistence, duplicate enrichment, vendor AI errors
- Vendor scorecard real data (no more placeholders)
- Embeddings health check in Settings
- Foresight teaser page (polished preview of v2 vision)

## Requirements

### Validated

- ✓ Server deployment on dedicated Linux server with PM2 — v1.0
- ✓ Cloudflare tunnel at app.riskmind.net with CORS locked — v1.0
- ✓ PostgreSQL with pgvector, migrations, and seed data — v1.0
- ✓ Dashboard with KPI trends, heatmap drill-down, KRI bars, executive summary, alert bell — v1.0
- ✓ All list pages with skeleton loaders, empty states, pagination, search/filter, RBAC — v1.0
- ✓ Vendor kanban pipeline (7 stages) + scorecard — v1.0
- ✓ Compliance posture percentage per framework — v1.0
- ✓ ⌘K command palette with semantic search via pgvector — v1.0
- ✓ AI enrichment badges with provenance on risk detail — v1.0
- ✓ AI treatment suggestions with provenance receipts — v1.0
- ✓ Signal → Finding → Risk traceability chain — v1.0
- ✓ CSV export for risk register — v1.0
- ✓ Risk trend sparklines — v1.0
- ✓ Breadcrumbs on all detail pages — v1.0
- ✓ Toast error notifications on all mutations — v1.0
- ✓ JWT authentication with tenant-aware login and RBAC — existing
- ✓ Multi-tenant architecture with tenant-scoped data isolation — existing
- ✓ Risk register CRUD with treatments, KRIs, incidents, review cycles — existing
- ✓ TPRM vendor management with 7-state lifecycle and risk-tiered routing — existing
- ✓ Compliance framework tracking with controls, gap analysis, control testing — existing
- ✓ Signal and findings management pipeline — existing
- ✓ Alert system with monitoring, acknowledgment, resolution — existing
- ✓ AI enrichment job queue with multi-provider LLM support — existing
- ✓ AI interview sessions for risk creation and control assessment — existing
- ✓ Autonomous risk intelligence agent with configurable policy tiers — existing
- ✓ MCP endpoint for AI agent integrations — existing
- ✓ PostgreSQL with pgvector for semantic search and clustering — existing

### Active

- [ ] LLM Config Wizard — guided provider onboarding with auto-discovery
- [ ] Intelligent Model Router — per-task model assignment with benchmarks
- [ ] Bug fixes — doc processor, agent findings, enrichment stacking, vendor AI errors
- [ ] Vendor scorecard real data — computed from related tables
- [ ] Embeddings health check — Settings warning when not configured
- [ ] Model name validation — prevent invalid model IDs
- [ ] Foresight teaser page — polished "Coming Soon" preview

### Out of Scope

- Mobile native app — responsive web covers mobile
- Foresight full implementation — Monte Carlo, OSINT, scenario modeling deferred to v2
- LLM observability dashboard — token cost analytics deferred to v2
- Risk clustering UI — pgvector similarity surfaced deferred to v2
- Cross-framework control mapping — deferred to v2

## Context

- **Deployment**: Running at https://app.riskmind.net via Cloudflare tunnel → localhost:4000
- **Server**: Ubuntu Linux, PM2 process management, PostgreSQL 16 + pgvector
- **Stack**: pnpm monorepo, TypeScript 5.9, Express 5, React 19 + Vite 7, Drizzle ORM, Zod v4, shadcn/ui, Tailwind CSS v4
- **Design**: Apple-like, minimalist, elegant, ergonomic (Linear/Vercel aesthetic)
- **Generated code**: `lib/api-client-react/` and `lib/api-zod/` are Orval-generated — do not modify directly
- **AI providers**: OpenAI-compatible (covers OpenAI, Ollama, others via baseUrl) and Anthropic SDKs
- **LLM configs**: Per-tenant, encrypted API keys (AES-256-GCM), stored in `llm_configs` table
- **Known issues from v1.0 audit**: 7 bugs documented in `.planning/v1.1-scope.md`

## Constraints

- **Generated code**: Do not edit `lib/api-client-react/` or `lib/api-zod/`
- **Iterative approach**: Confirm before major architectural changes
- **ENCRYPTION_KEY**: Cannot be rotated without re-encrypting all stored LLM API keys
- **Embeddings**: Only openai_compat providers support embeddings (not Anthropic)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Migrate from Replit to dedicated server | More control, better performance, persistent deployment | ✓ Good |
| Use Cloudflare tunnel for public access | Zero-trust, Cloudflare manages SSL | ✓ Good |
| Single Express port (4000) serves API + SPA | Simpler deployment, same-origin requests | ✓ Good |
| PM2 with Node 20 --env-file | PM2 6.x env_file broken, Node native works | ✓ Good |
| ⌘K command palette with pgvector semantic search | Differentiator, shows AI-native identity | ✓ Good |
| Defer Foresight to v2 | Monte Carlo + OSINT needs deep planning | — Pending |
| Intelligent model routing | Auto-discover + benchmark + per-task assignment | — Pending |

---
*Last updated: 2026-03-18 after v1.0 milestone complete, v1.1 started*
