# RiskMind Security Architecture

**Version:** 1.1
**Last Updated:** 2026-03-19
**Classification:** Internal — Engineering

---

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Authorization and RBAC](#authorization-and-rbac)
3. [Multi-Tenancy Isolation](#multi-tenancy-isolation)
4. [Data Encryption](#data-encryption)
5. [Password Hashing](#password-hashing)
6. [CORS Policy](#cors-policy)
7. [SSRF Protection](#ssrf-protection)
8. [Input Validation](#input-validation)
9. [Audit Trail](#audit-trail)
10. [Transport Security](#transport-security)
11. [Security Considerations for Deployment](#security-considerations-for-deployment)
12. [Known Limitations and Future Work](#known-limitations-and-future-work)

---

## Authentication System

### Mechanism

RiskMind uses a custom JWT implementation. The JWT specification is implemented from scratch using Node.js built-in `crypto` primitives — no third-party JWT library is used. This eliminates exposure to library-specific vulnerabilities (e.g., CVE-class issues in `jsonwebtoken`).

### Token Construction

```
JWT = base64url(header) + "." + base64url(payload) + "." + signature

header = { "alg": "HS256", "typ": "JWT" }
payload = { sub, tenantId, email, role, type, iat, exp }
signature = HMAC-SHA256(header + "." + payload, JWT_SECRET)
```

Algorithm: **HMAC-SHA256** (`HS256`)
Encoding: Base64URL for all three JWT segments

### Token Types

| Type | Expiry | Purpose |
|---|---|---|
| `access` | 3600 seconds (1 hour) | Authenticates API requests via `Authorization: Bearer` |
| `refresh` | 604800 seconds (7 days) | Exchanges for a new access/refresh pair at `/v1/auth/refresh` |

### Token Verification

On every protected request, the `authMiddleware` performs:

1. Extracts the Bearer token from the `Authorization` header
2. Splits token into header, payload, and signature segments
3. Recomputes `HMAC-SHA256(header.payload, JWT_SECRET)` and compares to the provided signature using a constant-time comparison (via `crypto.timingSafeEqual`)
4. Validates `exp` (expiry) and `type` (must be `"access"`)
5. Attaches `{ id, tenantId, email, role }` to `req.user`

If any check fails, the request is rejected with HTTP 401 and a RFC 7807 error body.

### Token Storage (Client Side)

The React SPA stores tokens in browser `localStorage`. This is a pragmatic choice for the current deployment context. Future work may migrate to `httpOnly` cookie-based storage for additional XSS resistance.

---

## Authorization and RBAC

### Role-Based Access Control

Authorization is enforced at the route level using the `requireRole()` middleware factory:

```typescript
router.post("/v1/risks", requireRole("risk_manager", "admin"), handler);
```

If the authenticated user's role is not in the allowed list, the request is rejected with HTTP 403.

### Defined Roles

| Role | Description |
|---|---|
| `admin` | Full platform access including user management and LLM settings |
| `risk_manager` | Create, read, update, delete risks, vendors, compliance, signals, findings |
| `risk_owner` | Update own risks, read all within tenant |
| `risk_executive` | Read-only access with executive summary visibility |
| `auditor` | Read-only access plus ability to record control test results |
| `viewer` | Read-only access to all standard resources |
| `vendor` | Access limited to vendor self-service portal (public routes only) |

### Permissions Matrix

| Resource | admin | risk_manager | risk_owner | risk_executive | auditor | viewer | vendor |
|---|---|---|---|---|---|---|---|
| Risks (read) | Y | Y | Y | Y | Y | Y | N |
| Risks (write) | Y | Y | Own only | N | N | N | N |
| Vendors (read) | Y | Y | Y | Y | Y | Y | N |
| Vendors (write) | Y | Y | N | N | N | N | N |
| Compliance (read) | Y | Y | Y | Y | Y | Y | N |
| Compliance (write) | Y | Y | N | N | N | N | N |
| Control Tests (record) | Y | Y | N | N | Y | N | N |
| Signals (read) | Y | Y | Y | Y | Y | Y | N |
| Signals (write) | Y | Y | N | N | N | N | N |
| Agent Config (read) | Y | N | N | N | N | N | N |
| Agent Config (write) | Y | N | N | N | N | N | N |
| LLM Settings | Y | N | N | N | N | N | N |
| User Management | Y | N | N | N | N | N | N |
| Vendor Portal | N | N | N | N | N | N | Y |

### RBAC Enforcement Points

1. **Route middleware** — `requireRole()` applied to write operations
2. **Frontend** — Role-gated UI controls (admin-only panels hidden from non-admins)
3. **Data layer** — All queries scoped by `tenantId` (prevents cross-tenant access regardless of role)

---

## Multi-Tenancy Isolation

### Isolation Model

RiskMind uses a **shared schema, row-level isolation** multi-tenancy model. All tenant data resides in the same PostgreSQL database and tables. Isolation is enforced exclusively by application-layer `tenant_id` filtering.

There is no PostgreSQL row-level security (RLS) policy. The application is the sole enforcement point.

### Enforcement Mechanism

1. At login, the user's `tenantId` is embedded in the JWT payload
2. The `authMiddleware` attaches `tenantId` to `req.user` on every request
3. Every database query in every route handler includes:
   ```typescript
   .where(eq(table.tenantId, req.user.tenantId))
   ```
4. There is no application path that accepts a `tenantId` override from the request body or query string

### Tenant Isolation Coverage

All 30+ domain tables carry a `tenant_id` column with a foreign key reference to `tenants.id`. Cascading at the database level means that if a tenant record were deleted, all associated rows would be removed automatically.

### Cross-Tenant Access Prevention

The `req.user.tenantId` value is derived exclusively from the verified JWT. A user cannot escalate to another tenant by modifying request parameters. Even the `admin` role is scoped within a single tenant — there is no super-admin role that spans tenants in the current architecture.

---

## Data Encryption

### LLM API Key Encryption

Third-party LLM provider API keys are sensitive credentials stored in the `llm_configs` table. These are encrypted at rest using authenticated encryption.

**Algorithm:** AES-256-GCM
**Key size:** 256 bits (32 bytes)
**IV size:** 12 bytes (randomly generated per encryption)
**Auth tag size:** 16 bytes

**Stored format:**
```
base64( IV(12 bytes) || AuthTag(16 bytes) || Ciphertext )
```

The column `llm_configs.encrypted_api_key` stores this base64-encoded blob. The plaintext API key never touches the database.

**Key management:** The 32-byte encryption key is stored in the `ENCRYPTION_KEY` environment variable (base64-encoded). It must not be committed to source control. Rotate with caution — see the critical constraint below.

**Critical constraint:** `ENCRYPTION_KEY` cannot be changed without re-encrypting every `llm_configs.encrypted_api_key` row. Changing the key without a data migration will cause decryption failures for all configured providers. Treat this key with database master key procedures.

### Encryption Implementation

```
encrypt(plaintext):
  key = base64decode(ENCRYPTION_KEY)  // 32 bytes
  iv = randomBytes(12)
  cipher = AES-256-GCM(key, iv)
  ciphertext = cipher.encrypt(plaintext)
  tag = cipher.authTag
  return base64( iv || tag || ciphertext )

decrypt(ciphertext):
  data = base64decode(ciphertext)
  iv = data[0:12]
  tag = data[12:28]
  encrypted = data[28:]
  decipher = AES-256-GCM(key, iv)
  decipher.setAuthTag(tag)
  return decipher.decrypt(encrypted)
```

The GCM auth tag verifies that the ciphertext has not been tampered with. Any modification to the stored blob will cause decryption to throw, which is caught and logged without crashing the request.

### Data at Rest

Beyond LLM API keys, no other fields are encrypted at the application layer. Database-level encryption (PostgreSQL full disk encryption) is the responsibility of the server administrator and is not configured by the application.

---

## Password Hashing

### Algorithm

User passwords are hashed using **bcryptjs** with a cost factor of **12 rounds**.

- bcrypt is memory-hard and time-bounded, resistant to GPU-accelerated cracking
- 12 rounds provides approximately 300–500 ms hash time on modern hardware, acceptable for login latency
- Each password hash includes a unique 22-character bcrypt salt, preventing rainbow table attacks

### Storage

The column `users.hashed_password` stores the full bcrypt output string:
```
$2b$12$<22-char-salt><31-char-hash>
```

Plaintext passwords are never logged, stored, or transmitted after the login endpoint processes them. The login handler compares the submitted password using `bcryptjs.compare()`, which is timing-safe.

### Password Policy

No application-enforced password policy (minimum length, complexity) is currently implemented beyond what client-side forms provide. A server-side policy enforcement is planned for a future release.

---

## CORS Policy

### Configuration

CORS is configured at the Express application level using the `cors` npm package:

```typescript
const ALLOWED_ORIGINS = [
  "https://app.riskmind.net",
  "http://localhost:4000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);       // allow non-browser requests (curl, Postman)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(null, false);                    // reject unlisted origins
  },
  credentials: true,
}));
```

### Policy Details

| Setting | Value | Rationale |
|---|---|---|
| Allowed origins | `https://app.riskmind.net`, `http://localhost:4000` | Explicit allowlist; no wildcard |
| Credentials | `true` | Required for cookie-bearing requests (future) |
| Null origin | Allowed | Permits server-to-server and CLI access |
| Unlisted origins | Rejected (no `Access-Control-Allow-Origin` header) | Browser enforces preflight rejection |

### Cloudflare Edge

Cloudflare's edge layer provides additional protection:
- TLS termination (Cloudflare manages certificates)
- DDoS mitigation
- Bot detection

The origin server (Express on port 4000) is not directly reachable from the internet; all traffic arrives via the Cloudflare tunnel.

---

## SSRF Protection

### Threat Context

Admins can configure LLM providers with arbitrary `baseUrl` values (for Ollama/private deployments). A malicious admin could point this to an internal service to probe internal network resources.

### Current Mitigations

- LLM provider configuration is restricted to users with the `admin` role
- Only authenticated admin users can set or modify `baseUrl` values
- Admin role is tenant-scoped — admin users are assumed to be trusted operators within their tenant

### Future Work

A future release will add URL validation to reject `baseUrl` values that resolve to private RFC 1918 address ranges (10.x, 172.16.x, 192.168.x) or localhost, with an explicit exception for self-hosted Ollama deployments configured via a whitelist.

---

## Input Validation

### Approach

All request bodies are validated using **Zod v4** schemas before any database interaction. Zod schemas are generated from the OpenAPI specification by Orval and are available as `@workspace/api-zod`.

### Validation Coverage

| Input Source | Validation |
|---|---|
| JSON request bodies | Zod schema parse, reject on failure with 400 |
| Path parameters | Type checking in route handler |
| Query parameters | Explicit parsing with type coercion |
| File uploads | Size limit enforced by `express.json({ limit: "10mb" })` |

### Invalid JSON

`express.json()` catches malformed JSON before it reaches route handlers. The Express error handler detects `entity.parse.failed` errors and returns HTTP 400 with a clear message.

### Zod Validation Pattern

```typescript
// Route handler pattern
const parsed = myRequestSchema.safeParse(req.body);
if (!parsed.success) {
  return badRequest(res, parsed.error.message);
}
const { title, category, likelihood } = parsed.data;
```

---

## Audit Trail

### Audit Events Table

The `audit_events` table records significant mutations across the system:

```
audit_events
  id         UUID
  tenant_id  UUID (FK: tenants.id)
  user_id    UUID (FK: users.id, nullable for system actions)
  action     text  -- e.g., "risk.created", "vendor.transitioned"
  entity_type text -- e.g., "risk", "vendor"
  entity_id  UUID  -- ID of the affected entity
  payload    jsonb -- Before/after values or context data
  created_at timestamp
  updated_at timestamp
```

### What Is Logged

| Action | Entity Type |
|---|---|
| Risk created, updated, deleted | `risk` |
| Treatment added, updated | `treatment` |
| Vendor created, transitioned | `vendor` |
| Control test recorded | `control_test` |
| Signal triaged | `signal` |
| Alert acknowledged, resolved | `alert` |
| LLM config added, updated | `llm_config` |
| Agent run started, completed | `agent_run` |
| User created, role changed | `user` |

### Audit Event Immutability

Audit events are insert-only. There is no update or delete endpoint for `audit_events`. Application code does not expose any mechanism to modify historical audit records.

---

## Transport Security

### TLS

All traffic to `https://app.riskmind.net` is encrypted by Cloudflare. Cloudflare terminates TLS at the edge and forwards requests to the origin via the tunnel using an encrypted connection managed by `cloudflared`.

The origin Express server itself does not handle TLS — it operates on plain HTTP over the local Cloudflare tunnel connection. This is the standard Cloudflare tunnel architecture.

### HTTP Security Headers

No application-level HTTP security headers (`Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, etc.) are currently set by Express. Cloudflare's edge can be configured to inject these headers via Transform Rules. This is planned for a future hardening pass.

---

## Security Considerations for Deployment

### Environment Variables

- Store `.env` with `chmod 600` — readable only by the application user
- Never commit `.env` to source control
- Rotate `JWT_SECRET` periodically (forces all active sessions to re-authenticate)
- Never rotate `ENCRYPTION_KEY` without a data migration script
- Use a secrets manager (HashiCorp Vault, AWS Secrets Manager) for production environments handling sensitive data

### PostgreSQL

- Use a dedicated database user with `CONNECT` and table-level privileges only — not a superuser
- Enable PostgreSQL SSL for the `DATABASE_URL` connection in multi-host deployments: `postgresql://user:pass@host:5432/riskmind?sslmode=require`
- Perform regular `pg_dump` backups before schema migrations

### Firewall

- Port 4000 should NOT be exposed to the internet. The Cloudflare tunnel is the only ingress point.
- Only necessary ports should be open: 22 (SSH, restricted by IP), 5432 (PostgreSQL, local only)
- Verify with `sudo ss -tlnp` that PostgreSQL is bound to `127.0.0.1` only

### Cloudflare

- Enable Cloudflare WAF rules for the zone
- Configure IP Access Rules to restrict access by geography if applicable
- Enable Cloudflare Bot Management for the production zone

### Dependency Security

- Run `pnpm audit` regularly to check for known vulnerabilities in npm dependencies
- Subscribe to security advisories for critical dependencies: `express`, `openai`, `@anthropic-ai/sdk`, `drizzle-orm`

---

## Known Limitations and Future Work

| Limitation | Current State | Planned Fix |
|---|---|---|
| SSRF protection for LLM baseUrl | Admin-trust only | URL blocklist for RFC 1918 ranges (v2) |
| HTTP security headers | Not set at Express layer | Cloudflare Transform Rules (v2) |
| JWT token revocation | No server-side blacklist | Redis-backed revocation list (v2) |
| Password complexity policy | Not enforced server-side | Server-side Zod validation (v2) |
| Token storage | localStorage (XSS-accessible) | httpOnly cookies (v2) |
| PostgreSQL RLS | Not configured | Evaluate for additional defense-in-depth (v2) |
| Rate limiting | Cloudflare edge only | Express rate limiter per endpoint (v2) |
| Dependency audit automation | Manual | CI pipeline check (v2) |
