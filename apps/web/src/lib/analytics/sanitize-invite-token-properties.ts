/**
 * Invite-token URL scrubber for analytics (KTD13).
 *
 * The invite flow is anonymous bearer-token by design: the token is a path
 * segment of every invite page URL on a logged-out visit. PostHog autocapture
 * and pageviews send `$current_url`, `$pathname`, and `$referrer` verbatim, so
 * the token must be replaced before any event leaves the client.
 *
 * Replacement shape (documented contract): the token segment becomes the
 * literal `[removed]` marker and the rest of the URL is preserved, so funnel
 * analysis can still tell which step a pageview came from:
 *
 *   https://authhub.co/invite/abc123?step=2
 *     -> https://authhub.co/invite/[removed]?step=2
 *   https://authhub.co/invite/abc123/kit/manual
 *     -> https://authhub.co/invite/[removed]/kit/manual
 *
 * OAuth secrets ride as query parameters on the invite OAuth return URL
 * (`/invite/oauth-callback?code=...&state=...`), so those parameters are
 * redacted on invite URLs too. Only `/invite` strings are touched; OAuth
 * callbacks outside the invite tree keep their query strings.
 *
 * The scrub is generic: ANY string property whose value contains an
 * `/invite/` path is scrubbed, at any nesting depth, so newly added
 * URL-shaped analytics properties (PostHog and Sentry both) are covered
 * without per-field allowlists.
 */

export const INVITE_TOKEN_REDACTED_MARKER = '[removed]';

/**
 * Matches `/invite/` plus the token segment — everything up to the next path
 * separator, query, fragment, or whitespace. A bare `/invite/` with no segment
 * does not match, so there is nothing to leak. The fixed `oauth-callback`
 * route segment is exempt: it is a route name, not a secret, and keeping it
 * lets funnel analysis tell the OAuth return apart from tokened pages.
 */
const INVITE_TOKEN_SEGMENT_PATTERN =
  /\/invite\/(?!oauth-callback(?:[/?#\s]|$))[^/?#\s]+/g;

/**
 * Matches the OAuth secret query parameters the callback URL carries, keeping
 * the parameter name and any following query or fragment intact. A plain
 * `state=` field on a form string would only be touched inside an `/invite`
 * URL, which never carries a form value by that name.
 */
const OAUTH_SECRET_PARAMS_PATTERN = /([?&])(code|auth_code|state)=([^&#\s]*)/g;

export function redactInviteTokenFromString(value: string): string {
  if (!value.includes('/invite/')) return value;
  return value
    .replace(INVITE_TOKEN_SEGMENT_PATTERN, `/invite/${INVITE_TOKEN_REDACTED_MARKER}`)
    .replace(
      OAUTH_SECRET_PARAMS_PATTERN,
      `$1$2=${INVITE_TOKEN_REDACTED_MARKER}`
    );
}

/**
 * True only when replay capture may run for this path. Session replays record
 * the URL bar verbatim, so the whole `/invite` tree — the tokened pages and
 * the oauth-callback sibling alike — stays out of replay capture.
 */
export function shouldRecordInviteReplay(pathname: string): boolean {
  return !(pathname === '/invite' || pathname.startsWith('/invite/'));
}

/** Property bags are shallow JSON shapes; the cap bounds pathological input. */
const MAX_SANITIZE_DEPTH = 8;

/**
 * Returns the input reference unchanged when nothing redacted (the common
 * case on every non-invite event) so the analytics hot path allocates nothing;
 * a new container only when a string actually changed.
 */
function redactInviteTokensInValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return value.includes('/invite/')
      ? redactInviteTokenFromString(value)
      : value;
  }
  if (!value || typeof value !== 'object' || depth >= MAX_SANITIZE_DEPTH) {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    let changed = false;
    const output: unknown[] = new Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      output[index] = redactInviteTokensInValue(value[index], depth + 1, seen);
      if (output[index] !== value[index]) changed = true;
    }
    return changed ? output : value;
  }

  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  let changed = false;
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    output[key] = redactInviteTokensInValue(source[key], depth + 1, seen);
    if (output[key] !== source[key]) changed = true;
  }
  return changed ? output : source;
}

/**
 * PostHog `sanitize_properties` hook. Returns a scrubbed copy when any invite
 * token was found; otherwise the original reference (PostHog only reads the
 * returned object, so same-reference is the no-change signal). The caller's
 * object is never mutated. Applied to every captured event (pageviews,
 * autocapture, and explicit captures) via posthog.init.
 */
export function sanitizeInviteTokenProperties(
  properties: Record<string, unknown>
): Record<string, unknown> {
  return redactInviteTokensDeep(properties);
}

/**
 * Deep redaction for any analytics payload — the Sentry `beforeSend` hook
 * uses the same walk for error events, breadcrumbs, and extras. Same-reference
 * return when nothing invite-shaped was present.
 */
export function redactInviteTokensDeep<T>(value: T): T {
  return redactInviteTokensInValue(value, 0, new WeakSet()) as T;
}
