const POSTHOG_PROJECT_KEY_PREFIX = 'phc_';

export function isPosthogProjectKey(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(POSTHOG_PROJECT_KEY_PREFIX);
}

/**
 * Removes accidental PostHog project API keys from event property bags.
 * PostHog JS also injects config.token into every capture payload; strip that at init via property_denylist.
 */
export function stripPhcTokenProperty(
  properties: Record<string, unknown>
): Record<string, unknown> {
  if (!('token' in properties)) {
    return properties;
  }

  const { token, ...rest } = properties;
  if (isPosthogProjectKey(token)) {
    return rest;
  }

  return properties;
}
