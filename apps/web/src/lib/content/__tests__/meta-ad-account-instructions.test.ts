import { describe, expect, it } from 'vitest';
import { META_AD_ACCOUNT_INSTRUCTIONS } from '../meta-ad-account-instructions';

/** Recursively collect leaf-key paths so every locale must match the en shape. */
function collectKeyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeyPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe('META_AD_ACCOUNT_INSTRUCTIONS', () => {
  it('carries the U9 manual-grant checklist copy in the en keys', () => {
    const en = META_AD_ACCOUNT_INSTRUCTIONS.en;

    expect(en.title).toMatch(/\(Manual\)/i);

    // Plain-language framing: what the client is doing and why.
    expect(en.intro).toContain('{agency}');
    expect(en.intro).toContain('{count}');
    expect(en.scopeNote).toContain('{agency}');
    expect(en.scopeNote).toMatch(/nothing else/i);

    // Revocation reassurance (R9), rendered verbatim near the steps.
    expect(en.revocationNote).toBe(
      'You can remove this access anytime in Meta Business Settings → Partners.'
    );

    // One-tap copy card for the agency business ID.
    expect(en.copyCard.label).toMatch(/business id/i);
    expect(en.copyCard.copyButton).toBe('Copy');
    expect(en.copyCard.copied).toBe('Copied');
    expect(typeof en.copyCard.helper).toBe('string');
    expect(en.copyCard.helper.length).toBeGreaterThan(0);
  });

  it('keeps every locale aligned with the en key shape (translation-ready)', () => {
    const enPaths = collectKeyPaths(META_AD_ACCOUNT_INSTRUCTIONS.en).sort();
    (Object.keys(META_AD_ACCOUNT_INSTRUCTIONS) as Array<keyof typeof META_AD_ACCOUNT_INSTRUCTIONS>)
      .filter((locale) => locale !== 'en')
      .forEach((locale) => {
        const localePaths = collectKeyPaths(META_AD_ACCOUNT_INSTRUCTIONS[locale]).sort();
        expect(localePaths, `${locale} diverges from the en key shape`).toEqual(enPaths);
      });
  });
});
