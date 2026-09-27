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
 * The scrub is generic: ANY string property whose value contains an
 * `/invite/<segment>` path is scrubbed, at any nesting depth, so newly added
 * URL-shaped PostHog properties are covered without per-field allowlists.
 */

export const INVITE_TOKEN_REDACTED_MARKER = '[removed]';

/**
 * Matches `/invite/` plus the token segment — everything up to the next path
 * separator, query, fragment, or whitespace. A bare `/invite/` with no segment
 * does not match, so there is nothing to leak.
 */
const INVITE_TOKEN_SEGMENT_PATTERN = /\/invite\/[^/?#\s]+/g;

export function redactInviteTokenFromString(value: string): string {
  return value.replace(
    INVITE_TOKEN_SEGMENT_PATTERN,
    `/invite/${INVITE_TOKEN_REDACTED_MARKER}`
  );
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
  return redactInviteTokensInValue(properties, 0, new WeakSet()) as Record<string, unknown>;
}
