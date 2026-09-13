import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

import { tokenHealthRoutes } from '../token-health.js';
import { connectionService } from '@/services/connection.service.js';
import * as authorization from '@/lib/authorization.js';
import { prisma } from '@/lib/prisma.js';

vi.mock('@/services/connection.service.js', () => ({
  connectionService: {
    getAgencyTokenHealth: vi.fn(),
    getAgencyConnections: vi.fn(),
    getAgencyConnectionSummaries: vi.fn(),
    getConnection: vi.fn(),
    revokeConnection: vi.fn(),
    refreshPlatformAuthorization: vi.fn(),
    revokePlatformAuthorization: vi.fn(),
  },
}));
vi.mock('@/lib/authorization.js');
vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    clientConnection: {
      findFirst: vi.fn(),
    },
    platformAuthorization: {
      findUnique: vi.fn(),
    },
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
    request.user = { sub: 'user_123', email: 'owner@example.com' };
  },
}));

describe('Token health routes - security', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(tokenHealthRoutes);
    vi.clearAllMocks();
    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: { agencyId: 'agency-owner', principalId: 'user_123', agency: { id: 'agency-owner', name: 'Owner', email: 'owner@example.com' } },
      error: null,
    });
    vi.mocked(connectionService.getAgencyTokenHealth).mockResolvedValue({ data: [], error: null } as any);
    vi.mocked(connectionService.getAgencyConnections).mockResolvedValue({ data: [], error: null } as any);
    vi.mocked(connectionService.getAgencyConnectionSummaries).mockResolvedValue({ data: [], error: null } as any);
    vi.mocked(connectionService.getConnection).mockResolvedValue({ data: { id: 'conn-1' }, error: null } as any);
    vi.mocked(connectionService.revokeConnection).mockResolvedValue({ data: { id: 'conn-1' }, error: null } as any);
    vi.mocked(connectionService.refreshPlatformAuthorization).mockResolvedValue({ data: { id: 'auth-1' }, error: null } as any);
    vi.mocked(connectionService.revokePlatformAuthorization).mockResolvedValue({ data: { id: 'auth-1' }, error: null } as any);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects token health requests without authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/token-health?agencyId=agency-other',
    });

    expect(response.statusCode).toBe(401);
    expect(connectionService.getAgencyTokenHealth).not.toHaveBeenCalled();
  });

  it('ignores caller-supplied agencyId and uses the resolved principal agency', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/token-health?agencyId=agency-other',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(connectionService.getAgencyTokenHealth).toHaveBeenCalledWith('agency-owner');
  });

  it('blocks refresh for a connection outside the principal agency before touching tokens', async () => {
    vi.mocked(prisma.clientConnection.findFirst).mockResolvedValue(null as any);

    const response = await app.inject({
      method: 'POST',
      url: '/token-refresh',
      headers: { authorization: 'Bearer token' },
      payload: { connectionId: 'conn-other', platform: 'meta' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('CONNECTION_NOT_FOUND');
    expect(connectionService.refreshPlatformAuthorization).not.toHaveBeenCalled();
  });

  it('blocks authorization revoke when the authorization connection is outside the principal agency', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-other',
      connectionId: 'conn-other',
      platform: 'meta',
      connection: { agencyId: 'agency-other' },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/authorizations/auth-other/revoke',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('AUTHORIZATION_NOT_FOUND');
    expect(connectionService.revokePlatformAuthorization).not.toHaveBeenCalled();
  });

  it('lists connections as summaries with a default limit of 50', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/connections',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(connectionService.getAgencyConnectionSummaries).toHaveBeenCalledWith(
      'agency-owner',
      expect.objectContaining({ limit: 50, offset: 0 })
    );
    expect(connectionService.getAgencyConnections).not.toHaveBeenCalled();
  });

  it('rejects an oversized connections list limit with VALIDATION_ERROR', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/connections?limit=500',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      data: null,
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR',
      }),
    });
    expect(connectionService.getAgencyConnectionSummaries).not.toHaveBeenCalled();
  });
});
