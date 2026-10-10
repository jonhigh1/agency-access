---
id: how-to-revoke-client-access-offboarding
title: How to Revoke Client Access When Offboarding (The Complete 2026 Guide)
excerpt: >-
  The client relationship ended three months ago. Your agency still has access to their
  Meta Business Manager, Google Ads, and GA4. That's a liability. Here's how to
  revoke client access across every platform — and why most agencies skip this step.
category: operations
stage: consideration
publishedAt: '2026-04-21'
updatedAt: '2026-10-10'
readTime: 12
author:
  name: Jon High
  role: Founder
tags:
  - how to revoke client access
  - client offboarding
  - agency offboarding
  - revoke platform access
  - client access management
  - agency security
  - remove agency access
metaTitle: 'How to Revoke Client Access When Offboarding (2026 Guide)'
metaDescription: >-
  Step-by-step guide to revoking client access across Meta, Google, LinkedIn, and TikTok
  when offboarding. Includes platform-specific instructions, offboarding checklists,
  and security best practices for agencies.
relatedPosts:
  - agency-security-checklist
  - what-is-client-access-management
  - how-to-onboard-new-marketing-client
  - client-onboarding-checklist
  - flat-rate-vs-credit-pricing
---

# How to Revoke Client Access When Offboarding (The Complete 2026 Guide)

A client sends you an email on a Tuesday afternoon: "We've decided to go in a different direction. Our last day will be the end of this month."

You acknowledge the email, wrap up the final campaigns, send the last report, and move on. Three months later, you get a call from their new agency: "Hey, why does your agency still have admin access to their Meta Business Manager?"

That's not an awkward conversation. That's a liability.

Most agencies have meticulous onboarding processes. Welcome emails. Kickoff calls. Access request templates. Intake forms. But when a client leaves? A quick "best of luck" and the file gets archived. The access stays.

This guide covers **how to revoke client access** across every platform — Meta, Google Ads, GA4, LinkedIn, TikTok, Pinterest — and why skipping this step is a liability waiting to surface.

---

## The Six-Month Problem

Six months after a client relationship ends, most agencies still have access to that client's accounts.

Not because anyone's malicious. Because revocation is invisible. There's no reminder. No automated alert. The client doesn't chase you to remove access — they assume it happened automatically. And your team is busy onboarding new clients, not offboarding old ones.

Three scenarios that play out regularly:

**The new agency finds you.** They're auditing account access and see your agency listed with full admin permissions. The client asks: "I thought we ended that relationship?" Trust erodes before the new relationship starts.

**The departing laptop.** A team member leaves. Their laptop still has active sessions to former clients' accounts. Six months later, that laptop is compromised. The attacker gains access to accounts your agency shouldn't even be connected to.

**The stalled enterprise deal.** You're pursuing an SOC2-compliant prospect. They ask for your offboarding protocol. You explain that you "usually" remove access. They ask for documentation. You don't have any. The deal dies.

The [IBM Cost of a Data Breach Report](https://www.ibm.com/reports/data-breach) found that compromised credentials are the most common initial attack vector. Every orphaned access point is a credential waiting to be exploited.

---

## The Offboarding Framework

Client offboarding isn't one step. It's a process with five distinct phases — the inverse of your onboarding workflow:

| Phase | What Happens | Time Required |
|-------|--------------|---------------|
| **1. Notification** | Client confirms end of relationship, final deliverables agreed | 1-2 days |
| **2. Asset Transfer** | Export reports, creative files, audience data, campaign structures | 2-4 hours |
| **3. Access Revocation** | Remove agency from all platforms, delete stored tokens | 1-2 hours |
| **4. Documentation** | Log what was revoked, when, by whom; archive audit logs | 30 min |
| **5. Confirmation** | Send client confirmation that access has been removed | 15 min |

Most agencies do Phase 1 and skip 2-5. That's where the liability builds.

---

## Platform-by-Platform Revocation Instructions

Each platform has a different method for removing access. Some are straightforward. Some require multiple steps. Here's the complete breakdown.

### Meta Business Manager

Meta has two layers: Business Manager partnerships and individual ad account access. You need to remove both.

**If the client granted access via Business Manager partnership:**

1. Log into [business.facebook.com](https://business.facebook.com)
2. Go to **Business Settings** → **Users** → **Partners**
3. Find your agency's Business Manager
4. Click **Remove** next to each asset (ad accounts, Pages, pixels)
5. Click **Remove Partner** to disconnect

**If the client added individual emails:**

1. Go to **Business Settings** → **People**
2. Find each team member's email
3. Click **Remove** for each asset
4. Repeat for every team member

**What to verify:**
- Your agency no longer appears in Business Settings → Partners
- No team member emails remain in Business Settings → People

Meta's [Business Manager documentation](https://www.facebook.com/business/help) covers the official flows, but doesn't emphasize the partnership vs. individual distinction — both need removal.

### Google Ads

Google Ads uses email-based invitations. Revocation removes those invitations.

**To remove agency access:**

1. The client logs into [ads.google.com](https://ads.google.com)
2. Click **Tools & Settings** → **Access and security**
3. Find your agency email addresses
4. Click **Remove access** for each one
5. Confirm the removal

**If your agency uses an MCC (Manager Account):**

The client needs to unlink your MCC from their account:

1. In the client account, go to **Tools & Settings** → **Access and security**
2. Click the **Managers** tab
3. Find your MCC
4. Click **Unlink**

**What to verify:**
- Your agency email no longer appears in Access and security
- If MCC: the client account no longer shows in your hierarchy

Google's [access management documentation](https://support.google.com/google-ads/answer/9978556) covers permission levels and removal.

### Google Analytics 4 (GA4)

GA4 access is separate from Google Ads. Both need to be removed.

**To remove GA4 access:**

1. The client logs into [analytics.google.com](https://analytics.google.com)
2. Select the correct property
3. Click **Admin** → **Property access management**
4. Find your agency email addresses
5. Click **Remove access** for each one
6. Repeat for any other properties your agency had access to

**What to verify:**
- Your agency email no longer appears in Property access management

### LinkedIn Campaign Manager

LinkedIn uses account-level invitations with a different UI from other platforms.

**To remove LinkedIn access:**

1. The client logs into [linkedin.com/campaignmanager](https://linkedin.com/campaignmanager)
2. Click account name → **Account settings**
3. Go to **Manage access**
4. Find your agency email addresses
5. Click **Remove** for each one
6. Confirm the removal

**What to verify:**
- Your agency emails no longer appear in Manage access
- No active campaigns show your agency as the owner

LinkedIn's [user roles documentation](https://www.linkedin.com/help/lms/answer/a1642661) covers permission levels, not the revocation process.

### TikTok Ads Manager

TikTok uses Business Center partnerships similar to Meta.

**If access was granted via Business Center:**

1. The client logs into [ads.tiktok.com](https://ads.tiktok.com)
2. Click profile → **Business Center**
3. Go to **Settings** → **Partners**
4. Find your agency's Business Center
5. Click **Remove partner**
6. Confirm the removal

**If individual emails were added:**

1. Go to **Account settings** → **User management**
2. Find your agency email addresses
3. Click **Remove** for each one
4. Confirm the removal

**What to verify:**
- Your Business Center no longer appears in Partners
- No agency emails remain in User management

### Pinterest Ads

Pinterest uses account-level invitations with a simpler interface.

**To remove Pinterest access:**

1. The client logs into [ads.pinterest.com](https://ads.pinterest.com)
2. Click profile → **Settings**
3. Go to **Access management**
4. Find your agency email addresses
5. Click **Remove** for each one
6. Confirm the removal

**What to verify:**
- Your agency emails no longer appear in Access management

---

## What Most Agencies Get Wrong

### Mistake 1: Only Removing Some Platforms

You revoke Meta and Google Ads. You forget about GA4. Or LinkedIn. Or the TikTok Business Center set up once and never used again.

Each platform is a separate access point. A 5-platform client means 5 separate revocations. Missing one leaves the liability in place.

**The fix:** Use the [agency security checklist](/blog/agency-security-checklist) as your offboarding template. It covers every platform and includes verification steps.

### Mistake 2: Relying on the Client to Remove You

You send an email: "Please remove our access." The client says they will. Three months later, nothing has happened.

The client is transitioning to a new agency. Removing old access isn't their priority. It's yours.

**The fix:** Request written confirmation within 48 hours. If the client doesn't confirm, follow up. If they can't do it, offer a screen-share session.

### Mistake 3: Not Documenting the Revocation

You remove access. Two years later, the former client claims you during a security incident that you still had access. You have no proof otherwise.

**The fix:** Log every revocation with date, time, platform, who performed it it and screenshot or confirmation email. Five minutes of work. Indefinite protection.

### Mistake 4: Leaving Tokens in Your System

You remove the client from Meta Business Manager. But the OAuth token stored in your system still exists. That token can access the client's data until it expires.

**The fix:** When using an access management tool, verify that offboarding deletes stored tokens — not just the visible connection. AuthHub stores tokens in Infisical and deletes them on offboarding. If your tool can't answer where tokens are stored or what happens on offboarding, that's a gap.

---

## The Offboarding Checklist

Print this. Use it for every client departure. No exceptions.

### Asset Transfer
- [ ] Exported all campaign reports (last 12 months minimum)
- [ ] Downloaded creative files and assets
- [ ] Exported audience lists and custom segments
- [ ] Documented campaign structure and naming conventions
- [ ] Sent all files to client via secure transfer

### Access Revocation
- [ ] Removed agency from Meta Business Manager (partners + people)
- [ ] Removed agency emails from Google Ads
- [ ] Unlinked agency MCC from client Google Ads account (if applicable)
- [ ] Removed agency emails from GA4 properties
- [ ] Removed agency emails from LinkedIn Campaign Manager
- [ ] Removed agency from TikTok Business Center or ad account
- [ ] Removed agency emails from Pinterest Ads
- [ ] Removed agency from any other platforms (Pinterest, etc.)

### Token Cleanup
- [ ] Deleted stored OAuth tokens from your systems
- [ ] Revoked API access if applicable
- [ ] Confirmed no service accounts remain connected

### Documentation
- [ ] Logged date, time, and platforms revoked
- [ ] Saved confirmation emails or screenshots
- [ ] Archived client audit logs (don't delete — compliance)
- [ ] Updated internal access inventory

### Team Cleanup
- [ ] Removed client folder from shared drives
- [ ] Archived project in project management system
- [ ] Removed client-specific Slack channels or groups
- [ ] Notified affected team members that access is revoked

### Confirmation
- [ ] Sent client confirmation email with revocation summary
- [ ] Included date, platforms removed, and contact for questions
- [ ] Requested written acknowledgment (optional but recommended)

---

## The Confirmation Email Template

Send this after revocation is complete:

**Subject:** Platform access revoked — [Client Name]

Hi [Client Name],

As of [date], [Agency Name] has revoked all access to your advertising and analytics platforms.

**Platforms where access was removed:**
- Meta Business Manager (ad accounts, Pages, pixels)
- Google Ads
- Google Analytics 4
- LinkedIn Campaign Manager
- TikTok Ads Manager
- Pinterest Ads

**What this means:**
- No one at our agency can access your accounts
- All stored OAuth tokens have been deleted from our systems
- You will not receive any further reports or communications from us related to these accounts

**Your next step:**
If you haven't already, add your new agency or team members to these platforms using the access management settings within each account.

If you have any questions about what was transferred or removed, reply to this email and we'll clarify within 24 hours.

Best,
[Your name]

---

## When to Use a Tool vs. Manual Revocation

You can revoke access manually using the platform-by-platform instructions above. For agencies with fewer than 10 clients, this takes 1-2 hours per offboarding and is manageable.

At scale, manual revocation breaks down:

- **10 active clients × 5 platforms = 50 connections to track**
- **One missed revocation = potential liability**
- **No centralized record = no proof when you need it**

Access management tools like AuthHub handle offboarding in one action:

- Remove agency from all platforms simultaneously
- Delete stored tokens automatically
- Log the revocation with timestamp and details
- Generate confirmation email automatically

The [client access management lifecycle](/blog/what-is-client-access-management) covers the full process from request to revocation. Tools that only handle onboarding leave you with the same offboarding problems — just delayed.

When [comparing pricing models](/blog/flat-rate-vs-credit-pricing), factor in the cost of manual offboarding. At $150/hour, a 2-hour manual revocation process costs $300 in non-billable time. Per client. That adds up fast.

---

## The Bottom Line

Your clients trusted you with access to their advertising spend, customer data, and business analytics. That trust doesn't end when the contract ends — it ends when you no longer have access.

Most agencies skip offboarding because there's no immediate consequence. The client doesn't chase you to remove access. Nothing breaks on day one. The consequence shows up six months later, in awkward conversations with new agencies or security audits for enterprise prospects.

The agencies that treat offboarding as seriously as onboarding are the ones that:
- Maintain professional relationships with former clients (referrals come from departed clients too)
- Pass security audits for enterprise sales
- Sleep better knowing they're not sitting on orphaned access to 50+ accounts

One hour of revocation. Zero lingering liability. That's the standard.

---

*Need the security framework that prevents these problems? Our [agency security checklist](/blog/agency-security-checklist) covers the full lifecycle. For the onboarding counterpart to this guide, see [how to onboard a new marketing client](/blog/how-to-onboard-new-marketing-client).*
