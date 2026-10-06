/**
 * Invite surface — Acid Brutalism v2.0 source contract (U10).
 *
 * Walks every invite-reachable source file (`app/invite/**`, the flow
 * components, and the client-auth components the invite wizard imports —
 * CLIENT_AUTH_FILES is that import closure; `FlowRedesignPrototype` is a
 * dev-only preview and stays excluded) and asserts the v2.0 rules from
 * apps/web/DESIGN_SYSTEM.md:
 *
 * 1. Raw accent text — `--coral`/`--teal` are fills and borders only; text
 *    carries the ink tokens (`--danger-ink`/`--success-ink`, AA). A
 *    `hover:`/`group-hover:` shift toward coral is sanctioned v2 behavior.
 *    Both `text-[var(--coral)]` and the rgb-wrapped `text-[rgb(var(--coral))]`
 *    idiom are matched (review #7).
 * 2. Binary radius — square (`--radius: 0rem`) or `rounded-full`.
 *    `rounded-sm/md/lg` resolve square through `--radius`, so only
 *    `-xl`/`-2xl`/`-3xl` and arbitrary values are violations here
 *    (DESIGN_SYSTEM.md is the binding authority, not the plan text).
 * 3. Shadow budget — one resting card-scale shadow per rendered state-view.
 *    `shadow-brutalist-sm` is input/small-element punctuation (sanctioned by
 *    DESIGN_SYSTEM.md) and `focus:`/`hover:` variants are not resting, so
 *    neither counts toward the budget. Non-token shadows (`shadow-lg` and
 *    friends) are violations outright (review #6).
 * 4. Emoji tiles — lucide glyphs, never emoji, on the invite surface.
 * 5. Off-palette fills — the generic Tailwind palette (slate/gray/indigo/…)
 *    never renders on an invite-reachable surface (review #32's class half).
 *
 * The walked surface is derived by directory walk, not a hand-built import
 * list (review #5): every file under `app/` (invite + platforms incl. the
 * OAuth callback), `components/flow`, and `components/client-auth` is
 * covered by default — `__tests__` and the dev-only `FlowRedesignPrototype`
 * stay excluded.
 *
 * Plus the 390px and branding fixtures: the wizard footer must never sit
 * inside an `overflow-hidden` ancestor, business/option names must not rely
 * on `truncate` as their only display, checklist rows and select options keep
 * 44px touch targets, the terminal card carries branding, and the agency
 * name renders through `toDisplayName`.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const WEB_SRC = path.resolve(__dirname, '../../../..');
const INVITE_ROOT = path.join(WEB_SRC, 'app', 'invite');
const FLOW_ROOT = path.join(WEB_SRC, 'components', 'flow');
const CLIENT_AUTH_ROOT = path.join(WEB_SRC, 'components', 'client-auth');

const PLATFORMS_ROOT = path.join(WEB_SRC, 'app', 'platforms');

/** Dev-only previews and test scaffolding never ship, so they stay out. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const SOURCE_FILES: string[] = [
  ...walk(INVITE_ROOT),
  ...walk(PLATFORMS_ROOT),
  ...fs
    .readdirSync(FLOW_ROOT)
    .filter((name) => name.endsWith('.tsx') && name !== 'FlowRedesignPrototype.tsx')
    .map((name) => path.join(FLOW_ROOT, name)),
  ...walk(CLIENT_AUTH_ROOT),
];

// ---------------------------------------------------------------------------
// Rule 1: raw accent text. Coral/teal are fills and borders only; only a
// `hover:`/`group-hover:` prefixed shift toward coral stays legal.
// ---------------------------------------------------------------------------
const RAW_ACCENT_TEXT =
  /(?<!group-hover:)(?<!hover:)(?<![-\w])text-\[(?:rgb\()?var\(--(?:coral|teal)\)\]?(?:\/\d+)?/g;

function findRawAccentText(source: string): string[] {
  return [...source.matchAll(RAW_ACCENT_TEXT)].map((match) => match[0]);
}

// ---------------------------------------------------------------------------
// Rule 2: binary radius. Square or circular — nothing between.
// ---------------------------------------------------------------------------
const NON_BINARY_RADIUS =
  /(?<![-\w])rounded-(?:xl|2xl|3xl)(?![\w-])|rounded-\[(?!9999|50%|full)[^\]\n]*\]/g;

function findNonBinaryRadius(source: string): string[] {
  return [...source.matchAll(NON_BINARY_RADIUS)].map((match) => match[0]);
}

// ---------------------------------------------------------------------------
// Rule 3: shadow budget. Resting CARD-scale shadows (`shadow-brutalist` and
// `shadow-brutalist-lg`) — one per rendered state-view. `-sm` is input-scale
// punctuation and prefixed variants are not resting, so neither counts.
// ---------------------------------------------------------------------------
const RESTING_CARD_SHADOW = /(?<![:\w-])shadow-brutalist(?:-lg)?(?![-\w])/g;

function countRestingCardShadows(source: string): number {
  return [...source.matchAll(RESTING_CARD_SHADOW)].length;
}

/**
 * Files whose source holds several MUTUALLY EXCLUSIVE state views need more
 * than one resting shadow in source while still rendering at most one per
 * view. Every entry documents which views the budget covers; a file missing
 * from this map gets the default budget of one.
 */
const SHADOW_BUDGET_BY_SOURCE_PATH: Record<string, number> = {
  // client-invite-page renders five exclusive state views, one emphasis each:
  // terminal card, intake form, intake platform summary, finalizing, complete.
  // The platforms view's single emphasis lives on the stage card
  // (invite-platform-stage.tsx), not here.
  'app/invite/[token]/client-invite-page.tsx': 5,
  // oauth-callback renders two exclusive states: processing, result.
  'app/invite/oauth-callback/page.tsx': 2,
  // The agency OAuth callback renders loading, portfolio states, and result
  // cards as mutually exclusive views; two carry one emphasis shadow each.
  'app/platforms/callback/page.tsx': 2,
};

// ---------------------------------------------------------------------------
// Rule 4: emoji tiles. Lucide glyphs render icons; emoji never do.
// ---------------------------------------------------------------------------
const EMOJI_GLYPH = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

function findEmojiGlyphs(source: string): string[] {
  return [...source.matchAll(EMOJI_GLYPH)].map((match) => match[0]);
}

// ---------------------------------------------------------------------------
// Rule 5: non-token shadows and the generic Tailwind palette. The v2 shadow
// vocabulary is shadow-brutalist(-lg|-sm) only; slate/gray/indigo/… never
// render on an invite-reachable surface (review #6, #32).
// ---------------------------------------------------------------------------
const NON_TOKEN_SHADOW = /(?<![-\w:])shadow-(?:sm|md|lg|xl|2xl|inner|none)(?![-\w])/g;
const GENERIC_PALETTE =
  /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

// v2 binary radius allows only square (rounded-none / default) and circle
// (rounded-full, arbitrary 9999px). sm/md/lg are the rounded world surviving
// in intermediate sizes — the 2026-09-29 intake sweep found 34 of them.
const INTERMEDIATE_RADIUS = /(?<![-\w])rounded-(?:sm|md|lg)(?![-\w])/g;
// The pre-v2 border token. v2 edges are ink (border-black / border-white) or
// hairlines (border-black/10); `border-border` carried no width and hid the
// intake inputs (2026-09-29).
const LEGACY_BORDER_TOKEN = /(?<![-\w:])border-border(?![-\w])/g;
// Raw white is not a token; surfaces are bg-card / bg-paper.
const RAW_WHITE_SURFACE = /(?<![-\w])bg-white(?![-\w])(?!\/)/g;

function findIntermediateRadius(source: string): string[] {
  return [...source.matchAll(INTERMEDIATE_RADIUS)].map((match) => match[0]);
}

function findLegacyBorderToken(source: string): string[] {
  return [...source.matchAll(LEGACY_BORDER_TOKEN)].map((match) => match[0]);
}

function findRawWhiteSurface(source: string): string[] {
  return [...source.matchAll(RAW_WHITE_SURFACE)].map((match) => match[0]);
}

/**
 * Full-box (`border-2`) budget per file, frozen at the 2026-09-29/30 nesting
 * sweeps: one bordered shell per surface, controls and icon chips carry the
 * rest. The count can only fall — growth requires editing this map, which is
 * the review conversation. Files not listed allow zero.
 */
const BORDER2_BUDGET_BY_SOURCE_PATH: Record<string, number> = {
  'app/invite/[token]/client-invite-page.tsx': 9,
  'app/platforms/callback/page.tsx': 5,
  'app/invite/[token]/loading.tsx': 1,
  'app/invite/oauth-callback/page.tsx': 2,
  'components/client-auth/AdAccountSharingInstructions.tsx': 1,
  'components/client-auth/AssetCheckbox.tsx': 1,
  'components/client-auth/AssetGroup.tsx': 1,
  'components/client-auth/AssetSelectorStates.tsx': 2,
  'components/client-auth/AutomaticPagesGrant.tsx': 1,
  'components/client-auth/GoogleAssetSelector.tsx': 1,
  'components/client-auth/GuidedRedirectModal.tsx': 9,
  'components/client-auth/LinkedInAssetSelector.tsx': 1,
  'components/client-auth/MetaAssetCreator.tsx': 6,
  'components/client-auth/MetaAssetSelector.tsx': 8,
  'components/client-auth/MetaBusinessCreator.tsx': 6,
  'components/client-auth/MetaBusinessSetupChecklist.tsx': 2,
  'components/client-auth/MetaConnectionErrorPanel.tsx': 1,
  'components/client-auth/MetaGrantChecklist.tsx': 2,
  'components/client-auth/PlatformAuthWizard.tsx': 17,
  'components/client-auth/PlatformStepProgress.tsx': 1,
  'components/client-auth/PortfolioSelector.tsx': 1,
  'components/client-auth/SelectionResetConfirmDialog.tsx': 1,
  'components/client-auth/TikTokAssetSelector.tsx': 2,
  'components/flow/invite-load-state-card.tsx': 1,
  'components/flow/invite-platform-stage.tsx': 1,
  'components/flow/invite-terminal-card.tsx': 1,
  'components/flow/manual-checklist-wizard.tsx': 1,
};

function countBorder2(source: string): number {
  return [...source.matchAll(/(?<![-\w])border-2(?![-\w])/g)].length;
}

function findNonTokenShadows(source: string): string[] {
  return [...source.matchAll(NON_TOKEN_SHADOW)].map((match) => match[0]);
}

/**
 * Platform brand colors are identity, not palette drift: the Instagram asset
 * tile is pink because Instagram is pink. Each exception names its file and
 * token; anything not listed is a violation.
 */
const GENERIC_PALETTE_BRAND_EXCEPTIONS: Record<string, Set<string>> = {
  'components/client-auth/MetaAssetSelector.tsx': new Set(['pink-500']),
};

function findGenericPalette(source: string, relativePath: string): string[] {
  const allowed = GENERIC_PALETTE_BRAND_EXCEPTIONS[relativePath] ?? new Set<string>();
  return [...source.matchAll(GENERIC_PALETTE)]
    .map((match) => match[0])
    .filter((token) => !allowed.has(token));
}

// ---------------------------------------------------------------------------
// 390px + branding fixture helpers.
// ---------------------------------------------------------------------------

/**
 * The wizard footer renders as the last child of the PlatformWizardCard root.
 * If that root (or the footer's own subtree) clips, the footer loses its
 * scroll-reachability guarantees at 390px (R4, R13).
 */
function findWizardFooterClip(wizardCardSource: string, wizardSource: string): string | null {
  const root = wizardCardSource.match(/<m\.div\s*\n\s*className="([^"]*)"/);
  if (!root) return 'PlatformWizardCard root m.div className not found';
  if (/\boverflow-hidden\b/.test(root[1])) {
    return `PlatformWizardCard root clips its footer: ${root[1]}`;
  }

  const footerIndex = wizardCardSource.indexOf('{footer && (');
  if (footerIndex < 0) return 'PlatformWizardCard footer render not found';
  if (/\boverflow-hidden\b/.test(wizardCardSource.slice(footerIndex))) {
    return 'PlatformWizardCard footer subtree clips itself';
  }

  const shareFooterStart = wizardSource.indexOf('const shareFooter');
  if (shareFooterStart < 0) return 'PlatformAuthWizard shareFooter definition not found';
  const shareFooterEnd = wizardSource.indexOf(') : undefined;', shareFooterStart);
  const shareFooter = wizardSource.slice(
    shareFooterStart,
    shareFooterEnd > shareFooterStart ? shareFooterEnd : undefined
  );
  if (/\boverflow-hidden\b/.test(shareFooter)) {
    return 'PlatformAuthWizard share footer subtree clips itself';
  }
  if (!/footer=\{shareFooter\}/.test(wizardSource)) {
    return 'PlatformAuthWizard does not pass shareFooter as the card footer';
  }

  return null;
}

describe('Invite surface — Design System v2.0 source contract', () => {
  it('walks a non-empty invite tree', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(30);
  });

  describe.each(SOURCE_FILES.map((file) => [path.relative(WEB_SRC, file), file]))(
    '%s',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(WEB_SRC, file);

      it('carries accent meaning in ink tokens, never raw coral/teal text', () => {
        expect(findRawAccentText(source)).toEqual([]);
      });

      it('keeps radius binary (no sm/md/lg/xl/2xl/3xl/arbitrary)', () => {
        expect(findNonBinaryRadius(source)).toEqual([]);
        expect(findIntermediateRadius(source)).toEqual([]);
      });

      it('draws edges in ink, never the pre-v2 border token', () => {
        expect(findLegacyBorderToken(source)).toEqual([]);
      });

      it('surfaces come from tokens, never raw bg-white', () => {
        expect(findRawWhiteSurface(source)).toEqual([]);
      });

      it('stays within its full-box border budget (nesting can only fall)', () => {
        const budget = BORDER2_BUDGET_BY_SOURCE_PATH[relativePath] ?? 0;
        expect(countBorder2(source)).toBeLessThanOrEqual(budget);
      });

      it('stays within the resting card-shadow budget for its state views', () => {
        const budget = SHADOW_BUDGET_BY_SOURCE_PATH[relativePath] ?? 1;
        const count = countRestingCardShadows(source);
        expect(count).toBeLessThanOrEqual(budget);
      });

      it('renders icons with lucide glyphs, not emoji tiles', () => {
        expect(findEmojiGlyphs(source)).toEqual([]);
      });

      it('uses only token shadows, never utility-scale shadows', () => {
        expect(findNonTokenShadows(source)).toEqual([]);
      });

      it('stays on the token palette, never the generic Tailwind palette', () => {
        expect(findGenericPalette(source, relativePath)).toEqual([]);
      });
    }
  );

  describe('rule functions — synthetic bad-string proofs', () => {
    it('raw accent text fires and spares hover-prefixed, bg, and border uses', () => {
      expect(findRawAccentText('<p className="text-[var(--coral)]">x</p>')).toHaveLength(1);
      expect(findRawAccentText('<p className="text-[var(--teal)]/80">x</p>')).toHaveLength(1);
      expect(
        findRawAccentText('<p className="group-hover:text-[var(--coral)]">x</p>')
      ).toEqual([]);
      expect(findRawAccentText('<p className="hover:text-[var(--coral)]/80">x</p>')).toEqual([]);
      expect(
        findRawAccentText('<div className="bg-[var(--coral)] border-[var(--teal)]">x</div>')
      ).toEqual([]);
    });

    it('non-binary radius fires on sm/md/lg and xl/2xl/3xl and arbitrary values, spares full', () => {
      expect(findNonBinaryRadius('<div className="rounded-xl">x</div>')).toHaveLength(1);
      expect(findNonBinaryRadius('<div className="rounded-2xl">x</div>')).toHaveLength(1);
      expect(findNonBinaryRadius('<div className="rounded-3xl">x</div>')).toHaveLength(1);
      expect(findNonBinaryRadius('<div className="rounded-[12px]">x</div>')).toHaveLength(1);
      expect(findIntermediateRadius('<div className="rounded-md">x</div>')).toHaveLength(1);
      expect(findIntermediateRadius('<div className="rounded-lg">x</div>')).toHaveLength(1);
      expect(findIntermediateRadius('<div className="rounded-sm">x</div>')).toHaveLength(1);
      expect(findNonBinaryRadius('<div className="rounded-lg rounded-sm rounded-md">x</div>')).toEqual([]);
      expect(findNonBinaryRadius('<div className="rounded-full rounded-[9999px]">x</div>')).toEqual([]);
    });

    it('legacy border token and raw bg-white fire; token edges and bg-card pass', () => {
      expect(findLegacyBorderToken('<div className="border-b border-border">x</div>')).toHaveLength(1);
      expect(findLegacyBorderToken('<div className="border-2 border-black">x</div>')).toEqual([]);
      expect(findRawWhiteSurface('<div className="bg-white p-4">x</div>')).toHaveLength(1);
      expect(findRawWhiteSurface('<div className="bg-card p-4">x</div>')).toEqual([]);
    });

    it('the resting shadow counter skips -sm and prefixed variants, counts card-scale', () => {
      expect(
        countRestingCardShadows('shadow-brutalist focus:shadow-brutalist shadow-brutalist-sm shadow-brutalist-lg')
      ).toBe(2);
      expect(countRestingCardShadows('hover:shadow-brutalist shadow-brutalist-sm')).toBe(0);
      // One resting card-scale shadow over a budget of one is a violation.
      const synthetic = '<div className="border-2 border-black shadow-brutalist a" /><div className="shadow-brutalist b" />';
      expect(countRestingCardShadows(synthetic)).toBeGreaterThan(1);
    });

    it('the emoji rule fires on tile emoji', () => {
      expect(findEmojiGlyphs('<span>🔐</span>')).toEqual(['🔐']);
      expect(findEmojiGlyphs('<div>🛍️</div>')).toEqual(['🛍']);
      expect(findEmojiGlyphs('<span>Search</span>')).toEqual([]);
    });

    it('raw accent text fires on the rgb-wrapped idiom too (review #7)', () => {
      expect(findRawAccentText('<p className="text-[rgb(var(--coral))]">x</p>')).toHaveLength(1);
      expect(findRawAccentText('<p className="text-[rgb(var(--teal))]">x</p>')).toHaveLength(1);
      expect(
        findRawAccentText('<p className="group-hover:text-[rgb(var(--coral))]">x</p>')
      ).toEqual([]);
    });

    it('non-token shadows fire, token shadows do not (review #6)', () => {
      expect(findNonTokenShadows('<div className="shadow-lg">x</div>')).toEqual(['shadow-lg']);
      expect(findNonTokenShadows('<div className="shadow-md shadow-xl shadow-inner shadow-none">x</div>')).toHaveLength(4);
      expect(findNonTokenShadows('<div className="shadow-brutalist shadow-brutalist-lg shadow-brutalist-sm">x</div>')).toEqual([]);
    });

    it('generic palette classes fire, token surfaces do not (review #32)', () => {
      expect(findGenericPalette('<div className="bg-slate-50 text-indigo-600">x</div>')).toEqual([
        'slate-50',
        'indigo-600',
      ]);
      expect(findGenericPalette('<div className="border-black bg-paper text-danger-ink dark:border-white">x</div>', 'x.tsx')).toEqual([]);
      // Brand-identity exception: pink-500 on the Instagram tile file only.
      expect(findGenericPalette('<div className="bg-pink-500">x</div>', 'components/client-auth/MetaAssetSelector.tsx')).toEqual([]);
      expect(findGenericPalette('<div className="bg-pink-500">x</div>', 'other.tsx')).toEqual(['pink-500']);
    });

    it('the footer-clip rule fires on an overflow-hidden card root', () => {
      const clippingCard = [
        'export function Card() {',
        '  return (',
        '    <m.div',
        '      className="bg-card rounded-none shadow-brutalist border-2 border-black overflow-hidden"',
        '    >',
        '      <div>content</div>',
        '      {footer && (<div>footer</div>)}',
        '    </m.div>',
        '  );',
        '}',
      ].join('\n');
      const cleanWizard = 'const shareFooter = true ? (<div>footer</div>) : undefined;';
      expect(findWizardFooterClip(clippingCard, cleanWizard)).toMatch(/root clips its footer/);

      const cleanCard = clippingCard.replace(' overflow-hidden', '');
      const clippingWizard = [
        'const shareFooter = cta ? (',
        '  <div className="overflow-hidden"><Button>Go</Button></div>',
        ') : undefined;',
      ].join('\n');
      expect(findWizardFooterClip(cleanCard, clippingWizard)).toMatch(/share footer subtree clips/);
    });
  });

  describe('390px + branding fixtures', () => {
    const wizardCardPath = path.join(CLIENT_AUTH_ROOT, 'PlatformWizardCard.tsx');
    const wizardPath = path.join(CLIENT_AUTH_ROOT, 'PlatformAuthWizard.tsx');
    const queueItemPath = path.join(FLOW_ROOT, 'invite-platform-queue-item.tsx');
    const portfolioPath = path.join(CLIENT_AUTH_ROOT, 'PortfolioSelector.tsx');
    const singleSelectPath = path.join(WEB_SRC, 'components', 'ui', 'single-select.tsx');
    const pagePath = path.join(INVITE_ROOT, '[token]', 'client-invite-page.tsx');
    const manualFlowPath = path.join(FLOW_ROOT, 'manual-invite-flow.tsx');

    it('keeps the wizard footer outside every overflow-hidden ancestor (390px reachability)', () => {
      const violation = findWizardFooterClip(
        fs.readFileSync(wizardCardPath, 'utf-8'),
        fs.readFileSync(wizardPath, 'utf-8')
      );
      expect(violation).toBeNull();
    });

    it('never relies on truncate as the sole display for business or option names', () => {
      for (const filePath of [portfolioPath, queueItemPath]) {
        expect(fs.readFileSync(filePath, 'utf-8')).not.toMatch(/\btruncate\b/);
      }
    });

    it('keeps 44px touch targets on checklist rows and select options', () => {
      expect(fs.readFileSync(queueItemPath, 'utf-8')).toMatch(/min-h-\[44px\]/);

      const singleSelect = fs.readFileSync(singleSelectPath, 'utf-8');
      expect(singleSelect).toMatch(/min-h-\[44px\]/);
      const optionRegion = singleSelect.slice(singleSelect.indexOf('role="option"'));
      const optionClass = optionRegion.match(/className=\{cn\(\s*\n?\s*'([^']*)'/);
      expect(optionClass?.[1] ?? '').toMatch(/min-h-\[44px\]/);
    });

    it('carries branding onto the terminal card and the hero header', () => {
      // The terminal card lives in its own module since review #1; the page
      // wires branding into it.
      const terminalCard = fs.readFileSync(
        path.join(FLOW_ROOT, 'invite-terminal-card.tsx'),
        'utf-8'
      );
      expect(terminalCard).toMatch(/<img/);
      expect(terminalCard).toMatch(/logoUrl/);
      const page = fs.readFileSync(pagePath, 'utf-8');
      expect(page).toMatch(/logoUrl=\{data\.branding\?\.logoUrl\}/);
    });

    it('renders the agency name through toDisplayName on every payload render site', () => {
      // Either the bare call or the fallback-parameter form counts; a raw
      // unformatted render site does not.
      expect(fs.readFileSync(pagePath, 'utf-8')).toMatch(/toDisplayName\(data\.agencyName[,)]/);
      expect(fs.readFileSync(manualFlowPath, 'utf-8')).toMatch(/toDisplayName\(data\.agencyName[,)]/);
    });
  });
});
