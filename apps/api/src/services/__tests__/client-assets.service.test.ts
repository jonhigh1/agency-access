import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clientAssetsService } from '../client-assets.service.js';
import { logger } from '../../lib/logger.js';

describe('ClientAssetsService - Meta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('waits for portfolio selection before loading scoped assets', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/businesses')) {
        return {
          ok: true,
          json: async () => ({ data: [
            { id: 'business-1', name: 'First' },
            { id: 'business-2', name: 'Second' },
          ] }),
        } as Response;
      }
      if (url.includes('/me/business_users')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      return { ok: false, status: 404, text: async () => `unexpected: ${url}` } as Response;
    });

    const result = await clientAssetsService.fetchMetaAssets('token-123');

    expect(result).toMatchObject({
      businesses: [{ id: 'business-1' }, { id: 'business-2' }],
      selectionRequired: true,
      adAccounts: [],
      pages: [],
      instagramAccounts: [],
      productCatalogs: [],
      pixels: [],
    });
    expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input)))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('/me/businesses'),
        expect.stringContaining('/me/business_users'),
      ]));
    expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input)))
      .not.toEqual(expect.arrayContaining([expect.stringContaining('/business-1/')]));
  });

  it('fetches client-selectable Meta business portfolios and scoped assets for the selected business', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
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
        } as Response;
      }

      if (url.includes('/me/business_users')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as Response;
      }

      if (url.includes('/biz_client_2/owned_ad_accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'act_2a', name: 'Owned Ad Account', account_status: 1, currency: 'USD' },
            ],
          }),
        } as Response;
      }

      if (url.includes('/biz_client_2/client_ad_accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'act_2b', name: 'Shared Ad Account', account_status: 1, currency: 'USD' },
            ],
          }),
        } as Response;
      }

      if (url.includes('/biz_client_2/owned_pages')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'page_2a',
                name: 'Owned Page',
                category: 'Retail',
                instagram_business_account: { id: 'ig_2', username: 'clienttwo' },
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/biz_client_2/client_pages')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'page_2b', name: 'Shared Page', category: 'Agency' },
            ],
          }),
        } as Response;
      }

      if (url.includes('/biz_client_2/instagram_accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'ig_2', username: 'clienttwo' },
            ],
          }),
        } as Response;
      }

      if (url.includes('/biz_client_2/owned_product_catalogs') && url.includes('after=cursor-2')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'catalog_2c', name: 'Second Page Catalog', catalog_type: 'commerce' }] }),
        } as Response;
      }

      if (url.includes('/biz_client_2/owned_product_catalogs')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: 'catalog_2a', name: 'Owned Catalog', catalog_type: 'commerce' }],
            paging: { next: 'https://graph.facebook.com/v25.0/biz_client_2/owned_product_catalogs?after=cursor-2' },
          }),
        } as Response;
      }

      if (url.includes('/biz_client_2/client_product_catalogs')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'catalog_2b', name: 'Shared Catalog', catalog_type: 'commerce' }] }),
        } as Response;
      }

      if (url.includes('/biz_client_2/client_pixels')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'pixel_2', name: 'Client Pixel' }] }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        text: async () => `not found: ${url}`,
      } as Response;
    });

    const result = await clientAssetsService.fetchMetaAssets('token-123', 'biz_client_2', [
      'ad_account', 'page', 'instagram_account', 'catalog', 'dataset',
    ]);

    expect(result.businesses).toEqual([
      {
        id: 'biz_client_1',
        name: 'Client One',
        verificationStatus: 'verified',
      },
      {
        id: 'biz_client_2',
        name: 'Client Two',
      },
    ]);
    expect(result.selectedBusinessId).toBe('biz_client_2');
    expect(result.selectedBusinessName).toBe('Client Two');
    expect(result.selectionRequired).toBe(false);
    expect(result.adAccounts).toEqual([
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
    ]);
    expect(result.pages).toEqual([
      {
        id: 'page_2a', name: 'Owned Page', category: 'Retail',
        connectedInstagram: { id: 'ig_2', username: 'clienttwo' }, ownershipType: 'owned',
      },
      { id: 'page_2b', name: 'Shared Page', category: 'Agency', ownershipType: 'client' },
    ]);
    expect(vi.mocked(fetch).mock.calls.some(([input]) =>
      new URL(String(input)).searchParams.get('fields') === 'id,name,category,instagram_business_account{id,username}'
    )).toBe(true);
    expect(result.instagramAccounts).toEqual([
      { id: 'ig_2', username: 'clienttwo' },
    ]);
    expect(result.productCatalogs).toEqual([
      { id: 'catalog_2a', name: 'Owned Catalog', catalogType: 'commerce', ownershipType: 'owned' },
      { id: 'catalog_2c', name: 'Second Page Catalog', catalogType: 'commerce', ownershipType: 'owned' },
      { id: 'catalog_2b', name: 'Shared Catalog', catalogType: 'commerce', ownershipType: 'client' },
    ]);
    expect(result.pixels).toEqual([{ id: 'pixel_2', name: 'Client Pixel' }]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining('/me/adaccounts')
    );
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining('/me/accounts?fields=id,name,picture')
    );
    expect(vi.mocked(fetch).mock.calls.every(([input]) => !String(input).includes('managed_businesses'))).toBe(true);
  });

  it('throws when the requested Meta business portfolio is not available to the client user', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/me/businesses')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: 'biz_client_1', name: 'Client One' }],
          }),
        } as Response;
      }

      if (url.includes('/me/business_users')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        text: async () => `not found: ${url}`,
      } as Response;
    });

    await expect(
      clientAssetsService.fetchMetaAssets('token-123', 'biz_missing')
    ).rejects.toMatchObject({
      code: 'INVALID_META_BUSINESS_PORTFOLIO',
    });
    expect(vi.mocked(fetch).mock.calls.every(([input]) => !String(input).includes('managed_businesses'))).toBe(true);
  });

  it('loads only requested Meta asset families for grant validation', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/businesses')) {
        return { ok: true, json: async () => ({ data: [{ id: 'business-1', name: 'Client' }] }) } as Response;
      }
      if (url.includes('/me/business_users')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/owned_ad_accounts') || url.includes('/client_ad_accounts')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      return { ok: false, status: 404, text: async () => `unexpected edge: ${url}` } as Response;
    });

    await clientAssetsService.fetchMetaAssets('token-123', 'business-1', ['ad_account']);

    const urls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(urls).toEqual(expect.arrayContaining([
      expect.stringContaining('/owned_ad_accounts?'),
      expect.stringContaining('/client_ad_accounts?'),
    ]));
    expect(urls).not.toEqual(expect.arrayContaining([
      expect.stringContaining('/owned_pages?'),
      expect.stringContaining('/instagram_accounts?'),
      expect.stringContaining('/product_catalogs?'),
      expect.stringContaining('/client_pixels?'),
    ]));
  });

  it('warns when connected Instagram accounts cannot load but keeps core assets available', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/businesses')) {
        return { ok: true, json: async () => ({ data: [{ id: 'business-1', name: 'Client' }] }) } as Response;
      }
      if (url.includes('/me/business_users')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/instagram_accounts?')) {
        return { ok: false, status: 403, text: async () => 'Permission denied' } as Response;
      }
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    });

    const result = await clientAssetsService.fetchMetaAssets('token-123', 'business-1');

    expect(result.adAccounts).toEqual([]);
    expect(result.pages).toEqual([]);
    expect(result.instagramAccounts).toEqual([]);
    expect(result.assetLoadWarnings).toEqual([
      'Could not load connected Instagram accounts for business business-1. Check Instagram permissions and try again.',
    ]);
  });

  it('warns when Pixel discovery is denied without failing core asset discovery', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/businesses')) {
        return { ok: true, json: async () => ({ data: [{ id: 'business-1', name: 'Client' }] }) } as Response;
      }
      if (url.includes('/me/business_users')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/client_pixels?')) {
        return { ok: false, status: 403, text: async () => 'Permission denied' } as Response;
      }
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    });

    const result = await clientAssetsService.fetchMetaAssets('token-123', 'business-1');

    expect(result.pixels).toEqual([]);
    expect(result.assetLoadWarnings).toContain(
      'Could not load Pixels for business business-1. Check Meta asset permissions and try again.'
    );
    expect(result.pages).toEqual([]);
  });

  it('warns when one catalog edge fails instead of treating incomplete discovery as empty', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/businesses')) {
        return { ok: true, json: async () => ({ data: [{ id: 'business-1', name: 'Client' }] }) } as Response;
      }
      if (url.includes('/me/business_users')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/client_product_catalogs?')) {
        return { ok: false, status: 403, text: async () => 'Permission denied' } as Response;
      }
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    });

    const result = await clientAssetsService.fetchMetaAssets('token-123', 'business-1', [
      'ad_account',
      'page',
      'instagram_account',
      'catalog',
      'dataset',
    ]);

    expect(result.productCatalogs).toEqual([]);
    expect(result.assetLoadWarnings).toContain(
      'Could not load Product Catalogs for business business-1. Check Meta asset permissions and try again.'
    );
  });

  it.each([
    'owned_ad_accounts',
    'client_ad_accounts',
    'owned_pages',
    'client_pages',
  ])('surfaces denied %s reads instead of returning an empty asset list', async (edge) => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/businesses')) {
        return { ok: true, json: async () => ({ data: [{ id: 'business-1', name: 'Client' }] }) } as Response;
      }
      if (url.includes('/me/business_users')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes(`/${edge}?`)) {
        return { ok: false, status: 403, text: async () => 'Permission denied' } as Response;
      }
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    });

    await expect(clientAssetsService.fetchMetaAssets('token-123', 'business-1'))
      .rejects.toThrow(`Meta API error (${edge}?`);
  });

  it('reads selected Page content with a Page access token without returning the token', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'page_1',
          name: 'Client Page',
          category: 'Local business',
          tasks: ['MANAGE', 'ADVERTISE'],
          fan_count: 120,
          followers_count: 150,
          instagram_business_account: { id: 'ig_1', username: 'clientpage' },
          access_token: 'page-token-secret',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'post_1', created_time: '2026-09-21T00:00:00+0000' },
            { id: 'post_2' },
          ],
        }),
      } as Response);

    const result = await clientAssetsService.fetchPageEngagementProof('user-token', 'page_1');

    expect(result).toEqual({
      page: {
        id: 'page_1',
        name: 'Client Page',
        category: 'Local business',
        managedTasks: ['MANAGE', 'ADVERTISE'],
        fanCount: 120,
        followerCount: 150,
      },
      connectedInstagram: { id: 'ig_1', username: 'clientpage' },
      posts: [
        { id: 'post_1', createdTime: '2026-09-21T00:00:00+0000' },
        { id: 'post_2' },
      ],
      graphOperationCaptions: [
        expect.stringMatching(/GET.*client_user.*ok/i),
        expect.stringMatching(/GET.*selected_page.*ok/i),
      ],
    });
    expect(result.graphOperationCaptions?.join(' ')).toMatch(/\{page_id\}|page_1/);
    expect(JSON.stringify(result)).not.toContain('page-token-secret');
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('/page_1');
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('followers_count');
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain('/page_1/feed');
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain('fields=id%2Ccreated_time');
    expect(new URL(String(vi.mocked(fetch).mock.calls[0]?.[0])).searchParams.has('access_token')).toBe(false);
    expect(new URL(String(vi.mocked(fetch).mock.calls[1]?.[0])).searchParams.has('access_token')).toBe(false);
    expect(new Headers(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer user-token'
    );
    expect(new Headers(vi.mocked(fetch).mock.calls[1]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer page-token-secret'
    );
    expect(JSON.stringify(result.graphOperationCaptions)).not.toContain('page-token-secret');
  });

  it('drops post message and story fields from the Page feed response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'page_1',
          name: 'Client Page',
          access_token: 'page-token-secret',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'post_1',
              created_time: '2026-09-21T00:00:00+0000',
              message: 'Hidden caption',
              story: 'Hidden story',
            },
          ],
        }),
      } as Response);

    const result = await clientAssetsService.fetchPageEngagementProof('user-token', 'page_1');

    expect(result.posts).toEqual([{ id: 'post_1', createdTime: '2026-09-21T00:00:00+0000' }]);
    expect(JSON.stringify(result)).not.toContain('Hidden');
  });

  it('treats an empty Page feed as a successful validation with no invented posts', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'page_1', name: 'Client Page', access_token: 'page-token-secret' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

    const result = await clientAssetsService.fetchPageEngagementProof('user-token', 'page_1');

    expect(result).toEqual({
      page: { id: 'page_1', name: 'Client Page', managedTasks: [] },
      posts: [],
      graphOperationCaptions: expect.any(Array),
    });
  });

  it.each(['user', 'page'] as const)('sanitizes a denied %s Page read and its diagnostic log', async (stage) => {
    const log = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const denied = {
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: {
        code: 10,
        error_subcode: 123,
        message: 'Denied access_token=private-token',
        fbtrace_id: 'trace-with-private-token',
      } }),
    } as Response;
    if (stage === 'page') {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'page_1', name: 'Client Page', access_token: 'page-token-secret' }),
      } as Response);
    }
    vi.mocked(fetch).mockResolvedValueOnce(denied);
    try {
      await expect(clientAssetsService.fetchPageEngagementProof('user-token', 'page_1'))
        .rejects.toThrow('AuthHub could not validate this Page. Confirm your Page access in Meta, then try again.');
      expect(log).toHaveBeenCalledWith(expect.any(String), {
        pageId: 'page_1', status: 403, code: 10, subcode: 123,
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain('private-token');
    } finally {
      log.mockRestore();
    }
  });

  it.each(['<html>private-token</html>', 'null', '{"error":{"code":"private-token"}}'])
    ('does not expose malformed Meta errors', async (body) => {
      const log = vi.spyOn(logger, 'error').mockImplementation(() => {});
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 502, text: async () => body } as Response);
      try {
        await expect(clientAssetsService.fetchPageEngagementProof('user-token', 'page_1'))
          .rejects.toThrow('AuthHub could not validate this Page. Confirm your Page access in Meta, then try again.');
        expect(log).toHaveBeenCalledWith(expect.any(String), { pageId: 'page_1', status: 502 });
      } finally {
        log.mockRestore();
      }
    });

  it.each(['user', 'page'] as const)('requires Meta reauthorization when the %s token is invalid', async (tokenStage) => {
    const invalidTokenResponse = {
      ok: false,
      text: async () => JSON.stringify({ error: { code: 190, type: 'OAuthException' } }),
    } as Response;
    vi.mocked(fetch).mockResolvedValueOnce(tokenStage === 'user'
      ? invalidTokenResponse
      : {
          ok: true,
          json: async () => ({ id: 'page_1', name: 'Client Page', access_token: 'page-token-secret' }),
        } as Response
    );
    if (tokenStage === 'page') vi.mocked(fetch).mockResolvedValueOnce(invalidTokenResponse);

    await expect(clientAssetsService.fetchPageEngagementProof('user-token', 'page_1'))
      .rejects.toMatchObject({
        name: 'MetaPageReauthorizationError',
        message: 'Meta access expired or the Page token is invalid. Reconnect Meta and try again.',
      });
  });
});

describe('ClientAssetsService - TikTok', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('fetches TikTok advertisers, business centers, and BC assets', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/oauth2/advertiser/get/')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              list: [
                {
                  advertiser_id: 'adv_1',
                  advertiser_name: 'Acme Advertiser',
                  status: 'STATUS_ENABLE',
                },
              ],
            },
          }),
        } as Response;
      }

      if (url.includes('/bc/get/')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              list: [
                {
                  bc_id: 'bc_1',
                  name: 'Acme Business Center',
                },
              ],
            },
          }),
        } as Response;
      }

      if (url.includes('/bc/asset/get/')) {
        return {
          ok: true,
          json: async () => ({
            code: 0,
            data: {
              list: [
                {
                  asset_id: 'adv_1',
                  asset_name: 'Acme Advertiser',
                  asset_type: 'ADVERTISER',
                },
              ],
            },
          }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        text: async () => 'not found',
      } as Response;
    });

    const result = await clientAssetsService.fetchTikTokAssets('token-123');

    expect(result.advertisers).toHaveLength(1);
    expect(result.businessCenters).toHaveLength(1);
    expect(result.businessCenterAssets).toHaveLength(1);
    expect(result.businessCenterAssets[0].bcId).toBe('bc_1');
    expect(result.businessCenterAssets[0].advertisers).toHaveLength(1);
  });

  it('returns empty arrays when TikTok API fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    } as Response);

    const result = await clientAssetsService.fetchTikTokAssets('token-123');

    expect(result.advertisers).toEqual([]);
    expect(result.businessCenters).toEqual([]);
    expect(result.businessCenterAssets).toEqual([]);
  });
});

describe('ClientAssetsService - LinkedIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('fetches LinkedIn Pages from organization ACLs and organization details', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/rest/organizationAcls')) {
        return {
          ok: true,
          json: async () => ({
            elements: [
              {
                role: 'ADMINISTRATOR',
                state: 'APPROVED',
                organizationTarget: 'urn:li:organization:789',
              },
            ],
          }),
        } as Response;
      }

      if (url === 'https://api.linkedin.com/rest/organizations/789') {
        return {
          ok: true,
          json: async () => ({
            id: 789,
            localizedName: 'Northwind',
            vanityName: 'northwind',
            primaryOrganizationType: 'COMPANY',
          }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        text: async () => 'not found',
      } as Response;
    });

    const result = await clientAssetsService.fetchLinkedInPages('token-123');

    expect(result).toEqual([
      {
        id: '789',
        name: 'Northwind',
        urn: 'urn:li:organization:789',
        vanityName: 'northwind',
        type: 'COMPANY',
      },
    ]);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('https://api.linkedin.com/rest/organizationAcls'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
          'LinkedIn-Version': '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        }),
      })
    );
  });

  it('throws when all LinkedIn organization detail lookups fail', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes('/rest/organizationAcls')) {
        return {
          ok: true,
          json: async () => ({
            elements: [
              {
                role: 'ADMINISTRATOR',
                state: 'APPROVED',
                organizationTarget: 'urn:li:organization:789',
              },
            ],
          }),
        } as Response;
      }

      if (url === 'https://api.linkedin.com/rest/organizations/789') {
        return {
          ok: false,
          status: 403,
          text: async () => 'forbidden',
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        text: async () => 'not found',
      } as Response;
    });

    await expect(clientAssetsService.fetchLinkedInPages('token-123')).rejects.toThrow(
      /failed to fetch linkedin organization details/i
    );
  });
});
