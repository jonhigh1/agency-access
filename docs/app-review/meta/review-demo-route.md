# `/review-demo` review-mode route

Lab-only guided Meta App Review screencast surface (issue #131 / build spec #135 section C).

## Enable (review.authhub.co)

**API (`apps/api`)**

- `META_REVIEW_DEMO_ENABLED=true`
- `META_REVIEW_LAB_USER_IDS` — Clerk user ids for lab reviewer/agency accounts
- Optional sandbox overrides: `META_REVIEW_BM_ID`, `META_REVIEW_AD_ACCOUNT_ID`, `META_REVIEW_PAGE_ID`, `META_REVIEW_CATALOG_ID`, `META_REVIEW_TEST_AD_ID`
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

## Playwright screencast harness

See [review-demo-recording-harness.md](./review-demo-recording-harness.md) for ≥1080p capture, caption overlay, artifact paths, and env vars (issue #132).
