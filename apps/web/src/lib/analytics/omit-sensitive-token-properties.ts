/** Remove caller-supplied bearer values before sending analytics. */
export function omitSensitiveTokenProperties(
  properties: Record<string, unknown>
): Record<string, unknown> {
  if (!('token' in properties) && !('access_request_token' in properties)) return properties;
  const { token: _token, access_request_token: _inviteToken, ...safeProperties } = properties;
  return safeProperties;
}
