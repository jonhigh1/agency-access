# Meta screencast execution check — 2026-09-25

Status: **blocked before final capture**. No final MP4 was made or uploaded. No Meta consent was granted, no asset was assigned, and the review was not submitted.

## Live checks

- Draft `1424442432965860` still showed Allowed usage 0% and Reviewer instructions 0%. Each of `pages_show_list`, `pages_read_engagement`, `business_management`, and `ads_management` showed **Get started** and required an end-to-end screencast. Do not add catalog picker, catalog creation, or catalog grant scenes; `catalog_management` is not in this submission.
- Meta App Roles showed Jon High as Administrator. This alone does not prove the client asset role or a clean-session consent run.
- The production new-request page initially held at **Loading clients...**. The Clients page later loaded one existing client; returning to the request form then worked. The old invite from earlier testing ended at **This link is not working** or **Still working on it**.
- A new production request for the existing test client was created with Meta Ads and Meta Pages selected. The new invite loaded and reached the Meta connection step. Keep its private link in the AuthHub request success page, not this repository. No email was sent by the operator.
- Request setup displayed **Meta: Standard**, but the invite displayed **Meta Ads · Admin Access** and **Meta Pages · Admin Access**. The request success page also said the client would be connected when they finish **Google**. Both statements conflict with the selected Meta request and need correction before a reviewer video.
- The production OAuth page opened in the Codex browser as **Continue as Jon High?**. Its URL requested `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`, and `pages_show_list` on **v21.0**. The active review draft does not request `ads_read`. The local unshipped permission contract uses v25.0 and excludes `ads_read`; that local code is not production proof.
- The operator stopped before pressing **Continue**. The run therefore did not verify granted scopes, Page reads, business reads, ad-account assignment, recipient read-back, or human agency access.
- The public API health check returned HTTP 200. This does not prove the client-list or OAuth flow is healthy.
- The Codex browser control surface exposed still images but no video capture. Native control of the Codex app was denied, and QuickTime Player control timed out. A capture pilot that includes Meta login was not completed.

## Gate to resume

1. Release a verified production build whose Meta OAuth scopes and Graph version match the active review draft. Correct the Meta access-level and Google success copy, and confirm client-list loading does not stall. The current broad dirty checkout and migration state are not a safe release source; use the separate production release gates in `production-acceptance.md`.
2. From a fresh session, create a new request and verify Meta consent, the actual granted scopes, and each permission's exact product operation. For `ads_management`, verify the selected recipient and requested tasks with a separate Meta read-back; do not equate system-user access with agency-owner access.
3. Prove screen capture of the Codex browser, including the Meta login window, with a disposable pilot. Only then make the four final recordings. Redact credentials and tokens, replay each MP4, and attach each to its matching review item.

Do not upload a recording of this diagnostic run as permission proof.
