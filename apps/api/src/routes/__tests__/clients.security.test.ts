import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { clientRoutes } from '../clients';
import * as authorization from '@/lib/authorization.js';
import { deleteClient } from '@/services/client.service';

vi.mock('@/lib/authorization.js');
vi.mock('@/services/client.service', () => ({
  createClient: vi.fn(),
  getClients: vi.fn(),
  getClientById: vi.fn(),
  updateClient: vi.fn(),
  findClientByEmail: vi.fn(),
  deleteClient: vi.fn(),
  getClientsWithConnections: vi.fn().mockResolvedValue([]),
  getClientDetail: vi.fn(),
  ClientError: class extends Error {},
}));
vi.mock('@/services/quota.service', () => ({
  quotaService: {
    checkQuota: vi.fn().mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 100,
      remaining: 100,
      metric: 'clients',
    }),
  },
  QuotaExceededError: class extends Error {
    toJSON() {
      return { error: { code: 'QUOTA_EXCEEDED', message: 'Quota exceeded' } };
    }
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

describe('Client Routes - Security', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(clientRoutes);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/clients',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 403 when principal agency cannot be resolved', async () => {
    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'Unable to resolve agency for authenticated user',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/clients',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('derives the delete actor from the authenticated identity, not the request body', async () => {
    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: { agencyId: 'agency-owner', principalId: 'user_123' },
      error: null,
    } as any);
    vi.mocked(authorization.resolveAuthenticatedUserEmail).mockResolvedValue('owner@example.com');
    vi.mocked(deleteClient).mockResolvedValue({ id: 'client-1' } as any);

    const response = await app.inject({
      method: 'DELETE',
      url: '/clients/client-1',
      headers: { authorization: 'Bearer token' },
      payload: { userEmail: 'forged@example.com' },
    });

    expect(response.statusCode).toBe(204);
    expect(deleteClient).toHaveBeenCalledWith('client-1', 'agency-owner', {
      userEmail: 'owner@example.com',
      ipAddress: expect.any(String),
    });
  });

  it('rejects client delete when no verified email is available', async () => {
    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: { agencyId: 'agency-owner', principalId: 'user_123' },
      error: null,
    } as any);
    vi.mocked(authorization.resolveAuthenticatedUserEmail).mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: 'DELETE',
      url: '/clients/client-1',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('USER_EMAIL_REQUIRED');
    expect(deleteClient).not.toHaveBeenCalled();
  });
});

