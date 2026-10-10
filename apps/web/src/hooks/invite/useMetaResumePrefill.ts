'use client';

/**
 * Meta invite resume / prefill session state (architecture card 3 / U6).
 * Keeps popup-resume sync (#10) and one-shot saved-share marking out of the wizard body.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MetaSelectionBlob } from '@/components/client-auth/meta-selection-blob';
import {
  hasSelectableAssets,
  type InviteSelectionPrefill,
} from '@/lib/invite/landing-state';
import {
  hasRetainedMetaSelection,
  invitePrefillSyncKey,
} from '@/lib/invite/meta-resume-prefill';

export interface UseMetaResumePrefillArgs {
  metaNeedsGrantStep: boolean;
  initialMetaSelections?: InviteSelectionPrefill | null;
  metaSelectionBlob: MetaSelectionBlob | undefined;
  setAssetsSaved: (saved: boolean) => void;
  setChooseAccountsExpanded: (expanded: boolean) => void;
}

export interface UseMetaResumePrefillResult {
  metaSelectionPrefill: InviteSelectionPrefill | null;
  clearResumePrefill: () => void;
  cancelResumeSavedPending: () => void;
  metaAssetsLoaded: boolean;
  retainedResumeSelection: boolean;
}

export function useMetaResumePrefill({
  metaNeedsGrantStep,
  initialMetaSelections,
  metaSelectionBlob,
  setAssetsSaved,
  setChooseAccountsExpanded,
}: UseMetaResumePrefillArgs): UseMetaResumePrefillResult {
  const hasInitialMetaSelections =
    metaNeedsGrantStep && hasSelectableAssets(initialMetaSelections);

  const [metaSelectionPrefill, setMetaSelectionPrefill] = useState<InviteSelectionPrefill | null>(
    hasInitialMetaSelections ? (initialMetaSelections as InviteSelectionPrefill) : null
  );

  const resumeSavedPendingRef = useRef(hasInitialMetaSelections);
  const prefillKey = invitePrefillSyncKey(metaNeedsGrantStep, initialMetaSelections);
  const appliedPrefillKeyRef = useRef(prefillKey);

  useEffect(() => {
    if (!prefillKey || appliedPrefillKeyRef.current === prefillKey) return;
    appliedPrefillKeyRef.current = prefillKey;
    setMetaSelectionPrefill(JSON.parse(prefillKey) as InviteSelectionPrefill);
    resumeSavedPendingRef.current = true;
  }, [prefillKey]);

  const metaAssetsLoaded =
    !metaNeedsGrantStep || metaSelectionBlob?.assetsLoaded === true;
  const retainedResumeSelection = hasRetainedMetaSelection(
    metaSelectionPrefill,
    metaSelectionBlob
  );

  useEffect(() => {
    if (!resumeSavedPendingRef.current || !metaAssetsLoaded) return;
    resumeSavedPendingRef.current = false;
    if (retainedResumeSelection) {
      setAssetsSaved(true);
      return;
    }
    setAssetsSaved(false);
    setChooseAccountsExpanded(true);
  }, [
    metaAssetsLoaded,
    metaSelectionBlob,
    retainedResumeSelection,
    setAssetsSaved,
    setChooseAccountsExpanded,
  ]);

  const clearResumePrefill = useCallback(() => {
    setMetaSelectionPrefill(null);
  }, []);

  const cancelResumeSavedPending = useCallback(() => {
    resumeSavedPendingRef.current = false;
  }, []);

  return {
    metaSelectionPrefill,
    clearResumePrefill,
    cancelResumeSavedPending,
    metaAssetsLoaded,
    retainedResumeSelection,
  };
}
