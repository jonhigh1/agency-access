'use client';

/**
 * PlatformAuthWizard - Main 3-step wizard for platform authorization
 *
 * Steps:
 * 1. Connect: OAuth authorization button
 * 2. Select Assets: MetaAssetSelector with asset fetching
 * 3. Connected: Success confirmation with granted assets list
 *
 * State Management:
 * - currentStep: tracks wizard progress
 * - sessionId: from OAuth callback, used for asset fetching
 * - selectedAssets: assets chosen by client
 * - grantedAssets: confirmation from backend after grant
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { m, AnimatePresence } from 'framer-motion';
import { Loader2, ExternalLink, CheckCircle2, ChevronDown } from 'lucide-react';
import { PlatformWizardCard } from './PlatformWizardCard';
import { MetaAssetSelector } from './MetaAssetSelector';
import { GoogleAssetSelector } from './GoogleAssetSelector';
import { LinkedInAssetSelector } from './LinkedInAssetSelector';
import { TikTokAssetSelector } from './TikTokAssetSelector';
import { AutomaticPagesGrant } from './AutomaticPagesGrant';
import { AdAccountSharingInstructions } from './AdAccountSharingInstructions';
import type { ManualMetaShareCompletionResult } from './AdAccountSharingInstructions';
import { StepHelpText } from './StepHelpText';
import { PlatformIcon, Button } from '@/components/ui';
import { PLATFORM_NAMES } from '@agency-platform/shared';
import type { Platform } from '@agency-platform/shared';
import { trackOnboardingEvent } from '@/lib/analytics/onboarding';
import {
  trackClientOAuthExchangeFailure,
  trackClientOAuthExchangeSuccess,
} from '@/lib/analytics/oauth-events';
import { rememberInviteOAuthReturnToken } from '@/lib/client-invite-oauth';
import { getClientInviteManualRoute } from '@/lib/client-invite-platforms';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';
import { launchMetaClientPopupLogin } from '@/lib/meta-business-login';

interface PlatformAuthWizardProps {
  platform: Platform;
  platformName: string;
  products: Array<{ product: string; accessLevel: string }>;
  accessRequestToken: string;
  onComplete: () => void;
  completionActionLabel?: string;
  deferManualRedirect?: boolean;
  // Optional initial values from OAuth callback
  initialConnectionId?: string;
  initialStep?: 1 | 2 | 3;
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

function isMetaAssetProduct(product: string): boolean {
  return product === 'meta_ads' || product === 'meta_pages';
}

function supportsAssetSelection(product: string): boolean {
  return (
    isMetaAssetProduct(product) ||
    product.startsWith('google_') ||
    product === 'ga4' ||
    product === 'linkedin_ads' ||
    product === 'linkedin_pages' ||
    product === 'tiktok' ||
    product === 'tiktok_ads'
  );
}

function isGoogleProduct(product: string): boolean {
  return product.startsWith('google_') || product === 'ga4';
}

function clampStep(step: number): 1 | 2 | 3 {
  return step > 3 ? 3 : step as 1 | 2 | 3;
}

function hasNoAssetsFollowUp(product: string, assets: any): boolean {
  if (
    (isGoogleProduct(product) || product === 'linkedin_ads' || product === 'linkedin_pages') &&
    assets.availableAssetCount === 0
  ) {
    return true;
  }

  if (
    (product === 'tiktok' || product === 'tiktok_ads') &&
    Array.isArray(assets.availableAdvertisers) &&
    assets.availableAdvertisers.length === 0
  ) {
    return true;
  }

  return false;
}

function getMetaFollowUpLines(assets: any): string[] {
  const lines: string[] = [];
  const unresolvedManualResults = Array.isArray(assets.manualAdAccountVerificationResults)
    ? assets.manualAdAccountVerificationResults.filter(
        (result: any) => result?.status && result.status !== 'verified'
      )
    : [];

  if (unresolvedManualResults.length > 0) {
    unresolvedManualResults.forEach((result: any) => {
      const assetName =
        typeof result.assetName === 'string' && result.assetName.length > 0
          ? result.assetName
          : typeof result.assetId === 'string'
            ? result.assetId
            : 'Selected ad account';
      lines.push(`Follow-up needed: ${assetName} still needs manual Meta sharing`);
    });
  } else if (assets.manualAdAccountShareStatus === 'partial') {
    lines.push('Follow-up needed: Some ad accounts still require manual sharing');
  }

  const selectedInstagramAccounts = Array.isArray(assets.selectedInstagramWithNames)
    ? assets.selectedInstagramWithNames
    : Array.isArray(assets.instagramAccounts)
      ? assets.instagramAccounts.map((id: string) => ({ id, name: id }))
      : [];

  selectedInstagramAccounts.forEach((account: any) => {
    const accountName =
      typeof account?.name === 'string' && account.name.length > 0
        ? account.name
        : typeof account?.id === 'string'
          ? account.id
          : 'Selected Instagram account';
    lines.push(
      `Follow-up needed: ${accountName} requires manual follow-up because Instagram automation is not supported yet`
    );
  });

  return lines;
}

function hasGrantFollowUp(product: string, assets: any): boolean {
  return isMetaAssetProduct(product) && getMetaFollowUpLines(assets).length > 0;
}

function getSelectedAssetCount(product: string, assets: any): number {
  switch (product) {
    case 'google_ads':
    case 'meta_ads':
    case 'linkedin_ads':
    case 'linkedin_pages':
      return (assets.adAccounts?.length ?? 0) + (assets.pages?.length ?? 0) + (assets.instagramAccounts?.length ?? 0);
    case 'meta_pages':
      return assets.pages?.length ?? 0;
    case 'ga4':
      return assets.properties?.length ?? 0;
    case 'google_business_profile':
      return assets.businessAccounts?.length ?? 0;
    case 'google_tag_manager':
      return assets.containers?.length ?? 0;
    case 'google_search_console':
      return assets.sites?.length ?? 0;
    case 'google_merchant_center':
      return assets.merchantAccounts?.length ?? 0;
    case 'tiktok':
    case 'tiktok_ads':
      return (assets.selectedAdvertiserIds?.length ?? 0) || (assets.adAccounts?.length ?? 0) || 0;
    default:
      return 0;
  }
}

function isProductReadyForSave(product: string, assets: any): boolean {
  const selectedCount = getSelectedAssetCount(product, assets);
  if (selectedCount > 0) {
    return true;
  }

  if (hasNoAssetsFollowUp(product, assets)) {
    return true;
  }

  return false;
}

function getProductSummaryLines(product: string, assets: any): string[] {
  switch (product) {
    case 'google_ads':
      if ((assets.adAccounts?.length ?? 0) > 0) return [`${assets.adAccounts.length} Ad Account${assets.adAccounts.length === 1 ? '' : 's'} selected`];
      if (assets.availableAssetCount === 0) return ['Follow-up needed: No ad accounts found yet'];
      return [];
    case 'ga4':
      if ((assets.properties?.length ?? 0) > 0) return [`${assets.properties.length} Propert${assets.properties.length === 1 ? 'y' : 'ies'} selected`];
      if (assets.availableAssetCount === 0) return ['Follow-up needed: No properties found yet'];
      return [];
    case 'google_business_profile':
      if ((assets.businessAccounts?.length ?? 0) > 0) return [`${assets.businessAccounts.length} Location${assets.businessAccounts.length === 1 ? '' : 's'} selected`];
      if (assets.availableAssetCount === 0) return ['Follow-up needed: No locations found yet'];
      return [];
    case 'google_tag_manager':
      if ((assets.containers?.length ?? 0) > 0) return [`${assets.containers.length} Container${assets.containers.length === 1 ? '' : 's'} selected`];
      if (assets.availableAssetCount === 0) return ['Follow-up needed: No containers found yet'];
      return [];
    case 'google_search_console':
      if ((assets.sites?.length ?? 0) > 0) return [`${assets.sites.length} Site${assets.sites.length === 1 ? '' : 's'} selected`];
      if (assets.availableAssetCount === 0) return ['Follow-up needed: No sites found yet'];
      return [];
    case 'google_merchant_center':
      if ((assets.merchantAccounts?.length ?? 0) > 0) return [`${assets.merchantAccounts.length} Account${assets.merchantAccounts.length === 1 ? '' : 's'} selected`];
      if (assets.availableAssetCount === 0) return ['Follow-up needed: No Merchant Center accounts found yet'];
      return [];
    case 'meta_ads': {
      const lines: string[] = [];
      if ((assets.adAccounts?.length ?? 0) > 0) lines.push(`${assets.adAccounts.length} Ad Account${assets.adAccounts.length === 1 ? '' : 's'} selected`);
      if ((assets.pages?.length ?? 0) > 0) lines.push(`${assets.pages.length} Page${assets.pages.length === 1 ? '' : 's'} selected`);
      if ((assets.instagramAccounts?.length ?? 0) > 0) lines.push(`${assets.instagramAccounts.length} IG Account${assets.instagramAccounts.length === 1 ? '' : 's'} selected`);
      lines.push(...getMetaFollowUpLines(assets));
      return lines;
    }
    case 'meta_pages':
      if ((assets.pages?.length ?? 0) > 0) return [`${assets.pages.length} Page${assets.pages.length === 1 ? '' : 's'} selected`];
      return [];
    case 'linkedin_ads':
      if ((assets.adAccounts?.length ?? 0) > 0) return [`${assets.adAccounts.length} Ad Account${assets.adAccounts.length === 1 ? '' : 's'} selected`];
      if (assets.availableAssetCount === 0) return ['Follow-up needed: No ad accounts found yet'];
      return [];
    case 'linkedin_pages':
      if ((assets.pages?.length ?? 0) > 0) return [`${assets.pages.length} Page${assets.pages.length === 1 ? '' : 's'} selected`];
      if (assets.availableAssetCount === 0) return ['Follow-up needed: No pages found yet'];
      return [];
    case 'tiktok':
    case 'tiktok_ads':
      if ((assets.selectedAdvertiserIds?.length ?? 0) > 0) {
        return [`${assets.selectedAdvertiserIds.length} Advertiser${assets.selectedAdvertiserIds.length === 1 ? '' : 's'} selected`];
      }
      if ((assets.adAccounts?.length ?? 0) > 0) {
        return [`${assets.adAccounts.length} Advertiser${assets.adAccounts.length === 1 ? '' : 's'} selected`];
      }
      if (Array.isArray(assets.availableAdvertisers) && assets.availableAdvertisers.length === 0) {
        return ['Follow-up needed: No advertisers found yet'];
      }
      return [];
    default:
      return [];
  }
}

export function PlatformAuthWizard({
  platform,
  platformName,
  products,
  accessRequestToken,
  onComplete,
  completionActionLabel,
  deferManualRedirect = false,
  initialConnectionId,
  initialStep,
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
  const finalActionLabel = completionActionLabel || 'Continue to next platform';

  // Redirect platforms to manual flow (no OAuth - uses team invitations)
  useEffect(() => {
    if (manualRoute && !deferManualRedirect) {
      router.push(`/invite/${accessRequestToken}/${manualRoute}` as any);
    }
  }, [accessRequestToken, deferManualRedirect, manualRoute, router]);

  // Initialize with props if returning from OAuth callback
  // All platforms use 3 steps: Connect → Choose Accounts & Grant Access → Done
  const metaNeedsGrantStep = platform === 'meta' && primaryMetaAssetProduct !== null;
  const maxSteps = 3;
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(initialStep ? clampStep(initialStep) : 1);
  const [connectionId, setConnectionId] = useState<string | null>(initialConnectionId || null);
  const [groupAssets, setGroupAssets] = useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [businessIdLoading, setBusinessIdLoading] = useState(false);
  const [businessIdError, setBusinessIdError] = useState<string | null>(null);
  const [pagesGranted, setPagesGranted] = useState(false);
  const [metaAdAccountShareStatus, setMetaAdAccountShareStatus] = useState<
    'idle' | 'verified' | 'partial'
  >('idle');
  const [assetsSaved, setAssetsSaved] = useState(false);
  const [chooseAccountsExpanded, setChooseAccountsExpanded] = useState(true);
  const [grantAccessExpanded, setGrantAccessExpanded] = useState(true);
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

  // Derived Meta asset state (single source for grant-step decisions)
  const metaAdAssets = groupAssets['meta_ads'] || {};
  const hasMetaPages = (metaAdAssets.pages?.length ?? 0) > 0;
  const hasMetaAdAccounts = (metaAdAssets.adAccounts?.length ?? 0) > 0;

  // Step 1: Initiate OAuth (or Meta popup)
  const handleConnectClick = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      // Meta client invite: try popup first, fallback to redirect when SDK blocked (e.g. Firefox tracking protection)
      if (platform === 'meta') {
        const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim();
        if (!appId) {
          setError('Meta login is not configured. Please contact your agency.');
          setIsProcessing(false);
          return;
        }

        try {
          const stateResponse = await fetch(`${apiBaseUrl}/api/client/${accessRequestToken}/oauth-state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'meta' }),
          });

          const stateJson = await parseJsonResponse<{
            data: { state: string };
            error: null | { message?: string };
          }>(stateResponse, {
            fallbackErrorMessage: 'Failed to prepare Meta login',
          });

          if (stateJson.error || !stateJson.data?.state) {
            throw new Error(stateJson.error?.message || 'Failed to prepare Meta login');
          }

          const authPayload = await launchMetaClientPopupLogin(appId);

          const finalizeResponse = await fetch(`${apiBaseUrl}/api/client/${accessRequestToken}/meta/finalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: stateJson.data.state,
              accessToken: authPayload.accessToken,
              userId: authPayload.userId,
              expiresIn: authPayload.expiresIn,
              signedRequest: authPayload.signedRequest,
              dataAccessExpirationTime: authPayload.dataAccessExpirationTime,
            }),
          });

          const finalizeJson = await parseJsonResponse<{
            data: { connectionId: string; platform: string; token: string };
            error: null | { message?: string };
          }>(finalizeResponse, {
            fallbackErrorMessage: 'Failed to complete Meta connection',
          });

          if (finalizeJson.error || !finalizeJson.data?.connectionId) {
            throw new Error(finalizeJson.error?.message || 'Failed to complete Meta connection');
          }

          trackClientOAuthExchangeSuccess({
            platform: finalizeJson.data.platform,
            access_request_token: accessRequestToken,
            connection_id: finalizeJson.data.connectionId,
            auth_source: 'client_meta_popup',
          });

          setConnectionId(finalizeJson.data.connectionId);
          setCurrentStep(2);
          setIsProcessing(false);
          return;
        } catch (popupError) {
          trackClientOAuthExchangeFailure({
            platform: 'meta',
            error_code: 'META_POPUP_FAILED',
            error_message:
              popupError instanceof Error ? popupError.message : 'Meta popup login failed',
            auth_source: 'client_meta_popup',
            access_request_token: accessRequestToken,
          });
          // Fallback to redirect when popup fails (e.g. Firefox Enhanced Tracking Protection blocks Facebook SDK)
          const response = await fetch(`${apiBaseUrl}/api/client/${accessRequestToken}/oauth-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'meta' }),
          });

          const json = await parseJsonResponse<{
            data: { authUrl: string };
            error: null | { message?: string };
          }>(response, {
            fallbackErrorMessage: 'Failed to start Meta authorization',
          });

          if (json.error) {
            throw new Error(json.error?.message || 'Failed to start Meta authorization');
          }

          rememberInviteOAuthReturnToken(accessRequestToken);
          window.location.href = json.data.authUrl;
          return;
        }
      }

      // All other platforms: redirect flow
      const response = await fetch(`${apiBaseUrl}/api/client/${accessRequestToken}/oauth-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
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

      const { authUrl } = json.data;

      if (platform === 'tiktok') {
        trackOnboardingEvent('client_tiktok_connect_clicked', {
          platform,
          step: 1,
          requestedProducts: products.map((p) => p.product),
        });
      }

      rememberInviteOAuthReturnToken(accessRequestToken);

      // Redirect to external OAuth provider
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate OAuth');
      setIsProcessing(false);
    }
  };

  // Update selection for a specific product in the group
  const handleProductSelectionChange = useCallback((product: string, selectedAssets: any) => {
    setGroupAssets((prev) => {
      if (isMetaAssetProduct(product)) {
        return {
          ...prev,
          meta_ads: selectedAssets,
          meta_pages: selectedAssets,
          [product]: selectedAssets,
        };
      }

      return {
        ...prev,
        [product]: selectedAssets,
      };
    });

    if (isMetaAssetProduct(product)) {
      setPagesGranted(false);
      setMetaAdAccountShareStatus('idle');
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
  }, [platform]);

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

    try {
      setIsProcessing(true);
      setError(null);

      // Save each product in order because each response updates shared connection state.
      for (const p of products) {
        const selectedAssets = groupAssets[p.product] || {};
        const response = await fetch(`${apiBaseUrl}/api/client/${accessRequestToken}/save-assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            platform: p.product, // Product-level ID for saving
            selectedAssets,
          }),
        });
        const json = await parseJsonResponse<{ error?: { message?: string } }>(response, {
          fallbackErrorMessage: 'Failed to save some selected assets',
        });
        if (json.error) {
          throw new Error(json.error.message || 'Failed to save some selected assets');
        }
      }

      // Mark assets as saved
      setAssetsSaved(true);

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

      // After saving, stay on step 2 to show grant access UI (for Meta) or go to final step
      // For Meta with pages/ad accounts, grant access is shown in step 2
      // For other platforms or Meta without grant needs, go to final step
      if (metaNeedsGrantStep) {
        if (hasMetaPages || hasMetaAdAccounts) {
          // Stay on step 2 to show grant access UI
          setChooseAccountsExpanded(false);
          setGrantAccessExpanded(true);
        } else {
          setCurrentStep(3);
        }
      } else if (platform !== 'tiktok') {
        // TikTok progress is controlled by the partner-share automation result above.
        setCurrentStep(3);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assets');
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if any assets are selected in the group
  const canContinueFromAssetSelection = () => {
    const selectableProducts = products.filter((product) => supportsAssetSelection(product.product));
    if (selectableProducts.length === 0) {
      return false;
    }

    return selectableProducts.every((product) =>
      isProductReadyForSave(product.product, groupAssets[product.product] || {})
    );
  };

  const hasZeroAssetFollowUp = Object.entries(groupAssets).some(
    ([product, assets]) => getSelectedAssetCount(product, assets) === 0 && hasNoAssetsFollowUp(product, assets)
  );
  const hasMetaFollowUp =
    platform === 'meta' && getMetaFollowUpLines(groupAssets['meta_ads'] || {}).length > 0;

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
              <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-4 text-[var(--coral)]">
                {error}
              </div>
            )}

            <Button
              onClick={handleConnectClick}
              isLoading={isProcessing}
              size="xl"
              variant="brutalist"
              rightIcon={!isProcessing ? <ExternalLink className="w-5 h-5" /> : undefined}
            >
              Connect {platformName}
            </Button>

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
                <span className="text-4xl">🔐</span>
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
                <CheckCircle2 className="w-10 h-10 text-[var(--teal)]" />
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
                <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-4 text-[var(--coral)]">
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
            {/* Choose Accounts Section - Brutalist Card */}
            <div className="border-2 border-black dark:border-white overflow-hidden">
              <button
                type="button"
                onClick={() => setChooseAccountsExpanded(!chooseAccountsExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between bg-muted/20 dark:bg-muted/60 hover:bg-muted/30 dark:hover:bg-muted/50 transition-colors"
              >
                <div className="text-left">
                  <h3 className="text-xl font-bold text-[var(--ink)] font-display">
                    Choose accounts to share
                  </h3>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                    Select the specific accounts you want to share.
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
                {chooseAccountsExpanded && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 space-y-3">
            {error && (
                        <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-3 text-[var(--coral)] text-sm">
                {error}
              </div>
            )}

            <div className="space-y-10">
              {/* Show all products that require asset selection */}
              {products
                .filter((p) => supportsAssetSelection(p.product))
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
                  const productName = PLATFORM_NAMES[p.product as Platform] || productNameMap[p.product] || p.product;

                  return (
                    <div key={p.product} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={p.product as Platform} size="sm" />
                        <h4 className="text-sm font-semibold text-[var(--ink)] font-display">{productName}</h4>
                      </div>

                      {isMetaAssetProduct(p.product) && primaryMetaAssetProduct === p.product && (
                        <div className="relative">
                          <MetaAssetSelector
                            sessionId={connectionId!}
                            accessRequestToken={accessRequestToken}
                            businessId={businessId || undefined}
                            allowedAssetTypes={
                              p.product === 'meta_pages' && !requestedMetaAssetProducts.includes('meta_ads')
                                ? ['page']
                                : ['ad_account', 'page', 'instagram']
                            }
                            onSelectionChange={(selectedAssets) => {
                              // Store both IDs and full asset objects for grant step
                              // selectedAssets now includes selectedPagesWithNames, etc. from MetaAssetSelector
                              handleProductSelectionChange(p.product, selectedAssets);
                            }}
                            onError={setError}
                          />
                        </div>
                      )}

                      {isMetaAssetProduct(p.product) && primaryMetaAssetProduct !== p.product && (
                        <p className="text-sm text-muted-foreground">
                          Account selection is shared with {PLATFORM_NAMES[primaryMetaAssetProduct as Platform] || primaryMetaAssetProduct}.
                        </p>
                      )}

                      {/* Use generic GoogleAssetSelector for all Google products */}
                      {(p.product.startsWith('google_') || p.product === 'ga4') && (
                        <div className="relative">
                          <GoogleAssetSelector
                            sessionId={connectionId!}
                            accessRequestToken={accessRequestToken}
                            product={p.product}
                            onSelectionChange={(assets) => handleProductSelectionChange(p.product, assets)}
                            onError={setError}
                          />
                        </div>
                      )}

                      {(p.product === 'tiktok' || p.product === 'tiktok_ads') && (
                        <div className="relative">
                          <TikTokAssetSelector
                            sessionId={connectionId!}
                            accessRequestToken={accessRequestToken}
                            onSelectionChange={(assets) => handleProductSelectionChange(p.product, assets)}
                            onError={setError}
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
                            onError={setError}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

                        {/* Unified Batch Save Button - only show if assets haven't been saved yet */}
                        {!assetsSaved && !isProcessing && canContinueFromAssetSelection() && (
            <div className="sticky bottom-0 bg-card border-t-2 border-black dark:border-white p-3 -mx-3 -mb-3 mt-4 flex justify-center">
              <Button
                onClick={handleBatchSave}
                disabled={!canContinueFromAssetSelection()}
                isLoading={isProcessing}
                size="xl"
                variant="brutalist"
                rightIcon={!isProcessing ? <CheckCircle2 className="w-6 h-6" /> : undefined}
              >
                {hasZeroAssetFollowUp ? 'Share access' : 'Share Access'}
              </Button>
            </div>
                        )}
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
          </div>

          {/* Section Divider for Meta Grant Access */}
          {platform === 'meta' && metaNeedsGrantStep && connectionId && assetsSaved && (() => {
            if (!hasMetaPages && !hasMetaAdAccounts) {
              return null;
            }

            return (
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-black dark:border-white" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-4 text-sm text-muted-foreground font-bold uppercase tracking-wider">then</span>
                </div>
              </div>
            );
          })()}

            {/* Grant Access Section (for Meta after assets are saved) - Brutalist Card */}
            {platform === 'meta' && metaNeedsGrantStep && connectionId && assetsSaved && (() => {
          const metaAssets = groupAssets['meta_ads'] || {};
          const selectedPages = metaAssets.selectedPagesWithNames ||
            (metaAssets.pages || []).map((id: string) => {
              const allPages = metaAssets.allPages || [];
              const page = allPages.find((p: any) => p.id === id);
              return { id, name: page?.name || id };
            });
          const selectedAdAccounts = metaAssets.selectedAdAccountsWithNames ||
            (metaAssets.adAccounts || []).map((id: string) => {
              const allAdAccounts = metaAssets.allAdAccounts || [];
              const account = allAdAccounts.find((a: any) => a.id === id);
              return { id, name: account?.name || id };
            });
          const hasPages = selectedPages.length > 0;
          const hasAdAccounts = selectedAdAccounts.length > 0;

              // Only show grant access UI if there are pages or ad accounts
              if (!hasPages && !hasAdAccounts) {
                return null;
              }

          return (
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
                        Complete the steps below to grant access to your selected accounts.
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
                        <div className="p-4">

                  {/* Show error banner if Business Manager ID is missing */}
                  {businessIdError && (
                    <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-4 text-[var(--coral)] mb-4">
                      <p className="font-semibold">{businessIdError}</p>
                    </div>
                  )}

              {error && (
                    <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-4 text-[var(--coral)] mb-4">
                  {error}
                </div>
              )}

              {hasPages && (
                <AutomaticPagesGrant
                  selectedPages={selectedPages}
                  accessLevel="Admin"
                      connectionId={connectionId}
                  accessRequestToken={accessRequestToken}
                  onGrantComplete={(results) => {
                    setPagesGranted(results.some((r) => r.status === 'granted'));
                    // If ad accounts also need sharing, wait; otherwise advance
                    if (
                      !hasAdAccounts ||
                      metaAdAccountShareStatus === 'verified' ||
                      metaAdAccountShareStatus === 'partial'
                    ) {
                          setCurrentStep(3);
                    }
                  }}
                  onError={setError}
                />
              )}

              {hasAdAccounts && businessId && (
                    <div className={hasPages ? 'mt-8' : ''}>
                  <AdAccountSharingInstructions
                    businessId={businessId}
                    businessName={businessName || undefined}
                    selectedAdAccounts={selectedAdAccounts}
                    accessRequestToken={accessRequestToken}
                        connectionId={connectionId}
                    onComplete={(result: ManualMetaShareCompletionResult) => {
                      setMetaAdAccountShareStatus(result.status);
                      setGroupAssets((prev) => ({
                        ...prev,
                        meta_ads: {
                          ...(prev.meta_ads || {}),
                          manualAdAccountShareStatus: result.status,
                          manualAdAccountVerificationResults: result.verificationResults || [],
                        },
                      }));
                      // If pages also need granting, wait; otherwise advance
                      if (!hasPages || pagesGranted) {
                            setCurrentStep(3);
                      }
                    }}
                    onError={setError}
                  />
                </div>
              )}

              {hasAdAccounts && !businessId && (
                    <div className={`border-2 p-6 ${
                      businessIdError
                        ? 'border-[var(--coral)] bg-[var(--coral)]/10'
                        : 'border-[var(--warning)] bg-[var(--warning)]/10'
                    }`}>
                      {businessIdLoading ? (
                        <p className="text-[var(--warning)] flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading Business Manager ID...
                        </p>
                      ) : businessIdError ? (
                        <div className="space-y-2">
                          <p className="text-[var(--coral)] font-semibold">Error loading Business Manager ID</p>
                          <p className="text-[var(--coral)] text-sm">{businessIdError}</p>
                        </div>
                      ) : (
                  <p className="text-[var(--warning)]">
                    Loading Business Manager ID...
                  </p>
                      )}
                    </div>
                  )}

                          {/* Continue button when both are complete */}
                          {(pagesGranted || !hasPages) &&
                          (!hasAdAccounts ||
                            metaAdAccountShareStatus === 'verified' ||
                            metaAdAccountShareStatus === 'partial') && (
                            <div className="mt-5 flex justify-center">
                              <Button
                                onClick={() => setCurrentStep(3)}
                                size="xl"
                                variant="brutalist"
                                rightIcon={<CheckCircle2 className="w-6 h-6" />}
                              >
                                Review access confirmation
                              </Button>
                </div>
              )}
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
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
                          <div className="border-2 border-[var(--coral)] bg-[var(--coral)]/10 p-4 text-[var(--coral)]">
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
                          <div className="border-2 border-[var(--teal)] bg-[var(--teal)]/10 p-4 text-[var(--teal)]">
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--teal)] bg-[var(--teal)]/10"
              >
                <CheckCircle2 className="w-5 h-5 text-[var(--teal)]" />
              </m.div>
              <div>
                <h3 className="text-lg font-bold text-[var(--ink)] font-display">
                  Connected
                </h3>
                <p className="text-sm text-muted-foreground">
                  {hasMetaFollowUp
                    ? 'Some Meta accounts still need follow-up.'
                    : hasTikTokPartialShare
                    ? 'Some TikTok accounts require manual sharing.'
                    : hasZeroAssetFollowUp
                      ? `Some ${platformName} products still need follow-up.`
                      : 'Access granted to the accounts you selected.'}
                </p>
              </div>
            </m.div>

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
                          hasGrantFollowUp(product, assets);
                        const summaryLines = getProductSummaryLines(product, assets);
                        const assetNames: string[] = assets.selectedAssetNames || [];

                        return (
                          <div
                            key={product}
                            className={`rounded-lg border px-3 py-2.5 text-left ${
                              isWarning
                                ? 'border-[var(--warning)]/60 bg-[var(--warning)]/5'
                                : 'border-[var(--teal)]/40 bg-[var(--teal)]/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <PlatformIcon platform={product as Platform} size="sm" />
                              <span className="text-sm font-semibold text-[var(--ink)]">{productName}</span>
                              {summaryLines.length > 0 && !summaryLines[0].startsWith('Follow-up') && (
                                <span className="ml-auto text-xs font-medium text-[var(--teal)]">
                                  {summaryLines[0]}
                                </span>
                              )}
                            </div>

                            {assetNames.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {assetNames.slice(0, 4).map((name) => (
                                  <span
                                    key={name}
                                    className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground"
                                  >
                                    {name}
                                  </span>
                                ))}
                                {assetNames.length > 4 && (
                                  <span className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
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
                          </div>
                        );
                      })}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              onClick={onComplete}
              variant="brutalist"
              size="lg"
              className="w-full"
            >
              {finalActionLabel}
            </Button>
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

  return (
    <PlatformWizardCard
      platform={platform}
      platformName={platformName}
      currentStep={currentStep}
      totalSteps={maxSteps}
      chrome="minimal"
    >
      {stepContent}
    </PlatformWizardCard>
  );
}
