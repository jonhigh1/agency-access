'use client';

/**
 * MetaGrantChecklist - the step-3 pending-grant checklist for Meta.
 *
 * One bordered row per selected or declined Meta asset kind. Server truth
 * (the invite payload's `metaFulfillment` rows) rolls up per kind through the
 * pure machine in lib/invite/meta-grant-checklist.ts; a client-side decline
 * list removes kinds the client said they cannot share; the overlay carries
 * optimistic local state until the page's refetch lands. The component owns
 * no wizard state and never navigates steps — every panel outcome is reported
 * through `onItemSettled(kind, state)` and the parent decides what it means.
 *
 * Callback identity contract: AdAccountSharingInstructions refires its mount
 * effect when a callback changes identity, so every panel callback below is
 * a stable useCallback over [onItemSettled]/[onError]. Never inline a closure
 * into that panel's props.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StatusBadge, type StatusVariant } from '@/components/ui/status-badge';
import { trackClientGrantItemCompleted } from '@/lib/analytics/invite-events';
import { AutomaticPagesGrant } from './AutomaticPagesGrant';
import { CatalogAccessGrant } from './CatalogAccessGrant';
import { InstagramAccessGrant } from './InstagramAccessGrant';
import { MetaPageEngagementProof } from './MetaPageEngagementProof';
import {
  AdAccountSharingInstructions,
  type ManualMetaShareCompletionResult,
} from './AdAccountSharingInstructions';
import { MetaDatasetVerifyPanel } from './MetaDatasetVerifyPanel';
import type { MetaSelectionBlob } from './meta-selection-blob';
import {
  buildMetaGrantChecklist,
  type MetaGrantChecklistItem,
  type MetaGrantItemState,
  type MetaGrantSelectedKinds,
} from '@/lib/invite/meta-grant-checklist';
import type { MetaAssetDecline, MetaFulfillmentResult } from '@agency-platform/shared';

/**
 * Selection counts per kind, read only from the blob's id arrays. Shared with
 * the wizard's remaining-count memo so both call sites of the pure machine
 * see identical inputs (and any future blob fields stay irrelevant here).
 */
export function metaGrantSelectedKindsFromBlob(
  selectedAssets?: MetaSelectionBlob
): MetaGrantSelectedKinds {
  return {
    adAccounts: selectedAssets?.adAccounts?.length ?? 0,
    pages: selectedAssets?.pages?.length ?? 0,
    instagramAccounts: selectedAssets?.instagramAccounts?.length ?? 0,
    catalogs: selectedAssets?.catalogs?.length ?? 0,
    datasets: selectedAssets?.datasets?.length ?? 0,
  };
}

/** State chip: existing badge variants, explicit client-voiced labels. */
const STATE_BADGE: Record<MetaGrantItemState, { badgeVariant: StatusVariant; label: string }> = {
  done: { badgeVariant: 'success', label: 'Done' },
  pending: { badgeVariant: 'warning', label: 'Pending' },
  action_required: { badgeVariant: 'danger', label: 'Action needed' },
  declined: { badgeVariant: 'default', label: 'Declined' },
};

type NamedAsset = { id: string; name: string };

interface MetaGrantChecklistProps {
  /** Fulfillment rows from the invite payload. Absent on a fresh save. */
  rows?: MetaFulfillmentResult[];
  /** Kinds the client explicitly declined to share. */
  declines?: MetaAssetDecline[];
  /** The Meta selection blob from groupAssets['meta_ads']. */
  selectedAssets?: MetaSelectionBlob;
  connectionId: string;
  accessRequestToken: string;
  /** Agency Business Portfolio id; null while the lookup is pending. */
  businessId: string | null;
  businessName?: string | null;
  onError?: (message: string) => void;
  /** The only out-bound signal a panel has. Never navigates steps. */
  onItemSettled: (kind: string, state: MetaGrantItemState) => void;
  /** Optimistic state overrides keyed by assetKind; wins until the refetch. */
  overlay?: Readonly<Record<string, MetaGrantItemState>>;
  /** Selector parity flag; catalog UI already gates on the selection blob. */
  metaCatalogEnabled?: boolean;
}

/** Kinds with a panel the client can act on right now. */
function isActionable(item: MetaGrantChecklistItem): boolean {
  return item.state === 'pending' || item.state === 'action_required';
}

export function MetaGrantChecklist({
  rows,
  declines,
  selectedAssets,
  connectionId,
  accessRequestToken,
  businessId,
  businessName,
  onError,
  onItemSettled,
  overlay,
}: MetaGrantChecklistProps) {
  const checklist = useMemo(
    () =>
      buildMetaGrantChecklist({
        rows,
        declines,
        selectedKinds: metaGrantSelectedKindsFromBlob(selectedAssets),
        overlay,
      }),
    [rows, declines, selectedAssets, overlay]
  );

  // Single completion funnel for panel settles: only a `done` settle counts
  // as completed — an `action_required` settle is a failure, not a completion.
  // Stable identity: see the callback contract note above.
  const settleItem = useCallback(
    (kind: string, state: MetaGrantItemState) => {
      if (state === 'done') {
        trackClientGrantItemCompleted({ item_kind: kind, source: 'panel' });
      }
      onItemSettled(kind, state);
    },
    [onItemSettled]
  );

  // Server-truth completions: a refetch can flip an item to `done` without any
  // panel (the client finished the steps in Meta directly, then checked again).
  // Only the pending -> done transition fires, and never while the optimistic
  // overlay already claims `done` for that kind (the panel path reported it),
  // so one completion is reported exactly once.
  const previousStatesRef = useRef<Map<string, MetaGrantItemState> | null>(null);
  useEffect(() => {
    const previous = previousStatesRef.current;
    const next = new Map(checklist.items.map((item) => [item.key, item.state]));
    if (previous) {
      for (const item of checklist.items) {
        const before = previous.get(item.key);
        if (
          before &&
          before !== 'done' &&
          item.state === 'done' &&
          overlay?.[item.assetKind] !== 'done'
        ) {
          trackClientGrantItemCompleted({ item_kind: item.assetKind, source: 'server' });
        }
      }
    }
    previousStatesRef.current = next;
  }, [checklist, overlay]);

  // Stable per-kind settle callbacks — see the identity contract note above.
  const handlePagesGrantComplete = useCallback(
    (results: Array<{ status: string }>) => {
      const allGranted = results.length > 0 && results.every((result) => result.status === 'granted');
      settleItem('page', allGranted ? 'done' : 'action_required');
    },
    [settleItem]
  );

  const handleAdAccountComplete = useCallback(
    (result: ManualMetaShareCompletionResult) => {
      settleItem('ad_account', result.status === 'verified' ? 'done' : 'action_required');
    },
    [settleItem]
  );

  const handleCatalogComplete = useCallback(
    (verified: boolean) => {
      settleItem('catalog', verified ? 'done' : 'action_required');
    },
    [settleItem]
  );

  const handleInstagramComplete = useCallback(
    (verified: boolean) => {
      settleItem('instagram_account', verified ? 'done' : 'action_required');
    },
    [settleItem]
  );

  const handleDatasetSettled = useCallback(
    (state: 'done' | 'action_required') => {
      settleItem('dataset', state);
    },
    [settleItem]
  );

  if (!checklist.hasAny) return null;

  const metaAssets: MetaSelectionBlob = selectedAssets || {
    adAccounts: [],
    pages: [],
    instagramAccounts: [],
    catalogs: [],
    datasets: [],
  };
  const allPages = metaAssets.allPages || [];
  const allAdAccounts = metaAssets.allAdAccounts || [];
  const allCatalogs = metaAssets.allProductCatalogs || [];

  // Selected-asset name arrays, derived exactly as the old step-2 grant
  // section did (WithNames arrays first, id + fallback-name otherwise).
  const selectedPages: NamedAsset[] =
    metaAssets.selectedPagesWithNames ||
    (metaAssets.pages || []).map((id: string) => ({
      id,
      name: allPages.find((page) => page.id === id)?.name || id,
    }));
  const selectedAdAccounts: NamedAsset[] =
    metaAssets.selectedAdAccountsWithNames ||
    (metaAssets.adAccounts || []).map((id: string) => ({
      id,
      name: allAdAccounts.find((account) => account.id === id)?.name || id,
    }));
  const selectedCatalogs: NamedAsset[] =
    metaAssets.selectedCatalogsWithNames ||
    (metaAssets.catalogs || []).map((id: string) => ({
      id,
      name: allCatalogs.find((catalog) => catalog.id === id)?.name || id,
    }));
  const selectedInstagramAccounts: NamedAsset[] =
    metaAssets.selectedInstagramWithNames ||
    (metaAssets.instagramAccounts || []).map((id: string) => ({ id, name: id }));
  const selectedDatasets: NamedAsset[] =
    metaAssets.selectedDatasetsWithNames ||
    (metaAssets.datasets || []).map((id: string) => ({ id, name: id }));

  // Ad-account server truth drives the panel's start behavior: any row past
  // `selected` means Meta sharing was already attempted, so the checklist
  // mounts verify-only and must not refire the start POST.
  const adAccountRows = (rows || []).filter((row) => row.assetKind === 'ad_account');
  const adAccountSharingAttempted = adAccountRows.some((row) => row.status !== 'selected');
  const adAccountInitialStatus: 'idle' | 'verified' | 'partial' = adAccountRows.some(
    (row) => row.status === 'verified'
  )
    ? adAccountRows.every((row) => row.status === 'verified')
      ? 'verified'
      : 'partial'
    : 'idle';
  // Rows are per (asset, recipient): roll up to one result per asset, verified
  // only when every recipient row for it verified.
  const adAccountResultsByAsset = new Map<string, { verified: boolean; name: string; message?: string }>();
  for (const row of adAccountRows) {
    const existing = adAccountResultsByAsset.get(row.assetId);
    const verified = row.status === 'verified';
    if (!existing) {
      adAccountResultsByAsset.set(row.assetId, {
        verified,
        name: row.assetName,
        message: verified ? undefined : row.errorMessage,
      });
    } else {
      existing.verified = existing.verified && verified;
      existing.message = existing.message || (verified ? undefined : row.errorMessage);
    }
  }
  const adAccountInitialVerificationResults =
    adAccountResultsByAsset.size > 0
      ? Array.from(adAccountResultsByAsset.entries()).map(([assetId, rolled]) => ({
          assetId,
          assetName: rolled.name,
          status: rolled.verified ? ('verified' as const) : ('unresolved' as const),
          errorMessage: rolled.message,
        }))
      : undefined;

  const clientBusinessId =
    typeof metaAssets.selectedBusinessId === 'string' ? metaAssets.selectedBusinessId : null;
  // The old grant section rendered this when ad accounts or Instagram needed
  // a panel but the agency Business Portfolio lookup had not landed.
  const needsBusinessId =
    !businessId &&
    ((adAccountResultsByAsset.size > 0 || (metaAssets.adAccounts?.length ?? 0) > 0) ||
      selectedInstagramAccounts.length > 0);

  const businessIdNotice = needsBusinessId ? (
    <div className="mt-3 border-2 border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-ink">
      Loading Business Manager ID...
    </div>
  ) : null;

  const panelFor = (item: MetaGrantChecklistItem) => {
    if (!isActionable(item)) return null;

    switch (item.assetKind) {
      case 'page':
        return (
          <div className="mt-3 space-y-4">
            {selectedPages.map((selectedPage) => (
              <MetaPageEngagementProof
                key={selectedPage.id}
                selectedPage={selectedPage}
                connectionId={connectionId}
                accessRequestToken={accessRequestToken}
              />
            ))}
            <AutomaticPagesGrant
              selectedPages={selectedPages}
              accessLevel="Admin"
              connectionId={connectionId}
              accessRequestToken={accessRequestToken}
              onGrantComplete={handlePagesGrantComplete}
              onError={onError}
            />
          </div>
        );
      case 'ad_account':
        return (
          <div className="mt-3">
            {businessId ? (
              <AdAccountSharingInstructions
                businessId={businessId}
                businessName={businessName || undefined}
                selectedAdAccounts={selectedAdAccounts}
                accessRequestToken={accessRequestToken}
                connectionId={connectionId}
                autoStart={!adAccountSharingAttempted}
                initialStatus={adAccountInitialStatus}
                initialVerificationResults={adAccountInitialVerificationResults}
                onComplete={handleAdAccountComplete}
                onError={onError}
              />
            ) : (
              businessIdNotice
            )}
          </div>
        );
      case 'catalog':
        return (
          <CatalogAccessGrant
            key={JSON.stringify(selectedCatalogs.map((catalog) => catalog.id).sort())}
            catalogs={selectedCatalogs}
            connectionId={connectionId}
            accessRequestToken={accessRequestToken}
            onComplete={handleCatalogComplete}
          />
        );
      case 'instagram_account':
        return (
          <div className="mt-3">
            {businessId && clientBusinessId ? (
              <InstagramAccessGrant
                key={JSON.stringify(selectedInstagramAccounts.map((account) => account.id).sort())}
                accounts={selectedInstagramAccounts}
                clientBusinessId={clientBusinessId}
                agencyBusinessId={businessId}
                connectionId={connectionId}
                accessRequestToken={accessRequestToken}
                onComplete={handleInstagramComplete}
              />
            ) : (
              businessIdNotice
            )}
          </div>
        );
      case 'dataset':
        return (
          <MetaDatasetVerifyPanel
            datasetIds={(metaAssets.datasets || []).slice()}
            datasetNames={selectedDatasets}
            clientBusinessId={clientBusinessId}
            connectionId={connectionId}
            accessRequestToken={accessRequestToken}
            onError={onError}
            onSettled={handleDatasetSettled}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section aria-label="Finish Meta access" className="space-y-3">
      <p className="label-micro">Finish Meta access</p>
      {checklist.items.map((item) => (
        <div
          key={item.key}
          className="border-2 border-black p-4 dark:border-white"
          data-checklist-kind={item.assetKind}
        >
          <div
            className={
              item.state === 'declined'
                ? 'flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3'
                : 'hairline-b flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3'
            }
          >
            <div>
              <h4 className="font-display text-base font-bold text-ink">{item.label}</h4>
              <p className="mt-0.5 text-sm text-muted-foreground">{item.clientAction}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.remainingCount > 0 ? (
                <span className="label-micro">{item.remainingCount} left</span>
              ) : null}
              <StatusBadge badgeVariant={STATE_BADGE[item.state].badgeVariant} size="sm">
                {STATE_BADGE[item.state].label}
              </StatusBadge>
            </div>
          </div>
          {panelFor(item)}
        </div>
      ))}
    </section>
  );
}
