import { env } from '../../lib/env.js';
import type {
  AccessLevel,
  GoogleAdsAccount,
  GoogleAnalyticsProperty,
  GoogleBusinessAccount,
  GoogleTagManagerContainer,
  GoogleSearchConsoleSite,
  GoogleMerchantCenterAccount,
  GooglePlatformProductId,
  OffboardingItemClassification,
} from '@agency-platform/shared';
import { GOOGLE_PRODUCT_OAUTH_REQUIREMENTS } from '@agency-platform/shared';
import { BaseConnector, type NormalizedTokenResponse } from './base.connector.js';

/**
 * Unified Google OAuth Connector
 *
 * Handles OAuth 2.0 flow for all Google products using a single authorization.
 * After connecting, agencies can access all their Google accounts:
 * - Google Ads
 * - Google Analytics (GA4)
 * - Google Business Profile
 * - Google Tag Manager
 * - Google Search Console
 * - Google Merchant Center
 *
 * Documentation: https://developers.google.com/identity/protocols/oauth2
 */

export const MERCHANT_ACCOUNTS_V1_BASE_URL =
  'https://merchantapi.googleapis.com/accounts/v1';

export function isMerchantV1Ready(): boolean {
  return env.GOOGLE_MERCHANT_CENTER_API_VERSION === 'v1';
}

export function evaluateOffboardingScopeReadiness(
  grantedScopes: ReadonlySet<string>,
  productId: GooglePlatformProductId
): OffboardingItemClassification {
  const requirement = GOOGLE_PRODUCT_OAUTH_REQUIREMENTS[productId];
  if (!requirement || requirement.managementScopes.length === 0) {
    return 'eligible_automatic';
  }

  const hasAllManagementScopes = requirement.managementScopes.every((scope) =>
    grantedScopes.has(scope)
  );

  return hasAllManagementScopes ? 'eligible_automatic' : 'reconnect_required';
}

/**
 * Build Google Ads API request headers.
 * Single owner for the Ads header shape used by the Ads connector and the
 * offboarding flows: Bearer token, developer-token, JSON content type, and
 * the optional login-customer-id for manager-account context.
 */
export function buildAdsHeaders(
  accessToken: string,
  developerToken: string,
  loginCustomerId?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };

  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  return headers;
}

/**
 * Strip the customers/ resource prefix and any non-digit characters
 * (e.g. dashes) from a Google Ads customer id. Single owner for the
 * digit-only normalization used across Ads connectors and services.
 */
export function normalizeCustomerId(customerId: string): string {
  return customerId.replace(/^customers\//, '').replace(/\D/g, '');
}

/**
 * Fetch the Google OAuth profile for an access token (query-param form).
 * Single owner for the Google userinfo request shared by all Google
 * product connectors.
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
}> {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google user info fetch failed: ${error}`);
  }

  return (await response.json()) as {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
}

// Union type for all Google product accounts
export type GoogleProductAccount =
  | GoogleAdsAccount
  | GoogleAnalyticsProperty
  | GoogleBusinessAccount
  | GoogleTagManagerContainer
  | GoogleSearchConsoleSite
  | GoogleMerchantCenterAccount;

// Combined result with all available accounts
export interface GoogleAccountsResponse {
  adsAccounts: GoogleAdsAccount[];
  analyticsProperties: GoogleAnalyticsProperty[];
  businessAccounts: GoogleBusinessAccount[];
  tagManagerContainers: GoogleTagManagerContainer[];
  searchConsoleSites: GoogleSearchConsoleSite[];
  merchantCenterAccounts: GoogleMerchantCenterAccount[];
  hasAccess: boolean;
}

export type GoogleProduct =
  | 'google_ads'
  | 'ga4'
  | 'google_business_profile'
  | 'google_tag_manager'
  | 'google_search_console'
  | 'google_merchant_center';

export class GoogleConnector extends BaseConnector {
  constructor() {
    super('google');
  }

  // All Google products share one OAuth client (the "google" platform group),
  // so the per-platform env lookup in BaseConnector must map to the shared keys.
  // Empty string (not a throw) preserves the historic tolerance for an
  // unconfigured client id.
  protected override getClientId(): string {
    return env.GOOGLE_CLIENT_ID || '';
  }

  protected override getClientSecret(): string {
    return env.GOOGLE_CLIENT_SECRET || '';
  }

  normalizeResponse(data: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }): NormalizedTokenResponse {
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  private appendPageToken(url: string, pageToken?: string): string {
    if (!pageToken) {
      return url;
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}pageToken=${encodeURIComponent(pageToken)}`;
  }

  private normalizeGoogleAdsCustomerId(value: string | number | undefined | null): string {
    if (value === undefined || value === null) {
      return '';
    }

    return String(value).replace(/^customers\//, '').replace(/-/g, '');
  }

  private formatGoogleAdsCustomerId(customerId: string): string {
    if (customerId.length !== 10) {
      return customerId;
    }

    return `${customerId.slice(0, 3)}-${customerId.slice(3, 6)}-${customerId.slice(6)}`;
  }

  private normalizeGoogleAdsCustomerStatus(status: string | null | undefined): string {
    return status?.trim().toUpperCase() || 'UNKNOWN';
  }

  private isSelectableGoogleAdsCustomerStatus(status: string | null | undefined): boolean {
    return this.normalizeGoogleAdsCustomerStatus(status) === 'ENABLED';
  }

  private parseGoogleAdsError(errorText: string): { message: string; code?: string } {
    try {
      const errorJson = JSON.parse(errorText);
      const googleAdsError = errorJson.error?.details?.[0]?.errors?.[0];
      const errorCode = googleAdsError?.errorCode
        ? Object.values(googleAdsError.errorCode).find(Boolean)
        : undefined;
      const detailMessage = googleAdsError?.message;
      const message = detailMessage || errorJson.error?.message || errorText.substring(0, 200);

      return {
        message,
        ...(typeof errorCode === 'string' ? { code: errorCode } : {}),
      };
    } catch {
      return { message: errorText.substring(0, 200) };
    }
  }

  /**
   * Verify token is still valid
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=${accessToken}`,
        { method: 'GET' }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get user info from Google OAuth
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    return getGoogleUserInfo(accessToken);
  }

  /**
   * Fetch all available Google accounts across all products
   */
  async getAllGoogleAccounts(accessToken: string): Promise<GoogleAccountsResponse> {
    const result: GoogleAccountsResponse = {
      adsAccounts: [],
      analyticsProperties: [],
      businessAccounts: [],
      tagManagerContainers: [],
      searchConsoleSites: [],
      merchantCenterAccounts: [],
      hasAccess: false,
    };

    const [
      adsResult,
      analyticsResult,
      businessResult,
      tagManagerResult,
      searchConsoleResult,
      merchantResult,
    ] = await Promise.allSettled([
      this.getAdsAccounts(accessToken).catch(() => ({ accounts: [] })),
      this.getAnalyticsProperties(accessToken).catch(() => ({ properties: [] })),
      this.getBusinessLocations(accessToken).catch(() => ({ accounts: [] })),
      this.getTagManagerContainers(accessToken).catch(() => ({ containers: [] })),
      this.getSearchConsoleSites(accessToken).catch(() => ({ sites: [] })),
      this.getMerchantCenterAccounts(accessToken).catch(() => ({ accounts: [] })),
    ]);

    if (adsResult.status === 'fulfilled' && adsResult.value.accounts.length > 0) {
      result.adsAccounts = adsResult.value.accounts;
      result.hasAccess = true;
    }

    if (analyticsResult.status === 'fulfilled' && analyticsResult.value.properties.length > 0) {
      result.analyticsProperties = analyticsResult.value.properties;
      result.hasAccess = true;
    }

    if (businessResult.status === 'fulfilled' && businessResult.value.accounts.length > 0) {
      result.businessAccounts = businessResult.value.accounts;
      result.hasAccess = true;
    }

    if (tagManagerResult.status === 'fulfilled' && tagManagerResult.value.containers.length > 0) {
      result.tagManagerContainers = tagManagerResult.value.containers;
      result.hasAccess = true;
    }

    if (searchConsoleResult.status === 'fulfilled' && searchConsoleResult.value.sites.length > 0) {
      result.searchConsoleSites = searchConsoleResult.value.sites;
      result.hasAccess = true;
    }

    if (merchantResult.status === 'fulfilled' && merchantResult.value.accounts.length > 0) {
      result.merchantCenterAccounts = merchantResult.value.accounts;
      result.hasAccess = true;
    }

    return result;
  }

  /**
   * Per-product account fetch. Unquoted-key table — walker-safe (card 5 U8).
   */
  async getAccountsForProduct(
    product: GoogleProduct,
    accessToken: string
  ): Promise<GoogleProductAccount[]> {
    const fetchers: Record<GoogleProduct, () => Promise<GoogleProductAccount[]>> = {
      google_ads: async () => (await this.getAdsAccounts(accessToken)).accounts,
      ga4: async () => (await this.getAnalyticsProperties(accessToken)).properties,
      google_business_profile: async () => (await this.getBusinessLocations(accessToken)).accounts,
      google_tag_manager: async () => (await this.getTagManagerContainers(accessToken)).containers,
      google_search_console: async () => (await this.getSearchConsoleSites(accessToken)).sites,
      google_merchant_center: async () => (await this.getMerchantCenterAccounts(accessToken)).accounts,
    };

    return fetchers[product]();
  }

  /**
   * Fetch Google Ads accounts with names using a 3-phase parallel strategy:
   *
   * Phase 1 — Direct parallel queries (no login-customer-id):
   *   For each accessible customer, query its own customer resource. Works for
   *   accounts the authenticated user has direct OAuth access to.
   *
   * Phase 2 — Hierarchy queries (self-as-login):
   *   For each account not yet resolved by Phase 1, run a customer_client
   *   hierarchy query with that account's own ID as login-customer-id. This
   *   resolves sub-accounts when the queried customer is a manager (MCC).
   *
   * Phase 3 — Cross-login fallback:
   *   For any still-unresolved accounts, cycle through every accessible customer
   *   ID as a potential login-customer-id and retry the direct query. This handles
   *   sub-accounts that are only reachable through a specific manager.
   */
  private async getAdsAccounts(accessToken: string): Promise<{ accounts: GoogleAdsAccount[] }> {
    try {
      console.log('🔍 Starting Google Ads account fetch...');
      const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
      const configuredLoginCustomerId = this.normalizeGoogleAdsCustomerId(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

      if (!developerToken) {
        console.warn('GOOGLE_ADS_DEVELOPER_TOKEN not configured - Google Ads accounts will not be available');
        return { accounts: [] };
      }

      const listResponse = await fetch(
        'https://googleads.googleapis.com/v22/customers:listAccessibleCustomers',
        {
          method: 'GET',
          headers: buildAdsHeaders(accessToken, developerToken, configuredLoginCustomerId || undefined),
        }
      );

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        let errorMessage = errorText;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
          }
        } catch {
          // Ignore JSON parse failures.
        }

        console.error('Google Ads API error (listAccessibleCustomers):', {
          status: listResponse.status,
          error: errorMessage.substring(0, 500),
        });
        return { accounts: [] };
      }

      const listData = (await listResponse.json()) as { resourceNames?: string[] };

      if (!listData.resourceNames || listData.resourceNames.length === 0) {
        console.log('No accessible Google Ads accounts found');
        return { accounts: [] };
      }

      const customerIds = listData.resourceNames.map((resourceName) =>
        this.normalizeGoogleAdsCustomerId(resourceName.split('/').pop() || resourceName)
      );
      const accessibleCustomerIds = new Set(customerIds);

      console.log(`📋 Found ${customerIds.length} accessible Google Ads account(s):`, customerIds);

      const accountMap = new Map<string, GoogleAdsAccount>();
      const managerIds = new Set<string>();
      const unresolvedErrors = new Map<string, string[]>();

      const appendError = (customerId: string, msg: string) => {
        const errs = unresolvedErrors.get(customerId) || [];
        errs.push(msg);
        unresolvedErrors.set(customerId, errs);
      };

      // Allow upgrading a fallback-named entry to a real name discovered in a later phase.
      const recordAccount = (
        customerId: string,
        descriptiveName: string | null | undefined,
        isManager: boolean,
        nameSource: 'hierarchy' | 'direct' | 'fallback',
        customerStatus?: string | null
      ): boolean => {
        if (!customerId) return false;
        const existing = accountMap.get(customerId);
        const resolvedName = descriptiveName?.trim();
        // Skip if we already have a real name, or if we have any entry and new name is also empty.
        if (existing && existing.nameSource !== 'fallback') return false;
        if (existing && !resolvedName) return false;
        const formattedId = this.formatGoogleAdsCustomerId(customerId);
        const normalizedStatus = this.normalizeGoogleAdsCustomerStatus(customerStatus);
        accountMap.set(customerId, {
          id: customerId,
          name: resolvedName || `Google Ads account • ${formattedId}`,
          formattedId,
          isManager,
          nameSource: resolvedName ? nameSource : 'fallback',
          type: 'google_ads',
          status: normalizedStatus,
        });
        if (isManager) {
          managerIds.add(customerId);
        }
        return true;
      };

      const directCustomerQuery =
        'SELECT customer.id, customer.descriptive_name, customer.manager, customer.status FROM customer LIMIT 1';
      const hierarchyCustomerQuery =
        'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level, customer_client.status FROM customer_client WHERE customer_client.level <= 1';
      const managerLinkQuery =
        'SELECT customer_manager_link.manager_customer, customer_manager_link.status FROM customer_manager_link WHERE customer_manager_link.status = ACTIVE';

      // Helper: run a GAQL search, returning parsed results or null on failure.
      const runGaqlSearch = async <T>(
        queryCustomerId: string,
        query: string,
        loginCustomerId?: string
      ): Promise<T[] | null> => {
        try {
          const resp = await fetch(
            `https://googleads.googleapis.com/v22/customers/${queryCustomerId}/googleAds:search`,
            {
              method: 'POST',
              headers: buildAdsHeaders(accessToken, developerToken, loginCustomerId),
              body: JSON.stringify({ query }),
            }
          );
          if (!resp.ok) {
            const errText = await resp.text();
            const parsed = this.parseGoogleAdsError(errText);
            appendError(
              queryCustomerId,
              `GAQL(login=${loginCustomerId || 'none'}) ${resp.status}: ${parsed.message.substring(0, 200)}`
            );
            return null;
          }
          const data = (await resp.json()) as { results?: T[] };
          return data.results || [];
        } catch (err) {
          appendError(
            queryCustomerId,
            `GAQL exception: ${err instanceof Error ? err.message : String(err)}`
          );
          return null;
        }
      };

      // Helper: REST GET /v22/customers/{id} — different access path from GAQL search.
      // For accounts where the user is a direct member, this endpoint may succeed even
      // when GAQL fails due to missing login-customer-id context.
      const getCustomerRest = async (
        customerId: string,
        loginCustomerId?: string
      ): Promise<{ descriptiveName?: string; manager?: boolean; status?: string } | null> => {
        try {
          const resp = await fetch(
            `https://googleads.googleapis.com/v22/customers/${customerId}`,
            {
              method: 'GET',
              headers: buildAdsHeaders(accessToken, developerToken, loginCustomerId),
            }
          );
          if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            const parsed = this.parseGoogleAdsError(errText);
            appendError(
              customerId,
              `REST-GET(login=${loginCustomerId || 'none'}) ${resp.status}: ${parsed.message.substring(0, 200)}`
            );
            return null;
          }
          const body = (await resp.json()) as { descriptiveName?: string; manager?: boolean; status?: string };
          console.log(
            `[REST-GET ${customerId}(login=${loginCustomerId || 'none'})] 200 → ${JSON.stringify(body).substring(0, 300)}`
          );
          return body;
        } catch (err) {
          appendError(customerId, `REST-GET exception: ${err instanceof Error ? err.message : String(err)}`);
          return null;
        }
      };

      // ── Phase 0b: Discover parent managers via customer_manager_link ─────────
      // For accounts still unresolved, query the manager link resource to find the
      // parent MCC ID. This GAQL query may fail with the same 403, but if it
      // succeeds it gives us external manager IDs to use as login candidates.
      const externalManagerIds = new Set<string>();
      const needsManagerDiscovery = customerIds.filter(
        (id) => !accountMap.has(id) || accountMap.get(id)?.nameSource === 'fallback'
      );

      if (needsManagerDiscovery.length > 0) {
        await Promise.all(
          needsManagerDiscovery.map(async (customerId) => {
            const results = await runGaqlSearch<{
              customerManagerLink?: { managerCustomer?: string; status?: string };
            }>(customerId, managerLinkQuery);

            if (!results) return;

            for (const result of results) {
              const managerResource = result.customerManagerLink?.managerCustomer;
              if (!managerResource) continue;
              const managerId = this.normalizeGoogleAdsCustomerId(
                managerResource.split('/').pop() || managerResource
              );
              if (managerId && !accessibleCustomerIds.has(managerId)) {
                externalManagerIds.add(managerId);
                console.log(`🔗 Discovered external manager ${managerId} for account ${customerId}`);
              }
            }
          })
        );
      }

      // ── Phase 0: REST GET — also pass through Phase 0 REST handler ─────────
      await Promise.all(
        customerIds.map(async (customerId) => {
          let data = await getCustomerRest(customerId);
          if (!data) {
            data = await getCustomerRest(customerId, customerId);
          }
          if (data) {
            recordAccount(customerId, data.descriptiveName, Boolean(data.manager), 'direct', data.status);
          }
        })
      );

      // ── Phase 1: Direct parallel GAQL queries (no login-customer-id) ─────────
      await Promise.all(
        customerIds.map(async (customerId) => {
          if (accountMap.get(customerId)?.nameSource !== 'fallback' && accountMap.has(customerId)) return;

          const results = await runGaqlSearch<{
            customer?: { id?: string | number; descriptiveName?: string; manager?: boolean; status?: string };
          }>(customerId, directCustomerQuery);

          if (results !== null && results.length === 0) {
            console.log(`[Phase1-GAQL ${customerId}(no-login)] 200 OK but empty results`);
          } else if (results && results.length > 0) {
            console.log(`[Phase1-GAQL ${customerId}(no-login)] 200 OK → ${JSON.stringify(results[0]).substring(0, 200)}`);
          }

          if (!results) return;

          for (const result of results) {
            const c = result.customer;
            if (!c) continue;
            const id = this.normalizeGoogleAdsCustomerId(c.id);
            if (id && accessibleCustomerIds.has(id)) {
              recordAccount(id, c.descriptiveName, Boolean(c.manager), 'direct', c.status);
            }
          }
        })
      );

      // ── Phase 1.5: Direct GAQL query with self-as-login ─────────────────────
      // For manager accounts and standalone accounts, using the account's OWN ID
      // as login-customer-id unlocks customer.descriptive_name even when querying
      // without any login fails silently with empty results.
      await Promise.all(
        customerIds.map(async (customerId) => {
          const current = accountMap.get(customerId);
          if (current && current.nameSource !== 'fallback') return;

          const results = await runGaqlSearch<{
            customer?: { id?: string | number; descriptiveName?: string; manager?: boolean; status?: string };
          }>(customerId, directCustomerQuery, customerId); // login = self

          if (results !== null && results.length === 0) {
            console.log(`[Phase1.5-GAQL ${customerId}(self-login)] 200 OK but empty results`);
          } else if (results && results.length > 0) {
            console.log(`[Phase1.5-GAQL ${customerId}(self-login)] 200 OK → ${JSON.stringify(results[0]).substring(0, 200)}`);
          }

          if (!results) return;

          for (const result of results) {
            const c = result.customer;
            if (!c) continue;
            const id = this.normalizeGoogleAdsCustomerId(c.id);
            if (id && accessibleCustomerIds.has(id)) {
              recordAccount(id, c.descriptiveName, Boolean(c.manager), 'direct', c.status);
            }
          }
        })
      );

      // ── Phase 2: Hierarchy queries (self-as-login) ───────────────────────────
      // Run customer_client hierarchy queries for all accounts not yet fully resolved.
      // If an account is a manager, this will also resolve its sub-accounts.
      const hierarchyCandidates = new Set<string>([
        ...customerIds.filter((id) => !accountMap.has(id) || accountMap.get(id)?.nameSource === 'fallback'),
        ...(configuredLoginCustomerId ? [configuredLoginCustomerId] : []),
      ]);

      await Promise.all(
        Array.from(hierarchyCandidates).map(async (candidateId) => {
          const results = await runGaqlSearch<{
            customerClient?: {
              id?: string | number;
              descriptiveName?: string;
              manager?: boolean;
              level?: number;
              status?: string;
            };
          }>(candidateId, hierarchyCustomerQuery, candidateId);

          if (!results) return;

          for (const result of results) {
            const c = result.customerClient;
            if (!c) continue;
            const id = this.normalizeGoogleAdsCustomerId(c.id);
            if (id && accessibleCustomerIds.has(id)) {
              recordAccount(id, c.descriptiveName, Boolean(c.manager), 'hierarchy', c.status);
            }
          }
        })
      );

      // ── Phase 3: Cross-login fallback ────────────────────────────────────────
      // For any still-unresolved (or fallback-named) accounts, try every login
      // candidate: discovered external managers (the most likely fix), then known
      // accessible IDs and the configured agency MCC.
      const stillUnresolved = customerIds.filter(
        (id) => !accountMap.has(id) || accountMap.get(id)?.nameSource === 'fallback'
      );

      if (stillUnresolved.length > 0) {
        const loginCandidates = Array.from(
          new Set(
            [
              // External managers discovered via customer_manager_link — highest priority
              ...Array.from(externalManagerIds),
              configuredLoginCustomerId,
              ...Array.from(managerIds),
              ...customerIds,
            ].filter(Boolean)
          )
        );

        await Promise.all(
          stillUnresolved.map(async (targetId) => {
            for (const loginId of loginCandidates) {
              const current = accountMap.get(targetId);
              if (current && current.nameSource !== 'fallback') break;
              if (loginId === targetId) continue;

              const results = await runGaqlSearch<{
                customer?: { id?: string | number; descriptiveName?: string; manager?: boolean; status?: string };
              }>(targetId, directCustomerQuery, loginId);

              if (!results) continue;

              for (const result of results) {
                const c = result.customer;
                if (!c) continue;
                const id = this.normalizeGoogleAdsCustomerId(c.id);
                if (id && accessibleCustomerIds.has(id)) {
                  recordAccount(id, c.descriptiveName, Boolean(c.manager), 'direct', c.status);
                }
              }
            }
          })
        );
      }

      // ── Build final accounts list (active only) ───────────────────────────────
      // Exclude CANCELLED and SUSPENDED accounts — these are inaccessible and
      // should not appear in either the agency asset manager or the client wizard.
      const allResolved: GoogleAdsAccount[] = customerIds.map((customerId) => {
        const existing = accountMap.get(customerId);
        if (existing) return existing;

        const formattedId = this.formatGoogleAdsCustomerId(customerId);
        console.warn('Google Ads account name unresolved after all discovery phases', {
          customerId,
          formattedId,
          errors: unresolvedErrors.get(customerId) || [],
        });

        return {
          id: customerId,
          name: `Google Ads account • ${formattedId}`,
          formattedId,
          isManager: false,
          nameSource: 'fallback' as const,
          type: 'google_ads' as const,
          status: 'UNKNOWN',
        };
      });

      const accounts = allResolved.filter((account) =>
        this.isSelectableGoogleAdsCustomerStatus(account.status)
      );
      const filteredAccounts = allResolved.filter(
        (account) => !this.isSelectableGoogleAdsCustomerStatus(account.status)
      );
      const unknownFilteredCount = filteredAccounts.filter(
        (account) => this.normalizeGoogleAdsCustomerStatus(account.status) === 'UNKNOWN'
      ).length;

      console.log(
        `✅ Google Ads fetch complete: ${accounts.length} active account(s) (${filteredAccounts.length} inactive filtered out, ${unknownFilteredCount} unknown)`
      );
      accounts.forEach((a) => console.log(`  📦 ${a.id}: "${a.name}" [${a.nameSource}] [${a.status}]`));
      filteredAccounts.forEach((account) =>
        console.log(`  🚫 Filtered ${account.id}: "${account.name}" [${account.nameSource}] [${account.status}]`)
      );

      return { accounts };
    } catch (error) {
      console.error('Failed to fetch Google Ads accounts:', error);
      return { accounts: [] };
    }
  }

  /**
   * Fetch Google Analytics (GA4) properties
   */
  private async getAnalyticsProperties(
    accessToken: string
  ): Promise<{ properties: GoogleAnalyticsProperty[] }> {
    try {
      const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn('Google Analytics Admin API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 300),
        });
        return { properties: [] };
      }

      const data = (await response.json()) as {
        accountSummaries?: Array<{
          account?: string;
          displayName?: string;
          propertySummaries?: Array<{
            property?: string;
            displayName?: string;
          }>;
        }>;
      };

      const properties: GoogleAnalyticsProperty[] = [];

      for (const accountSummary of data.accountSummaries || []) {
        const accountId = accountSummary.account?.split('/').pop() || '';
        const accountName = accountSummary.displayName || `Account ${accountId}`;

        for (const propSummary of accountSummary.propertySummaries || []) {
          const propertyId = propSummary.property?.split('/').pop() || '';
          properties.push({
            id: propertyId,
            name: propSummary.property || '',
            displayName: propSummary.displayName || `Property ${propertyId}`,
            type: 'ga4',
            accountName,
          });
        }
      }

      return { properties };
    } catch (error) {
      console.error('Failed to fetch Google Analytics properties:', error);
      return { properties: [] };
    }
  }

  /**
   * Fetch Google Business Profile locations.
   */
  private async getBusinessLocations(
    accessToken: string
  ): Promise<{ accounts: GoogleBusinessAccount[] }> {
    try {
      const businessAccounts: Array<{ name: string; accountName?: string }> = [];
      let nextAccountsPageToken: string | undefined;

      do {
        const response = await fetch(
          this.appendPageToken(
            'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
            nextAccountsPageToken
          ),
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 429) {
            console.warn('Google Business Profile API rate limited (429). Will retry on next request.');
            return { accounts: [] };
          }

          console.warn('Google Business Profile API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText.substring(0, 200),
          });
          return { accounts: [] };
        }

        const data = (await response.json()) as {
          accounts?: Array<{
            name: string;
            accountName?: string;
            type?: string;
          }>;
          nextPageToken?: string;
        };

        businessAccounts.push(...(data.accounts || []));
        nextAccountsPageToken = data.nextPageToken;
      } while (nextAccountsPageToken);

      const locationResponses = await Promise.all(
        businessAccounts.map(async (account) => {
          try {
            const locations: GoogleBusinessAccount[] = [];
            let nextLocationsPageToken: string | undefined;

            do {
              const response = await fetch(
                this.appendPageToken(
                  `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
                  nextLocationsPageToken
                ),
                {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );

              if (!response.ok) {
                const errorText = await response.text();
                console.warn('Google Business Profile locations API error:', {
                  status: response.status,
                  statusText: response.statusText,
                  error: errorText.substring(0, 200),
                  account: account.name,
                });
                return [];
              }

              const data = (await response.json()) as {
                locations?: Array<{
                  name: string;
                  title?: string;
                }>;
                nextPageToken?: string;
              };

              locations.push(
                ...(data.locations || []).map((location) => ({
                  id: location.name?.split('/').pop() || '',
                  name: location.title || location.name,
                  type: 'google_business' as const,
                  accountName: account.accountName || account.name,
                }))
              );

              nextLocationsPageToken = data.nextPageToken;
            } while (nextLocationsPageToken);

            return locations;
          } catch (error) {
            console.warn(`Failed to fetch locations for GBP account ${account.name}:`, error);
            return [];
          }
        })
      );

      return { accounts: locationResponses.flat() };
    } catch (error) {
      console.error('Failed to fetch Google Business Profile accounts:', error);
      return { accounts: [] };
    }
  }

  /**
   * Fetch Google Tag Manager containers
   */
  private async getTagManagerContainers(
    accessToken: string
  ): Promise<{ containers: GoogleTagManagerContainer[] }> {
    try {
      const accountsResponse = await fetch(
        'https://www.googleapis.com/tagmanager/v2/accounts',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.warn('Google Tag Manager API error (accounts):', {
          status: accountsResponse.status,
          statusText: accountsResponse.statusText,
          error: errorText.substring(0, 200),
        });
        return { containers: [] };
      }

      const accountsData = (await accountsResponse.json()) as {
        account?: Array<{
          accountId: string;
          name: string;
        }>;
      };

      const containerArrays = await Promise.all(
        (accountsData.account || []).map(async (account) => {
          try {
            const containersResponse = await fetch(
              `https://www.googleapis.com/tagmanager/v2/accounts/${account.accountId}/containers`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (!containersResponse.ok) {
              return [];
            }

            const containersData = (await containersResponse.json()) as {
              container?: Array<{
                containerId: string;
                name: string;
              }>;
            };

            return (containersData.container || []).map((container) => ({
              id: container.containerId,
              name: container.name,
              type: 'google_tag_manager' as const,
              accountId: account.accountId,
              accountName: account.name,
            }));
          } catch (error) {
            console.warn(`Failed to fetch containers for GTM account ${account.accountId}:`, error);
            return [];
          }
        })
      );

      return { containers: containerArrays.flat() };
    } catch (error) {
      console.error('Failed to fetch Google Tag Manager containers:', error);
      return { containers: [] };
    }
  }

  /**
   * Fetch Google Search Console sites
   */
  private async getSearchConsoleSites(
    accessToken: string
  ): Promise<{ sites: GoogleSearchConsoleSite[] }> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/webmasters/v3/sites',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Google Search Console API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200),
        });
        return { sites: [] };
      }

      const data = (await response.json()) as {
        siteEntry?: Array<{
          siteUrl: string;
          permissionLevel?: string;
        }>;
      };

      const sites: GoogleSearchConsoleSite[] = (data.siteEntry || []).map((site) => ({
        id: site.siteUrl,
        url: site.siteUrl,
        type: 'google_search_console',
        permissionLevel: site.permissionLevel || 'unknown',
      }));

      return { sites };
    } catch (error) {
      console.error('Failed to fetch Google Search Console sites:', error);
      return { sites: [] };
    }
  }

  /**
   * Fetch Google Merchant Center accounts
   */
  private async getMerchantCenterAccounts(
    accessToken: string
  ): Promise<{ accounts: GoogleMerchantCenterAccount[] }> {
    try {
      const response = await fetch(
        'https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Google Merchant Center API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200),
        });
        return { accounts: [] };
      }

      const data = (await response.json()) as {
        accountIdentifiers?: Array<{
          merchantId?: string | number;
        }>;
      };

      const merchantIds = (data.accountIdentifiers || [])
        .map((account) => String(account.merchantId || ''))
        .filter(Boolean);

      const accountMap = new Map<string, GoogleMerchantCenterAccount>();

      await Promise.all(
        merchantIds.map(async (merchantId) => {
          try {
            const detailResponse = await fetch(
              `https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/accounts/${merchantId}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (detailResponse.ok) {
              const detail = (await detailResponse.json()) as {
                id?: string | number;
                name?: string;
                websiteUrl?: string;
              };

              const id = String(detail.id || merchantId);
              accountMap.set(id, {
                id,
                name: detail.name || `Merchant Center ${id}`,
                type: 'google_merchant_center',
                websiteUrl: detail.websiteUrl,
              });
            }
          } catch (error) {
            console.warn(`Failed to fetch Merchant Center account detail for ${merchantId}:`, error);
          }

          try {
            const listResponse = await fetch(
              `https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/accounts`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (listResponse.ok) {
              const listData = (await listResponse.json()) as {
                resources?: Array<{
                  id?: string | number;
                  name?: string;
                  websiteUrl?: string;
                }>;
              };

              for (const account of listData.resources || []) {
                const id = String(account.id || '');
                if (!id) {
                  continue;
                }

                accountMap.set(id, {
                  id,
                  name: account.name || `Merchant Center ${id}`,
                  type: 'google_merchant_center',
                  websiteUrl: account.websiteUrl,
                });
              }
            }
          } catch (error) {
            console.warn(`Failed to list Merchant Center sub-accounts for ${merchantId}:`, error);
          }

          if (!accountMap.has(merchantId)) {
            accountMap.set(merchantId, {
              id: merchantId,
              name: `Merchant Center ${merchantId}`,
              type: 'google_merchant_center',
            });
          }
        })
      );

      return { accounts: Array.from(accountMap.values()) };
    } catch (error) {
      console.error('Failed to fetch Google Merchant Center accounts:', error);
      return { accounts: [] };
    }
  }
}

// Export singleton instance
export const googleConnector = new GoogleConnector();
