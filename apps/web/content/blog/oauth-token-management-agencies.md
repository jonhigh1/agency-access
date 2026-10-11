---
id: oauth-token-management-agencies
title: 'OAuth Token Refresh for Agencies: Stop Friday-Night Meta Token Deaths'
excerpt: >-
  Agency guide to OAuth token refresh: what auto-renews, what needs a client click,
  and how Infisical-backed auto-refresh plus 14-day reauth requests stop Friday-night
  outages.
category: operations
stage: awareness
publishedAt: '2026-05-06'
updatedAt: '2026-10-10'
readTime: 15
author:
  name: Jon High
  role: Founder
tags:
  - oauth token refresh
  - oauth token management
  - client access management
  - agency operations
  - token expiration
  - meta ads access
  - google ads access
  - agency security
  - platform access
metaTitle: 'OAuth Token Refresh for Agencies: Stop Friday-Night Meta Token Deaths'
metaDescription: >-
  Agency guide to OAuth token refresh: what auto-renews, what needs a client click,
  and how Infisical-backed auto-refresh plus 14-day reauth requests stop Friday-night
  outages.
relatedPosts:
  - mcp-oauth-client-access-agencies
  - agency-security-checklist
  - what-is-client-access-management
  - how-to-revoke-client-access-offboarding
  - client-onboarding-checklist
  - best-client-onboarding-software-agencies-2026
---

# OAuth Token Refresh for Agencies: Stop Friday-Night Meta Token Deaths

The client's Meta campaigns stopped spending at 11pm on a Friday.

Not a budget issue. Not targeting. Automated rules were fine. Creative was fine. What broke was an OAuth token—the authorization that gave your agency permission to manage the account. It expired while everyone was offline. By Monday morning, the client had already spent the weekend wondering why campaigns went dark.

That is the nature of OAuth tokens: invisible until they break. When they break, the failure looks like a campaign problem, a platform glitch, or a budget issue—before anyone checks the access layer.

This page is the **agency ops** guide to **OAuth token refresh** and reauthorization—not a curl cookbook. Developer docs explain `grant_type=refresh_token`. Meta MCP posts tell you to use System Users or set a 55-day reminder. Agencies need something else: expiry visibility across the roster, automatic refresh where platforms allow it, and a white-labeled client click before Meta and LinkedIn clocks hit zero.

Token-refresh and Meta-expiry queries are still absent from AuthHub's GSC top queries in the last 28 days (SnowSEO, 2026-09-02 → 2026-09-29 PT). Adjacent demand is real: `oauth token refresh` **170**, `refresh token oauth` **170**, `oauth 2.0 refresh token` **70**, `oauth token expiry` **70**, `google oauth refresh token` **40**, `oauth refresh token expiration` **20**, `oauth refresh token flow` **10** monthly US searches (SnowSEO keyword_research, 2026-09-29). Exact phrases like `meta ads token expired` and `automatic oauth token refresh agencies` show **0** monthly search—useful as long-tail / AEO intent, not volume proof. (`oauth renew token` is **0** today—do not treat older snapshots as live.)

**[Start 14-day free trial — no credit card](/)** · [AuthHub pricing](/pricing) · [MCP OAuth for agencies (same vault, agents)](/blog/mcp-oauth-client-access-agencies)

---

### Quick answers (for humans and assistants)

**What is OAuth token refresh for agencies?**  
OAuth token refresh is how your tools get a new short-lived access token without making the client log in again—usually by storing a longer-lived refresh token and calling the platform's token endpoint before the access token dies. For agencies, "refresh" only works when the platform supports it (often Google and TikTok Login-style grants). Meta and LinkedIn long-lived user grants commonly still need a client reauthorization before the ~60-day clock hits zero—unless you are on an approved LinkedIn refresh path or a Meta System User architecture.

**Why did our Meta Ads access die overnight?**  
Meta long-lived user access tokens typically expire on a ~60-day cycle (and can die sooner after password changes or revoked app access). Platforms often do not email you first. API calls then fail with errors like code **190** ("session has expired"), which looks like a campaign or reporting outage. Fix it by sending the client a direct reauthorization link, confirming the right assets/scopes, and putting expiry monitoring in place so the next cycle is handled about 14 days early.

**How do agencies stop OAuth tokens from expiring on Friday night?**  
Centralize expiry dates across clients and platforms, auto-refresh where the platform allows, and send a white-labeled reauthorization request about two weeks before Meta/LinkedIn-style tokens expire—not after campaigns go dark. Store tokens in a vault with audit logs (AuthHub uses Infisical), avoid password sharing, and treat staff offboarding and client offboarding as token-revocation events. AuthHub does **not** claim SOC 2 and does **not** promise that access "never expires."

---

## The outage that looks like a campaign problem

For agencies managing 20, 50, or 100 client accounts across Meta, Google Ads, GA4, LinkedIn, and TikTok, OAuth token management is less of a technical detail and more of an operational risk. The cost is not only downtime—it is the client conversation, the trust hit, and hours spent on a predictable failure.

Promise of this page: track what expires, refresh what can renew silently, and get a client click before Meta and LinkedIn clocks hit zero.

---

## What "OAuth token refresh" actually means

OAuth tokens are the digital keys that give your agency permission to manage a client's ad accounts. When a client connects Meta Business Manager or Google Ads, they are not sharing a password. They are authorizing a time-limited grant that says: this agency can take these specific actions on my behalf.

A token proves **permission**, not identity. Permissions expire.

### Access token vs refresh token vs long-lived token

- **Access tokens** — short-lived (often ~1 hour on Google; shorter Meta user tokens measured in hours). Used for API calls; renewable in the background when a valid refresh token exists.
- **Refresh tokens** — longer-lived. Silently renew access tokens without a client login. When they expire or are revoked, you need the client again.
- **Long-lived tokens** — platform-specific. Meta's ~60-day long-lived **user** tokens do **not** behave like Google's silent refresh loop.

Useful agency distinction: **some connections renew silently; some require the client to click again.**

### The refresh grant in one paragraph (no RFC)

Apps that hold a refresh token call the platform's token endpoint with `grant_type=refresh_token` to mint a new access token. Okta, Auth0, and Google own the curl details. Your job is knowing which client connections can renew silently, which still need a Business Manager / Campaign Manager click, and how you ask for that click without Zoom archaeology.

---

## Platform-by-platform: what auto-refreshes vs what needs the client

Each platform handles expiry differently. That is why token ops gets hard at agency scale.

| Platform | Typical token life | Silent auto-refresh? | What usually forces a client click |
| --- | --- | --- | --- |
| **Meta Ads / Business Manager** (user long-lived) | ~**60 days** | **No** for long-lived user tokens | Manual reauth; also password change / app revoke. **System User** tokens are a different architecture (no timer expiry unless revoked)—not a substitute for every client-granted agency workflow |
| **Google Ads** | Access ~**1 hour**; refresh persists until revoked | **Yes**, while refresh token is valid | Password / revoke; refresh unused **6+ months**; **100** refresh tokens per Google Account per OAuth client ID (oldest dropped); Testing-mode apps can expire in 7 days |
| **LinkedIn Campaign Manager** | Access **60 days** | **Only** if your app is approved for programmatic refresh (**365-day** refresh TTL for MDP partners). Otherwise: member reauth | Access expiry for non-approved apps; refresh TTL end even for approved partners; LinkedIn can revoke |
| **GA4 / Google Analytics** | Same Google pattern as Ads | **Yes**, same Google rules | Same Google invalidation rules |
| **TikTok** (Login / user-token family) | Access **24 hours**; refresh **365 days** | **Yes** for access via refresh, while refresh is valid | After refresh TTL or revocation. **Note:** some TikTok Marketing / Business long-term advertiser tokens are described differently—confirm the token family you actually store |

**Practical takeaway:** Google and TikTok Login-style connections self-heal if offline refresh is set up and a vault renews before access dies. Meta user grants and many LinkedIn connections still break on a schedule and need the client (or an approved LinkedIn refresh path / Meta System User design). Google nuance: refresh tokens still die after six months unused, revoke/password events, or when you burn past **100** refresh tokens per Google Account per OAuth client ID.

---

## Why agencies fail at token refresh (ops, not code)

Developer guides treat OAuth as a code problem. For agencies, it is operations.

### No single expiry view across 20–50 clients

Which connections expire in the next 30 days? If you cannot answer without five platform dashboards, you will learn through breakage.

### Reactive "please reconnect" after error 190

Most teams discover expiry after the fact—reporting stalls, a budget rule misses—then scramble: diagnose, email, guide reauth, wait, follow up.

### Staff-tied tokens and offboarding gaps

When someone leaves, audit grants tied to their personal credentials. Many agency connections are individual, not centralized; reactivation can run through someone who no longer works there. Client offboarding mirrors it: revoke intentionally—do not leave former-client access live until natural expiry.

---

## The agency playbook: refresh where you can, reauth before you must

Spreadsheets work under ~10 clients. Past that, Meta and LinkedIn's ~60-day cycles become a part-time job. You need a process—and tooling that makes the client's click easy.

### Centralize expiry visibility

Every connection needs a known expiry date in one place. Aggregate visibility is table stakes.

### Auto-refresh + vault (Infisical) for platforms that support it

Where platforms allow it, renew access in the background and keep refresh material in a real vault—not a spreadsheet, Slack thread, or laptop `.env`. AuthHub stores tokens in **Infisical**, auto-refreshes where providers support it, and keeps **audit logs** of who accessed what and when.

What we do **not** claim: **SOC 2**. Infisical + audit logs only.

### 14-day white-label reauth for Meta / LinkedIn

Send reauth **before** expiry. Fourteen days is the practical window. A single Day-45 request on a 60-day Meta grant beats three frantic messages after Day 60. A **direct, white-labeled link** beats "please reconnect in Business Manager" click-paths.

### When System Users are the right Meta answer (and when they're not)

Meta **System Users** help server/MCP stacks: no timer expiry unless revoked. Fair—and incomplete for many agency workflows that still need **client-granted** OAuth plus reauth UX. AuthHub does not replace Business Manager System Users for every architecture.

Wiring Claude, ChatGPT, or Cursor to client ads? Refresh is half the stack—intake is the other. See [MCP OAuth for agencies](/blog/mcp-oauth-client-access-agencies) for one-link intake, vaulting, and per-client isolation. **Same vault feeds humans and agents**; that page owns access collection. This page owns refresh ops.

---

## Troubleshooting cheat sheet

### Meta error 190 / "Session has expired"

**What it usually means:** the access token is invalid, expired, or revoked. On long-lived user tokens, that often means the ~60-day clock ran out—or the user changed their password / revoked the app.

**Agency steps:** confirm which asset/grant failed; send a **direct reauth link**; confirm scopes after the client finishes; resume reporting and log it; schedule ~14-day early outreach so 190 is not your first alert again. System Users help server architectures; they do not erase client-granted reauth UX.

### Google `invalid_grant` / missing refresh token

**Usually means:** refresh token expired, revoked, unused too long, killed by token caps, or never issued (missing offline access / consent).

**Agency steps:** verify who owns the grant; send a clean reauth link; confirm a refresh token was stored; watch clients who paused Ads for months (six-month unused rule); avoid reconnect loops that burn the **100** refresh tokens per Google Account per OAuth client ID.

---

## How AuthHub fits (and what we won't claim)

AuthHub is the client access layer for agencies that are tired of Friday-night token deaths:

- **One link** for client OAuth across featured platforms (Meta, Google Ads, GA4, LinkedIn, TikTok) with honest **15+** coverage overall—not Leadsie-class long-tail parity.
- **Infisical-backed** token storage.
- **Automatic refresh** where providers support it.
- **Audit logs** of access events.
- **White-label** reauth / onboarding links so the client never has to dig through platform settings alone.
- **Dual-run migration only**—keep the current tool live while new clients and re-authorizations complete AuthHub; no SaaS ports platform permissions.

**Pricing (monthly primary, caps = active clients):**

| Plan | Monthly | Active clients | Notes |
| --- | --- | --- | --- |
| Starter | **$29** | **5** | One-link onboarding, token auto-refresh, audit logs |
| Growth | **$79** | **20** | White-label, custom domain, API + webhooks, token health dashboard |
| Scale | **$149** | **50** | Multi-brand (up to 3), custom integrations |

Annual billing displays roughly **~$24 / $66 / $124** per month equivalent ($290 / $790 / $1,490 per year) for the same caps—footnote only; compare like-for-like on [AuthHub pricing](/pricing). All plans include a 14-day free trial (no credit card on the public pricing page). API + webhooks from Growth up.

**Cannot claim here:** SOC 2; that access "never expires"; uncleared testimonials; exclusive intake vs peers; that AgencyAccess is "Zapier-only."

Homepage marketing may say access never drops. Precise product truth: **auto-refresh where platforms allow + proactive reauth where they don't + health monitoring.** Platforms still revoke. Meta-class long-lived user tokens still need a client click when refresh cannot save you.

---

## FAQ

### Refresh vs asking the client to reconnect?

Refresh = silent renewal with a stored refresh token. Reconnect = new client consent click. Google and TikTok Login-style grants often refresh silently; Meta user grants and many LinkedIn setups still need the scheduled click.

### Why Meta ~60 days while Google often renews in the background?

Meta long-lived **user** tokens sit on a ~60-day clock without Google-style silent refresh. Google pairs short-lived access tokens with a refresh token (offline access) until revoke, six months unused, or cap/policy invalidation.

### Staff leaving or clients ending?

Treat both as revocation events. Audit staff-tied grants before last day. Revoke client tokens at offboarding—do not wait for natural expiry.

### Does AuthHub replace Meta System Users?

No. System Users are a BM server pattern. AuthHub owns intake, Infisical vaulting, auto-refresh where allowed, audit logs, and white-label reauth for client-granted OAuth.

### Migrate without downtime?

**Dual-run only:** keep the current tool live, send AuthHub links for new onboards and reauths, cut over when those clients finish. Clients must approve again.

---

## Related reading / next steps

- [MCP OAuth for agencies](/blog/mcp-oauth-client-access-agencies) — same vault feeds AI agents; access collection, not this refresh pillar
- [Best client onboarding software for agencies (2026)](/blog/best-client-onboarding-software-agencies-2026)
- [AuthHub vs Leadsie](/compare/leadsie-alternative) · [Leadsie pricing](/compare/leadsie-pricing) · [AgencyAccess alternative](/compare/agencyaccess-alternative) · [Leadsie vs AgencyAccess vs AuthHub](/compare/leadsie-vs-agencyaccess-vs-authhub)
- [Best Leadsie alternatives (2026)](/blog/best-leadsie-alternatives-2026)
- [AuthHub pricing](/pricing) · [Start free trial](/)

AuthHub tracks token expiry across connected platforms, auto-refreshes where providers allow it, and sends white-labeled reauthorization requests before Meta and LinkedIn clocks hit zero—so the first time you hear about an expired token is not from the client wondering why campaigns stopped. [See how it works](/).
