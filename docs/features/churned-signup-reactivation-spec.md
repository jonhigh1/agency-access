# AuthHub Churned-Signup Re-engagement Sequence — Spec

**Status:** DRAFT for Jon's sign-off. No emails are wired or sent.
**Scope:** Agencies that signed up, went through the day 0–7 onboarding arc, and never activated (created zero access requests). This is NOT a cancellation flow — AuthHub is pre-revenue, so "churned" means dormant signup, not lost MRR.
**Owner:** onboarding-email.service.ts (extend, don't fork — same queue, same skip logic, same audit-log dedup).
**Written:** 2026-09-16

---

## 1. Entry condition

A signup is "churned dormant" when ALL of the following are true:

- Agency account exists (signed up via `queueSequenceStart`)
- `accessRequests` count = 0 (never activated — reuse the existing check at line 344)
- Day 7 email (`turn_one_request_into_workflow`) already sent, no reply, no activation
- Not unsubscribed

**Rule: every email in this sequence re-checks activation before sending.** One new access request at any point kills the entire remaining sequence (same `skipped: already_activated` pattern as `get_to_first_link`). This is the single most important mechanical rule — the sequence must never scold someone who already converted.

## 2. The sequence

| # | emailKey | Send | Job |
|---|----------|------|-----|
| 1 | `still_waiting_day14` | Day 14 | Name the real blocker, remove it |
| 2 | `one_client_day30` | Day 30 | Shrink the ask to one client, five minutes |
| 3 | `closing_the_loop_day60` | Day 60 | Honest last ask: reactivate or tell us why (reply-driven) |

Three emails. Not five. A dormant signup who ignored four emails will not reward a fifth nudge — the sequence must earn the right to keep writing by being worth reading.

## 3. The copy

Voice contract (from the existing sequence): plain sentences, no hype, numbered steps, one CTA, "reply and tell us" as the secondary action, signed "— The AuthHub team". The churned sequence keeps that voice and adds one thing the onboarding arc never earned: permission to be direct about the fact that they left.

### Email 1 — Day 14 · `still_waiting_day14`

**Subject:** The part where most agencies get stuck
**Preview:** It is never the tech. It is picking the first client.

```
Hi there,

Two weeks ago you signed up to kill the access-handoff email loop. Still nothing set up. That is normal, and it is almost never the product that stopped you.

It is picking which client goes first.

So here is the shortcut: pick the next client you are already chasing for access. Not the biggest one. The one where the back-and-forth is actively annoying you this week.

That client already needs to give you access. AuthHub just turns three days of email into one link.

Create that request here:
{getOnboardingUrl()}

If it is something else blocking you, reply with one sentence about what it is. We read every reply.

— The AuthHub team
```

*Why it works:* names the real objection (decision paralysis, not product doubt) instead of restating features. "Actively annoying you this week" borrows urgency the user already has. The reply-ask is real feedback collection, not decoration.

### Email 2 — Day 30 · `one_client_day30`

**Subject:** Five minutes, one client, done
**Preview:** The whole setup fits inside a coffee order.

```
Hi there,

One month in, so this is the short version.

Setting up AuthHub takes about five minutes: pick a client, choose their platforms, generate the link. The link does the rest — your client authorizes Meta, Google, GA4, or LinkedIn without a single email thread.

If you have a client waiting on access right now, this is your moment:

Create the link here:
{getOnboardingUrl()}

And if AuthHub turned out to be not for you, that is fine too. Reply with the word "pass" and we will stop emailing. No hard feelings. Marcus had whole chapters on letting go.

— The AuthHub team
```

*Why it works:* extreme compression respects a month of being ignored. The explicit opt-out word ("pass") is the sleeper move — it converts silent unsubscribes into honest signal, and disarming the pressure is what makes the CTA clickable. The Marcus line is on-brand and earns a smile from the exact audience (agency owners) that skims everything else.

### Email 3 — Day 60 · `closing_the_loop_day60`

**Subject:** Before we stop emailing you
**Preview:** One question, one reply, and we go quiet.

```
Hi there,

This is the last email in this sequence. After this, we go quiet unless you reach out first.

Before that, one honest question:

What would have made you set up your first access link in those first days?

Reply with one sentence. If the answer is something we can fix, you will have made the product better for every agency after you. If the answer means we are not for you, that is useful too.

The door stays open. Your account is live whenever a client handoff gets painful again:

{getDashboardUrl()}

— The AuthHub team
```

*Why it works:* the exit email's job is not conversion — it is diagnosis and permission. "We go quiet" is the most clickable sentence in the sequence. Asking "what would have made you…" instead of "why didn't you…" gets answers instead of silence. And leaving the account live with a no-pressure door keeps reactivation one bad client-handoff week away, which is how dormant SaaS signups actually return.

## 4. Mechanics (implementation notes)

- **Extend `EMAIL_DELAYS`-style scheduling**, not a new pipeline: new keys `still_waiting_day14` (14d), `one_client_day30` (30d), `closing_the_loop_day60` (60d), queued at signup with the same `singletonKey: onboarding-email:{agencyId}:{emailKey}` pattern.
- **Activation check on every job run** (reuse the `get_to_first_link` pattern): if `agency.accessRequests.length > 0` → skip with `already_activated`. If the audit log shows any onboarding email bounced hard or the agency unsubscribed → skip.
- **Reply capture:** emails 1 and 3 explicitly invite replies. Route to Jon's inbox (they already go to the reply-to). Log `CHURNED_REPLY` in auditLog with the emailKey so we can measure reply-driven saves.
- **"pass" opt-out:** if email 2 or any reply contains "pass", set a suppress flag (audit log `CHURN_OPTOUT`), cancel remaining jobs, exclude from future sequences. Cheap to build, honors the promise in the copy.
- **Success metric:** not opens. The only number that matters is **activations from dormant** (agencies whose first access request is created after day 8). Secondary: reply rate (diagnosis gold), "pass" rate (list hygiene).
- **Explicitly out of scope:** discounts, urgency timers, fake "we miss you." Pre-revenue AuthHub has no pricing to discount and the voice would break.

## 5. Sequencing with the existing arc

Day 0/1/3/7 arc → (silence) → **day 14 / 30 / 60 re-engagement** → quiet, door open.

The two arcs must never overlap for the same agency: re-engagement jobs only enqueue for agencies whose day-7 email sent AND who have zero access requests at day 8. If activation happens at any point, remaining re-engagement jobs die silently.
