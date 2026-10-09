'use client';

/**
 * OAuth Callback Page
 *
 * Handles OAuth callback success/error states.
 * Shows user-friendly messages and redirects appropriately.
 * For Meta, shows the consolidated portfolio selector (receipt-first) instead
 * of auto-redirect: agency onboarding and connections both return here.
 */

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import type { Route } from 'next';
import { AlertCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { PortfolioSelector, type PortfolioBusiness } from '@/components/client-auth/PortfolioSelector';
import { Button } from '@/components/ui/button';
import { startAgencyMetaOAuth } from '@/lib/agency-meta-oauth';
import {
  consumeOnboardingReturnIntent,
  getSessionDraftStorage,
  onboardingReturnUrl,
  peekOnboardingReturnIntent,
} from '@/lib/onboarding/onboarding-draft';
import { resolveApiUrl } from '@/lib/api/api-env';
import { META_CREATE_BUSINESS_PORTFOLIO_URL } from '@/lib/onboarding/meta-readiness';
import {
  trackOAuthCallbackFailure,
  trackOAuthCallbackSuccess,
} from '@/lib/analytics/oauth-events';
import { PLATFORM_NAMES, type Platform } from '@agency-platform/shared';

// Error message mapping
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_STATE: 'Security token is invalid or expired. Please try connecting again.',
  TOKEN_EXCHANGE_FAILED: 'Unable to complete authorization with the platform. Please try again.',
  CALLBACK_FAILED: 'An unexpected error occurred during connection. Please try again.',
  CONNECTOR_NOT_IMPLEMENTED: 'This platform connection is not yet available.',
  PLATFORM_ALREADY_CONNECTED: 'This platform is already connected to your agency.',
};

function CallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgId, getToken } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [countdown, setCountdown] = useState(5);
  const [showPortfolioSelector, setShowPortfolioSelector] = useState(false);
  const [confirmedBusiness, setConfirmedBusiness] = useState<PortfolioBusiness | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [isReauthenticating, setIsReauthenticating] = useState(false);

  const success = searchParams.get('success') === 'true';
  const platform = searchParams.get('platform');
  const errorCode = searchParams.get('error');
  const requireBusinessSelection = searchParams.get('requireBusinessSelection') === 'true';
  const connectionId = searchParams.get('connectionId');
  const agencyIdParam = searchParams.get('agencyId');
  const targetAgencyId = agencyIdParam || orgId;

  const platformName = platform ? PLATFORM_NAMES[platform as Platform] || platform : 'Platform';
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] || 'Something went wrong. Please try again.'
    : null;

  const isLoading = !success && !errorCode;

  // Set when the agency started this Meta connection from onboarding (read after mount: sessionStorage is client-only).
  const [returnToOnboarding, setReturnToOnboarding] = useState(false);
  useEffect(() => {
    setReturnToOnboarding(Boolean(peekOnboardingReturnIntent(getSessionDraftStorage())));
  }, []);

  // Complete Meta OAuth Mutation
  const { mutate: completeMetaOauth, isPending: isSaving } = useMutation({
    mutationFn: async ({ businessId, businessName }: { businessId: string; businessName: string }) => {
      const token = await getToken();
      const response = await fetch(resolveApiUrl('/agency-platforms/meta/complete-oauth'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          agencyId: agencyIdParam || orgId,
          connectionId,
          businessId,
          businessName,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to complete connection');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections', targetAgencyId] });
      queryClient.invalidateQueries({ queryKey: ['available-platforms', targetAgencyId] });
      // Started from onboarding's platform step: go back there (the draft keeps the Meta choice).
      const onboardingIntent = consumeOnboardingReturnIntent(getSessionDraftStorage());
      const destination = (onboardingIntent
        ? onboardingReturnUrl('connected')
        : '/connections?success=true&platform=meta') as Parameters<typeof router.push>[0];
      router.push(destination);
    },
    onError: (error: Error) => {
      setSaveError(error.message || 'Failed to complete connection');
    },
  });

  // Clerk-authenticated business discovery (KTD5). The endpoint returns
  // `{ data: { businesses: [{ id, name, verticalName?, verificationStatus? }] } }`.
  const portfolioQuery = useQuery({
    queryKey: ['meta-portfolio-businesses', targetAgencyId],
    enabled: showPortfolioSelector && Boolean(targetAgencyId),
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<PortfolioBusiness[]> => {
      const token = await getToken();
      const response = await fetch(
        resolveApiUrl(`/agency-platforms/meta/business-accounts?agencyId=${targetAgencyId}&refresh=true`),
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      if (!response.ok) throw new Error('Failed to load your Meta business portfolios.');
      const result = await response.json();
      const businesses = (result?.data?.businesses || []) as Array<Record<string, unknown>>;
      return businesses
        .filter((business) => business?.id && business?.name)
        .map((business) => ({
          id: String(business.id),
          name: String(business.name),
          ...(typeof business.verificationStatus === 'string'
            ? { verificationStatus: business.verificationStatus }
            : {}),
          ...(typeof business.verticalName === 'string'
            ? { vertical: business.verticalName }
            : {}),
        }));
    },
  });

  const portfolioBusinesses = portfolioQuery.data ?? [];
  // Receipt-first (R6): a single owner business is confirmed automatically.
  const selectedBusiness =
    confirmedBusiness ?? (portfolioBusinesses.length === 1 ? portfolioBusinesses[0] : null);

  const handlePortfolioSelect = (business: PortfolioBusiness) => {
    if (isSaving) return;
    setSaveError(null);
    setConfirmedBusiness(business);
    void capturePosthogEvent('meta_business_portfolio_selected', {
      agency_id: agencyIdParam || orgId,
      connection_id: connectionId,
      platform: 'meta',
      business_id: business.id,
    });
    completeMetaOauth({ businessId: business.id, businessName: business.name });
  };

  // The receipt view has no confirm button, so the auto-selected single owner
  // must fire the save itself — once. A failed save still allows the manual
  // escape → chooser path to retry through handlePortfolioSelect.
  const autoConfirmedRef = useRef(false);
  useEffect(() => {
    if (
      !confirmedBusiness &&
      portfolioBusinesses.length === 1 &&
      !autoConfirmedRef.current
    ) {
      autoConfirmedRef.current = true;
      handlePortfolioSelect(portfolioBusinesses[0]);
    }
  }, [confirmedBusiness, portfolioBusinesses, handlePortfolioSelect]);

  // Zero-portfolio agencies recover by re-running the Meta OAuth consent so
  // the business list refreshes (legacy affordance, preserved).
  const handleReauthenticate = async () => {
    const userEmail =
      user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    if (!userEmail || !targetAgencyId) {
      setReauthError('Unable to resolve your account email.');
      return;
    }

    setReauthError(null);
    setIsReauthenticating(true);

    try {
      await startAgencyMetaOAuth({
        agencyId: targetAgencyId,
        userEmail,
        getToken,
      });
    } catch (err) {
      setReauthError(
        err instanceof Error ? err.message : 'Failed to refresh Meta Business Portfolios.'
      );
    } finally {
      setIsReauthenticating(false);
    }
  };

  // Track OAuth callback results in PostHog
  useEffect(() => {
    if (success) {
      trackOAuthCallbackSuccess({
        platform: platform || 'unknown',
        auth_source: 'agency_redirect',
        agency_id: agencyIdParam || orgId,
        connection_id: connectionId,
        requires_business_selection: requireBusinessSelection || platform === 'meta',
      });
    } else if (errorCode) {
      trackOAuthCallbackFailure({
        platform: platform,
        error_code: errorCode,
        error_message: errorMessage,
        auth_source: 'agency_redirect',
        agency_id: agencyIdParam || orgId,
      });
    }
  }, [success, errorCode, platform, agencyIdParam, orgId, connectionId, requireBusinessSelection, errorMessage]);

  // For non-Meta platforms, invalidate caches immediately so the Connections UI updates right away.
  useEffect(() => {
    if (!success) return;
    if (platform === 'meta' || requireBusinessSelection) return;

    const targetAgencyId = agencyIdParam || orgId;
    if (!targetAgencyId) return;

    queryClient.invalidateQueries({ queryKey: ['platform-connections', targetAgencyId] });
    queryClient.invalidateQueries({ queryKey: ['available-platforms', targetAgencyId] });
  }, [success, platform, requireBusinessSelection, agencyIdParam, orgId, queryClient]);

  // Auto-redirect on success (except for Meta which needs portfolio selection)
  useEffect(() => {
    if (!success) return;

    // For Meta, we ALWAYS show the portfolio selector as a required step
    if (platform === 'meta' || requireBusinessSelection) {
      setShowPortfolioSelector(true);
      return;
    }

    // Next.js typed routes: router.push expects a RouteImpl, so keep the string but
    // type it to the router's push() parameter type.
    const destination = (platform
      ? `/connections?success=true&platform=${encodeURIComponent(platform)}`
      : '/connections') as Parameters<typeof router.push>[0];

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.push(destination);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [success, platform, router, orgId, requireBusinessSelection]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--coral))] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Processing your connection...</p>
        </div>
      </div>
    );
  }

  if (success) {
    // Show Business Portfolio selector for Meta
    if (showPortfolioSelector && (orgId || agencyIdParam)) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-paper p-4">
          <div className="max-w-lg w-full">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-[rgb(var(--teal))]/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-success-ink"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-ink mb-2">Successfully Connected!</h1>
              <p className="text-muted-foreground">Now select your Meta Business Portfolio</p>
            </div>
            {portfolioQuery.isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground font-medium">Checking for Meta Business accounts...</p>
              </div>
            ) : portfolioQuery.error ? (
              <div className="p-8 text-center bg-[rgb(var(--coral))]/10 rounded-none border-2 border-[rgb(var(--coral))]/40">
                <AlertCircle className="h-8 w-8 text-danger-ink mx-auto mb-3" />
                <p className="text-danger-ink font-semibold mb-1">Failed to load portfolios</p>
                <p className="text-danger-ink text-sm mb-4">Please try refreshing the page or connecting again.</p>
                <Button onClick={() => void portfolioQuery.refetch()} variant="ghost" size="sm" className="text-danger-ink">
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : portfolioBusinesses.length === 0 ? (
              <div className="p-10 text-center bg-[rgb(var(--warm-gray))]/20 rounded-none border-2 border-black dark:border-white border-dashed">
                <div className="w-16 h-16 bg-[rgb(var(--warm-gray))]/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-ink font-bold mb-2">No Meta Business portfolios found</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
                  Your agency needs a Business Portfolio to receive client access. Create one in Meta (it opens in a
                  new tab), then come back and check again.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                  <Button variant="primary" size="sm" asChild>
                    <a href={META_CREATE_BUSINESS_PORTFOLIO_URL} target="_blank" rel="noopener noreferrer">
                      Create a Business Portfolio
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void portfolioQuery.refetch()}
                    disabled={portfolioQuery.isFetching}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    {portfolioQuery.isFetching ? 'Checking…' : 'Check again'}
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
                  Don&apos;t see your Business Portfolio? To refresh this list{' '}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-1 text-ink underline-offset-2"
                    onClick={() => void handleReauthenticate()}
                    disabled={isReauthenticating}
                  >
                    {isReauthenticating ? 'logging in again…' : 'log in again'}
                  </Button>
                </p>
                {reauthError && <p className="text-sm text-danger-ink">{reauthError}</p>}
              </div>
            ) : isSaving ? (
              <div className="p-10 text-center" role="status">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground font-medium">Connecting your Business Portfolio...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {saveError ? (
                  <div role="alert" className="border-2 border-[rgb(var(--coral))]/40 bg-[rgb(var(--coral))]/10 text-danger-ink rounded-none p-4 text-sm">
                    {saveError}
                  </div>
                ) : null}
                <PortfolioSelector
                  businesses={portfolioBusinesses}
                  selectedBusiness={selectedBusiness}
                  selectionRequired={portfolioBusinesses.length > 1}
                  fetchBusinesses={() => Promise.resolve(portfolioBusinesses)}
                  onBusinessConfirmed={handlePortfolioSelect}
                />
              </div>
            )}
            {returnToOnboarding && !isSaving && (
              <p className="mt-6 text-center text-sm">
                <Link
                  href={onboardingReturnUrl('cancelled') as Route}
                  className="text-muted-foreground underline underline-offset-2 hover:text-ink"
                >
                  Back to onboarding without Meta
                </Link>
              </p>
            )}
          </div>
        </div>
      );
    }

    // Standard success message for other platforms
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <div className="max-w-md w-full bg-card rounded-none border-2 border-black dark:border-white shadow-brutalist p-8">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div
              data-testid="success-icon"
              className="w-16 h-16 bg-[rgb(var(--teal))]/15 rounded-full flex items-center justify-center"
            >
              <svg
                className="w-8 h-8 text-success-ink"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-2xl font-bold text-center mb-2 text-ink">Successfully Connected!</h1>
          <p className="text-center text-muted-foreground mb-8">
            You've successfully connected {platformName} to your agency account.
          </p>

          {/* Auto-redirect notice */}
          <p className="text-sm text-center text-muted-foreground mb-6">
            Redirecting to connections in {countdown} seconds...
          </p>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button className="w-full" asChild>
              <Link
                href={
                  platform
                    ? `/connections?success=true&platform=${encodeURIComponent(platform)}`
                    : '/connections'
                }
              >
                View Connections
              </Link>
            </Button>
            <Button variant="secondary" className="w-full" asChild>
              <Link href="/dashboard">Continue to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="flex items-center justify-center min-h-screen bg-paper">
      <div className="max-w-md w-full bg-card rounded-none border-2 border-black dark:border-white shadow-brutalist p-8">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div
            data-testid="error-icon"
            className="w-16 h-16 bg-[rgb(var(--coral))]/15 rounded-full flex items-center justify-center"
          >
            <svg
              className="w-8 h-8 text-danger-ink"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-2xl font-bold text-center mb-2 text-danger-ink">Connection Failed</h1>
        <p className="text-center text-muted-foreground mb-2">{errorMessage}</p>

        {/* Error code */}
        {errorCode && (
          <p className="text-center text-sm text-muted-foreground mb-8">Error code: {errorCode}</p>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          {returnToOnboarding ? (
            <Button className="w-full" asChild>
              <Link href={onboardingReturnUrl('error') as Route}>Back to onboarding</Link>
            </Button>
          ) : (
            <Button className="w-full" asChild>
              <Link href="/onboarding/platforms">Try Again</Link>
            </Button>
          )}
          <Button variant="secondary" className="w-full" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--coral))] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CallbackPageContent />
    </Suspense>
  );
}
