# Deployment Guide

This guide covers deploying the Agency Access Platform. The platform consists of a Next.js frontend and a Fastify backend.

## Architecture

- **Frontend**: Next.js (App Router), deployed to **Vercel**.
- **Backend**: Fastify API, deployed to **Render**.
- **Database**: PostgreSQL (Neon).
- **Queue**: pg-boss on PostgreSQL.
- **Secrets**: Infisical.

## 1. Backend Deployment (Render)

The backend should be deployed first to obtain the API URL.

### Prerequisites

- Render account connected to your GitHub repo.
- PostgreSQL database (e.g., Neon).
- Infisical project set up.

### Deployment Steps

1. Create a new project on Render using the `render.yaml` blueprint.
2. Configure the following environment variables for the API service:
   - `NODE_ENV=production`
   - `PORT=3001`
   - `DATABASE_URL` (PostgreSQL connection string)
   - `FRONTEND_URL` (your Vercel frontend URL)
   - `API_URL` (your Render API URL)
   - `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` / `INFISICAL_PROJECT_ID` / `INFISICAL_ENVIRONMENT`
   - `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`
   - `OAUTH_STATE_HMAC_SECRET`
   - `SENTRY_WEBHOOK_SECRET`
   - `DB_ENFORCE_LEAST_PRIVILEGE=true`
   - `BACKGROUND_WORKERS_ENABLED=false` for pre-launch zero-traffic deploys
   - Platform OAuth credentials (META_APP_ID, etc.)
3. Render will automatically build, run Prisma migrations with `prisma migrate deploy` during startup, and start the API using the commands in `render.yaml`.

## 2. Frontend Deployment (Vercel)

### Prerequisites

- Vercel account connected to your GitHub repo.
- Deployed backend URL (from step 1).

### Deployment Steps

1. Import the repo in Vercel and **leave the project's root directory unset (empty)** — link it
   from the repository root (e.g. `vercel link --cwd .`), not from `apps/web`. Setting
   `rootDirectory` to `apps/web` makes Vercel run `npm install` from that directory, which can't
   see the root `package.json` workspaces and causes install failures. `vercel.json`'s
   `buildCommand`/`outputDirectory` (already configured at the repo root) handle building the
   monorepo and locating the Next.js app's output. See
   `docs/VERCEL_DEPLOYMENT_LESSONS_LEARNED.md` for the full rationale and history.
2. Add the following **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: Your deployed backend URL (e.g., `https://api.yourdomain.com`)
   - `NEXT_PUBLIC_APP_URL`: Your Vercel frontend URL (e.g., `https://app.yourdomain.com`)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_META_APP_ID`
   - `NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID`
   - `NEXT_PUBLIC_DOCS_URL`
   - `NEXT_PUBLIC_POSTHOG_KEY`
   - `NEXT_PUBLIC_POSTHOG_HOST`
3. Deploy from Vercel after the API health check passes.

## 3. Post-Deployment Configuration

### OAuth Callbacks

Ensure your OAuth applications (Meta, Google, etc.) have the correct callback URLs:
- `https://api.yourdomain.com/agency-platforms/meta/callback`
- `https://api.yourdomain.com/agency-platforms/google/callback`

### Clerk Configuration

Update your Clerk dashboard with the production URLs:
- **Home URL**: `https://app.yourdomain.com`
- **Redirect URLs**: After sign-in/sign-up.

## Monitoring

- **Render**: Deployment logs and runtime metrics.
- **Sentry**: (Optional) For error tracking.
