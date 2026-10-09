/**
 * PLATFORMS registry — the one sanctioned place to hand-type platform facts.
 *
 * Every platform-id set literal in the codebase must either live here or in
 * the ratcheted walker allowlist (Phase 3, DEC-015). Derivations below are
 * mechanical projections; the curated facts (clientAuthorizable, the rider
 * split, LEGACY_PAYLOAD_IDS) are hand-typed and pinned by goldens:
 * packages/shared/src/__tests__/platform-registry.golden.test.ts.
 *
 * One id = one entry. Discriminated union on `kind`:
 * - group: OAuth umbrella covering several products (agency connections bind here).
 * - product: own token lifecycle — OAuth products have a parent, manual/api_key
 *   singletons stand alone.
 * - parent-authorized product: current, selectable hierarchy product whose grants
 *   ride its parent group's connection (google-native-access). Discriminated by
 *   the required literal `authorizesViaParent: true`; capabilities are
 *   compile-forbidden because the entry has no token lifecycle of its own.
 * - legacy: payload-history id — still arrives in stored platforms[] rows
 *   (see LEGACY_PAYLOAD_IDS) but is not selectable. id/kind/displayName/parent only.
 *
 * `connectionMethod` documents the client-facing authorization flow. The
 * optional `oauth` block documents agency-side transport; the two are
 * independent facts (shopify is client-manual and agency-OAuth in one entry).
 * The oauth block is declared in Phase 1 and populated in Phase 2b.
 */
import {
  META_GRAPH_VERSION,
  META_PERMISSION_CONTRACT,
  type PlatformTokenCapability,
} from '../types.js';

/**
 * Agency-side OAuth transport facts for a platform: the verbatim shape of the
 * api connector registry (apps/api/src/services/connectors/registry.config.ts),
 * absorbed in Phase 2b (DEC-015). Meta URLs reference META_GRAPH_VERSION and
 * Meta scopes reference META_PERMISSION_CONTRACT so those contracts stay the
 * single source for their values; the golden pins the resolved values.
 * Shopify keeps {shop} placeholders — the api substitutes shop context at
 * runtime. `connectionMethod` documents the client-facing flow; this block
 * documents agency-side transport. Independent facts: shopify is
 * client-manual and agency-OAuth in one entry.
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

/** The five OAuth umbrella groups. Hand-typed; the golden pins it to the registry group ids. */
export type PlatformGroupId = 'google' | 'meta' | 'linkedin' | 'tiktok' | 'snapchat';

interface PlatformEntryBase {
  readonly displayName: string;
}

export interface GroupPlatformEntry extends PlatformEntryBase {
  readonly kind: 'group';
  /** The client OAuth step is available for this platform in an access request. Curated, NOT derived. */
  readonly clientAuthorizable: boolean;
  readonly capabilities: PlatformTokenCapability;
  readonly oauth?: PlatformOAuthConfig;
}

export interface ProductPlatformEntry extends PlatformEntryBase {
  readonly kind: 'product';
  readonly parent?: PlatformGroupId;
  readonly clientAuthorizable: boolean;
  readonly capabilities: PlatformTokenCapability;
  readonly oauth?: PlatformOAuthConfig;
}

export interface ParentAuthorizedProductEntry extends PlatformEntryBase {
  readonly kind: 'product';
  readonly parent: PlatformGroupId;
  readonly authorizesViaParent: true;
  readonly clientAuthorizable: false;
  readonly capabilities?: never;
  readonly oauth?: never;
}

export interface LegacyPlatformEntry extends PlatformEntryBase {
  readonly kind: 'legacy';
  readonly parent: PlatformGroupId;
  readonly clientAuthorizable?: never;
  readonly capabilities?: never;
  readonly oauth?: never;
}

export type PlatformRegistryEntry =
  | GroupPlatformEntry
  | ProductPlatformEntry
  | ParentAuthorizedProductEntry
  | LegacyPlatformEntry;

/**
 * Canonical declaration order = PlatformSchema enum order (types.ts:6-28),
 * then the four Google rider products, then the three legacy payload ids.
 * Capabilities are verbatim from PLATFORM_TOKEN_CAPABILITIES (types.ts:60-208)
 * at characterization time; the golden pins the equality and Phase 2 flips
 * ownership so this table becomes the source.
 */
export const PLATFORMS = {
  // --- 21 PlatformSchema members, in enum order ---
  google: {
    kind: 'group',
    displayName: 'Google',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
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
  },
  meta: {
    kind: 'group',
    displayName: 'Meta',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'Meta',
      authUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
      tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      scopeSeparator: ',',
      version: META_GRAPH_VERSION,
      requiresLongLivedExchange: true, // Meta-specific: 2hr → 60 day token
      userInfoUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
      supportsRefreshTokens: false, // Meta uses long-lived tokens instead
      defaultScopes: [...META_PERMISSION_CONTRACT.core.permissions],
    },
  },
  google_ads: {
    kind: 'product',
    parent: 'google',
    displayName: 'Google Ads',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
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
  },
  ga4: {
    kind: 'product',
    parent: 'google',
    displayName: 'Google Analytics',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
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
  },
  meta_ads: {
    kind: 'product',
    parent: 'meta',
    displayName: 'Meta Ads',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'Meta Ads',
      authUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
      tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      scopeSeparator: ',',
      version: META_GRAPH_VERSION,
      requiresLongLivedExchange: true,
      userInfoUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
      supportsRefreshTokens: false,
      defaultScopes: [...META_PERMISSION_CONTRACT.core.permissions],
    },
  },
  meta_pages: {
    kind: 'product',
    parent: 'meta',
    displayName: 'Meta Pages',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'Meta Pages',
      authUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
      tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      scopeSeparator: ',',
      version: META_GRAPH_VERSION,
      requiresLongLivedExchange: true,
      userInfoUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
      supportsRefreshTokens: false,
      defaultScopes: [...META_PERMISSION_CONTRACT.tracks.meta_pages],
    },
  },
  tiktok: {
    kind: 'group',
    displayName: 'TikTok Ads',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'TikTok',
      authUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/',
      tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth/token/',
      scopeSeparator: ',',
      userInfoUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
      verifyUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
      supportsRefreshTokens: false,
      defaultScopes: ['advertiser.info'],
    },
  },
  tiktok_ads: {
    kind: 'product',
    parent: 'tiktok',
    displayName: 'TikTok Ads',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'TikTok Ads',
      authUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/',
      tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth/token/',
      scopeSeparator: ',',
      userInfoUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
      verifyUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
      supportsRefreshTokens: false,
      defaultScopes: ['advertiser.info'],
    },
  },
  linkedin: {
    kind: 'group',
    displayName: 'LinkedIn',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'LinkedIn',
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      scopeSeparator: ' ',
      userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
      supportsRefreshTokens: true,
      // OIDC scopes (openid, profile, email) required for /v2/userinfo endpoint
      defaultScopes: ['openid', 'profile', 'email', 'rw_ads', 'r_ads_reporting'],
    },
  },
  linkedin_ads: {
    kind: 'product',
    parent: 'linkedin',
    displayName: 'LinkedIn Ads',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'LinkedIn Ads',
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      scopeSeparator: ' ',
      userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
      supportsRefreshTokens: true,
      // OIDC scopes (openid, profile, email) required for /v2/userinfo endpoint
      defaultScopes: ['openid', 'profile', 'email', 'rw_ads', 'r_ads_reporting'],
    },
  },
  linkedin_pages: {
    kind: 'product',
    parent: 'linkedin',
    displayName: 'LinkedIn Pages',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'LinkedIn Pages',
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      scopeSeparator: ' ',
      userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
      supportsRefreshTokens: true,
      defaultScopes: ['openid', 'profile', 'email', 'rw_organization_admin'],
    },
  },
  snapchat: {
    kind: 'group',
    displayName: 'Snapchat Ads',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'Snapchat',
      authUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
      tokenUrl: 'https://accounts.snapchat.com/login/oauth2/access_token',
      scopeSeparator: ' ',
      userInfoUrl: 'https://adsapi.snapchat.com/v1/me',
      supportsRefreshTokens: true,
      defaultScopes: ['snapchat-marketing-api'],
    },
  },
  snapchat_ads: {
    kind: 'product',
    parent: 'snapchat',
    displayName: 'Snapchat Ads',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'Snapchat Ads',
      authUrl: 'https://accounts.snapchat.com/login/oauth2/authorize',
      tokenUrl: 'https://accounts.snapchat.com/login/oauth2/access_token',
      scopeSeparator: ' ',
      userInfoUrl: 'https://adsapi.snapchat.com/v1/me',
      supportsRefreshTokens: true,
      defaultScopes: ['snapchat-marketing-api'],
    },
  },
  instagram: {
    kind: 'product',
    parent: 'meta',
    displayName: 'Instagram',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
    oauth: {
      name: 'Instagram',
      authUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
      tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      scopeSeparator: ',',
      version: META_GRAPH_VERSION,
      requiresLongLivedExchange: true,
      userInfoUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/me`,
      supportsRefreshTokens: false,
      defaultScopes: [...META_PERMISSION_CONTRACT.tracks.instagram],
    },
  },
  kit: {
    kind: 'product',
    displayName: 'Kit',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  },
  beehiiv: {
    kind: 'product',
    displayName: 'Beehiiv',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'api_key', tokenKind: 'api_key', refreshStrategy: 'none', healthStrategy: 'api_key_verify', expiryBehavior: 'non_expiring' },
  },
  mailchimp: {
    kind: 'product',
    displayName: 'Mailchimp',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  },
  pinterest: {
    kind: 'product',
    displayName: 'Pinterest',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  },
  klaviyo: {
    kind: 'product',
    displayName: 'Klaviyo',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  },
  shopify: {
    kind: 'product',
    displayName: 'Shopify',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
    // Agency-side OAuth transport: shop-specific URLs; the api substitutes the
    // {shop} placeholder at runtime (client side uses the manual collaborator
    // flow — dual identity per DEC-015).
    oauth: {
      name: 'Shopify',
      authUrl: 'https://{shop}.myshopify.com/admin/oauth/authorize',
      tokenUrl: 'https://{shop}.myshopify.com/admin/oauth/access_token',
      scopeSeparator: ',',
      supportsRefreshTokens: false, // Access tokens don't expire
      requiresShopContext: true,
      defaultScopes: ['read_products', 'read_orders', 'read_customers', 'read_marketing_events'],
    },
  },
  zapier: {
    kind: 'product',
    displayName: 'Zapier',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'manual', tokenKind: 'none', refreshStrategy: 'none', healthStrategy: 'manual', expiryBehavior: 'none' },
  },
  // --- 4 Google riders: current, selectable hierarchy products whose grants ride the google group ---
  google_tag_manager: {
    kind: 'product',
    parent: 'google',
    authorizesViaParent: true,
    clientAuthorizable: false,
    displayName: 'Tag Manager',
  },
  google_merchant_center: {
    kind: 'product',
    parent: 'google',
    authorizesViaParent: true,
    clientAuthorizable: false,
    displayName: 'Merchant Center',
  },
  google_search_console: {
    kind: 'product',
    parent: 'google',
    authorizesViaParent: true,
    clientAuthorizable: false,
    displayName: 'Search Console',
  },
  google_business_profile: {
    kind: 'product',
    parent: 'google',
    authorizesViaParent: true,
    clientAuthorizable: false,
    displayName: 'Business Profile',
  },
  // --- 3 legacy payload ids; parents per the web normalizer (transform-platforms.ts) ---
  whatsapp_business: {
    kind: 'legacy',
    parent: 'meta',
    displayName: 'WhatsApp Business',
  },
  youtube_studio: {
    kind: 'legacy',
    parent: 'google',
    displayName: 'YouTube Studio',
  },
  display_video_360: {
    kind: 'legacy',
    parent: 'google',
    displayName: 'Display & Video 360',
  },
} satisfies Record<string, PlatformRegistryEntry>;

export type PlatformRegistryId = keyof typeof PLATFORMS & string;

/**
 * Payload history, not a platform property: these ids still arrive in stored
 * platforms[] rows (access-request payloads predate the current catalog), so
 * the API must keep accepting them. Four are demoted hierarchy products; three
 * exist nowhere else. Deliberately a named set, not per-entry flags (DEC-015).
 */
export const LEGACY_PAYLOAD_IDS: ReadonlySet<PlatformRegistryId> = new Set<PlatformRegistryId>([
  'whatsapp_business',
  'google_tag_manager',
  'google_merchant_center',
  'google_search_console',
  'youtube_studio',
  'google_business_profile',
  'display_video_360',
]);

const ENTRIES = Object.entries(PLATFORMS) as readonly [PlatformRegistryId, PlatformRegistryEntry][];

export const platformIds: readonly PlatformRegistryId[] = ENTRIES.map(([id]) => id);

/** The client OAuth gate: platforms whose client-facing flow is OAuth and that accept client OAuth steps. */
export const clientOAuthPlatforms: readonly PlatformRegistryId[] = ENTRIES.filter(
  ([, entry]) => entry.clientAuthorizable === true
).map(([id]) => id);

/** Platforms authorized outside OAuth: manual invitation or API key. */
export const manualConfirmationPlatforms: readonly PlatformRegistryId[] = ENTRIES.filter(
  ([, entry]) => entry.capabilities !== undefined && entry.capabilities.connectionMethod !== 'oauth'
).map(([id]) => id);

/**
 * Platforms the connector factory can serve: every entry with an OAuth
 * transport plus the api_key connector (beehiiv). Manual-invite platforms
 * (kit, mailchimp, pinterest, klaviyo, zapier) have no connector. The api
 * factory's key set is pinned to this derivation (DEC-015 Phase 2b).
 */
export const connectorPlatformIds: readonly PlatformRegistryId[] = ENTRIES.filter(
  ([, entry]) =>
    entry.oauth !== undefined ||
    (entry.capabilities !== undefined && entry.capabilities.connectionMethod === 'api_key')
).map(([id]) => id);

export function getPlatform(id: PlatformRegistryId): PlatformRegistryEntry {
  return PLATFORMS[id];
}
