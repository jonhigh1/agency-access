import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSendInviteReminder } from '@/lib/invite-reminder';
import * as accessRequestsApi from '@/lib/api/access-requests';
import * as inviteEvents from '@/lib/analytics/invite-events';

vi.mock('@/lib/api/access-requests', () => ({
  sendAccessRequestReminder: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  buildInviteReminderMailto: vi.fn(() => 'mailto:fallback@example.com'),
  trackInviteReminderSent: vi.fn(),
}));

describe('executeSendInviteReminder', () => {
  const locationAssign = vi.fn();
  const copyReminderLink = vi.fn().mockResolvedValue(undefined);
  const getToken = vi.fn().mockResolvedValue('token');

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: locationAssign },
    });
  });

  it('tracks email channel when API send succeeds', async () => {
    vi.mocked(accessRequestsApi.sendAccessRequestReminder).mockResolvedValue({
      data: {
        accessRequestId: 'req-1',
        sentAt: '2026-09-19T12:00:00.000Z',
        recipientEmail: 'client@example.com',
      },
    });

    const result = await executeSendInviteReminder({
      accessRequestId: 'req-1',
      accessRequestToken: 'tok',
      status: 'pending',
      surface: 'detail',
      clientEmail: 'client@example.com',
      clientName: 'Client',
      authorizationUrl: 'https://authhub.co/invite/tok',
      getToken,
      copyReminderLink,
    });

    expect(result.outcome).toBe('sent');
    expect(inviteEvents.trackInviteReminderSent).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email' })
    );
    expect(locationAssign).not.toHaveBeenCalled();
  });

  it('returns cooldown without opening mailto', async () => {
    vi.mocked(accessRequestsApi.sendAccessRequestReminder).mockResolvedValue({
      error: {
        code: 'REMINDER_COOLDOWN',
        message: 'Too soon',
        details: { retryAfter: '2026-09-19T13:00:00.000Z' },
      },
    });

    const result = await executeSendInviteReminder({
      accessRequestId: 'req-1',
      accessRequestToken: 'tok',
      status: 'pending',
      surface: 'dashboard',
      clientEmail: 'client@example.com',
      clientName: 'Client',
      authorizationUrl: 'https://authhub.co/invite/tok',
      getToken,
      copyReminderLink,
    });

    expect(result.outcome).toBe('cooldown');
    expect(locationAssign).not.toHaveBeenCalled();
    expect(inviteEvents.trackInviteReminderSent).not.toHaveBeenCalled();
  });

  it('falls back to mailto when email is not configured', async () => {
    vi.mocked(accessRequestsApi.sendAccessRequestReminder).mockResolvedValue({
      error: { code: 'EMAIL_NOT_CONFIGURED', message: 'Not configured' },
    });

    const result = await executeSendInviteReminder({
      accessRequestId: 'req-1',
      accessRequestToken: 'tok',
      status: 'pending',
      surface: 'detail',
      clientEmail: 'client@example.com',
      clientName: 'Client',
      authorizationUrl: 'https://authhub.co/invite/tok',
      getToken,
      copyReminderLink,
    });

    expect(result.outcome).toBe('fallback_mailto');
    expect(locationAssign).toHaveBeenCalledWith('mailto:fallback@example.com');
    expect(inviteEvents.trackInviteReminderSent).not.toHaveBeenCalled();
  });
});
