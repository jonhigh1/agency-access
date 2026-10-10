/**
 * Invite wizard selection counts, summary lines, and CTA zero-selection mode.
 *
 * Extracted from PlatformAuthWizard (architecture review card 3 / U5).
 * Unquoted-key tables keep this module outside the platform-id walker's
 * case-dispatch detector (DEC-015). Instagram counts only `instagramAccounts`
 * (mirrors API product-selection-signals). TikTok keeps the wizard rule:
 * selectedAdvertiserIds || adAccounts — not the advertisers array.
 */

import type { MetaSelectionBlob } from '@/components/client-auth/meta-selection-blob';
import type {
  CtaProductSelectionState,
  ZeroSelectionMode,
} from '@/lib/invite/cta-reason';
import type { MetaGrantChecklist } from '@/lib/invite/meta-grant-checklist';

/** Meta products that share the MetaAssetSelector blob. */
export type MetaAssetProduct = 'meta_ads' | 'meta_pages' | 'instagram';

/**
 * Wizard selection blob: Meta shape plus Google/TikTok product fields the
 * same groupAssets slots carry.
 */
export type ProductSelectionAssets = MetaSelectionBlob & {
  properties?: string[];
  businessAccounts?: string[];
  containers?: string[];
  sites?: string[];
  merchantAccounts?: string[];
  selectedAdvertiserIds?: string[];
};

const META_ASSET_PRODUCTS: Readonly<Record<MetaAssetProduct, true>> = {
  meta_ads: true,
  meta_pages: true,
  instagram: true,
};

export function isMetaAssetProduct(product: string): product is MetaAssetProduct {
  return Object.prototype.hasOwnProperty.call(META_ASSET_PRODUCTS, product);
}

export function isGoogleProduct(product: string): boolean {
  return product.startsWith('google_') || product === 'ga4';
}

export function supportsAssetSelection(product: string): boolean {
  return (
    isMetaAssetProduct(product) ||
    product.startsWith('google_') ||
    product === 'ga4' ||
    product === 'linkedin_ads' ||
    product === 'linkedin_pages' ||
    product === 'tiktok' ||
    product === 'tiktok_ads'
  );
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sumFieldLengths(
  assets: ProductSelectionAssets,
  fields: readonly (keyof ProductSelectionAssets)[]
): number {
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

function countMetaShapedSelection(assets: ProductSelectionAssets): number {
  return sumFieldLengths(assets, META_SHAPED_SELECTION_FIELDS);
}

/** Wizard TikTok rule — selectedAdvertiserIds || adAccounts only. */
function countTikTokSelection(assets: ProductSelectionAssets): number {
  return (
    asArray(assets.selectedAdvertiserIds).length ||
    asArray(assets.adAccounts).length ||
    0
  );
}

interface ProductCountSignal {
  countSelected: (assets: ProductSelectionAssets) => number;
}

/**
 * Unquoted object keys — walker-safe (DEC-015 Phase 3).
 */
const PRODUCT_SELECTION_COUNTS: Readonly<Record<string, ProductCountSignal>> = {
  google_ads: { countSelected: countMetaShapedSelection },
  meta_ads: { countSelected: countMetaShapedSelection },
  linkedin_ads: { countSelected: countMetaShapedSelection },
  linkedin_pages: { countSelected: countMetaShapedSelection },
  meta_pages: {
    countSelected: (assets) => asArray(assets.pages).length,
  },
  instagram: {
    countSelected: (assets) => asArray(assets.instagramAccounts).length,
  },
  ga4: {
    countSelected: (assets) => asArray(assets.properties).length,
  },
  google_business_profile: {
    countSelected: (assets) => asArray(assets.businessAccounts).length,
  },
  google_tag_manager: {
    countSelected: (assets) => asArray(assets.containers).length,
  },
  google_search_console: {
    countSelected: (assets) => asArray(assets.sites).length,
  },
  google_merchant_center: {
    countSelected: (assets) => asArray(assets.merchantAccounts).length,
  },
  tiktok: { countSelected: countTikTokSelection },
  tiktok_ads: { countSelected: countTikTokSelection },
};

export function getSelectedAssetCount(
  product: string,
  assets: ProductSelectionAssets
): number {
  const signal = PRODUCT_SELECTION_COUNTS[product];
  return signal ? signal.countSelected(assets) : 0;
}

/**
 * Meta products share one selector blob, but save-assets is product-scoped.
 * Skip secondary products that have nothing of their own to persist so an
 * empty Instagram/Pages save cannot fail a successful ads/pages share.
 */
const META_PRODUCT_PERSIST_PREDICATES: Readonly<
  Record<MetaAssetProduct, (assets: MetaSelectionBlob) => boolean>
> = {
  meta_ads: (assets) =>
    getSelectedAssetCount('meta_ads', assets) > 0 ||
    (assets.declinedAssetKinds?.length ?? 0) > 0,
  meta_pages: (assets) => (assets.pages?.length ?? 0) > 0,
  instagram: (assets) => (assets.instagramAccounts?.length ?? 0) > 0,
};

export function shouldPersistMetaProductSave(
  product: MetaAssetProduct,
  assets: MetaSelectionBlob
): boolean {
  return META_PRODUCT_PERSIST_PREDICATES[product](assets);
}

function availableAssetCountIsZero(assets: MetaSelectionBlob): boolean {
  return assets.availableAssetCount === 0;
}

function tikTokInventoryEmpty(assets: MetaSelectionBlob): boolean {
  return Array.isArray(assets.availableAdvertisers) && assets.availableAdvertisers.length === 0;
}

export function hasNoAssetsFollowUp(
  product: string,
  assets: MetaSelectionBlob
): boolean {
  if (
    (isGoogleProduct(product) ||
      product === 'linkedin_ads' ||
      product === 'linkedin_pages') &&
    availableAssetCountIsZero(assets)
  ) {
    return true;
  }

  if ((product === 'tiktok' || product === 'tiktok_ads') && tikTokInventoryEmpty(assets)) {
    return true;
  }

  return false;
}

export function getMetaFollowUpLines(
  assets: MetaSelectionBlob,
  checklist?: MetaGrantChecklist
): string[] {
  const lines: string[] = [];
  const unresolvedManualResults = Array.isArray(assets.manualAdAccountVerificationResults)
    ? assets.manualAdAccountVerificationResults.filter(
        (result) => result?.status && result.status !== 'verified'
      )
    : [];

  if (unresolvedManualResults.length > 0) {
    unresolvedManualResults.forEach((result) => {
      const assetName =
        typeof result.assetName === 'string' && result.assetName.length > 0
          ? result.assetName
          : typeof result.assetId === 'string'
            ? result.assetId
            : 'Selected ad account';
      lines.push(`Follow-up needed: ${assetName} still needs manual Meta sharing`);
    });
  } else if (assets.manualAdAccountShareStatus === 'partial') {
    lines.push('Follow-up needed: Some ad accounts still require manual sharing');
  }

  const selectedInstagramAccounts = Array.isArray(assets.selectedInstagramWithNames)
    ? assets.selectedInstagramWithNames
    : Array.isArray(assets.instagramAccounts)
      ? assets.instagramAccounts.map((id: string) => ({ id, name: id }))
      : [];

  selectedInstagramAccounts.forEach((account) => {
    const accountName =
      typeof account?.name === 'string' && account.name.length > 0
        ? account.name
        : typeof account?.id === 'string'
          ? account.id
          : 'Selected Instagram account';
    // The checklist machine owns the Instagram state once mounted; the blob
    // flag stays as the fallback for callers without a checklist.
    const instagramState = checklist?.items.find(
      (item) => item.key === 'instagram_account'
    )?.state;
    const instagramVerified =
      instagramState !== undefined
        ? instagramState === 'done'
        : assets.instagramBusinessAccessStatus === 'verified';
    lines.push(
      instagramVerified
        ? `Follow-up needed: ${accountName} agency access is verified; individual recipient access is not verified`
        : `Follow-up needed: ${accountName} needs agency Business Portfolio sharing and verification`
    );
  });

  const selectedDatasets = Array.isArray(assets.selectedDatasetsWithNames)
    ? assets.selectedDatasetsWithNames
    : Array.isArray(assets.datasets)
      ? assets.datasets.map((id: string) => ({ id, name: id }))
      : [];
  // A verified dataset row set is a Done on the checklist: repeating the
  // manual-assignment ask would contradict the Connected header.
  const datasetDone = checklist?.items.some(
    (item) => item.key === 'dataset' && item.state === 'done'
  );
  if (!datasetDone) {
    selectedDatasets.forEach((dataset) => {
      lines.push(
        `Follow-up needed: ${dataset.name || dataset.id} requires manual Meta access assignment and verification`
      );
    });
  }

  return lines;
}

export function hasGrantFollowUp(
  product: string,
  assets: MetaSelectionBlob,
  checklist?: MetaGrantChecklist
): boolean {
  return isMetaAssetProduct(product) && getMetaFollowUpLines(assets, checklist).length > 0;
}

/**
 * Zero available Meta assets cannot be saved (the save API rejects zero
 * assets), so the client must create an asset first (KTD10). The selection
 * blob carries the full available lists, so an all-empty blob means the
 * client's business has nothing to select from.
 */
export function getMetaZeroSelectionMode(
  assets: MetaSelectionBlob,
  allowedAssetTypes: readonly string[]
): ZeroSelectionMode {
  const declineKindByAssetType: Record<string, string> = {
    ad_account: 'ad_account',
    page: 'page',
    instagram: 'instagram_account',
    catalog: 'catalog',
    dataset: 'dataset',
  };
  const declinedKinds = new Set(assets.declinedAssetKinds || []);
  if (
    allowedAssetTypes.length > 0 &&
    allowedAssetTypes.every((type) => declinedKinds.has(declineKindByAssetType[type] as never))
  ) {
    return 'declined-save';
  }
  const availableCount =
    (assets.allAdAccounts?.length ?? 0) +
    (assets.allPages?.length ?? 0) +
    (assets.allInstagramAccounts?.length ?? 0) +
    (assets.allProductCatalogs?.length ?? 0) +
    (assets.allDatasets?.length ?? 0);
  return availableCount === 0 ? 'create-required' : 'selection-required';
}

/** Maps one product's selection blob to the resolver's per-product input. */
export function getProductCtaState(
  product: string,
  assets: MetaSelectionBlob,
  metaAllowedAssetTypes: readonly string[]
): CtaProductSelectionState {
  const zeroSelectionMode: ZeroSelectionMode = isMetaAssetProduct(product)
    ? getMetaZeroSelectionMode(assets, metaAllowedAssetTypes)
    : hasNoAssetsFollowUp(product, assets)
      ? 'follow-up-save'
      : 'selection-required';

  return {
    product,
    selectedCount: getSelectedAssetCount(product, assets),
    zeroSelectionMode,
  };
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function selectedLine(count: number, singular: string, pluralForm: string): string {
  return `${plural(count, singular, pluralForm)} selected`;
}

function emptyInventoryLine(message: string): string[] {
  return [`Follow-up needed: ${message}`];
}

type SummaryBuilder = (
  assets: ProductSelectionAssets,
  checklist?: MetaGrantChecklist
) => string[];

function countOrEmpty(
  count: number,
  singular: string,
  pluralForm: string,
  emptyMessage: string,
  assets: ProductSelectionAssets
): string[] {
  if (count > 0) return [selectedLine(count, singular, pluralForm)];
  if (assets.availableAssetCount === 0) return emptyInventoryLine(emptyMessage);
  return [];
}

function tikTokSummaryLines(assets: ProductSelectionAssets): string[] {
  const selectedCount = assets.selectedAdvertiserIds?.length ?? 0;
  if (selectedCount > 0) {
    return [selectedLine(selectedCount, 'Advertiser', 'Advertisers')];
  }
  const adCount = assets.adAccounts?.length ?? 0;
  if (adCount > 0) {
    return [selectedLine(adCount, 'Advertiser', 'Advertisers')];
  }
  if (Array.isArray(assets.availableAdvertisers) && assets.availableAdvertisers.length === 0) {
    return emptyInventoryLine('No advertisers found yet');
  }
  return [];
}

/**
 * Unquoted object keys — walker-safe (DEC-015 Phase 3).
 */
const PRODUCT_SUMMARY_LINES: Readonly<Record<string, SummaryBuilder>> = {
  google_ads: (assets) =>
    countOrEmpty(
      assets.adAccounts?.length ?? 0,
      'Ad Account',
      'Ad Accounts',
      'No ad accounts found yet',
      assets
    ),
  ga4: (assets) =>
    countOrEmpty(
      assets.properties?.length ?? 0,
      'Property',
      'Properties',
      'No properties found yet',
      assets
    ),
  google_business_profile: (assets) =>
    countOrEmpty(
      assets.businessAccounts?.length ?? 0,
      'Location',
      'Locations',
      'No locations found yet',
      assets
    ),
  google_tag_manager: (assets) =>
    countOrEmpty(
      assets.containers?.length ?? 0,
      'Container',
      'Containers',
      'No containers found yet',
      assets
    ),
  google_search_console: (assets) =>
    countOrEmpty(
      assets.sites?.length ?? 0,
      'Site',
      'Sites',
      'No sites found yet',
      assets
    ),
  google_merchant_center: (assets) =>
    countOrEmpty(
      assets.merchantAccounts?.length ?? 0,
      'Account',
      'Accounts',
      'No Merchant Center accounts found yet',
      assets
    ),
  meta_ads: (assets, checklist) => {
    const lines: string[] = [];
    const adCount = assets.adAccounts?.length ?? 0;
    const pageCount = assets.pages?.length ?? 0;
    const igCount = assets.instagramAccounts?.length ?? 0;
    if (adCount > 0) lines.push(selectedLine(adCount, 'Ad Account', 'Ad Accounts'));
    if (pageCount > 0) lines.push(selectedLine(pageCount, 'Page', 'Pages'));
    if (igCount > 0) lines.push(selectedLine(igCount, 'IG Account', 'IG Accounts'));
    lines.push(...getMetaFollowUpLines(assets, checklist));
    return lines;
  },
  meta_pages: (assets) => {
    const pageCount = assets.pages?.length ?? 0;
    if (pageCount > 0) return [selectedLine(pageCount, 'Page', 'Pages')];
    return [];
  },
  linkedin_ads: (assets) =>
    countOrEmpty(
      assets.adAccounts?.length ?? 0,
      'Ad Account',
      'Ad Accounts',
      'No ad accounts found yet',
      assets
    ),
  linkedin_pages: (assets) =>
    countOrEmpty(
      assets.pages?.length ?? 0,
      'Page',
      'Pages',
      'No pages found yet',
      assets
    ),
  tiktok: tikTokSummaryLines,
  tiktok_ads: tikTokSummaryLines,
};

export function getProductSummaryLines(
  product: string,
  assets: ProductSelectionAssets,
  checklist?: MetaGrantChecklist
): string[] {
  const builder = PRODUCT_SUMMARY_LINES[product];
  return builder ? builder(assets, checklist) : [];
}
