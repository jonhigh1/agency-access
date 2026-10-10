# OAuth Aggregation Platform - Progress & Next Steps

> **History — not current.** Day 1 Meta-only snapshot. Current state lives in `docs/workspace/status.md`.

**Last Updated:** 2025-12-24
**Status:** Day 1 - Foundation (External Service Setup)

---

## 🎯 Project Goal

Build a **Minimum Lovable Product (MLP)** to prove that Meta OAuth aggregation is technically achievable with minimal effort. Target timeline: 1 week (40-50 hours).

**Riskiest Assumption Being Tested:**
"Building OAuth aggregation is achievable with minimal effort"

---

## ✅ What's Complete

### 1. Planning & Architecture
- ✅ Comprehensive MLP plan created (see `/Users/jhigh/.claude/plans/gentle-squishing-quill.md`)
- ✅ Scope confirmed: Option A - Technical Validation (Meta OAuth only, no billing/teams)
- ✅ CLAUDE.md created with codebase guidance
- ✅ Build-kit.md reviewed and scope differences identified

### 2. Repository Setup
- ✅ Monorepo structure exists (apps/web, apps/api, packages/shared)
- ✅ Dependencies installed (~1,192 packages via npm workspaces)
- ✅ Prisma schema complete (6 tables: Agency, AgencyMember, AccessRequest, ClientConnection, PlatformAuthorization, AuditLog)
- ✅ Shared types defined (Platform enum, status schemas, OAuth scopes)
- ✅ Package.json scripts configured for all workspaces

### 3. Understanding
- ✅ Confirmed package count is normal for Next.js + Fastify monorepo
- ✅ Verified npm workspaces hoisting to root (efficient, no duplication)
- ✅ Reviewed existing codebase (basic Fastify server + Next.js layout exist)

---

## ⏳ Current Status: Day 1 - External Service Setup

**What We're Working On:**
Setting up the 4 required external services and creating `.env` files.

### Services Needed:

#### 1. Neon (PostgreSQL Database) ❌ NOT STARTED
- **URL:** https://neon.tech
- **Action:** Create project "agency-access-platform"
- **Deliverable:** Connection string (starts with `postgresql://...`)
- **Where it goes:** `apps/api/.env` as `DATABASE_URL`

#### 2. Clerk (Authentication) ❌ NOT STARTED
- **URL:** https://clerk.com
- **Action:** Create application "Agency Access Platform"
- **Deliverable:**
  - Publishable Key (starts with `pk_test_...`)
  - Secret Key (starts with `sk_test_...`)
- **Where it goes:**
  - `apps/api/.env` as `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`
  - `apps/web/.env.local` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`

#### 3. AWS (Secrets Manager) ❌ NOT STARTED
- **URL:** https://console.aws.amazon.com
- **Action:**
  1. Create IAM user "agency-platform-secrets"
  2. Attach policy `SecretsManagerReadWrite`
  3. Generate access keys
- **Deliverable:**
  - Access Key ID
  - Secret Access Key
  - Region (e.g., "us-east-1")
- **Where it goes:** `apps/api/.env` as `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

#### 4. Meta Developer (OAuth App) ❌ NOT STARTED
- **URL:** https://developers.facebook.com
- **Action:**
  1. Create app "Agency OAuth Platform"
  2. Add "Facebook Login" product
  3. Configure redirect URI: `http://localhost:3001/api/oauth/meta/callback`
- **Deliverable:**
  - App ID
  - App Secret
- **Where it goes:** `apps/api/.env` as `META_APP_ID`, `META_APP_SECRET`

---

## 📋 Immediate Next Steps (Day 1 Continuation)

### Step 1: Set Up External Services (2-3 hours)
Follow the instructions above to create accounts and gather credentials for all 4 services.

**Pro Tip:** Open all 4 services in separate browser tabs and sign up simultaneously to save time.

### Step 2: Create .env Files (10 minutes)

Once you have all credentials, create these two files:

**File 1: `apps/api/.env`**
```bash
# Database
DATABASE_URL="postgresql://[your-neon-connection-string]"

# Authentication
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."

# AWS
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"

# Meta OAuth
META_APP_ID="..."
META_APP_SECRET="..."

# Server Config
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
LOG_LEVEL=info
```

**File 2: `apps/web/.env.local`**
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Step 3: Initialize Database (15 minutes)
```bash
cd apps/api
npm run db:generate  # Generate Prisma client
npm run db:push      # Create tables in Neon
npm run db:studio    # (Optional) View database in browser
```

**Verify:**
- All 6 tables created in Neon dashboard (agencies, agency_members, access_requests, client_connections, platform_authorizations, audit_logs)
- Prisma client generated successfully

### Step 4: Build Clerk Authentication (2-3 hours)

**Frontend Setup:**
- Create `apps/web/src/middleware.ts` for auth protection
- Update `apps/web/src/app/layout.tsx` with `<ClerkProvider>`
- Create `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`

**Backend Setup:**
- Update `apps/api/src/lib/env.ts` with Clerk + AWS + Meta env vars
- Create `apps/api/src/lib/clerk.ts` for token verification middleware

**Verify:**
- Can sign up/sign in via Clerk UI
- Protected routes redirect to sign-in
- Public routes (`/authorize/*`) accessible without auth

### Step 5: Create Prisma Client (30 minutes)
- Create `apps/api/src/lib/prisma.ts` with singleton pattern
- Test database connection

**After Day 1:**
You should be able to:
- Sign in with Clerk
- Query database with Prisma
- Have all env vars configured and working

---

## 🗓 Remaining Days (Reference Only)

### Day 2: Meta OAuth Backend (8-10 hours)
- Build AWS Secrets Manager service
- Create Meta OAuth connector (getAuthUrl, exchangeCode, getLongLivedToken)
- Build OAuth callback route

### Day 3: Agency Dashboard (8-10 hours)
- Create access request API routes
- Build dashboard UI (create request, view status, copy link, view token)

### Day 4: Client Authorization Flow (8-10 hours)
- Client landing page
- OAuth success page (with confetti)
- Error page with retry

### Day 5: Testing & Deployment (6-8 hours)
- End-to-end testing
- Mobile testing
- Deploy to Railway (backend) and Vercel (frontend)

---

## 📚 Key Files & References

### Documentation
- **Detailed Plan:** `/Users/jhigh/.claude/plans/gentle-squishing-quill.md` (full 5-day implementation guide)
- **Codebase Guide:** `/Users/jhigh/agency-access-platform/CLAUDE.md` (for future Claude instances)
- **README:** `/Users/jhigh/agency-access-platform/README.md` (project overview)

### Database Schema
- **Location:** `apps/api/prisma/schema.prisma`
- **Tables:** 6 models (Agency, AgencyMember, AccessRequest, ClientConnection, PlatformAuthorization, AuditLog)
- **Key Pattern:** Tokens NEVER stored in PostgreSQL, only AWS Secrets Manager IDs

### Shared Types
- **Location:** `packages/shared/src/types.ts`
- **Exports:** Platform enum, status schemas, PLATFORM_NAMES, PLATFORM_SCOPES

### Existing Code
- **Backend:** `apps/api/src/index.ts` (Fastify server with health check)
- **Frontend:** `apps/web/src/app/layout.tsx` and `page.tsx` (basic Next.js setup)

---

## 🎯 Success Criteria for MLP

After 1 week, we should have:
- ✅ Agency can create access request → get shareable link
- ✅ Client clicks link → completes Meta OAuth
- ✅ Token stored in AWS Secrets Manager (not database)
- ✅ Agency retrieves token from dashboard
- ✅ >90% OAuth success rate (no critical bugs)
- ✅ Stable enough to demo to 3-5 pilot agencies

---

## 🚨 What's Out of Scope (DO NOT BUILD YET)

**Defer to Week 2+:**
- ❌ Multiple platforms (Google Ads, LinkedIn, GA4, TikTok, Instagram)
- ❌ Stripe subscriptions/billing
- ❌ Team member management
- ❌ Email confirmation system
- ❌ Automatic token refresh (BullMQ jobs)
- ❌ Rate limiting
- ❌ Advanced analytics dashboard
- ❌ White-label branding

**Why:** We need to prove the core OAuth flow works FIRST before adding complexity.

---

## 💡 Tips for New Conversation

When starting a new conversation, provide this context:

1. **What we're building:** OAuth aggregation platform MLP (Meta only, technical validation)
2. **Where we are:** Day 1 - External service setup
3. **What's needed:** Set up Neon, Clerk, AWS, Meta Developer accounts
4. **Reference:** See `/Users/jhigh/.claude/plans/gentle-squishing-quill.md` for full plan

**Quick start command for next session:**
```
"We're building an OAuth aggregation MLP. See PROGRESS.md for current status.
We need to set up external services (Neon, Clerk, AWS, Meta) and create .env files.
See the detailed plan at /Users/jhigh/.claude/plans/gentle-squishing-quill.md"
```

---

## 📞 Current Blockers

**None** - Ready to proceed with external service setup!

Just need to:
1. Create accounts for Neon, Clerk, AWS, Meta
2. Gather credentials
3. Create `.env` files
4. Run `npm run db:push` to initialize database

Then we can start building!

---

## 🔗 Quick Links

- **Neon Dashboard:** https://console.neon.tech (after signup)
- **Clerk Dashboard:** https://dashboard.clerk.com (after signup)
- **AWS Console:** https://console.aws.amazon.com
- **Meta Developers:** https://developers.facebook.com/apps
- **Detailed Plan:** file:///Users/jhigh/.claude/plans/gentle-squishing-quill.md
- **CLAUDE.md:** file:///Users/jhigh/agency-access-platform/CLAUDE.md

---

**Last Action:** User asked to create summary for new conversation
**Next Action:** User will set up external services, then continue with Day 1 implementation
