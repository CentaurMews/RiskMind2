# Stack Research

**Domain:** TypeScript monorepo deployment — Express 5 + React/Vite + PostgreSQL/pgvector on dedicated Linux server with Cloudflare tunnel
**Researched:** 2026-03-17
**Confidence:** HIGH (most components already installed on server, versions verified directly)

---

## Recommended Stack

### Process Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PM2 | 6.0.14 (latest) | Node.js process manager | Industry standard for production Node.js. Auto-restarts on crash, starts on system boot via `pm2 startup`, built-in log management, zero-downtime reload. Monorepo-aware via `ecosystem.config.cjs` with multiple `apps` entries. Already at 6.x — Node.js 20 compatible. |

PM2 is installed globally on this server at version 6.0.10. Latest is 6.0.14. Upgrade recommended but not blocking.

### Tunnel / Public Exposure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| cloudflared | 2026.3.0 | Cloudflare tunnel daemon | Already installed. Outbound-only connection — no firewall rules, no public IP exposure. Free tier supports named tunnels. Handles HTTPS termination. Run as systemd service for persistence. |

cloudflared is already installed at `/usr/local/bin/cloudflared` at version 2026.3.0. No additional installation needed.

**Deployment pattern:** Cloudflare tunnel routes to a single localhost port. The Express server serves both the API (`/api/*`) and the built React SPA (static files at `/`). No nginx needed — cloudflared → Express handles everything.

### Reverse Proxy / Static File Serving

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Express static middleware (built-in) | (Express 5) | Serve React dist/ files | Express already serves the API. Add `express.static` for the Vite build output + SPA catch-all fallback. Avoids a second process (nginx) for a single-server setup. |

**Do NOT install nginx** for this project. The server is single-tenant, no SSL termination is needed (Cloudflare handles it), and running cloudflared → Express is simpler and sufficient. Nginx adds operational overhead with no benefit here.

### Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL | 16.13 (installed) | Primary database | Already running on localhost:5432. Ubuntu 24.04 package. |
| postgresql-16-pgvector | apt package (available) | Vector similarity search extension | Listed in apt cache as `postgresql-16-pgvector`. Install with `sudo apt install postgresql-16-pgvector`, then `CREATE EXTENSION vector;` in the database. Required for AI semantic search features. |

### Build Tooling (Existing — No Changes)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| esbuild (via build.ts) | 0.27.3 | Bundle API server → dist/index.cjs | Already configured. Produces a single CJS bundle. PM2 runs this compiled output in production. |
| Vite | 7.x (catalog) | Build React SPA → dist/public/ | Already configured. `pnpm build` produces static files at `artifacts/riskmind-app/dist/public/`. |
| pnpm | workspace | Monorepo package manager | Already in use. Run `pnpm -r build` or individual workspace builds. |

### Environment Configuration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js `--env-file` flag | Node.js 20.6+ | Load .env file natively | Node.js 20.19.5 is on this server. Use `node --env-file=.env dist/index.cjs` instead of the `dotenv` npm package. PM2 handles env vars via `ecosystem.config.cjs` `env` block — no dotenv package needed at all. |

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | — | .env loading | **Do not add.** PM2 ecosystem config handles environment injection. Node.js 20+ `--env-file` covers dev. |
| `compression` | ^1.7.5 | Gzip middleware for Express | Add to Express for API response compression. Reduces bandwidth through Cloudflare tunnel. Worth adding during performance phase. |

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `pm2 startup` | Generate systemd unit for PM2 daemon | Run once, follow the output command. Makes PM2 auto-start on server reboot. |
| `pm2 save` | Persist current process list | Run after first `pm2 start ecosystem.config.cjs`. Survives reboots. |
| `cloudflared tunnel login` | Authenticate cloudflared with Cloudflare | Required once before creating tunnel. Opens browser or provides URL. |
| `cloudflared tunnel create riskmind` | Create named tunnel | Produces a UUID and credentials JSON file in `~/.cloudflared/`. |
| `cloudflared service install` | Install tunnel as systemd service | Run with `--config /etc/cloudflared/config.yml` to avoid root home dir issue. |

---

## Configuration Patterns

### PM2 Ecosystem File

The API server builds to `artifacts/api-server/dist/index.cjs`. PM2 runs this compiled output. For development, PM2 can use `tsx` as interpreter against the TypeScript source — but for production, always run the compiled CJS bundle.

```javascript
// ecosystem.config.cjs (at repo root)
module.exports = {
  apps: [
    {
      name: "riskmind-api",
      script: "./artifacts/api-server/dist/index.cjs",
      cwd: "/home/dante/RiskMind2",
      env_production: {
        NODE_ENV: "production",
        PORT: "3001",           // avoid occupied ports: 3000, 5173, 9323, 5037
        DATABASE_URL: "postgresql://...",
      },
      max_memory_restart: "512M",
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
    }
  ]
}
```

The React frontend is served as static files by the Express server — no separate PM2 process needed for the frontend.

### Express Static + SPA Fallback

Add to `artifacts/api-server/src/app.ts` after building the React app:

```typescript
import path from "path";
// After /api and /mcp routes, before 404 handler:
const distPath = path.resolve(process.cwd(), "artifacts/riskmind-app/dist/public");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});
```

This pattern: API on `/api/*`, static assets served from Vite's `dist/public/` output, all other routes return `index.html` for React Router.

### Cloudflare Tunnel Config

```yaml
# /etc/cloudflared/config.yml
tunnel: <TUNNEL-UUID>
credentials-file: /root/.cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: riskmind.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
```

Single ingress rule — all traffic goes to Express on port 3001 which handles both API and static files.

### Port Assignment

Occupied: 3000, 5173, 5432, 9323, 5037, 22
Recommended: **3001** for the combined Express server (API + static file serving)

---

## Installation

```bash
# pgvector (if not already installed)
sudo apt install postgresql-16-pgvector
# Then in psql:
# CREATE EXTENSION IF NOT EXISTS vector;

# PM2 upgrade (optional, 6.0.10 → 6.0.14)
npm install -g pm2@latest

# No other new packages needed — all tools are on the server
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Express serves static files | nginx as reverse proxy | Use nginx only if: multiple Node.js apps behind one domain, SSL offloading needed, high-traffic caching required. None of these apply here. |
| PM2 ecosystem.config.cjs | systemd unit files per service | Use systemd directly if you want zero Node.js tooling — valid but PM2 is already installed and simpler to manage. |
| PM2 ecosystem config for env vars | dotenv npm package | Use dotenv if Node.js < 20.6 or if the team strongly prefers .env files as the canonical source. Not needed here. |
| Single Express server (API + static) | Separate Vite preview server | Vite preview is dev-only convenience. Production should always serve static files from Express or nginx, not Vite's preview server. |
| Named cloudflared tunnel + systemd | `cloudflared tunnel --url localhost:3001` (quick tunnel) | Quick tunnels are fine for one-off demos but produce random URLs, expire, and do not survive reboots. Use named tunnels for persistent deployments. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| nginx | No benefit on a single-app server where Cloudflare handles SSL — adds config complexity for zero gain | Express `express.static` middleware |
| `vite preview` in production | Vite preview is not designed for production traffic — it lacks compression, caching headers, and process management | Express `express.static` + PM2 |
| Quick Cloudflare tunnels (`--url`) | Random subdomain, no persistence, expires — not suitable for internal tools | Named tunnel with `config.yml` and `cloudflared service install` |
| `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-dev-banner` | Replit-only plugins — will either fail or add overhead in non-Replit environments | Remove from `vite.config.ts` conditionally (already behind `REPL_ID` check) |
| `@replit/connectors-sdk` in production | Root `package.json` still has this — it's unused outside Replit | Remove from workspace `package.json` |
| PM2 cluster mode for this app | The AI job queue and agent scheduler maintain in-memory state — clustering would break this without Redis-backed coordination | Single-instance PM2 (no `instances: "max"`) |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| PM2 6.0.x | Node.js 20.x | Verified: PM2 6.0.10 on Node.js 20.19.5 works |
| cloudflared 2026.3.0 | Current Cloudflare API | Auto-updates by default — consider `--no-autoupdate` flag for production stability |
| PostgreSQL 16.13 | pgvector (apt) | `postgresql-16-pgvector` is in Ubuntu 24.04 apt repos, matches PG version |
| esbuild 0.27.3 | Node.js 20, CJS output | Produces `dist/index.cjs` — PM2 runs this with `node` directly, no tsx needed |
| Vite 7.x | React 19, @vitejs/plugin-react 5.x | Confirmed in workspace catalog |

---

## Sources

- PM2 official docs — `pm2.keymetrics.io/docs/usage/application-declaration/` — ecosystem config format, tsx interpreter support (HIGH confidence)
- cloudflared docs — `developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/` — config.yml format, ingress rules (HIGH confidence)
- cloudflared Linux service docs — `developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/as-a-service/linux/` — systemd install procedure (HIGH confidence)
- Server environment direct inspection — `pm2 --version`, `cloudflared version`, `psql --version`, `node --version`, `apt-cache search pgvector` — versions confirmed (HIGH confidence)
- Project source inspection — `package.json`, `pnpm-workspace.yaml`, `build.ts`, `vite.config.ts`, `app.ts` — existing patterns confirmed (HIGH confidence)
- npm registry — `npm show pm2 version`, `npm show drizzle-orm version` — latest versions verified (HIGH confidence)

---
*Stack research for: RiskMind server deployment (Express 5 + React/Vite + PostgreSQL + cloudflared)*
*Researched: 2026-03-17*
