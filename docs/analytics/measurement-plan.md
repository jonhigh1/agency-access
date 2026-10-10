# AuthHub measurement and PostHog implementation plan

Status: proposed target contract, initially grounded in public documentation. The repository jonhigh1/agency-access is now cloned and inspected at main commit 18df05ce. It already has PostHog web/docs initialization, custom journey events, server billing events, and reports referencing US project 309879. Local implementation improvements are documented in docs/analytics/posthog-rollout.md. Live PostHog project settings, credentials, production configuration, consent handling and ingestion remain unverified. Proposed event names below must be mapped to existing names; this is not a claim that every proposed event is implemented.

## Product outcome and priorities

Primary outcome: clients provide the requested platform/asset permissions and the agency can use that access. A generated link or successful OAuth callback alone does not prove this outcome.

North-star metric: weekly distinct agency/client pairs reaching verified request completion for the first time in that week, excluding demos, internal traffic, and repeated completion of the same request. Also show distinct agencies delivering that value and healthy active connections as a stock metric; onboarding frequency will vary by agency.

Activation: an agency's first real access request reaches verified completion within seven days of workspace creation. Track first request creation within 24 hours separately as an early milestone. These are proposed analysis windows, not established targets.

Priority order:
1. Agency acquisition and activation.
2. Client recipient completion and provider/asset failure diagnosis.
3. Continued access health and recovery.
4. Trial conversion and retained agency value.
5. Webhooks, API/CLI/agents, collaboration, and branding adoption.

## Critical journeys and metric definitions

| Journey | Steps | Main metrics | Analysis unit/window |
| --- | --- | --- | --- |
| Website acquisition | Landing → trial CTA → signup → workspace created | Unique visitor CTA rate; signup completion; acquired workspaces by first-touch campaign, landing route, device | Visitor to user; 7-day funnel; attribution only where consent and identity linkage permit |
| Demo acquisition | Landing → demo CTA → confirmed booking | CTA rate; confirmed booking rate | Visitor; 7 days; external scheduler confirmation required, clicks are not bookings |
| Agency setup | Workspace created → request builder → request created → link copied or delivery accepted | First-request rate; time to first request; builder step drop-off | Agency; 24 hours and 7 days |
| Client completion | Valid recipient request opened → provider started → authorization verified → asset selection submitted → access verified → request completed | Open-to-complete rate; created-to-complete rate; per-provider success; partial/expired rates; time to usable access | Request; 7-day completion cohort; provider attempts analyzed separately |
| Recovery | Failed/partial request → retry or reminder → verified completion | Recovery rate; attempts before success; time to recovery; expiry/revocation reasons | Request or connection; 7 days |
| Retained value | First verified completion → further real completions or successful authorized work | Week 1/4/8 agency retention; repeat onboarding; active agencies; healthy connection stock | Agency cohorts; completed onboarding and user-initiated successful work qualify; background refresh does not |
| Monetization | Trial started → checkout started → first payment confirmed → renew/change/cancel | Trial-to-first-paid rate; time to paid; paid agency retention; MRR and revenue churn reconciled to billing | Agency; trial maturity at 14 days plus 7-day observation grace; billing is authoritative |
| Access health | Active connection → refresh/check → invalidation → recovery or disconnect | Refresh success; invalid connection share; recovery latency; cleanup failures | Connection/provider; 24h and 7d; operational system remains alert authority |
| Automation | Webhook configured → test succeeds → real lifecycle delivery succeeds | Setup-to-working integration rate; final delivery success; latency/retry distribution | Agency and logical delivery; 7 days; tests reported separately |
| Agents/API/CLI | Grant created → first authorized operation → repeat successful operation | Adoption; successful first operation; denied/failed operation rates; operation latency | Agency/grant; 7 days; distinguish read, write, and polling |

Client duration has two clocks: request creation to completion (includes waiting) and first valid recipient open to completion (client execution). Report p50/p90 and the share completed within five minutes of opening alongside completion rate. Completed-only duration excludes stalled clients; show their count and age separately. Freeze the initial requested requirements for analysis; edits create a requirement version. Completion requires all required platforms/assets to satisfy the application's verified access rules.

Funnel windows are initial defaults to revise after baseline volume is observed. Seven-day conversion denominators use cohorts at least seven days old. Trial conversion uses trial cohorts at least 21 days old. Requests revoked/expired remain in created-cohort denominators, with explicit outcome breakdowns. Recipient-open funnels exclude agency previews and known bots using validated rules.

## Event contract

Names use snake_case. Emit business outcomes from committed backend state, once per logical transition, rather than optimistic UI states. Browser events describe user intent and visible steps. Instrument the shared domain services so UI, API, CLI, and agents generate consistent outcomes.

| Events | Owner and exact trigger | Useful additional properties |
| --- | --- | --- |
| `marketing_cta_clicked`, `pricing_plan_selected`, `demo_booking_completed` | Browser for clicks/selections; trusted scheduler confirmation for booking | `cta_id`, `placement`, `route_name`, `plan`, `billing_interval`, allowlisted campaign values |
| `signup_started`, `signup_failed`, `signup_completed` | Browser start; authoritative auth service for failure/completion | `auth_method`, normalized `error_code` |
| `workspace_created`, `trial_started` | Backend after committed creation/trial transition | `plan`, `trial_duration_days` |
| `request_builder_started`, `request_builder_step_completed` | Browser on meaningful builder entry/step progression | `step`, `requested_platforms`, `required_platform_count` |
| `access_request_created`, `access_request_creation_failed` | Backend committed creation or normalized failure | analytics-only `request_id`, `requirements_version`, `requested_platforms`, `access_level` |
| `request_link_copied`, `request_delivery_accepted`, `request_reminder_sent` | Browser after clipboard success; backend after provider acceptance/reminder dispatch | `request_id`, `channel`; acceptance does not prove delivery or recipient reading |
| `client_request_opened`, `client_request_unavailable` | Browser on valid rendered recipient experience; classify preview separately | `request_id` for validated request only, `branding_mode`, bounded `reason` |
| `provider_authorization_started`, `provider_authorization_succeeded`, `provider_authorization_failed` | Backend OAuth attempt creation and verified callback outcome | `request_id`, `attempt_id`, `provider`, `error_code`, `duration_ms` |
| `asset_selection_viewed`, `asset_selection_submitted`, `asset_access_verified`, `asset_access_failed` | Browser viewed; backend accepted selection and verified grant/failure | `request_id`, `attempt_id`, `provider`, counts/types only, normalized failure code |
| `access_request_partial`, `access_request_completed`, `access_request_expired`, `access_request_revoked` | Backend committed lifecycle transition | `request_id`, `requirements_version`, requested/completed counts, verified durations, `reason` |
| `connection_health_changed`, `token_refresh_succeeded`, `token_refresh_failed`, `connection_recovered` | Backend health transition/refresh result/recovery | analytics-only `connection_id`, `provider`, `old_status`, `new_status`, `attempt_id`, `duration_ms`, `error_code` |
| `connection_disconnect_started`, `connection_disconnect_completed`, `connection_cleanup_failed` | Backend requested disconnect and confirmed cleanup outcome | `connection_id`, `provider`, `reason`, `error_code`; request alone is not successful revocation |
| `checkout_started`, `subscription_started`, `subscription_changed`, `subscription_cancelled`, `invoice_paid`, `invoice_payment_failed` | Browser checkout intent; validated billing webhooks for outcomes | `plan`, `billing_interval`, amount in minor units, currency, opaque billing event ID |
| `webhook_endpoint_created`, `webhook_test_succeeded`, `webhook_delivery_attempted`, `webhook_delivery_succeeded`, `webhook_delivery_failed` | Backend settings write, test result, attempt and final logical outcome | analytics-only endpoint/delivery IDs, `is_test`, event type, attempt number, latency, response class; no URL/payload/signature |
| `agent_grant_created`, `agent_grant_revoked`, `agent_operation_completed`, `agent_operation_failed` | Backend grant transition or terminal operation result | opaque grant/operation IDs, bounded operation name, read/write type, duration, error code; no prompts or outputs |
| `team_invite_sent`, `team_invite_accepted`, `branding_saved` | Backend persisted outcomes; lower priority | role, branding mode; no email, names, uploaded content, or custom domains |

Common properties: `schema_version: 1`, `environment`, `surface` (marketing/app/client_portal/api/cli/agent/worker), `actor_type` (agency_user/client_recipient/agent/system), `source` (browser/server), `release`, `is_internal`, `is_demo`, and opaque `agency_id` when legitimately known. Attach PostHog agency group context consistently if the chosen plan supports group analytics; otherwise retain `agency_id` and use request/agency-level queries. Platform taxonomy must match actual application enums, with stable categories rather than ad hoc display labels.

Failure taxonomy: user_cancelled, insufficient_permissions, no_eligible_assets, provider_unavailable, rate_limited, expired_request, revoked_request, invalid_callback, persistence_failed, timeout, unknown. Map from actual code without sending raw errors. Treat cancellation separately from infrastructure failure; count unfinished attempts and callback loss separately from explicit failures.

## Identity, attribution, and counting

- Agency members: identify using immutable opaque internal user IDs after authentication. Use agency grouping rather than sharing a single identity across team members. Set only approved non-PII person properties; reset on logout and clear/reassign agency context on workspace switch.
- Client recipients: never identify as the agency member or as the request ID. Use a recipient-specific anonymous identity, or an opaque authenticated recipient ID if one exists. Join journeys using an analytics-only request ID independent of link secrets. Shared-link users may be different people or devices.
- Agents and background workers: use separately namespaced service/agent identities; never inflate human active-user measures. Group with the verified agency from backend authorization context.
- Bind browser/server identity and attempt correlation before OAuth redirects through existing server-side request/session records. Do not append analytics identifiers to provider redirects or overwrite OAuth state. Different-device client activity is correlated by request, not an assumed shared person.
- Capture first and last marketing attribution separately using bounded, validated values and referrer origin only. Do not attribute an agency's acquisition to a client's later recipient session. Cross-subdomain continuity depends on observed hosting and consent; custom domains cannot share root-domain cookies.
- Generate deterministic event UUIDs from non-secret domain event IDs for idempotent server retries. Persist outcomes through the existing outbox/event infrastructure where available; delivery failures must not block authorization. A per-delivery attempt ID is different from a logical delivery ID.
- Compute request funnels by request ID and provider funnels by request ID + provider + attempt ID. A person funnel cannot join an agency creating a request to a different client completing it. Agency retention should count agencies, not seats. Use group analytics where available, otherwise HogQL or verified aggregate models.

## PostHog configuration to apply after access is available

1. Inspect existing SDK/GTM initialization, project settings, event definitions and dashboards. Reuse the correct project; avoid duplicate initialization or competing pageview tracking.
2. Confirm region, project ingestion key, ingest/API hosts, and production domains. Keep any personal/API management key server-side in configured secrets; use least privilege. Use separate production/nonproduction projects where feasible, with environment filters regardless.
3. Install the SDK appropriate to the actual frontend/backend stack and initialize once. Coordinate consent with the existing product mechanism, and avoid browser persistence or capture before analytics permission where required. Respect opt-out and deletion flows; document resulting coverage gaps rather than bypassing consent with server events.
4. Start with explicit events and controlled route-based pageviews. Disable blanket autocapture, automatic URL collection, unrestricted exception capture, and session replay until verified safe. Exclude raw OAuth callbacks, login credentials, request links, token screens, and sensitive settings. Replace routes containing IDs/secrets with static templates; remove query strings/fragments and sanitize referrers before any capture.
5. Apply an allowlist for custom properties on browser and server and audit SDK-generated metadata, person updates, and errors. Never send access/refresh tokens, authorization codes/state, link secrets, cookies, email/name, client or asset names/native IDs, account details, webhook URLs/secrets/payloads, agent prompts/outputs, or full provider errors. Pseudonymous IDs remain subject to access and retention controls.
6. If replay is introduced later, use a small sample only on approved agency screens, mask inputs/text, block sensitive elements, and verify recordings and network metadata. Keep recipient/OAuth/token screens excluded until an explicit safe design exists.
7. Configure production dashboards below, descriptions, exclusion filters, and cohorts for internal/demo traffic. Set retention, project access, and group analytics availability deliberately. Route health alerts through existing monitoring; PostHog is not the authoritative security audit trail.
8. Establish a 2–4 week baseline. Select alerts based on traffic and provider-specific error rates with minimum sample counts; do not set arbitrary SLA thresholds before observing the product.

## Initial dashboards

- Acquisition: eligible unique visitors, CTA/signup funnel, campaign/landing breakdown, first request and verified activation by acquisition cohort, demo clicks versus confirmed bookings.
- Activation and onboarding: workspace cohorts, first-request/first-completion timing, request creation/open/completion counts, request-level funnel, partial/expired/revoked outcomes, platform and access-level breakdowns.
- Client friction and reliability: OAuth attempt funnel, asset verification failures, unknown/missing outcomes, execution p50/p90 and five-minute share, aged incomplete requests, recovery, connection health and disconnect cleanup.
- Retention and revenue: agency week 1/4/8 retention, repeated client onboarding, healthy connection stock, matured trial-to-paid conversion, paid cohorts, billing reconciled MRR/churn.
- Automation adoption: webhook setup-to-real-success, logical delivery versus attempt failure, agents/CLI/API usage by operation and actor, collaboration/branding adoption by plan.

Every dashboard starts with production, noninternal, nondemo filters and explicitly states counting unit, conversion window, cohort maturity and data coverage. Segment by provider, plan, requested-platform count, access level, device and surface where useful; use bounded categories to avoid noisy breakdowns.

## Acceptance checks before claiming setup complete

1. In staging, run signup → agency request → separate recipient session → multi-provider authorization → asset grant → completed request. Check event sequence, identity separation, group context and request/attempt joins in PostHog.
2. Verify partial approval, cancellation, callback failure, no eligible assets, refresh failure/recovery, revoked/expired links and failed disconnect cleanup produce correct distinct outcomes.
3. Repeat callbacks, queue retries, webhook deliveries and billing notifications. Verify one completion/first-payment event per logical transition and separately counted retries.
4. Check SPA navigation/back/refresh yields intended pageviews; login/logout, user change, agency switching, cross-subdomain and white-label flows preserve correct boundaries.
5. Inspect actual outgoing browser/server payloads and SDK metadata with synthetic canary secrets, including callback URLs and error paths. Confirm all sensitive values are excluded. Check opt-out/consent withdrawal and deletion behavior.
6. Block analytics/network and verify signup and authorization still work; verify server flush/outbox behavior on the actual deployment runtime.
7. Verify billing outcomes from signed source events; confirm trial and retention cohort maturity. Validate request-level funnels with events from two distinct people.
8. Reconcile sampled production requests/connections/payments with database/billing counts, test project isolation and internal/demo exclusions. Check every dashboard query against known fixtures and low-volume cases.

Completion evidence: reviewed code diff, passing relevant checks, sanitized captured events from staging, correct PostHog project/settings, working dashboard links, reconciliation results and clearly documented consent/ad-blocking coverage gaps. Local code and test evidence now exists in the rollout audit; sanitized staging/live ingestion, dashboards and reconciliation remain unverified.

## Evidence and remaining unknowns

Public sources inspected on 2026-10-10:
- https://authhub.co/ — product outcome and agency/client platform-access journey.
- https://authhub.co/pricing — trial and paid plan context; actual billing code remains authoritative.
- https://docs.authhub.co/getting-started/create-your-first-request — request creation flow.
- https://docs.authhub.co/requests-and-links/send-your-link — agency/recipient handoff.
- https://docs.authhub.co/automation/webhooks — lifecycle, partial/completed states, health changes and automation.
- https://docs.authhub.co/agentic-workflows/connect-an-agent — agent grants and operations.
- https://authhub.co/privacy-policy — data sensitivity and disconnect cleanup outcomes.

The source repository is now inspected on main. Remaining access needs are actual deployment configuration, confirmed PostHog project/ingestion configuration and securely configured management access for remote setup. Historical reports reference US project 309879. Confirm event hooks, provider enums, completion rules, consent policy and project capabilities against actual code before treating this contract as implemented. Public pages do not establish current PostHog installation status.
