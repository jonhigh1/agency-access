/**
 * Pure helpers for Meta invite resume / prefill (architecture card 3 / U6).
 * Session effects stay in useMetaResumePrefill; this file has no React.
 */

import type { MetaSelectionBlob } from '@/components/client-auth/meta-selection-blob';
import {
  hasSelectableAssets,
  type InviteSelectionPrefill,
} from '@/lib/invite/landing-state';

export function hasRetainedMetaSelection(
  expected: InviteSelectionPrefill | null,
  actual: MetaSelectionBlob | undefined
): boolean {
  if (!expected || !actual) return false;
  const matches = (saved: string[], selected: string[]) =>
    saved.length === selected.length && saved.every((id) => selected.includes(id));
  return (
    matches(expected.adAccounts, actual.adAccounts) &&
    matches(expected.pages, actual.pages) &&
    matches(expected.instagramAccounts, actual.instagramAccounts) &&
    matches(expected.catalogs, actual.catalogs) &&
    matches(expected.datasets, actual.datasets)
  );
}

/** Serialized key for popup-resume prefill sync (#10). Empty when no prefill. */
export function invitePrefillSyncKey(
  metaNeedsGrantStep: boolean,
  initialMetaSelections: InviteSelectionPrefill | null | undefined
): string {
  if (!metaNeedsGrantStep || !hasSelectableAssets(initialMetaSelections)) {
    return '';
  }
  return JSON.stringify(initialMetaSelections);
}

/** Seed groupAssets when the invite payload already carries Meta selections. */
export function buildMetaGroupAssetsSeedFromPrefill(
  prefill: InviteSelectionPrefill,
  businessId?: string
): Record<string, MetaSelectionBlob> {
  const selectedAssets: MetaSelectionBlob = {
    ...prefill,
    selectedBusinessId: businessId,
    selectedAdAccountsWithNames: prefill.adAccounts.map((id) => ({ id, name: id })),
    selectedPagesWithNames: prefill.pages.map((id) => ({ id, name: id })),
    selectedInstagramWithNames: prefill.instagramAccounts.map((id) => ({ id, name: id })),
    selectedCatalogsWithNames: prefill.catalogs.map((id) => ({ id, name: id })),
    selectedDatasetsWithNames: prefill.datasets.map((id) => ({ id, name: id })),
  };
  return {
    meta_ads: selectedAssets,
    meta_pages: selectedAssets,
    instagram: selectedAssets,
  };
}
