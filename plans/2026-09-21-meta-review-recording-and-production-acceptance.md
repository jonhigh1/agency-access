# Meta review recordings and production access acceptance

## Outcome

An authorized client uses AuthHub to select Meta assets and grant the intended agency access. The agency owner can then manage those exact assets in Meta. AuthHub verifies the actual grant and shows accurate per-asset results. App Review approval is a separate external decision; it is not proof that this flow works.

This plan updates the evidence and completion criteria in `2026-09-21-0850-meta-app-review-proof-plan.md`. It does not authorize changing the live submission during this review-only task.

## Status checked in the live dashboard on September 21, 2026

App: `1215220247221414`. Draft submission: `1424442432965860`.

| Area | Observed state |
|---|---|
| Verification | 100% in submission wizard |
| App settings | 100% in submission wizard |
| Allowed usage | 0%; requests incomplete |
| Data handling | 0% |
| Reviewer instructions | 0% |
| pages_read_engagement | API testing Completed; no recording selected; usage agreement unchecked |
| ads_management | API testing Completed; no recording selected; usage agreement unchecked |
| Marketing API Access Tier | Requirement reads at least 500 Marketing API calls, error rate below 15%, 85% success rate; currently Completed |
| Business Asset User Profile Access | Still included; no recording selected; reviewer asks for user profiles of people engaging with business assets |

The prior Page and ads-management rejection says the use case is allowed but the video fails to demonstrate the complete described experience. Meta requests full login, permission consent, actual use, English UI, explanatory captions, and disclosure of system-user/server-side operations.

This is a historical snapshot from September 21, 2026. The live wizard check on September 24 shows New requests for `pages_read_engagement`, `pages_show_list`, `business_management`, `ads_management`, and Marketing API Access Tier. `ads_read` and Business Asset User Profile Access are not in the current New requests. The renewal tab still requires inspection; do not assume `public_profile` or `email` are exempt.

The prior production Page-content check returned Graph error #10. That failure was observed earlier in this session, not replayed in this status review. The draft's rejection alone does not establish its cause. There is no evidence here that Page Public Content Access is a required fix.

## Contradictions to resolve before recording

1. Page notes say the app never reads posts, but the implemented proof feature reads Page content. Select the real useful operation, then make the UI, scopes, calls, recording and notes agree. Keep pages_read_engagement, including the dependency shown by Meta for ads_management. Do not add a feed viewer solely to satisfy review if it has no role in the product.
2. Marketing-tier notes pass an agency Business ID to assigned_users. The service requires a system-user identity. A business partner relationship, system-user asset assignment and human agency-owner access are different results. Prove each required result explicitly.
3. Ads-management notes promise automatic assignments and optional ad-account creation. Record only paths that are reachable and working in production. Remove creation claims if they are not part of the demonstrated flow.
4. Notes say client tokens are discarded after onboarding. Verify storage, retention and deletion in the actual implementation before repeating this claim.
5. Business Asset User Profile Access notes describe assigned users, while reviewer feedback requests profiles of people engaging with assets. Recommend removing this feature, consistent with the earlier plan. Do not build unrelated profile features for a recording.
6. A manual Business Settings grant cannot prove that AuthHub performed an API grant. Keep manual results truthful, but do not count that path as completion of the user's automation goal.

## Historical implementation audit — September 21, 2026

This section records the implementation state when this plan was first written. It is superseded by the current [permission matrix](../docs/app-review/meta/permission-matrix.md) and [production acceptance record](../docs/app-review/meta/production-acceptance.md); do not treat its old scope or endpoint notes as current.

The current product does not yet deliver the complete stated outcome.

- Client OAuth requests `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`, and `pages_show_list` in `apps/web/src/lib/meta-business-login.ts`.
- AuthHub exchanges the client credential for a long-lived token and stores it in Infisical. The current review copy saying the token is discarded after onboarding is inaccurate.
- The active UI sends only Pages through the automatic `/grant-meta-access` path. It uses the agency partner-admin system-user token, provisions a client-business system user, and assigns that system user to selected assets.
- That OBO path still calls `/{partnerBusinessId}/managed_businesses`. Prior Graph testing found this operation invalid. The automatic Page grant cannot be treated as recordable until the live operation is replaced or proved supported.
- Ad accounts use manual Assign Partner instructions in the active UI. AuthHub verifies the result afterward; it does not currently perform the ad-account partner grant automatically.
- Manual ad-account verification reads `owned_ad_accounts` but not `client_ad_accounts`. A successfully partner-shared client account can therefore remain falsely unresolved.
- A system-user assignment supports backend API operations. It does not assign the agency owner as a person or prove that the owner can open the account in Ads Manager. No current path assigns or verifies that human.
- Page proof uses the stored client user token to retrieve a Page token and then calls `/{pageId}/feed`. The Page token is not stored separately. This path has no `appsecret_proof`; check the app's Require App Secret Proof setting before deciding whether that is causal.
- AuthHub's privacy copy says tokens remain until revocation, while submission copy says they are discarded after onboarding. Direct Meta revocation can invalidate a credential without deleting the stored secret, and Infisical deletion is best-effort. Align implementation, privacy copy, and review claims.

Primary code surfaces: `AutomaticPagesGrant.tsx`, `PlatformAuthWizard.tsx`, `assets.routes.ts`, `meta-obo.service.ts`, `meta-partner.service.ts`, `client-assets.service.ts`, and `connectors/meta.ts`.

## Phase 1 — Prove the grant mechanism

Use two distinct, authorized Business Portfolios: a client portfolio that owns the assets and the recipient agency portfolio. Use a client admin and an agency owner. A same-portfolio test or an agency owner who already controls the client assets can produce a misleading success.

Create an endpoint contract for every intended operation: Graph version, method, edge, caller token type, required scopes, caller business role, asset ownership, recipient ID type, requested tasks and verification read. Validate it against current Meta documentation and a permitted test call. Public documentation retrieval was blocked during this audit, so endpoint eligibility remains a required execution check, not an established fact.

Trace and test separately:

- Client authorization to AuthHub.
- Client-business relationship with the recipient agency, where required.
- Asset sharing to the agency business.
- System-user assignment for backend access, if used.
- Assignment or access for the human agency owner who will use Ads Manager/Business Suite.

Use existing code where valid. Resolve any obsolete or unsupported API path at its source. Do not assume ads_management approval creates a business partnership or bypasses asset ownership requirements. If Meta restricts an operation to an unavailable program/access level, document that precise prerequisite and do not promise automation before it is available.

Pass condition: a new grant made through AuthHub appears on the client and recipient sides, with matching asset IDs and requested tasks, and the agency owner can open/manage the asset without using the client's session. No ad spend is needed to prove access.

Required repairs before that pass condition:

1. Replace or remove the invalid `managed_businesses` OBO call with a supported Meta business/asset-sharing operation.
2. Decide whether the product promise is agency Business Portfolio access, backend system-user access, named human access, or all three. For the stated goal, prove portfolio sharing plus the agency owner's existing role inside that recipient portfolio.
3. Make ad-account automation real if Meta permits it for this app and access tier. Otherwise describe and record the flow as manual partner sharing; do not use that recording to claim programmatic grant.
4. Verify partner-shared accounts through `client_ad_accounts` or an equivalent supported agency-access edge, not only `owned_ad_accounts`.
5. Keep Page and ad-account results separate. A successful Page system-user assignment must not mask an unresolved ad account.

## Phase 2 — Repair the Page check and rehearse production

Diagnose error #10 by inspecting sanitized token metadata: issuing app, token type, expiry, actual granted and granular scopes, selected Page targets, and the test person's app role and Page tasks. A checked consent option alone is insufficient. Compare the exact production call using the appropriate Page token and the supported edge for the selected data. Record only sanitized receipts; never expose tokens.

Establish the supported pre-approval testing setup with authorized app-role accounts and owned test assets. Do not assume advanced-access rejection prevents all development testing. If testing is still blocked, identify the precise provider requirement rather than adding Page Public Content Access by guesswork.

Then rehearse on authhub.co using a fresh, valid review request:

1. Agency configures the recipient portfolio and necessary backend access.
2. Agency creates a client access request.
3. Client opens the invite and completes Meta login and consent.
4. Client selects the business, Page and ad account.
5. AuthHub performs the retained Page operation and the actual access grant.
6. AuthHub verifies each result and shows complete, pending or failed accurately.
7. Agency owner opens the same assets in Meta from their own session.

Also check denied consent, partial failure, safe retry, request expiry and persistence after refresh. Verify cancellation separately if it is used to prepare recordings; it does not need to appear in every permission video.

## Phase 3 — Capture one full journey, export permission-specific videos

Record a continuous production master at readable desktop resolution (target 1080p), English UI, no unrelated tabs or notifications. Use legitimate test assets with non-sensitive sample content. Show login and consent without revealing passwords, OTPs or access tokens. Add brief captions explaining each operation and its benefit. Explain when backend system-user calls occur; show their real resulting UI states.

Each permission export must remain self-contained: entry point, full login/consent sequence, permission-specific operation and visible result. Reuse authentic footage where appropriate, but do not cut a failure into a success or imply independent recordings are a continuous transaction. Durations below are planning targets, not Meta limits.

| Recording | Target | Required scenes and proof |
|---|---|---|
| pages_show_list.mp4 | 2–3 min | Use a client who manages a Page but has no Business Portfolio. Show invite, Meta login and Page consent, `GET /me/accounts`, the actual Page list, and primary-Page selection before guided Business Portfolio creation. A Page list inside an existing portfolio is not proof of this permission. |
| pages_read_engagement.mp4 | 2–4 min | Invite; login and Page consent; select Page; perform the exact retained Page-content/metadata operation; show the real result and Page identity; explain how this supports Page management/onboarding. If showing posts, fetch successfully and update notes to say so. Selection alone is not proof. |
| business_management.mp4 | 3–5 min | Agency recipient setup; client login/consent; owned portfolio discovery; select assets; actual supported business/asset-sharing action; verified receiving agency and client-side result. Disclose backend system-user use. |
| ads_management.mp4 | 3–5 min | Login/consent; select client account; show AuthHub's `assigned_users` system-user mutation and exact read-back; then show Business Portfolio partner-sharing and human agency-owner access as separate outcomes. Label required Meta Business Settings steps as manual. Do not claim an automated partner mutation unless live v25.0 proof succeeds. |
| Marketing API Access Tier | Written/API usage evidence | This is not a permission. The current Meta wizard requests a use description and required API-call evidence but no screencast for this item. Do not generate calls only to raise the counter; recheck the live threshold immediately before submission. |
| public_profile / email renewal | Inspect renewal form | Complete the actual renewal requirements. Use login/account identity scenes only where the app genuinely retrieves and displays those fields. Do not assume a new separate video is required. |

For each retained permission create notes with: purpose, exact login path, preconditions, UI steps, endpoint and token class, returned fields or mutation, user benefit, video filename and measured timestamps. Fill timestamps only after watching the final exported file.

Do not create current-track videos for `ads_read` or Business Asset User Profile Access; neither is in the live New requests.

## Phase 4 — Upload and complete the submission

1. Rewrite stale descriptions using the verified endpoint contract and actual token lifecycle. Keep claims limited to the recorded production behavior.
2. Align requested review items, Login for Business configuration, requested scopes, backend calls and visible product features. Remove unsupported extra features through the authorized submission workflow.
3. Upload each video to its matching permission dialog. Wait for processing, confirm the attachment persists, and replay it. Save the truthful allowed-usage agreement for each retained item.
4. Complete data handling with verified processors, storage, retention/deletion practices and accurate responses. Do not infer organizational/legal facts from a code comment.
5. Supply a working review URL and reproducible reviewer access instructions. Resolve expiring/one-use links, account roles and 2FA access using Meta-supported reviewer methods; do not put secrets in the video or public repository.
6. Check renewal items, verification, app settings and the rolling Marketing API gate. Check privacy/deletion links and reviewer accessibility.
7. Run the exact reviewer instructions in a clean session. All requested items must have matching proof. Review the final package, submit under the existing authorized submission workflow, and capture Meta's resulting submission ID/status.

## Production acceptance after approval

Repeat onboarding with an authorized client account that is not an AuthHub app admin/developer/tester. Prove access from the agency owner's session. Verify only selected assets/tasks were granted, retries do not duplicate or overgrant access, failures remain explicit, and Meta-side removal is reflected on re-verification. Distinguish cancellation of an invite from revocation of already-granted Meta access.

Completion requires both Meta's decision and a working production grant flow. Neither a successful OAuth callback, an API-call count, a system-user assignment alone nor an uploaded video satisfies the business outcome.

## Evidence and handoff

Keep videos, sanitized API receipts, the permission matrix, final reviewer instructions and an upload checklist together in the review artifact folder chosen during execution. Keep credentials and private reviewer access details out of git. Record deployed frontend/API revisions and test date in the receipts. Preserve the existing dirty worktree; this planning task changes no implementation or live configuration.

Sources: live [submission](https://developers.facebook.com/apps/1215220247221414/app-review/submissions/?submission_id=1424442432965860&business_id=3808519629379919), its permission-specific reviewer feedback and requirements; current repository services and prior plan. Meta links presented by the form: [screen recordings](https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/), [permission dependencies](https://developers.facebook.com/docs/permissions#permission-dependencies), [Marketing API access](https://developers.facebook.com/docs/marketing-api/access). Public web retrieval of developer documentation failed during this audit; live form text is the verified review source.
