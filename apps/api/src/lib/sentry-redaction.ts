const SECRET_KEY = /^(?:authorization|cookie|set-cookie|x-api-key|access_token|refresh_token|access_request_token|oauth_access_token|page_access_token|fb_exchange_token|input_token|client_secret|appsecret_proof|app_secret_proof|signed_request|code|auth_code|oauth_code|state|oauth_state|token|invite)$/i;
const SECRET_QUERY = /(^|[?&])((?:access_token|refresh_token|access_request_token|fb_exchange_token|input_token|client_secret|appsecret_proof|signed_request|code|auth_code|state|token|invite)=)[^&#]*/gi;

export function redactSensitiveString(value: string): string {
  return value
    .replace(/\/(client|access-requests|invite)\/[^/?#]+/gi, '/$1/[redacted]')
    .replace(SECRET_QUERY, '$1$2[redacted]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\bEA[A-Za-z0-9]{20,}\b/g, '[redacted]');
}

export function redactSentryEvent<T>(event: T): T {
  const seen = new WeakMap<object, object>();
  const request = (event as { request?: unknown } | null)?.request;
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') return redactSensitiveString(value);
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      seen.set(value, result);
      for (const item of value) result.push(visit(item));
      return result;
    }
    const result: Record<string, unknown> = {};
    seen.set(value, result);
    for (const [key, child] of Object.entries(value)) {
      if (key === 'data' && value === request) continue;
      const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      result[key] = SECRET_KEY.test(normalizedKey) ? '[redacted]' : visit(child);
    }
    return result;
  };
  return visit(event) as T;
}
