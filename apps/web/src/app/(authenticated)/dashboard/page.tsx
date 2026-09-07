'use client';

/**
 * Agency Dashboard
 *
 * Main dashboard for agencies to view access requests and client connections.
 * Optimized to use a single unified API endpoint for better performance.
 * Includes ETag support for conditional requests to save bandwidth.
 */

import { Plus, Users, Key, Activity, AlertCircle, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useAuthOrBypass, DEV_USER_ID } from '@/lib/dev-auth';
import { useQuery } from '@tanstack/react-query';
import { TrialBanner } from '@/components/trial-banner';
import { StatCard, StatusBadge, EmptyState, PlatformIcon } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { useEffect, useRef, useState } from 'react';
import { readPerfHarnessContext, startPerfTimer } from '@/lib/perf-harness';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { extractApiErrorMessage } from '@/lib/api/extract-error';
import { useUpdateAgencyOnboardingProgress } from '@/lib/query/onboarding';
import { trackOnboardingEvent } from '@/lib/analytics/onboarding';
import { usePrefetchQuota, useQuotaCheck, QuotaExceededError } from '@/lib/query/quota';
import { UpgradeModal } from '@/components/upgrade-modal';
import { PendingNudgeBanners } from '@/components/pending-nudge-banners';
import {
  PLATFORM_NAMES,
  SUBSCRIPTION_TIER_NAMES,
  type DashboardPayload,
  type DashboardRequestSummary,
  type DashboardConnectionSummary,
  type Platform,
} from '@agency-platform/shared';

const DASHBOARD_PERF_SAMPLE_RATE = 0.2;
const dashboardSessionSeen = new Set<string>();

interface DashboardApiError {
  code: string;
  message: string;
  details?: unknown;
}

interface DashboardApiResponse {
  data: DashboardPayload | null;
  error: DashboardApiError | null;
}

const EMPTY_DASHBOARD_STATS = {
  totalRequests: 0,
  pendingRequests: 0,
  activeConnections: 0,
  totalPlatforms: 0,
};

interface DashboardPerfMetrics {
  tokenFetchMs: number;
  dashboardApiMs: number;
  timeToDataMs: number;
  cacheStatus: string;
  isColdSession: boolean;
  principalId: string;
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function shouldSampleDashboardPerf(): boolean {
  return Math.random() < DASHBOARD_PERF_SAMPLE_RATE;
}

async function captureDashboardLoadPerf(metrics: DashboardPerfMetrics): Promise<void> {
  if (!shouldSampleDashboardPerf()) {
    return;
  }

  try {
    const { default: posthog } = await import('posthog-js');
    posthog.capture('dashboard_load_perf', {
      token_fetch_ms: Number(metrics.tokenFetchMs.toFixed(2)),
      dashboard_api_ms: Number(metrics.dashboardApiMs.toFixed(2)),
      time_to_data_ms: Number(metrics.timeToDataMs.toFixed(2)),
      cache_status: metrics.cacheStatus,
      is_cold_session: metrics.isColdSession,
      principal_id: metrics.principalId,
    });
  } catch {
    // Ignore analytics failures.
  }
}

function platformLabel(platform: string): string {
  return (PLATFORM_NAMES as Record<string, string>)[platform] ?? platform;
}

function requestClientHref(request: DashboardRequestSummary): string {
  return `/access-requests/${request.id}`;
}

export default function DashboardPage() {
  const clerkAuth = useAuth();
  const { getToken } = clerkAuth;
  const { userId, orgId, isLoaded, isDevelopmentBypass } = useAuthOrBypass(clerkAuth);
  const perfHarness = readPerfHarnessContext();
  const principalId = perfHarness?.principalId || orgId || userId;
  const canFetchDashboard = Boolean(perfHarness?.token) || (isLoaded && Boolean(principalId));
  const hasTrackedView = useRef(false);
  const hasTrackedChecklistView = useRef(false);
  const router = useRouter();

  // Quota check for access requests
  const checkQuota = useQuotaCheck();
  const prefetchQuota = usePrefetchQuota();
  const [quotaError, setQuotaError] = useState<QuotaExceededError | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);

  // Single unified query that fetches all dashboard data at once.
  const { data: dashboardData, isLoading, error, refetch } = useQuery<DashboardApiResponse>({
    queryKey: ['dashboard', principalId || 'anonymous'],
    queryFn: async () => {
      const principalKey = principalId || 'anonymous';
      const requestStart = nowMs();

      const stopTokenTimer = startPerfTimer('dashboard:token-fetch');
      const tokenFetchStart = nowMs();
      const token = perfHarness?.token || await getToken();
      const tokenFetchMs = nowMs() - tokenFetchStart;
      stopTokenTimer?.();

      if (!token) {
        throw new Error('AUTH_TOKEN_UNAVAILABLE');
      }

      const stopTimer = startPerfTimer('dashboard:data-fetch');

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };

        const apiFetchStart = nowMs();
        const response = await fetch(`${getApiBaseUrl()}/api/dashboard`, {
          headers,
        });
        const dashboardApiMs = nowMs() - apiFetchStart;
        const cacheStatus = response.headers.get('X-Cache') || 'UNKNOWN';

        if (!response.ok) {
          throw new Error(await extractApiErrorMessage(response, 'Failed to fetch dashboard data'));
        }

        const data = await response.json() as DashboardApiResponse;

        const isColdSession = !dashboardSessionSeen.has(principalKey);
        dashboardSessionSeen.add(principalKey);
        void captureDashboardLoadPerf({
          tokenFetchMs,
          dashboardApiMs,
          timeToDataMs: nowMs() - requestStart,
          cacheStatus,
          isColdSession,
          principalId: principalKey,
        });

        return data;
      } finally {
        stopTimer?.();
      }
    },
    enabled: canFetchDashboard,
    retry: (failureCount, queryError) => {
      const message = queryError instanceof Error ? queryError.message : '';
      if (message === 'AUTH_TOKEN_UNAVAILABLE' || message.includes('No auth token')) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  const payload = dashboardData?.data;
  const agency = payload?.agency;
  const onboardingProgressMutation = useUpdateAgencyOnboardingProgress(agency?.id);
  const onboardingStatus = payload?.onboardingStatus ?? null;
  const trialBanner = payload?.trialBanner ?? null;
  const showOnboardingChecklist = Boolean(
    onboardingStatus &&
    !onboardingStatus.completed &&
    (onboardingStatus.status === 'in_progress' || onboardingStatus.status === 'activated')
  );
  const isActivatedChecklist = onboardingStatus?.status === 'activated';
  const stats = payload?.stats ?? EMPTY_DASHBOARD_STATS;
  const requests: DashboardRequestSummary[] = payload?.requests || [];
  const connections: DashboardConnectionSummary[] = payload?.connections || [];
  const requestsMeta = payload?.meta?.requests;
  const connectionsMeta = payload?.meta?.connections;

  const handleDismissOptionalSetup = async () => {
    if (!agency?.id) return;

    await onboardingProgressMutation.mutateAsync({
      status: 'completed',
      dismissedAt: new Date().toISOString(),
      lastVisitedStep: 6,
      lastCompletedStep: 6,
    });

    trackOnboardingEvent('onboarding_optional_dismissed', {
      agencyId: agency.id,
      status: onboardingStatus?.status,
    });
  };

  useEffect(() => {
    if (!agency?.id) {
      return;
    }
    void prefetchQuota();
  }, [agency?.id, prefetchQuota]);

  const handleCreateRequest = async () => {
    setIsCreatingRequest(true);
    try {
      const result = await checkQuota.mutateAsync({ metric: 'access_requests' });
      if (!result.allowed) {
        // Quota exceeded - show upgrade modal
        setQuotaError(
          new QuotaExceededError({
            code: 'QUOTA_EXCEEDED',
            message: `You've reached your Access Requests limit`,
            metric: 'access_requests',
            limit: result.limit,
            used: result.used,
            remaining: result.remaining,
            currentTier: result.currentTier,
            suggestedTier: result.suggestedTier,
            upgradeUrl: result.upgradeUrl || '',
          })
        );
        setShowUpgradeModal(true);
        return;
      }
      // Quota OK - navigate to new request page
      router.push('/access-requests/new');
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        setQuotaError(error);
        setShowUpgradeModal(true);
      } else {
        console.error('Failed to check quota:', error);
        // Allow navigation even if quota check fails
        router.push('/access-requests/new');
      }
    } finally {
      setIsCreatingRequest(false);
    }
  };

  // Shared Create Request button (header + Recent Access Requests panel).
  // v2.0 rule: one brutalist per view. Header mount keeps it; the panel
  // header mount renders primary.
  const createRequestButton = (variant: 'brutalist' | 'primary' = 'brutalist') => (
    <Button
      type="button"
      variant={variant}
      size="sm"
      data-testid="dashboard-create-request"
      onClick={handleCreateRequest}
      disabled={isCreatingRequest}
      aria-busy={isCreatingRequest}
      aria-label={isCreatingRequest ? 'Checking quota before opening new request' : 'Create access request'}
      className="px-6 sm:px-8 normal-case font-semibold tracking-normal hover:translate-x-0 hover:bg-coral/90 disabled:pointer-events-none disabled:opacity-80"
    >
      {isCreatingRequest ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Plus className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {isCreatingRequest ? 'Checking…' : 'Create Request'}
    </Button>
  );

  // Track dashboard view in PostHog (only once per mount)
  useEffect(() => {
    if (agency && !hasTrackedView.current) {
      const trackDashboardView = async () => {
        const { default: posthog } = await import('posthog-js');
        posthog.capture('dashboard_viewed', {
          agency_id: agency.id,
          agency_name: agency.name,
          total_requests: stats.totalRequests,
          pending_requests: stats.pendingRequests,
          active_connections: stats.activeConnections,
          total_platforms: stats.totalPlatforms,
        });
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          void trackDashboardView();
        });
      } else {
        setTimeout(() => {
          void trackDashboardView();
        }, 0);
      }

      hasTrackedView.current = true;
    }
  }, [agency, stats]);

  useEffect(() => {
    if (!agency || !showOnboardingChecklist || hasTrackedChecklistView.current || !onboardingStatus) {
      return;
    }

    trackOnboardingEvent('checklist_shown', {
      agencyId: agency.id,
      status: onboardingStatus.status,
    });
    hasTrackedChecklistView.current = true;
  }, [agency, onboardingStatus, showOnboardingChecklist]);

  if (!canFetchDashboard && !dashboardData) {
    return (
      <div className="flex-1 bg-paper p-8 flex items-center justify-center">
        <div className="text-center">
          <LogoSpinner size="lg" className="mx-auto" />
          <p className="mt-4 text-muted-foreground">Initializing session...</p>
        </div>
      </div>
    );
  }

  if (isLoading && !dashboardData) {
    return (
      <div className="flex-1 bg-paper p-8 flex items-center justify-center">
        <div className="text-center">
          <LogoSpinner size="lg" className="mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isAuthUnavailable = error instanceof Error && error.message === 'AUTH_TOKEN_UNAVAILABLE';

    return (
      <div className="flex-1 bg-paper p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-coral/10 border border-coral rounded-lg p-6 text-center">
            <AlertCircle className="h-8 w-8 text-danger-ink mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-danger-ink mb-2">
              {isAuthUnavailable ? 'Authenticating Session' : 'Failed to Load Dashboard'}
            </h2>
            <p className="text-danger-ink/90 mb-4">
              {isAuthUnavailable
                ? 'We are still initializing your session. Please wait a moment and retry.'
                : error instanceof Error
                  ? error.message
                  : 'An error occurred while loading the dashboard.'}
            </p>
            <Button variant="brutalist" size="md" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!agency && !isLoading) {
    return (
      <div className="flex-1 bg-paper p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-coral/10 border border-coral rounded-lg p-6 text-center">
            <span className="hidden bg-coral" aria-hidden />
            <AlertCircle className="h-8 w-8 text-danger-ink mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-danger-ink mb-2">Agency Setup Required</h2>
            <p className="text-danger-ink mb-4">
              We couldn&apos;t find an agency associated with your account. Let&apos;s set one up.
            </p>
            <Button variant="brutalist" size="md" asChild>
              <Link href="/onboarding/unified">
                Complete Onboarding
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-paper p-8">
      <div className="max-w-7xl mx-auto">
        {isDevelopmentBypass && (
          <div className="mb-4 flex justify-end">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900"
              aria-label="Development mode active"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
              Dev Mode · {DEV_USER_ID.slice(0, 12)}...
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage client access requests</p>
          </div>
          {createRequestButton('brutalist')}
        </div>

        {trialBanner && (
          <div className="mb-6">
            <TrialBanner
              trialEnd={trialBanner.trialEnd}
              tierName={SUBSCRIPTION_TIER_NAMES[trialBanner.tier]}
            />
          </div>
        )}

        {showOnboardingChecklist && (
          <div className="mb-6 rounded-lg border border-coral/40 bg-coral/10 p-5">
            <h2 className="text-lg font-semibold text-ink">Finish your onboarding setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isActivatedChecklist
                ? 'You generated your first access link. Wrap up optional setup to complete onboarding.'
                : 'Continue onboarding to generate your first client access link.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="brutalist" size="md" asChild>
                <Link
                  href="/onboarding/unified"
                  onClick={() => {
                    trackOnboardingEvent('checklist_resume_clicked', {
                      agencyId: agency?.id,
                      status: onboardingStatus?.status,
                    });
                  }}
                >
                  Resume onboarding
                </Link>
              </Button>

              {isActivatedChecklist && (
                <button
                  type="button"
                  onClick={() => {
                    void handleDismissOptionalSetup();
                  }}
                  disabled={onboardingProgressMutation.isPending}
                  className="inline-flex min-h-[40px] items-center rounded-lg border-2 border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-all duration-200 hover:border-teal/30 hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Finish setup
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mb-6">
          <PendingNudgeBanners
            requests={requests.map((request) => ({
              id: request.id,
              clientName: request.clientName,
              status: request.status,
              createdAt: request.createdAt,
              uniqueToken: request.uniqueToken,
            }))}
            surface="dashboard"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Requests"
            value={stats.totalRequests}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="Pending"
            value={stats.pendingRequests}
            icon={<Activity className="h-5 w-5" />}
          />
          <StatCard
            label="Active Connections"
            value={stats.activeConnections}
            icon={<Key className="h-5 w-5" />}
          />
          <StatCard
            label="Platforms Connected"
            value={stats.totalPlatforms}
            icon={<Activity className="h-5 w-5" />}
          />
        </div>

        <div className="bg-card rounded-lg shadow-brutalist border border-black/10">
          <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Recent Access Requests</h2>
              {requestsMeta?.hasMore && (
                <p className="text-xs text-muted-foreground mt-1">
                  Showing latest {requestsMeta.returned} of {requestsMeta.total} requests
                </p>
              )}
            </div>
            {createRequestButton('primary')}
          </div>

          {requests.length === 0 ? (
            <EmptyState
              title="No access requests yet"
              description="Create your first access request to start onboarding clients."
            />
          ) : (
            <div className="divide-y divide-black/10">
              {requests.map((request, index) => (
                <Link
                  key={request.id}
                  href={requestClientHref(request) as any}
                  aria-label={`View details for ${request.clientName}`}
                  className={cn(
                    'group px-6 py-4 flex items-center justify-between hover:bg-coral/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/60 focus-visible:ring-inset',
                    index === requests.length - 1 && 'rounded-b-lg'
                  )}
                >
                  <div>
                    <h3 className="font-medium text-ink">{request.clientName}</h3>
                    <p className="text-sm text-muted-foreground">{request.clientEmail}</p>
                    {request.platforms.length > 0 && (
                      <div
                        className="mt-2 flex flex-wrap items-center gap-1.5"
                        aria-label="Platforms in this request"
                      >
                        {[...new Set(request.platforms)].map((platform) => (
                          <div
                            key={platform}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10 bg-muted/80 p-0.5"
                            title={platformLabel(platform)}
                          >
                            <PlatformIcon platform={platform as Platform} size="sm" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                    <StatusBadge status={request.status as any} />
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg shadow-brutalist border border-black/10 mt-6 overflow-hidden">
          <div className="ink-panel px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="label-micro">Active Connections</h2>
              {connectionsMeta?.hasMore && (
                <p className="label-nano mt-1">
                  Showing latest {connectionsMeta.returned} of {connectionsMeta.total} connections
                </p>
              )}
            </div>
            <Link href="/clients" className="label-micro hover:text-danger-ink font-semibold">
              Manage Clients
            </Link>
          </div>

          {connections.length === 0 ? (
            <EmptyState
              title="No client connections yet"
              description="Connections will appear here after clients authorize access."
            />
          ) : (
            <div className="divide-y divide-black/10">
              {connections.map((connection, index) => (
                <div
                  key={connection.id}
                  className={cn(
                    'px-6 py-4 flex items-center justify-between hover:bg-coral/10 transition-colors',
                    index === connections.length - 1 && 'rounded-b-lg'
                  )}
                >
                  <div>
                    <h3 className="font-medium text-ink">{connection.clientEmail}</h3>
                    <p className="text-xs text-muted">
                      Connected on {new Date(connection.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      {connection.platforms.map((platform) => (
                        <div
                          key={`${connection.id}-${platform}`}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-muted p-0.5 ring-2 ring-card"
                          title={platformLabel(platform)}
                        >
                          <PlatformIcon platform={platform as Platform} size="sm" />
                        </div>
                      ))}
                    </div>
                    <Link
                      href={
                        connection.clientId
                          ? `/clients/${connection.clientId}`
                          : `/clients?email=${encodeURIComponent(connection.clientEmail)}`
                      }
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 border-2 border-black/10 bg-transparent text-foreground rounded-lg hover:bg-black/5 hover:border-black/30 transition-all text-sm font-medium"
                    >
                      View Details
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upgrade Modal */}
        {showUpgradeModal && quotaError && (
          <UpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => {
              setShowUpgradeModal(false);
              setQuotaError(null);
            }}
            quotaError={quotaError}
          />
        )}
      </div>
    </div>
  );
}
