import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../agency-platform.service.js', () => ({
  agencyPlatformService: {
    getValidToken: vi.fn(),
    updateConnectionMetadata: vi.fn(),
    getConnection: vi.fn(),
  },
}));

vi.mock('../connectors/meta.js', () => ({
  MetaConnector: vi.fn(),
}));

vi.mock('../meta-system-user.service.js', () => ({
  metaSystemUserService: {
    getOrCreateSystemUser: vi.fn(),
    createSystemUserAccessToken: vi.fn(),
    getSystemUsers: vi.fn(),
    getDefaultPartnerAdminSystemUserName: vi
      .fn()
      .mockReturnValue('Agency Platform Admin System User'),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agencyPlatformConnection: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/services/audit.service', () => ({
  createAuditLog: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/services/audit.service';
import { agencyPlatformService } from '../agency-platform.service.js';
import { MetaConnector } from '../connectors/meta.js';
import { metaAssetsService } from '../meta-assets.service.js';
import { metaSystemUserService } from '../meta-system-user.service.js';

const mockMetaConnectorInstance = {
  getAllAssets: vi.fn(),
  getClientInstagramAccounts: vi.fn(),
};

describe('MetaAssetsService', () => {
  const agencyId = 'agency-1';
  const businessId = 'biz-1';
  const accessToken = 'token-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAssignableRecipients', () => {
    it('returns people and system users from the selected agency portfolio', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'agency-meta-connection-1', businessId, metadata: {} },
        error: null,
      } as any);
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({ data: accessToken, error: null });
      vi.mocked(metaSystemUserService.getSystemUsers).mockResolvedValue({
        data: [{ id: 'system-1', name: 'Automation', role: 'ADMIN' }],
        error: null,
      } as any);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'person-1', name: 'Jon High', email: 'jon@example.com', role: 'ADMIN' }] }),
      }));
      vi.mocked(createAuditLog).mockResolvedValue({ data: {} as any, error: null });

      const request = {
        ip: '203.0.113.4',
        headers: { 'user-agent': 'test-agent' },
        user: { sub: 'user-1', email: 'owner@example.com' },
      } as any;
      const result = await metaAssetsService.getAssignableRecipients(agencyId, request);

      expect(result.error).toBeNull();
      expect(result.data).toEqual([
        { type: 'human', id: 'person-1', name: 'Jon High', email: 'jon@example.com', role: 'ADMIN' },
        { type: 'system_user', id: 'system-1', name: 'Automation', role: 'ADMIN' },
      ]);
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain(`/${businessId}/business_users`);
      expect(String(url)).not.toContain('access_token');
      expect(options.method).toBe('GET');
      expect(new Headers(options.headers).get('Authorization')).toBe(`Bearer ${accessToken}`);
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.redirect).toBe('error');
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        agencyId,
        userEmail: 'owner@example.com',
        action: 'ACCESSED',
        resourceType: 'connection',
        resourceId: expect.any(String),
        agencyConnectionId: expect.any(String),
        platform: 'meta',
        request,
        metadata: {
          operation: 'list_assignable_recipients',
          actorType: 'authenticated_user',
          actorId: 'user-1',
        },
      }));
    });

    it('loads all human recipients across Meta Graph pages', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'agency-meta-connection-1', businessId, metadata: {} }, error: null,
      } as any);
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({ data: accessToken, error: null });
      vi.mocked(metaSystemUserService.getSystemUsers).mockResolvedValue({ data: [], error: null });
      vi.mocked(createAuditLog).mockResolvedValue({ data: {} as any, error: null });
      const secondPage = `https://graph.facebook.com/v25.0/${businessId}/business_users?after=cursor`;
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: 'person-1', name: 'First' }], paging: { next: secondPage } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: 'person-2', name: 'Second' }] }),
        }));

      const result = await metaAssetsService.getAssignableRecipients(agencyId, {
        ip: '203.0.113.4', headers: { 'user-agent': 'test-agent' }, user: { sub: 'user-1' },
      } as any);

      expect(result).toEqual({
        data: [
          { type: 'human', id: 'person-1', name: 'First' },
          { type: 'human', id: 'person-2', name: 'Second' },
        ],
        error: null,
      });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('does not return a partial recipient list when system-user discovery has no result or error', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'agency-meta-connection-1', businessId, metadata: {} }, error: null,
      } as any);
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({ data: accessToken, error: null });
      vi.mocked(metaSystemUserService.getSystemUsers).mockResolvedValue({ data: null, error: null });
      vi.mocked(createAuditLog).mockResolvedValue({ data: {} as any, error: null });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, json: async () => ({ data: [{ id: 'person-1', name: 'First' }] }),
      }));

      const result = await metaAssetsService.getAssignableRecipients(agencyId, {
        ip: '203.0.113.4', headers: { 'user-agent': 'test-agent' }, user: { sub: 'user-1' },
      } as any);

      expect(result).toEqual({
        data: null,
        error: { code: 'SYSTEM_USER_LIST_FAILED', message: 'Failed to list Meta system users' },
      });
    });

    it('does not return system users when human recipient discovery fails', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'agency-meta-connection-1', businessId, metadata: {} }, error: null,
      } as any);
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({ data: accessToken, error: null });
      vi.mocked(metaSystemUserService.getSystemUsers).mockResolvedValue({
        data: [{ id: 'system-1', name: 'Automation', role: 'ADMIN' }], error: null,
      } as any);
      vi.mocked(createAuditLog).mockResolvedValue({ data: {} as any, error: null });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'Permission denied' } }),
      }));

      const result = await metaAssetsService.getAssignableRecipients(agencyId, {
        ip: '203.0.113.4', headers: { 'user-agent': 'test-agent' }, user: { sub: 'user-1' },
      } as any);

      expect(result).toEqual({
        data: null,
        error: { code: 'META_BUSINESS_USERS_FAILED', message: 'Permission denied' },
      });
    });

    it('does not return humans when system-user discovery fails', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'agency-meta-connection-1', businessId, metadata: {} }, error: null,
      } as any);
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({ data: accessToken, error: null });
      vi.mocked(metaSystemUserService.getSystemUsers).mockResolvedValue({
        data: null, error: { code: 'SYSTEM_USER_LIST_FAILED', message: 'Graph unavailable' },
      });
      vi.mocked(createAuditLog).mockResolvedValue({ data: {} as any, error: null });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, json: async () => ({ data: [{ id: 'person-1', name: 'First' }] }),
      }));

      const result = await metaAssetsService.getAssignableRecipients(agencyId, {
        ip: '203.0.113.4', headers: { 'user-agent': 'test-agent' }, user: { sub: 'user-1' },
      } as any);

      expect(result).toEqual({
        data: null,
        error: { code: 'SYSTEM_USER_LIST_FAILED', message: 'Graph unavailable' },
      });
    });

    it('does not attribute a public invite lookup to the stored client email', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'agency-meta-connection-1', businessId, metadata: {} }, error: null,
      } as any);
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({ data: accessToken, error: null });
      vi.mocked(metaSystemUserService.getSystemUsers).mockResolvedValue({ data: [], error: null } as any);
      vi.mocked(createAuditLog).mockResolvedValue({ data: {} as any, error: null });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }));
      const request = { ip: '203.0.113.5', headers: { 'user-agent': 'invite-test' } } as any;

      await metaAssetsService.getAssignableRecipients(
        agencyId, request, undefined, 'access_request_holder', 'request-1'
      );

      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        agencyId,
        userEmail: undefined,
        request,
        metadata: {
          operation: 'list_assignable_recipients',
          actorType: 'access_request_holder',
          actorId: 'request-1',
        },
      }));
    });

    it('does not read an agency token when the audit write fails', async () => {
      vi.stubGlobal('fetch', vi.fn());
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'agency-meta-connection-1', businessId, metadata: {} },
        error: null,
      } as any);
      vi.mocked(createAuditLog).mockResolvedValue({
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Audit storage unavailable' },
      });

      const result = await metaAssetsService.getAssignableRecipients(agencyId, {} as any);

      expect(result.error?.code).toBe('INTERNAL_ERROR');
      expect(agencyPlatformService.getValidToken).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it('reads client Instagram assets and returns Graph errors as verification failures', async () => {
    vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
      data: { id: 'connection-1' }, error: null,
    } as any);
    vi.mocked(createAuditLog).mockResolvedValue({ data: {} as any, error: null });
    vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({ data: accessToken, error: null });
    vi.mocked(MetaConnector).mockImplementation(function () { return mockMetaConnectorInstance as any; });
    mockMetaConnectorInstance.getClientInstagramAccounts.mockResolvedValue([{ id: 'ig-1', username: 'client' }]);
    const request = { ip: '203.0.113.4', headers: { 'user-agent': 'test-agent' } } as any;

    await expect(metaAssetsService.getClientInstagramAssetsForBusiness(agencyId, businessId, request, 'request-1')).resolves.toEqual({
      data: [{ id: 'ig-1', username: 'client' }],
      error: null,
    });
    expect(mockMetaConnectorInstance.getClientInstagramAccounts).toHaveBeenCalledWith(accessToken, businessId);
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ACCESSED', resourceId: 'connection-1',
      metadata: expect.objectContaining({ operation: 'list_client_instagram_assets', actorId: 'request-1' }),
    }));

    mockMetaConnectorInstance.getClientInstagramAccounts.mockRejectedValue(new Error('Graph denied access'));
    await expect(metaAssetsService.getClientInstagramAssetsForBusiness(agencyId, businessId, request, 'request-1')).resolves.toMatchObject({
      data: null,
      error: { code: 'META_CLIENT_INSTAGRAM_ASSETS_FAILED', message: 'Graph denied access' },
    });
  });

  describe('getAssetsForBusiness', () => {
    it('does not read the Meta token when the access audit fails', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'connection-1' }, error: null,
      } as any);
      vi.mocked(createAuditLog).mockResolvedValue({
        data: null, error: { code: 'INTERNAL_ERROR', message: 'Audit storage unavailable' },
      } as any);

      const result = await metaAssetsService.getAssetsForBusiness(
        agencyId, businessId, { ip: '203.0.113.4', headers: {} } as any
      );

      expect(result.error?.code).toBe('INTERNAL_ERROR');
      expect(agencyPlatformService.getValidToken).not.toHaveBeenCalled();
    });

    it('should retrieve assets using valid token', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'connection-1' }, error: null,
      } as any);
      vi.mocked(createAuditLog).mockResolvedValue({ data: {} as any, error: null });
      const mockAssets = {
        businessId,
        businessName: 'Test Biz',
        adAccounts: [],
        pages: [],
        instagramAccounts: [],
        productCatalogs: [],
      };

      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({ data: accessToken, error: null });
      vi.mocked(MetaConnector).mockImplementation(function () {
        return mockMetaConnectorInstance as any;
      });
      mockMetaConnectorInstance.getAllAssets.mockResolvedValue(mockAssets);

      const request = { ip: '203.0.113.4', headers: { 'user-agent': 'test-agent' } } as any;
      const result = await metaAssetsService.getAssetsForBusiness(agencyId, businessId, request);

      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'ACCESSED', resourceId: 'connection-1',
        metadata: expect.objectContaining({ operation: 'list_business_assets' }),
      }));
      expect(agencyPlatformService.getValidToken).toHaveBeenCalledWith(agencyId, 'meta');
      expect(mockMetaConnectorInstance.getAllAssets).toHaveBeenCalledWith(accessToken, businessId);
      expect(result.data).toEqual(mockAssets);
    });

    it('should return error if token retrieval fails', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'connection-1' }, error: null,
      } as any);
      vi.mocked(createAuditLog).mockResolvedValue({ data: {} as any, error: null });
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({
        data: null,
        error: { code: 'CONNECTION_NOT_FOUND', message: 'Not found' } as any,
      });

      const result = await metaAssetsService.getAssetsForBusiness(agencyId, businessId, { ip: '', headers: {} } as any);

      expect(result.error?.code).toBe('CONNECTION_NOT_FOUND');
    });
  });

  describe('saveAssetSelections', () => {
    it('should store selections in connection metadata', async () => {
      const selections = [
        { assetType: 'ad_account', assetId: 'act_1', permissionLevel: 'advertise', selected: true },
      ] as any;

      vi.mocked(agencyPlatformService.updateConnectionMetadata).mockResolvedValue({ data: {}, error: null } as any);

      const result = await metaAssetsService.saveAssetSelections(agencyId, selections);

      expect(agencyPlatformService.updateConnectionMetadata).toHaveBeenCalledWith(
        agencyId,
        'meta',
        { assetSelections: selections }
      );
      expect(result.error).toBeNull();
    });
  });

  describe('saveBusinessPortfolio', () => {
    it('persists the partner admin system-user token reference when Meta setup succeeds', async () => {
      vi.mocked(agencyPlatformService.updateConnectionMetadata).mockResolvedValue({
        data: {},
        error: null,
      } as any);
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: {
          id: 'conn-1',
          metadata: {
            tokenType: 'bearer',
          },
          connectedBy: 'owner@agency.test',
        },
        error: null,
      } as any);
      vi.mocked(prisma.agencyPlatformConnection.update)
        .mockResolvedValueOnce({
          id: 'conn-1',
          metadata: {
            tokenType: 'bearer',
          },
        } as any)
        .mockResolvedValueOnce({
          id: 'conn-1',
          metadata: {
            tokenType: 'bearer',
            systemUserId: 'sys-admin-1',
            partnerAdminSystemUserStatus: 'ready',
            partnerAdminSystemUserTokenSecretId:
              'meta_partner_admin_system_user_agency-1_biz-1',
          },
        } as any);
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({
        data: accessToken,
        error: null,
      } as any);
      vi.mocked(metaSystemUserService.getOrCreateSystemUser).mockResolvedValue({
        data: 'sys-admin-1',
        error: null,
      });
      vi.mocked(metaSystemUserService.createSystemUserAccessToken).mockResolvedValue({
        data: {
          tokenSecretId: 'meta_partner_admin_system_user_agency-1_biz-1',
          scopes: ['ads_management', 'business_management', 'pages_read_engagement'],
        },
        error: null,
      });
      vi.mocked(createAuditLog).mockResolvedValue({ data: {}, error: null } as any);

      const result = await metaAssetsService.saveBusinessPortfolio(
        agencyId,
        businessId,
        'Agency Business'
      );

      expect(result.error).toBeNull();
      expect(agencyPlatformService.updateConnectionMetadata).toHaveBeenCalledWith(
        agencyId,
        'meta',
        {
          selectedBusinessId: businessId,
          selectedBusinessName: 'Agency Business',
        }
      );
      expect(metaSystemUserService.getOrCreateSystemUser).toHaveBeenCalledWith(
        businessId,
        accessToken,
        {
          name: 'Agency Platform Admin System User',
          role: 'ADMIN',
        }
      );
      expect(metaSystemUserService.createSystemUserAccessToken).toHaveBeenCalledWith({
        businessId,
        systemUserId: 'sys-admin-1',
        accessToken,
        secretName: 'meta_partner_admin_system_user_agency-1_biz-1',
      });
      expect(prisma.agencyPlatformConnection.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'conn-1' },
        data: {
          metadata: {
            tokenType: 'bearer',
            systemUserId: 'sys-admin-1',
            partnerAdminSystemUserStatus: 'ready',
            partnerAdminSystemUserTokenSecretId:
              'meta_partner_admin_system_user_agency-1_biz-1',
            partnerAdminSystemUserScopes: [
              'ads_management',
              'business_management',
              'pages_read_engagement',
            ],
            partnerAdminSystemUserProvisionedAt: expect.any(String),
          },
        },
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          agencyId,
          agencyConnectionId: 'conn-1',
          action: 'META_PARTNER_SYSTEM_USER_TOKEN_PROVISIONED',
          userEmail: 'owner@agency.test',
          metadata: expect.objectContaining({
            businessId,
            systemUserId: 'sys-admin-1',
            tokenSecretId: 'meta_partner_admin_system_user_agency-1_biz-1',
          }),
        })
      );
    });

    it('persists a failed partner admin system-user token state without failing the business save', async () => {
      vi.mocked(agencyPlatformService.updateConnectionMetadata).mockResolvedValue({
        data: {},
        error: null,
      } as any);
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: {
          id: 'conn-1',
          metadata: {
            tokenType: 'bearer',
            previous: true,
          },
          connectedBy: 'owner@agency.test',
        },
        error: null,
      } as any);
      vi.mocked(prisma.agencyPlatformConnection.update)
        .mockResolvedValueOnce({
          id: 'conn-1',
          metadata: {
            tokenType: 'bearer',
            previous: true,
          },
        } as any)
        .mockResolvedValueOnce({
          id: 'conn-1',
          metadata: {
            tokenType: 'bearer',
            previous: true,
            systemUserId: 'sys-admin-1',
            partnerAdminSystemUserStatus: 'failed',
          },
        } as any);
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({
        data: accessToken,
        error: null,
      } as any);
      vi.mocked(metaSystemUserService.getOrCreateSystemUser).mockResolvedValue({
        data: 'sys-admin-1',
        error: null,
      });
      vi.mocked(metaSystemUserService.createSystemUserAccessToken).mockResolvedValue({
        data: null,
        error: {
          code: 'SYSTEM_USER_TOKEN_CREATE_FAILED_200',
          message: 'Permission denied',
        },
      });
      vi.mocked(createAuditLog).mockResolvedValue({ data: {}, error: null } as any);

      const result = await metaAssetsService.saveBusinessPortfolio(
        agencyId,
        businessId,
        'Agency Business'
      );

      expect(result.error).toBeNull();
      expect(prisma.agencyPlatformConnection.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'conn-1' },
        data: {
          metadata: {
            tokenType: 'bearer',
            previous: true,
            systemUserId: 'sys-admin-1',
            partnerAdminSystemUserStatus: 'failed',
            partnerAdminSystemUserLastErrorCode: 'SYSTEM_USER_TOKEN_CREATE_FAILED_200',
            partnerAdminSystemUserLastErrorMessage: 'Permission denied',
            partnerAdminSystemUserLastAttemptAt: expect.any(String),
          },
        },
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          agencyId,
          agencyConnectionId: 'conn-1',
          action: 'META_PARTNER_SYSTEM_USER_TOKEN_PROVISION_FAILED',
          userEmail: 'owner@agency.test',
          metadata: expect.objectContaining({
            businessId,
            systemUserId: 'sys-admin-1',
            errorCode: 'SYSTEM_USER_TOKEN_CREATE_FAILED_200',
          }),
        })
      );
    });
  });

  describe('getAssetSettings', () => {
    it('defaults catalog to disabled for App Review scope', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'conn-1', metadata: {} },
        error: null,
      } as any);

      const result = await metaAssetsService.getAssetSettings(agencyId);

      expect(result.error).toBeNull();
      expect(result.data?.catalog.enabled).toBe(false);
      expect(result.data?.adAccount.enabled).toBe(true);
    });
  });
});
