import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { dashboardRoutes } from '../dashboard';
import { performanceOnRequest, performanceOnSend } from '@/middleware/performance.js';

const {
  resolvePrincipalAgencyMock,
  getDashboardStatsMock,
  getDashboardAccessRequestSummariesMock,
  getDashboardConnectionSummariesMock,
  getOnboardingStatusMock,
  getSubscriptionMock,
  getCachedMock,
} = vi.hoisted(() => ({
  resolvePrincipalAgencyMock: vi.fn(),
  getDashboardStatsMock: vi.fn(),
  getDashboardAccessRequestSummariesMock: vi.fn(),
  getDashboardConnectionSummariesMock: vi.fn(),
  getOnboardingStatusMock: vi.fn(),
  getSubscriptionMock: vi.fn(),
  getCachedMock: vi.fn(),
}));

vi.mock('@/lib/authorization.js', () => ({
  resolvePrincipalAgency: resolvePrincipalAgencyMock,
  assertAgencyAccess: vi.fn(),
}));

vi.mock('@/services/connection-aggregation.service', () => ({
  getDashboardStats: getDashboardStatsMock,
}));

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getDashboardAccessRequestSummaries: getDashboardAccessRequestSummariesMock,
    getAgencyAccessRequests: vi.fn(),
  },
}));

vi.mock('@/services/connection.service', () => ({
  connectionService: {
    getDashboardConnectionSummaries: getDashboardConnectionSummariesMock,
    getAgencyConnectionSummaries: vi.fn(),
  },
}));

vi.mock('@/services/agency.service', () => ({
  agencyService: {
    getOnboardingStatus: getOnboardingStatusMock,
  },
}));

vi.mock('@/services/subscription.service', () => ({
  subscriptionService: {
    getSubscription: getSubscriptionMock,
  },
}));

vi.mock('@/lib/cache', () => ({
  getCached: getCachedMock,
  CacheKeys: { dashboard: (agencyId: string) => `dashboard:${agencyId}` },
  CacheTTL: { MEDIUM: 300 },
}));

vi.mock('@/middleware/auth.js', async () => {
  const perf = await vi.importActual<typeof import('@/middleware/performance.js')>('@/middleware/performance.js');

  return {
    authenticate: () => async (request: any, reply: any) => {
      perf.recordPerformanceMark(request, 'auth', 1);

      if (!request.headers.authorization) {
        return reply.code(401).send({
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing token',
          },
        });
      }

      request.user = { sub: 'user_123' };
    },
  };
});

function createItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i + 1}`,
    clientName: `Client ${i + 1}`,
    clientEmail: `client${i + 1}@example.com`,
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    platforms: ['google'],
  }));
}

describe('Dashboard Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.addHook('onRequest', performanceOnRequest);
    app.addHook('onSend', performanceOnSend);
    await app.register(dashboardRoutes);

    resolvePrincipalAgencyMock.mockReset();
    getDashboardStatsMock.mockReset();
    getDashboardAccessRequestSummariesMock.mockReset();
    getDashboardConnectionSummariesMock.mockReset();
    getOnboardingStatusMock.mockReset();
    getSubscriptionMock.mockReset();
    getCachedMock.mockReset();

    const cache = new Map<string, unknown>();
    getCachedMock.mockImplementation(async ({ key, fetch }: { key: string; fetch: () => Promise<{ data: unknown; error: unknown }> }) => {
      if (cache.has(key)) {
        return { data: cache.get(key), error: null, cached: true };
      }

      const result = await fetch();
      if (result.data && !result.error) {
        cache.set(key, result.data);
      }

      return { ...result, cached: false };
    });

    resolvePrincipalAgencyMock.mockResolvedValue({
      data: {
        agencyId: 'agency-1',
        principalId: 'user_123',
        agency: {
          id: 'agency-1',
          name: 'Agency One',
          email: 'owner@agency.test',
        },
      },
      error: null,
    });

    getDashboardStatsMock.mockResolvedValue({
      data: {
        totalRequests: 25,
        pendingRequests: 6,
        activeConnections: 42,
        totalPlatforms: 7,
      },
      error: null,
    });

    getDashboardAccessRequestSummariesMock.mockResolvedValue({
      data: {
        items: createItems(12),
        total: 25,
      },
      error: null,
    });

    getDashboardConnectionSummariesMock.mockResolvedValue({
      data: {
        items: createItems(14),
        total: 42,
      },
      error: null,
    });

    getOnboardingStatusMock.mockResolvedValue({
      data: {
        completed: false,
        status: 'in_progress',
        lifecycle: {
          status: 'in_progress',
          startedAt: '2026-03-04T10:00:00.000Z',
        },
        step: {
          profile: true,
          members: false,
          firstRequest: false,
        },
      },
      error: null,
    });

    getSubscriptionMock.mockResolvedValue({
      data: {
        id: 'sub_123',
        tier: 'SCALE',
        status: 'trialing',
        cancelAtPeriodEnd: false,
        trialEnd: new Date('2026-03-20T00:00:00.000Z'),
      },
      error: null,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns bounded dashboard summaries and truncation metadata', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(getDashboardAccessRequestSummariesMock).toHaveBeenCalledWith('agency-1', 10, {
      includeTotal: false,
    });
    expect(getDashboardConnectionSummariesMock).toHaveBeenCalledWith('agency-1', 10, {
      includeTotal: false,
    });

    expect(body.data.meta.requests).toEqual({
      limit: 10,
      returned: 10,
      total: 25,
      hasMore: true,
    });

    expect(body.data.meta.connections).toEqual({
      limit: 10,
      returned: 10,
      total: 42,
      hasMore: true,
    });
  });

  it('uses stats totals and skips extra summary count queries', async () => {
    getDashboardStatsMock.mockResolvedValue({
      data: {
        totalRequests: 99,
        pendingRequests: 6,
        activeConnections: 88,
        totalPlatforms: 7,
      },
      error: null,
    });

    getDashboardAccessRequestSummariesMock.mockResolvedValue({
      data: {
        items: createItems(10),
        total: 10,
      },
      error: null,
    });

    getDashboardConnectionSummariesMock.mockResolvedValue({
      data: {
        items: createItems(10),
        total: 10,
      },
      error: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(getDashboardAccessRequestSummariesMock).toHaveBeenCalledWith('agency-1', 10, {
      includeTotal: false,
    });
    expect(getDashboardConnectionSummariesMock).toHaveBeenCalledWith('agency-1', 10, {
      includeTotal: false,
    });

    const body = response.json();
    expect(body.data.meta.requests.total).toBe(99);
    expect(body.data.meta.connections.total).toBe(88);
  });

  it('returns 304 when if-none-match matches current etag', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: 'Bearer token' },
    });

    expect(first.statusCode).toBe(200);
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();

    const second = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: {
        authorization: 'Bearer token',
        'if-none-match': etag,
      },
    });

    expect(second.statusCode).toBe(304);
  });

  it('adds response-time and server-timing headers for dashboard requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-response-time']).toBeTruthy();

    const serverTiming = String(response.headers['server-timing'] || '');
    expect(serverTiming).toContain('total;dur=');
    expect(serverTiming).toContain('auth;dur=');
    expect(serverTiming).toContain('resolveAgency;dur=');
    expect(serverTiming).toContain('cache;dur=');
    expect(serverTiming).toContain('dataFetch;dur=');
  });

  it('includes onboarding status and trial banner bootstrap data in the dashboard payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.data.onboardingStatus).toEqual({
      completed: false,
      status: 'in_progress',
      lifecycle: {
        status: 'in_progress',
        startedAt: '2026-03-04T10:00:00.000Z',
      },
      step: {
        profile: true,
        members: false,
        firstRequest: false,
      },
    });
    expect(body.data.trialBanner).toEqual({
      tier: 'SCALE',
      trialEnd: '2026-03-20T00:00:00.000Z',
    });
  });
});
