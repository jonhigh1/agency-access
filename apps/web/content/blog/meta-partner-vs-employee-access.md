---
id: meta-partner-vs-employee-access
title: 'Meta Partner vs Employee: Which Access Should a Client Give an Agency?'
excerpt: >-
  Agencies should be partners on the client’s Business Manager, not employees
  of it. Partner keeps ownership with the client and makes offboarding a revoke.
category: tutorials
stage: consideration
publishedAt: '2026-10-10'
updatedAt: '2026-10-10'
readTime: 7
author:
  name: Jon High
  role: Founder
tags:
  - Meta Business Manager
  - partner access
  - agency access
  - Facebook ads
metaTitle: 'Meta Partner vs Employee Access for Agencies (2026)'
metaDescription: >-
  Should a client add an agency as a Meta Business Manager partner or employee?
  Partner keeps the client as owner. Employee mixes the agency into the brand’s BM.
canonical: https://authhub.co/blog/meta-partner-vs-employee-access
relatedPosts:
  - how-to-revoke-client-access-offboarding
  - client-onboarding-checklist
  - google-ads-access-guide
faqs:
  - question: Should an agency be a Meta employee or a partner?
    answer: >-
      Partner. The client owns the Business. The agency is granted access to specific ad accounts and Pages. Employee access puts agency people inside the client’s Business as staff.
  - question: What does the client need to add a partner?
    answer: >-
      The agency’s Business ID, the ad accounts (and Pages) to share, and a permission level — typically Ad Account Advertiser, not Admin, unless billing is in scope.
  - question: Can AuthHub look up a Business Manager ID?
    answer: >-
      No. AuthHub does not scrape Graph API for BM IDs. The client signs in with Facebook on an official invite and picks the Business Portfolio and assets.
  - question: What if a previous agency is still a partner?
    answer: >-
      The client removes them in Business Settings → Users → Partner accounts before or right after granting you. Stale partners are a liability, not a courtesy.
---
Updated October 10, 2026

Meta Business Manager has two ways to add people: **people in your Business** (employees) and **partners** (another Business). Agencies should almost always be partners.

## Why partner

The client keeps the Business, the ad accounts, the billing profile, and the Page. You get a grant you can revoke. When the SOW ends, they remove the partner. They do not have to hunt for agency logins mixed into their employee list.

Employee access is for staff on payroll or long-term contractors the brand wants inside *their* Business. It is the wrong default for a media retainer.

## What the client actually clicks

Business Settings → Accounts → Ad Accounts → Add people → Add a partner. They enter the agency Business ID, pick Advertiser (or Analyst), confirm. You accept under Partner requests.

AuthHub’s one-link path walks the same official Facebook login. It does not look up BM IDs and it does not ask for a password.

## Permission still matters

Partner + Admin is still Admin. If you only need to ship campaigns, ask for Advertiser. Use the [access-level tool](/tools/access-level) if the client is staring at the role picker.

Manual steps live in the [Meta Ads guide](/guides/meta-ads-access). Offboarding lives in the revoke guide. Do not leave a previous agency as a partner “in case they need reports.”
