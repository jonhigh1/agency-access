import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agencyPlatformsRoutes } from '../agency-platforms';
import * as authorization from '../../lib/authorization.js';
import { agencyPlatformService } from '../../services/agency-platform.service.js';
import { metaAssetsService } from '../../services/meta-assets.service.js';
import { identityVerificationService } from '../../services/identity-verification.service.js';
import { prisma } from '../../lib/prisma.js';

vi.mock('../../lib/authorization.js');
vi.mock('../../services/agency-platform.service.js', () => ({
  agencyPlatformService: {
    getConnections: vi.fn(),
    revokeConnection: vi.fn(),
  },
}));
vi.mock('../../services/meta-assets.service.js', () => ({
  metaAssetsService: {
    saveBusinessPortfolio: vi.fn(),
  },
}));
vi.mock('../../services/identity-verification.service.js', () => ({
  identityVerificationService: {
    createIdentityConnection: vi.fn(),
  },
}));
vi.mock('../../services/connectors/meta.js', () => ({
  MetaConnector: vi.fn(),
}));
vi.mock('../../services/connectors/google.js', () => ({
  GoogleConnector: vi.fn(),
}));
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    agencyPlatformConnection: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));
vi.mock('../../middleware/auth.js', () => ({
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

describe('Agency Platforms Routes - Security', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(agencyPlatformsRoutes);
    vi.clearAllMocks();
    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: { agencyId: 'agency-owner', principalId: 'user_123' },
      error: null,
    } as any);
    vi.mocked(authorization.assertAgencyAccess).mockImplementation((requested, principal) => {
      if (requested !== principal) {
        return {
          code: 'FORBIDDEN',
          message: 'You do not have access to this agency resource',
        };
      }
      return null;
    });
    vi.mocked(authorization.resolveAuthenticatedUserEmail).mockResolvedValue('owner@example.com');
    vi.mocked(identityVerificationService.createIdentityConnection).mockResolvedValue({
      data: { id: 'identity-1' },
      error: null,
    } as any);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/agency-platforms?agencyId=agency-1',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 403 when requested agency differs from principal agency', async () => {
    vi.mocked(authorization.assertAgencyAccess).mockReturnValueOnce({
      code: 'FORBIDDEN',
      message: 'You do not have access to this agency resource',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/agency-platforms?agencyId=agency-other',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
    expect(agencyPlatformService.getConnections).not.toHaveBeenCalled();
  });

  it('returns 404 for meta complete-oauth when connectionId is not owned by agency', async () => {
    vi.mocked(metaAssetsService.saveBusinessPortfolio).mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'conn-1',
      agencyId: 'agency-other',
      platform: 'meta',
      secretId: 'secret-other',
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(null as any);

    const response = await app.inject({
      method: 'POST',
      url: '/agency-platforms/meta/complete-oauth',
      headers: { authorization: 'Bearer token' },
      payload: {
        agencyId: 'agency-owner',
        businessId: 'biz-1',
        businessName: 'Biz',
        connectionId: 'conn-1',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('CONNECTION_NOT_FOUND');
  });

  it('does not expose an endpoint that marks an identity verified without provider evidence', async () => {
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'conn-1',
      agencyId: 'agency-owner',
      platform: 'meta',
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
      id: 'conn-1',
      agencyId: 'agency-owner',
      platform: 'meta',
    } as any);
    const response = await app.inject({
      method: 'PUT',
      url: '/agency-platforms/conn-1/verify',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(404);
    expect(prisma.agencyPlatformConnection.findFirst).not.toHaveBeenCalled();
  });

  it('derives the identity audit actor from authenticated claims', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/agency-platforms/identity',
      headers: { authorization: 'Bearer token' },
      payload: {
        agencyId: 'agency-owner',
        platform: 'google',
        agencyEmail: 'access@agency.example',
        connectedBy: 'forged@example.com',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(identityVerificationService.createIdentityConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-owner',
        connectedBy: 'owner@example.com',
      })
    );
  });

  it('rejects identity creation when the authenticated claim has no email', async () => {
    vi.mocked(authorization.resolveAuthenticatedUserEmail).mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/agency-platforms/identity',
      headers: { authorization: 'Bearer token' },
      payload: {
        agencyId: 'agency-owner',
        platform: 'google',
        agencyEmail: 'access@agency.example',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('USER_EMAIL_REQUIRED');
    expect(identityVerificationService.createIdentityConnection).not.toHaveBeenCalled();
  });

  it('derives the revoke actor from the authenticated identity, not the request body', async () => {
    vi.mocked(agencyPlatformService.revokeConnection).mockResolvedValue({
      data: { id: 'conn-1', platform: 'meta', revokedBy: 'owner@example.com' },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'DELETE',
      url: '/agency-platforms/meta',
      headers: { authorization: 'Bearer token' },
      payload: {
        agencyId: 'agency-owner',
        revokedBy: 'forged@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(agencyPlatformService.revokeConnection).toHaveBeenCalledWith(
      'agency-owner',
      'meta',
      'owner@example.com',
      expect.objectContaining({ ipAddress: expect.any(String) })
    );
  });

  it('rejects platform revoke when no verified email is available', async () => {
    vi.mocked(authorization.resolveAuthenticatedUserEmail).mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: 'DELETE',
      url: '/agency-platforms/meta',
      headers: { authorization: 'Bearer token' },
      payload: { agencyId: 'agency-owner' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('USER_EMAIL_REQUIRED');
    expect(agencyPlatformService.revokeConnection).not.toHaveBeenCalled();
  });
});
