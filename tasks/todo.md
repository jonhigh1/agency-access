# Todo: Square-on-Round Icons + Button Treatment Cohesion Sweep

Plan: `~/.claude/plans/eventual-moseying-harp.md` · Session: 2026-09-12

## Checklist

### Part 1 — Icon fix (TDD)
- [x] Failing tests: platform-icon fallback `rounded-none`; dashboard chips `rounded-none`
- [x] Fix `dashboard/page.tsx:559` + `:625` (rounded-full → rounded-none)
- [x] Fix `platform-icon.tsx:54` (rounded-lg → rounded-none)
- [x] Icon tests green

### Part 2 — Enforcement walker (written first, doubles as to-do list)
- [x] `apps/web/src/test/button-contract.test.ts` — global walker, failing on current drift

### Tier 0 — Button contract overrides (7)
- [x] Dashboard `createRequestButton` → true brutalist
- [x] how-it-works-section (2) + hero-copy-rewrite twin (2) + meta-page-permissions-modal + hero-section
- [x] Commit

### Tier 1 — Authenticated pages (35)
- [ ] access-requests/new (11), clients (3) + error (2), token-health (5), dashboard (2), edit page (1), internal/admin (11)
- [x] Commit

### Tier 2 — Shared components (~30)
- [ ] client-selector, upgrade-modal, save-as-template-modal, usage-display, hierarchical-platform-selector, modals, wizards, GoogleOffboardingPanel (legacy tokens), settings/billing, trial-banner, manual-invitation-modal
- [ ] platform-card rounded-xl/clean-card adjacent fix
- [x] Commit

### Tier 3 — Client auth + agency-meta (~25)
- [ ] client-auth/** (MetaAssetSelector rounded-[0.75rem], wizard, anchors, copy buttons), agency-meta (slate), pinterest inputs (indigo)
- [x] Commit

### Tier 4 — Marketing + programmatic (~25)
- [ ] marketing-nav (inverted hover), about, blog, pricing, carousel arrows, FAQ, solution sections (teal/rounded-2xl), affiliate form, programmatic templates (raw hex)
- [x] Commit

### Tier 5 — Controls tokenization
- [ ] Tabs/segmented/pills/accordions/dashed add-field/pagination/option rows → rounded-none + on-palette + consistent hover
- [ ] Walker green
- [x] Commit

### Verification & docs
- [ ] `npm run test --workspace=apps/web` green
- [ ] `npm run typecheck` + `npm run build` green
- [ ] Visual pass (dev-browser): dashboard, clients, token-health, access-requests/new, connections, invite, marketing, admin — hover/focus/active + reduced motion
- [ ] DESIGN_SYSTEM.md changelog v2.2.0, SESSION-LOG entry

## Review

(to fill at wrap-up)
