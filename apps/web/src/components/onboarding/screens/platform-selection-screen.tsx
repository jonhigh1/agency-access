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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { m } from 'framer-motion';
import { Platform, PlatformSelection } from '@agency-platform/shared';
import { PlatformSelectorGrid } from '../platform-selector-grid';
import { fadeVariants, fadeTransition } from '@/lib/animations';
import { formatOnboardingStepLabel } from '@/lib/onboarding-steps';
import { MetaPortfolioPanel } from '../meta-portfolio-panel';
import {
  isMetaGateBlocking,
  selectionIncludesMeta,
  selectionWithoutMeta,
  type MetaPortfolioReadiness,
} from '@/lib/onboarding/meta-readiness';
import { isMetaPendingApproval, META_PENDING_APPROVAL_LABEL } from '@/lib/meta-pending-approval';

// ============================================================
// TYPES
// ============================================================

interface PlatformSelectionScreenProps {
  selectedPlatforms: PlatformSelection;
  onUpdate: (platforms: PlatformSelection) => void;
  onGenerate: () => void;
  loading: boolean;
  /** Agency Meta Business Portfolio readiness; the inline panel shows when Meta is selected. */
  metaReadiness?: MetaPortfolioReadiness;
  metaJustConnected?: boolean;
  onConnectMeta?: () => void;
  onRetryMetaCheck?: () => void;
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
  metaReadiness,
  metaJustConnected,
  onConnectMeta,
  onRetryMetaCheck,
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

  // "Skip Meta for now": deselect Meta (which un-gates Continue) and say where to connect it later.
  const [metaSkipped, setMetaSkipped] = useState(false);
  const metaIncluded = selectionIncludesMeta(selectedPlatforms);
  const handleSkipMeta = useCallback(() => {
    const remaining = selectionWithoutMeta(selectedPlatforms);
    // Never leave an empty selection: fall back to the Google default (what link generation would use anyway).
    onUpdate(Object.keys(remaining).length > 0 ? remaining : { google: ['google'] });
    setMetaSkipped(true);
  }, [onUpdate, selectedPlatforms]);
  useEffect(() => {
    if (metaIncluded) setMetaSkipped(false);
  }, [metaIncluded]);

  // Google-first mode (NEXT_PUBLIC_META_PENDING_APPROVAL=true): Meta is greyed out and
  // the Meta Business Portfolio panel never renders, so this step can't dead-end.
  const metaPending = isMetaPendingApproval();
  const pendingPlatforms = useMemo<Partial<Record<Platform, string>> | undefined>(
    () => (metaPending ? { meta: META_PENDING_APPROVAL_LABEL } : undefined),
    [metaPending]
  );

  const platformCount = flatPlatforms.length;
  const showMetaPanel =
    !metaPending && Boolean(metaReadiness && onConnectMeta) && selectionIncludesMeta(selectedPlatforms);
  const metaBlocking = !metaPending && Boolean(metaReadiness) && isMetaGateBlocking(selectedPlatforms, metaReadiness!);

  return (
    <m.div
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
          pendingPlatforms={pendingPlatforms}
        />

        {showMetaPanel && metaReadiness && onConnectMeta && (
          <MetaPortfolioPanel
            readiness={metaReadiness}
            justConnected={metaJustConnected}
            connecting={loading}
            onConnect={onConnectMeta}
            onRetry={onRetryMetaCheck ?? (() => undefined)}
            onSkip={handleSkipMeta}
          />
        )}

        {metaSkipped && !metaIncluded && (
          <p
            role="status"
            data-testid="meta-skipped-note"
            className="mt-6 rounded-lg border-2 border-black bg-paper p-4 text-sm text-ink"
          >
            Meta skipped for now. You can connect it later from Connections and add it to a new access request.
          </p>
        )}

        {/* Selection Summary */}
        <m.div
          className="mt-6 p-4 bg-paper border-2 border-black rounded-lg shadow-brutalist-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-sm text-ink">
            <span className="font-semibold">{platformCount} platform(s) selected</span>
            {platformCount > 0 && !metaBlocking && (
              <span className="text-ink/60 ml-2">
                → Ready to generate access link
              </span>
            )}
            {metaBlocking && (
              <span className="text-ink/60 ml-2">
                → Connect your Meta Business Portfolio above (or skip Meta for now) to continue
              </span>
            )}
          </div>
        </m.div>

        {/* What Happens Next - Brutalist Info Card */}
        <div className="mt-6 p-5 bg-paper border-2 border-black rounded-lg">
          <h3 className="font-semibold text-ink mb-3 flex items-center gap-2">
            <span className="text-success-ink">→</span> What happens next?
          </h3>
          <ol className="text-sm text-ink/80 space-y-2 list-decimal list-inside">
            <li>We'll generate a unique access link for your client</li>
            <li>Copy the link on the next screen and send it to your client</li>
            <li>They'll click the link and authorize each platform in one flow</li>
            <li>Once they authorize, OAuth tokens appear in your dashboard</li>
          </ol>
        </div>
      </div>
    </m.div>
  );
}
