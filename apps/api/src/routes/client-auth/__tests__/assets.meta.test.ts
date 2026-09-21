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

vi.mock('@/services/meta-obo.service', () => ({
  metaOBOService: {
    getClientAccessTokenForOBO: vi.fn(),
    ensureManagedBusinessRelationship: vi.fn(),
    provisionClientBusinessSystemUserToken: vi.fn(),
  },
}));

vi.mock('@/services/meta-partner.service', () => ({
  metaPartnerService: {
    grantPageAccess: vi.fn(),
    verifyPageAccess: vi.fn(),
    grantAdAccountAccess: vi.fn(),
    verifyAdAccountAccess: vi.fn(),
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
  },
}));

describe('Client Auth Asset Routes - Meta', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerAssetRoutes(app);
    vi.clearAllMocks();

    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
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
            data: [{ id: 'page_2a', name: 'Owned Page', category: 'Retail' }],
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
  });

  it('returns business-scoped Meta assets and persists discovery metadata for the selected client business', async () => {
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
        { id: 'page_2a', name: 'Owned Page', category: 'Retail', ownershipType: 'owned' },
        { id: 'page_2b', name: 'Shared Page', category: 'Agency', ownershipType: 'client' },
      ],
      instagramAccounts: [{ id: 'ig_2', username: 'clienttwo' }],
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
          access_token: 'page-token-secret',
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'post_1', message: 'Page post' }],
        }),
      } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/meta-page-proof?connectionId=conn-1&pageId=page_1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        page: { id: 'page_1', name: 'Client Page' },
        posts: [{ id: 'post_1', message: 'Page post' }],
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

  it('verifies Meta page and ad-account grants through the OBO flow before marking success', async () => {
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
    vi.mocked(metaOBOService.provisionClientBusinessSystemUserToken).mockResolvedValue({
      data: {
        status: 'ready',
        clientBusinessId: 'biz_client_2',
        appId: 'test-meta-app-id',
        scopes: ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement'],
        systemUserId: 'client-system-user-1',
        tokenSecretId: 'client-system-user-secret',
        provisionedAt: '2026-03-11T10:02:00.000Z',
        lastAttemptAt: '2026-03-11T10:02:00.000Z',
      },
      error: null,
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockImplementation(async (secretId: string) => {
      if (secretId === 'agency-partner-secret') {
        return { accessToken: 'partner-admin-system-user-token' } as any;
      }

      if (secretId === 'client-system-user-secret') {
        return { accessToken: 'client-system-user-token' } as any;
      }

      return { accessToken: 'meta-access-token' } as any;
    });

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
      clientSystemUserStatus: 'ready',
      assetGrantResults: [
        expect.objectContaining({
          assetId: 'page_2a',
          assetType: 'page',
          status: 'verified',
          requestedTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
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
      ],
    });

    expect(metaOBOService.ensureManagedBusinessRelationship).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationId: 'pa-1',
        partnerBusinessId: 'partner-bm-1',
        clientBusinessId: 'biz_client_2',
        clientBusinessAdminAccessToken: 'client-admin-user-token',
      })
    );
    expect(metaPartnerService.grantPageAccess).toHaveBeenCalledWith(
      'client-system-user-token',
      'page_2a',
      'client-system-user-1',
      ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE']
    );
    expect(metaPartnerService.grantAdAccountAccess).toHaveBeenCalledWith(
      'client-system-user-token',
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
              assetGrantResults: [
                expect.objectContaining({
                  assetId: 'page_2a',
                  status: 'verified',
                }),
                expect.objectContaining({
                  assetId: 'act_2a',
                  status: 'verified',
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
            verifiedMetaAssetGrantStatus: 'verified',
            pagesAccessGranted: true,
            adAccountsAccessGranted: true,
            verifiedMetaAssetGrantAt: expect.any(String),
          }),
        }),
      },
    });
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
    vi.mocked(metaOBOService.provisionClientBusinessSystemUserToken).mockResolvedValue({
      data: {
        status: 'ready',
        clientBusinessId: 'biz_client_2',
        appId: 'test-meta-app-id',
        scopes: ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement'],
        systemUserId: 'client-system-user-1',
        tokenSecretId: 'client-system-user-secret',
        provisionedAt: '2026-03-11T10:02:00.000Z',
        lastAttemptAt: '2026-03-11T10:02:00.000Z',
      },
      error: null,
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockImplementation(async (secretId: string) => {
      if (secretId === 'agency-partner-secret') {
        return { accessToken: 'partner-admin-system-user-token' } as any;
      }

      if (secretId === 'client-system-user-secret') {
        return { accessToken: 'client-system-user-token' } as any;
      }

      return { accessToken: 'meta-access-token' } as any;
    });

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
      clientSystemUserStatus: 'ready',
      assetGrantResults: [
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
      ],
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
  });

  it('returns partial Meta grant results when unsupported assets remain unresolved', async () => {
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
    vi.mocked(metaOBOService.provisionClientBusinessSystemUserToken).mockResolvedValue({
      data: {
        status: 'ready',
        clientBusinessId: 'biz_client_2',
        appId: 'test-meta-app-id',
        scopes: ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement'],
        systemUserId: 'client-system-user-1',
        tokenSecretId: 'client-system-user-secret',
        provisionedAt: '2026-03-11T10:02:00.000Z',
        lastAttemptAt: '2026-03-11T10:02:00.000Z',
      },
      error: null,
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockImplementation(async (secretId: string) => {
      if (secretId === 'agency-partner-secret') {
        return { accessToken: 'partner-admin-system-user-token' } as any;
      }

      if (secretId === 'client-system-user-secret') {
        return { accessToken: 'client-system-user-token' } as any;
      }

      return { accessToken: 'meta-access-token' } as any;
    });

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
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      success: false,
      partial: true,
      selectedBusinessId: 'biz_client_2',
      selectedBusinessName: 'Client Two',
      managedBusinessLinkStatus: 'linked',
      clientSystemUserStatus: 'ready',
      assetGrantResults: [
        expect.objectContaining({
          assetId: 'page_2a',
          assetType: 'page',
          status: 'verified',
        }),
        {
          assetId: 'ig_2',
          assetType: 'instagram_account',
          requestedTasks: [],
          status: 'unresolved',
          errorCode: 'UNSUPPORTED_META_ASSET_TYPE',
          errorMessage: 'Instagram account automated grants are not yet supported',
        },
      ],
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

  it('verifies manually shared Meta ad accounts by checking agency business visibility', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'meta',
      secretId: 'secret-1',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: {
            adAccounts: ['act_2a', 'act_missing'],
            selectedAdAccountsWithNames: [
              { id: 'act_2a', name: 'DogTimez' },
              { id: 'act_missing', name: 'Still Pending' },
            ],
          },
        },
        meta: {
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
            selectedAdAccountIds: ['act_2a', 'act_missing'],
            selectedAdAccounts: [
              { id: 'act_2a', name: 'DogTimez' },
              { id: 'act_missing', name: 'Still Pending' },
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

    const getAllAssetsSpy = vi
      .spyOn(MetaConnector.prototype, 'getAllAssets')
      .mockResolvedValue({
        businessId: 'partner-bm-1',
        businessName: 'Outdoor DIY',
        adAccounts: [
          {
            id: 'act_2a',
            name: 'DogTimez',
            account_status: 1,
            currency: 'USD',
          },
        ],
        pages: [],
        instagramAccounts: [],
        productCatalogs: [],
      } as any);

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
        },
        {
          assetId: 'act_missing',
          assetName: 'Still Pending',
          status: 'unresolved',
          errorCode: 'MANUAL_SHARE_PENDING',
          errorMessage:
            'Ad account has not been shared to the agency business portfolio yet',
        },
      ],
    });

    expect(getAllAssetsSpy).toHaveBeenCalledWith('agency-meta-access-token', 'partner-bm-1');
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
                  status: 'verified',
                }),
                expect.objectContaining({
                  assetId: 'act_missing',
                  assetType: 'ad_account',
                  status: 'unresolved',
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
              ],
            }),
          }),
        }),
      },
    });
  });

  it('rejects the legacy Meta page grant endpoint so callers must use the verified OBO route', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/grant-pages-access',
      payload: {
        connectionId: 'conn-1',
        pageIds: ['page_2a'],
      },
    });

    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual({
      data: null,
      error: {
        code: 'LEGACY_META_ROUTE_DISABLED',
        message:
          'Legacy Meta page grants are disabled. Use /grant-meta-access with page-only verification instead.',
      },
    });
    expect(prisma.clientConnection.update).not.toHaveBeenCalled();
    expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
    expect(auditService.createAuditLog).not.toHaveBeenCalled();
  });

  it('rejects the legacy Meta ad-account self-attestation endpoint so callers must use manual verification', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/ad-accounts-shared',
      payload: {
        connectionId: 'conn-1',
        sharedAdAccountIds: ['act_2a'],
      },
    });

    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual({
      data: null,
      error: {
        code: 'LEGACY_META_ROUTE_DISABLED',
        message:
          'Legacy Meta ad-account completion is disabled. Use the manual share verification flow instead.',
      },
    });
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
    vi.mocked(metaOBOService.provisionClientBusinessSystemUserToken).mockResolvedValue({
      data: {
        status: 'ready',
        clientBusinessId: 'biz_client_2',
        appId: 'test-meta-app-id',
        scopes: ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement'],
        systemUserId: 'client-system-user-1',
        tokenSecretId: 'client-system-user-secret',
        provisionedAt: '2026-03-11T10:02:00.000Z',
        lastAttemptAt: '2026-03-11T10:02:00.000Z',
      },
      error: null,
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockImplementation(async (secretId: string) => {
      if (secretId === 'agency-partner-secret') {
        return { accessToken: 'partner-admin-system-user-token' } as any;
      }

      if (secretId === 'client-system-user-secret') {
        return { accessToken: 'client-system-user-token' } as any;
      }

      return { accessToken: 'meta-access-token' } as any;
    });

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

    const results = response.json().data.assetGrantResults as Array<{ assetId: string; assetType: string; status: string }>;
    expect(results).toHaveLength(5);
    expect(results.every((result) => result.status === 'verified')).toBe(true);
    expect(results.filter((result) => result.assetType === 'page').map((result) => result.assetId)).toEqual([
      'page_1',
      'page_2',
      'page_3',
    ]);
    expect(
      results.filter((result) => result.assetType === 'ad_account').map((result) => result.assetId)
    ).toEqual(['act_1', 'act_2']);
  });
});
