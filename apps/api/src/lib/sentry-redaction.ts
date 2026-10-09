const SECRET_KEY = /^(?:authorization|cookie|set-cookie|x-api-key|access_token|refresh_token|access_request_token|oauth_access_token|page_access_token|fb_exchange_token|input_token|client_secret|appsecret_proof|app_secret_proof|signed_request|code|auth_code|oauth_code|state|oauth_state|token|invite)$/i;
const SECRET_QUERY = /(^|[?&])((?:access_token|refresh_token|access_request_token|fb_exchange_token|input_token|client_secret|appsecret_proof|signed_request|code|auth_code|state|token|invite)=)[^&#]*/gi;

const GRAPH_URL = /https?:\/\/graph\.facebook\.com[^\s"'<>)]*/gi;
const AD_ACCOUNT_ID = /\bact_\d+/gi;
const LONG_NUMERIC_SEGMENT = /\/\d{8,}(?=\/|$)/g;
const DROP_GRAPH_PARAMS = ['access_token', 'appsecret_proof', 'fb_exchange_token'] as const;

const LONG_NUMERIC_QUERY_VALUE = /(^|[?&])([^=&#?]+=)\d{8,}(?=&|#|$)/g;

function scrubGraphUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'graph.facebook.com') return url;
    for (const key of DROP_GRAPH_PARAMS) {
      parsed.searchParams.delete(key);
    }
    parsed.pathname = parsed.pathname.replace(LONG_NUMERIC_SEGMENT, '/[redacted]');
    return parsed.toString().replace(LONG_NUMERIC_QUERY_VALUE, '$1$2[redacted]');
  } catch {
    return url;
  }
}

/**
 * Meta Graph hygiene for Sentry: ad account ids (act_<digits>) are redacted everywhere,
 * and graph.facebook.com URLs lose access_token/appsecret_proof/fb_exchange_token params,
 * long numeric path segments (page, business and asset ids), and number-only query values
 * of 8+ digits (e.g. ids=...).
 */
export function scrubMetaGraphUrls(value: string): string {
  return value.replace(GRAPH_URL, scrubGraphUrl).replace(AD_ACCOUNT_ID, 'act_[redacted]');
}

const GRAPH_HOST = /\bgraph\.facebook\.com\b/i;
const GRAPH_DROP_QUERY = /(^|[?&])(?:access_token|appsecret_proof|fb_exchange_token)=[^&#]*/gi;

/**
 * Host-less URL parts that sit next to a Graph URL in span/breadcrumb data
 * (e.g. `url.path`, `http.query`): apply the same path and query hygiene.
 */
function scrubGraphUrlPart(value: string): string {
  const looksLikePath = value.startsWith('/');
  const looksLikeQuery = /^\??[^\s=&?#]+=[^\s]*$/.test(value);
  if (!looksLikePath && !looksLikeQuery) return value;
  const queryStart = value.search(/[?#]/);
  const path = looksLikePath ? (queryStart === -1 ? value : value.slice(0, queryStart)) : '';
  const rest = looksLikePath ? (queryStart === -1 ? '' : value.slice(queryStart)) : value;
  const cleanedRest = rest
    .replace(GRAPH_DROP_QUERY, (_match, sep: string) => sep)
    .replace(LONG_NUMERIC_QUERY_VALUE, '$1$2[redacted]')
    .replace(/([?&])&+/g, '$1')
    .replace(/[?&]+$/, '')
    .replace(/^&+/, '');
  return path.replace(LONG_NUMERIC_SEGMENT, '/[redacted]') + cleanedRest;
}

export function redactSensitiveString(value: string): string {
  return scrubMetaGraphUrls(value)
    .replace(/\/(client|access-requests|invite)\/[^/?#]+/gi, '/$1/[redacted]')
    .replace(SECRET_QUERY, '$1$2[redacted]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\bEA[A-Za-z0-9]{20,}\b/g, '[redacted]');
}

/** Sentry `beforeBreadcrumb` hook: keeps the breadcrumb, cleans its URL and data. */
export function scrubSentryBreadcrumb<T>(breadcrumb: T): T {
  return redactSentryEvent(breadcrumb);
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
    const entries = Object.entries(value);
    const graphContext = entries.some(
      ([, child]) => typeof child === 'string' && GRAPH_HOST.test(child)
    );
    for (const [key, child] of entries) {
      if (key === 'data' && value === request) continue;
      const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      if (SECRET_KEY.test(normalizedKey)) {
        result[key] = '[redacted]';
      } else if (graphContext && typeof child === 'string' && !GRAPH_HOST.test(child)) {
        result[key] = visit(scrubGraphUrlPart(child));
      } else {
        result[key] = visit(child);
      }
    }
    return result;
  };
  return visit(event) as T;
}
