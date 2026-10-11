import { describe, it, expect, beforeEach, vi } from 'vitest';

const { agencyCount, clientConnectionCount, platformAuthorizationCount, accessRequestCount, auditLogCount } =
  vi.hoisted(() => ({
    agencyCount: vi.fn(),
    clientConnectionCount: vi.fn(),
    platformAuthorizationCount: vi.fn(),
    accessRequestCount: vi.fn(),
    auditLogCount: vi.fn(),
  }));

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    agency: { count: agencyCount },
    clientConnection: { count: clientConnectionCount },
    platformAuthorization: { count: platformAuthorizationCount },
    accessRequest: { count: accessRequestCount },
    auditLog: { count: auditLogCount },
  },
}));

import { getMarketingStats } from '../marketing-stats.service';

describe('getMarketingStats', () => {
  beforeEach(() => {
    [agencyCount, clientConnectionCount, platformAuthorizationCount, accessRequestCount, auditLogCount].forEach(
      (m) => m.mockReset(),
    );
    agencyCount.mockResolvedValue(12);
    clientConnectionCount.mockResolvedValue(140);
    platformAuthorizationCount.mockResolvedValue(380);
    accessRequestCount.mockResolvedValue(220);
    auditLogCount.mockResolvedValue(5100);
  });

  it('counts active connections, active authorizations, completed requests and token refreshes', async () => {
    const { data, error } = await getMarketingStats();

    expect(error).toBeNull();
    expect(data).toEqual({
      agencies: 12,
      activeClientConnections: 140,
      activePlatformAuthorizations: 380,
      completedAccessRequests: 220,
      tokenRefreshes: 5100,
    });
    expect(clientConnectionCount).toHaveBeenCalledWith({ where: { status: 'active' } });
    expect(platformAuthorizationCount).toHaveBeenCalledWith({ where: { status: 'active' } });
    expect(accessRequestCount).toHaveBeenCalledWith({ where: { status: 'completed' } });
    expect(auditLogCount).toHaveBeenCalledWith({ where: { action: 'REFRESHED' } });
  });

  it('returns an INTERNAL_ERROR envelope when any count fails', async () => {
    platformAuthorizationCount.mockRejectedValue(new Error('db down'));

    const { data, error } = await getMarketingStats();

    expect(data).toBeNull();
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
