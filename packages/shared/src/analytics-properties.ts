/** Scrub custom analytics properties and SDK URL metadata before ingestion. */
const PRIVATE_KEYS = new Set([
  'token', 'access_request_token', 'access_token', 'refresh_token', 'authorization',
  'code', 'auth_code', 'state', 'password', 'secret', 'signing_secret',
  'agency_name', 'client_name', 'client_email', 'email', 'user_email',
  'business_name', 'recipient_name', 'name', 'asset_name', 'asset_id',
  'business_id', 'template_name', 'agencyname', 'clientname', 'clientemail',
  'agencyemail', 'useremail', 'businessname', 'businessid', 'assetname', 'assetid',
  'accesstoken', 'refreshtoken', 'uniquetoken', 'collaboratorcode',
  'error_message', 'errormessage', 'search', '$title', '$initial_title',
]);

const REDACTED = '[removed]';

function scrubString(value: string): string {
  const redacted = value.replace(/\/invite\/(?!oauth-callback(?:[/?#\s]|$))[^/?#\s]+/g, `/invite/${REDACTED}`);
  // URL metadata may contain OAuth secrets on any callback, not just /invite.
  if (/^(https?:\/\/|\/)/i.test(redacted)) return redacted.split(/[?#]/, 1)[0];
  return redacted;
}

/**
 * SDK properties.token is its ingestion key. Preserve it only in the SDK hook,
 * never in caller-supplied custom properties. Cycles/deep values are omitted.
 */
export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
  preserveIngestionToken = false,
): Record<string, unknown> {
  const ancestors = new WeakSet<object>();
  function visit(value: unknown, depth: number): unknown {
    if (typeof value === 'string') return scrubString(value);
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (!value || typeof value !== 'object' || depth > 8 || ancestors.has(value)) return undefined;
    ancestors.add(value);
    let result: unknown;
    if (Array.isArray(value)) {
      result = value.map((item) => visit(item, depth + 1)).filter((item) => item !== undefined);
    } else {
      const output: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        if (PRIVATE_KEYS.has(key.toLowerCase()) && !(depth === 0 && key === 'token' && preserveIngestionToken)) continue;
        const sanitized = visit(entry, depth + 1);
        if (sanitized !== undefined) Object.defineProperty(output, key, { value: sanitized, enumerable: true });
      }
      result = output;
    }
    ancestors.delete(value);
    return result;
  }
  return visit(properties, 0) as Record<string, unknown>;
}
