# Sentry Monitoring Setup Guide

**✅ Sentry is configured with your DSN!**

Your DSN is already set up in both frontend and backend:
```
https://336d2646d3970e13ba997b0f41a0c8dd@o4511018218946560.ingest.us.sentry.io/4511018267574272
```

**You're almost done!** Just a few more steps to get source maps working and enable automated issue tracking.

---

## ✅ Already Completed

### Frontend (Next.js)
- ✅ Sentry SDK installed (`@sentry/nextjs`)
- ✅ Server-side configuration (`sentry.server.config.ts`)
- ✅ Edge runtime configuration (`sentry.edge.config.ts`)
- ✅ Client-side initialization in `instrumentation-client.ts` (required for Turbopack; do not use `sentry.client.config.ts`)
- ✅ Global error boundary (`app/global-error.tsx`)
- ✅ Source map uploads configured in `next.config.ts` (org `authhub`, project `node`)
- ✅ DSN fallback in code; set `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` in Vercel for prod uploads

### Backend (Fastify)
- ✅ Sentry SDK installed (`@sentry/node`)
- ✅ Instrumentation file created (`apps/api/src/instrument.ts`)
- ✅ Error handler reports 500s when `Sentry.isInitialized()` (not only when env DSN is set)
- ✅ Performance tracing enabled
- ✅ DSN fallback in code; set `SENTRY_DSN` on Render
- ✅ Webhook endpoint created (`/api/webhooks/sentry`)

---

## 🔧 Remaining Steps

### Step 1: Get Your Auth Token & Project Info

1. **Auth Token** (for source map uploads):
   - Go to **Settings** → **Auth Tokens**
   - Create a new auth token with the `project:releases` scope
   - Copy the token (starts with `sntrys_`)

2. **Organization Slug**:
   - Go to **Settings** → **General**
   - Copy the "Organization Slug"

3. **Project Slug**:
   - Go to **Settings** → **Projects**
   - Click on your project
   - Copy the "Project Slug" from the URL or settings

### Step 2: Add Source Map Config to Frontend

Add these to `apps/web/.env.local`:

```bash
# Sentry Source Map Upload (CLI-verified live project)
SENTRY_AUTH_TOKEN=sntrys_YOUR_TOKEN_HERE
SENTRY_ORG=authhub
SENTRY_PROJECT=node
```

### Step 3: Configure Sentry Webhook Integration (Automated Issue Tracking)

**🎯 New Feature:** Sentry issues can now automatically create task files in your project for AI agents to process!

1. **Generate a webhook secret:**
   ```bash
   openssl rand -hex 32
   ```

2. **Add webhook secret to backend environment:**
   Add to `apps/api/.env`:
   ```bash
   SENTRY_WEBHOOK_SECRET=your-generated-secret-here
   ```

3. **Create webhook in Sentry:**
   - Go to **Settings** → **Alerts** → **New Alert Rule**
   - Choose "Issue Alert" trigger
   - Configure filters (optional)
   - Add **Webhook** notification
   - Webhook URL: `https://your-api-domain.com/api/webhooks/sentry`
   - Secret: Use the same secret from step 1

4. **How it works:**
   - When Sentry detects a new issue, it sends a webhook to your API
   - The API creates a markdown task file in `.claude/tasks/sentry-issues/`
   - AI agents (Claude Code) can read and process these tasks automatically
   - Tasks include: issue details, stack traces, user context, breadcrumbs

### Step 4: Test Your Setup

**Test Frontend:**
```bash
cd apps/web && npm run dev
```
Any 500 errors will automatically appear in Sentry!

**Test Backend:**
```bash
cd apps/api && npm run dev
```
Visit any endpoint - errors are captured automatically.

**Test Webhook Integration:**
```bash
curl https://your-api-domain.com/api/webhooks/sentry/health
```
Should return: `{ data: { status: 'ok', integration: 'sentry-webhooks' } }`

---

## 🚀 You're Ready to Go!

Once you complete the steps above, your complete monitoring stack will be active:

- ✅ **Error Tracking** - Captures all server and client errors
- ✅ **Performance Monitoring** - Traces page loads and API requests
- ✅ **Session Replay** - Records user sessions around errors
- ✅ **Source Maps** - Readable stack traces in production
- ✅ **Automated Issue Tracking** - Issues create tasks for AI agents

---

## 📊 What Gets Monitored

| Type | What's Captured |
|------|----------------|
| **Errors** | Unhandled exceptions, promise rejections, React errors |
| **Performance** | Page load times, API durations, database queries |
| **Session Replay** | Video-like recordings of user sessions (frontend) |
| **User Context** | IP addresses, request headers, breadcrumbs |
| **AI Agent Tasks** | New Sentry issues → task files in `.claude/tasks/sentry-issues/` |

---

## 🔐 Security Notes

- **DSN is public** - It's safe to commit to git
- **Auth Token is secret** - Never commit this, use environment variables
- **Webhook Secret is secret** - Never commit, use environment variables
- **Sensitive data is filtered** - We automatically exclude auth tokens, cookies, and emails
- **Webhook signatures** - All webhooks are verified using HMAC SHA-256

---

## 📖 Documentation Links

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Node.js Docs](https://docs.sentry.io/platforms/javascript/guides/node/)
- [Sentry Webhooks](https://docs.sentry.io/product/alerts/notification-actions/webhooks/)
- [Your Sentry Dashboard](https://sentry.io/)

---

## Need Help?

1. Check your Sentry dashboard → **Issues** tab to see incoming errors
2. Check browser console for any Sentry initialization errors
3. Verify your `.env.local` values are correct
4. Make sure your dev servers are restarted after adding env vars
5. For webhook issues, check the API logs for signature verification errors
