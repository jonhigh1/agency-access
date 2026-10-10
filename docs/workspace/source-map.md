# Source Map

## Authority order

When sources disagree, use this order:

1. Current user instruction and explicit approval.
2. Verified live state: public app, Render services/logs, production database, Clerk, Infisical, Redis, monitoring, analytics, and external platform consoles.
3. Current code, database schema, configuration, tests, and committed history.
4. `docs/workspace/status.md` for the latest inspected synthesis.
5. Confirmed product strategy and current decisions.
6. An explicitly activated implementation plan or specification.
7. README files, runbooks, checklists, and session logs.
8. Research, brainstorms, archived plans, and historical setup notes.

File dates and confident prose do not make a document authoritative. If a high-impact conflict remains, stop and ask the user.

## Where to look

| Question | Best source | Notes |
|---|---|---|
| Current priorities and gaps | `docs/workspace/status.md` | Confirm inferred priorities with the user. |
| Product direction | `product/PRODUCT-ROADMAP-2026.md`, `docs/PRD.md`, `docs/build-kit.md` | Strategy context; check freshness and reconcile conflicts. |
| Current application behavior | `apps/web/src`, `apps/api/src`, `packages/shared/src` | Verify with tests or a live flow. |
| Database truth | `apps/api/prisma/schema.prisma`, migrations, verified live database | Prisma models use mapped table names. |
| API topology and contracts | `apps/api/src/index.ts`, route files, shared schemas, focused tests | Current backend registration beats old frontend URL strings. |
| Platform/OAuth behavior | connector services, `apps/api/src/services/connectors/registry.config.ts`, shared platform types | External provider behavior should be checked against official docs when material. |
| Runtime environment | `apps/api/src/lib/env.ts`, frontend env helpers, `.env.example` files | Never expose secret values. Live host settings outrank examples. |
| Deployment | `render.yaml`, `docs/PRODUCTION_CHECKLIST.md`, recent commits, verified Render state | Older Vercel docs may be historical. |
| Security decisions | code/tests, `docs/DECISIONS.md`, security plans and solution notes | `docs/DECISIONS.md` is sparse and not a complete ledger. |
| Active engineering plan | latest confirmed file in `docs/plans/` (`docs/plans/` is canonical; `docs/implementation-plans/` is archive) | A dated plan is not active merely because it exists. |
| Product/content evidence | analytics, database, customer/support systems, then marketing/research docs | Verify claims before external use. |

## Conflict rules

- Live production behavior beats local assumptions, but investigate drift from committed code.
- Current schema/config/code beats old setup and deployment instructions.
- Current user decisions beat roadmap language.
- Plans describe intended change; tests and running behavior establish implementation truth.
- Research may inform a decision but cannot establish current internal status.
