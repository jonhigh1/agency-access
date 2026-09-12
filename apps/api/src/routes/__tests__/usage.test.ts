/**
 * Usage Routes Tests
 *
 * Test-Driven Development for usage snapshot API endpoint.
 * Following Red-Green-Refactor cycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { usageRoutes } from '../usage';

// Mock dependencies
vi.mock('@/services/clerk-metadata.service', () => ({
  clerkMetadataService: {
    getSubscriptionTier: vi.fn(),
  },
}));

  vi.mock('@/lib/prisma', () => ({
  prisma: {
    agency: {
      findUnique: vi.fn(),
    },
    agencyUsageCounter: {
      findMany: vi.fn(),
    },
  },
  }));
vi.mock('@/middleware/auth', () => ({
  authenticate: () => async (request: any) => {
    if (request.headers['x-test-auth']) request.user = { sub: 'clerk_user_123' };
  },
}));

import { clerkMetadataService } from '@/services/clerk-metadata.service';
import { prisma } from '@/lib/prisma';

describe('Usage Routes - TDD Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(usageRoutes, { prefix: '/api' });
    vi.clearAllMocks();

    // Mock tier response (STARTER tier)
    (clerkMetadataService.getSubscriptionTier as any).mockResolvedValue({
      data: {
        tier: 'STARTER',
        publicMetadata: { tierName: 'Starter', features: ['all_platforms', 'email_support'] },
        privateMetadata: {
          quotaLimits: {
            clientOnboards: { limit: 36, used: 10, resetsAt: '2025-01-01T00:00:00.000Z' },
            platformAudits: { limit: 120, used: 25, resetsAt: '2025-01-01T00:00:00.000Z' },
            teamSeats: { limit: 1, used: 1 },
          },
          subscriptionStatus: 'active',
          currentPeriodStart: '2024-01-01T00:00:00.000Z',
          currentPeriodEnd: '2025-01-01T00:00:00.000Z',
        },
      },
      error: null,
    });

    // Mock agency lookup
    (prisma.agency.findUnique as any).mockResolvedValue({
      id: 'agency-123',
      clerkUserId: 'clerk_user_123',
      name: 'Test Agency',
      email: 'test@example.com',
    });

    // Mock usage counters
    (prisma.agencyUsageCounter.findMany as any).mockResolvedValue([
      { metricType: 'client_onboards', period: 'current_year', count: 10 },
      { metricType: 'platform_audits', period: 'current_year', count: 25 },
      { metricType: 'team_seats', period: 'all_time', count: 1 },
    ]);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/usage', () => {
    it('should return usage snapshot for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/usage',
        headers: { 'x-test-auth': 'true' },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      expect(payload.data).toBeDefined();
      expect(payload.data.agencyId).toBe('agency-123');
      expect(payload.data.tier).toBe('STARTER');
      expect(payload.data.tierName).toBe('Starter');
      expect(payload.data.metrics.clientOnboards).toBeDefined();
      expect(payload.data.metrics.platformAudits).toBeDefined();
      expect(payload.data.metrics.teamSeats).toBeDefined();
    });

    it('should calculate remaining quota correctly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/usage',
        headers: { 'x-test-auth': 'true' },
      });

      const payload = JSON.parse(response.payload);

      expect(payload.data.metrics.clientOnboards.used).toBe(10);
      expect(payload.data.metrics.clientOnboards.limit).toBe(36);
      expect(payload.data.metrics.clientOnboards.remaining).toBe(26);
      expect(payload.data.metrics.clientOnboards.percentage).toBeCloseTo(27.78, 1);
    });

    it('should handle unlimited seats for PRO tier', async () => {
      (clerkMetadataService.getSubscriptionTier as any).mockResolvedValue({
        data: {
          tier: 'SCALE',
          publicMetadata: { tierName: 'Agency', features: [] },
          privateMetadata: {
            quotaLimits: {
              clientOnboards: { limit: 600, used: 100, resetsAt: '2025-01-01T00:00:00.000Z' },
              platformAudits: { limit: 3000, used: 500, resetsAt: '2025-01-01T00:00:00.000Z' },
              teamSeats: { limit: -1, used: 50 },
            },
            subscriptionStatus: 'active',
            currentPeriodStart: '2024-01-01T00:00:00.000Z',
            currentPeriodEnd: '2025-01-01T00:00:00.000Z',
          },
        },
        error: null,
      });

      (prisma.agencyUsageCounter.findMany as any).mockResolvedValue([
        { metricType: 'team_seats', period: 'all_time', count: 50 },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/usage',
        headers: { 'x-test-auth': 'true' },
      });

      const payload = JSON.parse(response.payload);

      expect(payload.data.metrics.teamSeats.isUnlimited).toBe(true);
      expect(payload.data.metrics.teamSeats.limit).toBe(-1);
      expect(payload.data.metrics.teamSeats.remaining).toBe(-1);
      expect(payload.data.metrics.teamSeats.percentage).toBe(0);
    });

    it('should return 401 when user not authenticated', async () => {
      const testApp = Fastify();
      await testApp.register(usageRoutes, { prefix: '/api' });

      const response = await testApp.inject({
        method: 'GET',
        url: '/api/usage',
      });

      expect(response.statusCode).toBe(401);
      await testApp.close();
    });

    it('should return 404 when tier not found', async () => {
      (clerkMetadataService.getSubscriptionTier as any).mockResolvedValue({
        data: null,
        error: { code: 'TIER_NOT_SET' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/usage',
        headers: { 'x-test-auth': 'true' },
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBeDefined();
      expect(payload.error.code).toBe('TIER_NOT_FOUND');
    });

    it('should return 404 when agency not found', async () => {
      (prisma.agency.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/usage',
        headers: { 'x-test-auth': 'true' },
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBeDefined();
      expect(payload.error.code).toBe('AGENCY_NOT_FOUND');
    });

    it('should include period dates in response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/usage',
        headers: { 'x-test-auth': 'true' },
      });

      const payload = JSON.parse(response.payload);

      expect(payload.data.currentPeriodStart).toBeDefined();
      expect(payload.data.currentPeriodEnd).toBeDefined();
      expect(new Date(payload.data.currentPeriodStart)).toBeInstanceOf(Date);
      expect(new Date(payload.data.currentPeriodEnd)).toBeInstanceOf(Date);
    });

    it('should include reset dates for annual metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/usage',
        headers: { 'x-test-auth': 'true' },
      });

      const payload = JSON.parse(response.payload);

      expect(payload.data.metrics.clientOnboards.resetsAt).toBeDefined();
      expect(payload.data.metrics.platformAudits.resetsAt).toBeDefined();
      // Team seats don't reset
      expect(payload.data.metrics.teamSeats.resetsAt).toBeUndefined();
    });
  });
});
