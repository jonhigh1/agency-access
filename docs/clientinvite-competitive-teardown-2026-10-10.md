# ClientInvite Competitive Teardown
**For AuthHub — CEO/CMO/CPO lens. Researched 2026-10-10. All claims verified live or from user-supplied recordings.**

## Verdict

ClientInvite is not winning on product depth. They're winning on **friction removal and risk reversal**. Their signup is two fields and a Google button. Their trial is 14 days, all features, no card, and if you don't pay you fall into a free plan instead of a paywall. Their pricing page promises they'll never auto-upgrade you and you'll keep client access even if you cancel. Every one of these is a deliberate conversion decision, and as a package it's the best PLG execution in this category. AuthHub's product is competitive; AuthHub's funnel is not. That's the gap to close.

---

## 1. Signup flow — graded against the signup skill

**What they do (verified live at app.clientinvite.com/auth/signup):**

One page, one step. Email + password (min 8 chars) + "Sign up" button + "or Continue with Google." Headline: "Create your free account in 30 seconds." Subhead: "Join hundreds of agencies onboarding new clients without sharing credentials." A 5-star testimonial (named founder, photo) sits beside the form.

**Skill grade: A-. Textbook with one gamble.**

| Skill principle | ClientInvite | Grade |
|---|---|---|
| Minimize fields (email + password essential; defer the rest) | 2 fields. No name, no company, no role, no phone at signup | A+ |
| Social auth prominent | Google SSO below the button, clear separation | A |
| Reduce perceived effort ("takes 30 seconds") | Literal headline: "Create your free account in 30 seconds" | A+ |
| Testimonial near form | Named founder testimonial beside the form | A |
| "No credit card required" at form level | Repeated under hero, pricing subhead, every plan CTA, dedicated FAQ | A+ |
| Single-step for ≤3 fields | Correct — one page, no wizard | A |
| Post-submit: clear next step | Redirects to /onboarding (workspace setup: agency name, website, username) | B+ |
| Email verification | None visible. No verification gate before product access | Gamble |

**The gamble:** no email verification. The skill says "consider delaying verification until necessary" — ClientInvite deleted it. This maximizes signup completion and is defensible for a trial product (fake emails self-clean when the trial expires), but it's a deliverability and abuse risk AuthHub should not copy blindly. Middle path: no verification gate, but verify-before-first-client-invite (the invite email is the deliverability-sensitive moment anyway).

**What happens after submit (from Jam recording 1):** Google OAuth → /onboarding form (agency name, website URL, username — 3 fields, dark pill submit) → short multi-step wizard → dashboard with `?tour=start`.

---

## 2. Onboarding — graded against the onboarding skill

**Activation event:** first access link created. They don't make you earn it — a toast announces **"Your first access link is ready: 'Facebook access'. Preview it on Home."** The link is pre-created for you.

**Skill grade: A-. They run the endowed-progress playbook.**

| Skill principle | ClientInvite | Grade |
|---|---|---|
| Time-to-value / Minimum Path to Value | Signup → 3-field workspace form → dashboard with a *pre-made* access link. MPTV is ~90 seconds | A |
| Endowed progress effect (start at 20%, not 0%) | First access link pre-created; toast frames it as already done. You preview, not build | A+ |
| Do, don't show | "Connect your accounts" wizard has you linking real accounts with per-account Link buttons — doing, not video-watching | A |
| One goal per session | First session = connect platforms + preview first link. Nothing else demanded | A |
| Progress creates motivation | "Connections" usage card in sidebar: FREELANCER plan, 0 used / 3 remaining, resets 10/23/2026 | B+ |
| Peak-end rule | Peak = "first access link ready" toast (a win). Ends on Home with a live, copyable link | A- |
| Guided tour | ?tour=start: Home → Platforms → Branding → Settings > Auto-assign. 4 stops — at the skill's 3–5 max, borderline long | B |
| Prescriptive error states (remove blockers) | Facebook link failure tells you *exactly* where to go: Meta Business Suite → Settings → Accounts → Pages, then press Link again | A+ |
| Checklist pattern (3–7 items, progress bar, celebration) | **Missing.** The tour is linear, not a dismissible checklist. No completion % | C — opening |

**The "Connect your accounts" wizard (Jam recording 2)** is the best thing they built: cards per platform (Facebook, Facebook Page, Instagram Page, Meta Ads, Shopify/product catalog), each with account dropdowns and green Link buttons, Previous/Continue nav, Help lower-left. Per-account status instead of one long form. When Facebook linking failed on camera, the error was specific and actionable — the exact Meta Business Suite path. Compare: most OAuth failures in this category die with "Something went wrong." This is a support-ticket killer.

**Notable:** their Bugsnag endpoint was erroring repeatedly in both recordings (POST net::ERR_ABORTED) and a tRPC call 403'd during the wizard. Their error *reporting* is noisy; their error *messaging* is excellent. Don't confuse the two.

---

## 3. Marketing site teardown

**Positioning:** "Get Access to Meta, Google & More in Minutes." One link, client approves, agency gets permissions. The entire site is a single idea repeated: *client access without the back-and-forth.*

**What works:**
- **Pain before product.** Hero sub names the exact pain (chasing clients, wrong permissions, days of email) before any feature appears.
- **3-step how-it-works.** Send link → client connects → manage from dashboard. A 10-year-old could follow it.
- **Trust stack above the fold:** Google Official Partner · Meta Official Partner · "Trusted by 900+ agencies" · logo marquee · no-card microcopy. Five trust signals before you scroll.
- **Social proof is specific.** Testimonials cite saved hours, faster audits, fewer Loom videos — outcomes, not adjectives. "4.6/5 based on 40+ reviews" on pricing.
- **Product-as-proof UI:** a stream of "recent asset-granted" notifications visualizes the product working.
- **The Leadsie-alternative page is the best competitive page in the category.** Side-by-side price table, "where the money actually goes" math, branding comparison — and then a section titled **"When Leadsie is the better pick"** listing four honest reasons to choose the competitor. "We would rather you chose correctly than chose us." This is disarming, credible, and it ranks. AuthHub needs this page format aimed at ClientInvite.
- **ROI calculator on pricing.** Platforms × clients × $50/hr manual cost → "potential monthly savings." Anchors $89/mo against staff cost, not against competitors.

**What's weak:**
- **Inconsistent social proof numbers:** "900+ agencies and freelancers" (hero) vs. "500+ leading digital marketing agencies" (marquee section). Pick one. This is the kind of thing that makes a skeptical buyer do math you don't want them doing.
- **"Hundreds of agencies" on the signup subhead** undersells the "900+" on the homepage. Same page, different confidence.
- **Derivative pricing page.** Their own FAQ admits the structure mirrors Leadsie's. Fine for conversion, zero for brand.
- **No urgency mechanics at all.** No trial countdown, no seat scarcity — only "17% OFF" on annual. Leaves money on the table for high-intent visitors.
- **"Official Partner" badges** are doing heavy lifting for trust. If those are reseller-tier badges rather than real partnerships, it's a credibility risk. (Unverified — flagged, not asserted.)

---

## 4. Pricing teardown

| | Solo | Freelancer | Agency |
|---|---|---|---|
| Price | $15/mo ($13 annual) | $29/mo ($25 annual) | **$89/mo ($75 annual) — RECOMMENDED** |
| Connections | 1/mo | 3/mo | Unlimited |
| Pitch | "onboarding one new client a month" | "a few clients a month" | "clients at scale" |

**Why it works:**
- **The value metric is countable and intuitive:** "a connection is onboarding one client." Every plan card re-defines it inline. No one wonders what they're buying.
- **Trial decoupled from plan choice.** 14 days, ALL premium features, no card — you prove value first, choose a plan second. Plan selection is deferred until it can be an informed decision.
- **Freemium safety net.** After trial: subscribe OR "continue with our free plan." This removes trial anxiety entirely — the worst case isn't a paywall, it's a free tier.
- **Risk reversal as a feature list:** "never automatically upgrade your plan," "keep client access even after cancellation." These read like product features, but they're conversion copy aimed at the burned-by-SaaS buyer.
- **Good-better-best anchored on usage**, not features. Solo/Freelancer differ only in connection count and support tier. Simple.

**Vs. AuthHub ($29/$79/$149):** ClientInvite undercuts entry ($15 vs $29) and top ($89 unlimited vs $149). More importantly, their packaging tells a clearer story: *pay for onboardings.* AuthHub's tiers need an equally countable value metric or they lose the 30-second pricing-page test.

---

## 5. What to steal — ranked by impact/effort

### P0 — this week
1. **Two-field signup. No plan picker, no card, no profiling.** AuthHub's signup should be email + password + Google, one page, headline with a time promise ("in 30 seconds"). Move agency name/website/username to post-signup onboarding. (Signup skill: every deferred field is conversion.)
2. **"No credit card required" everywhere.** Hero microcopy, pricing subhead, under every CTA, dedicated FAQ. Say it four times minimum.
3. **Testimonial beside the signup form.** One named founder, photo, 5 stars, one outcome sentence. Free conversion.
4. **Trial = all premium features, plan choice deferred.** If AuthHub trials gate features by tier, ungate them. Let value precede the pricing decision.
5. **Pre-create the first access link.** On first dashboard load, the user's first invite link should already exist with a toast: "Your first access link is ready." Endowed progress beats an empty state. (Onboarding skill: start at 20%, not 0%.)

### P1 — this month
6. **Freemium fallback after trial.** "Subscribe or continue free" removes the #1 trial objection. Design the free tier as a safety net, not a product.
7. **"Never auto-upgrade" + "keep access after cancel" promises.** Put them on pricing as risk-reversal copy. They cost nothing and disarm the two most common SaaS objections.
8. **Guided first-run tour ending on a live link.** 3 stops max (skill says 3–5; keep it tight): connect a platform → preview your first link → copy it. Dismissible, never repeated.
9. **Prescriptive OAuth error states.** Every platform failure should name the exact fix path (their Business Portfolio error is the template). This is a support-ticket killer and a trust builder.
10. **Per-account "Connect your accounts" wizard** for the client side: platform cards, per-account Link buttons, explicit status — instead of one opaque OAuth button.

### P2 — this quarter
11. **Alternative-page playbook.** Ship /clientinvite-alternative with a price table, "where the money goes" math, and an honest "when ClientInvite is the better pick" section. Their Leadsie page proves the format converts and ranks.
12. **ROI calculator on pricing.** (Clients/mo × platforms × $50/hr) vs. plan price. Anchors against staff cost.
13. **Recountable value metric for AuthHub pricing.** "Connections" is taken; find AuthHub's equivalent countable unit and rebuild tiers around it.
14. **Connections usage card in the sidebar** (plan, used/remaining, reset date). Makes the value metric visible every session.

---

## 6. What NOT to copy

- **No email verification at all.** They skipped it. AuthHub should delay it, not delete it — verify before the first client invite sends, not at signup.
- **Inconsistent proof numbers** (900+ vs 500+ vs "hundreds"). One number, everywhere, or don't print it.
- **4-stop linear tour with no checklist.** Their tour is fine; a dismissible 3–5 item checklist with a progress bar and completion state would beat it. Don't copy the weaker version.
- **Zero urgency.** Their funnel has no trial countdown, no expiry nudge. AuthHub can add honest urgency (trial-days-remaining in-app, "your trial ends in 3 days" email) without countdown-timer cheese.
- **Pricing page modeled on the competitor's.** It converts, but it's forgettable. AuthHub's pricing page should look like AuthHub.

---

## 7. Where they're vulnerable — AuthHub openings

1. **Trust is badge-deep.** "Official Partner" badges + testimonial count is their whole enterprise story. No security page depth observed, no compliance posture, no audit-log narrative. AuthHub can own **agency-grade trust**: audit logs, granular permissions, SOC 2 path, DPA — the things that win the 10-person agency, not the solo.
2. **Single-player onboarding.** Their flow optimizes the solo agency owner. No team-invite moment in the observed onboarding, no roles. AuthHub's team/roles story (already in product) is a wedge for larger shops.
3. **The client experience is still OAuth-roulette.** Their wizard is better than most, but the client still bounces between platform dialogs. AuthHub's guided invite flow (intake → connect → asset selection in one branded flow) is the differentiator to sharpen, not abandon.
4. **No community, no content moat.** Their SEO is alternative-pages + pricing. A real education hub (platform-permission guides, agency onboarding templates) is unclaimed territory.
5. **Price anchoring cuts both ways.** $15 entry trains the market that this is cheap. AuthHub at $29–$149 can position as the premium option *if* the product and trust story justify it — but only with the same friction-free signup, or the price premium reads as arrogance.

---

## 8. Differentiation strategy for AuthHub

Don't out-cheap them. Out-trust them and out-workflow them.

- **Positioning:** ClientInvite = "fastest way to get client access." AuthHub = "the client-access platform agencies run their business on." Speed is their word; *control* is ours — audit trails, team roles, granular permissions, revocation, compliance.
- **Funnel:** match their friction removal beat-for-beat (2-field signup, no card, pre-created first link, freemium fallback), then differentiate *after* activation with depth they don't have.
- **Pricing:** keep the premium, but make the value metric as countable as "connections." If AuthHub's unit is access requests, say so on every plan card like they do — define it inline, no jargon.
- **Marketing:** ship the alternative page *about them* before they ship one about you. Their format is proven; turn it around.
- **The one thing they can't copy quickly:** the client-side branded flow. Their client experience is a wizard of platform dialogs. If AuthHub's invite flow feels like *your agency's* product to the end client (branding, guidance, plain-language permission explanations), that's a moat built on craft, not features.

---

## 9. 30/60/90

**30 days (conversion surgery):**
- 2-field signup, Google SSO prominent, "30 seconds" headline, testimonial beside form
- "No credit card required" ×4 across funnel
- Trial = all features; no plan picker pre-trial
- Pre-created first access link + toast on first login
- Prescriptive OAuth error copy (Business Portfolio template)

**60 days (activation engine):**
- 3-stop dismissible onboarding checklist ending on "copy your first link"
- Freemium fallback tier
- "Never auto-upgrade / keep access after cancel" pricing copy
- Connections-style usage card in sidebar
- Trial-expiry email sequence (honest urgency: days remaining, what happens next)

**90 days (moat):**
- /clientinvite-alternative page (their format, turned around)
- ROI calculator on pricing
- Agency-grade trust page (audit logs, permissions, DPA, SOC 2 path)
- Client-side flow polish: branded, plain-language, one continuous flow

---

*Raw sources: `competitor-profiles/raw/clientinvite/2026-10-10/` (homepage, pricing, signup-flow, jam-signup-onboarding, jam-access-link-wizard) — captured in a previous workspace; not synced into this repo as of 2026-10-09.*
*Skills applied: competitor-profiling (structure), signup (flow grade), onboarding (flow grade), cro (conversion lens)*
