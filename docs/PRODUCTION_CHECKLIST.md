# Production OAuth Checklist - Quick Start

## Production Readiness Launch Gates

Run these from a clean Node 24 install before customer launch:

```bash
npm install --no-audit
npm audit --omit=dev --audit-level=moderate --workspace=apps/api --workspace=apps/web
npm run db:generate --workspace=apps/api
DATABASE_URL='postgresql://user:password@host:5432/db?sslmode=require' npm exec --workspace=apps/api -- prisma validate --schema prisma/schema.prisma
DATABASE_URL='postgresql://migration_user:password@host:5432/db?sslmode=require' npm run db:migrate:deploy --workspace=apps/api
npm run lint
npm run typecheck
npm run build
npm run test
npm run perf:web:inp-smoke
```

Required production controls:

- `OAUTH_STATE_HMAC_SECRET` is set to a generated 32-byte+ value.
- `SENTRY_WEBHOOK_SECRET` is set when Sentry webhooks are enabled; `skip` and `disabled` are local-only.
- `DB_ENFORCE_LEAST_PRIVILEGE=true` with `DATABASE_URL` set to a non-owner runtime database role and `MIGRATE_DATABASE_URL` set to a migration-capable role.
- `BACKGROUND_WORKERS_ENABLED=false` for pre-launch zero-traffic deploys; turn on deliberately for launch-critical background jobs (requires migration `20261007120000_pgboss_runtime_grants` for least-privilege runtime roles — production `agency_access_runtime`, optional `aap_app_runtime`).
- Render API service uses `npm install --no-audit --include=dev`.
- While staying on Render Free, `startCommand` runs `DATABASE_URL="${MIGRATE_DATABASE_URL:-$DATABASE_URL}" PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 npx prisma migrate deploy` before `npm start`; keep one instance, and if upgraded to a paid plan later, move migrations to `preDeployCommand`.
- Vercel web project is linked to the production account/team and has `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, Clerk, Meta Business Login, docs, and PostHog env vars configured.
- Public invite, referral, sitemap, robots, and OAuth callback routes still pass proxy tests while `/dev`, `/test`, `/perf`, and `/design-system` stay unavailable to production customers.

## ✅ What's Already Working

- **Meta OAuth** - Fully implemented (`meta.ts`)
- **Google OAuth** - Fully implemented (`google.ts`)
- **Google Ads** - Separate connector (`google-ads.ts`)
- **GA4** - Separate connector (`ga4.ts`)

## ⚠️ Important: Two Types of OAuth

**1. Clerk OAuth (User Authentication)**
- For users signing in to your app
- Configured in Clerk Dashboard → Social Connections
- Needs separate Google OAuth client ID
- See [CLERK_GOOGLE_OAUTH_SETUP.md](./CLERK_GOOGLE_OAUTH_SETUP.md)

**2. Platform OAuth (Connecting Accounts)**
- For connecting agency/client accounts
- Configured via environment variables
- Uses different Google OAuth client ID
- See sections below

## ⚠️ What Needs to Be Done

### Agent-native access operations

- [ ] Deploy the additive agent migration with `AGENT_NATIVE_ENABLED=false`.
- [ ] Confirm existing agency, request, invite, OAuth, webhook, billing, and quota smoke tests.
- [ ] Configure Clerk OAuth issuer, exact MCP resource, verification endpoint, and approved OAuth clients.
- [ ] Exercise wrong issuer/audience/resource, expiry, local grant revocation, and authorization-server revocation in staging.
- [ ] Add only confirmed design-partner agency UUIDs to `AGENT_NATIVE_AGENCY_ALLOWLIST`.
- [ ] Complete the full loop and revocation with two current MCP hosts; record host versions and date.
- [ ] Inspect agent metrics and verify no PII, token, API key, signing secret, or secret ID appears in responses or logs.
- [ ] Rehearse `AGENT_NATIVE_ENABLED=false` rollback and retain additive security records.

See `docs/agent-native-access-operations.md` for commands, invariants, troubleshooting, and rollback.

### 1. Environment Variables (Render)

Set these in Render dashboard → Environment:

```bash
# URLs (set after deployment)
API_URL=https://your-service.onrender.com
FRONTEND_URL=https://your-app.vercel.app

# Meta OAuth
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-token  # Optional
```

### 2. Meta OAuth App Configuration

**In Meta App Settings:**

1. **Valid OAuth Redirect URIs:**
   ```
   https://your-service.onrender.com/agency-platforms/meta/callback
   ```

2. **App Review:**
   - Request permissions: `ads_management`, `ads_read`, `business_management`
   - OR add test users for immediate testing

3. **Production Mode:**
   - Toggle app to "Public" after permissions approved

### 3. Google OAuth App Configuration

**In Google Cloud Console:**

1. **Authorized Redirect URIs:**
   ```
   https://your-service.onrender.com/agency-platforms/google/callback
   ```

2. **OAuth Consent Screen:**
   - Add required scopes
   - Add privacy policy URL
   - Publish app OR add test users

3. **Enable APIs:**
   - Google Ads API
   - Google Analytics Admin API
   - Google Tag Manager API
   - (Others as needed)

### 4. Configure Clerk Google OAuth (User Authentication)

**Separate from platform OAuth!**

1. Create Google OAuth client ID in Google Cloud Console
2. Add Clerk redirect URI to authorized redirect URIs
3. Go to Clerk Dashboard → Social Connections → Google
4. Enable Google and add Client ID + Secret
5. See [CLERK_GOOGLE_OAUTH_SETUP.md](./CLERK_GOOGLE_OAUTH_SETUP.md) for details

### 5. Test OAuth Flow

1. **User Sign-In:**
   - Test "Sign in with Google" button
   - Should redirect to Google and sign you in

2. **Agency Connection:**
   - Go to `/onboarding/platforms`
   - Click "Connect" for Meta or Google
   - Should redirect to OAuth provider
   - Authorize and return to app

3. **Client Authorization:**
   - Create access request
   - Send link to client
   - Client authorizes platforms
   - Agency receives tokens

### 5. Verify Tokens

1. **Check Database:**
   - `AgencyPlatformConnection` should have `secretId`
   - `PlatformAuthorization` should have `secretId`

2. **Check Infisical:**
   - Tokens should be stored in Infisical
   - Secret name format: `meta_connection_{id}_meta_ads`

3. **Check Logs:**
   - No errors in Render logs
   - Token refresh jobs running

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| `redirect_uri_mismatch` | Check callback URL matches exactly in OAuth app |
| `Invalid OAuth state` | Check OAuth state storage and HMAC secret configuration; state token may be expired |
| `Access denied` | Add test users or publish OAuth app |
| `Token exchange failed` | Verify credentials are correct |

## 📋 Full Documentation

See [PRODUCTION_OAUTH_SETUP.md](./PRODUCTION_OAUTH_SETUP.md) for detailed setup instructions.

## Meta outcome-access launch gate

- [ ] `META_LOGIN_FOR_BUSINESS_CONFIG_ID` and `NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID` match the approved Meta configuration.
- [ ] Each receiving destination reports ready after live provider read-back of the matching `ADMIN` system user.
- [ ] Provider sandbox proves the stored recipe tasks for Ad Accounts and Pages; no `MANAGE` task is inferred.
- [ ] Manual fallback is verified using native assigned-user or partner access read-back.
- [ ] Desktop and mobile invite runs cover no portfolio, portfolio choice, insufficient authority, handoff, popup cancellation/blocking, partial resume, and final diagnostics.
- [ ] Audit logs contain outcome/error classes and resource IDs, never raw Meta tokens or provider payloads.
- [ ] Deployment and production configuration changes have separate approval.
