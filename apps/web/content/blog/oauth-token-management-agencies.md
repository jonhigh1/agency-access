---
id: oauth-token-management-agencies
title: 'OAuth Token Management for Agencies: What Expires, What Breaks, and How to Fix It (2026)'
excerpt: >-
  OAuth tokens expire silently. Campaigns stop running. Clients don't notice until
  they check their numbers. Here's how token management actually works for agencies
  managing Meta, Google, LinkedIn, and GA4 access — and how to stop getting surprised.
category: operations
stage: awareness
publishedAt: '2026-05-06'
readTime: 12
author:
  name: Jon High
  role: Founder
tags:
  - oauth token management
  - client access management
  - agency operations
  - token expiration
  - meta ads access
  - google ads access
  - agency security
  - platform access
metaTitle: 'OAuth Token Management for Agencies (2026): What Expires & How to Fix It'
metaDescription: >-
  OAuth tokens expire silently and kill your campaigns. Learn how token management
  works for Meta, Google, LinkedIn, and GA4 — and how agencies handle this at scale.
relatedPosts:
  - agency-security-checklist
  - what-is-client-access-management
  - how-to-revoke-client-access-offboarding
  - client-onboarding-checklist
  - social-media-access-request-template
  - mcp-oauth-client-access-agencies
---

# OAuth Token Management for Agencies: What Expires, What Breaks, and How to Fix It (2026)

The client's Meta campaigns stopped spending at 11pm on a Friday.

Not a budget issue. Not a targeting problem. The automated rules were fine. The creative was fine. What broke was an OAuth token — the 60-day authorization that gave your agency permission to manage the account. It expired while everyone was offline. By the time anyone noticed Monday morning, the client had already spent the weekend wondering why their campaigns went dark.

That's the nature of OAuth tokens: they're invisible until they break. And when they break, the failure looks like a campaign problem, a platform glitch, or a budget issue — before anyone thinks to check the access layer.

For agencies managing 20, 50, or 100 client accounts across Meta, Google Ads, GA4, LinkedIn, and TikTok, **OAuth token management** is less of a technical detail and more of an operational risk. This guide explains what tokens actually are, why they expire, and what a functional management process looks like — without the developer jargon.

---

## What OAuth Tokens Are (and What They're Not)

OAuth tokens are the digital keys that give your agency permission to manage a client's ad accounts. When a client connects their Meta Business Manager or Google Ads account to your agency, they're not sharing a password. They're authorizing a time-limited token that says: "This agency can take these specific actions on my behalf."

The key distinction: a token is not a credential. It doesn't prove identity. It proves *permission*. And permissions expire.

Every major ad platform uses the [OAuth 2.0 framework](https://oauth.net/2/) for this authorization model — including Meta, Google, LinkedIn, GA4, and TikTok. The mechanics differ, but the concept is identical: client approves access, platform issues a token, agency uses that token to make API calls.

Three token types you're dealing with:

**Access tokens** — short-lived, often 1-2 hours. Used for direct API calls. Most platforms automatically refresh these in the background when a valid refresh token exists.

**Refresh tokens** — longer-lived, sometimes months. Used to silently renew expired access tokens without asking the client to reauthorize. When a refresh token expires or is revoked, you're back to needing the client to reconnect.

**Long-lived tokens** — platform-specific. Meta issues 60-day long-lived user tokens through a separate exchange process. These don't auto-refresh.

For most agencies, the relevant distinction is simpler: some connections renew silently, and some require the client to click a button again. The ones that require the client are where things go sideways.

---

## The Token Lifecycle (What Actually Happens)

Here's what happens from the moment a client connects an account to the moment access breaks:

**Day 0 — Authorization**
The client follows your access request link and authorizes the connection. A token is issued. It has an expiration timestamp baked into it from the start.

**Days 1–55 — Active**
Everything works. Campaigns run. Reporting pulls data. Automated rules execute. The token is valid and the platform honors API calls.

**Days 55–60 — Approaching expiry**
No notification from the platform. No warning email. The clock is running, but silently. For Meta's 60-day long-lived tokens, there's no built-in alert mechanism — [you have to monitor expiry yourself](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived).

**Day 60 — Expired**
Access token is revoked. API calls fail. Campaigns using automated rules stop. Third-party integrations that pull reporting data return errors. But here's the thing: the client's account still exists. Campaigns are still live (if they were running directly, not through API). It's only your *access* that's gone.

**Day 60+ — Discovery**
Someone notices the discrepancy. Reporting stopped updating. An automated budget rule didn't fire. Scheduled posts didn't go out. Now you're in the reactive cycle: figure out what broke, reach out to the client, guide them through reauthorization, wait for them to do it.

Most agencies discover token expiration after the fact. The cost isn't just the downtime — it's the client conversation explaining why their campaigns stopped, the trust erosion, and the time spent on a problem that was entirely predictable.

---

## Platform-by-Platform Token Behavior

Each platform handles this differently, which is part of why OAuth token management is complicated at agency scale.

| Platform | Long-Lived Token Life | Auto-Refresh? | Reauth Trigger |
|----------|----------------------|---------------|----------------|
| Meta Ads / Business Manager | 60 days | No | Manual — client must reauthorize |
| Google Ads | 1 hour (access); refresh token persists until revoked | Yes, if refresh token valid | Password change, inactive 6+ months, or 50+ tokens issued |
| LinkedIn Campaign Manager | 60 days | No | Manual reauth |
| GA4 / Google Analytics | 1 hour (access); persistent refresh token | Yes, same Google rules | Same Google rules |
| TikTok Ads | 24 hours (access); 365-day refresh token | Yes | After 365 days or revocation |

The practical takeaway: Google and TikTok connections are self-healing if properly set up. Meta and LinkedIn connections will break on a predictable schedule and require your client to act.

For agencies with significant Meta spend — which is most agencies — this means a calendar of client reauthorization requests. Miss the window, and you're in damage control.

Google's rules are more nuanced: a [refresh token becomes invalid](https://developers.google.com/identity/protocols/oauth2#expiration) if it hasn't been used in six months, if the user revokes access, or if the account issues more than 50 tokens (the oldest get revoked). For most agency-client connections, the six-month inactivity rule is the relevant one — meaning a client who pauses Google Ads spend for a few months may require full reauthorization when they restart.

---

## Where Token Management Breaks Down for Agencies

Developer guides treat OAuth token management as a code problem: how do you store tokens securely, build refresh logic, and handle error states in your application? That's the right frame for building software.

For agencies, it's an operations problem. The questions that actually matter:

**Expiry tracking**: Which of your 47 client connections expire in the next 30 days? If you can't answer this without manually checking each one, you'll find out through breakage.

**Reauthorization workflow**: When a token expires, what happens? Is there an automated email to the client? Does someone on your team manually reach out? How many follow-ups do you send before escalating? Most agencies have no formal process — just reactive scrambling.

**Staff token audit**: When a team member leaves your agency, do you audit which platform connections were authorized through their personal credentials? In many cases, agency connections to client platforms are tied to individual accounts, not a centralized agency identity. A departing employee's tokens may stay active — and their reactivation path runs through someone who no longer works for you. This is the most underappreciated security gap in the agency stack. (The [agency offboarding section of this security checklist](/blog/agency-security-checklist) covers this in more detail.)

**Client offboarding**: When a client relationship ends, are tokens explicitly revoked? Or does the expiry clock just run out? Leaving tokens active after offboarding is a liability — as covered in the [client offboarding access guide](/blog/how-to-revoke-client-access-offboarding), most agencies still have active access to former clients' accounts six months after the relationship ends.

---

## What Good Token Management Looks Like

There's no standard "agency OAuth token management system" — most agencies cobble this together with spreadsheets, calendar reminders, and muscle memory. What separates agencies that handle this well from agencies that don't is rarely the tooling. It's having a defined process.

**1. Centralized expiry visibility**

Every client connection should have a known expiry date, visible in one place. Not scattered across five different platform dashboards. This is table stakes. If you can't see expiry dates in aggregate, you can't be proactive.

**2. 14-day advance reauthorization requests**

Send the reauthorization request before the token expires, not after. Fourteen days is the practical window: enough lead time for the client to act, not so early that they ignore it. A single reauthorization request sent on Day 45 of a 60-day token is better than three frantic messages sent after Day 60.

The reauthorization experience matters here. If the client has to navigate platform settings on their own, the response rate drops. A direct link that takes them straight to the authorization screen — like the flows AuthHub generates — completes faster than generic "please reconnect" instructions that require clients to navigate platform settings themselves.

**3. Quarterly staff token audits**

Every quarter, check which platform connections were authorized through individual team member credentials rather than a centralized agency account. When someone leaves, those connections should either be transferred or revoked before their last day — not discovered later when a client asks why their campaigns stopped.

**4. Offboarding integration**

Token revocation should be part of every client offboarding checklist, not an afterthought. When a relationship ends, revoke access intentionally. Don't wait for tokens to expire naturally. Active access to a former client's account — even if no one's using it — is a liability that most agencies carry without realizing it.

**5. Connection health monitoring**

Some platforms return specific error codes when a token is invalid or expired (Meta's error code 190, Google's `invalid_grant`). If your reporting pipeline or integration tools surface these errors, they're a signal, not noise. Build a process to act on them within 24 hours rather than letting them pile up.

---

## The Hidden Cost: What Token Failures Actually Cost

The direct cost of a token expiration is usually a few hours of downtime and a client conversation. The real cost is harder to quantify.

An agency managing clients in the $5,000–$50,000/month spend range is responsible for campaigns that don't pause well. A $20,000/month Google Ads client who loses reporting access for three days may not notice the campaigns were unaffected — but they'll notice the data gap in their dashboard and start asking questions about oversight.

Token failures erode the one thing that keeps client relationships intact: the sense that someone competent is watching.

The [client onboarding process](/blog/client-onboarding-checklist) that agencies invest weeks building can be undermined in a Friday evening outage caused by a token nobody was tracking. The agencies that treat token management as an operations discipline — not a technical afterthought — avoid that conversation entirely.

---

## Scaling Token Management Past 10 Clients

For agencies managing fewer than 10 clients, a spreadsheet with expiry dates and calendar reminders is workable. Tedious, but workable.

Past 10 clients, the math changes. If you have 40 client connections across Meta and LinkedIn — which both use 60-day tokens — you're managing roughly 3 expiring tokens per week on average. That's 3 client reauthorization requests per week, and clients rarely act on the first message. Some of those will take 2-3 follow-ups. That's a part-time job.

The operational answer at this scale is to centralize the access request layer. Tools like AuthHub handle token expiry monitoring, automate reauthorization outreach, and generate direct-link flows that clients can complete in under two minutes — rather than navigating platform settings on their own. The access request templates that [agencies send to new clients](/blog/social-media-access-request-template) become the same mechanism used for reauthorization.

If you are wiring Claude, ChatGPT, or Cursor to client ad accounts, token refresh is only half the stack—the other half is how clients grant OAuth in the first place. See [MCP OAuth for agencies: using tokens with AI agents](/blog/mcp-oauth-client-access-agencies) for one-link intake, vaulting, and per-client isolation without password sharing.

The math is worth running: if each reauthorization cycle takes 30-60 minutes of account management time across emails, follow-ups, and verification — and you're handling 12 reauthorizations per month — that's 6-12 hours a month on a problem with a known solution.

---

## The Invisible Infrastructure

OAuth token management is the infrastructure layer that holds agency operations together. It doesn't show up in case studies or agency credentials decks. Nobody talks about it at conference panels. But when it fails, everyone notices — including the client.

The agencies that handle this well aren't using more sophisticated tools. They've simply decided that predictable access is part of their service delivery standard, not an IT detail. They know which tokens expire next week. They have a process to handle reauthorization before campaigns go dark. They review access quarterly, not annually.

That's not technical work. It's operational discipline. And the cost of not having it shows up in client conversations you'd rather not have.

---

*AuthHub tracks token expiry across all connected platforms and sends reauthorization requests automatically. When a token is approaching its expiration, clients receive a direct-link request that completes in under two minutes — so the first time you hear about an expired token isn't from the client wondering why their campaigns stopped. [See how it works.](https://www.authhub.co)*
