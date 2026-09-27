'use client';

/**
 * OAuth Callback Page
 *
 * Handles OAuth callback success/error states.
 * Shows user-friendly messages and redirects appropriately.
 * For Meta, shows the consolidated portfolio selector (receipt-first) instead
 * of auto-redirect: agency onboarding and connections both return here.
 */

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { PortfolioSelector, type PortfolioBusiness } from '@/components/client-auth/PortfolioSelector';
import { Button } from '@/components/ui/button';
import { startAgencyMetaOAuth } from '@/lib/agency-meta-oauth';
import { resolveApiUrl } from '@/lib/api/api-env';
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
      router.push('/connections?success=true&platform=meta');
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
      business_name: business.name,
    });
    completeMetaOauth({ businessId: business.id, businessName: business.name });
  };

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your connection...</p>
        </div>
      </div>
    );
  }

  if (success) {
    // Show Business Portfolio selector for Meta
    if (showPortfolioSelector && (orgId || agencyIdParam)) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <div className="max-w-lg w-full">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
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
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Successfully Connected!</h1>
              <p className="text-slate-600">Now select your Meta Business Portfolio</p>
            </div>
            {portfolioQuery.isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 font-medium">Checking for Meta Business accounts...</p>
              </div>
            ) : portfolioQuery.error ? (
              <div className="p-8 text-center bg-red-50 rounded-lg border border-red-100">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
                <p className="text-red-900 font-semibold mb-1">Failed to load portfolios</p>
                <p className="text-red-700 text-sm mb-4">Please try refreshing the page or connecting again.</p>
                <Button onClick={() => void portfolioQuery.refetch()} variant="ghost" size="sm" className="text-danger-ink">
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : portfolioBusinesses.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-slate-900 font-bold mb-2">No Meta Business portfolios found</h3>
                <p className="text-slate-600 text-sm max-w-xs mx-auto mb-6">
                  Don&apos;t see your Business Portfolio? To refresh this list{' '}
                  <button
                    onClick={() => void handleReauthenticate()}
                    className="text-indigo-600 font-semibold hover:underline px-1"
                    disabled={isReauthenticating}
                  >
                    {isReauthenticating ? 'logging in again…' : 'log in again'}
                  </button>
                </p>
                {reauthError && <p className="text-sm text-red-700">{reauthError}</p>}
              </div>
            ) : isSaving ? (
              <div className="p-10 text-center" role="status">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 font-medium">Connecting your Business Portfolio...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {saveError ? (
                  <div role="alert" className="border border-red-200 bg-red-50 text-red-800 rounded-lg p-4 text-sm">
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
          </div>
        </div>
      );
    }

    // Standard success message for other platforms
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div
              data-testid="success-icon"
              className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"
            >
              <svg
                className="w-8 h-8 text-green-600"
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
          <h1 className="text-2xl font-bold text-center mb-2">Successfully Connected!</h1>
          <p className="text-center text-gray-600 mb-8">
            You've successfully connected {platformName} to your agency account.
          </p>

          {/* Auto-redirect notice */}
          <p className="text-sm text-center text-gray-500 mb-6">
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
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div
            data-testid="error-icon"
            className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center"
          >
            <svg
              className="w-8 h-8 text-red-600"
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
        <h1 className="text-2xl font-bold text-center mb-2 text-red-900">Connection Failed</h1>
        <p className="text-center text-gray-600 mb-2">{errorMessage}</p>

        {/* Error code */}
        {errorCode && (
          <p className="text-center text-sm text-gray-500 mb-8">Error code: {errorCode}</p>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          <Button className="w-full" asChild>
            <Link href="/onboarding/platforms">Try Again</Link>
          </Button>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CallbackPageContent />
    </Suspense>
  );
}
