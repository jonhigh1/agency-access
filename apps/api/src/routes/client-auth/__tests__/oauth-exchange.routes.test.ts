/**
 * Characterization tests for the two OAuth exchange endpoints.
 *
 * These record the current HTTP contract (status codes + exact response
 * bodies) of both POST /client/:token/oauth-exchange and
 * POST /client/oauth-exchange BEFORE the handlers are merged into a single
 * implementation. They must pass unmodified before and after the merge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerOAuthExchangeRoutes } from '../oauth-exchange.routes.js';
import { oauthStateService } from '@/services/oauth-state.service';
import { auditService } from '@/services/audit.service';
import { getConnector } from '@/services/connectors/factory';
import { infisical } from '@/lib/infisical';
import { prisma } from '@/lib/prisma';

vi.mock('@/services/oauth-state.service', () => ({
  oauthStateService: { validateState: vi.fn() },
}));

vi.mock('@/services/audit.service', () => ({
  auditService: { createAuditLog: vi.fn() },
}));

vi.mock('@/services/connectors/factory', () => ({
  getConnector: vi.fn(),
}));

vi.mock('@/lib/infisical', () => ({
  infisical: {
    generateSecretName: vi.fn(() => 'secret/agency-access/test-platform/conn-1'),
    storeOAuthTokens: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    accessRequest: { findUnique: vi.fn() },
    clientConnection: { findFirst: vi.fn(), create: vi.fn() },
    platformAuthorization: { upsert: vi.fn() },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:3000',
  },
}));

const TOKENED_URL = '/client/token-123/oauth-exchange';
const STATIC_URL = '/client/oauth-exchange';

const BASE_STATE = {
  accessRequestId: 'req-1',
  accessRequestToken: 'token-123',
  platform: 'google',
  clientEmail: 'client@example.com',
};

const ACCESS_REQUEST = {
  id: 'req-1',
  agencyId: 'agency-1',
  uniqueToken: 'unique-token-1',
};

const TOKENS = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: new Date('2026-01-01T00:00:00.000Z'),
};

const CONNECTED_CONNECTION = { id: 'conn-1' };
const PLATFORM_AUTH = { id: 'auth-1' };

function mockHappyPath(overrides?: {
  state?: Record<string, unknown>;
  connection?: unknown;
  connector?: Record<string, unknown>;
}) {
  vi.mocked(oauthStateService.validateState).mockResolvedValue({
    data: { ...BASE_STATE, ...overrides?.state } as any,
    error: null,
  });

  vi.mocked(getConnector).mockReturnValue({
    exchangeCode: vi.fn().mockResolvedValue(TOKENS),
    getUserInfo: vi.fn().mockResolvedValue({ id: 'user-1', name: 'Test User' }),
    ...overrides?.connector,
  } as any);

  vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(ACCESS_REQUEST as any);
  vi.mocked(prisma.clientConnection.findFirst).mockResolvedValue(
    (overrides?.connection ?? null) as any
  );
  vi.mocked(prisma.clientConnection.create).mockResolvedValue(CONNECTED_CONNECTION as any);
  vi.mocked(prisma.platformAuthorization.upsert).mockResolvedValue(PLATFORM_AUTH as any);
  vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);
}

describe('OAuth exchange routes (characterization)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify({ logger: false });
    await registerOAuthExchangeRoutes(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('shared contract for both endpoints', () => {
    for (const [label, url] of [
      ['tokened endpoint', TOKENED_URL],
      ['static endpoint', STATIC_URL],
    ] as const) {
      describe(label, () => {
        it('returns 400 VALIDATION_ERROR body for an invalid payload', async () => {
          const response = await app.inject({
            method: 'POST',
            url,
            payload: { platform: 'google' },
          });

          expect(response.statusCode).toBe(400);
          expect(response.json()).toEqual({
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid OAuth exchange data',
              details: expect.any(Array),
            },
          });
        });

        it('returns 400 INVALID_STATE body when state validation fails', async () => {
          vi.mocked(oauthStateService.validateState).mockResolvedValue({
            data: null,
            error: { code: 'INVALID_STATE', message: 'Invalid or expired' },
          });

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(response.statusCode).toBe(400);
          expect(response.json()).toEqual({
            data: null,
            error: {
              code: 'INVALID_STATE',
              message: 'Invalid or expired OAuth state token',
            },
          });
        });

        it('returns 400 PLATFORM_MISMATCH body when payload platform differs from state', async () => {
          vi.mocked(oauthStateService.validateState).mockResolvedValue({
            data: { ...BASE_STATE, platform: 'google' } as any,
            error: null,
          });

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1', platform: 'meta_ads' },
          });

          expect(response.statusCode).toBe(400);
          expect(response.json()).toEqual({
            data: null,
            error: {
              code: 'PLATFORM_MISMATCH',
              message: 'Platform does not match OAuth state',
            },
          });
        });

        it('returns 404 ACCESS_REQUEST_NOT_FOUND body when the access request is gone', async () => {
          mockHappyPath();
          vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(null);

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(response.statusCode).toBe(404);
          expect(response.json()).toEqual({
            data: null,
            error: {
              code: 'ACCESS_REQUEST_NOT_FOUND',
              message: 'Access request not found',
            },
          });
        });

        it('returns the sanitized 500 body when token exchange fails', async () => {
          mockHappyPath();
          vi.mocked(getConnector).mockReturnValue({
            exchangeCode: vi.fn().mockRejectedValue(new Error('invalid_grant returned')),
            getUserInfo: vi.fn(),
          } as any);

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(response.statusCode).toBe(500);
          expect(response.json()).toEqual({
            data: null,
            error: {
              code: 'OAUTH_INVALID_GRANT',
              message:
                'Authorization code is invalid or expired. Please restart the authorization process.',
            },
          });
        });

        it('returns the exact success body and persists tokens via infisical', async () => {
          mockHappyPath();

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(response.statusCode).toBe(200);
          expect(response.json()).toEqual({
            data: {
              connectionId: 'conn-1',
              platform: 'google',
              token: 'token-123',
            },
            error: null,
          });

          expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
            'secret/agency-access/test-platform/conn-1',
            {
              accessToken: 'access-1',
              refreshToken: 'refresh-1',
              expiresAt: TOKENS.expiresAt,
            }
          );
          expect(auditService.createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
              agencyId: 'agency-1',
              action: 'CLIENT_AUTHORIZED',
              userEmail: 'client@example.com',
            })
          );
        });

        it('exchanges the long-lived token for meta platforms before persisting', async () => {
          mockHappyPath({
            state: { platform: 'meta_ads' },
            connector: {
              getLongLivedToken: vi.fn().mockResolvedValue({
                accessToken: 'long-lived-1',
                refreshToken: 'refresh-1',
                expiresAt: TOKENS.expiresAt,
              }),
            },
          });

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1', platform: 'meta_ads' },
          });

          expect(response.statusCode).toBe(200);
          expect(response.json()).toEqual({
            data: {
              connectionId: 'conn-1',
              platform: 'meta_ads',
              token: 'token-123',
            },
            error: null,
          });
          expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ accessToken: 'long-lived-1' })
          );
        });

        it('writes the extra TIKTOK_TOKEN_EXCHANGED audit log for tiktok platforms', async () => {
          mockHappyPath({ state: { platform: 'tiktok_ads' } });

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(response.statusCode).toBe(200);
          expect(auditService.createAuditLog).toHaveBeenCalledTimes(2);
          expect(auditService.createAuditLog).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ action: 'TIKTOK_TOKEN_EXCHANGED' })
          );
        });

        it('persists the snapchat discovery contract as platform authorization metadata', async () => {
          const SNAP_USER_INFO = {
            id: 'snap-user-1',
            email: 'client@example.com',
            name: 'Snap User',
            organizations: [
              {
                id: 'org-1',
                name: 'Snap Org',
                state: 'ACTIVE',
                roles: ['ORGANIZATION_ADMIN'],
                isAgency: false,
                adAccounts: [
                  {
                    id: 'acct-1',
                    name: 'Main Account',
                    status: 'ACTIVE',
                    currency: 'USD',
                    timezone: 'America/Los_Angeles',
                    roles: ['AD_ACCOUNT_ADMIN'],
                  },
                ],
              },
            ],
            adAccountCount: 1,
            role: 'ORGANIZATION_ADMIN',
            discoveryFailed: false,
            orgStatus: 'COMPLETED',
          };

          mockHappyPath({
            state: { platform: 'snapchat' },
            connector: { getUserInfo: vi.fn().mockResolvedValue(SNAP_USER_INFO) },
          });

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1', platform: 'snapchat' },
          });

          expect(response.statusCode).toBe(200);
          expect(response.json()).toEqual({
            data: {
              connectionId: 'conn-1',
              platform: 'snapchat',
              token: 'token-123',
            },
            error: null,
          });

          expect(prisma.clientConnection.create).toHaveBeenCalledWith({
            data: {
              accessRequestId: 'req-1',
              agencyId: 'agency-1',
              clientEmail: 'client@example.com',
              status: 'active',
            },
          });

          expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ accessToken: 'access-1' })
          );

          expect(prisma.platformAuthorization.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
              where: {
                connectionId_platform: { connectionId: 'conn-1', platform: 'snapchat' },
              },
              create: expect.objectContaining({
                platform: 'snapchat',
                metadata: expect.objectContaining({
                  organizations: SNAP_USER_INFO.organizations,
                  adAccountCount: 1,
                  role: 'ORGANIZATION_ADMIN',
                  discoveryFailed: false,
                  orgStatus: 'COMPLETED',
                }),
              }),
              update: expect.objectContaining({
                metadata: expect.objectContaining({
                  adAccountCount: 1,
                  role: 'ORGANIZATION_ADMIN',
                  discoveryFailed: false,
                }),
              }),
            })
          );

          // CLIENT_AUTHORIZED only: no snapchat-specific audit action exists
          // (the TIKTOK_TOKEN_EXCHANGED precedent stays unique).
          expect(auditService.createAuditLog).toHaveBeenCalledTimes(1);
          expect(auditService.createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
              agencyId: 'agency-1',
              action: 'CLIENT_AUTHORIZED',
              userEmail: 'client@example.com',
              resourceType: 'client_connection',
              resourceId: 'conn-1',
              metadata: expect.objectContaining({
                platform: 'snapchat',
                accessRequestId: 'req-1',
                platformAuthId: 'auth-1',
              }),
            })
          );
        });

        it('creates the client connection when none exists yet', async () => {
          mockHappyPath();

          await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(prisma.clientConnection.create).toHaveBeenCalledWith({
            data: {
              accessRequestId: 'req-1',
              agencyId: 'agency-1',
              clientEmail: 'client@example.com',
              status: 'active',
            },
          });
          expect(prisma.platformAuthorization.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
              where: {
                connectionId_platform: { connectionId: 'conn-1', platform: 'google' },
              },
            })
          );
        });

        it('prefers the stored redirectUrl over the default callback', async () => {
          const connector = {
            exchangeCode: vi.fn().mockResolvedValue(TOKENS),
            getUserInfo: vi.fn().mockResolvedValue({ id: 'user-1' }),
          };
          vi.mocked(oauthStateService.validateState).mockResolvedValue({
            data: {
              ...BASE_STATE,
              redirectUrl: 'https://app.example.com/invite/oauth-callback',
            } as any,
            error: null,
          });
          vi.mocked(getConnector).mockReturnValue(connector as any);
          vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(ACCESS_REQUEST as any);
          vi.mocked(prisma.clientConnection.findFirst).mockResolvedValue(null);
          vi.mocked(prisma.clientConnection.create).mockResolvedValue(CONNECTED_CONNECTION as any);
          vi.mocked(prisma.platformAuthorization.upsert).mockResolvedValue(PLATFORM_AUTH as any);
          vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

          await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(connector.exchangeCode).toHaveBeenCalledWith(
            'code-1',
            'https://app.example.com/invite/oauth-callback'
          );
        });
      });
    }
  });

  describe('tokened endpoint specifics (POST /client/:token/oauth-exchange)', () => {
    it('falls back to the access request uniqueToken when state has no token', async () => {
      mockHappyPath({ state: { accessRequestToken: undefined } });

      const response = await app.inject({
        method: 'POST',
        url: TOKENED_URL,
        payload: { code: 'code-1', state: 'state-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: {
          connectionId: 'conn-1',
          platform: 'google',
          token: 'unique-token-1',
        },
        error: null,
      });
    });
  });

  describe('static endpoint specifics (POST /client/oauth-exchange)', () => {
    it('returns 400 MISSING_TOKEN body when state has no access request token', async () => {
      mockHappyPath({ state: { accessRequestToken: undefined } });

      const response = await app.inject({
        method: 'POST',
        url: STATIC_URL,
        payload: { code: 'code-1', state: 'state-1' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        data: null,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access request token not found in OAuth state',
        },
      });
    });
  });
});
