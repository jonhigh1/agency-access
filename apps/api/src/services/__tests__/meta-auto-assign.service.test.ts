import { beforeEach, describe, expect, it, vi } from 'vitest';
import { metaAutoAssignService } from '../meta-auto-assign.service.js';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    accessRequest: { findFirst: vi.fn() },
  },
}));

vi.mock('@/services/agency-platform.service.js', () => ({
  agencyPlatformService: {
    getConnection: vi.fn(),
    getValidToken: vi.fn(),
    updateConnectionMetadata: vi.fn(),
  },
}));

vi.mock('@/services/meta-assets.service.js', () => ({
  metaAssetsService: {
    getAssignableRecipients: vi.fn(),
  },
}));

vi.mock('@/services/meta-partner.service.js', () => ({
  metaPartnerService: {
    assignAgencyRecipientToAsset: vi.fn(),
    verifyAgencyRecipientOnAsset: vi.fn(),
  },
}));

vi.mock('@/services/meta-asset-grant.service.js', () => ({
  metaAssetGrantService: {
    claimAttempts: vi.fn(),
    recordOutcomes: vi.fn(),
  },
}));

vi.mock('@/services/audit.service.js', () => ({
  createAuditLog: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { agencyPlatformService } from '@/services/agency-platform.service.js';
import { metaAssetsService } from '@/services/meta-assets.service.js';
import { metaPartnerService } from '@/services/meta-partner.service.js';
import { metaAssetGrantService } from '@/services/meta-asset-grant.service.js';
import { createAuditLog } from '@/services/audit.service.js';

const mockRequest = { user: { sub: 'user-1' }, ip: '127.0.0.1' } as any;

describe('metaAutoAssignService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAuditLog).mockResolvedValue({ error: null } as any);
    vi.mocked(metaAssetGrantService.claimAttempts).mockResolvedValue(new Map([['page:page-1', 1]]));
    vi.mocked(metaAssetGrantService.recordOutcomes).mockResolvedValue(undefined);
  });

  describe('savePreferences', () => {
    it('persists enabled recipients after validating against agency assignees', async () => {
      vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
        data: [{ type: 'human', id: '42', name: 'Alex' }],
        error: null,
      });
      vi.mocked(agencyPlatformService.updateConnectionMetadata).mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await metaAutoAssignService.savePreferences(
        'agency-1',
        { enabled: true, recipients: [{ type: 'human', id: '42', name: 'Alex' }] },
        mockRequest,
      );

      expect(result.error).toBeNull();
      expect(agencyPlatformService.updateConnectionMetadata).toHaveBeenCalledWith('agency-1', 'meta', {
        autoAssignPreferences: { enabled: true, recipients: [{ type: 'human', id: '42', name: 'Alex' }] },
      });
    });

    it('rejects recipients outside the agency portfolio', async () => {
      vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
        data: [{ type: 'human', id: '42', name: 'Alex' }],
        error: null,
      });

      const result = await metaAutoAssignService.savePreferences(
        'agency-1',
        { enabled: true, recipients: [{ type: 'system_user', id: '99' }] },
        mockRequest,
      );

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('INVALID_AUTO_ASSIGN_RECIPIENT');
    });
  });

  describe('runForAccessRequest', () => {
    it('assigns configured recipients after verified partner grants and records per-recipient results', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: {
          id: 'conn-agency',
          businessId: 'agency-bm',
          metadata: {
            autoAssignPreferences: {
              enabled: true,
              recipients: [{ type: 'human', id: '42', name: 'Alex' }],
            },
          },
        },
        error: null,
      });
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({
        data: 'agency-token',
        error: null,
      });
      vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue({
        id: 'req-1',
        agencyId: 'agency-1',
        platforms: [{ products: [{ product: 'meta_pages' }] }],
        metaAccessConfig: { recipients: [], pageTasks: ['ADVERTISE'], adAccountTasks: [], catalogTasks: [] },
        connection: {
          id: 'client-conn',
          authorizations: [{ id: 'auth-1', authorizationEpoch: 1 }],
          metaAssetGrants: [
            {
              recipientType: 'business',
              recipientId: 'agency-bm',
              status: 'verified',
              grantMethod: 'automatic_agency_partner',
              assetKind: 'page',
              assetId: 'page-1',
              assetName: 'Demo Page',
              clientBusinessId: 'client-bm',
              requestedTasks: ['ADVERTISE'],
              destination: { name: 'Agency BM', agencyConnection: { id: 'conn-agency', businessId: 'agency-bm', status: 'active' } },
            },
          ],
        },
      } as any);
      vi.mocked(metaPartnerService.assignAgencyRecipientToAsset).mockResolvedValue(undefined);
      vi.mocked(metaPartnerService.verifyAgencyRecipientOnAsset).mockResolvedValue({
        verified: true,
        assignedTasks: ['ADVERTISE'],
      });

      const result = await metaAutoAssignService.runForAccessRequest('req-1', 'agency-1', mockRequest);

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toMatchObject({
        assetId: 'page-1',
        recipientId: '42',
        status: 'verified',
        verifiedTasks: ['ADVERTISE'],
      });
      expect(metaPartnerService.assignAgencyRecipientToAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          agencyAccessToken: 'agency-token',
          assetId: 'page-1',
          recipientId: '42',
        }),
      );
      expect(metaAssetGrantService.recordOutcomes).toHaveBeenCalled();
    });

    it('fails closed when partner access is not verified yet', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: {
          id: 'conn-agency',
          businessId: 'agency-bm',
          metadata: {
            autoAssignPreferences: {
              enabled: true,
              recipients: [{ type: 'human', id: '42' }],
            },
          },
        },
        error: null,
      });
      vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue({
        id: 'req-1',
        agencyId: 'agency-1',
        platforms: [],
        connection: {
          id: 'client-conn',
          authorizations: [],
          metaAssetGrants: [
            {
              recipientType: 'business',
              status: 'manual_action_required',
              grantMethod: 'automatic_agency_partner',
              assetKind: 'page',
              assetId: 'page-1',
            },
          ],
        },
      } as any);

      const result = await metaAutoAssignService.runForAccessRequest('req-1', 'agency-1', mockRequest);

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('PARTNER_ACCESS_NOT_VERIFIED');
      expect(metaPartnerService.assignAgencyRecipientToAsset).not.toHaveBeenCalled();
    });
  });
});
