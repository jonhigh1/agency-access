import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { accessRequestRoutes } from '../access-requests';
import * as accessRequestService from '@/services/access-request.service';
import * as authorization from '@/lib/authorization.js';

vi.mock('@/services/access-request.service');
vi.mock('@/lib/authorization.js');
vi.mock('@/services/quota.service', () => ({
  quotaService: {
    checkQuota: vi.fn().mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 100,
      remaining: 100,
      metric: 'access_requests',
    }),
  },
  QuotaExceededError: class extends Error {
    toJSON() {
      return { error: { code: 'QUOTA_EXCEEDED', message: 'Quota exceeded' } };
    }
  },
}));
vi.mock('@/services/agency-platform.service', () => ({
  agencyPlatformService: {
    getConnections: vi.fn(),
  },
}));

vi.mock('@/middleware/auth.js', () => ({
  authenticate: () => async (request: any, reply: any) => {
    if (!request.headers.authorization) {
      return reply.code(401).send({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Missing token' },
      });
    }
    request.user = { sub: 'user_123' };
  },
}));

describe('Access Requests Routes - Security', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(accessRequestRoutes);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 for protected route when Authorization header is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/agencies/agency-1/access-requests',
    });

    expect(response.statusCode).toBe(401);
  });

  it('uses principal agency for creation even if a different agencyId is provided', async () => {
    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: { agencyId: 'agency-owner', principalId: 'user_123' },
      error: null,
    });
    vi.mocked(accessRequestService.createAccessRequest).mockResolvedValue({
      data: {
        id: 'req-1',
        agencyId: 'agency-owner',
        uniqueToken: 'token-1',
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/access-requests',
      headers: { authorization: 'Bearer token' },
      payload: {
        agencyId: 'agency-other',
        clientName: 'Client',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(accessRequestService.createAccessRequest).toHaveBeenCalledWith(
      expect.objectContaining({ agencyId: 'agency-owner' }),
      expect.anything()
    );
  });
});
