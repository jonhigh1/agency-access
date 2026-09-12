/**
 * Quota Enforcement Middleware Tests
 *
 * Test-Driven Development for quota enforcement at API level.
 * Following Red-Green-Refactor cycle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { TIER_LIMITS } from '@agency-platform/shared';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agencyUsageCounter: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Mock Clerk metadata service
vi.mock('@/services/clerk-metadata.service', () => ({
  clerkMetadataService: {
    getSubscriptionTier: vi.fn(),
  },
}));

import { quotaEnforcement } from '../quota-enforcement';
import { prisma } from '@/lib/prisma';
import { clerkMetadataService } from '@/services/clerk-metadata.service';

describe('Quota Enforcement Middleware - TDD Tests', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let nextSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Default request with authenticated user
    mockRequest = {
      user: { sub: 'clerk_user_123' },
      body: { agencyId: 'agency-123' },
    };

    // Default reply
    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    nextSpy = vi.fn();

    // Mock default tier response (STARTER)
    (clerkMetadataService.getSubscriptionTier as any).mockResolvedValue({
      data: {
        tier: 'STARTER',
        publicMetadata: { tierName: 'Starter', features: [] },
        privateMetadata: {
          quotaLimits: {
            clientOnboards: { limit: 36, used: 0, resetsAt: '2025-01-01T00:00:00.000Z' },
            platformAudits: { limit: 120, used: 0, resetsAt: '2025-01-01T00:00:00.000Z' },
            teamSeats: { limit: 1, used: 1 },
          },
        },
      },
      error: null,
    });

    // Mock default usage counter (0 used)
    (prisma.agencyUsageCounter.findUnique as any).mockResolvedValue({
      agencyId: 'agency-123',
      metricType: 'client_onboards',
      period: 'current_year',
      count: 0,
      resetAt: new Date('2025-01-01T00:00:00.000Z'),
    });
  });

  describe('checkQuota', () => {
    it('should allow action when under limit', async () => {
      const result = await quotaEnforcement.checkQuota({
        metric: 'client_onboards',
        agencyId: 'agency-123',
        clerkUserId: 'clerk_user_123',
      });

      expect(result.allowed).toBe(true);
      expect(result.metric).toBe('client_onboards');
      expect(result.limit).toBe(36);
      expect(result.used).toBe(0);
      expect(result.remaining).toBe(36);
    });

    it('should block action when limit exceeded', async () => {
      (prisma.agencyUsageCounter.findUnique as any).mockResolvedValue({
        count: 36, // At limit
        resetAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const result = await quotaEnforcement.checkQuota({
        metric: 'client_onboards',
        agencyId: 'agency-123',
        clerkUserId: 'clerk_user_123',
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should allow unlimited team seats for SCALE tier', async () => {
      (clerkMetadataService.getSubscriptionTier as any).mockResolvedValue({
        data: {
          tier: 'SCALE',
          privateMetadata: {
            quotaLimits: {
              teamSeats: { limit: -1, used: 100 },
            },
          },
        },
        error: null,
      });

      const result = await quotaEnforcement.checkQuota({
        metric: 'team_seats',
        agencyId: 'agency-123',
        clerkUserId: 'clerk_user_123',
      });

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });

    it('should handle missing usage counter gracefully', async () => {
      (prisma.agencyUsageCounter.findUnique as any).mockResolvedValue(null);

      const result = await quotaEnforcement.checkQuota({
        metric: 'client_onboards',
        agencyId: 'agency-123',
        clerkUserId: 'clerk_user_123',
      });

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
    });

    it('should return error when tier fetch fails', async () => {
      (clerkMetadataService.getSubscriptionTier as any).mockResolvedValue({
        data: null,
        error: { code: 'CLERK_FETCH_FAILED' },
      });

      await expect(quotaEnforcement.checkQuota({
        metric: 'client_onboards',
        agencyId: 'agency-123',
        clerkUserId: 'clerk_user_123',
      })).rejects.toMatchObject({ code: 'QUOTA_SERVICE_UNAVAILABLE' });
    });
  });

  describe('incrementUsage', () => {
    it('should increment existing counter', async () => {
      (prisma.agencyUsageCounter.upsert as any).mockResolvedValue({
        count: 1,
      });

      await quotaEnforcement.incrementUsage('agency-123', 'client_onboards');

      expect(prisma.agencyUsageCounter.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            agencyId_metricType_period: {
              agencyId: 'agency-123',
              metricType: 'client_onboards',
              period: 'current_year',
            },
          },
          update: expect.objectContaining({
            count: { increment: 1 },
          }),
        })
      );
    });

    it('should create counter if not exists', async () => {
      (prisma.agencyUsageCounter.upsert as any).mockResolvedValue({
        count: 1,
      });

      await quotaEnforcement.incrementUsage('agency-123', 'team_seats');

      expect(prisma.agencyUsageCounter.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            agencyId: 'agency-123',
            metricType: 'team_seats',
            period: 'all_time',
            count: 1,
          }),
        })
      );
    });
  });

  describe('enforcement middleware', () => {
    it('should allow request when under quota', async () => {
      const middleware = quotaEnforcement.enforcement({ metric: 'client_onboards' });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).not.toHaveBeenCalled();
      expect((mockRequest as any).quotaCheck).toBeDefined();
      expect((mockRequest as any).quotaCheck.allowed).toBe(true);
    });

    it('should block request when quota exceeded', async () => {
      (prisma.agencyUsageCounter.findUnique as any).mockResolvedValue({
        count: 36, // At limit
        resetAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const middleware = quotaEnforcement.enforcement({ metric: 'client_onboards' });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(402);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'QUOTA_EXCEEDED',
            metric: 'client_onboards',
            limit: 36,
            used: 36,
            upgradeUrl: '/pricing?upgrade=GROWTH',
          }),
        })
      );
    });

    it('should fetch the Clerk tier exactly once on the 402 path', async () => {
      (prisma.agencyUsageCounter.findUnique as any).mockResolvedValue({
        count: 36, // At limit
        resetAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const middleware = quotaEnforcement.enforcement({ metric: 'client_onboards' });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(402);
      expect(clerkMetadataService.getSubscriptionTier).toHaveBeenCalledTimes(1);
    });

    it('should return 401 when user not authenticated', async () => {
      delete (mockRequest as any).user;

      const middleware = quotaEnforcement.enforcement({ metric: 'client_onboards' });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
    });

    it('should return 400 when agencyId missing', async () => {
      delete (mockRequest as any).body?.agencyId;
      delete (mockRequest as any).params?.agencyId;

      const middleware = quotaEnforcement.enforcement({ metric: 'client_onboards' });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
    });

    it('should not suggest a higher tier when SCALE tier is exceeded', async () => {
      (clerkMetadataService.getSubscriptionTier as any).mockResolvedValue({
        data: {
          tier: 'SCALE',
          privateMetadata: {
            quotaLimits: {
              clientOnboards: { limit: 120, used: 120 },
            },
          },
        },
        error: null,
      });

      (prisma.agencyUsageCounter.findUnique as any).mockResolvedValue({
        count: 600, // At SCALE limit
        resetAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const middleware = quotaEnforcement.enforcement({ metric: 'client_onboards' });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            currentTier: 'SCALE',
            suggestedTier: null,
          }),
        })
      );
    });
  });

  describe('increment middleware', () => {
    it('should increment usage after successful request', async () => {
      (prisma.agencyUsageCounter.upsert as any).mockResolvedValue({ count: 1 });

      const middleware = quotaEnforcement.increment('client_onboards');

      // Fastify onSend hooks receive (request, reply, payload)
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, null);

      expect(prisma.agencyUsageCounter.upsert).toHaveBeenCalled();
    });

    it('should not throw when increment fails', async () => {
      (prisma.agencyUsageCounter.upsert as any).mockRejectedValue(new Error('DB error'));

      const middleware = quotaEnforcement.increment('client_onboards');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply, null);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
