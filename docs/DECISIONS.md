# Technical Decisions

Record significant technical choices so future sessions (and humans) understand why something was done.

**When to add an entry:** Architecture choices, technology picks, approach tradeoffs, or anything that would be non-obvious to someone reading the code later.

**Format:** One DEC per decision. Newest first.

---

### DEC-008: Infisical stays off the Prisma transaction; list APIs are bounded summaries
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

## DEC-007 — AGENCY→SCALE ships as a split migration: Postgres in-deploy, Clerk operator-gated (2026-09-11)
The tier rename rewrites two stores that cannot share a transaction. PostgreSQL migrates inside the Render deploy: `render.yaml` runs `npm run db:migrate:deploy && npm start`, so `20260911_rename_agency_tier_to_scale` applies before the new API serves. Clerk `publicMetadata.subscriptionTier` is backfilled separately by `apps/api/scripts/backfill-clerk-tier-agency-to-scale.ts`, run by an operator after the deploy is healthy, with dry-run → `--limit 5` canary → full `--apply` gates.

Chosen over a single atomic cutover, which is not available: Clerk has no transaction to join and no history to roll back to. The split is made safe by the audit trail — every write emits an `AuditLog` row with action `AGENCY_SUBSCRIPTION_TIER_BACKFILLED` carrying `resourceId` (Clerk user id), `previousTier`, `newTier`, and `basis`. Those rows are the only way to reverse the Clerk half, so they must not be pruned until the rename is settled.

Clerk's target tier is resolved from `privateMetadata.quotaLimits.clientOnboards.limit` (36→STARTER, 120→GROWTH, 600/-1→SCALE) before the label map. The label 'AGENCY' meant the $79 mid tier before 20260314 and the $149 top tier after it; that migration rewrote Postgres and skipped Clerk, so both eras still sit behind one label. An unconditional AGENCY→SCALE rewrite would silently promote pre-March $79 customers to a $149 plan's quota. The quota fingerprint never changed meaning across either rename, so it is the stronger signal. Rows that fall through to `label-fallback` are printed with that basis and stop the run for Creem confirmation.

Consequences: positive — each store is independently verifiable and reversible; the backfill is idempotent because a rewritten user no longer matches the selection. Negative — a window exists where Postgres says SCALE and Clerk still says AGENCY; `setSubscriptionTier` resets `quotaLimits.*.used` to 0, which reads permissive until the 5-minute `syncQuotaUsage` job restores real usage; and Creem is not renamed at all (product ids are unchanged and the webhook maps id→tier), so the Creem dashboard keeps saying "Agency".
