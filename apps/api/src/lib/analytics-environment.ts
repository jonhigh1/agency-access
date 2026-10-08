/**
 * PostHog `environment` super-property.
 *
 * Returns `{ environment }` for non-production app environments (e.g. "staging")
 * so their events can be filtered out, and `{}` when the value is unset, blank or
 * "production" so prod events stay exactly as they are today.
 */
export function resolveAnalyticsEnvironment(raw: string | undefined | null): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value || value === 'production') return null;
  return value;
}

export function analyticsEnvironmentProperties(
  raw: string | undefined | null
): { environment: string } | Record<string, never> {
  const environment = resolveAnalyticsEnvironment(raw);
  return environment ? { environment } : {};
}
