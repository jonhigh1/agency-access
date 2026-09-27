'use client';

import { useEffect, useMemo, useState } from 'react';
import { Music } from 'lucide-react';
import { AssetGroup, type Asset } from './AssetGroup';
import { SingleSelect } from '@/components/ui/single-select';
import { AssetSelectorEmpty, AssetSelectorError, AssetSelectorLoading } from './AssetSelectorStates';
import { resolveApiUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';

interface TikTokAdvertiser {
  id: string;
  name: string;
  status?: string;
  businessCenterId?: string;
}

interface TikTokBusinessCenter {
  id: string;
  name: string;
}

interface TikTokBusinessCenterAssetGroup {
  bcId: string;
  advertisers: TikTokAdvertiser[];
}

interface TikTokAssetsResponse {
  advertisers: TikTokAdvertiser[];
  businessCenters: TikTokBusinessCenter[];
  businessCenterAssets: TikTokBusinessCenterAssetGroup[];
}

interface TikTokAssetSelectorProps {
  sessionId: string;
  accessRequestToken: string;
  onSelectionChange: (selectedAssets: {
    adAccounts: string[];
    selectedAdvertiserIds: string[];
    selectedBusinessCenterId?: string;
    availableAdvertisers: TikTokAdvertiser[];
    availableBusinessCenters: TikTokBusinessCenter[];
    selectedAssetNames?: string[];
  }) => void;
  onError?: (error: string) => void;
}

export function TikTokAssetSelector({
  sessionId,
  accessRequestToken,
  onSelectionChange,
  onError,
}: TikTokAssetSelectorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<TikTokAssetsResponse>({
    advertisers: [],
    businessCenters: [],
    businessCenterAssets: [],
  });
  const [selectedAdvertisers, setSelectedAdvertisers] = useState<Set<string>>(new Set());
  const [selectedBusinessCenterId, setSelectedBusinessCenterId] = useState<string>('');

  const fetchAssets = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        resolveApiUrl(`/api/client/${accessRequestToken}/assets/tiktok?connectionId=${encodeURIComponent(sessionId)}`)
      );
      const json = await parseJsonResponse<{
        data?: TikTokAssetsResponse;
        error?: { message?: string };
      }>(response, { fallbackErrorMessage: 'Failed to load TikTok ad accounts' });

      if (json.error) {
        throw new Error(json.error?.message || 'Failed to load TikTok ad accounts');
      }

      setAssets({
        advertisers: json.data?.advertisers || [],
        businessCenters: json.data?.businessCenters || [],
        businessCenterAssets: json.data?.businessCenterAssets || [],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load TikTok ad accounts';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, accessRequestToken]);

  const visibleAdvertisers = useMemo(() => {
    if (!selectedBusinessCenterId) {
      return assets.advertisers;
    }

    const match = assets.businessCenterAssets.find((item) => item.bcId === selectedBusinessCenterId);
    if (match) {
      return match.advertisers;
    }

    return assets.advertisers.filter(
      (advertiser) => advertiser.businessCenterId === selectedBusinessCenterId
    );
  }, [assets, selectedBusinessCenterId]);

  useEffect(() => {
    onSelectionChange({
      adAccounts: Array.from(selectedAdvertisers),
      selectedAdvertiserIds: Array.from(selectedAdvertisers),
      selectedBusinessCenterId: selectedBusinessCenterId || undefined,
      availableAdvertisers: assets.advertisers,
      availableBusinessCenters: assets.businessCenters,
      selectedAssetNames: assets.advertisers
        .filter((a) => selectedAdvertisers.has(a.id))
        .map((a) => a.name),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAdvertisers, selectedBusinessCenterId, assets]);

  if (isLoading) {
    return (
      <AssetSelectorLoading message="Loading your TikTok ad accounts..." />
    );
  }

  if (error) {
    return (
      <AssetSelectorError
        title="Couldn't load TikTok ad accounts"
        message={error}
        onRetry={fetchAssets}
      />
    );
  }

  if (assets.advertisers.length === 0) {
    return (
      <AssetSelectorEmpty
        title="No TikTok ad accounts found"
        description="We couldn't find any authorized TikTok advertisers for this connection."
      />
    );
  }

  const advertiserAssets: Asset[] = visibleAdvertisers.map((advertiser) => ({
    id: advertiser.id,
    name: advertiser.name,
    metadata: {
      id: advertiser.id,
      status: advertiser.status,
    },
  }));

  const selectedNames = visibleAdvertisers
    .filter((a) => selectedAdvertisers.has(a.id))
    .map((a) => a.name);

  return (
    <div className="space-y-3">
      {selectedAdvertisers.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-coral/40 bg-coral/5 px-3 py-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-coral text-xs font-bold text-white">
            {selectedAdvertisers.size}
          </span>
          <p className="min-w-0 truncate text-sm text-ink">
            {selectedNames.length <= 2
              ? selectedNames.join(', ')
              : `${selectedNames.slice(0, 2).join(', ')} +${selectedNames.length - 2} more`}
          </p>
        </div>
      )}

      {assets.businessCenters.length > 0 && (
        <div className="space-y-2">
          <label
            htmlFor="tiktok-business-center"
            className="block text-sm font-semibold text-ink"
          >
            Business Center
          </label>
          <SingleSelect
            options={[
              { value: '', label: 'All Business Centers' },
              ...assets.businessCenters.map((bc) => ({ value: bc.id, label: bc.name })),
            ]}
            value={selectedBusinessCenterId}
            onChange={(v) => setSelectedBusinessCenterId(v)}
            placeholder="All Business Centers"
            ariaLabel="Business Center"
            triggerClassName="rounded-lg border-2 border-border"
          />
        </div>
      )}

      <AssetGroup
        title="TikTok Ad Accounts"
        assets={advertiserAssets}
        selectedIds={selectedAdvertisers}
        onSelectionChange={setSelectedAdvertisers}
        icon={(
          <div className="w-10 h-10 border-2 border-black dark:border-white bg-coral flex items-center justify-center">
            <Music className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
        )}
      />
    </div>
  );
}
