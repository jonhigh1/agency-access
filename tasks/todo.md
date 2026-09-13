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
