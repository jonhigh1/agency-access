# Render Deployment Guide

This guide covers deploying the Agency Access Platform to Render using the `render.yaml` blueprint.

## Architecture

- **Frontend**: Next.js (App Router) on Vercel
- **Backend**: Fastify API on Render Web Service
- **Database**: PostgreSQL (Neon) - also used for job queues (pg-boss)
- **Secrets**: Infisical

## 1. Create Render Project (Blueprint)

1. Go to [render.com/dashboard](https://render.com/dashboard)
2. Click **New** → **Blueprint**
3. Select your GitHub repo
4. Render reads `render.yaml` and creates `agency-access-api`. The web app deploys from Vercel.

## 2. Configure Environment Variables

Set environment variables for each service in the Render dashboard.

### Backend (API)

Required:

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://runtime_user:...@.../neondb?sslmode=require
MIGRATE_DATABASE_URL=postgresql://migration_owner:...@.../neondb?sslmode=require
FRONTEND_URL=https://your-app.vercel.app
API_URL=https://your-service.onrender.com
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
INFISICAL_CLIENT_ID=...
INFISICAL_CLIENT_SECRET=...
INFISICAL_PROJECT_ID=...
INFISICAL_ENVIRONMENT=prod
META_APP_ID=...
META_APP_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CREEM_API_KEY=...
CREEM_WEBHOOK_SECRET=...
OAUTH_STATE_HMAC_SECRET=$(openssl rand -hex 32)
SENTRY_WEBHOOK_SECRET=$(openssl rand -hex 32)
DB_ENFORCE_LEAST_PRIVILEGE=true
BACKGROUND_WORKERS_ENABLED=false
RATE_LIMIT_ENABLED=true
RATE_LIMIT_SKIP_AUTHENTICATED=true
TRUST_PROXY_IPS=<Render trusted proxy CIDRs>
AGENT_NATIVE_ENABLED=false
AGENT_NATIVE_AGENCY_ALLOWLIST=<comma-separated agency UUIDs>
AGENT_MCP_RESOURCE_URL=https://your-service.onrender.com/mcp
CLERK_OAUTH_ISSUER=https://<your-clerk-issuer>
CLERK_OAUTH_VERIFY_URL=https://api.clerk.com/v1/oauth_applications/access_tokens/verify
```

Pre-launch deploys should keep `BACKGROUND_WORKERS_ENABLED=false` to avoid background polling cost while there is no customer traffic. Turn it on only when token refresh, notifications, scheduled webhooks, and other background jobs are intentionally part of the launch posture.

When `DB_ENFORCE_LEAST_PRIVILEGE=true`, the runtime database role in `DATABASE_URL` must have `USAGE` on the `pgboss` schema plus `SELECT`/`INSERT`/`UPDATE`/`DELETE` on its tables and `USAGE`/`SELECT` on its sequences. Production uses **`agency_access_runtime`**; Neon hardening may use **`aap_app_runtime`**. Prisma migration `20261007120000_pgboss_runtime_grants` grants both roles idempotently when each role exists (skips missing roles). Without it, `BACKGROUND_WORKERS_ENABLED=true` fails at API boot with `permission denied for schema pgboss`.

Deploy the agent-native migration with `AGENT_NATIVE_ENABLED=false`, verify existing flows and the data invariants in `docs/agent-native-access-operations.md`, then enable only after the Clerk staging matrix and two-host MCP smoke pass. A production-enabled configuration fails startup when the issuer, HTTPS resource, or agency allowlist is missing.

Production startup fails when `OAUTH_STATE_HMAC_SECRET` is missing or shorter than 32 characters. Sentry webhook delivery also fails closed in production unless `SENTRY_WEBHOOK_SECRET` is configured and incoming requests include a valid signature.

Optional:

```bash
GOOGLE_ADS_DEVELOPER_TOKEN=...
RESEND_API_KEY=...
LOG_LEVEL=info
```

### Frontend (Web)

Required:

```bash
NEXT_PUBLIC_API_URL=https://your-service.onrender.com
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

Optional:

```bash
NEXT_PUBLIC_BRANDFETCH_CLIENT_ID=...
NEXT_PUBLIC_CREEM_PUBLISHABLE_KEY=pk_live_...
```

## 3. Deploy

1. Deploy the API service first.
2. Deploy the web app from Vercel second.

Render will:
- Install dependencies at repo root
- Build shared package + app
- Run `DATABASE_URL="${MIGRATE_DATABASE_URL:-$DATABASE_URL}" PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 npx prisma migrate deploy` during service startup
- Start the service using `render.yaml` commands

## 4. Prisma Migrations

Production schema changes must use committed Prisma migrations. Because this service stays on Render Free, migrations run from the `startCommand` before `npm start`:

```bash
cd apps/api
DATABASE_URL="${MIGRATE_DATABASE_URL:-$DATABASE_URL}" PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 npx prisma migrate deploy
```

`MIGRATE_DATABASE_URL` (or `DIRECT_URL`) should use a migration-capable database role AND point to the **direct (unpooled)** Neon hostname (e.g. `ep-xxxx.us-east-1.aws.neon.tech`, without `-pooler`). `DATABASE_URL` should use the least-privilege runtime role pointing to the pooled endpoint (`ep-xxxx-pooler.c-2.us-east-1.aws.neon.tech`).

> **Important**: Running `prisma migrate deploy` against Neon's pooled endpoint (`-pooler`) fails with `Error: P1001: Can't reach database server` because PgBouncer in transaction pooling mode drops DDL and migration connections. Ensure `MIGRATE_DATABASE_URL` or `DIRECT_URL` uses the direct (unpooled) Neon connection string.

The advisory lock is disabled for this Free-plan startup path because the previous live process can still hold pg-boss advisory locks while Render is starting the replacement process. Keep Render at one instance while using this startup migration pattern.

If the service later moves to a paid instance type, prefer Render's `preDeployCommand` for migrations so database changes complete before the new web process starts.

Do not use `prisma db push` against production. Use it only for local development experiments where migration history is not being preserved.

### Enabling background workers (post-merge)

After the `pgboss` runtime-grants migration is deployed to production:

1. Confirm `prisma migrate deploy` succeeded on the latest release (check Render deploy logs for `20261007120000_pgboss_runtime_grants`).
2. Set `BACKGROUND_WORKERS_ENABLED=true` on the Render API service.
3. Redeploy the API (or trigger a manual deploy) so pg-boss starts with the runtime role.
4. Verify startup logs include `pg-boss started successfully` and `pg-boss job handlers started`, and hit `GET /health`.

## 5. Update External Integrations

- **OAuth apps**: update redirect URLs to Render API domain
- **Clerk**: update allowed origins and redirect URLs to Render web domain
- **Creem**: update webhook endpoint to Render API domain

## 6. Health Checks

- API: `https://your-service.onrender.com/health`
- Web: load `https://your-app.vercel.app`

## 7. Logs

Use Render dashboard or CLI:

```bash
render logs
```

## Notes

- Keep Neon as external managed PostgreSQL service.
- Job queues use pg-boss (Postgres-backed) - no separate Redis required.
- `render.yaml` is the source of truth for build, migration, and start commands.
