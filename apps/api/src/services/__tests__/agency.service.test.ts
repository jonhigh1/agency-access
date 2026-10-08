/**
 * Agency Service Unit Tests
 *
 * Tests for agency CRUD operations and member management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import * as agencyService from '@/services/agency.service';
import { onboardingEmailService } from '@/services/onboarding-email.service';
import { affiliateService } from '@/services/affiliate.service';
import { creem } from '@/lib/creem';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agency: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    agencyMember: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/services/onboarding-email.service', () => ({
  onboardingEmailService: {
    queueSequenceStart: vi.fn(),
    queueActivatedFollowUp: vi.fn(),
  },
}));

vi.mock('@/services/affiliate.service', () => ({
  affiliateService: {
    claimReferralForAgency: vi.fn(),
  },
}));

vi.mock('@/lib/creem', () => ({
  creem: {
    createCheckoutSession: vi.fn(),
  },
}));

describe('AgencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(affiliateService.claimReferralForAgency).mockResolvedValue({
      data: { id: 'referral-1', status: 'attributed' },
      error: null,
    });
  });

  describe('createAgency', () => {
    it('should create a new agency with admin member', async () => {
      const mockAgency = {
        id: 'agency-1',
        name: 'Test Agency',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMember = {
        id: 'member-1',
        agencyId: 'agency-1',
        email: 'admin@test.com',
        role: 'admin',
        createdAt: new Date(),
      };

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          agency: {
            create: vi.fn().mockResolvedValue(mockAgency),
          },
          agencyMember: {
            create: vi.fn().mockResolvedValue(mockMember),
          },
        } as any);
      });

      const result = await agencyService.createAgency({
        name: 'Test Agency',
        email: 'admin@test.com',
        clerkUserId: 'user_123',
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockAgency);
      expect(onboardingEmailService.queueSequenceStart).toHaveBeenCalledWith({
        agencyId: 'agency-1',
      });
    });

    it('should return error for invalid input', async () => {
      const result = await agencyService.createAgency({
        name: '', // Invalid - empty name
        email: 'invalid-email', // Invalid email
      });

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return error if agency email already exists', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'existing-agency',
        name: 'Test Agency',
        email: 'admin@test.com',
      } as any);

      const result = await agencyService.createAgency({
        name: 'Test Agency',
        email: 'admin@test.com',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('AGENCY_EXISTS');
    });

    it('should allow duplicate agency display names', async () => {
      const mockAgency = {
        id: 'agency-2',
        name: 'Northstar Growth',
        email: 'team2@example.com',
      };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          agency: {
            create: vi.fn().mockResolvedValue(mockAgency),
          },
          agencyMember: {
            create: vi.fn().mockResolvedValue({
              id: 'member-2',
              agencyId: 'agency-2',
              email: 'team2@example.com',
              role: 'admin',
            }),
          },
        } as any);
      });

      const result = await agencyService.createAgency({
        name: 'Northstar Growth',
        email: 'team2@example.com',
      });

      expect(result.error).toBeNull();
      expect(result.data?.name).toBe('Northstar Growth');
      expect(prisma.agency.findFirst).not.toHaveBeenCalled();
    });

    it('should default subscriptionTier to null for free agencies', async () => {
      const mockAgency = {
        id: 'agency-1',
        name: 'Test Agency',
      };
      const agencyCreate = vi.fn().mockResolvedValue(mockAgency);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.agency.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          agency: {
            create: agencyCreate,
          },
          agencyMember: {
            create: vi.fn().mockResolvedValue({
              id: 'member-1',
              agencyId: 'agency-1',
              email: 'admin@test.com',
              role: 'admin',
            }),
          },
        } as any);
      });

      await agencyService.createAgency({
        name: 'Test Agency',
        email: 'admin@test.com',
      });

      expect(agencyCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subscriptionTier: null,
        }),
      });
    });

    it('claims affiliate referral when an affiliate click token is provided', async () => {
      const mockAgency = {
        id: 'agency-1',
        name: 'Test Agency',
      };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.agency.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          agency: {
            create: vi.fn().mockResolvedValue(mockAgency),
          },
          agencyMember: {
            create: vi.fn().mockResolvedValue({
              id: 'member-1',
              agencyId: 'agency-1',
              email: 'admin@test.com',
              role: 'admin',
            }),
          },
        } as any);
      });

      const result = await agencyService.createAgency({
        name: 'Test Agency',
        email: 'admin@test.com',
        affiliateClickToken: 'click_123',
      });

      expect(result.error).toBeNull();
      expect(affiliateService.claimReferralForAgency).toHaveBeenCalledWith({
        clickToken: 'click_123',
        agencyId: 'agency-1',
        agencyEmail: 'admin@test.com',
      });
    });
  });

  describe('createAgencyWithCheckout', () => {
    it('claims affiliate referral after creating an agency checkout', async () => {
      const mockAgency = {
        id: 'agency-1',
        name: 'Test Agency',
        email: 'admin@test.com',
      };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.agency.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          agency: {
            create: vi.fn().mockResolvedValue(mockAgency),
          },
          agencyMember: {
            create: vi.fn().mockResolvedValue({
              id: 'member-1',
              agencyId: 'agency-1',
              email: 'admin@test.com',
              role: 'admin',
            }),
          },
        } as any);
      });

      vi.mocked(creem.createCheckoutSession).mockResolvedValue({
        data: { url: 'https://checkout.creem.io/test' },
        error: null,
      } as any);

      const result = await agencyService.createAgencyWithCheckout({
        clerkUserId: 'user_123',
        name: 'Test Agency',
        email: 'admin@test.com',
        selectedTier: 'STARTER',
        billingInterval: 'monthly',
        affiliateClickToken: 'click_123',
      });

      expect(result.error).toBeNull();
      expect(affiliateService.claimReferralForAgency).toHaveBeenCalledWith({
        clickToken: 'click_123',
        agencyId: 'agency-1',
        agencyEmail: 'admin@test.com',
      });
    });
  });

  describe('getAgency', () => {
    it('should return agency by id', async () => {
      const mockAgency = {
        id: 'agency-1',
        name: 'Test Agency',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(mockAgency as any);

      const result = await agencyService.getAgency('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockAgency);
    });

    it('should return error if agency not found', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);

      const result = await agencyService.getAgency('non-existent');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('AGENCY_NOT_FOUND');
    });
  });

  describe('inviteMember', () => {
    it('should invite a new member to agency', async () => {
      const mockMember = {
        id: 'member-2',
        agencyId: 'agency-1',
        email: 'member@test.com',
        role: 'member',
        createdAt: new Date(),
      };

      vi.mocked(prisma.agencyMember.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.agencyMember.create).mockResolvedValue(mockMember as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ id: 'agency-1' } as any);

      const result = await agencyService.inviteMember('agency-1', {
        email: 'member@test.com',
        role: 'member',
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockMember);
    });

    it('should return error if member already exists', async () => {
      vi.mocked(prisma.agencyMember.findFirst).mockResolvedValue({
        id: 'existing-member',
        email: 'member@test.com',
      });

      const result = await agencyService.inviteMember('agency-1', {
        email: 'member@test.com',
        role: 'member',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('MEMBER_EXISTS');
    });

    it('should return error for invalid email', async () => {
      const result = await agencyService.inviteMember('agency-1', {
        email: 'invalid-email',
        role: 'member',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const mockMember = {
        id: 'member-1',
        agencyId: 'agency-1',
        email: 'member@test.com',
        role: 'admin',
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agencyMember.update).mockResolvedValue(mockMember as any);

      const result = await agencyService.updateMemberRole('member-1', 'admin');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockMember);
    });

    it('should return error for invalid role', async () => {
      const result = await agencyService.updateMemberRole('member-1', 'invalid-role' as any);

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent changing last admin to member', async () => {
      vi.mocked(prisma.agencyMember.count).mockResolvedValue(1); // Only 1 admin
      vi.mocked(prisma.agencyMember.findFirst).mockResolvedValue({
        id: 'member-1',
        role: 'admin',
      });

      const result = await agencyService.updateMemberRole('member-1', 'member');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('LAST_ADMIN');
    });
  });

  describe('removeMember', () => {
    it('should remove member from agency', async () => {
      const mockMember = {
        id: 'member-1',
        email: 'member@test.com',
        role: 'member',
      };

      vi.mocked(prisma.agencyMember.findFirst).mockResolvedValue(mockMember as any);
      vi.mocked(prisma.agencyMember.delete).mockResolvedValue(mockMember as any);

      const result = await agencyService.removeMember('member-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockMember);
    });

    it('should prevent removing last admin', async () => {
      vi.mocked(prisma.agencyMember.count).mockResolvedValue(1); // Only 1 admin
      vi.mocked(prisma.agencyMember.findFirst).mockResolvedValue({
        id: 'member-1',
        role: 'admin',
      });

      const result = await agencyService.removeMember('member-1');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('LAST_ADMIN');
    });
  });

  describe('getAgencyMembers', () => {
    it('should return all members of an agency', async () => {
      const mockMembers = [
        { id: 'member-1', email: 'admin@test.com', role: 'admin' },
        { id: 'member-2', email: 'member@test.com', role: 'member' },
      ];

      vi.mocked(prisma.agencyMember.findMany).mockResolvedValue(mockMembers as any);

      const result = await agencyService.getAgencyMembers('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockMembers);
    });
  });

  describe('scoped member mutation helpers', () => {
    it('should reject role updates for members outside principal agency', async () => {
      vi.mocked(prisma.agencyMember.findFirst).mockResolvedValue({
        id: 'member-1',
        agencyId: 'agency-other',
        role: 'member',
      } as any);

      const result = await agencyService.updateMemberRoleForAgency('member-1', 'agency-owner', 'admin');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('FORBIDDEN');
      expect(prisma.agencyMember.update).not.toHaveBeenCalled();
    });

    it('should reject member removal for members outside principal agency', async () => {
      vi.mocked(prisma.agencyMember.findFirst).mockResolvedValue({
        id: 'member-1',
        agencyId: 'agency-other',
        role: 'member',
      } as any);

      const result = await agencyService.removeMemberForAgency('member-1', 'agency-owner');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('FORBIDDEN');
      expect(prisma.agencyMember.delete).not.toHaveBeenCalled();
    });
  });

  describe('onboarding lifecycle', () => {
    it('derives onboarding flags from relation counts without loading relation arrays', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        name: 'Agency One',
        settings: {
          onboarding: {
            unifiedV1: {
              status: 'in_progress',
              startedAt: '2026-03-04T10:00:00.000Z',
            },
          },
        },
        _count: {
          members: 2,
          accessRequests: 1,
        },
      } as any);

      const result = await agencyService.getOnboardingStatus('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({
        status: 'activated',
        completed: true,
        step: {
          members: true,
          firstRequest: true,
        },
      });
    });

    it('returns in_progress when no request has been created yet', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        name: 'Agency One',
        settings: {
          onboarding: {
            unifiedV1: {
              status: 'in_progress',
              startedAt: '2026-03-04T10:00:00.000Z',
            },
          },
        },
        members: [{ id: 'member-1' }],
        accessRequests: [],
      } as any);

      const result = await agencyService.getOnboardingStatus('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({
        status: 'in_progress',
        completed: false,
        step: {
          firstRequest: false,
        },
      });
    });

    it('returns activated when first request exists and onboarding is not completed', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        name: 'Agency One',
        settings: {
          onboarding: {
            unifiedV1: {
              status: 'in_progress',
              startedAt: '2026-03-04T10:00:00.000Z',
            },
          },
        },
        members: [{ id: 'member-1' }],
        accessRequests: [{ id: 'req-1' }],
      } as any);

      const result = await agencyService.getOnboardingStatus('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({
        status: 'activated',
        completed: false,
        step: {
          firstRequest: true,
        },
      });
    });

    it('returns completed when lifecycle metadata marks onboarding complete', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        name: 'Agency One',
        settings: {
          onboarding: {
            unifiedV1: {
              status: 'completed',
              completedAt: '2026-03-04T10:20:00.000Z',
            },
          },
        },
        members: [{ id: 'member-1' }, { id: 'member-2' }],
        accessRequests: [{ id: 'req-1' }],
      } as any);

      const result = await agencyService.getOnboardingStatus('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({
        status: 'completed',
        completed: true,
      });
    });
  });

  describe('updateOnboardingProgress', () => {
    it('merges onboarding lifecycle fields without deleting unrelated agency settings', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        settings: {
          timezone: 'America/Los_Angeles',
          onboarding: {
            unifiedV1: {
              status: 'in_progress',
              startedAt: '2026-03-04T10:00:00.000Z',
            },
          },
        },
      } as any);

      vi.mocked(prisma.agency.update).mockResolvedValue({
        id: 'agency-1',
        settings: {
          timezone: 'America/Los_Angeles',
          onboarding: {
            unifiedV1: {
              status: 'activated',
              startedAt: '2026-03-04T10:00:00.000Z',
              activatedAt: '2026-03-04T10:05:00.000Z',
              accessRequestId: 'req-1',
            },
          },
        },
      } as any);

      const result = await agencyService.updateOnboardingProgress('agency-1', {
        status: 'activated',
        activatedAt: '2026-03-04T10:05:00.000Z',
        accessRequestId: 'req-1',
      } as any);

      expect(result.error).toBeNull();
      expect(prisma.agency.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'agency-1' },
        data: {
          settings: {
            timezone: 'America/Los_Angeles',
            onboarding: {
              unifiedV1: {
                status: 'activated',
                startedAt: '2026-03-04T10:00:00.000Z',
                activatedAt: '2026-03-04T10:05:00.000Z',
                accessRequestId: 'req-1',
              },
            },
          },
        },
      }));
    });

    it('queues the activated follow-up email when onboarding reaches activated status', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        settings: {
          onboarding: {
            unifiedV1: {
              status: 'in_progress',
              startedAt: '2026-03-04T10:00:00.000Z',
            },
          },
        },
      } as any);

      vi.mocked(prisma.agency.update).mockResolvedValue({
        id: 'agency-1',
        settings: {
          onboarding: {
            unifiedV1: {
              status: 'activated',
              startedAt: '2026-03-04T10:00:00.000Z',
              activatedAt: '2026-03-04T10:05:00.000Z',
              accessRequestId: 'req-1',
            },
          },
        },
      } as any);

      const result = await agencyService.updateOnboardingProgress('agency-1', {
        status: 'activated',
        activatedAt: '2026-03-04T10:05:00.000Z',
        accessRequestId: 'req-1',
      } as any);

      expect(result.error).toBeNull();
      expect(onboardingEmailService.queueActivatedFollowUp).toHaveBeenCalledWith({
        agencyId: 'agency-1',
        accessRequestId: 'req-1',
      });
    });
  });
});
