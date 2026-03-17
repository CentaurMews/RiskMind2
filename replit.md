# RiskMind

## Overview

RiskMind is an AI-native multi-organization enterprise risk management platform designed to provide a comprehensive solution for identifying, assessing, and mitigating risks. It offers capabilities for managing risk registers, third-party risk, compliance, and leverages AI for signal triage, enrichment, and autonomous risk intelligence. The platform aims to streamline risk operations, enhance decision-making with AI-driven insights, and ensure robust security and compliance across various organizational structures.

## User Preferences

I prefer concise and straightforward communication. When making changes, please prioritize iterative development, clearly explaining each step and its rationale. Always ask for confirmation before implementing significant architectural changes or critical business logic modifications. Do not make changes to files under `lib/api-client-react/` or `lib/api-zod/` as these are generated.

## System Architecture

RiskMind is built as a pnpm workspace monorepo using TypeScript.

**Core Technologies:**
- **Node.js**: Version 24
- **Package Manager**: pnpm
- **TypeScript**: Version 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL with Drizzle ORM and pgvector for vector embeddings.
- **Validation**: Zod (v4) and `drizzle-zod`.
- **API Codegen**: Orval, generating client code and Zod schemas from an OpenAPI spec.
- **Build System**: esbuild for CJS bundles.
- **Authentication**: Custom HMAC-SHA256 JWT implementation for access (1hr) and refresh (7d) tokens.
- **Password Hashing**: bcryptjs (12 salt rounds).

**Monorepo Structure:**
- `artifacts/api-server`: The main Express API server containing business logic, middleware (auth, RBAC), and route handlers.
- `lib/`: Shared libraries including OpenAPI spec, generated React Query hooks, generated Zod schemas, and the Drizzle ORM schema with database connection.
- `scripts/`: Utility scripts for seeding data and managing framework requirements.

**Database Schema & Features:**
- All tables use UUID primary keys and `created_at`/`updated_at` timestamps. Tenant-scoped tables include `tenant_id`.
- Key entities include `tenants`, `users` (with RBAC roles), `risks` (with pgvector embedding), `vendors`, `questionnaire_questions` (seeded question bank with core and category-specific questions), `frameworks`, `controls`, `signals`, `findings`, `alerts`, `jobs` (async queue), and `llm_configs`.
- `pgvector` is integral for embedding columns in `risks`, `vendors`, `signals`, and `framework_requirements` for AI-driven semantic search and clustering.

**Authentication & Multi-Tenancy:**
- JWT-based authentication with `tenantSlug` for tenant-aware login.
- Tenant resolution from JWT payload on every request.
- Role-Based Access Control (RBAC) with roles: admin, risk_manager, risk_owner, auditor, viewer, vendor.
- API errors conform to RFC 7807.

**API Endpoints:**
- **Public**: Health checks, user login/refresh, questionnaire submission.
- **Protected**: Comprehensive endpoints covering:
    - **Risk Register**: CRUD operations for risks, treatments, KRIs, incidents, and review cycles.
    - **TPRM**: Vendor management with 7-state lifecycle (identification → due_diligence → risk_assessment → contracting → onboarding → monitoring → offboarding), risk-tiered routing (full flow for critical/high, simplified 4-state flow for medium/low), transition validation with prerequisite checks, vendor_status_events audit trail, auto-tier computation from riskScore, manual tier overrides, questionnaires (with AI question generation, answer validation, weighted scoring), document uploads.
    - **Compliance**: Frameworks, controls, gap analysis, and control testing.
    - **Signals & Findings**: Management of incoming signals and derived findings.
    - **Alerts & Monitoring**: Listing, summarizing, acknowledging, and resolving system alerts.
    - **AI Enrichment**: Queuing jobs for AI-driven risk enrichment and document summarization.
    - **Settings**: Configuration of LLM providers per tenant.
    - **AI Interview Sessions**: Interactive AI-driven risk creation or control assessment.
    - **Autonomous Risk Intelligence Agent**: Manually triggering agent runs, managing findings, and configuring agent behavior (observe, advisory, active policy tiers).
- **Model Context Protocol (MCP)**: A streamable HTTP endpoint for AI agent integrations with 13 defined tools and JWT authentication.

**AI & Async Infrastructure:**
- **Asynchronous Job Queue**: PostgreSQL-backed, supporting exponential backoff retries and dead-lettering, with workers for AI triage, AI enrichment, and document processing.
- **LLM Service Architecture**: Multi-provider support (OpenAI-compatible, Anthropic), tenant-scoped configurations with AES-256-GCM encrypted API keys, auto-routing, and streaming capabilities.
- **Monitoring Scheduler**: Daily automated checks generating alerts for KRI breaches, overdue reviews, failed documents, failed control tests, vendor status issues, and alert escalations.

**Frontend Application (`artifacts/riskmind-app`):**
- **Framework**: React + Vite, port 19534 (reads from PORT env var)
- **Routing**: Wouter with base path support
- **State Management**: TanStack React Query with generated hooks from `@workspace/api-client-react`
- **UI Components**: shadcn/ui (Radix primitives + Tailwind CSS)
- **Design**: Monochrome enterprise design with dark sidebar, clean typography
- **Auth Flow**: JWT stored in localStorage, global fetch interceptor injects Bearer token for same-origin `/api/` requests, auto-clears on 401
- **Pages**: Login, Dashboard (KPIs + alerts + risk heatmap preview), Risk Register/Detail/Heatmap, Signals/Findings, Vendors/Detail, Compliance Frameworks/Controls, Alerts, Foresight (autonomous agent), Settings (LLM config)
- **Layout**: AppLayout wraps authenticated pages with sidebar nav, top bar with tenant badge, mobile-responsive hamburger menu

**Development & Build:**
- Leverages TypeScript composite projects and project references for efficient type checking and build processes across the monorepo.

## External Dependencies

- **PostgreSQL**: Primary database for all persistent data.
- **pgvector**: PostgreSQL extension for efficient vector similarity search, used for AI features.
- **OpenAI SDK (`openai` package)**: For integrating with OpenAI-compatible LLM providers.
- **Anthropic SDK (`@anthropic-ai/sdk`)**: For integrating with Anthropic LLM providers.
- **bcryptjs**: For secure password hashing.
- **Orval**: For generating TypeScript API clients and Zod schemas from OpenAPI specifications.
- **Zod**: Schema validation library.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL interaction.
- **Express**: Web application framework for the API server.
- **esbuild**: Bundler for efficient JavaScript builds.