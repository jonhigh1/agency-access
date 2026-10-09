/**
 * Products whose fulfillment state is driven by client asset selection:
 * authorization collects selected assets (ad accounts, pages, datasets)
 * rather than a bare grant.
 *
 * Characterized verbatim from the byte-identical literals this module replaces
 * in access-request.service.ts and client.service.ts (DEC-015, docs/DECISIONS.md).
 * Usage is .has() membership only.
 *
 * Intentionally NOT a registry projection — includes group-level 'tiktok' and
 * omits 'snapchat_ads'. Do not derive this set from the PLATFORMS registry.
 */
export const ASSET_SELECTING_PRODUCTS: ReadonlySet<string> = new Set([
  'google_ads',
  'ga4',
  'google_business_profile',
  'google_tag_manager',
  'google_search_console',
  'google_merchant_center',
  'meta_ads',
  'meta_pages',
  'instagram',
  'linkedin_ads',
  'linkedin_pages',
  'tiktok',
  'tiktok_ads',
]);
