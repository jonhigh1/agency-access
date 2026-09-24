import type { Platform } from '@agency-platform/shared';
import { META_GRAPH_VERSION } from '../../lib/meta-constants.js';

/**
 * Platform OAuth Registry Configuration
 *
 * This file contains the "personality" of each platform - their OAuth endpoints,
 * scopes, and behavioral quirks. Platforms that follow the standard OAuth 2.0 flow
 * can be added with configuration alone, without writing any connector code.
 *
 * Adding a new platform is as simple as:
 * 1. Add env vars to apps/api/src/lib/env.ts
 * 2. Add platform to packages/shared/src/types.ts
 * 3. Add entry here with OAuth endpoints
 * 4. Create a simple connector extending BaseConnector
 *
 * @see apps/api/src/services/connectors/base.connector.ts
 */

/**
 * Platform-specific OAuth configuration flags
 *
 * These flags indicate platform-specific behaviors that require special handling:
 * - requiresLongLivedExchange: Platform needs short → long token exchange (e.g., Meta)
 * - supportsRefreshTokens: Platform supports refresh_token grant type
 * - requiresDeveloperToken: Platform requires developer token header in API calls
 * - scopeSeparator: Character used to join multiple scopes (space, comma, etc.)
 * - authParams: Additional parameters to include in auth URL
 * - tokenParams: Additional parameters to include in token exchange
 */
export interface PlatformOAuthConfig {
  /** Display name for the platform */
  name: string;

  /** OAuth authorization endpoint URL */
  authUrl: string;

  /** OAuth token endpoint URL */
  tokenUrl: string;

  /** Character used to join multiple scopes (default: ' ') */
  scopeSeparator?: string;

  /** Additional parameters for authorization URL */
  authParams?: Record<string, string>;

  /** Additional parameters for token exchange */
  tokenParams?: Record<string, string>;

  /** Platform API version (for platforms like Meta with versioned APIs) */
  version?: string;

  /** Platform requires short → long token exchange after authorization */
  requiresLongLivedExchange?: boolean;

  /** Platform requires PKCE (Proof Key for Code Exchange) for OAuth */
  requiresPKCE?: boolean;

  /** Platform requires shop context in URLs (e.g., Shopify) */
  requiresShopContext?: boolean;

  /** Platform-specific headers for API calls (e.g., developer tokens) */
  apiHeaders?: Record<string, string>;

  /** User info endpoint to fetch user profile after OAuth */
  userInfoUrl?: string;

  /** Token verification endpoint */
  verifyUrl?: string;

  /** Whether platform supports token refresh */
  supportsRefreshTokens?: boolean;

  /** Default OAuth scopes for this platform */
  defaultScopes: string[];
}

/**
 * Platform Configuration Registry
 *
 * Maps platform identifiers to their OAuth configurations.
 * Partial: only platforms with a real OAuth flow have entries.
 * Non-OAuth platforms (Kit, Beehiiv, Zapier — team invitation / API key
 * flows) are intentionally absent; their connectors are standalone.
 *
 * NOTE: This config uses shared PLATFORM_SCOPES for the actual scope values.
 * The defaultScopes here are references for documentation and fallback.
 */
export const PLATFORM_CONFIGS: Partial<Record<Platform, PlatformOAuthConfig>> = {
  // ========================================================================
  // GOOGLE PLATFORMS
  // ========================================================================

  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopeSeparator: ' ',
    authParams: {
      access_type: 'offline', // Required for refresh tokens
      prompt: 'consent', // Force consent screen to ensure refresh token
    },
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    verifyUrl: 'https://www.googleapis.com/oauth2/v2/tokeninfo',
    supportsRefreshTokens: true,
    apiHeaders: {}, // Google Ads requires developer-token, but it's API-specific
    // Combined OAuth scopes for every Google product (order matters: the
    // unified Google connector authorizes all products in one consent).
    defaultScopes: [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/tagmanager.readonly',
      'https://www.googleapis.com/auth/webmasters',
      'https://www.googleapis.com/auth/content',
    ],
  },

  google_ads: {
    name: 'Google Ads',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopeSeparator: ' ',
    authParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    verifyUrl: 'https://googleads.googleapis.com/v22/customers:listAccessibleCustomers',
    supportsRefreshTokens: true,
    apiHeaders: {
      // Developer token is required for Google Ads API calls
      // Set in env as GOOGLE_ADS_DEVELOPER_TOKEN
    },
    defaultScopes: ['https://www.googleapis.com/auth/adwords'],
  },

  ga4: {
    name: 'Google Analytics 4',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopeSeparator: ' ',
    authParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    supportsRefreshTokens: true,
    defaultScopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  },

  // ========================================================================
  // META PLATFORMS
  // ========================================================================

  meta: {
    name: 'Meta',
    authUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
    scopeSeparator: ',',
    version: META_GRAPH_VERSION,
    requiresLongLivedExchange: true, // Meta-specific: 2hr → 60 day token
    userInfoUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
    supportsRefreshTokens: false, // Meta uses long-lived tokens instead
    defaultScopes: ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement', 'pages_read_user_content'],
  },

  meta_ads: {
    name: 'Meta Ads',
    authUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
    scopeSeparator: ',',
    version: META_GRAPH_VERSION,
    requiresLongLivedExchange: true,
    userInfoUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
    supportsRefreshTokens: false,
    defaultScopes: ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement', 'pages_read_user_content'],
  },

  meta_pages: {
    name: 'Meta Pages',
    authUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
    scopeSeparator: ',',
    version: META_GRAPH_VERSION,
    requiresLongLivedExchange: true,
    userInfoUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
    supportsRefreshTokens: false,
    defaultScopes: ['business_management', 'pages_read_engagement', 'pages_read_user_content'],
  },

  instagram: {
    name: 'Instagram',
    authUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
    scopeSeparator: ',',
    version: META_GRAPH_VERSION,
    requiresLongLivedExchange: true,
    userInfoUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
    supportsRefreshTokens: false,
    defaultScopes: ['business_management', 'pages_read_engagement', 'pages_read_user_content'],
  },

  // ========================================================================
  // LINKEDIN PLATFORMS
  // ========================================================================

  linkedin: {
    name: 'LinkedIn',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopeSeparator: ' ',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    supportsRefreshTokens: true,
    // OIDC scopes (openid, profile, email) required for /v2/userinfo endpoint
    defaultScopes: ['openid', 'profile', 'email', 'rw_ads', 'r_ads_reporting'],
  },

  linkedin_ads: {
    name: 'LinkedIn Ads',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopeSeparator: ' ',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    supportsRefreshTokens: true,
    // OIDC scopes (openid, profile, email) required for /v2/userinfo endpoint
    defaultScopes: ['openid', 'profile', 'email', 'rw_ads', 'r_ads_reporting'],
  },

  linkedin_pages: {
    name: 'LinkedIn Pages',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopeSeparator: ' ',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    supportsRefreshTokens: true,
    defaultScopes: ['openid', 'profile', 'email', 'rw_organization_admin'],
  },

  // ========================================================================
  // TIKTOK PLATFORMS
  // ========================================================================

  tiktok: {
    name: 'TikTok',
    authUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/',
    tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth/token/',
    scopeSeparator: ',',
    userInfoUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
    verifyUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
    supportsRefreshTokens: false,
    defaultScopes: ['advertiser.info'],
  },

  tiktok_ads: {
    name: 'TikTok Ads',
    authUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/',
    tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth/token/',
    scopeSeparator: ',',
    userInfoUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
    verifyUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
    supportsRefreshTokens: false,
    defaultScopes: ['advertiser.info'],
  },

  // ========================================================================
  // SNAPCHAT PLATFORMS
  // ========================================================================

  snapchat: {
    name: 'Snapchat',
    authUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
    tokenUrl: 'https://accounts.snapchat.com/login/oauth2/access_token',
    scopeSeparator: ' ',
    userInfoUrl: 'https://adsapi.snapchat.com/v1/me',
    supportsRefreshTokens: true,
    defaultScopes: ['snapchat-marketing-api'],
  },

  snapchat_ads: {
    name: 'Snapchat Ads',
    authUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
    tokenUrl: 'https://accounts.snapchat.com/login/oauth2/access_token',
    scopeSeparator: ' ',
    userInfoUrl: 'https://adsapi.snapchat.com/v1/me',
    supportsRefreshTokens: true,
    defaultScopes: ['snapchat-marketing-api'],
  },

  // ========================================================================
  // MAILCHIMP PLATFORMS
  // ========================================================================

  mailchimp: {
    name: 'Mailchimp',
    authUrl: 'https://login.mailchimp.com/oauth2/authorize',
    tokenUrl: 'https://login.mailchimp.com/oauth2/token',
    scopeSeparator: ',',
    userInfoUrl: 'https://login.mailchimp.com/oauth2/metadata', // Metadata endpoint for server prefix
    supportsRefreshTokens: false, // Tokens never expire
    defaultScopes: [], // Mailchimp uses account-level permissions, no scopes
  },

  // ========================================================================
  // PINTEREST PLATFORMS
  // ========================================================================

  pinterest: {
    name: 'Pinterest',
    // Pinterest v5 OAuth endpoints
    authUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scopeSeparator: ',',
    userInfoUrl: 'https://api.pinterest.com/v5/user_account',
    // Access tokens expire in 30 days; refresh tokens are continuous
    supportsRefreshTokens: true,
    defaultScopes: ['ads:read', 'ads:write', 'user_accounts:read'],
  },

  // ========================================================================
  // KLAVIYO PLATFORMS
  // ========================================================================

  klaviyo: {
    name: 'Klaviyo',
    authUrl: 'https://www.klaviyo.com/oauth/authorize',
    tokenUrl: 'https://a.klaviyo.com/oauth/token', // NOTE: a.klaviyo.com subdomain
    scopeSeparator: ' ',
    userInfoUrl: 'https://a.klaviyo.com/api/accounts/',
    supportsRefreshTokens: true, // Refresh tokens expire after 90 days of no-use
    // Klaviyo requires PKCE (Proof Key for Code Exchange)
    // This flag is checked in the connector to add code_challenge parameters
    requiresPKCE: true,
    defaultScopes: ['lists:write', 'campaigns:write', 'metrics:read', 'events:read'],
  },

  // ========================================================================
  // SHOPIFY PLATFORMS
  // ========================================================================

  shopify: {
    name: 'Shopify',
    // Shopify uses shop-specific URLs: https://{shop}.myshopify.com/admin/oauth/authorize
    // The {shop} placeholder is replaced at runtime
    authUrl: 'https://{shop}.myshopify.com/admin/oauth/authorize',
    tokenUrl: 'https://{shop}.myshopify.com/admin/oauth/access_token',
    scopeSeparator: ',',
    supportsRefreshTokens: false, // Access tokens don't expire
    // Shopify requires shop context in URLs
    requiresShopContext: true,
    defaultScopes: ['read_products', 'read_orders', 'read_customers', 'read_marketing_events'],
  },
};

/**
 * Typed error thrown when a platform has no OAuth configuration.
 * Carries the platform identifier for upstream error mapping.
 */
export class PlatformNotConfiguredError extends Error {
  constructor(public platform: Platform) {
    super(`No OAuth configuration found for platform: ${platform}`);
    this.name = 'PlatformNotConfiguredError';
  }
}

/**
 * Get configuration for a platform
 *
 * @param platform - Platform identifier
 * @returns Platform OAuth configuration
 * @throws PlatformNotConfiguredError if platform config doesn't exist
 */
export function getPlatformConfig(platform: Platform): PlatformOAuthConfig {
  const config = PLATFORM_CONFIGS[platform];
  if (!config) {
    throw new PlatformNotConfiguredError(platform);
  }
  return config;
}
