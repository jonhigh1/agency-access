## Session: 2026-10-09 — Architecture cards 2/3/5 ce-work closed (Phase 3–4)

### What was done
- Reconciled plan `docs/plans/2026-10-09-feat-architecture-cards-2-3-5-plan.md`: U1–U9 all present on `main` through `c3319e2c` (U4/U6 included).
- Verification: walker green; named API/web suites green (including `platform-verification-handlers.test.ts`).
- `ce-code-review` receipt `20261009-184456-6f5f67c9` (focused; verdict Ready with fixes). Applied P2: client-detail MCC `manager_link` characterization in `client.service.test.ts`.
- Already shipped on `main` (Jon directed stay-on-main); no feature-branch PR.

### Decisions
- Code review receipt: `/tmp/compound-engineering-501/ce-code-review/20261009-184456-6f5f67c9`
- Residual: legacy rows with only `grantedAssets.instagram` ignored until re-save; TikTok advertisers-array web/API count asymmetry pre-existing.

### Next steps
- Deferred: vocabulary enum merge (KTD3), `google-offboarding-executor` walker entry, Meta → BaseConnector.
- Entire pre-push durable fix still parked.

## Session: 2026-10-08/09 — PLATFORMS registry: Phases 2a–3 shipped; the partition has one owner and an enforcement layer

### What was done
- Phase 2a (PR #174): `clientOAuthPlatform` now constructs from the registry's `clientAuthorizable` derivation; the hand-typed gate enum is gone. RED→GREEN on the elementwise construction assertion.
- Phase 2b (PR #175, two commits): the 15 OAuth personalities absorbed into the registry's `oauth` blocks verbatim (Meta still references `META_GRAPH_VERSION` / `META_PERMISSION_CONTRACT`); `registry.config.ts` became a thin facade and the existing `registry.config.test.ts` pins prove the projection byte-for-byte; dead `PLATFORM_SCOPES` (85 lines) deleted. Factory keys pinned to the new `connectorPlatformIds` derivation by a completeness test; stale factory header replaced.
- Phase 2c (PR #178): web's triple-encoded seven-member manual list collapsed to the shared `manualConfirmationPlatforms` derivation. The lib's own suite caught a real regression in the first rewrite — beehiiv is agency-`api_key` but client-manual; the flow decision reads the derived list (`connectionMethod !== 'oauth'`), not `=== 'manual'`. Instructional copy stays web-side.
- Phase 3 (PR #179): partition duplicates deduped (`RECOMMENDED_CONNECTION_PLATFORMS` / `getConnectionPlatformCategory` / dead agency `getPlatformDisplayName` deleted); email quartet collapsed to one named `EMAIL_INVITE_PLATFORMS` (PQ-selector-4 stays parked). Platform-id walker shipped: node:test over 562 files, ≥3-quoted-run and ≥3-case-dispatch detectors, 13-entry ratcheted allowlist seeded from the real first run, stale-entry failures, >250 anti-vacuous guard, wired into root `test:run`. Transform normalizer gained its emitted-ids test.
- Walker built by a clean subagent after two corrupted direct writes; two spec bugs found and fixed (ROOT depth; newline-erasing comment blanking broke line numbers — now per-character blanking preserving newlines).

### Decisions
- Order ownership for every derived list moved to the registry; per-tier pins are order-free frozen sets, construction assertions are elementwise.
- Unquoted object-key maps are outside the walker's predicate: the factory is pinned by `factory-completeness.test.ts` instead (the reviewer's predicted factory allowlist entry turned out unnecessary — and would have failed as stale).
- Shared's pre-existing global coverage-threshold breach (branches/functions < 80% on main) remains open; Phases 1+ improved it (registry.ts is 100%).

### Next steps
- Merged 2026-10-09: main carries the registry via #172 (Phase 0 squash) + #181 (Phases 1–3 aggregate squash). Sequencing lesson recorded: stacked PRs retarget only when the base branch is deleted — #173–#180 squash-merged into their still-alive base branches, so #181 re-delivered the remainder as one reviewed set (its tip was the exact rebased stack that passed CI five times). The rebase onto origin/main was mandatory regardless: the stack had inherited the Entire-stomped pre-push hook from local main (upstream had repaired it) and was ~10 upstream PRs stale.
- Review cards 2/3/5 can now consume the walker allowlist: refactoring `getSelectedAssetCount` dispatch (card 2), the invite session module (card 3), or the connector interface (card 5) should PRUNE allowlist entries in the same change — the stale check enforces it.
- Registry migration of the shared types.ts partition (PlatformSchema/ManualConfirmationPlatformSchema derive from PLATFORMS) is the natural Phase 4 if drift reappears; the allowlist entry documents it.
- Parked product questions: PQ-other-14, PQ-selector-4.

## Session: 2026-10-08 — PLATFORMS registry: architecture review, settled design, Phase 0+1 shipped (PR #172 + stacked PR)

### What was done
- Ran the improve-codebase-architecture review: two explorer passes (api+shared, web) over hot spots from the last ~60 commits; 8-candidate report delivered as a temp-dir HTML file (not committed). Top pick: the platform-capability partition — hand-typed in 6+ places across three tiers, drift already shipped 8e17c27e.
- Settled the design through a two-round grilling loop with a hostile-reviewer subagent as proxy decision-maker (user-delegated): FRONTIER: EMPTY. Registry = one sanctioned place to hand-type; walker + goldens are the load-bearing enforcement. Key rulings: per-entry `clientAuthorizable` (gate-10 not derivable), `LEGACY_PAYLOAD_IDS` as a named set (R3 contest flipped per-entry flags), shopify dual identity confirmed live by audit (agency OAuth at oauth.routes.ts:99/207), rider products split by required-literal `authorizesViaParent`.
- Wrote `GLOSSARY.md` (repo root): platform identity kinds, connection method vs oauth config block, clientAuthorizable, email-invite quartet, PQ-other-14 / PQ-selector-4 parked questions.
- Implemented Phase 0 (PR #172, `refactor/platform-registry-phase-0`): RED→GREEN goldens for the identity-mode 6-platform list and the 13-product asset-selection set, then deduped both to single sites (lib/asset-selecting-products.ts; shared const in identity-verification.service.ts). Full api suite green (165 files, 1796 tests).
- Implemented Phase 1 (`feat/platform-registry-phase-1`, stacked): acknowledged golden regenerator (`scripts/generate-platform-registry-golden.ts`, refuses without `--acknowledge`), `packages/shared/src/platforms/registry.ts` (28-entry discriminated union, `satisfies`-checked), shared golden (RED first — it caught a real data-entry error: the four client-gated ads products were typed authorizable), api gate golden (schemas.ts export is @internal-for-golden), web manual-invite golden.
- Recorded DEC-015 (full design + 6-PR roadmap + parked questions).

### Decisions
- DEC-015 (docs/DECISIONS.md) — the registry design, the rider encoding, LEGACY_PAYLOAD_IDS, the golden regen protocol, and the six-PR delivery plan.
- Phases 2a–3 (gate flip, registry.config absorption + factory flip, web flip, source walker) are separate stacked PRs; no consumer flips landed in Phase 0+1.
- Shared jest config gained the NodeNext `.js→.ts` moduleNameMapper so the src/index.ts barrel is importable under jest (the golden is its first importer).

### Next steps
- Phase 2a: flip `clientOAuthPlatform` to derive from the registry's `clientOAuthPlatforms`; delete the @internal-for-golden enum.
- Phase 2b: absorb `registry.config.ts` into the descriptors' oauth blocks (golden equality diff first), then flip the factory keys (two commits).
- Phase 2c: collapse the web lib's triple-encoded 7-member manual list to the derived import; keep instructional copy web-side.
- Phase 3: source walker (3 tiers + .tsx, ≥3-id switch detection, pre-seeded ratchet allowlist incl. connector layer, stale-entry failures).
- Open: shared's pre-existing global coverage-threshold breach (branches/functions below 80% on main; Phase 1 improves it, registry.ts is 100%); PQ-other-14 and PQ-selector-4 product questions.

## Session: 2026-10-05/06 — Creem production webhook: wired, then env-incident and full recovery

### What was done
- Confirmed `POST /api/webhooks/creem` is the sole writer of subscription state (tier, status, Clerk metadata); production endpoint is `https://agency-access.onrender.com/api/webhooks/creem`.
- Added `CREEM_WEBHOOK_SECRET` to local `apps/api/.env` (gitignored) and to the Render service; **my replace-all env PUT hit the API's pagination (page size 20) and deleted ~43 of ~60 service env vars** — see `docs/ERRORS.md` 2026-10-06 entry for full RCA.
- Recovered all 10 boot-critical vars across runs: Vercel (Clerk keys, `META_APP_ID`), repo-derivable (`FRONTEND_URL`, `API_URL`, `CLERK_OAUTH_*`, `INFISICAL_PROJECT_ID`), user dashboards (`META_APP_SECRET`, `CREEM_API_KEY`, `INFISICAL_CLIENT_ID/SECRET`), regenerated `OAUTH_STATE_HMAC_SECRET`.
- Deployed `dep-db27nsvlot8c73e61mbg` — **live**. Verified: `/health` 200; unsigned webhook POST → 401; HMAC-signed probe → 400 `Unknown product ID` (signature secret matches Creem; end-to-end confirmed).
- Re-enabled auto-deploy (`autoDeploy: yes / trigger: commit`); it had been disabled as incident protection.
- Local `apps/api/.env` now carries the recovered prod values for local dev (still missing `DATABASE_URL`, Redis, connector creds for a full local boot).
- Cleaned all secret-bearing temp files (Vercel env pulls, decrypted Infisical backup) from `/tmp`.

### Decisions
- Billing secrets stay as Render env vars (not Infisical) per `docs/RENDER_DEPLOYMENT.md`; Infisical remains the OAuth-token vault.
- `OAUTH_STATE_HMAC_SECRET` is a new value; in-flight OAuth handshakes from incident time are invalid (self-heals).

### Next steps
- Restore 22 connector/functional vars from their own dashboards (list in `docs/ERRORS.md`): Google/LinkedIn/Pinterest/Kit/Klaviyo/Mailchimp/Shopify/Beehiiv/TikTok-Login-Kit creds, `SENTRY_DSN`, `INTERNAL_ADMIN_EMAILS/USER_IDS`, `TRUST_PROXY_IPS`, `AGENT_MCP_RESOURCE_URL`, `AGENT_NATIVE_AGENCY_ALLOWLIST`.
- Confirm the Creem dashboard endpoint URL + event subscriptions (only dashboard-side piece unverifiable from here).
- Rotate Render API key + refresh token (printed in agent transcripts) and consider rotating the chat-transited secrets.
- Log render-env pagination hazard into `docs/solutions/` if a Render-var runbook is written.

## Session: 2026-10-03 — Meta invite flow: decoupled confirm/complete, step-3 grant checklist, declines, resume (Phase 4 polish)

### What was done
- Completed the Meta invite-flow decoupling: the wizard's save (confirm) advances unconditionally to a step-3 grant checklist; panel completions only settle checklist items (optimistic overlay + one refetch ask) and never gate the share step.
- Built the step-3 checklist on a pure resolver (`lib/invite/meta-grant-checklist.ts`): server fulfillment rows roll up per kind, client declines remove kinds, an overlay carries optimistic state until the refetch; rows with an empty selection blob render on the resume path.
- Declines persist end-to-end: the selector emits `declinedAssetKinds`, the save stores them, the payload carries `metaDeclines`, and the resume/landing logic treats declines as decisions rather than gaps.
- Resume works: revisits with a confirmed Meta selection land straight on the step-3 checklist; the post-completion 409 card offers "Resume Meta checklist" back into it.
- Phase 4 polish: five PostHog funnel events (`client_grant_checklist_viewed`, `client_grant_item_completed` panel/server, `client_assets_decline_toggled`, `client_finish_clicked_with_pending`, `client_checklist_resumed`) — counts and kinds only; agency-side declines visibility on `MetaFulfillmentCard` ("Client marked:" muted section, no status badges); stale step-2 grant comments swept to the new model.
- TDD throughout: red-green per unit across analytics, checklist, wizard, selector, card, page, and API service suites.

### Files changed
- `apps/web/src/lib/analytics/invite-events.ts` (+test) — five `trackClient*` funnel emitters
- `apps/web/src/components/client-auth/MetaGrantChecklist.tsx` (+test) — panel settle funnel (`done` only) and server-row flip detection with overlay suppression
- `apps/web/src/components/client-auth/PlatformAuthWizard.tsx` (+test) — checklist-viewed (once per instance) and finish-with-pending events
- `apps/web/src/components/client-auth/MetaAssetSelector.tsx` (+decline test) — decline-toggle event
- `apps/web/src/app/invite/[token]/client-invite-page.tsx` (+page test) — resume event; declines passed to the follow-up card
- `apps/web/src/components/access-request-detail/meta-fulfillment-card.tsx` (+test) — optional `declines` prop with muted "Client marked:" section
- `apps/web/src/app/(authenticated)/access-requests/[id]/page.tsx` — passes `accessRequest.metaDeclines`
- `apps/web/src/lib/api/access-requests.ts` — `AccessRequest.metaDeclines` type
- `apps/api/src/services/access-request.service.ts` (+service test) — `getAccessRequestById` now returns `metaDeclines`
- Copy sweep comments: `meta-selection-blob.ts`, wizard, selector

### Decisions made
- See DEC-014 in docs/DECISIONS.md (parallel `metaDeclines` payload; reversible client declines vs surviving agency exclusions; completion notification moved into `setAccessRequestLifecycleStatus`).
- Item-completed events fire only on transitions to `done` from either source; a panel settle to `action_required` is a failure, not a completion; server events are suppressed while the optimistic overlay already claims `done`, so one completion is reported once.

### Next steps
- PostHog dashboard: funnel from checklist_viewed → item_completed → finish (with/without pending).
- Deploy and watch the agency detail card with real declined payloads; consider surfacing decline counts on the requests list.

---

## Session: 2026-10-03 — Fix 401 USER_EMAIL_REQUIRED on revoke endpoints (jam 76b5f94c)

### What was done
- Read the jam (jev browser blocked; drove jam.dev via agent-browser): Disconnect on /connections fired `DELETE /agency-platforms/meta` → 401, empty body, one click, 4s video.
- Root-caused: Clerk session JWTs in production carry no resolvable email claims; PR #72's hard 401 `USER_EMAIL_REQUIRED` guards keyed on `resolveUserEmail(request.user)` broke every mutating revoke endpoint (platform disconnect, client delete, both token-health revokes) while GETs worked.
- Fixed all four handlers to derive the audit actor via `resolveAuthenticatedUserEmail` (JWT claims → verified Clerk record), placed after agency-ownership checks; removed email resolution from token-health's shared helper so list endpoints pay zero email cost.
- Web: disconnect mutation now surfaces the API error message; removed the ignored client-supplied `revokedBy` body field.
- TDD: red→green across agency-platforms.security, clients.security, token-health.security, authorization (helper), connections page (toast). Updated 4 stale mocks from the old seam.
- Validation: full API suite 1711 passed, full web suite 2272 passed, typecheck clean across workspaces. Logged to docs/ERRORS.md; concept saved to gbrain (concepts/clerk-session-token-email-claims).

### Files changed
- `apps/api/src/routes/agency-platforms/connection.routes.ts` — revoke actor via authenticated email, after access check
- `apps/api/src/routes/clients.ts` — same for DELETE /clients/:id
- `apps/api/src/routes/token-health.ts` — email resolution moved into the two revoke handlers; helper no longer returns userEmail
- `apps/web/src/app/(authenticated)/connections/page.tsx` — disconnect error parsing; dead revokedBy removed
- Tests: `agency-platforms.security.test.ts`, `clients.security.test.ts`, `clients.routes.test.ts`, `token-health.security.test.ts`, `agency-platforms.routes.test.ts`, `authorization.test.ts`, `connections/__tests__/page.test.tsx`
- Docs: `docs/ERRORS.md`, `tasks/todo.md`, `concepts/clerk-session-token-email-claims.md` (gbrain write-through)

### Decisions made
- Keep the Clerk-API fallback in code rather than relying on a Clerk session-token template change (dashboard config); verified emails only, unchanged security posture. See docs/ERRORS.md residual note.

### Next steps
- Commit alongside the in-flight WIP (fix depends on the uncommitted `resolveAuthenticatedUserEmail` helper in authorization.ts) and deploy; then verify a real disconnect against production.
- Optional: add the email claim to Clerk's session token template so JWTs carry it directly.

## Session: 2026-09-26/27 — Client invite flow 10X redesign (PR #73)

### What was done
- Executed plan 2026-09-26-0931 end to end: U1-U11 (ingest middleware fix, non-destructive selection reset, reason-resolver CTA, receipt-first PortfolioSelector on both surfaces with server-validated saves, named-platform checklist, server-truth landing states, intake audit, manual-grant checklist, design-contract walker, token-scrubbed funnel events), then a simplification pass.
- Ran ce-code-review (run 20260927-104425-d1ca0db7, 11 reviewers + cross-model codex pass): verdict Not ready; fixed all 4 P1 blockers (Sentry token leak, OAuth code/state in PostHog, save deadline, assetsLoaded gate) plus the Vercel build break the gate fix caused.
- Visual QA on the live invite (browser capture, rule + taste gates): fixed the REQUEST_NOT_FOUND terminal gap, the duplicated security badge, 390px CTA wrapping.
- Review batch fixes: A (API scope validation unified, WithNames ids validated, 403->409, 500/502 tests), B (prefill prune-to-empty, popup resume effect, save/reset race guard), C (walker silent-pass surfaces: rgb-wrapped accent regex, handler-first button regex + legacy ratchet, callback page migrated to v2 tokens, directory-walk coverage).

### Files changed
- apps/web: proxy.ts, invite page + flow components, client-auth components, lib/invite/*, lib/analytics/*, sentry.client.config.ts, platforms/callback page, walkers and their tests
- apps/api: assets.routes.ts, schemas.ts, assets.meta.test.ts
- packages/shared: (types added during U1-U11 per plan; see plan)

### Decisions made
- See DEC-010 through DEC-013 in docs/DECISIONS.md.
- Review residuals: 23 actionable P2/P3s tracked in the PR Known Residuals; #14 (Graph-discovery caching) resolved as "do not - plan stop condition" with post-deploy 502 monitoring; #24 (PortfolioSelector fetch-surface removal) recorded as a settled conflict vs KTD5, not applied.

### Next steps
- Merge PR #73; run the post-deploy checklist in the PR body (ingest smoke, token-scrub spot-check, Meta save 502-rate watch, heuristic re-score >= 28/40).
- Migrate the tracked legacy button-contract backlog (ratcheted in button-contract.design.test.ts).

## Session: 2026-09-13/14 — App craft and motion plan implementation (PR #56)

### What was done
- Implemented plan 2026-09-13-001: intake persistence (API + migration), SingleSelect keyboard semantics, button pending/focus states, wizard sessionStorage draft + customize-step validation, invite finalizing state, single modal lifecycle owner, motion tokens, DESIGN_SYSTEM.md v2.3.
- Landed prior-session WIP as 12 reviewable commits; added the design-system motion contract; ran a full ce-code-review (24 findings, 18 applied in fix(review) 0df1dc2); opened PR #56.

### Files changed
- apps/api: intake.routes.ts, schemas.ts, completion.routes.ts, access-request.service.ts, schema.prisma + migration, new route tests
- apps/web: contexts/access-request-context.tsx, invite page, wizard page, ui/button|single-select|sidebar, manage-assets-modal-shell, connections/clients/layout pages, globals.css, DESIGN_SYSTEM.md, new behavior tests
- packages/shared: intakeResponses on ClientAccessRequestPayload

### Decisions made
- Intake answers stored on AccessRequest.intakeResponses (nullable JSONB); label-keyed fallback for id-less legacy forms; 422 INVALID_INTAKE_FORM for mixed ids; revoked/completed gated 404.
- Wizard draft: per-agency sessionStorage key, version-stamped, whole-draft discard on invalid, throw-safe storage helpers.
- Motion: six semantic tokens; reduced motion stricter than MotionConfig (fades suppressed) per plan.
- Review residuals #7/#9/#16/#23 accepted into PR Known Residuals.

### Next steps
- Phases 4-5: carry polish to dashboard/onboarding/settings/diagnostics; browser/device matrix + contrast + reduced-motion browser verification; performance traces.

# Session Log

Append-only log of what was done each session. Newest first. Read the last 3–5 entries at session start to get current status.

---

## Template (copy for new entries)

```markdown
## Session: YYYY-MM-DD — [Brief title]

### What was done
- Item 1
- Item 2

### Files changed
- `path/to/file` — what changed

### Decisions made
- [Brief note; add full DEC to docs/DECISIONS.md if significant]

### Next steps
- What to pick up next time
```

---

## Session: 2026-09-26 — Client invite flow 10X plan: critique → plan → review; execution paused on merge

### What was done
- Ran a dual-agent UX critique of the client invite flow (`/invite/92190f8e1c81`, Meta step): heuristic score **15/40 (Poor)**, 7/8 cognitive-load checks failed, no dark patterns. Full report + snapshot at `.impeccable/critique/2026-09-26T15-53-26Z__ps-web-src-app-invite-token-client-invite-page-tsx.md`.
- Root-caused the production PostHog 404s: `apps/web/src/proxy.ts` middleware runs invite visitors' `/ingest/*` beacons through Clerk `auth.protect` — one-line matcher fix, bundled as plan unit U1.
- Wrote the 10X redesign plan via ce-plan (bootstrap, Deep, 11 units) with three research subagents + a flow-gap analysis. Two pre-existing defects surfaced: mid-flow refresh loses all wizard state (falls back to intake), and intake answers are never submitted — the API endpoint validates then discards (stored TODO).
- Ran ce-doc-review non-interactively: 7 in-process reviewers + 2 cross-model peers (codex/GPT-5.6-luna; adversarial + product-lens peers exited, named in coverage). Applied 3 fixes; Jon confirmed folding the remaining 20 proposed fixes + 2 decisions into the plan (new KTD13 token-security contract; U8 gained the intake-persistence backend half; U7 prefill source is an Open Question).
- ce-work start blocked by the plan's own stop condition (KTD8: land after `codex/meta-app-review-proof` merges — currently 3 unpushed commits, 216 dirty files, 35 behind main). Jon chose to wait.

### Files changed
- `docs/plans/2026-09-26-0931-feat-client-invite-flow-10x-redesign-plan.md` — new unified plan, implementation-ready
- `CONCEPTS.md` — added `Owner Business` entry
- `.impeccable/critique/…` — critique snapshot (untracked)

### Decisions made
- 10X rethink over in-place fixes; whole-flow scope; must-fix gates: plain language/trust, visible CTA + honest status, design-system conformance (all session-settled, annotated in plan KD1–KD5).
- Consolidate both portfolio selectors into one component (KTD5); checklist status model replaces the percentage (KTD6); measurement included (KD5).
- Execution sequencing: fresh branch strictly after the Meta app-review branch merges.

### Next steps
- Merge `codex/meta-app-review-proof` → main, then re-invoke `ce-work` with `docs/plans/2026-09-26-0931-feat-client-invite-flow-10x-redesign-plan.md` (units U1→U11; U1 first, U6 parallel track).
- Decide the U7 Open Question (resume prefill: fulfillment-row derivation vs one sanctioned payload field) before U7 lands.

---

## Session: 2026-09-13 — Content calendar Week 1 shipped (Snapchat guide + cluster push)

### What was done
- Implemented Week 1 of `marketing/content/CONTENT-CALENDAR-SEPTEMBER-2026.md` end to end.
- Finished the pre-existing Snapchat draft through blog-pipeline phases 4–7: exact keyword "Snapchat Business Manager" front-loaded in meta title/H1/first 100 words; 3 cited external sources (Snapchat Business Help Center roles docs ×2 + Snap Q2-2026 investor results for the 493M DAU stat); internal links 1→5 incl. exact-anchor to the cluster post; tags/meta/relatedPosts normalized; scored 9/10.
- Cluster push on `best-client-onboarding-software-agencies-2026`: title/H1 now "Best Agency Client Onboarding Software for Agencies (2026)…" (exact cluster term, #8 phrase preserved); exact phrase moved to intro para 2; meta description trimmed to ≤160; 6 exact-anchor inbound links added across checklist, questionnaire, how-to-onboard, and the Snapchat guide; closing CTA refreshed with /pricing path.
- Both commits passed the pre-push production build gate; both live URLs verified via curl (title + meta present in rendered HTML at authhub.co).
- KEYWORD-TRACKER.md: added `snapchat business manager` (+ long-tail) Tier-2 rows; CONTENT-STRATEGY-2026.md inventory → 21 posts.

### Files changed
- `apps/web/content/blog/snapchat-ads-access-agencies.md` — new post (commit 552bfab)
- `apps/web/content/blog/best-client-onboarding-software-agencies-2026.md` — title/intro/meta/tags/CTA (commit f86ab29)
- `apps/web/content/blog/client-onboarding-checklist.md`, `client-onboarding-questionnaire-27-questions.md`, `how-to-onboard-new-marketing-client.md` — exact-anchor internal links
- `marketing/content/CONTENT-CALENDAR-SEPTEMBER-2026.md` — Week 1 marked done (committed for the first time)
- `marketing/content/KEYWORD-TRACKER.md`, `marketing/CONTENT-STRATEGY-2026.md`, `tasks/todo.md` — tracking sync

### Decisions made
- Cluster title keeps "Best … for Agencies (2026)" skeleton (protects the #8-ranking term) and nests "Agency Client Onboarding Software" one word in — expands coverage of the 7-term cluster without breaking the proven ranking.
- FAQPage JSON-LD deferred: needs a code change to the blog page (TDD) — tracked as follow-up in tasks/todo.md.

### Next steps
- Week 2 (Sep 15–21): GTM Access guide (`gtm-access-agencies`) + Microsoft Ads Access guide (`microsoft-ads-access-agencies`), full pipeline.
- FAQPage JSON-LD schema follow-up (tasks/todo.md).
- Sep 30: verify ≥2 of 7 cluster terms on page one; add 5 keywords to SnowSEO rank tracking.

---


## Session: 2026-09-13 — Square icon chips + app-wide button cohesion sweep

### What was done
- Fixed reported dashboard bug: square Brandfetch logos sat in `rounded-full`
  chips, showing the ground behind the logo corners. Chips are `rounded-none`
  (binary radius); `PlatformIcon` fallback tile likewise.
- Full button-cohesion sweep: 133+ hand-rolled button-like elements across 46
  files migrated to the five Button variants (four parallel batches);
  off-palette fills (indigo/yellow/slate/raw hex/teal-as-primary) eliminated.
- Dashboard header CTA restored to a true brutalist (uppercase, diagonal
  press); previously neutered via className (`normal-case hover:translate-x-0`).
- New global enforcement: `src/app/__tests__/button-contract.design.test.ts`
  walks app/** + components/** and bans hand-rolled button signatures and
  variant-fighting overrides (incl. zeroed hovers, resting `shadow-none`).
  Walker regex survives `=>` in arrow-function attributes.
- `PlatformCard` onto the contract card (was deprecated `clean-card` +
  `rounded-xl`); its Connect button no longer cancels primary's shadow/lift.
- DESIGN_SYSTEM.md changelog v2.2.0 documents mapping rulings.

### Files changed
- `apps/web/src/app/(authenticated)/dashboard/page.tsx` — chips + CTA + 2 hand-rolled buttons
- `apps/web/src/components/ui/platform-icon.tsx` — square fallback tile
- `apps/web/src/app/__tests__/button-contract.design.test.ts` — NEW enforcement walker
- 44 files swept (see commits b51d399, 87c915f, e0c2717, b6523db for lists)
- `apps/web/DESIGN_SYSTEM.md` — v2.2.0 changelog

### Decisions made
- Ink-filled CTAs → primary (app) / secondary (marketing); teal action fills →
  primary; quiet destructive → ghost + `text-danger-ink` text token.
- Controls (tabs/pills/accordions/dashed add-field/pagination) stay raw,
  tokenized to rounded-none + on-palette — not Button-wrapped.
- Sanctioned: link-style ghost (`px-0` + `hover:bg-transparent`) and
  padding-only Button overrides. Dark-ground CTAs may add `border-white`.
- Branch renamed (not by session): `jonhigh1/spiderfish` →
  `jonhigh1/fix-access-request-visuals`.

### Verification
- web suite: 1276 passed / 11 failed — all 11 proven pre-existing at base
  commit 86fa16a via throwaway worktree (settings page/view-counts +
  access-requests success analytics; see docs/ERRORS.md). typecheck clean.
  Production build + visual QA (dashboard, pricing, about, blog,
  /design-system showcase) confirmed variant pairs and square icon tiles.
- Next steps: fix the pre-existing settings/success test failures; consider
  deleting `components/marketing/hero-copy-rewrite/` experiment.

### Update (same session)
- Merged `origin/main` (2 conflicts resolved: token-health filter a11y fix
  kept with contract styling; lazy Clerk imports + Button import combined).
  Main cleared 10 of the 11 pre-existing settings failures; the last
  (success-page analytics test) was stale against the PostHog serialization
  and is fixed here. Post-merge: walker 0, suite 1315/0, typecheck clean
  (after `prisma generate` in the fresh worktree), build pass. Branch pushed;
  PR #55 opened against main.

## Session: 2026-09-13 — Infisical off the Prisma transaction; bounded list APIs

### What was done
- Moved Infisical I/O out of `createClientConnection`'s Prisma `$transaction`: store secrets first, then a short DB write of `secretId` only, with secret cleanup if the DB write fails.
- Logged `GRANTED` audit rows (agencyId, no token material) after persist.
- Added `(status, expiresAt)` indexes on `PlatformAuthorization` and `AccessRequest`, and `(resourceType, resourceId, createdAt)` on `AuditLog`. Migration committed, not applied to production.
- Capped `GET /agencies/:id/access-requests` and `GET /connections` at default 50 / max 100. Connection list uses summary select. Slimmed `getClientDetail` nested payload (no `secretId` on the response).

### Files changed
- `apps/api/src/services/connection.service.ts` — Infisical-first persist; slim bounded connection list
- `apps/api/src/services/access-request.service.ts` — default/capped list + slim select
- `apps/api/src/services/client.service.ts` — slim client-detail query and response
- `apps/api/src/routes/access-requests.ts`, `apps/api/src/routes/token-health.ts` — list query validation
- `apps/api/src/lib/list-pagination.ts` — shared default 50 / max 100
- `apps/api/prisma/schema.prisma` + `apps/api/prisma/migrations/20260913_status_expires_at_and_audit_indexes/migration.sql`

### Decisions made
- DEC-009: Infisical stays off the Prisma transaction; list APIs are bounded summaries

### Next steps
- Review draft PR against main. Do not apply the index migration to production from this PR.
- Token-health live-verify change, BACKGROUND_WORKERS, Redis cache, and frontend RSC remain out of scope.

---

## Session: 2026-09-12 — Settings page revamp on Design System v2.0 (hallmark + ce-plan + ce-work)

### What was done
- Planned with `hallmark redesign` + `ce-plan`: plan at `docs/plans/2026-09-12-1912-feat-settings-page-revamp-plan.md` (Durable, 8 units), reviewed by 5 doc-review personas (19 fixes applied; cross-model pass skipped — no external egress sanctioned).
- Settled with Jon: DESIGN_SYSTEM.md v2.0 canonical (root design.md stale); keep four tabs + `?tab=`; utilitarian mood; remove the Team Members placeholder and fake-save Notifications card; container widened to `max-w-7xl`.
- Built test-first. U1 contract tests (source walker + rendered per-view counts) went red on 15 of 25 files, then U2–U7 turned them green: `SettingsTabs` shell (identity line, ARIA tab rail, Home/End, two-ring focus), `SettingsRow`/`SettingsGroup`, General (PlanStrip ink-panel + usage rows + profile rows), Billing (hero strip + rows, plan-comparison debt cleared: 7 shadows, font-dela, 22 generic colours), Webhooks (endpoint strip, rows, gradient gone), Agents (MCP strip, approval brutalist only with `connect=`). U5–U7 ran as parallel worktree workers and were merged in dependency order.
- Render gate (visual-qa, dev server with auth bypass, no API): rule layer clean at 1440/768/390/320 (no overflow, no console errors, tap targets ≥24px); two blind taste passes → PASS-WITH-NITS. Fixes: coral limited to one action per view, tier-card emphasis, panel label consistency, 320px rail.
- Verification: settings suite 18 files / 335 tests green; full web suite 1239 passed with the one pre-existing `access-requests/success` failure; `tsc` clean; `next build` succeeds and `/settings` prerenders statically; eslint 0 errors.

### Files changed
- `apps/web/src/components/settings/**` — shell, row primitive, all four tabs, tests; `team-members-card.tsx` and `notifications-card.tsx` deleted
- `apps/web/src/app/(authenticated)/settings/page.tsx` — no Reveal, square skeleton, PlanStrip wired
- `apps/web/src/app/globals.css` — reduced-motion hover transform rule
- `apps/web/DESIGN_SYSTEM.md` (v2.1.0 changelog, clean-card deprecated), `design.md`/`DESIGN.md` (stale notice), `docs/DECISIONS.md` (DEC-008), `.hallmark/log.json`

### Decisions made
- DEC-008 (see DECISIONS.md).

### Next steps
- Follow-ups from the plan's Deferred section: real team management; persisted notification preferences; delete `.clean-card` from globals.css; regenerate root design.md from v2.0; fix `stat-card.tsx` radius/shadow; `UsageDisplayInline` → `Link`.
- Render gate ran without a backend; loaded-data states are covered by the rendered tests only. Worth one manual look at `/settings?tab=billing` on staging with a real subscription.
- Judge nits left open: "Included on every plan" list wraps unevenly at some widths; the agents empty-state link sits lower than its row label.

---

## Session: 2026-09-11 — ce-simplify-code pass on uncommitted AGENCY→SCALE tier rename

### What was done
- Ran compound-engineering simplify (3 reviewers: reuse, quality, efficiency) on the uncommitted diff (`git diff HEAD`, code files only).
- Applied 7 findings; skipped 4. Restored `PRICING_DISPLAY_TIER_ORDER.map` in plan-comparison (removed two identity maps, hardcoded tier arrays, shadowed `tierIndex`, dead `SubscriptionTier` import); fixed broken describe/brace nesting in shared `types.test.ts` (file did not parse); renamed `isAgencyTier`→`isScaleTier`; current-plan-card now reads tier descriptions from `PRICING_DISPLAY_TIER_DETAILS`; repaired indentation damage in 6 files.
- Verification: web tsc clean; shared jest 150/150; eslint 0 errors (2 pre-existing warnings). API tsc still fails (5 errors) and 11 web tests still fail — both pre-existing from the incomplete rename, not from this pass.

### Files changed
- `apps/web/src/components/settings/billing/plan-comparison.tsx` — grid iterates shared tier order again; identity maps removed
- `apps/web/src/components/settings/billing/current-plan-card.tsx` — description from shared details
- `apps/web/src/components/settings/billing/usage-limits-card.tsx` — variable rename
- `apps/web/src/components/settings/billing/billing-hero.tsx`, `apps/web/src/components/marketing/pricing/pricing-tiers.tsx`, `apps/web/src/lib/comparison-data.ts` — indentation only
- `packages/shared/src/__tests__/types.test.ts` — brace nesting + SCALE rename completed

### Decisions made
- Did not widen scope to finish the rename in `apps/api` (Prisma `tier` column holds `'AGENCY'` strings in prod; Creem config keyed by tier). That is a migration decision, not a simplification.

### Follow-up (same day): closed the rename gaps the parallel T3 session left open
- Parallel session 1ef6e095 renamed the API source files (creem.config, agency.service, quota.service, routes/agencies). Closed here: quota-enforcement `suggestedTier` now uses `getNextTierForCheckout` (was hardcoded AGENCY/PRO); checkout success copy; pricing-tier-card legacy map (was writing AGENCY/PRO to localStorage); analytics `BillingPlanSlug` `agency`→`scale` (SCALE previously fell back to `starter`); Prisma comment; 19 test files; migration `20260911_rename_agency_tier_to_scale` for `subscriptions.tier` and `agencies.subscription_tier`.
- comparison-data.ts: restored Leadsie's real plan names/prices (Starter $59 / Agency $129 / Pro $299, verified at leadsie.com/pricing) and AuthHub Scale at $149 monthly (rename had produced "Leadsie Scale $124").
- Verification: web tsc, api tsc, shared jest 150/150, api rename tests 178/178, web scope 241/245.

### Follow-up 2 (same day, via opus subagents): SOC 2 removal, connector count, Clerk backfill, rollout plan
- SOC 2 claims about AuthHub removed from apps/web/src, privacy policy, blog content, and marketing strategy (AuthHub is not SOC 2 compliant). Security copy now says Infisical-backed tokens, audit logs, GDPR ready.
- `SUPPORTED_PLATFORM_COUNT` (20, derived from PLATFORM_HIERARCHY products) exported from shared and interpolated into pricing FAQ, JSON-LD, comparison data, Schema.tsx; blog literals updated. Leadsie blog no longer lists WhatsApp / YouTube Ads / DV360 / CM360.
- `apps/api/scripts/backfill-clerk-tier-agency-to-scale.ts` (+21 tests): dry-run default, `--apply`, `--limit`; fingerprints tier by quota limits because 'AGENCY' meant $79 before 2026-03-14 and $149 after.
- `quota.service.ts` upgrade path aligned with middleware (no `/checkout?tier=undefined`).
- Plan: `docs/plans/2026-09-11-1316-refactor-agency-to-scale-tier-rollout-plan.md`; DEC-007 added.
- Verification: typecheck clean (5 workspaces); shared jest 154/154; API full suite 1318 passed; web full suite 912 passed, 1 unrelated pre-existing failure.

### Follow-up 3 (same day): comparison content + PostHog tool
- AgencyAccess comparison page aligned to Starter/Growth/Scale; fixed false "AuthHub lacks intake forms / Shopify / Klaviyo"; savings badge now sourced ($108/yr Starter yearly vs AgencyAccess $33 annual).
- Leadsie blog: invented "Other Platforms" column replaced by AgencyAccess with every number traced to comparison-data.ts; Leadsie "~8 platforms" corrected to 31+; unsourced ROI/AES-256/CSV claims removed.
- `apps/api/scripts/posthog-rename-plan-filters.ts` (+35 tests): finds insights/dashboards/cohorts/actions/flags/experiments filtering `plan = agency`, widens to `['agency','scale']` (or replaces); dry-run default; needs POSTHOG_PERSONAL_API_KEY. Runbook in plan U10. Legacy insight `filters` blobs are not PATCHable and are reported for manual fix.

- PostHog dry run (project 309879): 13 saved objects scanned, 0 filter on `plan = agency`. U10 closed with no writes.

### Rollout (2026-09-12)
- PR #44 → `main` `1dc85a5`. Render migration applied at boot, `/health` 200; Vercel live with Scale. Data gate: no AGENCY rows. Clerk dry run: 29 users, 0 on a retired tier — no apply needed. PostHog: nothing to apply. Render logs clean.
- Branch note: the shared checkout sits on `feat/self-healing-deploy-pipeline` (another session). The rename was committed from a separate worktree off `main`; duplicate uncommitted copies in that checkout were restored to HEAD after confirming byte-identity with `main`, so the deploy-pipeline branch merges `main` cleanly.

### Next steps
- Follow the rollout plan (U1 commit split → U2 commits → U4 content decision → U7 deploy → U8/U9 Clerk backfill dry-run/canary/apply → U10 PostHog).
- Previously listed items now resolved:
- Decide on 4 failing `comparison-data.claims.test.ts` assertions: new copy claims "SOC 2 Type II" (test forbids SOC 2 claims), says "15+ platforms" (test expects "19 platform connectors"), and drops the "N clients/month" phrasing. Either the copy or the test must change.
- Backfill Clerk `publicMetadata.subscriptionTier` for users still holding `'AGENCY'` (no script exists; `TIER_LIMITS['AGENCY']` is undefined after the rename).
- PostHog: `plan` property value `agency` becomes `scale` for subscription events; update dashboards/filters.
- agencyAccess page `pricingComparison.authhub.starter` is $29 but lists Growth-only features (white-label, custom domain, API). Content review needed.

---

## Session: 2026-09-10 — Snapchat Ads OAuth connector (U1-U9) + review hardening

### What was done
- Planned (ce-plan) + executed (ce-work) the Snapchat Ads OAuth connector: capability flip to oauth/automatic/live_verify, SnapchatConnector (BaseConnector; form-body token protocol, two-phase best-effort discovery), agency + client-invite OAuth registration, retryable-vs-terminal refresh classification with rotation persistence, full manual-path removal (web + API), truthful health/reconnect UI (needs_reconnect status, minutes-level expiry copy, status-gated refresh), gated legacy-row migration script.
- ce-simplify-code pass (11 fixes: shared status types, single findUnique, registry-owned URLs, typed countdown).
- ce-code-review (9 local reviewers + codex cross-model adversarial peer): 10 actionable findings — all applied across 7 fix(review) commits (retryable transport/credential classification + base refresh hook + fetch timeouts; snapchat identity degradation + requested-platform gate; migration CAS guard; dead countdown branch; job-handler audit tests; ms-precision server health math; fail-fast on missing refresh_token). 2 validator findings dropped with reasons; residuals recorded in the review artifact.

### Files changed
- Branch feat/snapchat-ads-oauth-connector (19 commits, a5e6215..HEAD): packages/shared types + tests; apps/api connectors/agency-platforms/client-auth/job-handlers/token-lifecycle/connection.service/scripts + tests; apps/web invite/onboarding/token-health/client-detail/ui libs + tests.

### Decisions made
- DEC-004/005/006 (see DECISIONS.md): two registered redirect URIs; legacy rows to 'revoked' with CAS + operator gate; needs_reconnect status + ms-precision server health.

### Next steps
- Operator gates (plan Verification Contract): create Snap OAuth apps (register BOTH redirect URIs at creation; immutable after), staging gate, production gate.
- U9 production apply only after explicit approval (dry-run first).
- Deferred: blog rewrite (snapchat-ads-access-agencies.md premise false post-launch), state-expiry recovery affordance, per-platform scan cadence, docs refresh (APP_OVERVIEW/PRODUCTION_OAUTH_SETUP/PRD/CLAUDE.md Redis wording).
- Open residuals: zero-ad-account fulfillment truth unconsumed (hasNoAssetsSignal has no snapchat branch), agency callback state/URL platform binding, scripts/ outside api tsconfig.


## Session: 2026-09-04 — v2.0 tail: review fixes, AA text pass, animation gate, rulings

### What was done
- Ran ce-code-review (6 reviewers + validator; codex peer died on MCP transport — lens degraded). Verdict Not ready → 24 findings; Jon chose apply-all. 8 fix subagents applied all 21 actionable findings (P0 verified-email agency binding, ticker renderer, AA text on edited lines, hairline token, showcase prune, contract tests, shadow/token integrity, Clerk client consolidation) — committed fix(review) 237feed. Merged to main, pushed.
- AA text audit (`docs/aa-text-audit.md`): classified 505 raw text-teal/coral sites; Jon approved full swap. 453 sites/131 files swapped to ink tokens on feat/aa-text-swap; also repaired 16 malformed dead classes (text-teal-90/coral600/900). Merged, pushed (4ab4e00).
- Animation gate hoisted to root layout (AnimationGate component) — animate-pulse skeletons + reveals now work on ALL route groups; root-layout reachability contract pinned in new test. Pushed 91ed325.
- Utility adoption: StatCard labels → .label-micro (red→green); dashboard Active Connections header → .ink-panel with ground-aware child rules. Pushed c95f1cd.
- Three delegated rulings executed: (1) brutalist rule rewritten to "one per view — the view's primary action" (48 in-app call sites made 'marketing-only' indefensible); dashboard duplicate createRequestButton demoted to primary on panel mount. (2) Hover AA pass: hover:/group-hover: text-coral/teal → ink tokens, 28 files, dark: untouched. (3) Footer column headings → .label-micro; comparison-table thead reclassified display-role. Pushed 7f8b7d4.

### Decisions made
- Brutalist = per-view primary action, not marketing-only (doc + button.tsx docstring updated)
- Coral-family text on light ground is always danger-ink — static or hovered; alpha hover variants dropped (sub-AA)
- Comparison-table thead is a display role, excluded from micro-label adoption

### Next steps
- zsh gotcha: unquoted $var does NOT word-split — xargs for multi-file perl passes
- Hover-state contrast on dark grounds unverified in browser (raw tokens assumed correct)
- `/design-system` showcase: consider public (non-Clerk) route for review flows

## Session: 2026-09-03 — Design System v2.0 (lazyweb extraction → delta plan → TDD execution → adversarial review)

### What was done
- Extracted a full design-DNA kit from lazyweb.com (Dembrandt + authored-CSS verification): `~/Desktop/lazyweb.com-design-kit/` (brief.md, tokens.json, scaffold.html, preview.png). Key production moves: mid-weights 650/750, dual green tokens per WCAG ground with in-CSS rationale comments, two-ring focus, tracking inversion (display −0.04em / micro +0.11em), radius binary.
- Wrote `docs/design-system-delta-plan.md` (3 phases, acceptance criteria). Jon decided: acid hero-only, stay teal (add `--success-ink`), full binary radius, drop Fraunces.
- Executed 7 units TDD where components were touched (red→green observed at StatusBadge, Button, shadow validators): b69922b subtraction (Fraunces/electric/acid), 56c8da7 shadow budget + hairline, 895ba9a animation cut, d93c5b7 mono labels + tracking, e00ec7f AA ink tokens, bf3b480 buttons 10→5 + two-ring focus, 7a87fa4 radius flip + ink panel + DESIGN_SYSTEM.md v2.0.0.
- Ran ce-code-review (6 reviewers + validator batch; codex peer died at startup on MCP transport — lens degraded). Verdict: Not ready → 24 findings. Jon chose apply-all: 8 fix subagents, all 21 actionable addressed, committed as 237feed. Deferred by design: #1 bind-policy rework, #8 utility consumer adoption, brutalist-on-in-app-CTAs tension.
- Final state: web 840 passed / api 1099 passed / typechecks clean / lint 0 errors. Recorded DEC-003.

### Files changed
- `apps/web/src/app/globals.css`, `tailwind.config.ts` — v2.0 token layer (see DEC-003)
- `apps/web/src/components/ui/{button,status-badge}.tsx` + design tests — contracts
- `apps/web/DESIGN_SYSTEM.md` — rewritten to v2.0.0 (production moves, contracts, verification)
- ~40 consumer files — electric/acid→coral, shadow collapse, variant migration
- `apps/api/src/lib/{authorization,clerk}.ts`, `agency-resolution.service.ts`, `internal-admin.service.ts`, `middleware/auth.ts`, `quota.service.ts` — verified-email P0 fix + Clerk client consolidation (rode the branch; reviewed)
- `docs/design-system-delta-plan.md`, `docs/DECISIONS.md` (DEC-003)

### Decisions made
- DEC-003 (above). Review observations logged to the task-observer workspace (0030: production-moves label count vs gate).

### Next steps
- Push `feat/design-system-v2` and open PR (on Jon's go).
- Residual design calls: brutalist variant on 9 in-app CTAs (doc says hero-only) — loosen doc or remap; wire .label-micro/.ink-panel consumers; 428 raw text-teal/coral sites repo-wide (dark-ground-aware sweep).
- Operational: `/design-system` route is Clerk-gated; consider a public token-showcase for review flows.
- Gotcha for CLAUDE.md: `npx vitest run` from repo root picks the wrong config (node env, mass failures) — always run from `apps/web`.

## Session: 2026-09-03 — Meta Business Portfolio creation (Leadsie parity+)

### What was done
- Analyzed Leadsie's Facebook asset-creation flow (help article 44) and mapped it to our architecture. Finding: ad-account/catalog creation and the OBO grant engine already existed; the real gap was Business Manager creation for zero-portfolio clients.
- Built the full creation path TDD-first (shared schema → connector → service → routes → components): `POST /me/businesses` on the client token, guided Page prerequisite check (`GET /me/accounts`), one-pass wizard flow (create BM → inline ad-account creator), and an unverified-business setup checklist with verification/payment deep links.
- Contained refactor: extracted `getActiveClientAccessToken` in `meta-asset-creation.service.ts` (4 duplicated guard sequences → 1 helper).
- Extended `/test/asset-creation` harness with the two new components; visual QA at desktop + mobile.

### Files changed
- `packages/shared/src/types.ts` (+test) — `selection.source` accepts `'created'`
- `apps/api/src/services/connectors/meta.ts` (+test) — `getUserPages`, `createBusiness`, URL helpers
- `apps/api/src/services/meta-asset-creation.service.ts` (+new test file) — `createBusiness`, `getUserPages`, token helper; `getAssetCreationLinks` extended
- `apps/api/src/routes/client-auth/asset-creation.routes.ts` (+new test file) — 2 new endpoints
- `apps/web/src/components/client-auth/MetaBusinessCreator.tsx` (new), `MetaBusinessSetupChecklist.tsx` (new), `MetaAssetSelector.tsx` (zero-portfolio branch, checklist, state resets) (+2 new test files)
- `apps/web/src/app/test/asset-creation/page.tsx` — sections 5/6

### Verification
- api 1093 passed · web 811 passed · shared 149 passed · CLI 7 passed · typecheck clean. Visual QA via harness on port 3011 (`NEXT_PUBLIC_BYPASS_AUTH=true`; port 3000 was serving an unrelated process).

### Decisions made
- DEC-002: creation service persists business selection into `metadata.meta` (save-assets schema strips it; grant flow reads server-side state only).

### Next steps
- Live-Meta E2E checklist in `tasks/todo.md` (token scope, BM-limit error shape, primary_page claim, unverified-BM ad account, managed_businesses on fresh BM, deep-link URLs) — needs a throwaway test user with a Page but no BM.
- Follow-up bug: `MetaAssetCreator` hardcoded timezone ids (1..16) vs backend sparse ids.


### What was done
- Implemented Lazyweb recommendation "Agency logo strip under the CTAs" per the Markdown report (generic greyscale placeholder wordmarks, caption "Trusted by marketing agencies").
- Read DESIGN_SYSTEM.md before UI work; reused font-mono, text-ink with opacity, Reveal delay pattern.
- Verified visually at desktop 1440px and mobile 375px: strip below CTA pair, left-aligned on desktop, centered on mobile, no overflow/overlap, primary CTA above the fold.

### Files changed
- `apps/web/src/components/marketing/hero-section.tsx` — trust strip (caption + five inline SVG wordmark placeholders, aria-hidden) added after CTA block in left column; nothing else touched.
- `docs/SESSION-LOG.md` — this entry.

### Verification
- `npm run typecheck --workspace=apps/web` clean. TDD-exempt (styling-only).

### Decisions made
- Placeholder wordmarks are inline SVG shapes (no real company names) per owner-approved brief; `aria-hidden` since decorative.

### Next steps
- Replace placeholder wordmarks with real customer logos once real customers approve logo use.

---

## Session: 2026-03-29 — INP improvements and client perf gate

### What was done
- Dashboard: synchronous pending UI on Create Request, `usePrefetchQuota` on mount, tests for immediate loading while quota is pending.
- Invite: lazy PostHog via `capture-posthog`, server wrapper + `dynamic()` client split, reduced-motion scroll behavior; loader tests for dynamic import path.
- Access request edit: save button loading/`aria-busy` hygiene; `HierarchicalPlatformSelector` respects `prefers-reduced-motion` for collapse duration.
- Regression: `scripts/perf/web-inp-smoke.sh`, root script `npm run perf:web:inp-smoke`, workflow `.github/workflows/web-client-perf-gate.yml` (Vitest smoke, no production build secrets).

### Files changed
- See git diff for `apps/web` (dashboard, invite, edit, hierarchical selector), `scripts/perf/web-inp-smoke.sh`, `.github/workflows/web-client-perf-gate.yml`, `package.json`, `AGENTS.md`, `docs/SESSION-LOG.md`.

### Field monitoring and refinement loop
- **Vercel Speed Insights**: After deploy, watch **P75 INP** for `/invite/[token]`, `/dashboard`, and `/access-requests/*` for ~2 weeks; treat low sample counts as directional until roughly 100+ sessions per route.
- **Lab**: Chrome Performance on Create Request, invite Continue, edit Save; confirm first paint after input shows loading/disabled state.
- **Repeat**: measure → hypothesis (bundle vs async handler vs animation) → minimal change → `npm run perf:web:inp-smoke` + targeted tests → ship → measure again.

### Verification (same session)
- `npm run perf:web:inp-smoke`, `npm run typecheck`, and `npm run lint` (warnings only) succeeded.
- `packages/shared` Jest tests updated for `STARTER` / `GROWTH` / `AGENCY` tier model and Google product count in `PLATFORM_HIERARCHY`.
- `apps/web` full `vitest run` still reports failures in legacy Phase 5 TDD files (`access-level-selector.test.tsx`, `client-selector.test.tsx`); billing/plan/current-plan/usage-widget and `hierarchical-platform-selector` Phase 5 tests were aligned with current UI. Follow-up: repair or skip the remaining Phase 5 client/access-level suites.

### Decisions made
- Client perf gate is **Vitest smoke only** (no Lighthouse CI / bundle byte budget in CI): production `next build` requires valid Clerk keys; bundle checks remain manual via local `next build` output or analyzer when needed.

### Next steps
- Compare Vercel SI P75 INP before/after once sample sizes are meaningful.

---

## Session: 2026-03-17 — Google Ads Manage Assets Consolidation

### What was done
- Consolidated Google Ads access method into the Google Ads product row (spec: google-ads-manage-assets-consolidation.md)
- Removed standalone "Google Ads access method (account-level)" card; single "Google products" section
- ProductCard supports `customContent`; GoogleAdsAccessMethod renders inline when Google Ads enabled
- Updated functional tests: GA4 displayName (use screen for portaled options), Select all/deselect all (correct labels), Manager Account dropdown when MCC, access method radiogroup when enabled

### Files changed
- `apps/web/src/components/google-unified-settings.tsx` — removed Access card, added customContent to Google Ads ProductCard
- `apps/web/src/components/manage-assets-ui.tsx` (ProductCard) — already had customContent; no change
- `apps/web/src/components/__tests__/google-unified-settings.test.tsx` — updated 5 tests for consolidated UI

### Decisions made
- (none; followed spec Option A)

### Next steps
- (none)

---

## Session: 2026-03-16 — Google Ads Access Method Redesign

### What was done
- Redesigned Google Ads section in manage-assets modal from "defaults" dropdown to radio-card choice
- Added RadioCard UI component with badge and tooltip support
- Added GoogleAdsAccessMethod, GoogleManagerAccountSelector, GoogleInviteEmailInput components
- Replaced Fallback behavior section with tooltip on MCC card
- Progressive disclosure: Manager Account dropdown or Invite Email input based on selection

### Files changed
- `apps/web/src/components/ui/radio-card.tsx` — new
- `apps/web/src/components/google-ads-access-method.tsx` — new
- `apps/web/src/components/google-manager-account-selector.tsx` — new
- `apps/web/src/components/google-invite-email-input.tsx` — new
- `apps/web/src/components/google-unified-settings.tsx` — use new components
- `apps/web/src/components/__tests__/google-unified-settings.test.tsx` — update assertions

### Decisions made
- Section retitled to "Google Ads access method (account-level)"
- MCC marked as [Recommended] with fallback info in tooltip only

### Next steps
- (none)

---

## Session: 2026-03-10 — Sentry Webhook Integration Setup

### What was done
- Created comprehensive documentation for Sentry webhook integration setup
- Attempted programmatic setup of Sentry webhook integration via API
- Discovered that Sentry's API doesn't allow creating webhook integrations without existing configured integration
- Created test script for verifying webhook functionality
- Updated monitoring documentation with links to webhook setup guide

### Files changed
- `docs/monitoring/SENTRY_WEBHOOK_SETUP.md` — NEW: Complete setup guide for Sentry webhook integration
- `docs/monitoring/SENTRY_SETUP.md` — Updated: Added link to detailed webhook setup guide
- `scripts/test-sentry-webhook.sh` — NEW: Test script for webhook verification

### Discovery
- Sentry's API requires webhook integrations to be configured through the UI first before they can be used in alert rules
- The organization (authhub) has two active projects: `javascript-nextjs` and `node`
- No existing integrations, sentry-apps, or alert rules exist in the organization
- Alert rule actions require a configured integration/service before they can reference it

### Decisions made
- Manual UI setup is required for Sentry webhook integration (no programmatic API available)
- Created comprehensive documentation to guide the manual setup process

### Next steps
- User needs to manually configure webhook integration in Sentry UI following the setup guide
- Once configured, test the integration using the provided test script
- Verify task files are being created in `.claude/tasks/sentry-issues/`

---

_(Add new session entries above this line; newest first.)_
