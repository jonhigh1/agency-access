/** Property keys never sent to PostHog on invite_* / client_* events (defense in depth). */
export const POSTHOG_PII_PROPERTY_KEYS = [
  'agency_name',
  'client_name',
  'client_email',
  'email',
  'user_email',
  'business_name',
  'recipient_name',
  'name',
] as const;

export function stripPosthogPiiProperties(
  properties: Record<string, unknown>
): Record<string, unknown> {
  const rest = { ...properties };
  for (const key of POSTHOG_PII_PROPERTY_KEYS) {
    delete rest[key];
  }
  return rest;
}
