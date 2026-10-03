import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAssetRoutes } from '../assets.routes';
import { accessRequestService } from '@/services/access-request.service';
import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { auditService } from '@/services/audit.service';
import { metaAssetsService } from '@/services/meta-assets.service';
import { clientAssetsService } from '@/services/client-assets.service';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getAccessRequestByToken: vi.fn(),
  },
}));

vi.mock('@/lib/infisical', () => ({
  infisical: {
    getOAuthTokens: vi.fn(),
  },
}));

vi.mock('@/services/audit.service', () => ({
  auditService: {
    createAuditLog: vi.fn(),
  },
}));

vi.mock('@/services/meta-assets.service', () => ({
  metaAssetsService: {
    getAssetSettings: vi.fn(),
    getAssignableRecipients: vi.fn(),
    getAssetsForBusiness: vi.fn(),
    getClientInstagramAssetsForBusiness: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clientConnection: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    platformAuthorization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agencyPlatformConnection: {
      findUnique: vi.fn(),
    },
    metaAgencyDestination: {
      upsert: vi.fn(),
    },
    metaAssetGrant: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const metaAccessConfig = {
  recipients: [{ type: 'human', id: 'person-1' }],
  pageTasks: ['MANAGE'],
  adAccountTasks: ['ANALYZE'],
  catalogTasks: ['ADVERTISE'],
  datasetTasks: ['ADVERTISE'],
};

function mockSavePath(options?: { existingGrants?: Array<Record<string, unknown>> }) {
  vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
    data: {
      id: 'request-a',
      agencyId: 'agency-a',
      metaAccessConfig,
      platforms: [{ platformGroup: 'meta', products: [{ product: 'meta_ads' }] }],
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
  vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
    id: 'pa-1',
    connectionId: 'conn-1',
    platform: 'meta',
    secretId: 'secret-1',
    status: 'active',
    authorizationEpoch: 2,
    metadata: {
      meta: {
        selection: {
          clientBusinessId: 'biz_client_2',
          selectedAt: '2026-09-22T00:00:00.000Z',
        },
      },
    },
  } as any);
  vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
    id: 'agency-meta-1',
    agencyId: 'agency-a',
    platform: 'meta',
    businessId: 'partner-bm-1',
    metadata: { selectedBusinessName: 'Agency Portfolio' },
  } as any);
  vi.mocked(infisical.getOAuthTokens).mockResolvedValue({ accessToken: 'meta-token' } as any);
  vi.mocked(metaAssetsService.getAssetSettings).mockResolvedValue({
    data: { catalog: { enabled: true, permissionLevel: 'manage' } } as any,
    error: null,
  });
  vi.spyOn(clientAssetsService, 'fetchMetaAssets').mockResolvedValue({
    businesses: [{ id: 'biz_client_2', name: 'Client Two' }],
    selectedBusinessId: 'biz_client_2',
    selectedBusinessName: 'Client Two',
    pages: [{ id: 'page_1', name: 'Page One' }],
    adAccounts: [{ id: 'act_1', name: 'Ad One', account_status: 1 }],
    instagramAccounts: [],
    productCatalogs: [{ id: 'catalog-1', name: 'Catalog', catalogType: 'commerce', ownershipType: 'owned' }],
    pixels: [{ id: 'pixel-1', name: 'Pixel' }],
  } as any);
  vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValue(
    (options?.existingGrants ?? []) as any
  );
}

describe('save-assets explicit asset-type declines', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerAssetRoutes(app);
    vi.clearAllMocks();
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'conn-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'pa-1' } as any);
    vi.mocked(prisma.metaAgencyDestination.upsert).mockResolvedValue({ id: 'destination-1' } as any);
    vi.mocked(prisma.metaAssetGrant.upsert).mockResolvedValue({ id: 'grant-1', attemptVersion: 1 } as any);
    vi.mocked(prisma.metaAssetGrant.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({ data: true, error: null } as any);
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('accepts a zero-selection save with declines and persists them', async () => {
    mockSavePath();

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        declinedAssetKinds: ['catalog'],
        selectedAssets: { selectedBusinessId: 'biz_client_2' },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.clientConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          grantedAssets: expect.objectContaining({
            meta: expect.objectContaining({
              declinedAssetKinds: expect.objectContaining({ kinds: ['catalog'] }),
            }),
          }),
        }),
      })
    );
    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            meta: expect.objectContaining({ declinedAssetKinds: ['catalog'] }),
          }),
        }),
      })
    );
    // Zero requirements: no grant rows to upsert.
    expect(prisma.metaAssetGrant.upsert).not.toHaveBeenCalled();
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CLIENT_ASSETS_SELECTED',
        metadata: expect.objectContaining({
          declines: ['catalog'],
        }),
      })
    );
  });

  it('still rejects a zero-selection save without declines', async () => {
    mockSavePath();

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: { selectedBusinessId: 'biz_client_2' },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('NO_SELECTED_ASSETS');
  });

  it('drops a decline for a kind that has selections in the same save', async () => {
    mockSavePath();

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        declinedAssetKinds: ['catalog'],
        selectedAssets: {
          selectedBusinessId: 'biz_client_2',
          catalogs: ['catalog-1'],
          selectedCatalogsWithNames: [{ id: 'catalog-1', name: 'Catalog' }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            meta: expect.objectContaining({ declinedAssetKinds: [] }),
          }),
        }),
      })
    );
  });

  it('drops declines for kinds the catalog setting does not allow, so an empty save still fails', async () => {
    mockSavePath();
    vi.mocked(metaAssetsService.getAssetSettings).mockResolvedValue({
      data: { catalog: { enabled: false, permissionLevel: 'manage' } } as any,
      error: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        declinedAssetKinds: ['catalog'],
        selectedAssets: { selectedBusinessId: 'biz_client_2' },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('NO_SELECTED_ASSETS');
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
  });

  it('excludes removed assets from requirements on re-save, never verified ones', async () => {
    mockSavePath({
      existingGrants: [
        { assetKind: 'page', assetId: 'page_1', status: 'sharing_attempted', metadata: null },
        { assetKind: 'ad_account', assetId: 'act_1', status: 'manual_action_required', metadata: null },
        { assetKind: 'page', assetId: 'page_verified', status: 'verified', metadata: null },
      ],
    });

    // Re-save keeps page_1, drops act_1 and page_verified from the selection.
    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: {
          selectedBusinessId: 'biz_client_2',
          pages: ['page_1'],
          selectedPagesWithNames: [{ id: 'page_1', name: 'Page One' }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const exclusionCalls = vi.mocked(prisma.metaAssetGrant.updateMany).mock.calls.filter(
      ([call]) => (call as any)?.data?.status === 'excluded'
    );
    expect(exclusionCalls).toHaveLength(1);
    const [exclusionInput] = exclusionCalls[0] as any as [any];
    expect(exclusionInput.where.assetId).toBe('act_1');
    expect(exclusionInput.where.status).toEqual({ notIn: ['verified', 'excluded'] });
    expect(exclusionInput.data.metadata.exclusion).toEqual(
      expect.objectContaining({ reason: 'removed_from_selection', excludedBy: 'client' })
    );
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'META_GRANT_REMOVED_FROM_SELECTION' })
    );
  });

  it('resets client-excluded rows to selected when the asset re-enters the selection', async () => {
    mockSavePath({
      existingGrants: [
        {
          assetKind: 'ad_account',
          assetId: 'act_1',
          status: 'excluded',
          metadata: { exclusion: { reason: 'removed_from_selection', excludedBy: 'client', excludedAt: '2026-10-01T00:00:00.000Z' } },
        },
      ],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: {
          selectedBusinessId: 'biz_client_2',
          adAccounts: ['act_1'],
          selectedAdAccountsWithNames: [{ id: 'act_1', name: 'Ad One' }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const resetCalls = vi.mocked(prisma.metaAssetGrant.updateMany).mock.calls.filter(
      ([call]) => (call as any).data?.status === 'selected'
    );
    expect(resetCalls).toHaveLength(1);
    const [call] = resetCalls[0] as any as [any];
    expect(call.where.assetId).toBe('act_1');
    expect(call.where.status).toBe('excluded');
    expect(call.data.metadata).toBe(Prisma.JsonNull);
  });

  it('leaves agency exclusions in place when the asset re-enters the selection', async () => {
    mockSavePath({
      existingGrants: [
        {
          assetKind: 'ad_account',
          assetId: 'act_1',
          status: 'excluded',
          metadata: { exclusion: { reason: 'duplicate_asset', excludedBy: 'agency_owner', excludedAt: '2026-10-01T00:00:00.000Z' } },
        },
      ],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: {
          selectedBusinessId: 'biz_client_2',
          adAccounts: ['act_1'],
          selectedAdAccountsWithNames: [{ id: 'act_1', name: 'Ad One' }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const resetCalls = vi.mocked(prisma.metaAssetGrant.updateMany).mock.calls.filter(
      ([call]) => (call as any).data?.status === 'selected'
    );
    expect(resetCalls).toHaveLength(0);
  });
});
