'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { AssetGroup, type Asset } from './AssetGroup';
import { resolveApiUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';
import {
  AssetSelectorEmpty,
  AssetSelectorError,
  AssetSelectorLoading,
} from './AssetSelectorStates';

interface LinkedInAsset {
  id: string;
  name: string;
  reference?: string;
  urn?: string;
  vanityName?: string;
  status?: string;
  type?: string;
}

interface LinkedInAssetSelectorProps {
  sessionId: string;
  accessRequestToken: string;
  product: string;
  onSelectionChange: (selectedAssets: {
    adAccounts?: string[];
    pages?: string[];
    availableAssetCount?: number;
    selectedAssetNames?: string[];
  }) => void;
  onError?: (error: string) => void;
}

export function LinkedInAssetSelector({
  sessionId,
  accessRequestToken,
  product,
  onSelectionChange,
  onError,
}: LinkedInAssetSelectorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<LinkedInAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const emitSelectionChange = useEffectEvent(onSelectionChange);

  const fetchAssets = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        resolveApiUrl(`/api/client/${accessRequestToken}/assets/${product}?connectionId=${encodeURIComponent(sessionId)}`)
      );
      const json = await parseJsonResponse<{ data?: LinkedInAsset[]; error?: { message?: string } }>(response, {
        fallbackErrorMessage:
          product === 'linkedin_pages' ? 'Failed to load LinkedIn Pages' : 'Failed to load ad accounts',
      });

      if (json.error) {
        throw new Error(
          json.error.message ||
            (product === 'linkedin_pages'
              ? 'Failed to load LinkedIn Pages'
              : 'Failed to load ad accounts')
        );
      }

      setAssets(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : product === 'linkedin_pages'
            ? 'Failed to load LinkedIn Pages'
            : 'Failed to load ad accounts';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchAssets();
    }
  }, [sessionId, accessRequestToken, product]);

  useEffect(() => {
    const selectedNames = assets
      .filter((a) => selectedIds.has(a.id))
      .map((a) => a.name);

    if (product === 'linkedin_pages') {
      emitSelectionChange({
        pages: Array.from(selectedIds),
        availableAssetCount: assets.length,
        selectedAssetNames: selectedNames,
      });
      return;
    }

    emitSelectionChange({
      adAccounts: Array.from(selectedIds),
      availableAssetCount: assets.length,
      selectedAssetNames: selectedNames,
    });
  }, [assets, product, selectedIds]);

  const isPagesProduct = product === 'linkedin_pages';

  if (isLoading) {
    return (
      <AssetSelectorLoading
        message={
          isPagesProduct ? 'Loading your LinkedIn Pages...' : 'Loading your LinkedIn ad accounts...'
        }
      />
    );
  }

  if (error) {
    return (
      <AssetSelectorError
        title={isPagesProduct ? "Couldn't load LinkedIn Pages" : "Couldn't load LinkedIn ad accounts"}
        message={error}
        onRetry={fetchAssets}
      />
    );
  }

  if (assets.length === 0) {
    return (
      <AssetSelectorEmpty
        title={isPagesProduct ? 'No LinkedIn Pages found' : 'No ad accounts found'}
        description={
          isPagesProduct
            ? "We couldn't find any LinkedIn Pages you can administer with this login."
            : "This LinkedIn account doesn't have any ad accounts. Create one in Campaign Manager first, then try again."
        }
      />
    );
  }

  const assetList: Asset[] = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    description: asset.status || asset.type || asset.vanityName || asset.urn || asset.reference || '',
  }));

  const selectedAssetNames = assetList
    .filter((a) => selectedIds.has(a.id))
    .map((a) => a.name);

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-none border border-coral/40 bg-coral/5 px-3 py-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none bg-coral text-xs font-bold text-white">
            {selectedIds.size}
          </span>
          <p className="min-w-0 truncate text-sm text-ink">
            {selectedAssetNames.length <= 2
              ? selectedAssetNames.join(', ')
              : `${selectedAssetNames.slice(0, 2).join(', ')} +${selectedAssetNames.length - 2} more`}
          </p>
        </div>
      )}

      <AssetGroup
        title={isPagesProduct ? 'LinkedIn Pages' : 'Campaign Manager Accounts'}
        assets={assetList}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        icon={
          <div className="w-10 h-10 border-2 border-black dark:border-white bg-coral flex items-center justify-center">
            <span className="text-white text-lg">in</span>
          </div>
        }
      />
    </div>
  );
}
