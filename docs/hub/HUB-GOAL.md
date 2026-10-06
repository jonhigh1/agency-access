# AuthHub Team Hub — Goal

**Written:** 2026-10-04
**Owner and approver:** Jon
**Status:** Draft. Items marked *proposed* need Jon's confirmation before the Hub treats them as commitments.

---

## Mission

Get AuthHub from a built product with no users to its first paying agencies, without giving up the trust the product sells: truthful status, safe token handling, and a client flow that non-technical people can finish.

## Why this goal

- The product is live at authhub.co and broad: about 20 platform products, OAuth and manual invite flows, intake, branding, token health, offboarding, billing, and an agent/MCP surface.
- The recorded business phase is "built, now distribution," with zero users as of 2026-07-27 (BRAIN.md). Distribution is the unsolved problem.
- Recent engineering (September and October 2026) went into the client invite flow, Meta grant checklist, audits, performance, and security fixes. Several of those changes still need production verification.
- More features will not fix distribution. The Hub should finish and prove what exists, then spend its effort on getting agencies in the door.

## Success criteria (proposed)

The Hub succeeds when all of these are true:

1. **Clean shipping state.** The in-flight work is either landed on `main` with Jon's approval or explicitly parked, and production matches `main`.
2. **Proven core flow.** One real end-to-end run in production (agency creates a request, client completes it, agency sees truthful status) passes for at least Meta and Google, with evidence.
3. **Measured funnel.** PostHog shows the agency signup funnel and the client invite funnel (checklist viewed, item completed, finish with or without pending) with real data.
4. **First agencies.** Jon confirms a target number of agencies that have signed up and sent a real access request, and a target for paying agencies. *(Numbers to be set by Jon; the Hub must not invent them.)*
5. **Honest status docs.** `docs/workspace/status.md`, `BRAIN.md`, and `CLAUDE.md` describe the current product, stack, and user count.

## Workstreams

Run these in order of priority. Workstream A blocks most others. B and D can run in parallel once A is clear.

### A. Land the in-flight work

- Triage the dirty main checkout with Jon (access-request, quota, client-auth assets, connection, and Meta asset-creation routes and services, plus their tests). For each group: what it does, whether its tests pass, and whether it is ready.
- Propose atomic commits by logical change. Commit, push, and deploy only with Jon's approval.
- Resolve the modified `.githooks/pre-push` and its four failing focused tests noted in `docs/audits/2026-10-02-full-flow-audit/pre-push-observation.md`. Jon decides the hook's intended behavior.

**Done when:** the main checkout holds only work Jon chose to keep uncommitted, and every landed change is deployed and healthy.

### B. Prove production truth

Run the open post-deploy checks from recent sessions and record the evidence:

- Platform disconnect and other revoke endpoints work in production for a real session (2026-10-03 `USER_EMAIL_REQUIRED` fix).
- Meta invite flow: decoupled confirm, step-3 grant checklist, declines, and resume, with the agency detail card showing real declines.
- PR #73 post-deploy checklist: PostHog ingest smoke test, invite token scrub spot check, Meta save 502 rate.
- Confirm whether DEC-009's indexes and DEC-007's Clerk tier backfill were applied in production. Report the state; apply nothing without approval.

Fix the truthfulness gaps found by the 2026-10-02 full-flow audit:

- `PUT /agency-platforms/:id/verify` marks a connection verified with no provider check. Design a supported provider verification, or stop claiming "verified." Needs a product decision first.
- Dashboard `pendingRequests` counts only lifecycle `pending`, while products inside `partial` requests still need follow-up. Needs a labeling decision from Jon.
- Zapier appears as a manual platform but has no client invite page or handler. Jon decides whether client-side Zapier invites are in scope.

**Done when:** each item is marked `verified in production`, `fixed`, or `blocked` with the named reason.

### C. Measure the funnel

- Build PostHog dashboards for agency signup to first request sent, and for the client invite funnel using the existing `client_*` events.
- Confirm events carry counts and kinds only, never tokens or personal data (DEC-012).
- Report the baseline. Do not set targets; propose them to Jon.

**Done when:** Jon can open one dashboard and see where agencies and clients drop off.

### D. Distribution

- **ICP.** Write a short brief on which agency segment to target first (for example paid-media agencies onboarding 3+ clients a month), with sources. Jon picks the segment.
- **Content.** Continue the content calendar through the blog pipeline: Leadsie-alternative and comparison intent, platform access guides, and the agency client onboarding cluster. Each post passes the 9/10 gate and is published only with approval.
- **Outreach.** Draft channel experiments (cold email, agency communities, partner or affiliate program) with a clear hypothesis and a way to measure each. Jon approves every send.
- **Activation.** Find and fix the biggest drop-off between agency signup and the first sent request, based on workstream C data.

**Done when:** at least one channel experiment has run with Jon's approval and reported a measured result, and the first agencies from criterion 4 are onboarded.

### E. Keep the house in order (background)

Pick these up only when a worker is free and they do not conflict with A–D:

- Migrate the 22 legacy files under the button-contract ratchet (DEC-010) and the remaining raw coral and teal text sites (DEC-003).
- Update `CLAUDE.md` (Redis, BullMQ, and Redis OAuth state are gone; pg-boss and PostgreSQL state replaced them), refresh `docs/workspace/status.md`, and regenerate or remove root `DESIGN.md` per DEC-008.
- Consider adding the email claim to the Clerk session token template (dashboard change, needs approval).

## Out of scope unless Jon says otherwise

- New platform connectors or major new features.
- White-label subdomains.
- Pricing or plan changes.
- Rewrites or architectural changes not tied to a workstream above.

## Open decisions for Jon

The Hub must ask these before acting on the related work:

1. Which groups of the current uncommitted work should ship, and in what order?
2. What should `.githooks/pre-push` do?
3. How should `PUT /agency-platforms/:id/verify` behave until a real provider check exists?
4. What should the dashboard call requests that are `partial` but still need client action?
5. Are client-side Zapier invites in scope?
6. Which agency segment is the first ICP?
7. What are the targets for signed-up agencies and paying agencies, and by when?
8. Which outreach channels may the Hub draft for, and who sends?

## Operating notes

- Follow `docs/hub/HUB-INSTRUCTIONS.md` for roles, cards, worktrees, approvals, and verification.
- Every report labels claims as verified locally, verified in browser, verified in production, or unverified.
- When this goal changes, the coordinator updates this file and records the change in the Library under `decisions/`.
