# Ticket 01 — Re-verify live Meta OAuth consent (CEO gate)

Automated tests assert AuthHub **builds** OAuth dialog URLs with Graph **v25.0** and sanitized `scope` query params. They do **not** prove what Meta renders in production (CDN, env vars, cached frontend bundles, or Meta dashboard Login-for-Business configs).

## When to run

Before merge/deploy for Meta App Review work, and after any change to Meta app settings, `META_*` env vars, or OAuth-related frontend/API deploy.

## Steps (production or staging that matches prod env)

1. Sign out of Facebook in a clean browser profile (or use a disposable test user).
2. Open a **fresh** client invite link from production/staging (not localhost unless that environment is the release candidate).
3. Start Meta connect from the invite (full redirect or popup — whichever the release uses).
4. On the Meta consent screen, confirm:
   - Dialog path shows Graph **v25.0** (URL or Meta UI version indicator when visible).
   - Requested permissions are exactly:
     - `ads_management`
     - `business_management`
     - `pages_read_engagement`
     - `pages_show_list`
   - **Not** present: `ads_read`, `catalog_management`, or extra permissions outside the four above.
5. Capture a screenshot for App Review evidence (no tokens in frame).
6. Optional cross-check: run `npx tsx scripts/verify-meta-config.ts` with production `META_APP_ID` / `META_APP_SECRET` from a secure shell (never commit secrets). Compare script output to the live dialog.

## Partial grant detection (engineering)

After exchange, AuthHub stores `grantedScopes`, `requiredOAuthScopes`, `missingOAuthScopes`, and `oauthScopesComplete` on Meta platform authorization metadata (from Meta `debug_token`). Invite flows can force re-consent when `oauthScopesComplete` is false.

## Fail criteria

- Dialog shows Graph version other than v25.0.
- Any scope outside the core four appears on the consent screen.
- Consent is driven by Login-for-Business **`config_id` only** with no explicit `scope` list in the authorization URL (inspect network → OAuth redirect URL before leaving AuthHub).

If any fail, stop release and fix OAuth URL construction or Meta app configuration before CEO merge.
