# Bug fix: 401 on platform disconnect (jam 76b5f94c) — 2026-10-03

## Root cause
Clerk session JWTs lack resolvable email claims. PR #72 (b7ed78e1) added hard
401 `USER_EMAIL_REQUIRED` guards keyed on `resolveUserEmail(request.user)` to
four mutating endpoints. Any session without an email claim 401s on platform
disconnect, client delete, and both token-health revokes. Page GETs succeed
because resolvePrincipalAgency keys off sub/orgId and has its own Clerk-API
email fallback.

## Review (completed)
- [x] TDD red→green: agency-platforms.security (actor derived from authenticated identity; body revokedBy ignored; 401 when no verified email), clients.security (same for client delete), token-health.security (actor via fallback, 401 paths, GETs skip email resolution), authorization (helper: verified-only Clerk email; no Clerk call for non-user subs)
- [x] Fix connection.routes.ts DELETE → resolveAuthenticatedUserEmail after agency access check
- [x] Fix clients.ts DELETE → resolveAuthenticatedUserEmail
- [x] Fix token-health.ts: both revokes resolve email post-ownership-check; userEmail removed from resolveAgencyIdOrReply (list endpoints pay zero email cost)
- [x] Web: disconnect mutation surfaces API error message; dead client-supplied revokedBy removed from the request body
- [x] Validate: full API suite 1711 passed, full web suite 2272 passed, typecheck clean across workspaces
- [x] Logged to docs/ERRORS.md

Residual (accepted, not fixed):
- Clerk session token template could carry the email claim (dashboard config,
  not code); the Clerk-API fallback covers both cases.
- Any future endpoint keying authorization off JWT email claims will repeat
  this bug class — use resolveAuthenticatedUserEmail instead.


---

# Content Calendar Implementation — September 2026

Source: `marketing/content/CONTENT-CALENDAR-SEPTEMBER-2026.md`
Pipeline: `.claude/skills/blog-pipeline` (7 phases, 9/10 gate)
Publish = commit to `main` → Vercel auto-deploy. One commit per post.

---

## Phase A — Week 1 (Sep 9–14) — ✅ COMPLETE

### A1. Snapchat Ads guide — draft existed, needed pipeline finish
- [x] SEO fixes: "Snapchat Business Manager" in first 100 words + meta title front-loaded; 3 official external sources (2× businesshelp.snapchat.com roles docs + Snap Q2-2026 investor DAU stat); internal links 1→5 (exact-anchor to cluster post); tags 5→6, primary keyword first
- [x] Editorial pass (Phase 5): banned-word scan clean
- [x] Quality gate (Phase 6): 9/10 — original "no access-request system" angle, three-layer permission framework, honest positioning
- [x] Docs sync (Phase 7): calendar, CONTENT-STRATEGY-2026.md (21 posts), KEYWORD-TRACKER.md Tier-2 rows
- [x] Shipped: commit `552bfab` → build gate passed → live at `authhub.co/blog/snapchat-ads-access-agencies` (title + description verified in HTML)

### A2. Striking-distance cluster push (7 terms at pos 15–22)
- [x] Title/H1: "Best **Agency Client Onboarding Software** for Agencies (2026)" — exact cluster term nested one word after "Best"; #8 ranking phrase preserved
- [x] Intro para 2 carries exact "agency onboarding software"; FAQ H2 + 5 Q&As already exact-match (pre-existing)
- [x] 6 exact-anchor inbound links: checklist ("client onboarding software for agencies"), questionnaire ("agency onboarding platform"), how-to-onboard ("onboarding platforms for agencies"), Snapchat guide ("client onboarding software for agencies")
- [x] Closing CTA refreshed (bottleneck framing + /pricing path)
- [x] Shipped: commit `f86ab29` → build gate passed → live title verified in HTML
- [ ] **Follow-up (deferred, needs TDD):** FAQPage JSON-LD schema in blog post page — parse FAQ Q&As from content or optional `faqs` frontmatter; write failing test first. Benefits all posts with FAQ sections.

### A3. BOFU referee post — Leadsie vs AgencyAccess ✅ (added 9/13, out-of-plan)
- [x] BOFU discovery: provider keyword-research unavailable (no provider installed — needs Jon's terminal approval); used GSC first-party (community-intent: `leadsie alternative(s)` = only classified BOFU cluster, pos 6.5) + live SERP checks for `leadsie review` / `leadsie alternatives` / `agencyaccess alternative` / `leadsie vs agencyaccess`
- [x] Page-one extraction: AgencyAccess's Feb vs-post is the only ranker; extracted its structure (workflows, feature diff, pricing tables, who-should-choose); our 3-way post carries the intent but doesn't rank
- [x] Written: `leadsie-vs-agencyaccess` (1,837 words, 9/10 rubric) — neutral referee angle, 60-second verdict table, "what neither vendor puts on the pricing page" section, honest third-option framing, G2-cited review discrepancy (4.9/55+ claim vs 4.8/66 on G2)
- [x] Pricing fact-check caught source drift: Leadsie live = $49/$107/$299 with $50 overage blocks (AA's Feb post quotes stale $99/$249/$30; the 3-way post's Sep 8 figures were right). AA live: $44/$99/$199, $33/$74/$149 annual ✓
- [x] Shipped: calendar item 10, tracker rows (`leadsie vs agencyaccess`, `agencyaccess alternative`), strategy inventory → 22
- [ ] Deferred: `leadsie review` standalone post (G2 + vendor pages own the SERP; revisit only if the compare page stalls) · provider install for volume data · `/compare/authhub-vs-leadsie` tracker target 404s (covered by 3-way post + compare page instead)

## Phase B — Week 2 (Sep 15–21)

- [ ] B1. GTM Access for Agencies (`gtm-access-agencies`) — full pipeline
- [ ] B2. Microsoft Ads Access for Agencies (`microsoft-ads-access-agencies`) — full pipeline

## Phase C — Week 3 (Sep 22–28)
- [ ] C1. Client Offboarding Checklist (`client-offboarding-checklist`) — full pipeline, links to revoke guide + platform guides
- [ ] C2. Pinterest Ads refresh — update steps, year, internal links

## Phase D — Week 4 (Sep 29–30) — maintenance
- [ ] D1. Internal link pass: new guides ← all platform guides + compare pages
- [ ] D2. Compare-page pricing verify (Leadsie + AgencyAccess) vs `comparison-data.ts`
- [ ] D3. Add 5 new keywords to rank tracking (seo CLI / SnowSEO)

## Success check (Sep 30)
1. 5 publishes live + indexed; Pinterest refresh live
2. ≥2 of 7 cluster terms on page one (≤10)
3. `leadsie alternative` holds ≤6
4. New keywords tracked with baselines

## Review
(appended at end of each phase)
