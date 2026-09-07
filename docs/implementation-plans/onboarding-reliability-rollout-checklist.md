# Onboarding Reliability Rollout Checklist

## Scope
This checklist covers rollout validation for onboarding reliability fixes:
- Authenticated onboarding API transport
- Unified onboarding payload contract alignment
- Step progression and team invite flow hardening
- Access request platform payload normalization

## Pre-Deploy
- [ ] `apps/web` tests pass for onboarding:
  - `src/lib/api/__tests__/authorized-api-fetch.test.ts`
  - `src/contexts/__tests__/unified-onboarding-context.test.tsx`
  - `src/app/onboarding/unified/__tests__/page.test.tsx`
  - `src/app/onboarding/platforms/__tests__/page.test.tsx`
- [ ] `apps/api` tests pass for access request route normalization:
  - `src/routes/__tests__/access-requests.routes.test.ts`
  - `src/routes/__tests__/access-requests.security.test.ts`
- [ ] `npm run typecheck --workspace=apps/web`
- [ ] `npm run typecheck --workspace=apps/api`
- [ ] `NEXT_PUBLIC_API_URL` configured in production web environment

## Release-Day Validation (First 30 Minutes)
- [ ] Create a new user and complete `/onboarding/unified` through link generation
- [ ] Add at least one team invite in onboarding and confirm success path
- [ ] Validate that `/onboarding/platforms` can initiate OAuth without 401
- [ ] Confirm no `Missing or invalid Authorization header` errors for onboarding endpoints

## Monitoring Queries (0-72 Hours)

### Backend error monitoring
Track status and error codes on:
- `POST /api/agencies`
- `POST /api/clients`
- `POST /api/access-requests`
- `POST /api/agencies/:id/members/bulk`
- `/agency-platforms/*`

Focus on:
- `UNAUTHORIZED`
- `VALIDATION_ERROR`
- `PLATFORMS_NOT_CONNECTED`

### Product analytics events
Track:
- `onboarding_step_completed`
- `first_access_link_generated`
- `onboarding_step_failed`
- `team_invites_sent`

**PostHog note (Growth):** `properties.token` on every event is the PostHog project API key (`phc_…`) injected by the JS SDK for ingestion — not an access-request token. It appears on `$pageview`, `onboarding_started`, and all other events. For onboarding funnels, correlate access requests with `properties.access_request_token` or `properties.accessRequestId` only. Do not filter or join on `properties.token`.

### Success thresholds
- 401 rate on onboarding endpoints: near-zero after rollout
- Link generation success rate: increase vs. pre-rollout baseline
- Step-3 drop-off (`platform_selection -> success_link`) decreases vs. baseline

## Rollback Criteria
Rollback if any of the following persist for >30 minutes:
- Sustained spike in onboarding 401s
- Sustained spike in onboarding 400 validation errors on agency/client/access-request creation
- Step-3 completion rate regression >20% from baseline

## Ownership
- Engineering: validate API/web behavior and hotfixes
- Product/Analytics: validate funnel and event quality
- Support: watch inbound onboarding failure tickets for new patterns
