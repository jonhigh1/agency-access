import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaConnector } from '../meta.js';

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    META_APP_ID: 'test-app-id',
    META_APP_SECRET: 'test-app-secret',
    META_LOGIN_FOR_BUSINESS_CONFIG_ID: undefined as string | undefined,
    API_URL: 'http://localhost:3001',
  },
}));

// Mock env
vi.mock('../../../lib/env', () => ({
  env: mockEnv,
}));

describe('MetaConnector Asset Discovery', () => {
  let connector: MetaConnector;
  const accessToken = 'test-access-token';
  const businessId = 'test-business-id';

  beforeEach(() => {
    mockEnv.META_LOGIN_FOR_BUSINESS_CONFIG_ID = undefined;
    connector = new MetaConnector();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('getAuthUrl', () => {
    it('includes config_id when Meta Login for Business configuration is present', () => {
      mockEnv.META_LOGIN_FOR_BUSINESS_CONFIG_ID = '1436589444014622';
      connector = new MetaConnector();

      const authUrl = new URL(connector.getAuthUrl('state-123'));

      expect(`${authUrl.origin}${authUrl.pathname}`).toBe('https://www.facebook.com/v21.0/dialog/oauth');
      expect(authUrl.searchParams.get('client_id')).toBe('test-app-id');
      expect(authUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3001/agency-platforms/meta/callback');
      expect(authUrl.searchParams.get('state')).toBe('state-123');
      expect(authUrl.searchParams.get('response_type')).toBe('code');
      expect(authUrl.searchParams.get('config_id')).toBe('1436589444014622');
      expect(authUrl.searchParams.get('scope')).toBeNull();
    });

    it('uses explicit scopes instead of config_id for client OAuth flows', () => {
      mockEnv.META_LOGIN_FOR_BUSINESS_CONFIG_ID = '1436589444014622';
      connector = new MetaConnector();

      const authUrl = new URL(
        connector.getAuthUrl('state-123', [
          'ads_management',
          'ads_read',
          'business_management',
          'pages_read_engagement',
        ], 'https://authhub.co/invite/oauth-callback')
      );

      expect(authUrl.searchParams.get('redirect_uri')).toBe('https://authhub.co/invite/oauth-callback');
      expect(authUrl.searchParams.get('config_id')).toBeNull();
      expect(authUrl.searchParams.get('scope')).toBe(
        'ads_management,ads_read,business_management,pages_read_engagement'
      );
    });

    it('falls back to scope-based OAuth when Meta Login for Business configuration is absent', () => {
      const authUrl = new URL(connector.getAuthUrl('state-123'));

      expect(authUrl.searchParams.get('config_id')).toBeNull();
      expect(authUrl.searchParams.get('scope')).toBe('ads_management,ads_read,business_management');
    });
  });

  describe('getLongLivedToken', () => {
    it('does not create an invalid expiry when Meta omits expires_in', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'long-lived-token', token_type: 'bearer' }),
      } as Response);

      await expect(connector.getLongLivedToken(accessToken)).resolves.toMatchObject({
        accessToken: 'long-lived-token',
        tokenType: 'bearer',
        expiresIn: undefined,
        expiresAt: undefined,
      });
    });
  });

  describe('getBusinessAccounts', () => {
    it('follows pagination so all businesses are returned', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'biz_1', name: 'Business One', vertical_name: 'Retail' },
            ],
            paging: {
              next: 'https://graph.facebook.com/v21.0/me/businesses?after=cursor-2',
            },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'biz_2', name: 'Business Two', verification_status: 'verified' },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response);

      const result = await connector.getBusinessAccounts(accessToken);

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('graph.facebook.com/v21.0/me/businesses'),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://graph.facebook.com/v21.0/me/businesses?after=cursor-2&access_token=test-access-token',
        expect.any(Object)
      );
      expect(result).toEqual({
        businesses: [
          { id: 'biz_1', name: 'Business One', verticalName: 'Retail', verificationStatus: undefined },
          { id: 'biz_2', name: 'Business Two', verticalName: undefined, verificationStatus: 'verified' },
        ],
        hasAccess: true,
      });
    });

    it('merges businesses discovered through business_users without duplicating existing businesses', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'biz_1', name: 'Business One', vertical_name: 'Retail' },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'business-user-1',
                business: {
                  id: 'biz_2',
                  name: 'Business Two',
                  verification_status: 'verified',
                },
              },
              {
                id: 'business-user-2',
                business: {
                  id: 'biz_1',
                  name: 'Business One',
                },
              },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response);

      const result = await connector.getBusinessAccounts(accessToken);

      const secondCallUrl = new URL(String(vi.mocked(fetch).mock.calls[1]?.[0]));
      expect(`${secondCallUrl.origin}${secondCallUrl.pathname}`).toBe(
        'https://graph.facebook.com/v21.0/me/business_users'
      );
      expect(secondCallUrl.searchParams.get('fields')).toBe('business{id,name,verification_status}');
      expect(secondCallUrl.searchParams.get('access_token')).toBe(accessToken);

      expect(result).toEqual({
        businesses: [
          { id: 'biz_1', name: 'Business One', verticalName: 'Retail', verificationStatus: undefined },
          { id: 'biz_2', name: 'Business Two', verticalName: undefined, verificationStatus: 'verified' },
        ],
        hasAccess: true,
      });
    });

    it('keeps primary business results when the business_users lookup fails', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'biz_1', name: 'Business One', vertical_name: 'Retail' },
              { id: 'biz_2', name: 'Business Two' },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Permissions error',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response);

      const result = await connector.getBusinessAccounts(accessToken);

      expect(result).toEqual({
        businesses: [
          { id: 'biz_1', name: 'Business One', verticalName: 'Retail', verificationStatus: undefined },
          { id: 'biz_2', name: 'Business Two', verticalName: undefined, verificationStatus: undefined },
        ],
        hasAccess: true,
      });
    });

    it('includes recursively managed businesses so OBO-linked portfolios appear in the list', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'biz_partner', name: 'Partner Business', vertical_name: 'Agency' },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'biz_client_1', name: 'Client Business One', verification_status: 'verified' },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 'biz_client_2', name: 'Client Business Two' },
            ],
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [],
          }),
        } as Response);

      const result = await connector.getBusinessAccounts(accessToken);

      expect(result).toEqual({
        businesses: [
          { id: 'biz_partner', name: 'Partner Business', verticalName: 'Agency', verificationStatus: undefined },
          { id: 'biz_client_1', name: 'Client Business One', verticalName: undefined, verificationStatus: 'verified' },
          { id: 'biz_client_2', name: 'Client Business Two', verticalName: undefined, verificationStatus: undefined },
        ],
        hasAccess: true,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/biz_partner/managed_businesses'),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/biz_client_1/managed_businesses'),
        expect.any(Object)
      );
    });

    it('throws when Meta business discovery fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        text: async () => 'OAuthException',
      } as Response);

      await expect(connector.getBusinessAccounts(accessToken)).rejects.toThrow(
        /Failed to fetch business accounts/
      );
    });
  });

  describe('getAdAccounts', () => {
    it('should fetch ad accounts for a business', async () => {
      const mockResponse = {
        data: [
          {
            id: 'act_123',
            name: 'Test Ad Account',
            account_status: 1,
            currency: 'USD',
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await connector.getAdAccounts(accessToken, businessId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/v21.0/${businessId}/owned_ad_accounts`),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'act_123',
        name: 'Test Ad Account',
        accountStatus: 'ACTIVE',
        currency: 'USD',
      });
    });

    it('should return empty array when no ad accounts exist', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      const result = await connector.getAdAccounts(accessToken, businessId);
      expect(result).toHaveLength(0);
    });
  });

  describe('getPages', () => {
    it('should fetch pages for a business', async () => {
      const mockResponse = {
        data: [
          {
            id: 'page_123',
            name: 'Test Page',
            category: 'Marketing',
            tasks: ['ADVERTISE', 'ANALYZE'],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await connector.getPages(accessToken, businessId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/v21.0/${businessId}/owned_pages`),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'page_123',
        name: 'Test Page',
        category: 'Marketing',
        tasks: ['ADVERTISE', 'ANALYZE'],
      });
    });
  });

  describe('getInstagramAccounts', () => {
    it('should fetch Instagram accounts linked to business', async () => {
      const mockResponse = {
        data: [
          {
            id: 'ig_123',
            username: 'test_ig',
            profile_picture_url: 'http://example.com/pic.jpg',
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await connector.getInstagramAccounts(accessToken, businessId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/v21.0/${businessId}/instagram_accounts`),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'ig_123',
        username: 'test_ig',
        profilePictureUrl: 'http://example.com/pic.jpg',
      });
    });
  });

  describe('getProductCatalogs', () => {
    it('should fetch product catalogs for a business', async () => {
      const mockResponse = {
        data: [
          {
            id: 'cat_123',
            name: 'Test Catalog',
            catalog_type: 'PRODUCT_CATALOG',
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await connector.getProductCatalogs(accessToken, businessId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/v21.0/${businessId}/owned_product_catalogs`),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'cat_123',
        name: 'Test Catalog',
        catalogType: 'PRODUCT_CATALOG',
      });
    });
  });

  describe('getAllAssets', () => {
    it('should aggregate all asset types for a business', async () => {
      // Mock business info and other endpoints
      vi.mocked(fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes(`v21.0/${businessId}?`)) {
          return { ok: true, json: async () => ({ id: businessId, name: 'Test Business' }) } as Response;
        }
        if (urlStr.includes('/owned_ad_accounts')) {
          return { ok: true, json: async () => ({ data: [{ id: 'act_1', name: 'Ad Account 1', account_status: 1, currency: 'USD' }] }) } as Response;
        }
        if (urlStr.includes('/owned_pages')) {
          return { ok: true, json: async () => ({ data: [{ id: 'page_1', name: 'Page 1', category: 'Test', tasks: [] }] }) } as Response;
        }
        if (urlStr.includes('/instagram_accounts')) {
          return { ok: true, json: async () => ({ data: [] }) } as Response;
        }
        if (urlStr.includes('/owned_product_catalogs')) {
          return { ok: true, json: async () => ({ data: [] }) } as Response;
        }
        return { ok: false, status: 404, text: async () => 'Not Found' } as Response;
      });

      const result = await connector.getAllAssets(accessToken, businessId);

      expect(result.businessId).toBe(businessId);
      expect(result.businessName).toBe('Test Business');
      expect(result.adAccounts).toHaveLength(1);
      expect(result.pages).toHaveLength(1);
      expect(result.instagramAccounts).toHaveLength(0);
      expect(result.productCatalogs).toHaveLength(0);
    });
  });
});

describe('MetaConnector Business Creation', () => {
  let connector: MetaConnector;
  const accessToken = 'test-access-token';

  beforeEach(() => {
    connector = new MetaConnector();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('getUserPages', () => {
    it('returns the user own pages mapped from /me/accounts', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'page-1', name: 'Acme Main', category: 'Retail' },
            { id: 'page-2', name: 'Acme Deals', category: 'Shopping' },
          ],
        }),
      } as Response);

      const result = await connector.getUserPages(accessToken);

      expect(result).toEqual([
        { id: 'page-1', name: 'Acme Main', category: 'Retail' },
        { id: 'page-2', name: 'Acme Deals', category: 'Shopping' },
      ]);
      expect(fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category&access_token=test-access-token',
        { method: 'GET' }
      );
    });

    it('returns an empty list when the user owns no pages', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      const result = await connector.getUserPages(accessToken);

      expect(result).toEqual([]);
    });

    it('throws with the Meta error payload on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ error: { message: 'Invalid OAuth access token' } }),
      } as unknown as Response);

      await expect(connector.getUserPages(accessToken)).rejects.toThrow(
        'Failed to fetch user pages: Invalid OAuth access token'
      );
    });
  });

  describe('createBusiness', () => {
    it('POSTs to /me/businesses with the creation fields and maps the response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'biz-123',
          name: 'Acme Business',
          timezone_id: '25',
        }),
      } as Response);

      const result = await connector.createBusiness(accessToken, {
        name: 'Acme Business',
        vertical: 'OTHER',
        primaryPageId: 'page-1',
        timezoneId: '25',
      });

      expect(result).toEqual({
        id: 'biz-123',
        name: 'Acme Business',
        timezoneId: '25',
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/me/businesses',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://graph.facebook.com/v21.0/me/businesses');
      const body = new URLSearchParams(init.body as string);
      expect(body.get('access_token')).toBe('test-access-token');
      expect(body.get('name')).toBe('Acme Business');
      expect(body.get('vertical')).toBe('OTHER');
      expect(body.get('primary_page')).toBe('page-1');
      expect(body.get('timezone_id')).toBe('25');
    });

    it('throws with the Meta error message on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: { message: 'You have reached the limit of businesses you can create' },
          }),
      } as unknown as Response);

      await expect(
        connector.createBusiness(accessToken, {
          name: 'Acme Business',
          vertical: 'OTHER',
          primaryPageId: 'page-1',
          timezoneId: '25',
        })
      ).rejects.toThrow(
        'Meta business creation failed: You have reached the limit of businesses you can create'
      );
    });

    it('throws with the raw error body when the payload is not JSON', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as unknown as Response);

      await expect(
        connector.createBusiness(accessToken, {
          name: 'Acme Business',
          vertical: 'OTHER',
          primaryPageId: 'page-1',
          timezoneId: '25',
        })
      ).rejects.toThrow('Meta business creation failed: Internal Server Error');
    });
  });

  describe('creation and setup URL helpers', () => {
    it('returns the Facebook page creation URL for users without a page', () => {
      expect(connector.getUserPageCreationUrl()).toBe(
        'https://www.facebook.com/pages/create/'
      );
    });

    it('returns a business verification deep link scoped to the business', () => {
      expect(connector.getBusinessVerificationUrl('biz-123')).toBe(
        'https://business.facebook.com/settings/biz-123/security_center'
      );
    });

    it('returns a payment method deep link scoped to the business', () => {
      expect(connector.getPaymentMethodUrl('biz-123')).toBe(
        'https://business.facebook.com/settings/biz-123/payment'
      );
    });
  });
});
