# Content Calendar - Q1 2026

**Agency Access Platform - Weekly Content Schedule**

**Audited**: March 18, 2026
**Q2 Plan Added**: March 18, 2026 (based on Leadsie competitive intelligence audit)

---

## What's Actually Live (Ground Truth)

### Blog Posts (20) — `/blog/[slug]`
| Slug | Title | Year | Quality Rating |
|------|-------|------|---------------|
| `how-to-get-meta-ads-access-from-clients` | How to Get Meta Ads Access From Clients | 2026 | 7/10 — dates fixed, canonical added, links fixed |
| `google-ads-access-agency` | Google Ads Access Guide | 2026 | 7/10 — date updated, GTM link replaced |
| `ga4-access-agencies` | GA4 Access for Agencies | 2026 | 6/10 — date updated, GTM link replaced |
| `leadsie-vs-authhub-comparison` | Leadsie vs Other Platforms vs AuthHub | 2026 | 7/10 — pricing fixed ($29/mo), date updated, links fixed |
| `meta-business-manager-access-guide` | How to Grant Meta Business Manager Access | 2026 | 6/10 — cannibalizes Meta Ads post |
| `linkedin-ads-access-agency` | LinkedIn Ads Access for Agencies | 2026 | 7/10 — date updated |
| `pinterest-ads-access-agencies` | Pinterest Ads Access for Agencies | 2025 | 6/10 — no internal links, missing year |
| `tiktok-ads-access-agency` | TikTok Ads Access for Agencies | 2026 | 7/10 — fresh, needs internal linking |
| `client-onboarding-checklist` | The Complete Client Onboarding Checklist | 2026 | 7/10 — strong, has PDF lead magnet |
| `agency-ad-account-access-management-guide` | Ultimate Guide to Agency Ad Account Access | 2026 | 5/10 — no internal links, thin CTA |
| `troubleshooting-guide-how-to-fix-common-ad-account-access-issues` | Fix Common Ad Account Access Issues | 2026 | 4/10 — 3 broken links at bottom |
| `flat-rate-vs-credit-pricing` | Flat-Rate vs Credit Pricing for Agency Tools (2026) | 2026 | 9/10 — DRAFT complete, Q2 kickoff, data-driven, competitive wedge |
| `what-is-client-access-management` | What Is Client Access Management? (2026 Guide for Agencies) | 2026 | 9/10 — publish-ready, elite copywriting polish, AI-pattern-free |
| `how-to-onboard-new-marketing-client` | How to Onboard a New Marketing Client (The Real 2026 Guide) | 2026 | 9/10 — publish-ready, 4 sourced stats, AI-pattern-free, elite copywriting pass |
| `best-client-onboarding-software-agencies-2026` | Best Client Onboarding Software for Agencies (2026) — Honest Breakdown | 2026 | 9/10 — publish-ready, category-based framework, unique angle |
| `agency-security-checklist` | The Agency Security Checklist: Protect Client Access in 2026 | 2026 | 8.5/10 — publish-ready, 6-phase framework, no competitor covers this angle |
| `social-media-access-request-template` | Social Media Access Request Template for Agencies (2026) | 2026 | 9/10 — publish-ready, platform-specific templates + follow-ups, practical utility post |
| `how-to-revoke-client-access-offboarding` | How to Revoke Client Access When Offboarding (2026) | 2026 | 9/10 — publish-ready, 5-phase framework, platform-by-platform revocation instructions |
| `client-onboarding-questionnaire-27-questions` | Client Onboarding Questionnaire: 27 Questions Every Agency Needs to Ask | 2026 | 9/10 — publish-ready, 27 questions across 6 categories, downloadable template |
| `marketing-agency-onboarding-best-practices-2026` | Agency Onboarding Best Practices (7 Mistakes That Make Clients Question Hiring You) | 2026 | 9/10 — publish-ready, client-POV mistakes + recovery playbook, unique from existing pillar posts |
| `oauth-token-management-agencies` | OAuth Token Management for Agencies: What Expires, What Breaks, and How to Fix It | 2026 | 9/10 — DRAFT complete, agency ops angle, 5-phase lifecycle framework, no competitor covers this |
| `unable-to-assign-assets-meta-business-suite` | Unable to Assign Assets in Meta Business Suite: 6 Fixes That Actually Work (2026) | 2026 | 9/10 — DRAFT complete, 6-cause diagnostic framework, pre-flight checklist, unique specificity vs. competitors |

### Dedicated Guides (2) — `/guides/[slug]`
| Slug | Title | SEO Score |
|------|-------|-----------|
| `google-ads-access` | How to Get Google Ads Access for Agencies (2026) | 8/10 — canonical, OG, schema |
| `meta-ads-access` | How to Get Meta Ads Access for Agencies (2026) | 9/10 — HowTo schema, canonical, OG |

### Comparison Pages (2) — `/compare/[slug]`
| Slug | Title | Issue |
|------|-------|-------|
| `leadsie-alternative` | Leadsie Alternative | ✅ Updated 2026-03-18 — correct pricing, 31+ platforms, correct URL |
| `agencyaccess-alternative` | AuthHub vs AgencyAccess | ✅ Updated 2026-03-18 — pricing standardized to $29/$79/mo |

---

## Critical Housekeeping (Fix Before Any New Content)

### P0 — Trust & Credibility ✅ COMPLETED (March 18, 2026)

| Issue | Fix | Status |
|-------|-----|--------|
| Leadsie comparison: $99/mo (actual: $49/mo), 8 platforms (actual: 31+), wrong URL | Updated `comparison-data.ts` | ✅ Done |
| 4 different AuthHub starter prices ($24, $29, $30, $79) | Standardized to $29/mo everywhere | ✅ Done |
| Blog post claims AuthHub is $79/mo | Updated `leadsie-vs-authhub-comparison.md` | ✅ Done |
| 11 broken internal links across posts | Removed or redirected | ✅ Done |

### P1 — SEO Foundation ✅ COMPLETED (March 18, 2026)

| Issue | Fix | Status |
|-------|-----|--------|
| 5 posts with 2024 `publishedAt` dates | Updated to 2026 | ✅ Done |
| Meta Ads H1 says "2024 Guide" | Fixed to 2026 | ✅ Done |
| Keyword cannibalization (2 Meta Ads posts) | Added canonical URL to blog post → `/guides/meta-ads-access` | ✅ Done |
| No canonical URLs on blog posts | Added `canonical` field to BlogPost type + frontmatter | ✅ Done |
| No HowTo schema on Google Ads guide | Added HowTo JSON-LD matching Meta guide pattern | ✅ Done |

### Broken Internal Links (11 total) ✅ COMPLETED (March 18, 2026)

| Dead Link | Fix Applied |
|-----------|-------------|
| `/blog/gtm-access-guide` | Replaced with troubleshooting guide link |
| `/blog/linkedin-ads-access-guide` | Fixed to `/blog/linkedin-ads-access-agency` |
| `/blog/leadsie-alternatives` | Removed (replaced with CTA link) |
| `/blog/leadsie-alternatives-7-tools` | Removed from relatedPosts |
| `/blog/client-onboarding-47-email-problem` | Replaced with `client-onboarding-checklist` in 4 posts |
| `/blog/agency-business-manager-structure` | Replaced with existing post links |
| `/blog/client-offboarding-checklist` | Replaced with existing post links |
| `/blog/meta-business-suite-vs-manager` | Replaced with existing post links |
| `/guides/linkedin-ads-access` | Fixed to `/blog/linkedin-ads-access-agency` |
| `/guides/tiktok-ads-access` | Fixed to `/blog/tiktok-ads-access-agency` |
| `/guides/pinterest-ads-access` | Fixed to `/blog/pinterest-ads-access-agencies` |

---

## What We're NOT Building

| Planned Route | Why Not |
|--------------|---------|
| `/guides/ga4-access` | Blog post covers it — fix metadata instead |
| `/guides/tiktok-ads-access` | Blog post covers it (2026, already fresh) |
| `/guides/linkedin-ads-access` | Blog post covers it — fix metadata instead |
| `/guides/pinterest-ads-access` | Blog post covers it — minor year update |
| `/compare/authhub-vs-leadsie` | `/compare/leadsie-alternative` already covers this intent |
| `/blog/onboarding-roi-calculator` | Replaced by `/blog/flat-rate-vs-credit-pricing` (stronger wedge) |

---

## February 2026 (Actual)

### Week 1 (Feb 10-16)

| Day | Content | Type | Status |
|-----|---------|------|--------|
| Mon | /compare/leadsie-alternative | Comparison page | ✅ **LIVE** |

### Week 2 (Feb 17-23)

| Day | Content | Type | Status |
|-----|---------|------|--------|
| Mon | /guides/google-ads-access | Guide | ✅ **LIVE** |
| Tue | /guides/meta-ads-access | Guide | ✅ **LIVE** |

### Week 3 (Feb 24 - Mar 2)

| Day | Content | Type | Status |
|-----|---------|------|--------|
| Mon | /blog/client-onboarding-checklist | Blog + PDF | ✅ **LIVE** |

### Week 4 (Mar 3-9)

| Day | Content | Type | Status |
|-----|---------|------|--------|
| — | (No content published) | — | ❌ |

---

## March 2026

### Week 5 (Mar 10-16)

| Day | Content | Type | Status |
|-----|---------|------|--------|
| — | (Content strategy pivot — no new content) | — | ❌ |

### Week 6 (Mar 17-23)

| Day | Content | Type | Status |
|-----|---------|------|--------|
| — | Competitive intelligence audit (this document) | Research | ✅ **COMPLETE** |
| — | Updated CONTENT-STRATEGY-2026.md with Leadsie findings | Strategy | ✅ **COMPLETE** |
| — | Q2 content calendar (15 high-leverage ideas) | Planning | ✅ **COMPLETE** |

### Week 7 (Mar 24-30) — Housekeeping Week ✅ COMPLETED EARLY (March 18, 2026)

All housekeeping items were completed ahead of schedule as part of the competitive audit remediation.

| Day | Content | Type | Status |
|-----|---------|------|--------|
| Mon | Fix broken internal links (11 dead links) | Maintenance | ✅ **DONE** |
| Tue | Fix Leadsie comparison data (pricing, platforms, URL) | Maintenance | ✅ **DONE** |
| Wed | Align AuthHub pricing across all pages | Maintenance | ✅ **DONE** |
| Thu | Update 5 blog post dates from 2024 → 2026 | Maintenance | ✅ **DONE** |
| Fri | Fix Meta Ads H1 ("2024" → "2026") + canonical + HowTo schema | Maintenance | ✅ **DONE** |

### Week 8 (Mar 31 - Apr 6)

| Day | Content | Type | Status |
|-----|---------|------|--------|
| Tue | #1 `/blog/flat-rate-vs-credit-pricing` | Blog | ✅ **DRAFT COMPLETE** — publish-ready, 9/10 quality |
| Thu | #3 `/blog/what-is-client-access-management` | Blog | ✅ **DRAFT COMPLETE** — publish-ready, 9/10 quality |

---

## April 2026 — Q2 Launch

### Week 9 (Apr 7-13)

| Day | Content | Type | Keyword Target |
|-----|---------|------|---------------|
| Tue | #5 `/blog/how-to-onboard-new-marketing-client` | Blog (pillar) | "how to onboard a new marketing client" | ✅ **DRAFT COMPLETE** — 9/10, publish-ready |
| Thu | #4 `/blog/best-client-onboarding-software-agencies-2026` | Listicle | "best client onboarding software for agencies" | ✅ **DRAFT COMPLETE** — 9/10, publish-ready |

### Week 10 (Apr 14-20)

| Day | Content | Type | Keyword Target |
|-----|---------|------|---------------|
| Tue | #6 `/blog/agency-security-checklist` | Blog | "agency security checklist" | ✅ **DRAFT COMPLETE** — 8.5/10, 6-phase framework, unique angle |
| Thu | #8 `/blog/social-media-access-request-template` | Blog + template | "social media access request template" | ✅ **DRAFT COMPLETE** — 9/10, platform-specific templates + follow-ups, practical utility post |

### Week 11 (Apr 21-27)

| Day | Content | Type | Keyword Target |
|-----|---------|------|---------------|
| Tue | #7 `/blog/how-to-revoke-client-access-offboarding` | Blog | "how to revoke client access" | ✅ **DRAFT COMPLETE** — 9/10, publish-ready, 5-phase framework, platform-by-platform instructions |
| Thu | #10 `/blog/how-to-see-who-has-access-facebook-page` | Blog | "how to see who has access to facebook page" | ✅ **DRAFT COMPLETE** — 8.5/10, publish-ready, step-by-step tutorial with role tables, security checklist, agency focus |

### Week 12 (Apr 28 - May 4)

| Day | Content | Type | Keyword Target |
|-----|---------|------|---------------|
| Tue | #12 `/blog/client-onboarding-questionnaire-27-questions` | Blog + template | "client onboarding questionnaire" | ✅ **DRAFT COMPLETE** — 9/10, publish-ready, 27 questions across 6 categories, downloadable template, practical utility post |
| Thu | #13 `/blog/marketing-agency-onboarding-best-practices-2026` | Blog | "agency onboarding best practices" | ✅ **DRAFT COMPLETE** — 9/10, publish-ready, client-POV mistakes angle, 7 onboarding mistakes + recovery playbook |

---

## May 2026

### Week 13 (May 5-11)

| Day | Content | Type | Keyword Target |
|-----|---------|------|---------------|
| Tue | #9 `/blog/oauth-token-management-agencies` | Blog (technical) | "oauth token management" | ✅ **DRAFT COMPLETE** — 9/10, publish-ready, 5-phase token lifecycle framework, agency ops angle (no competitor covers this), 3 authoritative external sources |
| Thu | #11 `/blog/unable-to-assign-assets-meta-business-suite` | Blog | "unable to assign assets meta business suite" | ✅ **DRAFT COMPLETE** — 9/10, publish-ready, 6-cause diagnostic framework, covers ground no competitor does at this specificity, 3 external Meta doc sources |

### Week 14 (May 12-18)

| Day | Content | Type | Keyword Target |
|-----|---------|------|---------------|
| Tue | #14 `/blog/google-ads-mcc-setup-guide` | Blog | "google ads manager account setup" |
| Thu | #15 `/blog/intake-forms-vs-separate-tools` | Blog | "client intake form tools" |

### Week 15 (May 19-25)

| Day | Content | Type | Status |
|-----|---------|------|--------|
| Mon | Internal linking overhaul — connect all Q2 content | SEO | Planned |
| Wed | Refresh top 3 existing posts with updated metadata | Maintenance | Planned |
| Fri | Social: "6 agency onboarding mistakes" roundup | Social | Planned |

### Week 16 (May 26 - Jun 1)

| Day | Content | Type | Status |
|-----|---------|------|--------|
| Tue | `/compare/client-onboarding-tools` broad comparison | Comparison | Planned |
| Thu | Performance review — check rankings, traffic, conversions | Analytics | Planned |

---

## June 2026

### Week 17-20 (June)

| Focus | Tasks |
|-------|-------|
| Content | First case study (if customer available) |
| Content | Refresh any posts not ranking after 60 days |
| SEO | Build backlinks to top 3 Q2 posts (outreach) |
| Social | Promote top-performing Q2 content |
| Planning | Q3 content plan based on Q2 performance data |

---

## Q2 Content Priority Rationale

**Why Tier 1 first?** Comparison/differentiator content captures agencies at the decision point — 3-5x higher conversion than educational content.

**Why "Flat-Rate vs Credit Pricing" as #1?** No competitor covers this. Leadsie's $30 overage fees are a documented pain point. This is our strongest differentiator and an evergreen wedge.

**Why category-defining content (#3, #15)?** "What is client access management?" has no authoritative answer on Google. Whoever defines the category shapes how prospects evaluate solutions.

**Why compete on Leadsie's keywords (#10, #11)?** Their content is aging (2025 dates). A fresh 2026 version with schema markup and better internal linking can displace them.

---

## Content Status Legend

- ✅ **LIVE**: Published and accessible on authhub.co
- 🎯 **DO NOW / NEXT**: Highest priority for this week
- **Planned**: Queued for future week
- ❌ **NOT CREATED**: Planned but no page exists
- **P2**: Nice to have — backlog

---

## Weekly Content Targets

| Metric | Target | Q1 Actual |
|--------|--------|-----------|
| Blog posts | 2/week | ~1.5/week (12 total in Q1) |
| Dedicated guides | Maintain | 2 live (sufficient) |
| Comparison pages | 1/month | 2 live |
| Social posts | 5/week | Not tracked |
| Email sends | 1/week | Not started |
| Stale metadata | 0 tolerance | 5 posts fixed by W7 |
| Broken internal links | 0 tolerance | 11 links fixed by W7 |

---

**Last Updated**: April 7, 2026 (added unable-to-assign-assets-meta-business-suite draft)
**Next Review**: April 15, 2026 (mid-Q2 performance check)
