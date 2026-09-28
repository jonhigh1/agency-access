---
title: "Production Dependency Audit - 2026-06-23"
date: 2026-06-23
module: Production dependency security
problem_type: security_issue
component: infrastructure
severity: high
status: stale
stale_date: 2026-09-27
stale_reason: "Point-in-time snapshot overtaken by events. A 2026-09-27 rerun of the same command found 22 vulnerabilities (9 moderate, 12 high, 1 critical: next middleware bypass GHSA-6gpp-xcg3-4w24), against the 0 recorded here. The doc's durable content (gray-matter removal rationale, docs-tooling debt classification) remains accurate; the results below are historical."
---

# Production Dependency Audit - 2026-06-23

> **Stale snapshot (2026-09-27).** The "found 0 vulnerabilities" result below no longer holds: a rerun of the same command on 2026-09-27 found **22 vulnerabilities (9 moderate, 12 high, 1 critical — `next` middleware bypass GHSA-6gpp-xcg3-4w24)**. Remediated on 2026-09-28 by in-range dependency updates (`next` 16.3.6, `fastify` 5.12.5, and transitives) — the remaining finding is the accepted `prisma` CLI chain (`deepmerge-ts` stack exhaustion, repo-authored config input only). Do not read the numbers below as the current audit state. The standing audit step lives in `docs/PRODUCTION_CHECKLIST.md`; run it fresh before any release.

## Shipping Runtime Workspaces

Command:

```bash
npm audit --omit=dev --audit-level=moderate --workspace=apps/api --workspace=apps/web
```

Result:

```text
found 0 vulnerabilities
```

The production API and web app dependency trees were remediated by upgrading the direct runtime dependencies that pulled the vulnerable chains:

- Clerk Next.js/backend packages
- Next.js
- Fastify and Fastify JWT
- Infisical SDK
- Sentry packages
- OpenTelemetry packages
- PostHog
- Resend/Svix
- PostCSS and Picomatch transitive placement

The web blog loader no longer uses `gray-matter`; checked-in Markdown frontmatter is parsed with `yaml` to remove the vulnerable `gray-matter -> js-yaml@3` runtime path from `apps/web`.

## Monorepo Tooling Advisory

Command:

```bash
npm audit --omit=dev --audit-level=moderate --workspaces
```

Remaining advisories are isolated to `apps/docs` / Docusaurus build tooling:

- `@docusaurus/* -> gray-matter -> js-yaml`
- `@docusaurus/bundler -> copy-webpack-plugin/css-minimizer-webpack-plugin -> serialize-javascript`
- `webpack-dev-server -> sockjs -> uuid`

These packages are not in the shipping `apps/api` or `apps/web` production runtime audit. Treat them as docs-tooling debt, not customer-facing launch blockers, unless the Docusaurus docs app is deployed as part of the production surface.
