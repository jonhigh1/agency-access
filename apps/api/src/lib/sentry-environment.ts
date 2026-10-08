/**
 * Sentry `environment` tag.
 *
 * Returns the first non-blank candidate, trimmed, or "development". Callers pass
 * SENTRY_ENVIRONMENT first and NODE_ENV last, so prod (SENTRY_ENVIRONMENT unset,
 * NODE_ENV=production) keeps reporting as "production" while staging can set
 * SENTRY_ENVIRONMENT=staging.
 *
 * Takes explicit values rather than reading process.env so Next.js can inline
 * NEXT_PUBLIC_* references in the browser bundle.
 */
export function resolveSentryEnvironment(...candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return 'development';
}
