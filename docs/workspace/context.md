# Context

## Workspace purpose

This repository is the product, engineering, operations, and research workspace for AuthHub (repository name: Agency Access Platform). AuthHub helps marketing agencies request and maintain client access to advertising, analytics, commerce, and marketing platforms through a guided link rather than manual back-and-forth.

The working product direction is broader than OAuth aggregation alone: combine account-access requests, client intake, status/diagnostics, and agency-facing workflow tools into one onboarding experience. That direction appears in `product/PRODUCT-ROADMAP-2026.md`, but its dates and targets require confirmation before use as a current commitment.

## User role

The user is the workspace owner, product decision-maker, and final approval authority for scope, priority, publication, and production-impacting actions. The repository does not clearly state the user's formal company title, team structure, or which work is delegated to other people; do not invent those details.

## Product and audience

- Primary customer: digital marketing agency owners and operators managing access across multiple client platforms.
- Core job: create a request, send one client-facing link, collect authorization or manual access details, and see truthful completion/status information.
- Current stack: Next.js web app, Fastify API, shared TypeScript package, Prisma/PostgreSQL, Clerk, Infisical, PostgreSQL-backed pg-boss jobs, process-local caching, and Render configuration.
- Public product name: AuthHub / authhub.co. The older repository name remains common in code and docs.

## Non-negotiable constraints

- Never store OAuth tokens in PostgreSQL; store Infisical secret references only.
- Audit token access with actor, IP, timestamp, action, and relevant metadata.
- Protect OAuth state against CSRF with the PostgreSQL-backed state service, HMAC signatures, and single-use consumption.
- Preserve tenant ownership checks and the established API success/error contracts.
- Treat live behavior and current code as stronger evidence than an old plan or narrative document.
