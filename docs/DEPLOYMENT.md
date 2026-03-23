# RiskMind Production Deployment Guide

**Version:** 1.1
**Last Updated:** 2026-03-19
**Target Environment:** Ubuntu Linux (Dedicated Server)

---

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [PostgreSQL and pgvector Setup](#postgresql-and-pgvector-setup)
3. [Application Setup](#application-setup)
4. [Environment Configuration](#environment-configuration)
5. [Build Process](#build-process)
6. [PM2 Configuration](#pm2-configuration)
7. [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
8. [Boot Persistence](#boot-persistence)
9. [Log Management](#log-management)
10. [Health Checks](#health-checks)
11. [Monitoring](#monitoring)
12. [Updating the Application](#updating-the-application)
13. [Rollback Procedure](#rollback-procedure)

---

## Server Requirements

### Minimum Hardware

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 40 GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

| Software | Version | Purpose |
|---|---|---|
| Ubuntu | 22.04 LTS or 24.04 LTS | Operating system |
| Node.js | 20.x LTS | Application runtime |
| pnpm | 9.x | Package manager (build only) |
| PostgreSQL | 16.x | Primary database |
| pgvector | 0.7.x or later | Vector similarity extension |
| PM2 | 5.x or 6.x | Process management |
| cloudflared | Latest | Cloudflare tunnel agent |

---

## PostgreSQL and pgvector Setup

### Install PostgreSQL 16

```bash
# Add PostgreSQL apt repository
sudo apt install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list'

sudo apt update
sudo apt install -y postgresql-16
```

### Install pgvector

```bash
sudo apt install -y postgresql-16-pgvector
```

### Create the Database

```bash
sudo -u postgres psql <<'EOF'
CREATE USER riskmind WITH PASSWORD 'your-strong-password-here';
CREATE DATABASE riskmind OWNER riskmind;
\c riskmind
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL PRIVILEGES ON DATABASE riskmind TO riskmind;
EOF
```

### Verify Extensions

```bash
sudo -u postgres psql -d riskmind -c "\dx"
```

Expected output includes rows for `uuid-ossp` and `vector`.

### PostgreSQL Configuration

For production performance, adjust these settings in `/etc/postgresql/16/main/postgresql.conf`:

```ini
# Memory (adjust based on available RAM)
shared_buffers = 512MB          # 25% of RAM
effective_cache_size = 1536MB   # 75% of RAM
work_mem = 16MB

# For pgvector performance
maintenance_work_mem = 128MB

# Logging
log_min_duration_statement = 1000   # Log slow queries (ms)
log_line_prefix = '%t [%p]: '
```

Reload PostgreSQL after changes:
```bash
sudo systemctl reload postgresql
```

---

## Application Setup

### Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Verify: v20.x.x
```

### Install pnpm

```bash
npm install -g pnpm
pnpm --version  # Verify: 9.x.x
```

### Install PM2

```bash
npm install -g pm2
pm2 --version
```

### Clone the Repository

```bash
cd /home/dante
git clone <repo-url> RiskMind2
cd RiskMind2
```

### Install Dependencies

```bash
pnpm install
```

---

## Environment Configuration

Create the `.env` file at the project root. This file is loaded by PM2 via Node's `--env-file` flag.

```bash
nano /home/dante/RiskMind2/.env
```

### Required Variables

```bash
# Server
PORT=4000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://riskmind:your-password@localhost:5432/riskmind

# Security — generate these values, store them securely
JWT_SECRET=<64+ character random hex string>
ENCRYPTION_KEY=<base64-encoded 32-byte value>
```

### Generating Secret Values

Generate `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Generate `ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### File Permissions

Restrict `.env` access to the application user:

```bash
chmod 600 /home/dante/RiskMind2/.env
```

---

## Build Process

Run the full build from the project root. This compiles TypeScript, bundles the API server with esbuild, and bundles the SPA with Vite.

```bash
cd /home/dante/RiskMind2

# 1. Build shared libraries (tsc --build)
pnpm typecheck:libs

# 2. Push schema to database (creates/updates tables)
cd lib/db && pnpm drizzle-kit push && cd ../..

# 3. Build all artifacts (api-server → dist/index.cjs, riskmind-app → dist/public/)
pnpm build
```

### Build Outputs

| Artifact | Location | Description |
|---|---|---|
| API server bundle | `artifacts/api-server/dist/index.cjs` | Single CommonJS file, all deps bundled |
| React SPA | `artifacts/riskmind-app/dist/public/` | Static HTML/JS/CSS assets |

The Express server is configured to serve the SPA static files from `artifacts/riskmind-app/dist/public/` relative to its compiled location at `artifacts/api-server/dist/index.cjs`.

---

## PM2 Configuration

The PM2 configuration is committed at the project root as `ecosystem.config.cjs`.

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "riskmind",
      script: "artifacts/api-server/dist/index.cjs",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      node_args: "--env-file /home/dante/RiskMind2/.env",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      error_file: "./logs/riskmind-error.log",
      out_file: "./logs/riskmind-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
```

### Key Configuration Notes

- `node_args: "--env-file ..."` — Uses Node.js 20's native `--env-file` flag. PM2 6.x's own `env_file` option has known bugs; the Node native approach is reliable.
- `instances: 1` — Single process. The application manages its own internal schedulers (job queue, agent scheduler, monitoring). Multi-instance clustering requires stateful coordination not yet implemented.
- `exec_mode: "fork"` — Fork mode is required for single instance with the native `--env-file` flag.
- `max_memory_restart: "1G"` — PM2 auto-restarts if the process exceeds 1 GB heap. Adjust based on available server RAM.

### Starting the Application

```bash
cd /home/dante/RiskMind2

# Create logs directory if it does not exist
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.cjs

# Verify status
pm2 status
pm2 logs riskmind --lines 50
```

### PM2 Management Commands

```bash
# View status
pm2 status

# View live logs
pm2 logs riskmind

# Restart after a code update
pm2 restart riskmind

# Graceful reload (zero-downtime for clustered; same as restart for fork)
pm2 reload riskmind

# Stop
pm2 stop riskmind

# Delete from PM2 registry
pm2 delete riskmind
```

---

## Cloudflare Tunnel Setup

The application is exposed publicly via a Cloudflare tunnel. This provides HTTPS, DDoS protection, and eliminates the need to open firewall ports.

### Prerequisites

- A Cloudflare account with a domain under Cloudflare management
- `cloudflared` CLI installed

### Install cloudflared

```bash
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

### Authenticate cloudflared

```bash
cloudflared tunnel login
```

Follow the browser prompt to authorize with your Cloudflare account.

### Create the Tunnel

```bash
cloudflared tunnel create riskmind
```

This generates a credentials file at `~/.cloudflared/<tunnel-uuid>.json`. Note the tunnel UUID shown in the output.

### Configure the Tunnel

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <tunnel-uuid>
credentials-file: /home/dante/.cloudflared/<tunnel-uuid>.json

ingress:
  - hostname: app.riskmind.net
    service: http://localhost:4000
    originRequest:
      noTLSVerify: false
  - service: http_status:404
```

### Configure DNS

```bash
cloudflared tunnel route dns riskmind app.riskmind.net
```

This creates a CNAME DNS record in Cloudflare pointing `app.riskmind.net` to the tunnel.

### Install as a systemd Service

```bash
sudo cloudflared --config /etc/cloudflared/config.yml service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

### Verify the Tunnel

```bash
# Check tunnel status
cloudflared tunnel info riskmind

# Test public access
curl -I https://app.riskmind.net/api/v1/health
```

---

## Boot Persistence

### PM2 Boot Persistence

Configure PM2 to start automatically on system boot:

```bash
# Generate the startup script for the current init system
pm2 startup

# PM2 prints a command to run as root — execute it. Example:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd \
  -u dante --hp /home/dante

# Save the current PM2 process list
pm2 save
```

Verify persistence by rebooting the server and checking `pm2 status`.

### Cloudflare Tunnel Boot Persistence

The `cloudflared service install` command (above) creates and enables a systemd unit. Verify:

```bash
sudo systemctl is-enabled cloudflared
# Expected: enabled

sudo systemctl is-active cloudflared
# Expected: active
```

### PostgreSQL Boot Persistence

PostgreSQL is managed by systemd and is enabled on install:

```bash
sudo systemctl is-enabled postgresql
# Expected: enabled
```

---

## Log Management

### PM2 Log Rotation

Install the PM2 log rotation module:

```bash
pm2 install pm2-logrotate
```

Configure rotation settings:

```bash
# Rotate when log file exceeds 10 MB
pm2 set pm2-logrotate:max_size 10M

# Keep 30 rotated log files
pm2 set pm2-logrotate:retain 30

# Compress rotated logs
pm2 set pm2-logrotate:compress true

# Rotate daily at midnight
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

### Log File Locations

| Log | Path |
|---|---|
| Application stdout | `/home/dante/RiskMind2/logs/riskmind-out.log` |
| Application stderr | `/home/dante/RiskMind2/logs/riskmind-error.log` |
| PM2 itself | `~/.pm2/logs/` |
| Cloudflare tunnel | `journalctl -u cloudflared` |
| PostgreSQL | `/var/log/postgresql/` |

### Viewing Logs

```bash
# Live tail — all PM2 apps
pm2 logs

# Live tail — riskmind only
pm2 logs riskmind

# Last 100 lines
pm2 logs riskmind --lines 100

# Cloudflare tunnel logs
sudo journalctl -u cloudflared -f

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

---

## Health Checks

### Application Health Endpoint

```bash
curl https://app.riskmind.net/api/v1/health
```

**Expected healthy response (HTTP 200):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-03-19T10:00:00.000Z"
}
```

**Degraded response (HTTP 503):**
```json
{
  "status": "degraded",
  "database": "error",
  "timestamp": "2026-03-19T10:00:00.000Z"
}
```

### Process Health

```bash
# PM2 process status
pm2 status

# Expected fields for the riskmind process:
# status: online
# cpu: <percentage>
# memory: <usage>
# restarts: 0 (or low)
```

### Database Health

```bash
sudo -u postgres psql -d riskmind -c "SELECT 1 AS health;"
```

### Disk Health

```bash
df -h /
# Monitor: keep usage below 80% to prevent log overflow
```

---

## Monitoring

### PM2 Monitoring (Built-in)

```bash
pm2 monit
```

Opens a terminal dashboard showing CPU, memory, and logs for all PM2 processes in real time.

### Uptime Monitoring

Configure an external uptime monitor to poll `https://app.riskmind.net/api/v1/health` every 60 seconds. Recommended tools: Uptime Kuma (self-hosted), Better Uptime, or Pingdom.

Alert conditions:
- HTTP status is not 200
- Response time exceeds 5 seconds
- `database` field is not `"connected"`

### PostgreSQL Monitoring

Check for bloated tables or slow queries:

```bash
# Table sizes
sudo -u postgres psql -d riskmind -c "
  SELECT relname AS table, pg_size_pretty(pg_total_relation_size(oid)) AS size
  FROM pg_class WHERE relkind = 'r' ORDER BY pg_total_relation_size(oid) DESC LIMIT 15;
"

# Active connections
sudo -u postgres psql -d riskmind -c "SELECT count(*) FROM pg_stat_activity;"

# Long-running queries
sudo -u postgres psql -d riskmind -c "
  SELECT pid, now() - query_start AS duration, query
  FROM pg_stat_activity
  WHERE state = 'active' AND now() - query_start > interval '5 seconds'
  ORDER BY duration DESC;
"
```

---

## Updating the Application

Follow this procedure for every code update:

```bash
cd /home/dante/RiskMind2

# 1. Pull latest code
git pull origin main

# 2. Install any new dependencies
pnpm install

# 3. Rebuild shared libraries
pnpm typecheck:libs

# 4. Apply any schema changes
cd lib/db && pnpm drizzle-kit push && cd ../..

# 5. Build all artifacts
pnpm build

# 6. Restart the PM2 process
pm2 restart riskmind

# 7. Verify health
curl https://app.riskmind.net/api/v1/health
pm2 status
pm2 logs riskmind --lines 20
```

---

## Rollback Procedure

If a deployment causes a critical failure:

```bash
# 1. Identify the last working commit
git log --oneline -10

# 2. Check out the last known good commit
git checkout <commit-sha>

# 3. Rebuild
pnpm install
pnpm typecheck:libs
pnpm build

# 4. Restart
pm2 restart riskmind

# 5. Verify health
curl https://app.riskmind.net/api/v1/health
```

**Database rollback:** Schema push changes cannot be automatically reversed. If a schema change caused data loss or corruption, restore from a PostgreSQL backup:

```bash
# Restore from pg_dump backup
sudo -u postgres pg_restore -d riskmind /path/to/backup.dump
```

Maintain regular `pg_dump` backups before every deployment that includes schema changes:

```bash
sudo -u postgres pg_dump -Fc riskmind > /path/to/backup-$(date +%Y%m%d).dump
```
