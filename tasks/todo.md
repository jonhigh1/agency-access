# Todo: Square-on-Round Icons + Button Treatment Cohesion Sweep

Plan: `~/.claude/plans/eventual-moseying-harp.md` · Session: 2026-09-12/13

## Checklist

### Part 1 — Icon fix (TDD)
- [x] Failing tests: platform-icon fallback `rounded-none`; dashboard chips `rounded-none`
- [x] Fix `dashboard/page.tsx:559` + `:625` (rounded-full → rounded-none)
- [x] Fix `platform-icon.tsx:54` (rounded-lg → rounded-none)
- [x] Icon tests green

### Part 2 — Enforcement walker (written first, doubles as to-do list)
- [x] `button-contract.design.test.ts` — global walker; also catches zeroed hovers, resting shadow-none, and arrow-fn attributes

### Tier 0 — Button contract overrides
- [x] Dashboard `createRequestButton` → true brutalist; how-it-works (2); hero-section group-hover press removed; meta-page-permissions link-ghost sanctioned; hero-copy-rewrite excluded
- [x] Commit (8186ffb, 6ab99bc)

### Tier 1 — Authenticated pages
- [x] 33 sites / 12 files (agent batch A) — commit b51d399
### Tier 2 — Shared components
- [x] 29 migrated + 9 tokenized / 13 files (agent batch B) — commit 87c915f
### Tier 3 — Client auth + agency-meta + pinterest
- [x] 18 migrated / 10 files (agent batch C) — commit e0c2717
### Tier 4 — Marketing + blog + programmatic
- [x] 17 migrated + 16 tokenized / 11 files (agent batch D) — commit b6523db
### Tier 5 — Controls tokenization
- [x] Done inside batches (rules 9/10); adjacent platform-card fix (6ab99bc)
- [x] Walker green tree-wide (0 violations)

### Verification & docs
- [x] web suite: 1276 passed / 11 failed — all 11 proven pre-existing at base 86fa16a (docs/ERRORS.md)
- [x] typecheck clean
- [x] Production build with real env sourced (worktree itself lacks .env.local)
- [x] Visual QA: dashboard, pricing, about, blog, /design-system — variant pairs correct, icon tiles square
- [x] DESIGN_SYSTEM.md v2.2.0 changelog; SESSION-LOG entry; docs/ERRORS.md created

## Review

**Shipped (8 commits, `8186ffb` → docs):** both reported issues fixed plus the
systemic drift behind them. Icon chips are square everywhere they wrap
`PlatformIcon`; 214 walker violations across 46 files swept to zero; the walker
now enforces the contract permanently (incl. override-neutering and the
arrow-function attribute blind spot). Off-palette buttons (indigo, yellow,
slate, raw hex, teal-as-primary) are gone.

**Verification:** suite 1276 passed / 11 failed / 2 skipped — the 11 predate
the session (proven via throwaway worktree at the base commit); typecheck
clean; production build passes with env present; visual pass on six surfaces
confirmed variant pairs and square icon tiles on the showcase.

**Notable:** branch renamed externally to `jonhigh1/fix-access-request-visuals`.

**Left open:** pre-existing settings/success test failures (docs/ERRORS.md has
the diagnosis); `components/marketing/hero-copy-rewrite/` flagged for deletion
decision; marketing nav keeps one brutalist across pages (global-chrome
reading of the one-per-view rule).
