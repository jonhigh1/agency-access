'use client';

/**
 * Meta grant checklist overlay session state (architecture card 3 / U6).
 * Optimistic overlay + funnel analytics stay here; the wizard only wires props.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MetaSelectionBlob } from '@/components/client-auth/meta-selection-blob';
import type { MetaAssetDecline, MetaFulfillmentResult } from '@agency-platform/shared';
import { trackClientFinishClickedWithPending, trackClientGrantChecklistViewed } from '@/lib/analytics/invite-events';
import {
  buildMetaGrantChecklist,
  type MetaGrantItemState,
} from '@/lib/invite/meta-grant-checklist';
import { metaGrantSelectedKindsFromBlob } from '@/components/client-auth/MetaGrantChecklist';
import { getMetaFollowUpLines } from '@/lib/invite/product-selection-summary';
import { resolveMetaGrantPhaseHeader } from '@/lib/invite/client-invite-status';

export interface UseMetaGrantChecklistOverlayArgs {
  platform: string;
  metaNeedsGrantStep: boolean;
  currentStep: number;
  connectionId: string | null;
  metaFulfillment?: MetaFulfillmentResult[];
  metaDeclines?: MetaAssetDecline[];
  metaAdAssets: MetaSelectionBlob;
  onRequestRefresh?: () => void;
  onComplete: () => void;
}

export interface UseMetaGrantChecklistOverlayResult {
  checklistOverlay: Record<string, MetaGrantItemState>;
  clearChecklistOverlay: () => void;
  metaChecklist: ReturnType<typeof buildMetaGrantChecklist>;
  handleItemSettled: (kind: string, state: MetaGrantItemState) => void;
  handleFinishClick: () => void;
  hasMetaFollowUp: boolean;
  metaGrantPhaseHeader: ReturnType<typeof resolveMetaGrantPhaseHeader> | null;
}

export function useMetaGrantChecklistOverlay({
  platform,
  metaNeedsGrantStep,
  currentStep,
  connectionId,
  metaFulfillment,
  metaDeclines,
  metaAdAssets,
  onRequestRefresh,
  onComplete,
}: UseMetaGrantChecklistOverlayArgs): UseMetaGrantChecklistOverlayResult {
  const [checklistOverlay, setChecklistOverlay] = useState<Record<string, MetaGrantItemState>>({});

  const metaChecklist = useMemo(
    () =>
      buildMetaGrantChecklist({
        rows: metaFulfillment,
        declines: metaDeclines,
        selectedKinds: metaGrantSelectedKindsFromBlob(metaAdAssets),
        overlay: checklistOverlay,
      }),
    [metaFulfillment, metaDeclines, metaAdAssets, checklistOverlay]
  );

  const hasReportedChecklistViewRef = useRef(false);
  useEffect(() => {
    if (!(platform === 'meta' && metaNeedsGrantStep && currentStep === 3 && connectionId)) return;
    if (hasReportedChecklistViewRef.current) return;
    hasReportedChecklistViewRef.current = true;
    trackClientGrantChecklistViewed({ remaining_count: metaChecklist.remainingCount });
  }, [platform, metaNeedsGrantStep, currentStep, connectionId, metaChecklist.remainingCount]);

  const handleItemSettled = useCallback(
    (kind: string, state: MetaGrantItemState) => {
      setChecklistOverlay((prev) => ({ ...prev, [kind]: state }));
      onRequestRefresh?.();
    },
    [onRequestRefresh]
  );

  const handleFinishClick = useCallback(() => {
    if (metaChecklist.remainingCount > 0) {
      trackClientFinishClickedWithPending({ remaining_count: metaChecklist.remainingCount });
    }
    onComplete();
  }, [metaChecklist.remainingCount, onComplete]);

  const hasMetaFollowUp =
    platform === 'meta' &&
    (metaChecklist.remainingCount > 0 ||
      getMetaFollowUpLines(metaAdAssets || {}, metaChecklist).length > 0);

  const metaGrantPhaseHeader =
    platform === 'meta' && metaNeedsGrantStep
      ? resolveMetaGrantPhaseHeader(metaChecklist)
      : null;

  const clearChecklistOverlay = useCallback(() => {
    setChecklistOverlay({});
  }, []);

  return {
    checklistOverlay,
    clearChecklistOverlay,
    metaChecklist,
    handleItemSettled,
    handleFinishClick,
    hasMetaFollowUp,
    metaGrantPhaseHeader,
  };
}
