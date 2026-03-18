# Phase 2: Public Access and Security - Research

**Researched:** 2026-03-18
**Domain:** Cloudflare Tunnel, Express CORS, SSE Streaming
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tunnel Configuration**
- Create a new dedicated tunnel for RiskMind — do not reuse the existing tunnel (which serves pdpl.pulsebridge.me)
- Single public hostname: `app.riskmind.net` → `http://localhost:4000`
- No other subdomains needed (no separate api.riskmind.net)
- Tunnel managed via Cloudflare dashboard (token-based, not local config.yml)
- Install as systemd service for boot persistence
- Domain riskmind.net already on Cloudflare DNS — no nameserver changes needed

**SSL/TLS**
- Cloudflare provides the certificate automatically — no server-side certificate needed
- Express runs plain HTTP on port 4000, Cloudflare terminates TLS at the edge
- No Let's Encrypt, certbot, or manual certificate management

**Access Control**
- Open access — no Cloudflare Access gate
- The app's own JWT authentication handles access control
- No bot protection needed — demo app with seed data
- Anyone on the internet can reach the login page

**CORS Policy**
- Lock CORS to two origins: `https://app.riskmind.net` and `http://localhost:4000`
- Replace `app.use(cors())` in `app.ts` with explicit origin whitelist
- Enable `credentials: true` for JWT Bearer token in Authorization header
- Dev on localhost still works, production locked to tunnel origin

**SSE Streaming Fix**
- Add `res.flushHeaders()` after setting SSE headers in `interviews.ts`
- This forces immediate streaming rather than buffering through Cloudflare tunnel
- Minimal code change — the `X-Accel-Buffering: no` header is already set
- No tunnel-side configuration changes needed (http2Origin, etc.)

### Claude's Discretion
- Exact cloudflared CLI commands for tunnel creation and service installation
- Whether to use `cloudflared tunnel create` locally or set up entirely via dashboard
- CORS error response format
- Any additional SSE routes that may need the same flushHeaders fix

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NET-01 | Configure named Cloudflare tunnel pointing to localhost:4000 | Tunnel creation via dashboard (token-based), cloudflared 2026.3.0 already installed |
| NET-02 | Install cloudflared tunnel as systemd service for persistence | Existing service pattern at /etc/systemd/system/cloudflared.service; new service file for RiskMind tunnel |
| NET-03 | Lock CORS to Cloudflare tunnel origin (remove open cors()) | cors package v2 already installed; replace `app.use(cors())` with whitelist options object |
| NET-04 | Configure http2Origin in cloudflared for SSE streaming (AI interviews) | Decision: use res.flushHeaders() instead of http2Origin — simpler, same effect |
| NET-05 | App accessible via public Cloudflare tunnel URL with working login | End-to-end smoke test: load page, login, verify JWT auth works from tunnel origin |
</phase_requirements>

---

## Summary

Phase 2 is a narrow infrastructure phase with three distinct tasks: (1) create a new named Cloudflare tunnel via the dashboard and install it as a systemd service, (2) lock Express CORS to the two allowed origins, and (3) add `res.flushHeaders()` to the SSE endpoint so AI interview streaming works through the tunnel. All required software is already installed and all required patterns are already established in the codebase.

The primary execution risk is the systemd service for the new tunnel conflicting with the existing `cloudflared.service`. The existing service uses the unit name `cloudflared.service` — the new service MUST use a different name (e.g., `cloudflared-riskmind.service`) to avoid collision. Both services can run concurrently since they use different tokens and route different hostnames.

The `X-Accel-Buffering: no` header is already present in `interviews.ts`. The only missing piece for SSE-through-Cloudflare is `res.flushHeaders()` immediately after setting SSE headers. The MCP handler uses `StreamableHTTPServerTransport` which manages its own response lifecycle — it does not use Express SSE headers and does not need this fix.

**Primary recommendation:** Create the RiskMind tunnel in the Cloudflare dashboard, install it as `cloudflared-riskmind.service`, configure CORS whitelist in `app.ts`, and add `res.flushHeaders()` at line 189 of `interviews.ts`.

---

## Current State Audit

### What Already Exists (do not recreate)

| Asset | Location | State |
|-------|----------|-------|
| cloudflared binary | `/usr/local/bin/cloudflared` | v2026.3.0, working |
| Existing tunnel service | `/etc/systemd/system/cloudflared.service` | Active, serves pdpl.pulsebridge.me → :3000 |
| cors npm package | `artifacts/api-server/package.json` | `"cors": "^2"` installed |
| Open CORS middleware | `artifacts/api-server/src/app.ts` line 10 | `app.use(cors())` — must be replaced |
| SSE headers | `artifacts/api-server/src/routes/interviews.ts` lines 185-188 | Content-Type, Cache-Control, Connection, X-Accel-Buffering set; `res.flushHeaders()` missing |

### What Must Be Created

| Asset | Description |
|-------|-------------|
| New Cloudflare tunnel | In dashboard: name `riskmind`, hostname `app.riskmind.net` → `http://localhost:4000` |
| `/etc/systemd/system/cloudflared-riskmind.service` | Token-based service file for the new tunnel |
| Updated `app.ts` CORS config | Replace open `cors()` with origin whitelist |
| `res.flushHeaders()` call | Single line addition in `interviews.ts` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cloudflared | 2026.3.0 (installed) | Cloudflare tunnel daemon | Official Cloudflare tool for tunnel management |
| cors (npm) | ^2 (installed) | Express CORS middleware | De-facto standard for Express CORS |
| express | ^5 (installed) | HTTP server | Already in use |

### No New Dependencies Required

This phase makes no new npm installs. All required packages are already present.

---

## Architecture Patterns

### Tunnel Service Naming Convention

The existing service occupies `cloudflared.service`. The new service MUST have a distinct unit name:

```
/etc/systemd/system/cloudflared-riskmind.service
```

Both can coexist since systemd identifies services by filename, not binary. The existing auto-update timer (`cloudflared-update.timer`) will continue to update the shared binary for both services.

### Existing Service Structure (reference, do not modify)

```ini
# /etc/systemd/system/cloudflared.service  -- DO NOT TOUCH
[Unit]
Description=cloudflared
After=network-online.target
Wants=network-online.target

[Service]
TimeoutStartSec=30
Type=notify
ExecStart=/usr/local/bin/cloudflared --no-autoupdate --protocol http2 tunnel run --token <TOKEN>
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

### New Service Structure (for RiskMind tunnel)

```ini
# /etc/systemd/system/cloudflared-riskmind.service
[Unit]
Description=cloudflared RiskMind tunnel
After=network-online.target
Wants=network-online.target

[Service]
TimeoutStartSec=30
Type=notify
ExecStart=/usr/local/bin/cloudflared --no-autoupdate --protocol http2 tunnel run --token <RISKMIND_TOKEN>
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Token source: Cloudflare dashboard → Zero Trust → Networks → Tunnels → (new tunnel) → Configure → Install connector.

### CORS Configuration Pattern

```typescript
// artifacts/api-server/src/app.ts
// Source: cors npm package docs (https://github.com/expressjs/cors)
import cors from "cors";

const ALLOWED_ORIGINS = [
  "https://app.riskmind.net",
  "http://localhost:4000",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
```

**Why the function form over the array form:** The array form in cors v2 sets `Access-Control-Allow-Origin` to the specific matched origin (not `*`), which is correct. Either form works — the function form is explicit and easier to audit. Both support `credentials: true`.

**Alternative — simpler array form:**
```typescript
app.use(cors({
  origin: ["https://app.riskmind.net", "http://localhost:4000"],
  credentials: true,
}));
```

Use whichever is clearest to read. The array form is sufficient.

### SSE Streaming Fix

```typescript
// artifacts/api-server/src/routes/interviews.ts
// Around line 185-189 — BEFORE the streaming loop starts
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.setHeader("X-Accel-Buffering", "no");
res.flushHeaders();  // <-- ADD THIS LINE

// Then the stream loop begins:
for await (const chunk of streamComplete(tenantId, { messages })) {
```

`res.flushHeaders()` sends the HTTP response headers immediately over the TCP connection without waiting for the first `res.write()` call. Without it, Node.js / Express buffers the 200 status + headers until data is written. Cloudflare's proxy, seeing no data, may buffer the entire response until the connection closes — destroying SSE semantics.

---

## SSE Scope Analysis

**Only one SSE endpoint exists in this codebase.** Confirmed by full grep of all route files.

| File | SSE? | Needs flushHeaders? |
|------|------|---------------------|
| `routes/interviews.ts` | YES — `text/event-stream` + loop | YES |
| `routes/agent.ts` | No | No |
| `routes/foresight.ts` | No (stub, 501) | No |
| `routes/risks.ts` | No | No |
| `routes/auth.ts` | No | No |
| All other routes | No | No |
| `mcp/handler.ts` | Uses `StreamableHTTPServerTransport` | No — SDK manages its own response |

The MCP handler uses `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport`. This is a different protocol from browser SSE; the SDK handles its own response flushing. No change needed there.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS enforcement | Custom middleware checking headers | `cors` npm package (already installed) | Handles preflight OPTIONS, wildcard, credentials, vary headers correctly |
| TLS/HTTPS | certbot, Let's Encrypt, self-signed certs | Cloudflare tunnel (already decided) | Cloudflare provides cert automatically; server runs plain HTTP |
| Tunnel management | Config.yml-based tunnel routing | Dashboard token-based tunnel | Already established pattern in existing service |
| SSE buffering bypass | nginx `proxy_buffering off` | `res.flushHeaders()` | Express-native solution; no proxy layer in this stack |

---

## Common Pitfalls

### Pitfall 1: Systemd Service Name Collision
**What goes wrong:** Writing the new service to `/etc/systemd/system/cloudflared.service` overwrites the active service for pdpl.pulsebridge.me, taking that site down.
**Why it happens:** Forgetting that cloudflared is already running as a service under that exact name.
**How to avoid:** Use a unique unit name: `cloudflared-riskmind.service`. Verify with `systemctl status cloudflared.service` before creating the new file.
**Warning signs:** `systemctl status cloudflared.service` shows the pdpl.pulsebridge.me token in ExecStart.

### Pitfall 2: CORS Not Applied to Preflight OPTIONS
**What goes wrong:** POST/PUT requests from the browser fail with CORS errors even though GET works.
**Why it happens:** Browsers send a preflight OPTIONS request before cross-origin POST with credentials. If only the main request method handler sets CORS headers, preflight gets no headers and fails.
**How to avoid:** The `cors()` middleware handles OPTIONS automatically — as long as it is placed BEFORE route handlers in the Express middleware chain. Current position (line 10 of `app.ts`) is correct.
**Warning signs:** Browser console shows "Response to preflight request doesn't pass access control check."

### Pitfall 3: `credentials: true` Without Explicit Origin
**What goes wrong:** CORS rejects requests even from allowed origins.
**Why it happens:** `credentials: true` is incompatible with wildcard `origin: "*"`. Must pair with an explicit origin whitelist.
**How to avoid:** The pattern above uses an explicit array — confirmed compatible with `credentials: true`.
**Warning signs:** Browser console: "The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'."

### Pitfall 4: SSE Connection Closes Immediately Through Tunnel
**What goes wrong:** SSE stream appears to work locally but returns a complete response (all chunks at once or empty) through the Cloudflare tunnel.
**Why it happens:** Without `res.flushHeaders()`, headers are buffered. Cloudflare may treat the connection as a regular HTTP request and buffer the entire response body.
**How to avoid:** Add `res.flushHeaders()` immediately after setting SSE headers, before the async generator loop.
**Warning signs:** Interview responses arrive all at once instead of token-by-token; `X-Accel-Buffering: no` header appears in response but streaming is still buffered.

### Pitfall 5: Tunnel Token Not Found After Reboot
**What goes wrong:** Service starts but fails because the token is embedded in ExecStart and gets double-quoted or corrupted during file creation.
**Why it happens:** Heredoc-based file writing can introduce quote escaping issues.
**How to avoid:** Write the service file content carefully. The existing service uses the token directly in ExecStart without quoting — follow the same pattern.
**Warning signs:** `systemctl status cloudflared-riskmind.service` shows "Failed to parse token" or similar cloudflared error.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| `cloudflared tunnel create` local config.yml | Token-based, dashboard-managed | Established in this project |
| nginx proxy_buffering off for SSE | `res.flushHeaders()` in Express | Simpler; no nginx in this stack |
| `cors({ origin: "*" })` | Explicit whitelist with credentials | Required for JWT Bearer auth |
| `http2Origin: true` in cloudflared config | `res.flushHeaders()` | Both fix SSE buffering; flushHeaders is simpler |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | None — see Wave 0 |
| Quick run command | Manual: `curl` smoke tests |
| Full suite command | Manual: browser-based end-to-end checks |

No automated test framework exists in this project. This phase is infrastructure-only with no testable TypeScript units — the changes are: a service file, two lines of CORS config, and one `res.flushHeaders()` call. Automated unit tests would not meaningfully exercise Cloudflare tunnel behavior or live CORS enforcement.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Verification Method |
|--------|----------|-----------|---------------------|
| NET-01 | Tunnel routes app.riskmind.net to localhost:4000 | smoke | `curl -I https://app.riskmind.net/api/health` returns 200 |
| NET-02 | cloudflared-riskmind service survives reboot | manual | `sudo reboot` then `systemctl status cloudflared-riskmind.service` |
| NET-03 | CORS rejects unauthorized origins | smoke | `curl -H "Origin: https://evil.com" -I https://app.riskmind.net/api/health` — no CORS headers in response |
| NET-03 | CORS allows authorized origin | smoke | `curl -H "Origin: https://app.riskmind.net" -I https://app.riskmind.net/api/health` — `Access-Control-Allow-Origin: https://app.riskmind.net` in response |
| NET-04 | SSE streams token-by-token (not buffered) | manual | Open interview in browser at tunnel URL; observe tokens arriving progressively |
| NET-05 | Login and navigation work at public URL | manual | Browser: load `https://app.riskmind.net`, login with seed credentials, navigate to risks page |

### Sampling Rate
- **Per task commit:** `curl -I https://app.riskmind.net/api/health` (once tunnel is live)
- **Per wave merge:** All curl smoke tests above
- **Phase gate:** All 5 manual/smoke checks green before `/gsd:verify-work`

### Wave 0 Gaps
None — no test framework setup needed. All verification is via curl and manual browser testing. No test files to create.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `/home/dante/RiskMind2/artifacts/api-server/src/app.ts` — current CORS state
- Direct code inspection: `/home/dante/RiskMind2/artifacts/api-server/src/routes/interviews.ts` — SSE endpoint, confirmed single SSE route in codebase
- Direct system inspection: `/etc/systemd/system/cloudflared.service` — existing service structure
- Direct system inspection: `cloudflared --version` output — v2026.3.0

### Secondary (MEDIUM confidence)
- cors npm package GitHub (https://github.com/expressjs/cors) — array origin + credentials:true pattern
- Node.js `res.flushHeaders()` docs — forces headers to flush before first write

### Tertiary (LOW confidence)
- Community knowledge: Cloudflare tunnel SSE buffering behavior resolved by flushHeaders — consistent with CONTEXT.md decisions made by user based on prior experience

---

## Open Questions

1. **RISKMIND_TOKEN availability**
   - What we know: Tunnel must be created in Cloudflare dashboard first; token is generated there
   - What's unclear: Whether the implementer has dashboard access during task execution
   - Recommendation: Task should instruct implementer to create the tunnel in the dashboard and paste the token into the service file. If running headless, the token can be obtained via `cloudflared tunnel token <tunnel-name>` after creation.

2. **Cloudflare DNS propagation timing**
   - What we know: riskmind.net DNS is already on Cloudflare; dashboard-created tunnels auto-create the CNAME
   - What's unclear: Whether the `app.riskmind.net` CNAME is already present or needs creation
   - Recommendation: After tunnel creation, verify in Cloudflare DNS dashboard that a CNAME for `app` pointing to the tunnel UUID is present. Dashboard tunnel creation should add this automatically.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct inspection of installed software and package.json
- Architecture: HIGH — existing service structure directly read; pattern is additive
- CORS config: HIGH — cors v2 package directly verified; pattern is documented
- SSE fix: HIGH — code directly read; single-line addition at verified location
- Pitfalls: HIGH — derived from direct code/system inspection, not speculation

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable infrastructure)
