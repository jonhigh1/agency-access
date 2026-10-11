# Social Proof Rollout — execution checklist

Plan: ~/.claude/plans/jaunty-coalescing-prism.md · Branch: worktree-feat+social-proof-rollout · TDD: red → green per item.

## Phase A — P0 badges

- [x] A1. `partner-badges.test.tsx` (red) → `PartnerBadges` component (green)
- [x] A2. Footer: extend `marketing-footer.test.tsx` (red) → render badges in brand column (green)
- [x] A3/A4. Hero + final CTA: source-walker claims (red) → wired (green)
- [x] A5. Security: extend `page.public.test.tsx` (red) → badges + framing line in platforms section (green)

## Phase B — P1 proof fixes

- [x] B1. `success-stories-section.test.tsx` (red: controls render with 1 story) → conditional render fix (green)
- [x] B2. Delete `pricing/testimonial-cards.tsx`; drop from `pricing-copy.claims.test.ts` file list; suite green
- [x] B3. Rename `social-proof-section` → `value-marquee-section` (5 consumers + motion test + claims walker path)

## Phase C — Tier 1 counters

- [x] C1. API: route test (3/3) + service test (2/2) → service + route + CacheKeys + index registration
- [x] C2. Web: `marketing-stats.ts` helper 4/4 (revalidate 3600, null fallback, 5s timeout)
- [x] C3. Claims test 2 rewritten to pin real counters; props-driven `MetricBanner` + pricing wiring
- [x] C4. Motion test stats assertions; async homepage + `revalidate = 3600` + stats row

## Gates

- [x] G1. `npm run test` all workspaces green (exit 0; shared 221, cli 7, api + web full suites)
- [x] G2. `npm run typecheck` green
- [x] G3. `npm run lint` green (0 errors; 74 pre-existing warnings in untouched files)
- [x] G4. `npm run build` green — `/` and `/pricing` static with Revalidate 1h, `/security` static
      (note: first build failed in the fresh worktree on a stale Prisma client — `db:generate` fixed it; not a code issue)

## Visual QA (t3 preview, mock stats API on 3201)

- [x] V1. Desktop 1440: hero badges + counters row, pricing MetricBanner (99.9% / 380 / 5,100),
      final CTA chips, security platforms section, footer brand column — all clean
- [x] V2. Mobile 390: badges stack centered, counters column legible, marquee static grid — clean
- [x] V3. API-down fallback (cold `.next`): counters hidden, badges remain, page renders
- [x] V4. No nits requiring fixes

## Wrap

- [x] W0. Jon's post-review call (d6439099): pricing MetricBanner reverted to the benefit trio
      (99.9% + estimated hours/emails + disclosure); homepage stats row + endpoint unchanged
- [ ] W1. Post-deploy: `curl https://agency-access.onrender.com/api/marketing-stats`; verify counters show
      real values; apply display floor (omit agencies count if too small) before it ships if needed
- [ ] W2. PR offered to Jon
- [ ] W3. Swap text chips for portal-exported badge assets when Jon provides them (config `src` field ready)

## Review

- All three phases shipped test-first; every walker (claims, honesty, button-contract, perf-contracts,
  motion) green without weakening any ban.
- Badge labels are Jon's explicit call ("Official Partner" both); `PARTNER_BADGES` config is the one
  place to correct wording or add portal assets.
- QA caught one real environmental trap: Next dev persists the fetch data cache in `.next/cache`
  across dev restarts — the API-down fallback only shows cold. Post-deploy check (W1) should hit the
  live endpoint, not rely on cache-warmed pages.
- Counters verified visually with mock values (380/309/5,100); real production values unknown until W1.
