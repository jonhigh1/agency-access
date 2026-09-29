# Meta reviewer instructions

Status: **blocked draft; do not submit yet**. This file is not a working reviewer path. The production URL, accepted client role, and successful end-to-end proof are not confirmed.

## Before review

The review owner must replace every bracketed field below only after a clean production replay. Do not put passwords, one-time codes, access tokens, or private credentials in this repository. Use Meta-supported reviewer access for any account the reviewer must use.

- App: AuthHub (`1215220247221414`)
- Graph API version: `v25.0`
- Fresh production request: `[INSERT tested, reachable request URL]`
- Test client identity and accepted app role: `[INSERT verified identity and role; no password]`
- Client Business Portfolio and assets: `[INSERT non-sensitive names and IDs used in recording]`
- Agency Business Portfolio: `[INSERT non-sensitive name and ID]`
- Recording package: `[INSERT filenames after final frame-by-frame review]`

If any value is unknown, the invite fails, Meta consent is unavailable, an asset was already shared with the agency, or a result depends on a mock, stop. Do not submit.

## Replay each permission video

Use a fresh browser session and a fresh request for each video. Keep the full sequence in view: AuthHub entry, Meta login and consent, exact asset selection, the permission-specific production operation, visible outcome, and separate agency-side verification. Explain any backend operation and token class in captions. Never show secrets.

1. Open the fresh request URL above.
2. Complete Meta login and consent as the client test identity. Show the permission prompt and the choices granted.
3. Follow the permission-specific path: for `pages_show_list`, show the managed Page before Business Portfolio creation; for other operations, select the named Business Portfolio and exact Page or ad account. Keep each asset name and ID visible in AuthHub.
4. Perform only the operation listed for that permission in `permission-matrix.md`.
5. Show the result in AuthHub. Distinguish `verified`, `manual action required`, `blocked`, and partial outcomes. Instructions or asset discovery alone are not proof of a grant.
6. Open the agency-side Meta session separately. Show that the intended recipient can access the same asset and requested tasks.
7. Replay the matching sanitized Graph receipt and timestamp from `production-acceptance.md`.

In the submission notes, explicitly identify any server-to-server operation or use of a system-user token. The previous reviewer asked for this disclosure when the frontend Meta login does not show that backend step. The video caption must name the operation and token class without exposing a token.

For each test, record the client app role, business role, asset role, 2FA status, Business Login configuration, Graph user ID, and actual granted permissions. Keep identity details in a restricted evidence record, not this repository. Never record passwords, 2FA codes, or access tokens. Before upload, ask a reviewer who did not record the video to follow the instructions from a clean session and confirm the visible asset, operation, read-back, and agency result.

Do not combine separate permission videos into a single implied transaction. Do not describe a manual Meta Business Settings action as an AuthHub API mutation. Do not claim that system-user access proves the agency owner's human access.

## Permission-specific paths

- `pages_show_list`: Use a client identity that manages a Page but has no Business Portfolio. AuthHub calls `GET /me/accounts` only in this zero-portfolio setup path. Show the Page list and primary-Page selection before guided Business Portfolio creation. A Page list inside an existing portfolio does not prove this permission.
- `pages_read_engagement`: Select a Page and run **Validate Page access**. Show the Page-token operation and returned Page metadata, tasks, linked Instagram account if present, and recent public post dates. Do not show post text or the Page token.
- `business_management`: Show Business Portfolio discovery and business-scoped asset selection. Keep this distinct from the zero-portfolio `/me/accounts` check. Label partner sharing as manual wherever AuthHub requires a Meta UI step.
- `ads_management`: Show the selected asset, system-user ID, requested tasks, and Meta read-back. Then show agency Business Portfolio sharing and the human agency owner's access as separate outcomes. Label any manual Meta Business Settings step; do not present it as an API mutation.
- Marketing API Access Tier is not a permission. The current Meta wizard asks for a use description and API-call evidence, not a screencast for this item. Do not create a separate video unless the live wizard changes.

## Permissions not in the current submission

Do not request, demonstrate, or imply `catalog_management` in this App Review package. Product catalogs are deferred to a later review track after catalog selection, creation, sharing, and read-back are complete end to end. The default client invite flow does not offer catalog selection unless an agency explicitly enables catalogs in Meta connection settings (that path is off for the current review). Do not record catalog creation, catalog grant, or catalog picker scenes for the active permission set.

## Historical feedback not in current scope

The earlier `Business Asset User Profile Access` request was rejected. Meta asked for a video that retrieves and displays an engaging person's profile fields, such as name or photo, while keeping the business asset identity visible. This feature is not in the current New requests. Do not add profile collection or request that access to improve the current submission. Revisit only if the product later has a real, approved use case and the permission is explicitly added to the live review scope.

## Current stop conditions

- App Review draft remains `Not submitted`.
- No production URL or accepted client identity has been recorded here.
- No fresh, two-identity grant and recipient-side usability proof is attached.
- No final videos or timestamps are attached.

These conditions must be cleared before this file can serve as reviewer instructions.
