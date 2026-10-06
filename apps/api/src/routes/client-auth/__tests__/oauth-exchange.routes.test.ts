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
import { accessRequestService } from '@/services/access-request.service';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    markRequestAuthorized: vi.fn().mockResolvedValue({ data: {}, error: null }),
    setAccessRequestLifecycleStatus: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
}));

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
    deleteOAuthTokens: vi.fn(),
    deleteSecret: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    accessRequest: { findUnique: vi.fn() },
    clientConnection: { findFirst: vi.fn(), create: vi.fn() },
    platformAuthorization: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    metaAssetGrant: { updateMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
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
  status: 'active',
  expiresAt: new Date('2027-01-01T00:00:00.000Z'),
  // Raw stored shape: flat rows keyed by product. Covers every platform the
  // characterization suite exercises (google, meta_ads, tiktok_ads, snapchat).
  platforms: [
    { platform: 'google_ads', accessLevel: 'manage' },
    { platform: 'meta_ads', accessLevel: 'manage' },
    { platform: 'tiktok_ads', accessLevel: 'manage' },
    { platform: 'snapchat_ads', accessLevel: 'manage' },
  ],
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
  vi.mocked(infisical.storeOAuthTokens).mockResolvedValue('secret-id');
  vi.mocked(oauthStateService.validateState).mockResolvedValue({
    data: { ...BASE_STATE, ...overrides?.state } as any,
    error: null,
  });

  vi.mocked(getConnector).mockReturnValue({
    exchangeCode: vi.fn().mockResolvedValue(TOKENS),
    getUserInfo: vi.fn().mockResolvedValue({ id: 'user-1', name: 'Test User' }),
    getTokenMetadata: vi.fn().mockResolvedValue({ scopes: [], isValid: true }),
    ...overrides?.connector,
  } as any);

  vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(ACCESS_REQUEST as any);
  vi.mocked(prisma.clientConnection.findFirst).mockResolvedValue(
    (overrides?.connection ?? null) as any
  );
  vi.mocked(prisma.clientConnection.create).mockResolvedValue(CONNECTED_CONNECTION as any);
  vi.mocked(prisma.platformAuthorization.upsert).mockResolvedValue(PLATFORM_AUTH as any);
  vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.$queryRaw).mockResolvedValue([] as any);
  vi.mocked(prisma.metaAssetGrant.updateMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
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

        it('reloads the connection after a concurrent create conflict', async () => {
          mockHappyPath();
          vi.mocked(prisma.clientConnection.findFirst)
            .mockResolvedValueOnce(null as any)
            .mockResolvedValueOnce(CONNECTED_CONNECTION as any);
          vi.mocked(prisma.clientConnection.create).mockRejectedValue({ code: 'P2002' });

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(response.statusCode).toBe(200);
          expect(response.json().data).toMatchObject({ connectionId: 'conn-1', platform: 'google' });
          expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ accessToken: 'access-1' })
          );
        });

        it.each([
          [{ status: 'revoked' }, 'REQUEST_REVOKED', 'Access request has been revoked'],
          [{ status: 'expired' }, 'REQUEST_EXPIRED', 'Access request has expired'],
          [{ expiresAt: new Date('2020-01-01T00:00:00.000Z') }, 'REQUEST_EXPIRED', 'Access request has expired'],
        ] as const)('rejects an inactive request before exchanging the code', async (requestPatch, code, message) => {
          mockHappyPath();
          vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
            ...ACCESS_REQUEST,
            ...requestPatch,
          } as any);
          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(response.statusCode).toBe(404);
          expect(response.json()).toEqual({ data: null, error: { code, message } });
          expect(getConnector).not.toHaveBeenCalled();
          expect(infisical.storeOAuthTokens).not.toHaveBeenCalled();
        });

        it('returns the sanitized 500 body when token exchange fails', async () => {
          mockHappyPath();
          const rawSecret = 'oauth-code-secret';
          vi.mocked(getConnector).mockReturnValue({
            exchangeCode: vi.fn().mockRejectedValue(new Error(`invalid_grant returned ${rawSecret}`)),
            getUserInfo: vi.fn(),
          } as any);
          const errorLog = vi.spyOn(app.log, 'error');

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
          expect(errorLog).toHaveBeenCalledWith(
            { errorName: 'Error', errorCode: 'OAUTH_INVALID_GRANT' },
            'OAuth exchange failed'
          );
          expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawSecret);
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
          const getTokenMetadata = vi.fn().mockResolvedValue({
            scopes: ['pages_show_list', 'pages_read_engagement'],
            expiresAt: TOKENS.expiresAt,
            userId: 'meta-user-1',
            isValid: true,
          });
          mockHappyPath({
            state: { platform: 'meta_ads' },
            connector: {
              getLongLivedToken: vi.fn().mockResolvedValue({
                accessToken: 'long-lived-1',
                refreshToken: 'refresh-1',
                expiresAt: TOKENS.expiresAt,
              }),
              getTokenMetadata,
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
          expect(getTokenMetadata).toHaveBeenCalledWith('long-lived-1');
          expect(accessRequestService.markRequestAuthorized).not.toHaveBeenCalled();
          expect(prisma.platformAuthorization.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({
              metadata: expect.objectContaining({
                grantedScopes: ['pages_read_engagement', 'pages_show_list'],
                tokenDebug: expect.objectContaining({ isValid: true, userId: 'meta-user-1' }),
              }),
            }),
          }));
        });

        it('does not persist a Meta token when debug-token validation says it is invalid', async () => {
          mockHappyPath({
            state: { platform: 'meta' },
            connector: {
              getLongLivedToken: vi.fn().mockResolvedValue(TOKENS),
              getTokenMetadata: vi.fn().mockResolvedValue({ scopes: [], isValid: false }),
            },
          });

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1' },
          });

          expect(response.statusCode).toBe(500);
          expect(infisical.storeOAuthTokens).not.toHaveBeenCalled();
          expect(prisma.platformAuthorization.upsert).not.toHaveBeenCalled();
        });

        it('uses long-lived token inspection for the Meta Pages alias', async () => {
          const getLongLivedToken = vi.fn().mockResolvedValue({
            accessToken: 'long-lived-pages-token',
            expiresAt: TOKENS.expiresAt,
          });
          mockHappyPath({
            state: { platform: 'meta_pages' },
            connector: { getLongLivedToken },
          });
          vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
            ...ACCESS_REQUEST,
            platforms: [{ platform: 'meta_pages', accessLevel: 'manage' }],
          } as any);

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1', platform: 'meta_pages' },
          });

          expect(response.statusCode).toBe(200);
          expect(getLongLivedToken).toHaveBeenCalledWith(TOKENS.accessToken);
          expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ accessToken: 'long-lived-pages-token' })
          );
        });

        it('uses long-lived token inspection for Instagram', async () => {
          const getLongLivedToken = vi.fn().mockResolvedValue({
            accessToken: 'long-lived-instagram-token',
            expiresAt: TOKENS.expiresAt,
          });
          const getTokenMetadata = vi.fn().mockResolvedValue({
            scopes: ['instagram_basic', 'business_management'],
            isValid: true,
          });
          mockHappyPath({
            state: { platform: 'instagram' },
            connector: { getLongLivedToken, getTokenMetadata },
          });
          vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
            ...ACCESS_REQUEST,
            platforms: [{ platform: 'instagram', accessLevel: 'manage' }],
          } as any);
          vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
            id: 'instagram-auth-1',
            connectionId: 'conn-1',
            secretId: 'old-instagram-secret',
            authorizationEpoch: 2,
            metadata: { providerRevokedAt: '2026-01-01T00:00:00.000Z' },
          } as any);

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1', platform: 'instagram' },
          });

          expect(response.statusCode).toBe(200);
          expect(getLongLivedToken).toHaveBeenCalledWith(TOKENS.accessToken);
          expect(getTokenMetadata).toHaveBeenCalledWith('long-lived-instagram-token');
          expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
            expect.stringMatching(/^secret\/agency-access\/test-platform\/conn-1_epoch_3_[\da-f-]{36}$/),
            expect.objectContaining({ accessToken: 'long-lived-instagram-token' })
          );
          expect(prisma.platformAuthorization.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ authorizationEpoch: { increment: 1 } }),
            create: expect.objectContaining({
              metadata: expect.objectContaining({
                grantedScopes: ['business_management', 'instagram_basic'],
                tokenDebug: expect.objectContaining({ isValid: true }),
              }),
            }),
          }));
          expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { authorizationId: 'instagram-auth-1', status: 'verified' },
            data: expect.objectContaining({ status: 'stale', lastErrorCode: 'AUTHORIZATION_REPLACED' }),
          }));
          expect(infisical.deleteSecret).toHaveBeenCalledWith('old-instagram-secret');
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

        it('degrades a failed Snapchat identity lookup into a persisted discoveryFailed authorization', async () => {
          mockHappyPath({
            state: { platform: 'snapchat' },
            connector: {
              getUserInfo: vi.fn().mockRejectedValue(new Error('snap identity lookup failed')),
            },
          });

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1', platform: 'snapchat' },
          });

          // Tokens are stored and the authorization persists even though the
          // Snap identity call failed after the authorization code was spent.
          expect(response.statusCode).toBe(200);
          expect(response.json()).toEqual({
            data: {
              connectionId: 'conn-1',
              platform: 'snapchat',
              token: 'token-123',
            },
            error: null,
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
                metadata: expect.objectContaining({
                  organizations: [],
                  adAccountCount: 0,
                  discoveryFailed: true,
                }),
              }),
              update: expect.objectContaining({
                metadata: expect.objectContaining({ discoveryFailed: true }),
              }),
            })
          );
          expect(auditService.createAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
              agencyId: 'agency-1',
              action: 'CLIENT_AUTHORIZED',
              userEmail: 'client@example.com',
              resourceType: 'client_connection',
              resourceId: 'conn-1',
            })
          );
        });

        it('returns 400 PLATFORM_NOT_REQUESTED when the state platform is absent from the access request', async () => {
          // ACCESS_REQUEST.platforms holds no linkedin row, so the linkedin state
          // must not exchange tokens for this request. (Klaviyo, Mailchimp, and
          // Pinterest are manual platforms now — rejected earlier at the schema.)
          mockHappyPath({ state: { platform: 'linkedin' } });

          const response = await app.inject({
            method: 'POST',
            url,
            payload: { code: 'code-1', state: 'state-1', platform: 'linkedin' },
          });

          expect(response.statusCode).toBe(400);
          expect(response.json()).toEqual({
            data: null,
            error: {
              code: 'PLATFORM_NOT_REQUESTED',
              message: 'Platform was not requested in this access request',
            },
          });
          expect(infisical.storeOAuthTokens).not.toHaveBeenCalled();
          expect(prisma.platformAuthorization.upsert).not.toHaveBeenCalled();
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

    it('preserves Meta selection, increments the epoch, and makes old verification stale on reauthorization', async () => {
      mockHappyPath({
        state: { platform: 'meta' },
        connection: CONNECTED_CONNECTION,
        connector: {
          getLongLivedToken: vi.fn().mockResolvedValue(TOKENS),
          getUserInfo: vi.fn().mockResolvedValue({ id: 'meta-user-2', name: 'Meta User' }),
        },
      });
      vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
        id: 'auth-1',
        secretId: 'meta_token_conn-1',
        authorizationEpoch: 1,
        providerRevokedAt: '2026-09-22T00:00:00.000Z',
        metadata: {
          meta: {
            selection: { clientBusinessId: 'client-business-1' },
          },
        },
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: TOKENED_URL,
        payload: { code: 'code-1', state: 'state-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.platformAuthorization.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { metadata: expect.objectContaining({ pendingSecretDeletion: [] }) },
      }));
      expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
        expect.stringMatching(/^secret\/agency-access\/test-platform\/conn-1_epoch_2_[\da-f-]{36}$/),
        expect.any(Object),
      );
      expect(prisma.platformAuthorization.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: expect.objectContaining({
          authorizationEpoch: { increment: 1 },
          metadata: expect.objectContaining({
            id: 'meta-user-2',
            meta: expect.objectContaining({
              selection: { clientBusinessId: 'client-business-1' },
            }),
          }),
        }),
      }));
      const reauthorizationWrite = vi.mocked(prisma.platformAuthorization.upsert).mock.calls[0]?.[0];
      expect(reauthorizationWrite?.update.metadata).not.toHaveProperty('providerRevokedAt');
      expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledWith({
        where: { authorizationId: 'auth-1', status: 'verified' },
        data: expect.objectContaining({
          status: 'stale',
          lastErrorCode: 'AUTHORIZATION_REPLACED',
        }),
      });
      expect(infisical.deleteSecret).toHaveBeenCalledWith('meta_token_conn-1');
      expect(accessRequestService.markRequestAuthorized).toHaveBeenCalledWith('req-1');
    });

    it('serializes concurrent Meta reauthorization against the latest authorization metadata', async () => {
      mockHappyPath({
        state: { platform: 'meta' },
        connection: CONNECTED_CONNECTION,
      });
      const initial = {
        id: 'auth-1',
        secretId: 'meta_token_before_race',
        authorizationEpoch: 1,
        metadata: { pendingSecretDeletion: ['meta_token_orphaned'] },
      };
      const latestLocked = {
        ...initial,
        secretId: 'meta_token_from_first_reauth',
        authorizationEpoch: 2,
        metadata: { pendingSecretDeletion: ['meta_token_orphaned'] },
      };
      vi.mocked(prisma.platformAuthorization.findUnique)
        .mockResolvedValueOnce(initial as any)
        .mockResolvedValueOnce(latestLocked as any);
      const response = await app.inject({
        method: 'POST',
        url: TOKENED_URL,
        payload: { code: 'code-1', state: 'state-1' },
      });

      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(prisma.platformAuthorization.findUnique).toHaveBeenCalledTimes(3);
      const write = vi.mocked(prisma.platformAuthorization.upsert).mock.calls[0]?.[0];
      expect(write?.update.metadata).toEqual(expect.objectContaining({
        pendingSecretDeletion: expect.arrayContaining([
          'meta_token_orphaned',
          'meta_token_from_first_reauth',
        ]),
      }));
      expect(infisical.deleteSecret).toHaveBeenCalledWith('meta_token_from_first_reauth');
      expect(infisical.deleteSecret).toHaveBeenCalledWith('meta_token_orphaned');
    });

    it('preserves cleanup work queued by a concurrent reauthorization', async () => {
      mockHappyPath({ state: { platform: 'meta' }, connection: CONNECTED_CONNECTION });
      vi.mocked(prisma.platformAuthorization.findUnique)
        .mockResolvedValueOnce({
          id: 'auth-1',
          secretId: 'meta_token_before_race',
          authorizationEpoch: 1,
          metadata: { pendingSecretDeletion: ['meta_token_orphaned'] },
        } as any)
        .mockResolvedValueOnce({
          id: 'auth-1',
          secretId: 'meta_token_from_first_reauth',
          authorizationEpoch: 2,
          metadata: { pendingSecretDeletion: ['meta_token_orphaned'] },
        } as any)
        .mockResolvedValueOnce({
          id: 'auth-1',
          secretId: 'meta_token_from_second_reauth',
          authorizationEpoch: 3,
          metadata: {
            latestReauthorization: true,
            pendingSecretDeletion: [
              'meta_token_orphaned',
              'meta_token_another_old_secret',
            ],
          },
        } as any);
      vi.mocked(infisical.deleteSecret).mockImplementation(async (secretId: string) => {
        if (secretId === 'meta_token_orphaned') throw new Error('Infisical unavailable');
      });

      const response = await app.inject({
        method: 'POST',
        url: TOKENED_URL,
        payload: { code: 'code-1', state: 'state-1' },
      });

      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
      expect(prisma.platformAuthorization.update).toHaveBeenCalledWith({
        where: { id: 'auth-1' },
        data: {
          metadata: {
            latestReauthorization: true,
            pendingSecretDeletion: [
              'meta_token_orphaned',
              'meta_token_another_old_secret',
            ],
          },
        },
      });
    });

    it('reopens a completed request if Meta reauthorization status recalculation fails', async () => {
      mockHappyPath({
        state: { platform: 'meta' },
        connection: CONNECTED_CONNECTION,
        connector: { getLongLivedToken: vi.fn().mockResolvedValue(TOKENS) },
      });
      vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
        id: 'auth-1', secretId: 'old-meta-secret', authorizationEpoch: 1, status: 'active',
      } as any);
      vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'temporary recalculation failure' },
      } as any);

      const response = await app.inject({ method: 'POST', url: TOKENED_URL, payload: { code: 'code-1', state: 'state-1' } });

      expect(response.statusCode).toBe(200);
      expect(accessRequestService.setAccessRequestLifecycleStatus).toHaveBeenCalledWith('req-1', 'partial');
    });

    it('keeps old Meta access active if reauthorization token storage fails', async () => {
      mockHappyPath({
        state: { platform: 'meta' },
        connection: CONNECTED_CONNECTION,
        connector: { getLongLivedToken: vi.fn().mockResolvedValue(TOKENS) },
      });
      vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
        id: 'auth-1', secretId: 'meta_token_conn-1', status: 'active',
      } as any);
      vi.mocked(infisical.storeOAuthTokens).mockRejectedValue(new Error('Infisical unavailable'));

      const response = await app.inject({
        method: 'POST', url: TOKENED_URL, payload: { code: 'code-1', state: 'state-1' },
      });

      expect(response.statusCode).toBe(500);
      expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
      expect(prisma.metaAssetGrant.updateMany).not.toHaveBeenCalled();
      expect(prisma.platformAuthorization.upsert).not.toHaveBeenCalled();
    });

    it('keeps old Meta access active and uses a new secret after transaction failure', async () => {
      mockHappyPath({
        state: { platform: 'meta' },
        connection: CONNECTED_CONNECTION,
        connector: { getLongLivedToken: vi.fn().mockResolvedValue(TOKENS) },
      });
      vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
        id: 'auth-1', secretId: 'meta_token_conn-1', status: 'active',
      } as any);
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('Database unavailable'));
      vi.mocked(infisical.deleteSecret).mockRejectedValueOnce(new Error('Infisical unavailable'));

      const response = await app.inject({
        method: 'POST', url: TOKENED_URL, payload: { code: 'code-1', state: 'state-1' },
      });

      expect(response.statusCode).toBe(500);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
      expect(infisical.deleteSecret).toHaveBeenCalledWith(
        expect.stringMatching(/^secret\/agency-access\/test-platform\/conn-1_epoch_2_[\da-f-]{36}$/),
      );
      expect(auditService.createAuditLog).not.toHaveBeenCalledWith(expect.objectContaining({
        action: 'CLIENT_AUTHORIZED',
      }));

      const retry = await app.inject({
        method: 'POST', url: TOKENED_URL, payload: { code: 'code-2', state: 'state-2' },
      });
      expect(retry.statusCode).toBe(200);
      const failedAttemptSecret = vi.mocked(infisical.storeOAuthTokens).mock.calls[0]?.[0];
      const retrySecret = vi.mocked(infisical.storeOAuthTokens).mock.calls[1]?.[0];
      expect(retrySecret).toMatch(/^secret\/agency-access\/test-platform\/conn-1_epoch_2_[\da-f-]{36}$/);
      expect(retrySecret).not.toBe(failedAttemptSecret);
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
