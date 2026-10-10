# 🚀 Quick Start for New Claude Code Session

> **History — not current.** This describes a 2025 Meta-only Day 1 setup. Start at `docs/workspace/status.md` and `docs/workspace/source-map.md` instead.

**Copy this to start your next conversation:**

---

## Context

We're building an **OAuth aggregation platform MLP** (Minimum Lovable Product) to prove Meta OAuth works end-to-end in 1 week.

**Current Status:** Day 1 - External service setup
**Full Details:** See `PROGRESS.md` in this directory
**Detailed Plan:** See `/Users/jhigh/.claude/plans/gentle-squishing-quill.md`

---

## What You Need to Know

1. **Scope:** Meta OAuth only (no billing, teams, or other platforms yet)
2. **Goal:** Prove "OAuth aggregation is achievable with minimal effort"
3. **Where we are:** Need to set up 4 external services before coding

---

## Immediate Next Steps

### You Need These 4 Services:

1. **Neon** (PostgreSQL) → https://neon.tech
   - Get connection string for `DATABASE_URL`

2. **Clerk** (Auth) → https://clerk.com
   - Get `pk_test_...` and `sk_test_...` keys

3. **AWS** (Secrets Manager) → https://console.aws.amazon.com
   - Create IAM user with `SecretsManagerReadWrite`
   - Get access keys

4. **Meta Developer** (OAuth) → https://developers.facebook.com
   - Create app, get App ID and Secret
   - Set redirect URI: `http://localhost:3001/api/oauth/meta/callback`

### Then Create .env Files:

**`apps/api/.env`:**
```bash
DATABASE_URL="postgresql://..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
META_APP_ID="..."
META_APP_SECRET="..."
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
```

**`apps/web/.env.local`:**
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Then Initialize Database:

```bash
cd apps/api
npm run db:generate
npm run db:push
```

---

## What's Already Done

✅ Monorepo setup (Next.js 16 + Fastify)
✅ Dependencies installed (~1,192 packages)
✅ Prisma schema complete (6 tables)
✅ Shared types defined
✅ Detailed 5-day plan created

---

## Key Architecture

**Security Pattern (CRITICAL):**
- OAuth tokens NEVER stored in PostgreSQL
- ONLY AWS Secrets Manager IDs stored in database
- All token access logged in AuditLog table

**Database Flow:**
```
Agency → AccessRequest → ClientConnection → PlatformAuthorization
                                              └→ secretId (AWS reference)
```

---

## Files to Reference

- **Progress:** `/Users/jhigh/agency-access-platform/PROGRESS.md`
- **Detailed Plan:** `/Users/jhigh/.claude/plans/gentle-squishing-quill.md`
- **Codebase Guide:** `/Users/jhigh/agency-access-platform/CLAUDE.md`
- **Prisma Schema:** `apps/api/prisma/schema.prisma`

---

## Prompt to Use in New Session

```
I'm building an OAuth aggregation MLP (Meta only, technical validation).

Current status: Day 1 - Need to set up external services (Neon, Clerk, AWS, Meta).

See PROGRESS.md for full context and /Users/jhigh/.claude/plans/gentle-squishing-quill.md for detailed plan.

Can you help me continue where we left off?
```

---

**That's it!** Just share this context and you're ready to continue building.
