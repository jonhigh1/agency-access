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
import type { PlatformTokenCapability } from '../types.js';

/**
 * Agency-side OAuth transport facts for a platform. Shape declared in Phase 1
 * (DEC-015); populated in Phase 2b when the api connector configs are absorbed.
 */
export interface PlatformOAuthConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: readonly string[];
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
  },
  meta: {
    kind: 'group',
    displayName: 'Meta',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  google_ads: {
    kind: 'product',
    parent: 'google',
    displayName: 'Google Ads',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  ga4: {
    kind: 'product',
    parent: 'google',
    displayName: 'Google Analytics',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  meta_ads: {
    kind: 'product',
    parent: 'meta',
    displayName: 'Meta Ads',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  meta_pages: {
    kind: 'product',
    parent: 'meta',
    displayName: 'Meta Pages',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  tiktok: {
    kind: 'group',
    displayName: 'TikTok Ads',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  tiktok_ads: {
    kind: 'product',
    parent: 'tiktok',
    displayName: 'TikTok Ads',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  linkedin: {
    kind: 'group',
    displayName: 'LinkedIn',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  linkedin_ads: {
    kind: 'product',
    parent: 'linkedin',
    displayName: 'LinkedIn Ads',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  linkedin_pages: {
    kind: 'product',
    parent: 'linkedin',
    displayName: 'LinkedIn Pages',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  snapchat: {
    kind: 'group',
    displayName: 'Snapchat Ads',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  snapchat_ads: {
    kind: 'product',
    parent: 'snapchat',
    displayName: 'Snapchat Ads',
    clientAuthorizable: false,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'automatic', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
  },
  instagram: {
    kind: 'product',
    parent: 'meta',
    displayName: 'Instagram',
    clientAuthorizable: true,
    capabilities: { connectionMethod: 'oauth', tokenKind: 'oauth', refreshStrategy: 'reconnect', healthStrategy: 'live_verify', expiryBehavior: 'expiring' },
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

export function getPlatform(id: PlatformRegistryId): PlatformRegistryEntry {
  return PLATFORMS[id];
}
