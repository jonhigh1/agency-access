import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getMarketingStats } from '../marketing-stats';

const fetchMock = vi.fn();

describe('getMarketingStats', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the aggregate envelope and pins the hourly revalidate policy', async () => {
    const payload = {
      agencies: 12,
      activeClientConnections: 140,
      activePlatformAuthorizations: 380,
      completedAccessRequests: 220,
      tokenRefreshes: 5100,
    };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: payload, error: null }) });

    await expect(getMarketingStats()).resolves.toEqual(payload);

    const [url, init] = fetchMock.mock.calls[0];
    expect(init.next).toEqual({ revalidate: 3600, tags: ['marketing-stats'] });
    expect(String(url)).toContain('/api/marketing-stats');
    expect(init.signal).toBeDefined();
  });

  it('returns null for a non-OK response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(getMarketingStats()).resolves.toBeNull();
  });

  it('returns null when the envelope carries null data', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: null, error: {} }) });

    await expect(getMarketingStats()).resolves.toBeNull();
  });

  it('returns null when the fetch throws (API unreachable at build time)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(getMarketingStats()).resolves.toBeNull();
  });
});
