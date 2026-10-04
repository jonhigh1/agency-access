import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAssetRoutes } from '../assets.routes';
import { accessRequestService } from '@/services/access-request.service';
import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { auditService } from '@/services/audit.service';

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

describe('Client Auth Asset Routes - LinkedIn', () => {
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
            platformGroup: 'linkedin',
            products: [{ product: 'linkedin_ads', accessLevel: 'standard' }],
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

    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'pa-1',
      connectionId: 'conn-1',
      platform: 'linkedin',
      secretId: 'secret-1',
      status: 'active',
      metadata: {},
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'linkedin-access-token',
    } as any);

    global.fetch = vi.fn(async (input: any) => {
      const url = String(input);

      if (url === 'https://api.linkedin.com/rest/adAccounts') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            elements: [
              {
                id: 123,
                name: 'Acme Campaign Manager',
                reference: 'urn:li:organization:456',
                status: 'ACTIVE',
                type: 'BUSINESS',
              },
            ],
          }),
          text: async () => '',
        } as any;
      }

      if (url.includes('https://api.linkedin.com/rest/organizationAcls')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            elements: [
              {
                role: 'ADMINISTRATOR',
                state: 'APPROVED',
                organizationTarget: 'urn:li:organization:456',
              },
            ],
          }),
          text: async () => '',
        } as any;
      }

      if (url === 'https://api.linkedin.com/rest/organizations/456') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            id: 456,
            localizedName: 'Acme Company Page',
            vanityName: 'acme-company',
            primaryOrganizationType: 'COMPANY',
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
    await app.close();
  });

  it('returns selector-ready LinkedIn Campaign Manager accounts for linkedin_ads', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/assets/linkedin_ads?connectionId=conn-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([
      {
        id: '123',
        name: 'Acme Campaign Manager',
        reference: 'urn:li:organization:456',
        status: 'ACTIVE',
        type: 'BUSINESS',
      },
    ]);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.linkedin.com/rest/adAccounts',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer linkedin-access-token',
          'LinkedIn-Version': '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        }),
      })
    );
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-a',
        action: 'LINKEDIN_TOKEN_READ',
        userEmail: 'client@example.com',
        resourceType: 'client_connection',
        resourceId: 'conn-1',
        metadata: expect.objectContaining({
          platform: 'linkedin_ads',
          source: 'client_assets_fetch',
        }),
        request: expect.anything(),
      })
    );
  });

  it('returns selector-ready LinkedIn Pages for linkedin_pages', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/client/token-a/assets/linkedin_pages?connectionId=conn-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([
      {
        id: '456',
        name: 'Acme Company Page',
        urn: 'urn:li:organization:456',
        vanityName: 'acme-company',
        type: 'COMPANY',
      },
    ]);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('https://api.linkedin.com/rest/organizationAcls'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer linkedin-access-token',
          'LinkedIn-Version': '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        }),
      })
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.linkedin.com/rest/organizations/456',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer linkedin-access-token',
          'LinkedIn-Version': '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        }),
      })
    );
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LINKEDIN_TOKEN_READ',
        metadata: expect.objectContaining({
          platform: 'linkedin_pages',
          source: 'client_assets_fetch',
        }),
      })
    );
  });

  it('surfaces a route error when LinkedIn page detail hydration fully fails', async () => {
    vi.mocked(fetch).mockImplementation(async (input: any) => {
      const url = String(input);

      if (url.includes('https://api.linkedin.com/rest/organizationAcls')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            elements: [
              {
                role: 'ADMINISTRATOR',
                state: 'APPROVED',
                organizationTarget: 'urn:li:organization:456',
              },
            ],
          }),
          text: async () => '',
        } as any;
      }

      if (url === 'https://api.linkedin.com/rest/organizations/456') {
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({}),
          text: async () => 'forbidden',
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
      url: '/client/token-a/assets/linkedin_pages?connectionId=conn-1',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('ASSET_FETCH_ERROR');
    expect(response.json().error.message).toMatch(/failed to fetch linkedin organization details/i);
  });

  it('accepts and persists zero-page discovery for linkedin_pages', async () => {
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'conn-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'pa-1' } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'linkedin_pages',
        selectedAssets: {
          pages: [],
          availableAssetCount: 0,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: {
        grantedAssets: {
          linkedin_pages: {
            pages: [],
            availableAssetCount: 0,
          },
        },
      },
    });
  });

  it('accepts and persists availableAssetCount in save-assets payloads', async () => {
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({ id: 'conn-1' } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'pa-1' } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-a/save-assets',
      payload: {
        connectionId: 'conn-1',
        platform: 'linkedin_ads',
        selectedAssets: {
          adAccounts: [],
          availableAssetCount: 0,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.clientConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: {
        grantedAssets: {
          linkedin_ads: {
            adAccounts: [],
            availableAssetCount: 0,
          },
        },
      },
    });
  });
});
