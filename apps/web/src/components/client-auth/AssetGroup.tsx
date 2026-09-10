'use client';

/**
 * AssetGroup - Collapsible group of assets with "Select All"
 *
 * Acid Brutalism Design:
 * - Hard borders and brutalist styling
 * - Large header with count badge
 * - Indeterminate checkbox state for partial selection
 * - Smooth collapse/expand with Framer Motion
 * - Grid layout (responsive: 1 col mobile, 2 col desktop)
 */

import { useState } from 'react';
import { m } from 'framer-motion';
import { ChevronDown, Inbox } from 'lucide-react';
import { AssetCheckbox } from './AssetCheckbox';

export interface Asset {
  id: string;
  name: string;
  metadata?: {
    id?: string;
    status?: string;
    avatar?: string;
  };
}

interface AssetGroupProps {
  title: string;
  assets: Asset[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
}

export function AssetGroup({
  title,
  assets,
  selectedIds,
  onSelectionChange,
  icon,
  defaultExpanded = true,
}: AssetGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate selection state
  const selectedCount = assets.filter((asset) => selectedIds.has(asset.id)).length;
  const allSelected = selectedCount === assets.length && assets.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < assets.length;

  // Handle "Select All" toggle
  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all
      const newSelection = new Set(selectedIds);
      assets.forEach((asset) => newSelection.delete(asset.id));
      onSelectionChange(newSelection);
    } else {
      // Select all
      const newSelection = new Set(selectedIds);
      assets.forEach((asset) => newSelection.add(asset.id));
      onSelectionChange(newSelection);
    }
  };

  // Handle individual asset toggle
  const handleAssetToggle = (assetId: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(assetId);
    } else {
      newSelection.delete(assetId);
    }
    onSelectionChange(newSelection);
  };

  return (
    <div className="border-t border-black/20 pt-3 first:border-t-0 first:pt-0">
      {/* Group title — the category being approved (P1: was never rendered) */}
      <p className="label-micro mb-1.5">
        {title}
      </p>

      {/* Header with Select All */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="label-nano">
            {selectedCount} of {assets.length} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Select All Checkbox */}
          {assets.length > 0 && (
            <button
              type="button"
              role="checkbox"
              aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
              aria-label={`Select all ${title}`}
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 cursor-pointer group"
            >
              <div
                className={`
                  w-5 h-5 border-2 flex items-center justify-center
                  transition-all duration-200
                  ${
                    allSelected || someSelected
                      ? 'bg-coral border-coral'
                      : 'border-black dark:border-white bg-card group-hover:border-coral'
                  }
                `}
              >
                {allSelected && (
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {someSelected && !allSelected && (
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-xs font-semibold text-[var(--ink)] group-hover:text-[var(--coral)]">
                All
              </span>
            </button>
          )}

          {/* Expand/Collapse Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
            className="border border-black bg-card p-1 hover:bg-paper transition-colors"
          >
            <m.div
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-[var(--ink)]" />
            </m.div>
          </button>
        </div>
      </div>

      {/* Asset List (Collapsible) */}
      {isExpanded && (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-1.5 ${assets.length > 8 ? 'max-h-[320px] overflow-y-auto pr-1' : ''}`}>
          {assets.map((asset) => (
            <AssetCheckbox
              key={asset.id}
              id={asset.id}
              name={asset.name}
              metadata={asset.metadata}
              checked={selectedIds.has(asset.id)}
              onChange={(checked) => handleAssetToggle(asset.id, checked)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {assets.length === 0 && isExpanded && (
        <div className="py-2 text-center">
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center border border-black bg-paper">
            <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm font-semibold text-[var(--ink)]">No {title.toLowerCase()} available</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            This account has no {title.toLowerCase()} to share
          </p>
        </div>
      )}
    </div>
  );
}
