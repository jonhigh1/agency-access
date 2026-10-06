# Errors & Known Failures

Log deterministic errors with a conclusion; infrastructure errors without one
until a pattern emerges. Newest first.

## 2026-10-06 — RESOLVED: Render env-var wipe via paginated replace-all PUT (during Creem webhook setup)

**Deterministic** (root cause proven; recovery verified in production).

- Symptom: after adding `CREEM_WEBHOOK_SECRET` via the Render env API, two
  deploys failed Zod env validation (`update_failed`); production kept serving
  from the pre-change instance while every restart would have booted broken.
- Root cause: `GET /v1/services/{id}/env-vars` paginates (default page = 20).
  A replace-all `PUT /v1/services/{id}/env-vars` was built from page 1 of a
  ~60-var service, deleting every var beyond the first page (Clerk keys,
  Infisical identity, Meta/Creem creds, all connector OAuth creds, Sentry DSN,
  admin allowlists). Concurrent earlier recovery runs made counts drift
  mid-session, which masked the loss twice.
- Recovery: values re-sourced from Vercel project `agency-access`
  (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `META_APP_ID`), repo-derivable
  facts (`FRONTEND_URL`, `API_URL`, `CLERK_OAUTH_ISSUER` via OIDC discovery,
  `CLERK_OAUTH_VERIFY_URL`, `INFISICAL_PROJECT_ID` from backup filename), user
  dashboards (`META_APP_SECRET`, `CREEM_API_KEY`,
  `INFISICAL_CLIENT_ID/SECRET`), and a regenerated `OAUTH_STATE_HMAC_SECRET`.
  Deploy `dep-db27nsvlot8c73e61mbg` went live; verified `/health` 200, unsigned
  webhook POST → 401, HMAC-signed probe event → 400 `Unknown product ID`
  (proves signature verification against the real secret end-to-end).
- Residual: **22 connector/functional vars remain unrestored** —
  `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`,
  `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `LINKEDIN_CLIENT_ID/SECRET`,
  `PINTEREST_CLIENT_ID/SECRET`, `KIT_CLIENT_ID/SECRET`,
  `KLAVIYO_CLIENT_ID/SECRET`, `MAILCHIMP_CLIENT_ID/SECRET`,
  `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET_KEY`, `BEEHIIV_API_KEY`,
  `TIKTOK_CLIENT_ID/SECRET`, `SENTRY_DSN`, `INTERNAL_ADMIN_EMAILS`,
  `INTERNAL_ADMIN_USER_IDS`, `TRUST_PROXY_IPS`, `AGENT_MCP_RESOURCE_URL`,
  `AGENT_NATIVE_AGENCY_ALLOWLIST`. No offline source exists (the Infisical
  backup holds OAuth *tokens*, not connector client creds; Vercel holds
  frontend vars only) — each must come from its own dashboard. Affected
  connectors fail at OAuth initiation until restored.
- Rules going forward:
  1. Never `PUT` the env-vars collection without `limit=100` AND a count
     assertion (GET count == PUT body count) before writing.
  2. After any env change, GET with `limit=100` and diff keys against the
     `render.yaml` declared list.
  3. Auto-deploy was disabled during recovery as protection and re-enabled
     (`autoDeploy: yes / trigger: commit`) after verification — do not leave
     it off.
- Rotation pending: Render API key + refresh token were printed in agent
  transcripts; secrets transited chat (Creem webhook secret, `CREEM_API_KEY`,
  `META_APP_SECRET`, Infisical client secret). Rotate when convenient.

## 2026-10-03 — RESOLVED: 401 USER_EMAIL_REQUIRED on all mutating revoke endpoints (jam 76b5f94c)

**Deterministic** (root cause proven by code path + production capture).

- Symptom: `DELETE /agency-platforms/meta` → 401 from
  https://authhub.co/connections Disconnect (jam.dev/c/76b5f94c). Same guard
  broke DELETE /clients/:id, POST /connections/:id/revoke, and
  POST /authorizations/:id/revoke.
- Root cause: PR #72 (b7ed78e1, 2026-09-26) added hard 401
  `USER_EMAIL_REQUIRED` guards keyed on `resolveUserEmail(request.user)` —
  i.e. on email claims inside the Clerk session JWT. Clerk session tokens do
  not include email claims in this deployment, so every revoke 401'd while
  GETs succeeded (agency resolution keys off sub/orgId and has its own
  Clerk-API email fallback).
- Fix: route handlers now derive the audit actor via
  `resolveAuthenticatedUserEmail` (JWT claims → verified Clerk record), after
  the agency-ownership check. token-health's shared helper no longer resolves
  email on list endpoints. Frontend disconnect no longer sends a client
  `revokedBy` and now surfaces the API error message.
- Tests: failing-first coverage added in agency-platforms.security,
  clients.security, token-health.security, authorization (helper), and
  connections page (toast surfaces API message). Full suites green (API 1711,
  web 2272), typecheck clean.
- Residual: any NEW endpoint that keys authorization off JWT email claims will
  repeat this bug. Clerk-side option (not done): add email to the session
  token template so claims carry it; the Clerk-API fallback keeps working
  either way.

---

---

## 2026-09-13 — RESOLVED: 11 pre-existing web test failures (settings + success page)

**Resolution:** merging `origin/main` (commits `147867d`, `ba21068`) fixed the
10 settings failures — mock coverage for the code-split tabs landed there. The
remaining success-page test was stale against the PostHog capture
serialization (`7178a20`); fixed in this branch by asserting
`trackInviteLinkCopyAndSent` and making the copy mock run its callback.

Original record below for reference.

---

## 2026-09-13 — 11 pre-existing web test failures (settings + success page)

**Deterministic** (reproduced in isolation, no concurrent edits).

- `src/components/settings/__tests__/settings-view-counts.test.tsx` — 6 tests.
  Tabs render no ink-panels (expected 1). Root symptom: hooks inside the
  rendered tab content fail (`usePrefetchBillingData` /
  `settings-tabs.tsx:51`; settings page tests additionally fail with
  "No QueryClient set" from `useUserAgency`).
- `src/app/(authenticated)/settings/__tests__/page.test.tsx` — 4 tests, same
  QueryClient root cause.
- `src/app/(authenticated)/access-requests/[id]/success/__tests__/page.test.tsx`
  — 1 test ("tracks invite analytics when copy link is clicked").

**Proof pre-existing:** reproduced identically at base commit `86fa16a` (before
the 2026-09-13 button-sweep session) in a throwaway worktree with the same
node_modules. Not caused by the sweep.

**Conclusion (provisional):** mock setup for `@/hooks/use-user-agency` /
billing hooks does not cover a code path added by the "code-split gated UI"
work (9c474cd..0929df9). Fix by extending the test mocks or wrapping renders
in a QueryClientProvider. No product bug demonstrated.


## 2026-09-14 — Flaky API test: quota/agency-resolution race

- Symptom: full API suite intermittently fails 1 test (quota-fingerprint 'boom' race in agency-resolution/quota tests); passes on re-run.
- Classification: infrastructure/timing flake, not deterministic. No conclusion yet; re-run before diagnosing.
