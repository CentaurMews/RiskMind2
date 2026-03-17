# Pitfalls Research

**Domain:** Replit-to-server migration + Cloudflare tunnel deployment + ERM platform improvement
**Researched:** 2026-03-17
**Confidence:** HIGH (codebase inspected directly; pitfalls derived from actual code analysis)

---

## Critical Pitfalls

### Pitfall 1: Replit SDK Left in Production Build

**What goes wrong:**
`package.json` at the workspace root lists `@replit/connectors-sdk` as a dependency. `vite.config.ts` conditionally loads `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner`. The `button.tsx` and `badge.tsx` components also import from Replit packages. On a bare Linux server these packages either fail to install correctly (native bindings), throw at import time, or silently no-op — but the dependency remains in the bundle and `pnpm install` may fail or produce warnings that mask real errors.

**Why it happens:**
The code was developed on Replit, which injects its own plugin infrastructure. The conditional guard (`process.env.REPL_ID !== undefined`) prevents runtime activation, but the packages are still installed and bundled.

**How to avoid:**
Remove `@replit/connectors-sdk` from `package.json` at the workspace root. Remove `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, and `@replit/vite-plugin-dev-banner` from `artifacts/riskmind-app/package.json`. Remove all import/require of these packages from `vite.config.ts` and any UI components. Verify with `pnpm install --frozen-lockfile` and `pnpm run build` after removal.

**Warning signs:**
- `pnpm install` emits peer-dependency warnings for `@replit/*`
- Build output includes `@replit` chunk in bundle analysis
- Any reference to `REPL_ID` env var in production config files

**Phase to address:** Phase 1 (Server Setup & Migration)

---

### Pitfall 2: Missing Environment Variables Cause Silent or Explosive Failures

**What goes wrong:**
The server fails loudly for `DATABASE_URL`, `PORT`, and `JWT_SECRET` (all throw `Error` at startup). But `ENCRYPTION_KEY` only throws when a tenant's LLM API key is first accessed — the server starts fine, then crashes mid-request when the first AI feature is used. This looks like an intermittent bug rather than a configuration problem.

**Why it happens:**
`getEncryptionKey()` in `encryption.ts` is called lazily per-request rather than at startup. Similarly, `JWT_SECRET` in `jwt.ts` is checked at module load, but `ENCRYPTION_KEY` is not. On Replit, secrets are always present; on a fresh server they are missing.

**How to avoid:**
Create a single `.env` file (never committed) before first run with all required variables:
- `PORT` — pick a port not in use (3000, 5173, 9323, 5037 occupied)
- `DATABASE_URL` — `postgresql://user:pass@localhost:5432/riskmind`
- `JWT_SECRET` — 64+ random hex characters (`openssl rand -hex 32`)
- `ENCRYPTION_KEY` — exactly 32 bytes base64-encoded (`openssl rand -base64 32`)

Add a startup validation function in `src/index.ts` that checks all four before calling `start()`.

**Warning signs:**
- Server starts but AI enrichment/settings throws 500 with "ENCRYPTION_KEY required"
- LLM config save succeeds but decrypt fails later
- `JWT_SECRET` throws at import — server won't start at all (this is the good case)

**Phase to address:** Phase 1 (Server Setup & Migration)

---

### Pitfall 3: Port Conflicts Break the Entire Stack Silently

**What goes wrong:**
The server environment already has ports 3000, 5173, 5037, 9323, and 5432 occupied. The API server and Vite dev server default to ports in these ranges. If `PORT` is not set, the API server throws immediately. If Vite's port is occupied, it auto-increments silently — meaning the frontend starts on an unexpected port, API calls to `/api/` hit the wrong process, and every request returns 404 with no obvious cause.

**Why it happens:**
Vite's `server.port` config uses the value of `process.env.PORT` with a fallback of `5173` — which is occupied. The API server requires `PORT` to be set explicitly. The two services need to be on separate ports, and neither knows about the other.

**How to avoid:**
Choose two clean ports not in the occupied list (e.g., 4000 for API, 4001 for frontend). Set them explicitly in environment variables and/or config before running either service. Do not rely on auto-increment — always bind explicitly. Document the port assignments.

**Warning signs:**
- `curl localhost:PORT/api/v1/health` returns HTML (hit Vite) or connection refused
- Frontend loads but all API calls return 404 or HTML error pages
- `ss -tlnp` shows unexpected port ownership

**Phase to address:** Phase 1 (Server Setup & Migration)

---

### Pitfall 4: Cloudflare Tunnel Buffers SSE Streams, Breaking AI Interviews

**What goes wrong:**
The AI interview feature uses Server-Sent Events (`Content-Type: text/event-stream`). Cloudflare's HTTP/2 proxy layer buffers responses by default. This causes the client to receive all SSE chunks at once at the end of the LLM call instead of streaming — the UI hangs for the full duration then shows a wall of text, or times out entirely for long responses.

**Why it happens:**
The codebase correctly sets `X-Accel-Buffering: no` (visible in `interviews.ts`), which disables nginx buffering. But Cloudflare has its own buffering layer that ignores this header unless the tunnel is configured with `no_tls_verify` or the appropriate HTTP/2 settings. Cloudflare also has a 100-second default response timeout for tunnel connections.

**How to avoid:**
In the cloudflared configuration YAML, set `http2Origin: true` under the ingress rule for the API service. This enables HTTP/2 between cloudflared and the origin, which streams correctly. Alternatively, ensure the tunnel routes the SSE path (`/api/v1/interviews/*/message`) through a dedicated ingress rule with `disableChunkedEncoding: false`. Also add `res.flushHeaders()` immediately after setting SSE headers in the Express route to force the response to start before buffering decisions are made.

**Warning signs:**
- AI interview shows spinner for 10-30 seconds then displays all text at once
- `curl -N` against the direct server port streams correctly but through the tunnel does not
- Browser DevTools shows SSE response arriving as a single event after long delay

**Phase to address:** Phase 2 (Cloudflare Tunnel Configuration)

---

### Pitfall 5: Cloudflare Tunnel Authentication Not Configured, App Exposed Publicly

**What goes wrong:**
A `cloudflared tunnel` with no Cloudflare Access policy exposes the entire application — including the MCP endpoint, all API routes, and admin functionality — to the public internet. The app has its own JWT auth, but the MCP endpoint and health checks are unauthenticated by design. Brute-force attempts against `/api/v1/auth/login` are trivially easy from the public internet.

**Why it happens:**
The default tunnel setup creates a public hostname with no additional authentication layer. Developers testing demos assume Cloudflare's obscurity (random subdomain) is sufficient protection.

**How to avoid:**
Configure Cloudflare Access on the tunnel subdomain as a second authentication layer. For internal demo use, restrict access to specific email addresses or an identity provider. Alternatively, use a Cloudflare Zero Trust application policy. At minimum, rate-limit the login endpoint via Cloudflare's WAF rules before the tunnel receives traffic.

**Warning signs:**
- The tunnel URL appears in public DNS immediately after creation
- No `CF-Access-*` headers present in requests reaching the Express server
- Login endpoint receives requests from IP ranges not belonging to intended users

**Phase to address:** Phase 2 (Cloudflare Tunnel Configuration)

---

### Pitfall 6: MCP Endpoint State Lost on Process Restart

**What goes wrong:**
The MCP handler stores sessions in an in-process `Map<string, McpSession>` (visible in `mcp/handler.ts`). If the server process restarts (crash, deployment, systemd restart), all active MCP sessions are lost. Clients with a stored `mcp-session-id` header will receive errors on reconnect with no clear recovery path.

**Why it happens:**
This is the correct architecture for a single-process server, but on a new Linux deployment without process supervision the server will occasionally restart. Without graceful session expiry or reconnect logic, AI agent integrations silently break.

**How to avoid:**
Add session expiry logic: periodically purge sessions older than N minutes from the Map. Document that MCP clients should handle `404` or `400` on session-id reuse as a "reconnect" signal and create a new session. Add a process supervisor (systemd or pm2) with restart policies so the server restarts quickly when it crashes.

**Warning signs:**
- MCP integration returns errors after server restart without explicit session re-establishment
- Map grows unbounded in long-running process (memory leak if sessions are never purged)

**Phase to address:** Phase 1 (Server Setup), Phase 3 (AI Feature Improvement)

---

### Pitfall 7: pgvector Extension Missing, Silently Degrading AI Features

**What goes wrong:**
`ensureExtensions()` runs `CREATE EXTENSION IF NOT EXISTS vector` at startup. If the PostgreSQL user lacks `SUPERUSER` or `CREATE EXTENSION` privilege, this silently fails (the error is caught by the try/finally but not re-thrown). The server starts fine. The first AI enrichment job that attempts to store or query an embedding fails with a cryptic PostgreSQL error about the `vector` type not existing.

**Why it happens:**
PostgreSQL extension creation requires superuser or the `pg_extension_owner_transfer` privilege. A freshly provisioned database user created with `CREATEDB` but not `SUPERUSER` cannot install extensions.

**How to avoid:**
During database setup, install the extension as the PostgreSQL superuser before the app user runs migrations: `psql -U postgres -d riskmind -c "CREATE EXTENSION IF NOT EXISTS vector;"`. Then confirm with `\dx` in psql. Do not rely on the runtime `ensureExtensions()` call to install — it should only verify.

**Warning signs:**
- `ensureExtensions()` completes without error but `SELECT * FROM pg_extension WHERE extname = 'vector'` returns empty
- AI enrichment jobs enter dead-letter state with PostgreSQL error mentioning unknown type `vector`
- `drizzle-kit push` fails with type errors on embedding columns

**Phase to address:** Phase 1 (Database Provisioning)

---

### Pitfall 8: Demo Seed Data Not Idempotent Across Migrations

**What goes wrong:**
`seedDemoDataIfEmpty()` checks for any user in `usersTable` before seeding. If the database is reset (tables dropped and recreated via `drizzle-kit push --force`) but the seed check is skipped, the demo tenant and users are not recreated. The app starts, migrations run, but the login page rejects all credentials because no users exist. There is no seed command separate from the server start.

**Why it happens:**
The seed is embedded in the server startup path with no standalone CLI invocation. Developers who run `drizzle-kit push --force` after a schema change lose all data and must restart the server once to re-trigger seeding — which is non-obvious.

**How to avoid:**
Create a standalone `seed` script (the `lib/db` package has a `bootstrap.ts` — extend it with seeding). Add `pnpm --filter @workspace/db run seed` to the deployment checklist. Document that after any `push --force` (schema reset), the seed must run before the server starts or the server must be restarted to trigger auto-seed.

**Warning signs:**
- Login with `admin@acme.com` / `password123` fails immediately after schema migration
- Server logs show "No users found — seeding demo data..." but tables were dropped mid-run

**Phase to address:** Phase 1 (Database Provisioning)

---

### Pitfall 9: CORS Configuration Allows All Origins in Production

**What goes wrong:**
`app.ts` calls `app.use(cors())` with no options — this sets `Access-Control-Allow-Origin: *` for all routes. In a Cloudflare tunnel deployment where the frontend is served from a known subdomain, this is unnecessary and exposes the API to cross-origin requests from any domain, including malicious ones that may have stolen a JWT.

**Why it happens:**
Open CORS is fine on Replit where the origin is always Replit's domain. On a real server with a public URL, it's a security weakness, especially combined with JWT tokens stored in localStorage (which are readable by any injected script).

**How to avoid:**
Configure CORS to allow only the specific Cloudflare tunnel frontend origin: `cors({ origin: 'https://your-tunnel.trycloudflare.com', credentials: true })`. Update this when the tunnel URL is known. For demo deployments where the URL changes, document this as a required configuration step.

**Warning signs:**
- `curl -H "Origin: https://evil.com" http://localhost:PORT/api/v1/health` returns `Access-Control-Allow-Origin: *`
- No `CORS_ORIGIN` or equivalent environment variable in the env configuration

**Phase to address:** Phase 2 (Cloudflare Tunnel Configuration)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| JWT stored in localStorage | Simple auth flow, easy to implement | XSS can steal tokens; no httpOnly cookie protection | MVP/demo only — acceptable for internal demo, not production |
| Open CORS (`cors()` with no config) | Zero configuration required | Any origin can make credentialed API calls | Never in production; fix in Phase 2 |
| In-memory MCP session Map | No Redis/DB dependency for sessions | Sessions lost on restart; unbounded memory growth | Acceptable for single-process demo deployment |
| Polling-based job queue (PostgreSQL) | No external message broker needed | Database load increases with job volume; polling interval creates latency | Fine up to ~100 concurrent jobs/minute; acceptable for demo |
| `drizzle-kit push` for schema management | Fast iteration, no migration files | No rollback capability; `push --force` is destructive | MVP only — consider migration files for production data |
| Seed in server startup path | Zero-config seeding | Seed runs on every cold start check; no standalone seed command | Acceptable but add standalone seed script before first demo |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cloudflare Tunnel + SSE | Tunnel buffers SSE chunks; client gets all data at end or times out | Set `http2Origin: true` in cloudflared config; call `res.flushHeaders()` before streaming; the code already sets `X-Accel-Buffering: no` which helps with nginx but not Cloudflare |
| Cloudflare Tunnel + MCP StreamableHTTP | StreamableHTTP uses long-lived connections that hit Cloudflare's 100s timeout | Configure tunnel with `keepAliveConnections: true`; ensure MCP client sends heartbeats |
| PostgreSQL + pgvector | Extension not installed as superuser, `ensureExtensions()` silently fails | Install extension manually as postgres superuser before migrations |
| OpenAI SDK + tenant LLM configs | Tenant API keys encrypted with `ENCRYPTION_KEY`; if key changes, all stored LLM configs become undecryptable | Never rotate `ENCRYPTION_KEY` after first tenant LLM config is saved; it's not a password, it's a data encryption key |
| Drizzle ORM + pgvector | Vector columns need `drizzle-orm/pg-core`'s `vector` import; Drizzle-kit push does not install the extension | Always install extension before push; keep `ensureExtensions` as a runtime guard only |
| Vite dev server + API proxy | Vite runs on a separate port from Express; `fetch('/api/')` in browser hits same-origin Vite, not Express | The frontend uses relative `/api/` paths; in dev, configure Vite proxy; in production, serve frontend from Express or tunnel routes must resolve both |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| pgvector similarity search without index | Embedding queries do full table scan; risk clustering becomes slow | Add `HNSW` or `IVFFlat` index on embedding columns after initial data load | ~1,000+ risk records |
| PostgreSQL polling every 1s per queue | Idle CPU usage from SELECT queries; DB connection pool saturation under load | Use `LISTEN/NOTIFY` instead of polling, or set poll interval to 5-10s for demo scale | ~10 concurrent users with AI jobs queued |
| React Query with default stale times | Dashboard re-fetches all KPIs on every focus; multiplied by all open tabs | Set `staleTime: 30_000` on dashboard queries; risks and compliance data don't need real-time refresh | Noticeable immediately in demo with multiple browser tabs |
| Bcrypt 12 rounds on login | Login takes ~300ms per attempt; multiplied under concurrent load | 12 rounds is appropriate for production; acceptable for demo; do not lower for performance | Fine at demo scale, becomes issue at 50+ concurrent logins |
| Unindexed tenant_id WHERE clauses | Multi-tenant queries scan full table; grows with data volume | Confirm `tenant_id` columns have indexes in Drizzle schema; check with EXPLAIN ANALYZE | ~10,000+ rows per tenant |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Demo credentials in seed (`password123`) | If demo app accidentally becomes accessible, trivially brute-forced or guessed | Change seed passwords before any public-facing deployment; document this in pre-demo checklist |
| JWT secret weak or default | Tokens can be forged; all tenants compromised | Use `openssl rand -hex 32` minimum; never use a string like "secret" or "development" |
| ENCRYPTION_KEY in `.env` not backed up | All stored LLM API keys permanently undecryptable if key is lost | Treat `ENCRYPTION_KEY` like a database backup password — document it securely separately from the server |
| MCP endpoint unauthenticated for non-JWT access | The MCP handler checks JWT but health check route is open | Health check exposure is acceptable; ensure `/mcp` always requires JWT — it currently does, but verify after any route refactoring |
| cloudflared credentials file world-readable | Tunnel credentials JSON grants full control of the tunnel | Set file permissions to 600 on `~/.cloudflared/` credentials; run cloudflared as a non-root service user |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| AI interview shows no progress during LLM streaming | User thinks the app is frozen for the duration of the LLM call (10-30s) | Ensure SSE streaming works through Cloudflare tunnel (see Pitfall 4); add a "thinking" animation that starts immediately when request is sent |
| Risk heatmap renders blank if no risks exist | Demo looks broken before data is seeded | Add empty-state illustration and "Add your first risk" CTA to heatmap page |
| Vendor 7-state lifecycle not visible at a glance | Demo audiences don't understand the TPRM flow | Add visual lifecycle stepper on vendor detail page showing current state and available transitions |
| Mobile sidebar navigation collapses but content is cramped | Enterprise risk managers use laptops; mobile is secondary but must not look broken | Test AppLayout at 375px and 768px before demo; hamburger menu exists but content overflow may still occur |
| JWT expiry during long demo session | Access token expires in 1 hour; user gets 401 mid-demo with no friendly message | Confirm auto-refresh interceptor works; add a visible session timeout warning at 55min if refresh fails |

---

## "Looks Done But Isn't" Checklist

- [ ] **Server running:** Verify `curl http://localhost:PORT/api/v1/health` returns `{"status":"ok","database":"connected"}` — `database` key being absent means pgvector or DB connection is broken
- [ ] **pgvector installed:** Verify `SELECT extname FROM pg_extension WHERE extname = 'vector'` returns a row before running migrations
- [ ] **Demo data seeded:** Log in as `admin@acme.com` / `password123` successfully — if this fails after migration, seed did not run
- [ ] **AI features functional:** LLM settings page must have a valid provider configured, or all AI enrichment jobs will dead-letter silently
- [ ] **SSE streaming works through tunnel:** Open an AI interview via the Cloudflare URL and confirm text streams progressively, not all at once
- [ ] **Replit dependencies removed:** `pnpm install --frozen-lockfile` must complete with no `@replit/*` peer warnings
- [ ] **CORS locked down:** Verify `Access-Control-Allow-Origin` response header is not `*` in production
- [ ] **ENCRYPTION_KEY backed up:** Confirm the key value is documented somewhere secure before configuring any LLM provider
- [ ] **Cloudflare Access policy set:** The tunnel URL should require authentication before reaching the app if it will be shared externally
- [ ] **Process supervisor configured:** Server must restart automatically on crash — verify with `systemctl status` or `pm2 list`

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Replit SDK breaks build | LOW | Remove packages from package.json, run `pnpm install`, rebuild |
| Missing ENCRYPTION_KEY after LLM configs saved | HIGH | Key is non-recoverable; must delete all LLM configs from DB and re-enter API keys after setting correct key |
| Port conflict discovered after deployment | LOW | Update `.env`, restart services; no data impact |
| SSE not streaming through tunnel | MEDIUM | Update cloudflared config YAML, restart tunnel daemon; no data impact but requires testing |
| pgvector not installed before push | MEDIUM | Install extension as superuser, re-run push; if tables already created, only affected columns need fixing |
| Demo data lost after `drizzle-kit push --force` | LOW | Restart server to trigger auto-seed (seed runs on empty DB); or run standalone seed script |
| JWT secret changed | HIGH | All existing tokens immediately invalid; all users must re-login; no other data impact |
| cloudflared credentials lost | LOW | Delete tunnel in Cloudflare dashboard, re-authenticate with `cloudflared tunnel login`, recreate tunnel |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Replit SDK in production build | Phase 1: Migration | `pnpm build` succeeds with no @replit warnings; bundle contains no @replit chunks |
| Missing environment variables | Phase 1: Migration | Startup validation logs confirm all env vars present; server starts cleanly |
| Port conflicts | Phase 1: Migration | `ss -tlnp` confirms chosen ports are free; health check responds correctly |
| pgvector missing | Phase 1: DB Provisioning | `SELECT extname FROM pg_extension WHERE extname = 'vector'` returns row |
| Demo seed not running | Phase 1: DB Provisioning | Login with demo credentials succeeds on fresh DB |
| SSE buffering through Cloudflare | Phase 2: Cloudflare Tunnel | AI interview streams progressively through tunnel URL |
| Tunnel public with no access control | Phase 2: Cloudflare Tunnel | Cloudflare Access application policy applied and tested |
| Open CORS | Phase 2: Cloudflare Tunnel | CORS origin locked to tunnel hostname |
| MCP session memory leak | Phase 3: AI Improvements | Session map has TTL/expiry logic; long-running server memory stable |
| Weak demo credentials | Pre-demo | Demo login credentials rotated from `password123` |
| ENCRYPTION_KEY not backed up | Phase 1: Migration | Key documented in secure location before any LLM config saved |
| No process supervisor | Phase 1: Migration | `systemctl status riskmind-api` shows active/running |

---

## Sources

- Direct codebase inspection: `/home/dante/RiskMind2/artifacts/api-server/src/` (HIGH confidence — source of truth)
- Direct codebase inspection: `/home/dante/RiskMind2/artifacts/riskmind-app/vite.config.ts` (HIGH confidence)
- Direct codebase inspection: `/home/dante/RiskMind2/lib/api-client-react/src/custom-fetch.ts` (HIGH confidence)
- Direct codebase inspection: `/home/dante/RiskMind2/artifacts/api-server/src/mcp/handler.ts` (HIGH confidence)
- cloudflared version check on target server: `2026.3.0` — tunnel not yet configured (HIGH confidence)
- Cloudflare documentation on HTTP/2 and tunnel buffering (MEDIUM confidence — based on known Cloudflare proxy behavior for SSE/streaming)
- PostgreSQL pgvector extension privilege requirements (HIGH confidence — standard PostgreSQL extension installation behavior)

---
*Pitfalls research for: RiskMind — Replit migration + Cloudflare tunnel + ERM platform improvement*
*Researched: 2026-03-17*
