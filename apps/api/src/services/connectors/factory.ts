import type { Platform } from '@agency-platform/shared';
import type { OAuthTokenResponse } from './base.connector.js';
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
export type { NormalizedTokenResponse, OAuthTokenResponse } from './base.connector.js';
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
 * google_ads, ga4). Beehiiv is the api_key connector (authMode union —
 * no cast). Manual-invite platforms (kit, zapier, mailchimp, pinterest,
 * klaviyo) have no connector.
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
 * OAuth platform connector contract (`authMode: 'oauth'`).
 *
 * Different platforms have different refresh capabilities:
 * - Google Ads & GA4: Support refresh_token flow
 * - Meta: Uses 60-day long-lived tokens (no refresh, requires re-auth)
 */
export interface PlatformConnector {
  readonly authMode: 'oauth';

  getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string;

  exchangeCode(code: string, redirectUri?: string): Promise<OAuthTokenResponse>;

  refreshToken?(refreshToken: string): Promise<OAuthTokenResponse>;

  getLongLivedToken?(shortToken: string): Promise<OAuthTokenResponse>;

  /** Optional provider-side token inspection; never return or persist token values. */
  getTokenMetadata?(accessToken: string): Promise<{
    scopes: string[];
    expiresAt?: Date;
    dataAccessExpiresAt?: Date;
    userId?: string;
    isValid: boolean;
  }>;

  verifyToken(accessToken: string): Promise<boolean>;

  getUserInfo(accessToken: string): Promise<unknown>;

  verifyClientAccess?(
    agencyAccessToken: string,
    ...args: unknown[]
  ): Promise<unknown>;

  revokeToken?(accessToken: string): Promise<void>;
}

/**
 * API-key connector contract (`authMode: 'api_key'`).
 * Beehiiv team-invitation workflow — no OAuth URL / code exchange.
 */
export interface ApiKeyConnector {
  readonly authMode: 'api_key';
  verifyToken(apiKey: string): Promise<boolean>;
}

export type RegistryConnector = PlatformConnector | ApiKeyConnector;

export function isOAuthConnector(connector: RegistryConnector): connector is PlatformConnector {
  return connector.authMode === 'oauth';
}

export function isApiKeyConnector(connector: RegistryConnector): connector is ApiKeyConnector {
  return connector.authMode === 'api_key';
}

/**
 * Platform Connector Registry
 *
 * Maps platform identifiers to their connector instances.
 * Key set pinned to the shared registry's connectorPlatformIds (DEC-015).
 */
export const CONNECTOR_REGISTRY: Partial<Record<Platform, RegistryConnector>> = {
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
  beehiiv: beehiivConnector,
  tiktok: tiktokConnector,
  tiktok_ads: tiktokConnector, // Alias for same connector
  snapchat: snapchatConnector,
  snapchat_ads: snapchatConnector, // Alias for same connector
  shopify: shopifyConnector,
};

function missingConnectorError(platform: Platform): Error {
  return new Error(
    `No connector found for platform: ${platform}. ` +
    `Available platforms: ${Object.keys(CONNECTOR_REGISTRY).join(', ')}`
  );
}

/**
 * Get the OAuth connector for a platform.
 *
 * @throws if no connector exists, or the platform uses API-key auth
 */
export function getConnector(platform: Platform): PlatformConnector {
  const connector = CONNECTOR_REGISTRY[platform];

  if (!connector) {
    throw missingConnectorError(platform);
  }

  if (!isOAuthConnector(connector)) {
    throw new Error(
      `Platform ${platform} uses API-key auth; use getApiKeyConnector() instead of getConnector().`
    );
  }

  return connector;
}

/**
 * Get the API-key connector for a platform (currently beehiiv).
 *
 * @throws if no connector exists, or the platform is OAuth
 */
export function getApiKeyConnector(platform: Platform): ApiKeyConnector {
  const connector = CONNECTOR_REGISTRY[platform];

  if (!connector) {
    throw missingConnectorError(platform);
  }

  if (!isApiKeyConnector(connector)) {
    throw new Error(
      `Platform ${platform} is an OAuth connector; use getConnector() instead of getApiKeyConnector().`
    );
  }

  return connector;
}
