---
title: Single-Stage Client Request Flow
date: 2026-09-07
category: design-patterns
module: Client request and invite flow
problem_type: design_pattern
component: frontend
severity: medium
applies_when:
  - A non-specialist client must approve agency access across multiple platforms
  - More than one platform, identity, or status surface could compete for attention
resolution_type: workflow_improvement
related_components:
  - design_system
  - agency_request_detail
tags:
  - client-invite
  - request-flow
  - single-stage
  - ux-architecture
  - oauth
  - truthful-status
---

# Single-Stage Client Request Flow

## Context

The client request/invite flow had truthful backend and progress semantics, but the screen architecture worked against them. A redesign critique diagnosed five competing surfaces: header, step chrome, active authorization work, platform status sections, and secondary trust/action furniture (session history). The client is a non-specialist approving real account access; every extra surface competes with the one decision that matters.

The team compared three structures in a dev-only prototype:

- **Single Stage**: one active-platform card, then one compact list for the full request. The prototype defines this as Variant A (`apps/web/src/components/flow/FlowRedesignPrototype.tsx:156-166`).
- **Split Desk**: active stage plus a desktop sticky rail. The rail repeats progress, identity, and safety information (`apps/web/src/components/flow/FlowRedesignPrototype.tsx:171-210`).
- **Checklist Scroll**: every platform becomes a section in one long scroll, with sticky top and bottom furniture (`apps/web/src/components/flow/FlowRedesignPrototype.tsx:215-264`).

Single Stage won (session history). It was the only structure that directly removed the attention competition. Split Desk became Single Stage on mobile plus desktop-only garnish. Checklist Scroll made the platform list the interface again and reintroduced the pile-up. The production rebuild extracted the winning structure into real components rather than promoting the prototype.

## Guidance

For a client-facing multi-platform access flow, make the active authorization decision the screen:

1. **Derive one active platform.** `buildInvitePlatformQueue()` separates completed platforms, chooses the returning OAuth platform when it is still incomplete, and otherwise chooses the first incomplete platform (`apps/web/src/lib/invite-platform-queue.ts:16-47`). Do not let the UI independently decide which platform is current.
2. **Render one stage.** The invite page renders `InvitePlatformStage` only while an active platform exists; when all platforms are complete, that stage is absent rather than left in a fake active state (`apps/web/src/app/invite/[token]/client-invite-page.tsx:860`).
3. **Put trust where the action is.** The stage identifies who is asking, what happens on click, and the exit promise before the wizard starts (`apps/web/src/components/flow/invite-platform-stage.tsx:22-68`). A separate trust rail is not needed.
4. **Make the rest a queue, not more cards.** All requested platforms appear in one numbered list — the named-platform checklist — driven by a pure reducer over server-reported fulfillment (`buildInvitePlatformChecklist`, `apps/web/src/lib/invite/platform-status.ts:34-39`, wired at `apps/web/src/app/invite/[token]/client-invite-page.tsx:185`). Its statuses are `done / connect-first / action-needed / waiting-on-agency / attention`, each with one line of client-facing copy. The queue component is deliberately one truth list, not three status sections (`apps/web/src/components/flow/invite-platform-queue-item.tsx`).
5. **Keep status readable without color alone.** Client statuses combine icon, word, and ink token (`apps/web/src/components/flow/invite-status-chip.tsx:3-39`). Agency request status follows the same rule: `StatusBadge` plus a "Waiting on client authorization" callout (`apps/web/src/components/access-request-detail/request-overview-card.tsx:50-57`).
6. **Mirror the truth on the agency side.** The request detail leads with lifecycle status and the next concrete action via `RequestOverviewCard` before overview, platforms, and actions (`apps/web/src/app/(authenticated)/access-requests/[id]/page.tsx:278`).

The shell itself is the structural contract: one truthful header, one progress surface (the checklist), then one stage on screen; no rail, dock, step-chip wall, or percentage bar (`apps/web/src/components/flow/invite-flow-shell.tsx:35-37`). Terminal endings join the same contract: every dead-end renders through the landing-state mapper and one branded `InviteTerminalCard`, never an ad-hoc error block (`apps/web/src/lib/invite/landing-state.ts`, `apps/web/src/components/flow/invite-terminal-card.tsx`).

## Why This Matters

This is a consent and security boundary, not a dashboard. The user must understand who is asking, what account access is being requested, and what will happen when they click. A split rail or full checklist can be visually organized and still fail because it makes several items feel equally actionable.

The single-stage model also gives OAuth returns a stable destination. The queue restores the returning platform as active when it remains incomplete (`apps/web/src/lib/invite-platform-queue.ts:35-46`), and focused tests pin that behavior (`apps/web/src/lib/__tests__/invite-platform-queue.test.ts:20-58`). The user returns to the same mental model: finish this one step; the rest is listed below.

Historically, the production rebuild replaced the rail, dock, scattered chips, and gradient chrome with this structure, with a reported net reduction of 486 lines. The final merged scope was reported as 243/243 touched tests passing, typecheck clean, detector clean, and a clean working tree. Those checks are historical session evidence, not a claim about every future change.

## When to Apply

Apply this pattern when:

- A non-specialist must approve agency access.
- The request can contain multiple platforms or grouped OAuth products.
- OAuth can leave and return, or a manual platform can require instructions in place.
- Identity verification and the exit promise are as important as the button label.

Do not force it onto expert bulk-administration screens where comparison across many accounts is the primary task. It is also unnecessary for a single-platform request: with only one item, the queue adds no value.

## Examples

The current invite page states the active-platform rule in copy: “Finish [platform] first. The rest of the request is listed below.” (`apps/web/src/app/invite/[token]/client-invite-page.tsx:660`). It then follows that copy with one stage and one list (`apps/web/src/app/invite/[token]/client-invite-page.tsx:860`).

The contract has focused checks:

- `InviteFlowShell` proves one-column header, progress, and content order, pins the named-platform checklist as the one progress surface, and forbids a percentage bar, progressbar, or legacy step counter (`apps/web/src/components/flow/__tests__/invite-flow-shell.test.tsx`).
- `InvitePlatformStage` proves identity verification, exit promise, active step, and wizard content appear together (`apps/web/src/components/flow/__tests__/invite-platform-stage.test.tsx:7-27`).
- `buildInvitePlatformQueue` proves first-incomplete selection, OAuth-return restoration, and the all-complete empty state (`apps/web/src/lib/__tests__/invite-platform-queue.test.ts:20-58`).

The comparison harness remains intentionally non-production. Its header calls it a throwaway prototype and says to fold the winning structure into the real flow (`apps/web/src/components/flow/FlowRedesignPrototype.tsx:1-11`); the route returns `404` in production (`apps/web/src/app/dev/redesign-prototype/page.tsx:5-8`).

Related truthfulness rules live in `docs/solutions/google-authorization-fulfillment-truthfulness.md` and `docs/solutions/grouped-oauth-product-expansion-with-truthful-fulfillment.md`. Those docs define when access is actually fulfilled; this doc defines how to present the one active step without hiding the rest of the truth.

## Related

- `docs/solutions/google-authorization-fulfillment-truthfulness.md`
- `docs/solutions/grouped-oauth-product-expansion-with-truthful-fulfillment.md`
- `docs/solutions/google-selector-stale-response-guard.md`
- `docs/solutions/design-patterns/design-system-authority-acid-brutalism-v2.md`
