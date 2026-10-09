import { describe, expect, it } from '@jest/globals';
import {
  LEGACY_PAYLOAD_IDS,
  PLATFORMS,
  clientOAuthPlatforms,
  connectorPlatformIds,
  getPlatform,
  manualConfirmationPlatforms,
  platformIds,
  type PlatformRegistryEntry,
} from '../platforms/registry';
import {
  ManualConfirmationPlatformSchema,
  PLATFORM_NAMES,
  PLATFORM_TOKEN_CAPABILITIES,
  PlatformSchema,
  type Platform,
  type PlatformTokenCapability,
} from '../types';
import * as SharedBarrel from '../index';

// GOLDEN — regenerate only via:
//   npx tsx scripts/generate-platform-registry-golden.ts --acknowledge=DEC-015
// Provenance: acknowledged under DEC-015 (docs/DECISIONS.md), 2026-10-08.
// Frozen literals; NEVER snapshots.
//
// Characterization source: PLATFORM_TOKEN_CAPABILITIES (types.ts:60-208),
// PLATFORM_NAMES (types.ts:650-672), PlatformSchema (types.ts:6-28),
// PLATFORM_HIERARCHY rider product names (types.ts:1370-1373). Canonical
// registry declaration order = PlatformSchema enum order, then the four
// Google rider products, then the three legacy payload ids.

const FROZEN_ENTRY_ROWS: ReadonlyArray<{
  id: string;
  kind: 'group' | 'product' | 'legacy';
  parent: string | null;
}> = [
  { id: 'google', kind: 'group', parent: null },
  { id: 'meta', kind: 'group', parent: null },
  { id: 'google_ads', kind: 'product', parent: 'google' },
  { id: 'ga4', kind: 'product', parent: 'google' },
  { id: 'meta_ads', kind: 'product', parent: 'meta' },
  { id: 'meta_pages', kind: 'product', parent: 'meta' },
  { id: 'tiktok', kind: 'group', parent: null },
  { id: 'tiktok_ads', kind: 'product', parent: 'tiktok' },
  { id: 'linkedin', kind: 'group', parent: null },
  { id: 'linkedin_ads', kind: 'product', parent: 'linkedin' },
  { id: 'linkedin_pages', kind: 'product', parent: 'linkedin' },
  { id: 'snapchat', kind: 'group', parent: null },
  { id: 'snapchat_ads', kind: 'product', parent: 'snapchat' },
  { id: 'instagram', kind: 'product', parent: 'meta' },
  { id: 'kit', kind: 'product', parent: null },
  { id: 'beehiiv', kind: 'product', parent: null },
  { id: 'mailchimp', kind: 'product', parent: null },
  { id: 'pinterest', kind: 'product', parent: null },
  { id: 'klaviyo', kind: 'product', parent: null },
  { id: 'shopify', kind: 'product', parent: null },
  { id: 'zapier', kind: 'product', parent: null },
  { id: 'google_tag_manager', kind: 'product', parent: 'google' },
  { id: 'google_merchant_center', kind: 'product', parent: 'google' },
  { id: 'google_search_console', kind: 'product', parent: 'google' },
  { id: 'google_business_profile', kind: 'product', parent: 'google' },
  { id: 'whatsapp_business', kind: 'legacy', parent: 'meta' },
  { id: 'youtube_studio', kind: 'legacy', parent: 'google' },
  { id: 'display_video_360', kind: 'legacy', parent: 'google' },
];

// Verbatim copy of PLATFORM_TOKEN_CAPABILITIES (types.ts:60-208) at
// characterization time. Do not regenerate by hand — use the regen protocol.
const FROZEN_CAPABILITIES: Record<Platform, PlatformTokenCapability> = {
  google: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  meta: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  google_ads: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  ga4: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  meta_ads: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  meta_pages: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  tiktok: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  tiktok_ads: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  linkedin: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  linkedin_ads: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  linkedin_pages: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  snapchat: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  snapchat_ads: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  instagram: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  kit: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  beehiiv: { connectionMethod: 'api_key', tokenKind: 'api_key', refreshStrategy: 'none', healthStrategy: 'api_key_verify', expiryBehavior: 'non_expiring' },
  mailchimp: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  pinterest: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  klaviyo: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  shopify: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  zapier: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
};

function capabilitiesOf(id: string): PlatformTokenCapability | undefined {
  const entry = PLATFORMS[id as keyof typeof PLATFORMS] as PlatformRegistryEntry;
  return 'capabilities' in entry && entry.capabilities !== undefined
    ? entry.capabilities
    : undefined;
}

describe('PLATFORMS registry shape', () => {
  it('holds exactly 28 entries', () => {
    expect(platformIds).toHaveLength(28);
  });

  it('declares id / kind / parent in canonical order', () => {
    const rows = platformIds.map((id) => {
      const entry = PLATFORMS[id as keyof typeof PLATFORMS] as PlatformRegistryEntry;
      const parent = 'parent' in entry ? entry.parent : null;
      return { id, kind: entry.kind, parent: parent ?? null };
    });
    expect(rows).toEqual(FROZEN_ENTRY_ROWS);
  });
});

describe('capabilities golden', () => {
  it('matches the frozen verbatim copy of PLATFORM_TOKEN_CAPABILITIES', () => {
    const derived: Partial<Record<Platform, PlatformTokenCapability>> = {};
    for (const id of platformIds) {
      const capabilities = capabilitiesOf(id);
      if (capabilities) derived[id as Platform] = capabilities;
    }
    expect(derived).toEqual(FROZEN_CAPABILITIES);
  });

  it('equals the live PLATFORM_TOKEN_CAPABILITIES (characterization cross-check)', () => {
    const derived: Partial<Record<Platform, PlatformTokenCapability>> = {};
    for (const id of platformIds) {
      const capabilities = capabilitiesOf(id);
      if (capabilities) derived[id as Platform] = capabilities;
    }
    expect(derived).toEqual(PLATFORM_TOKEN_CAPABILITIES);
  });

  it('gives riders and legacy entries no capabilities', () => {
    for (const id of [
      'google_tag_manager',
      'google_merchant_center',
      'google_search_console',
      'google_business_profile',
      'whatsapp_business',
      'youtube_studio',
      'display_video_360',
    ]) {
      expect(capabilitiesOf(id)).toBeUndefined();
    }
  });
});

describe('clientAuthorizable golden', () => {
  it('derives exactly the client OAuth gate ten, in derivation order', () => {
    expect(clientOAuthPlatforms).toEqual([
      'google',
      'meta',
      'google_ads',
      'ga4',
      'meta_ads',
      'meta_pages',
      'tiktok',
      'linkedin',
      'snapchat',
      'instagram',
    ]);
  });
});

describe('manual confirmation golden', () => {
  it('derives exactly the seven manual-invite platforms, in derivation order', () => {
    expect(manualConfirmationPlatforms).toEqual([
      'kit',
      'beehiiv',
      'mailchimp',
      'pinterest',
      'klaviyo',
      'shopify',
      'zapier',
    ]);
  });

  it('equals the live ManualConfirmationPlatformSchema members (order-insensitive)', () => {
    expect([...manualConfirmationPlatforms].sort()).toEqual(
      [...ManualConfirmationPlatformSchema.options].sort()
    );
  });
});

describe('connector platform golden', () => {
  it('derives exactly the sixteen connector-served platforms, in derivation order', () => {
    expect(connectorPlatformIds).toEqual([
      'google',
      'meta',
      'google_ads',
      'ga4',
      'meta_ads',
      'meta_pages',
      'tiktok',
      'tiktok_ads',
      'linkedin',
      'linkedin_ads',
      'linkedin_pages',
      'snapchat',
      'snapchat_ads',
      'instagram',
      'beehiiv',
      'shopify',
    ]);
  });
});

describe('LEGACY_PAYLOAD_IDS golden', () => {
  it('is exactly the seven payload-history ids', () => {
    expect([...LEGACY_PAYLOAD_IDS]).toEqual([
      'whatsapp_business',
      'google_tag_manager',
      'google_merchant_center',
      'google_search_console',
      'youtube_studio',
      'google_business_profile',
      'display_video_360',
    ]);
  });

  it('is a subset of the registry ids', () => {
    for (const id of LEGACY_PAYLOAD_IDS) {
      expect(platformIds).toContain(id);
    }
  });
});

describe('PlatformSchema derivation', () => {
  it('derives exactly the 21 PlatformSchema members, elementwise in enum order', () => {
    const derived = platformIds.filter((id) => {
      const entry = PLATFORMS[id as keyof typeof PLATFORMS] as PlatformRegistryEntry;
      return entry.kind !== 'legacy' && !('authorizesViaParent' in entry);
    });
    expect(derived).toEqual([
      'google',
      'meta',
      'google_ads',
      'ga4',
      'meta_ads',
      'meta_pages',
      'tiktok',
      'tiktok_ads',
      'linkedin',
      'linkedin_ads',
      'linkedin_pages',
      'snapchat',
      'snapchat_ads',
      'instagram',
      'kit',
      'beehiiv',
      'mailchimp',
      'pinterest',
      'klaviyo',
      'shopify',
      'zapier',
    ]);
    expect(derived).toEqual([...PlatformSchema.options]);
  });
});

describe('display names golden', () => {
  it('matches PLATFORM_NAMES for the 21 schema platforms', () => {
    const derived: Partial<Record<Platform, string>> = {};
    for (const id of platformIds) {
      const entry = PLATFORMS[id as keyof typeof PLATFORMS] as PlatformRegistryEntry;
      const capabilities = capabilitiesOf(id);
      if (capabilities) derived[id as Platform] = entry.displayName;
    }
    expect(derived).toEqual(PLATFORM_NAMES);
  });

  it('freezes the rider and legacy display names', () => {
    expect(getPlatform('google_tag_manager').displayName).toBe('Tag Manager');
    expect(getPlatform('google_merchant_center').displayName).toBe('Merchant Center');
    expect(getPlatform('google_search_console').displayName).toBe('Search Console');
    expect(getPlatform('google_business_profile').displayName).toBe('Business Profile');
    expect(getPlatform('whatsapp_business').displayName).toBe('WhatsApp Business');
    expect(getPlatform('youtube_studio').displayName).toBe('YouTube Studio');
    expect(getPlatform('display_video_360').displayName).toBe('Display & Video 360');
  });
});

// Verbatim copy of apps/api/src/services/connectors/registry.config.ts
// PLATFORM_CONFIGS at absorption time (DEC-015 Phase 2b). Meta URLs resolve
// META_GRAPH_VERSION ('v25.0'); Meta scopes resolve META_PERMISSION_CONTRACT.
// Do not regenerate by hand — use the regen protocol.
const FROZEN_OAUTH_CONFIGS: Record<string, Record<string, unknown>> = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopeSeparator: ' ',
    authParams: { access_type: 'offline', prompt: 'consent' },
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    verifyUrl: 'https://www.googleapis.com/oauth2/v2/tokeninfo',
    supportsRefreshTokens: true,
    apiHeaders: {},
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
    authParams: { access_type: 'offline', prompt: 'consent' },
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    verifyUrl: 'https://googleads.googleapis.com/v22/customers:listAccessibleCustomers',
    supportsRefreshTokens: true,
    apiHeaders: {},
    defaultScopes: ['https://www.googleapis.com/auth/adwords'],
  },
  ga4: {
    name: 'Google Analytics 4',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopeSeparator: ' ',
    authParams: { access_type: 'offline', prompt: 'consent' },
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    supportsRefreshTokens: true,
    defaultScopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  },
  meta: {
    name: 'Meta',
    authUrl: 'https://www.facebook.com/v25.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v25.0/oauth/access_token',
    scopeSeparator: ',',
    version: 'v25.0',
    requiresLongLivedExchange: true,
    userInfoUrl: 'https://graph.facebook.com/v25.0/me',
    supportsRefreshTokens: false,
    defaultScopes: ['ads_management', 'business_management', 'pages_read_engagement', 'pages_show_list'],
  },
  meta_ads: {
    name: 'Meta Ads',
    authUrl: 'https://www.facebook.com/v25.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v25.0/oauth/access_token',
    scopeSeparator: ',',
    version: 'v25.0',
    requiresLongLivedExchange: true,
    userInfoUrl: 'https://graph.facebook.com/v25.0/me',
    supportsRefreshTokens: false,
    defaultScopes: ['ads_management', 'business_management', 'pages_read_engagement', 'pages_show_list'],
  },
  meta_pages: {
    name: 'Meta Pages',
    authUrl: 'https://www.facebook.com/v25.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v25.0/oauth/access_token',
    scopeSeparator: ',',
    version: 'v25.0',
    requiresLongLivedExchange: true,
    userInfoUrl: 'https://graph.facebook.com/v25.0/me',
    supportsRefreshTokens: false,
    defaultScopes: ['business_management', 'pages_show_list', 'pages_read_engagement'],
  },
  instagram: {
    name: 'Instagram',
    authUrl: 'https://www.facebook.com/v25.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v25.0/oauth/access_token',
    scopeSeparator: ',',
    version: 'v25.0',
    requiresLongLivedExchange: true,
    userInfoUrl: 'https://graph.facebook.com/v25.0/me',
    supportsRefreshTokens: false,
    defaultScopes: ['business_management', 'pages_read_engagement'],
  },
  linkedin: {
    name: 'LinkedIn',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopeSeparator: ' ',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    supportsRefreshTokens: true,
    defaultScopes: ['openid', 'profile', 'email', 'rw_ads', 'r_ads_reporting'],
  },
  linkedin_ads: {
    name: 'LinkedIn Ads',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopeSeparator: ' ',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    supportsRefreshTokens: true,
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
  shopify: {
    name: 'Shopify',
    authUrl: 'https://{shop}.myshopify.com/admin/oauth/authorize',
    tokenUrl: 'https://{shop}.myshopify.com/admin/oauth/access_token',
    scopeSeparator: ',',
    supportsRefreshTokens: false,
    requiresShopContext: true,
    defaultScopes: ['read_products', 'read_orders', 'read_customers', 'read_marketing_events'],
  },
};

describe('oauth config golden', () => {
  it('carries exactly the absorbed api OAuth configs, verbatim', () => {
    const derived: Record<string, unknown> = {};
    for (const id of platformIds) {
      const entry = PLATFORMS[id as keyof typeof PLATFORMS] as PlatformRegistryEntry;
      if (entry.oauth !== undefined) derived[id] = entry.oauth;
    }
    expect(derived).toEqual(FROZEN_OAUTH_CONFIGS);
  });

  it('gives riders and legacy entries no oauth block', () => {
    for (const id of [
      'google_tag_manager',
      'google_merchant_center',
      'google_search_console',
      'google_business_profile',
      'whatsapp_business',
      'youtube_studio',
      'display_video_360',
    ]) {
      const entry = PLATFORMS[id as keyof typeof PLATFORMS] as PlatformRegistryEntry;
      expect(entry.oauth).toBeUndefined();
    }
  });
});

describe('accessor and barrel', () => {
  it('returns entries through getPlatform', () => {
    expect(getPlatform('google').kind).toBe('group');
    expect(getPlatform('kit').kind).toBe('product');
    expect(getPlatform('whatsapp_business').kind).toBe('legacy');
  });

  it('re-exports the registry through the package barrel', () => {
    expect(SharedBarrel.PLATFORMS).toBe(PLATFORMS);
    expect(SharedBarrel.LEGACY_PAYLOAD_IDS).toBe(LEGACY_PAYLOAD_IDS);
  });
});
