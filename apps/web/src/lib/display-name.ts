/**
 * Display-name formatter (U10).
 *
 * Agencies and clients type names in any case; the invite surface shows the
 * result to the client on every screen. `toDisplayName` normalizes an
 * all-lowercase entry for display without second-guessing a name that already
 * carries intentional casing ("IBM" stays "IBM").
 *
 * Rules:
 * - Trim and collapse repeated spaces.
 * - Empty or whitespace-only input returns "" — the caller falls back to the
 *   raw value or a generic noun.
 * - A token that already contains an uppercase letter is preserved verbatim.
 * - Common lowercase entity tokens are lifted to caps (llc, ltd, inc, gmb,
 *   plc, b2b, b2c, sa, bv, pty).
 * - Everything else gets its first letter capitalized.
 */

const ENTITY_TOKENS = new Set(['llc', 'ltd', 'inc', 'gmb', 'plc', 'b2b', 'b2c', 'sa', 'bv', 'pty']);

export function toDisplayName(raw: string): string {
  const collapsed = raw.trim().replace(/ {2,}/g, ' ');
  if (!collapsed) return '';

  return collapsed
    .split(' ')
    .map((token) => {
      const lower = token.toLowerCase();
      if (ENTITY_TOKENS.has(lower)) return lower.toUpperCase();
      if (/[A-Z]/.test(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(' ');
}
