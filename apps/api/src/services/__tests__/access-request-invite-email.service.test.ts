import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accessRequestInviteEmailService,
  INVITE_EMAIL_AUDIT_ACTION,
  normalizeInviteRecipientEmail,
} from '@/services/access-request-invite-email.service.js';
import { prisma } from '@/lib/prisma';
import { isEmailDeliveryConfigured, sendEmail } from '@/services/email.service.js';
import { auditService } from '@/services/audit.service.js';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    accessRequest: { findUnique: vi.fn() },
    auditLog: { findFirst: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('@/services/email.service.js', () => ({
  isEmailDeliveryConfigured: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/services/audit.service.js', () => ({
  auditService: { createAuditLog: vi.fn() },
}));

vi.mock('@/lib/env.js', () => ({
  env: { RESEND_REPLY_TO_EMAIL: 'support@example.com', RESEND_FROM_EMAIL: undefined },
  frontendBaseUrl: () => 'https://app.example.com',
}));

const future = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

const baseRequest = () => ({
  id: 'req-1',
  agencyId: 'agency-1',
  status: 'pending',
  uniqueToken: 'tok-example',
  expiresAt: future(),
  platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads' }] }],
  agency: { name: 'Example Agency', email: 'owner@agency.example', notificationEmail: null },
});

const send = (overrides: Partial<Parameters<typeof accessRequestInviteEmailService.sendInviteEmail>[0]> = {}) =>
  accessRequestInviteEmailService.sendInviteEmail({
    accessRequestId: 'req-1',
    principalAgencyId: 'agency-1',
    recipientEmail: 'Client@Example.com ',
    senderEmail: 'user@agency.example',
    ...overrides,
  });

describe('accessRequestInviteEmailService.sendInviteEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(true);
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(baseRequest() as any);
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(sendEmail).mockResolvedValue({ data: { id: 'email-1' }, error: null } as any);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({ data: {} as any, error: null });
  });

  it('sends from "<Agency> via AuthHub" with reply-to the agency user and logs the send', async () => {
    const result = await send();

    expect(result.error).toBeNull();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        from: '"Example Agency via AuthHub" <notifications@notifications.authhub.co>',
        replyTo: 'user@agency.example',
        subject: 'Example Agency needs access to your Google accounts',
        idempotencyKey: expect.stringMatching(/^invite-email-req-1-[0-9a-f]{16}-\d+$/),
      })
    );
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain('https://app.example.com/invite/tok-example');
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        action: INVITE_EMAIL_AUDIT_ACTION,
        resourceId: 'req-1',
      })
    );
  });

  it('falls back to the agency notification email for reply-to when the user email is unknown', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      ...baseRequest(),
      agency: { name: 'Example Agency', email: 'owner@agency.example', notificationEmail: 'notify@agency.example' },
    } as any);

    await send({ senderEmail: undefined });

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'notify@agency.example' }));
  });

  it.each(['', 'not-an-email', 'a@b', 'x@example.com\r\nBcc: y@example.com', 'a,b@example.com', 42])(
    'rejects invalid recipient %j before touching the database',
    async (recipientEmail) => {
      const result = await send({ recipientEmail });
      expect(result.error?.code).toBe('INVALID_EMAIL');
      expect(prisma.accessRequest.findUnique).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    }
  );

  it('returns FORBIDDEN when the request belongs to another agency', async () => {
    const result = await send({ principalAgencyId: 'agency-other' });
    expect(result.error?.code).toBe('FORBIDDEN');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for an unknown request', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(null);
    expect((await send()).error?.code).toBe('NOT_FOUND');
  });

  it('refuses completed and expired requests', async () => {
    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({ ...baseRequest(), status: 'completed' } as any);
    expect((await send()).error?.code).toBe('INVALID_STATUS');

    vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
      ...baseRequest(),
      expiresAt: new Date(Date.now() - 1000),
    } as any);
    expect((await send()).error?.code).toBe('REQUEST_EXPIRED');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('enforces a per-request cooldown', async () => {
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({ createdAt: new Date(Date.now() - 20_000) } as any);
    const result = await send();
    expect(result.error?.code).toBe('INVITE_EMAIL_COOLDOWN');
    expect(result.error?.details?.retryAfterSeconds).toBeGreaterThan(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('enforces per-request daily and per-agency hourly caps', async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    expect((await send()).error?.code).toBe('INVITE_EMAIL_LIMIT');

    vi.mocked(prisma.auditLog.count).mockResolvedValueOnce(0).mockResolvedValueOnce(20);
    expect((await send()).error?.code).toBe('INVITE_EMAIL_LIMIT');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns EMAIL_NOT_CONFIGURED without Resend', async () => {
    vi.mocked(isEmailDeliveryConfigured).mockReturnValue(false);
    expect((await send()).error?.code).toBe('EMAIL_NOT_CONFIGURED');
  });

  it('maps provider failures to INVITE_EMAIL_DELIVERY_FAILED and does not log a send', async () => {
    vi.mocked(sendEmail).mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'bad' } } as any);
    const result = await send();
    expect(result.error?.code).toBe('INVITE_EMAIL_DELIVERY_FAILED');
    expect(auditService.createAuditLog).not.toHaveBeenCalled();
  });
});

describe('normalizeInviteRecipientEmail', () => {
  it('trims and lowercases valid addresses', () => {
    expect(normalizeInviteRecipientEmail('  Someone@Example.COM ')).toBe('someone@example.com');
  });
});
