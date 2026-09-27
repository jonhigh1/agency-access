'use client';

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
import { AssetGroup, type Asset } from './AssetGroup';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { SingleSelect } from '@/components/ui/single-select';
import { AssetSelectorLoading, AssetSelectorError } from './AssetSelectorStates';
import { MetaAssetCreator } from './MetaAssetCreator';
import { MetaBusinessCreator } from './MetaBusinessCreator';
import { MetaBusinessSetupChecklist } from './MetaBusinessSetupChecklist';
import { GuidedRedirectCard } from './GuidedRedirectModal';
import { Plus } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { ApiResponseError, parseJsonResponse } from '@/lib/api/parse-json-response';
import { Button } from '@/components/ui/button';

interface MetaAssets {
  businesses?: Array<{
    id: string;
    name: string;
    verificationStatus?: string;
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
  allowedAssetTypes?: Array<'ad_account' | 'page' | 'instagram' | 'catalog' | 'dataset'>;
  onSelectionChange: (selectedAssets: {
    adAccounts: string[];
    pages: string[];
    instagramAccounts: string[];
    catalogs: string[];
    datasets: string[];
    selectedBusinessId?: string;
    selectedBusinessName?: string;
    businesses?: Array<{ id: string; name: string }>;
    selectionRequired?: boolean;
    // Extended properties for grant step
    selectedPagesWithNames?: Array<{ id: string; name: string }>;
    selectedAdAccountsWithNames?: Array<{ id: string; name: string }>;
    selectedInstagramWithNames?: Array<{ id: string; name: string }>;
    selectedCatalogsWithNames?: Array<{ id: string; name: string }>;
    selectedDatasetsWithNames?: Array<{ id: string; name: string }>;
    selectedAssetNames?: string[];
    allPages?: MetaAssets['pages'];
    allAdAccounts?: MetaAssets['adAccounts'];
    allInstagramAccounts?: MetaAssets['instagramAccounts'];
    allProductCatalogs?: NonNullable<MetaAssets['productCatalogs']>;
    allDatasets?: MetaAssets['pixels'];
  }) => void;
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
  allowedAssetTypes = ['ad_account', 'page', 'instagram'],
  onSelectionChange,
  onSelectionDerivedStateReset,
  onError,
}: MetaAssetSelectorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<MetaAssets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [selectedBusinessName, setSelectedBusinessName] = useState<string | null>(null);
  const [pendingBusinessId, setPendingBusinessId] = useState('');

  // Selection state
  const [selectedAdAccounts, setSelectedAdAccounts] = useState<Set<string>>(new Set());
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [selectedInstagram, setSelectedInstagram] = useState<Set<string>>(new Set());
  const [selectedCatalogs, setSelectedCatalogs] = useState<Set<string>>(new Set());
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(new Set());
  const [datasetVerification, setDatasetVerification] = useState<string | null>(null);
  const [isVerifyingDatasets, setIsVerifyingDatasets] = useState(false);
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

  // Reset confirmation (never destroy a live selection silently)
  const [pendingResetConfirm, setPendingResetConfirm] = useState<'switch-business' | null>(null);

  // Track if we've already captured the event (to avoid duplicates)
  const hasTrackedSelection = useRef(false);
  const activeBusinessId = selectedBusinessId || (assets?.selectionRequired ? undefined : businessId || undefined);
  const activeBusinessIdRef = useRef(activeBusinessId);
  const assetFetchVersion = useRef(0);
  const businessCreationVersion = useRef(0);
  const datasetVerificationVersion = useRef(0);
  const datasetVerificationKey = JSON.stringify([activeBusinessId, [...selectedDatasets].sort()]);
  const datasetVerificationKeyRef = useRef(datasetVerificationKey);
  datasetVerificationKeyRef.current = datasetVerificationKey;
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
    if (refreshed) setBusinessCreationNeedsReview(true);
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

  const verifyDatasetAccess = async () => {
    if (selectedDatasets.size === 0) {
      setDatasetVerification('Select at least one Pixel or Dataset first.');
      return;
    }
    const version = ++datasetVerificationVersion.current;
    const requestKey = datasetVerificationKeyRef.current;
    setIsVerifyingDatasets(true);
    setDatasetVerification(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/client/${accessRequestToken}/meta/datasets/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: sessionId, datasetIds: Array.from(selectedDatasets) }),
      });
      const json = await parseJsonResponse<{ data?: { status?: string }; error?: { message?: string } }>(response, {
        fallbackErrorMessage: 'Could not verify Pixel or Dataset access',
      });
      if (json.error) throw new ApiResponseError(json.error.message || 'Could not verify Pixel or Dataset access');
      if (version !== datasetVerificationVersion.current || requestKey !== datasetVerificationKeyRef.current) return;
      const status = json.data?.status;
      setDatasetVerification(status === 'verified'
        ? 'Meta confirmed access for every selected recipient and required task.'
        : status === 'partial'
          ? 'Meta confirmed some access. Review the remaining people, partner, or tasks in Business Settings.'
          : 'Meta did not confirm the required access. Check the people, partner, and tasks in Business Settings, then verify again.');
    } catch (err) {
      if (version === datasetVerificationVersion.current && requestKey === datasetVerificationKeyRef.current) {
        setDatasetVerification(err instanceof Error ? err.message : 'Could not verify Pixel or Dataset access.');
      }
    } finally {
      if (version === datasetVerificationVersion.current) setIsVerifyingDatasets(false);
    }
  };

  useEffect(() => {
    datasetVerificationVersion.current += 1;
    setDatasetVerification(null);
    setIsVerifyingDatasets(false);
    return () => {
      datasetVerificationVersion.current += 1;
    };
  }, [activeBusinessId, selectedDatasets]);

  const fetchAssets = async (requestedBusinessId?: string) => {
    const fetchVersion = ++assetFetchVersion.current;
    try {
      setIsLoading(true);
      setError(null);

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
      const json = await parseJsonResponse<{ data?: MetaAssets; error?: { message?: string } }>(
        response,
        {
          fallbackErrorMessage: 'Failed to load accounts',
        }
      );

      if (json.error) {
        throw new Error(json.error.message || 'Failed to load accounts');
      }

      const fetchedAssets = json.data || { adAccounts: [], pages: [], instagramAccounts: [] };
      if (fetchVersion !== assetFetchVersion.current) return null;
      setAssets(fetchedAssets);
      setSelectedBusinessId(fetchedAssets.selectedBusinessId || requestedBusinessId || null);
      setSelectedBusinessName(fetchedAssets.selectedBusinessName || null);
      setPendingBusinessId(fetchedAssets.selectedBusinessId || requestedBusinessId || '');
      return fetchedAssets;
    } catch (err) {
      if (fetchVersion !== assetFetchVersion.current) return null;
      const errorMessage = err instanceof Error ? err.message : 'Failed to load accounts';
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      if (fetchVersion === assetFetchVersion.current) setIsLoading(false);
    }
  };

  // Fetch assets on mount
  useEffect(() => {
    if (sessionId) {
      fetchAssets(selectedBusinessId || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, accessRequestToken]);

  // Fetch the client user's own Pages — only needed in the zero-portfolio
  // branch (guided Page prerequisite for Business creation).
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

  // Lazy-fetch user pages once when the zero-portfolio branch is entered
  useEffect(() => {
    if (isLoading || error || !assets) return;
    const zeroPortfolio =
      (assets.businesses || []).length === 0 && !selectedBusinessId && !businessId;
    if (!zeroPortfolio) return;

    const fetchKey = `${sessionId}`;
    if (userPagesFetchedFor.current !== fetchKey) {
      userPagesFetchedFor.current = fetchKey;
      void fetchUserPages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, isLoading, error, selectedBusinessId, businessId, sessionId]);

  // Business created → refetch scoped to the new portfolio and open the
  // ad-account creator inline: one pass, no return-and-reselect journey.
  const handleBusinessCreated = (business: { id: string; name: string }) => {
    const creationVersion = ++businessCreationVersion.current;
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
    // Include full asset objects for grant step
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
      selectedBusinessId: selectedBusinessId || undefined,
      selectedBusinessName: selectedBusinessName || undefined,
      businesses: assets?.businesses || [],
      selectionRequired: assets?.selectionRequired,
      // Include full objects for grant step
      selectedPagesWithNames,
      selectedAdAccountsWithNames,
      selectedInstagramWithNames,
      selectedCatalogsWithNames,
      selectedDatasetsWithNames,
      selectedAssetNames,
      // Store all assets for lookup
      allPages: assets?.pages || [],
      allAdAccounts: assets?.adAccounts || [],
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
  }, [selectedAdAccounts, selectedPages, selectedInstagram, selectedCatalogs, selectedDatasets, assets]);

  // Loading state
  if (isLoading) {
    return (
      <AssetSelectorLoading
        message={`Finding your ${assetTypeLabel || 'accounts'}...`}
      />
    );
  }

  // Error state
  if (error) {
    return (
      <AssetSelectorError
        title="Couldn't load Meta accounts"
        message={error}
        onRetry={fetchAssets}
      />
    );
  }

  // Convert assets to Asset format (for Instagram) and MultiSelectOption format (for Ad Accounts and Pages)
  const adAccountAssets = (assets?.adAccounts || []).map((account) => ({
    id: account.id,
    name: account.name,
    description: account.status || account.currency || '',
  }));

  const pageAssets = (assets?.pages || []).map((page) => ({
    id: page.id,
    name: page.name,
    description: page.category || '',
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

  const selectedBusinessVerification = availableBusinesses.find(
    (b) => b.id === selectedBusinessId
  )?.verificationStatus;
  const showSetupChecklist = Boolean(
    selectedBusinessId &&
      (createdBusiness?.id === selectedBusinessId ||
        (selectedBusinessVerification && selectedBusinessVerification !== 'verified'))
  );

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
    setDatasetVerification(null);
    setIsVerifyingDatasets(false);
    setCatalogCreationErrorsFor({});
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
    if (!options.keepBusiness) {
      setSelectedBusinessId(null);
      setSelectedBusinessName(null);
      setPendingBusinessId('');
    }
  };

  const handleBusinessSelectionLoad = () => {
    if (!pendingBusinessId) return;
    activeBusinessIdRef.current = pendingBusinessId;
    resetSelectionDerivedState({ keepBusiness: true });
    onSelectionDerivedStateReset?.();
    void fetchAssets(pendingBusinessId);
  };

  const performSwitchBusiness = () => {
    businessCreationVersion.current += 1;
    activeBusinessIdRef.current = undefined;
    assetFetchVersion.current += 1;
    resetSelectionDerivedState();
    setAssets((currentAssets) =>
      currentAssets
        ? {
            ...currentAssets,
            selectedBusinessId: null,
            selectedBusinessName: null,
            selectionRequired: true,
            adAccounts: [],
            pages: [],
            instagramAccounts: [],
          }
        : currentAssets
    );
    onSelectionDerivedStateReset?.();
  };

  const handleSwitchBusiness = () => {
    if (totalSelected > 0) {
      setPendingResetConfirm('switch-business');
      return;
    }
    performSwitchBusiness();
  };

  return (
    <div className="space-y-6">
      {pendingResetConfirm ? (
        <div
          role="alertdialog"
          aria-labelledby="meta-reset-confirm-title"
          aria-describedby="meta-reset-confirm-description"
          className="space-y-4 border-2 border-black bg-[rgb(var(--card))] p-6 dark:border-white"
        >
          <h3 id="meta-reset-confirm-title" className="text-lg font-bold text-[rgb(var(--ink))] font-display">
            Switch business and clear this selection?
          </h3>
          <p id="meta-reset-confirm-description" className="text-sm text-[rgb(var(--muted-foreground))]">
            You have selected {totalSelected} {totalSelected === 1 ? 'account' : 'accounts'}. Switching clears the selection, the saved state, and all grant and verification progress.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setPendingResetConfirm(null);
                performSwitchBusiness();
              }}
            >
              Clear selection and switch
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPendingResetConfirm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {businessCreationNeedsReview ? <p role="status" className="border-2 border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))]">Business Portfolio creation is unconfirmed. Select the intended portfolio, then continue with asset selection and verification. Do not repeat creation in this request.</p> : null}
      {hasNoBusinessPortfolio ? (
        <div className="border-2 border-black dark:border-white bg-[rgb(var(--warm-gray))]/20 p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[rgb(var(--ink))] font-display">
              No Business Portfolio yet
            </h3>
            <p className="text-sm text-[rgb(var(--muted-foreground))] mt-1">
              Meta requires a Business Portfolio to hold ad accounts and Pages. Create one
              here — it takes about a minute.
            </p>
          </div>

          {userPagesError ? (
            <div className="border-2 border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))]">
              {userPagesError}
            </div>
          ) : userPagesLoading ? (
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Checking your Facebook Pages...
            </p>
          ) : userPages && userPages.length === 0 ? (
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
          ) : userPages && userPages.length > 0 ? (
            <MetaBusinessCreator
              connectionId={sessionId}
              accessRequestToken={accessRequestToken}
              userPages={userPages}
              onSuccess={handleBusinessCreated}
              onError={onError}
              onReconcile={handleBusinessReconcile}
            />
          ) : null}
        </div>
      ) : requiresBusinessSelection ? (
        <div className="border-2 border-black dark:border-white bg-[rgb(var(--warm-gray))]/20 p-6 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[rgb(var(--ink))] font-display">
              Select Business Portfolio
            </h3>
            <p className="text-sm text-[rgb(var(--muted-foreground))] mt-1">
              Choose the client Business Portfolio that owns the Meta assets you want to share.
            </p>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="meta-business-portfolio"
              className="block text-xs font-bold uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]"
            >
              Business Portfolio
            </label>
            <SingleSelect
              options={availableBusinesses.map((b) => ({
                value: b.id,
                label: `${b.name} (${b.id})`,
              }))}
              value={pendingBusinessId}
              onChange={(v) => setPendingBusinessId(v)}
              placeholder="Select a portfolio..."
              ariaLabel="Business Portfolio"
              triggerClassName="border-2 border-black dark:border-white min-h-[48px]"
            />
            <Button
              type="button"
              variant="primary"
              onClick={handleBusinessSelectionLoad}
              disabled={!pendingBusinessId || isLoading}
            >
              Load accounts
            </Button>
          </div>
        </div>
      ) : null}

      {selectedBusinessName ? (
        <div className="border-2 border-black dark:border-white bg-[rgb(var(--card))] px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[rgb(var(--ink))]">
                Sharing from {selectedBusinessName}
              </p>
              {availableBusinesses.length > 1 ? (
                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
                  Switch to another client Business Portfolio before continuing if these assets are not the right ones.
                </p>
              ) : null}
            </div>
            {availableBusinesses.length > 1 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSwitchBusiness}
              >
                Switch business
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {assets?.assetLoadWarnings?.map((warning) => (
        <div
          key={warning}
          role="alert"
          className="border-2 border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))]"
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
              <span className="text-white text-lg">💼</span>
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
            <div className="border-2 border-[rgb(var(--coral))] bg-[rgb(var(--coral))]/5 p-4 rounded-lg mb-3">
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
              onSelectionChange={setSelectedAdAccounts}
              placeholder="Select ad accounts..."
            />
          ) : (
            /* Empty state with create option */
            <div className="py-8 text-center px-6">
              {/* Empty state icon - Brutalist Square */}
              <div className="w-20 h-20 border-2 border-black dark:border-white bg-[rgb(var(--muted))]/30 dark:bg-[rgb(var(--muted))]/60 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl" role="img" aria-label="Empty">
                  📭
                </span>
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
                <div className="border-2 border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))] max-w-sm mx-auto">
                  Select a Business Portfolio before creating ad accounts.
                </div>
              )}
            </div>
          )}
        </div>
        ) : null}

        {/* Pages - Multi-select Combobox or Guided Redirect */}
        {showPages ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 border-2 border-black dark:border-white bg-[rgb(var(--coral))]/100 flex items-center justify-center">
              <span className="text-white text-lg">📄</span>
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
              onSelectionChange={setSelectedPages}
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
                <span className="text-4xl" role="img" aria-label="Empty">
                  📄
                </span>
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
                <div className="border-2 border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))] max-w-sm mx-auto">
                  Select a Business Portfolio before creating pages.
                </div>
              )}
            </div>
          )}
        </div>
        ) : null}

        {showPages && activeBusinessId ? (
          <section aria-labelledby="meta-leads-access-heading" className="border border-[rgb(var(--border))] p-4">
            <h3 id="meta-leads-access-heading" className="text-lg font-bold text-[rgb(var(--ink))] font-display">
              {requestedPageTasks.includes('MANAGE_LEADS') ? 'Requested: Meta Leads Access' : 'Optional: Meta Leads Access'}
            </h3>
            <p className="mt-2 text-sm text-[rgb(var(--muted-foreground))]">
              {requestedPageTasks.includes('MANAGE_LEADS')
                ? <>This request includes the Manage Leads Access Page task for selected agency recipients. AuthHub will attempt assignment and report Meta read-back. It does not read lead records or request <code>leads_retrieval</code>. If Meta does not verify the task, use Business Settings and keep access pending until AuthHub confirms it.</>
                : <>Leads Access is not included in this request. Page task sharing alone does not confirm it. AuthHub does not read lead records or request <code>leads_retrieval</code>.</>}
            </p>
            <Button asChild variant="secondary" className="mt-3">
              <a
                href={`https://business.facebook.com/settings/${encodeURIComponent(activeBusinessId)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {requestedPageTasks.includes('MANAGE_LEADS') ? 'Open Meta Business Settings for Leads Access' : 'Review Leads Access in Meta Business Settings'}
              </a>
            </Button>
          </section>
        ) : null}

        {/* Instagram Accounts - Keep as AssetGroup for now */}
        {showInstagramAccounts ? (
        <AssetGroup
          title="Instagram Accounts"
          assets={instagramAssets}
          selectedIds={selectedInstagram}
          onSelectionChange={setSelectedInstagram}
          icon={
            <div className="w-10 h-10 border-2 border-black dark:border-white bg-pink-500 flex items-center justify-center">
              <span className="text-white text-lg">📷</span>
            </div>
          }
          defaultExpanded={instagramAssets.length > 0}
        />
        ) : null}

        {showCatalogs ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 border-2 border-black dark:border-white bg-[rgb(var(--coral))] flex items-center justify-center" aria-hidden="true">🛍️</div>
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
                options={(assets?.productCatalogs || []).map((catalog) => ({ id: catalog.id, name: catalog.name, description: catalog.catalogType || '' }))}
                selectedIds={selectedCatalogs}
                onSelectionChange={setSelectedCatalogs}
                placeholder="Select product catalogs..."
              />
            ) : <p className="text-sm text-[rgb(var(--muted-foreground))]">No product catalogs found in this Business Portfolio.</p>}
          </div>
        ) : null}

        {showPixels ? (
          <section aria-labelledby="meta-pixels-heading" className="border border-[rgb(var(--border))] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 id="meta-pixels-heading" className="text-lg font-bold text-[rgb(var(--ink))] font-display">Pixels and Datasets</h3>
              <span className="label-micro">{assets?.pixels?.length || 0} FOUND</span>
            </div>
            <p className="mt-2 text-sm text-[rgb(var(--muted-foreground))]">
              Select the client’s Pixels or Datasets needed for this request. Assign the requested access to each selected recipient and the agency partner in Meta. Then verify it here. Selection alone does not prove access.
            </p>
            {(assets?.pixels?.length || 0) > 0 ? (
              <MultiSelectCombobox
                options={(assets?.pixels || []).map((pixel) => ({ id: pixel.id, name: pixel.name, description: pixel.id }))}
                selectedIds={selectedDatasets}
                onSelectionChange={setSelectedDatasets}
                placeholder="Select Pixels and Datasets..."
              />
            ) : <p className="mt-3 text-sm text-[rgb(var(--muted-foreground))]">No Pixels were returned for this Business Portfolio.</p>}
            {datasetVerification ? <p role="status" className="mt-3 text-sm text-[rgb(var(--ink))]">{datasetVerification}</p> : null}
            {activeBusinessId ? (
              <div className="mt-4">
                <GuidedRedirectCard
                  title="Manage Pixels and Datasets in Meta"
                  description="Assign the requested access to each recipient and the agency partner. Return here to check the access that Meta reports."
                  businessManagerUrl={`https://business.facebook.com/settings/${encodeURIComponent(activeBusinessId)}`}
                  instructions={[
                    { title: 'Open this Business Portfolio in Meta Business Settings.' },
                    { title: 'Open Data Sources, then Pixels or Datasets. Assign the requested tasks to each selected person and the agency partner.' },
                    { title: 'Return here and verify access. AuthHub reports only the access that Meta confirms.' },
                  ]}
                  onRefresh={verifyDatasetAccess}
                  isRefreshing={isVerifyingDatasets}
                  completionLabel="Verify access"
                  actionLabel="Verify access"
                />
              </div>
            ) : null}
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
