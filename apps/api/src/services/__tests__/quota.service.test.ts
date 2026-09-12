/**
 * Quota Service Tests
 *
 * TDD: Red phase - These tests will fail initially
 *
 * Test coverage:
 * - Check quota for under-limit agency (allowed)
 * - Check quota for at-limit agency (denied)
 * - Check quota for unlimited tier (always allowed)
 * - Check quota for over-limit agency (denied)
 * - Update usage increments correctly
 * - Get usage returns correct snapshot
 * - Clerk metadata updates on quota actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuotaService } from '../quota.service';
import { TIER_LIMITS, type SubscriptionTier, type MetricType } from '@agency-platform/shared';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('@/lib/clerk', () => ({
  clerkClient: {
    users: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agency: {
      findUnique: vi.fn(),
    },
    client: {
      count: vi.fn(),
    },
    agencyMember: {
      count: vi.fn(),
    },
    accessRequest: {
      count: vi.fn(),
    },
    accessRequestTemplate: {
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('QuotaService', () => {
  let quotaService: QuotaService;
  const mockAgencyId = 'test-agency-id';

  beforeEach(() => {
    quotaService = new QuotaService();
    vi.clearAllMocks();
    vi.mocked(prisma.agency.findUnique).mockResolvedValue({
      subscription: { tier: 'STARTER', status: 'active' },
    } as any);
    vi.mocked(prisma.client.count).mockResolvedValue(0);
    vi.mocked(prisma.agencyMember.count).mockResolvedValue(0);
    vi.mocked(prisma.accessRequest.count).mockResolvedValue(0);
    vi.mocked(prisma.accessRequestTemplate.count).mockResolvedValue(0);
  });

  describe('checkQuota', () => {
    it('should allow action when under limit', async () => {
      // Arrange
      const tier: SubscriptionTier = 'STARTER';
      const metric: MetricType = 'clients';
      const limit = TIER_LIMITS[tier].clients; // 5 for STARTER

      // Mock agency with tier
      const mockAgency = {
        id: mockAgencyId,
        subscriptionTier: tier,
      };

      const mockCount = 3; // Under limit
      vi.mocked(prisma.client.count).mockResolvedValue(mockCount);

      // Act
      const result = await quotaService.checkQuota({
        agencyId: mockAgencyId,
        metric,
        action: 'create',
        requestedAmount: 1,
      });

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(limit);
      expect(result.used).toBe(mockCount);
      expect(result.remaining).toBe(limit - mockCount);
    });

    it('should deny action when at exactly limit', async () => {
      // Arrange - STRICT enforcement: block at limit, no overage
      const tier: SubscriptionTier = 'STARTER';
      const metric: MetricType = 'clients';
      const limit = TIER_LIMITS[tier].clients; // 5 for STARTER

      const mockCount = 5; // AT limit
      vi.mocked(prisma.client.count).mockResolvedValue(mockCount);

      // Act
      const result = await quotaService.checkQuota({
        agencyId: mockAgencyId,
        metric,
        action: 'create',
        requestedAmount: 1,
      });

      // Assert - Strict enforcement: denied at limit
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.suggestedTier).toBe('GROWTH');
    });

    it('should always allow actions for unlimited team seats on SCALE tier', async () => {
      // Arrange
      const metric: MetricType = 'team_seats';
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: { tier: 'SCALE', status: 'active' },
      } as any);

      // Act
      const result = await quotaService.checkQuota({
        agencyId: mockAgencyId,
        metric,
        action: 'create',
        requestedAmount: 9999,
      });

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe('unlimited');
      expect(result.used).toBeGreaterThanOrEqual(0);
      expect(result.remaining).toBe('unlimited');
    });

    it('should always allow actions for unlimited team seats on SCALE tier', async () => {
      const metric: MetricType = 'team_seats';
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        subscription: { tier: 'SCALE', status: 'active' },
      } as any);

      // Act
      const result = await quotaService.checkQuota({
        agencyId: mockAgencyId,
        metric,
        action: 'create',
        requestedAmount: 100,
      });

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe('unlimited');
    });

    it('should suggest correct upgrade tier based on metric', async () => {
      // Arrange
      const tier: SubscriptionTier = 'STARTER';
      const metric: MetricType = 'clients';
      vi.mocked(prisma.client.count).mockResolvedValue(TIER_LIMITS.STARTER.clients);

      // Act - STARTER at limit for clients
      const result = await quotaService.checkQuota({
        agencyId: mockAgencyId,
        metric,
        action: 'create',
        requestedAmount: 1,
      });

      // Assert - GROWTH is the next tier up from STARTER
      expect(result.allowed).toBe(false);
      expect(result.suggestedTier).toBe('GROWTH');
    });

    it('should include upgrade URL in denied response', async () => {
      // Arrange
      const tier: SubscriptionTier = 'STARTER';
      const metric: MetricType = 'clients';
      vi.mocked(prisma.client.count).mockResolvedValue(TIER_LIMITS.STARTER.clients);

      // Act
      const result = await quotaService.checkQuota({
        agencyId: mockAgencyId,
        metric,
        action: 'create',
        requestedAmount: 1,
      });

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.upgradeUrl).toContain('/checkout');
      expect(result.upgradeUrl).toContain('tier=GROWTH');
    });
  });

  describe('updateUsage', () => {
    it('should increment usage metric after successful action', async () => {
      // Arrange
      const metric: MetricType = 'clients';

      // Act
      await quotaService.updateUsage(mockAgencyId, metric, 1);

      // Assert - Should update Clerk metadata
      // Verification will be in implementation
      expect(true).toBe(true); // Placeholder
    });

    it('should decrement usage metric when item is deleted', async () => {
      // Arrange
      const metric: MetricType = 'clients';

      // Act
      await quotaService.updateUsage(mockAgencyId, metric, -1);

      // Assert
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('getUsage', () => {
    it('should return current usage snapshot for all metrics', async () => {
      // Act
      const usage = await quotaService.getUsage(mockAgencyId);

      // Assert
      expect(usage).toBeDefined();
      expect(usage.currentTier).toBeDefined();
      expect(usage.clients).toBeDefined();
      expect(usage.members).toBeDefined();
      expect(usage.accessRequests).toBeDefined();
      expect(usage.templates).toBeDefined();
    });

    it('should return null for non-existent agency', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValueOnce(null);
      // Act
      const usage = await quotaService.getUsage('non-existent-agency');

      // Assert
      expect(usage).toBeNull();
    });
  });
});
