'use client';

/**
 * PlatformAuthWizard - Main 3-step wizard for platform authorization
 *
 * Steps:
 * 1. Connect: OAuth authorization button
 * 2. Select Assets: MetaAssetSelector with asset fetching
 * 3. Connected: pending-grant checklist + shared accounts summary
 *
 * State Management:
 * - currentStep: tracks wizard progress
 * - sessionId: from OAuth callback, used for asset fetching
 * - selectedAssets: assets chosen by client
 * - grantedAssets: confirmation from backend after grant
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { m, AnimatePresence } from 'framer-motion';
import { Loader2, ExternalLink, CheckCircle2, ChevronDown, Lock } from 'lucide-react';
import { PlatformWizardCard } from './PlatformWizardCard';
import { MetaAssetSelector } from './MetaAssetSelector';
import { SelectionResetConfirmDialog } from './SelectionResetConfirmDialog';
import { GoogleAssetSelector } from './GoogleAssetSelector';
import { LinkedInAssetSelector } from './LinkedInAssetSelector';
import { TikTokAssetSelector } from './TikTokAssetSelector';
import { MetaGrantChecklist } from './MetaGrantChecklist';
import {
  ClientGrantPrimaryButton,
  ClientGrantSecondaryButton,
} from './client-grant-button';
import { clearManualGrantChecklistStorage } from '@/lib/invite/manual-grant-checklist-storage';
import { StepHelpText } from './StepHelpText';
import { PlatformIcon, Button } from '@/components/ui';
import {
  PLATFORM_NAMES,
  buildMetaClientAllowedAssetTypes,
} from '@agency-platform/shared';
import type {
  MetaAccessConfig,
  MetaAssetDecline,
  MetaFulfillmentResult,
  Platform,
} from '@agency-platform/shared';
import { trackOnboardingEvent } from '@/lib/analytics/onboarding';
import {
  trackInviteCtaBlocked,
  trackInviteSelectionSaved,
} from '@/lib/analytics/invite-events';
import { rememberInviteOAuthReturnToken } from '@/lib/client-invite-oauth';
import { getClientInviteManualRoute } from '@/lib/client-invite-platforms';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { ApiResponseError, parseJsonResponse } from '@/lib/api/parse-json-response';
import {
  resolveCta,
  type RequestAvailability,
} from '@/lib/invite/cta-reason';
import {
  hasSelectableAssets,
  isTerminalRequestCode,
  type InviteSelectionPrefill,
} from '@/lib/invite/landing-state';
import { waitForMetaPopup } from '@/lib/invite/meta-oauth-popup';
import { buildMetaGroupAssetsSeedFromPrefill } from '@/lib/invite/meta-resume-prefill';
import {
  getProductCtaState,
  getProductSummaryLines,
  getSelectedAssetCount,
  hasGrantFollowUp,
  hasNoAssetsFollowUp,
  isMetaAssetProduct,
  shouldPersistMetaProductSave,
  supportsAssetSelection,
} from '@/lib/invite/product-selection-summary';
import { META_GRANT_ACCESS } from '@/lib/content/meta-grant-access';
import { useMetaGrantChecklistOverlay } from '@/hooks/invite/useMetaGrantChecklistOverlay';
import { useMetaResumePrefill } from '@/hooks/invite/useMetaResumePrefill';

interface PlatformAuthWizardProps {
  platform: Platform;
  platformName: string;
  products: Array<{ product: string; accessLevel: string }>;
  accessRequestToken: string;
  metaAccessConfig?: MetaAccessConfig;
  /** Agency Meta connection setting; catalog UI requires explicit enable + later catalog_management review. */
  metaCatalogEnabled?: boolean;
  onComplete: () => void;
  completionActionLabel?: string;
  deferManualRedirect?: boolean;
  // Optional initial values from OAuth callback
  initialConnectionId?: string;
  initialStep?: 1 | 2 | 3;
  // U7 resume: the client's saved Meta selections derived from the invite
  // payload's fulfillment rows. The selector prunes these against its fresh
  // asset fetch, so only still-shared assets prefill. Absent for a fresh
  // connect and for non-Meta platforms.
  initialMetaSelections?: InviteSelectionPrefill | null;
  /** Saved client Business Portfolio ID for step-3 Meta grant panels. */
  initialMetaBusinessId?: string;
  // U7 terminal states: 'available' until the page learns the request expired
  // or was revoked; a terminal value disables the primary action truthfully.
  requestAvailability?: RequestAvailability;
  // U7: fired when a save returns a terminal request code so the page can
  // replace the flow with the terminal card instead of a generic failure.
  onRequestUnavailable?: (code: string) => void;
  // R4 decoupling: server truth for the step-3 grant checklist. Absent (or
  // empty) on a fresh save — every selected kind then starts pending.
  metaFulfillment?: MetaFulfillmentResult[];
  metaDeclines?: MetaAssetDecline[];
  // Fired after a save and after every checklist settle so the page can
  // refetch the payload and replace the optimistic overlay with rows.
  onRequestRefresh?: () => void;
}

interface TikTokShareResult {
  advertiserId: string;
  status: 'granted' | 'failed' | 'already_granted';
  error?: string;
  verified?: boolean;
}

interface TikTokShareResponse {
  success: boolean;
  partialFailure?: boolean;
  results: TikTokShareResult[];
  manualFallback?: {
    required: boolean;
    reason?: string | null;
    agencyBusinessCenterId?: string | null;
  };
}

// #2: the save round-trip includes server-side Meta Graph discovery, so it
// can legitimately take tens of seconds. Past this deadline the client maps
// the abort to a retryable message instead of spinning forever.
const SAVE_REQUEST_TIMEOUT_MS = 45_000;
const SAVE_REQUEST_TIMEOUT_MESSAGE =
  'Saving is taking longer than expected. Check your connection and try again.';

function clampStep(step: number): 1 | 2 | 3 {
  return step > 3 ? 3 : step as 1 | 2 | 3;
}

const PAGE_TASK_LABELS: Record<string, string> = {
  MANAGE: 'Manage settings',
  CREATE_CONTENT: 'Create content',
  MODERATE: 'Moderate',
  ADVERTISE: 'Advertise',
  ANALYZE: 'View insights',
  MANAGE_LEADS: 'Manage Leads Access',
};

export function PlatformAuthWizard({
  platform,
  platformName,
  products,
  accessRequestToken,
  metaAccessConfig,
  metaCatalogEnabled = false,
  onComplete,
  completionActionLabel,
  deferManualRedirect = false,
  initialConnectionId,
  initialStep,
  initialMetaSelections,
  initialMetaBusinessId,
  requestAvailability = 'available',
  onRequestUnavailable,
  metaFulfillment,
  metaDeclines,
  onRequestRefresh,
}: PlatformAuthWizardProps) {
  const router = useRouter();
  const apiBaseUrl = getApiBaseUrl();
  const manualRoute = getClientInviteManualRoute(platform);
  const isManualPlatform = Boolean(manualRoute);
  const requiresAssetSelection = products.some((product) => supportsAssetSelection(product.product));
  const requestedMetaAssetProducts = products
    .filter((product) => isMetaAssetProduct(product.product))
    .map((product) => product.product);
  const primaryMetaAssetProduct =
    requestedMetaAssetProducts.find((product) => product === 'meta_ads') ||
    requestedMetaAssetProducts[0] ||
    null;
  const metaAllowedAssetTypes = buildMetaClientAllowedAssetTypes({
    pagesOnly: false,
    catalogEnabled: metaCatalogEnabled,
  }).filter((type) =>
    requestedMetaAssetProducts.includes('meta_ads') ||
    (type === 'page' && requestedMetaAssetProducts.includes('meta_pages')) ||
    (type === 'instagram' && requestedMetaAssetProducts.includes('instagram'))
  );
  const metaRequestIncludesAdAccounts = requestedMetaAssetProducts.includes('meta_ads');
  const metaSystemUserDisclaimer =
    metaRequestIncludesAdAccounts &&
    metaAccessConfig?.recipients.some((recipient) => recipient.type === 'system_user')
      ? META_GRANT_ACCESS.en.manual.systemUserDisclaimer
      : null;
  const finalActionLabel = completionActionLabel || 'Continue to next platform';
  const activePopupWaiter = useRef<{
    popup: Window;
    waiter: ReturnType<typeof waitForMetaPopup>;
  } | null>(null);
  const activePopup = useRef<Window | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      const active = activePopupWaiter.current;
      activePopupWaiter.current = null;
      active?.waiter.cancel();
      activePopup.current?.close();
      activePopup.current = null;
    };
  }, []);

  // Redirect platforms to manual flow (no OAuth - uses team invitations)
  useEffect(() => {
    if (manualRoute && !deferManualRedirect) {
      router.push(`/invite/${accessRequestToken}/${manualRoute}` as any);
    }
  }, [accessRequestToken, deferManualRedirect, manualRoute, router]);

  // Initialize with props if returning from OAuth callback
  // All platforms use 3 steps: Connect → Choose Accounts to Share → Done
  // (the Done step hosts the pending-grant checklist; grants no longer live on step 2)
  const metaNeedsGrantStep = platform === 'meta' && primaryMetaAssetProduct !== null;
  const maxSteps = 3;
  // U7 resume prefill: present only when the payload carried saved Meta
  // selections. Consumed once — any selection reset clears it via the resume hook.
  const hasInitialMetaSelections =
    metaNeedsGrantStep && hasSelectableAssets(initialMetaSelections);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(initialStep ? clampStep(initialStep) : 1);
  const [connectionId, setConnectionId] = useState<string | null>(initialConnectionId || null);
  const [groupAssets, setGroupAssets] = useState<Record<string, any>>(() =>
    hasInitialMetaSelections && initialMetaSelections
      ? buildMetaGroupAssetsSeedFromPrefill(initialMetaSelections, initialMetaBusinessId)
      : {}
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Selector-scoped fetch failure. Kept separate from `error` so the CTA
  // reason reports a load failure, not a save or grant failure.
  const [assetsFetchError, setAssetsFetchError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [businessIdLoading, setBusinessIdLoading] = useState(false);
  const [businessIdError, setBusinessIdError] = useState<string | null>(null);
  const [assetsSaved, setAssetsSaved] = useState(false);
  const [chooseAccountsExpanded, setChooseAccountsExpanded] = useState(true);
  const [grantAccessExpanded, setGrantAccessExpanded] = useState(true);
  // #22: bumped by every selection-derived reset so an in-flight save's
  // success handler can detect that its state was replaced underneath it.
  const saveVersionRef = useRef(0);
  const [sharedAccountsExpanded, setSharedAccountsExpanded] = useState(false);
  const [tiktokShareResult, setTikTokShareResult] = useState<TikTokShareResponse | null>(null);
  const [isTikTokSharing, setIsTikTokSharing] = useState(false);
  const [tiktokShareError, setTikTokShareError] = useState<string | null>(null);

  // Update state when initialStep or initialConnectionId props change (for test page)
  useEffect(() => {
    if (initialStep) {
      setCurrentStep(clampStep(initialStep));
    }
  }, [initialStep]);

  useEffect(() => {
    if (initialConnectionId) {
      setConnectionId(initialConnectionId);
    }
  }, [initialConnectionId]);

  // Derived Meta asset state (single source for checklist + summary copy)
  const metaAdAssets = groupAssets['meta_ads'] || {};
  const metaSelectionBlob = groupAssets['meta_ads'] || undefined;

  const {
    metaSelectionPrefill,
    clearResumePrefill,
    cancelResumeSavedPending,
    metaAssetsLoaded,
  } = useMetaResumePrefill({
    metaNeedsGrantStep,
    initialMetaSelections,
    metaSelectionBlob,
    setAssetsSaved,
    setChooseAccountsExpanded,
  });

  const {
    checklistOverlay,
    clearChecklistOverlay,
    metaChecklist,
    handleItemSettled,
    handleFinishClick,
    hasMetaFollowUp,
    metaGrantPhaseHeader,
  } = useMetaGrantChecklistOverlay({
    platform,
    metaNeedsGrantStep,
    currentStep,
    connectionId,
    metaFulfillment,
    metaDeclines,
    metaAdAssets,
    onRequestRefresh,
    onComplete,
  });

  // Step 1: Initiate OAuth
  const handleConnectClick = async (presentation: 'redirect' | 'popup' = 'redirect') => {
    const popup = presentation === 'popup' ? window.open('about:blank', '_blank', 'popup,width=680,height=760') : null;
    if (presentation === 'popup' && !popup) {
      setError('Your browser blocked the pop-up. Allow pop-ups for this site, then try again.');
      return;
    }
    if (popup) activePopup.current = popup;
    let popupWait: ReturnType<typeof waitForMetaPopup> | null = null;
    try {
      setIsProcessing(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/api/client/${accessRequestToken}/oauth-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presentation === 'popup' ? { platform, presentation } : { platform }),
      });

      const json = await parseJsonResponse<{
        data: { authUrl: string };
        error: null | { message?: string };
      }>(response, {
        fallbackErrorMessage: 'Failed to start authorization',
      });

      if (json.error) {
        throw new Error(json.error.message || 'Failed to generate OAuth URL');
      }
      if (!isMounted.current) return;

      const { authUrl } = json.data;

      if (platform === 'tiktok') {
        trackOnboardingEvent('client_tiktok_connect_clicked', {
          platform,
          step: 1,
          requestedProducts: products.map((p) => p.product),
        });
      }

      rememberInviteOAuthReturnToken(accessRequestToken);

      if (popup) {
        if (popup.closed) throw new Error('Meta authorization closed before it started. Try again.');
        popupWait = waitForMetaPopup(popup);
        activePopupWaiter.current = { popup, waiter: popupWait };
        popup.location.href = authUrl;
        const result = await popupWait.promise;
        if (!isMounted.current || activePopupWaiter.current?.waiter !== popupWait) return;
        activePopupWaiter.current = null;
        activePopup.current = null;
        router.replace(`/invite/${accessRequestToken}?connectionId=${result.connectionId}&platform=${result.platform}&step=2`);
      } else {
        window.location.href = authUrl;
      }
    } catch (err) {
      popupWait?.cleanup();
      if (activePopupWaiter.current?.waiter === popupWait) activePopupWaiter.current = null;
      popup?.close();
      if (activePopup.current === popup) activePopup.current = null;
      if (!isMounted.current) return;
      setError(err instanceof Error ? err.message : 'Failed to initiate OAuth');
      setIsProcessing(false);
    }
  };

  // Update selection for a specific product in the group
  const handleProductSelectionChange = useCallback((product: string, selectedAssets: any) => {
    // A fresh selection blob means the selector loaded fresh data.
    setAssetsFetchError(null);
    setGroupAssets((prev) => {
      if (isMetaAssetProduct(product)) {
        return {
          ...prev,
          meta_ads: selectedAssets,
          meta_pages: selectedAssets,
          instagram: selectedAssets,
          [product]: selectedAssets,
        };
      }

      return {
        ...prev,
        [product]: selectedAssets,
      };
    });

    if (isMetaAssetProduct(product)) {
      // A fresh selection blob invalidates any optimistic grant state.
      clearChecklistOverlay();
    }

    if (platform === 'tiktok' || product === 'tiktok' || product === 'tiktok_ads') {
      const selectedCount =
        (selectedAssets?.selectedAdvertiserIds?.length ?? 0) ||
        (selectedAssets?.adAccounts?.length ?? 0) ||
        0;

      trackOnboardingEvent('client_tiktok_assets_selected', {
        platform: 'tiktok',
        step: 2,
        product,
        selectedAccountCount: selectedCount,
        selectedBusinessCenterId: selectedAssets?.selectedBusinessCenterId,
      });
    }
  }, [platform, clearChecklistOverlay]);

  /**
   * Single ownership point for clearing wizard state derived from Meta asset
   * selections. Every reset path (selector switch-business reset, the post-save
   * change-selection affordance) goes through it. When new selection-derived
   * wizard state is added, register its storage here so every reset path
   * clears it together.
   */
  const resetSelectionDerivedState = useCallback(() => {
    // #22: every reset invalidates an in-flight save's success handler.
    saveVersionRef.current += 1;
    setAssetsSaved(false);
    clearChecklistOverlay();
    // U9 registration: the manual-grant checklist persists per-row check
    // state in sessionStorage. A post-save change-selection must uncheck it,
    // so clear its storage alongside the in-memory resets.
    clearManualGrantChecklistStorage(accessRequestToken);
    // The resume prefill counts as selection-derived state: once the client
    // resets their selections it must not come back on a selector remount,
    // and the resumed saved state must not reapply after the fresh fetch.
    clearResumePrefill();
    cancelResumeSavedPending();
    setGroupAssets((prev) => {
      if (!prev.meta_ads && !prev.meta_pages && !prev.instagram) return prev;
      const next = { ...prev };
      delete next.meta_ads;
      delete next.meta_pages;
      delete next.instagram;
      return next;
    });
    setChooseAccountsExpanded(true);
  }, [
    accessRequestToken,
    clearChecklistOverlay,
    clearResumePrefill,
    cancelResumeSavedPending,
  ]);

  // Selector fetch failures feed both the in-card banner and the CTA reason.
  const handleSelectorError = useCallback((message: string) => {
    setAssetsFetchError(message);
    setError(message);
    setChooseAccountsExpanded(true);
  }, []);

  // Post-save change-selection: re-open selection editing with a clean slate.
  const [pendingSelectionReset, setPendingSelectionReset] = useState(false);
  const [metaSelectorResetKey, setMetaSelectorResetKey] = useState(0);

  const performSelectionReset = useCallback(() => {
    setPendingSelectionReset(false);
    resetSelectionDerivedState();
    setMetaSelectorResetKey((key) => key + 1);
  }, [resetSelectionDerivedState]);

  // Fetch Business Manager ID for Meta
  useEffect(() => {
    if (platform === 'meta' && currentStep >= 2 && !businessId && !businessIdLoading) {
      const fetchBusinessId = async () => {
        setBusinessIdLoading(true);
        setBusinessIdError(null);
        try {
          const response = await fetch(`${apiBaseUrl}/api/client/${accessRequestToken}/agency-business-id`);
          const json = await parseJsonResponse<{
            data?: { businessId: string; businessName?: string | null };
            error?: { message?: string };
          }>(response, {
            fallbackErrorMessage: 'Failed to load Business Manager ID',
          });
          
          if (json.error) {
            setBusinessIdError(json.error.message || 'Failed to load Business Manager ID');
          } else if (json.data) {
            setBusinessId(json.data.businessId);
            setBusinessName(json.data.businessName || null);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Business Manager ID';
          setBusinessIdError(errorMessage);
          console.error('Failed to fetch Business Manager ID:', error);
        } finally {
          setBusinessIdLoading(false);
        }
      };
      fetchBusinessId();
    }
  }, [platform, currentStep, accessRequestToken, businessId, businessIdLoading]);

  // Step 2: Handle batch save for all products in the group
  const handleBatchSave = async () => {
    if (!connectionId) return;

    // #2: the save route now runs Meta Graph discovery server-side, making it
    // the slowest request in the flow. A client-side deadline turns a wedged
    // save into a retryable error instead of a spinner with no exit. The
    // deadline covers only the save round-trips; it is cleared before the
    // grant transitions so later fetches are never aborted.
    const saveController = new AbortController();
    const saveDeadlineId = setTimeout(
      () => saveController.abort(),
      SAVE_REQUEST_TIMEOUT_MS
    );

    const saveVersionAtStart = saveVersionRef.current;

    try {
      setIsProcessing(true);
      setError(null);

      // Save each product in order because each response updates shared connection state.
      try {
        for (const p of products) {
          const selectedAssets = groupAssets[p.product] || {};
          if (
            isMetaAssetProduct(p.product) &&
            !shouldPersistMetaProductSave(p.product, selectedAssets)
          ) {
            continue;
          }
          const response = await fetch(
            `${apiBaseUrl}/api/client/${accessRequestToken}/save-assets`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                connectionId,
                platform: p.product, // Product-level ID for saving
                selectedAssets,
                ...(p.product === 'meta_ads'
                  ? { declinedAssetKinds: selectedAssets.declinedAssetKinds || [] }
                  : {}),
              }),
              signal: saveController.signal,
            }
          );
          const json = await parseJsonResponse<{ error?: { message?: string } }>(response, {
            fallbackErrorMessage: 'Failed to save some selected assets',
          });
          if (json.error) {
            throw new Error(json.error.message || 'Failed to save some selected assets');
          }
        }
      } finally {
        clearTimeout(saveDeadlineId);
      }

      // #22: a reset (business switch, change-selection) landed while the
      // save round-trips were in flight. The stale success must not re-assert
      // saved state over the fresh reset — bail before any post-success write.
      if (saveVersionRef.current !== saveVersionAtStart) {
        return;
      }

      // Mark assets as saved, then ask the page for fresh fulfillment rows —
      // the step-3 checklist renders from server truth once they land.
      setAssetsSaved(true);
      onRequestRefresh?.();

      // U11: one event per successful save. Counts only — never asset names.
      {
        const selectable = products.filter((product) => supportsAssetSelection(product.product));
        trackInviteSelectionSaved({
          platform,
          total_selected: selectable.reduce(
            (sum, product) =>
              sum + getSelectedAssetCount(product.product, groupAssets[product.product] || {}),
            0
          ),
          product_count: selectable.length,
        });
      }

      if (platform === 'tiktok') {
        const tiktokAssets = groupAssets['tiktok_ads'] || groupAssets['tiktok'] || {};
        const hasTikTokNoAssets = hasNoAssetsFollowUp('tiktok_ads', tiktokAssets);
        const selectedCount =
          (tiktokAssets.selectedAdvertiserIds?.length ?? 0) ||
          (tiktokAssets.adAccounts?.length ?? 0) ||
          0;
        trackOnboardingEvent('client_tiktok_assets_saved', {
          platform: 'tiktok',
          step: 2,
          selectedAccountCount: selectedCount,
          selectedBusinessCenterId: tiktokAssets.selectedBusinessCenterId,
        });

        setTikTokShareError(null);
        setTikTokShareResult(null);

        if (hasTikTokNoAssets) {
          setCurrentStep(3);
        } else {
          setIsTikTokSharing(true);

          try {
            const selectedAdvertiserIds = tiktokAssets.selectedAdvertiserIds || tiktokAssets.adAccounts || [];
            const shareResponse = await fetch(`${apiBaseUrl}/api/client/${accessRequestToken}/tiktok/share-partner-access`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                connectionId,
                advertiserIds: selectedAdvertiserIds,
                selectedBusinessCenterId: tiktokAssets.selectedBusinessCenterId,
              }),
            });

            const shareJson = await parseJsonResponse<{
              data: TikTokShareResponse;
              error?: { message?: string };
            }>(shareResponse, {
              fallbackErrorMessage: 'Failed to share TikTok advertiser access',
            });
            if (!shareResponse.ok || shareJson.error) {
              throw new Error(shareJson.error?.message || 'Failed to share TikTok advertiser access');
            }

            const shareData = shareJson.data as TikTokShareResponse;
            setTikTokShareResult(shareData);

            trackOnboardingEvent('client_tiktok_partner_share_attempted', {
              platform: 'tiktok',
              step: 2,
              success: shareData.success,
              resultCount: shareData.results?.length || 0,
              failedCount: shareData.results?.filter((item) => item.status === 'failed').length || 0,
            });

            // Keep user on Step 2 when manual follow-up is required.
            if (shareData.success) {
              setCurrentStep(3);
            } else {
              setChooseAccountsExpanded(false);
              setGrantAccessExpanded(true);
            }
          } catch (shareError) {
            const shareErrorMessage =
              shareError instanceof Error
                ? shareError.message
                : 'Failed to automate TikTok Business Center sharing';
            setTikTokShareError(shareErrorMessage);
            setChooseAccountsExpanded(false);
            setGrantAccessExpanded(true);
          } finally {
            setIsTikTokSharing(false);
          }
        }
      }

      // R4: confirm is decoupled from completion. Meta (and every other
      // OAuth platform) advances to step 3, whose checklist hosts the
      // pending grant work. TikTok progress stays controlled by its
      // partner-share automation result above.
      if (platform !== 'tiktok') {
        setCurrentStep(3);
      }
    } catch (err) {
      // #2: the deadline fired mid-save. Map the abort to a retryable
      // message; the server may still complete, so the client keeps its
      // selection and can simply save again.
      if (saveController.signal.aborted) {
        setError(SAVE_REQUEST_TIMEOUT_MESSAGE);
      } else if (err instanceof ApiResponseError && isTerminalRequestCode(err.code)) {
        // U7: an expired or revoked request is terminal (AE6). The page replaces
        // the whole flow with the terminal card — never a "not found" error.
        onRequestUnavailable?.(err.code);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save assets');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // The primary action is always rendered on the share screen. The pure
  // resolver (R4, KTD2) decides whether it is clickable and which single
  // truthful reason applies right now.
  const selectableProducts = products.filter((product) => supportsAssetSelection(product.product));
  // U7 resume: the selector reports `assetsLoaded` only after fetchAssets
  // resolves; until then the resolver sees a loading state (KTD2).
  const assetsLoading =
    !assetsFetchError && (
      selectableProducts.some((product) => groupAssets[product.product] === undefined) ||
      !metaAssetsLoaded
    );
  const ctaProductStates = selectableProducts.map((product) =>
    getProductCtaState(
      product.product,
      groupAssets[product.product] || {},
      metaAllowedAssetTypes
    )
  );

  const ctaResolution =
    currentStep === 2 && connectionId && requiresAssetSelection
      ? resolveCta({
          assetsLoading,
          businessLookupPending: businessIdLoading,
          businessLookupError: businessIdError,
          assetsFetchError,
          products: ctaProductStates,
          saved: assetsSaved,
          saveInFlight: isProcessing || isTikTokSharing,
          // The creation reason names the client's selected business.
          businessName: groupAssets['meta_ads']?.selectedBusinessName ?? null,
          // U7: the page passes the live availability from the load, refresh,
          // and save responses; a terminal value disables the action with the
          // matching reason instead of allowing a doomed save.
          requestAvailability,
        })
      : null;

  useEffect(() => {
    if (
      ctaResolution?.reasonKind === 'select_required' ||
      ctaResolution?.reasonKind === 'create_required' ||
      ctaResolution?.reasonKind === 'fetch_error'
    ) {
      setChooseAccountsExpanded(true);
    }
  }, [ctaResolution?.reasonKind]);

  // U11 funnel: report each blocked state once per occurrence. The effect runs
  // on the reason-kind transition only — re-renders with an unchanged kind are
  // silent, and leaving the blocked state (or the share step) re-arms it.
  const ctaBlockedReasonKind = ctaResolution?.reasonKind;
  const lastReportedBlockedKindRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ctaBlockedReasonKind) {
      lastReportedBlockedKindRef.current = null;
      return;
    }
    if (ctaBlockedReasonKind === 'loading' || ctaBlockedReasonKind === 'saving') {
      return;
    }
    if (lastReportedBlockedKindRef.current === ctaBlockedReasonKind) return;
    lastReportedBlockedKindRef.current = ctaBlockedReasonKind;
    trackInviteCtaBlocked({ platform, reason_kind: ctaBlockedReasonKind });
  }, [ctaBlockedReasonKind, platform]);

  const handlePrimaryAction = () => {
    if (!ctaResolution || ctaResolution.disabled) return;
    if (ctaResolution.kind === 'advance') {
      setCurrentStep(3);
      return;
    }
    void handleBatchSave();
  };

  const hasZeroAssetFollowUp = Object.entries(groupAssets).some(
    ([product, assets]) => getSelectedAssetCount(product, assets) === 0 && hasNoAssetsFollowUp(product, assets)
  );

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        if (isManualPlatform) {
          return (
            <div className="text-center space-y-3 sm:space-y-5">
              <div className="mb-2 inline-flex h-14 w-14 items-center justify-center border-2 border-black bg-[var(--paper)] dark:border-white sm:mb-4 sm:h-20 sm:w-20">
                <PlatformIcon platform={platform} size="xl" />
              </div>

              <div>
                <h3 className="mb-2 text-2xl font-bold text-[var(--ink)] font-display sm:mb-3 sm:text-3xl">
                  Resume {platformName} setup
                </h3>
                <p className="mx-auto max-w-md text-base text-muted-foreground dark:text-muted-foreground sm:text-lg">
                  This platform uses native invite steps instead of OAuth. Resume the checklist when you are ready.
                </p>
              </div>

              <Button
                onClick={() => router.push(`/invite/${accessRequestToken}/${manualRoute}` as any)}
                size="xl"
                variant="brutalist"
                rightIcon={<ExternalLink className="w-5 h-5" />}
              >
                Continue in {platformName}
              </Button>

              <StepHelpText
                title={`What happens when you continue in ${platformName}?`}
                description={`You'll return to the ${platformName} checklist and can come back here afterward to review platform status.`}
                steps={[
                  `Open the ${platformName} invite checklist`,
                  'Complete the native platform steps',
                  'Return to the request flow when the invite is sent',
                  'Continue with the next requested platform',
                ]}
              />
            </div>
          );
        }

        return (
          <div className="text-center space-y-3 sm:space-y-5">
            {/* Platform Icon with Brutalist Border */}
            <div className="mb-2 inline-flex h-14 w-14 items-center justify-center border-2 border-black bg-[var(--paper)] dark:border-white sm:mb-4 sm:h-20 sm:w-20">
              <PlatformIcon platform={platform} size="xl" />
            </div>

            {/* Bold Typography */}
            <div>
              <h3 className="mb-2 text-2xl font-bold text-[var(--ink)] font-display sm:mb-3 sm:text-3xl">
                Connect {platformName}
              </h3>
              <p className="mx-auto max-w-md text-base text-muted-foreground dark:text-muted-foreground sm:text-lg">
                Sign in to {platformName} and approve access. You'll choose which accounts to share next.
              </p>
            </div>

            {error && (
              <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-4 text-danger-ink">
                {error}
              </div>
            )}

            <Button
              onClick={() => handleConnectClick()}
              isLoading={isProcessing}
              size="xl"
              variant="brutalist"
              className="whitespace-nowrap px-6 sm:px-12"
              rightIcon={!isProcessing ? <ExternalLink className="w-5 h-5" /> : undefined}
            >
              Connect {platformName}
            </Button>

            {platform === 'meta' && (
              <Button
                onClick={() => handleConnectClick('popup')}
                isLoading={isProcessing}
                size="xl"
                variant="secondary"
                disabled={isProcessing}
                className="whitespace-nowrap px-6 sm:px-12"
              >
                Open Meta in a pop-up
              </Button>
            )}

            <StepHelpText
              title="What happens when you click Connect?"
              description={`You'll be redirected to ${platformName} to sign in and authorize access.`}
              steps={[
                `Click "Connect ${platformName}" above`,
                `Sign in to your ${platformName} account`,
                'Approve the requested permissions',
                'Return here to select which accounts to share',
              ]}
            />
          </div>
        );

      case 2:
        // If user hasn't completed OAuth yet, show message to go to Step 1
        if (!connectionId) {
          return (
            <div className="text-center space-y-6 py-8">
              {/* Warning Icon with Brutalist Border */}
              <div className="inline-flex items-center justify-center w-20 h-20 border-2 border-black dark:border-white bg-[var(--warning)]/10 mb-4">
                <Lock className="h-8 w-8 text-warning" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-[var(--ink)] mb-3 font-display">
                  Please connect your account first
                </h3>
                <p className="text-lg text-muted-foreground dark:text-muted-foreground max-w-md mx-auto mb-6">
                  You need to complete Step 1 before you can select accounts to share.
                </p>
              </div>
              <Button
                onClick={() => setCurrentStep(1)}
                variant="brutalist"
                size="lg"
              >
                Go to Step 1
              </Button>
            </div>
          );
        }

        if (!requiresAssetSelection) {
          return (
            <div className="text-center space-y-6 py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 border-2 border-black dark:border-white bg-[var(--teal)]/10 mb-4">
                <CheckCircle2 className="w-10 h-10 text-success-ink" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-[var(--ink)] mb-3 font-display">
                  Authorization received
                </h3>
                <p className="text-lg text-muted-foreground dark:text-muted-foreground max-w-md mx-auto">
                  {platformName} does not require any extra account selection here. Review the confirmation screen to finish this step.
                </p>
              </div>

              {error && (
                <div className="border border-danger-ink bg-[var(--coral)]/10 p-4 text-danger-ink">
                  {error}
                </div>
              )}

              <Button
                onClick={() => setCurrentStep(3)}
                size="xl"
                variant="brutalist"
                rightIcon={<CheckCircle2 className="w-6 h-6" />}
              >
                Review access confirmation
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {/* Choose Accounts Section — a disclosure, not a box: the stage
                shell owns the border; this separates by the header bar and
                hairlines (one shell per surface). */}
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => setChooseAccountsExpanded(!chooseAccountsExpanded)}
                aria-expanded={chooseAccountsExpanded}
                aria-controls="meta-asset-selection"
                className="w-full px-6 py-4 flex items-center justify-between bg-muted/20 dark:bg-muted/60 hover:bg-muted/30 dark:hover:bg-muted/50 transition-colors"
              >
                <div className="text-left">
                  <h3 className="text-xl font-bold text-[var(--ink)] font-display">
                    Choose accounts to share
                  </h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                    Select the accounts you can share now. Anything left to do shows up in the next step.
                  </p>
                </div>
                <m.div
                  animate={{ rotate: chooseAccountsExpanded ? 0 : -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-6 h-6 text-muted-foreground dark:text-muted-foreground" />
                </m.div>
              </button>

              <AnimatePresence initial={false}>
                  <m.div
                    id="meta-asset-selection"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: chooseAccountsExpanded ? 'auto' : 0, opacity: chooseAccountsExpanded ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    aria-hidden={!chooseAccountsExpanded}
                    inert={!chooseAccountsExpanded}
                    className="overflow-hidden"
                  >
                    <div className="p-3 space-y-3">
            {error && (
                        <div className="border border-danger-ink bg-[var(--coral)]/10 p-3 text-danger-ink text-sm">
                {error}
              </div>
            )}

            <div className="space-y-10">
              {/* Show all products that require asset selection */}
              {products
                // The Meta products share one selector, so only the primary
                // renders; the others would be headings over a repeat note.
                .filter(
                  (p) =>
                    supportsAssetSelection(p.product) &&
                    !(isMetaAssetProduct(p.product) && primaryMetaAssetProduct !== p.product)
                )
                .map((p) => {
                  // Map product IDs to display names (some products aren't in PLATFORM_CONFIG)
                  const productNameMap: Record<string, string> = {
                    'google_ads': 'Google Ads',
                    'ga4': 'Google Analytics',
                    'google_tag_manager': 'Google Tag Manager',
                    'google_search_console': 'Google Search Console',
                    'google_merchant_center': 'Google Merchant Center',
                    'google_business_profile': 'Google Business Profile',
                    'meta_ads': 'Meta Ads',
                    'meta_pages': 'Meta Pages',
                    'linkedin_ads': 'LinkedIn Ads',
                    'linkedin_pages': 'LinkedIn Pages',
                    'tiktok': 'TikTok Ads',
                    'tiktok_ads': 'TikTok Ads',
                  };
                  // The one Meta selector covers ads, Pages, and Instagram, so
                  // it is named for the platform, not for a single product.
                  const productName = isMetaAssetProduct(p.product)
                    ? platformName
                    : PLATFORM_NAMES[p.product as Platform] || productNameMap[p.product] || p.product;

                  return (
                    <div key={p.product} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={p.product as Platform} size="sm" />
                        <h4 className="text-sm font-semibold text-[var(--ink)] font-display">{productName}</h4>
                      </div>

                      {isMetaAssetProduct(p.product) && primaryMetaAssetProduct === p.product && (
                        <div className="relative">
                          {metaAccessConfig ? (
                            <div className="mb-4 border-t border-black/10 pt-3 text-sm text-ink dark:border-white/10">
                              <p className="font-semibold">Access this request will assign</p>
                              <ul className="mt-2 list-disc space-y-1 pl-5">
                                {metaAccessConfig.recipients.map((recipient) => (
                                  <li key={`${recipient.type}:${recipient.id}`}>
                                    {recipient.name || recipient.id} ({recipient.type === 'human' ? 'person' : 'system user'})
                                  </li>
                                ))}
                              </ul>
                              {metaAccessConfig.pageTasks.length > 0 ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Page tasks: {metaAccessConfig.pageTasks.map((task) => PAGE_TASK_LABELS[task] ?? task).join(', ')}
                                </p>
                              ) : null}
                              {metaSystemUserDisclaimer ? (
                                <p
                                  className="mt-3 border border-black/10 bg-muted/20 px-3 py-2 text-xs text-muted-foreground dark:border-white/10"
                                  role="note"
                                >
                                  {metaSystemUserDisclaimer}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          <MetaAssetSelector
                            key={`meta-asset-selector-${metaSelectorResetKey}`}
                            sessionId={connectionId!}
                            accessRequestToken={accessRequestToken}
                            businessId={businessId || undefined}
                            requestedPageTasks={metaAccessConfig?.pageTasks}
                            initialSelection={metaSelectionPrefill}
                            allowedAssetTypes={metaAllowedAssetTypes}
                            onSelectionChange={(selectedAssets) => {
                              // Store both IDs and full asset objects for the save and the step-3 checklist
                              // selectedAssets now includes selectedPagesWithNames, etc. from MetaAssetSelector
                              handleProductSelectionChange(p.product, selectedAssets);
                            }}
                            onSelectionDerivedStateReset={resetSelectionDerivedState}
                            onError={handleSelectorError}
                          />
                        </div>
                      )}

                      {/* Use generic GoogleAssetSelector for all Google products */}
                      {(p.product.startsWith('google_') || p.product === 'ga4') && (
                        <div className="relative">
                          <GoogleAssetSelector
                            sessionId={connectionId!}
                            accessRequestToken={accessRequestToken}
                            product={p.product}
                            onSelectionChange={(assets) => handleProductSelectionChange(p.product, assets)}
                            onError={handleSelectorError}
                          />
                        </div>
                      )}

                      {(p.product === 'tiktok' || p.product === 'tiktok_ads') && (
                        <div className="relative">
                          <TikTokAssetSelector
                            sessionId={connectionId!}
                            accessRequestToken={accessRequestToken}
                            onSelectionChange={(assets) => handleProductSelectionChange(p.product, assets)}
                            onError={handleSelectorError}
                          />
                        </div>
                      )}

                      {(p.product === 'linkedin_ads' || p.product === 'linkedin_pages') && (
                        <div className="relative">
                          <LinkedInAssetSelector
                            sessionId={connectionId!}
                            accessRequestToken={accessRequestToken}
                            product={p.product}
                            onSelectionChange={(assets) => handleProductSelectionChange(p.product, assets)}
                            onError={handleSelectorError}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

                      </div>
                    </m.div>
                </AnimatePresence>
          </div>

          {/* Post-save change-selection: the only way back after assets are saved. */}
          {(() => {
            const metaSelectionCount = getSelectedAssetCount('meta_ads', groupAssets['meta_ads'] || {});
            if (!(platform === 'meta' && metaNeedsGrantStep && connectionId && assetsSaved)) return null;
            return (
              <div className="flex flex-col items-start gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (metaSelectionCount > 0) {
                      setPendingSelectionReset(true);
                      return;
                    }
                    performSelectionReset();
                  }}
                >
                  Change selection
                </Button>
                {pendingSelectionReset ? (
                  <SelectionResetConfirmDialog
                    titleId="meta-selection-reset-title"
                    descriptionId="meta-selection-reset-description"
                    title="Clear this selection and start over?"
                    selectionCount={metaSelectionCount}
                    consequence="Clearing removes the selection, the saved state, and all grant and verification progress."
                    confirmLabel="Clear selection and edit"
                    onConfirm={performSelectionReset}
                    onCancel={() => setPendingSelectionReset(false)}
                  />
                ) : null}
              </div>
            );
          })()}

            {platform === 'tiktok' && connectionId && assetsSaved && (
              <div className="border-2 border-black dark:border-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGrantAccessExpanded(!grantAccessExpanded)}
                  className="w-full px-6 py-4 flex items-center justify-between bg-muted/20 dark:bg-muted/60 hover:bg-muted/30 dark:hover:bg-muted/50 transition-colors"
                >
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-[var(--ink)] font-display">
                      Grant access
                    </h3>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                      We attempt TikTok Business Center partner sharing automatically.
                    </p>
                  </div>
                  <m.div
                    animate={{ rotate: grantAccessExpanded ? 0 : -90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-6 h-6 text-muted-foreground dark:text-muted-foreground" />
                  </m.div>
                </button>

                <AnimatePresence initial={false}>
                  {grantAccessExpanded && (
                    <m.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-4">
                        {isTikTokSharing && (
                          <div className="border-2 border-[var(--warning)] bg-[var(--warning)]/10 p-4 text-[var(--ink)]">
                            <p className="font-semibold flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Granting access in TikTok Business Center...
                            </p>
                          </div>
                        )}

                        {tiktokShareError && (
                          <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-4 text-danger-ink">
                            <p className="font-semibold mb-2">Automatic TikTok sharing failed</p>
                            <p className="text-sm">{tiktokShareError}</p>
                            <p className="text-sm mt-3">
                              Complete sharing manually in TikTok Business Center, then continue.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <a
                                href="https://business.tiktok.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 border-2 border-black dark:border-white font-semibold text-[var(--ink)] hover:bg-muted/20 transition-colors"
                              >
                                Open TikTok Business Center
                              </a>
                              <Button
                                onClick={() => setCurrentStep(3)}
                                size="lg"
                                variant="brutalist"
                              >
                                Review partial access confirmation
                              </Button>
                            </div>
                          </div>
                        )}

                        {tiktokShareResult && !tiktokShareResult.success && (
                          <div className="border-2 border-[var(--warning)] bg-[var(--warning)]/10 p-4 text-[var(--ink)]">
                            <p className="font-semibold mb-2">Automation completed with issues</p>
                            <p className="text-sm mb-3">
                              Some advertisers could not be shared automatically. Complete them manually in TikTok Business Center.
                            </p>
                            <ul className="text-sm space-y-1">
                              {tiktokShareResult.results
                                .filter((item) => item.status === 'failed')
                                .map((item) => (
                                  <li key={item.advertiserId}>
                                    {item.advertiserId}: {item.error || 'Manual action required'}
                                  </li>
                                ))}
                            </ul>

                            {tiktokShareResult.manualFallback?.agencyBusinessCenterId && (
                              <p className="text-sm mt-3">
                                Agency Business Center ID: <span className="font-semibold">{tiktokShareResult.manualFallback.agencyBusinessCenterId}</span>
                              </p>
                            )}

                            <div className="mt-4 flex flex-wrap gap-3">
                              <a
                                href="https://business.tiktok.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 border-2 border-black dark:border-white font-semibold text-[var(--ink)] hover:bg-muted/20 transition-colors"
                              >
                                Open TikTok Business Center
                              </a>
                              <Button
                                onClick={() => setCurrentStep(3)}
                                size="lg"
                                variant="brutalist"
                              >
                                Review partial access confirmation
                              </Button>
                            </div>
                          </div>
                        )}

                        {tiktokShareResult?.success && (
                          <div className="border-2 border-[var(--teal)] bg-[var(--teal)]/10 p-4 text-success-ink">
                            <p className="font-semibold">TikTok partner sharing completed</p>
                            <p className="text-sm mt-1">
                              Selected advertisers were shared with your agency Business Center.
                            </p>
                          </div>
                        )}
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            </div>
          );

      case 3: {
        const hasTikTokPartialShare =
          platform === 'tiktok' && Boolean(tiktokShareResult?.partialFailure || tiktokShareError);

        return (
          <div className="space-y-4 py-3">
            {/* Compact success header - start visible to avoid blank-state when enter animation fails */}
            <m.div
              initial={{ opacity: 1, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <m.div
                initial={{ scale: 1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, type: 'spring' }}
                className={`flex h-10 w-10 shrink-0 items-center justify-center border ${
                  metaGrantPhaseHeader?.successTone ?? !hasMetaFollowUp
                    ? 'border-[var(--teal)] bg-[var(--teal)]/10'
                    : 'border-black/20 bg-muted/30 dark:border-white/20'
                }`}
              >
                <CheckCircle2
                  className={`w-5 h-5 ${
                    metaGrantPhaseHeader?.successTone ?? !hasMetaFollowUp
                      ? 'text-success-ink'
                      : 'text-muted-foreground'
                  }`}
                />
              </m.div>
              <div>
                <h3 className="text-lg font-bold text-[var(--ink)] font-display">
                  {metaGrantPhaseHeader?.title ??
                    (hasMetaFollowUp ? 'Signed in' : 'Connected')}
                </h3>
                <p className="text-sm text-muted-foreground text-balance">
                  {metaGrantPhaseHeader?.subtitle ??
                    (hasMetaFollowUp
                      ? 'Finish the steps below to share access with your agency.'
                      : hasTikTokPartialShare
                        ? 'Some TikTok accounts require manual sharing.'
                        : hasZeroAssetFollowUp
                          ? `Some ${platformName} products still need follow-up.`
                          : 'Access granted to the accounts you selected.')}
                </p>
              </div>
            </m.div>

            {/* R4: the pending-grant checklist lives here, not on step 2.
                Panel completions only settle items (overlay + refetch ask). */}
            {platform === 'meta' && metaNeedsGrantStep && connectionId ? (
              <MetaGrantChecklist
                rows={metaFulfillment}
                declines={metaDeclines}
                selectedAssets={groupAssets['meta_ads']}
                connectionId={connectionId}
                accessRequestToken={accessRequestToken}
                businessId={businessId}
                businessName={businessName}
                metaCatalogEnabled={metaCatalogEnabled}
                requestedPageTasks={metaAccessConfig?.pageTasks}
                onError={setError}
                onItemSettled={handleItemSettled}
                overlay={checklistOverlay}
              />
            ) : null}

            {/* Collapsible shared accounts – collapsed by default, compact and secondary */}
            <div className="border-2 border-black dark:border-white overflow-hidden">
              <button
                type="button"
                onClick={() => setSharedAccountsExpanded(!sharedAccountsExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between bg-muted/20 dark:bg-muted/60 hover:bg-muted/30 dark:hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  See which accounts you shared
                </span>
                <m.div
                  animate={{ rotate: sharedAccountsExpanded ? 0 : -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </m.div>
              </button>

              <AnimatePresence initial={false}>
                {sharedAccountsExpanded && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 pt-0 space-y-2">
                      {Object.entries(groupAssets).map(([product, assets]) => {
                        const productNameMap: Record<string, string> = {
                          'google_ads': 'Google Ads',
                          'ga4': 'Google Analytics',
                          'google_tag_manager': 'Tag Manager',
                          'google_search_console': 'Search Console',
                          'google_merchant_center': 'Merchant Center',
                          'google_business_profile': 'Business Profile',
                          'meta_ads': 'Meta Ads',
                          'meta_pages': 'Meta Pages',
                          'linkedin_ads': 'LinkedIn Ads',
                          'linkedin_pages': 'LinkedIn Pages',
                          'tiktok': 'TikTok Ads',
                          'tiktok_ads': 'TikTok Ads',
                        };
                        const productName = PLATFORM_NAMES[product as Platform] || productNameMap[product] || product;
                        const isWarning =
                          (hasNoAssetsFollowUp(product, assets) &&
                            getSelectedAssetCount(product, assets) === 0) ||
                          hasGrantFollowUp(product, assets, metaChecklist);
                        const summaryLines = getProductSummaryLines(product, assets, metaChecklist);
                        const assetNames: string[] = assets.selectedAssetNames || [];

                        return (
                          <div
                            key={product}
                            className={`rounded-none border px-3 py-2.5 text-left ${
                              isWarning
                                ? 'border-[var(--warning)]/60 bg-[var(--warning)]/5'
                                : 'border-[var(--teal)]/40 bg-[var(--teal)]/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <PlatformIcon platform={product as Platform} size="sm" />
                              <span className="text-sm font-semibold text-[var(--ink)]">{productName}</span>
                              {summaryLines.length > 0 && !summaryLines[0].startsWith('Follow-up') && (
                                <span className="ml-auto text-xs font-medium text-success-ink">
                                  {summaryLines[0]}
                                </span>
                              )}
                            </div>

                            {assetNames.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {assetNames.slice(0, 4).map((name) => (
                                  <span
                                    key={name}
                                    className="rounded-none px-2 py-0.5 text-xs text-muted-foreground"
                                  >
                                    {name}
                                  </span>
                                ))}
                                {assetNames.length > 4 && (
                                  <span className="rounded-none px-2 py-0.5 text-xs text-muted-foreground">
                                    +{assetNames.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}

                            {summaryLines
                              .filter((line) => line.startsWith('Follow-up needed'))
                              .map((line) => (
                                <p key={line} className="mt-1 text-xs text-[var(--warning)]">
                                  {line}
                                </p>
                              ))}
                            {product === 'meta_ads' &&
                            (groupAssets['meta_ads']?.instagramAccounts?.length ?? 0) > 0 &&
                            typeof groupAssets['meta_ads']?.selectedBusinessId === 'string' ? (
                              <a
                                className="mt-2 inline-flex min-h-[44px] items-center font-semibold text-[var(--ink)] underline"
                                href={`https://business.facebook.com/settings/${encodeURIComponent(groupAssets['meta_ads'].selectedBusinessId)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Manage Instagram sharing in Meta
                              </a>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            {metaChecklist.remainingCount > 0 ? (
              <ClientGrantSecondaryButton type="button" onClick={handleFinishClick}>
                {`Finish when done (${metaChecklist.remainingCount} left)`}
              </ClientGrantSecondaryButton>
            ) : (
              <ClientGrantPrimaryButton type="button" onClick={handleFinishClick}>
                {finalActionLabel}
              </ClientGrantPrimaryButton>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (isManualPlatform && !deferManualRedirect) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-danger-ink" />
      </div>
    );
  }

  const stepContent = renderStepContent();

  // The share screen's primary action renders at the card boundary, outside
  // every collapsible stage card's overflow-hidden container, so it stays
  // visible and reachable at narrow viewports (R4, R13 enabler).
  const shareFooter = ctaResolution ? (
    <div className="border-t-2 border-black bg-card p-4 dark:border-white">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Button
          onClick={handlePrimaryAction}
          disabled={ctaResolution.disabled}
          isLoading={isProcessing || isTikTokSharing}
          size="xl"
          variant="brutalist"
          className="w-full sm:w-auto"
          aria-describedby={ctaResolution.reason ? 'wizard-primary-action-reason' : undefined}
          rightIcon={
            !ctaResolution.disabled && !(isProcessing || isTikTokSharing) ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : undefined
          }
        >
          {ctaResolution.kind === 'advance'
            ? 'Continue'
            : 'Share Access'}
        </Button>
        {ctaResolution.reason ? (
          <p
            id="wizard-primary-action-reason"
            aria-live="polite"
            className="text-sm text-muted-foreground sm:max-w-[16rem] sm:text-right"
          >
            {ctaResolution.reason}
          </p>
        ) : null}
      </div>
    </div>
  ) : undefined;

  return (
    <PlatformWizardCard
      platform={platform}
      platformName={platformName}
      currentStep={currentStep}
      totalSteps={maxSteps}
      chrome="minimal"
      footer={shareFooter}
    >
      {stepContent}
    </PlatformWizardCard>
  );
}
