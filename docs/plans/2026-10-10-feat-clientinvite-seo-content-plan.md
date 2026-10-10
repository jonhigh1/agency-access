---
title: ClientInvite SEO content 90-day - Plan
type: feat
date: 2026-10-10
topic: clientinvite-seo-content
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
origin: clientinvite-seo-content-teardown.md (session 2026-10-10; not checked in — public-repo leak)
---

# ClientInvite SEO content 90-day — Plan

## Goal Capsule

- **Objective:** AuthHub.co — not GitHub — is the indexed source for client-access how-tos, ClientInvite/Leadsie comparisons, and the category's missing Meta/Google decision tool, with extractable FAQ/HowTo structure and named-operator E-E-A-T.
- **Means:** Week 1 indexation + compare hub; month 1–2 shared guide template, FAQ schema, one access-level tool with distribution; month 2–3 bylines, agency `/uses/` cluster, stats page, case studies only with real customers.
- **Product authority:** Teardown 90-day plan > `marketing/CONTENT-STRATEGY-2026.md` pillars > `docs/seo-patterns.md` > `apps/web/DESIGN_SYSTEM.md` for any UI.
- **Already shipped:** `/compare/clientinvite-alternative` with honest pick-X-if, unit-mismatch pricing math, AEO blocks, and FAQPage schema. Two platform guides with HowTo schema. 26 markdown blog posts. Footer already links the ClientInvite compare URL.
- **Open blockers:** Real case-study customer (U9). Private-vs-public GitHub repo is Jon ops, out of unit scope.
- **Stop conditions:** No invented metrics or testimonials. No influencer-whitelisting page. No BM Graph-API scraper. No trend-chase posts.
- **Plan preservation:** Product Contract created in this bootstrap from the ClientInvite SEO teardown plus live-code corrections.

## Product Contract

### Summary

Close the ClientInvite content gap without copying their mistakes: fix authhub.co indexation, beat their how-to moat with freshness + FAQ schema + a shared guide template, ship one ungated access-level tool, then compound with bylines and interlinked agency use-case pages.

### Problem Frame

ClientInvite ranks on programmatic how-tos and "leadsie alternative." AuthHub already has comparison pages and 26 blog posts, but guides lack visible freshness and FAQPage schema, FAQ JSON-LD is hardcoded for 5 posts only, there is no `/guides` or `/compare` hub (guide breadcrumbs point at a 404), no tools, no author pages, and public GitHub markdown competes with authhub.co.

### Key Decisions

- **KTD1.** First tool is the access-level decision tool, not a BM ID finder. It maps to existing `ACCESS_LEVEL_DESCRIPTIONS` and needs no Meta API. (planning default)
- **KTD2.** Skip influencer-whitelisting content. Product does not serve it. (verified in CONCEPTS, compare copy)
- **KTD3.** Verticals are agency types, not ClientInvite's client verticals. (ICP in CONTENT-STRATEGY-2026)
- **KTD4.** GitHub leak: strengthen authhub.co canonicals/sitemap/schema. `robots.ts` cannot noindex github.com. Private-repo remains Jon ops. (seo-audit)
- **KTD5.** FAQ JSON-LD is generated from the same list the page renders (`security-page-faq.ts` pattern).
- **KTD6.** Guides become a shared template + data files. Breadcrumb `/guides` must exist before more spokes.
- **KTD7.** Tools are ungated; email capture is optional convenience.
- **KTD8.** Case-study pages are blocked on a real customer.
- **KTD9.** New/refreshed posts use a named operator byline. "AuthHub Team" is not the default for this cluster.
- **KTD10.** `llms.txt` + keep AI crawlers allowed. Do not write separate "for AI" pages.

### Actors

- A1. Agency owner / ops lead searching how to get Meta/Google access or a Leadsie/ClientInvite alternative
- A2. Non-technical client who might land on a how-to (secondary)
- A3. Implementer shipping routes, schema, and the tool in `apps/web`

### Requirements

- R1. authhub.co pages self-canonicalize to `https://authhub.co` (non-www); sitemap lists only 200 canonical URLs; `lastmod` uses content freshness (`updatedAt` / `lastVerified`), not only `publishedAt`.
- R2. GitHub leak is treated as duplicate-content risk: published pages win on structure/freshness/schema; unpublished competitive drafts stay out of the public tree; GSC inspection is ops, not a code substitute for a private-repo decision.
- R3. Every how-to shows "Updated [Month Year]", a 40–60 word answer block, HowTo + FAQPage JSON-LD from the same source as visible FAQs, and links to the guides hub, sibling guides, pricing, and the relevant compare page.
- R4. Blog FAQ schema is content-driven (frontmatter), not a hardcoded map in `apps/web/src/app/(marketing)/blog/[slug]/page.tsx`.
- R5. One ungated Meta/Google-adjacent tool at `/tools/access-level` using `ACCESS_LEVEL_DESCRIPTIONS` / `PLATFORM_SCOPES` from `@agency-platform/shared`. Optional "email me this report" only — never a gate.
- R6. Named operator bylines, Person schema, `/authors/[slug]`, and a human about-page operator story.
- R7. Agency-type use-case pages (PPC, SEO, freelance, in-house) interlink to guides → tool → pricing → compare.
- R8. Case studies require a real named customer, dates, and sourced metrics.
- R9. Docs stay public. No trend-chase posts. Every tool ladders to the client-access narrative.
- R10. `llms.txt` at site root listing product, audience, pricing, guides, compare pages, and docs. AI search bots remain allowed in robots.

### Success Criteria

- `/compare/clientinvite-alternative`, `/guides/*`, and `/tools/access-level` return 200, sit in sitemap, carry self-canonicals, and pass claims/metadata tests plus new schema tests.
- Both current guides plus new spokes share one template; `/guides` is a real hub.
- FAQPage JSON-LD is present on all how-tos and on blog posts that have FAQs, generated from content.
- Tool is usable with no account; result is copyable/shareable.
- No new public markdown that is not a live canonical page.

### Scope Boundaries

**In**

- Marketing routes under `apps/web/src/app/(marketing)/`, blog frontmatter, sitemap/robots, schema generators, one interactive tool, author + uses + compare hub pages, strategy-doc sync.

**Out**

- Influencer whitelisting product or page
- Meta Business Manager ID finder / Graph API scraping
- Making the GitHub repo private
- Gated API docs
- CMS migration
- Buying listicle placements
- Inventing case-study customers

## Planning Contract

### Design

- Follow Acid Brutalism: one hard element per view on new marketing templates (`apps/web/DESIGN_SYSTEM.md`).
- Guide demo widget: static/mock access-link, no signup wall.
- Reuse `apps/web/src/lib/schema-generators.ts`, `apps/web/src/components/seo/Schema.tsx`, and compare FAQ generation. Do not migrate to unused `BlogPostTemplate` unless a later unit explicitly does.

### Assumptions

- Jon is the named expert for bylines unless another operator is supplied at U4.
- Optional tool email capture can land in the existing marketing/contact path.
- Live indexation of `/compare/clientinvite-alternative` is unverified in planning — U1 includes a GSC/live check note, not a rebuild.

### Sequencing

Week 1: U1 → U2 → U3 (hub + refresh the two live guides).
Month 1–2: U4 ∥ U5 after U3; U6 after U3; remaining guide spokes in U3.
Month 2–3: U7 after U3+U5; U8 ongoing; U9 if a customer exists; U10 last.

Do not parallelize sitemap/robots (U1) with U2/U3/U5 — those all touch `apps/web/src/app/sitemap.ts`.

## Implementation Units

### U1 — Indexation hygiene and GitHub leak playbook

- **Covers:** R1, R2, R10
- **Files:**
  - `apps/web/src/app/sitemap.ts`
  - `apps/web/src/app/robots.ts`
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/lib/seo-canonical.ts` (new)
  - `apps/web/src/lib/root-schemas.ts` (new)
  - `apps/web/public/llms.txt` (new)
  - `apps/web/src/lib/blog-data.ts`
  - `docs/seo-patterns.md`
- **Approach:** Sitemap `lastmod` prefers `updatedAt` then `publishedAt` (blog) and `lastVerified` (compare). Omit slugs that 301. Normalize `www.authhub.co` canonicals to non-www. Allow GPTBot / ChatGPT-User / PerplexityBot / ClaudeBot / Google-Extended. Drop WebSite SearchAction pointing at missing `/search`. Document: GitHub blobs cannot be noindex'd from this repo.
- **Tests:** `apps/web/src/app/__tests__/sitemap.test.ts`, `apps/web/src/app/__tests__/robots.test.ts`, `apps/web/src/lib/__tests__/seo-canonical.test.ts`, `apps/web/src/lib/__tests__/root-schemas.test.ts`, `apps/web/src/lib/__tests__/llms-txt.test.ts`
- **Verification:** those suites green; live `/sitemap.xml` and `/robots.txt` when a server is up.
- **Execution direction:** test-first.

### U2 — Compare hub and ClientInvite indexation

- **Covers:** R1, R2
- **Files:** new `apps/web/src/app/(marketing)/compare/page.tsx`, `apps/web/src/components/marketing/marketing-footer.tsx`, `apps/web/src/components/marketing/marketing-nav.tsx`, `apps/web/src/app/sitemap.ts`, `apps/web/src/app/(marketing)/compare/__tests__/compare-metadata.test.ts`
- **Approach:** Index hub linking all compare slugs. Confirm `/compare/clientinvite-alternative` 200 + schema. Re-verify ClientInvite prices only if public pages drifted since 2026-10-01. Do not rebuild the honest format.
- **Tests:** hub 200, in sitemap, links every slug; ClientInvite metadata/canonical assertions stay green.
- **Verification:** existing `comparison-data.claims.test.ts` + compare metadata tests.

### U3 — Guides hub, shared template, freshness, FAQ

- **Covers:** R3, KTD5, KTD6
- **Files:** new `apps/web/src/app/(marketing)/guides/page.tsx`; new `apps/web/src/lib/guides/` data + template; refactor the two existing guide `page.tsx` files to data; `apps/web/src/app/(marketing)/guides/__tests__/pages.public.test.tsx`; sitemap
- **Approach:** Hub first. Each guide: visible Updated badge, 40–60 word answer, numbered steps, 4–6 FAQs, HowTo + FAQPage + BreadcrumbList from the same data. Then add spokes: GA4, LinkedIn, TikTok, Meta Business Manager.
- **Tests:** `/guides` 200; both existing guides still public; FAQ JSON-LD matches visible questions; breadcrumb item `/guides` resolves.
- **Verification:** guides public tests + schema assertions. Browser: hub + one guide desktop and mobile.

### U4 — Content-driven blog FAQ + author E-E-A-T

- **Covers:** R4, R6, KTD9
- **Files:** `apps/web/src/lib/blog-types.ts`, `apps/web/src/lib/blog-data.ts`, blog `[slug]/page.tsx` (delete `faqSchemas` map), `apps/web/src/components/blog/blog-content.tsx`, new `apps/web/src/app/(marketing)/authors/[slug]/page.tsx`, `apps/web/src/app/(marketing)/about/page.tsx`
- **Approach:** Optional `faqs[]` and required named `author` with slug. Generate FAQPage when faqs exist. Author page with Person schema. About page gets an operator story.
- **Tests:** post with faqs emits matching FAQPage; post without faqs does not; author page 200.
- **Verification:** `blog-data` tests + blog public-content tests.

### U5 — Access-level decision tool

- **Covers:** R5, R7, R9, KTD1, KTD7
- **Files:** new `apps/web/src/app/(marketing)/tools/page.tsx`, `tools/access-level/page.tsx`, colocated client quiz + result card, tests under `tools/`, sitemap, footer/nav
- **Approach:** Inputs = platform family + job-to-be-done → recommend `admin | standard | read_only | email_only` from shared types. Ungated. Optional email-report after the result is on screen. Shareable result card and copy-with-attribution. No Graph API.
- **Tests:** recommendation table for fixture inputs; FAQ schema present; page in sitemap; works without auth.
- **Verification:** unit tests for the decision table + public page test. Browser: complete the quiz end to end.

### U6 — In-guide demo widget

- **Covers:** R3
- **Files:** new component under `apps/web/src/components/marketing/` or `guides/`, wired into the guide template from U3
- **Approach:** One mock access-link widget. No signup wall. Respect `prefers-reduced-motion`. One brutalist element.
- **Tests:** renders in guide template; no `/signup` required to interact with the mock.
- **Verification:** guide page test + browser on Meta guide.

### U7 — Agency use-case cluster

- **Covers:** R7
- **Files:** `apps/web/src/app/(marketing)/uses/page.tsx` + four vertical pages, sitemap, footer, links from guides/compare/pricing
- **Approach:** Substantial pages for PPC, SEO, freelance, in-house. Cross-link every vertical. No dental/ecommerce.
- **Tests:** all four + hub 200, in sitemap, no orphans.
- **Verification:** public page tests.

### U8 — Bylined cluster + category stats page

- **Covers:** R6, R9
- **Files:** `apps/web/content/blog/*.md` in the client-access set; new stats page
- **Approach:** Quarterly refresh of existing how-tos. 4–6 new posts, all on client access. Stats page = citable one-liners with dates/sources. No invented statistics.
- **Tests:** frontmatter/schema for new posts; sitemap lastmod reflects updates.
- **Verification:** blog tests.

### U9 — Case study template, gated on a real customer

- **Covers:** R8
- **Approach:** 30-second summary plus timeline, methodology, client-side quote, metrics with bases. Do not publish until Jon supplies a real customer. If none in 90 days, skip.
- **Tests:** none until a real page exists; then claims tests like compare pages.
- **Verification:** claims test pinning every metric to a source.

### U10 — Strategy doc sync

- **Covers:** keep CONTENT-STRATEGY-2026 from drifting
- **Files:** `marketing/CONTENT-STRATEGY-2026.md`, `docs/seo-patterns.md`
- **Approach:** Record pillars, URL map, FAQ-from-content rule, tools policy, GitHub leak reality, and "do not clone influencer/whitelisting."
- **Tests:** none (docs).
- **Verification:** doc review against this plan's KTDs.

## Verification Contract

- Named web suites: compare metadata, comparison-data claims, blog-data, guides public, marketing-footer, plus new tools/uses/sitemap tests each unit names.
- After UI units: browser-verify the changed marketing flow (not screenshot-only).
- Claims: no new competitor price or customer metric without a `lastVerified` source.
- Gate: `npm run test --workspace=apps/web` for touched packages.

## Definition of Done

- U1–U7 shipped on authhub.co; U8 editorial cadence started; U9 either live with real evidence or explicitly skipped; U10 merged.
- Money pages (guides, compare ClientInvite, tool) have freshness, FAQ/HowTo schema, self-canonicals, and hub links.
- No influencer page, no gimmick tool, no invented case study, no GitHub-robots fiction.
