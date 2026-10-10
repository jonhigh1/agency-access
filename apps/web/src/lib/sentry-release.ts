/**
 * Sentry `release` tag — first non-blank candidate, or undefined.
 * Browser callers pass NEXT_PUBLIC_* values (only those are inlined).
 */
export function resolveSentryRelease(
  ...candidates: Array<string | undefined | null>
): string | undefined {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return undefined;
}
