# Technical Decisions

Record significant technical choices so future sessions (and humans) understand why something was done.

**When to add an entry:** Architecture choices, technology picks, approach tradeoffs, or anything that would be non-obvious to someone reading the code later.

**Format:** One DEC per decision. Newest first.

---

### DEC-016: Sign-up runs a custom Clerk flow (useSignUp), not the prebuilt card
**Date:** 2026-10-10

**Context:** The revamp of `/sign-up` targets a two-column layout (form on paper, testimonial on an ink panel) copied from a competitor reference. The prebuilt `<SignUp />` card cannot host custom copy placement, so the choice was theming the prebuilt card (close, not exact) versus a custom flow.

**Decision:** `/sign-up` renders a custom `SignUpScreen` on Clerk's `useSignUp` hook: `create` → optional `email_code` verification step → `setActive` → redirect to `/onboarding/unified`. Google uses `authenticateWithRedirect` returning through a new public `/sso-callback` route (`AuthenticateWithRedirectCallback`, added to `isPublicRoute` in `proxy.ts`). The `(auth)` group layout was deleted: sign-in carries its own centered wrapper; sign-up is full-bleed.

**Consequences:** positive — exact layout control, the right panel is the view's one ink panel, social button uses the sanctioned `secondary` variant; negative — Clerk sign-up config changes (e.g. adding a strategy) are code changes here now, and the Clerk instance must keep the `oauth_google` connection and password enabled for this page to work.

### DEC-015: The PLATFORMS registry is the one sanctioned place to hand-type platform facts
**Date:** 2026-10-08

**Context:** The platform-capability partition (OAuth vs manual vs api_key, client gate, display names, legacy payload ids) was hand-typed in 6+ places across three tiers. Drift shipped a production bug (8e17c27e: the client OAuth gate accepted manual-invite platforms). An architecture review (2026-10-08) selected the partition as the top deepening candidate; a two-round design review settled the design.

**Decision:**
- One registry module, `packages/shared/src/platforms/registry.ts`: a keyed record over a discriminated union `kind: 'group' | 'product' | 'legacy'`. 28 entries — the 21 `PlatformSchema` members (capabilities verbatim from `PLATFORM_TOKEN_CAPABILITIES`), 4 Google "rider" products (`google_tag_manager`, `google_merchant_center`, `google_search_console`, `google_business_profile`: current, selectable hierarchy products whose grants ride the google group connection, encoded by a required-literal `authorizesViaParent: true` with capabilities compile-forbidden), and 3 legacy-only payload ids (`whatsapp_business`, `youtube_studio`, `display_video_360`), carrying id/kind/displayName/parent only.
- The registry is NOT "derivation kills hand-typing." The client gate, the identity-verification 6, the asset-selecting 13, and the picker "other" 14 are curated facts with no generating rule. The registry concentrates the hand-typing; the walker + goldens guard it.
- The client OAuth gate derives from a per-entry `clientAuthorizable` boolean reproducing today's exact ten members (`linkedin_ads`, `linkedin_pages`, `tiktok_ads`, `snapchat_ads` are connectionMethod `oauth` but not client-authorizable — the fact 8e17c27e enforces).
- `LEGACY_PAYLOAD_IDS` is one named seven-member set (payload history, not a platform property — a per-entry flag would state a falsehood about live products). A golden asserts it is a subset of all registry ids.
- `connectionMethod` documents the client-facing authorization flow; the optional `oauth` config block documents agency-side transport. Independent facts: shopify is client-manual and agency-OAuth (live at `oauth.routes.ts:99, 207`) in one entry.
- Per-tier goldens pin every projection as frozen literals with provenance headers; changes require the hand-run regenerator with `--acknowledge=<decision-ref>` (`scripts/generate-platform-registry-golden.ts`). Never snapshots.
- Delivery is six stacked PRs: Phase 0 dedupe (identity 6, asset-selecting 13) → Phase 1 registry + goldens → Phase 2a gate flip → Phase 2b registry.config absorption + factory flip (two commits) → Phase 2c web flip → Phase 3 source walker with a pre-seeded ratchet allowlist (connector layer included pending review card 5). Phase 0+1 are additive; no consumer flips until Phase 2.

**Consequences:**
- Positive: adding a platform becomes a one-file registry edit with compiler-forced completeness; drift fails CI instead of production; both progress vocabularies and two connector registries get a common substrate for later deepening (review cards 2 and 5).
- Negative: the registry initially duplicates `PLATFORM_TOKEN_CAPABILITIES` values (golden-pinned; Phase 2 flips ownership); shared's pre-existing global coverage-threshold breach on branches/functions (58.22%/71.87% on main) remains open — Phase 1 improves it (59.25%/76.31%) and the registry module is 100%.
- Parked product questions (GLOSSARY.md): PQ-other-14 (why the picker "other" list holds 14 and omits three ads products) and PQ-selector-4 (email quartet semantics). Both are pinned as-is by goldens; a linked decision must resolve each.

### DEC-014: Meta declines ride a parallel payload; completion notifications moved to the lifecycle transition
**Date:** 2026-10-03

**Context:** The decoupled invite flow (confirm no longer waits for grants) needed the agency to see what a client explicitly refused to share, and completion had to fire from the single place where request status actually changes.

**Decision:** Client "we don't have / won't share this asset type" choices surface as a parallel `metaDeclines` payload on both invite payloads (token + agency byId), never as synthetic `excluded` fulfillment rows — exclusions remain agency bookkeeping, declines are client decisions with their own muted "Client marked:" surface and no status badges. Client declines are reversible: selecting an asset of that kind (or re-selecting after a reset) withdraws the decline, while agency exclusions survive client-side changes. Completion notifications moved into `setAccessRequestLifecycleStatus`, so the verify-driven partial→completed transition now notifies without a separate completion path.

**Consequences:** positive - one decline shape end to end (`MetaAssetDecline[]`), no fake rows to filter in fulfillment logic, no duplicate notification paths. negative - consumers must join declines to fulfillment by kind when they want the combined view; declines with selections are intentionally ignored (the selection wins).

---

### DEC-013: The client selection blob is validated server-side at one choke point
**Date:** 2026-09-27

**Context:** KTD5 made the client-controlled save blob trusted input for persisted state. Validation existed in the save path and a near-duplicate block in the grant path; `selected*WithNames` arrays (preferred by `extractSelectedMetaAdAccounts`) skipped membership validation entirely.

**Decision:** `scopedMetaAssetSelection()` (assets.routes.ts) owns kind derivation, narrowed Graph discovery, and membership validation for both paths; WithNames ids are unioned into their kind before validation. Claimed-portfolio mismatch returns 409 everywhere (one code, one status).

**Consequences:** positive - one behavior to test; the typed INVALID_META_BUSINESS_PORTFOLIO 400 surfaces from both paths. negative - the manual share/start route consumes persisted (already-validated) metadata rather than re-validating; its verify step remains the Graph check.

---

### DEC-012: Invite tokens are scrubbed at every egress sink, not just PostHog
**Date:** 2026-09-27

**Context:** KTD13 originally covered PostHog `sanitize_properties` only. Review found the invite bearer token shipping in Sentry error events, breadcrumbs, and session replays, plus OAuth `code`/`state` query params surviving in `$current_url` on `/invite/oauth-callback`.

**Decision:** The deep redaction walk is shared: PostHog's hook and Sentry's `beforeSend` both apply it; replay capture never registers on `/invite` paths; the scrubber also redacts OAuth secret parameters on `/invite` strings only. `no-referrer` moved to a shared `app/invite/layout.tsx` so no nested route can forget it.

**Consequences:** positive - one scrubber, all sinks. negative - deeply nested (>8) property values remain unscrubbed by the depth cap (documented residual).

---

### DEC-011: Landing states read server truth; terminal codes end the flow
**Date:** 2026-09-27

**Context:** The invite page must never loop a dead link on a retry card, nor show a terminal card for a transient failure.

**Decision:** `TERMINAL_REQUEST_CODES` = REQUEST_EXPIRED, REQUEST_REVOKED, ACCESS_REQUEST_NOT_FOUND, REQUEST_NOT_FOUND (the API's own not-found code). Everything else renders the retryable load card. A failed server fetch (e.g. Render cold start past the 10s server timeout) degrades to the retry card, never terminal.

**Consequences:** positive - dead links end honestly; transient failures recover with one click. negative - the retry card's title ("This link is not working") reads scary for a timeout; copy iteration welcome.

---

### DEC-010: The design contract is enforced by source walkers with ratchets, not review vigilance
**Date:** 2026-09-27

**Context:** The invite redesign added a source-contract walker (invite.design.test.ts); the button-contract walker's attribute regex could not see handler-first raw buttons, hiding a tree-wide backlog.

**Decision:** The invite walker derives its surface by directory walk (app/invite + app/platforms + components/flow + components/client-auth) with rules for accent-text ink, binary radius, shadow budget, non-token shadows, generic palette (per-file brand exceptions), and emoji. The button walker's regex tries `=>` before `[^>]`; the pre-existing backlog it surfaced (66 violations, 22 files) is frozen under a ratchet that fails on growth.

**Consequences:** positive - new files are covered by default; debt is finite and visible. negative - 22 legacy files still carry tracked debt until migrated.

---

### DEC-009: Infisical stays off the Prisma transaction; list APIs are bounded summaries
**Date:** 2026-09-13

**Context:** `createClientConnection` stored OAuth tokens in Infisical while holding a pooled Prisma `$transaction`. `GET /connections` and `GET /agencies/:id/access-requests` returned unbounded full rows (`secretId`, authorization metadata, branding JSON). Token-refresh and expiry jobs filtered `status + expiresAt` with no matching index.

**Decision:**
- Store secrets in Infisical first (pre-generated connection id), then a short DB write of `secretId` only. On DB failure, delete the stored secrets. Log `GRANTED` audit rows with `agencyId` and no token material.
- Default list `limit` 50, max 100 on access-request and connection list endpoints. Connection lists use the summary `select` (platform + status only). Client detail maps a slim client object and does not return nested `secretId`.
- Add `(status, expiresAt)` on `PlatformAuthorization` and `AccessRequest`, and `(resourceType, resourceId, createdAt)` on `AuditLog`. Migration is committed; it is not applied to production from this change.

**Rationale:** Infisical RTT must not pin a Postgres connection. List payloads and expiry scans are the cheap wins after unused-deps cleanup. Tokens never belong in PostgreSQL.

**Consequences:**
- Positive: OAuth persist holds the pool only for the DB write; list routes stop shipping secrets and large JSON by default
- Negative: callers that omitted `limit` now receive at most 50 rows; page with `offset` for more
- Migration must be reviewed before a production apply (`CREATE INDEX CONCURRENTLY` in ops, not this PR)

---

### DEC-003: Design System v2.0 — refinement by subtraction (lazyweb extraction)
**Date:** 2026-09-03

**Context:** The Acid Brutalism system (v1.3.0) carried five chromatic tokens, a six-step shadow ramp, ten button variants, intermediate radii, and eleven decorative animation families. An extracted design-DNA kit of lazyweb.com (same brutalist skeleton, tighter discipline) showed the refinement gap was subtraction, not new tokens. Evidence kit: `~/Desktop/lazyweb.com-design-kit/`; plan: `docs/design-system-delta-plan.md`.

**Decision (user-approved in session):**
- One accent: `--electric` deleted; `--acid` restricted to the homepage hero moment
- Fraunces dropped; the `font-display` role collapses onto Outfit (dela keeps hero duty)
- Shadow budget of three (2/4/6px), token-driven in tailwind; shadow is punctuation, never a resting state — default cards are 1px-border, no shadow
- AA contrast contract: `--success-ink`/`--danger-ink` carry status TEXT; raw teal/coral are fills and borders only
- Buttons: 10 variants → 5 (`primary/secondary/ghost/danger/brutalist`); danger uses `bg-danger-ink`
- Binary radius: `--radius: 0rem`; square or circular, nothing between; all six Tailwind steps map to the token
- Two-ring focus (3px accent stroke + 6px halo); mono micro-label layer (`.label-micro`/`.label-nano`); `.ink-panel` as the one dark surface per view
- Reveal timing 450ms `cubic-bezier(0.2,0.8,0.3,1)`; decorative keyframe families removed

**Rationale:** Every accent added after coral competes with it; contrast must be a token decision with measured ratios; contracts that aren't enforced by tests regress silently (mutation-verified during review).

**Consequences:**
- Positive: single accent reads as intentional; status text passes WCAG AA on both grounds; design contracts test-enforced
- Negative: raw coral/teal remain <AA as text anywhere not yet migrated (428 residual sites, many on dark ground); v2.0 utilities await consumer adoption
- Deferred: bind-by-email policy rework (product decision); utility consumer wiring (design decision)

---

## Template (copy for new entries)

```markdown
### DEC-XXX: [Short title]
**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded | Deprecated

**Context:** [What situation required a decision?]
**Decision:** [What was decided?]
**Rationale:** [Why this choice?]

**Alternatives considered:**
1. [Alternative A] — why rejected
2. [Alternative B] — why rejected

**Consequences:**
- Positive: [benefits]
- Negative: [tradeoffs]
```

---

## Decisions

### DEC-002: Business selection persisted by the creation service, not save-assets
**Date:** 2026-09-03
**Status:** Accepted

**Context:** The Meta Business Portfolio creation flow (`meta-asset-creation.service.createBusiness`) must make the newly created business immediately usable by `grant-meta-access` in the same wizard pass. The frontend sends the business selection as extra fields on `save-assets`, but `saveAssetsSchema` is a plain `z.object` that strips unknown keys.

**Decision:** `createBusiness` persists the selection server-side into `PlatformAuthorization.metadata.meta.selection` (with `source: 'created'`) and merges the business into `discovery.availableBusinesses` at creation time. The frontend refetch of `/assets/meta_ads?businessId=` is UX only.

**Rationale:** `grant-meta-access` reads the business exclusively from `metadata.meta.selection.clientBusinessId` (assets.routes.ts). Persisting in the service keeps one source of truth and avoids widening `saveAssetsSchema` for a field only Meta business creation needs.

**Alternatives considered:**
1. Extend `saveAssetsSchema` to carry `selectedBusinessId` — rejected: widens a shared cross-platform schema for one platform's need and invites inconsistent states between the two writes.
2. Have the frontend pass the business id to `grant-meta-access` directly — rejected: the grant route's contract is server-side state; mixing client-supplied business ids weakens authorization scoping.

**Consequences:**
- Positive: one-pass UX (create → share) works with zero wizard changes; refetch re-stamping `source` from `'created'` to `'user_selection'` is harmless.
- Negative: two writers to `metadata.meta` (asset-discovery route and creation service); both must keep using the shared Zod schema for reads.

### DEC-001: Sentry Webhook Integration via Manual UI Setup
**Date:** 2026-03-10
**Status:** Accepted

**Context:** Attempted to set up Sentry webhook integration programmatically via the Sentry API to automatically send error alerts to the Cursor project for AI agent processing.

**Decision:** Use manual UI configuration for Sentry webhook integration instead of programmatic API setup.

**Rationale:** After extensive API exploration, discovered that Sentry's API doesn't allow direct creation of webhook integrations without an existing configured integration. The organization (authhub) has no existing integrations, sentry-apps, or alert rules. Creating integrations requires the Sentry UI or specific admin endpoints not available through the standard API.

**Alternatives considered:**
1. Continue trying different API endpoints — reached API limitations
2. Use Sentry CLI — not available in the environment
3. Wait for Sentry to add programmatic webhook support — delays implementation

**Consequences:**
- Positive: Allows immediate implementation with clear documentation
- Positive: Provides visibility into integration setup through UI
- Negative: Requires manual one-time setup in Sentry UI
- Negative: Cannot automate the initial integration creation

---

_(Add DEC-002, DEC-003, … here; newest first.)_

## DEC-004 — Snapchat OAuth redirect strategy: two registered URIs (2026-09-10)
Register both the frontend invite callback and the API agency callback in the Snap OAuth app (TikTok parity). Chosen over single-URI + browser forwarding: Snap codes are single-use and the exchange redirect_uri must match the authorize request, so forwarding cannot work. Snap URIs are immutable after creation — register both at app creation.

## DEC-005 — Legacy manual Snapchat rows migrate to status 'revoked' (2026-09-10)
Old manual-only AgencyPlatformConnection rows (active, secretId null) are set to status 'revoked' + revokedAt/revokedBy 'system:legacy-manual-migration' + audit entry, per-row transaction, CAS-guarded (status+secretId re-checked in-transaction). 'revoked' is the only non-active status createConnection reuses, so reconnect lands on the update-in-place path. Production apply is operator-gated: dry-run, explicit approval, staging first.

## DEC-006 — needs_reconnect product status + ms-precision server health (2026-09-10)
ClientDetailProductStatus gains 'needs_reconnect' (client authorized; grant died — distinct from 'pending' never-authorized and 'revoked' request-level). Server calculateHealthStatus now uses ms-precision expiry (<= 0 -> expired) to match the web countdown, replacing day-ceil rounding.

## DEC-008 — Settings page runs on Design System v2.0 with a rendered design contract; root design.md is stale (2026-09-12)
`apps/web/DESIGN_SYSTEM.md` v2.0 is the canonical design system; the code and `globals.css` implement it. The root `design.md` / `DESIGN.md` (July 2026: Fraunces display, 8–12px radii, violet hover) predate v2.0 and carry a stale notice rather than being deleted — regenerating them is follow-up work.

The Settings page is rebuilt as one shell (`SettingsTabs`) over a flat row layer (`SettingsRow` / `SettingsGroup`): one `.ink-panel` strip per tab, at most one `brutalist` button per tab in the row layer (never on ink ground), ≤3 hard shadows per rendered view, binary radius, no `.clean-card`. The four tabs and the `?tab=` URL model stay; hooks, mutations, analytics, and Creem calls are untouched. The Team Members placeholder and the fake-save Notifications card are removed rather than restyled.

Enforcement is two-layered on purpose: a source walker (`settings.design.test.ts`, first consumer of `src/test/utils/design-system.ts` plus regex assertions the validator misses at string edges) and a rendered per-view count test (`settings-view-counts.test.tsx`) because conditional variants and `Button`-carried shadows are invisible to source text. Chosen over per-file design tests, which drift file by file.

## DEC-007 — AGENCY→SCALE ships as a split migration: Postgres in-deploy, Clerk operator-gated (2026-09-11)
The tier rename rewrites two stores that cannot share a transaction. PostgreSQL migrates inside the Render deploy: `render.yaml` runs `npm run db:migrate:deploy && npm start`, so `20260911_rename_agency_tier_to_scale` applies before the new API serves. Clerk `publicMetadata.subscriptionTier` is backfilled separately by `apps/api/scripts/backfill-clerk-tier-agency-to-scale.ts`, run by an operator after the deploy is healthy, with dry-run → `--limit 5` canary → full `--apply` gates.

Chosen over a single atomic cutover, which is not available: Clerk has no transaction to join and no history to roll back to. The split is made safe by the audit trail — every write emits an `AuditLog` row with action `AGENCY_SUBSCRIPTION_TIER_BACKFILLED` carrying `resourceId` (Clerk user id), `previousTier`, `newTier`, and `basis`. Those rows are the only way to reverse the Clerk half, so they must not be pruned until the rename is settled.

Clerk's target tier is resolved from `privateMetadata.quotaLimits.clientOnboards.limit` (36→STARTER, 120→GROWTH, 600/-1→SCALE) before the label map. The label 'AGENCY' meant the $79 mid tier before 20260314 and the $149 top tier after it; that migration rewrote Postgres and skipped Clerk, so both eras still sit behind one label. An unconditional AGENCY→SCALE rewrite would silently promote pre-March $79 customers to a $149 plan's quota. The quota fingerprint never changed meaning across either rename, so it is the stronger signal. Rows that fall through to `label-fallback` are printed with that basis and stop the run for Creem confirmation.

Consequences: positive — each store is independently verifiable and reversible; the backfill is idempotent because a rewritten user no longer matches the selection. Negative — a window exists where Postgres says SCALE and Clerk still says AGENCY; `setSubscriptionTier` resets `quotaLimits.*.used` to 0, which reads permissive until the 5-minute `syncQuotaUsage` job restores real usage; and Creem is not renamed at all (product ids are unchanged and the webhook maps id→tier), so the Creem dashboard keeps saying "Agency".
