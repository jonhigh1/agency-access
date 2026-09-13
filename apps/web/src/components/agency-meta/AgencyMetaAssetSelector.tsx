'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { 
  MetaAssetSelection, 
  MetaAllAssets, 
  MetaPermissionLevel
} from '@agency-platform/shared';
import { PermissionSelect } from './PermissionSelect';
import { SingleSelect } from '@/components/ui/single-select';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { resolveApiUrl } from '@/lib/api/api-env';
import { Button } from '@/components/ui/button';

interface AgencyMetaAssetSelectorProps {
  businessId: string;
  businessName: string;
  onSelectionChange: (selections: MetaAssetSelection[]) => void;
  onSave: () => void;
  initialSelections?: MetaAssetSelection[];
  agencyId?: string;
}

export function AgencyMetaAssetSelector({
  businessId,
  businessName,
  onSelectionChange,
  onSave,
  initialSelections = [],
  agencyId,
}: AgencyMetaAssetSelectorProps) {
  const { getToken } = useAuth();
  const [selections, setSelections] = useState<MetaAssetSelection[]>(initialSelections);
  const [searchQuery, setSearchQuery] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<'all' | 'ad_account' | 'page' | 'instagram' | 'catalog'>('all');

  // Fetch all assets for this business
  const { data: assetsResponse, isLoading, error } = useQuery<{ data: MetaAllAssets }>({
    queryKey: ['meta-assets', businessId, agencyId],
    queryFn: async () => {
      const url = new URL(resolveApiUrl(`/agency-platforms/meta/assets/${businessId}`));
      if (agencyId) url.searchParams.append('agencyId', agencyId);
      
      const token = await getToken();
      const response = await fetch(url.toString(), {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!response.ok) throw new Error('Failed to fetch assets');
      return response.json();
    },
  });

  const assets = assetsResponse?.data;

  // Handle selection changes
  const handleToggleAsset = (assetId: string, assetType: MetaAssetSelection['assetType'], selected: boolean) => {
    let newSelections: MetaAssetSelection[];
    
    if (selected) {
      newSelections = [
        ...selections,
        { assetId, assetType, permissionLevel: 'analyze', selected: true }
      ];
    } else {
      newSelections = selections.filter(s => s.assetId !== assetId);
    }
    
    setSelections(newSelections);
    onSelectionChange(newSelections);
  };

  const handlePermissionChange = (assetId: string, permissionLevel: MetaPermissionLevel) => {
    const newSelections = selections.map(s => 
      s.assetId === assetId ? { ...s, permissionLevel } : s
    );
    setSelections(newSelections);
    onSelectionChange(newSelections);
  };

  // Filtered assets
  const filteredAdAccounts = useMemo(() => 
    assets?.adAccounts.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())) || [],
    [assets, searchQuery]
  );

  const filteredPages = useMemo(() => 
    assets?.pages.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())) || [],
    [assets, searchQuery]
  );

  const filteredInstagram = useMemo(() => 
    assets?.instagramAccounts.filter(i => i.username.toLowerCase().includes(searchQuery.toLowerCase())) || [],
    [assets, searchQuery]
  );

  const filteredCatalogs = useMemo(() => 
    assets?.productCatalogs.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())) || [],
    [assets, searchQuery]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading Meta assets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4 text-red-500">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm font-medium">Failed to load assets</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[80vh] bg-card">
      {/* Header & Search */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{businessName}</h2>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{businessId}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets..."
              className="w-full pl-9 pr-4 py-2 border border-border rounded-sm text-sm focus:outline-none focus:border-slate-400 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <SingleSelect
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'ad_account', label: 'Ad Accounts' },
              { value: 'page', label: 'Pages' },
              { value: 'instagram', label: 'Instagram' },
              { value: 'catalog', label: 'Catalogs' },
            ]}
            value={assetTypeFilter}
            onChange={(v) => setAssetTypeFilter(v as any)}
            placeholder="All Types"
            ariaLabel="Asset type filter"
            className="flex-1 min-w-0"
            triggerClassName="px-3 py-2 border border-border rounded-sm text-sm min-h-auto"
          />
        </div>
      </div>

      {/* Asset List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {/* Ad Accounts */}
        {(assetTypeFilter === 'all' || assetTypeFilter === 'ad_account') && filteredAdAccounts.length > 0 && (
          <AssetSection 
            title="Ad Accounts" 
            assets={filteredAdAccounts} 
            assetType="ad_account"
            selections={selections}
            onToggle={handleToggleAsset}
            onPermissionChange={handlePermissionChange}
          />
        )}

        {/* Pages */}
        {(assetTypeFilter === 'all' || assetTypeFilter === 'page') && filteredPages.length > 0 && (
          <AssetSection 
            title="Pages" 
            assets={filteredPages} 
            assetType="page"
            selections={selections}
            onToggle={handleToggleAsset}
            onPermissionChange={handlePermissionChange}
          />
        )}

        {/* Instagram */}
        {(assetTypeFilter === 'all' || assetTypeFilter === 'instagram') && filteredInstagram.length > 0 && (
          <AssetSection 
            title="Instagram Accounts" 
            assets={filteredInstagram} 
            assetType="instagram"
            selections={selections}
            onToggle={handleToggleAsset}
            onPermissionChange={handlePermissionChange}
          />
        )}

        {/* Catalogs */}
        {(assetTypeFilter === 'all' || assetTypeFilter === 'catalog') && filteredCatalogs.length > 0 && (
          <AssetSection 
            title="Product Catalogs" 
            assets={filteredCatalogs} 
            assetType="catalog"
            selections={selections}
            onToggle={handleToggleAsset}
            onPermissionChange={handlePermissionChange}
          />
        )}

        {filteredAdAccounts.length === 0 && filteredPages.length === 0 && filteredInstagram.length === 0 && filteredCatalogs.length === 0 && (
          <div className="py-12 text-center text-slate-500 text-sm">
            No assets found matching your criteria.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{selections.length}</span> assets selected
        </div>
        <Button onClick={onSave} variant="primary" size="sm">
          Save Selections
        </Button>
      </div>
    </div>
  );
}

function AssetSection({ 
  title, 
  assets, 
  assetType, 
  selections, 
  onToggle, 
  onPermissionChange 
}: { 
  title: string; 
  assets: any[]; 
  assetType: MetaAssetSelection['assetType'];
  selections: MetaAssetSelection[];
  onToggle: (id: string, type: MetaAssetSelection['assetType'], selected: boolean) => void;
  onPermissionChange: (id: string, permission: MetaPermissionLevel) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{title}</h3>
      <div className="border border-border rounded-sm overflow-x-hidden divide-y divide-slate-100">
        {assets.map((asset) => {
          const selection = selections.find(s => s.assetId === asset.id);
          const isSelected = !!selection;
          
          return (
            <div key={asset.id} className={`relative flex items-center justify-between p-3 transition-colors ${isSelected ? 'bg-slate-50' : 'bg-card hover:bg-slate-50/50'}`}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  checked={isSelected}
                  onChange={(e) => onToggle(asset.id, assetType, e.target.checked)}
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{asset.name || asset.username}</div>
                  <div className="text-[10px] font-mono text-slate-400">{asset.id}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {asset.accountStatus && (
                  <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${asset.accountStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {asset.accountStatus}
                  </div>
                )}
                <PermissionSelect
                  value={selection?.permissionLevel || 'analyze'}
                  onChange={(p) => onPermissionChange(asset.id, p)}
                  disabled={!isSelected}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
