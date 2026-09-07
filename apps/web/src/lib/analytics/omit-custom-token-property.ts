/**
 * PostHog JS injects `properties.token` (the phc_ project API key) on every capture
 * for ingestion auth. That system field must not be stripped — see instrumentation-client.ts.
 *
 * App code must never pass a custom `token` property; use `access_request_token` instead.
 */
export function omitCustomTokenProperty(
  properties: Record<string, unknown>
): Record<string, unknown> {
  if (!('token' in properties)) {
    return properties;
  }

  const { token: _token, ...rest } = properties;
  return rest;
}
