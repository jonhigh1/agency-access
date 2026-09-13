/**
 * Button Contract Walker — global enforcement
 *
 * The v2.0 button contract lives in components/ui/button.tsx: five variants,
 * binary radius, lift-or-press hover. Hand-rolled button-like elements drift
 * (rounded corners, inverted hovers, off-palette fills), so this walker bans
 * the drift signatures on raw <button>/<Link>/<a> elements and on <Button>
 * className overrides that neuter a variant.
 *
 * Reuses the palette/radius vocabulary of src/test/utils/design-system.ts.
 * If this test fails: migrate the element to a <Button> variant (or, for
 * genuine controls — tabs, pills, accordions — tokenize to rounded-none and
 * on-palette classes with tinted hovers only).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/app', 'src/components'];

/** Files/dirs exempt from the walker (component library, showcase, experiments, dev previews). */
const EXCLUDED_SUBSTRINGS = [
  'src/components/ui/',
  'src/app/design-system/',
  'src/app/dev/',
  'src/app/test/',
  'FlowRedesignPrototype',
  'hero-copy-rewrite',
];

/** Generic Tailwind palette — never on our surfaces. Bare `teal` is brand and stays legal. */
const GENERIC_PALETTE =
  /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal-\d|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

/** Resting solid fills — a raw element with these is impersonating a Button variant. */
const SOLID_FILL =
  /^bg-(?:coral|ink|primary|teal|danger-ink|card|paper|background|muted|accent|popover|secondary|white|black)$/;

const NON_BINARY_RADIUS = /^rounded-(?:sm|md|lg|xl|2xl|3xl|full)$/;
const ARBITRARY_RADIUS = /^rounded-\[/;
const BRUTALIST_SHADOW = /^shadow-brutalist/;
/** Movement mechanics — hover lifts/presses belong to Button variants. */
const MOVEMENT_MECHANICS = /(?:^|:)-?translate-/;
/** Button className tokens that cancel or fight the chosen variant. */
const BUTTON_OVERRIDE_BAN = [
  'hover:translate-x-0',
  'normal-case',
  'hover:shadow-',
];

interface Violation {
  file: string;
  line: number;
  kind: string;
  detail: string;
}

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (EXCLUDED_SUBSTRINGS.some((x) => full.includes(x))) continue;
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      collectTsxFiles(full, acc);
    } else if (entry.endsWith('.tsx') && !entry.includes('.test.')) {
      acc.push(full);
    }
  }
  return acc;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function walkFile(file: string, violations: Violation[]): void {
  const source = readFileSync(file, 'utf-8');
  const push = (index: number, kind: string, detail: string) =>
    violations.push({ file, line: lineOf(source, index), kind, detail });

  // Raw button-like elements.
  const rawOpen = /<(button|Link|a)\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = rawOpen.exec(source)) !== null) {
    const attrs = match[2];
    const dynamic = /className=\{/.test(attrs);
    const classMatch = attrs.match(/className="([^"]*)"/);
    if (dynamic) {
      // Rows and nav links legitimately compose classNames with cn(); only a
      // raw <button> hides button styling from the walker when dynamic.
      if (match[1] === 'button') {
        push(match.index, 'dynamic-classname', 'raw <button> builds className dynamically; keep it static so the walker can verify');
      }
      continue;
    }
    if (!classMatch) continue;
    const tokens = classMatch[1].split(/\s+/).filter(Boolean);

    for (const token of tokens) {
      const bare = token.includes(':') ? token.slice(token.lastIndexOf(':') + 1) : token;
      if (token.match(MOVEMENT_MECHANICS)) {
        push(match.index, 'hand-rolled-hover-motion', token);
      }
      if (BRUTALIST_SHADOW.test(token)) {
        push(match.index, 'hand-rolled-shadow', token);
      }
      if (NON_BINARY_RADIUS.test(bare) || ARBITRARY_RADIUS.test(bare)) {
        push(match.index, 'non-binary-radius', token);
      }
      if (GENERIC_PALETTE.test(token)) {
        push(match.index, 'off-palette-color', token);
      }
      // Resting fills only (no hover:/focus:/… prefix): tints stay legal for controls.
      if (!token.includes(':') && (SOLID_FILL.test(bare) || bare.startsWith('bg-['))) {
        push(match.index, 'solid-fill-on-raw-element', token);
      }
    }
  }

  // <Button> usages whose className fights the variant contract.
  const buttonOpen = /<Button\b([^>]*)>/g;
  while ((match = buttonOpen.exec(source)) !== null) {
    const classMatch = match[1].match(/className="([^"]*)"/);
    if (!classMatch) continue;
    const tokens = classMatch[1].split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (BUTTON_OVERRIDE_BAN.some((banned) => token.startsWith(banned))) {
        push(match.index, 'button-variant-override', token);
      }
      if (token.startsWith('rounded-')) {
        push(match.index, 'button-radius-override', token);
      }
    }
  }
}

function collectViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const root of ROOTS) {
    for (const file of collectTsxFiles(root)) {
      walkFile(file, violations);
    }
  }
  return violations;
}

describe('Button contract (global walker)', () => {
  const violations = collectViolations();

  it('actually walks the tree (sanity canary)', () => {
    const files = collectTsxFiles('src/app').concat(collectTsxFiles('src/components'));
    expect(files.length).toBeGreaterThan(150);
    expect(files).toContain('src/app/(authenticated)/dashboard/page.tsx');
  });

  it('has no hand-rolled or contract-fighting buttons', () => {
    const formatted = violations
      .slice(0, 60)
      .map((v) => `  ${v.file}:${v.line}  [${v.kind}]  ${v.detail}`);
    const summary =
      violations.length === 0
        ? ''
        : `\n${violations.length} violations:\n${formatted.join('\n')}${
            violations.length > 60 ? `\n  … and ${violations.length - 60} more` : ''
          }`;
    expect(violations, summary).toEqual([]);
  });
});
