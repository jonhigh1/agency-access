# Flow spec: client invite (`/invite/[token]`)

What a client walks through after opening the access-request link. The agency
side that creates the link is `access-request.md`.

## Route and entry

- Canonical route: `/invite/[token]` — `token` is the 12-character
  `uniqueToken` minted at request creation.
- Two legacy aliases redirect to it: `/authorize/[token]` and
  `/client/[token]`. The agent API channel links `/client/{token}`.
- Gotcha (G6): the onboarding day-1* email and the legacy mailto helpers link
  the `/authorize` alias, not `/invite`. Aliases are redirects, but every route
  is a separate surface to keep truthful.

## Landing precedence

`resolveInviteLandingState()` (`apps/web/src/lib/invite/landing-state.ts`)
resolves the first state from, in order:

1. terminal code (`REQUEST_EXPIRED`, `REQUEST_REVOKED`, `ACCESS_REQUEST_NOT_FOUND`, `REQUEST_NOT_FOUND`)
2. completed
3. OAuth return (`?step=2&connectionId=…`)
4. Meta grant-checklist resume
5. all connected
6. has progress
7. intake (default)

Invariant: any recorded progress lands on `platforms`, never back on `intake`.

## Page phases

`PagePhase = 'intake' | 'platforms' | 'finalizing' | 'complete'`
(`apps/web/src/app/invite/[token]/client-invite-page.tsx:82`).
Per-phase hero copy lives in `phaseCopyByPhase` (same file, ~:841).

## Intake

- With intake fields: card titled "Quick Setup", button "Continue"
  (POST `/api/client/:token/intake`).
- Without fields: "Requested platforms" grid, button "Continue to connect".

## Platform queue

`buildInvitePlatformQueue()` (`apps/web/src/lib/invite-platform-queue.ts:22`)
orders the requested platforms. Partition comes from the registry
(`packages/shared/src/platforms/registry.ts:528-543`):

- OAuth, client-authorizable (10): `clientOAuthPlatforms` — google, meta,
  google_ads, ga4, meta_ads, meta_pages, tiktok, linkedin, snapchat,
  instagram. Google riders (`google_tag_manager`, `google_merchant_center`,
  `google_search_console`, `google_business_profile`) are
  `authorizesViaParent: true` — no own step.
- Manual (7): `manualConfirmationPlatforms` — kit, mailchimp, pinterest,
  klaviyo, shopify, zapier, beehiiv. The curated email-invite quartet is
  `EMAIL_INVITE_PLATFORMS` (`apps/web/src/lib/client-invite-platforms.ts:24`).
  beehiiv is agency-`api_key` but client-manual; flow decisions read
  `connectionMethod !== 'oauth'`, never `=== 'manual'`.

Gap (G2): completion gates on **every** requested platform — a 6-platform
request is 6 wizard loops before finalizing.

## Wizard (both branches, 3 steps)

`PlatformAuthWizard` is hardcoded at 3 steps
(`apps/web/src/components/client-auth/PlatformAuthWizard.tsx:141`; the
contract comment is at :228 — "All platforms use 3 steps: Connect → Choose
Accounts to Share → Done").

- OAuth step 1: "Connect {platform}"; exit note "You will leave for {platform}
  and come right back here." OAuth return resumes the same connection
  (`?step=2`), never a second OAuth.
- Step 2: "Choose accounts to share" — per-product asset selectors; stored in
  `grantedAssets` / `metadata.selectedAssets`.
- Step 3: "Signed in" → grant checklist (Meta renders `MetaGrantChecklist`).
- Manual step 1 routes to `/invite/[token]/{platform}/manual` checklists
  (`apps/web/src/app/invite/[token]/manual-invite.config.tsx`): email quartet
  `copy-invite-email → open-team-settings → send-invite`; Pinterest
  `open-business-manager → add-partner → assign-permissions`; Shopify
  `connect-shopify → select-store → connected` ("Submitted for review").
  Completion gates on the checkbox "I invited {email} to my {platform}
  account".
- Security summary varies by mix (OAuth-only / manual-only / mixed); strings in
  `apps/web/src/lib/client-invite-platforms.ts`.

## Progress vocabulary (no bar, no counter)

Deliberate: the invite page renders no percentage bar and no legacy step
counter (R3; pinned by `invite-flow-shell.test.tsx`).
`apps/web/src/lib/invite/platform-status.ts` maps each platform to exactly one
of: `connect-first | done | action-needed | waiting-on-agency | attention`.
`DONE_COPY = 'Access confirmed.'` (:55); pending copy: "Your {platform} access
request was recorded. Your agency will verify it before this request can
finish."

## Resume

- `sessionStorage` key `invite-progress:{token}` merged with the server's
  `authorizationProgress.completedPlatforms`; `unresolvedProducts` beat stale
  local state.
- Meta with a confirmed selection resumes at wizard step 3; the
  post-completion 409 card offers "Resume Meta checklist".

## Finalizing and complete

- Finalizing: "Confirming your authorization" → POST
  `/api/client/:token/complete`.
- Complete: "All set — you're done"; agency-verified variant "{agency} now has
  verified access".

## Terminal states (one-way)

`TERMINAL_REQUEST_CODES` (`apps/web/src/lib/invite/landing-state.ts:49`).
`InviteTerminalCard` copy: expired → "This link has expired"; revoked → "This
request was revoked"; unknown → "This link is no longer available". All end
"You can safely close this page." + a "Need a new link?" support card.
Terminal is one-way (AE6): no recovery in-page; the agency issues a new link.

## Flags

- G2: all platforms mandatory (see Platform queue).
- G6: duplicate entry routes (see Route and entry).
- `NEXT_PUBLIC_META_PENDING_APPROVAL` queues Meta last and shows "Meta access
  coming soon".

## Sources

- apps/web/src/app/invite/[token]/client-invite-page.tsx:82 — "type PagePhase = 'intake' | 'platforms' | 'finalizing' | 'complete'"
- apps/web/src/lib/invite/landing-state.ts:49 — "export const TERMINAL_REQUEST_CODES"
- apps/web/src/lib/invite-platform-queue.ts:22 — "export function buildInvitePlatformQueue"
- packages/shared/src/platforms/registry.ts:528 — "export const clientOAuthPlatforms"
- apps/web/src/lib/client-invite-platforms.ts:24 — "export const EMAIL_INVITE_PLATFORMS"
- apps/web/src/components/client-auth/PlatformAuthWizard.tsx:228 — "All platforms use 3 steps"
- apps/web/src/lib/invite/platform-status.ts:55 — "export const DONE_COPY"
- apps/web/src/app/invite/[token]/manual-invite.config.tsx:147 — "id: 'copy-invite-email'"
