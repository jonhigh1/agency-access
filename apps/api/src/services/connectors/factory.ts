import type { Platform } from '@agency-platform/shared';
import { metaConnector } from './meta.js';
import { googleAdsConnector } from './google-ads.js';
import { ga4Connector } from './ga4.js';
import { googleConnector } from './google.js';
import { linkedinConnector } from './linkedin.js';
import { kitConnector } from './kit.js';
import { beehiivConnector } from './beehiiv.js';
import { mailchimpConnector } from './mailchimp.js';
import { pinterestConnector } from './pinterest.js';
import { klaviyoConnector } from './klaviyo.js';
import { shopifyConnector } from './shopify.js';
import { tiktokConnector } from './tiktok.js';
import { snapchatConnector } from './snapchat.js';
// Zapier uses manual invitation flow (like Beehiiv/Kit), not OAuth

// Export new hybrid architecture components
export { BaseConnector, ConnectorError } from './base.connector.js';
export type { NormalizedTokenResponse } from './base.connector.js';
export { PLATFORM_CONFIGS, getPlatformConfig } from './registry.config.js';

/**
 * ============================================================================
 * HYBRID CONNECTOR ARCHITECTURE
 * ============================================================================
 *
 * This factory supports TWO connector patterns:
 *
 * 1. **LEGACY PATTERN** (Existing connectors: meta, google, google-ads, ga4)
 *    - Standalone classes implementing full PlatformConnector interface
 *    - Each has its own OAuth flow implementation
 *    - Located in: meta.ts, google.ts, google-ads.ts, ga4.ts
 *
 * 2. **NEW PATTERN** (BaseConnector + Registry)
 *    - Extend BaseConnector class for standard OAuth 2.0 platforms
 *    - Configuration-driven via registry.config.ts
 *    - ~80% less code for standard OAuth platforms
 *    - See: TEMPLATE.ts for usage examples
 *
 * MIGRATION:
 * - Legacy connectors continue to work unchanged
 * - New platforms should use BaseConnector pattern
 * - Existing connectors can be migrated gradually (not urgent)
 *
 * ADDING A NEW CONNECTOR (New Pattern):
 * 1. Add platform to packages/shared/src/types.ts (PlatformSchema, PLATFORM_NAMES, PLATFORM_SCOPES)
 * 2. Add env vars to apps/api/src/lib/env.ts
 * 3. Add config to registry.config.ts
 * 4. Create connector extending BaseConnector
 * 5. Register connector in the `connectors` object below
 * 6. Add OAuth callback route in apps/api/src/routes/oauth.ts
 *
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
 * Add new connectors here as they are implemented.
 */
const connectors: Partial<Record<Platform, PlatformConnector>> = {
  // Legacy pattern connectors
  meta: metaConnector,
  meta_ads: metaConnector,
  meta_pages: metaConnector,
  google: googleConnector,
  google_ads: googleAdsConnector,
  ga4: ga4Connector,

  // New pattern connectors (BaseConnector)
  linkedin: linkedinConnector,
  linkedin_ads: linkedinConnector, // Alias for same connector
  linkedin_pages: linkedinConnector, // Alias for same connector
  kit: kitConnector, // Kit (ConvertKit) - standalone pattern (like Meta)

  // API Key authentication connectors (non-OAuth)
  beehiiv: beehiivConnector as any, // Beehiiv uses API key auth (team invitation workflow)

  // New platform connectors
  tiktok: tiktokConnector,
  tiktok_ads: tiktokConnector, // Alias for same connector
  snapchat: snapchatConnector,
  snapchat_ads: snapchatConnector, // Alias for same connector
  mailchimp: mailchimpConnector,
  pinterest: pinterestConnector,
  klaviyo: klaviyoConnector,
  shopify: shopifyConnector,
  // zapier: uses manual invitation flow, not OAuth
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
  const connector = connectors[platform];

  if (!connector) {
    throw new Error(
      `No connector found for platform: ${platform}. ` +
      `Available platforms: ${Object.keys(connectors).join(', ')}`
    );
  }

  return connector;
}
