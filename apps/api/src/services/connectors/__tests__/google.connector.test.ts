import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleConnector, evaluateOffboardingScopeReadiness, isMerchantV1Ready } from '../google.js';
import { env } from '../../../lib/env.js';

// Mock env used by GoogleConnector constructor
vi.mock('../../../lib/env', () => ({
  env: {
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    API_URL: 'http://localhost:3001',
    PORT: 3001,
    GOOGLE_ADS_DEVELOPER_TOKEN: undefined,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: undefined,
  },
}));

describe('GoogleConnector', () => {
  const accessToken = 'test-access-token';
  const originalDeveloperToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const originalLoginCustomerId = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    env.GOOGLE_ADS_DEVELOPER_TOKEN = originalDeveloperToken;
    env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = originalLoginCustomerId;
  });

  it('includes Search Console webmasters scope in the default auth URL', () => {
    const connector = new GoogleConnector();

    const authUrl = connector.getAuthUrl('state-123');
    const parsed = new URL(authUrl);
    const scope = parsed.searchParams.get('scope') || '';

    expect(scope).toContain('https://www.googleapis.com/auth/webmasters');
  });

  it('parses GA4 properties from Analytics Admin accountSummaries and uses Authorization header', async () => {
    const connector = new GoogleConnector();

    vi.mocked(fetch).mockImplementation(async (input: any, init?: any) => {
      const url = String(input);

      if (url.includes('https://analyticsadmin.googleapis.com/v1beta/accountSummaries')) {
        expect(init?.headers?.Authorization).toBe(`Bearer ${accessToken}`);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            accountSummaries: [
              {
                account: 'accounts/111',
                displayName: 'Test Account',
                propertySummaries: [
                  {
                    property: 'properties/222',
                    displayName: 'Test Property',
                  },
                ],
              },
            ],
          }),
        } as any;
      }

      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Forbidden',
        json: async () => ({}),
      } as any;
    });

    const result = await connector.getAllGoogleAccounts(accessToken);

    expect(result.analyticsProperties).toEqual([
      {
        id: '222',
        name: 'properties/222',
        displayName: 'Test Property',
        type: 'ga4',
        accountName: 'Test Account',
      },
    ]);
    expect(result.hasAccess).toBe(true);
  });

  it('maps Business Profile locations instead of only top-level business accounts', async () => {
    const connector = new GoogleConnector();

    vi.mocked(fetch).mockImplementation(async (input: any) => {
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
        } as any;
      }

      if (url.includes('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/123/locations?readMask=name,title')) {
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
        } as any;
      }

      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Forbidden',
        json: async () => ({}),
      } as any;
    });

    const result = await connector.getAllGoogleAccounts(accessToken);

    expect(result.businessAccounts).toEqual([
      {
        id: '456',
        name: 'Main Street Store',
        type: 'google_business',
        accountName: 'Agency Test Business',
      },
    ]);
  });

  it('follows Business Profile pagination for accounts and locations', async () => {
    const connector = new GoogleConnector();

    vi.mocked(fetch).mockImplementation(async (input: any) => {
      const url = String(input);

      if (url === 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            accounts: [{ name: 'accounts/123', accountName: 'First Account' }],
            nextPageToken: 'accounts-page-2',
          }),
        } as any;
      }

      if (url.includes('https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageToken=accounts-page-2')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            accounts: [{ name: 'accounts/999', accountName: 'Second Account' }],
          }),
        } as any;
      }

      if (url === 'https://mybusinessbusinessinformation.googleapis.com/v1/accounts/123/locations?readMask=name,title') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            locations: [{ name: 'accounts/123/locations/456', title: 'Store 456' }],
            nextPageToken: 'locations-page-2',
          }),
        } as any;
      }

      if (url.includes('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/123/locations?readMask=name,title&pageToken=locations-page-2')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            locations: [{ name: 'accounts/123/locations/457', title: 'Store 457' }],
          }),
        } as any;
      }

      if (url === 'https://mybusinessbusinessinformation.googleapis.com/v1/accounts/999/locations?readMask=name,title') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            locations: [{ name: 'accounts/999/locations/990', title: 'Store 990' }],
          }),
        } as any;
      }

      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Forbidden',
        json: async () => ({}),
      } as any;
    });

    const result = await connector.getAllGoogleAccounts(accessToken);

    expect(result.businessAccounts).toEqual([
      {
        id: '456',
        name: 'Store 456',
        type: 'google_business',
        accountName: 'First Account',
      },
      {
        id: '457',
        name: 'Store 457',
        type: 'google_business',
        accountName: 'First Account',
      },
      {
        id: '990',
        name: 'Store 990',
        type: 'google_business',
        accountName: 'Second Account',
      },
    ]);
  });

  it('resolves Merchant Center account details and accessible sub-accounts from authinfo', async () => {
    const connector = new GoogleConnector();

    vi.mocked(fetch).mockImplementation(async (input: any) => {
      const url = String(input);

      if (url.includes('https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            accountIdentifiers: [{ merchantId: '7890' }],
          }),
        } as any;
      }

      if (url.includes('https://shoppingcontent.googleapis.com/content/v2.1/7890/accounts/7890')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            id: '7890',
            name: 'Primary Merchant Center',
            websiteUrl: 'https://primary.example',
          }),
        } as any;
      }

      if (url.includes('https://shoppingcontent.googleapis.com/content/v2.1/7890/accounts')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            resources: [
              {
                id: '7891',
                name: 'Sub Account One',
                websiteUrl: 'https://sub.example',
              },
            ],
          }),
        } as any;
      }

      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not Found',
        json: async () => ({}),
      } as any;
    });

    const result = await connector.getAllGoogleAccounts(accessToken);

    expect(result.merchantCenterAccounts).toEqual([
      {
        id: '7890',
        name: 'Primary Merchant Center',
        type: 'google_merchant_center',
        websiteUrl: 'https://primary.example',
      },
      {
        id: '7891',
        name: 'Sub Account One',
        type: 'google_merchant_center',
        websiteUrl: 'https://sub.example',
      },
    ]);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${accessToken}`,
        }),
      })
    );
  });

  it('filters unresolved Google Ads accounts when account detail lookup returns 403', async () => {
    env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-developer-token';
    const connector = new GoogleConnector();

    vi.mocked(fetch).mockImplementation(async (input: any) => {
      const url = String(input);

      if (url.includes('https://googleads.googleapis.com/v22/customers:listAccessibleCustomers')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            resourceNames: ['customers/6449142979'],
          }),
        } as any;
      }

      if (url.includes('https://googleads.googleapis.com/v22/customers/6449142979/googleAds:search')) {
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
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
        text: async () => 'Not Found',
        json: async () => ({}),
      } as any;
    });

    const result = await connector.getAllGoogleAccounts(accessToken);

    expect(result.adsAccounts).toEqual([]);
    expect(result.hasAccess).toBe(false);
  });

  it('returns only ENABLED Google Ads accounts and filters cancelled or unresolved accounts', async () => {
    env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-developer-token';
    const connector = new GoogleConnector();

    vi.mocked(fetch).mockImplementation(async (input: any, init?: any) => {
      const url = String(input);
      const headers = init?.headers as Record<string, string> | undefined;

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
        } as any;
      }

      if (url === 'https://googleads.googleapis.com/v22/customers/3333333333') {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Not Found',
          json: async () => ({}),
        } as any;
      }

      if (url.includes('https://googleads.googleapis.com/v22/customers/') && url.includes('/googleAds:search')) {
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: async () => JSON.stringify({
            error: {
              code: 403,
              message: `Permission denied for ${headers?.['login-customer-id'] || 'none'}`,
            },
          }),
        } as any;
      }

      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not Found',
        json: async () => ({}),
      } as any;
    });

    const result = await connector.getAllGoogleAccounts(accessToken);

    expect(result.adsAccounts).toEqual([
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

  it('uses the customer descriptive name when Google Ads returns direct customer details', async () => {
    env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-developer-token';
    const connector = new GoogleConnector();

    vi.mocked(fetch).mockImplementation(async (input: any) => {
      const url = String(input);

      if (url.includes('https://googleads.googleapis.com/v22/customers:listAccessibleCustomers')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            resourceNames: ['customers/6449142979'],
          }),
        } as any;
      }

      if (url.includes('https://googleads.googleapis.com/v22/customers/6449142979/googleAds:search')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            results: [
              {
                customer: {
                  id: '6449142979',
                  descriptiveName: 'Pillar AI Agency MCC',
                  manager: true,
                  status: 'ENABLED',
                },
              },
            ],
          }),
        } as any;
      }

      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not Found',
        json: async () => ({}),
      } as any;
    });

    const result = await connector.getAllGoogleAccounts(accessToken);

    expect(result.adsAccounts).toEqual([
      {
        id: '6449142979',
        name: 'Pillar AI Agency MCC',
        formattedId: '644-914-2979',
        isManager: true,
        nameSource: 'direct',
        type: 'google_ads',
        status: 'ENABLED',
      },
    ]);
  });

  it('falls back to customer_client hierarchy names when direct customer lookups are not accessible', async () => {
    env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-developer-token';
    const connector = new GoogleConnector();

    vi.mocked(fetch).mockImplementation(async (input: any, init?: any) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;

      if (url.includes('https://googleads.googleapis.com/v22/customers:listAccessibleCustomers')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            resourceNames: ['customers/6449142979', 'customers/5497559774'],
          }),
        } as any;
      }

      if (
        url.includes('https://googleads.googleapis.com/v22/customers/6449142979/googleAds:search') &&
        body?.query === 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level, customer_client.status FROM customer_client WHERE customer_client.level <= 1'
      ) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            results: [
              {
                customerClient: {
                  id: '6449142979',
                  descriptiveName: 'Pillar AI Agency MCC',
                  manager: true,
                  level: 0,
                  status: 'ENABLED',
                },
              },
              {
                customerClient: {
                  id: '5497559774',
                  descriptiveName: 'Client Alpha',
                  manager: false,
                  level: 1,
                  status: 'ENABLED',
                },
              },
            ],
          }),
        } as any;
      }

      if (url.includes('https://googleads.googleapis.com/v22/customers/') && body?.query === 'SELECT customer.id, customer.descriptive_name, customer.manager, customer.status FROM customer LIMIT 1') {
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
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
        text: async () => 'Not Found',
        json: async () => ({}),
      } as any;
    });

    const result = await connector.getAllGoogleAccounts(accessToken);

    expect(result.adsAccounts).toEqual([
      {
        id: '6449142979',
        name: 'Pillar AI Agency MCC',
        formattedId: '644-914-2979',
        isManager: true,
        nameSource: 'hierarchy',
        type: 'google_ads',
        status: 'ENABLED',
      },
      {
        id: '5497559774',
        name: 'Client Alpha',
        formattedId: '549-755-9774',
        isManager: false,
        nameSource: 'hierarchy',
        type: 'google_ads',
        status: 'ENABLED',
      },
    ]);
  });

  it('retries hierarchy discovery with alternate login customer contexts when the configured login customer is invalid', async () => {
    env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-developer-token';
    env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = '9999999999';
    const connector = new GoogleConnector();

    vi.mocked(fetch).mockImplementation(async (input: any, init?: any) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const headers = init?.headers as Record<string, string> | undefined;
      const loginCustomerId = headers?.['login-customer-id'];

      if (url.includes('https://googleads.googleapis.com/v22/customers:listAccessibleCustomers')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            resourceNames: ['customers/1111111111', 'customers/2222222222'],
          }),
        } as any;
      }

      if (
        url.includes('https://googleads.googleapis.com/v22/customers/1111111111/googleAds:search') &&
        body?.query === 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level, customer_client.status FROM customer_client WHERE customer_client.level <= 1'
      ) {
        if (loginCustomerId === '9999999999') {
          return {
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            text: async () => JSON.stringify({
              error: {
                code: 403,
                message: 'Permission denied',
              },
            }),
          } as any;
        }

        if (loginCustomerId === '1111111111') {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
              results: [
                {
                  customerClient: {
                    id: '1111111111',
                    descriptiveName: 'Agency MCC',
                    manager: true,
                    level: 0,
                    status: 'ENABLED',
                  },
                },
                {
                  customerClient: {
                    id: '2222222222',
                    descriptiveName: 'Client Bravo',
                    manager: false,
                    level: 1,
                    status: 'ENABLED',
                  },
                },
              ],
            }),
          } as any;
        }
      }

      if (
        url.includes('https://googleads.googleapis.com/v22/customers/2222222222/googleAds:search') &&
        body?.query === 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level FROM customer_client WHERE customer_client.level <= 1'
      ) {
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: async () => JSON.stringify({
            error: {
              code: 403,
              message: 'Permission denied',
            },
          }),
        } as any;
      }

      if (url.includes('https://googleads.googleapis.com/v22/customers/') && body?.query === 'SELECT customer.id, customer.descriptive_name, customer.manager, customer.status FROM customer LIMIT 1') {
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
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
        text: async () => 'Not Found',
        json: async () => ({}),
      } as any;
    });

    const result = await connector.getAllGoogleAccounts(accessToken);

    expect(result.adsAccounts).toEqual([
      {
        id: '1111111111',
        name: 'Agency MCC',
        formattedId: '111-111-1111',
        isManager: true,
        nameSource: 'hierarchy',
        type: 'google_ads',
        status: 'ENABLED',
      },
      {
        id: '2222222222',
        name: 'Client Bravo',
        formattedId: '222-222-2222',
        isManager: false,
        nameSource: 'hierarchy',
        type: 'google_ads',
        status: 'ENABLED',
      },
    ]);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://googleads.googleapis.com/v22/customers/1111111111/googleAds:search',
      expect.objectContaining({
        headers: expect.objectContaining({
          'login-customer-id': '1111111111',
        }),
      })
    );
  });
});

describe('getAccountsForProduct dispatch (card 5 U8)', () => {
  it('routes each Google product to its account fetcher', async () => {
    const connector = new GoogleConnector();
    const token = 'test-access-token';
    const ads = [{ id: 'ads-1', name: 'Ads', type: 'google_ads' as const }];
    const props = [{ id: 'ga4-1', name: 'Prop', type: 'ga4' as const }];
    const biz = [{ id: 'biz-1', name: 'Biz', type: 'google_business_profile' as const }];
    const gtm = [{ id: 'gtm-1', name: 'GTM', type: 'google_tag_manager' as const }];
    const sc = [{ id: 'sc-1', name: 'SC', type: 'google_search_console' as const }];
    const mc = [{ id: 'mc-1', name: 'MC', type: 'google_merchant_center' as const }];

    vi.spyOn(connector as any, 'getAdsAccounts').mockResolvedValue({ accounts: ads });
    vi.spyOn(connector as any, 'getAnalyticsProperties').mockResolvedValue({ properties: props });
    vi.spyOn(connector as any, 'getBusinessLocations').mockResolvedValue({ accounts: biz });
    vi.spyOn(connector as any, 'getTagManagerContainers').mockResolvedValue({ containers: gtm });
    vi.spyOn(connector as any, 'getSearchConsoleSites').mockResolvedValue({ sites: sc });
    vi.spyOn(connector as any, 'getMerchantCenterAccounts').mockResolvedValue({ accounts: mc });

    await expect(connector.getAccountsForProduct('google_ads', token)).resolves.toEqual(ads);
    await expect(connector.getAccountsForProduct('ga4', token)).resolves.toEqual(props);
    await expect(connector.getAccountsForProduct('google_business_profile', token)).resolves.toEqual(biz);
    await expect(connector.getAccountsForProduct('google_tag_manager', token)).resolves.toEqual(gtm);
    await expect(connector.getAccountsForProduct('google_search_console', token)).resolves.toEqual(sc);
    await expect(connector.getAccountsForProduct('google_merchant_center', token)).resolves.toEqual(mc);
  });
});

describe('offboarding prerequisite checks', () => {
  it('classifies GA4 as reconnect_required when analytics.manage.users scope is missing', () => {
    const grantedScopes = new Set([
      'https://www.googleapis.com/auth/analytics.readonly',
      'openid',
    ]);

    const result = evaluateOffboardingScopeReadiness(grantedScopes, 'ga4');

    expect(result).toBe('reconnect_required');
  });

  it('classifies GTM as reconnect_required when tagmanager.manage.users scope is missing', () => {
    const grantedScopes = new Set([
      'https://www.googleapis.com/auth/tagmanager.readonly',
      'openid',
    ]);

    const result = evaluateOffboardingScopeReadiness(grantedScopes, 'google_tag_manager');

    expect(result).toBe('reconnect_required');
  });

  it('classifies GA4 as eligible_automatic when management scope is present', () => {
    const grantedScopes = new Set([
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/analytics.manage.users',
      'openid',
    ]);

    const result = evaluateOffboardingScopeReadiness(grantedScopes, 'ga4');

    expect(result).toBe('eligible_automatic');
  });

  it('classifies products with no management scopes as eligible_automatic', () => {
    const grantedScopes = new Set([
      'https://www.googleapis.com/auth/adwords',
    ]);

    const result = evaluateOffboardingScopeReadiness(grantedScopes, 'google_ads');

    expect(result).toBe('eligible_automatic');
  });

  it('returns isMerchantV1Ready false when GOOGLE_MERCHANT_CENTER_API_VERSION is not v1', () => {
    expect(isMerchantV1Ready()).toBe(false);
  });

  it('returns isMerchantV1Ready true when GOOGLE_MERCHANT_CENTER_API_VERSION equals v1', () => {
    env.GOOGLE_MERCHANT_CENTER_API_VERSION = 'v1';
    try {
      expect(isMerchantV1Ready()).toBe(true);
    } finally {
      delete (env as any).GOOGLE_MERCHANT_CENTER_API_VERSION;
    }
  });
});
