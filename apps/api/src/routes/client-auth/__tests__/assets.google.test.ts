import { mockJsonTransactions } from '../../../__tests__/json-transaction-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAssetRoutes } from '../assets.routes';
import { accessRequestService } from '@/services/access-request.service';
import { googleNativeAccessService } from '@/services/google-native-access.service';
import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { auditService } from '@/services/audit.service';
import { env } from '@/lib/env';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getAccessRequestByToken: vi.fn(),
  },
}));

vi.mock('@/services/google-native-access.service', () => ({
  googleNativeAccessService: {
    planGoogleNativeGrants: vi.fn(),
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
  },
}));

describe('Client Auth Asset Routes - Google', () => {
  let app: FastifyInstance;
  const originalDeveloperToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;

  beforeEach(async () => {
    app = Fastify();
    await registerAssetRoutes(app);
    vi.clearAllMocks();
    mockJsonTransactions(prisma);
    env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-google-ads-developer-token';

    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        platforms: [
          {
            platformGroup: 'google',
            products: [{ product: 'google_business_profile', accessLevel: 'standard' }],
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
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'conn-1' } as any);

    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'google',
      secretId: 'secret-1',
      status: 'active',
      metadata: {},
    } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'pa-1' } as any);

    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'google-access-token',
    } as any);

    vi.mocked(googleNativeAccessService.planGoogleNativeGrants).mockResolvedValue({
      data: null,
      error: null,
    } as any);

    global.fetch = vi.fn(async (input: any) => {
      const url = String(input);

      if (url.includes('https://mybusinessaccountmanagement.googleapis.com/v1/accounts')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            accounts: [
              {
                name: 'accounts/123',
                accountName: 'Agency Test Business',
              },
            ],
          }),
          text: async () => '',
        } as any;
      }

      if (url.includes('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/123/locations')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            locations: [
              {
                name: 'accounts/123/locations/456',
                title: 'Main Street Store',
              },
            ],
          }),
          text: async () => '',
        } as any;
      }

      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
        text: async () => 'Not Found',
      } as any;
    });
  });

  afterEach(async () => {
    env.GOOGLE_ADS_DEVELOPER_TOKEN = originalDeveloperToken;
    await app.close();
  });

  it('returns business profile locations without fetching unrelated Google product inventories', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/assets/google_business_profile?connectionId=conn-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([
      {
        id: '456',
        name: 'Main Street Store',
        type: 'google_business',
        accountName: 'Agency Test Business',
      },
    ]);

    const requestedUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(
      requestedUrls.some((url) => url.includes('googleads.googleapis.com'))
    ).toBe(false);
    expect(
      requestedUrls.some((url) => url.includes('analyticsadmin.googleapis.com'))
    ).toBe(false);
    expect(
      requestedUrls.some((url) => url.includes('www.googleapis.com/tagmanager'))
    ).toBe(false);
    expect(
      requestedUrls.some((url) => url.includes('www.googleapis.com/webmasters'))
    ).toBe(false);
    expect(
      requestedUrls.some((url) => url.includes('shoppingcontent.googleapis.com'))
    ).toBe(false);
  });

  it('logs Google token reads during client asset discovery', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/assets/google_business_profile?connectionId=conn-1',
    });

    expect(response.statusCode).toBe(200);
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-a',
        action: 'GOOGLE_TOKEN_READ',
        userEmail: 'client@example.com',
        resourceType: 'client_connection',
        resourceId: 'conn-1',
        metadata: expect.objectContaining({
          platform: 'google_business_profile',
          source: 'client_assets_fetch',
        }),
        request: expect.anything(),
      })
    );
  });

  it('returns only active Google Ads accounts for client asset discovery', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        platforms: [
          {
            platformGroup: 'google',
            products: [{ product: 'google_ads', accessLevel: 'standard' }],
          },
        ],
      } as any,
      error: null,
    });

    global.fetch = vi.fn(async (input: any, init?: any) => {
      const url = String(input);

      if (url.includes('https://googleads.googleapis.com/v22/customers:listAccessibleCustomers')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            resourceNames: [
              'customers/1111111111',
              'customers/2222222222',
              'customers/3333333333',
            ],
          }),
          text: async () => '',
        } as any;
      }

      if (url === 'https://googleads.googleapis.com/v22/customers/1111111111') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            descriptiveName: 'Enabled Account',
            manager: false,
            status: 'ENABLED',
          }),
          text: async () => '',
        } as any;
      }

      if (url === 'https://googleads.googleapis.com/v22/customers/2222222222') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            descriptiveName: 'Cancelled Account',
            manager: false,
            status: 'CANCELED',
          }),
          text: async () => '',
        } as any;
      }

      if (url === 'https://googleads.googleapis.com/v22/customers/3333333333') {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({}),
          text: async () => 'Not Found',
        } as any;
      }

      if (url.includes('https://googleads.googleapis.com/v22/customers/') && url.includes('/googleAds:search')) {
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({}),
          text: async () => JSON.stringify({
            error: {
              code: 403,
              message: 'Permission denied',
            },
          }),
        } as any;
      }

      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
        text: async () => 'Not Found',
      } as any;
    });

    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/assets/google_ads?connectionId=conn-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([
      {
        id: '1111111111',
        name: 'Enabled Account',
        formattedId: '111-111-1111',
        isManager: false,
        nameSource: 'direct',
        type: 'google_ads',
        status: 'ENABLED',
      },
    ]);
  });

  it('persists orchestrated Google native-grant lifecycle details when saving Google assets', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-a',
        agencyId: 'agency-a',
        platforms: [
          {
            platformGroup: 'google',
            products: [{ product: 'google_ads', accessLevel: 'admin' }],
          },
        ],
      } as any,
      error: null,
    });
    vi.mocked(googleNativeAccessService.planGoogleNativeGrants).mockResolvedValue({
      data: {
        selectedAssets: {
          adAccounts: ['1111111111'],
          googleGrantLifecycle: {
            product: 'google_ads',
            capabilityTier: 'native_grant_supported',
            fulfillmentMode: 'manager_link',
            state: 'pending_native_grant',
            requiresNativeGrant: true,
            isFulfilled: false,
            grantStatus: 'pending',
            pendingActor: 'none',
          },
        },
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'google_ads',
        selectedAssets: {
          adAccounts: ['1111111111'],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(googleNativeAccessService.planGoogleNativeGrants).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'google_ads',
        selectedAssets: {
          adAccounts: ['1111111111'],
        },
      })
    );
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: {
        grantedAssets: {
          google_ads: {
            adAccounts: ['1111111111'],
            googleGrantLifecycle: expect.objectContaining({
              fulfillmentMode: 'manager_link',
              state: 'pending_native_grant',
            }),
          },
        },
      },
    });
    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith({
      where: { id: 'pa-1' },
      data: {
        metadata: {
          selectedAssets: {
            google_ads: {
              adAccounts: ['1111111111'],
              googleGrantLifecycle: expect.objectContaining({
                fulfillmentMode: 'manager_link',
              }),
            },
          },
        },
      },
    });
  });
});
