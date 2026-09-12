/**
 * Clerk Metadata Service Tests
 *
 * Test-Driven Development for subscription tier management via Clerk metadata.
 * Following Red-Green-Refactor cycle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TIER_LIMITS } from '@agency-platform/shared';

// Mock @clerk/backend BEFORE importing the service
vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    users: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
  })),
}));

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    CLERK_SECRET_KEY: 'sk_test_secret_key',
  },
}));

// Mock Prisma for syncQuotaUsage
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agencyUsageCounter: {
      findMany: vi.fn(),
    },
  },
}));

// Import service AFTER mocks
import { clerkMetadataService } from '../clerk-metadata.service';

describe('Clerk Metadata Service - TDD Tests', () => {
  const mockClerk = {
    users: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to default state
    mockClerk.users.getUser.mockResolvedValue({
      publicMetadata: {
        subscriptionTier: 'STARTER',
        tierName: 'Starter',
        features: TIER_LIMITS.STARTER.features,
      },
      privateMetadata: {
        quotaLimits: {
          clientOnboards: { limit: 36, used: 0, resetsAt: '2025-01-01T00:00:00.000Z' },
          platformAudits: { limit: 120, used: 0, resetsAt: '2025-01-01T00:00:00.000Z' },
          teamSeats: { limit: 1, used: 1 },
        },
        subscriptionStatus: 'active',
        currentPeriodStart: '2024-01-01T00:00:00.000Z',
        currentPeriodEnd: '2025-01-01T00:00:00.000Z',
      },
    });
    mockClerk.users.updateUser.mockResolvedValue({});
  });

  describe('setSubscriptionTier', () => {
    it('should set STARTER tier in Clerk metadata', async () => {
      const { createClerkClient } = await import('@clerk/backend');
      (createClerkClient as any).mockReturnValue(mockClerk);

      const result = await clerkMetadataService.setSubscriptionTier('user_123', 'STARTER');

      expect(result.error).toBeNull();
      expect(result.data?.tier).toBe('STARTER');
      expect(result.data?.publicMetadata).toEqual({
        subscriptionTier: 'STARTER',
        tierName: 'Starter',
        features: TIER_LIMITS.STARTER.features,
      });
      expect(mockClerk.users.updateUser).toHaveBeenCalledWith('user_123', {
        publicMetadata: expect.any(Object),
        privateMetadata: expect.any(Object),
      });
    });

    it('should set SCALE tier with trial status', async () => {
      const { createClerkClient } = await import('@clerk/backend');
      (createClerkClient as any).mockReturnValue(mockClerk);

      const result = await clerkMetadataService.setSubscriptionTier('user_456', 'SCALE', {
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date('2025-02-01'),
      });

      expect(result.error).toBeNull();
      expect(result.data?.tier).toBe('SCALE');
      expect(result.data?.publicMetadata.tierName).toBe('Scale');
      expect(result.data?.privateMetadata.subscriptionStatus).toBe('trialing');
      expect(result.data?.privateMetadata.trialEndsAt).toBeDefined();
    });

    it('should include quota limits in private metadata', async () => {
      const { createClerkClient } = await import('@clerk/backend');
      (createClerkClient as any).mockReturnValue(mockClerk);

      const result = await clerkMetadataService.setSubscriptionTier('user_789', 'SCALE');

      expect(result.error).toBeNull();
      expect(result.data?.privateMetadata.quotaLimits).toBeDefined();
      expect(result.data?.privateMetadata.quotaLimits.clientOnboards.limit).toBe(600);
      expect(result.data?.privateMetadata.quotaLimits.platformAudits.limit).toBe(3000);
      expect(result.data?.privateMetadata.quotaLimits.teamSeats.limit).toBe(-1); // unlimited
    });

    it('should return error on Clerk API failure', async () => {
      mockClerk.users.updateUser.mockRejectedValueOnce(new Error('Clerk API error'));
      const { createClerkClient } = await import('@clerk/backend');
      (createClerkClient as any).mockReturnValue(mockClerk);

      const result = await clerkMetadataService.setSubscriptionTier('user_error', 'STARTER');

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('CLERK_UPDATE_FAILED');
    });
  });

  describe('getSubscriptionTier', () => {
    it('should fetch user tier from Clerk metadata', async () => {
      const { createClerkClient } = await import('@clerk/backend');
      (createClerkClient as any).mockReturnValue(mockClerk);

      const result = await clerkMetadataService.getSubscriptionTier('user_123');

      expect(result.error).toBeNull();
      expect(result.data?.tier).toBe('STARTER');
      expect(result.data?.publicMetadata.tierName).toBe('Starter');
      expect(result.data?.privateMetadata.quotaLimits).toBeDefined();
    });

    it('should return error when tier not found in metadata', async () => {
      mockClerk.users.getUser.mockResolvedValueOnce({
        publicMetadata: {},
        privateMetadata: {},
      });
      const { createClerkClient } = await import('@clerk/backend');
      (createClerkClient as any).mockReturnValue(mockClerk);

      const result = await clerkMetadataService.getSubscriptionTier('user_no_tier');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('TIER_NOT_SET');
    });

    it('should return error on Clerk API failure', async () => {
      mockClerk.users.getUser.mockRejectedValueOnce(new Error('Network error'));
      const { createClerkClient } = await import('@clerk/backend');
      (createClerkClient as any).mockReturnValue(mockClerk);

      const result = await clerkMetadataService.getSubscriptionTier('user_error');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('CLERK_FETCH_FAILED');
    });
  });

  describe('syncQuotaUsage', () => {
    it('should sync usage counters to Clerk private metadata', async () => {
      const { createClerkClient } = await import('@clerk/backend');
      (createClerkClient as any).mockReturnValue(mockClerk);

      const { prisma } = await import('@/lib/prisma');
      (prisma.agencyUsageCounter.findMany as any).mockResolvedValue([
        { metricType: 'client_onboards', count: 10 },
        { metricType: 'platform_audits', count: 25 },
        { metricType: 'team_seats', count: 2 },
      ]);

      const result = await clerkMetadataService.syncQuotaUsage('user_123', 'agency-1');

      expect(result.error).toBeNull();
      expect(result.data?.synced).toBe(true);
      expect(result.data?.usage).toEqual({
        clientOnboards: 10,
        platformAudits: 25,
        teamSeats: 2,
      });
      expect(mockClerk.users.updateUser).toHaveBeenCalledWith('user_123', {
        privateMetadata: expect.objectContaining({
          quotaLimits: expect.objectContaining({
            clientOnboards: expect.objectContaining({ used: 10 }),
            platformAudits: expect.objectContaining({ used: 25 }),
            teamSeats: expect.objectContaining({ used: 2 }),
          }),
        }),
      });
    });

    it('should handle tier not found gracefully', async () => {
      mockClerk.users.getUser.mockResolvedValueOnce({
        publicMetadata: {},
        privateMetadata: {},
      });
      const { createClerkClient } = await import('@clerk/backend');
      (createClerkClient as any).mockReturnValue(mockClerk);

      const result = await clerkMetadataService.syncQuotaUsage('user_no_tier', 'agency-1');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('TIER_NOT_SET');
    });
  });
});
