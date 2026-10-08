# Meta Marketing API tier — daily Ads Graph cron (#134)

Implements build-spec **§F** in [#135](https://github.com/jonhigh1/agency-access/issues/135). Exercises **read-only** Marketing API / Ads Graph against the **Review BM test ad account** so AuthHub can accumulate successful API days toward Meta’s Marketing API access tier (target **16** days) and stay within the **≤30-day** Graph freshness window for App Review.

## Scheduling (Render API service)

This repo uses **pg-boss** on the `agency-access-api` Render web service (same pattern as token refresh and trial expiration). No separate Render Cron Job is required when `BACKGROUND_WORKERS_ENABLED=true`.

| Item | Value |
|------|--------|
| Job name | `meta-marketing-api-tier-daily` |
| Cron (UTC) | `0 6 * * *` (daily 06:00), or `*/10 * * * *` when burst mode is on |
| Handler | `apps/api/src/jobs/meta-marketing-api-tier-cron.ts` |
| Manual run | `cd apps/api && npx tsx src/jobs/meta-marketing-api-tier-cron.ts` |

The job is a no-op unless `META_MARKETING_API_TIER_CRON_ENABLED=true`. It also skips when `META_REVIEW_DEMO_MOCK_GRAPH=true` (fixtures must not count as live Graph).

## Locked sandbox (defaults)

| Asset | ID |
|-------|-----|
| Prod Meta app | `1215220247221414` (`META_APP_ID`) |
| Review BM | `695982475048959` (`META_REVIEW_BM_ID`) |
| Test ad account | `act_557538895783894` (`META_REVIEW_AD_ACCOUNT_ID`) |

Only that ad account is called. Client ad accounts are never used.

## Graph calls (Marketing API — read-only)

Each successful run performs these **GET** edges (see `META_MARKETING_API_TIER_CRON_GRAPH_CALLS` in `@agency-platform/shared`):

1. **`GET /v{version}/act_{test_aa}?fields=id,name,account_status,currency`** — ad account read.
2. **`GET /v{version}/act_{test_aa}/campaigns?fields=id,name,status&limit=5`** — campaign list read.

No create/update/pause/spend mutations. Safe for tier counting without spend risk.

## Environment variables

Set on the **review/lab API** Render service (secrets via Infisical/env only — never git):

| Variable | Purpose |
|----------|---------|
| `BACKGROUND_WORKERS_ENABLED` | Must be `true` for pg-boss schedule |
| `META_MARKETING_API_TIER_CRON_ENABLED` | `true` to run daily exercise |
| `META_MARKETING_API_TIER_CRON_BURST` | `true` or `1` only — 10-minute schedule, no once-per-day success skip (~288 calls/day) |
| `META_APP_ID` | `1215220247221414` on review host |
| `META_REVIEW_AD_ACCOUNT_ID` | Test AA (default `557538895783894`) |
| `META_REVIEW_LAB_USER_IDS` | Lab reviewer Clerk id(s) |
| `META_MARKETING_API_TIER_CRON_LAB_USER_ID` | Clerk user id whose **review_demo** token is copied during one-off seed (see below) |
| `META_REVIEW_LAB_AGENCY_ID` | Stored on audit rows for lab context |
| `META_REVIEW_DEMO_MOCK_GRAPH` | Must be `false` for live Graph |
| `META_MARKETING_API_TIER_FAILURE_ALERT_THRESHOLD` | Consecutive failed UTC days (failed runs, no successful run) before Sentry alert (default `3`). Counts days, not runs, in both daily and burst mode |
| `SENTRY_DSN` | Optional; consecutive-failure alerts |
| Infisical | **`meta_tier_cron_token`** — isolated cron token (never overwritten by `/review-demo` reconnect) |

### Seed the isolated cron token (one-off)

After Alex (or the lab reviewer) has connected Meta on `/review-demo`, copy that token into `meta_tier_cron_token` so daily tier exercise survives reviewer reconnects:

```bash
# From repo root (requires Infisical Machine Identity env on the API)
npm run seed:meta-tier-cron-token --workspace=apps/api
```

Alternatively, as an internal admin (Clerk JWT + allowlist):

```http
POST /internal-admin/meta/seed-tier-cron-token
```

The seed is **idempotent** (skips when `meta_tier_cron_token` already has an access token). Responses never include token values.

If `meta_tier_cron_token` is missing, the cron **skips** with `meta_marketing_api_tier_daily_skipped` / Sentry warning — it does **not** fall back to `review_demo_meta_*`.

## Structured log & day count

Each run writes an **append-only** row to `audit_logs`:

- **action:** `META_MARKETING_API_TIER_DAILY`
- **resource_type:** `meta_marketing_api_tier`
- **resource_id:** test ad account id
- **metadata:** `timestamp`, `metaAppId`, `adAccountId`, `httpStatus`, `success`, `tierUtcDate` (UTC date), `tierDayCount`, `targetTierDays` (16), `graphCalls[]`

Application logs also emit `meta_marketing_api_tier_daily` (Pino) with the same fields (no tokens).

### Read day count (SQL)

```sql
SELECT
  metadata->>'tierUtcDate' AS day,
  metadata->>'success' AS success,
  metadata->>'tierDayCount' AS tier_day_count,
  created_at
FROM audit_logs
WHERE action = 'META_MARKETING_API_TIER_DAILY'
ORDER BY created_at DESC
LIMIT 30;
```

Distinct successful UTC days ≈ progress toward day-16 readiness (`tierDayCount` on the latest success row).

## Failure visibility

- Failed runs log `success: false` with HTTP status and `graphCalls`.
- After **N** consecutive failed UTC days (`META_MARKETING_API_TIER_FAILURE_ALERT_THRESHOLD`, default 3), the API sends a **Sentry** error message (`meta_marketing_api_tier_daily_consecutive_failures`), at most once per hour.
  - A failed day is a UTC day with at least one failed run and **no** successful run. Each day counts once, however many runs it had (burst mode runs every 10 minutes; pg-boss retries add more). A day with any success resets the streak. Days with no runs at all are skipped.
  - In burst mode a breakage that starts after the day's first success is not a failed day until the next UTC day; set the threshold to `1` to page on the first full UTC day without a success.
  - The Sentry event groups under one fingerprint and carries tags `meta_error_code`, `meta_error_subcode`, `meta_error_type`, `tier_cron_failed_call`, `tier_cron_http_status`, plus `extra.metaError` (code, subcode, type, scrubbed message, fbtrace id). Ad account ids, other long numeric ids and tokens are never sent to Sentry.
- pg-boss retries failed job handlers; operators should fix token/Graph issues and re-run manually if needed.

## Related docs

- [`review-demo-route.md`](./review-demo-route.md) — lab OAuth and sandbox IDs
- [#135](https://github.com/jonhigh1/agency-access/issues/135) — full build spec
