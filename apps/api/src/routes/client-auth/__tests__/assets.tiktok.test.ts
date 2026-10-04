import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAssetRoutes } from '../assets.routes';
import { accessRequestService } from '@/services/access-request.service';
import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { clientAssetsService } from '@/services/client-assets.service';
import { auditService } from '@/services/audit.service';
import { tiktokPartnerService } from '@/services/tiktok-partner.service';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getAccessRequestByToken: vi.fn(),
  },
}));

vi.mock('@/services/client-assets.service', () => ({
  clientAssetsService: {
    fetchTikTokAssets: vi.fn(),
  },
}));

vi.mock('@/services/audit.service', () => ({
  auditService: {
    createAuditLog: vi.fn(),
  },
}));

vi.mock('@/services/tiktok-partner.service', () => ({
  mapAccessLevelToTikTokRole: (accessLevel: string) => {
    if (accessLevel === 'admin') return 'ADMIN';
    if (accessLevel === 'standard') return 'OPERATOR';
    return 'ANALYST';
  },
  tiktokPartnerService: {
    shareAdvertiserAssets: vi.fn(),
    verifyAdvertiserShare: vi.fn(),
  },
}));

vi.mock('@/lib/infisical', () => ({
  infisical: {
    getOAuthTokens: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    clientConnection: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agencyPlatformConnection: {
      findFirst: vi.fn(),
    },
    platformAuthorization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Client Auth Asset Routes - TikTok', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerAssetRoutes(app);
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'conn-1', granted_assets: {} }] as any);

    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        platforms: [
          {
            platformGroup: 'tiktok',
            products: [{ product: 'tiktok_ads', accessLevel: 'standard' }],
          },
        ],
      } as any,
      error: null,
    });

    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
      id: 'conn-1',
      accessRequestId: 'request-a',
      agencyId: 'agency-a',
      clientEmail: 'client@example.com',
      grantedAssets: {},
    } as any);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns TikTok assets and logs token read audit event', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'tiktok',
      secretId: 'secret-1',
      status: 'active',
      metadata: {},
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'access-token',
    } as any);

    vi.mocked(clientAssetsService.fetchTikTokAssets).mockResolvedValue({
      advertisers: [{ id: 'adv_1', name: 'Advertiser 1' }],
      businessCenters: [{ id: 'bc_1', name: 'Business Center 1' }],
      businessCenterAssets: [{ bcId: 'bc_1', advertisers: [{ id: 'adv_1', name: 'Advertiser 1' }] }],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/assets/tiktok?connectionId=conn-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      advertisers: [{ id: 'adv_1', name: 'Advertiser 1' }],
      businessCenters: [{ id: 'bc_1', name: 'Business Center 1' }],
      businessCenterAssets: [{ bcId: 'bc_1', advertisers: [{ id: 'adv_1', name: 'Advertiser 1' }] }],
    });

    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TIKTOK_TOKEN_READ',
        resourceId: 'conn-1',
      })
    );
  });

  it('persists selected TikTok advertiser IDs and BC ID into authorization metadata', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'tiktok',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: {
          google_ads: {
            adAccounts: ['123'],
          },
        },
        tiktok: {
          selectedBusinessCenterId: 'bc_old',
        },
      },
    } as any);

    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'conn-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'pa-1' } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'tiktok',
        selectedAssets: {
          adAccounts: ['adv_1', 'adv_2'],
          selectedBusinessCenterId: 'bc_1',
          availableAdvertisers: [{ id: 'adv_1', name: 'Advertiser 1' }],
          availableBusinessCenters: [{ id: 'bc_1', name: 'Business Center 1' }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pa-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            tiktok: expect.objectContaining({
              selectedAdvertiserIds: ['adv_1', 'adv_2'],
              selectedBusinessCenterId: 'bc_1',
              discoverySnapshot: expect.objectContaining({
                advertisers: [{ id: 'adv_1', name: 'Advertiser 1' }],
                businessCenters: [{ id: 'bc_1', name: 'Business Center 1' }],
              }),
            }),
          }),
        }),
      })
    );
  });

  it('shares selected TikTok advertisers to agency BC and returns partial-failure payload', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'tiktok',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        tiktok: {
          selectedBusinessCenterId: 'bc_client_1',
          selectedAdvertiserIds: ['adv_1', 'adv_2'],
        },
      },
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
      id: 'agency-conn-1',
      agencyId: 'agency-a',
      platform: 'tiktok',
      status: 'active',
      businessId: 'bc_agency_1',
      metadata: {},
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'access-token',
    } as any);

    vi.mocked(tiktokPartnerService.shareAdvertiserAssets).mockResolvedValue({
      success: false,
      results: [
        { advertiserId: 'adv_1', status: 'granted' },
        { advertiserId: 'adv_2', status: 'failed', error: 'permission denied' },
      ],
    });

    vi.mocked(tiktokPartnerService.verifyAdvertiserShare).mockResolvedValue(true);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'pa-1' } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/tiktok/share-partner-access',
      payload: {
        connectionId: 'conn-1',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.error).toBeNull();
    expect(body.data.success).toBe(false);
    expect(body.data.manualFallback.required).toBe(true);
    expect(body.data.manualFallback.agencyBusinessCenterId).toBe('bc_agency_1');
    expect(body.data.results).toHaveLength(2);
    expect(JSON.stringify(body)).not.toContain('access-token');

    expect(tiktokPartnerService.shareAdvertiserAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        clientBusinessCenterId: 'bc_client_1',
        agencyBusinessCenterId: 'bc_agency_1',
        advertiserIds: ['adv_1', 'adv_2'],
        advertiserRole: 'OPERATOR',
      })
    );

    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pa-1' },
      })
    );

    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TIKTOK_PARTNER_SHARE_ATTEMPT',
        resourceId: 'conn-1',
      })
    );
  });

  it('returns 400 when share endpoint has no selected advertisers', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'tiktok',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        tiktok: {
          selectedBusinessCenterId: 'bc_client_1',
          selectedAdvertiserIds: [],
        },
      },
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
      id: 'agency-conn-1',
      agencyId: 'agency-a',
      platform: 'tiktok',
      status: 'active',
      businessId: 'bc_agency_1',
      metadata: {},
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/tiktok/share-partner-access',
      payload: {
        connectionId: 'conn-1',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('verifies TikTok partner share status and persists verification snapshot', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'tiktok',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        tiktok: {
          selectedBusinessCenterId: 'bc_client_1',
          selectedAdvertiserIds: ['adv_1', 'adv_2'],
          partnerSharing: {
            agencyBusinessCenterId: 'bc_agency_1',
            results: [],
          },
        },
      },
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'access-token',
    } as any);

    vi.mocked(tiktokPartnerService.verifyAdvertiserShare)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'pa-1' } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/tiktok/verify-share',
      payload: {
        connectionId: 'conn-1',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.success).toBe(false);
    expect(body.data.partialFailure).toBe(true);
    expect(body.data.results).toEqual([
      expect.objectContaining({ advertiserId: 'adv_1', status: 'granted', verified: true }),
      expect.objectContaining({ advertiserId: 'adv_2', status: 'failed', verified: false }),
    ]);

    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pa-1' },
      })
    );
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TIKTOK_PARTNER_SHARE_VERIFIED',
        resourceId: 'conn-1',
      })
    );
  });
});
