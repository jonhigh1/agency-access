---
id: agency-security-checklist
title: "The Agency Security Checklist: Protect Client Access in 2026"
excerpt: >-
  A practical security checklist for agencies managing client platform access. Covers OAuth token storage, audit logging, offboarding, and SOC2 compliance — the security gaps most agencies don't know they have.
category: security
stage: consideration
publishedAt: '2026-04-15'
readTime: 14
author:
  name: Jon High
  role: Founder
tags:
  - agency security checklist
  - client data security
  - oauth token security
  - agency compliance
  - SOC2 for agencies
  - access management
  - security audit
metaTitle: "Agency Security Checklist 2026: Protect Client Platform Access"
metaDescription: >-
  The complete security checklist for agencies. OAuth token storage, audit logging, offboarding protocols, and SOC2 compliance for client access management.
relatedPosts:
  - what-is-client-access-management
  - leadsie-vs-authhub-comparison
  - flat-rate-vs-credit-pricing
  - how-to-onboard-new-marketing-client
---

Your agency has access to your clients' ad accounts, analytics, customer data, and credit cards. You're logging into their Meta Business Manager, their Google Ads MCC, their GA4 properties. You can spend their money and see their customers' behavior.

Now ask yourself: **Who on your team has access to all of that? When did they get it? When was the last time you checked?**

Most agencies can't answer these questions. They granted access months or years ago, never documented it, and haven't reviewed it since. The client relationship could have ended, the team member could have left, and the access is still there — a security liability waiting to become a problem.

This **agency security checklist** covers the fundamentals specific to managing client platform access. Not generic IT security. Not "use strong passwords." The actual risks that come with OAuth tokens, platform permissions, and the messy reality of 15+ client accounts across 5+ platforms.

---

## The 6-Phase Agency Security Framework

Security for agencies isn't one thing. It's a lifecycle that runs parallel to [client access management](/blog/what-is-client-access-management). Here's the framework:

| Phase | What It Covers | Frequency |
|-------|---------------|-----------|
| **1. Inventory** | What access exists, who has it, when it expires | Monthly |
| **2. Request** | How access is requested, approved, documented | Every new client/team member |
| **3. Storage** | Where tokens and credentials live | Continuous |
| **4. Monitoring** | Who's accessing what, anomaly detection | Real-time |
| **5. Maintenance** | Token refresh, permission updates, access reviews | Quarterly |
| **6. Offboarding** | Revoking access when relationships end | Every departure |

Most agencies do Phase 2 (request) and skip everything else. That's where the problems start.

---

## Phase 1: Inventory — Know What You Have

You can't secure what you don't know about. Start with a complete inventory of every platform connection your agency maintains.

### What to Document

For each client, track:

| Field | Example |
|-------|---------|
| Client name | Acme Dental |
| Platform | Meta Ads, Google Ads, GA4, LinkedIn |
| Access level | Admin, Standard, Read-only |
| Granted to | Team member email or "Agency MCC" |
| Granted date | 2024-03-15 |
| Expires | 2025-05-14 (for 60-day tokens) |
| Purpose | Monthly reporting + campaign management |

### How to Get This Information

**If you're using an access management tool:** Export from the dashboard. Most tools show all connections in one place.

**If you're doing it manually:** Log into each platform and check:

- **Meta Business Manager:** Business Settings → People → Filter by your agency
- **Google Ads:** Tools & Settings → Access and security → Managers
- **GA4:** Admin → Property access management
- **LinkedIn Campaign Manager:** Account settings → Manage access

This is tedious. A 10-client agency with 4 platforms per client has 40 connections to audit. Plan for 2-3 hours the first time.

### Red Flags to Watch For

- **Orphaned access:** Team members who left but still have permissions
- **Expired clients:** Access granted 18 months ago to a client you haven't worked with in a year
- **Over-permissioned accounts:** Everyone has admin access when only 2 people need it
- **Missing expiration dates:** Long-lived tokens with no refresh schedule

---

## Phase 2: Request — Controlled Access Granting

Every new access grant should follow a consistent process. Not "the account manager emails the client asking for admin access." This should be part of your broader [client onboarding workflow](/blog/how-to-onboard-new-marketing-client) — security built in from day one, not bolted on later.

### The Access Request Protocol

1. **Define the minimum access level needed**
   - Can this person do their job with read-only access? Start there.
   - Do they need to create campaigns or just view reports?
   - Admin access should require explicit justification.

2. **Use the client's platform, not your personal account**
   - Never connect client platforms to personal email addresses.
   - Agency email = audit trail = professional boundaries.

3. **Document the request in a central location**
   - Who requested it, when, why, and what level.
   - This becomes your audit trail.

4. **Set a calendar reminder for token expiration**
   - Meta long-lived tokens: 60 days
   - Google OAuth tokens: 60 minutes (refresh tokens: 6 months)
   - LinkedIn: 60 days for member tokens

### Access Level Matrix

Not everyone needs admin access. Here's a sensible default:

| Role | Meta Access | Google Ads Access | GA4 Access |
|------|-------------|-------------------|------------|
| Account Manager | Ad account analyst | Reporting only | Read + analyze |
| Strategist | Ad account admin | Standard | Edit |
| Media Buyer | Ad account admin | Standard | — |
| Analyst | Ad account analyst | Reporting only | Read + analyze |
| Executive | Business manager employee | — | Read |

Adapt this to your agency structure. The principle: **start with the minimum, escalate only when needed.**

---

## Phase 3: Storage — Where Tokens Live

This is where most agencies — and the tools they use — have a security blind spot.

### The Database Problem

OAuth tokens are credentials. They grant access to your clients' ad accounts, analytics data, and in some cases, payment methods. When a tool stores these tokens in a standard database:

- The database can be queried by anyone with database access
- If the database is compromised, all tokens are exposed at once
- There's no audit trail of who accessed which token and when
- Tokens can't be rotated without re-authorization

This is how breaches happen. Not through sophisticated attacks — through basic database access to credentials that should never have been there. The [IBM Cost of a Data Breach Report](https://www.ibm.com/reports/data-breach) found that the average breach costs $4.45 million, and compromised credentials are the most common initial attack vector. Your client tokens are exactly the kind of credential attackers want.

### The Secrets Management Standard

Tokens should be stored in a dedicated secrets management system:

| Feature | Database Storage | Secrets Management |
|---------|------------------|-------------------|
| Encryption | Optional | Required (AES-256) |
| Access control | Database permissions | Granular, auditable |
| Audit trail | None | Every access logged |
| Rotation | Manual, disruptive | Automatic, transparent |
| Audit evidence for security reviews | Hard to produce | Generated automatically |

Systems like Infisical, HashiCorp Vault, and AWS Secrets Manager are built for this. They're what Fortune 500 companies use to store credentials. Your client access tokens deserve the same standard — and if you're [comparing access management tools](/blog/leadsie-vs-authhub-comparison), token storage architecture should be on your evaluation checklist.

**If your access management tool can't tell you where tokens are stored, that's a security gap.** The OAuth 2.0 specification [explicitly warns](https://datatracker.ietf.org/doc/html/rfc6819) against storing tokens in plaintext or unprotected databases.

---

## Phase 4: Monitoring — Audit Logging

You need to know who accessed what, when, and from where. Not for paranoia — for accountability and incident response.

### What to Log

Every access to client platform credentials should record:

- **Who:** User email and role
- **When:** Timestamp (ISO 8601 format)
- **What:** Client name, platform, action taken
- **From where:** IP address, user agent
- **Why:** Business purpose (scheduled report, campaign update, etc.)

### Why This Matters

**Scenario 1:** A client calls saying someone made unauthorized changes to their campaign. With audit logs, you can see exactly who accessed that account in the last 48 hours. Without them, you're guessing.

**Scenario 2:** Your agency is pursuing an enterprise client who requires [SOC2 compliance](https://www.aicpa.org/soc2). They ask for your security documentation. Audit logs are non-negotiable. If you can't produce them, the deal stalls.

**Scenario 3:** A team member's laptop is stolen. You need to know what client data they had access to and rotate those credentials immediately. Audit logs tell you what's at risk.

### Real-Time Alerts

For high-value clients or sensitive actions, set up real-time alerts:

- New admin access granted
- Access from unrecognized IP addresses
- Bulk data exports
- Access outside business hours

These don't prevent incidents, but they dramatically reduce response time.

---

## Phase 5: Maintenance — Keeping Access Current

Access isn't "set it and forget it." Tokens expire, team roles change, and client relationships evolve. This is why the [client access management lifecycle](/blog/what-is-client-access-management) includes maintenance as a dedicated phase.

### Token Refresh Schedule

| Platform | Token Lifetime | Refresh Schedule |
|----------|---------------|------------------|
| Meta long-lived tokens | 60 days | Refresh at day 50 |
| Google OAuth refresh tokens | 6 months | Refresh at month 5 |
| LinkedIn member tokens | 60 days | Refresh at day 50 |
| TikTok access tokens | 24 hours | Automatic refresh required |

If you're managing this manually, set calendar reminders. If you're using an access management tool, verify that automatic refresh is actually happening — don't assume.

### Quarterly Access Reviews

Every 90 days, review access for each client:

1. **Is this client still active?** If not, revoke access.
2. **Do the current team members still need access?** Roles change.
3. **Are permission levels still appropriate?** Maybe read-only is sufficient now.
4. **When did tokens last refresh?** Catch expirations before they cause problems.

This takes 30 minutes per client. A 10-client agency: 5 hours per quarter. Worth it for the security posture.

---

## Phase 6: Offboarding — Clean Breaks

When a client relationship ends — or a team member leaves — access needs to be revoked. Completely. Immediately.

### Client Offboarding Checklist

- [ ] Revoke agency access from Meta Business Manager
- [ ] Remove agency from Google Ads MCC
- [ ] Disconnect agency from GA4 properties
- [ ] Revoke LinkedIn Campaign Manager access
- [ ] Disconnect any other platforms (TikTok, Pinterest, etc.)
- [ ] Delete stored tokens from your systems
- [ ] Archive (don't delete) audit logs for compliance
- [ ] Send confirmation to client: "Access revoked as of [date]"

### Team Member Offboarding Checklist

- [ ] Revoke access to all client platforms
- [ ] Reset shared passwords they had access to
- [ ] Review audit logs for their recent access
- [ ] Update any API keys or service accounts they had access to
- [ ] Notify affected clients if the departing person was their primary contact

**The six-month problem:** Most agencies skip offboarding. Six months later, the former client's new agency asks why your name still shows up as a partner on their ad account. Or the departed team member still has access to client analytics. This is how professional relationships end badly.

---

## The Complete Agency Security Checklist (Print This)

Print this. Use it quarterly. Update it as your client roster changes.

### Access Inventory
- [ ] All client platforms documented (client, platform, access level, holder, date)
- [ ] No orphaned access (former team members removed)
- [ ] No zombie clients (access revoked for ended relationships)
- [ ] Expiration dates tracked for all tokens

### Access Control
- [ ] Minimum access levels enforced (not everyone gets admin)
- [ ] Access requests documented with justification
- [ ] Calendar reminders set for token refresh
- [ ] Access level matrix defined and followed

### Token Storage
- [ ] Tokens stored in secrets management system (not database)
- [ ] Encryption at rest confirmed (AES-256 or equivalent)
- [ ] Access control granular (not "all or nothing")
- [ ] Rotation supported without client re-authorization

### Audit Logging
- [ ] Every token access logged (who, when, what, where)
- [ ] Logs retained for minimum 12 months
- [ ] Logs exportable for compliance audits
- [ ] Real-time alerts configured for sensitive actions

### Maintenance
- [ ] Quarterly access reviews scheduled
- [ ] Token refresh automated or calendared
- [ ] Permission levels reviewed when roles change
- [ ] Expired tokens caught before causing issues

### Offboarding
- [ ] Client offboarding checklist documented and followed
- [ ] Team member offboarding checklist documented and followed
- [ ] Confirmation sent to clients when access revoked
- [ ] Audit logs archived (not deleted) for compliance

---

## What Good Looks Like

Agencies with strong security practices share these characteristics:

**1. They can answer "who has access to what?" in under 5 minutes.**
Not "let me check each platform and get back to you." A dashboard or document that shows everything in one place.

**2. They treat tokens like the credentials they are.**
Not stored in a database. Not in a spreadsheet. In a proper secrets management system with encryption and audit trails.

**3. They have offboarding protocols, not just onboarding.**
When someone leaves — client or team member — there's a checklist. It gets followed. There's a paper trail.

**4. They're ready for enterprise sales.**
When a prospect sends a security questionnaire, they can answer it with evidence. Audit logs, token storage documentation, access policies — it's all ready.

---

## When to Use a Tool vs. Build It Yourself

You can implement most of this with spreadsheets, calendar reminders, and discipline. For agencies with fewer than 10 clients, that might be sufficient.

But at scale, manual security breaks down:

- **10 clients × 4 platforms × 2 access levels = 80 connections to track**
- **Quarterly reviews = 5 hours per quarter**
- **One missed offboarding = professional embarrassment or worse**

Access management tools like AuthHub handle the security infrastructure automatically:

- Token storage in Infisical (secrets management, not database)
- Audit logging for every access (complete, exportable trail)
- One-click offboarding across all platforms
- Token refresh without client intervention

The question isn't whether you need security practices — you do. The question is whether you want to build and maintain them yourself, or use a tool that handles it as a side effect of doing the job. And when you're [comparing pricing models](/blog/flat-rate-vs-credit-pricing), remember that security features like audit logging and secrets management aren't add-ons — they're infrastructure.

---

## The Bottom Line

Your clients trust you with access to their advertising spend, their customer data, and their business analytics. That trust is earned through competence, and confirmed through security.

The checklist in this article covers the fundamentals. Most agencies are missing at least half of it. If you implement everything here, you'll be ahead of 90% of the agencies your clients could hire instead.

Start with Phase 1 (inventory). Everything else builds on knowing what access you actually have.
