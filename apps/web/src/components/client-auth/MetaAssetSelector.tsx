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
import { parseJsonResponse } from '@/lib/api/parse-json-response';

interface MetaAssets {
  businesses?: Array<{
    id: string;
    name: string;
    verificationStatus?: string;
  }>;
  selectedBusinessId?: string | null;
  selectedBusinessName?: string | null;
  selectionRequired?: boolean;
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
}

interface MetaAssetSelectorProps {
  sessionId: string;
  accessRequestToken: string;
  businessId?: string;
  allowedAssetTypes?: Array<'ad_account' | 'page' | 'instagram'>;
  onSelectionChange: (selectedAssets: {
    adAccounts: string[];
    pages: string[];
    instagramAccounts: string[];
    selectedBusinessId?: string;
    selectedBusinessName?: string;
    businesses?: Array<{ id: string; name: string }>;
    selectionRequired?: boolean;
    // Extended properties for grant step
    selectedPagesWithNames?: Array<{ id: string; name: string }>;
    selectedAdAccountsWithNames?: Array<{ id: string; name: string }>;
    selectedInstagramWithNames?: Array<{ id: string; name: string }>;
    selectedAssetNames?: string[];
    allPages?: MetaAssets['pages'];
    allAdAccounts?: MetaAssets['adAccounts'];
    allInstagramAccounts?: MetaAssets['instagramAccounts'];
  }) => void;
  onError?: (error: string) => void;
}

export function MetaAssetSelector({
  sessionId,
  accessRequestToken,
  businessId,
  allowedAssetTypes = ['ad_account', 'page', 'instagram'],
  onSelectionChange,
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

  // Creation UI state
  const [showAdAccountCreator, setShowAdAccountCreator] = useState(false);
  const [showPageCreator, setShowPageCreator] = useState(false);

  // Business creation state (zero-portfolio clients)
  const [userPages, setUserPages] = useState<Array<{ id: string; name: string; category?: string }> | null>(null);
  const [userPagesLoading, setUserPagesLoading] = useState(false);
  const [userPagesError, setUserPagesError] = useState<string | null>(null);
  const [createdBusiness, setCreatedBusiness] = useState<{ id: string; name: string } | null>(null);
  const userPagesFetchedFor = useRef<string | null>(null);

  // Track if we've already captured the event (to avoid duplicates)
  const hasTrackedSelection = useRef(false);
  const activeBusinessId = selectedBusinessId || businessId || undefined;
  const showAdAccounts = allowedAssetTypes.includes('ad_account');
  const showPages = allowedAssetTypes.includes('page');
  const showInstagramAccounts = allowedAssetTypes.includes('instagram');

  const assetTypeLabel = [
    showAdAccounts ? 'ad accounts' : null,
    showPages ? 'pages' : null,
    showInstagramAccounts ? 'Instagram accounts' : null,
  ]
    .filter(Boolean)
    .join(', ');

  // Handle successful ad account creation - auto-select and refresh
  const handleAdAccountCreated = (newAccount: { id: string; name: string }) => {
    // Refresh assets to get the updated list
    fetchAssets(activeBusinessId).then(() => {
      // Auto-select the newly created account
      setSelectedAdAccounts((prev) => new Set([...prev, newAccount.id]));
      setShowAdAccountCreator(false);
    });
  };

  // Handle page creation - refresh list
  const handlePageCreated = () => {
    fetchAssets(activeBusinessId).then(() => {
      setShowPageCreator(false);
    });
  };
  const fetchAssets = async (requestedBusinessId?: string) => {
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
      setAssets(fetchedAssets);
      setSelectedBusinessId(fetchedAssets.selectedBusinessId || requestedBusinessId || null);
      setSelectedBusinessName(fetchedAssets.selectedBusinessName || null);
      setPendingBusinessId(fetchedAssets.selectedBusinessId || requestedBusinessId || '');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load accounts';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
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
    void fetchAssets(business.id).then(() => {
      setCreatedBusiness(business);
      setShowAdAccountCreator(true);
    });
  };

  // Notify parent of changes
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

    // Track meta_assets_selected when selection changes (debounced)
    const totalSelected =
      (showAdAccounts ? selectedAdAccounts.size : 0) +
      (showPages ? selectedPages.size : 0) +
      (showInstagramAccounts ? selectedInstagram.size : 0);
    let selectionTrackingTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (totalSelected > 0 && !hasTrackedSelection.current) {
      // Debounce the tracking to avoid spamming events
      selectionTrackingTimeoutId = setTimeout(() => {
        void capturePosthogEvent('meta_assets_selected', {
          session_id: sessionId,
          ad_accounts_selected: selectedAdAccounts.size,
          pages_selected: selectedPages.size,
          instagram_accounts_selected: selectedInstagram.size,
          total_selected: totalSelected,
          available_ad_accounts: assets?.adAccounts?.length || 0,
          available_pages: assets?.pages?.length || 0,
          available_instagram: assets?.instagramAccounts?.length || 0,
        });
        hasTrackedSelection.current = true;
      }, 2000); // Wait 2 seconds after last selection change
    }

    // Build flat list of selected asset names for Step 3 summary
    const selectedAssetNames = [
      ...(showAdAccounts ? selectedAdAccountsWithNames.map((a) => a.name) : []),
      ...(showPages ? selectedPagesWithNames.map((p) => p.name) : []),
      ...(showInstagramAccounts ? selectedInstagramWithNames.map((ig) => ig.name) : []),
    ];

    onSelectionChange({
      adAccounts: Array.from(selectedAdAccounts),
      pages: Array.from(selectedPages),
      instagramAccounts: Array.from(selectedInstagram),
      selectedBusinessId: selectedBusinessId || undefined,
      selectedBusinessName: selectedBusinessName || undefined,
      businesses: assets?.businesses || [],
      selectionRequired: assets?.selectionRequired,
      // Include full objects for grant step
      selectedPagesWithNames,
      selectedAdAccountsWithNames,
      selectedInstagramWithNames,
      selectedAssetNames,
      // Store all assets for lookup
      allPages: assets?.pages || [],
      allAdAccounts: assets?.adAccounts || [],
      allInstagramAccounts: assets?.instagramAccounts || [],
    });

    return () => {
      if (selectionTrackingTimeoutId) {
        clearTimeout(selectionTrackingTimeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdAccounts, selectedPages, selectedInstagram, assets]);

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

  const totalSelected =
    (showAdAccounts ? selectedAdAccounts.size : 0) +
    (showPages ? selectedPages.size : 0) +
    (showInstagramAccounts ? selectedInstagram.size : 0);
  const availableBusinesses = assets?.businesses || [];
  const requiresBusinessSelection = Boolean(
    assets?.selectionRequired && !selectedBusinessId && availableBusinesses.length > 0
  );
  const creationBusinessId = selectedBusinessId || businessId;
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

  const handleBusinessSelectionLoad = () => {
    if (!pendingBusinessId) return;
    setSelectedAdAccounts(new Set());
    setSelectedPages(new Set());
    setSelectedInstagram(new Set());
    void fetchAssets(pendingBusinessId);
  };

  const handleSwitchBusiness = () => {
    setSelectedBusinessId(null);
    setSelectedBusinessName(null);
    setPendingBusinessId('');
    setSelectedAdAccounts(new Set());
    setSelectedPages(new Set());
    setSelectedInstagram(new Set());
    setShowAdAccountCreator(false);
    setShowPageCreator(false);
    setCreatedBusiness(null);
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
  };

  return (
    <div className="space-y-6">
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
            <button
              type="button"
              onClick={handleBusinessSelectionLoad}
              disabled={!pendingBusinessId || isLoading}
              className="inline-flex min-h-[48px] items-center justify-center bg-[rgb(var(--ink))] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-[rgb(var(--muted))]/40 disabled:text-[rgb(var(--muted-foreground))]"
            >
              Load accounts
            </button>
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
              <button
                type="button"
                onClick={handleSwitchBusiness}
                className="inline-flex min-h-[44px] items-center justify-center border-2 border-black dark:border-white bg-[rgb(var(--paper))] px-4 py-2 text-sm font-bold text-[rgb(var(--ink))] hover:bg-[rgb(var(--muted))]/20"
              >
                Switch business
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

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
              {creationBusinessId ? (
                <button
                  onClick={() => setShowAdAccountCreator(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[rgb(var(--coral))] text-white border-2 border-black dark:border-white rounded-[0.75rem] font-bold uppercase tracking-wide shadow-brutalist hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all min-h-[48px]"
                >
                  <Plus className="w-5 h-5" />
                  Create Ad Account
                </button>
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
                <button
                  onClick={() => setShowPageCreator(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[rgb(var(--coral))] text-white border-2 border-black dark:border-white rounded-[0.75rem] font-bold uppercase tracking-wide shadow-brutalist hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all min-h-[48px]"
                >
                  <Plus className="w-5 h-5" />
                  Create Page
                </button>
              ) : (
                <div className="border-2 border-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 p-4 text-sm text-[rgb(var(--warning))] max-w-sm mx-auto">
                  Select a Business Portfolio before creating pages.
                </div>
              )}
            </div>
          )}
        </div>
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
