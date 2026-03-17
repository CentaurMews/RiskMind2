# Architecture Research

**Domain:** TypeScript monorepo deployment — Express 5 API + React/Vite frontend + PostgreSQL/pgvector on dedicated Linux server with Cloudflare tunnel
**Researched:** 2026-03-17
**Confidence:** HIGH (derived from direct codebase inspection, not training data)

---

## System Overview

```
Internet
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  Cloudflare Edge (CDN + DDoS + TLS termination)            │
│  riskmind.yourdomain.com → HTTPS                           │
└──────────────────────┬─────────────────────────────────────┘
                       │ QUIC/HTTP2 (encrypted)
                       ▼
┌────────────────────────────────────────────────────────────┐
│  cloudflared daemon (port 20241, already running)          │
│  Cloudflare tunnel — terminates TLS, forwards plain HTTP   │
│  Target: http://localhost:PORT (single ingress target)     │
└──────────────────────┬─────────────────────────────────────┘
                       │ HTTP (loopback only)
                       ▼
┌────────────────────────────────────────────────────────────┐
│  Express API Server (artifacts/api-server)                 │
│  Port: 4000 (suggested — all others occupied)              │
│  Serves: /api/v1/*, /mcp (POST/GET/DELETE)                 │
│  Also serves: dist/public/** (React static bundle)         │
│  Catches: * → index.html (SPA fallback)                    │
└──────────┬─────────────────────────────────────────────────┘
           │ pg connection pool (DATABASE_URL)
           ▼
┌────────────────────────────────────────────────────────────┐
│  PostgreSQL 5432 (localhost only)                          │
│  Database: riskmind (new, created fresh)                   │
│  Extensions: vector (pgvector)                             │
│  Managed by: Drizzle ORM + drizzle-kit migrations          │
└────────────────────────────────────────────────────────────┘

External services (outbound only, no inbound ports):
  Express → OpenAI API (HTTPS)
  Express → Anthropic API (HTTPS)
```

---

## Component Boundaries

| Component | Location | Responsibility | Port | Communicates With |
|-----------|----------|---------------|------|-------------------|
| cloudflared | system service | TLS termination, public URL, forwards to local port | 20241 (loopback) | Cloudflare edge (outbound), Express (loopback) |
| Express API | `artifacts/api-server` | REST API, MCP endpoint, static file serving, JWT auth, job queue, AI workers | 4000 | PostgreSQL, OpenAI, Anthropic |
| React frontend | `artifacts/riskmind-app` | SPA — built to `dist/public/`, served by Express | N/A (static files) | Express via relative `/api/v1/` URLs |
| PostgreSQL | system service | Persistent data, pgvector semantic search | 5432 (loopback) | Express only |
| `lib/db` | `lib/db` | Shared schema, Drizzle client, migrations, bootstrap | — | Imported by Express |
| `lib/api-client-react` | `lib/api-client-react` | Orval-generated React Query hooks — do not edit | — | Imported by React app |
| `lib/api-zod` | `lib/api-zod` | Orval-generated Zod schemas — do not edit | — | Imported by Express + React |
| `lib/api-spec` | `lib/api-spec` | OpenAPI spec source — input to Orval codegen | — | Orval only |

---

## Deployment Architecture: Single-Process, No Nginx

**Key insight from codebase inspection:** The frontend uses `fetch` with same-origin relative URLs (`/api/v1/...`) and no `VITE_API_URL` environment variable. There is no Vite dev proxy configuration. This means in production:

- The React app must be served from the same origin as the API.
- Express must serve the built `dist/public/` static bundle AND handle `/api/v1/` routes.
- No separate frontend process is needed in production.
- No reverse proxy (nginx) is required — Express is the single HTTP listener.

The Cloudflare tunnel points to one port. That port must serve both the SPA and the API.

**Dev vs Production modes:**

```
PRODUCTION (what we are building):
  cloudflared → Express :4000
                  ├── /api/v1/*  → route handlers
                  ├── /mcp       → MCP handler
                  └── /*         → serve dist/public/ (built React app)
                                   fallback: index.html (SPA routing)

DEVELOPMENT (optional, separate from tunnel):
  Terminal 1: Express dev :4000   (tsx src/index.ts, PORT=4000)
  Terminal 2: Vite dev :8080      (vite --config vite.config.ts)
              └── Vite proxy /api → http://localhost:4000
```

---

## Port Allocation Strategy

Occupied ports (do not use):
- 22 — SSH
- 3000 — unknown node process
- 5037 — ADB (Android Debug Bridge)
- 5173 — existing node/Vite process
- 5432 — PostgreSQL
- 9323 — unknown node process
- 20241 — cloudflared (loopback)

Recommended port assignment:

| Service | Port | Binding | Rationale |
|---------|------|---------|-----------|
| Express API (production) | 4000 | 0.0.0.0 or 127.0.0.1 | Free, conventional Express port |
| Vite dev server (dev only) | 8080 | 0.0.0.0 | Free, conventional dev alt |
| cloudflared tunnel target | 4000 | — | Points to Express |

Configure via `.env` in `artifacts/api-server/`:
```
PORT=4000
DATABASE_URL=postgresql://riskmind:PASSWORD@localhost:5432/riskmind
NODE_ENV=production
JWT_SECRET=...
```

Configure via `.env` in `artifacts/riskmind-app/` (dev only):
```
PORT=8080
```

---

## Data Flow

### HTTP Request Flow (Production)

```
Browser request (GET /dashboard)
    │
    ▼ HTTPS
Cloudflare edge
    │
    ▼ HTTP
cloudflared :20241
    │
    ▼ HTTP loopback
Express :4000
    │
    ├── path matches /api/v1/* ?
    │       ├── JWT middleware (Authorization header or cookie)
    │       ├── tenant-scoping middleware
    │       └── route handler → Drizzle ORM → PostgreSQL → JSON response
    │
    ├── path matches /mcp ?
    │       └── MCP session handler → tools → Drizzle ORM → PostgreSQL
    │
    └── all other paths
            └── serve dist/public/index.html (SPA fallback)
                    └── React app boots, calls /api/v1/* relative
```

### API Call Flow (from React SPA)

```
React component (via Orval-generated hook)
    │
    ▼
customFetch() in lib/api-client-react
    │
    ▼
fetch-interceptor (injects Bearer token from localStorage)
    │
    ▼ GET/POST /api/v1/risks (same-origin, no cross-origin)
Express route handler
    │
    ▼
JWT verification → tenant extraction
    │
    ▼
Drizzle ORM query (tenant-scoped WHERE clause)
    │
    ▼
PostgreSQL (localhost:5432)
    │
    ▼
JSON response
    │
    ▼
React Query cache → component re-render
```

### AI Job Flow (async)

```
API route handler
    │
    ▼
enqueueJob() → INSERT into jobs table (PostgreSQL)
    │
    ▼ (polling interval, same process)
Job processor (lib/job-queue.ts)
    │
    ▼
AI worker (lib/ai-workers.ts)
    │
    ▼
LLM service → OpenAI or Anthropic API (outbound HTTPS)
    │
    ▼
UPDATE risk/signal/vendor in PostgreSQL
    │
    ▼
Next API poll returns enriched data to frontend
```

---

## Build Order (Dependencies Between Components)

Build must follow this dependency order:

```
Step 1: lib/db          (no workspace deps)
Step 2: lib/api-spec    (no workspace deps — OpenAPI source)
Step 3: lib/api-zod     (depends on lib/api-spec via Orval)
Step 4: lib/api-client-react  (depends on lib/api-zod)
Step 5: artifacts/api-server  (depends on lib/db, lib/api-zod)
Step 6: artifacts/riskmind-app (depends on lib/api-client-react)
```

The root workspace `build` script (`pnpm run build`) uses `pnpm -r` which respects this via pnpm workspace topology.

**Production artifact locations after build:**
- `artifacts/api-server/dist/index.cjs` — bundled Express server (CJS)
- `artifacts/riskmind-app/dist/public/` — built React SPA (HTML/CSS/JS)

Express must be configured to serve `riskmind-app/dist/public/` as its static directory before the SPA fallback catch-all.

---

## Architectural Patterns

### Pattern 1: Express Serves SPA Static Files

**What:** Express is the single HTTP listener. It serves the React build as static files and falls back to `index.html` for any unmatched route.

**When to use:** When the SPA uses same-origin relative API URLs, making a separate server or reverse proxy unnecessary.

**Trade-offs:** Simpler ops (one process, one port), less isolation between static serving and API. Acceptable for internal/small-scale deployment.

**Implementation sketch:**
```typescript
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, "../../riskmind-app/dist/public");

app.use(express.static(staticDir));

// After all /api/v1/* routes:
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});
```

### Pattern 2: In-Process Job Queue (PostgreSQL-backed)

**What:** Background AI enrichment jobs are stored in the `jobs` table and polled by a worker running in the same Express process. No external queue (Redis, RabbitMQ) needed.

**When to use:** Single-server deployment, moderate job volume, simpler ops.

**Trade-offs:** Polling latency (configurable), no horizontal scaling of workers, but zero additional infrastructure.

### Pattern 3: Tenant-Scoped Data Isolation

**What:** All database queries include a `tenant_id` filter derived from the JWT claim. No row-level security at the database level — enforced at the ORM/application layer.

**When to use:** Multi-tenant SaaS with application-layer isolation.

**Trade-offs:** Application bugs can leak cross-tenant data. For internal deployment with trusted users, acceptable risk. A future hardening step could add PostgreSQL RLS.

---

## Anti-Patterns

### Anti-Pattern 1: Running Vite Dev Server as Production Frontend

**What people do:** Start `vite dev` on a port, point the tunnel at it.

**Why it's wrong:** Vite dev server is not a production server — no caching, HMR overhead, no source map stripping, exposes source files. Also requires a proxy config to forward `/api/v1/` to Express.

**Do this instead:** Run `vite build` → serve `dist/public/` from Express static middleware.

### Anti-Pattern 2: Pointing Cloudflare Tunnel at Vite Port

**What people do:** Route the tunnel to port 5173 or 8080 where Vite is listening.

**Why it's wrong:** Vite is not production-ready; loses the single-origin constraint; API on a different port requires CORS and a proxy.

**Do this instead:** Tunnel points to Express. Express serves static + API from same port.

### Anti-Pattern 3: Separate Frontend + Nginx + API

**What people do:** Nginx on port 80 → proxy `/api/` to Express, serve `/` as static files.

**Why it's wrong:** Adds an nginx dependency and config file to maintain. The codebase already calls relative URLs — nginx is unnecessary overhead.

**Do this instead:** Express static + SPA fallback. One process, one port, no nginx.

### Anti-Pattern 4: Editing Orval-Generated Files

**What people do:** Modify `lib/api-client-react/src/generated/` or `lib/api-zod/src/generated/` directly.

**Why it's wrong:** These are regenerated from `lib/api-spec` by Orval. All manual edits are silently overwritten on the next `pnpm run codegen`.

**Do this instead:** Change the OpenAPI spec in `lib/api-spec`, then regenerate.

### Anti-Pattern 5: Binding Express to 0.0.0.0 in Production Without Firewall

**What people do:** `app.listen(4000)` (binds all interfaces) without a firewall rule.

**Why it's wrong:** Port 4000 is then directly accessible from the internet, bypassing Cloudflare's security (DDoS, bot protection, access policies).

**Do this instead:** Bind to `127.0.0.1:4000` so only loopback traffic (from cloudflared) can reach Express. Or keep `0.0.0.0` but add a `ufw` rule to block external access to 4000.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Cloudflare Tunnel | cloudflared daemon → loopback HTTP to Express | Already running; reconfigure ingress to point to port 4000 |
| OpenAI API | Outbound HTTPS from Express job workers | Per-tenant encrypted API keys stored in DB |
| Anthropic API | Outbound HTTPS from Express job workers | Per-tenant encrypted API keys stored in DB |
| PostgreSQL | `pg` connection pool via `DATABASE_URL` env var | localhost:5432, requires `pgvector` extension |

### Internal Workspace Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `api-server` ↔ `lib/db` | Direct TypeScript import | Drizzle client + schema shared via workspace package |
| `api-server` ↔ `lib/api-zod` | Direct TypeScript import | Request/response Zod schemas for validation |
| `riskmind-app` ↔ `lib/api-client-react` | Direct TypeScript import | React Query hooks (Orval-generated) |
| `riskmind-app` ↔ `lib/api-zod` | Direct TypeScript import | Shared type definitions |
| `api-server` ↔ `riskmind-app` | None at runtime | Frontend is a static build; they share no runtime import |

---

## Deployment Sequence (Build Order for Milestone)

This sequence ensures each step has its prerequisites satisfied:

```
1. Database setup
   - Create database: CREATE DATABASE riskmind;
   - Create user with password, grant privileges
   - Ensure pgvector extension (lib/db bootstrap handles this)

2. Install dependencies
   - pnpm install (from monorepo root)

3. Bootstrap database
   - pnpm --filter @workspace/db run push
   - (runs bootstrap.ts to create vector extension, then drizzle-kit push)

4. Build API server
   - pnpm --filter @workspace/api-server run build
   - Output: artifacts/api-server/dist/index.cjs

5. Build React frontend
   - pnpm --filter @workspace/riskmind-app run build
   - Output: artifacts/riskmind-app/dist/public/

6. Configure Express to serve static files from step 5 output
   - Add static middleware + SPA fallback to api-server

7. Configure environment
   - artifacts/api-server/.env  (PORT=4000, DATABASE_URL, NODE_ENV=production, JWT_SECRET, etc.)

8. Reconfigure cloudflared tunnel
   - Update ingress in Cloudflare dashboard to route to http://localhost:4000
   - Or update cloudflared config.yaml if present

9. Start API server
   - node artifacts/api-server/dist/index.cjs
   - Or: process manager (systemd unit or pm2)

10. Verify
    - curl http://localhost:4000/api/v1/health
    - curl https://riskmind.yourdomain.com/api/v1/health
    - Open SPA in browser
```

---

## Scaling Considerations

This is an internal deployment, not public SaaS. Scale targets are realistic:

| Scale | Architecture | Notes |
|-------|-------------|-------|
| 1-20 users (current target) | Single Express process, single Vite build, single PG instance | Current architecture is appropriate |
| 20-200 users | Add Redis for job queue; add pg connection pool tuning | Job polling may need faster response; PG connections multiply |
| 200+ users | Split API from static serving (nginx or CDN); add read replicas | Unlikely for internal use; overkill |

**First bottleneck:** The in-process job queue — long-running AI enrichment jobs block the poll loop. Mitigation: configure `delayMs` and `maxAttempts` conservatively; run multiple poll intervals per queue type.

**Second bottleneck:** PostgreSQL connection pool under concurrent requests. Mitigation: tune `max` in `pg.Pool` config in `lib/db`.

---

## Sources

- Direct inspection of `artifacts/api-server/src/index.ts`, `app.ts`, `build.ts`
- Direct inspection of `artifacts/riskmind-app/vite.config.ts`
- Direct inspection of `lib/api-client-react/src/custom-fetch.ts` and `src/fetch-interceptor.ts`
- Direct inspection of `lib/db/src/bootstrap.ts`
- `ss -tlnp` output confirming occupied ports on the live server
- `systemctl status cloudflared` confirming tunnel is active on port 20241

---

*Architecture research for: RiskMind deployment — TypeScript monorepo on dedicated Linux server with Cloudflare tunnel*
*Researched: 2026-03-17*
