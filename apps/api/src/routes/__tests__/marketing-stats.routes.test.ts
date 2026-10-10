import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

const { getMarketingStatsMock, getCachedMock } = vi.hoisted(() => ({
  getMarketingStatsMock: vi.fn(),
  getCachedMock: vi.fn(),
}));

vi.mock('@/services/marketing-stats.service', () => ({
  getMarketingStats: getMarketingStatsMock,
}));

vi.mock('@/lib/cache', () => ({
  getCached: getCachedMock,
  CacheKeys: { marketingStats: () => 'marketing-stats:global' },
}));

import { marketingStatsRoutes } from '../marketing-stats';

const PAYLOAD = {
  agencies: 12,
  activeClientConnections: 140,
  activePlatformAuthorizations: 380,
  completedAccessRequests: 220,
  tokenRefreshes: 5100,
};

async function buildApp() {
  const app = Fastify();
  await app.register(marketingStatsRoutes);
  return app;
}

describe('GET /marketing-stats (public aggregate counters)', () => {
  beforeEach(() => {
    getMarketingStatsMock.mockReset();
    getCachedMock.mockReset();
  });

  it('is public and returns the aggregate envelope with a 1h cache policy', async () => {
    getCachedMock.mockResolvedValue({ data: PAYLOAD, error: null });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/marketing-stats' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: PAYLOAD, error: null });
    expect(getCachedMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'marketing-stats:global', ttl: 3600 }),
    );
  });

  it('returns a 500 error envelope when the aggregate fails', async () => {
    getCachedMock.mockResolvedValue({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve marketing stats' },
    });

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/marketing-stats' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve marketing stats' },
    });
  });

  it('passes the service result through the cache layer without auth headers', async () => {
    getMarketingStatsMock.mockResolvedValue({ data: PAYLOAD, error: null });
    getCachedMock.mockImplementation(async ({ fetch }: { fetch: () => Promise<any> }) => fetch());

    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/marketing-stats' });

    expect(getMarketingStatsMock).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(PAYLOAD);
  });
});
