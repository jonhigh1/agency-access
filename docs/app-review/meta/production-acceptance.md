# Meta production acceptance

Status: **migration preflight passed; production acceptance and App Review pending**. No deployment of the two Meta migrations, app submission, or non-role acceptance is claimed by this checklist. The current permission matrix and Meta's active New requests exclude `ads_read`: AuthHub has no Ads Insights operation. Meta still lists the permission under the rejected Marketing API use case, but it is not in the active App Review draft. `catalog_management` is also excluded: catalogs are a later review track and the default client invite does not surface catalog selection or grant. Older run notes below record the earlier draft state, not the current target scope.

## Run record

Fill this record from one fresh test. Store sanitized evidence only. Keep tokens, credentials, client personal data, and private reviewer access details out of git.

| Field | Result |
| --- | --- |
| Test date and operator | Pending |
| Deployment commit and frontend/API revisions | Pending |
| App ID and Graph version | `1215220247221414` / `v25.0` (verify live before run) |
| Meta Business verification and Tech Provider Access Verification | Pending; confirm current state before review or production test |
| Business portfolio contact-email confirmation | Pending; record status only, not the address |
| Require App Secret Proof | Off in live Meta Advanced settings on 2026-09-24; recheck before the run |
| Client Facebook identity and accepted app role | Pending; role/email mapping unverified |
| Graph user ID and granted permissions | Pending; record in restricted evidence, not git |
| Client Business Portfolio and role | Pending |
| Client asset and assigned user role | Pending |
| Agency owner identity and Business Portfolio | Pending |
| Fresh request URL and expiry | Pending |
| Prior client-to-agency access absent before test | Pending |
| Client 2FA state | Pending; record status only, never credentials or codes |
| Business Login configuration and requested scopes | Pending |
| Actual granted scopes after consent | Pending |
| Independent clean-session reviewer and date | Pending |

## Local verification (not production acceptance)

On 2026-09-23, the uncommitted checkout at `1f27c9fa148ee3369f7340fb93a1590078f3e752` passed `npm run typecheck`, `npm run build`, and `npm run test`. The plan's API Meta focus passed 7 suites / 91 tests; Web Meta focus plus the business-creation race regression passed 6 suites / 39 tests; shared-contract tests passed 162 tests. The full workspace test also passed: web 199 files / 1,351 tests (2 skipped), shared 9 suites / 162 tests, and authhub-cli 7 tests; API workspace passed. This does not prove the deployed revisions, live Graph mutations, Meta review, or a non-role production flow.

On 2026-09-23, focused invite OAuth callback and ad-account sharing guide tests passed (6 tests). Successful code exchange replaces, not pushes, the callback history entry; provider denial gives a recoverable message without calling the code exchange API; manual ad-account instructions give a conditional next step when Meta requires two-factor authentication. AuthHub does not claim to detect or enforce two-factor status. This is local-only evidence; the production flow remains unverified.

On 2026-09-23, the Meta grant retry regression passed with the API Meta asset route suite (33 tests) and durable grant-service suite (5 tests); API typecheck passed. After a Meta assignment succeeds but its read-back times out, retry first checks the recipient assignment. It avoids a second mutation when Meta confirms access, and refuses another mutation when read-back is still unavailable. Existing grant time remains intact. This is local-only evidence; Meta Graph behavior remains unverified.

On 2026-09-23, the full Green Gate was rerun from the uncommitted checkout at `1f27c9f`: workspace typecheck, production build, and all workspace tests passed (API 153 files / 1,589 tests; Web 199 files / 1,352 tests with 2 skipped; shared 9 suites / 162 tests; CLI 7 tests). The build emitted the existing Sentry navigation-hook and stale Browserslist-data warnings. Tests also emitted React warnings. These checks do not prove production deployment or live Meta behavior.

On 2026-09-23, review-driven fixes added client-business ownership validation before manual ad-account verification, a timeout for Meta permission revocation, unique secret names for concurrent Meta reauthorization attempts, and a partial-status fallback if lifecycle recalculation fails. The three affected API suites passed (111 tests). The complete Green Gate then passed again: typecheck, production build, API 153 files / 1,592 passed and 19 skipped, Web 199 files / 1,352 passed and 2 skipped, shared 9 suites / 162 passed, and CLI 7 passed; `git diff --check` passed. This evidence is local only. Production rollout remains blocked on migration safety, and app review/production acceptance remain unverified.

On 2026-09-23, the complete Green Gate passed again after the bounded client-list loading fix: workspace typecheck, production build, and all tests passed. Web: 199 files, 1,356 passed and 2 skipped; shared: 9 suites, 162 passed; CLI: 1 test file, 7 passed; API workspace passed. `git diff --check` passed. The build retained the Sentry navigation-hook and stale Browserslist-data warnings; tests emitted existing React warnings. This checkout is still uncommitted and not deployed. These checks do not prove production loading behavior, live Graph operations, or Meta approval.

On 2026-09-23, all request-setup API calls now use the bounded authorized API client: client listing/creation, agency lookup, active agency connections, and Meta assignee discovery. A never-resolving Clerk token becomes a visible timeout; retry works for client listing and Meta assignees, while the agency lookup exposes a recoverable query error. The three focused component/hook suites passed (29 tests), Web typecheck and production build passed, and `git diff --check` passed. The build emitted the existing Sentry navigation-hook and stale Browserslist-data warnings. This is local-only and not deployed.

On 2026-09-23, both new Meta Prisma migrations were replayed against a fresh local PostgreSQL database. The first replay exposed the reserved alias `grant` in the recipient backfill; changing it to `g` allowed both migrations to complete. The success fixture verified the existing grant was backfilled to its destination business and the new table, indexes, and foreign keys were created. A second fixture with an unmatched destination failed at the intended `NOT NULL` check; the explicit transaction left no added columns and preserved the old index. These are disposable local database checks, not production data checks.

The Prisma deploy runner also applied both migrations successfully to a disposable database modeled on an existing schema. That simulation marked only the eight migrations present in this stale checkout as applied. It is not a production-equivalent baseline. A clean empty database did not bootstrap: the first historical migration failed because `subscriptions` did not exist. This repo has no initial schema migration.

Read-only Neon inspection on 2026-09-23 found 10 successful, non-rolled-back production migration records. The two production migrations missing from this checkout are `20260913090000_add_access_request_intake_responses` and `20260919180000_access_request_last_reminder_sent_at`; both exist on `origin/main`. This branch is 29 commits behind and 3 ahead of `origin/main`, with extensive dirty work and overlapping paths. Do not deploy from this checkout. Prepare a reconciled release baseline that includes all 10 production migrations, then verify that only the two new Meta migrations are pending. Do not run the deploy command against an empty or unbaselined database.

The manual Pixel/Dataset verification fix adds selected Dataset IDs to the verification request and validates those IDs against assets discovered in the saved client Business Portfolio. The route test reproduces verification before the selection is saved.

On 2026-09-23, reauthorization was also fixed to recalculate request status after old Meta grants become stale. A service test proves that a previously completed request becomes partial when its grants are stale; an OAuth route test proves initial authorization does not trigger recalculation, while reauthorization does. Local focused API tests passed (206 tests across 9 suites); Web Meta tests passed (36 tests across 7 suites); shared tests passed (162 tests across 9 suites). The complete `npm run typecheck && npm run build && npm run test` gate then passed from the uncommitted checkout. Web: 199 files, 1,352 passed, 2 skipped; shared: 9 suites, 162 passed; CLI: 7 passed. The Prisma schema passed `prisma validate` using a dummy local `DATABASE_URL`; no database connection was made. `git diff --check` passed. Existing Sentry, Browserslist, and React test warnings remain. These checks do not prove production deployment or live Meta behavior.

On 2026-09-23, `authorizedApiFetch` was changed so its 15-second deadline covers token acquisition, network fetch, and response parsing. The access-request client selector now uses this shared helper for its read path, so a stalled Clerk token request reaches the existing error and Retry state instead of spinning forever. Regression tests proved timeouts for token, fetch, and response parsing; a component test proved the selector exits loading and shows Retry. After review, the helper and client selector suites passed (26 tests), Web typecheck passed, and `git diff --check` passed. This is local-only; it is not deployed.

## Live UI diagnostic (not end-to-end acceptance)

On 2026-09-23, the production `/access-requests/new` page first showed `Failed to load clients`. The production Clients page then loaded its existing client, and the request page loaded that client after navigation back. Three subsequent full page reloads each showed the client with no loading or error state. No access request was created and no Meta action was run. This makes the prior failure transient in this session; it does not prove root cause or a fix. Keep the fresh-session invite check blocked until its full OAuth and fulfillment path passes.

The same-day read-only Meta recheck still showed Allowed usage at 0%, Reviewer instructions at 0%, Requests incomplete, and Renewal pending. App Roles still listed Jon High as sole Administrator; Test User Accounts had no rows. No form, app-role, or test-user change was made.

On 2026-09-23 at about 19:13 PDT, a fresh production visit to `/access-requests/new` and then `/clients` stayed on `Loading clients...` for several minutes. The browser console showed only a Clerk deprecation warning. Render read-only inspection identified the production API URL as `https://agency-access.onrender.com`; `/health` returned 200, an unauthenticated `/api/clients` request returned the expected 401, and Render logs later showed browser `OPTIONS /api/clients` 204 and authenticated `GET /api/clients` 200. After browser refresh, `/clients` showed the existing client and `/access-requests/new` showed the same client. No request was created and no Meta action ran. The service and API were healthy by then; the original delay's cause is still unproven. This current production replay is not end-to-end Meta acceptance.

## Read-only Meta dashboard check

Observed 2026-09-23 in App Review submission `1424442432965860` and App Roles for app `1215220247221414`:

- Verification, App settings, and Data handling showed 100%; Allowed usage and Reviewer instructions showed 0%. Submit for review was disabled.
- Allowed usage still required permission-specific screencasts for `pages_show_list`, `pages_read_engagement`, `business_management`, `ads_read`, and `ads_management`, plus remaining usage certifications. The UI said `pages_read_engagement` requires `pages_show_list`, and `ads_management` requires `pages_read_engagement`.
- API-test-call checklists appeared complete for Marketing API Access Tier and `pages_read_engagement`. This does not replace clean-session proof or screencasts.
- App Roles showed Jon High as the sole Administrator. The account menu showed a different email domain from `client-test-account`; it did not prove whether this is the same Facebook identity. Treat target-Gmail role mapping as unverified. Test User Accounts showed no users.
- Read-only recheck later on 2026-09-23 still showed the review at 0% for Allowed usage and Reviewer instructions, with Requests incomplete and Renewal pending. The app-role list still showed only Jon High as Administrator. The signed-in account email does not match the target Gmail domain, so the target account's role is not verified.
- No Meta form was edited, role changed, recording uploaded, or review submitted during this check.

### Live recheck — 2026-09-23 17:10 PDT

- App Review still showed Verification 100%, App settings 100%, Data handling 100%, Allowed usage 0%, and Reviewer instructions 0% for submission `1424442432965860`.
- All six Allowed usage items showed **Get started**: Marketing API Access Tier, `pages_read_engagement`, `pages_show_list`, `business_management`, `ads_read`, and `ads_management`. Each item still requires its described usage, and five items explicitly require a screencast. Marketing API Access Tier and `pages_read_engagement` also require API test-call confirmation. The dashboard states that `pages_read_engagement` requires `pages_show_list`, and `ads_management` requires `pages_read_engagement`.
- App Roles showed one row: Jon High, Administrator. The account menu identified `meta-profile-account`. This does not verify the `client-test-account` Facebook identity or its app role.
- Meta's official Ruby Business SDK exposes AdAccount `assigned_users` GET, POST, and DELETE operations with a user ID and tasks. Its Business SDK also exposes `client_ad_accounts` as a read edge. This confirms the API surface exists, not that this app's token, roles, cross-business recipient, and selected account satisfy Meta's live authorization rules. Verify POST plus exact read-back with a disposable ad account before treating automatic assignment as supported.
- This was read-only. No test-user row or client app role was verified. No Meta form, role, video, or submission was changed.

### Live recheck — 2026-09-23 17:23 PDT

- App Review again showed Verification, App settings, and Data handling at 100%; Allowed usage and Reviewer instructions remained at 0% for submission `1424442432965860`.
- Each of the six Allowed usage cards still showed **Get started**. Required screencasts remained listed for the five permission requests; Marketing API Access Tier and `pages_read_engagement` still listed API test calls. The dependency warnings remained: `pages_read_engagement` requires `pages_show_list`; `ads_management` requires `pages_read_engagement`.
- This confirms the review package has not advanced since the 17:10 check. No Meta form was opened or edited, and no role, video, or submission was changed.

### Live recheck — 2026-09-23 17:50 PDT

- App Review still showed Verification 100%, App settings 100%, Data handling 100%, Allowed usage 0%, and Reviewer instructions 0% for submission `1424442432965860`. Requests remained incomplete and Renewal remained pending.
- All six allowed-usage items still showed **Get started**: Marketing API Access Tier, `pages_read_engagement`, `pages_show_list`, `business_management`, `ads_read`, and `ads_management`. Meta still required permission-specific screencasts and showed the same permission dependencies.
- App Roles still showed only Jon High as Administrator. The logged-in Facebook account was `meta-profile-account`; this does not verify that `client-test-account` maps to an accepted app-role identity.
- The Account Center contact list for that signed-in Facebook identity did not include `client-test-account`. Do not treat the current Administrator role as proof for the target Gmail identity.
- This was read-only. No Meta role, form, recording, or submission was changed.

### Live recheck — 2026-09-23 18:36 PDT

- Submission `1424442432965860` still showed Verification 100%, App settings 100%, Data handling 100%, Allowed usage 0%, and Reviewer instructions 0%.
- Requests remained incomplete and Renewal remained pending. All six items still showed **Get started**: Marketing API Access Tier, `pages_read_engagement`, `pages_show_list`, `business_management`, `ads_read`, and `ads_management`. The page repeated the screencast requirements and the dependencies `pages_read_engagement` → `pages_show_list` and `ads_management` → `pages_read_engagement`.
- This was read-only. No Meta role, permission description, video, or submission was changed.

### Live recheck — 2026-09-23 19:10 PDT

- Submission `1424442432965860` showed Verification 100%, App settings 100%, Data handling 100%, Allowed usage 0%, and Reviewer instructions 0%.
- Requests remained incomplete and Renewal remained pending. All six items still showed **Get started**: Marketing API Access Tier, `pages_read_engagement`, `pages_show_list`, `business_management`, `ads_read`, and `ads_management`.
- The page still required screencasts for the five permission requests. It repeated that `pages_read_engagement` requires `pages_show_list` and `ads_management` requires `pages_read_engagement`.
- This was read-only. No Meta role, permission description, video, or submission was changed.

### Live identity recheck — 2026-09-23 19:40 PDT

- The Meta developer account currently signed in is Jon High (`meta-profile-account`). App Roles shows this account as the only app-role user and as Administrator.
- This does not establish that `client-test-account` is the same Facebook user or has an accepted app role. Do not treat Gmail ownership or a matching display name as role proof.
- No role was added or changed. The target Gmail's app-role status remains unresolved.

### Live App Review recheck — 2026-09-23 19:41 PDT

- Verification: 100%; App settings: 100%; Data handling: 100%; Allowed usage: 0%; Reviewer instructions: 0%.
- Requests remain incomplete and Renewal remains pending.
- All six allowed-usage items still show **Get started**: Marketing API Access Tier, `pages_read_engagement`, `pages_show_list`, `business_management`, `ads_read`, and `ads_management`. Meta still states that `pages_read_engagement` requires `pages_show_list`, and `ads_management` requires `pages_read_engagement`.
- This was read-only. No permission description, screencast, role, or submission was changed.

## Acceptance checks

For every check, record the sanitized result, exact asset ID, recipient identity, and a timestamp or test artifact. A failed or missing check blocks submission or release.

- [ ] Fresh production invite loads without an indefinite spinner or stale/expired callback.
- [ ] Client completes Meta login and consent; granted scopes match the permission matrix.
- [ ] Client selects exact assets; names and IDs remain stable through the result.
- [ ] Each automatic mutation is supported on v25.0 and has recipient-specific Meta read-back.
- [ ] Each manual path is labeled manual and remains unresolved until its own verification succeeds.
- [ ] Business Portfolio, human assignee, and system-user outcomes remain separate.
- [ ] Page validation produces a useful result for each selected Page without exposing a token.
- [ ] Partial failure, denial, safe retry, expiry, refresh, reauthorization, and revocation remain truthful.
- [ ] Agency owner opens the same assets in their own Meta session and can perform the intended task.
- [ ] No access existed before the test that could mask a failed grant.
- [ ] Logs, telemetry, screenshots, and videos contain no credentials, tokens, or unnecessary personal data.
- [ ] Green Gate passed against the deployment commit: `npm run typecheck && npm run build && npm run test`.
- [ ] Meta dashboard requirements, permission-specific videos, allowed usage, data handling, renewal items, and reviewer instructions are complete.
- [ ] After approval only: a client who is not an app-role user completes the same production flow.

## Graph receipt fields

For each operation, capture: Graph version, HTTP method, edge, token class (never token value), app role, client and agency business roles, asset role, required permission, requested task, sanitized response, recipient-side read-back, and visible AuthHub result. Record whether the operation was automatic or manual.

## Production migration checks

Before deploy, save the full set of existing `meta_asset_grants.id` values. A row count is not a safe migration baseline: valid recipient grants can be added while old and new instances overlap. After deploy, use the saved IDs to verify every pre-existing grant survived and was backfilled to its destination business. New rows do not affect this comparison. Save sanitized counts and migration state with the deployment receipt; do not expose client names or credentials.

These post-deploy checks are detection and acceptance checks, not a traffic gate. A read-only Render inspection recorded on 2026-09-24 found no pre-deploy command. The configured start command runs migrations before the new API starts, but the old instance remains live during zero-downtime deployment; the checks below run after the deployment can serve requests. At that checkpoint, recipient-grant traffic had not been ruled out, so the decision was **NO-GO**. See the refreshed migration preflight below.

```sql
SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::text[]) AS predeploy_grant_ids
FROM "meta_asset_grants";

SELECT to_regclass('public._prisma_migrations') AS migration_history_table;

SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260922073000_meta_fulfillment_recipients',
  '20260922100000_meta_asset_creation_idempotency'
)
ORDER BY migration_name;

SELECT COUNT(*) AS invalid_recipient_rows
FROM "meta_asset_grants"
WHERE "recipient_type" IS NULL OR "recipient_id" IS NULL;

WITH predeploy_ids AS (
  -- Replace with the exact ID array saved before deploy.
  SELECT unnest(ARRAY['<saved-id-1>', '<saved-id-2>']::text[]) AS id
)
SELECT
  COUNT(*) FILTER (WHERE g."id" IS NULL) AS missing_predeploy_grant_rows,
  COUNT(*) FILTER (
    WHERE g."id" IS NOT NULL
      AND (g."recipient_type" <> 'business' OR g."recipient_id" <> destination."business_id")
  ) AS invalid_backfilled_grants
FROM predeploy_ids AS baseline
LEFT JOIN "meta_asset_grants" AS g ON g."id" = baseline.id
LEFT JOIN "meta_agency_destinations" AS destination ON destination."id" = g."destination_id";

SELECT COUNT(*) AS mismatched_business_backfills
FROM "meta_asset_grants" AS g
JOIN "meta_agency_destinations" AS destination
  ON destination."id" = g."destination_id"
WHERE g."recipient_type" = 'business'
  AND g."recipient_id" <> destination."business_id";

SELECT indexname
FROM pg_indexes
WHERE tablename IN ('meta_asset_grants', 'meta_asset_creations')
  AND indexname IN (
    'meta_asset_grants_idempotency_key',
    'meta_asset_creations_access_request_id_idempotency_key_key',
    'meta_asset_creations_connection_id_asset_type_status_idx',
    'meta_asset_creations_authorization_id_idx'
  )
ORDER BY indexname;

SELECT conname
FROM pg_constraint
WHERE conrelid = 'meta_asset_creations'::regclass
  AND conname IN (
    'meta_asset_creations_access_request_id_fkey',
    'meta_asset_creations_connection_id_fkey',
    'meta_asset_creations_authorization_id_fkey'
  )
ORDER BY conname;
```

Expected before deploy: the reconciled release contains all 10 historical production migration files; production has all 10 historical migrations recorded as successful, with no failed or rolled-back row; only the two new Meta migrations are pending. Expected after deploy: both new migration rows have `finished_at` set and `rolled_back_at` null; missing pre-deploy grant rows, invalid backfills, and mismatched counts are zero; all four indexes and all three foreign keys are present. Stop acceptance if the baseline differs, any count is nonzero, or any constraint/index is missing. These checks do not prevent traffic; see the refreshed traffic assessment below.

The first migration adds recipient columns and replaces the Meta grant unique index. The last read-only Render inspection, recorded 2026-09-24, observed migrations in the start command, overlapping old and new instances, a Free service, and no pre-deploy command. Refresh these live facts before release. See [Render deploy steps](https://render.com/docs/deploys#zero-downtime-deploys) and [maintenance mode limits](https://render.com/docs/maintenance-mode).

Fresh source review on 2026-09-24 corrected the earlier expand/contract concern: live commit `a644f02` (current `origin/main`) has no `prisma.metaAssetGrant` or `prisma.metaAssetCreation` calls. The old API does not read or write either table during instance overlap. Its only shared-table change is to `platform_authorizations`; the new `authorization_epoch` column has database default `1`, so old inserts remain valid. The earlier claim that old grant writers need a temporary recipient trigger/default was unsupported; do not add expand/contract complexity on that basis.

At the 2026-09-24 checkpoint, the remaining DB checks were a fresh production baseline, backfill and index verification, a disposable lock test, and a clean release baseline with all 10 historical migrations. The refreshed results below address the pre-deploy checks. Recheck live Render settings before release; `render.yaml` alone is not proof of current configuration.

Read-only release analysis on 2026-09-24 confirmed that `origin/main` has 10 migration files while this branch's committed tree has 8; the two pending Meta migrations are dirty. Prior Neon evidence recorded 10 successful production migrations, but refresh that database baseline before release. This branch is 31 commits behind `origin/main`, 3 ahead, and has 186 dirty paths. Build a clean release baseline from `origin/main` and selectively reconcile only goal-owned changes. Do not deploy or apply database changes from this checkout.

## Identity mapping clarification — 2026-09-24

Jon confirms that `client-test-account` and the email on the signed-in Meta profile, `meta-profile-account`, refer to the same person. This resolves the identity question by user confirmation. It is not an independent Meta identity check. The live app-role page showed Jon High as the only Administrator and showed zero Testers. Still required: a fresh accepted-role OAuth run, 2FA and client-asset-control proof, a separate agency-owner identity, and recipient-side Graph read-back.

## Migration preflight — 2026-09-26 PT

The read-only Neon production check found 10 successful historical migrations, no failed migration, and neither pending Meta migration applied. The old grant index is present. There are **zero existing Meta grant rows**, so there is no recipient data to backfill or preserve at this baseline. Save a fresh grant ID baseline immediately before deployment in case this changes.

The deployed `main` commit was `20a30a4`. Its API has no Prisma or SQL writer for `meta_asset_grants` or `meta_asset_creations`. The live Render start command runs `prisma migrate deploy` before starting the new API. Thus the old instance cannot write the new grant tables during overlap, and the new instance cannot serve grant requests before migration completes. This is the table traffic gate for this release; it is an inference from the checked code and live configuration, and must be rechecked if either changes.

Both new SQL files passed a disposable PostgreSQL test based on the current `main` schema with 20,000 synthetic grants. The first migration took 0.59 seconds without contention and 3.34 seconds behind a reader that held a lock for 3 seconds. All 20,000 recipients and 10,000 verified authorization epochs were backfilled; all expected indexes and foreign keys were present. An orphan-destination fixture failed as intended and rolled back fully. The fixture is synthetic; the production baseline above is the authority for current row counts.

## Release decision

The migration preflight is **ready for the authorized merge**, subject to a fresh grant ID count and unchanged Render configuration. After deployment, run the post-deploy SQL checks above before calling production acceptance complete. App Review remains **NO-GO**: clean-session authorization and recipient-side access proof are incomplete. Meta approval and non-role production acceptance are separate gates.
