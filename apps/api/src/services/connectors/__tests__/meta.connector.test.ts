import { describe, it, expect, vi, beforeEach } from 'vitest';
import { META_GRAPH_VERSION, META_PERMISSION_CONTRACT } from '@agency-platform/shared';
import { MetaConnector, MetaGraphMutationError, metaConnector } from '../meta.js';
import { getConnector } from '../factory.js';

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
    it('uses explicit core scopes when Meta Login for Business configuration is present (never config_id-only consent)', () => {
      mockEnv.META_LOGIN_FOR_BUSINESS_CONFIG_ID = '1436589444014622';
      connector = new MetaConnector();

      const authUrl = new URL(connector.getAuthUrl('state-123'));

      expect(`${authUrl.origin}${authUrl.pathname}`).toBe(
        `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`
      );
      expect(authUrl.searchParams.get('client_id')).toBe('test-app-id');
      expect(authUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3001/agency-platforms/meta/callback');
      expect(authUrl.searchParams.get('state')).toBe('state-123');
      expect(authUrl.searchParams.get('response_type')).toBe('code');
      expect(authUrl.searchParams.get('config_id')).toBeNull();
      expect(authUrl.searchParams.get('scope')).toBe(
        META_PERMISSION_CONTRACT.core.permissions.join(',')
      );
      expect(authUrl.searchParams.get('scope')).not.toContain('catalog_management');
    });

    it('uses explicit scopes instead of config_id for client OAuth flows', () => {
      mockEnv.META_LOGIN_FOR_BUSINESS_CONFIG_ID = '1436589444014622';
      connector = new MetaConnector();

      const authUrl = new URL(
        connector.getAuthUrl(
          'state-123',
          [...META_PERMISSION_CONTRACT.core.permissions],
          'https://authhub.co/invite/oauth-callback'
        )
      );

      expect(authUrl.searchParams.get('redirect_uri')).toBe('https://authhub.co/invite/oauth-callback');
      expect(authUrl.searchParams.get('config_id')).toBeNull();
      expect(authUrl.searchParams.get('scope')).toBe(
        META_PERMISSION_CONTRACT.core.permissions.join(',')
      );
    });

    it('falls back to scope-based OAuth when Meta Login for Business configuration is absent', () => {
      const authUrl = new URL(connector.getAuthUrl('state-123'));

      expect(authUrl.searchParams.get('config_id')).toBeNull();
      expect(authUrl.searchParams.get('scope')).toBe(
        META_PERMISSION_CONTRACT.core.permissions.join(',')
      );
    });

    it('strips catalog_management if a caller passes it in the scope list', () => {
      const authUrl = new URL(
        connector.getAuthUrl('state-123', [
          ...META_PERMISSION_CONTRACT.core.permissions,
          'catalog_management',
        ])
      );

      expect(authUrl.searchParams.get('scope')).toBe(
        META_PERMISSION_CONTRACT.core.permissions.join(',')
      );
    });

    it('strips ads_read and unknown scopes if a caller passes them in the scope list', () => {
      const authUrl = new URL(
        connector.getAuthUrl('state-123', [
          'ads_read',
          ...META_PERMISSION_CONTRACT.core.permissions,
          'unknown_permission',
        ])
      );

      expect(authUrl.searchParams.get('scope')).toBe(
        META_PERMISSION_CONTRACT.core.permissions.join(',')
      );
      expect(authUrl.searchParams.get('scope')).not.toContain('ads_read');
    });
  });

  it('does not treat agency Business Portfolio identity as proof of client asset access', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: businessId, name: 'Agency Portfolio' }),
    } as Response);

    const result = await connector.verifyClientAccess(
      accessToken,
      businessId,
      'client@example.com',
      'admin',
    );

    expect(result).toMatchObject({
      hasAccess: false,
      accessLevel: 'read_only',
      assets: [],
      error: expect.stringContaining('asset-specific'),
    });
    expect(fetch).not.toHaveBeenCalled();
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

  it('bounds token inspection and keeps the app token out of the request URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { user_id: 'user-1', is_valid: true, scopes: ['ads_read'] } }),
    } as Response);

    await expect(connector.getTokenMetadata('client-access-token')).resolves.toMatchObject({
      userId: 'user-1', isValid: true, scopes: ['ads_read'],
    });

    const [url, init] = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(String(url)).toContain('input_token=client-access-token');
    expect(String(url)).not.toContain('test-app-secret');
    expect(init?.headers).toEqual({ Authorization: 'Bearer test-app-id|test-app-secret' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
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
              next: `https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses?after=cursor-2`,
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
        } as Response);

      const result = await connector.getBusinessAccounts(accessToken);

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(`graph.facebook.com/${META_GRAPH_VERSION}/me/businesses`),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses?after=cursor-2`,
        expect.objectContaining({ headers: { Authorization: `Bearer ${accessToken}` } })
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
        } as Response);

      const result = await connector.getBusinessAccounts(accessToken);

      const secondCallUrl = new URL(String(vi.mocked(fetch).mock.calls[1]?.[0]));
      expect(`${secondCallUrl.origin}${secondCallUrl.pathname}`).toBe(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me/business_users`
      );
      expect(secondCallUrl.searchParams.get('fields')).toBe('business{id,name,verification_status}');
      expect(secondCallUrl.searchParams.has('access_token')).toBe(false);
      expect(vi.mocked(fetch).mock.calls[1]?.[1]).toEqual(expect.objectContaining({
        headers: { Authorization: `Bearer ${accessToken}` },
      }));
      expect(fetch).toHaveBeenCalledTimes(2);

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

    it('throws when Meta business discovery fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        text: async () => 'OAuthException',
      } as Response);

      await expect(connector.getBusinessAccounts(accessToken)).rejects.toThrow(
        /Failed to fetch business accounts/
      );
    });

    it('does not send the access token to a non-Meta business pagination host', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], paging: { next: 'https://attacker.example/collect' } }),
      } as Response);

      await expect(connector.getBusinessAccounts(accessToken))
        .rejects.toThrow('Meta returned an invalid pagination URL');
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAdAccounts', () => {
    it('follows pagination on owned and shared account edges', async () => {
      vi.mocked(fetch).mockImplementation(async (url) => {
        const value = String(url);
        const isOwned = value.includes('/owned_ad_accounts');
        const isNext = value.includes('after=cursor-2');
        const id = isOwned ? (isNext ? 'act_owned_2' : 'act_owned_1') : (isNext ? 'act_shared_2' : 'act_shared_1');
        return {
          ok: true,
          json: async () => ({
            data: [{ id, name: id, account_status: 1, currency: 'USD' }],
            ...(!isNext ? { paging: { next: `https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/${isOwned ? 'owned_ad_accounts' : 'client_ad_accounts'}?after=cursor-2` } } : {}),
          }),
        } as Response;
      });

      const result = await connector.getAdAccounts(accessToken, businessId);

      expect(result.map(({ id }) => id)).toEqual(['act_owned_1', 'act_owned_2', 'act_shared_1', 'act_shared_2']);
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    it('rejects pagination URLs outside Graph API', async () => {
      vi.mocked(fetch).mockImplementation(async (url) => ({
        ok: true,
        json: async () => String(url).includes('/owned_ad_accounts')
          ? { data: [], paging: { next: 'https://attacker.example/collect' } }
          : { data: [] },
      } as Response));

      await expect(connector.getAdAccounts(accessToken, businessId))
        .rejects.toThrow('Meta returned an invalid pagination URL');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('stops when Meta repeats a pagination URL', async () => {
      vi.mocked(fetch).mockImplementation(async (url) => ({
        ok: true,
        json: async () => String(url).includes('/owned_ad_accounts')
          ? { data: [], paging: { next: String(url) } }
          : { data: [] },
      } as Response));

      await expect(connector.getAdAccounts(accessToken, businessId))
        .rejects.toThrow('Meta returned a repeated pagination URL');
      expect(fetch).toHaveBeenCalledTimes(3);
    });

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

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'act_456',
                name: 'Shared Ad Account',
                account_status: 1,
                currency: 'USD',
              },
            ],
          }),
        } as Response);

      const result = await connector.getAdAccounts(accessToken, businessId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/owned_ad_accounts`),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/client_ad_accounts`),
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'act_123',
        name: 'Test Ad Account',
        accountStatus: 'ACTIVE',
        currency: 'USD',
      });
      expect(result[1]).toEqual({
        id: 'act_456',
        name: 'Shared Ad Account',
        accountStatus: 'ACTIVE',
        currency: 'USD',
        sharedWithBusiness: true,
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
    it('fetches owned and client pages for a business and deduplicates them', async () => {
      vi.mocked(fetch).mockImplementation(async (url) => ({
        ok: true,
        json: async () => String(url).includes('/owned_pages')
          ? { data: [{ id: 'page_123', name: 'Test Page', category: 'Marketing', tasks: ['ADVERTISE', 'ANALYZE'] }] }
          : { data: [
              { id: 'page_123', name: 'Test Page', category: 'Marketing', tasks: ['ADVERTISE', 'ANALYZE'] },
              { id: 'page_456', name: 'Client Page', category: 'Retail', tasks: ['ANALYZE'] },
            ] },
      } as Response));

      const result = await connector.getPages(accessToken, businessId);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/owned_pages`),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/client_pages`),
        expect.any(Object)
      );
      expect(result).toEqual([{
        id: 'page_123',
        name: 'Test Page',
        category: 'Marketing',
        tasks: ['ADVERTISE', 'ANALYZE'],
      }, {
        id: 'page_456',
        name: 'Client Page',
        category: 'Retail',
        tasks: ['ANALYZE'],
      }]);
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

      vi.mocked(fetch).mockImplementation(async (url) => ({
        ok: true,
        json: async () => String(url).includes('/client_product_catalogs')
          ? { data: [{ id: 'cat_shared', name: 'Shared Catalog', catalog_type: 'PRODUCT_CATALOG' }] }
          : mockResponse,
      } as Response));

      const result = await connector.getInstagramAccounts(accessToken, businessId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/instagram_accounts`),
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

  it('reads client Instagram assets by Instagram user ID for partner verification', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { id: 'asset_123', ig_user_id: 'ig_123', ig_username: 'client_ig' },
        { id: 'asset_without_identity' },
      ] }),
    } as Response);

    await expect(connector.getClientInstagramAccounts(accessToken, businessId)).resolves.toEqual([
      { id: 'ig_123', username: 'client_ig' },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/${businessId}/client_instagram_assets?fields=id%2Cig_user_id%2Cig_username`),
      expect.objectContaining({ headers: { Authorization: `Bearer ${accessToken}` } }),
    );
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

      vi.mocked(fetch).mockImplementation(async (url) => ({
        ok: true,
        json: async () => String(url).includes('/client_product_catalogs')
          ? { data: [{ id: 'cat_shared', name: 'Shared Catalog', catalog_type: 'PRODUCT_CATALOG' }] }
          : mockResponse,
      } as Response));

      const result = await connector.getProductCatalogs(accessToken, businessId);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/owned_product_catalogs`),
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/client_product_catalogs`),
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'cat_123',
        name: 'Test Catalog',
        catalogType: 'PRODUCT_CATALOG',
      });
      expect(result[1]).toEqual({ id: 'cat_shared', name: 'Shared Catalog', catalogType: 'PRODUCT_CATALOG' });
    });

    it('should fail discovery when either catalog edge is unavailable', async () => {
      vi.mocked(fetch).mockImplementation(async (url) => {
        if (String(url).includes('/client_product_catalogs')) {
          return { ok: false, status: 403 } as Response;
        }
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      });

      await expect(connector.getProductCatalogs(accessToken, businessId))
        .rejects.toThrow(/client_product_catalogs returned 403/);
    });
  });

  describe('getAllAssets', () => {
    it('should aggregate all asset types for a business', async () => {
      // Mock business info and other endpoints
      vi.mocked(fetch).mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes(`${META_GRAPH_VERSION}/${businessId}?`)) {
          return { ok: true, json: async () => ({ id: businessId, name: 'Test Business' }) } as Response;
        }
        if (urlStr.includes('/owned_ad_accounts')) {
          return { ok: true, json: async () => ({ data: [{ id: 'act_1', name: 'Ad Account 1', account_status: 1, currency: 'USD' }] }) } as Response;
        }
        if (urlStr.includes('/client_ad_accounts')) {
          return { ok: true, json: async () => ({ data: [{ id: 'act_2', name: 'Shared Ad Account', account_status: 1, currency: 'USD' }] }) } as Response;
        }
        if (urlStr.includes('/owned_pages')) {
          return { ok: true, json: async () => ({ data: [{ id: 'page_1', name: 'Page 1', category: 'Test', tasks: [] }] }) } as Response;
        }
        if (urlStr.includes('/client_pages')) {
          return { ok: true, json: async () => ({ data: [] }) } as Response;
        }
        if (urlStr.includes('/instagram_accounts')) {
          return { ok: true, json: async () => ({ data: [] }) } as Response;
        }
        if (urlStr.includes('/owned_product_catalogs')) {
          return { ok: true, json: async () => ({ data: [] }) } as Response;
        }
        if (urlStr.includes('/client_product_catalogs')) {
          return { ok: true, json: async () => ({ data: [] }) } as Response;
        }
        return { ok: false, status: 404, text: async () => 'Not Found' } as Response;
      });

      const result = await connector.getAllAssets(accessToken, businessId);

      expect(result.businessId).toBe(businessId);
      expect(result.businessName).toBe('Test Business');
      expect(result.adAccounts).toHaveLength(2);
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
      const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${accessToken}`);
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
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses`,
        expect.objectContaining({
          method: 'POST',
        })
      );

      const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get('Content-Type')).toBe(
        'application/x-www-form-urlencoded'
      );
      expect(url).toBe(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses`);
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
            error: { message: 'You have reached the limit of businesses you can create', code: 200, error_subcode: 1815001 },
          }),
      } as unknown as Response);

      await expect(
        connector.createBusiness(accessToken, {
          name: 'Acme Business',
          vertical: 'OTHER',
          primaryPageId: 'page-1',
          timezoneId: '25',
        })
      ).rejects.toMatchObject({
        name: MetaGraphMutationError.name,
        message: 'Meta business creation failed: You have reached the limit of businesses you can create',
        status: 400,
        metaCode: 200,
        metaSubcode: 1815001,
      });
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
      ).rejects.toMatchObject({
        name: MetaGraphMutationError.name,
        message: 'Meta business creation failed: Internal Server Error',
        status: 500,
        metaCode: undefined,
      });
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

describe('MetaConnector token revocation', () => {
  it('revokes app permission without putting the token in the request URL', async () => {
    const connector = new MetaConnector();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => true } as Response);

    await connector.revokeToken('sensitive-token');

    expect(fetch).toHaveBeenCalledWith(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me/permissions`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(new URLSearchParams(request.body as string).get('access_token')).toBe('sensitive-token');
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).not.toContain('sensitive-token');
  });

  it('fails when Meta does not confirm app permission revocation', async () => {
    const connector = new MetaConnector();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => false } as Response);

    await expect(connector.revokeToken('sensitive-token')).rejects.toThrow('Meta did not confirm app permission revocation');
  });

  it('treats an already-invalid access token as revoked', async () => {
    const connector = new MetaConnector();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 190, type: 'OAuthException' } }),
    } as Response);

    await expect(connector.revokeToken('sensitive-token')).resolves.toBeUndefined();
  });
});

describe('Meta connector registration', () => {
  it('uses the Meta connector for Instagram OAuth', () => {
    expect(getConnector('instagram')).toBe(metaConnector);
  });
});
