import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { apiKeyRoutes } from '../api-keys';
import * as apiKeyService from '@/services/api-key.service';

vi.mock('@/services/api-key.service');
vi.mock('@/lib/authorization.js', () => ({
  resolveAuthenticatedUserEmail: vi.fn().mockResolvedValue('admin@acme.co'),
  resolvePrincipalAgency: vi.fn().mockResolvedValue({
    data: {
      agencyId: 'agency-1',
      principalId: 'user_123',
      agency: { id: 'agency-1', name: 'Acme', email: 'a@acme.co' },
    },
    error: null,
  }),
  assertAgencyAccess: vi.fn().mockReturnValue(null),
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

const ISSUED = {
  key: {
    id: 'key-1',
    agencyId: 'agency-1',
    familyId: 'fam-1',
    name: 'crm',
    prefix: 'ah_live_abc1',
    scopes: ['clients:read'],
    createdBy: 'admin@acme.co',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    isActive: true,
  },
  apiKey: 'ah_live_abc1supersecretvalue',
};

describe('API Key Dashboard Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(apiKeyRoutes);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('issue returns the secret exactly once', async () => {
    vi.mocked(apiKeyService.issueApiKey).mockResolvedValue({
      data: ISSUED,
      error: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api-keys',
      headers: { authorization: 'Bearer jwt_session' },
      payload: { name: 'crm', scopes: ['clients:read'] },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.apiKey).toBe(ISSUED.apiKey);
    expect(body.data.key.id).toBe('key-1');
  });

  it('listing never includes secret material', async () => {
    const { apiKey: _secret, ...metadataOnly } = ISSUED;
    void _secret;
    vi.mocked(apiKeyService.listApiKeys).mockResolvedValue({
      data: { keys: [metadataOnly.key] },
      error: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api-keys',
      headers: { authorization: 'Bearer jwt_session' },
    });

    expect(response.statusCode).toBe(200);
    const raw = response.body;
    expect(raw).not.toContain('supersecretvalue');
    expect(raw).not.toContain('keyHash');
    expect(response.json().data.keys[0]).not.toHaveProperty('apiKey');
  });

  it('issue rejects unknown scopes with the field named', async () => {
    vi.mocked(apiKeyService.issueApiKey).mockResolvedValue({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Unknown scope: noodle:read' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api-keys',
      headers: { authorization: 'Bearer jwt_session' },
      payload: { name: 'crm', scopes: ['noodle:read'] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('eleventh key fails with the cap code', async () => {
    vi.mocked(apiKeyService.issueApiKey).mockResolvedValue({
      data: null,
      error: { code: 'API_KEY_LIMIT_EXCEEDED', message: 'Key limit reached' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api-keys',
      headers: { authorization: 'Bearer jwt_session' },
      payload: { name: 'extra', scopes: [] },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('API_KEY_LIMIT_EXCEEDED');
  });

  it('revoke takes immediate effect', async () => {
    vi.mocked(apiKeyService.revokeApiKey).mockResolvedValue({
      data: { revoked: true },
      error: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api-keys/key-1/revoke',
      headers: { authorization: 'Bearer jwt_session' },
    });

    expect(response.statusCode).toBe(200);
    expect(apiKeyService.revokeApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ agencyId: 'agency-1', keyId: 'key-1' })
    );
  });

  it('rotate returns a replacement secret once', async () => {
    vi.mocked(apiKeyService.rotateApiKey).mockResolvedValue({
      data: { key: ISSUED.key, apiKey: 'ah_live_newsecret' },
      error: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api-keys/key-1/rotate',
      headers: { authorization: 'Bearer jwt_session' },
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.apiKey).toBe('ah_live_newsecret');
  });

  it('family revoke kills every active key in the family', async () => {
    vi.mocked(apiKeyService.revokeApiKeyFamily).mockResolvedValue({
      data: { revokedCount: 2 },
      error: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api-keys/families/fam-1/revoke',
      headers: { authorization: 'Bearer jwt_session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.revokedCount).toBe(2);
  });
});
