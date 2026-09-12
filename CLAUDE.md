# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

- **Monorepo**: `apps/web` (Next.js 16), `apps/api` (Fastify), `packages/shared` (types + Zod). Run from root: `npm run dev`, `npm run test`, `npm run typecheck`.
- **Ports**: Frontend 3000, Backend 3001, Prisma Studio 5555.
- **Tokens**: NEVER store OAuth tokens in PostgreSQL. Use Infisical; store only `secretId` in DB. See Critical Architecture below.
- **Tests**: Write failing tests BEFORE implementation (TDD). Tests live in `__tests__/` next to source. See [docs/tdd-guide.md](docs/tdd-guide.md) for tutorial; rules and coverage are in the TDD section below.
- **Shared types**: `packages/shared/src/types.ts`; export from `packages/shared/src/index.ts`. Use `@agency-platform/shared` in both apps.
- **Connectors**: OAuth connectors in `apps/api/src/services/connectors/`. Registry in `registry.config.ts`, base class `BaseConnector`, factory in `factory.ts`.
- **Design system**: `apps/web/DESIGN_SYSTEM.md`; token showcase at `http://localhost:3000/design-system`. "Acid Brutalism" — one brutalist element per view.
- **API responses**: Success `{ data: T }`; Error `{ error: { code, message, details? } }`. Common codes: INVALID_TOKEN, VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN, PLATFORM_ERROR.
- **Auth**: Verify Clerk JWT on every API request via backend middleware. Scope all queries to the user's agency.
- **Env**: Backend `apps/api/src/lib/env.ts` (Zod); `apps/api/.env.example` and `apps/web/.env.local` for required vars.
- **Session/decisions**: Start: read last 3–5 entries in `docs/SESSION-LOG.md`. End: append to SESSION-LOG, add DECs to `docs/DECISIONS.md`.

## Non-Negotiable Rules

- [ ] **ALWAYS** read `apps/web/DESIGN_SYSTEM.md` before starting any UI work — components, pages, layouts, styling, or visual changes. No UI implementation without consulting the design system first.
- [ ] **NEVER** store OAuth tokens in PostgreSQL — use Infisical, store only `secretId` in database.
- [ ] **ALWAYS** write failing tests before implementation (TDD). Exceptions: config files, type-only definitions, styling/CSS.
- [ ] **ALWAYS** verify Clerk JWT on every API request via middleware.
- [ ] **NEVER** commit `.env` files or log tokens/secrets.
- [ ] **ALWAYS** log token access in AuditLog (user email, IP, timestamp, action, metadata where applicable).
- [ ] **ALWAYS** use Redis-backed CSRF state for OAuth flows (OAuthStateService).
- [ ] **ALWAYS** scope queries to the user's agency; enforce agency member roles (admin/member/viewer).

For full security rules see [.cursor/rules/security.mdc](.cursor/rules/security.mdc).

## Project Overview

OAuth aggregation platform for marketing agencies. Agencies create access requests; clients authorize multiple platforms (Meta, Google Ads, GA4, LinkedIn) through a single link; agencies get instant token access. Replaces 2–3 days of manual OAuth setup with a 5-minute flow.

## Design Context

### Users

**Primary users**: Marketing agencies (digital advertising, social media marketing, performance marketing) who onboard 3+ clients monthly. They're frustrated with the manual OAuth setup process — it takes 2–3 days of back-and-forth emails, confused clients, and expired tokens.

**Secondary users**: Agency clients (business owners, marketing managers) who receive access requests and need to authorize platform permissions. They're not technical — they just want it to work.

**The job to be done**: Get client platform access (Meta Ads, Google Ads, GA4, LinkedIn) in 5 minutes instead of 3 days. Agencies send one link; clients click and authorize; everyone gets back to work.

### Brand Personality

**Three words**: Bold, Efficient, Trustworthy

**Voice and tone**:
- Direct and confident — we know the OAuth pain and we've solved it
- Professional but not corporate — agencies appreciate personality and expertise
- Action-oriented — focus on "done" rather than "doing"

**Emotional goals** (the feeling when using AuthHub):
- **Relief**: "Finally, this OAuth nightmare is over"
- **Efficiency**: "That was fast — back to real work"
- **Bold/Different**: "This isn't another generic SaaS tool"
- **Calm Control**: "Predictable pricing, clear status, no surprises"

### Aesthetic Direction

**Visual tone**: "Acid Brutalism" — hard shadows (`shadow-brutalist`), bold borders (2px hard borders), kinetic accent colors (coral, teal, acid green). Rejects generic SaaS aesthetics (soft gradients, rounded everything, blue "trust" colors).

**References**: Bento, Hey, Superhuman — personality-driven, distinctive, breaks conventions while remaining usable. These apps have strong points of view and aren't afraid to be different.

**Anti-references**: Generic enterprise SaaS — interchangeable dashboards, "safe" design, committee-driven aesthetics. If it looks like it could be any tool, we've failed.

**Theme**: Light-first with brutalist accents. Dark mode supported but not the primary experience. One brutalist element per view — restraint creates impact.

### Design Principles

1. **Boldness through restraint, not excess**
   One brutalist element per view. When everything is bold, nothing is. Let the hard shadows, bold borders, and accent colors stand out through scarcity.

2. **Relief through clarity**
   OAuth is confusing; AuthHub should be clear. Use accessible status colors, show progress, explain next steps, and eliminate uncertainty.

3. **Efficiency through speed**
   Fast load times, instant feedback, minimal clicks. Respect `prefers-reduced-motion`. The "5-minute flow" promise means every second counts.

4. **Trust through consistency**
   Use the documented design system — predictable patterns build familiarity. Brutalist aesthetics feel chaotic if undisciplined.

5. **Personality through details**
   The brutalist aesthetic is the surface personality. The deeper personality is in micro-interactions: hover feedback, reveal animations, and specific wording in error messages. These make AuthHub feel crafted, not generic.

**When in doubt**: Ask "Could this be mistaken for a generic SaaS tool?" If yes, push harder. We're the bold alternative to Leadsie's conservative approach — make it count.

## Monorepo Structure

- `apps/web/` — Next.js 16 frontend (App Router, TypeScript, TailwindCSS, Clerk auth)
- `apps/api/` — Fastify backend (TypeScript, Prisma, PostgreSQL, BullMQ, Redis)
- `packages/shared/` — Shared TypeScript types and schemas (Zod)

## Tools
- **gws** (Google Workspace CLI): `gws` or `npx gws` — Drive, Gmail, Calendar, Sheets, Docs, Chat, Admin. Auth: `gws auth setup` then `gws auth login`. [github.com/googleworkspace/cli](https://github.com/googleworkspace/cli)

## Essential Commands

### Development
```bash
# From root - starts both frontend (3000) and backend (3001)
npm run dev

# Individual apps
npm run dev:web    # Frontend only
npm run dev:api    # Backend only

# Type-check all packages
npm run typecheck

# Lint all packages
npm run lint

# Build all packages
npm run build
```

### Database (from apps/api/)
```bash
cd apps/api
npm run db:generate    # Generate Prisma client after schema changes
npm run db:push        # Push schema to database (development)
npm run db:studio      # Open Prisma Studio GUI
```

### Testing
```bash
# From root
npm run test

# Individual workspace tests
npm run test --workspace=apps/api
npm run test --workspace=apps/web
```

## Critical Architecture Patterns

### Token Security (MUST FOLLOW)

**NEVER store OAuth tokens directly in PostgreSQL.** All OAuth tokens MUST be stored in Infisical (secrets management):

1. Store tokens in Infisical using the SDK
2. Store only the `secretId` (secret reference) in database:
   - `PlatformAuthorization.secretId` — for client OAuth tokens
   - `AgencyPlatformConnection.secretId` — for agency's own platform connections
3. Retrieve tokens only when needed for API calls
4. Log all token access in `AuditLog` table

**Example:**
```typescript
// ❌ WRONG - Never do this
await prisma.platformAuthorization.create({
  data: { accessToken: token.access_token } // NEVER store tokens directly
});

// ✅ CORRECT - Always use Infisical
import { infisical } from '@/lib/infisical';

const secretName = infisical.generateSecretName('meta', connectionId);
await infisical.storeOAuthTokens(secretName, {
  accessToken: token.access_token,
  refreshToken: token.refresh_token,
  expiresAt: new Date(Date.now() + token.expires_in * 1000),
});

await prisma.platformAuthorization.create({
  data: { secretId: secretName } // Only store the secret name
});
```

**Important:** Infisical configuration requires Machine Identity credentials (`INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`), project details (`INFISICAL_PROJECT_ID`, `INFISICAL_ENVIRONMENT`). See `apps/api/src/lib/infisical.ts`.

### Shared Types Usage

Types in `packages/shared/src/types.ts` are available to both frontend and backend. Import via `@agency-platform/shared`. When adding new shared types: add to `types.ts`, export from `index.ts`, use Zod for runtime validation.

### API Response & Error Handling

Success: `{ data: T }`. Error: `{ error: { code: string; message: string; details?: any } }`. Backend: return `{ data }` on success; on validation error return 400 with error shape; otherwise throw. Frontend: check `'error' in json` and throw with `json.error.message`; otherwise use `json.data`. Common codes: INVALID_TOKEN, VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN, PLATFORM_ERROR.

### Database Model Relationships

**Client Authorization Flow:** Agency → AgencyMember, Client, AccessRequestTemplate, AccessRequest (uniqueToken, platforms[]) → ClientConnection → PlatformAuthorization[]; AuditLog append-only.

**Agency Platform Connections:** Agency → AgencyPlatformConnection[] (each has secretId; used for agency-side OAuth identities and manual invite instructions).

**Key unique constraints:** AccessRequest.uniqueToken; PlatformAuthorization (connectionId + platform); AgencyPlatformConnection (agencyId + platform); AgencyMember (agencyId + email); Client (agencyId + email); AccessRequestTemplate (agencyId + name).

### Environment Configuration

Backend: Zod in `apps/api/src/lib/env.ts`. When adding env vars: add to envSchema, update `apps/api/.env.example`.

### Platform Connectors

OAuth connectors live in `apps/api/src/services/connectors/`. Configuration-driven registry + base connector:

1. **`registry.config.ts`** — OAuth endpoints, scopes, flags (e.g. requiresLongLivedExchange, supportsRefreshTokens)
2. **`base.connector.ts`** — Common OAuth flows; override for platform quirks
3. **`[platform].ts`** — When needed (e.g. Beehiiv API key, Kit JSON token exchange)
4. **`factory.ts`** — Instantiation and caching

**Adding a new platform:** (1) Add to shared types (PlatformSchema, PLATFORM_NAMES, PLATFORM_SCOPES), (2) Add config in registry.config.ts, (3) Add env vars in env.ts and .env.example, (4) Create connector only if non-standard OAuth, (5) Register in factory, (6) Test full flow and Infisical storage.

**Platform hierarchy:** Group-level (google, meta, linkedin) = one OAuth for multiple products; product-level (google_ads, ga4, meta_ads, etc.) = per-product. Meta: use getLongLivedToken for 60-day tokens. Google Ads: developer-token header. Kit: JSON body for token exchange. Beehiiv/Zapier: manual invitation flows, not standard OAuth. Store metadata in PlatformAuthorization.metadata. OAuth state via OAuthStateService (Redis). Template: `TEMPLATE.ts`.

### Client Authorization Pattern

Two steps: (1) OAuth redirect and scope authorization, (2) Asset selection — backend fetches assets (e.g. GET /api/client-assets/:connectionId/:platform), client selects; stored in ClientConnection.grantedAssets and PlatformAuthorization.metadata.selectedAssets.

### Authorization Routing

Authorization flow is determined per platform. OAuth-capable platforms use client OAuth. Manual-invite platforms use platform-native instructions and verification. There is no separate request-level authorization model.

### Access Levels

admin, standard, read_only, email_only. Use ACCESS_LEVEL_DESCRIPTIONS from shared for UI. Access levels map to platform OAuth scopes (see PLATFORM_SCOPES in shared types).

### Templates & Custom Branding

AccessRequestTemplate: platforms (hierarchical), intakeFields, branding (logoUrl, primaryColor, subdomain). Client model: reusable profile (name, company, email, language en/es/nl); unique per agency+email.

## Development Workflow

**New feature:** DB changes → edit schema, `db:push`, `db:generate`. Shared types → add in types.ts, export from index.ts. Then `npm run dev` from root.

**New platform connector:** See Platform Connectors above (shared types → registry → env → connector if needed → factory → test).

**Background jobs:** BullMQ + Redis. Key files: `lib/redis.ts`, `lib/queue.ts`, `jobs/token-refresh.ts`, `services/oauth-state.service.ts`. Define queue, add worker in jobs/, schedule from service.

## Frontend Development & Design System

**Conventions:** See [.cursor/rules/ui-ux.mdc](.cursor/rules/ui-ux.mdc) and [.cursor/rules/react-nextjs.mdc](.cursor/rules/react-nextjs.mdc) for TypeScript, Tailwind, shadcn, and React/Next.js patterns.

**Project-specific:** Design system in `apps/web/DESIGN_SYSTEM.md`; token showcase at `/design-system`. "Acid Brutalism": one brutalist element per view. Component library at `apps/web/src/components/ui/`.

## Test-Driven Development (TDD)

**Rule:** Write a failing test first, then minimum code to pass, then refactor. No implementation without a failing test (except config, type-only defs, styling).

**Where:** `__tests__/` next to source (backend, frontend, shared). Vitest + Testing Library.

**Coverage:** Backend 80% min (90% for OAuth/token paths); Frontend 70% components, 90% utils/hooks; Shared 95%+.

**Commands:** `npm run test`, `npm test -- --watch`, `npm test -- --coverage`. Full tutorial and examples: [docs/tdd-guide.md](docs/tdd-guide.md).

**UI testing:** Use the dev-browser skill for browser automation, visual regression, and E2E flows.

## Key Dependencies

**Backend:** Fastify, Prisma, BullMQ, IORedis, @clerk/backend, @infisical/sdk, Zod, Pino.

**Frontend:** Next.js 16, @clerk/nextjs, TanStack Query, TailwindCSS, shadcn/ui.

## Port Configuration

Frontend 3000, Backend 3001, Prisma Studio 5555. Kill: `lsof -ti:3000 | xargs kill -9`, same for 3001.

## Deployment

**Vercel (web):** Deploy from apps/web. Checklist: all imported modules committed; design-system pages use real prop names (StatusBadge status/badgeVariant, HealthBadge health, PlatformIcon size token); shared types use real properties; test files excluded in tsconfig; useSearchParams wrapped in Suspense for static prerender.

**Render (api):** Deploys via the `render.yaml` Blueprint at the repo root (`autoDeploy: true` — pushes to main trigger a build automatically, no manual `up` command). Env vars are set per service in the Render dashboard. PostgreSQL (Neon) and secrets (Infisical) are external. See `docs/RENDER_DEPLOYMENT.md` for the full setup and env-var list.

**Self-healing deploy pipeline:** This repo auto-detects and repairs build-time deploy failures on both apps/web (Vercel) and apps/api (Render). See `docs/deploy-repair-runbook.md` for setup, manual replay, drills, and recovery when the loop gives up.

## Security Requirements

1. Token storage: Infisical only; never in DB.
2. Audit logging: every token access with user email, IP, timestamp, action (token_viewed, access_granted, access_revoked, AGENCY_*); metadata, ipAddress, userAgent where applicable.
3. Auth: Clerk JWT on every API request.
4. Roles: admin (full), member (create/manage requests, view connections), viewer (read-only).
5. OAuth: Redis-backed CSRF state.
6. Rotate Infisical Machine Identity quarterly.
7. Access requests expire after 7 days by default.

Full checklist: [.cursor/rules/security.mdc](.cursor/rules/security.mdc).

## Environment Variables

Backend: `apps/api/.env` — see `apps/api/.env.example`. Core (NODE_ENV, PORT, DATABASE_URL, FRONTEND_URL, API_URL), Clerk keys, Infisical (client id/secret, project id, environment), REDIS_URL, LOG_LEVEL. Frontend: `apps/web/.env.local` — Clerk keys, NEXT_PUBLIC_API_URL. New platform: add to env.ts and .env.example (e.g. META_APP_ID, META_APP_SECRET).

## Workflow Orchestration

1. **Plan Node Default:** Enter plan mode for non-trivial tasks (3+ steps or architecture). If things go wrong, stop and re-plan. Use plan mode for verification too.
2. **Subagent Strategy:** Use subagents to keep context clean; offload research and parallel work; one focused task per subagent.
3. **Self-Improvement Loop:** After user corrections, update `tasks/lessons.md` and add rules to prevent repeat mistakes; review at session start.
4. **Verification Before Done:** Prove it works before marking complete; run tests, check logs; "Would a staff engineer approve?"
5. **Demand Elegance (balanced):** For non-trivial changes ask "is there a more elegant way?"; avoid hacky fixes; skip for obvious fixes.
6. **Autonomous Bug Fixing:** Given a bug, fix it using logs/errors/tests; fix failing CI without being asked.

## Learning & Self-Maintenance

Actively manage institutional knowledge. This is as important as the current task.

**Track two types of knowledge:**
- **Domain: what things are** — product context, user preferences, APIs, naming conventions
- **Procedural: how to do things** — deploy steps, test commands, review flows

**Organize as a hierarchy of .md files:**
- `docs/START-HERE.md` and `docs/` subdirs (solutions/, sprints/, features/) route to categories
- Categories hold the details
- Progressive disclosure: read top-down, only load what is needed

**Log errors to `docs/ERRORS.md`:**
- **Deterministic errors** (bad schema, wrong type) — conclude immediately
- **Infrastructure errors** (timeout, rate limit) — log, no conclusion until pattern emerges
- **Conclusions** graduate into the relevant domain or procedural file

**Self-maintenance actions:**
- Review knowledge files at the start of each session
- Merge overlapping categories
- Split files that grow too long
- Remove knowledge that is no longer accurate
- Create new categories when patterns emerge
- When something should be here but is not — propose the edit

## Session Protocol

**Start of session:** Read the last 3–5 entries in `docs/SESSION-LOG.md` to get current status and next steps.

**End of session (when wrapping up):** Append a new entry to `docs/SESSION-LOG.md` (newest first) with: what was done, files changed, decisions made, next steps. Add any significant technical decisions to `docs/DECISIONS.md` using the DEC-XXX format there.

## Task Management

1. Plan First — write plan to `tasks/todo.md` with checkable items.
2. Verify Plan — check in before implementation.
3. Track Progress — mark items complete as you go.
4. Explain Changes — high-level summary each step.
5. Document Results — add review section to `tasks/todo.md`.
6. Capture Lessons — update `tasks/lessons.md` after corrections.
7. Significant technical choices — record in `docs/DECISIONS.md` (DEC-XXX); session wrap-up — append to `docs/SESSION-LOG.md`.

## Core Principles

- **Simplicity First:** Minimal change, minimal code impact.
- **No Laziness:** Root causes only; no temporary fixes; senior standards.
- **Minimal Impact:** Touch only what’s necessary; avoid new bugs.

## Current State & Known Issues

- **Authorization flow:** Determined from platform capabilities. OAuth platforms run through client authorization; manual platforms use invite/instruction flows.
- **Subdomain / white-label:** Planned but not implemented (e.g. `{subdomain}.accessplatform.com`).
- **Zapier and Beehiiv:** Use manual invitation flows, not standard OAuth. Intentional.

These are known limitations, not issues to "fix" unless explicitly in scope.
