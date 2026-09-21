/**
 * ClientAssetsService
 *
 * Fetches client's platform assets using OAuth tokens stored in Infisical.
 * This is the simplified version that fetches assets for display purposes only,
 * NOT for partner access granting (which was removed in favor of standard OAuth).
 *
 * Usage Pattern:
 * 1. Get token from Infisical using PlatformAuthorization.secretId
 * 2. Call fetchMetaAssets(token) to get all assets
 * 3. Display assets to agency or client for informational purposes
 */

import { logger } from '../lib/logger.js';
import { META_GRAPH_VERSION } from '../lib/meta-constants.js';
import type { MetaPageEngagementProof } from '@agency-platform/shared';
import { MetaConnector } from './connectors/meta.js';

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency?: string;
  ownershipType?: 'owned' | 'client';
}

export interface MetaPage {
  id: string;
  name: string;
  category?: string;
  picture?: {
    data: {
      url: string;
    };
  };
  ownershipType?: 'owned' | 'client';
}

export interface MetaInstagramAccount {
  id: string;
  username: string;
  profile_picture_url?: string;
}

export interface MetaBusinessPortfolio {
  id: string;
  name: string;
  verticalName?: string;
  verificationStatus?: string;
}

export interface GoogleAdsAccount {
  id: string;
  name: string;
  status: string;
}

export interface LinkedInAdAccount {
  id: string;
  name: string;
  reference?: string;
  status?: string;
  type?: string;
}

export interface LinkedInPage {
  id: string;
  name: string;
  urn: string;
  vanityName?: string;
  type?: string;
}

export interface GA4Property {
  id: string;
  name: string;
  displayName: string;
  accountName: string;
}

export interface TikTokAdvertiser {
  id: string;
  name: string;
  status?: string;
  businessCenterId?: string;
  raw?: Record<string, any>;
}

export interface TikTokBusinessCenter {
  id: string;
  name: string;
  role?: string;
  raw?: Record<string, any>;
}

export interface TikTokBusinessCenterAssetGroup {
  bcId: string;
  advertisers: TikTokAdvertiser[];
}

export interface TikTokAssets {
  advertisers: TikTokAdvertiser[];
  businessCenters: TikTokBusinessCenter[];
  businessCenterAssets: TikTokBusinessCenterAssetGroup[];
}

export interface MetaAssets {
  adAccounts: MetaAdAccount[];
  pages: MetaPage[];
  instagramAccounts: MetaInstagramAccount[];
  businesses?: MetaBusinessPortfolio[];
  selectedBusinessId?: string;
  selectedBusinessName?: string;
  selectionRequired?: boolean;
}

export class MetaBusinessPortfolioUnavailableError extends Error {
  readonly code = 'INVALID_META_BUSINESS_PORTFOLIO';
  readonly statusCode = 400;

  constructor(message: string = 'Selected Meta business portfolio is not available for this client user') {
    super(message);
    this.name = 'MetaBusinessPortfolioUnavailableError';
  }
}

class ClientAssetsService {
  private readonly GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
  private readonly LINKEDIN_API_VERSION = '202601';

  private getLinkedInHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': this.LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    };
  }

  /**
   * Fetch Meta business portfolios and assets using business-scoped edges.
   *
   * @param accessToken - Client's OAuth access token (from Infisical)
   * @param businessId - Optional selected Business Portfolio ID
   * @returns Object containing arrays of ad accounts, pages, and Instagram accounts
   */
  async fetchMetaAssets(accessToken: string, businessId?: string): Promise<MetaAssets> {
    logger.info('Fetching Meta assets for client', { businessId: businessId || null });

    try {
      const connector = new MetaConnector();
      const businessAccountResult = await connector.getBusinessAccounts(accessToken);
      const businesses = businessAccountResult.businesses as MetaBusinessPortfolio[];

      const selectedBusiness = businessId
        ? businesses.find((business) => business.id === businessId)
        : businesses.length === 1
          ? businesses[0]
          : undefined;

      if (businessId && !selectedBusiness) {
        throw new MetaBusinessPortfolioUnavailableError();
      }

      const businessIdsToFetch = selectedBusiness
        ? [selectedBusiness.id]
        : businesses.map((business) => business.id);

      const scopedAssets = await Promise.all(
        businessIdsToFetch.map((portfolioId) =>
          this.fetchMetaAssetsForBusiness(accessToken, portfolioId)
        )
      );

      const adAccounts = this.mergeById(scopedAssets.flatMap((assets) => assets.adAccounts));
      const pages = this.mergeById(scopedAssets.flatMap((assets) => assets.pages));
      const instagramAccounts = this.mergeById(
        scopedAssets.flatMap((assets) => assets.instagramAccounts)
      );

      logger.info('Successfully fetched Meta assets', {
        adAccountCount: adAccounts.length,
        pageCount: pages.length,
        instagramAccountCount: instagramAccounts.length,
      });

      return {
        adAccounts,
        pages,
        instagramAccounts,
        businesses,
        selectedBusinessId: selectedBusiness?.id,
        selectedBusinessName: selectedBusiness?.name,
        selectionRequired: !selectedBusiness && businesses.length > 1,
      };
    } catch (error) {
      logger.error('Failed to fetch Meta assets', { error });
      if (error instanceof MetaBusinessPortfolioUnavailableError) {
        throw error;
      }
      throw new Error(
        `Failed to fetch Meta assets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async fetchPageEngagementProof(
    accessToken: string,
    pageId: string
  ): Promise<MetaPageEngagementProof> {
    const pageUrl = new URL(`${this.GRAPH_API_BASE}/${pageId}`);
    pageUrl.searchParams.set('fields', 'id,name,access_token');
    pageUrl.searchParams.set('access_token', accessToken);

    const pageResponse = await fetch(pageUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!pageResponse.ok) {
      const error = await pageResponse.text();
      throw new Error(`Meta Page access lookup failed: ${error}`);
    }

    const page = (await pageResponse.json()) as {
      id?: string;
      name?: string;
      access_token?: string;
    };

    if (!page?.id || !page.name || !page.access_token) {
      throw new Error('Meta did not return a Page access token for the selected Page');
    }

    const feedUrl = new URL(`${this.GRAPH_API_BASE}/${pageId}/feed`);
    feedUrl.searchParams.set('fields', 'id,message,created_time');
    feedUrl.searchParams.set('limit', '3');
    feedUrl.searchParams.set('access_token', page.access_token);

    const feedResponse = await fetch(feedUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!feedResponse.ok) {
      const error = await feedResponse.text();
      throw new Error(`Meta Page content access failed: ${error}`);
    }

    const feedData = (await feedResponse.json()) as {
      data?: Array<{ id?: string; message?: string; created_time?: string }>;
    };

    return {
      page: { id: page.id, name: page.name },
      posts: (feedData.data || [])
        .filter((post): post is { id: string; message?: string; created_time?: string } => Boolean(post.id))
        .map((post) => ({
          id: post.id,
          ...(post.message ? { message: post.message } : {}),
          ...(post.created_time ? { createdTime: post.created_time } : {}),
        })),
    };
  }

  private mergeById<T extends { id: string }>(items: T[]): T[] {
    return Array.from(new Map(items.map((item) => [item.id, item])).values());
  }

  private async fetchMetaAssetsForBusiness(
    accessToken: string,
    businessId: string
  ): Promise<Pick<MetaAssets, 'adAccounts' | 'pages' | 'instagramAccounts'>> {
    const [adAccounts, pages, instagramAccounts] = await Promise.all([
      this.fetchBusinessAdAccounts(accessToken, businessId),
      this.fetchBusinessPages(accessToken, businessId),
      this.fetchBusinessInstagramAccounts(accessToken, businessId),
    ]);

    return {
      adAccounts,
      pages,
      instagramAccounts,
    };
  }

  private async fetchBusinessCollection<T>(
    accessToken: string,
    businessId: string,
    edge: string
  ): Promise<T[]> {
    const url = `${this.GRAPH_API_BASE}/${businessId}/${edge}&access_token=${accessToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta API error (${edge}): ${error}`);
    }

    const data = (await response.json()) as { data?: T[] };
    return data.data || [];
  }

  private async fetchOptionalBusinessCollection<T>(
    accessToken: string,
    businessId: string,
    edge: string
  ): Promise<T[]> {
    try {
      return await this.fetchBusinessCollection<T>(accessToken, businessId, edge);
    } catch (error) {
      logger.warn(`Failed to fetch Meta ${edge} for business ${businessId}`, { error });
      return [];
    }
  }

  private async fetchBusinessAdAccounts(
    accessToken: string,
    businessId: string
  ): Promise<MetaAdAccount[]> {
    try {
      const [ownedAccounts, clientAccounts] = await Promise.all([
        this.fetchBusinessCollection<{
          id: string;
          name: string;
          account_status: number;
          currency?: string;
        }>(
          accessToken,
          businessId,
          'owned_ad_accounts?fields=id,name,account_status,currency'
        ),
        this.fetchOptionalBusinessCollection<{
          id: string;
          name: string;
          account_status: number;
          currency?: string;
        }>(
          accessToken,
          businessId,
          'client_ad_accounts?fields=id,name,account_status,currency'
        ),
      ]);

      return this.mergeById([
        ...ownedAccounts.map((account) => ({ ...account, ownershipType: 'owned' as const })),
        ...clientAccounts.map((account) => ({ ...account, ownershipType: 'client' as const })),
      ]);
    } catch (error) {
      logger.error('Failed to fetch business-scoped ad accounts', { error, businessId });
      return [];
    }
  }

  private async fetchBusinessPages(
    accessToken: string,
    businessId: string
  ): Promise<MetaPage[]> {
    try {
      const [ownedPages, clientPages] = await Promise.all([
        this.fetchBusinessCollection<{
          id: string;
          name: string;
          category?: string;
        }>(
          accessToken,
          businessId,
          'owned_pages?fields=id,name,category'
        ),
        this.fetchOptionalBusinessCollection<{
          id: string;
          name: string;
          category?: string;
        }>(
          accessToken,
          businessId,
          'client_pages?fields=id,name,category'
        ),
      ]);

      return this.mergeById([
        ...ownedPages.map((page) => ({ ...page, ownershipType: 'owned' as const })),
        ...clientPages.map((page) => ({ ...page, ownershipType: 'client' as const })),
      ]);
    } catch (error) {
      logger.error('Failed to fetch business-scoped pages', { error, businessId });
      return [];
    }
  }

  private async fetchBusinessInstagramAccounts(
    accessToken: string,
    businessId: string
  ): Promise<MetaInstagramAccount[]> {
    try {
      return await this.fetchBusinessCollection<MetaInstagramAccount>(
        accessToken,
        businessId,
        'instagram_accounts?fields=id,username,profile_picture_url'
      );
    } catch (error) {
      logger.warn(`Failed to fetch Instagram accounts for business ${businessId}`, { error });
      return [];
    }
  }

  /**
   * Fetch client's Meta ad accounts
   *
   * @param accessToken - Client's OAuth access token
   * @returns Array of ad accounts with id, name, status, and currency
   * @private
   */
  private async fetchAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
    try {
      const url = `${this.GRAPH_API_BASE}/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Meta API error (ad accounts): ${error}`);
      }

      const data: any = await response.json();
      return data.data || [];
    } catch (error) {
      logger.error('Failed to fetch ad accounts', { error });
      // Return empty array on error - don't fail entire fetch
      return [];
    }
  }

  /**
   * Fetch client's Meta pages (Facebook Pages)
   *
   * @param accessToken - Client's OAuth access token
   * @returns Array of pages with id, name, and profile picture
   * @private
   */
  private async fetchPages(accessToken: string): Promise<MetaPage[]> {
    try {
      const url = `${this.GRAPH_API_BASE}/me/accounts?fields=id,name,picture&access_token=${accessToken}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Meta API error (pages): ${error}`);
      }

      const data: any = await response.json();
      return data.data || [];
    } catch (error) {
      logger.error('Failed to fetch pages', { error });
      // Return empty array on error - don't fail entire fetch
      return [];
    }
  }

  /**
   * Fetch client's Instagram Business accounts
   *
   * This is a two-step process:
   * 1. Get businesses the user owns/manages
   * 2. For each business, fetch connected Instagram accounts
   *
   * @param accessToken - Client's OAuth access token
   * @returns Array of Instagram accounts with id, username, and profile picture
   * @private
   */
  private async fetchInstagramAccounts(accessToken: string): Promise<MetaInstagramAccount[]> {
    try {
      // Step 1: Get businesses
      const businessesUrl = `${this.GRAPH_API_BASE}/me/businesses?fields=id,name&access_token=${accessToken}`;
      const businessesResponse = await fetch(businessesUrl);

      if (!businessesResponse.ok) {
        const error = await businessesResponse.text();
        throw new Error(`Meta API error (businesses): ${error}`);
      }

      const businessesData: any = await businessesResponse.json();
      const businesses = businessesData.data || [];

      if (businesses.length === 0) {
        return [];
      }

      // Step 2: Fetch Instagram accounts for each business in parallel
      const instagramAccountsPromises = businesses.map(async (business: { id: string }) => {
        const igUrl = `${this.GRAPH_API_BASE}/${business.id}/instagram_accounts?fields=id,username,profile_picture_url&access_token=${accessToken}`;
        const igResponse = await fetch(igUrl);

        if (!igResponse.ok) {
          logger.warn(`Failed to fetch Instagram accounts for business ${business.id}`);
          return [];
        }

        const igData: any = await igResponse.json();
        return igData.data || [];
      });

      const instagramAccountsArrays = await Promise.all(instagramAccountsPromises);

      // Flatten arrays and deduplicate by ID
      const allAccounts: any[] = instagramAccountsArrays.flat();
      const uniqueAccounts = Array.from(
        new Map(allAccounts.map((account: any) => [account.id, account])).values()
      ) as MetaInstagramAccount[];

      return uniqueAccounts;
    } catch (error) {
      logger.error('Failed to fetch Instagram accounts', { error });
      // Return empty array on error - don't fail entire fetch
      return [];
    }
  }

  /**
   * Fetch accessible Google Ads accounts
   * Note: This method is deprecated - use GoogleConnector.getAdsAccounts instead
   * which properly handles the developer token header
   */
  async fetchGoogleAdsAccounts(accessToken: string): Promise<GoogleAdsAccount[]> {
    try {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      if (!developerToken) {
        logger.warn('GOOGLE_ADS_DEVELOPER_TOKEN not configured');
        return [];
      }

      const response = await fetch(
        'https://googleads.googleapis.com/v22/customers:listAccessibleCustomers',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': developerToken,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Ads API error: ${error}`);
      }

      const data = (await response.json()) as any;
      const resourceNames = data.resourceNames || [];

      return resourceNames.map((name: string) => {
        const id = name.split('/').pop() || name;
        return {
          id,
          name: `Account ${id}`,
          status: 'active',
        };
      });
    } catch (error) {
      logger.error('Failed to fetch Google Ads accounts', { error });
      return [];
    }
  }

  async fetchLinkedInAdAccounts(accessToken: string): Promise<LinkedInAdAccount[]> {
    try {
      const response = await fetch('https://api.linkedin.com/rest/adAccounts', {
        method: 'GET',
        headers: this.getLinkedInHeaders(accessToken),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LinkedIn API error (ad accounts): ${error}`);
      }

      const data = (await response.json()) as { elements?: Array<Record<string, unknown>> };

      return (data.elements || []).map((account) => ({
        id: String(account.id ?? ''),
        name: String(account.name ?? account.id ?? 'LinkedIn ad account'),
        ...(account.reference ? { reference: String(account.reference) } : {}),
        ...(account.status ? { status: String(account.status) } : {}),
        ...(account.type ? { type: String(account.type) } : {}),
      }));
    } catch (error) {
      logger.error('Failed to fetch LinkedIn ad accounts', { error });
      throw new Error(
        `Failed to fetch LinkedIn ad accounts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async fetchLinkedInPages(accessToken: string): Promise<LinkedInPage[]> {
    try {
      const organizationUrns = await this.fetchLinkedInOrganizationUrns(accessToken);
      if (organizationUrns.length === 0) {
        return [];
      }

      const organizationIds = Array.from(
        new Set(
          organizationUrns
            .map((urn) => urn.split(':').pop() || '')
            .filter(Boolean)
        )
      );

      const pages = await Promise.allSettled(
        organizationIds.map((organizationId) =>
          this.fetchLinkedInOrganization(accessToken, organizationId)
        )
      );

      const fulfilledPages = pages
        .filter(
          (result): result is PromiseFulfilledResult<LinkedInPage> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value);

      if (fulfilledPages.length === 0 && organizationIds.length > 0) {
        throw new Error('Failed to fetch LinkedIn organization details');
      }

      const failedCount = pages.filter((result) => result.status === 'rejected').length;
      if (failedCount > 0) {
        logger.warn('LinkedIn page discovery completed with partial organization lookup failures', {
          requestedOrganizationCount: organizationIds.length,
          returnedPageCount: fulfilledPages.length,
          failedCount,
        });
      }

      return fulfilledPages;
    } catch (error) {
      logger.error('Failed to fetch LinkedIn pages', { error });
      throw new Error(
        `Failed to fetch LinkedIn pages: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async fetchLinkedInOrganizationUrns(accessToken: string): Promise<string[]> {
    const urns = new Set<string>();
    let start = 0;
    const count = 100;

    while (true) {
      const url = new URL('https://api.linkedin.com/rest/organizationAcls');
      url.searchParams.set('q', 'roleAssignee');
      // rw_organization_admin is scoped to organizations where the member is an ADMINISTRATOR.
      url.searchParams.set('role', 'ADMINISTRATOR');
      url.searchParams.set('state', 'APPROVED');
      url.searchParams.set('count', String(count));
      url.searchParams.set('start', String(start));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getLinkedInHeaders(accessToken),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LinkedIn API error (organization ACLs): ${error}`);
      }

      const data = (await response.json()) as {
        elements?: Array<Record<string, unknown>>;
        paging?: { count?: number; start?: number; total?: number };
      };

      for (const entry of data.elements || []) {
        const organizationTarget = entry.organizationTarget ?? entry.organization;
        if (typeof organizationTarget === 'string' && organizationTarget.length > 0) {
          urns.add(organizationTarget);
        }
      }

      const pageCount = data.paging?.count ?? count;
      const total = data.paging?.total ?? urns.size;
      start += pageCount;

      if (start >= total || (data.elements?.length ?? 0) < pageCount) {
        break;
      }
    }

    return Array.from(urns);
  }

  private async fetchLinkedInOrganization(
    accessToken: string,
    organizationId: string
  ): Promise<LinkedInPage> {
    const response = await fetch(`https://api.linkedin.com/rest/organizations/${organizationId}`, {
      method: 'GET',
      headers: this.getLinkedInHeaders(accessToken),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LinkedIn organization ${organizationId} lookup failed: ${error}`);
    }

    const organization = (await response.json()) as Record<string, unknown>;
    const id = String(organization.id ?? organizationId);
    const name = String(
      organization.localizedName ??
        organization.name ??
        organization.vanityName ??
        `LinkedIn Page ${id}`
    );

    return {
      id,
      name,
      urn: `urn:li:organization:${id}`,
      ...(organization.vanityName ? { vanityName: String(organization.vanityName) } : {}),
      ...(organization.primaryOrganizationType
        ? { type: String(organization.primaryOrganizationType) }
        : {}),
    };
  }

  /**
   * Fetch accessible GA4 properties
   */
  async fetchGA4Properties(accessToken: string): Promise<GA4Property[]> {
    try {
      const response = await fetch(
        `https://analyticsadmin.googleapis.com/v1beta/accountSummaries?access_token=${accessToken}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GA4 API error: ${error}`);
      }

      const data = (await response.json()) as any;
      const properties: GA4Property[] = [];

      for (const accountSummary of data.accountSummaries || []) {
        const accountName = accountSummary.displayName || 'Unknown Account';
        for (const propSummary of accountSummary.propertySummaries || []) {
          const id = propSummary.property?.split('/').pop() || '';
          properties.push({
            id,
            name: propSummary.property || '',
            displayName: propSummary.displayName || `Property ${id}`,
            accountName,
          });
        }
      }

      return properties;
    } catch (error) {
      logger.error('Failed to fetch GA4 properties', { error });
      return [];
    }
  }

  // ==========================================================================
  // NEW PLATFORM ASSET FETCHING (Mailchimp, Pinterest, Klaviyo, Shopify, TikTok)
  // ==========================================================================

  /**
   * Fetch Mailchimp assets (lists/audiences and campaigns)
   *
   * @param accessToken - Client's OAuth access token
   * @param dc - Data center prefix (e.g., "us12") from metadata
   * @returns Object containing arrays of lists and campaigns
   */
  async fetchMailchimpAssets(accessToken: string, dc: string): Promise<{
    lists: any[];
    campaigns: any[];
  }> {
    logger.info('Fetching Mailchimp assets');

    try {
      const baseUrl = `https://${dc}.api.mailchimp.com/3.0/`;

      // Fetch lists (audiences)
      const listsResponse = await fetch(`${baseUrl}lists?count=100`, {
        headers: { 'Authorization': `OAuth ${accessToken}` },
      });

      // Fetch campaigns
      const campaignsResponse = await fetch(`${baseUrl}campaigns?count=100`, {
        headers: { 'Authorization': `OAuth ${accessToken}` },
      });

      const listsData = await listsResponse.json() as any;
      const campaignsData = await campaignsResponse.json() as any;

      logger.info('Successfully fetched Mailchimp assets', {
        listCount: listsData.lists?.length || 0,
        campaignCount: campaignsData.campaigns?.length || 0,
      });

      return {
        lists: listsData.lists || [],
        campaigns: campaignsData.campaigns || [],
      };
    } catch (error) {
      logger.error('Failed to fetch Mailchimp assets', { error });
      return { lists: [], campaigns: [] };
    }
  }

  /**
   * Fetch Pinterest ad accounts
   *
   * @param accessToken - Client's OAuth access token
   * @returns Object containing arrays of ad accounts
   */
  async fetchPinterestAssets(accessToken: string): Promise<{
    adAccounts: any[];
  }> {
    logger.info('Fetching Pinterest assets');

    try {
      // Fetch ad accounts
      const adAccountsResponse = await fetch('https://api.pinterest.com/v5/ad_accounts', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      const adAccountsData = await adAccountsResponse.json() as any;

      logger.info('Successfully fetched Pinterest assets', {
        adAccountCount: adAccountsData.items?.length || 0,
      });

      return {
        adAccounts: adAccountsData.items || [],
      };
    } catch (error) {
      logger.error('Failed to fetch Pinterest assets', { error });
      return { adAccounts: [] };
    }
  }

  /**
   * Fetch Klaviyo assets (lists and campaigns)
   *
   * @param accessToken - Client's OAuth access token
   * @returns Object containing arrays of lists and campaigns
   */
  async fetchKlaviyoAssets(accessToken: string): Promise<{
    lists: any[];
    campaigns: any[];
  }> {
    logger.info('Fetching Klaviyo assets');

    try {
      const baseUrl = 'https://a.klaviyo.com/api/';

      // Fetch lists (audiences)
      const listsResponse = await fetch(`${baseUrl}lists/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      // Fetch campaigns
      const campaignsResponse = await fetch(`${baseUrl}campaigns/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      const listsData = await listsResponse.json() as any;
      const campaignsData = await campaignsResponse.json() as any;

      logger.info('Successfully fetched Klaviyo assets', {
        listCount: listsData.data?.length || 0,
        campaignCount: campaignsData.data?.length || 0,
      });

      return {
        lists: listsData.data || [],
        campaigns: campaignsData.data || [],
      };
    } catch (error) {
      logger.error('Failed to fetch Klaviyo assets', { error });
      return { lists: [], campaigns: [] };
    }
  }

  /**
   * Fetch Shopify store information
   *
   * @param accessToken - Client's OAuth access token
   * @param shop - Shop name (e.g., "my-store" from my-store.myshopify.com)
   * @returns Object containing store metrics
   */
  async fetchShopifyAssets(accessToken: string, shop: string): Promise<{
    products: number;
    orders: number;
    customers: number;
    shop: string;
  }> {
    logger.info('Fetching Shopify assets');

    try {
      const baseUrl = `https://${shop}.myshopify.com/admin/api/2024-01/`;

      // Fetch products count
      const productsResponse = await fetch(`${baseUrl}products/count.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });

      // Fetch orders count
      const ordersResponse = await fetch(`${baseUrl}orders/count.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });

      // Fetch customers count
      const customersResponse = await fetch(`${baseUrl}customers/count.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });

      const productsData = await productsResponse.json() as any;
      const ordersData = await ordersResponse.json() as any;
      const customersData = await customersResponse.json() as any;

      logger.info('Successfully fetched Shopify assets', {
        products: productsData.count || 0,
        orders: ordersData.count || 0,
        customers: customersData.count || 0,
      });

      return {
        products: productsData.count || 0,
        orders: ordersData.count || 0,
        customers: customersData.count || 0,
        shop,
      };
    } catch (error) {
      logger.error('Failed to fetch Shopify assets', { error });
      return { products: 0, orders: 0, customers: 0, shop };
    }
  }

  /**
   * Fetch TikTok advertisers and Business Center assets.
   *
   * @param accessToken - Client's OAuth access token
   * @returns Normalized TikTok asset model for UI selection
   */
  async fetchTikTokAssets(accessToken: string): Promise<TikTokAssets> {
    logger.info('Fetching TikTok assets');

    try {
      const [advertisers, businessCenters] = await Promise.all([
        this.fetchTikTokAdvertisers(accessToken),
        this.fetchTikTokBusinessCenters(accessToken),
      ]);

      const businessCenterAssets = await Promise.all(
        businessCenters.map(async (bc) => ({
          bcId: bc.id,
          advertisers: await this.fetchTikTokBusinessCenterAdvertisers(accessToken, bc.id),
        }))
      );

      logger.info('Successfully fetched TikTok assets', {
        advertiserCount: advertisers.length,
        businessCenterCount: businessCenters.length,
        businessCenterAssetGroups: businessCenterAssets.length,
      });

      return {
        advertisers,
        businessCenters,
        businessCenterAssets,
      };
    } catch (error) {
      logger.error('Failed to fetch TikTok assets', { error });
      return {
        advertisers: [],
        businessCenters: [],
        businessCenterAssets: [],
      };
    }
  }

  private async fetchTikTokAdvertisers(accessToken: string): Promise<TikTokAdvertiser[]> {
    try {
      const response = await fetch(
        'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
        {
          method: 'GET',
          headers: {
            'Access-Token': accessToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`TikTok advertiser API failed (${response.status})`);
      }

      const payload = await response.json() as any;
      if (payload?.code && payload.code !== 0) {
        throw new Error(payload?.message || 'TikTok advertiser API returned non-zero code');
      }

      const list = Array.isArray(payload?.data?.list) ? payload.data.list : [];
      return list.map((item: any) => ({
        id: String(item.advertiser_id ?? item.id ?? ''),
        name: item.advertiser_name ?? item.name ?? String(item.advertiser_id ?? item.id ?? ''),
        status: item.status,
        raw: item,
      })).filter((item: TikTokAdvertiser) => Boolean(item.id));
    } catch (error) {
      logger.error('Failed to fetch TikTok advertisers', { error });
      return [];
    }
  }

  private async fetchTikTokBusinessCenters(accessToken: string): Promise<TikTokBusinessCenter[]> {
    try {
      const response = await fetch(
        'https://business-api.tiktok.com/open_api/v1.3/bc/get/',
        {
          method: 'GET',
          headers: {
            'Access-Token': accessToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`TikTok business center API failed (${response.status})`);
      }

      const payload = await response.json() as any;
      if (payload?.code && payload.code !== 0) {
        throw new Error(payload?.message || 'TikTok business center API returned non-zero code');
      }

      const list = Array.isArray(payload?.data?.list) ? payload.data.list : [];
      return list.map((item: any) => ({
        id: String(item.bc_id ?? item.business_center_id ?? item.id ?? ''),
        name: item.name ?? item.bc_name ?? String(item.bc_id ?? item.business_center_id ?? item.id ?? ''),
        role: item.role,
        raw: item,
      })).filter((item: TikTokBusinessCenter) => Boolean(item.id));
    } catch (error) {
      logger.error('Failed to fetch TikTok business centers', { error });
      return [];
    }
  }

  private async fetchTikTokBusinessCenterAdvertisers(
    accessToken: string,
    bcId: string
  ): Promise<TikTokAdvertiser[]> {
    try {
      const url = new URL('https://business-api.tiktok.com/open_api/v1.3/bc/asset/get/');
      url.searchParams.set('bc_id', bcId);
      url.searchParams.set('asset_type', 'ADVERTISER');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Access-Token': accessToken,
        },
      });

      if (!response.ok) {
        throw new Error(`TikTok BC asset API failed (${response.status})`);
      }

      const payload = await response.json() as any;
      if (payload?.code && payload.code !== 0) {
        throw new Error(payload?.message || 'TikTok BC asset API returned non-zero code');
      }

      const list = Array.isArray(payload?.data?.list) ? payload.data.list : [];
      return list.map((item: any) => ({
        id: String(item.advertiser_id ?? item.asset_id ?? item.id ?? ''),
        name: item.advertiser_name ?? item.asset_name ?? item.name ?? String(item.advertiser_id ?? item.asset_id ?? item.id ?? ''),
        status: item.status,
        businessCenterId: bcId,
        raw: item,
      })).filter((item: TikTokAdvertiser) => Boolean(item.id));
    } catch (error) {
      logger.error('Failed to fetch TikTok business center assets', { error, bcId });
      return [];
    }
  }
}

export const clientAssetsService = new ClientAssetsService();
