# Flow spec: agency onboarding email sequence

The post-signup email sequence for agencies. All behavior lives in
`apps/api/src/services/onboarding-email.service.ts`; this file carries the
schedule, the skip predicates, and the gotchas.

## Transport and shape

- Sent via Resend through `sendEmail()` (`apps/api/src/services/email.service.ts`).
- Bodies are plaintext; HTML is generated from the text by `textToHtml()`
  (same service, :48) — double newlines split paragraphs, links auto-link.
- Dedup: one send per `(agencyId, emailKey)` forever, via AuditLog action
  `ONBOARDING_EMAIL_SENT` (:69).

## The 8 keys

| Key | Day | Subject | Builder |
|---|---|---|---|
| `welcome_first_step` | 0 | "Your client access flow starts here" | :98 |
| `get_to_first_link` | 1 | "Your first access link is still waiting" | :124 |
| `send_the_link` | 1 after first request | "Your access link is ready to send" | :148 |
| `track_status_keep_momentum` | 3 | "Check your request status" / "Need help getting your first request live?" | :178 |
| `turn_one_request_into_workflow` | 7 | "Turn this into your standard onboarding flow" | :217 |
| `still_waiting_day14` | 14 | "The part where most agencies get stuck" | :285 |
| `one_client_day30` | 30 | "Five minutes, one client, done" | :307 |
| `closing_the_loop_day60` | 60 | "Before we stop emailing you" | :327 |

Schedule source: `EMAIL_DELAYS` (:17). Signature quirk: seven emails sign
"- The AuthHub team"; day 60 signs with an em dash.

## Skip predicates (send-time, per key)

Checked inside `sendOnboardingEmail` (:411) *after* dedup:

- `get_to_first_link`: skip if the agency has any access request
  (`already_activated`).
- `send_the_link`: queued per request; skip if the request is missing or
  `completed`. This is the only key outside `EMAIL_DELAYS`.
- `track_status_keep_momentum`: never skipped; **branches** on whether any
  request exists — "Check your request status" (has request) vs "Need help
  getting your first request live?" (none).
- `turn_one_request_into_workflow`: skip if the agency has **no** request
  (`not_activated`) — the inverse of the others.
- `still_waiting_day14`, `one_client_day30`, `closing_the_loop_day60`: skip if
  any request exists, or if a `CHURN_OPTOUT` AuditLog exists.

Gotcha: the skip asymmetry means an agency that activates late still receives
day 7 but never days 14/30/60 — by design.

## Opt-out

Replying "pass" to day 30 (or any contact-form path) records `CHURN_OPTOUT`
(:241, `recordChurnOptOut` :270), which silences days 14/30/60 only.

## Scheduling mechanics

- `queueSequenceStart` (:348) enqueues all 7 scheduled keys at signup with
  PgBoss `startAfter` = delay, `singletonKey` per agency+key, retryLimit 3.
- `queueActivatedFollowUp` (:381) enqueues `send_the_link` 1 day after a
  request is created, `singletonKey` per agency+request.
- Handler: `apps/api/src/lib/job-handlers.ts:206`.

## Gotchas and flags

- Day 1*'s forwardable note links `{FRONTEND_URL}/authorize/{uniqueToken}` —
  the legacy alias, not `/invite` (G6).
- Docs drift (G3): `docs/new-user-onboarding-email-flow.md` documents a 5-email
  sequence; the code ships these 8 keys.
- G5 (adjacent): this sequence is agency-facing. Nothing in it reminds a
  *client* before link expiry — see `access-request.md` G1.

## Sources

- apps/api/src/services/onboarding-email.service.ts:17 — "const EMAIL_DELAYS"
- apps/api/src/services/onboarding-email.service.ts:48 — "function textToHtml"
- apps/api/src/services/onboarding-email.service.ts:69 — "async function hasAlreadySentEmail"
- apps/api/src/services/onboarding-email.service.ts:98 — "function buildWelcomeEmail"
- apps/api/src/services/onboarding-email.service.ts:178 — "function buildMomentumEmail"
- apps/api/src/services/onboarding-email.service.ts:241 — "const CHURN_OPTOUT_ACTION"
- apps/api/src/services/onboarding-email.service.ts:348 — "export async function queueSequenceStart"
- apps/api/src/services/onboarding-email.service.ts:411 — "export async function sendOnboardingEmail"
- apps/api/src/lib/job-handlers.ts:206 — "onboarding-email"
- apps/api/src/lib/client-invite-email.ts:114 — "needs access to your"
