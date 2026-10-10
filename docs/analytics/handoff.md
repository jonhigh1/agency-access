# AuthHub PostHog handoff

Publication update: the user subsequently authorized committing and pushing `feat/posthog-critical-journeys` to GitHub. The snapshot below records the state before publication; verify the current branch and commit on GitHub when resuming. No deployment or live PostHog configuration changes were authorized or performed.

Prepared 2026-10-10. Goal: define the critical website/app journeys and metrics, then make PostHog accurately measure them.

## Pre-publication snapshot

- Repository: https://github.com/jonhigh1/agency-access — the AuthHub codebase despite its older name.
- Checkout: `/workspace/agency-access`.
- Local branch: `feat/posthog-critical-journeys`, based on `main` commit `18df05ce`.
- All changes from this session are **uncommitted, unpushed and undeployed**. No PR was opened and no production settings or dashboards were changed.
- Existing reports reference PostHog US project https://us.posthog.com/project/309879. Its current ownership, settings and ingestion have not been verified.
- GitHub CLI was authenticated and used to clone the repository. The user installed PostHog; plugin discovery confirmed it installed and enabled, but repeated checks exposed no callable PostHog tools in this conversation. No PostHog environment credentials were present when checked. A new session should discover available tools again; installation alone does not establish access to project 309879.
- Preserve this dirty worktree. If the next chat has a different environment, these changes will not be in a fresh GitHub clone. Use the accompanying patch and documents, or return to this workspace.

## Measurement work completed

`docs/analytics/measurement-plan.md` defines proposed journeys, metric denominators/windows, event ownership, identity/correlation, dashboards and acceptance checks. `docs/analytics/posthog-rollout.md` maps the proposal to existing events and records implemented versus remaining scope.

Recommended primary outcome: real client requests reaching verified usable access, rather than link generation or OAuth callback success. Proposed north star: weekly distinct agency/client pairs reaching request completion. Report active agencies and healthy connection stock alongside it.

Prioritized journeys:
1. Website acquisition → signup → workspace setup.
2. Agency request creation → client handoff → verified completion.
3. Provider authorization and asset-grant friction, partial completion and recovery.
4. Continued access health, token refresh and recovery.
5. Trial conversion, paid conversion and agency retention.
6. Webhook, API/CLI/agent and collaboration adoption.

These are proposed analysis definitions, not verified business baselines or agreed performance targets. Initial cohort windows should be revised after observing real volume.

## What existed before this session

The repository already contained a PostHog integration. Do not initialize a second instance.

- Web initializer in `apps/web/instrumentation-client.ts`; `/ingest` proxy rewrites in `apps/web/next.config.ts`.
- Custom onboarding, pricing/checkout, invite/sharing/reminder, OAuth, asset-selection and dashboard events.
- Invite funnel context with `access_request_id`, `agency_id`, `is_preview` and `is_internal`.
- Server Creem billing lifecycle capture through `apps/api/src/lib/posthog.ts`.
- Separate docs analytics in `apps/docs/src/theme/Root.tsx`.
- Historical setup and self-driving reports. Their dashboards/settings are evidence of past setup, not current verified state.

## Local implementation built

| Change | Files | Result |
| --- | --- | --- |
| User identity | `apps/web/src/lib/analytics/posthog-identity.ts`, `apps/web/src/components/analytics/posthog-identity.tsx`, `apps/web/src/app/root-providers.tsx`, initializer | Identifies signed-in users by Clerk ID; resets on logout/account change. Persists app/recipient scope to prevent recipient activity merging into agency identity when returning from an invite, including across page loads. Applies auth resolved before deferred SDK initialization. |
| Stale agency context | `apps/web/src/hooks/use-user-agency.ts` | Clears agency analytics context when no agency data exists. |
| Pageviews and collection scope | `apps/web/instrumentation-client.ts` | Uses `capture_pageview: 'history_change'`. Explicitly disables PostHog autocapture, replay and automatic exception capture. Uses current `before_send` hook rather than deprecated `sanitize_properties`. |
| Shared scrubber | `packages/shared/src/analytics-properties.ts`, shared exports, browser capture helper, initializer, API capture helper | Recursively strips known secret/PII keys, URL query strings/fragments and invite path tokens. Preserves join IDs. Keeps the SDK ingestion token only in the final SDK boundary. Omits cycles/deep branches. |
| Backend request creation | `apps/api/src/services/access-request.service.ts` | Emits `access_request_created` from the shared persisted creation service, including nonbrowser callers. Adds source, agency/request/client IDs, counts, platform categories and internal verdict. |
| Browser creation confirmation | `apps/web/src/contexts/access-request-context.tsx` | Renames its event to `access_request_creation_confirmed`, preserving UI details without duplicating the backend creation event. Update dashboards accordingly. |
| Backend request milestones | request service and `apps/api/src/lib/posthog.ts` | Emits `access_request_partial`, `access_request_completed`, `access_request_expired`, `access_request_revoked` from persisted lifecycle snapshots, independent of agency webhook subscriptions. Adds stable UUIDs, source, agency/request/client IDs and completion `duration_ms`. |
| Safe failure classification | `apps/web/src/app/invite/[token]/client-invite-page.tsx` | Uses `error_code` for the completion failure category; generic `code` is scrubbed as potentially secret. |

Backend domain events use `distinct_id = agency:<agencyId>` and `actor_type=system`. Human events use Clerk/anonymous identities. Join cross-actor funnels on `access_request_id` and retention on `agency_id`; a same-person funnel will not represent agency-created/client-completed requests correctly. Agency PostHog grouping is not implemented.

## Verification completed

- Dependencies installed with `npm ci --ignore-scripts --no-audit --no-fund`.
- Shared TypeScript build passed; Prisma client generated locally without applying migrations.
- Web analytics, request-context and recipient-page batch: 194 tests passed. Subsequently the identity suite expanded from four to five tests; its five tests passed, including a regression that first failed for recipient-to-agency identity merging.
- API request service, environment capture and billing analytics batch: 117 tests passed, including failing-first tests for backend creation/completion tracking.
- Web and API typechecks passed. Web typecheck passed again after the final identity change.
- Targeted web ESLint passed before the final identity-scope adjustment. Rerun it for the final patch before release.
- `git diff --check` passed.

API tests emitted existing mock/notification warning messages but exited successfully. No production build, real-browser network inspection, live OAuth walkthrough, PostHog ingestion test, dashboard query verification, production reconciliation or full monorepo suite was run. Unit checks do not establish production correctness.

## Next steps, in order

1. **Recover and inspect the work.** Read root `AGENTS.md`, workspace instructions and `apps/web/AGENTS.md`. Verify branch/base/dirty state. If necessary apply the supplied patch to the matching base in an isolated checkout. Compare with current main before integration; preserve unrelated work.
2. **Obtain callable PostHog access.** Discover project/organization tools in the new session and verify project 309879. If unavailable, use securely configured management credentials; never request credentials pasted into chat or ship personal API keys to the frontend.
3. **Audit live configuration.** Inspect events/property definitions, recent ingestion, current insights/cohorts, SDK/replay settings and actual deployment variables. Confirm web `NEXT_PUBLIC_POSTHOG_KEY` and API `POSTHOG_API_KEY` are ingestion keys for the same intended environment. Verify anonymous `/ingest` requests and domain/proxy behavior.
4. **Close instrumentation gaps.** Audit consent/opt-out; docs still sends `location.search` and does not use the new scrubber. Validate early SDK event buffering and server delivery on shutdown/failure. Reconcile backend internal-traffic verdicts with owner/member allowlists. Evaluate a durable analytics outbox if delivery evidence warrants it. Add authoritative connection health/recovery, webhook logical delivery, agent operations, signup and actual payment outcomes according to the plan.
5. **Review measurement accuracy.** A successful callback or selected asset is not usable-access completion. Verify completion/waived-requirement rules against database truth. Stable UUIDs do not prove exactly-once ingestion. Count distinct request IDs and test retries/concurrency. `subscription_started` can describe trial checkout and can be emitted by multiple sources; do not use it as first payment. Revenue/MRR properties currently include list-price estimates.
6. **Prepare dashboards.** Acquisition/activation; request-level completion and provider friction; access health/recovery; agency retention and billing-reconciled revenue; automation adoption. Exclude internal/demo/preview traffic. Existing production events may omit `environment`, so production equality-only filters can discard historical data. Report join-ID/consent coverage and mature cohort denominators.
7. **Run final checks and staging walkthrough.** Rebuild shared, rerun relevant tests/typechecks/lint/diff checks, then run agency and separate recipient sessions through partial/full completion, retries, cancellation, expiry, logout/account changes and app/recipient transitions. Inspect outgoing payloads using synthetic secret canaries. Block analytics and ensure core workflows continue working. Reconcile known fixtures with PostHog queries.
8. **Release through repository policy.** Present concrete changes/settings/dashboards for review. Root `AGENTS.md` says: “Get approval before deployments, production configuration/data/schema changes … or git commit/push/PR actions.” Commit and push were subsequently approved for this feature branch. Deployment, production changes and PR creation still require applicable authorization. After applicable approval, publish the reviewed branch, deploy, and verify live ingestion/dashboard results. Record evidence and remaining limitations rather than declaring setup complete from local tests.

## Suggested prompt for the next session

> Continue the AuthHub PostHog work for GitHub repository jonhigh1/agency-access and recorded US project 309879. Read docs/analytics/handoff.md, measurement-plan.md and posthog-rollout.md. Prior local changes are uncommitted on feat/posthog-critical-journeys, based on 18df05ce; recover the supplied patch if the workspace is different. Discover the newly installed PostHog plugin, verify actual live ingestion/settings/dashboards, finish the documented coverage gaps, and validate request-level funnels across agency and client identities. Preserve unrelated work and follow AGENTS.md release approval rules. Do not assume any local changes are already deployed.
