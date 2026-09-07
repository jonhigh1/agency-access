import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildInviteReminderMailto,
  buildInviteSentMailto,
  trackInviteOpenedOncePerSession,
} from '../invite-events';

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: captureMock,
  },
}));

describe('invite-events helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('tracks invite_opened only once per session token', () => {
    trackInviteOpenedOncePerSession({
      access_request_token: 'tok-1',
      surface: 'invite_page',
    });
    trackInviteOpenedOncePerSession({
      access_request_token: 'tok-1',
      surface: 'invite_page',
    });

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith('invite_opened', {
      access_request_token: 'tok-1',
      surface: 'invite_page',
    });
  });

  it('builds honest reminder mailto copy', () => {
    const href = buildInviteReminderMailto({
      clientEmail: 'client@example.com',
      clientName: 'Acme',
      authorizationUrl: 'https://app.authhub.co/invite/tok-1',
      expirationText: 'March 14, 2026',
    });

    expect(href).toContain('mailto:client%40example.com');
    expect(decodeURIComponent(href)).toContain('when you\'re ready');
    expect(decodeURIComponent(href)).toContain('only receive access tokens after you finish');
  });

  it('builds honest initial send mailto copy', () => {
    const href = buildInviteSentMailto({
      clientEmail: 'client@example.com',
      clientName: 'Acme',
      authorizationUrl: 'https://app.authhub.co/invite/tok-1',
    });

    expect(decodeURIComponent(href)).toContain('When you\'re ready');
    expect(decodeURIComponent(href)).toContain('Tokens are issued only after you complete authorization');
  });
});
