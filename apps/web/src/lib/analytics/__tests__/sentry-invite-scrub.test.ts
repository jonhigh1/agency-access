import { describe, expect, it } from 'vitest';

import {
  INVITE_TOKEN_REDACTED_MARKER,
  redactInviteTokensDeep,
  shouldRecordInviteReplay,
} from '../sanitize-invite-token-properties';

/**
 * KTD13 covers the error-reporting sink too: Sentry error events and session
 * replays must never carry the anonymous invite bearer token. `beforeSend`
 * walks the event through the same deep redaction the PostHog hook uses, and
 * replay capture stays off while the visitor is on an invite route.
 */
describe('Sentry invite-token scrub (KTD13)', () => {
  const tokenUrl = `https://authhub.co/invite/${INVITE_TOKEN_REDACTED_MARKER}/assets`;

  it('redacts the invite token from the event request URL', () => {
    const event = {
      request: { url: 'https://authhub.co/invite/secret-token-123/assets?step=2' },
      exception: { values: [{ type: 'Error', value: 'boom' }] },
    };

    const scrubbed = redactInviteTokensDeep(event) as typeof event;

    expect(scrubbed.request.url).toBe(`${tokenUrl}?step=2`);
    expect(scrubbed.exception.values[0].value).toBe('boom');
  });

  it('redacts invite tokens inside breadcrumbs and extra without mutating the event', () => {
    const event = {
      breadcrumbs: [
        { to: '/invite/secret-token-123/share', category: 'navigation' },
        { message: 'failed https://authhub.co/invite/secret-token-123?step=2', category: 'fetch' },
      ],
      extra: { page: '/invite/secret-token-123' },
    };

    const scrubbed = redactInviteTokensDeep(event) as typeof event;

    expect(scrubbed.breadcrumbs[0].to).toBe(`/invite/${INVITE_TOKEN_REDACTED_MARKER}/share`);
    expect(scrubbed.breadcrumbs[1].message).toBe(
      `failed https://authhub.co/invite/${INVITE_TOKEN_REDACTED_MARKER}?step=2`
    );
    expect(scrubbed.extra.page).toBe(`/invite/${INVITE_TOKEN_REDACTED_MARKER}`);
    expect(event.breadcrumbs[0].to).toBe('/invite/secret-token-123/share');
  });

  it('returns the same reference when nothing invite-shaped is present', () => {
    const event = { request: { url: 'https://authhub.co/dashboard' }, extra: { a: 1 } };
    expect(redactInviteTokensDeep(event)).toBe(event);
  });

  it('never records replays on invite routes', () => {
    expect(shouldRecordInviteReplay('/invite/secret-token-123')).toBe(false);
    expect(shouldRecordInviteReplay('/invite/secret-token-123/kit/manual')).toBe(false);
    expect(shouldRecordInviteReplay('/invite/oauth-callback')).toBe(false);
  });

  it('records replays everywhere else', () => {
    expect(shouldRecordInviteReplay('/dashboard')).toBe(true);
    expect(shouldRecordInviteReplay('/')).toBe(true);
    expect(shouldRecordInviteReplay('/platforms/callback')).toBe(true);
  });

  it('keeps lookalike routes out of the invite gate', () => {
    expect(shouldRecordInviteReplay('/invites/legacy')).toBe(true);
    expect(shouldRecordInviteReplay('/platforms/invite/other')).toBe(true);
  });
});
