import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clientAssetsService } from '../client-assets.service.js';

describe('ClientAssetsService - Meta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
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

      if (url.includes('/biz_client_1/managed_businesses') || url.includes('/biz_client_2/managed_businesses')) {
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
              { id: 'page_2a', name: 'Owned Page', category: 'Retail' },
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

      return {
        ok: false,
        status: 404,
        text: async () => `not found: ${url}`,
      } as Response;
    });

    const result = await clientAssetsService.fetchMetaAssets('token-123', 'biz_client_2');

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
      { id: 'page_2a', name: 'Owned Page', category: 'Retail', ownershipType: 'owned' },
      { id: 'page_2b', name: 'Shared Page', category: 'Agency', ownershipType: 'client' },
    ]);
    expect(result.instagramAccounts).toEqual([
      { id: 'ig_2', username: 'clienttwo' },
    ]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining('/me/adaccounts')
    );
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      expect.stringContaining('/me/accounts?fields=id,name,picture')
    );
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

      if (url.includes('/me/business_users') || url.includes('/biz_client_1/managed_businesses')) {
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
  });

  it('reads selected Page content with a Page access token without returning the token', async () => {
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
            { id: 'post_1', message: 'Hello from the Page', created_time: '2026-09-21T00:00:00+0000' },
            { id: 'post_2' },
          ],
        }),
      } as Response);

    const result = await clientAssetsService.fetchPageEngagementProof('user-token', 'page_1');

    expect(result).toEqual({
      page: { id: 'page_1', name: 'Client Page' },
      posts: [
        {
          id: 'post_1',
          message: 'Hello from the Page',
          createdTime: '2026-09-21T00:00:00+0000',
        },
        { id: 'post_2' },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('page-token-secret');
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('/page_1');
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('fields=id%2Cname%2Caccess_token');
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain('/page_1/feed');
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain('fields=id%2Cmessage%2Ccreated_time');
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
