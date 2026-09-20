import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/services/email.service';
import * as pgBoss from '@/lib/pg-boss';
import { onboardingEmailService } from '@/services/onboarding-email.service';

vi.mock('@/lib/env', () => ({
  env: {
    CLERK_SECRET_KEY: 'sk_test_secret_key',
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agency: {
      findUnique: vi.fn(),
    },
    accessRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/services/email.service', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/pg-boss', () => ({
  enqueueJob: vi.fn(),
}));

describe('onboardingEmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendEmail).mockResolvedValue({
      data: { id: 'email-1' },
      error: null,
    } as any);
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 1n } as any);
  });

  describe('queueSequenceStart', () => {
    it('queues the welcome sequence jobs with expected delays', async () => {
      await onboardingEmailService.queueSequenceStart({ agencyId: 'agency-1' });

      expect(pgBoss.enqueueJob).toHaveBeenCalledTimes(7);
      expect(pgBoss.enqueueJob).toHaveBeenCalledWith(
        'onboarding-email',
        expect.objectContaining({
          agencyId: 'agency-1',
          emailKey: 'welcome_first_step',
        }),
        expect.objectContaining({
          singletonKey: 'onboarding-email:agency-1:welcome_first_step',
          startAfter: 0,
        })
      );
      expect(pgBoss.enqueueJob).toHaveBeenCalledWith(
        'onboarding-email',
        expect.objectContaining({
          agencyId: 'agency-1',
          emailKey: 'get_to_first_link',
        }),
        expect.objectContaining({
          singletonKey: 'onboarding-email:agency-1:get_to_first_link',
          startAfter: 86400, // 24 hours in seconds
        })
      );
      expect(pgBoss.enqueueJob).toHaveBeenCalledWith(
        'onboarding-email',
        expect.objectContaining({
          agencyId: 'agency-1',
          emailKey: 'still_waiting_day14',
        }),
        expect.objectContaining({
          singletonKey: 'onboarding-email:agency-1:still_waiting_day14',
          startAfter: 14 * 86400,
        })
      );
      expect(pgBoss.enqueueJob).toHaveBeenCalledWith(
        'onboarding-email',
        expect.objectContaining({
          agencyId: 'agency-1',
          emailKey: 'one_client_day30',
        }),
        expect.objectContaining({
          singletonKey: 'onboarding-email:agency-1:one_client_day30',
          startAfter: 30 * 86400,
        })
      );
      expect(pgBoss.enqueueJob).toHaveBeenCalledWith(
        'onboarding-email',
        expect.objectContaining({
          agencyId: 'agency-1',
          emailKey: 'closing_the_loop_day60',
        }),
        expect.objectContaining({
          singletonKey: 'onboarding-email:agency-1:closing_the_loop_day60',
          startAfter: 60 * 86400,
        })
      );
    });
  });

  describe('sendOnboardingEmail', () => {
    it('sends the welcome email when the agency exists', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        name: 'Northstar',
        email: 'owner@northstar.co',
        settings: {},
        accessRequests: [],
      } as any);

      const result = await onboardingEmailService.sendOnboardingEmail({
        agencyId: 'agency-1',
        emailKey: 'welcome_first_step',
      });

      expect(result.error).toBeNull();
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'owner@northstar.co',
        subject: 'Your client access flow starts here',
      }));
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          agencyId: 'agency-1',
          action: 'ONBOARDING_EMAIL_SENT',
        }),
      }));
    });

    it('skips the first-link reminder once the agency already has a request', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        name: 'Northstar',
        email: 'owner@northstar.co',
        settings: {},
        accessRequests: [{ id: 'req-1' }],
      } as any);

      const result = await onboardingEmailService.sendOnboardingEmail({
        agencyId: 'agency-1',
        emailKey: 'get_to_first_link',
      });

      expect(result.data).toEqual({ skipped: true, reason: 'already_activated' });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('sends the link follow-up when the access request is still pending', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        name: 'Northstar',
        email: 'owner@northstar.co',
        settings: {},
        accessRequests: [{ id: 'req-1' }],
      } as any);
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        clientName: 'Acme',
        uniqueToken: 'token-123',
      } as any);

      const result = await onboardingEmailService.sendOnboardingEmail({
        agencyId: 'agency-1',
        accessRequestId: 'req-1',
        emailKey: 'send_the_link',
      });

      expect(result.error).toBeNull();
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'owner@northstar.co',
        subject: 'Your access link is ready to send',
      }));
    });

    it('sends the fallback check-in when no request exists yet', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        name: 'Northstar',
        email: 'owner@northstar.co',
        settings: {},
        accessRequests: [],
      } as any);
      vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);

      const result = await onboardingEmailService.sendOnboardingEmail({
        agencyId: 'agency-1',
        emailKey: 'track_status_keep_momentum',
      });

      expect(result.error).toBeNull();
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'Need help getting your first request live?',
      }));
    });

    describe('churned re-engagement sequence', () => {
      const dormantAgency = {
        id: 'agency-1',
        name: 'Northstar',
        email: 'owner@northstar.co',
        settings: {},
        accessRequests: [],
      };

      it('sends the day-14 email to a dormant agency', async () => {
        vi.mocked(prisma.agency.findUnique).mockResolvedValue(dormantAgency as any);

        const result = await onboardingEmailService.sendOnboardingEmail({
          agencyId: 'agency-1',
          emailKey: 'still_waiting_day14',
        });

        expect(result.error).toBeNull();
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
          to: 'owner@northstar.co',
          subject: 'The part where most agencies get stuck',
        }));
      });

      it('sends the day-30 email to a dormant agency', async () => {
        vi.mocked(prisma.agency.findUnique).mockResolvedValue(dormantAgency as any);

        const result = await onboardingEmailService.sendOnboardingEmail({
          agencyId: 'agency-1',
          emailKey: 'one_client_day30',
        });

        expect(result.error).toBeNull();
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
          subject: 'Five minutes, one client, done',
        }));
      });

      it('sends the day-60 closing email to a dormant agency', async () => {
        vi.mocked(prisma.agency.findUnique).mockResolvedValue(dormantAgency as any);

        const result = await onboardingEmailService.sendOnboardingEmail({
          agencyId: 'agency-1',
          emailKey: 'closing_the_loop_day60',
        });

        expect(result.error).toBeNull();
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
          subject: 'Before we stop emailing you',
        }));
      });

      it.each(['still_waiting_day14', 'one_client_day30', 'closing_the_loop_day60'] as const)(
        'skips %s once the agency activated',
        async (emailKey) => {
          vi.mocked(prisma.agency.findUnique).mockResolvedValue({
            ...dormantAgency,
            accessRequests: [{ id: 'req-1' }],
          } as any);

          const result = await onboardingEmailService.sendOnboardingEmail({
            agencyId: 'agency-1',
            emailKey,
          });

          expect(result.data).toEqual({ skipped: true, reason: 'already_activated' });
          expect(sendEmail).not.toHaveBeenCalled();
        }
      );

      it.each(['still_waiting_day14', 'one_client_day30', 'closing_the_loop_day60'] as const)(
        'skips %s when the agency opted out',
        async (emailKey) => {
          vi.mocked(prisma.agency.findUnique).mockResolvedValue(dormantAgency as any);
          vi.mocked(prisma.auditLog.findFirst).mockImplementation(async (args: any) => {
            if (args?.where?.action === 'CHURN_OPTOUT') {
              return { id: 1n } as any;
            }
            return null;
          });

          const result = await onboardingEmailService.sendOnboardingEmail({
            agencyId: 'agency-1',
            emailKey,
          });

          expect(result.data).toEqual({ skipped: true, reason: 'churn_optout' });
          expect(sendEmail).not.toHaveBeenCalled();
        }
      );

      it('records a churn opt-out', async () => {
        const result = await onboardingEmailService.recordChurnOptOut({ agencyId: 'agency-1' });

        expect(result.error).toBeNull();
        expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({
            agencyId: 'agency-1',
            action: 'CHURN_OPTOUT',
            resourceType: 'onboarding_email',
          }),
        }));
      });
    });
  });
});
