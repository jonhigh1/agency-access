# Agency Access Platform — Design System

> **Version**: 2.0.0
> **Last Updated**: September 3, 2026
> **Aesthetic**: Acid Brutalism v2 — subtraction over excess

---

## Overview

Acid Brutalism v2.0 is a **refinement through subtraction**, informed by an
extracted design-DNA kit of lazyweb.com (September 2026) — a site running the
same brutalist skeleton with tighter discipline. The bones were already ours:
ink on paper, hard borders, square buttons, offset shadows. What changed is
restraint.

- **shadcn/ui** remains the foundational component library
- **One accent** (coral). Acid is hero-only. Electric is gone.
- **Binary radius**: square or circular. Nothing between.
- **Shadow budget**: three sizes, applied as punctuation — never a resting state
- **A mono data layer**: JetBrains Micro-labels carry status, metadata, KPIs

### Core Philosophy

**Structure carries the brand. Color only marks the event.**

1. **Subtraction creates impact.** One accent, one hero moment, three shadows.
2. **Elevation is drawn, not cast.** 1px ink edges separate; shadows accent.
3. **Contrast is a token decision, not a hex choice.** Ink variants per ground.
4. **Tracking inverts with size.** Display pulls tight; micro-labels push out.

---

## Production Moves (the invisible decisions)

Documented beside their tokens in `globals.css` — decisions with evidence, so
future contributors inherit the *why*.

1. **Dual ink tokens per ground.** Raw teal (#00A896) as text on white measures
   ~3.0:1 — a WCAG AA failure carried in v1.x. Text now carries `--success-ink`
   (#0F766E, 5.5:1) and `--danger-ink` (#C2410C, 4.8:1); raw teal/coral are
   fills and borders only. Dark ground uses lightened variants. (source: authored
   decision, verified with measured contrast pairs)
2. **Tracking inversion.** Display headings pull to −0.02/−0.04em
   (`.tracking-display-*`); mono micro-labels push to +0.10/0.12em
   (`.label-micro`/`.label-nano`). The extremes move in opposite directions.
3. **Mid-weights on variable fonts.** Outfit and JetBrains Mono are variable via
   `next/font` — author 650 where 600 feels weak and 700 feels loud (buttons at
   650, mono labels at 650–700).
4. **Two-ring focus.** `outline: 3px solid coral/25` plus a 6px coral/8 halo —
   inner stroke and outer glow, both derived from the accent.
5. **Hero-only acid.** `--acid` survives on the homepage hero moment. One
   element, one view. Its 1.4:1 contrast can never carry meaning.

---

## Design Tokens

### Color Palette

Defined in `globals.css` (`:root`, light + dark). All colors are RGB triplets.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRIMARY SURFACES                            │
├─────────────────────────────────────────────────────────────────────┤
│  --ink      #09090B  │ Deep black; ink panels, heavy sections       │
│  --paper    #FAFAFA  │ Off-white; page ground, surfaces             │
├─────────────────────────────────────────────────────────────────────┤
│                        BRAND COLORS                                 │
├─────────────────────────────────────────────────────────────────────┤
│  --coral    #FF6B35  │ AuthHub Coral — THE accent (fills, borders)  │
│  --teal     #00A896  │ Success fills/borders only — never text      │
├─────────────────────────────────────────────────────────────────────┤
│                     SEMANTIC INK TOKENS (text)                      │
├─────────────────────────────────────────────────────────────────────┤
│  --warning  #B45309  │ Warning text (5.2:1 on white)                │
│  --success-ink #0F766E │ Success text (5.5:1 on white)  [v2.0]      │
│  --danger-ink  #C2410C │ Danger text (4.8:1 on white)   [v2.0]      │
├─────────────────────────────────────────────────────────────────────┤
│                        BRUTALIST ACCENT                             │
├─────────────────────────────────────────────────────────────────────┤
│  --acid     #CCFF00  │ HERO-ONLY (homepage hero). Never text/status │
└─────────────────────────────────────────────────────────────────────┘
```

**The contrast rule (v2.0):** raw coral (~2.9:1) and raw teal (~3.0:1) fail WCAG
AA as text on white. They are **fill and border colors only**. Status text uses
the ink tokens. On dark grounds the ink tokens swap to lightened variants.

| Color | When to Use | Examples |
|-------|-------------|----------|
| `--ink` | Ink panels, footers, heavy sections, borders | `.ink-panel`, `border-black` |
| `--paper` | Page ground, cards | Dashboard surfaces |
| `--coral` | Primary CTAs (fill), borders, the focus system | "Create Access Request" |
| `--teal` | Success **fills and borders** | Connected badge background |
| `--success-ink` | Success **text** | "Authorized" badge text |
| `--danger-ink` | Danger **text** and destructive fills | "Expired" badge text |
| `--warning` | Warning text and fills | "Pending" badge |
| `--acid` | Homepage hero decorative moment only | Hero rotation shape |

#### Removed in v2.0

- `--electric` (#8B5CF6): a second accent in hover states. Hovers now shift
  border/text color toward coral, or invert to ink.
- `--acid` as a general decorative token: hero-only (see above).

### Typography

Three families, three roles:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Role      │ Family          │ Variable │ Notes                     │
├─────────────────────────────────────────────────────────────────────┤
│  Hero      │ Dela Gothic One │ No (400) │ Hero display only         │
│  Display/  │ Outfit          │ Yes      │ Headings + body           │
│  Body      │                 │          │ (font-display class =     │
│            │                 │          │  Outfit since v2.0)       │
│  Data      │ JetBrains Mono  │ Yes      │ Micro-labels, status,     │
│            │                 │          │ metadata, terminal panels │
└─────────────────────────────────────────────────────────────────────┘
```

> **Weight discipline:** Outfit and JetBrains Mono are variable — author 650
> where 600 feels weak and 700 feels loud. Dela is fixed at 400.

#### Tracking spec (v2.0)

| Context | Tracking | Utility |
|---|---|---|
| Display ≥3.5rem | −0.04em | `.tracking-display-lg` |
| Display ≥2rem | −0.02em | `.tracking-display-md` |
| Body | none | — |
| Mono micro (≤11px) | +0.10 to +0.12em | `.label-micro` / `.label-nano` |

#### Mono micro-label system

```tsx
<span className="label-micro">Connection Health</span>   // JBM 700 11px, uppercase
<span className="label-nano">Updated 2 min ago</span>     // JBM 400 10px
```

Adopted: StatCard labels, dashboard Active Connections header (ink-panel
header with ground-aware child rules), marketing footer column headings.
Comparison-table `thead` is a display role, not a micro-label target.
Remaining targets: card meta rows, section eyebrows.

#### Type Scale

| Element | Size | Weight | Font Family | Line Height |
|---------|------|--------|-------------|-------------|
| Hero (fluid) | clamp(2rem, 8vw, 4.5rem) | 400 | dela | 1.05 |
| H1 | 4.5rem | 700 | display | 1.1 |
| H2 | 3rem | 600–650 | display | 1.2 |
| H3 | 2rem | 600 | display | 1.3 |
| Body | 1rem | 400 | display (Outfit) | 1.6 |
| Small | 0.875rem | 400 | display | 1.5 |
| Label | 0.8125rem | 500 | display | 1.4 |
| Micro | 11px | 650–700 | mono | 1.5 |

### Spacing

Tailwind defaults, 4px base grid:

- **Card padding**: `p-6`
- **Section spacing**: `py-16 md:py-24`
- **Component gaps**: `gap-4`
- **Touch targets**: `min-h-[44px]` minimum

### Border Radius — BINARY (v2.0)

```
0        → Cards, buttons, inputs, modals, badges   (--radius: 0rem)
999px    → Pills, chips, status dots                (rounded-full)
50%      → Avatars, icon-only buttons               (rounded-full)
```

Nothing between. `--radius: 0rem` drives Tailwind's `rounded-sm/md/lg`, so the
whole shadcn primitive set resolves square automatically. Use `rounded-full`
only for genuinely circular elements. **Never** author intermediate values
(`rounded-xl`, `rounded-2xl`, `rounded-[0.75rem]` are now violations).

### Shadows — BUDGET OF THREE (v2.0)

Shadow is **punctuation** for interactive or hero elements — never a resting
state. Default cards use a **1px border and no shadow**.

```css
.shadow-brutalist-sm  → 2px 2px 0px #000   /* inputs, small elements   */
.shadow-brutalist     → 4px 4px 0px #000   /* primary buttons          */
.shadow-brutalist-lg  → 6px 6px 0px #000   /* hover peak, hero emphasis */
```

- **Budget**: ≤3 shadow applications per view.
- **Deprecations (v2.0)**: `-xl`, `-2xl`, `-3xl`, `.shadow-hard-xl` are deleted.
- **Hover**: buttons lift 2px; the shadow does NOT grow (stable elevation).

**Hairlines** separate content where shadows once did:

```tsx
<div className="hairline-b">…</div>   /* 1px ink-secondary bottom rule —
                                         meta rows, card footers, list dividers */
```

Adopted: dashboard Active Connections header (ground-aware child rules included).

---

## Component System

### shadcn/ui Foundation

Unchanged: `cn()` merging, forwardRef, CVA where needed, components in
`src/components/ui/`.

### Button (v2.0 contract)

**Five variants. Nothing else.**

| Variant | Look | Use |
|---|---|---|
| `primary` | Coral fill, 1px ink border, `shadow-brutalist` | Main actions |
| `secondary` | Card fill, 1px ink border, no shadow | Alternative/cancel |
| `ghost` | Transparent | Tertiary, icon-adjacent |
| `danger` | `danger-ink` fill, white text | Destructive — never looks like primary |
| `brutalist` | Uppercase coral, 2px border, diagonal shift hover | **One per view** — the view's primary action, wherever it lives (marketing hero, app page, or modal) |

- Sizes: `sm | md | lg | xl | icon` — all `rounded-none` except `icon` (circle)
- Hover: lift 2px (`hover:translate-y-[-2px]`); shadow does not grow
- Focus: two-ring system (3px coral outline + 6px coral/8 halo)
- All buttons ≥44px touch height

> **Migration note:** v1.x `success` → `primary`, `warning` → `primary`,
> `brutalist-rounded` → `brutalist`, `brutalist-ghost[-rounded]` → `secondary`.

### Card

- **Default**: `border` + `bg-card`, **no shadow** (v2.0)
- **Static containers**: keep them static when they hold interactive children —
  one hover target per interactive element (unchanged from v1.x)
- **`clean-card`**: deprecated — Settings no longer uses it (soft shadow + `transition-all` break v2.0). Slated for deletion once no consumer remains

### StatusBadge

Status text carries **ink tokens**; fills stay in the family color:

| State family | Fill | Border | **Text** |
|---|---|---|---|
| Success (authorized/active/healthy) | `bg-teal/10` | `border-teal/30` | `text-success-ink` |
| Warning (pending/past_due/expiring/trialing/incomplete) | `bg-warning/10` | `border-warning/30` | `text-warning` |
| Danger (expired/revoked/invalid/incomplete_expired) | `bg-coral/10` | `border-coral/30` | `text-danger-ink` |
| Neutral (cancelled/unknown) | `bg-muted/10` | `border-border` | `text-muted-foreground` |

**Never** `text-teal` or `text-coral` on light ground — they fail AA.

### Ink Panel (v2.0)

The one dark terminal-style surface per view — "one brutalist element per view"
given a concrete form:

```tsx
<div className="ink-panel p-6">
  <span className="label-micro !text-paper/60">SYNC STATUS</span>
  <p className="text-sm">4 platforms connected</p>
  <span className="cursor-blink" />
</div>
```

Ink ground, paper text, mono data layer, optional blinking cursor.

Defined and ready; adoption is planned — no consumer wired yet.

---

## Animation System

### Philosophy

Functional motion only. One hero moment, honest feedback, no decoration for its
own sake.

- **Reveals**: 450ms, `cubic-bezier(0.2, 0.8, 0.3, 1)` — decel with a settle
- **Hovers**: 150ms — instant feedback
- **Continuous**: `animate-marquee` (proof strips) + `animate-float-pillar`
  (homepage hero) — that is the complete list

### Removed in v2.0

`float-chaos`, `float-order`, `glitch-text`, `ticker-up`, `pulse-button`,
`expand-reveal`, `collapse-center`, `animate-float`, `shadow-brutal` hover
growth, `scaleUp`, `scroll-left-slow`.

### Rules (unchanged from v1.x)

1. Respect `prefers-reduced-motion` — built into all animations
2. Wait for `animations-ready` — no SSR mismatch
3. CSS over JS
4. One hero animation per page
5. Use the `Reveal` component — never raw `reveal-element` classes
6. No hover on containers holding interactive elements

---

## Forms & Inputs

```tsx
// Base input (globals.css) — 1px border, square, two-ring coral focus
<input className="w-full px-4 py-3 border border-black rounded-none" />
```

- Labels always present; mono micro-labels for field groups
- Validation: `text-success-ink` success, `text-warning` caution,
  `text-danger-ink` errors — never raw coral/teal text
- Focus: 3px coral/25 outline + 6px coral/8 halo (two-ring, automatic)

---

## Accessibility

### Color Contrast

- **WCAG AA minimum** — 4.5:1 for normal text; AAA target 7:1
- Ink/paper: 21:1. `--ink-secondary`: 10.4:1. All status ink tokens ≥4.5:1
- **Raw coral/teal are never body or status text on light ground** (v2.0)
- Orange-family text on white stays in the ink variants

### Focus States

Two-ring system everywhere (buttons, inputs): inner 3px coral stroke + outer
6px soft halo. Keyboard focus is unmistakable at any contrast.

### Motion Preferences

`prefers-reduced-motion` collapses all animation — unchanged from v1.x.

---

## Dark Mode

Planned, not yet the primary experience. The ink tokens already carry dark
variants in `:root .dark` (lightened success/danger ink), so the token layer is
dark-ready.

---

## Verification

Design tests enforce this contract (`__tests__` beside components):

- `status-badge.test.tsx` — AA contrast contract per status family
- `button.design.test.tsx` — five variants, binary radius, two-ring focus
- `src/test/utils/design-system.ts` — shadow budget, radius validator,
  brand-color usage lints

Run: `npm run test --workspace=apps/web`. Visual reference: `/design-system`.

---

## Extending the Design System

1. **New component**: shadcn patterns, tokens not hex, square by default
2. **New color**: define CSS variable + tailwind mapping + contrast measurement
   (both grounds) + document here AND comment the *why* beside the token
3. **New animation**: functional only; ≤450ms entrances; justify continuous
   motion in review

---

## Files Reference

| File | Purpose |
|------|---------|
| `globals.css` | Tokens, utilities, production-move comments |
| `tailwind.config.ts` | Theme mapping (colors, fontFamily, shadows) |
| `src/lib/utils.ts` | `cn()` |
| `src/components/ui/` | Component library |
| `src/test/utils/design-system.ts` | Contract validators |
| `~/Desktop/lazyweb.com-design-kit/` | The reference extraction (brief, tokens, scaffold) |

## Changelog

### v2.1.0 (September 12, 2026) — Settings adoption
- Settings page rebuilt on rows: `SettingsRow` / `SettingsGroup` primitives (`src/components/settings/settings-row.tsx`), hairline dividers, no cards
- `.ink-panel` gets its first consumers: one strip per Settings tab (plan, subscription, endpoint, MCP)
- `brutalist` button: one per tab view, always in the row layer, never on ink ground (black border and shadow vanish on `--ink`)
- Enforcement: `settings.design.test.ts` (source walker + regex) and `settings-view-counts.test.tsx` (rendered counts of ink-panel, brutalist, `shadow-brutalist`)
- `clean-card` deprecated for settings surfaces
- Reduced motion: hover transforms disabled under `prefers-reduced-motion` in `globals.css`; `motion-reduce:` utilities are avoided because the validator substring-matches `-red`

### v2.0.0 (September 3, 2026) — Subtraction release
- **Removed `--electric`** — one accent (coral) carries the system
- **`--acid` restricted to homepage hero** — one element, one view
- **Dropped Fraunces** — `font-display` role collapsed onto Outfit; dela keeps hero duty
- **AA contrast contract** — `--success-ink`/`--danger-ink` text tokens; raw
  teal/coral are fills/borders only (fixes v1.x 3.0:1/2.9:1 text failures)
- **Binary radius** — `--radius: 0rem`; corners square or circular, nothing between
- **Shadow budget** — three sizes; default cards border-only, no shadow;
  `-xl/-2xl/-3xl` deleted
- **Button consolidation** — 10 variants → 5; danger no longer identical to primary
- **Two-ring focus** — 3px coral stroke + 6px halo on buttons and inputs
- **Mono micro-label system** — `.label-micro`/`.label-nano`; tracking inversion spec
- **Ink panel** — `.ink-panel` terminal surface, one per view
- **Animation cut** — 11 decorative keyframe families removed; reveals retimed
  to 450ms decel
- **Hairline utility** — `.hairline-b` for meta rows and list dividers
- Fixed documentation drift: fonts documented are the fonts loaded

### v1.3.0 (February 15, 2026)
- Added `--warning` semantic color; restricted `--acid` to decorative-only

### v1.2.x (February 11, 2026)
- Button shadow always visible; hover is lift-only

### v1.1.0 (February 11, 2026)
- Animation anti-patterns; clean-card static pattern

### v1.0.0 (February 10, 2026)
- Initial design system documentation
