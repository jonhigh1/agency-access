---
target: full client request flow (agency + client sides)
total_score: 23
max_score: 40
na_heuristics:
p0_count: 2
p1_count: 3
timestamp: 2026-09-07T03-09-27Z
slug: src-app-authenticated-access-requests-invite-flow
---
# Impeccable Critique — Client Request Flow (post-rebuild, Waves 1-4)

Dual assessment: independent design-review agent + separate detector/browser agent. Same target slug as the baseline critique for trend continuity.

## Design Specificity Verdict

**LLM assessment:** AuthHub-specific thinking is real on the rebuilt client shell, dead end, agency detail, and agency success: flows name the agency, show exact permissions, verify identities, and use plain consent language. But production still splits into three visual systems: Acid Brutalism v2 (rebuilt surfaces), rounded shadcn remnants (PlatformAuthWizard, FlowShell consumers, agency buttons), and the old root DESIGN.md world. A clear product idea wearing an inconsistent costume.

**Deterministic scan:** CLI detector: exit 0, 0 findings. In-page overlay: invite dead end — 3 findings (`low-contrast` white-on-coral 2.8:1, `flat-type-hierarchy`, `nested-cards`); prototype harness — 9 elements/18 instances, mostly throwaway-harness labels (`undersized-ui-text`, `wide-tracking`, plus the same white-on-coral contrast hit). No false positives beyond harness labels. No console/page errors on any captured page this run.

## Overall Impression

The redesign fixed the structure and the trust language; the remaining gap is coverage, not direction. The client frame, agency detail/success, status vocabulary, and dead ends are now on-system and honest. The old world survives inside PlatformAuthWizard (the biggest client-facing surface), the ui primitives layer, and two genuine P0 behavioral breaks: consent copy that points the wrong way, and OAuth failure that throws the user off the journey.

## What's Working

1. **Client trust model is authored:** who asks, what is requested, what is never requested — one short header block.
2. **Agency success is product-specific:** copy, preview, email, expiry, status, next action as one clear task.
3. **Status language is concrete:** RequestStatusChip + nextActionLine distinguish waiting/partial/complete/expired/revoked without color alone.

## Priority Issues

1. **[P0] Client consent copy points the wrong way.** Intake/complete titles read "Share account access with [clientName]" — but the client is the one sharing. Fix: "[Agency] needs access to finish setup." `$impeccable clarify apps/web/src/app/invite/[token]/client-invite-page.tsx`
2. **[P0] OAuth failure is a dead end.** oauth-callback sends users to `/` after failure, losing the invite context. Fix: return to `/invite/[token]` with failure detail + retry/contact. `$impeccable harden apps/web/src/app/invite/oauth-callback/page.tsx`
3. **[P1] One design world, not three.** PlatformAuthWizard, FlowShell consumers, Card, agency buttons still rounded/soft. Fix: promote v2 primitives in components/ui. `$impeccable extract apps/web/src/components/ui`
4. **[P1] Asset selection overloaded + unlabeled.** AssetGroup receives a title but never renders it; Meta step stacks connection + 4 selection decisions + creation. Fix: label groups, collapse optional creation. `$impeccable distill apps/web/src/components/client-auth/PlatformAuthWizard.tsx`
5. **[P1] Revoke can fail silently.** handleCancelConfirm try/finally, no catch, no error surface — agency can't tell if access is still live. Fix: catch + actionable error + keep modal open. `$impeccable harden apps/web/src/components/access-request-detail/request-actions-bar.tsx`

## Persona Red Flags

- **Alex (agency power user):** client search caps at 50 with no total/pagination; cancel failure invisible.
- **Jordan (first-timer client):** raw coral errors, collapsed help, step language that differs between shell and wizard.
- **Sam (screen reader/keyboard):** asset-group collapse buttons say only "Collapse/Expand"; select-all not aria-checked; modals move focus but don't trap it.

## Minor Observations

- invite-trust-note / invite-support-card still rounded-xl/2xl; support link styled as danger (false alarm); secondary button hover drifts to danger ink; Card violates v2 by default; manual wizard hides current-step description on mobile; edit success copy promises a resend action that doesn't exist; root DESIGN.md still documents the old world.

## Questions to Consider

1. Is Acid Brutalism v2 the system of record, or an aspiration applied to recently touched routes?
2. Why does client progress use sessionStorage as a truth source when authorization is server state?
3. What is the emotional peak: the client's "done" or the agency's "sent"?
4. Is PlatformAuthWizard one component or four products pretending to be one?

## Evidence Notes

- Score: 23/40 (all 10 heuristics applied). P0=2, P1=3. Baseline was 20/40.
- Detector CLI clean; overlay corroborates white-on-coral contrast (2.8:1) on primary buttons — v2 accent carries white text below AA; consider ink-on-coral or darker accent for text-bearing fills.
- No console/page errors reproduced this run (prior classList TypeError did not fire on captured pages; still open as a ticket).
- Agency pages judged from source (Clerk gate on live server).
