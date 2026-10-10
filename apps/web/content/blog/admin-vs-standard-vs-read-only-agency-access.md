---
id: admin-vs-standard-vs-read-only-agency-access
title: 'Admin vs Standard vs Read-Only: Which Access Level Should an Agency Request?'
excerpt: >-
  Match the job to the permission. Campaign work is Standard. Reporting is
  Read only. Billing and users are Admin. Email-only is a digest, not an account.
category: tutorials
stage: consideration
publishedAt: '2026-10-10'
updatedAt: '2026-10-10'
readTime: 8
author:
  name: Jon High
  role: Founder
tags:
  - access level
  - agency permissions
  - admin vs standard
  - client access
metaTitle: 'Admin vs Standard vs Read-Only Access for Agencies (2026)'
metaDescription: >-
  Which access level should an agency request? Admin, standard, read-only, and
  email-only mapped to the job — with a public recommender, no Business Manager ID lookup.
canonical: https://authhub.co/blog/admin-vs-standard-vs-read-only-agency-access
relatedPosts:
  - google-ads-access-guide
  - how-to-revoke-client-access-offboarding
  - client-onboarding-checklist
faqs:
  - question: Should every agency request Admin?
    answer: >-
      No. Admin is for billing, users, and account settings. Campaign build-out is Standard. Ask for Admin only when the SOW actually needs it.
  - question: What is read-only access for?
    answer: >-
      Reporting, exports, and review. It cannot create or edit campaigns. Use it for analysts and stakeholders who should not touch live ads.
  - question: What is email-only?
    answer: >-
      A digest or shared dashboard with no direct account login. It is not a substitute for platform access when the agency has to ship work.
  - question: Is there a tool that picks the level?
    answer: >-
      AuthHub publishes an ungated access-level recommender at /tools/access-level. Platform family plus the job. No signup, no Graph API.
---
Updated October 10, 2026

Agencies over-ask. Clients over-refuse. The fix is naming the job before naming the role.

AuthHub uses four levels everywhere the product talks about permissions: **Admin**, **Standard**, **Read only**, and **Email only**. They map to real platform roles with different names (Advertiser, Analyst, Standard user). The mapping is the job, not the biggest checkbox.

## Admin

Full control: campaigns, settings, billing, add/remove users. Request this when the SOW includes spend ownership, user management, or consolidating Business Managers. Do not request it because it “avoids a second invite later.”

## Standard

Create and edit. No delete, no billing, no user-admin. This is the default for paid media and most SEO property work (GA4 editor, Search Console). If you can ship the campaign without touching invoices, this is the level.

## Read only

View campaigns, view reports, export. No edits. Use it for the client’s CFO, a fractional CMO who only reviews, or an analyst who should not publish.

## Email only

Notifications and shared dashboards. No direct login. If the work requires changing bids, this is the wrong level.

## How to send the request

Write the role in the email: “We need Standard / Advertiser on the Meta ad account, not Admin.” If the client wants a second opinion, send the public [access-level tool](/tools/access-level). It does not look up Business Manager IDs.

When the engagement ends, revoke. See the offboarding guide. Least privilege only works if someone removes the grant.
