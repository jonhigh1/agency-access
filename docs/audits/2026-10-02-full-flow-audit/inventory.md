# Full-flow coverage inventory

Date: 2026-10-02. Scope: implemented user-facing web routes and API route groups. This document defines coverage targets. It records no successful runtime result.

## Coverage rules

`coverage.json` contains one row per material flow. Each row names user role, prerequisites, steps, expected result, evidence, status, and required environment. All rows start `untested`; all `observed_result` values are `null`; all evidence lists are empty. Update those fields only after observing the named behavior and recording reproducible evidence.

Production browser access is read-only for this audit. Production mutations, sends, revokes, checkout, invitation completion, and account creation remain excluded until separately approved. Local fixtures and provider sandboxes are verification targets for those flows. Local results do not establish production behavior.

## Route inventory

### Public and authentication

- Marketing: `/`, `/pricing`, `/features/white-label`, `/guides/google-ads-access`, `/guides/meta-ads-access`, `/blog`, `/blog/[slug]`, `/compare/[slug]`, `/about`, `/contact`, `/affiliate`, `/terms`, and `/privacy-policy`.
- Authentication: `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]`.
- Onboarding: `/onboarding/unified`, `/onboarding/agency`, and `/onboarding/platforms`.

### Agency workspace

- Dashboard: `/dashboard`.
- Clients: `/clients` and `/clients/[id]`, including create, edit, detail, and offboarding flows.
- Access requests: `/access-requests/new`, `/access-requests/[id]`, `/access-requests/[id]/edit`, and `/access-requests/[id]/success`; includes template use, sharing, reminders, and cancellation.
- Agency connections: `/connections`, plus OAuth, manual connection, asset, and revoke API flows.
- Token status: `/token-health`.
- Settings: `/settings` General, Billing, Webhooks, and Agents tabs.
- Agent work: `/agent-operations/[id]` and API/MCP operation endpoints.

### Client invitation and authorization

- Invitation intake: `/invite/[token]`.
- OAuth return aliases: `/invite/oauth-callback` and `/platforms/callback`.
- Manual platform flows: `/invite/[token]/beehiiv/manual`, `/kit/manual`, `/mailchimp/manual`, `/klaviyo/manual`, `/pinterest/manual`, and `/shopify/manual`.
- Authorization and client access: `/authorize/[token]` and `/client/[token]`.
- API groups cover invitation intake, OAuth state and exchange, asset listing/selection, manual completion, and invitation completion.

### Partner and internal administration

- Partner portal: `/partners`.
- Internal administration: `/internal/admin`, `/internal/admin/agencies`, `/internal/admin/subscriptions`, `/internal/admin/webhooks`, and `/internal/admin/affiliates`.
- Affiliate API covers applications, referrals, partner records, and payout workflows.

### API source groups

API route coverage references implemented handlers under `apps/api/src/routes/`: `access-requests.ts`, `templates.ts`, `clients.ts`, `client-offboarding.routes.ts`, `client-auth/`, `agency-platforms/`, `agencies.ts`, `dashboard.ts`, `token-health.ts`, `subscriptions.ts`, `quota.routes.ts`, `webhooks.ts`, `agent-grants.ts`, `agent-operations.ts`, `mcp.ts`, `affiliate.ts`, and `internal-admin.routes.ts`. Service and provider behavior requires local fixture or sandbox evidence where production action is disallowed.

### Production-hidden harnesses

`/dev/*`, `/test/*`, `/perf/*`, and `/design-system` are excluded from production user-flow coverage. They remain local verification targets. The audit must confirm environment visibility before treating any harness as reachable.

## Flow-level matrix

See [`coverage.json`](./coverage.json) for scenario rows. It includes happy, invalid/error, cancellation, and persistence scenarios where each changes expected behavior. A route's existence or a source test does not prove an end-to-end flow. Browser/runtime evidence must be attached to each verified row.

## Provider, permission, and recovery expansion

The expanded `coverage.json` gives separate invitation OAuth scenarios for each provider or product: Google, Google Ads, GA4, Meta, Meta Ads, Meta Pages, Instagram, TikTok, TikTok Ads, LinkedIn, LinkedIn Ads, LinkedIn Pages, Snapchat, Snapchat Ads, Mailchimp, Pinterest, Klaviyo, Shopify, Kit, and Zapier. These rows are source targets; supported OAuth setup and availability still require provider configuration evidence. The shared `PlatformSchema` also includes `beehiiv`, which uses a manual invitation path rather than OAuth.

Manual invitation scenarios have distinct success and error/recovery rows for Kit, Beehiiv, Mailchimp, Klaviyo, Pinterest, and Shopify. The Shopify row must cover shop-domain and collaborator-code validation. The Pinterest row must cover missing business ID gating. Email invitation rows must verify configured invite email, confirmation, and retry behavior.

The inventory also separates affiliate application validation and duplicate handling, referral attribution, partner overview/commission/link access, admin partner review, fraud review, commission/payout operations, and subscription actions. Role tests cover agency tenant isolation, owner controls, approved affiliate access, and internal-admin restrictions. Responsive verification covers public, invite, dashboard, client, access-request, and settings surfaces. Refresh, back navigation, repeated submission, cancellation, and completed-state recovery each require local fixture evidence.

## Pre-push observation

See [`pre-push-observation.md`](./pre-push-observation.md) for read-only findings about the existing dirty hook and its four focused test failures. The finding records current observed behavior and does not change or endorse the local hook.

## Additional implemented routes and UI gaps

- Client deletion uses the detail dialog and `DELETE /clients/:id`; cancellation and confirmed deletion with Meta access cleanup need separate checks.
- Templates include save/create, update, delete, and default routes. The application exposes a save-as-template dialog and helper calls. Coverage separates create from update/delete/default so one path does not imply the others passed.
- Team invites occur in onboarding. Agency APIs also expose member listing, bulk invites, role changes, and removal. The four settings tabs contain no Team tab in the inspected UI; team role and removal coverage targets the API surface. Do not imply a settings team-management interface exists.
- Token health APIs expose connection revocation and platform-authorization revocation in addition to refresh. Coverage treats revoke cancel, confirm, repeated revoke, and tenant denial as separate concerns.
- Kit and Zapier are manual connection capabilities in `factory.ts`, not OAuth integrations. Kit has a client manual page and handler. Zapier appears in the manual-platform capability list, but the inspected client invitation routes and manual configuration have no Zapier page/config/handler. Its invitation flow remains untested pending confirmation that client-side Zapier invitations are in product scope. The source gap alone does not establish a defect.

## Evidence status

`status` uses only `untested`, `passed`, `failed`, `blocked`, `fixed locally`, or `verified in browser`. `observation_status` preserves qualifiers such as `partially_observed`, `partially_verified`, `prerequisite_blocked`, or a source question. Partial evidence does not prove persistence, complete interaction behavior, or production API correctness. A blocked row names the missing prerequisite. Untested rows have no result claim.

The browser evidence covers dashboard, connections, token health filters, clients, client detail, settings panels, and request-builder review. It records no save or request submission. The API report covers local mocked tests and explicitly excludes provider exchanges, provider grants, token refresh, database persistence, and production deployment verification. See `browser-observations.json` and `api-validation.md` for boundaries.
