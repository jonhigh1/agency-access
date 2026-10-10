# AuthHub analytics audit and rollout

Inspected 2026-10-10 at `main` commit `18df05ce`. Source: `jonhigh1/agency-access`. These are local changes awaiting review, not a production deployment or live PostHog validation.

## Existing implementation

- Web: `apps/web/instrumentation-client.ts` initializes PostHog once through `/ingest`, with Next.js reverse-proxy rewrites.
- Events: onboarding, invite opens/sharing/reminders, authorization/asset steps, OAuth success/failure, pricing/checkout, and feature usage already exist. The invite funnel has `access_request_id`, `agency_id`, `is_preview` and `is_internal` context.
- API: `apps/api/src/lib/posthog.ts` captures billing lifecycle events from Creem webhooks.
- Docs: `apps/docs/src/theme/Root.tsx` captures docs views, CTA clicks and search length.
- Recorded project: https://us.posthog.com/project/309879, from setup reports and the plan-filter maintenance script. Recorded dashboards are historical, not verified current.
- No PostHog credentials are configured in this execution environment. GitHub CLI access is authenticated and the repository has been cloned successfully.

## Local changes

1. Signed-in web users are identified by Clerk user ID, with reset before an account change or logout. Recipient invite routes use anonymous identity rather than the signed-in agency identity. The SDK loaded callback applies auth state even if auth resolves before deferred initialization. This is person identification; agency grouping still needs a separate design/capability check.
2. PostHog pageviews explicitly cover browser history changes. Blanket autocapture, PostHog replay and automatic exception capture are disabled locally in favor of explicit events and existing error monitoring. This changes the data available to replay-based tools after deployment.
3. Browser custom captures, final SDK event metadata and server captures share a recursive property scrubber. It strips known secret/PII keys and URL query/fragment data, preserves request/agency join IDs, and redacts invite paths. The SDK's root ingestion token is preserved only at its final event boundary. This is defense in depth, not proof that arbitrary future fields or strings are safe; event-specific allowlists and actual network inspection remain required.
4. The shared backend request creation service emits `access_request_created`, including requests created outside the browser. The browser now emits `access_request_creation_confirmed` for its UI-specific configuration details. Do not combine the two as independent requests.
5. Persisted request milestones emit `access_request_partial`, `access_request_completed`, `access_request_expired`, and `access_request_revoked` independently of agency webhook subscriptions. Creation and milestone events have stable UUIDs and analytics-only IDs; completion includes creation-to-authorized `duration_ms`. Query unique request IDs and verify ingestion deduplication before relying on raw event counts.
6. Analytics capture remains best effort and does not wait on the remote collector in the request workflow. No durable analytics outbox or reconciliation job is added. SDK startup buffering and shutdown/failure delivery need integration verification.

## Map proposed metrics to current events

Use `measurement-plan.md` for the target journeys, counting units, windows, denominators, and acceptance checks. Reuse existing events when their triggers match; do not install a second initializer or duplicate event stream.

| Metric | Current event/data source | Caveat |
| --- | --- | --- |
| First generated request | Backend `access_request_created`; existing `first_access_link_generated` for onboarding UX timing | Count unique request IDs and agencies; onboarding UI event uses `accessRequestId` |
| Recipient open-to-ready | `invite_opened` → backend `access_request_completed`, joined by `access_request_id` | Exclude `is_preview=true`, internal/demo recipients; use request-level queries, not same-person funnels |
| Verified weekly value | Distinct agency/client pairs on backend `access_request_completed` | Exclude missing client IDs from client-pair metric and report separately; verify persisted completion semantics and granted/waived requirements |
| Request expiry/partial/revocation | Backend request milestone events | Report outcomes within mature created cohorts; incomplete requests need database reconciliation |
| OAuth friction | `oauth_callback_success`, `oauth_callback_failure`, `client_oauth_exchange_success`, `client_oauth_exchange_failure` | Shared and client-specific events can describe the same callback; choose one series rather than summing both |
| Meta asset friction | `invite_assets_loaded`, `invite_cta_blocked`, `invite_selection_saved`, `invite_verify_result`, `client_grant_*` | Selection and OAuth success are intermediate steps, not usable-access completion |
| Pricing/checkout | `pricing_viewed`, `plan_selected`, `billing_checkout_started` | Inspect trigger coverage across all marketing CTAs and actual consent controls |
| Trial/paid conversion | Server billing lifecycle events plus actual paid invoices | `subscription_started` can be a trial checkout and is also emitted by the billing UI; it is not a first-payment metric |
| Retention | Backend completions grouped by `agency_id`, or successful user/agent work once instrumented | Existing dashboard pageviews and background refresh do not establish retained value |

Request-level dashboard queries must join distinct request IDs across different actors. For historical events without a reliable request ID, report coverage rather than reconstructing joins from invite tokens, client emails, or guessed identities. Production events currently may have no environment property: the existing helper omits it for production. Until an explicit production-label rollout, filter both missing and production as appropriate and exclude staging/preview; do not use an equality-only production filter that discards history.

## Configuration and verification remaining

- Confirm project 309879 ownership, region, SDK ingestion key and actual deployed settings. `NEXT_PUBLIC_POSTHOG_KEY` (web) and `POSTHOG_API_KEY` (API) must be project ingestion keys for the same intended environment. A personal API key is for management only and must never enter browser code.
- Supply least-privilege PostHog management access through environment secrets to inspect actual event definitions, current insights and project settings. No credential values belong in this file, logs or chat.
- Inspect docs analytics separately: it still has its own SDK initialization and sends `location.search`. The local shared sanitizer changes apply to web/API, not docs. Audit it before extending end-to-end coverage there.
- Add or confirm consent/opt-out behavior in the actual application; the existing persistent initialization does not demonstrate consent gating. Preserve essential auth independently of analytics choices.
- Audit ingestion proxy accessibility to anonymous visitors, public aliases/white-label domains, SDK startup and consent behavior, all outgoing metadata, person changes and actual SPA pageviews in a deployed test environment.
- Verify new request analytics against real database state, revoked/expired/partial paths, concurrent transitions and retries. Stable UUIDs alone are not evidence of guaranteed exactly-once delivery.
- Backend milestone exclusion currently checks agency IDs. To exclude internal users by owner/member allowlists consistently, reconcile the service's verdict with existing API funnel verdicts; configure internal agency IDs for these events meanwhile.
- Build request-level activation/onboarding dashboards, provider friction, agency retention/revenue and automation adoption using the target plan. Verify each query against known fixtures and record live links. No live dashboards have been created or modified here.
- Instrument/reconcile connection refresh and recovery, webhook logical delivery, agent operations, signup completion and confirmed payments from their authoritative services. These remain target-plan work, not implemented outcomes in this patch.
- Billing events still use list-price estimates and may have multiple source triggers. Reconcile revenue/MRR to the billing provider; do not treat current `mrr_cents` as verified realized revenue.

## Review and release gate

Review the code diff, tests and event mapping before publishing. Repository `AGENTS.md` requires approval before commit/push/PR and deployment/production changes. This task authorizes local analytics changes; it does not supply those release approvals. Do not change live project settings or deploy from this audit without the applicable authorization.

After an approved rollout, record sanitized staging payload evidence, actual PostHog settings and dashboard links, production ingestion checks, reconciliation counts, consent/ad-blocking coverage, and any delivery gaps. Until then, describe this as a local instrumentation improvement with a proposed measurement plan.
