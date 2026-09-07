import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: captureMock,
  },
}));

import {
  trackInviteLinkCopied,
  trackInviteOpened,
  trackInviteReminderSent,
  trackInviteSent,
} from '../invite-events';

describe('invite-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks invite_opened with access_request_token', () => {
    trackInviteOpened({
      access_request_token: 'tok-abc',
      access_request_id: 'req-1',
      status: 'pending',
      surface: 'invite_page',
    });

    expect(captureMock).toHaveBeenCalledWith('invite_opened', {
      access_request_token: 'tok-abc',
      access_request_id: 'req-1',
      status: 'pending',
      surface: 'invite_page',
    });
  });

  it('tracks invite_link_copied with surface', () => {
    trackInviteLinkCopied({
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      status: 'pending',
      surface: 'detail',
    });

    expect(captureMock).toHaveBeenCalledWith('invite_link_copied', {
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      status: 'pending',
      surface: 'detail',
    });
  });

  it('tracks invite_sent with channel', () => {
    trackInviteSent({
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      channel: 'email',
      surface: 'success',
    });

    expect(captureMock).toHaveBeenCalledWith('invite_sent', {
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      channel: 'email',
      surface: 'success',
    });
  });

  it('tracks invite_reminder_sent with channel', () => {
    trackInviteReminderSent({
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      status: 'pending',
      channel: 'copy',
      surface: 'detail',
    });

    expect(captureMock).toHaveBeenCalledWith('invite_reminder_sent', {
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      status: 'pending',
      channel: 'copy',
      surface: 'detail',
    });
  });
});
