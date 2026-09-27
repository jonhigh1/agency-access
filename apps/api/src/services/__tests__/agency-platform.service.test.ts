/**
 * Agency Platform Service Unit Tests
 *
 * Tests for managing agency platform connections and OAuth tokens.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import * as agencyPlatformService from '@/services/agency-platform.service';

const { deleteCacheMock, invalidateDashboardCacheMock, ensureAgencyAccessTokenMock, getConnectorMock, revokeSystemUserTokensMock } = vi.hoisted(() => ({
  deleteCacheMock: vi.fn(async () => true),
  invalidateDashboardCacheMock: vi.fn(async () => {}),
  ensureAgencyAccessTokenMock: vi.fn(),
  getConnectorMock: vi.fn(),
  revokeSystemUserTokensMock: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agencyPlatformConnection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    agency: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock cache layer (used by /agency-platforms/available)
vi.mock('@/lib/cache', () => ({
  CacheKeys: {
    agencyConnections: (agencyId: string) => `agency:${agencyId}:connections`,
  },
  deleteCache: deleteCacheMock,
  invalidateDashboardCache: invalidateDashboardCacheMock,
}));

vi.mock('@/services/token-lifecycle.service', () => ({
  ensureAgencyAccessToken: ensureAgencyAccessTokenMock,
}));

vi.mock('@/services/connectors/factory', () => ({ getConnector: getConnectorMock }));
vi.mock('@/services/meta-system-user.service', () => ({
  metaSystemUserService: { revokeSystemUserAccessTokens: revokeSystemUserTokensMock },
}));

// Mock Infisical
vi.mock('@/lib/infisical', () => ({
  infisical: {
    storeOAuthTokens: vi.fn(),
    getOAuthTokens: vi.fn(),
    updateOAuthTokens: vi.fn(),
    deleteOAuthTokens: vi.fn(),
    deleteSecret: vi.fn(),
    generateSecretName: vi.fn(),
  },
}));

describe('AgencyPlatformService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({ accessToken: 'agency-meta-access-token' });
    getConnectorMock.mockReturnValue({ revokeToken: vi.fn().mockResolvedValue(undefined) });
    revokeSystemUserTokensMock.mockResolvedValue({ error: null });
  });

  describe('getConnections', () => {
    it('should return all platform connections for an agency', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          agencyId: 'agency-1',
          platform: 'google',
          secretId: 'google_agency_agency-1',
          status: 'active',
          connectedBy: 'admin@agency.com',
          connectedAt: new Date(),
        },
        {
          id: 'conn-2',
          agencyId: 'agency-1',
          platform: 'meta',
          secretId: 'meta_agency_agency-1',
          status: 'active',
          connectedBy: 'admin@agency.com',
          connectedAt: new Date(),
        },
      ];

      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue(mockConnections as any);

      const result = await agencyPlatformService.getConnections('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockConnections);
      expect(prisma.agencyPlatformConnection.findMany).toHaveBeenCalledWith({
        where: { agencyId: 'agency-1' },
        orderBy: { connectedAt: 'desc' },
      });
    });

    it('should filter by status if provided', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          agencyId: 'agency-1',
          platform: 'google',
          status: 'active',
        },
      ];

      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue(mockConnections as any);

      const result = await agencyPlatformService.getConnections('agency-1', { status: 'active' });

      expect(result.error).toBeNull();
      expect(prisma.agencyPlatformConnection.findMany).toHaveBeenCalledWith({
        where: { agencyId: 'agency-1', status: 'active' },
        orderBy: { connectedAt: 'desc' },
      });
    });

    it('should return empty array if no connections exist', async () => {
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);

      const result = await agencyPlatformService.getConnections('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    });
  });

  describe('getConnection', () => {
    it('should return a specific platform connection', async () => {
      const mockConnection = {
        id: 'conn-1',
        agencyId: 'agency-1',
        platform: 'google',
        secretId: 'google_agency_agency-1',
        status: 'active',
        connectedBy: 'admin@agency.com',
        connectedAt: new Date(),
      };

      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(mockConnection as any);

      const result = await agencyPlatformService.getConnection('agency-1', 'google');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockConnection);
      expect(prisma.agencyPlatformConnection.findFirst).toHaveBeenCalledWith({
        where: { agencyId: 'agency-1', platform: 'google' },
      });
    });

    it('should return null if connection not found', async () => {
      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(null);

      const result = await agencyPlatformService.getConnection('agency-1', 'google');

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });
  });

  describe('createConnection', () => {
    it('should create a new platform connection with token storage', async () => {
      const mockAgency = { id: 'agency-1', name: 'Test Agency' };
      const mockConnection = {
        id: 'conn-1',
        agencyId: 'agency-1',
        platform: 'google',
        secretId: 'google_agency_agency-1',
        status: 'active',
        connectedBy: 'admin@agency.com',
        connectedAt: new Date(),
      };

      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(mockAgency as any);
      vi.mocked(infisical.generateSecretName).mockReturnValue('google_agency_agency-1');
      vi.mocked(infisical.storeOAuthTokens).mockResolvedValue('google_agency_agency-1');
      vi.mocked(prisma.agencyPlatformConnection.create).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await agencyPlatformService.createConnection({
        agencyId: 'agency-1',
        platform: 'google',
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
        expiresAt,
        scope: 'ads.readonly',
        connectedBy: 'admin@agency.com',
        metadata: { businessId: '123456' },
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockConnection);

      // Verify Infisical was called to store tokens
      expect(infisical.storeOAuthTokens).toHaveBeenCalledWith('google_agency_agency-1', {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
        expiresAt,
        scope: 'ads.readonly',
      });

      // Verify database record created
      expect(prisma.agencyPlatformConnection.create).toHaveBeenCalledWith({
        data: {
          agencyId: 'agency-1',
          platform: 'google',
          secretId: 'google_agency_agency-1',
          status: 'active',
          expiresAt,
          scope: 'ads.readonly',
          metadata: { businessId: '123456' },
          connectedBy: 'admin@agency.com',
        },
      });

      // Verify audit log created
      expect(prisma.auditLog.create).toHaveBeenCalled();

      // Verify cache invalidated (so /agency-platforms/available updates immediately)
      expect(deleteCacheMock).toHaveBeenCalledWith('agency:agency-1:connections');
      expect(invalidateDashboardCacheMock).toHaveBeenCalledWith('agency-1');
    });

    it('should return error if agency not found', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);

      const result = await agencyPlatformService.createConnection({
        agencyId: 'non-existent',
        platform: 'google',
        accessToken: 'token',
        connectedBy: 'admin@agency.com',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('AGENCY_NOT_FOUND');
    });

    it('should return error if platform already connected', async () => {
      const mockAgency = { id: 'agency-1' };
      const existingConnection = { id: 'existing', platform: 'google', status: 'active' };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(mockAgency as any);
      vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue(existingConnection as any);

      const result = await agencyPlatformService.createConnection({
        agencyId: 'agency-1',
        platform: 'google',
        accessToken: 'token',
        connectedBy: 'admin@agency.com',
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('PLATFORM_ALREADY_CONNECTED');
    });
  });

  describe('createConnection row reuse (revoked / expired / invalid)', () => {
    const staleStatuses = ['revoked', 'expired', 'invalid'] as const;

    function mockReusableRow(status: string, connectionMode?: string) {
      const staleRow = {
        id: 'row-stale',
        agencyId: 'agency-1',
        platform: 'snapchat',
        status,
        connectionMode,
      };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ id: 'agency-1', name: 'Test Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue(staleRow as any);
      vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({
        ...staleRow,
        status: 'active',
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      return staleRow;
    }

    staleStatuses.forEach((staleStatus) => {
      it(`updates a ${staleStatus} row in place instead of creating a duplicate`, async () => {
        const staleRow = mockReusableRow(staleStatus, 'manual_invitation');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const result = await agencyPlatformService.createConnection({
          agencyId: 'agency-1',
          platform: 'snapchat',
          accessToken: 'access_token_123',
          expiresAt,
          connectedBy: 'admin@agency.com',
          metadata: { snapchatOrganizations: { discoveryFailed: false } },
        });

        expect(result.error).toBeNull();
        expect(result.data).toEqual({ ...staleRow, status: 'active' });

        // The slot lookup is a single findUnique on the (agencyId, platform)
        // unique key; the stale-status branch is decided in memory (the Prisma
        // mock ignores `where`, so pin the query shape explicitly).
        expect(prisma.agencyPlatformConnection.findUnique).toHaveBeenCalledTimes(1);
        expect(prisma.agencyPlatformConnection.findUnique).toHaveBeenCalledWith({
          where: {
            agencyId_platform: {
              agencyId: 'agency-1',
              platform: 'snapchat',
            },
          },
        });

        // Reuse must never attempt a create: the (agencyId, platform) unique
        // constraint would reject it with P2002.
        expect(prisma.agencyPlatformConnection.create).not.toHaveBeenCalled();
        expect(prisma.agencyPlatformConnection.update).toHaveBeenCalledWith({
          where: { id: 'row-stale' },
          data: expect.objectContaining({
            status: 'active',
            secretId: 'snapchat_agency_agency-1',
            expiresAt,
            connectedBy: 'admin@agency.com',
            revokedAt: null,
            revokedBy: null,
            connectionMode: 'oauth',
          }),
        });
      });
    });

    it('keeps connectionMode untouched when the reused row is already oauth', async () => {
      mockReusableRow('expired', 'oauth');

      const result = await agencyPlatformService.createConnection({
        agencyId: 'agency-1',
        platform: 'snapchat',
        accessToken: 'access_token_123',
        connectedBy: 'admin@agency.com',
      });

      expect(result.error).toBeNull();
      expect(prisma.agencyPlatformConnection.create).not.toHaveBeenCalled();

      const updateCall = vi.mocked(prisma.agencyPlatformConnection.update).mock.calls[0][0] as any;
      expect(updateCall.data).not.toHaveProperty('connectionMode');
    });
  });

  describe('revokeConnection', () => {
    it('audits Meta token access before reading the token and fails closed if audit fails', async () => {
      const auditContext = { ipAddress: '127.0.0.1' };
      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
        id: 'conn-meta-1', agencyId: 'agency-1', platform: 'meta', status: 'active', secretId: 'meta-secret', metadata: {},
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const success = await agencyPlatformService.revokeConnection('agency-1', 'meta', 'admin@agency.com', auditContext);
      expect(success.error).toBeNull();
      const tokenAuditCall = vi.mocked(prisma.auditLog.create).mock.calls.find(([call]) => call.data.action === 'ACCESSED');
      expect(tokenAuditCall?.[0].data).toEqual(expect.objectContaining({
        resourceId: 'conn-meta-1', action: 'ACCESSED', userEmail: 'admin@agency.com', ipAddress: auditContext.ipAddress,
        metadata: expect.objectContaining({ platform: 'meta', operation: 'meta_provider_revocation' }),
      }));
      expect(vi.mocked(prisma.auditLog.create).mock.invocationCallOrder[0]).toBeLessThan(infisical.getOAuthTokens.mock.invocationCallOrder[0]);

      vi.clearAllMocks();
      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
        id: 'conn-meta-1', agencyId: 'agency-1', platform: 'meta', status: 'active', secretId: 'meta-secret', metadata: {},
      } as any);
      vi.mocked(prisma.auditLog.create).mockRejectedValueOnce(new Error('audit unavailable'));

      const failed = await agencyPlatformService.revokeConnection('agency-1', 'meta', 'admin@agency.com', auditContext);
      expect(failed.error?.code).toBe('META_ACCESS_REVOCATION_FAILED');
      expect(infisical.getOAuthTokens).not.toHaveBeenCalled();
    });

    it('deletes the derived Meta system-user secret before the agency token', async () => {
      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
        id: 'conn-meta-1', agencyId: 'agency-1', platform: 'meta', status: 'active',
        secretId: 'meta_agency_agency-1',
        metadata: { systemUserId: '42', partnerAdminSystemUserTokenSecretId: 'meta_partner_admin_system_user_agency-1_biz-1' },
      } as any);
      vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({ id: 'conn-meta-1', status: 'revoked' } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await agencyPlatformService.revokeConnection('agency-1', 'meta', 'admin@agency.com', { ipAddress: '127.0.0.1' });

      expect(result.error).toBeNull();
      expect(revokeSystemUserTokensMock).toHaveBeenCalledWith({
        systemUserId: '42', accessToken: 'agency-meta-access-token',
      });
      expect(vi.mocked(infisical.deleteSecret).mock.invocationCallOrder[0]).toBeGreaterThan(
        revokeSystemUserTokensMock.mock.invocationCallOrder[0],
      );
      expect(vi.mocked(infisical.deleteSecret).mock.calls.map(([secretId]) => secretId)).toEqual([
        'meta_partner_admin_system_user_agency-1_biz-1',
        'meta_agency_agency-1',
      ]);
      expect(prisma.agencyPlatformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-meta-1' },
        data: expect.objectContaining({
          status: 'revoked',
          metadata: expect.objectContaining({ partnerAdminSystemUserStatus: 'revoked' }),
        }),
      });
      const revokedData = vi.mocked(prisma.agencyPlatformConnection.update).mock.calls.at(-1)![0].data;
      expect(revokedData.metadata).not.toHaveProperty('partnerAdminSystemUserTokenSecretId');
      expect(revokedData.metadata).toEqual(expect.objectContaining({
        providerRevokedAt: expect.any(String),
        partnerAdminSystemUserRevokedAt: expect.any(String),
      }));
    });

    it('treats a second Meta revocation as already complete', async () => {
      const revokeToken = vi.fn().mockResolvedValue(undefined);
      getConnectorMock.mockReturnValue({ revokeToken });
      const connection = {
        id: 'conn-meta-1', agencyId: 'agency-1', platform: 'meta', status: 'active',
        secretId: 'meta_agency_agency-1',
        metadata: { systemUserId: '42', partnerAdminSystemUserTokenSecretId: 'system-user-secret' },
      };
      vi.mocked(prisma.agencyPlatformConnection.findFirst)
        .mockResolvedValueOnce(connection as any)
        .mockResolvedValueOnce({ ...connection, status: 'revoked' } as any);
      vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({ ...connection, status: 'revoked' } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const first = await agencyPlatformService.revokeConnection(
        'agency-1', 'meta', 'admin@agency.com', { ipAddress: '127.0.0.1' }
      );
      const second = await agencyPlatformService.revokeConnection(
        'agency-1', 'meta', 'admin@agency.com', { ipAddress: '127.0.0.1' }
      );

      expect(first.error).toBeNull();
      expect(second.error).toBeNull();
      expect(revokeToken).toHaveBeenCalledTimes(1);
      expect(infisical.getOAuthTokens).toHaveBeenCalledTimes(1);
      expect(infisical.deleteSecret).toHaveBeenCalledTimes(2);
    });

    it('keeps the agency connection inactive and retryable if derived token cleanup fails', async () => {
      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
        id: 'conn-meta-1', agencyId: 'agency-1', platform: 'meta', status: 'active',
        secretId: 'meta_agency_agency-1',
        metadata: { systemUserId: '42', partnerAdminSystemUserTokenSecretId: 'meta_partner_admin_system_user_agency-1_biz-1' },
      } as any);
      vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({ id: 'conn-meta-1', status: 'invalid' } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(infisical.deleteSecret).mockRejectedValueOnce(new Error('Infisical unavailable'));

      const result = await agencyPlatformService.revokeConnection('agency-1', 'meta', 'admin@agency.com', { ipAddress: '127.0.0.1' });

      expect(result.error?.code).toBe('TOKEN_DELETION_FAILED');
      expect(infisical.deleteSecret).toHaveBeenCalledTimes(1);
      expect(infisical.deleteSecret).toHaveBeenCalledWith('meta_partner_admin_system_user_agency-1_biz-1');
      expect(prisma.agencyPlatformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-meta-1' }, data: { status: 'invalid' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'TOKEN_DELETION_FAILED' }),
      }));
    });

    it('keeps agency tokens when Meta rejects system-user credential revocation', async () => {
      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
        id: 'conn-meta-1', agencyId: 'agency-1', platform: 'meta', status: 'active',
        secretId: 'meta_agency_agency-1',
        metadata: { systemUserId: '42', partnerAdminSystemUserTokenSecretId: 'system-user-secret' },
      } as any);
      vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({ id: 'conn-meta-1', status: 'invalid' } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      revokeSystemUserTokensMock.mockResolvedValueOnce({
        error: { code: 'SYSTEM_USER_TOKEN_REVOKE_FAILED', message: 'Meta denied access' },
      });

      const result = await agencyPlatformService.revokeConnection('agency-1', 'meta', 'admin@agency.com', { ipAddress: '127.0.0.1' });

      expect(result.error?.code).toBe('META_ACCESS_REVOCATION_FAILED');
      expect(infisical.deleteSecret).not.toHaveBeenCalled();
      expect(prisma.agencyPlatformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-meta-1' }, data: { status: 'invalid' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'META_ACCESS_REVOCATION_FAILED' }),
      }));
    });

    it('should revoke connection and delete tokens from Infisical', async () => {
      const mockConnection = {
        id: 'conn-1',
        agencyId: 'agency-1',
        platform: 'google',
        secretId: 'google_agency_agency-1',
        status: 'active',
      };

      const updatedConnection = {
        ...mockConnection,
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: 'admin@agency.com',
      };

      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue(updatedConnection as any);
      vi.mocked(infisical.deleteSecret).mockResolvedValue();
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await agencyPlatformService.revokeConnection(
        'agency-1',
        'google',
        'admin@agency.com'
      );

      expect(result.error).toBeNull();
      expect(result.data).toEqual(updatedConnection);

      // Verify tokens deleted from Infisical
      expect(infisical.deleteSecret).toHaveBeenCalledWith('google_agency_agency-1');

      // Verify database updated
      expect(prisma.agencyPlatformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: {
          status: 'revoked',
          revokedAt: expect.any(Date),
          revokedBy: 'admin@agency.com',
        },
      });

      // Verify audit log
      expect(prisma.auditLog.create).toHaveBeenCalled();

      // Verify cache invalidated (so /agency-platforms/available updates immediately)
      expect(deleteCacheMock).toHaveBeenCalledWith('agency:agency-1:connections');
      expect(invalidateDashboardCacheMock).toHaveBeenCalledWith('agency-1');
    });

    it('should return error if connection not found', async () => {
      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(null);

      const result = await agencyPlatformService.revokeConnection(
        'agency-1',
        'google',
        'admin@agency.com'
      );

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('does not mark the connection revoked when secret cleanup fails', async () => {
      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
        id: 'conn-meta-1', agencyId: 'agency-1', platform: 'meta', secretId: 'meta_agency_agency-1', status: 'active',
      } as any);
      vi.mocked(infisical.deleteSecret).mockRejectedValue(new Error('Infisical unavailable'));

      const result = await agencyPlatformService.revokeConnection('agency-1', 'meta', 'admin@agency.com', { ipAddress: '127.0.0.1' });

      expect(result.error).not.toBeNull();
      expect(prisma.agencyPlatformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-meta-1' }, data: { status: 'invalid' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'TOKEN_DELETION_FAILED', agencyConnectionId: 'conn-meta-1' }),
      }));
    });
  });

  describe('refreshConnection', () => {
    it('should refresh expired tokens and update database', async () => {
      const mockConnection = {
        id: 'conn-1',
        agencyId: 'agency-1',
        platform: 'google',
        secretId: 'google_agency_agency-1',
        status: 'active',
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      const oldTokens = {
        accessToken: 'old_access_token',
        refreshToken: 'refresh_token',
        expiresAt: new Date(Date.now() - 1000),
      };

      const newTokens = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };

      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(mockConnection as any);
      vi.mocked(infisical.getOAuthTokens).mockResolvedValue(oldTokens);

      // Mock platform connector refresh (this would be called internally)
      // For now, we'll assume the service handles this
      vi.mocked(infisical.updateOAuthTokens).mockResolvedValue();
      vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({
        ...mockConnection,
        expiresAt: newTokens.expiresAt,
        lastRefreshedAt: new Date(),
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const result = await agencyPlatformService.refreshConnection(
        'agency-1',
        'google',
        newTokens
      );

      expect(result.error).toBeNull();

      // Verify tokens updated in Infisical
      expect(infisical.updateOAuthTokens).toHaveBeenCalledWith(
        'google_agency_agency-1',
        newTokens
      );

      // Verify database updated with new expiry
      expect(prisma.agencyPlatformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: {
          expiresAt: newTokens.expiresAt,
          lastRefreshedAt: expect.any(Date),
        },
      });

      // Verify audit log
      expect(prisma.auditLog.create).toHaveBeenCalled();

      // Verify cache invalidated (expiresAt affects UI)
      expect(deleteCacheMock).toHaveBeenCalledWith('agency:agency-1:connections');
      expect(invalidateDashboardCacheMock).toHaveBeenCalledWith('agency-1');
    });
  });

  describe('updateConnectionMetadata', () => {
    it('should update metadata and invalidate connections cache', async () => {
      const mockConnection = {
        id: 'conn-1',
        agencyId: 'agency-1',
        platform: 'google',
        status: 'active',
        metadata: { existing: true },
      };

      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({
        ...mockConnection,
        metadata: { existing: true, newKey: 'newVal' },
      } as any);

      const result = await agencyPlatformService.updateConnectionMetadata('agency-1', 'google', {
        newKey: 'newVal',
      });

      expect(result.error).toBeNull();
      expect(prisma.agencyPlatformConnection.update).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: {
          metadata: { existing: true, newKey: 'newVal' },
        },
      });
      expect(deleteCacheMock).toHaveBeenCalledWith('agency:agency-1:connections');
      expect(invalidateDashboardCacheMock).toHaveBeenCalledWith('agency-1');
    });
  });

  describe('getValidToken', () => {
    it('should return valid access token without refresh', async () => {
      ensureAgencyAccessTokenMock.mockResolvedValue({
        data: {
          outcome: 'still_valid',
          accessToken: 'valid_access_token',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        error: null,
      });

      const result = await agencyPlatformService.getValidToken('agency-1', 'google');

      expect(result.error).toBeNull();
      expect(result.data).toBe('valid_access_token');
      expect(ensureAgencyAccessTokenMock).toHaveBeenCalledWith('agency-1', 'google');
    });

    it('should return error if connection not found', async () => {
      ensureAgencyAccessTokenMock.mockResolvedValue({
        data: null,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Platform connection not found',
        },
      });

      const result = await agencyPlatformService.getValidToken('agency-1', 'google');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('should return error if connection is not active', async () => {
      ensureAgencyAccessTokenMock.mockResolvedValue({
        data: null,
        error: {
          code: 'CONNECTION_NOT_ACTIVE',
          message: 'Platform connection is not active',
        },
      });

      const result = await agencyPlatformService.getValidToken('agency-1', 'google');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('CONNECTION_NOT_ACTIVE');
    });

    it('should return reconnect required when expired platform requires reconnect', async () => {
      ensureAgencyAccessTokenMock.mockResolvedValue({
        data: null,
        error: {
          code: 'RECONNECT_REQUIRED',
          message: 'meta authorization has expired and requires reconnect',
        },
      });

      const result = await agencyPlatformService.getValidToken('agency-1', 'meta');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('RECONNECT_REQUIRED');
    });
  });

  describe('validateConnection', () => {
    it('should return true for valid active connection', async () => {
      const mockConnection = {
        id: 'conn-1',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue(mockConnection as any);

      const result = await agencyPlatformService.validateConnection('conn-1');

      expect(result.error).toBeNull();
      expect(result.data).toBe(true);
    });

    it('should return false for revoked connection', async () => {
      const mockConnection = {
        id: 'conn-1',
        status: 'revoked',
      };

      vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue(mockConnection as any);

      const result = await agencyPlatformService.validateConnection('conn-1');

      expect(result.error).toBeNull();
      expect(result.data).toBe(false);
    });

    it('should return false for expired connection', async () => {
      const mockConnection = {
        id: 'conn-1',
        status: 'active',
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue(mockConnection as any);

      const result = await agencyPlatformService.validateConnection('conn-1');

      expect(result.error).toBeNull();
      expect(result.data).toBe(false);
    });

    it('should return false if connection not found', async () => {
      vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue(null);

      const result = await agencyPlatformService.validateConnection('non-existent');

      expect(result.error).toBeNull();
      expect(result.data).toBe(false);
    });
  });
});
