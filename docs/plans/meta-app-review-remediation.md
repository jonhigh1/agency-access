# Meta App Review Remediation Plan

> Historical snapshot, checked 2026-09-20. Do not use its permission keep/remove decisions or recording instructions as current guidance. The active product contract is `plans/2026-09-21-1807-feat-leadsie-meta-parity-plan.md`; the current submission evidence is in `docs/app-review/meta/`. Keep this file only for its dated rejection diagnosis and usage-counter history.

**Date:** 2026-09-15
**App:** AuthHub (App ID 1215220247221414)
**Submission reviewed:** 2026-09-05 17:45 HST (submission_id 1410264624383641)
**Result:** Approved: `public_profile`, `email`. Rejected: Marketing API Access Tier, Business Asset User Profile Access, `pages_show_list`, `catalog_management`, `business_management`, `ads_read`, `pages_read_engagement`, `ads_management`.

## Current verified state — 2026-09-20

- Business verification: **Verified**.
- Access verification: **Verified** as a Tech Provider.
- Meta Testing marks the Marketing API, Pages API, and Instagram API use cases **Testing complete**.
- Current API-call counts: `ads_management` 860, `ads_read` 789, `business_management` 660, and `pages_show_list` 159.
- On 2026-09-20, Graph API Explorer completed 501 additional successful `GET /act_350253281?fields=id,name,account_status,currency,timezone_name` request cycles. Each bounded batch ended with a valid response and no visible OAuth error.
- Meta says testing data can take up to 24 hours to appear. On 2026-09-20, the live Testing page changed to `Marketing API Access Tier — Completed`; the dashboard now confirms the tier gate passed.
- A new App Review draft exists as submission `1424442432965860` and currently contains only `Marketing API Access Tier`, `business_management`, `ads_read`, `ads_management`, and `pages_show_list`; it has not been submitted.
- Required Actions contains only the completed Data Use Checkup; no unresolved required action was visible.
- App settings have privacy policy, Terms of Service, data-deletion URL, app icon, category, site URL, and contact email `support@authhub.co`.
- Meta's Web testing setup has no value in the required "Where can we find the app?" field. Its saved instructions reference expired invite `https://authhub.co/invite/7710ef100c97`; the production API returns `REQUEST_EXPIRED` and the page stays on "Loading request."
- Saved testing instructions also contain stale claims: `pages_read_engagement`, `email`, `public_profile`, and Business Asset User Profile Access do not match the current Meta Ads review scope.
- Current resubmission scope: Marketing API Access Tier, `ads_management`, `ads_read`, `business_management`, and `pages_show_list`.
- Excluded from this resubmission: `catalog_management`, `pages_read_engagement`, and Business Asset User Profile Access because AuthHub does not have matching reviewable product surfaces.
- Adding items to the App Review draft and submitting the review require explicit approval.
- The production AuthHub fresh-request form currently remains on `Loading clients...` in the Codex browser, so a fresh non-expired review URL and production screencast are still blocked.

---

## 1. Root-Cause Analysis

Three distinct failure modes — not one. Fixing only the screencast will fail again.

### Cause A: Submission/code mismatch (affected `pages_show_list` and `catalog_management`)

The rejected submission requested permissions that did not match the client OAuth flow. The remediated client Meta Ads flow now requests:

```ts
scopes = ['ads_management', 'ads_read', 'business_management', 'pages_show_list'];
```

`pages_show_list` is required by the existing `/me/accounts` Page-selection flow and is now requested consistently across API, web, registry, and shared scope definitions. `catalog_management` and `pages_read_engagement` remain outside the Meta Ads flow.

### Cause B: Screencast didn't show retrieved data in the UI (kills everything else)

All six screencast rejections cite "fails to demonstrate the end-to-end experience." The reviewer note for Business Asset User Profile Access spells out the bar: *"user profile fields … being retrieved and displayed in your app … Keep the asset identity visible and demonstrate where this information appears in the UI. Annotating your screencast can help."*

Current code now provides reviewable proof:

- `MetaAssetSelector.tsx` returns selected business, ad-account, Page, and Instagram names.
- `PlatformAuthWizard.tsx` displays selected asset names on the completion screen, not only counts.
- `/client/:token/grant-meta-access` assigns the agency system user to each selected Page and ad account, verifies the assigned tasks through Meta, and stores per-asset status.
- No new Meta review screencast artifact is verified. The existing capture helper targets a mocked evidence harness, not the production OAuth flow required by Meta. Captions, annotations, and production playback evidence remain outstanding.

### Cause C: Prior Ads API usage was insufficient for Marketing API Access Tier

The rejected tier decision was usage-based. The live Testing page now marks Marketing API Access Tier `Completed`, and the use case is `Testing complete`. The remaining work is to add the tier to the new review draft and provide accurate review evidence.

### Bonus finding: `Business Asset User Profile Access` should never have been requested

That feature grants access to name/photo of **people who engage with a business's assets** (commenters, messengers). AuthHub has no engagement surface and no code path touching those users. It is unapprovable for this product and must be dropped.

---

## 2. Permission Decision Table

Principle: request only what a UI screen demonstrably displays. Every kept permission needs a screencast scene; every dropped permission comes off the OAuth scope list too (parity between code and submission is mandatory — reviewers see the consent screen).

| Permission | Verdict | Rationale |
|---|---|---|
| `public_profile`, `email` | ✅ Already approved | No action. |
| `business_management` | ✅ **Keep** | Strong surface: business fetch (`meta.ts:311-470`), business picker in wizard. Scene: businesses listed and selected by name. |
| `ads_read` | ✅ **Keep** | Ad account listing exists. Strengthen: connection detail shows ad account name/ID/currency/status. Scene: accounts retrieved and displayed. |
| `ads_management` | ✅ **Keep** | AuthHub uses it to assign and verify the agency system user's access to selected client ad accounts. The review video must show the selected account and verified grant result. |
| `pages_read_engagement` | ❌ **Drop** | Nothing in the Meta Ads UI displays Page content or engagement. Re-request only with a matching product surface. |
| `pages_show_list` | ✅ **Keep** | Required by the existing `/me/accounts` Page-selection flow. Current OAuth scope definitions and tests now include it. |
| `catalog_management` | ❌ **Drop** (unless catalogs are on the roadmap now) | Connector lists/creates catalogs (`meta.ts:566-590, 786-841`) but no UI surface displays them. An unshown permission is an unapprovable permission. Re-request when catalog selection ships in the wizard. |
| Business Asset User Profile Access | ❌ **Drop** | No engagement surface exists. Unapprovable. |
| Marketing API Access Tier | 🔁 **Separate track** | Usage-gated; see Track B. |

Net submission: Marketing API Access Tier, `business_management`, `ads_read`, `ads_management`, and `pages_show_list`.

---

## 3. Track A — Permission Re-Review

### Step A1: Scope parity cleanup (code)

1. Completed: API, web, registry, connector, and shared definitions request `ads_management`, `ads_read`, `business_management`, and `pages_show_list`.
2. Completed: removed the invalid `/managed_businesses` endpoint from business discovery after live v21.0 and v25.0 calls returned `(#100) Tried accessing nonexisting field (managed_businesses)`.
3. Completed checks: 148 API test files / 1,435 tests passed (19 skipped), the 11-file Meta-focused API subset / 108 tests passed, API typecheck, API/web/shared typechecks, the production build gate, and `git diff --check`.
4. The scope-parity repair is merged to `origin/main`; production deployment and live-flow parity are still unverified. Do not record the review video until the deployed flow is checked.

### Step A2: Verify every kept permission in the production UI

1. Show the selected Business Portfolio, ad-account name, Page name, and IDs during asset selection.
2. Show the same selected asset names on the completion screen.
3. Run the existing Meta grant step so AuthHub assigns the agency system user to the selected assets and verifies the granted tasks.
4. Do not build an unrelated campaign-management feature for review. The product's real management action is the verified agency-access grant.

### Step A3: Record the screencast

One continuous annotated video, 1080p, ~4–6 min, English UI, captions throughout:

1. **(0:00) Complete Meta login** — start logged out. Email → password → 2FA → logged in. Do not start mid-session; the checklist explicitly requires the full login flow.
2. **(0:45) Consent** — click "Connect with Meta" on the agency's access-request link. Full-screen the dialog. Annotate each permission line: "`ads_read` — lets AuthHub read and display the selected ad account's identity and metadata" etc. Click OK.
3. **(1:30) Asset selection** — AuthHub fetches and displays: businesses (annotate "`business_management`"), ad accounts with names/IDs (annotate "`ads_read`"), page names/photos if in scope. Client selects real assets.
4. **(3:00) Management proof** (`ads_management`) — submit the existing agency-access grant for the selected ad account; show the verified result and keep the ad-account identity visible.
5. **(4:00) Agency side** — show the completed request with the same selected asset identities and verified access status.
6. **(5:00) End card** — table: permission → timestamp → where it appears in the UI.

Recording rules: English app UI, no browser extensions visible, real (non-test) data where possible, cursor deliberate and slow, annotations calling out every button meaning (per the Screen Recording Guide).

### Step A4: Submission notes

- Rewrite notes to mirror the video section-by-section **with timestamps**.
- Explicitly state: "This is a browser-based web app; the frontend Meta login flow is visible in the screencast" (preempts the server-to-server question).
- One sentence per permission: what the user grants → what AuthHub retrieves → where the agency sees it.
- Create a fresh review-only access request and verify that it loads before placing its URL in "Where can we find the app?"
- Replace the stale saved instructions. Do not mention `catalog_management`, `pages_read_engagement`, Business Asset User Profile Access, `email`, or `public_profile` as part of this Meta Ads flow.
- Add `support@authhub.co` as the app contact email after explicit approval.
- Confirm before submitting: privacy policy URL, data deletion instructions/URL, business verification status, Data Use Check, app category/icon all current. Required Actions showed no unresolved item on 2026-09-20.
- Only submit when every item above is verifiably done. Repeated rejections harden review; do not spend this attempt on "close enough."

### Step A5: Screencast acceptance plan

The goal is not to produce a persuasive demo. The goal is to leave no reviewer inference between the requested permission, the Meta response, and the visible AuthHub result. A reviewer must be able to pause any scene and identify the asset, action, permission, and result.

#### Recording artifact

- Produce one continuous master screencast, 1080p, 16:9, 4–6 minutes, in English.
- Start from a clean logged-out browser profile. Use a Meta test user or approved non-production account with stable access to the selected Business Portfolio, ad account, and Page.
- Record the production deployment and the fresh review-only AuthHub request. Do not use `/dev`, preview data, mocked fetch responses, Graph API Explorer as a substitute for the product UI, or an expired invite.
- Keep the selected asset name and ID visible whenever a permission is being proven. Blur unrelated personal data, tokens, passwords, 2FA codes, and browser-extension UI.
- Add burned-in captions and short on-screen labels. A written submission note alone does not satisfy the reviewer instruction.

#### Scene and proof matrix

| Time | Reviewer-visible scene | Proof that must remain on screen | Permission / feature |
|---|---|---|---|
| 0:00–0:45 | Full Meta login from logged out state, including consent and the user granting access | Meta account, consent dialog, and the Connect/Continue action; caption that this is frontend browser OAuth | All kept permissions |
| 0:45–1:30 | AuthHub receives the grant and opens asset selection | Business Portfolio name and ID returned by AuthHub | `business_management` |
| 1:30–2:15 | Ad-account list loads and one account is selected | Account name, ID, status, and currency; caption that AuthHub reads this identity/metadata | `ads_read` |
| 2:15–2:45 | Page list loads and one Page is selected | Page name and ID; caption that AuthHub lists Pages the user manages | `pages_show_list` |
| 2:45–4:15 | AuthHub submits the existing Meta agency-access grant for the selected assets | Same asset names/IDs, assignment action, returned task/role, and successful verification result | `ads_management` |
| 4:15–5:15 | Completion and agency-side request views | Same selected Business Portfolio, ad account, and Page identities plus verified access status | End-to-end product proof |
| 5:15–5:45 | End card and reviewer map | Permission → timestamp → exact UI location → returned data/action | Review navigation |

#### Permission boundaries

- Do not include `Business Asset User Profile Access` in the draft or video. The reviewer asked for profile fields of people engaging with a business asset; AuthHub does not have that product surface. Showing the agency admin's profile would prove the wrong use case.
- Do not include `catalog_management` or `pages_read_engagement`. Do not add scenes that imply those permissions are used.
- Do not claim `ads_read` retrieves campaign performance unless the production UI visibly displays it. The current proof target is ad-account identity and metadata.
- Do not claim `ads_management` from a button labeled “Connect.” Show the actual assignment and verification result for the selected asset.
- Do not record request cancellation. It is not part of the reviewed Meta permission use case.

#### Pre-record gate

Do not record if any item fails:

1. `origin/main` is deployed to the production URL used in the review instructions.
2. A fresh review-only access request opens without `REQUEST_EXPIRED` and remains valid for the full recording.
3. The production consent scopes exactly match `ads_management`, `ads_read`, `business_management`, and `pages_show_list`; no dropped scope appears in the dialog or saved instructions.
4. The test user can complete Meta login, select one real Business Portfolio, one ad account, and one Page, and reach the grant-completion screen.
5. The same asset names and IDs appear in selection, grant verification, completion, and the agency-side request view.
6. The Marketing API Access Tier still shows `Completed`; capture a dashboard screenshot or export as separate evidence. Do not use the screencast to imply that a counter proves permission approval.

#### Playback gate

Before submission, a second person or a fresh playback pass must verify:

- no scene starts after login or consent;
- every requested permission has one visible proof scene;
- captions are readable at normal playback speed and name the button meaning;
- asset identity never disappears during the relevant action;
- the final screen makes clear what AuthHub retrieved and what it changed;
- the fresh review URL and the video both work in a logged-out browser;
- the timestamped notes use the same permission names and order as the video.

#### Submission gate

Only after the pre-record and playback gates pass should the reviewer-facing draft be filled. Use the same master video for the kept permissions where Meta permits reuse, replace the expired testing instructions, add the fresh review URL, attach the Marketing API tier evidence, and request explicit approval before submitting. No plan can guarantee Meta's decision, but this gate directly addresses every rejection reason and prevents submission when the evidence is incomplete.

Draft replacement testing instructions after a fresh review URL exists:

1. Open the review URL supplied in "Where can we find the app?"
2. Enter a company website and continue to the Meta Ads access step.
3. Select "Connect Meta" and complete the full Meta login and consent flow.
4. AuthHub lists the user's Business Portfolios, ad accounts, and Pages. The video keeps each selected asset name and ID visible.
5. Select an ad account and Page, then continue. AuthHub assigns and verifies the agency system user's requested tasks for those assets.
6. The completion screen shows the selected asset names and verified grant status.

Permission mapping:

- `business_management`: list Business Portfolios and portfolio-owned assets.
- `ads_read`: read and display ad-account identity and metadata during selection.
- `ads_management`: assign and verify agency system-user access to the selected ad account.
- `pages_show_list`: list Pages that the user manages for the Page-selection and zero-portfolio setup flow.

---

## 4. Track B — Marketing API Standard Access Tier

Usage-gated. Meta's requirement popover states: at least 500 Marketing API calls with an error rate below 15%.

### Step B1: Add the tier to the review draft

- Current visible counts: `ads_management` 860, `ads_read` 789, and `business_management` 660.
- Completed 501 additional valid Marketing API calls on 2026-09-20. Meta now reports Marketing API Access Tier `Completed`.
- Meta marks the Marketing API use case Testing complete.
- Add Marketing API Access Tier to the new draft only after the tier counter confirms the requirement and explicit approval is received.

### Step B2: Submit evidence

- State the production context: agencies use AuthHub to retrieve and manage client-authorized business and ad-account assets.
- Include current successful-call evidence and the tested endpoints.
- Do not claim approval until Meta's review status changes to approved.

---

## 5. Timeline

| Window | Work |
|---|---|
| Now | Finish the pre-record gate and obtain approval to add the five current-scope items to the App Review draft. |
| Next | Verify the scope-parity repair on the deployed production flow before recording. |
| After deploy | Record and annotate one complete production OAuth and asset-selection flow. |
| Final | Complete reviewer notes, verify every item, then obtain explicit approval to submit. |
| Buffer | Review turnaround is typically 3–7 days per submission. |

---

## 6. Decision Points for Jon

1. Confirm adding the five current-scope items to the App Review draft.
2. Approve commit, push, and production deployment of the tested scope-parity repair.
3. Record the production screencast before the final submission.

---

## 7. Risks

- **Another blanket rejection** if the screencast skips even one beat (login, consent, data-in-UI). Mitigation: the scene checklist above is the reviewer's own bullet list, in order.
- **Consent-screen drift**: if Meta's Business Login config (`META_LOGIN_FOR_BUSINESS_CONFIG_ID`) injects different scopes than the explicit scope list for agency login vs client login, the screencast consent won't match the submission. Verify both flows during recording.
- **Review back-and-forth latency** is outside our control; the tier clock and permission review run in parallel to absorb it.
