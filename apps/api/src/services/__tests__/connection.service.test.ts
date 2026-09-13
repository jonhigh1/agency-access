/**
 * Connection Service Unit Tests
 *
 * Tests for client connection and platform authorization management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import * as connectionService from '@/services/connection.service';
import { infisical } from '@/lib/infisical';
import { auditService } from '@/services/audit.service';

const { refreshClientPlatformAuthorizationMock, getConnectorMock, verifyTokenMock } = vi.hoisted(() => ({
  refreshClientPlatformAuthorizationMock: vi.fn(),
  getConnectorMock: vi.fn(),
  verifyTokenMock: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    clientConnection: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    platformAuthorization: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      createMany: vi.fn(),
    },
    accessRequest: {
      findUnique: vi.fn(),
    },
    agency: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/services/token-lifecycle.service', () => ({
  refreshClientPlatformAuthorization: refreshClientPlatformAuthorizationMock,
}));

vi.mock('@/services/connectors/factory', () => ({
  getConnector: getConnectorMock,
}));

// Mock Infisical
vi.mock('@/lib/infisical', () => ({
  infisical: {
    generateSecretName: vi.fn((platform, connectionId) => `oauth_${platform}_${connectionId}`),
    storeOAuthTokens: vi.fn(),
    retrieveOAuthTokens: vi.fn(),
    updateOAuthTokens: vi.fn(),
    deleteSecret: vi.fn(),
  },
}));

vi.mock('@/services/audit.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/audit.service')>();
  return {
    ...actual,
    auditService: {
      ...actual.auditService,
      createAuditLog: vi.fn().mockResolvedValue({ data: null, error: null }),
      createAuditLogs: vi.fn((...args: Parameters<typeof actual.auditService.createAuditLogs>) =>
        actual.auditService.createAuditLogs(...args)
      ),
    },
  };
});

describe('ConnectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConnectorMock.mockReturnValue({
      verifyToken: verifyTokenMock,
    });
    verifyTokenMock.mockResolvedValue(true);
    vi.mocked(infisical.storeOAuthTokens).mockResolvedValue(undefined as any);
  });

  describe('createClientConnection', () => {
    it('should create a new client connection with platform authorizations', async () => {
      const mockRequest = {
        id: 'request-1',
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: ['meta_ads', 'google_ads'],
        intakeFields: [],
        branding: {},
      };

      const mockConnection = {
        id: 'connection-1',
        requestId: 'request-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        createdAt: new Date(),
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          clientConnection: {
            create: vi.fn().mockResolvedValue(mockConnection),
          },
          platformAuthorization: {
            create: vi.fn(),
          },
        } as any);
      });

      const mockTokens = {
        meta_ads: {
          accessToken: 'meta-access-token',
          refreshToken: 'meta-refresh-token',
          expiresAt: new Date(Date.now() + 3600000 * 24 * 60),
        },
        google_ads: {
          accessToken: 'google-access-token',
          refreshToken: 'google-refresh-token',
          expiresAt: new Date(Date.now() + 3600000 * 24 * 60),
        },
      };

      const result = await connectionService.createClientConnection({
        requestId: 'request-1',
        platforms: mockTokens,
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(infisical.storeOAuthTokens).toHaveBeenCalledTimes(2);
    });

    it('should return error if access request not found', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(null);

      const result = await connectionService.createClientConnection({
        requestId: 'non-existent',
        platforms: {},
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('REQUEST_NOT_FOUND');
    });

    it('should store tokens in Infisical and only save secretId in database', async () => {
      const mockRequest = {
        id: 'request-1',
        clientName: 'Test Client',
        platforms: ['meta_ads'],
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const prismaMock = {
          clientConnection: {
            create: vi.fn().mockResolvedValue({ id: 'connection-1' }),
          },
          platformAuthorization: {
            create: vi.fn().mockImplementation((data) => {
              // Verify only secretId is stored, not actual tokens
              expect(data.data.secretId).toContain('oauth_meta_ads_');
              expect(data.data.accessToken).toBeUndefined();
              expect(data.data.refreshToken).toBeUndefined();
              return { id: 'auth-1', ...data.data };
            }),
          },
        };
        return callback(prismaMock as any);
      });

      await connectionService.createClientConnection({
        requestId: 'request-1',
        platforms: {
          meta_ads: {
            accessToken: 'secret-token',
            refreshToken: 'secret-refresh',
            expiresAt: new Date(),
          },
        },
      });

      expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
        expect.stringContaining('oauth_meta_ads_'),
        expect.objectContaining({
          accessToken: 'secret-token',
          refreshToken: 'secret-refresh',
        })
      );
    });

    it('should store Infisical secrets before opening a database transaction', async () => {
      const callOrder: string[] = [];
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@test.com',
      } as any);
      vi.mocked(infisical.storeOAuthTokens).mockImplementation(async () => {
        callOrder.push('infisical');
      });
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        callOrder.push('transaction');
        return callback({
          clientConnection: {
            create: vi.fn().mockResolvedValue({ id: 'connection-1' }),
          },
          platformAuthorization: {
            create: vi.fn(),
          },
        } as any);
      });

      await connectionService.createClientConnection({
        requestId: 'request-1',
        platforms: {
          meta_ads: {
            accessToken: 'secret-token',
            refreshToken: 'secret-refresh',
            expiresAt: new Date(),
          },
        },
      });

      expect(callOrder).toEqual(['infisical', 'transaction']);
    });

    it('should not open a database transaction when Infisical storage fails', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@test.com',
      } as any);
      vi.mocked(infisical.storeOAuthTokens).mockRejectedValue(new Error('Infisical unavailable'));

      const result = await connectionService.createClientConnection({
        requestId: 'request-1',
        platforms: {
          meta_ads: {
            accessToken: 'secret-token',
            expiresAt: new Date(),
          },
        },
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Failed to create client connection',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should log token grant audit entries without writing OAuth tokens', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@test.com',
      } as any);
      vi.mocked(infisical.storeOAuthTokens).mockResolvedValue(undefined as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          clientConnection: {
            create: vi.fn().mockResolvedValue({ id: 'connection-1' }),
          },
          platformAuthorization: {
            create: vi.fn().mockResolvedValue({ id: 'auth-1' }),
          },
        } as any);
      });

      const result = await connectionService.createClientConnection({
        requestId: 'request-1',
        platforms: {
          meta_ads: {
            accessToken: 'secret-token',
            refreshToken: 'secret-refresh',
            expiresAt: new Date(),
          },
        },
      });

      expect(result.error).toBeNull();
      expect(auditService.createAuditLogs).toHaveBeenCalledWith([
        expect.objectContaining({
          agencyId: 'agency-1',
          userEmail: 'client@test.com',
          action: 'GRANTED',
          resourceType: 'connection',
          resourceId: 'connection-1',
          metadata: expect.objectContaining({ platform: 'meta_ads' }),
        }),
      ]);
      expect(JSON.stringify(vi.mocked(auditService.createAuditLogs).mock.calls[0][0])).not.toContain(
        'secret-token'
      );
    });
  });

  describe('getAgencyConnections', () => {
    it('should return connection summaries with a default limit and without secretId', async () => {
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([] as any);

      const result = await connectionService.getAgencyConnections('agency-1');

      expect(result.error).toBeNull();
      expect(prisma.clientConnection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agencyId: 'agency-1' },
          take: 50,
          skip: 0,
          select: {
            id: true,
            clientEmail: true,
            status: true,
            createdAt: true,
            authorizations: {
              select: {
                platform: true,
                status: true,
              },
            },
          },
        })
      );
      const query = vi.mocked(prisma.clientConnection.findMany).mock.calls[0][0] as {
        include?: unknown;
      };
      expect(query.include).toBeUndefined();
    });

    it('should cap an oversized connections list limit at 100', async () => {
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([] as any);

      await connectionService.getAgencyConnections('agency-1', { limit: 500, offset: 10 });

      expect(prisma.clientConnection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 10,
        })
      );
    });
  });

  describe('getConnection', () => {
    it('should return connection by id', async () => {
      const mockConnection = {
        id: 'connection-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
      };

      vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue(mockConnection as any);

      const result = await connectionService.getConnection('connection-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockConnection);
    });

    it('should return error if connection not found', async () => {
      vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue(null);

      const result = await connectionService.getConnection('non-existent');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('CONNECTION_NOT_FOUND');
    });
  });

  describe('getConnectionAuthorizations', () => {
    it('should return all platform authorizations for a connection', async () => {
      const mockAuthorizations = [
        {
          id: 'auth-1',
          connectionId: 'connection-1',
          platform: 'meta_ads',
          status: 'active',
          secretId: 'oauth_meta_ads_connection-1',
          expiresAt: new Date(Date.now() + 3600000 * 24 * 60),
        },
        {
          id: 'auth-2',
          connectionId: 'connection-1',
          platform: 'google_ads',
          status: 'active',
          secretId: 'oauth_google_ads_connection-1',
          expiresAt: new Date(Date.now() + 3600000 * 24 * 60),
        },
      ];

      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue(mockAuthorizations as any);

      const result = await connectionService.getConnectionAuthorizations('connection-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockAuthorizations);
    });
  });

  describe('getAgencyTokenHealth', () => {
    function authRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'auth-google',
        connectionId: 'connection-1',
        platform: 'google_ads',
        status: 'active',
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        lastRefreshedAt: null,
        secretId: 'secret-google',
        connection: {
          agencyId: 'agency-1',
          clientEmail: 'client@example.com',
        },
        ...overrides,
      };
    }

    it('should return agency-wide token health with refresh capability from stored expiry', async () => {
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue([
        authRow({ expiresAt }),
        authRow({
          id: 'auth-meta',
          connectionId: 'connection-2',
          platform: 'meta_ads',
          expiresAt,
          secretId: 'secret-meta',
          connection: {
            agencyId: 'agency-1',
            clientEmail: 'meta@example.com',
          },
        }),
      ] as any);
      verifyTokenMock.mockResolvedValue(false);
      vi.mocked(infisical.retrieveOAuthTokens).mockResolvedValue({ accessToken: 'live-token' } as any);

      const result = await connectionService.getAgencyTokenHealth('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'auth-google',
          clientName: 'client@example.com',
          health: 'expiring',
          canRefresh: true,
        }),
        expect.objectContaining({
          id: 'auth-meta',
          clientName: 'meta@example.com',
          health: 'expiring',
          canRefresh: false,
        }),
      ]);
      expect(infisical.retrieveOAuthTokens).not.toHaveBeenCalled();
      expect(verifyTokenMock).not.toHaveBeenCalled();
    });

    it('should classify health from expiresAt even when a live platform verify would fail', async () => {
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue([
        authRow({ expiresAt }),
      ] as any);
      vi.mocked(infisical.retrieveOAuthTokens).mockResolvedValue({ accessToken: 'google-token' } as any);
      verifyTokenMock.mockResolvedValue(false);

      const result = await connectionService.getAgencyTokenHealth('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'auth-google',
          health: 'healthy',
        }),
      ]);
      expect(infisical.retrieveOAuthTokens).not.toHaveBeenCalled();
      expect(verifyTokenMock).not.toHaveBeenCalled();
    });

    it('should not Infisical-get, live-verify, or write TOKEN_HEALTH_CHECK audit rows', async () => {
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue([
        authRow({ expiresAt }),
        authRow({
          id: 'auth-meta',
          connectionId: 'connection-2',
          platform: 'meta_ads',
          expiresAt,
          secretId: 'secret-meta',
          connection: {
            agencyId: 'agency-1',
            clientEmail: 'meta@example.com',
          },
        }),
      ] as any);
      vi.mocked(infisical.retrieveOAuthTokens).mockResolvedValue({ accessToken: 'token' } as any);
      verifyTokenMock.mockResolvedValue(true);

      const result = await connectionService.getAgencyTokenHealth('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        expect.objectContaining({ id: 'auth-google', health: 'expiring' }),
        expect.objectContaining({ id: 'auth-meta', health: 'expiring' }),
      ]);
      expect(verifyTokenMock).not.toHaveBeenCalled();
      expect(infisical.retrieveOAuthTokens).not.toHaveBeenCalled();
      expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
      expect(auditService.createAuditLog).not.toHaveBeenCalled();
    });

    it('should mark stored non-active status as expired without reading secrets', async () => {
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue([
        authRow({
          status: 'invalid',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }),
      ] as any);

      const result = await connectionService.getAgencyTokenHealth('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'auth-google',
          health: 'expired',
          daysUntilExpiry: -1,
        }),
      ]);
      expect(infisical.retrieveOAuthTokens).not.toHaveBeenCalled();
      expect(verifyTokenMock).not.toHaveBeenCalled();
    });

    it('should report non-expiring API-key platforms as healthy without Infisical', async () => {
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue([
        authRow({
          id: 'auth-beehiiv',
          platform: 'beehiiv',
          expiresAt: null,
          secretId: 'secret-beehiiv',
        }),
      ] as any);

      const result = await connectionService.getAgencyTokenHealth('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'auth-beehiiv',
          health: 'healthy',
          canRefresh: false,
        }),
      ]);
      expect(infisical.retrieveOAuthTokens).not.toHaveBeenCalled();
      expect(verifyTokenMock).not.toHaveBeenCalled();
    });

    it('should classify a token that died 12 minutes ago as expired (no day-ceil round-up to day 0)', async () => {
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue([
        {
          id: 'auth-snap',
          connectionId: 'connection-1',
          platform: 'snapchat',
          status: 'active',
          expiresAt: new Date(Date.now() - 12 * 60 * 1000),
          lastRefreshedAt: null,
          connection: {
            agencyId: 'agency-1',
            clientEmail: 'client@example.com',
          },
        },
      ] as any);

      const result = await connectionService.getAgencyTokenHealth('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'auth-snap',
          health: 'expired',
          daysUntilExpiry: -1,
        }),
      ]);
    });

    it('should classify a token with 12 minutes left as expiring, not expired', async () => {
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue([
        {
          id: 'auth-snap',
          connectionId: 'connection-1',
          platform: 'snapchat',
          status: 'active',
          expiresAt: new Date(Date.now() + 12 * 60 * 1000),
          lastRefreshedAt: null,
          connection: {
            agencyId: 'agency-1',
            clientEmail: 'client@example.com',
          },
        },
      ] as any);

      const result = await connectionService.getAgencyTokenHealth('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'auth-snap',
          health: 'expiring',
          daysUntilExpiry: 1,
        }),
      ]);
    });
  });

  describe('getTokenHealth', () => {
    it('should classify a single connection from stored expiry without Infisical or verifyToken', async () => {
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue([
        {
          id: 'auth-google',
          connectionId: 'connection-1',
          platform: 'google_ads',
          status: 'active',
          expiresAt,
          lastRefreshedAt: null,
          secretId: 'secret-google',
        },
      ] as any);
      verifyTokenMock.mockResolvedValue(false);
      vi.mocked(infisical.retrieveOAuthTokens).mockResolvedValue({ accessToken: 'google-token' } as any);

      const result = await connectionService.getTokenHealth('connection-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'auth-google',
          health: 'expiring',
        }),
      ]);
      expect(infisical.retrieveOAuthTokens).not.toHaveBeenCalled();
      expect(verifyTokenMock).not.toHaveBeenCalled();
      expect(auditService.createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('getPlatformTokens', () => {
    it('should retrieve tokens from Infisical for a platform authorization', async () => {
      const mockAuth = {
        id: 'auth-1',
        platform: 'meta_ads',
        secretId: 'oauth_meta_ads_connection-1',
        expiresAt: new Date(Date.now() + 3600000 * 24 * 60),
      };

      vi.mocked(prisma.platformAuthorization.findFirst).mockResolvedValue(mockAuth as any);
      vi.mocked(infisical.retrieveOAuthTokens).mockResolvedValue({
        accessToken: 'meta-access-token',
        refreshToken: 'meta-refresh-token',
        expiresAt: new Date(Date.now() + 3600000 * 24 * 60),
      });

      const result = await connectionService.getPlatformTokens('connection-1', 'meta_ads');

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        accessToken: 'meta-access-token',
        refreshToken: 'meta-refresh-token',
        expiresAt: expect.any(Date),
      });
      expect(infisical.retrieveOAuthTokens).toHaveBeenCalledWith('oauth_meta_ads_connection-1');
    });

    it('should return error if authorization not found', async () => {
      vi.mocked(prisma.platformAuthorization.findFirst).mockResolvedValue(null);

      const result = await connectionService.getPlatformTokens('connection-1', 'meta_ads');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('AUTHORIZATION_NOT_FOUND');
    });

    it('should return error if tokens not found in Infisical', async () => {
      vi.mocked(prisma.platformAuthorization.findFirst).mockResolvedValue({
        secretId: 'missing-secret',
      } as any);
      vi.mocked(infisical.retrieveOAuthTokens).mockResolvedValue(null);

      const result = await connectionService.getPlatformTokens('connection-1', 'meta_ads');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('TOKENS_NOT_FOUND');
    });
  });

  describe('updatePlatformTokens', () => {
    it('should update tokens in Infisical and database', async () => {
      const mockAuth = {
        id: 'auth-1',
        secretId: 'oauth_meta_ads_connection-1',
      };

      vi.mocked(prisma.platformAuthorization.findFirst).mockResolvedValue(mockAuth as any);
      vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({
        id: 'auth-1',
        expiresAt: new Date(Date.now() + 3600000 * 24 * 60),
      } as any);
      vi.mocked(infisical.updateOAuthTokens).mockResolvedValue(undefined);

      const newExpiresAt = new Date(Date.now() + 3600000 * 24 * 60);

      const result = await connectionService.updatePlatformTokens('connection-1', 'meta_ads', {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: newExpiresAt,
      });

      expect(result.error).toBeNull();
      expect(infisical.updateOAuthTokens).toHaveBeenCalledWith(
        'oauth_meta_ads_connection-1',
        expect.objectContaining({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        })
      );
    });
  });

  describe('revokeConnection', () => {
    it('should revoke connection and delete all tokens from Infisical', async () => {
      const mockConnection = {
        id: 'connection-1',
      };

      const mockAuthorizations = [
        { secretId: 'oauth_meta_ads_connection-1' },
        { secretId: 'oauth_google_ads_connection-1' },
      ];

      vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.clientConnection.update).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue(mockAuthorizations as any);
      vi.mocked(prisma.platformAuthorization.updateMany).mockResolvedValue({});
      vi.mocked(infisical.deleteSecret).mockResolvedValue(undefined);

      const result = await connectionService.revokeConnection('connection-1');

      expect(result.error).toBeNull();
      expect(infisical.deleteSecret).toHaveBeenCalledTimes(2);
      expect(infisical.deleteSecret).toHaveBeenCalledWith('oauth_meta_ads_connection-1');
      expect(infisical.deleteSecret).toHaveBeenCalledWith('oauth_google_ads_connection-1');
    });

    it('should continue revocation when one secret deletion fails', async () => {
      const mockConnection = {
        id: 'connection-partial',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
      };
      const mockAuthorizations = [
        { platform: 'meta_ads', secretId: 'secret-ok' },
        { platform: 'google_ads', secretId: 'secret-failed' },
      ];

      vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.clientConnection.update).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.platformAuthorization.findMany).mockResolvedValue(mockAuthorizations as any);
      vi.mocked(prisma.platformAuthorization.updateMany).mockResolvedValue({} as any);
      vi.mocked(infisical.deleteSecret).mockImplementation(async (secretId) => {
        if (secretId === 'secret-failed') throw new Error('Infisical unavailable');
      });

      const result = await connectionService.revokeConnection('connection-partial');

      expect(result.error).toBeNull();
      expect(result.partialFailure).toBe(true);
      expect(prisma.clientConnection.update).toHaveBeenCalled();
      expect(auditService.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'TOKEN_DELETION_FAILED',
        metadata: expect.objectContaining({ secretId: 'secret-failed', platform: 'google_ads' }),
      }));
    });
  });

  describe('refreshPlatformAuthorization', () => {
    it('should refresh a platform authorization through the lifecycle service', async () => {
      const refreshedAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const updatedAuthorization = {
        id: 'auth-1',
        connectionId: 'connection-1',
        platform: 'google_ads',
        status: 'active',
        expiresAt: refreshedAt,
      };

      refreshClientPlatformAuthorizationMock.mockResolvedValue({
        data: {
          outcome: 'refreshed',
          accessToken: 'new-access-token',
          expiresAt: refreshedAt,
        },
        error: null,
      });
      vi.mocked(prisma.platformAuthorization.findFirst).mockResolvedValue(updatedAuthorization as any);

      const result = await connectionService.refreshPlatformAuthorization('connection-1', 'google_ads');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(updatedAuthorization);
      expect(refreshClientPlatformAuthorizationMock).toHaveBeenCalledWith('connection-1', 'google_ads');
    });

    it('should return lifecycle errors unchanged', async () => {
      refreshClientPlatformAuthorizationMock.mockResolvedValue({
        data: null,
        error: {
          code: 'RECONNECT_REQUIRED',
          message: 'meta_ads requires reconnect instead of automatic refresh',
        },
      });

      const result = await connectionService.refreshPlatformAuthorization('connection-1', 'meta_ads');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('RECONNECT_REQUIRED');
    });
  });
});
