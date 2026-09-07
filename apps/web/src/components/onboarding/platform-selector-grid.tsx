/**
 * PlatformSelectorGrid
 *
 * Visual grid component for platform selection.
 * Makes the platform selection feel interactive and opinionated.
 *
 * Features:
 * - Visual grid with platform icons
 * - Toggle selection on click
 * - Pre-selected platforms highlighted
 * - "Most popular" callout
 * - Group by platform family (Google, Meta, etc.)
 *
 * Design Principles:
 * - Visual: Users SEE platforms, not just read names
 * - Opinionated: Pre-select Google as the starting platform
 * - Fast: One click to toggle multiple platforms
 */

'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { PlatformIcon } from '@/components/ui/platform-icon';
import {
  Platform,
  PLATFORM_NAMES,
  RECOMMENDED_CONNECTION_PLATFORMS,
  SUPPORTED_CONNECTION_PLATFORMS,
} from '@agency-platform/shared';

// ============================================================
// TYPES
// ============================================================

export interface PlatformSelectorGridProps {
  selectedPlatforms: Platform[];
  onSelectionChange: (platforms: Platform[]) => void;
  preSelected?: Platform[];
  showPreSelectedMessage?: boolean;
  disabled?: boolean;
}

// ============================================================
// PLATFORM GROUPS
// ============================================================

interface PlatformGroupConfig {
  name: string;
  platforms: Platform[];
  color: string;
  selectedColor: string;
}

const PRIMARY_PLATFORM_GROUPS: PlatformGroupConfig[] = [
  {
    name: 'Google',
    platforms: ['google'],
    color: 'bg-paper hover:bg-card border-black/20',
    selectedColor: 'bg-teal/5 border-teal',
  },
  {
    name: 'Meta',
    platforms: ['meta'],
    color: 'bg-paper hover:bg-card border-black/20',
    selectedColor: 'bg-teal/5 border-teal',
  },
  {
    name: 'LinkedIn',
    platforms: ['linkedin'],
    color: 'bg-paper hover:bg-card border-black/20',
    selectedColor: 'bg-teal/5 border-teal',
  },
];

const SECONDARY_PLATFORM_GROUP: PlatformGroupConfig = {
  name: 'Other Platforms',
  platforms: SUPPORTED_CONNECTION_PLATFORMS.filter(
    (platform: Platform) => !RECOMMENDED_CONNECTION_PLATFORMS.includes(platform as any)
  ) as Platform[],
  color: 'bg-paper hover:bg-card border-black/20',
  selectedColor: 'bg-coral/5 border-coral',
};

// ============================================================
// COMPONENT
// ============================================================

export function PlatformSelectorGrid({
  selectedPlatforms,
  onSelectionChange,
  preSelected = [],
  showPreSelectedMessage = true,
  disabled = false,
}: PlatformSelectorGridProps) {
  const [hoveredPlatform, setHoveredPlatform] = useState<Platform | null>(null);

  // Toggle platform selection
  const togglePlatform = useCallback(
    (platform: Platform) => {
      if (disabled) return;

      const isSelected = selectedPlatforms.includes(platform);
      let newSelection: Platform[];

      if (isSelected) {
        // Don't allow deselecting if it's the only platform
        if (selectedPlatforms.length === 1) return;
        newSelection = selectedPlatforms.filter((p) => p !== platform);
      } else {
        newSelection = [...selectedPlatforms, platform];
      }

      onSelectionChange(newSelection);
    },
    [selectedPlatforms, onSelectionChange, disabled]
  );

  // Check if platform is pre-selected
  const isPreSelected = useCallback(
    (platform: Platform) => preSelected.includes(platform),
    [preSelected]
  );

  // Check if platform is currently selected
  const isSelected = useCallback(
    (platform: Platform) => selectedPlatforms.includes(platform),
    [selectedPlatforms]
  );

  const renderGroup = (group: PlatformGroupConfig, platformGridClassName: string) => {
    if (group.platforms.length === 0) {
      return null;
    }

    return (
      <div key={group.name} className="space-y-3">
        <h3 className="text-sm font-semibold text-ink/70">{group.name}</h3>
        <div className={platformGridClassName}>
          {group.platforms.map((platform) => {
            const selected = isSelected(platform);
            const isPreselected = isPreSelected(platform);

            return (
              <motion.button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                onMouseEnter={() => setHoveredPlatform(platform)}
                onMouseLeave={() => setHoveredPlatform(null)}
                disabled={disabled}
                className={cn(
                  'relative p-4 rounded-lg border-2 transition-all text-left min-h-[120px]',
                  selected ? group.selectedColor : group.color,
                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                )}
                variants={staggerItem}
                whileHover={{ scale: disabled ? 1 : 1.02 }}
                whileTap={{ scale: disabled ? 1 : 0.98 }}
              >
                {selected && (
                  <motion.div
                    className="absolute top-2 right-2 w-6 h-6 bg-teal rounded-full flex items-center justify-center shadow-brutalist-sm border border-black"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </motion.div>
                )}

                {isPreselected && !selected && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-teal text-white text-xs font-bold rounded border border-black shadow-brutalist-sm">
                    Recommended
                  </div>
                )}

                <div className="mb-3">
                  <PlatformIcon platform={platform} size="lg" />
                </div>
                <div className="font-semibold text-ink text-sm">
                  {PLATFORM_NAMES[platform]}
                </div>

                {hoveredPlatform === platform && !selected && (
                  <motion.div
                    className="text-xs text-ink/50 mt-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    Click to select
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Pre-selected Message - Brutalist Info Callout */}
      {showPreSelectedMessage && preSelected.length > 0 && (
        <motion.div
          className="p-4 bg-paper border-2 border-black rounded-lg shadow-brutalist-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-3">
            <span className="text-success-ink text-xl font-bold">→</span>
            <div className="flex-1">
              <div className="font-semibold text-ink mb-1">
                Most agencies start with Google
              </div>
              <div className="text-sm text-ink/70">
                We've pre-selected it for you (add Meta or others anytime)
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Platform Groups */}
      <motion.div
        className="space-y-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <div data-testid="primary-platform-groups" className="grid gap-4 md:grid-cols-3">
          {PRIMARY_PLATFORM_GROUPS.map((group) => renderGroup(group, 'grid grid-cols-1 gap-3'))}
        </div>
        {renderGroup(SECONDARY_PLATFORM_GROUP, 'grid grid-cols-2 md:grid-cols-4 gap-3')}
      </motion.div>

      {/* Selection Summary */}
      {selectedPlatforms.length > 0 && (
        <motion.div
          className="p-4 bg-paper border-2 border-black rounded-lg shadow-brutalist-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-sm text-ink">
            <span className="font-semibold">{selectedPlatforms.length} platform(s) selected:</span>{' '}
            <span className="text-ink/60">
              {selectedPlatforms.map((p) => PLATFORM_NAMES[p]).join(', ')}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
