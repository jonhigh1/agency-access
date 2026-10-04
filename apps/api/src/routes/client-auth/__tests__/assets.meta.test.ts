import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAssetRoutes } from '../assets.routes';
import { accessRequestService } from '@/services/access-request.service';
import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { auditService } from '@/services/audit.service';
import { metaOBOService } from '@/services/meta-obo.service';
import { metaPartnerService } from '@/services/meta-partner.service';
import { MetaConnector } from '@/services/connectors/meta';
import { metaAssetsService } from '@/services/meta-assets.service';
import {
  clientAssetsService,
  MetaBusinessPortfolioUnavailableError,
} from '@/services/client-assets.service';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getAccessRequestByToken: vi.fn(),
    markRequestAuthorized: vi.fn(),
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

vi.mock('@/services/meta-obo.service', () => ({
  metaOBOService: {
    getClientAccessTokenForOBO: vi.fn(),
    ensureManagedBusinessRelationship: vi.fn(),
  },
}));

vi.mock('@/services/meta-partner.service', () => ({
  metaPartnerService: {
    grantPageAccess: vi.fn(),
    verifyPageAccess: vi.fn(),
    grantAdAccountAccess: vi.fn(),
    verifyAdAccountAccess: vi.fn(),
    verifyAdAccountAgencyAccess: vi.fn(),
    grantCatalogAccess: vi.fn(),
    verifyCatalogAccess: vi.fn(),
    grantCatalogAgencyAccess: vi.fn(),
    verifyCatalogAgencyAccess: vi.fn(),
    verifyDatasetAccess: vi.fn(),
    verifyDatasetAgencyAccess: vi.fn(),
  },
}));

vi.mock('@/services/meta-assets.service', () => ({
  metaAssetsService: {
    getAssignableRecipients: vi.fn(),
    getAssetsForBusiness: vi.fn(),
    getClientInstagramAssetsForBusiness: vi.fn(),
  },
}));

vi.mock('@/services/connectors/meta', async () => {
  const actual = await vi.importActual<typeof import('@/services/connectors/meta')>(
    '@/services/connectors/meta'
  );

  return {
    ...actual,
    MetaConnector: actual.MetaConnector,
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
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

describe('Client Auth Asset Routes - Meta', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerAssetRoutes(app);
    vi.clearAllMocks();
    vi.spyOn(clientAssetsService, 'fetchMetaAssets').mockResolvedValue({
      businesses: [{ id: 'biz_client_2', name: 'Client Two' }],
      selectedBusinessId: 'biz_client_2',
      selectedBusinessName: 'Client Two',
      adAccounts: ['act_1', 'act_2', 'act_2a', 'act_missing', 'act_failed'].map((id) => ({ id, name: id, account_status: 1 })),
      pages: ['page_1', 'page_2', 'page_2a', 'page_3'].map((id) => ({
        id,
        name: id,
        ...(id === 'page_2a' ? { connectedInstagram: { id: 'ig_2', username: 'clienttwo' } } : {}),
      })),
      instagramAccounts: [{ id: 'ig_2', username: 'clienttwo' }],
      productCatalogs: [{ id: 'catalog-1', name: 'Catalog', catalogType: 'commerce', ownershipType: 'owned' }],
      pixels: [{ id: 'pixel-1', name: 'Pixel' }],
    });
    vi.mocked(prisma.metaAssetGrant.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'conn-1', granted_assets: {} }] as any);

    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: null,
      error: null,
    } as any);

    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        metaAccessConfig: {
          recipients: [{ type: 'system_user', id: 'client-system-user-1' }],
          pageTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
          adAccountTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
        },
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
      metadata: {
        selectedAssets: {
          meta_ads: { adAccounts: ['act_existing'] },
        },
      },
    } as any);

    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({
      id: 'pa-1',
    } as any);
    vi.mocked(prisma.metaAgencyDestination.upsert).mockResolvedValue({ id: 'destination-1' } as any);
    vi.mocked(prisma.metaAssetGrant.upsert).mockResolvedValue({ id: 'grant-1', attemptVersion: 1 } as any);
    vi.mocked(prisma.metaAssetGrant.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
      data: [{ type: 'system_user', id: 'client-system-user-1', name: 'Automation' }],
      error: null,
    });
    vi.mocked(metaAssetsService.getAssetsForBusiness).mockResolvedValue({
      data: {
        businessId: 'partner-bm-1',
        businessName: 'Agency Portfolio',
        pages: [{ id: 'page_2a', name: 'Page' }],
        adAccounts: [{ id: 'act_2a', name: 'Ad Account' }],
        instagramAccounts: [],
        productCatalogs: [],
      },
      error: null,
    } as any);
    vi.mocked(metaAssetsService.getClientInstagramAssetsForBusiness).mockResolvedValue({ data: [], error: null });

    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'meta-access-token',
    } as any);

    global.fetch = vi.fn(async (input: any) => {
      const url = String(input);

      if (url.includes('/me/businesses')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'biz_client_1', name: 'Client One', verification_status: 'verified' },
              { id: 'biz_client_2', name: 'Client Two' },
            ],
          }),
        } as any;
      }

      if (url.includes('/me/business_users')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as any;
      }

      if (url.includes('/biz_client_1/managed_businesses') || url.includes('/biz_client_2/managed_businesses')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as any;
      }

      if (url.includes('/biz_client_2/owned_ad_accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: 'act_2a', name: 'Owned Ad Account', account_status: 1, currency: 'USD' }],
          }),
        } as any;
      }

      if (url.includes('/biz_client_2/client_ad_accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: 'act_2b', name: 'Shared Ad Account', account_status: 1, currency: 'USD' }],
          }),
        } as any;
      }

      if (url.includes('/biz_client_2/owned_pages')) {
        return {
          ok: true,
          json: async () => ({
            data: [{
              id: 'page_2a', name: 'Owned Page', category: 'Retail',
              instagram_business_account: { id: 'ig_2', username: 'clienttwo' },
            }],
          }),
        } as any;
      }

      if (url.includes('/biz_client_2/client_pages')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: 'page_2b', name: 'Shared Page', category: 'Agency' }],
          }),
        } as any;
      }

      if (url.includes('/biz_client_2/instagram_accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: 'ig_2', username: 'clienttwo' }],
          }),
        } as any;
      }

      if (url.includes('/biz_client_2/owned_product_catalogs') || url.includes('/biz_client_2/client_product_catalogs')) {
        return { ok: true, json: async () => ({ data: [] }) } as any;
      }

      if (url.includes('/biz_client_2/client_pixels')) {
        return { ok: true, json: async () => ({ data: [] }) } as any;
      }

      return {
        ok: false,
        status: 404,
        text: async () => `Not Found: ${url}`,
        json: async () => ({ error: { message: `Not Found: ${url}` } }),
      } as any;
    });
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('creates one durable requirement for each selected Meta asset and recipient', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        metaAccessConfig: {
          recipients: [
            { type: 'human', id: 'person-1' },
            { type: 'system_user', id: 'system-user-1' },
          ],
          pageTasks: ['MANAGE'],
          adAccountTasks: ['ANALYZE'],
          catalogTasks: ['ADVERTISE', 'AA_ANALYZE'],
        },
      } as any,
      error: null,
    });
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

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: {
          selectedBusinessId: 'biz_client_2',
          pages: ['page_1'],
          adAccounts: ['act_1'],
          catalogs: ['catalog-1'],
          selectedCatalogsWithNames: [{ id: 'catalog-1', name: 'Spring Catalog' }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledTimes(9);
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        assetId: 'page_1',
        recipientType: 'human',
        recipientId: 'person-1',
        requestedTasks: ['MANAGE'],
        status: 'selected',
      }),
      update: expect.not.objectContaining({ status: expect.anything() }),
    }));
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        assetId: 'act_1',
        recipientType: 'system_user',
        recipientId: 'system-user-1',
        requestedTasks: ['ANALYZE'],
      }),
    }));
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        assetKind: 'catalog',
        assetId: 'catalog-1',
        assetName: 'Spring Catalog',
        recipientType: 'system_user',
        recipientId: 'system-user-1',
        requestedTasks: ['ADVERTISE', 'AA_ANALYZE'],
      }),
    }));
  });

  it('records selected Pixel access as manual action required, never verified', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        metaAccessConfig: {
          recipients: [{ type: 'human', id: 'person-1' }],
          pageTasks: [],
          adAccountTasks: [],
          catalogTasks: [],
          datasetTasks: ['ADVERTISE', 'AA_ANALYZE'],
        },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      authorizationEpoch: 2,
      metadata: { meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } } },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      metadata: { selectedBusinessName: 'Agency Portfolio' },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: {
          datasets: ['pixel-1'],
          selectedDatasetsWithNames: [{ id: 'pixel-1', name: 'Website Pixel' }],
        },
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        assetKind: 'dataset',
        assetId: 'pixel-1',
        assetName: 'Website Pixel',
        recipientType: 'business',
        recipientId: 'partner-bm-1',
        requestedTasks: ['ADVERTISE'],
        status: 'manual_action_required',
        nextActor: 'client_admin',
      }),
    }));
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        assetKind: 'dataset',
        assetId: 'pixel-1',
        recipientType: 'human',
        recipientId: 'person-1',
        requestedTasks: ['ADVERTISE', 'AA_ANALYZE'],
        status: 'manual_action_required',
        nextActor: 'client_admin',
      }),
    }));
  });

  it('rejects Meta asset selection before a client Business Portfolio is selected', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: { pages: ['page-1'] },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('META_BUSINESS_SELECTION_REQUIRED');
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
  });

  it('rejects a save whose selected Business Portfolio is outside the saved client selection', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        metaAccessConfig: {
          recipients: [{ type: 'human', id: 'person-1' }],
          pageTasks: ['MANAGE'],
          adAccountTasks: ['ANALYZE'],
        },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: { meta_ads: {} },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      metadata: { selectedBusinessName: 'Agency Portfolio' },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: {
          selectedBusinessId: 'biz_client_1',
          pages: ['page-1'],
          selectedPagesWithNames: [{ id: 'page-1', name: 'Client Page' }],
        },
      },
    });

    // Review #11: one code, one status — the same mismatch emits 409 from the
    // grant automation and the shared validator, so the save path matches.
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('META_BUSINESS_SELECTION_MISMATCH');
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
    expect(prisma.metaAssetGrant.upsert).not.toHaveBeenCalled();
  });

  it('rejects a save with a Meta asset outside the selected client Business Portfolio', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        metaAccessConfig: {
          recipients: [{ type: 'human', id: 'person-1' }],
          pageTasks: ['MANAGE'],
          adAccountTasks: ['ANALYZE'],
        },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: { meta_ads: {} },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      metadata: { selectedBusinessName: 'Agency Portfolio' },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: {
          selectedBusinessId: 'biz_client_2',
          adAccounts: ['act_tampered'],
          selectedAdAccountsWithNames: [{ id: 'act_tampered', name: 'Tampered account' }],
        },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('META_ASSET_NOT_IN_SELECTED_BUSINESS');
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
    expect(prisma.metaAssetGrant.upsert).not.toHaveBeenCalled();
  });

  it('rejects a save when the saved client Business Portfolio is no longer visible to the Meta token', async () => {
    const { MetaBusinessPortfolioUnavailableError } = await import('@/services/client-assets.service');
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        metaAccessConfig: {
          recipients: [{ type: 'human', id: 'person-1' }],
          pageTasks: ['MANAGE'],
          adAccountTasks: ['ANALYZE'],
        },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: { meta_ads: {} },
        meta: { selection: { clientBusinessId: 'biz_revoked', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      metadata: { selectedBusinessName: 'Agency Portfolio' },
    } as any);
    vi.mocked(clientAssetsService.fetchMetaAssets).mockRejectedValueOnce(
      new MetaBusinessPortfolioUnavailableError()
    );

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'meta_ads',
        selectedAssets: {
          selectedBusinessId: 'biz_revoked',
          pages: ['page-1'],
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_META_BUSINESS_PORTFOLIO');
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    expect(prisma.metaAssetGrant.upsert).not.toHaveBeenCalled();
  });

  it('returns business-scoped Meta assets and persists discovery metadata for the selected client business', async () => {
    vi.mocked(clientAssetsService.fetchMetaAssets).mockRestore();
    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/assets/meta_ads?connectionId=conn-1&businessId=biz_client_2',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      businesses: [
        { id: 'biz_client_1', name: 'Client One', verificationStatus: 'verified' },
        { id: 'biz_client_2', name: 'Client Two' },
      ],
      selectedBusinessId: 'biz_client_2',
      selectedBusinessName: 'Client Two',
      selectionRequired: false,
      adAccounts: [
        {
          id: 'act_2a',
          name: 'Owned Ad Account',
          account_status: 1,
          currency: 'USD',
          ownershipType: 'owned',
        },
        {
          id: 'act_2b',
          name: 'Shared Ad Account',
          account_status: 1,
          currency: 'USD',
          ownershipType: 'client',
        },
      ],
      pages: [
        {
          id: 'page_2a', name: 'Owned Page', category: 'Retail',
          connectedInstagram: { id: 'ig_2', username: 'clienttwo' }, ownershipType: 'owned',
        },
        { id: 'page_2b', name: 'Shared Page', category: 'Agency', ownershipType: 'client' },
      ],
      instagramAccounts: [{ id: 'ig_2', username: 'clienttwo' }],
      productCatalogs: [],
      pixels: [],
    });

    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith({
      where: { id: 'pa-1' },
      data: {
        metadata: expect.objectContaining({
          selectedAssets: {
            meta_ads: { adAccounts: ['act_existing'] },
          },
          meta: expect.objectContaining({
            discovery: expect.objectContaining({
              availableBusinesses: [
                { id: 'biz_client_1', name: 'Client One', verificationStatus: 'verified' },
                { id: 'biz_client_2', name: 'Client Two' },
              ],
            }),
            selection: expect.objectContaining({
              clientBusinessId: 'biz_client_2',
              clientBusinessName: 'Client Two',
              source: 'user_selection',
            }),
          }),
        }),
      },
    });

    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-a',
        action: 'META_TOKEN_READ',
        userEmail: 'client@example.com',
        resourceType: 'client_connection',
        resourceId: 'conn-1',
        metadata: expect.objectContaining({
          platform: 'meta_ads',
          source: 'client_assets_fetch',
          businessId: 'biz_client_2',
        }),
        request: expect.anything(),
      })
    );
  });

  it('returns 400 when the requested Meta business portfolio is unavailable', async () => {
    vi.mocked(clientAssetsService.fetchMetaAssets).mockRestore();
    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/assets/meta_ads?connectionId=conn-1&businessId=biz_missing',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      data: null,
      error: {
        code: 'INVALID_META_BUSINESS_PORTFOLIO',
        message: 'Selected Meta business portfolio is not available for this client user',
      },
    });
  });

  it('returns Page content proof only for a selected Page and does not expose the Page token', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: { pages: ['page_1'] },
          meta_pages: { pages: ['page_2'] },
        },
      },
    } as any);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'page_1',
          name: 'Client Page',
          category: 'Local business',
          tasks: ['MANAGE'],
          access_token: 'page-token-secret',
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'post_1', created_time: '2026-09-21T00:00:00+0000' }],
        }),
      } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/meta-page-proof?connectionId=conn-1&pageId=page_1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        page: {
          id: 'page_1',
          name: 'Client Page',
          category: 'Local business',
          managedTasks: ['MANAGE'],
        },
        posts: [{ id: 'post_1', createdTime: '2026-09-21T00:00:00+0000' }],
      },
      error: null,
    });
    expect(response.body).not.toContain('page-token-secret');
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'META_PAGE_ENGAGEMENT_PROOF_READ',
        metadata: expect.objectContaining({ pageId: 'page_1' }),
      })
    );
  });

  it('asks the client to reconnect when Meta rejects the user or Page token', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: { selectedAssets: { meta_ads: { pages: ['page_1'] } } },
    } as any);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: { code: 190, type: 'OAuthException' } }),
    } as Response);

    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/meta-page-proof?connectionId=conn-1&pageId=page_1',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toEqual({
      code: 'REAUTHORIZATION_REQUIRED',
      message: 'Meta access expired or the Page token is invalid. Reconnect Meta and try again.',
    });
  });

  it('does not read the Meta token when Page proof audit logging fails', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: { selectedAssets: { meta_ads: { pages: ['page_1'] } } },
    } as any);
    vi.mocked(auditService.createAuditLog).mockResolvedValueOnce({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create audit log' },
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/meta-page-proof?connectionId=conn-1&pageId=page_1',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('AUDIT_LOG_FAILED');
    expect(infisical.getOAuthTokens).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not read the Meta token when asset-discovery audit logging fails', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {},
    } as any);
    vi.mocked(auditService.createAuditLog).mockResolvedValueOnce({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create audit log' },
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/assets/meta_ads?connectionId=conn-1&businessId=biz_client_2',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('AUDIT_LOG_FAILED');
    expect(infisical.getOAuthTokens).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', '/client/token-a/meta-page-proof?connectionId=conn-1&pageId=page_1'],
    ['POST', '/client/token-a/grant-meta-access'],
    ['POST', '/client/token-a/meta/manual-ad-account-share/start'],
    ['POST', '/client/token-a/meta/manual-ad-account-share/verify'],
  ] as const)('blocks %s %s while Meta reauthorization is incomplete', async (method, url) => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'invalid',
      metadata: { selectedAssets: { meta_pages: { pages: ['page_1'] } } },
    } as any);

    const response = await app.inject({
      method, url,
      ...(method === 'POST' ? { payload: { connectionId: 'conn-1' } } : {}),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('REAUTHORIZATION_REQUIRED');
    expect(infisical.getOAuthTokens).not.toHaveBeenCalled();
    expect(metaPartnerService.grantPageAccess).not.toHaveBeenCalled();
  });

  it('blocks manual Meta sharing when the agency connection is inactive', async () => {
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta',
      businessId: 'partner-bm-1', status: 'invalid',
    } as any);

    const response = await app.inject({
      method: 'POST', url: '/client/token-a/meta/manual-ad-account-share/start',
      payload: { connectionId: 'conn-1' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('AGENCY_META_RECONNECT_REQUIRED');
    expect(prisma.metaAssetGrant.upsert).not.toHaveBeenCalled();
  });

  it('rejects a grant request for a Business Portfolio other than the saved client selection', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active',
      metadata: {
        selectedAssets: { meta_pages: { pages: ['page-2'] } },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', businessId: 'biz_other', assetTypes: ['page'] },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('META_BUSINESS_SELECTION_MISMATCH');
    expect(metaOBOService.getClientAccessTokenForOBO).not.toHaveBeenCalled();
    expect(infisical.getOAuthTokens).not.toHaveBeenCalled();
  });

  it('rejects selected Meta assets that are not in the selected client Business Portfolio', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a', agencyId: 'agency-a',
        metaAccessConfig: { recipients: [{ type: 'system_user', id: 'client-system-user-1' }], pageTasks: ['MANAGE'] },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active',
      metadata: {
        selectedAssets: { meta_pages: { pages: ['page-outside'] } },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1', status: 'active', metadata: {},
    } as any);
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' }, error: null,
    });
    vi.mocked(clientAssetsService.fetchMetaAssets).mockResolvedValue({
      businesses: [{ id: 'biz_client_2', name: 'Client Two' }],
      selectedBusinessId: 'biz_client_2',
      selectedBusinessName: 'Client Two',
      adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [], pixels: [],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['page'] },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('META_ASSET_NOT_IN_SELECTED_BUSINESS');
    expect(metaOBOService.ensureManagedBusinessRelationship).not.toHaveBeenCalled();
    expect(metaPartnerService.grantPageAccess).not.toHaveBeenCalled();
  });

  it('stops Meta fulfillment and returns a gateway error when agency recipient discovery fails', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        platforms: [{ platform: 'meta_ads' }],
        metaAccessConfig: {
          recipients: [{ type: 'system_user', id: 'client-system-user-1' }],
          pageTasks: ['MANAGE'],
          adAccountTasks: ['ANALYZE'],
        },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: { meta_ads: { pages: ['page-2'] } },
        meta: { selection: {
          clientBusinessId: 'biz_client_2',
          selectedAt: '2026-09-22T00:00:00.000Z',
        } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      status: 'active',
      metadata: {},
    } as any);
    vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
      data: null,
      error: { code: 'META_BUSINESS_USERS_FAILED', message: 'Meta recipient lookup failed' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['page'] },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toMatchObject({
      code: 'META_BUSINESS_USERS_FAILED',
      message: 'Meta recipient lookup failed',
    });
    expect(metaOBOService.getClientAccessTokenForOBO).not.toHaveBeenCalled();
    expect(metaPartnerService.grantPageAccess).not.toHaveBeenCalled();
  });

  it('continues independent asset assignment when partner-business sharing needs a manual step', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: { meta_ads: { adAccounts: ['act_2a'] } },
        meta: {
          selection: {
            clientBusinessId: 'biz_client_2',
            clientBusinessName: 'Client Two',
            selectedAt: '2026-03-11T10:00:00.000Z',
          },
        },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      status: 'active',
      metadata: { partnerAdminSystemUserTokenSecretId: 'agency-partner-secret' },
    } as any);
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' },
      error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: {
        status: 'manual_action_required',
        partnerBusinessId: 'partner-bm-1',
        clientBusinessId: 'biz_client_2',
        nextAction: 'Add partner business portfolio partner-bm-1 in Meta Business Settings.',
      },
      error: null,
    });
    vi.mocked(metaPartnerService.grantAdAccountAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyAdAccountAccess).mockResolvedValue({
      verified: true,
      assignedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
    });
    vi.mocked(metaAssetsService.getAssetsForBusiness).mockResolvedValue({
      data: { businessId: 'partner-bm-1', businessName: 'Agency', pages: [], adAccounts: [], instagramAccounts: [], productCatalogs: [] },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      success: false,
      partial: true,
      managedBusinessLinkStatus: 'manual_action_required',
      assetGrantResults: expect.arrayContaining([
        expect.objectContaining({ recipientType: 'system_user', status: 'verified' }),
        expect.objectContaining({
          recipientType: 'business',
          status: 'unresolved',
          errorMessage: 'Add partner business portfolio partner-bm-1 in Meta Business Settings.',
        }),
      ]),
    });
    expect(metaPartnerService.grantAdAccountAccess).toHaveBeenCalledWith(
      'client-admin-user-token', 'act_2a', 'client-system-user-1', ['MANAGE', 'ADVERTISE', 'ANALYZE']
    );
  });

  it('verifies configured Page tasks, including Leads Access, through the OBO flow', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        metaAccessConfig: {
          recipients: [{ type: 'system_user', id: 'client-system-user-1' }],
          pageTasks: ['MANAGE_LEADS'],
          adAccountTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
        },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: {
            adAccounts: ['act_2a'],
            pages: ['page_2a'],
          },
        },
        meta: {
          selection: {
            clientBusinessId: 'biz_client_2',
            clientBusinessName: 'Client Two',
            selectedAt: '2026-03-11T10:00:00.000Z',
          },
        },
      },
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      status: 'active',
      metadata: {
        partnerAdminSystemUserTokenSecretId: 'agency-partner-secret',
      },
    } as any);

    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: {
        accessToken: 'client-admin-user-token',
      },
      error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: {
        status: 'linked',
        partnerBusinessId: 'partner-bm-1',
        clientBusinessId: 'biz_client_2',
        establishedAt: '2026-03-11T10:01:00.000Z',
        lastAttemptAt: '2026-03-11T10:01:00.000Z',
      },
      error: null,
    } as any);
    vi.mocked(metaPartnerService.grantPageAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyPageAccess).mockResolvedValue({
      verified: true,
      assignedTasks: ['MANAGE_LEADS'],
    });
    vi.mocked(metaPartnerService.grantAdAccountAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyAdAccountAccess).mockResolvedValue({
      verified: true,
      assignedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
    });
    vi.mocked(metaAssetsService.getAssetsForBusiness).mockResolvedValue({
      data: {
        businessId: 'partner-bm-1',
        businessName: 'Agency Portfolio',
        pages: [{ id: 'page_2a', name: 'Page 2A' }],
        adAccounts: [{ id: 'act_2a', name: 'Account 2A', sharedWithBusiness: true }],
        instagramAccounts: [],
        productCatalogs: [],
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: {
        connectionId: 'conn-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      success: true,
      partial: false,
      selectedBusinessId: 'biz_client_2',
      selectedBusinessName: 'Client Two',
      managedBusinessLinkStatus: 'linked',
      assetGrantResults: expect.arrayContaining([
        expect.objectContaining({
          assetId: 'page_2a',
          assetType: 'page',
          status: 'verified',
          requestedTasks: ['MANAGE_LEADS'],
          grantedAt: expect.any(String),
          verifiedAt: expect.any(String),
        }),
        expect.objectContaining({
          assetId: 'act_2a',
          assetType: 'ad_account',
          status: 'verified',
          requestedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
          grantedAt: expect.any(String),
          verifiedAt: expect.any(String),
        }),
        expect.objectContaining({
          assetId: 'page_2a',
          recipientType: 'business',
          recipientId: 'partner-bm-1',
          requestedTasks: [],
          status: 'verified',
        }),
        expect.objectContaining({
          assetId: 'act_2a',
          recipientType: 'business',
          recipientId: 'partner-bm-1',
          requestedTasks: [],
          status: 'verified',
        }),
      ]),
    });
    expect(response.json().data.assetGrantResults.find((result: any) =>
      result.assetType === 'ad_account' && result.recipientType === 'business'
    )).not.toHaveProperty('verifiedTasks');

    expect(metaOBOService.ensureManagedBusinessRelationship).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationId: 'pa-1',
        partnerBusinessId: 'partner-bm-1',
        clientBusinessId: 'biz_client_2',
        clientBusinessAdminAccessToken: 'client-admin-user-token',
      })
    );
    expect(metaPartnerService.grantPageAccess).toHaveBeenCalledWith(
      'client-admin-user-token',
      'page_2a',
      'client-system-user-1',
      ['MANAGE_LEADS']
    );
    expect(metaPartnerService.verifyPageAccess).toHaveBeenCalledWith(
      'client-admin-user-token', 'page_2a', 'client-system-user-1', ['MANAGE_LEADS']
    );
    expect(metaPartnerService.grantAdAccountAccess).toHaveBeenCalledWith(
      'client-admin-user-token',
      'act_2a',
      'client-system-user-1',
      ['MANAGE', 'ADVERTISE', 'ANALYZE']
    );
    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith({
      where: { id: 'pa-1' },
      data: {
        metadata: expect.objectContaining({
          meta: expect.objectContaining({
            obo: expect.objectContaining({
              assetGrantResults: expect.arrayContaining([
                expect.objectContaining({
                  assetId: 'page_2a',
                  status: 'verified',
                }),
                expect.objectContaining({
                  assetId: 'act_2a',
                  status: 'verified',
                }),
              ]),
              lastVerifiedAt: expect.any(String),
            }),
          }),
        }),
      },
    });
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: {
        grantedAssets: expect.objectContaining({
          meta: expect.objectContaining({
            verifiedMetaAssetGrantStatus: 'verified',
            pagesAccessGranted: true,
            adAccountsAccessGranted: true,
            verifiedMetaAssetGrantAt: expect.any(String),
          }),
        }),
      },
    });

  });

  it('shares selected catalogs with the agency and verifies each recipient and the business grant', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      authorizationEpoch: 2,
      metadata: {
        selectedAssets: { meta_ads: { catalogs: ['catalog-1'] } },
        meta: { selection: {
          clientBusinessId: 'biz_client_2',
          clientBusinessName: 'Client Two',
          selectedAt: '2026-09-22T00:00:00.000Z',
        } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1',
      status: 'active', metadata: {},
    } as any);
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' }, error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: { status: 'linked', partnerBusinessId: 'partner-bm-1', clientBusinessId: 'biz_client_2' },
      error: null,
    } as any);
    vi.mocked(metaPartnerService.grantCatalogAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyCatalogAccess).mockResolvedValue({
      verified: true, assignedTasks: ['MANAGE'],
    });
    vi.mocked(metaPartnerService.grantCatalogAgencyAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyCatalogAgencyAccess).mockResolvedValue(true);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['catalog'] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.success).toBe(true);
    expect(metaPartnerService.grantCatalogAccess).toHaveBeenCalledWith(
      'client-admin-user-token', 'catalog-1', 'client-system-user-1', ['MANAGE'],
    );
    expect(metaPartnerService.verifyCatalogAccess).toHaveBeenCalledWith(
      'client-admin-user-token', 'catalog-1', 'client-system-user-1', ['MANAGE'],
    );
    expect(metaPartnerService.grantCatalogAgencyAccess).toHaveBeenCalledWith(
      'client-admin-user-token', 'catalog-1', 'partner-bm-1', ['MANAGE'],
    );
    expect(metaPartnerService.verifyCatalogAgencyAccess).toHaveBeenCalledWith(
      'client-admin-user-token', 'catalog-1', 'partner-bm-1', ['MANAGE'],
    );
    expect(metaAssetsService.getAssetsForBusiness).not.toHaveBeenCalled();
    expect(response.json().data.assetGrantResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'catalog-1', recipientType: 'system_user', status: 'verified' }),
      expect.objectContaining({ assetId: 'catalog-1', recipientType: 'business', status: 'verified' }),
    ]));
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ assetKind: 'catalog', grantMethod: 'catalog_agencies' }),
    }));

    let catalogAttempt = 0;
    vi.mocked(prisma.metaAssetGrant.upsert).mockImplementation(async (args: any) => ({
      attemptVersion: args.create.grantMethod === 'catalog_agencies' ? ++catalogAttempt + 1 : 1,
    } as any));
    const retryResponse = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['catalog'] },
    });

    expect(retryResponse.statusCode).toBe(200);
    expect(metaPartnerService.grantCatalogAgencyAccess).toHaveBeenCalledTimes(1);
    expect(metaPartnerService.verifyCatalogAgencyAccess).toHaveBeenCalledTimes(2);
    expect(retryResponse.json().data.assetGrantResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'catalog-1', recipientType: 'business', status: 'verified' }),
    ]));
  });

  it('keeps a Pixel-only request in manual pending state instead of treating it as no selection', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active',
      metadata: {
        selectedAssets: { meta_ads: { datasets: ['pixel-1'] } },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1',
      status: 'active', metadata: {},
    } as any);
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' }, error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: { status: 'linked', partnerBusinessId: 'partner-bm-1', clientBusinessId: 'biz_client_2' }, error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['dataset'] },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().data).toMatchObject({ success: false, partial: false });
    expect(response.json().data.assetGrantResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'pixel-1', assetType: 'dataset', recipientType: 'system_user', status: 'unresolved' }),
      expect.objectContaining({ assetId: 'pixel-1', assetType: 'dataset', recipientType: 'business', status: 'unresolved' }),
    ]));
    expect(metaPartnerService.grantPageAccess).not.toHaveBeenCalled();
    expect(metaPartnerService.grantAdAccountAccess).not.toHaveBeenCalled();
    expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'manual_action_required', nextActor: 'client_admin' }),
    }));
  });

  it('verifies manually shared Pixel access for each agency recipient and the partner business', async () => {
    const recipients = Array.from({ length: 6 }, (_, index) => ({
      type: 'system_user' as const,
      id: `client-system-user-${index + 1}`,
    }));
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a', agencyId: 'agency-a',
        metaAccessConfig: {
          recipients,
          pageTasks: [], adAccountTasks: [], datasetTasks: ['ADVERTISE', 'ANALYZE'],
        },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active', authorizationEpoch: 2,
      metadata: {
        selectedAssets: { meta_ads: { datasets: [] } },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1', status: 'active', metadata: {},
    } as any);
    vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
      data: recipients.map((recipient) => ({ ...recipient, name: recipient.id })), error: null,
    });
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' }, error: null,
    });
    let inFlight = 0;
    let peakInFlight = 0;
    const verifyWithDelay = async (verified: boolean, assignedTasks: string[]) => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return { verified, assignedTasks };
    };
    vi.mocked(metaPartnerService.verifyDatasetAccess).mockImplementation(() =>
      verifyWithDelay(true, ['ADVERTISE', 'ANALYZE'])
    );
    vi.mocked(metaPartnerService.verifyDatasetAgencyAccess).mockImplementation(() =>
      verifyWithDelay(false, ['ADVERTISE'])
    );

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/meta/datasets/verify',
      payload: { connectionId: 'conn-1', datasetIds: ['pixel-1'] },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().data).toMatchObject({ success: false, partial: true, status: 'partial' });
    expect(peakInFlight).toBe(5);
    expect(metaPartnerService.verifyDatasetAccess).toHaveBeenCalledTimes(6);
    expect(response.json().data.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: 'pixel-1', recipientType: 'system_user', status: 'verified', verifiedTasks: ['ADVERTISE', 'ANALYZE'] }),
      expect.objectContaining({ assetId: 'pixel-1', recipientType: 'business', status: 'unresolved', verifiedTasks: ['ADVERTISE'] }),
    ]));
    expect(metaPartnerService.verifyDatasetAccess).toHaveBeenCalledWith(
      'client-admin-user-token', 'pixel-1', 'client-system-user-1', ['ADVERTISE', 'ANALYZE'], 'biz_client_2'
    );
    expect(metaPartnerService.verifyDatasetAgencyAccess).toHaveBeenCalledWith(
      'client-admin-user-token', 'pixel-1', 'partner-bm-1', ['ADVERTISE', 'ANALYZE']
    );
    expect(metaPartnerService.grantPageAccess).not.toHaveBeenCalled();
    expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'manual_action_required', nextActor: 'client_admin' }),
    }));
  });

  it('echoes the re-evaluated request status after manual Dataset verification', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a', agencyId: 'agency-a',
        metaAccessConfig: {
          recipients: [{ type: 'system_user', id: 'client-system-user-1' }],
          pageTasks: [], adAccountTasks: [], datasetTasks: ['ADVERTISE'],
        },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active',
      metadata: {
        selectedAssets: { meta_ads: { datasets: [] } },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1', status: 'active', metadata: {},
    } as any);
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' }, error: null,
    });
    vi.mocked(metaPartnerService.verifyDatasetAccess).mockResolvedValue({
      verified: true, assignedTasks: ['ADVERTISE'],
    });
    vi.mocked(metaPartnerService.verifyDatasetAgencyAccess).mockResolvedValue({
      verified: true, assignedTasks: ['ADVERTISE'],
    });
    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: { id: 'request-a', status: 'partial' }, error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/meta/datasets/verify',
      payload: { connectionId: 'conn-1', datasetIds: ['pixel-1'] },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(accessRequestService.markRequestAuthorized).toHaveBeenCalledWith('request-a');
    expect(response.json().data.success).toBe(true);
    expect(response.json().data.requestStatus).toBe('partial');
  });

  it('rejects manual Dataset verification when selected Pixel is outside the client Business Portfolio', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a', agencyId: 'agency-a',
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }], datasetTasks: ['ADVERTISE'] },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active',
      metadata: {
        selectedAssets: { meta_ads: { datasets: ['pixel-outside'] } },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1', status: 'active', metadata: {},
    } as any);
    vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
      data: [{ type: 'human', id: 'person-1', name: 'Client admin' }], error: null,
    });
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' }, error: null,
    });
    vi.mocked(clientAssetsService.fetchMetaAssets).mockResolvedValue({
      businesses: [{ id: 'biz_client_2', name: 'Client Two' }], selectedBusinessId: 'biz_client_2',
      adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [], pixels: [],
    });

    const response = await app.inject({
      method: 'POST', url: '/client/token-a/meta/datasets/verify', payload: { connectionId: 'conn-1', datasetIds: ['pixel-outside'] },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('META_ASSET_NOT_IN_SELECTED_BUSINESS');
    expect(metaPartnerService.verifyDatasetAccess).not.toHaveBeenCalled();
    expect(metaPartnerService.verifyDatasetAgencyAccess).not.toHaveBeenCalled();
  });

  it('keeps fulfillment partial when system-user tasks verify but the selected human does not', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        metaAccessConfig: {
          recipients: [
            { type: 'human', id: 'person-1', name: 'Jon High' },
            { type: 'system_user', id: 'system-user-1', name: 'Automation' },
          ],
          pageTasks: ['MANAGE', 'ADVERTISE'],
          adAccountTasks: ['ANALYZE'],
        },
      } as any,
      error: null,
    });
    vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
      data: [
        { type: 'human', id: 'person-1', name: 'Jon High' },
        { type: 'system_user', id: 'system-user-1', name: 'Automation' },
      ],
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      authorizationEpoch: 3,
      status: 'active',
      metadata: {
        selectedAssets: { meta_pages: { pages: ['page_2a'] } },
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
      businessId: 'partner-bm-1',
      status: 'active',
      metadata: {},
    } as any);
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' },
      error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: { status: 'linked', partnerBusinessId: 'partner-bm-1', clientBusinessId: 'biz_client_2' },
      error: null,
    } as any);
    vi.mocked(metaPartnerService.grantPageAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyPageAccess).mockImplementation(async (_token, _page, recipientId) =>
      recipientId === 'system-user-1'
        ? { verified: true, assignedTasks: ['MANAGE', 'ADVERTISE'] }
        : { verified: false, assignedTasks: ['ADVERTISE'] }
    );

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['page'] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ success: false, partial: true });
    expect(response.json().data.assetGrantResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipientType: 'human', recipientId: 'person-1', status: 'failed' }),
      expect.objectContaining({ recipientType: 'system_user', recipientId: 'system-user-1', status: 'verified' }),
    ]));
    expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ recipientType: 'human', recipientId: 'person-1' }),
      data: expect.objectContaining({ status: 'blocked' }),
    }));
    expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ recipientType: 'system_user', recipientId: 'system-user-1' }),
      data: expect.objectContaining({ status: 'verified', verifiedAuthorizationEpoch: 3 }),
    }));
  });

  it('verifies a retry before repeating a Meta assignment after read-back timed out', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a', agencyId: 'agency-a',
        metaAccessConfig: { recipients: [{ type: 'system_user', id: 'system-user-1' }], pageTasks: ['MANAGE'] },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active', authorizationEpoch: 1,
      metadata: {
        selectedAssets: { meta_pages: { pages: ['page_2a'] } },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1', status: 'active', metadata: {},
    } as any);
    vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
      data: [{ type: 'system_user', id: 'system-user-1', name: 'Automation' }], error: null,
    });
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' }, error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: { status: 'linked', partnerBusinessId: 'partner-bm-1', clientBusinessId: 'biz_client_2' }, error: null,
    } as any);
    vi.mocked(prisma.metaAssetGrant.upsert)
      .mockResolvedValueOnce({ id: 'recipient-grant', attemptVersion: 1 } as any)
      .mockResolvedValueOnce({ id: 'business-grant', attemptVersion: 1 } as any)
      .mockResolvedValueOnce({ id: 'recipient-grant', attemptVersion: 2 } as any)
      .mockResolvedValueOnce({ id: 'business-grant', attemptVersion: 2 } as any)
      .mockResolvedValueOnce({ id: 'recipient-grant', attemptVersion: 3 } as any)
      .mockResolvedValueOnce({ id: 'business-grant', attemptVersion: 3 } as any);
    vi.mocked(metaPartnerService.grantPageAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyPageAccess)
      .mockRejectedValueOnce(new Error('Meta read-back timeout'))
      .mockRejectedValueOnce(new Error('Meta read-back still unavailable'))
      .mockResolvedValue({ verified: true, assignedTasks: ['MANAGE'] });

    const request = () => app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['page'] },
    });

    const firstAttempt = await request();
    expect(firstAttempt.statusCode, firstAttempt.body).toBe(200);
    expect(firstAttempt.json().data).toMatchObject({ success: false, partial: true });

    const unverifiableRetry = await request();
    expect(unverifiableRetry.statusCode).toBe(200);
    expect(unverifiableRetry.json().data.assetGrantResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipientType: 'system_user',
        recipientId: 'system-user-1',
        errorCode: 'META_PREVIOUS_ASSIGNMENT_UNVERIFIED',
      }),
    ]));
    expect(metaPartnerService.grantPageAccess).toHaveBeenCalledTimes(1);

    const retry = await request();
    expect(retry.statusCode).toBe(200);
    expect(retry.json().data).toMatchObject({ success: true, partial: false });
    expect(metaPartnerService.grantPageAccess).toHaveBeenCalledTimes(1);
    expect(metaPartnerService.verifyPageAccess).toHaveBeenCalledTimes(3);
    expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ recipientType: 'system_user', recipientId: 'system-user-1', attemptVersion: 3 }),
      data: expect.objectContaining({ status: 'verified' }),
    }));
  });

  it('does not publish results when a newer grant attempt supersedes this request', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a', agencyId: 'agency-a',
        metaAccessConfig: { recipients: [{ type: 'system_user', id: 'system-user-1' }], pageTasks: ['MANAGE'] },
      } as any,
      error: null,
    });
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active', authorizationEpoch: 1,
      metadata: {
        selectedAssets: { meta_pages: { pages: ['page_2a'] } },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1', status: 'active', metadata: {},
    } as any);
    vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
      data: [{ type: 'system_user', id: 'system-user-1', name: 'Automation' }], error: null,
    });
    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: { accessToken: 'client-admin-user-token' }, error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: { status: 'linked', partnerBusinessId: 'partner-bm-1', clientBusinessId: 'biz_client_2' }, error: null,
    } as any);
    vi.mocked(metaPartnerService.grantPageAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyPageAccess).mockResolvedValue({ verified: true, assignedTasks: ['MANAGE'] });
    vi.mocked(prisma.metaAssetGrant.updateMany).mockResolvedValue({ count: 0 } as any);

    const response = await app.inject({
      method: 'POST', url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['page'] },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('META_GRANT_ATTEMPT_SUPERSEDED');
    expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
  });

  it('supports verified Meta page-only grants without attempting ad-account assignment', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: {
            pages: ['page_2a'],
            adAccounts: ['act_2a'],
          },
        },
        meta: {
          selection: {
            clientBusinessId: 'biz_client_2',
            clientBusinessName: 'Client Two',
            selectedAt: '2026-03-11T10:00:00.000Z',
          },
          obo: {
            assetGrantResults: [
              {
                assetId: 'act_2a',
                assetType: 'ad_account',
                requestedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
                status: 'verified',
                grantedAt: '2026-03-11T09:55:00.000Z',
                verifiedAt: '2026-03-11T09:56:00.000Z',
              },
            ],
          },
        },
      },
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      status: 'active',
      metadata: {
        partnerAdminSystemUserTokenSecretId: 'agency-partner-secret',
      },
    } as any);

    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: {
        accessToken: 'client-admin-user-token',
      },
      error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: {
        status: 'linked',
        partnerBusinessId: 'partner-bm-1',
        clientBusinessId: 'biz_client_2',
        establishedAt: '2026-03-11T10:01:00.000Z',
        lastAttemptAt: '2026-03-11T10:01:00.000Z',
      },
      error: null,
    } as any);
    vi.mocked(metaPartnerService.grantPageAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyPageAccess).mockResolvedValue({
      verified: true,
      assignedTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: {
        connectionId: 'conn-1',
        assetTypes: ['page'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      success: true,
      partial: false,
      selectedBusinessId: 'biz_client_2',
      selectedBusinessName: 'Client Two',
      managedBusinessLinkStatus: 'linked',
      assetGrantResults: expect.arrayContaining([
        expect.objectContaining({
          assetId: 'page_2a',
          assetType: 'page',
          status: 'verified',
        }),
        expect.objectContaining({
          assetId: 'act_2a',
          assetType: 'ad_account',
          status: 'verified',
        }),
      ]),
    });
    expect(metaPartnerService.grantAdAccountAccess).not.toHaveBeenCalled();
    expect(metaPartnerService.verifyAdAccountAccess).not.toHaveBeenCalled();
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: {
        grantedAssets: expect.objectContaining({
          meta: expect.objectContaining({
            verifiedMetaAssetGrantStatus: 'verified',
            pagesAccessGranted: true,
            adAccountsAccessGranted: true,
          }),
        }),
      },
    });

    vi.mocked(prisma.metaAssetGrant.findMany).mockImplementation(async (query: any) =>
      query.where.recipientType === 'system_user'
        ? [{ assetKind: 'page', assetId: 'page_2a', status: 'excluded' }] as any
        : [] as any
    );
    const retry = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['page'] },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().data).toMatchObject({ success: false, partial: true });
    expect(metaPartnerService.grantPageAccess).toHaveBeenCalledTimes(1);
  });

  it('verifies direct Instagram partner sharing without requiring a selected Page link', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: {
            pages: ['page_2a'],
            instagramAccounts: ['ig_2'],
          },
        },
        meta: {
          selection: {
            clientBusinessId: 'biz_client_2',
            clientBusinessName: 'Client Two',
            selectedAt: '2026-03-11T10:00:00.000Z',
          },
        },
      },
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      status: 'active',
      metadata: {
        partnerAdminSystemUserTokenSecretId: 'agency-partner-secret',
      },
    } as any);

    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: {
        accessToken: 'client-admin-user-token',
      },
      error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: {
        status: 'linked',
        partnerBusinessId: 'partner-bm-1',
        clientBusinessId: 'biz_client_2',
        establishedAt: '2026-03-11T10:01:00.000Z',
        lastAttemptAt: '2026-03-11T10:01:00.000Z',
      },
      error: null,
    } as any);
    vi.mocked(metaPartnerService.grantPageAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyPageAccess).mockResolvedValue({
      verified: true,
      assignedTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
    });
    vi.mocked(metaAssetsService.getClientInstagramAssetsForBusiness).mockResolvedValue({
      data: [{ id: 'ig_2', username: 'clienttwo' }],
      error: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: {
        connectionId: 'conn-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      success: false,
      partial: true,
      selectedBusinessId: 'biz_client_2',
      selectedBusinessName: 'Client Two',
      managedBusinessLinkStatus: 'linked',
      assetGrantResults: expect.arrayContaining([
        expect.objectContaining({
          assetId: 'page_2a',
          assetType: 'page',
          status: 'verified',
        }),
        {
          assetId: 'ig_2',
          assetType: 'instagram_account',
          recipientType: 'system_user',
          recipientId: 'client-system-user-1',
          requestedTasks: [],
          status: 'unresolved',
          errorCode: 'UNSUPPORTED_META_ASSET_TYPE',
          errorMessage: 'Instagram account automated grants are not yet supported',
        },
        expect.objectContaining({
          assetId: 'ig_2',
          assetType: 'instagram_account',
          recipientType: 'business',
          recipientId: 'partner-bm-1',
          status: 'verified',
        }),
      ]),
    });

    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: {
        grantedAssets: expect.objectContaining({
          meta: expect.objectContaining({
            verifiedMetaAssetGrantStatus: 'partial',
            pagesAccessGranted: true,
            adAccountsAccessGranted: false,
          }),
        }),
      },
    });

    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: { meta_ads: { pages: ['page_2b'], instagramAccounts: ['ig_2'] } },
        meta: { selection: {
          clientBusinessId: 'biz_client_2',
          clientBusinessName: 'Client Two',
          selectedAt: '2026-09-23T00:00:00.000Z',
        } },
      },
    } as any);
    vi.mocked(clientAssetsService.fetchMetaAssets).mockResolvedValueOnce({
      businesses: [{ id: 'biz_client_2', name: 'Client Two' }],
      selectedBusinessId: 'biz_client_2',
      selectedBusinessName: 'Client Two',
      adAccounts: [],
      pages: [{ id: 'page_2b', name: 'Shared Page' }],
      instagramAccounts: [{ id: 'ig_2', username: 'clienttwo' }],
      productCatalogs: [],
      pixels: [],
    });

    const directInstagramResponse = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: { connectionId: 'conn-1', assetTypes: ['instagram_account'] },
    });
    expect(directInstagramResponse.statusCode, directInstagramResponse.body).toBe(200);
    expect(directInstagramResponse.json().data.assetGrantResults).toContainEqual(
      expect.objectContaining({
        assetId: 'ig_2',
        assetType: 'instagram_account',
        recipientType: 'business',
        recipientId: 'partner-bm-1',
        status: 'verified',
      })
    );
  });

  it('starts manual Meta ad-account sharing with the agency partner business id and waiting state', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: {
            adAccounts: ['act_2a'],
            selectedAdAccountsWithNames: [{ id: 'act_2a', name: 'DogTimez' }],
          },
        },
      },
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      status: 'active',
      metadata: {
        selectedBusinessName: 'Outdoor DIY',
      },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/meta/manual-ad-account-share/start',
      payload: {
        connectionId: 'conn-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      success: true,
      status: 'waiting_for_manual_share',
      partnerBusinessId: 'partner-bm-1',
      partnerBusinessName: 'Outdoor DIY',
      selectedAdAccounts: [{ id: 'act_2a', name: 'DogTimez' }],
      startedAt: expect.any(String),
    });

    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: {
        grantedAssets: expect.objectContaining({
          meta: expect.objectContaining({
            manualAdAccountShare: {
              status: 'waiting_for_manual_share',
              partnerBusinessId: 'partner-bm-1',
              partnerBusinessName: 'Outdoor DIY',
              selectedAdAccountIds: ['act_2a'],
              selectedAdAccounts: [{ id: 'act_2a', name: 'DogTimez' }],
              startedAt: expect.any(String),
              verificationResults: [
                {
                  assetId: 'act_2a',
                  assetName: 'DogTimez',
                  status: 'waiting_for_manual_share',
                },
              ],
            },
          }),
        }),
      },
    });

  });

  it('keeps per-account verification results when one Meta read fails', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: {
            adAccounts: ['act_2a', 'act_missing', 'act_failed'],
            selectedAdAccountsWithNames: [
              { id: 'act_2a', name: 'DogTimez' },
              { id: 'act_missing', name: 'Still Pending' },
              { id: 'act_failed', name: 'Read Failed' },
            ],
          },
        },
        meta: {
          selection: {
            clientBusinessId: 'biz_client_2',
            clientBusinessName: 'Client Two',
            selectedAt: '2026-03-11T09:00:00.000Z',
          },
          obo: {
            assetGrantResults: [
              {
                assetId: 'page_2a',
                assetType: 'page',
                requestedTasks: ['MANAGE'],
                status: 'verified',
                grantedAt: '2026-03-11T10:00:00.000Z',
                verifiedAt: '2026-03-11T10:01:00.000Z',
              },
            ],
          },
        },
      },
    } as any);

    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
      id: 'conn-1',
      accessRequestId: 'request-a',
      agencyId: 'agency-a',
      clientEmail: 'client@example.com',
      grantedAssets: {
        meta: {
          manualAdAccountShare: {
            status: 'waiting_for_manual_share',
            partnerBusinessId: 'partner-bm-1',
            partnerBusinessName: 'Outdoor DIY',
            selectedAdAccountIds: ['act_2a', 'act_missing', 'act_failed'],
            selectedAdAccounts: [
              { id: 'act_2a', name: 'DogTimez' },
              { id: 'act_missing', name: 'Still Pending' },
              { id: 'act_failed', name: 'Read Failed' },
            ],
            startedAt: '2026-03-11T11:00:00.000Z',
          },
        },
      },
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      secretId: 'agency-meta-secret',
      status: 'active',
      metadata: {
        selectedBusinessName: 'Outdoor DIY',
      },
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockImplementation(async (secretId: string) => {
      if (secretId === 'agency-meta-secret') {
        return { accessToken: 'agency-meta-access-token' } as any;
      }

      return { accessToken: 'meta-access-token' } as any;
    });

    vi.mocked(metaPartnerService.verifyAdAccountAgencyAccess)
      .mockResolvedValueOnce({ verified: true, assignedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'] })
      .mockResolvedValueOnce({ verified: false, assignedTasks: ['ADVERTISE'] })
      .mockRejectedValueOnce(new Error('Meta read timeout'));

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/meta/manual-ad-account-share/verify',
      payload: {
        connectionId: 'conn-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      success: false,
      partial: true,
      status: 'partial',
      partnerBusinessId: 'partner-bm-1',
      partnerBusinessName: 'Outdoor DIY',
      verificationResults: [
        {
          assetId: 'act_2a',
          assetName: 'DogTimez',
          status: 'verified',
          verifiedAt: expect.any(String),
          assignedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
        },
        {
          assetId: 'act_missing',
          assetName: 'Still Pending',
          status: 'unresolved',
          errorCode: 'MANUAL_SHARE_OR_TASKS_PENDING',
          errorMessage:
            'Ad account has not been shared to the agency business portfolio yet; Meta must report these tasks: MANAGE, ADVERTISE, ANALYZE.',
          assignedTasks: ['ADVERTISE'],
        },
        {
          assetId: 'act_failed',
          assetName: 'Read Failed',
          status: 'failed',
          errorCode: 'META_ACCESS_CHECK_FAILED',
          errorMessage: 'Meta access could not be verified. Retry this check.',
        },
      ],
    });

    expect(metaPartnerService.verifyAdAccountAgencyAccess).toHaveBeenNthCalledWith(
      1, 'meta-access-token', 'act_2a', 'partner-bm-1', ['MANAGE', 'ADVERTISE', 'ANALYZE']
    );
    expect(metaPartnerService.verifyAdAccountAgencyAccess).toHaveBeenCalledTimes(3);
    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith({
      where: { id: 'pa-1' },
      data: {
        metadata: expect.objectContaining({
          meta: expect.objectContaining({
            obo: expect.objectContaining({
              assetGrantResults: [
                expect.objectContaining({
                  assetId: 'page_2a',
                  assetType: 'page',
                  status: 'verified',
                }),
                expect.objectContaining({
                  assetId: 'act_2a',
                  assetType: 'ad_account',
                  recipientType: 'business',
                  recipientId: 'partner-bm-1',
                  requestedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
                  verifiedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
                  status: 'verified',
                }),
                expect.objectContaining({
                  assetId: 'act_missing',
                  assetType: 'ad_account',
                  status: 'unresolved',
                }),
                expect.objectContaining({
                  assetId: 'act_failed',
                  assetType: 'ad_account',
                  status: 'failed',
                }),
              ],
              lastVerifiedAt: expect.any(String),
            }),
          }),
        }),
      },
    });
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: {
        grantedAssets: expect.objectContaining({
          meta: expect.objectContaining({
            verifiedMetaAssetGrantStatus: 'partial',
            pagesAccessGranted: true,
            adAccountsAccessGranted: false,
            manualAdAccountShare: expect.objectContaining({
              status: 'partial',
              partnerBusinessId: 'partner-bm-1',
              verificationResults: [
                expect.objectContaining({
                  assetId: 'act_2a',
                  status: 'verified',
                }),
                expect.objectContaining({
                  assetId: 'act_missing',
                  status: 'unresolved',
                }),
                expect.objectContaining({
                  assetId: 'act_failed',
                  status: 'failed',
                }),
              ],
            }),
          }),
        }),
      },
    });
  });

  it('rejects manual verification for an ad account outside the selected client business', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: { id: 'request-a', agencyId: 'agency-a', platforms: [{ platform: 'meta_ads' }], metaAccessConfig: { adAccountTasks: ['ANALYZE'], recipients: [] } } as any,
      error: null,
    });
    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1',
      status: 'active', metadata: { selectedBusinessName: 'Agency Portfolio' },
    } as any);
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active',
      metadata: {
        selectedAssets: { meta_ads: { adAccounts: ['act_foreign'], selectedAdAccountsWithNames: [{ id: 'act_foreign', name: 'Foreign account' }] } },
        meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-23T18:00:00.000Z' } },
      },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/meta/manual-ad-account-share/verify',
      payload: { connectionId: 'conn-1' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('META_ASSET_NOT_IN_SELECTED_BUSINESS');
    expect(metaPartnerService.verifyAdAccountAgencyAccess).not.toHaveBeenCalled();
    expect(prisma.metaAssetGrant.upsert).not.toHaveBeenCalled();
    expect(prisma.metaAssetGrant.updateMany).not.toHaveBeenCalled();
  });

  it('does not expose the obsolete Meta page grant endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-pages-access',
      payload: {
        connectionId: 'conn-1',
        pageIds: ['page_2a'],
      },
    });

    expect(response.statusCode).toBe(404);
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
    expect(auditService.createAuditLog).not.toHaveBeenCalled();
  });

  it('does not expose the obsolete Meta ad-account self-attestation endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/ad-accounts-shared',
      payload: {
        connectionId: 'conn-1',
        sharedAdAccountIds: ['act_2a'],
      },
    });

    expect(response.statusCode).toBe(404);
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    expect(auditService.createAuditLog).not.toHaveBeenCalled();
  });

  it('writes discovery metadata once and skips the write when a consecutive fetch is unchanged', async () => {
    const requestUrl = '/client/token-a/assets/meta_ads?connectionId=conn-1&businessId=biz_client_2';

    const first = await app.inject({
      method: 'GET',
      url: requestUrl,
    });
    expect(first.statusCode).toBe(200);
    expect(prisma.platformAuthorization.update).toHaveBeenCalledTimes(1);

    const persistedWrite = vi.mocked(prisma.platformAuthorization.update).mock.calls[0][0] as any;
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: persistedWrite.data.metadata,
    } as any);

    const second = await app.inject({
      method: 'GET',
      url: requestUrl,
    });
    expect(second.statusCode).toBe(200);
    expect(prisma.platformAuthorization.update).toHaveBeenCalledTimes(1);
    expect(second.json().data).toEqual(first.json().data);
  });

  it('applies and verifies every selected page and ad account when several assets are selected', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: {
            pages: ['page_1', 'page_2', 'page_3'],
            adAccounts: ['act_1', 'act_2'],
          },
        },
        meta: {
          selection: {
            clientBusinessId: 'biz_client_2',
            clientBusinessName: 'Client Two',
            selectedAt: '2026-03-11T10:00:00.000Z',
          },
        },
      },
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
      id: 'agency-meta-1',
      agencyId: 'agency-a',
      platform: 'meta',
      businessId: 'partner-bm-1',
      status: 'active',
      metadata: {
        partnerAdminSystemUserTokenSecretId: 'agency-partner-secret',
      },
    } as any);

    vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
      data: {
        accessToken: 'client-admin-user-token',
      },
      error: null,
    });
    vi.mocked(metaOBOService.ensureManagedBusinessRelationship).mockResolvedValue({
      data: {
        status: 'linked',
        partnerBusinessId: 'partner-bm-1',
        clientBusinessId: 'biz_client_2',
        establishedAt: '2026-03-11T10:01:00.000Z',
        lastAttemptAt: '2026-03-11T10:01:00.000Z',
      },
      error: null,
    } as any);
    vi.mocked(metaPartnerService.grantPageAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyPageAccess).mockResolvedValue({
      verified: true,
      assignedTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
    });
    vi.mocked(metaPartnerService.grantAdAccountAccess).mockResolvedValue();
    vi.mocked(metaPartnerService.verifyAdAccountAccess).mockResolvedValue({
      verified: true,
      assignedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE'],
    });
    vi.mocked(metaAssetsService.getAssetsForBusiness).mockResolvedValue({
      data: {
        businessId: 'partner-bm-1',
        businessName: 'Agency Portfolio',
        pages: ['page_1', 'page_2', 'page_3'].map((id) => ({ id, name: id })),
        adAccounts: ['act_1', 'act_2'].map((id) => ({ id, name: id, sharedWithBusiness: true })),
        instagramAccounts: [],
        productCatalogs: [],
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-meta-access',
      payload: {
        connectionId: 'conn-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(metaPartnerService.grantPageAccess).toHaveBeenCalledTimes(3);
    expect(metaPartnerService.verifyPageAccess).toHaveBeenCalledTimes(3);
    expect(metaPartnerService.grantAdAccountAccess).toHaveBeenCalledTimes(2);
    expect(metaPartnerService.verifyAdAccountAccess).toHaveBeenCalledTimes(2);

    const results = response.json().data.assetGrantResults as Array<{ assetId: string; assetType: string; recipientType: string; status: string }>;
    expect(results).toHaveLength(10);
    expect(results.every((result) => result.status === 'verified')).toBe(true);
    expect(results.filter((result) => result.assetType === 'page' && result.recipientType === 'system_user').map((result) => result.assetId)).toEqual([
      'page_1',
      'page_2',
      'page_3',
    ]);
    expect(
      results.filter((result) => result.assetType === 'ad_account' && result.recipientType === 'system_user').map((result) => result.assetId)
    ).toEqual(['act_1', 'act_2']);
  });

  describe('save-assets hardening (review batch A)', () => {
    function mockSavePrereqs() {
      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'request-a',
          agencyId: 'agency-a',
          metaAccessConfig: {
            recipients: [{ type: 'human', id: 'person-1' }],
            pageTasks: ['MANAGE'],
            adAccountTasks: ['ANALYZE'],
          },
        } as any,
        error: null,
      });
      vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
        id: 'pa-1',
        connectionId: 'conn-1',
        platform: 'meta',
        secretId: 'secret-1',
        status: 'active',
        metadata: {
          selectedAssets: { meta_ads: {} },
          meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
        },
      } as any);
      vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
        id: 'agency-meta-1',
        agencyId: 'agency-a',
        platform: 'meta',
        businessId: 'partner-bm-1',
        metadata: { selectedBusinessName: 'Agency Portfolio' },
      } as any);
    }

    it('saves Instagram assets in both product and canonical Meta selections without clearing Ads', async () => {
      mockSavePrereqs();
      vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
        id: 'conn-1',
        accessRequestId: 'request-a',
        agencyId: 'agency-a',
        clientEmail: 'client@example.com',
        grantedAssets: { meta_ads: { selectedBusinessId: 'biz_client_2', adAccounts: ['act_1'] } },
      } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{
        id: 'conn-1',
        granted_assets: { meta_ads: { selectedBusinessId: 'biz_client_2', adAccounts: ['act_1'] } },
      }] as any);

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/save-assets',
        payload: {
          connectionId: 'conn-1',
          platform: 'instagram',
          selectedAssets: {
            selectedBusinessId: 'biz_client_2',
            instagramAccounts: ['ig_2'],
            selectedInstagramWithNames: [{ id: 'ig_2', name: 'clienttwo' }],
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(clientAssetsService.fetchMetaAssets).toHaveBeenCalledWith('meta-access-token', 'biz_client_2', ['instagram_account']);
      expect(prisma.clientConnection.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { grantedAssets: {
          meta_ads: expect.objectContaining({ adAccounts: ['act_1'], instagramAccounts: ['ig_2'] }),
          instagram: expect.objectContaining({ instagramAccounts: ['ig_2'] }),
        } },
      }));
      expect(prisma.platformAuthorization.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { metadata: expect.objectContaining({
          selectedAssets: expect.objectContaining({
            meta_ads: expect.objectContaining({ instagramAccounts: ['ig_2'] }),
            instagram: expect.objectContaining({ instagramAccounts: ['ig_2'] }),
          }),
        }) },
      }));
      expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ assetKind: 'instagram_account', assetId: 'ig_2' }),
      }));
    });

    it('rejects an empty Instagram selection before reading the Meta token', async () => {
      mockSavePrereqs();

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/save-assets',
        payload: { connectionId: 'conn-1', platform: 'instagram', selectedAssets: {} },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('NO_SELECTED_ASSETS');
      expect(infisical.getOAuthTokens).not.toHaveBeenCalled();
      expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    });

    it('rejects an Instagram account outside the selected client Business Portfolio', async () => {
      mockSavePrereqs();

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/save-assets',
        payload: {
          connectionId: 'conn-1',
          platform: 'instagram',
          selectedAssets: { selectedBusinessId: 'biz_client_2', instagramAccounts: ['ig_foreign'] },
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('META_ASSET_NOT_IN_SELECTED_BUSINESS');
      expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    });

    it('rejects WithNames ids outside the selected Business Portfolio even when the flat list is in scope', async () => {
      mockSavePrereqs();

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/save-assets',
        payload: {
          connectionId: 'conn-1',
          platform: 'meta_ads',
          selectedAssets: {
            selectedBusinessId: 'biz_client_2',
            adAccounts: ['act_1'],
            selectedAdAccountsWithNames: [
              { id: 'act_1', name: 'In scope' },
              { id: 'act_smuggled', name: 'Smuggled account' },
            ],
          },
        },
      });

      // Review #16: extractSelectedMetaAdAccounts prefers the WithNames array,
      // so ids riding only in the names arrays must pass the same membership
      // gate as the flat ids before anything persists.
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('META_ASSET_NOT_IN_SELECTED_BUSINESS');
      expect(prisma.clientConnection.update).not.toHaveBeenCalled();
      expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
    });

    it('narrows Meta discovery on save to exactly the selected asset kinds', async () => {
      mockSavePrereqs();

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/save-assets',
        payload: {
          connectionId: 'conn-1',
          platform: 'meta_ads',
          selectedAssets: {
            selectedBusinessId: 'biz_client_2',
            pages: ['page_1'],
            adAccounts: ['act_1'],
            catalogs: ['catalog-1'],
          },
        },
      });

      expect(response.statusCode).toBe(200);
      // Review #12: pin the kinds narrowing so a future edit cannot silently
      // widen discovery back to full-fan-out Graph pagination per save.
      expect(clientAssetsService.fetchMetaAssets).toHaveBeenCalledWith('meta-access-token', 'biz_client_2', [
        'page',
        'ad_account',
        'catalog',
      ]);
    });

    it('returns 500 AUDIT_LOG_FAILED and never reads the Meta token when the scope audit fails on save', async () => {
      mockSavePrereqs();
      vi.mocked(auditService.createAuditLog).mockResolvedValueOnce({ error: 'audit unavailable' } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/save-assets',
        payload: {
          connectionId: 'conn-1',
          platform: 'meta_ads',
          selectedAssets: { selectedBusinessId: 'biz_client_2', adAccounts: ['act_1'] },
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json().error.code).toBe('AUDIT_LOG_FAILED');
      expect(infisical.getOAuthTokens).not.toHaveBeenCalled();
      expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    });

    it('returns 500 TOKEN_NOT_FOUND when secure storage has no Meta access token on save', async () => {
      mockSavePrereqs();
      vi.mocked(infisical.getOAuthTokens).mockResolvedValueOnce({} as any);

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/save-assets',
        payload: {
          connectionId: 'conn-1',
          platform: 'meta_ads',
          selectedAssets: { selectedBusinessId: 'biz_client_2', adAccounts: ['act_1'] },
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json().error.code).toBe('TOKEN_NOT_FOUND');
      expect(clientAssetsService.fetchMetaAssets).not.toHaveBeenCalled();
      expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    });

    it('returns 502 META_ASSET_DISCOVERY_FAILED and skips persistence when discovery fails on save', async () => {
      mockSavePrereqs();
      vi.spyOn(clientAssetsService, 'fetchMetaAssets').mockRejectedValueOnce(new Error('graph down'));

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/save-assets',
        payload: {
          connectionId: 'conn-1',
          platform: 'meta_ads',
          selectedAssets: { selectedBusinessId: 'biz_client_2', adAccounts: ['act_1'] },
        },
      });

      expect(response.statusCode).toBe(502);
      expect(response.json().error.code).toBe('META_ASSET_DISCOVERY_FAILED');
      expect(prisma.clientConnection.update).not.toHaveBeenCalled();
      expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
    });

    it('surfaces the typed unavailable-portfolio error from the grant path', async () => {
      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'request-a',
          agencyId: 'agency-a',
          metaAccessConfig: { recipients: [{ type: 'system_user', id: 'client-system-user-1' }], pageTasks: ['MANAGE'] },
        } as any,
        error: null,
      });
      vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
        id: 'pa-1', connectionId: 'conn-1', platform: 'meta', secretId: 'secret-1', status: 'active',
        metadata: {
          selectedAssets: { meta_pages: { pages: ['page_1'] } },
          meta: { selection: { clientBusinessId: 'biz_client_2', selectedAt: '2026-09-22T00:00:00.000Z' } },
        },
      } as any);
      vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
        id: 'agency-meta-1', agencyId: 'agency-a', platform: 'meta', businessId: 'partner-bm-1', status: 'active', metadata: {},
      } as any);
      vi.mocked(metaOBOService.getClientAccessTokenForOBO).mockResolvedValue({
        data: { accessToken: 'client-admin-user-token' }, error: null,
      });
      vi.spyOn(clientAssetsService, 'fetchMetaAssets').mockRejectedValueOnce(
        new MetaBusinessPortfolioUnavailableError('Selected Meta business portfolio is not available for this client user')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/grant-meta-access',
        payload: { connectionId: 'conn-1', assetTypes: ['page'] },
      });

      // Review #13: the save and grant paths run the same scope validation,
      // so the typed 400 surfaces from both instead of the grant path's bare
      // 502 catch.
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('INVALID_META_BUSINESS_PORTFOLIO');
      expect(metaOBOService.ensureManagedBusinessRelationship).not.toHaveBeenCalled();
    });
  });
});
