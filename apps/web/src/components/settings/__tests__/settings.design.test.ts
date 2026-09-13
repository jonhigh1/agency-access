/**
 * Settings tree — Design System v2.0 source contract
 *
 * Walks every component under src/components/settings (excluding tests) and
 * asserts the v2.0 token rules from apps/web/DESIGN_SYSTEM.md:
 * binary radius, no soft shadows, no generic Tailwind colour families,
 * no `.clean-card`, no gradients, no `font-dela`, no `transition-all`.
 *
 * Two layers, on purpose. `validateDesignSystem` exact-matches whitespace
 * tokens, so a class glued to a quote or JSX delimiter (`rounded-lg">`)
 * slips past it. The regex layer runs on the raw source text and closes
 * that gap without weakening the shared validator.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validateDesignSystem } from '@/test/utils/design-system';

const SETTINGS_ROOT = path.resolve(__dirname, '..');
const PAGE_PATH = path.resolve(__dirname, '../../../app/(authenticated)/settings/page.tsx');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const SOURCE_FILES = [...walk(SETTINGS_ROOT), PAGE_PATH];

const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: 'non-binary radius', pattern: /\brounded-(sm|md|lg|xl|2xl|3xl)\b/ },
  { label: 'arbitrary radius', pattern: /rounded-\[/ },
  { label: 'soft shadow', pattern: /\bshadow-(sm|md|lg|xl|2xl|3xl)\b/ },
  { label: 'generic colour family', pattern: /\b(gray|zinc|neutral|stone|orange|sky|cyan|pink|lime|fuchsia)-\d/ },
  // Only inside class strings: a quote/backtick opens and closes the token run, so prose never matches.
  { label: 'bare or arbitrary shadow', pattern: /["'`](?:[^"'`\n]*\s)?(shadow|shadow-inner|drop-shadow(?:-[\w[\]]+)?|shadow-\[[^\]]*\])(?=\s|["'`])/ },
  { label: 'clean-card', pattern: /clean-card/ },
  { label: 'gradient', pattern: /bg-gradient/ },
  { label: 'font-dela', pattern: /font-dela/ },
  { label: 'transition-all', pattern: /transition-all/ },
];

describe('Settings tree — Design System v2.0 source contract', () => {
  it('walks a non-empty settings tree', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(10);
  });

  describe.each(SOURCE_FILES.map((file) => [path.relative(SETTINGS_ROOT, file), file]))(
    '%s',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf-8');

      it('passes validateDesignSystem on every class token', () => {
        const violations = validateDesignSystem(source.split(/\s+/).join(' '));
        expect(violations.map((v) => `${v.type}: ${v.className}`)).toEqual([]);
      });

      it.each(FORBIDDEN.map((f) => [f.label, f.pattern]))('contains no %s', (_name, pattern) => {
        const match = source.match(pattern as RegExp);
        expect(match ? `${match[0]} in ${path.basename(file)}` : null).toBeNull();
      });
    }
  );
});
