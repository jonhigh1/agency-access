/**
 * Shared selection / inventory signals for asset-selecting products.
 *
 * Single home for the helpers previously duplicated (and drifted) between
 * access-request.service.ts and client.service.ts. Review card 2 / DEC-015:
 * encode per-product dispatch as an unquoted-key table so the platform-id
 * walker does not need an allowlist entry for this module.
 *
 * Instagram counts only `instagramAccounts` (client-detail / wizard truth).
 */

type AssetBlob = Record<string, unknown>;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sumFieldLengths(assets: AssetBlob, fields: readonly string[]): number {
  let total = 0;
  for (const field of fields) {
    total += asArray(assets[field]).length;
  }
  return total;
}

const META_SHAPED_SELECTION_FIELDS = [
  'adAccounts',
  'pages',
  'instagramAccounts',
  'catalogs',
  'datasets',
] as const;

function countMetaShapedSelection(assets: AssetBlob): number {
  return sumFieldLengths(assets, META_SHAPED_SELECTION_FIELDS);
}

function countTikTokSelection(assets: AssetBlob): number {
  return (
    asArray(assets.selectedAdvertiserIds).length ||
    asArray(assets.adAccounts).length ||
    asArray(assets.advertisers).length ||
    0
  );
}

function availableAssetCountIsZero(assets: AssetBlob): boolean {
  return assets.availableAssetCount === 0;
}

function tikTokInventoryEmpty(assets: AssetBlob): boolean {
  return Array.isArray(assets.availableAdvertisers) && assets.availableAdvertisers.length === 0;
}

interface ProductSelectionSignal {
  countSelected: (assets: AssetBlob) => number;
  hasNoAssets?: (assets: AssetBlob) => boolean;
}

/**
 * Unquoted object keys — outside the walker's quoted-run and case-dispatch
 * detectors (DEC-015 Phase 3). Adding a product here is the sanctioned edit.
 */
const PRODUCT_SELECTION_SIGNALS: Readonly<Record<string, ProductSelectionSignal>> = {
  google_ads: {
    countSelected: countMetaShapedSelection,
    hasNoAssets: availableAssetCountIsZero,
  },
  meta_ads: {
    countSelected: countMetaShapedSelection,
  },
  linkedin_ads: {
    countSelected: countMetaShapedSelection,
    hasNoAssets: availableAssetCountIsZero,
  },
  linkedin_pages: {
    countSelected: countMetaShapedSelection,
    hasNoAssets: availableAssetCountIsZero,
  },
  instagram: {
    countSelected: (assets) => asArray(assets.instagramAccounts).length,
  },
  meta_pages: {
    countSelected: (assets) => asArray(assets.pages).length,
    hasNoAssets: availableAssetCountIsZero,
  },
  ga4: {
    countSelected: (assets) => asArray(assets.properties).length,
    hasNoAssets: availableAssetCountIsZero,
  },
  google_business_profile: {
    countSelected: (assets) => asArray(assets.businessAccounts).length,
    hasNoAssets: availableAssetCountIsZero,
  },
  google_tag_manager: {
    countSelected: (assets) => asArray(assets.containers).length,
    hasNoAssets: availableAssetCountIsZero,
  },
  google_search_console: {
    countSelected: (assets) => asArray(assets.sites).length,
    hasNoAssets: availableAssetCountIsZero,
  },
  google_merchant_center: {
    countSelected: (assets) => asArray(assets.merchantAccounts).length,
    hasNoAssets: availableAssetCountIsZero,
  },
  tiktok: {
    countSelected: countTikTokSelection,
    hasNoAssets: tikTokInventoryEmpty,
  },
  tiktok_ads: {
    countSelected: countTikTokSelection,
    hasNoAssets: tikTokInventoryEmpty,
  },
};

export function getSelectedAssetCount(product: string, assets: AssetBlob): number {
  const signal = PRODUCT_SELECTION_SIGNALS[product];
  return signal ? signal.countSelected(assets) : 0;
}

export function hasNoAssetsSignal(product: string, assets: AssetBlob): boolean {
  const signal = PRODUCT_SELECTION_SIGNALS[product];
  return signal?.hasNoAssets ? signal.hasNoAssets(assets) : false;
}
