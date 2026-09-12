/**
 * Tier Limits Service Tests
 *
 * Tests for tier limit enforcement across the application.
 * Following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TIER_LIMITS } from '@agency-platform/shared';
import { tierLimitsService } from '../tier-limits.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agency: {
      findUnique: vi.fn().mockResolvedValue({
        subscription: {
          tier: 'STARTER',
          status: 'active',
        },
      }),
    },
    accessRequest: {
      count: vi.fn().mockResolvedValue(0),
    },
    client: {
      count: vi.fn().mockResolvedValue(0),
    },
    agencyMember: {
      count: vi.fn().mockResolvedValue(0),
    },
    accessRequestTemplate: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

describe('TierLimitsService', () => {
  const mockAgencyId = 'test-agency-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkTierLimit', () => {
    it('should allow action when under limit', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: {
          tier: 'STARTER',
          status: 'active',
        },
      });
      vi.mocked(prisma.accessRequest.count).mockResolvedValue(4);

      const result = await tierLimitsService.checkTierLimit(
        mockAgencyId,
        'access_requests'
      );

      expect(result).toEqual({
        allowed: true,
        limit: TIER_LIMITS.STARTER.accessRequests,
        current: 4,
        error: undefined,
      });
    });

    it('should deny action when at limit', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: {
          tier: 'STARTER',
          status: 'active',
        },
      });
      vi.mocked(prisma.accessRequest.count).mockResolvedValue(TIER_LIMITS.STARTER.accessRequests);

      const result = await tierLimitsService.checkTierLimit(
        mockAgencyId,
        'access_requests'
      );

      expect(result).toEqual({
        allowed: false,
        limit: TIER_LIMITS.STARTER.accessRequests,
        current: TIER_LIMITS.STARTER.accessRequests,
        error: 'TIER_LIMIT_EXCEEDED',
      });
    });

    it('should allow unlimited members for SCALE tier', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: {
          tier: 'SCALE',
          status: 'active',
        },
      });
      vi.mocked(prisma.agencyMember.count).mockResolvedValue(9999);

      const result = await tierLimitsService.checkTierLimit(
        mockAgencyId,
        'members'
      );

      expect(result).toEqual({
        allowed: true,
        limit: undefined,
        current: 9999,
        error: undefined,
      });
    });

    it('should return error for unknown agency', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);

      const result = await tierLimitsService.checkTierLimit(
        mockAgencyId,
        'access_requests'
      );

      expect(result).toEqual({
        allowed: false,
        error: 'AGENCY_NOT_FOUND',
      });
    });

    it('should check different resource types', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: {
          tier: 'STARTER',
          status: 'active',
        },
      });

      // Test clients
      vi.mocked(prisma.client.count).mockResolvedValue(3);
      const clientsResult = await tierLimitsService.checkTierLimit(
        mockAgencyId,
        'clients'
      );
      expect(clientsResult.allowed).toBe(true);
      expect(clientsResult.limit).toBe(5);

      // Test members
      vi.mocked(prisma.agencyMember.count).mockResolvedValue(1);
      const membersResult = await tierLimitsService.checkTierLimit(
        mockAgencyId,
        'members'
      );
      expect(membersResult.allowed).toBe(true);
      expect(membersResult.limit).toBeUndefined();

      // Test templates
      vi.mocked(prisma.accessRequestTemplate.count).mockResolvedValue(1);
      const templatesResult = await tierLimitsService.checkTierLimit(
        mockAgencyId,
        'templates'
      );
      expect(templatesResult.allowed).toBe(true);
      expect(templatesResult.limit).toBe(3);
    });

    it('should enforce Free limits when paid subscription is not active', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscriptionTier: 'STARTER',
        subscription: {
          tier: 'STARTER',
          status: 'incomplete',
        },
      });
      vi.mocked(prisma.client.count).mockResolvedValue(1);

      const result = await tierLimitsService.checkTierLimit(
        mockAgencyId,
        'clients'
      );

      expect(result).toEqual({
        allowed: false,
        limit: 1,
        current: 1,
        error: 'TIER_LIMIT_EXCEEDED',
      });
    });
  });

  describe('hasFeatureAccess', () => {
    it('should return true for feature in tier', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: {
          tier: 'STARTER',
          status: 'active',
        },
      });

      const result = await tierLimitsService.hasFeatureAccess(
        mockAgencyId,
        'all_platforms'
      );

      expect(result).toBe(true);
    });

    it('should return false for feature not in tier', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: {
          tier: 'STARTER',
          status: 'active',
        },
      });

      const result = await tierLimitsService.hasFeatureAccess(
        mockAgencyId,
        'multi_brand'
      );

      expect(result).toBe(false);
    });

    it('should return true for SCALE feature access', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: {
          tier: 'SCALE',
          status: 'active',
        },
      });

      const result = await tierLimitsService.hasFeatureAccess(
        mockAgencyId,
        'multi_brand'
      );

      expect(result).toBe(true);
    });

    it('should return false for unknown agency', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);

      const result = await tierLimitsService.hasFeatureAccess(
        mockAgencyId,
        'all_platforms'
      );

      expect(result).toBe(false);
    });
  });

  describe('getTierDetails', () => {
    it('should return tier details with usage', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: {
          tier: 'STARTER',
          status: 'active',
        },
      });
      vi.mocked(prisma.accessRequest.count).mockResolvedValue(5);
      vi.mocked(prisma.client.count).mockResolvedValue(2);
      vi.mocked(prisma.agencyMember.count).mockResolvedValue(1);
      vi.mocked(prisma.accessRequestTemplate.count).mockResolvedValue(1);

      const result = await tierLimitsService.getTierDetails(mockAgencyId);

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        tier: 'STARTER',
        limits: {
          accessRequests: {
            limit: TIER_LIMITS.STARTER.accessRequests,
            used: 5,
            remaining: 0,
          },
          clients: {
            limit: 5,
            used: 2,
            remaining: 3,
          },
          members: {
            limit: 'unlimited',
            used: 1,
            remaining: -1,
          },
          templates: {
            limit: 3,
            used: 1,
            remaining: 2,
          },
        },
        features: ['all_platforms', 'email_support'],
      });
    });

    it('should return error for unknown agency', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);

      const result = await tierLimitsService.getTierDetails(mockAgencyId);

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'AGENCY_NOT_FOUND',
        message: 'Agency not found',
      });
    });

    it('should show current limits for SCALE tier', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: {
          tier: 'SCALE',
          status: 'active',
        },
      });
      vi.mocked(prisma.accessRequest.count).mockResolvedValue(9999);
      vi.mocked(prisma.client.count).mockResolvedValue(500);
      vi.mocked(prisma.agencyMember.count).mockResolvedValue(100);
      vi.mocked(prisma.accessRequestTemplate.count).mockResolvedValue(50);

      const result = await tierLimitsService.getTierDetails(mockAgencyId);

      expect(result.data?.limits).toEqual({
        accessRequests: {
          limit: TIER_LIMITS.SCALE.accessRequests,
          used: 9999,
          remaining: 0,
        },
        clients: {
          limit: TIER_LIMITS.SCALE.clients,
          used: 500,
          remaining: 0,
        },
        members: {
          limit: 'unlimited',
          used: 100,
          remaining: -1,
        },
        templates: {
          limit: TIER_LIMITS.SCALE.templates,
          used: 50,
          remaining: 0,
        },
      });
    });

    it('should return Free tier details when paid subscription is not active', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscriptionTier: 'STARTER',
        subscription: {
          tier: 'STARTER',
          status: 'incomplete',
        },
      });
      vi.mocked(prisma.accessRequest.count).mockResolvedValue(0);
      vi.mocked(prisma.client.count).mockResolvedValue(1);
      vi.mocked(prisma.agencyMember.count).mockResolvedValue(1);
      vi.mocked(prisma.accessRequestTemplate.count).mockResolvedValue(0);

      const result = await tierLimitsService.getTierDetails(mockAgencyId);

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        tier: null,
        limits: {
          accessRequests: {
            limit: 3,
            used: 0,
            remaining: 3,
          },
          clients: {
            limit: 1,
            used: 1,
            remaining: 0,
          },
          members: {
            limit: 1,
            used: 1,
            remaining: 0,
          },
          templates: {
            limit: 1,
            used: 0,
            remaining: 1,
          },
        },
        features: ['core_platforms', 'email_support'],
      });
    });
  });
});
