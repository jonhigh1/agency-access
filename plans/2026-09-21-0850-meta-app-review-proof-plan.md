---
title: "Meta App Review proof and access-flow remediation"
type: plan
date: 2026-09-21
---

# Meta App Review proof and access-flow remediation

> Superseded by `plans/2026-09-21-1807-feat-leadsie-meta-parity-plan.md`, which expands this core-review plan to full Leadsie Meta parity.

## Goal Capsule

Get AuthHub ready for a new Meta App Review submission for the real agency client-access flow.

The submission must prove, in the production web app, that AuthHub:

1. authenticates the client with Meta;
2. lists the client’s eligible business assets;
3. lets the client select the assets to share;
4. grants or clearly guides the remaining manual grant steps;
5. verifies the resulting agency access; and
6. uses each requested permission in a visible, truthful product operation.

The plan keeps `pages_read_engagement` because that is the confirmed product decision. It treats that permission as a hard evidence gate: the implementation must identify, call, and display a real Page-content, metadata, or engagement operation that requires it. If the current Graph API or Meta review rules make that operation unavailable, the review submission must stop rather than present Page selection as proof for this permission.

## Product Contract

### Product promise

AuthHub gives an agency a guided client link for receiving access to selected Meta assets. The client should not share a password. The client should see which business, Page, ad account, and connected Instagram asset they selected. AuthHub should report whether access was granted, pending, manual, or blocked.

### Confirmed permission decisions

| Capability | Decision | Product proof required |
|---|---|---|
| `public_profile`, `email` | Already approved | No new review proof. |
| `business_management` | Keep | Business Portfolio discovery and selection. |
| `ads_read` | Keep | Ad-account identity and read-only metadata displayed in the asset selector or review result. |
| `ads_management` | Keep | Selected ad account plus verified agency grant/tasks. |
| `pages_show_list` | Keep | Page listing and Page selection. |
| `pages_read_engagement` | Keep, with a hard gate | A real Page operation that reads content, metadata, or engagement and displays the result in AuthHub. |
| Marketing API Access Tier | Keep as a separate usage gate | Current Testing and usage evidence verified before submission. |
| Business Asset User Profile Access | Exclude | No AuthHub surface displays people who engage with a business asset. |
| `catalog_management` | Exclude from this submission | No catalog selection or display surface is in the confirmed flow. Revisit only when that surface exists. |
| Instagram-specific review scope | Exclude from this recording | Connected Instagram may remain visible as a selected asset, but do not claim a separate Instagram permission without a separate use case and proof. |

### Leadsie comparison

Leadsie is a useful UX comparator, not permission authority. Its documented flow focuses on delegation: Business Portfolios, Pages, Instagram connected through Pages, ad accounts, catalogues, pixels/datasets, and Leads access. Its public product documentation does not show an engagement-metadata screen. Its support documentation nevertheless describes a Page endpoint that can require `pages_read_engagement`, Page Public Content Access, or Page Public Metadata Access.

Therefore AuthHub may copy the narrow delegation shape, but it cannot use the Leadsie UI as evidence that `pages_read_engagement` is unused. AuthHub must prove its own endpoint and visible product result.

## Planning Contract

- This is a deep implementation plan. Do not implement from this document without a separate execution decision.
- Inspect current live production behavior before changing code. The browser state, an old plan, or a successful test is not proof of deployment or Meta approval.
- Preserve unrelated dirty work. Stage only files owned by an implementation unit.
- Do not add a compatibility fallback for an invalid Graph endpoint. Validate the current Graph API version and remove or replace obsolete calls at their shared source.
- Do not record or submit a screencast while any review URL shows `Loading request`, `Loading clients`, an indefinite spinner, a misleading success state, or a failed OBO grant.
- Do not submit the Meta review or change production configuration without explicit approval.
- Apply `apps/web/DESIGN_SYSTEM.md` to any UI change: truthful status, accessible loading/error states, square controls, and no decorative review-only surface that is not part of the product.

## Implementation Units

### U1. Establish the permission-to-operation contract

**Intent:** Remove ambiguity between requested scopes, Graph calls, displayed data, and review claims.

**Inspect and update:**

- `apps/api/src/services/connectors/meta.ts`
- `apps/api/src/services/connectors/registry.config.ts`
- `apps/api/src/routes/client-auth/oauth-state.routes.ts`
- `apps/web/src/lib/meta-business-login.ts`
- `packages/shared/src/types.ts`
- related Meta scope and connector tests

**Work:**

1. Inventory every Meta scope sent by the client OAuth flow and every scope named in the App Review draft.
2. Map each retained scope to one concrete Graph operation and one visible AuthHub result.
3. Validate the exact `pages_read_engagement` operation against the current Graph API version with a fresh, correctly scoped Page token. Record the request, response shape, token type, Page identity, and required Meta feature or review state.
4. Choose the smallest real Page proof surface. It may be Page content, Page metadata, or Page engagement data, but it must be an operation that actually needs the retained permission and is useful to the product.
5. If the operation fails because the app lacks a separate Meta feature or because the permission is no longer sufficient, mark the submission blocked and document the required Meta feature. Do not claim that Page selection proves this permission.
6. Keep `pages_show_list` separate. Its proof is the existing Page-listing and selection operation, not Page content access.

**Acceptance criteria:**

- A review matrix names one operation, UI location, and screencast timestamp for every retained permission.
- `pages_read_engagement` has a live successful response and a planned visible result, or the plan records a blocking Meta prerequisite.
- No excluded permission remains in the client consent scope or review notes.
- The matrix uses the same Graph API version as production.

### U2. Repair and verify the production client flow

**Intent:** Make the review URL usable from a clean browser session.

**Inspect and update if required:**

- `apps/web/src/components/client-auth/PlatformAuthWizard.tsx`
- `apps/web/src/components/client-auth/MetaAssetSelector.tsx`
- `apps/web/src/components/client-auth/AutomaticPagesGrant.tsx`
- `apps/web/src/components/client-auth/AdAccountSharingInstructions.tsx`
- `apps/api/src/routes/client-auth/assets.routes.ts`
- `apps/api/src/services/client-assets.service.ts`

**Work:**

1. Use a fresh review-only access request. Confirm the request loads without a stale or expired request identifier.
2. Confirm the new-request page loads its client list and does not remain on `Loading clients...`.
3. Confirm Meta login has a bounded popup timeout and a redirect fallback. Errors must render an actionable state.
4. Confirm the selector displays business, Page, ad-account, and connected Instagram identities, not only counts.
5. Confirm the selected Page operation from U1 is visible in the client flow or completion detail without hiding the asset identity.
6. Keep manual ad-account sharing explicit. A pending manual grant must not be presented as completed access.
7. Confirm cancel and other request mutations have bounded client behavior and truthful final state if they are part of the review request lifecycle. Do not leave a spinner after the server has returned an error or timeout.

**Acceptance criteria:**

- A new production request loads in a clean browser with no console error that affects the flow.
- Meta login, consent, asset selection, Page proof, grant attempt, and completion status all render.
- Loading, pending, failed, and complete states are distinct and accessible.
- The same asset names and IDs remain visible across selection and completion.

### U3. Complete Meta OBO and grant verification

**Intent:** Make the agency-side grant path work, or expose a precise blocking state before recording.

**Inspect and update if required:**

- `apps/api/src/services/meta-assets.service.ts`
- `apps/api/src/routes/agency-platforms/assets.routes.ts`
- `apps/api/src/routes/client-auth/grant-meta-access.routes.ts` or its current route location
- `apps/api/src/services/connectors/meta.ts`
- `apps/web/src/components/meta-unified-settings.tsx`
- `apps/web/src/components/meta-business-portfolio-selector.tsx`

**Work:**

1. Verify that the agency has selected the correct Meta Business Portfolio.
2. Verify OBO setup creates or retrieves the partner-admin system user and token required for grants.
3. Verify secrets and token references resolve in the deployed environment without exposing credentials in logs or UI.
4. Run a real selected-Page and selected-ad-account grant through the client request.
5. Verify assigned tasks through Meta after the grant, with idempotent behavior on retry.
6. Return a truthful per-asset result when automatic Page grant is blocked or ad-account sharing remains manual.
7. Keep the agency setup error actionable: missing OBO setup must point to the setup action, not spin indefinitely.

**Acceptance criteria:**

- The live flow no longer ends with “Agency must complete their Meta OBO setup” when setup is complete.
- Automatic Page grant and ad-account grant verification have separate results.
- Retry does not duplicate grants or overwrite a successful result with a transient failure.
- Tokens and secrets never appear in browser output, API responses, or recordings.

### U4. Add the smallest reviewable Page proof surface

**Intent:** Make `pages_read_engagement` honest and reviewable.

**Work:**

1. Reuse the existing client-auth asset and status components where possible.
2. Add only the result needed to show the operation from U1. Do not build a general analytics dashboard.
3. Display the Page name and ID next to the returned content, metadata, or engagement result.
4. Display an empty result, denied permission, expired token, and unsupported feature as explicit states.
5. Add focused API and component tests for the success and denial cases.
6. Keep the surface inside the real access-request flow. Do not create a mocked review-only route.

**Acceptance criteria:**

- The result is produced by the same Graph call used in production.
- The Page identity is visible in the result.
- The UI does not claim access when Meta returns a permission or feature error.
- The surface follows `apps/web/DESIGN_SYSTEM.md` and remains keyboard and screen-reader usable.

### U5. Produce review evidence and screencast

**Intent:** Give Meta a short, reproducible proof of the actual product flow.

**Work:**

1. Create a fresh non-expired review access request after U2 passes.
2. Start from a logged-out or clean test account state where possible.
3. Record one continuous production walkthrough at 1080p with English UI and captions.
4. Show, in order: login, consent, business selection, asset selection, the Page proof operation, ad-account management grant, manual step if applicable, agency-side result, and final status.
5. Keep the selected asset identity visible whenever a permission is explained.
6. Add timestamps to the reviewer notes. Use one sentence per permission: what the user grants, what AuthHub retrieves or does, and where the result appears.
7. Include the exact Graph operation and Page proof in the notes. Do not claim that a permission is used only because it is present in the consent dialog.
8. Do not show browser extensions, credentials, unrelated tabs, test harnesses, or internal debugging overlays.

**Acceptance criteria:**

- Every retained permission has a visible scene and timestamp.
- The video starts at the real login flow and ends at a real completion state.
- The Page proof is readable and tied to the selected Page.
- The video can be replayed from a fresh request without an expired-link or loading blocker.

### U6. Prepare and gate the new Meta submission

**Intent:** Submit only a consistent, complete review package.

**Work:**

1. Verify the Marketing API Access Tier is still complete and that the current usage evidence has propagated.
2. Align the App Review draft with the permission matrix from U1.
3. Remove stale mentions of `catalog_management`, Business Asset User Profile Access, unsupported `pages_read_engagement` claims, and unrelated `email` or `public_profile` claims from the Meta Ads review instructions.
4. Fill the “Where can we find the app?” field with the fresh review URL only after U2 passes.
5. Confirm privacy policy, Terms of Service, data deletion URL/instructions, app icon, category, contact email, business verification, and Data Use Checkup.
6. Add the screencast and timestamped reviewer notes.
7. Run the final parity checklist: OAuth scopes, registry configuration, UI, API calls, reviewer notes, and selected review permissions must match.
8. Stop for explicit approval immediately before submission.

**Acceptance criteria:**

- No requested permission lacks a product operation, UI proof, or screencast timestamp.
- No excluded permission appears in the scope, draft, notes, or video.
- The review URL loads in a clean browser.
- The package is ready for submission, but no submission occurs without explicit approval.

## Verification Contract

### Automated checks

Run the smallest focused checks first, then the repository gates required by the changed paths:

```bash
pnpm --filter api test -- apps/api/src/routes/client-auth/__tests__/assets.meta.test.ts
pnpm --filter api test -- apps/api/src/routes/__tests__/client-auth.routes.test.ts
pnpm --filter web test -- apps/web/src/components/client-auth/__tests__/MetaAssetSelector.test.tsx
pnpm --filter api typecheck
pnpm --filter web typecheck
git diff --check
```

Add focused tests for the U4 Page proof and U3 grant-result states before running the broader suite. Use the repository’s actual package scripts if names differ in the current checkout.

### Live checks

- Fresh review request loads in production.
- New-request page loads clients.
- Meta OAuth returns to AuthHub with the expected scopes.
- Businesses, Pages, ad accounts, and connected Instagram assets load.
- The exact U1 Page operation succeeds and its result is displayed.
- OBO setup completes before grant execution.
- Page grant, ad-account grant, and manual-pending states are truthful.
- Retry is idempotent.
- Browser console has no flow-breaking error.
- Meta Testing and App Review draft show the same scope set as production.

### Evidence artifacts

Store the review matrix, endpoint response receipt, fresh review URL, screencast, timestamped notes, and final parity checklist in the repository’s existing review-artifact location after confirming that no credential or client-sensitive data is included.

## Definition of Done

This plan is complete only when all of the following are true:

- `pages_read_engagement` has a verified, real AuthHub operation and visible result, or the review is explicitly blocked by a documented Meta prerequisite.
- `pages_show_list` is proven separately through Page listing and selection.
- `business_management`, `ads_read`, and `ads_management` each have matching operations and visible evidence.
- OBO setup and grant verification work in production, with truthful manual and failure states.
- Fresh review requests do not load indefinitely or expire before recording.
- The screencast starts from login and shows the complete production flow.
- Reviewer notes, OAuth scopes, code, and App Review draft are in parity.
- Automated and live verification receipts are captured.
- The submission package is ready and awaiting the user’s explicit submission approval.

## Appendix: Research evidence

- Leadsie asset support: https://help.leadsie.com/article/20-what-can-i-get-access-to-with-leadsie
- Leadsie connection errors and Page permission requirement: https://help.leadsie.com/article/34-overview-of-connection-errors
- Leadsie Instagram access through a connected Page: https://help.leadsie.com/article/53-how-to-use-instagram-access-received-via-leadsie
- Leadsie social publishing support: https://help.leadsie.com/article/73-post-on-social-media-accounts
- Leadsie Page-based Leads access: https://help.leadsie.com/article/67-how-to-share-leads-access
