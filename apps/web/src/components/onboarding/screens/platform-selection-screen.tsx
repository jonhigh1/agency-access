/**
 * Platform Selection Screen (Screen 2B)
 *
 * Step 3 of the unified onboarding flow.
 * Purpose: Customize platform selection (but with smart defaults).
 *
 * Key Elements:
 * - Visual grid with platform icons
 * - Google pre-selected with checkmark
 * - Click to toggle on/off
 * - "Pre-selected" callout reassures this is smart default
 * - Generate Link CTA creates excitement
 *
 * Design Principles:
 * - Visual: Platform grid is scannable and interactive
 * - Opinionated: Pre-select Google as the starting platform
 * - Fast: Can complete in 10-15 seconds
 */

'use client';

import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Platform, PlatformSelection } from '@agency-platform/shared';
import { PlatformSelectorGrid } from '../platform-selector-grid';
import { fadeVariants, fadeTransition } from '@/lib/animations';
import { formatOnboardingStepLabel } from '@/lib/onboarding-steps';

// ============================================================
// TYPES
// ============================================================

interface PlatformSelectionScreenProps {
  selectedPlatforms: PlatformSelection;
  onUpdate: (platforms: PlatformSelection) => void;
  onGenerate: () => void;
  loading: boolean;
}

// ============================================================
// PLATFORM TRANSFORM HELPERS
// ============================================================

// Convert hierarchical format to flat array
function selectionToFlat(selection: PlatformSelection): Platform[] {
  const flat: Platform[] = [];
  for (const [, platforms] of Object.entries(selection || {})) {
    if (platforms) {
      flat.push(...(platforms as Platform[]));
    }
  }
  return flat;
}

// Convert flat array to hierarchical format
function flatToSelection(platforms: Platform[]): PlatformSelection {
  const selection: PlatformSelection = {};
  for (const platform of platforms) {
    const group = platform.split('_')[0]; // e.g., 'google' from 'google'
    if (!selection[group]) {
      selection[group] = [];
    }
    selection[group].push(platform);
  }
  return selection;
}

// ============================================================
// COMPONENT
// ============================================================

export function PlatformSelectionScreen({
  selectedPlatforms,
  onUpdate,
  loading,
}: PlatformSelectionScreenProps) {
  // Convert to flat array for the grid component
  const flatPlatforms = useMemo(() => selectionToFlat(selectedPlatforms), [selectedPlatforms]);

  // Pre-selected platform (Google)
  const preSelected: Platform[] = ['google'];

  // Handle platform selection change
  const handleSelectionChange = useCallback(
    (platforms: Platform[]) => {
      onUpdate(flatToSelection(platforms));
    },
    [onUpdate]
  );

  const platformCount = flatPlatforms.length;

  return (
    <motion.div
      className="p-6 md:p-10"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fadeTransition}
    >
      {/* Step Header */}
      <div className="mb-8">
        <div className="text-sm font-semibold text-danger-ink mb-2">{formatOnboardingStepLabel(3)}</div>
        <h2 className="text-3xl font-bold text-ink mb-2">Choose Platforms</h2>
        <p className="text-ink/60">
          Which platforms does this client need to authorize?
        </p>
      </div>

      <div className="max-w-5xl">
        {/* Platform Selector Grid */}
        <PlatformSelectorGrid
          selectedPlatforms={flatPlatforms}
          onSelectionChange={handleSelectionChange}
          preSelected={preSelected}
          showPreSelectedMessage
          disabled={loading}
        />

        {/* Selection Summary */}
        <motion.div
          className="mt-6 p-4 bg-paper border-2 border-black rounded-lg shadow-brutalist-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-sm text-ink">
            <span className="font-semibold">{platformCount} platform(s) selected</span>
            {platformCount > 0 && (
              <span className="text-ink/60 ml-2">
                → Ready to generate access link
              </span>
            )}
          </div>
        </motion.div>

        {/* What Happens Next - Brutalist Info Card */}
        <div className="mt-6 p-5 bg-paper border-2 border-black rounded-lg">
          <h3 className="font-semibold text-ink mb-3 flex items-center gap-2">
            <span className="text-success-ink">→</span> What happens next?
          </h3>
          <ol className="text-sm text-ink/80 space-y-2 list-decimal list-inside">
            <li>We'll generate a unique access link for your client</li>
            <li>You'll send it to them (we'll copy it to your clipboard)</li>
            <li>They'll click the link and authorize each platform in one flow</li>
            <li>Once they authorize, OAuth tokens appear in your dashboard</li>
          </ol>
        </div>
      </div>
    </motion.div>
  );
}
