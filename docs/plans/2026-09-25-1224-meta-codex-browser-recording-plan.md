# Record AuthHub's four Meta App Review permission flows
Created: 2026-09-25

## Outcome

Create four separate, self-contained MP4 videos for draft submission `1424442432965860`: `pages_show_list`, `pages_read_engagement`, `business_management`, and `ads_management`. Each video shows a real AuthHub production flow in the Codex browser, from Meta login and consent through the permission-specific result. Attach each accepted video to its matching Meta review item, with notes that describe only what the video proves. Meta's approval remains its decision.

## What the live review asks for

On 2026-09-25 the [draft submission](https://developers.facebook.com/apps/1215220247221414/app-review/submissions/?submission_id=1424442432965860&business_id=3808519629379919) showed all four permission items at **Get started** and required an end-to-end screencast for each. It also required API test calls for `pages_read_engagement`, `business_management`, and `ads_management`. Marketing API Access Tier required written usage and API-call evidence, with no video shown in the wizard. Verification, App settings, and Data handling were at 100%; Allowed usage and Reviewer instructions were at 0%.

The [prior review feedback](https://developers.facebook.com/apps/1215220247221414/app-review/submissions/feedback/?submission_id=1410264624383641&business_id=3808519629379919) rejected the earlier videos because they did not show complete Meta login, the user granting the requested access, and the full use case. It asks for English UI, captions or tooltips that explain controls, and disclosure of server-to-server or system-user-token operations. These are the playback checks for every new video. The public screen-recording guide returned HTTP 429 during this planning pass; the live feedback is the verified source.

## Capture setup in the Codex browser

1. Keep AuthHub and Meta inside the **Codex in-app browser** for the user-facing flow. Put that browser on screen at a readable desktop size. Browser automation drives the visible UI; macOS screen recording captures it. The browser control tool provides screenshots but no video-recording command.
2. Record the full display with local FFmpeg AVFoundation screen device `2` (recheck the device index before each take). A five-second MP4 pilot on 2026-09-26 passed file and frame inspection at 3420×2214 and 15 fps. Use `-capture_cursor 1`, then check that Codex, the Meta login window, cursor, text, and browser transitions appear. The pilot also proved that other foreground apps can replace Codex in the capture; keep Codex in front and stop the take if focus changes. The macOS Screenshot toolbar remains a manual fallback. QuickTime control timed out in this session.
3. Use a clean browser session and a fresh, working AuthHub request for each final take. Start recording before the client opens the request. The client types any password and one-time code; remove or mask those values before upload while leaving the login step visible. Never show access tokens, app secrets, or private reviewer credentials.
4. Export a readable MP4. The installed local `ffmpeg` can convert the macOS recording and burn short English captions into the final file. Preserve the original capture until the MP4 has passed playback review. Targets of roughly 2–5 minutes per video are editing aims, not Meta limits.

## Fixture check before each take

- Confirm the production AuthHub deployment, live app ID and OAuth configuration match the draft. Check the exact scopes granted after consent. Local tests or unshipped changes are not production proof.
- Use a Facebook identity that can authorize this app before approval and controls the asset used in that take. Record the identity's app role, client business/Page role, and controlled asset in a restricted evidence record. Jon has confirmed his Gmail and Yahoo addresses refer to the same person; this does not replace the role and asset check.
- Use a separate agency recipient and check that the asset was not already accessible to it when a grant is the claim. For `pages_show_list`, obtain the special fixture: a Page manager with **no Business Portfolio**, so AuthHub calls `GET /me/accounts`. Do not use ordinary business-scoped Page selection as this proof.
- Open the fresh request from a clean session once without recording. If it expires, spins, skips consent, or fails the permission-specific action, keep the failure as diagnostic evidence, fix that path, and make a new final take. Do not wait for Meta approval merely because an authorized test run has not yet been tried.

## Four shot lists

| Video | Required AuthHub scenes after login and consent | Decisive visible result | What to avoid claiming |
| --- | --- | --- | --- |
| `pages_show_list.mp4` | Open a fresh request as the no-portfolio Page manager; show AuthHub's managed-Page discovery and primary-Page selection. | The managed Page's name and ID appear in AuthHub before guided Business Portfolio creation. Record the sanitized `GET /me/accounts` receipt. | A Page list read from an existing Business Portfolio is a different path. |
| `pages_read_engagement.mp4` | Select a controlled Page and use **Validate Page access**. | Show Page name/ID, managed tasks, linked Instagram account if present, and recent post dates from the real Page read. Record the sanitized Page-read receipt. | Do not claim post text, engager profiles, or agency asset sharing from this read. |
| `business_management.mp4` | Show the client's Business Portfolio list, select the named portfolio, and show its selected assets in AuthHub. | The returned portfolio and asset names/IDs remain visible through selection and the resulting request view. Record sanitized business and asset-read receipts. | Do not label a manual partner-sharing step as an automatic AuthHub API mutation. |
| `ads_management.mp4` | Show the selected ad account, intended system-user recipient and tasks, then run the AuthHub assignment and verification path. | Show the same ad-account ID and the Meta assignment read-back for that recipient and tasks. Show agency Business Portfolio and human-owner access separately if those outcomes are claimed. Record sanitized mutation and read-back receipts. | System-user assignment alone does not prove the human agency owner can manage the account. |

Each video starts with the AuthHub entry point and complete Meta login and consent sequence. Keep the permission's exact product operation and result in the same file. Caption any real backend or system-user-token step with its operation and token class, without showing the credential. The video may end after its specific read result; the data-read permissions do not need an invented access grant.

## Execution order

1. **Pilot capture:** prove the Codex browser and Meta login window are recordable and readable. Discard the pilot.
2. **Record the available business fixture first:** `business_management`, then `pages_read_engagement`, then `ads_management`. This discovers production failures early and reuses the same controlled business and assets where permitted; make a fresh request and consent sequence for each final file.
3. **Record `pages_show_list` with its separate no-portfolio Page-manager fixture.** If that identity or AuthHub branch does not exist, treat this one video as blocked and prepare the fixture. Continue work on the other three.
4. **Playback review each MP4:** a person who did not record it can identify the Meta login, consent, asset, action, returned result, and why that permission is needed. Check at normal playback speed, including captions and any redaction. A failed or partial result is diagnostic footage, never the final submission video.
5. **Match evidence to Meta:** write the actual endpoint, token class, asset ID, file name, and measured timestamps in the restricted evidence record. Align each permission's usage text and reviewer instructions with the final video. Upload to its matching **Get started** item, wait for processing, and confirm the attachment remains and plays. Check required API calls and the Marketing API tier separately. Submit only after all four uploads and reviewer instructions pass a clean replay.

## Recording done when

- Four distinct MP4 files exist, each with its own complete login, consent, feature operation, visible result, readable captions, and no exposed secrets.
- The real production result and a sanitized Graph receipt support every claim in each file.
- Each file is attached to the matching live permission item and replays there; reviewer instructions contain a working fresh request and exact video timestamps.
- Any missing fixture, failed Graph call, absent production UI, or unsafe release is recorded as a specific blocker and resolved before that video's final take. No video is represented as proof of a capability that AuthHub did not perform.

This recording plan uses the current [permission matrix](../app-review/meta/permission-matrix.md) and [reviewer instructions](../app-review/meta/reviewer-instructions.md) for product scope. The older `docs/plans/meta-app-review-remediation.md` is a historical snapshot with a different permission set.
