# `/review-demo` review-mode route

Lab-only guided Meta App Review screencast surface (issue #131 / build spec #135 section C).

## Enable (review.authhub.co)

**API (`apps/api`)**

- `META_REVIEW_DEMO_ENABLED=true`
- `META_REVIEW_LAB_USER_IDS` — Clerk user ids for lab reviewer/agency accounts
- Optional sandbox overrides: `META_REVIEW_BM_ID`, `META_REVIEW_AD_ACCOUNT_ID`, `META_REVIEW_PAGE_ID`
- **Required for live Graph partner proof:** `META_REVIEW_AGENCY_BM_ID` — agency sandbox Business Portfolio id assigned as partner on the review ad account
- `META_REVIEW_LAB_AGENCY_ID` — agency id stored in OAuth state for review-demo Meta connect

**Web (`apps/web`)**

- `NEXT_PUBLIC_META_REVIEW_DEMO_ENABLED=true`
- `NEXT_PUBLIC_META_REVIEW_LAB_USER_IDS` — same Clerk ids (gate before API)

**Clerk `public_metadata`**

- `labRole`: `reviewer` | `agency`, or `lab: true`

## OAuth redirect

Review-demo Meta connect uses the registered client callback:

`https://review.authhub.co/invite/oauth-callback?flow=review-demo`

Tokens are stored in Infisical under `review_demo_meta_{clerkUserId}` (not PostgreSQL).

## Offline / CI mock path

Set `META_REVIEW_DEMO_MOCK_GRAPH=true` on the API to serve fixture step payloads without live Graph. Production review host should keep this `false`.

## `pages_read_engagement` (review-demo only)

Review Lab does **not** call `GET /{page-id}/feed` or request a Page access token. Alex’s reviewer token has no app role and cannot satisfy feed/PPCA requirements without one.

Live proof is a single Graph read:

`GET /{META_REVIEW_PAGE_ID}?fields=id,name,category,fan_count,followers_count`

The UI shows Page name, category, fan count, and follower count with copy explaining AuthHub uses these fields to confirm the correct Page before agency onboarding. Production client onboarding still uses the full **Validate Page access** path (metadata + dates-only feed) via `fetchPageEngagementProof` with feed enabled.

## Marketing API tier daily cron

See [marketing-api-tier-cron.md](./marketing-api-tier-cron.md) for pg-boss schedule, Graph endpoints, env vars, and how to read the tier day-count audit log (#134 / #135 §F).

## Playwright screencast harness

See [review-demo-recording-harness.md](./review-demo-recording-harness.md) for ≥1080p capture, caption overlay, artifact paths, verifier (`review-demo:verify`, issue #132 / #133), and env vars.
