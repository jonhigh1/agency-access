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
};

describe('MetaAssetsService', () => {
  const agencyId = 'agency-1';
  const businessId = 'biz-1';
  const accessToken = 'token-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAssetsForBusiness', () => {
    it('should retrieve assets using valid token', async () => {
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

      const result = await metaAssetsService.getAssetsForBusiness(agencyId, businessId);

      expect(agencyPlatformService.getValidToken).toHaveBeenCalledWith(agencyId, 'meta');
      expect(mockMetaConnectorInstance.getAllAssets).toHaveBeenCalledWith(accessToken, businessId);
      expect(result.data).toEqual(mockAssets);
    });

    it('should return error if token retrieval fails', async () => {
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({
        data: null,
        error: { code: 'CONNECTION_NOT_FOUND', message: 'Not found' } as any,
      });

      const result = await metaAssetsService.getAssetsForBusiness(agencyId, businessId);

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
          scopes: ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement'],
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
              'ads_read',
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
});
