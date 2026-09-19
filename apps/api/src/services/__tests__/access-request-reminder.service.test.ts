import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessRequestReminderService } from '@/services/access-request-reminder.service.js';
import { prisma } from '@/lib/prisma';
import {
  isEmailDeliveryConfigured,
  sendClientInviteReminderEmail,
} from '@/services/email.service.js';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    accessRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/services/email.service.js', () => ({
  isEmailDeliveryConfigured: vi.fn(),
  sendClientInviteReminderEmail: vi.fn(),
}));

vi.mock('@/lib/env.js', () => ({
  env: {
    RESEND_REPLY_TO_EMAIL: 'support@authhub.co',
  },
  frontendBaseUrl: () => 'https://app.example.com',
}));

const baseRequest = {
  id: 'req-1',
  agencyId: 'agency-1',
  clientName: 'Jamie Client',
  clientEmail: 'jamie@client.com',
  status: 'pending',
  uniqueToken: 'tok-abc',
  expiresAt: new Date('2026-10-01T00:00:00.000Z'),
  lastReminderSentAt: null as Date | null,
  agency: {
    id: 'agency-1',
    name: 'Acme Agency',
    email: 'team@acme.com',
    notificationEmail: 'notify@acme.com',
  },
};

describe('accessRequestReminderService.sendInviteReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(true);
    vi.mocked(sendClientInviteReminderEmail).mockResolvedValue({
      data: { id: 'email-1' },
      error: null,
    } as any);
    vi.mocked(prisma.accessRequest.update).mockResolvedValue({} as any);
  });

  it('sends reminder email and updates lastReminderSentAt on happy path', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(baseRequest as any);

    const result = await accessRequestReminderService.sendInviteReminder('req-1');

    expect(result.error).toBeNull();
    expect(sendClientInviteReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jamie@client.com',
        replyTo: 'notify@acme.com',
        authorizationUrl: 'https://app.example.com/invite/tok-abc',
        idempotencyKey: expect.stringMatching(/^invite-reminder-req-1-/),
      })
    );
    expect(prisma.accessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: expect.objectContaining({ lastReminderSentAt: expect.any(Date) }),
      })
    );
  });

  it('returns EMAIL_NOT_CONFIGURED when Resend is not configured', async () => {
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(false);

    const result = await accessRequestReminderService.sendInviteReminder('req-1');

    expect(result).toEqual({
      data: null,
      error: expect.objectContaining({ code: 'EMAIL_NOT_CONFIGURED' }),
    });
    expect(prisma.accessRequest.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-awaiting statuses', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      ...baseRequest,
      status: 'completed',
    } as any);

    const result = await accessRequestReminderService.sendInviteReminder('req-1');

    expect(result.error?.code).toBe('INVALID_STATUS');
    expect(sendClientInviteReminderEmail).not.toHaveBeenCalled();
  });

  it('returns REMINDER_COOLDOWN when a reminder was sent within the hour', async () => {
    const recent = new Date(Date.now() - 15 * 60 * 1000);
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      ...baseRequest,
      lastReminderSentAt: recent,
    } as any);

    const result = await accessRequestReminderService.sendInviteReminder('req-1');

    expect(result.error?.code).toBe('REMINDER_COOLDOWN');
    expect(result.error?.details).toEqual(
      expect.objectContaining({
        retryAfter: expect.any(String),
        retryAfterSeconds: expect.any(Number),
      })
    );
    expect(sendClientInviteReminderEmail).not.toHaveBeenCalled();
  });

  it('returns MISSING_CLIENT_EMAIL when client email is blank', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      ...baseRequest,
      clientEmail: '   ',
    } as any);

    const result = await accessRequestReminderService.sendInviteReminder('req-1');

    expect(result.error?.code).toBe('MISSING_CLIENT_EMAIL');
  });

  it('maps provider RESEND_NOT_CONFIGURED to EMAIL_NOT_CONFIGURED', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(baseRequest as any);
    vi.mocked(sendClientInviteReminderEmail).mockResolvedValue({
      data: null,
      error: { code: 'RESEND_NOT_CONFIGURED', message: 'missing key' },
    } as any);

    const result = await accessRequestReminderService.sendInviteReminder('req-1');

    expect(result.error?.code).toBe('EMAIL_NOT_CONFIGURED');
    expect(prisma.accessRequest.update).not.toHaveBeenCalled();
  });
});
