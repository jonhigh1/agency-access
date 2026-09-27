'use client';

/**
 * GoogleAssetSelector - Generic asset selector for all Google products
 * 
 * Supports:
 * - google_ads: Ad Accounts
 * - ga4: Analytics Properties
 * - google_business_profile: Business Profile Locations
 * - google_tag_manager: Tag Manager Containers
 * - google_search_console: Search Console Sites
 * - google_merchant_center: Merchant Center Accounts
 */

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { AssetGroup, type Asset } from './AssetGroup';
import { AssetSelectorLoading, AssetSelectorError, AssetSelectorEmpty } from './AssetSelectorStates';
import { getGoogleAdsAccountLabel } from '@/lib/google-ads-account-label';
import { resolveApiUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';

interface GoogleAssetSelectorProps {
  sessionId: string; // connectionId
  accessRequestToken: string;
  product: string; // e.g., 'google_ads', 'ga4', 'google_business_profile', etc.
  onSelectionChange: (selectedAssets: {
    adAccounts?: string[];
    properties?: string[];
    businessAccounts?: string[];
    containers?: string[];
    sites?: string[];
    merchantAccounts?: string[];
    availableAssetCount?: number;
  }) => void;
  onError?: (error: string) => void;
}

// Map product IDs to API platform identifiers
const PRODUCT_TO_PLATFORM: Record<string, string> = {
  'google_ads': 'google_ads',
  'ga4': 'ga4',
  'google_business_profile': 'google_business_profile',
  'google_tag_manager': 'google_tag_manager',
  'google_search_console': 'google_search_console',
  'google_merchant_center': 'google_merchant_center',
};

// Map product IDs to asset type keys
const PRODUCT_TO_ASSET_KEY: Record<string, string> = {
  'google_ads': 'adAccounts',
  'ga4': 'properties',
  'google_business_profile': 'businessAccounts',
  'google_tag_manager': 'containers',
  'google_search_console': 'sites',
  'google_merchant_center': 'merchantAccounts',
};

const PRODUCT_FOLLOW_UP_COPY: Record<
  string,
  {
    unresolvedName: string;
    missingEntity: string;
  }
> = {
  'google_ads': {
    unresolvedName: 'Google Ads',
    missingEntity: 'an eligible ad account',
  },
  'ga4': {
    unresolvedName: 'Google Analytics',
    missingEntity: 'a property',
  },
  'google_business_profile': {
    unresolvedName: 'Google Business Profile',
    missingEntity: 'a location',
  },
  'google_tag_manager': {
    unresolvedName: 'Google Tag Manager',
    missingEntity: 'a container',
  },
  'google_search_console': {
    unresolvedName: 'Google Search Console',
    missingEntity: 'a site',
  },
  'google_merchant_center': {
    unresolvedName: 'Google Merchant Center',
    missingEntity: 'an eligible Merchant Center account',
  },
};

export function GoogleAssetSelector({
  sessionId,
  accessRequestToken,
  product,
  onSelectionChange,
  onError,
}: GoogleAssetSelectorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const latestRequestIdRef = useRef(0);
  const emitSelectionChange = useEffectEvent(onSelectionChange);

  // Get title based on product type (defined early since it's used in early returns)
  const getTitle = () => {
    const titles: Record<string, string> = {
      'google_ads': 'Ad Accounts',
      'ga4': 'Analytics Properties',
      'google_business_profile': 'Business Profile Locations',
      'google_tag_manager': 'Tag Manager Containers',
      'google_search_console': 'Search Console Sites',
      'google_merchant_center': 'Merchant Center Accounts',
    };
    return titles[product] || 'Accounts';
  };

  // Fetch assets from backend
  const fetchAssets = async () => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    try {
      setIsLoading(true);
      setError(null);

      const platform = PRODUCT_TO_PLATFORM[product] || product;
      const response = await fetch(
        resolveApiUrl(`/api/client/${accessRequestToken}/assets/${platform}?connectionId=${encodeURIComponent(sessionId)}`)
      );
      const json = await parseJsonResponse<{ data?: unknown; error?: { message?: string } }>(response, {
        fallbackErrorMessage: 'Failed to load accounts',
      });

      if (json.error) {
        throw new Error(json.error.message || 'Failed to load accounts');
      }

      // Handle both array responses and object responses
      const fetchedAssets = Array.isArray(json.data) ? json.data : [];
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setAssets(fetchedAssets);
    } catch (err) {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to load accounts';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      latestRequestIdRef.current += 1;
    };
  }, []);

  // Fetch assets on mount
  useEffect(() => {
    if (sessionId) {
      fetchAssets();
    }
  }, [sessionId, product, accessRequestToken]);

  // Notify parent of changes
  useEffect(() => {
    const assetKey = PRODUCT_TO_ASSET_KEY[product];
    if (!assetKey || isLoading || error) return;

    const selection: any = {};
    selection[assetKey] = Array.from(selectedIds);
    selection.availableAssetCount = assets.length;
    // Include selected asset names so Step 3 can display them
    selection.selectedAssetNames = assets
      .filter((a) => selectedIds.has(a.id))
      .map((a) =>
        product === 'google_ads'
          ? getGoogleAdsAccountLabel(a)
          : a.displayName || a.name || a.username || a.url || `Account ${a.id}`
      );
    emitSelectionChange(selection);
  }, [assets, error, isLoading, product, selectedIds]);

  if (isLoading) {
    return (
      <AssetSelectorLoading
        message={`Loading your ${getTitle().toLowerCase()}...`}
      />
    );
  }

  if (error) {
    return (
      <AssetSelectorError
        title={`Couldn't load ${getTitle()}`}
        message={error}
        onRetry={fetchAssets}
      />
    );
  }

  // Convert assets to Asset format
  // Prefer displayName over name since 'name' often contains API paths like "properties/123456"
  const assetList: Asset[] = assets.map((asset) => {
    let name: string;
    let description: string = '';

    // Handle different product types with appropriate formatting
    if (product === 'google_tag_manager') {
      // Tag Manager: Show container name, description as account name
      name = asset.name || `Container ${asset.id}`;
      description = asset.accountName ? `Account: ${asset.accountName}` : '';
    } else if (product === 'google_ads') {
      name = getGoogleAdsAccountLabel(asset);
      description = asset.status || '';
    } else if (product === 'google_search_console') {
      // Search Console: Show clean URL, description as permission level
      const url = asset.url || asset.id || '';
      // Remove protocol and trailing slash for cleaner display
      name = url.replace(/^https?:\/\//, '').replace(/\/$/, '') || url;
      description = asset.permissionLevel 
        ? `Permission: ${asset.permissionLevel}` 
        : '';
    } else {
      // Other products: Use standard mapping
      name = asset.displayName || asset.name || asset.username || asset.url || `Account ${asset.id}`;
      description = asset.status || asset.accountName || asset.category || asset.permissionLevel || '';
    }

    return {
      id: asset.id,
      name,
      description,
    };
  });

  const totalSelected = selectedIds.size;

  if (assetList.length === 0) {
    const followUpCopy = PRODUCT_FOLLOW_UP_COPY[product];
    return (
      <AssetSelectorEmpty
        title={`No ${getTitle()} found`}
        description={`Connected to Google, but no ${getTitle().toLowerCase()} were found for this login. You can continue with the rest of this request, but ${followUpCopy?.unresolvedName || 'this product'} will stay unresolved until ${followUpCopy?.missingEntity || 'an eligible asset'} is available.`}
      />
    );
  }

  return (
    <div>
      <AssetGroup
        title={getTitle()}
        assets={assetList}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        icon={
          <div className="h-8 w-8 border-2 border-black bg-coral flex items-center justify-center dark:border-white">
            <BarChart3 className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
        }
      />
    </div>
  );
}
