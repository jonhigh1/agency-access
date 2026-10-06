import { env } from '../../lib/env.js';
import { META_GRAPH_VERSION } from '../../lib/meta-constants.js';
import { metaGraphGet, META_GRAPH_TIMEOUT_MS } from '../../lib/meta-graph-request.js';
import { metaGraphFetch } from '../../lib/meta-graph-instrumentation.js';
import { logger } from '../../lib/logger.js';
import {
  META_PERMISSION_CONTRACT,
  sanitizeMetaOAuthScopes,
  type AccessLevel,
  type MetaAdAccount,
  type MetaAllAssets,
  type MetaInstagramAccount,
  type MetaPage,
  type MetaProductCatalog,
} from '@agency-platform/shared';

/**
 * Meta (Facebook) OAuth Connector
 *
 * Handles OAuth 2.0 flow for Meta platforms (Facebook, Instagram, WhatsApp)
 *
 * Documentation: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 */

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface MetaLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface MetaTokens {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  expiresAt?: Date;
}

interface MetaDebugTokenResponse {
  data?: {
    app_id?: string;
    type?: string;
    application?: string;
    data_access_expires_at?: number;
    expires_at?: number;
    is_valid?: boolean;
    scopes?: string[];
    user_id?: string;
  };
}

export class MetaGraphMutationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly metaCode?: number,
    readonly metaSubcode?: number,
  ) {
    super(message);
    this.name = 'MetaGraphMutationError';
  }
}

async function throwMetaMutationError(response: Response, operation: string): Promise<never> {
  const body = await response.text();
  let payload: { error?: { message?: string; code?: number; error_subcode?: number } } = {};
  try {
    payload = JSON.parse(body);
  } catch {
    // Preserve HTTP status even when Meta returns a non-JSON error body.
  }
  throw new MetaGraphMutationError(
    `Meta ${operation} failed: ${payload.error?.message || body}`,
    response.status,
    payload.error?.code,
    payload.error?.error_subcode,
  );
}

export class MetaConnector {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;

  static readonly DEFAULT_SCOPES = [...META_PERMISSION_CONTRACT.core.permissions];

  constructor() {
    this.appId = env.META_APP_ID;
    this.appSecret = env.META_APP_SECRET;
    // Use agency-platforms callback for production (redirects to frontend)
    // For testing, use /api/oauth/meta/callback in Meta app settings
    this.redirectUri = `${env.API_URL}/agency-platforms/meta/callback`;
  }

  private async getGraphCollection<T>(url: string, accessToken: string, failure: string): Promise<T[]> {
    const items: T[] = [];
    let nextUrl: string | null = url;
    const visitedUrls = new Set<string>();

    while (nextUrl) {
      if (visitedUrls.has(nextUrl)) throw new Error('Meta returned a repeated pagination URL');
      visitedUrls.add(nextUrl);
      const response = await metaGraphGet(nextUrl, accessToken);
      if (!response.ok) {
        const body = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
        throw new Error(`${failure} ${response.status}: ${body}`);
      }
      const payload = await response.json() as { data?: T[]; paging?: { next?: string } };
      items.push(...(payload.data || []));
      const next = payload.paging?.next;
      if (next && new URL(next).origin !== 'https://graph.facebook.com') {
        throw new Error('Meta returned an invalid pagination URL');
      }
      nextUrl = next || null;
    }
    return items;
  }

  /**
   * Generate OAuth authorization URL
   *
   * Uses Meta Marketing API permissions (NOT Facebook Login permissions).
   * Default scopes are for ads management, business management, and Page selection.
   *
   * @param state - CSRF protection token (should be stored in session/database)
   * @param scopes - Marketing API permissions to request
   * @param redirectUri - Optional override for redirect URI (used in client flow)
   * @returns Authorization URL to redirect user to
   */
  getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri ?? this.redirectUri,
      state,
      response_type: 'code',
    });

    // Always request explicit Marketing API scopes from code so consent matches
    // META_PERMISSION_CONTRACT. Do not use Login for Business config_id alone —
    // Meta dashboard configs can include permissions (e.g. catalog_management)
    // outside the current App Review scope.
    const scopesToUse = sanitizeMetaOAuthScopes(scopes ?? MetaConnector.DEFAULT_SCOPES);
    params.set('scope', scopesToUse.join(','));

    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for short-lived access token
   *
   * @param code - Authorization code from OAuth callback
   * @param redirectUri - Optional override for redirect URI (must match getAuthUrl)
   * @returns Short-lived access token (expires in ~2 hours)
   */
  async exchangeCode(code: string, redirectUri?: string): Promise<MetaTokens> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri ?? this.redirectUri,
      code,
    });

    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`,
      { method: 'GET', signal: AbortSignal.timeout(META_GRAPH_TIMEOUT_MS), redirect: 'error' }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta token exchange failed: ${error}`);
    }

    const data = (await response.json()) as MetaTokenResponse;

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  /**
   * Exchange short-lived token for long-lived token
   *
   * Meta best practice: Always exchange for long-lived tokens (60 days)
   *
   * @param shortLivedToken - Short-lived access token from exchangeCode
   * @returns Long-lived access token (expires in ~60 days)
   */
  async getLongLivedToken(shortLivedToken: string): Promise<MetaTokens> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`,
      { method: 'GET', signal: AbortSignal.timeout(META_GRAPH_TIMEOUT_MS), redirect: 'error' }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta long-lived token exchange failed: ${error}`);
    }

    const data = (await response.json()) as MetaLongLivedTokenResponse;

    const expiresIn = Number(data.expires_in);

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
      expiresAt: Number.isFinite(expiresIn)
        ? new Date(Date.now() + expiresIn * 1000)
        : undefined,
    };
  }

  /**
   * Refresh access token (NOT SUPPORTED BY META)
   *
   * Meta does not support token refresh via refresh_token.
   * Instead, Meta uses long-lived tokens valid for 60 days.
   * When tokens expire, the user must re-authorize via OAuth flow.
   *
   * For token refresh, use the token refresh job to detect expiring tokens
   * and prompt users to re-authorize before expiration.
   *
   * @throws Error - Always throws as this is not supported
   */
  async refreshToken(_refreshToken: string): Promise<MetaTokens> {
    throw new Error(
      'Meta does not support token refresh via refresh_token. ' +
      'Meta uses long-lived tokens valid for 60 days. ' +
      'When tokens expire, the user must re-authorize via OAuth flow. ' +
      'Use getLongLivedToken() during initial authorization to get 60-day tokens.'
    );
  }

  /**
   * Get user info from Meta Graph API
   *
   * Note: With Marketing API permissions, email is NOT available.
   * For agency use cases, you should fetch business and ad account info instead.
   *
   * @param accessToken - Valid Meta access token
   * @returns User profile data (id, name - email not available with Marketing API)
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string;
    name: string;
  }> {
    const response = await metaGraphGet(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name`, accessToken
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta user info fetch failed: ${error}`);
    }

    return (await response.json()) as { id: string; name: string };
  }

  /**
   * Fetch token metadata from Meta's debug_token endpoint.
   * Single owner for the Graph debug_token request shared by verifyToken
   * and getTokenMetadata.
   */
  private async fetchDebugToken(accessToken: string): Promise<MetaDebugTokenResponse> {
    const params = new URLSearchParams({
      input_token: accessToken,
    });

    const response = await metaGraphGet(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token?${params.toString()}`,
      `${this.appId}|${this.appSecret}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta debug_token fetch failed: ${error}`);
    }

    return (await response.json()) as MetaDebugTokenResponse;
  }

  /**
   * Verify token is still valid
   *
   * @param accessToken - Token to verify
   * @returns Whether token is valid
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const data = await this.fetchDebugToken(accessToken);
      return data.data?.is_valid === true;
    } catch {
      return false;
    }
  }

  async getTokenMetadata(accessToken: string): Promise<{
    scopes: string[];
    expiresAt?: Date;
    dataAccessExpiresAt?: Date;
    userId?: string;
    isValid: boolean;
  }> {
    const data = await this.fetchDebugToken(accessToken);
    const payload = data.data;

    return {
      scopes: payload?.scopes || [],
      expiresAt: payload?.expires_at ? new Date(payload.expires_at * 1000) : undefined,
      dataAccessExpiresAt: payload?.data_access_expires_at
        ? new Date(payload.data_access_expires_at * 1000)
        : undefined,
      userId: payload?.user_id,
      isValid: payload?.is_valid === true,
    };
  }

  /**
   * Revoke access token (when user disconnects)
   *
   * @param accessToken - Token to revoke
   */
  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/permissions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: accessToken }).toString(),
      signal: AbortSignal.timeout(META_GRAPH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { code?: number } } | null;
      if (payload?.error?.code === 190) return;
      throw new Error('Meta app permission revocation failed');
    }

    if (await response.json() !== true) throw new Error('Meta did not confirm app permission revocation');
  }

  /**
   * Get all Meta Business Manager accounts for the agency
   *
   * Fetches all Business Manager accounts the agency has access to.
   * This is used to display available businesses in the UI after connection.
   *
   * @param accessToken - Valid Meta access token
   * @returns Business Manager accounts with metadata
   */
  async getBusinessAccounts(accessToken: string): Promise<{
    businesses: Array<{
      id: string;
      name: string;
      verticalName?: string;
      verificationStatus?: string;
    }>;
    hasAccess: boolean;
  }> {
    const businesses: Array<{
      id: string;
      name: string;
      verticalName?: string;
      verificationStatus?: string;
    }> = [];

    const seenBusinessIds = new Set<string>();
    const recordBusiness = (business: {
      id?: string;
      name?: string;
      vertical_name?: string;
      verification_status?: string;
    }): boolean => {
      if (!business.id || !business.name || seenBusinessIds.has(business.id)) {
        return false;
      }

      seenBusinessIds.add(business.id);
      businesses.push({
        id: business.id,
        name: business.name,
        verticalName: business.vertical_name,
        verificationStatus: business.verification_status,
      });
      return true;
    };

    const fetchBusinessCollection = async (
      url: string,
      extractBusinesses: (payload: any) => Array<{
        id?: string;
        name?: string;
        vertical_name?: string;
        verification_status?: string;
      }>
    ): Promise<string[]> => {
      let nextUrl: string | null = url;
      const discoveredBusinessIds: string[] = [];
      const visitedUrls = new Set<string>();

      while (nextUrl) {
        if (visitedUrls.has(nextUrl)) throw new Error('Meta returned a repeated pagination URL');
        visitedUrls.add(nextUrl);
        if (new URL(nextUrl).origin !== 'https://graph.facebook.com') {
          throw new Error('Meta returned an invalid pagination URL');
        }
        const response = await metaGraphGet(nextUrl, accessToken);

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to fetch business accounts: ${error}`);
        }

        const data = await response.json() as {
          data?: unknown[];
          paging?: {
            next?: string;
          };
        };

        for (const business of extractBusinesses(data)) {
          if (recordBusiness(business) && business.id) {
            discoveredBusinessIds.push(business.id);
          }
        }

        nextUrl = data.paging?.next || null;
      }

      return discoveredBusinessIds;
    };

    await fetchBusinessCollection(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses?fields=id,name,vertical_name,verification_status`,
      (payload) => (payload.data || []) as Array<{
        id: string;
        name: string;
        vertical_name?: string;
        verification_status?: string;
      }>
    );

    try {
      await fetchBusinessCollection(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me/business_users?fields=business{id,name,verification_status}`,
        (payload) =>
          ((payload.data || []) as Array<{
            business?: {
              id?: string;
              name?: string;
              vertical_name?: string;
              verification_status?: string;
            };
          }>)
            .map((entry) => entry.business)
            .filter((business): business is {
              id?: string;
              name?: string;
              vertical_name?: string;
              verification_status?: string;
            } => Boolean(business))
      );
    } catch (error) {
      console.warn('Failed to fetch supplemental Meta business_users data; continuing with primary businesses list.', error);
    }

    return {
      businesses,
      hasAccess: businesses.length > 0,
    };
  }

  /**
   * Get ad accounts for a business
   */
  async getAdAccounts(accessToken: string, businessId: string): Promise<MetaAdAccount[]> {
    const fetchAccounts = async (edge: 'owned_ad_accounts' | 'client_ad_accounts') => {
      return this.getGraphCollection<{
          id: string;
          name: string;
          account_status: number;
          currency: string;
        }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/${edge}?fields=id,name,account_status,currency`, accessToken, 'Failed to fetch ad accounts');
    };
    const [owned, shared] = await Promise.all([
      fetchAccounts('owned_ad_accounts'),
      fetchAccounts('client_ad_accounts'),
    ]);
    const accounts = new Map<string, {
      id: string;
      name: string;
      account_status: number;
      currency: string;
      sharedWithBusiness?: true;
    }>();

    for (const account of owned) {
      accounts.set(account.id, account);
    }
    for (const account of shared) {
      accounts.set(account.id, { ...accounts.get(account.id), ...account, sharedWithBusiness: true });
    }

    return Array.from(accounts.values()).map((account) => ({
      id: account.id,
      name: account.name,
      accountStatus: account.account_status === 1 ? 'ACTIVE' : 'INACTIVE',
      currency: account.currency,
      ...(account.sharedWithBusiness ? { sharedWithBusiness: true as const } : {}),
    }));
  }

  /**
   * Get pages for a business
   */
  async getPages(accessToken: string, businessId: string): Promise<MetaPage[]> {
    const fetchPages = async (edge: 'owned_pages' | 'client_pages') => {
      return this.getGraphCollection<{
        id: string;
        name: string;
        category: string;
        tasks: string[];
      }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/${edge}?fields=id,name,category,tasks`, accessToken, `Failed to fetch ${edge}`);
    };

    const [ownedPages, clientPages] = await Promise.all([
      fetchPages('owned_pages'),
      fetchPages('client_pages'),
    ]);
    const pages = new Map<string, MetaPage>();

    for (const page of [...ownedPages, ...clientPages]) {
      const existing = pages.get(page.id);
      pages.set(page.id, {
        id: page.id,
        name: page.name,
        category: page.category,
        tasks: page.tasks?.length ? page.tasks : existing?.tasks || [],
      });
    }

    return Array.from(pages.values());
  }

  /**
   * Get Instagram accounts for a business
   */
  async getInstagramAccounts(accessToken: string, businessId: string): Promise<MetaInstagramAccount[]> {
    const data = await this.getGraphCollection<{
        id: string;
        username: string;
        profile_picture_url?: string;
      }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/instagram_accounts?fields=id,username,profile_picture_url`, accessToken, 'Failed to fetch Instagram accounts');

    return data.map((account) => ({
      id: account.id,
      username: account.username,
      profilePictureUrl: account.profile_picture_url,
    }));
  }

  async getClientInstagramAccounts(accessToken: string, businessId: string): Promise<MetaInstagramAccount[]> {
    const response = await metaGraphGet(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/client_instagram_assets?fields=id,ig_user_id,ig_username`, accessToken
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch client Instagram assets: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ id?: string; ig_user_id?: string; ig_username?: string }>;
    };
    return (data.data || [])
      .filter((asset): asset is { id: string; ig_user_id: string; ig_username: string } =>
        Boolean(asset.ig_user_id && asset.ig_username)
      )
      .map((asset) => ({ id: asset.ig_user_id, username: asset.ig_username }));
  }

  /**
   * Get product catalogs for a business
   */
  async getProductCatalogs(accessToken: string, businessId: string): Promise<MetaProductCatalog[]> {
    const fetchCatalogs = async (edge: 'owned_product_catalogs' | 'client_product_catalogs') => {
      try {
        return await this.getGraphCollection<{ id: string; name: string; catalog_type: string }>(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/${edge}?fields=id,name,catalog_type`, accessToken, `Failed to fetch Meta product catalogs: ${edge} returned`);
      } catch (error) {
        logger.warn('Failed to fetch Meta product catalogs', { businessId, edge });
        throw error;
      }
    };

    const [owned, client] = await Promise.all([
      fetchCatalogs('owned_product_catalogs'),
      fetchCatalogs('client_product_catalogs'),
    ]);
    return Array.from(new Map([...owned, ...client].map((catalog) => [catalog.id, {
      id: catalog.id,
      name: catalog.name,
      catalogType: catalog.catalog_type,
    }])).values());
  }

  /**
   * Get all assets for a business (composite)
   */
  async getAllAssets(accessToken: string, businessId: string): Promise<MetaAllAssets> {
    // Fetch business name first
    const businessResponse = await metaGraphGet(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}?fields=name`, accessToken
    );

    if (!businessResponse.ok) {
      const error = await businessResponse.text();
      throw new Error(`Failed to fetch business info: ${error}`);
    }

    const businessData = (await businessResponse.json()) as { name: string };

    // Fetch all assets in parallel
    const [adAccounts, pages, instagramAccounts, productCatalogs] = await Promise.all([
      this.getAdAccounts(accessToken, businessId),
      this.getPages(accessToken, businessId),
      this.getInstagramAccounts(accessToken, businessId),
      this.getProductCatalogs(accessToken, businessId),
    ]);

    return {
      businessId,
      businessName: businessData.name,
      adAccounts,
      pages,
      instagramAccounts,
      productCatalogs,
    };
  }

  /**
   * Legacy generic verification has no selected asset or recipient to read back.
   * Fail closed; Meta access must use the per-asset fulfillment verifier.
   */
  async verifyClientAccess(
    _agencyAccessToken: string,
    _businessId: string,
    _clientEmail: string,
    _requiredAccessLevel: AccessLevel
  ): Promise<{
    hasAccess: boolean;
    accessLevel: AccessLevel;
    businessName?: string;
    assets: Array<{
      type: 'ad_account' | 'page' | 'instagram_account';
      id: string;
      name: string;
      permissions: string[];
    }>;
    error?: string;
  }> {
    return {
      hasAccess: false,
      accessLevel: 'read_only',
      assets: [],
      error: 'Meta verification requires asset-specific assignment read-back; Business Portfolio identity alone is not proof of access.',
    };

  }

  /**
   * Create a new ad account within a Business Manager
   *
   * @param accessToken - Valid Meta access token with ads_management scope
   * @param businessId - Business Manager ID to create the ad account under
   * @param params - Ad account creation parameters
   * @returns Created ad account details
   */
  async createAdAccount(
    accessToken: string,
    businessId: string,
    params: {
      name: string;
      currency: string;
      timezoneId: string;
    }
  ): Promise<{
    id: string;
    name: string;
    currency: string;
    timezoneId: string;
    accountId: string;
  }> {
    const requestBody = new URLSearchParams({
      access_token: accessToken,
      name: params.name,
      currency: params.currency,
      timezone_id: params.timezoneId,
    });

    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/adaccounts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody.toString(),
      }
    );

    if (!response.ok) {
      await throwMetaMutationError(response, 'ad account creation');
    }

    const data = (await response.json()) as {
      id: string;
      name: string;
      currency: string;
      timezone_id: string;
      account_id: string;
    };

    return {
      id: data.id,
      name: data.name,
      currency: data.currency,
      timezoneId: data.timezone_id,
      accountId: data.account_id,
    };
  }

  /**
   * Create a new product catalog within a Business Manager
   *
   * @param accessToken - Valid Meta access token with catalog_management scope
   * @param businessId - Business Manager ID to create the catalog under
   * @param name - Product catalog name
   * @returns Created product catalog details
   */
  async createProductCatalog(
    accessToken: string,
    businessId: string,
    name: string
  ): Promise<{
    id: string;
    name: string;
    catalogType: string;
  }> {
    const requestBody = new URLSearchParams({
      access_token: accessToken,
      name: name,
    });

    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/product_catalogs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody.toString(),
      }
    );

    if (!response.ok) {
      await throwMetaMutationError(response, 'product catalog creation');
    }

    const data = (await response.json()) as {
      id: string;
      name: string;
      catalog_type: string;
    };

    return {
      id: data.id,
      name: data.name,
      catalogType: data.catalog_type,
    };
  }

  /**
   * List the user's own Facebook Pages (GET /me/accounts)
   * Used for the guided Page prerequisite check before Business creation
   *
   * @param accessToken - Valid Meta access token
   * @returns Pages the user administers
   */
  async getUserPages(
    accessToken: string
  ): Promise<Array<{ id: string; name: string; category?: string }>> {
    const response = await metaGraphGet(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,category`, accessToken
    );

    if (!response.ok) {
      const error = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(error);
      } catch {
        throw new Error(`Failed to fetch user pages: ${error}`);
      }
      throw new Error(`Failed to fetch user pages: ${parsedError.error?.message || error}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ id: string; name: string; category?: string }>;
    };

    return (data.data || []).map((page) => ({
      id: page.id,
      name: page.name,
      category: page.category,
    }));
  }

  /**
   * Create a Business Portfolio owned by the token's user
   * POST /me/businesses — requires business_management on the app and the user token
   * primary_page must be a Page the user administers; a Business cannot be deleted
   *
   * @param accessToken - Valid Meta access token with business_management scope
   * @param params - Business creation parameters
   * @returns Created business details
   */
  async createBusiness(
    accessToken: string,
    params: {
      name: string;
      vertical: string;
      primaryPageId: string;
      timezoneId: string;
    }
  ): Promise<{
    id: string;
    name: string;
    timezoneId: string;
  }> {
    const requestBody = new URLSearchParams({
      access_token: accessToken,
      name: params.name,
      vertical: params.vertical,
      primary_page: params.primaryPageId,
      timezone_id: params.timezoneId,
    });

    const response = await metaGraphFetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody.toString(),
        tokenClass: 'client_user',
      }
    );

    if (!response.ok) {
      await throwMetaMutationError(response, 'business creation');
    }

    const data = (await response.json()) as {
      id: string;
      name: string;
      timezone_id: string;
    };

    return {
      id: data.id,
      name: data.name,
      timezoneId: data.timezone_id,
    };
  }

  /**
   * Get the URL for creating a new Facebook Page within a Business Manager
   * This is a deep link to Meta's page creation flow
   *
   * @param businessId - Business Manager ID
   * @returns URL for page creation
   */
  getPageCreationUrl(businessId: string): string {
    return `https://business.facebook.com/pages/creation/?business_id=${businessId}`;
  }

  /**
   * Get the URL for creating a new Facebook Page as an end user
   * Used when a client has no Page at all — Pages cannot be created via the API
   *
   * @returns URL for page creation
   */
  getUserPageCreationUrl(): string {
    return 'https://www.facebook.com/pages/create/';
  }

  /**
   * Get the URL for verifying a Business (Security Center)
   * Required by Meta before an unverified business can spend on ads
   *
   * @param businessId - Business Manager ID
   * @returns URL for business verification
   */
  getBusinessVerificationUrl(businessId: string): string {
    return `https://business.facebook.com/settings/${businessId}/security_center`;
  }

  /**
   * Get the URL for managing a Business payment methods
   * Required by Meta before an ad account can spend
   *
   * @param businessId - Business Manager ID
   * @returns URL for payment settings
   */
  getPaymentMethodUrl(businessId: string): string {
    return `https://business.facebook.com/settings/${businessId}/payment`;
  }

  /**
   * Get the URL for creating a new Meta Pixel within a Business Manager
   * This is a deep link to Meta's Events Manager pixel creation flow
   *
   * @param businessId - Business Manager ID
   * @returns URL for pixel creation
   */
  getPixelCreationUrl(businessId: string): string {
    return `https://business.facebook.com/events_manager2/pixel/new/?business_id=${businessId}`;
  }

  /**
   * Get supported currencies for ad account creation
   * Common currencies used in Meta Ads
   *
   * @returns Array of supported currency codes
   */
  getSupportedCurrencies(): string[] {
    return [
      'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK',
      'DKK', 'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'INR', 'SGD', 'HKD',
      'TWD', 'KRW', 'THB', 'IDR', 'MYR', 'PHP', 'VND', 'PLN', 'TRY', 'ILS',
      'AED', 'SAR', 'ZAR', 'NGN', 'EGP', 'KES', 'RUB', 'UAH', 'CZK', 'HUF',
      'RON', 'BGN', 'HRK',
    ];
  }

  /**
   * Get supported timezone IDs for ad account creation
   * Common timezone IDs used in Meta Ads
   *
   * @returns Array of supported timezone IDs with names
   */
  getSupportedTimezones(): Array<{ id: string; name: string; offset: string }> {
    return [
      { id: '1', name: 'Pacific/Midway', offset: 'UTC-11' },
      { id: '5', name: 'Pacific/Honolulu', offset: 'UTC-10' },
      { id: '9', name: 'America/Anchorage', offset: 'UTC-9' },
      { id: '13', name: 'America/Los_Angeles', offset: 'UTC-8' },
      { id: '17', name: 'America/Denver', offset: 'UTC-7' },
      { id: '21', name: 'America/Chicago', offset: 'UTC-6' },
      { id: '25', name: 'America/New_York', offset: 'UTC-5' },
      { id: '29', name: 'America/Caracas', offset: 'UTC-4' },
      { id: '33', name: 'America/Sao_Paulo', offset: 'UTC-3' },
      { id: '37', name: 'Atlantic/South_Georgia', offset: 'UTC-2' },
      { id: '41', name: 'Atlantic/Azores', offset: 'UTC-1' },
      { id: '45', name: 'Europe/London', offset: 'UTC+0' },
      { id: '49', name: 'Europe/Paris', offset: 'UTC+1' },
      { id: '53', name: 'Europe/Berlin', offset: 'UTC+1' },
      { id: '57', name: 'Africa/Cairo', offset: 'UTC+2' },
      { id: '61', name: 'Europe/Moscow', offset: 'UTC+3' },
      { id: '65', name: 'Asia/Dubai', offset: 'UTC+4' },
      { id: '69', name: 'Asia/Karachi', offset: 'UTC+5' },
      { id: '73', name: 'Asia/Kolkata', offset: 'UTC+5:30' },
      { id: '77', name: 'Asia/Dhaka', offset: 'UTC+6' },
      { id: '81', name: 'Asia/Bangkok', offset: 'UTC+7' },
      { id: '85', name: 'Asia/Singapore', offset: 'UTC+8' },
      { id: '89', name: 'Asia/Tokyo', offset: 'UTC+9' },
      { id: '93', name: 'Australia/Sydney', offset: 'UTC+10' },
      { id: '97', name: 'Pacific/Noumea', offset: 'UTC+11' },
      { id: '101', name: 'Pacific/Auckland', offset: 'UTC+12' },
    ];
  }
}

// Export singleton instance
export const metaConnector = new MetaConnector();
