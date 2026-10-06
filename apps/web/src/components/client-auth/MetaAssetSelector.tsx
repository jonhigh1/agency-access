'use client';

import { type MetaSelectionBlob } from './meta-selection-blob';
import type { MetaDeclinableAssetKind } from '@agency-platform/shared';

/**
 * MetaAssetSelector - Multi-asset selection for Meta platform
 *
 * Displays three collapsible groups:
 * 1. Ad Accounts
 * 2. Pages
 * 3. Instagram Accounts
 *
 * Features:
 * - Loading states with shimmer animation
 * - Empty state handling
 * - Selection count badge
 * - Sticky footer with Continue button
 */

import { useState, useEffect, useRef } from 'react';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import {
  trackClientAssetsDeclineToggled,
  trackInviteAssetsLoaded,
} from '@/lib/analytics/invite-events';
import { AssetGroup, type Asset } from './AssetGroup';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { AssetSelectorLoading } from './AssetSelectorStates';
import { MetaConnectionErrorPanel } from './MetaConnectionErrorPanel';
import {
  mapMetaConnectionErrorFromApi,
  type MetaConnectionErrorPresentation,
} from '@agency-platform/shared';
import { MetaAssetCreator } from './MetaAssetCreator';
import { MetaBusinessCreator } from './MetaBusinessCreator';
import { ZeroPortfolioPageDiscovery } from './ZeroPortfolioPageDiscovery';
import { MetaBusinessSetupChecklist } from './MetaBusinessSetupChecklist';
import { GuidedRedirectCard } from './GuidedRedirectModal';
import { SelectionResetConfirmDialog } from './SelectionResetConfirmDialog';
import { PortfolioSelector, type PortfolioBusiness } from './PortfolioSelector';
import { MetaSelectedEntitiesSummary } from './MetaSelectedEntitiesSummary';
import { metaAssetOptionDescription } from '@/lib/invite/meta-entity-identity';
import { buildMetaPartnerGrantNarrative } from '@/lib/invite/meta-partner-grant-narrative';
import { clearManualGrantChecklistStorage } from '@/lib/invite/manual-grant-checklist-storage';
import { Briefcase, Camera, FileText, MailX, Plus, ShoppingBag } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { ApiResponseError, parseJsonResponse } from '@/lib/api/parse-json-response';
import { Button } from '@/components/ui/button';
import {
  intersectSelectionPrefill,
  type InviteSelectionPrefill,
} from '@/lib/invite/landing-state';

/** Exact per-kind skip copy: the client's "we don't have / won't share this type" decision. */
const DECLINE_TOGGLE_COPY: Record<MetaDeclinableAssetKind, string> = {
  ad_account: 'No ad accounts to share',
  page: 'No Pages to share',
  instagram_account: 'No Instagram accounts to share',
  catalog: 'No catalogs to share',
  dataset: 'No pixels or datasets to share',
};

/** Emission order for declinedAssetKinds — schema order, so re-emits stay stable. */
const DECLINE_KIND_ORDER: MetaDeclinableAssetKind[] = [
  'ad_account',
  'page',
  'instagram_account',
  'catalog',
  'dataset',
];

interface MetaAssets {
  businesses?: Array<{
    id: string;
    name: string;
    verificationStatus?: string;
    verticalName?: string;
  }>;
  selectedBusinessId?: string | null;
  selectedBusinessName?: string | null;
  selectionRequired?: boolean;
  assetLoadWarnings?: string[];
  adAccounts: Array<{
    id: string;
    name: string;
    status?: string;
    currency?: string;
  }>;
  pages: Array<{
    id: string;
    name: string;
    avatar?: string;
    category?: string;
  }>;
  instagramAccounts: Array<{
    id: string;
    username: string;
    name?: string;
    avatar?: string;
  }>;
  productCatalogs?: Array<{ id: string; name: string; catalogType?: string; ownershipType?: 'owned' | 'client' }>;
  pixels?: Array<{ id: string; name: string }>;
}

interface MetaAssetSelectorProps {
  sessionId: string;
  accessRequestToken: string;
  businessId?: string;
  requestedPageTasks?: string[];
  /**
   * U7 resume prefill: saved asset ids from the invite payload's fulfillment
   * rows. Read once — the first successful asset fetch intersects it with the
   * fresh data, so only still-shared assets are pre-checked. Absent on a
   * fresh connect.
   */
  initialSelection?: InviteSelectionPrefill | null;
  allowedAssetTypes?: Array<'ad_account' | 'page' | 'instagram' | 'catalog' | 'dataset'>;
  onSelectionChange: (selectedAssets: MetaSelectionBlob) => void;
  onError?: (error: string) => void;
  /**
   * Called after this selector wipes its selection-derived state (switch
   * business, business re-load) so the parent can clear its own derived
   * state (saved flag, grant flags, verification results) in the same pass.
   */
  onSelectionDerivedStateReset?: () => void;
}

export function MetaAssetSelector({
  sessionId,
  accessRequestToken,
  businessId,
  requestedPageTasks = [],
  initialSelection,
  allowedAssetTypes = ['ad_account', 'page', 'instagram'],
  onSelectionChange,
  onSelectionDerivedStateReset,
  onError,
}: MetaAssetSelectorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<MetaAssets | null>(null);
  const [connectionError, setConnectionError] = useState<MetaConnectionErrorPresentation | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [selectedBusinessName, setSelectedBusinessName] = useState<string | null>(null);
  const [zeroPortfolioPrimaryPageId, setZeroPortfolioPrimaryPageId] = useState('');

  // A resume prefill can arrive after this component mounts. Consume each
  // value once for its session after fresh assets are available.
  const appliedInitialSelectionKey = useRef<string | null>(null);
  const selectionSessionId = useRef(sessionId);
  const [resolvedPrefillSessionKey, setResolvedPrefillSessionKey] = useState<string | null>(null);
  const initialSelectionKey = initialSelection ? JSON.stringify(initialSelection) : null;
  const initialSelectionSessionKey = initialSelectionKey ? `${sessionId}:${initialSelectionKey}` : null;

  // Selection state, seeded from the resume prefill when present.
  const [selectedAdAccounts, setSelectedAdAccounts] = useState<Set<string>>(
    () => new Set(initialSelection?.adAccounts ?? [])
  );
  const [selectedPages, setSelectedPages] = useState<Set<string>>(
    () => new Set(initialSelection?.pages ?? [])
  );
  const [selectedInstagram, setSelectedInstagram] = useState<Set<string>>(
    () => new Set(initialSelection?.instagramAccounts ?? [])
  );
  const [selectedCatalogs, setSelectedCatalogs] = useState<Set<string>>(
    () => new Set(initialSelection?.catalogs ?? [])
  );
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(
    () => new Set(initialSelection?.datasets ?? [])
  );
  // Per-type decline ("we don't have / won't share this type"). Kept outside the
  // fetch: a re-fetch of the same portfolio must not drop an explicit decision;
  // only a selection of that kind (or a selection-derived reset) withdraws it.
  const [declinedKinds, setDeclinedKinds] = useState<Set<MetaDeclinableAssetKind>>(new Set());
  const [showCatalogCreator, setShowCatalogCreator] = useState(false);
  const [catalogName, setCatalogName] = useState('');
  const [catalogCreationErrorsFor, setCatalogCreationErrorsFor] = useState<Record<string, string>>({});
  const [catalogCreationNeedsReviewFor, setCatalogCreationNeedsReviewFor] = useState<Set<string>>(new Set());
  const [isRefreshingCatalogs, setIsRefreshingCatalogs] = useState(false);
  const [catalogCreated, setCatalogCreated] = useState<{ id: string; name: string } | null>(null);
  const [isCreatingCatalog, setIsCreatingCatalog] = useState(false);
  const [adAccountCreationNeedsReviewFor, setAdAccountCreationNeedsReviewFor] = useState<Set<string>>(new Set());

  // Creation UI state
  const [showAdAccountCreator, setShowAdAccountCreator] = useState(false);
  const [showPageCreator, setShowPageCreator] = useState(false);

  // Business creation state (zero-portfolio clients)
  const [userPages, setUserPages] = useState<Array<{ id: string; name: string; category?: string }> | null>(null);
  const [userPagesLoading, setUserPagesLoading] = useState(false);
  const [userPagesError, setUserPagesError] = useState<string | null>(null);
  const [businessCreationNeedsReview, setBusinessCreationNeedsReview] = useState(false);
  const [createdBusiness, setCreatedBusiness] = useState<{ id: string; name: string } | null>(null);
  const userPagesFetchedFor = useRef<string | null>(null);

  // Reset confirmation (never destroy a live selection silently). Holds the
  // newly confirmed business until the client accepts the reset.
  const [pendingResetConfirm, setPendingResetConfirm] = useState<PortfolioBusiness | null>(null);

  // Track if we've already captured the event (to avoid duplicates)
  const hasTrackedSelection = useRef(false);
  // U11: report invite_assets_loaded once per business per component life, so
  // re-fetches of the same portfolio (creation refresh, retry) never re-fire.
  const assetsLoadedReportedForRef = useRef<Set<string>>(new Set());
  const activeBusinessId = selectedBusinessId || (assets?.selectionRequired ? undefined : businessId || undefined);
  const activeBusinessIdRef = useRef(activeBusinessId);
  const assetFetchVersion = useRef(0);
  const businessCreationVersion = useRef(0);
  activeBusinessIdRef.current = activeBusinessId;
  const showAdAccounts = allowedAssetTypes.includes('ad_account');
  const showPages = allowedAssetTypes.includes('page');
  const showInstagramAccounts = allowedAssetTypes.includes('instagram');
  const showCatalogs = allowedAssetTypes.includes('catalog');
  const showPixels = allowedAssetTypes.includes('dataset');

  const assetTypeLabel = [
    showAdAccounts ? 'ad accounts' : null,
    showPages ? 'pages' : null,
    showInstagramAccounts ? 'Instagram accounts' : null,
    showCatalogs ? 'product catalogs' : null,
    showPixels ? 'Pixels and Datasets' : null,
  ]
    .filter(Boolean)
    .join(', ');

  // The prop names kinds 'instagram'; the shared decline kind is 'instagram_account'.
  const kindSelectionSetters: Record<MetaDeclinableAssetKind, (ids: Set<string>) => void> = {
    ad_account: setSelectedAdAccounts,
    page: setSelectedPages,
    instagram_account: setSelectedInstagram,
    catalog: setSelectedCatalogs,
    dataset: setSelectedDatasets,
  };
  const kindSelectionSizes: Record<MetaDeclinableAssetKind, number> = {
    ad_account: selectedAdAccounts.size,
    page: selectedPages.size,
    instagram_account: selectedInstagram.size,
    catalog: selectedCatalogs.size,
    dataset: selectedDatasets.size,
  };

  /** Withdraw a kind's decline: a selection on that kind means the client can share it. */
  const clearKindDecline = (kind: MetaDeclinableAssetKind) =>
    setDeclinedKinds((prev) => {
      if (!prev.has(kind)) return prev;
      const next = new Set(prev);
      next.delete(kind);
      return next;
    });

  /** Single sink for per-kind selections so any selection withdraws that kind's decline. */
  const selectKindAssets = (kind: MetaDeclinableAssetKind, ids: Set<string>) => {
    if (ids.size > 0) clearKindDecline(kind);
    kindSelectionSetters[kind](ids);
  };

  const toggleDecline = (kind: MetaDeclinableAssetKind) => {
    const wasDeclined = declinedKinds.has(kind);
    setDeclinedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
    // Declining also drops any residual selection for the kind.
    if (!wasDeclined) kindSelectionSetters[kind](new Set());
    // Funnel: kind and direction only — never asset names or ids.
    trackClientAssetsDeclineToggled({ asset_kind: kind, checked: !wasDeclined });
  };

  // Handle successful ad account creation - auto-select and refresh
  const handleAdAccountCreated = (newAccount: { id: string; name: string }) => {
    const businessIdForCreation = activeBusinessId;
    if (!businessIdForCreation || activeBusinessIdRef.current !== businessIdForCreation) return;

    fetchAssets(businessIdForCreation).then((refreshed) => {
      if (activeBusinessIdRef.current !== businessIdForCreation) return;
      if (!refreshed?.adAccounts?.some((account) => account.id === newAccount.id)) {
        setAdAccountCreationNeedsReviewFor((current) => new Set([...current, businessIdForCreation]));
        setShowAdAccountCreator(false);
        return;
      }

      clearKindDecline('ad_account');
      setSelectedAdAccounts((prev) => new Set([...prev, newAccount.id]));
      setShowAdAccountCreator(false);
    });
  };

  const handleAdAccountReconcile = async () => {
    const refreshed = await fetchAssets(activeBusinessId);
    if (refreshed && activeBusinessId) {
      setAdAccountCreationNeedsReviewFor((current) => new Set([...current, activeBusinessId]));
      setShowAdAccountCreator(false);
    }
    return Boolean(refreshed);
  };

  const handleBusinessReconcile = async () => {
    const refreshed = await fetchAssets();
    if (refreshed) {
      setBusinessCreationNeedsReview(true);
      if ((refreshed.businesses || []).length > 0) setZeroPortfolioPrimaryPageId('');
    }
    return Boolean(refreshed);
  };

  // Handle page creation - refresh list
  const handlePageCreated = () => {
    fetchAssets(activeBusinessId).then(() => {
      setShowPageCreator(false);
    });
  };

  const handleCatalogCreated = async () => {
    if (!activeBusinessId || !catalogName.trim()) return;
    const businessIdForCreation = activeBusinessId;
    setIsCreatingCatalog(true);
    setCatalogCreationErrorsFor((current) => {
      const next = { ...current };
      delete next[businessIdForCreation];
      return next;
    });
    setCatalogCreated(null);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/client/${accessRequestToken}/create/meta/product-catalog`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId: sessionId, businessId: businessIdForCreation, name: catalogName.trim() }),
        }
      );
      const json = await parseJsonResponse<{ data?: { id: string; name: string }; error?: { code?: string; message?: string } }>(
        response,
        { fallbackErrorMessage: 'Failed to create product catalog' }
      );
      if (json.error) throw new ApiResponseError(json.error.message || 'Meta did not return the created catalog', json.error.code);
      if (!json.data) throw new Error('Meta did not return the created catalog');
      const created = json.data;
      if (activeBusinessIdRef.current !== businessIdForCreation) {
        setCatalogCreationNeedsReviewFor((current) => new Set([...current, businessIdForCreation]));
        return;
      }
      const refreshed = await fetchAssets(businessIdForCreation);
      if (activeBusinessIdRef.current !== businessIdForCreation) {
        setCatalogCreationNeedsReviewFor((current) => new Set([...current, businessIdForCreation]));
        return;
      }
      if (!refreshed) throw new ApiResponseError('Catalog was created, but discovery failed. Refresh this asset list before continuing.', 'CATALOG_DISCOVERY_FAILED');
      if (!refreshed.productCatalogs?.some((catalog) => catalog.id === created.id)) {
        throw new ApiResponseError('Catalog was created but is not visible in this Business Portfolio. Refresh and check its access in Meta.', 'CATALOG_NOT_VISIBLE');
      }
      setCatalogCreated(created);
      setCatalogCreationErrorsFor((current) => {
        const next = { ...current };
        delete next[businessIdForCreation];
        return next;
      });
      setCatalogName('');
      setShowCatalogCreator(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create product catalog';
      const needsReview = (err instanceof ApiResponseError
        && ['CREATION_OUTCOME_UNKNOWN', 'CREATION_IN_PROGRESS', 'CATALOG_DISCOVERY_FAILED', 'CATALOG_NOT_VISIBLE'].includes(err.code || ''));
      if (needsReview) {
        setCatalogCreationNeedsReviewFor((current) => new Set([...current, businessIdForCreation]));
        if (activeBusinessIdRef.current === businessIdForCreation) setShowCatalogCreator(false);
      }
      setCatalogCreationErrorsFor((current) => ({ ...current, [businessIdForCreation]: message }));
    } finally {
      setIsCreatingCatalog(false);
    }
  };

  const refreshCatalogsAfterUnknownCreation = async () => {
    const businessIdForRefresh = activeBusinessIdRef.current;
    setIsRefreshingCatalogs(true);
    try {
      const refreshed = await fetchAssets(businessIdForRefresh);
      if (refreshed && businessIdForRefresh) {
        setCatalogCreationErrorsFor((current) => {
          const next = { ...current };
          delete next[businessIdForRefresh];
          return next;
        });
      }
    } finally {
      setIsRefreshingCatalogs(false);
    }
  };

  const fetchAssets = async (requestedBusinessId?: string) => {
    const fetchVersion = ++assetFetchVersion.current;
    try {
      setIsLoading(true);
      setConnectionError(null);

      const apiUrl = getApiBaseUrl();
      const query = new URLSearchParams({
        connectionId: sessionId,
      });

      if (requestedBusinessId) {
        query.set('businessId', requestedBusinessId);
      }

      const response = await fetch(
        `${apiUrl}/api/client/${accessRequestToken}/assets/meta_ads?${query.toString()}`
      );
      const json = await parseJsonResponse<{
        data?: MetaAssets;
        error?: { code?: string; message?: string; details?: unknown };
      }>(response, {
        fallbackErrorMessage: 'Failed to load accounts',
      });

      if (json.error) {
        throw new ApiResponseError(
          json.error.message || 'Failed to load accounts',
          json.error.code,
          json.error.details,
        );
      }

      const fetchedAssets = json.data || { adAccounts: [], pages: [], instagramAccounts: [] };
      if (fetchVersion !== assetFetchVersion.current) return null;
      setAssets(fetchedAssets);
      setSelectedBusinessId(fetchedAssets.selectedBusinessId || requestedBusinessId || null);
      setSelectedBusinessName(fetchedAssets.selectedBusinessName || null);

      // U11: funnel step — this business's assets are loaded. Counts and flags
      // only; availability numbers reuse the same shapes as meta_assets_selected.
      const loadedForBusiness =
        fetchedAssets.selectedBusinessId || requestedBusinessId || 'unscoped';
      if (!assetsLoadedReportedForRef.current.has(loadedForBusiness)) {
        assetsLoadedReportedForRef.current.add(loadedForBusiness);
        trackInviteAssetsLoaded({
          available_ad_accounts: fetchedAssets.adAccounts?.length || 0,
          available_pages: fetchedAssets.pages?.length || 0,
          available_instagram: fetchedAssets.instagramAccounts?.length || 0,
          available_catalogs: fetchedAssets.productCatalogs?.length || 0,
          available_datasets: fetchedAssets.pixels?.length || 0,
          business_count: fetchedAssets.businesses?.length || 0,
          selection_required: Boolean(fetchedAssets.selectionRequired),
          has_load_warnings: Boolean(fetchedAssets.assetLoadWarnings?.length),
        });
      }

      return fetchedAssets;
    } catch (err) {
      if (fetchVersion !== assetFetchVersion.current) return null;
      const presentation =
        err instanceof ApiResponseError
          ? mapMetaConnectionErrorFromApi(err.code ?? 'ASSET_FETCH_ERROR', err.message, err.details)
          : mapMetaConnectionErrorFromApi(
              'ASSET_FETCH_ERROR',
              err instanceof Error ? err.message : 'Failed to load accounts',
            );
      setConnectionError(presentation);
      onError?.(presentation.message);
      return null;
    } finally {
      if (fetchVersion === assetFetchVersion.current) setIsLoading(false);
    }
  };

  // Fetch assets on mount
  useEffect(() => {
    if (sessionId) {
      fetchAssets(selectionSessionId.current === sessionId ? selectedBusinessId || undefined : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, accessRequestToken]);

  // A saved fulfillment reaches the wizard after asset discovery on resume.
  // Prune it against the current session's assets, then never apply it again.
  useEffect(() => {
    if (!initialSelection || !initialSelectionKey || !initialSelectionSessionKey) return;
    if (selectionSessionId.current !== sessionId || !assets) return;
    if (appliedInitialSelectionKey.current === initialSelectionSessionKey) return;

    appliedInitialSelectionKey.current = initialSelectionSessionKey;
    const prunedPrefill = intersectSelectionPrefill(initialSelection, assets) ?? {
      adAccounts: [],
      pages: [],
      instagramAccounts: [],
      catalogs: [],
      datasets: [],
    };
    setSelectedAdAccounts(new Set(prunedPrefill.adAccounts));
    setSelectedPages(new Set(prunedPrefill.pages));
    setSelectedInstagram(new Set(prunedPrefill.instagramAccounts));
    setSelectedCatalogs(new Set(prunedPrefill.catalogs));
    setSelectedDatasets(new Set(prunedPrefill.datasets));
    setResolvedPrefillSessionKey(initialSelectionSessionKey);
  }, [assets, initialSelection, initialSelectionKey, initialSelectionSessionKey, sessionId]);

  // A session change invalidates in-memory ids before its next asset response.
  useEffect(() => {
    if (selectionSessionId.current === sessionId) return;
    selectionSessionId.current = sessionId;
    setAssets(null);
    setSelectedBusinessId(null);
    setSelectedBusinessName(null);
    setSelectedAdAccounts(new Set());
    setSelectedPages(new Set());
    setSelectedInstagram(new Set());
    setSelectedCatalogs(new Set());
    setSelectedDatasets(new Set());
    setResolvedPrefillSessionKey(initialSelectionSessionKey);
    userPagesFetchedFor.current = null;
    setUserPages(null);
    setZeroPortfolioPrimaryPageId('');
  }, [initialSelectionSessionKey, sessionId]);

  // Fetch the client user's own Pages — zero-portfolio branch (pages_show_list).
  const fetchUserPages = async () => {
    try {
      setUserPagesLoading(true);
      setUserPagesError(null);

      const response = await fetch(
        `${getApiBaseUrl()}/api/client/${accessRequestToken}/create/meta/user-pages?connectionId=${sessionId}`
      );
      const json = await parseJsonResponse<{
        data?: { pages?: Array<{ id: string; name: string; category?: string }> };
        error?: { message?: string };
      }>(response, { fallbackErrorMessage: 'Failed to load your Facebook Pages' });

      if (json.error) {
        throw new Error(json.error.message || 'Failed to load your Facebook Pages');
      }

      setUserPages(json.data?.pages || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load your Facebook Pages';
      setUserPagesError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setUserPagesLoading(false);
    }
  };

  // Zero-portfolio clients: user Page discovery (GET /me/accounts) as soon as
  // asset load confirms no Business Portfolio — not gated on a separate CTA.
  useEffect(() => {
    if (isLoading || connectionError || !assets) return;

    const availableBusinesses = assets.businesses || [];
    const requiresSelection = Boolean(
      assets.selectionRequired && !selectedBusinessId && availableBusinesses.length > 0
    );
    const scopedBusinessId = selectedBusinessId || businessId;
    const noBusinessPortfolio =
      !requiresSelection && !scopedBusinessId && availableBusinesses.length === 0;
    if (!noBusinessPortfolio) return;

    const fetchKey = sessionId;
    if (userPagesFetchedFor.current === fetchKey) return;
    userPagesFetchedFor.current = fetchKey;
    void fetchUserPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, isLoading, connectionError, sessionId, selectedBusinessId, businessId]);

  // Business created → refetch scoped to the new portfolio and open the
  // ad-account creator inline: one pass, no return-and-reselect journey.
  const handleBusinessCreated = (business: { id: string; name: string }) => {
    const creationVersion = ++businessCreationVersion.current;
    setZeroPortfolioPrimaryPageId('');
    void fetchAssets(business.id).then((fetchedAssets) => {
      if (!fetchedAssets || businessCreationVersion.current !== creationVersion) return;
      setCreatedBusiness(business);
      setShowAdAccountCreator(true);
    });
  };

  // Notify parent of changes
  const totalSelected =
    (showAdAccounts ? selectedAdAccounts.size : 0) +
    (showPages ? selectedPages.size : 0) +
    (showInstagramAccounts ? selectedInstagram.size : 0) +
    (showCatalogs ? selectedCatalogs.size : 0) +
    (showPixels ? selectedDatasets.size : 0);

  useEffect(() => {
    if (assets && initialSelectionSessionKey && resolvedPrefillSessionKey !== initialSelectionSessionKey) return;
    // Include full asset objects for the save and the step-3 checklist
    const selectedPagesWithNames = Array.from(selectedPages).map((id) => {
      const page = assets?.pages.find((p) => p.id === id);
      return page ? { id: page.id, name: page.name } : { id, name: id };
    });
    
    const selectedAdAccountsWithNames = Array.from(selectedAdAccounts).map((id) => {
      const account = assets?.adAccounts.find((a) => a.id === id);
      return account ? { id: account.id, name: account.name } : { id, name: id };
    });
    
    const selectedInstagramWithNames = Array.from(selectedInstagram).map((id) => {
      const account = assets?.instagramAccounts.find((a) => a.id === id);
      return account ? { id: account.id, name: account.username || account.name || id } : { id, name: id };
    });
    const selectedCatalogsWithNames = Array.from(selectedCatalogs).map((id) => {
      const catalog = assets?.productCatalogs?.find((item) => item.id === id);
      return catalog ? { id: catalog.id, name: catalog.name } : { id, name: id };
    });
    const selectedDatasetsWithNames = Array.from(selectedDatasets).map((id) => {
      const dataset = assets?.pixels?.find((item) => item.id === id);
      return dataset ? { id: dataset.id, name: dataset.name } : { id, name: id };
    });

    // Track meta_assets_selected when selection changes (debounced)
    let selectionTrackingTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (totalSelected > 0 && !hasTrackedSelection.current) {
      // Debounce the tracking to avoid spamming events
      selectionTrackingTimeoutId = setTimeout(() => {
        void capturePosthogEvent('meta_assets_selected', {
          session_id: sessionId,
          ad_accounts_selected: selectedAdAccounts.size,
          pages_selected: selectedPages.size,
          instagram_accounts_selected: selectedInstagram.size,
          catalogs_selected: selectedCatalogs.size,
          datasets_selected: selectedDatasets.size,
          total_selected: totalSelected,
          available_ad_accounts: assets?.adAccounts?.length || 0,
          available_pages: assets?.pages?.length || 0,
          available_instagram: assets?.instagramAccounts?.length || 0,
          available_catalogs: assets?.productCatalogs?.length || 0,
          available_datasets: assets?.pixels?.length || 0,
        });
        hasTrackedSelection.current = true;
      }, 2000); // Wait 2 seconds after last selection change
    }

    // Build flat list of selected asset names for Step 3 summary
    const selectedAssetNames = [
      ...(showAdAccounts ? selectedAdAccountsWithNames.map((a) => a.name) : []),
      ...(showPages ? selectedPagesWithNames.map((p) => p.name) : []),
      ...(showInstagramAccounts ? selectedInstagramWithNames.map((ig) => ig.name) : []),
      ...(showCatalogs ? selectedCatalogsWithNames.map((catalog) => catalog.name) : []),
      ...(showPixels ? selectedDatasetsWithNames.map((dataset) => dataset.name) : []),
    ];

    onSelectionChange({
      adAccounts: Array.from(selectedAdAccounts),
      pages: Array.from(selectedPages),
      instagramAccounts: Array.from(selectedInstagram),
      catalogs: Array.from(selectedCatalogs),
      datasets: Array.from(selectedDatasets),
      // Per-type skips, in schema order so re-emits stay stable.
      declinedAssetKinds: DECLINE_KIND_ORDER.filter((kind) => declinedKinds.has(kind)),
      selectedBusinessId: selectedBusinessId || undefined,
      selectedBusinessName: selectedBusinessName || undefined,
      businesses: assets?.businesses || [],
      selectionRequired: assets?.selectionRequired,
      // Include full objects for the save and the step-3 checklist
      selectedPagesWithNames,
      selectedAdAccountsWithNames,
      selectedInstagramWithNames,
      selectedCatalogsWithNames,
      selectedDatasetsWithNames,
      selectedAssetNames,
      // Store all assets for lookup
      allPages: assets?.pages || [],
      allAdAccounts: assets?.adAccounts || [],
      // U7/#3: the mount emission fires before the asset fetch resolves with
      // every list defined-empty. Consumers must not read those empty lists
      // as a completed fetch — the wizard's loading gate keys on this flag.
      assetsLoaded: assets != null,
      allInstagramAccounts: assets?.instagramAccounts || [],
      allProductCatalogs: assets?.productCatalogs || [],
      allDatasets: assets?.pixels || [],
    });

    return () => {
      if (selectionTrackingTimeoutId) {
        clearTimeout(selectionTrackingTimeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdAccounts, selectedPages, selectedInstagram, selectedCatalogs, selectedDatasets, declinedKinds, assets, initialSelectionSessionKey, resolvedPrefillSessionKey]);

  // Loading state
  if (isLoading) {
    return (
      <AssetSelectorLoading
        message={`Finding your ${assetTypeLabel || 'accounts'}...`}
      />
    );
  }

  // Error state
  if (connectionError) {
    return (
      <MetaConnectionErrorPanel
        error={connectionError}
        onRetry={() => {
          void fetchAssets(selectedBusinessId || undefined);
        }}
      />
    );
  }

  // Convert assets to Asset format (for Instagram) and MultiSelectOption format (for Ad Accounts and Pages)
  const adAccountAssets = (assets?.adAccounts || []).map((account) => ({
    id: account.id,
    name: account.name,
    description: metaAssetOptionDescription(
      account.id,
      account.status || account.currency || null
    ),
  }));

  const pageAssets = (assets?.pages || []).map((page) => ({
    id: page.id,
    name: page.name,
    description: metaAssetOptionDescription(page.id, page.category || null),
  }));

  const instagramAssets: Asset[] = (assets?.instagramAccounts || []).map((account) => ({
    id: account.id,
    name: account.username || account.name || account.id,
    metadata: {
      id: account.id,
      avatar: account.avatar,
    },
  }));

  const availableBusinesses = assets?.businesses || [];
  const requiresBusinessSelection = Boolean(
    assets?.selectionRequired && !selectedBusinessId && availableBusinesses.length > 0
  );
  const creationBusinessId = selectedBusinessId || businessId;
  const catalogCreationNeedsReview = Boolean(
    activeBusinessId && catalogCreationNeedsReviewFor.has(activeBusinessId)
  );
  const adAccountCreationNeedsReview = Boolean(
    creationBusinessId && adAccountCreationNeedsReviewFor.has(creationBusinessId)
  );
  const hasNoBusinessPortfolio =
    !requiresBusinessSelection && !creationBusinessId && availableBusinesses.length === 0;

  // PortfolioSelector data (R2/KTD11): names only, with the Meta vertical as
  // the collision tiebreaker. The full list comes from the server's asset
  // discovery, so the selector's escape fetcher resolves it without a second
  // Graph round-trip.
  const portfolioBusinesses: PortfolioBusiness[] = availableBusinesses.map((business) => ({
    id: business.id,
    name: business.name,
    verificationStatus: business.verificationStatus,
    ...(business.verticalName ? { vertical: business.verticalName } : {}),
  }));
  const selectedPortfolioBusiness: PortfolioBusiness | null = selectedBusinessId
    ? portfolioBusinesses.find((business) => business.id === selectedBusinessId) ||
      { id: selectedBusinessId, name: selectedBusinessName || '' }
    : null;
  const fetchPortfolioBusinessList = (): Promise<PortfolioBusiness[]> =>
    Promise.resolve(portfolioBusinesses);

  const selectedBusinessVerification = availableBusinesses.find(
    (b) => b.id === selectedBusinessId
  )?.verificationStatus;
  const showSetupChecklist = Boolean(
    selectedBusinessId &&
      (createdBusiness?.id === selectedBusinessId ||
        (selectedBusinessVerification && selectedBusinessVerification !== 'verified'))
  );

  const businessScopedDiscoveryCopy = buildMetaPartnerGrantNarrative({
    agencyBusinessId: businessId ?? null,
    agencyBusinessName: null,
    clientBusinessId: selectedBusinessId,
    clientBusinessName: selectedBusinessName,
  }).discoveryNote;

  const selectedSummaryAdAccounts = Array.from(selectedAdAccounts).map((id) => {
    const account = assets?.adAccounts.find((item) => item.id === id);
    return account ? { id: account.id, name: account.name } : { id, name: id };
  });
  const selectedSummaryPages = Array.from(selectedPages).map((id) => {
    const page = assets?.pages.find((item) => item.id === id);
    return page ? { id: page.id, name: page.name } : { id, name: id };
  });
  const selectedSummaryInstagram = Array.from(selectedInstagram).map((id) => {
    const account = assets?.instagramAccounts.find((item) => item.id === id);
    return account
      ? { id: account.id, name: account.username || account.name || id }
      : { id, name: id };
  });
  const selectedSummaryCatalogs = Array.from(selectedCatalogs).map((id) => {
    const catalog = assets?.productCatalogs?.find((item) => item.id === id);
    return catalog ? { id: catalog.id, name: catalog.name } : { id, name: id };
  });
  const selectedSummaryDatasets = Array.from(selectedDatasets).map((id) => {
    const dataset = assets?.pixels?.find((item) => item.id === id);
    return dataset ? { id: dataset.id, name: dataset.name } : { id, name: id };
  });

  /**
   * Single ownership point for "reset everything selection-derived" in this
   * selector. Every reset path (switch business, business re-load) goes
   * through it. When new selection-derived state is added (for example a
   * manual-grant checklist), register its storage here so every reset path
   * clears it together.
   */
  const resetSelectionDerivedState = (options: { keepBusiness?: boolean } = {}) => {
    setSelectedAdAccounts(new Set());
    setSelectedPages(new Set());
    setSelectedInstagram(new Set());
    setSelectedCatalogs(new Set());
    setSelectedDatasets(new Set());
    // Declines are selection-derived too: a switch lands on a different
    // portfolio than the one the decision was about.
    setDeclinedKinds(new Set());
    setCatalogCreationErrorsFor({});
    // U9 registration: the manual-grant checklist persists per-row check
    // state in sessionStorage. It is selection-derived, so a business switch
    // must uncheck it — clear its storage alongside the in-memory resets.
    clearManualGrantChecklistStorage(accessRequestToken);
    // Creation-review records persist across switches: they are keyed by the
    // business that owns them and render only when that business is active,
    // so they cannot go stale on another business (keeps a pending creation
    // discoverable when the client returns to its source portfolio).
    setCatalogCreated(null);
    setShowCatalogCreator(false);
    setShowAdAccountCreator(false);
    setShowPageCreator(false);
    setCreatedBusiness(null);
    setBusinessCreationNeedsReview(false);
    setZeroPortfolioPrimaryPageId('');
    if (!options.keepBusiness) {
      setSelectedBusinessId(null);
      setSelectedBusinessName(null);
    }
  };

  // Apply a business confirmed in PortfolioSelector: full reset (R5/KTD3),
  // then fetch that business's assets. The fetch response swaps the receipt
  // and the scoped asset lists in one pass.
  const applyBusinessSelection = (business: { id: string; name: string }) => {
    setPendingResetConfirm(null);
    businessCreationVersion.current += 1;
    assetFetchVersion.current += 1;
    activeBusinessIdRef.current = business.id;
    resetSelectionDerivedState({ keepBusiness: true });
    onSelectionDerivedStateReset?.();
    void fetchAssets(business.id);
  };

  // Confirmation-first (R6): re-confirming the active business is a no-op so
  // the escape-to-chooser detour never destroys work. A different business
  // confirms with the selection count first when work exists (R5).
  const handleBusinessConfirmed = (business: PortfolioBusiness) => {
    if (business.id === selectedBusinessId) return;
    if (totalSelected > 0) {
      setPendingResetConfirm(business);
      return;
    }
    applyBusinessSelection(business);
  };

  /**
   * Per-type skip control. Only for an allowed kind (each call site sits inside
   * its allowedAssetTypes branch) with zero selected assets — a kind with a
   * selection has no decision to record. Placement is directly under the
   * kind's select control or its empty state, so a zero-option kind gets a way
   * forward instead of a dead end.
   */
  const renderDeclineToggle = (kind: MetaDeclinableAssetKind) => {
    if (kindSelectionSizes[kind] > 0) return null;
    return (
      <button
        type="button"
        aria-pressed={declinedKinds.has(kind)}
        onClick={() => toggleDecline(kind)}
        className="mt-2 text-sm text-[rgb(var(--muted-foreground))] underline hover:text-[rgb(var(--coral))] aria-pressed:text-[rgb(var(--ink))]"
      >
        {DECLINE_TOGGLE_COPY[kind]}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {pendingResetConfirm ? (
        <SelectionResetConfirmDialog
          titleId="meta-reset-confirm-title"
          descriptionId="meta-reset-confirm-description"
          title="Switch business and clear this selection?"
          selectionCount={totalSelected}
          consequence="Switching clears the selection, the saved state, and all grant and verification progress."
          confirmLabel="Clear selection and switch"
          className="space-y-4 border-2 border-black bg-[rgb(var(--card))] p-6 dark:border-white"
          onConfirm={() => {
            if (pendingResetConfirm) applyBusinessSelection(pendingResetConfirm);
          }}
          onCancel={() => setPendingResetConfirm(null)}
        />
      ) : null}
      {businessCreationNeedsReview ? <p role="status" className="border border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))]">Business Portfolio creation is unconfirmed. Select the intended portfolio, then continue with asset selection and verification. Do not repeat creation in this request.</p> : null}

      {/* Confirmation-first portfolio choice (R6, KTD5): receipt for a
          confirmed business with an escape, one plain question when ambiguous,
          and the creation path when the client has zero businesses. */}
      <PortfolioSelector
        businesses={portfolioBusinesses}
        selectedBusiness={selectedPortfolioBusiness}
        selectionRequired={Boolean(assets?.selectionRequired)}
        fetchBusinesses={fetchPortfolioBusinessList}
        onBusinessConfirmed={handleBusinessConfirmed}
      />

      {selectedBusinessId && !hasNoBusinessPortfolio ? (
        <p className="text-xs text-[rgb(var(--muted-foreground))]">{businessScopedDiscoveryCopy}</p>
      ) : null}

      {totalSelected > 0 && selectedBusinessId ? (
        <MetaSelectedEntitiesSummary
          clientBusiness={{
            id: selectedBusinessId,
            name: selectedBusinessName || selectedBusinessId,
          }}
          adAccounts={showAdAccounts ? selectedSummaryAdAccounts : []}
          pages={showPages ? selectedSummaryPages : []}
          instagramAccounts={showInstagramAccounts ? selectedSummaryInstagram : []}
          catalogs={showCatalogs ? selectedSummaryCatalogs : []}
          datasets={showPixels ? selectedSummaryDatasets : []}
        />
      ) : null}

      {hasNoBusinessPortfolio ? (
        <div className="space-y-4">
          {userPages && userPages.length === 0 && !userPagesLoading && !userPagesError ? (
            <GuidedRedirectCard
              title="Create a Facebook Page first"
              description="A Business Portfolio needs a primary Facebook Page. Pages are created on Facebook — follow these steps:"
              businessManagerUrl="https://www.facebook.com/pages/create/"
              instructions={[
                { title: 'Click the button below to open Facebook', description: 'A new tab will open' },
                { title: 'Create a Page for your business', description: 'Add a name, category, and description' },
                { title: 'Return here and refresh', description: 'Your Page will appear and business creation unlocks' },
              ]}
              onRefresh={fetchUserPages}
            />
          ) : (
            <>
              <p className="text-xs text-[rgb(var(--muted-foreground))]">
                {buildMetaPartnerGrantNarrative({
                  agencyBusinessId: null,
                  clientBusinessId: null,
                }).zeroPortfolioPagesNote}
              </p>
              <ZeroPortfolioPageDiscovery
                pages={userPages}
                loading={userPagesLoading}
                error={userPagesError}
                primaryPageId={zeroPortfolioPrimaryPageId}
                onPrimaryPageChange={setZeroPortfolioPrimaryPageId}
                businessCreator={
                  <MetaBusinessCreator
                    connectionId={sessionId}
                    accessRequestToken={accessRequestToken}
                    userPages={userPages ?? []}
                    fixedPrimaryPageId={zeroPortfolioPrimaryPageId}
                    onSuccess={handleBusinessCreated}
                    onError={onError}
                    onReconcile={handleBusinessReconcile}
                  />
                }
              />
            </>
          )}
        </div>
      ) : null}

      {assets?.assetLoadWarnings?.map((warning) => (
        <div
          key={warning}
          role="alert"
          className="border border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))]"
        >
          {warning}
        </div>
      ))}

      {hasNoBusinessPortfolio || requiresBusinessSelection ? null : (
        <>
      {/* Asset Groups */}
      <div className="space-y-4">
        {/* Ad Accounts - Multi-select Combobox or Creator */}
        {showAdAccounts ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 border-2 border-black dark:border-white bg-[rgb(var(--coral))] flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[rgb(var(--ink))] font-display">Ad Accounts</h3>
              <p className="text-sm text-[rgb(var(--muted-foreground))] mt-0.5">
                {selectedAdAccounts.size} of {adAccountAssets.length} selected
              </p>
            </div>
          </div>
          {adAccountCreationNeedsReview ? <p role="status" className="mb-3 text-sm text-[rgb(var(--warning))]">Creation is unconfirmed. Select the intended account below, then continue with sharing and verification. Do not repeat creation in this request.</p> : null}

          {/* Show creator if empty and user clicked "Create New" */}
          {showAdAccountCreator && creationBusinessId ? (
            <div className="bg-[rgb(var(--coral))]/5 p-4 rounded-none mb-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-[rgb(var(--ink))]">Create New Ad Account</h4>
                <button
                  onClick={() => setShowAdAccountCreator(false)}
                  className="text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--coral))] underline"
                >
                  Cancel
                </button>
              </div>
              <MetaAssetCreator
                connectionId={sessionId}
                businessId={creationBusinessId}
                accessRequestToken={accessRequestToken}
                onSuccess={handleAdAccountCreated}
                onError={onError}
                onReconcile={handleAdAccountReconcile}
              />
            </div>
          ) : adAccountAssets.length > 0 ? (
            <MultiSelectCombobox
              options={adAccountAssets.map((asset) => ({
                id: asset.id,
                name: asset.name,
                description: asset.description,
              }))}
              selectedIds={selectedAdAccounts}
              onSelectionChange={(ids) => selectKindAssets('ad_account', ids)}
              placeholder="Select ad accounts..."
            />
          ) : (
            /* Empty state with create option */
            <div className="py-8 text-center px-6">
              {/* Empty state icon - Brutalist Square */}
              <div className="w-20 h-20 border-2 border-black dark:border-white bg-[rgb(var(--muted))]/30 dark:bg-[rgb(var(--muted))]/60 flex items-center justify-center mx-auto mb-4">
                <MailX className="h-8 w-8 text-[rgb(var(--muted-foreground))]" aria-hidden="true" />
              </div>

              {/* Message */}
              <h3 className="text-lg font-bold text-[rgb(var(--ink))] mb-2 font-display">No Ad Accounts Found</h3>
              <p className="text-sm text-[rgb(var(--muted-foreground))] mb-4 max-w-sm mx-auto">
                You don't have any ad accounts in this Business Manager yet. Create one to get started.
              </p>
              {/* Create button */}
              {creationBusinessId && !adAccountCreationNeedsReview ? (
                <Button variant="primary" onClick={() => setShowAdAccountCreator(true)}>
                  <Plus className="w-5 h-5" />
                  Create Ad Account
                </Button>
              ) : (
                <div className="border border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))] max-w-sm mx-auto">
                  Select a Business Portfolio before creating ad accounts.
                </div>
              )}
            </div>
          )}
          {renderDeclineToggle('ad_account')}
        </div>
        ) : null}

        {/* Pages - Multi-select Combobox or Guided Redirect */}
        {showPages ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 border-2 border-black dark:border-white bg-[rgb(var(--coral))]/100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[rgb(var(--ink))] font-display">Pages</h3>
              <p className="text-sm text-[rgb(var(--muted-foreground))] mt-0.5">
                {selectedPages.size} of {pageAssets.length} selected
              </p>
            </div>
          </div>

          {/* Show guided redirect if empty */}
          {pageAssets.length > 0 ? (
            <MultiSelectCombobox
              options={pageAssets.map((asset) => ({
                id: asset.id,
                name: asset.name,
                description: asset.description,
              }))}
              selectedIds={selectedPages}
              onSelectionChange={(ids) => selectKindAssets('page', ids)}
              placeholder="Select pages..."
            />
          ) : showPageCreator ? (
            /* Guided redirect card */
            <GuidedRedirectCard
              title="Create a Facebook Page"
              description="Pages must be created in Meta Business Manager. Follow these steps:"
              businessManagerUrl={`https://business.facebook.com/settings/${creationBusinessId}/pages`}
              instructions={[
                { title: 'Click the button below to open Meta Business Manager', description: 'A new tab will open' },
                { title: 'Click "Add a Page" or "Create a New Page"', description: 'Choose to create a new page or add an existing one' },
                { title: 'Follow the prompts to set up your page', description: 'Add name, category, and description' },
                { title: 'Return here and click "Refresh List"', description: 'Your new page will appear in the list' },
              ]}
              onRefresh={handlePageCreated}
            />
          ) : (
            /* Empty state with create option */
            <div className="py-8 text-center px-6">
              {/* Empty state icon - Brutalist Square */}
              <div className="w-20 h-20 border-2 border-black dark:border-white bg-[rgb(var(--muted))]/30 dark:bg-[rgb(var(--muted))]/60 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-[rgb(var(--muted-foreground))]" aria-hidden="true" />
              </div>

              {/* Message */}
              <h3 className="text-lg font-bold text-[rgb(var(--ink))] mb-2 font-display">No Pages Found</h3>
              <p className="text-sm text-[rgb(var(--muted-foreground))] mb-4 max-w-sm mx-auto">
                You don't have any Facebook Pages in this Business Manager. Create one to get started.
              </p>

              {/* Create button */}
              {creationBusinessId ? (
                <Button variant="primary" onClick={() => setShowPageCreator(true)}>
                  <Plus className="w-5 h-5" />
                  Create Page
                </Button>
              ) : (
                <div className="border border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))] max-w-sm mx-auto">
                  Select a Business Portfolio before creating pages.
                </div>
              )}
            </div>
          )}
          {renderDeclineToggle('page')}
        </div>
        ) : null}

        {showPages && requestedPageTasks.includes('MANAGE_LEADS') ? (
          <p className="border-t border-black/10 pt-4 text-sm text-[rgb(var(--muted-foreground))] dark:border-white/10">
            Leads Access is part of this request. We confirm it with you right after you share.
          </p>
        ) : null}

        {/* Instagram Accounts - Keep as AssetGroup for now */}
        {showInstagramAccounts ? (
        <>
        <AssetGroup
          title="Instagram Accounts"
          assets={instagramAssets}
          selectedIds={selectedInstagram}
          onSelectionChange={(ids) => selectKindAssets('instagram_account', ids)}
          icon={
            <div className="w-10 h-10 border-2 border-black dark:border-white bg-pink-500 flex items-center justify-center">
              <Camera className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
          }
          defaultExpanded={instagramAssets.length > 0}
        />
        {renderDeclineToggle('instagram_account')}
        </>
        ) : null}

        {showCatalogs ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 border-2 border-black dark:border-white bg-[rgb(var(--coral))] flex items-center justify-center" aria-hidden="true"><ShoppingBag className="h-5 w-5 text-white" /></div>
              <div>
                <h3 className="text-lg font-bold text-[rgb(var(--ink))] font-display">Product Catalogs</h3>
                <p className="text-sm text-[rgb(var(--muted-foreground))] mt-0.5">{selectedCatalogs.size} of {assets?.productCatalogs?.length || 0} selected</p>
              </div>
            </div>
            {catalogCreated ? <p role="status" className="mb-3 text-sm text-[rgb(var(--success-ink))]">Catalog {catalogCreated.name} ({catalogCreated.id}) was created and rediscovered. Select it below to request access.</p> : null}
            {activeBusinessId && catalogCreationErrorsFor[activeBusinessId] ? <p role="alert" className="mb-3 text-sm text-[rgb(var(--danger-ink))]">{catalogCreationErrorsFor[activeBusinessId]}</p> : null}
            {catalogCreationNeedsReview ? <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center"><p role="status" className="text-sm text-[rgb(var(--warning))]">Creation is not fully verified. Refresh, then select the intended catalog below. Do not repeat creation in this request.</p><Button type="button" variant="secondary" className="min-h-[44px]" disabled={isRefreshingCatalogs} onClick={() => void refreshCatalogsAfterUnknownCreation()}>{isRefreshingCatalogs ? 'Refreshing…' : 'Refresh catalog list'}</Button></div> : null}
            {showCatalogCreator ? (
              <form className="mb-3 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void handleCatalogCreated(); }}>
                <label className="sr-only" htmlFor="meta-product-catalog-name">Product catalog name</label>
                <input
                  id="meta-product-catalog-name"
                  className="min-h-[44px] flex-1 border-2 border-black bg-[rgb(var(--card))] px-3 text-[rgb(var(--ink))]"
                  value={catalogName}
                  onChange={(event) => setCatalogName(event.target.value)}
                  maxLength={100}
                  required
                  placeholder="Catalog name"
                />
                <Button type="submit" variant="primary" disabled={isCreatingCatalog || !activeBusinessId}>
                  {isCreatingCatalog ? 'Creating…' : 'Create catalog'}
                </Button>
                <Button type="button" variant="secondary" disabled={isCreatingCatalog} onClick={() => setShowCatalogCreator(false)}>Cancel</Button>
              </form>
            ) : !catalogCreationNeedsReview ? (
              <Button type="button" variant="secondary" className="mb-3 min-h-[44px]" onClick={() => setShowCatalogCreator(true)}>
                <Plus className="h-4 w-4" /> Create catalog
              </Button>
            ) : null}
            {(assets?.productCatalogs?.length || 0) > 0 ? (
              <MultiSelectCombobox
                options={(assets?.productCatalogs || []).map((catalog) => ({
                  id: catalog.id,
                  name: catalog.name,
                  description: metaAssetOptionDescription(catalog.id, catalog.catalogType || null),
                }))}
                selectedIds={selectedCatalogs}
                onSelectionChange={(ids) => selectKindAssets('catalog', ids)}
                placeholder="Select product catalogs..."
              />
            ) : <p className="text-sm text-[rgb(var(--muted-foreground))]">No product catalogs found in this Business Portfolio.</p>}
            {renderDeclineToggle('catalog')}
          </div>
        ) : null}

        {showPixels ? (
          <section aria-labelledby="meta-pixels-heading" className="border-t border-black/10 pt-4 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 id="meta-pixels-heading" className="text-lg font-bold text-[rgb(var(--ink))] font-display">Pixels and Datasets</h3>
              <span className="label-micro">{assets?.pixels?.length || 0} FOUND</span>
            </div>
            <p className="mt-2 text-sm text-[rgb(var(--muted-foreground))]">
              Select the Pixels or Datasets this request needs. We walk you through assigning access in Meta right after you share.
            </p>
            {(assets?.pixels?.length || 0) > 0 ? (
              <MultiSelectCombobox
                options={(assets?.pixels || []).map((pixel) => ({
                  id: pixel.id,
                  name: pixel.name,
                  description: metaAssetOptionDescription(pixel.id),
                }))}
                selectedIds={selectedDatasets}
                onSelectionChange={(ids) => selectKindAssets('dataset', ids)}
                placeholder="Select Pixels and Datasets..."
              />
            ) : <p className="mt-3 text-sm text-[rgb(var(--muted-foreground))]">No Pixels were returned for this Business Portfolio.</p>}
            {renderDeclineToggle('dataset')}
          </section>
        ) : null}
      </div>

      {/* Post-creation setup guidance for unverified portfolios */}
      {showSetupChecklist && selectedBusinessId ? (
        <MetaBusinessSetupChecklist
          accessRequestToken={accessRequestToken}
          businessId={selectedBusinessId}
        />
      ) : null}
        </>
      )}
    </div>
  );
}
