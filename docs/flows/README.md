# Flow specs (agent-facing)

Reference specs for AuthHub's three core flows. Written for AI coding agents and
new engineers: facts, invariants, reasons, and source anchors — not tutorials.

## Ground-truth ordering

1. **Code** is the source of truth. Always re-read the anchored file before
   changing behavior; line numbers drift with edits.
2. **These specs** carry the why, the invariants, and the gotchas the code does
   not confess. If a spec contradicts the code, the code wins — fix the spec in
   the same commit.
3. **`docs/email-onboarding-flow.html`** is a human-facing audit view generated
   from the same facts. Never an input for code changes; treat as a consumer of
   these specs.

## Files

| File | Covers | Key entry points |
|---|---|---|
| `client-invite.md` | `/invite/[token]` client journey: phases, landing precedence, platform queue, wizard, checklist, resume, terminal states | `client-invite-page.tsx`, `landing-state.ts`, `invite-platform-queue.ts` |
| `onboarding-emails.md` | Agency onboarding email sequence: 8 keys, schedule, skip predicates, dedup, opt-out | `onboarding-email.service.ts` |
| `access-request.md` | Request lifecycle: creation, token, expiry, delivery modes, statuses | `access-request.service.ts`, `access-requests.ts` routes |

## Anchor format

Every spec ends in a **Sources** section. Each bullet pins a claim to code:

```
- path/to/file.ts:LINE — "quoted fragment from that line"
```

`scripts/tests/flow-spec-anchors.test.mjs` walks every bullet and fails when a
file is missing, a line is out of range, or the fragment no longer appears
within ±5 lines of the anchor. Run it directly:

```bash
node --test scripts/tests/flow-spec-anchors.test.mjs
```

Rules when editing specs:

- Every load-bearing claim gets an anchor. Reasons and invariants may stand
  without one only when the anchor is the section header above them.
- Quote fragments exactly as the source spells them (straight quotes in the
  fragment; the walker normalizes nothing).
- Do not copy email bodies, copy decks, or token lists into these files. They
  live in code; copy the anchor, not the payload.
