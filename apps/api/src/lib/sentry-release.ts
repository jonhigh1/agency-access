/**
 * Sentry `release` tag — first non-blank candidate, or undefined.
 * Callers pass APP_VERSION, then host git SHA envs (Render/Vercel).
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
