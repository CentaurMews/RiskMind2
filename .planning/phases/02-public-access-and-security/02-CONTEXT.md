# Phase 2: Public Access and Security - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure a new dedicated Cloudflare tunnel to expose the app at `app.riskmind.net` → `http://localhost:4000`, lock CORS to the tunnel origin + localhost, fix SSE streaming for AI interviews. The app must be fully functional from the public URL with working login, navigation, and real-time AI features.

</domain>

<decisions>
## Implementation Decisions

### Tunnel Configuration
- Create a **new dedicated tunnel** for RiskMind — do not reuse the existing tunnel (which serves pdpl.pulsebridge.me)
- Single public hostname: `app.riskmind.net` → `http://localhost:4000`
- No other subdomains needed (no separate api.riskmind.net)
- Tunnel managed via Cloudflare dashboard (token-based, not local config.yml)
- Install as systemd service for boot persistence
- Domain riskmind.net already on Cloudflare DNS — no nameserver changes needed

### SSL/TLS
- Cloudflare provides the certificate automatically — no server-side certificate needed
- Express runs plain HTTP on port 4000, Cloudflare terminates TLS at the edge
- No Let's Encrypt, certbot, or manual certificate management

### Access Control
- Open access — no Cloudflare Access gate
- The app's own JWT authentication handles access control
- No bot protection needed — demo app with seed data
- Anyone on the internet can reach the login page

### CORS Policy
- Lock CORS to two origins: `https://app.riskmind.net` and `http://localhost:4000`
- Replace `app.use(cors())` in `app.ts` with explicit origin whitelist
- Enable `credentials: true` for JWT Bearer token in Authorization header
- Dev on localhost still works, production locked to tunnel origin

### SSE Streaming Fix
- Add `res.flushHeaders()` after setting SSE headers in `interviews.ts`
- This forces immediate streaming rather than buffering through Cloudflare tunnel
- Minimal code change — the `X-Accel-Buffering: no` header is already set
- No tunnel-side configuration changes needed (http2Origin, etc.)

### Claude's Discretion
- Exact cloudflared CLI commands for tunnel creation and service installation
- Whether to use `cloudflared tunnel create` locally or set up entirely via dashboard
- CORS error response format
- Any additional SSE routes that may need the same flushHeaders fix

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Express app (CORS + SSE)
- `artifacts/api-server/src/app.ts` — Current `cors()` call at line 10 (no args), static middleware, route mounting
- `artifacts/api-server/src/routes/interviews.ts` — SSE endpoint at line 185-188 (Content-Type, X-Accel-Buffering headers, missing flushHeaders)

### Cloudflare tunnel
- Current tunnel runs as systemd service at `/etc/systemd/system/cloudflared.service` — token-based, routes pdpl.pulsebridge.me → :3000
- cloudflared version 2026.3.0 installed at `/usr/local/bin/cloudflared`

### MCP endpoint (potential SSE)
- `artifacts/api-server/src/mcp/handler.ts` — Check if this also uses SSE/streaming that needs flushHeaders

### Phase 1 decisions (carry forward)
- Express serves API + SPA on port 4000 (single origin pattern)
- PM2 manages process via ecosystem.config.cjs with --env-file
- SPA fallback regex excludes /api and /mcp prefixes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cors` package already installed — just needs configuration options passed
- SSE pattern in interviews.ts already sets correct headers, just missing flushHeaders()
- cloudflared binary already installed and working

### Established Patterns
- Tunnel management via Cloudflare dashboard (token-based, not local config)
- systemd service for cloudflared persistence
- Express middleware chain: cors → json → urlencoded → routes → static → SPA fallback → 404

### Integration Points
- `app.ts` line 10: `app.use(cors())` — replace with configured cors options
- `interviews.ts` line 188: after `X-Accel-Buffering` header — add `res.flushHeaders()`
- systemd: new service file for the dedicated RiskMind tunnel (separate from existing cloudflared.service)

</code_context>

<specifics>
## Specific Ideas

- Domain: `app.riskmind.net` (user owns riskmind.net, DNS on Cloudflare)
- New dedicated tunnel, not shared with existing services
- Open access, JWT-only auth — no Cloudflare Access gate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-public-access-and-security*
*Context gathered: 2026-03-18*
