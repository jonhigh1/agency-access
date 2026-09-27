import { describe, expect, it } from 'vitest';

import {
  INVITE_TOKEN_REDACTED_MARKER,
  redactInviteTokenFromString,
  sanitizeInviteTokenProperties,
} from '../sanitize-invite-token-properties';

/**
 * KTD13: the invite URL carries an anonymous bearer token on a logged-out
 * visit. PostHog autocapture sends $current_url/$pathname/$referrer verbatim,
 * so every URL-shaped string is scrubbed before an event leaves the client.
 *
 * Replacement shape (documented contract): the token segment becomes the
 * literal `[removed]` marker; path structure and query are preserved.
 */
describe('sanitizeInviteTokenProperties (KTD13)', () => {
  it('replaces the invite token segment in $current_url and keeps the query', () => {
    expect(
      sanitizeInviteTokenProperties({
        $current_url: 'https://authhub.co/invite/abc123?step=2',
      })
    ).toEqual({
      $current_url: `https://authhub.co/invite/${INVITE_TOKEN_REDACTED_MARKER}?step=2`,
    });
  });

  it('sanitizes $pathname and $referrer too', () => {
    expect(
      sanitizeInviteTokenProperties({
        $pathname: '/invite/abc123',
        $referrer: 'https://authhub.co/invite/abc123?view=connect',
      })
    ).toEqual({
      $pathname: `/invite/${INVITE_TOKEN_REDACTED_MARKER}`,
      $referrer: `https://authhub.co/invite/${INVITE_TOKEN_REDACTED_MARKER}?view=connect`,
    });
  });

  it('walks nested property objects such as $set', () => {
    expect(
      sanitizeInviteTokenProperties({
        $set: {
          $current_url: 'https://authhub.co/invite/abc123',
          $initial_pathname: '/invite/abc123',
        },
      })
    ).toEqual({
      $set: {
        $current_url: `https://authhub.co/invite/${INVITE_TOKEN_REDACTED_MARKER}`,
        $initial_pathname: `/invite/${INVITE_TOKEN_REDACTED_MARKER}`,
      },
    });
  });

  it('scrubs every segment after /invite/ generically, including nested route paths', () => {
    expect(
      redactInviteTokenFromString('https://authhub.co/invite/abc123/kit/manual?step=1')
    ).toBe(`https://authhub.co/invite/${INVITE_TOKEN_REDACTED_MARKER}/kit/manual?step=1`);
  });

  it('leaves non-invite URLs and plain copy untouched', () => {
    const properties = {
      $current_url: 'https://authhub.co/pricing?utm_source=x',
      reason: 'Select at least one ad account to continue',
      oauth_redirect: 'https://authhub.co/api/auth/callback?code=xyz',
    };
    expect(sanitizeInviteTokenProperties(properties)).toEqual(properties);
  });

  it('leaves non-string properties untouched', () => {
    const properties = {
      platform_count: 3,
      selection_required: true,
      null_value: null,
      platforms: ['meta_ads', 'google_ads'],
    };
    expect(sanitizeInviteTokenProperties(properties)).toEqual(properties);
  });

  it('scrubs invite URLs inside arrays', () => {
    expect(
      sanitizeInviteTokenProperties({
        pages: ['https://authhub.co/invite/abc123', 'https://authhub.co/pricing'],
      })
    ).toEqual({
      pages: [
        `https://authhub.co/invite/${INVITE_TOKEN_REDACTED_MARKER}`,
        'https://authhub.co/pricing',
      ],
    });
  });

  it('never throws on cyclic property values', () => {
    const cyclic: Record<string, unknown> = {
      $current_url: 'https://authhub.co/invite/abc123',
    };
    cyclic.self = cyclic;

    let output: Record<string, unknown> | undefined;
    expect(() => {
      output = sanitizeInviteTokenProperties(cyclic);
    }).not.toThrow();

    expect(output?.$current_url).toBe(
      `https://authhub.co/invite/${INVITE_TOKEN_REDACTED_MARKER}`
    );
  });

  it('does not mutate the caller-provided property bag', () => {
    const properties = { $current_url: 'https://authhub.co/invite/abc123' };
    sanitizeInviteTokenProperties(properties);

    expect(properties.$current_url).toBe('https://authhub.co/invite/abc123');
  });
});
