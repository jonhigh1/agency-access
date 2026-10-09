import type { Platform } from '@agency-platform/shared';
import { metaConnector } from './meta.js';
import { googleAdsConnector } from './google-ads.js';
import { ga4Connector } from './ga4.js';
import { googleConnector } from './google.js';
import { linkedinConnector } from './linkedin.js';
import { beehiivConnector } from './beehiiv.js';
import { shopifyConnector } from './shopify.js';
import { tiktokConnector } from './tiktok.js';
import { snapchatConnector } from './snapchat.js';

// Export new hybrid architecture components
export { BaseConnector, ConnectorError } from './base.connector.js';
export type { NormalizedTokenResponse } from './base.connector.js';
export { PLATFORM_CONFIGS, getPlatformConfig } from './registry.config.js';

/**
 * ============================================================================
 * CONNECTOR FACTORY
 * ============================================================================
 *
 * Maps platform ids to connector instances. The key set is pinned to the
 * shared PLATFORMS registry (`connectorPlatformIds`, DEC-015 Phase 2b) by
 * __tests__/factory-completeness.test.ts — a platform missing here fails CI,
 * not the first request that needs it.
 *
 * Aliases: meta_ads / meta_pages / instagram share the Meta connector;
 * linkedin_ads / linkedin_pages, tiktok_ads, and snapchat_ads alias their
 * group connector. Google products have distinct connectors (google,
 * google_ads, ga4). Beehiiv is the api_key connector (cast stays until
 * review card 5 unifies the connector interface). Manual-invite platforms
 * (kit, zapier, mailchimp, pinterest, klaviyo) have no connector.
 *
 * ADDING A NEW PLATFORM:
 * 1. Add its descriptor to packages/shared/src/platforms/registry.ts
 *    (capabilities, oauth block, clientAuthorizable)
 * 2. Add env vars to apps/api/src/lib/env.ts
 * 3. OAuth transports feed registry.config automatically from the registry
 * 4. Create a connector (extend BaseConnector for standard OAuth 2.0) and
 *    register the instance below — the completeness pin enforces it
 *
 * @see apps/api/src/services/connectors/base.connector.ts
 * @see apps/api/src/services/connectors/registry.config.ts
 * ============================================================================
 */

/**
 * Platform Connector Interface
 *
 * Defines the contract that all platform connectors must implement.
 * Different platforms have different refresh capabilities:
 *
 * - Google Ads & GA4: Support refresh_token flow
 * - Meta: Uses 60-day long-lived tokens (no refresh, requires re-auth)
 * - TikTok/LinkedIn/Snapchat: To be implemented
 */
export interface PlatformConnector {
  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string;

  /**
   * Exchange authorization code for access tokens
   */
  exchangeCode(code: string, redirectUri?: string): Promise<any>;

  /**
   * Optional: Refresh access token using refresh token
   * Not supported by all platforms (e.g., Meta)
   */
  refreshToken?(refreshToken: string): Promise<any>;

  /**
   * Optional: Exchange short-lived token for long-lived token
   * Meta-specific (60-day tokens)
   */
  getLongLivedToken?(shortToken: string): Promise<any>;

  /** Optional provider-side token inspection; never return or persist token values. */
  getTokenMetadata?(accessToken: string): Promise<{
    scopes: string[];
    expiresAt?: Date;
    dataAccessExpiresAt?: Date;
    userId?: string;
    isValid: boolean;
  }>;

  /**
   * Verify token is still valid
   */
  verifyToken(accessToken: string): Promise<boolean>;

  /**
   * Get user info from platform
   */
  getUserInfo(accessToken: string): Promise<any>;

  /**
   * Optional: Verify agency has access to client's assets
   */
  verifyClientAccess?(
    agencyAccessToken: string,
    ...args: any[]
  ): Promise<any>;

  /**
   * Optional: Revoke token
   */
  revokeToken?(accessToken: string): Promise<void>;
}

/**
 * Platform Connector Registry
 *
 * Maps platform identifiers to their connector instances.
 * Key set pinned to the shared registry's connectorPlatformIds (DEC-015).
 */
export const CONNECTOR_REGISTRY: Partial<Record<Platform, PlatformConnector>> = {
  meta: metaConnector,
  meta_ads: metaConnector, // Alias for same connector
  meta_pages: metaConnector, // Alias for same connector
  instagram: metaConnector, // Alias for same connector
  google: googleConnector,
  google_ads: googleAdsConnector,
  ga4: ga4Connector,
  linkedin: linkedinConnector,
  linkedin_ads: linkedinConnector, // Alias for same connector
  linkedin_pages: linkedinConnector, // Alias for same connector
  beehiiv: beehiivConnector as any, // Beehiiv uses API key auth (team invitation workflow)
  tiktok: tiktokConnector,
  tiktok_ads: tiktokConnector, // Alias for same connector
  snapchat: snapchatConnector,
  snapchat_ads: snapchatConnector, // Alias for same connector
  shopify: shopifyConnector,
};

/**
 * Get the appropriate connector for a platform
 *
 * @param platform - The platform identifier
 * @returns The platform connector instance
 * @throws Error if no connector exists for the platform
 *
 * @example
 * ```typescript
 * const connector = getConnector('meta_ads');
 * const tokens = await connector.exchangeCode(code);
 * ```
 */
export function getConnector(platform: Platform): PlatformConnector {
  const connector = CONNECTOR_REGISTRY[platform];

  if (!connector) {
    throw new Error(
      `No connector found for platform: ${platform}. ` +
      `Available platforms: ${Object.keys(CONNECTOR_REGISTRY).join(', ')}`
    );
  }

  return connector;
}
