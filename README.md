# Agency Access Platform

OAuth aggregation platform for marketing agencies - one-click client authorization across multiple platforms.

## 🎯 What This Is

A SaaS platform that replaces 2-3 days of manual OAuth setup with a 5-minute automated flow. Agencies create access requests, clients click one link and authorize all platforms sequentially, agencies get instant access.

**Target Platforms (MVP):**
- Meta Ads Manager (Facebook/Instagram)
- Google Ads
- Google Analytics 4
- LinkedIn Ads

## 📁 Project Structure

```
agency-access-platform/
├── apps/
│   ├── web/          # Next.js 16 frontend (Render)
│   └── api/          # Fastify backend (Render)
├── packages/
│   └── shared/       # Shared TypeScript types
└── README.md
```

## 🛠 Tech Stack

### Frontend (apps/web)
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS + shadcn/ui
- **Auth:** Clerk
- **State:** React Query
- **Deployment:** Render

### Backend (apps/api)
- **Runtime:** Node.js 20+
- **Framework:** Fastify
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon) + Prisma ORM
- **Jobs:** BullMQ
- **Cache:** Redis (Upstash)
- **Token Storage:** Infisical
- **Deployment:** Render

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL database (recommend [Neon](https://neon.tech))
- Redis instance (recommend [Upstash](https://upstash.com))
- Clerk account
- Infisical account (for secrets management)

### 1. Clone and Install

```bash
cd agency-access-platform
npm install
```

### 1b. Git hooks setup

```bash
bash scripts/setup/install-git-hooks.sh
```

Points this clone at the committed hooks in `.githooks/` (survives
re-clone, unlike `.git/hooks/`). The pre-push hook blocks pushes to `main`
that fail `npm run typecheck` or `npm run build`, validated against a clean
checkout of the pushed commit — not your working tree — so a build that
only passes locally because of uncommitted changes gets caught before it
reaches Render/Vercel. Non-`main` pushes are unaffected. Emergency bypass:
`git push --no-verify`. Details: [`.githooks/README.md`](.githooks/README.md).

### 2. Set Up Environment Variables

**Backend (`apps/api/.env`):**
```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and fill in:
- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `CLERK_SECRET_KEY` - From Clerk dashboard
- `INFISICAL_CLIENT_ID` & `INFISICAL_CLIENT_SECRET` - From Infisical
- `INFISICAL_PROJECT_ID` & `INFISICAL_ENVIRONMENT` - From Infisical project
- `REDIS_URL` - Your Upstash Redis URL

**Frontend (`apps/web/.env.local`):**
```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/web/.env.local` and fill in:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk dashboard
- `CLERK_SECRET_KEY` - From Clerk dashboard

### 3. Set Up Database

```bash
# Generate Prisma client
cd apps/api
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Prisma Studio to view database
npm run db:studio
```

### 4. Start Development Servers

```bash
# From root directory
npm run dev

# Or run individually:
npm run dev:web   # Frontend on http://localhost:3000
npm run dev:api   # Backend on http://localhost:3001
```

## 📦 Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend
- `npm run build` - Build all apps
- `npm run lint` - Lint all apps
- `npm run typecheck` - Type-check all apps

### Frontend (apps/web)
- `npm run dev` - Start Next.js dev server
- `npm run build` - Production build
- `npm run start` - Start production server
- `npm run lint` - Lint code

### Backend (apps/api)
- `npm run dev` - Start Fastify with hot reload
- `npm run build` - Build TypeScript
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open Prisma Studio

## 🏗 Development Workflow

### Adding a New Feature

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Update Database Schema** (if needed)
   ```bash
   # Edit apps/api/prisma/schema.prisma
   cd apps/api
   npm run db:push
   npm run db:generate
   ```

3. **Develop**
   ```bash
   npm run dev  # From root
   ```

4. **Type-check**
   ```bash
   npm run typecheck
   ```

5. **Lint**
   ```bash
   npm run lint
   ```

### Adding Platform Connectors

Platform connectors go in `apps/api/src/services/connectors/`:

```typescript
// Example: apps/api/src/services/connectors/meta.ts
export class MetaConnector {
  getAuthUrl(state: string): string {
    // Return OAuth URL
  }

  async exchangeCode(code: string): Promise<Tokens> {
    // Exchange code for tokens
  }

  async refreshToken(refreshToken: string): Promise<Tokens> {
    // Refresh access token
  }
}
```

## 🔐 Security Best Practices

### Token Storage
- **NEVER** store tokens in PostgreSQL directly
- **ALWAYS** use Infisical for OAuth tokens
- Encrypt secret IDs at rest
- Rotate Infisical Machine Identity credentials quarterly

### Authentication
- Clerk handles all user auth
- Validate Clerk JWT on every API request
- Use role-based access control (RBAC)

### Audit Logging
- Log every token access
- Include: user email, IP address, timestamp, action
- Logs are append-only (never delete)

## 📊 Database Schema

See `apps/api/prisma/schema.prisma` for full schema.

**Key Models:**
- `Agency` - Marketing agencies using the platform
- `AgencyMember` - Team members with roles
- `AccessRequest` - Access requests created by agencies
- `ClientConnection` - Active client connections
- `PlatformAuthorization` - Per-platform OAuth tokens
- `AuditLog` - Security audit trail

## 🚢 Deployment

### Render (Frontend + Backend)

Create a Render project using the `render.yaml` blueprint in the repo root.
This will provision both services and run the monorepo build commands.

### Environment Variables

**Render (Frontend + Backend):**
- Add environment variables in Render dashboard (or via CLI)
- Production variables must match `.env.local.example` and `apps/api/.env.example`

## 📖 API Documentation

API runs on `http://localhost:3001` in development.

### Health Check
```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-22T10:30:00.000Z"
}
```

### Coming Soon
- OAuth initiation endpoints
- Token management endpoints
- Agency management endpoints

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test connection
cd apps/api
npx prisma db pull
```

### Clerk Auth Not Working

1. Check Clerk dashboard for correct keys
2. Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts with `pk_`
3. Verify `CLERK_SECRET_KEY` starts with `sk_`
4. Restart dev server after changing env vars

### Port Already in Use

```bash
# Frontend (3000)
lsof -ti:3000 | xargs kill -9

# Backend (3001)
lsof -ti:3001 | xargs kill -9
```

## 📚 Resources

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Fastify Documentation](https://fastify.dev)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

## 📝 License

Proprietary - All Rights Reserved

## 🤝 Contributing

This is a private project. For access, contact the project owner.

---

**Built with:**
- Next.js 16
- Fastify
- Prisma
- PostgreSQL
- Redis
- Infisical
- Clerk
- TailwindCSS
