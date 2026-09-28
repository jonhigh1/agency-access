import type { MetaAssetKind } from '@agency-platform/shared';

/**
 * The Meta selection blob the wizard stores under `groupAssets.meta_ads` and
 * reads structurally (review #36): what MetaAssetSelector emits through
 * `onSelectionChange`, the grant step consumes, and `evaluateMetaProductFulfillment`
 * reads back. KTD5's preserved keys (`selectedBusinessId`,
 * `manualAdAccountShareStatus` on the grant path, verification results) stay
 * unchanged; this interface names the shape instead of leaking `any`.
 */
export interface MetaSelectionBlob {
  adAccounts: string[];
  pages: string[];
  instagramAccounts: string[];
  catalogs: string[];
  datasets: string[];

  selectedBusinessId?: string;
  selectedBusinessName?: string;
  businesses?: Array<{
    id: string;
    name: string;
    verificationStatus?: string;
    verticalName?: string;
  }>;
  selectionRequired?: boolean;

  /** True only after the asset fetch resolved; empty lists alone are the mount state (#3). */
  assetsLoaded?: boolean;

  /** Non-Meta product fields the same wizard slots carry (google/tiktok). */
  availableAssetCount?: number;
  availableAdvertisers?: unknown[];

  /** Manual Meta ad-account share state persisted on the blob (U9 consumers). */
  manualAdAccountShareStatus?: 'idle' | 'waiting_for_manual_share' | 'partial' | 'verified';
  /** Instagram business-link verification outcome emitted with the blob. */
  instagramBusinessAccessStatus?: string;
  manualAdAccountVerificationResults?: Array<{
    assetId: string;
    assetName?: string;
    status: string;
    verifiedAt?: string;
    errorMessage?: string;
    assignedTasks?: string[];
  }>;

  selectedPagesWithNames?: Array<{ id: string; name: string }>;
  selectedAdAccountsWithNames?: Array<{ id: string; name: string }>;
  selectedInstagramWithNames?: Array<{ id: string; name: string }>;
  selectedCatalogsWithNames?: Array<{ id: string; name: string }>;
  selectedDatasetsWithNames?: Array<{ id: string; name: string }>;
  selectedAssetNames?: string[];

  allPages?: Array<{ id: string; name: string; avatar?: string; category?: string }>;
  allAdAccounts?: Array<{ id: string; name: string; status?: string; currency?: string }>;
  allInstagramAccounts?: Array<{ id: string; username: string }>;
  allProductCatalogs?: Array<{ id: string; name: string; catalogType?: string; ownershipType?: string }>;
  allDatasets?: Array<{ id: string; name: string }>;
}

/** Asset kinds the blob's per-kind arrays map onto. */
export type MetaSelectionBlobKind = Exclude<MetaAssetKind, 'unknown'>;
