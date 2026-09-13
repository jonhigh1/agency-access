'use client';

/**
 * Connections Page
 *
 * Shows all supported platforms in a card-based grid layout.
 * Platforms are categorized into "Recommended" and "Other" sections.
 * Users can connect platforms directly from this page via OAuth.
 */

import { useState, useMemo, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { PlatformCard, Button, EmptyState } from '@/components/ui';
import { Platform, PlatformInfo } from '@agency-platform/shared';
import {
  trackOAuthCallbackFailure,
  trackOAuthCallbackSuccess,
} from '@/lib/analytics/oauth-events';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { AnimatePresence } from 'framer-motion';
import { DEV_BYPASS_TOKEN, useAuthOrBypass } from '@/lib/dev-auth';
import { useUserAgency } from '@/hooks/use-user-agency';
import { finalizeMetaBusinessLogin, launchMetaBusinessLogin } from '@/lib/meta-business-login';
import { readPerfHarnessContext } from '@/lib/perf-harness';
import { resolveApiUrl } from '@/lib/api/api-env';
import { isManualInvitePlatform } from '@/lib/client-invite-platforms';
import { useTransientMessage } from '@/hooks/use-transient-message';

function gatedModalFallback(label: string) {
  return (
    <div
      className="min-h-[220px] rounded-xl border border-border bg-muted/25"
      aria-busy
      aria-label={label}
    />
  );
}

const ManageAssetsModalShell = dynamic(
  () =>
    import('@/components/manage-assets-modal-shell').then((m) => ({
      default: m.ManageAssetsModalShell,
    })),
  { loading: () => gatedModalFallback('Loading connection settings') }
);

const MetaUnifiedSettings = dynamic(
  () =>
    import('@/components/meta-unified-settings').then((m) => ({
      default: m.MetaUnifiedSettings,
    })),
  { loading: () => gatedModalFallback('Loading Meta connection settings') }
);

const GoogleUnifiedSettings = dynamic(
  () =>
    import('@/components/google-unified-settings').then((m) => ({
      default: m.GoogleUnifiedSettings,
    })),
  { loading: () => gatedModalFallback('Loading Google connection settings') }
);

const ManualInvitationModal = dynamic(
  () =>
    import('@/components/manual-invitation-modal').then((m) => ({
      default: m.ManualInvitationModal,
    })),
  { loading: () => gatedModalFallback('Loading invitation setup') }
);

function ConnectionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clerkAuth = useAuth();
  const { userId, orgId, isDevelopmentBypass } = useAuthOrBypass(clerkAuth);
  const { getToken } = clerkAuth;
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [successMessage, showSuccessMessage, clearSuccessMessage] = useTransientMessage<string>();
  const [errorMessage, showErrorMessage, clearErrorMessage] = useTransientMessage<string>();
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<Platform | null>(null);
  const [managingMetaAssets, setManagingMetaAssets] = useState(false);
  const [managingGoogleAssets, setManagingGoogleAssets] = useState(false);

  // Manual invitation modal state
  const [manualInvitationPlatform, setManualInvitationPlatform] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string>('');
  const perfHarness = useMemo(() => readPerfHarnessContext(), []);

  const principalClerkId = (isDevelopmentBypass ? perfHarness?.principalId : null) || orgId || userId;

  const getAuthToken = async (): Promise<string | null> => {
    const token = await getToken();
    if (token) {
      return token;
    }

    if (isDevelopmentBypass) {
      return perfHarness?.token || DEV_BYPASS_TOKEN;
    }

    return null;
  };

  // Resolve the active principal's agency by clerk user/org id.
  const { data: agencyData } = useUserAgency({ principalClerkId, getAuthToken });

  const agencyId = agencyData?.id ?? null;

  const handleManageMetaAssets = () => {
    setManagingMetaAssets(!managingMetaAssets);
  };

  const handleManageGoogleAssets = () => {
    setManagingGoogleAssets(!managingGoogleAssets);
  };

  // Handle OAuth callback redirect
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const platform = searchParams.get('platform');

    if (success === 'true' && platform) {
      // Track platform connected in PostHog
      void capturePosthogEvent('platform_connected', {
        agency_id: agencyId,
        platform: platform,
        connection_source: 'oauth_callback',
      });

      showSuccessMessage(`Successfully connected ${platform}!`);
      if (agencyId) {
        queryClient.invalidateQueries({ queryKey: ['available-platforms', agencyId] });
      }

      // Clear URL params
      router.replace('/connections');

      clearErrorMessage();
    }

    if (error) {
      trackOAuthCallbackFailure({
        platform: platform,
        error_code: error,
        auth_source: 'agency_redirect',
        agency_id: agencyId,
      });

      showErrorMessage(`Failed to connect platform: ${error}`);
      router.replace('/connections');

      clearSuccessMessage();
    }
  }, [searchParams, queryClient, agencyId, router, showSuccessMessage, showErrorMessage, clearSuccessMessage, clearErrorMessage]);

  // Fetch all platforms with connection status (with ETag caching)
  const {
    data: platforms = [],
    isLoading,
    error,
  } = useQuery<PlatformInfo[]>({
    queryKey: ['available-platforms', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      // Get Clerk session token for authenticated request
      const token = await getAuthToken();

      // Get stored ETag from previous request
      const etagKey = `etag-available-platforms-${agencyId}`;
      const storedEtag = localStorage.getItem(etagKey);

      const headers: Record<string, string> = {
        ...(token && { Authorization: `Bearer ${token}` }),
      };
      if (storedEtag) {
        headers['If-None-Match'] = storedEtag;
      }

      const response = await fetch(
        resolveApiUrl(`/agency-platforms/available?agencyId=${agencyId}`),
        { headers, cache: 'no-store' }
      );

      // Store new ETag for future requests
      const newEtag = response.headers.get('ETag')?.replace(/"/g, '');
      if (newEtag) {
        localStorage.setItem(etagKey, newEtag);
      }

      // 304 Not Modified - return cached data
      if (response.status === 304) {
        const cached = localStorage.getItem(`cached-platforms-${agencyId}`);
        if (cached) {
          return JSON.parse(cached);
        }
        return [];
      }

      if (!response.ok) throw new Error('Failed to fetch platforms');
      const result = await response.json();

      // Cache the response for 304 handling
      localStorage.setItem(`cached-platforms-${agencyId}`, JSON.stringify(result.data || []));

      return result.data || [];
    },
    enabled: !!agencyId,
    staleTime: 2 * 60 * 1000, // 2 minutes - matches server Cache-Control
  });


  // Categorize platforms
  const { recommended, other } = useMemo(() => {
    const recommended = platforms.filter((p) => p.category === 'recommended');
    const other = platforms.filter((p) => p.category === 'other');
    return { recommended, other };
  }, [platforms]);


  // OAuth initiation mutation
  const { mutate: initiateOAuth } = useMutation({
    mutationFn: async (platform: Platform) => {
      if (!agencyId) {
        throw new Error('Agency not found. Please complete onboarding first.');
      }

      setConnectingPlatform(platform);

      const userEmail = user?.primaryEmailAddress?.emailAddress || 'user@agency.com';
      const token = await getAuthToken();

      const response = await fetch(
        resolveApiUrl(`/agency-platforms/${platform}/initiate`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            agencyId,
            userEmail,
            redirectUrl: `${window.location.origin}/platforms/callback`,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = result?.error?.message ?? 'Failed to initiate OAuth';
        throw new Error(message);
      }
      return result;
    },
    onSuccess: (data) => {
      // Redirect to OAuth provider
      window.location.href = data.data.authUrl;
    },
    onError: (error) => {
      showErrorMessage((error as Error).message);
      setConnectingPlatform(null);
    },
  });

  // Disconnect mutation
  const { mutate: disconnectPlatform } = useMutation({
    mutationFn: async (platform: Platform) => {
      if (!agencyId) {
        throw new Error('Agency not found. Please complete onboarding first.');
      }

      setDisconnectingPlatform(platform);

      const userEmail = user?.primaryEmailAddress?.emailAddress || 'user@agency.com';
      const token = await getAuthToken();

      const response = await fetch(
        resolveApiUrl(`/agency-platforms/${platform}`),
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            agencyId,
            revokedBy: userEmail,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to disconnect platform');
      return response.json();
    },
    onSuccess: (_, platform) => {
      // Track platform disconnected in PostHog
      void capturePosthogEvent('platform_disconnected', {
        agency_id: agencyId,
        platform: platform,
      });

      showSuccessMessage(`Successfully disconnected ${platform}!`);
      setDisconnectingPlatform(null);
      // Clear localStorage cache and bypass any cached fetch
      if (typeof window !== 'undefined' && agencyId) {
        window.localStorage.removeItem(`etag-available-platforms-${agencyId}`);
        window.localStorage.removeItem(`cached-platforms-${agencyId}`);
      }
      // Force immediate refetch so UI updates (invalidate + refetch; fetch uses cache: 'no-store')
      void queryClient.refetchQueries({ queryKey: ['available-platforms', agencyId] });
      clearErrorMessage();
    },
    onError: (error) => {
      showErrorMessage(`Failed to disconnect platform: ${(error as Error).message}`);
      setDisconnectingPlatform(null);
      clearSuccessMessage();
    },
  });

  const handleConnect = (platform: Platform) => {
    clearErrorMessage();

    // Check if this is a manual invitation platform
    if (isManualInvitePlatform(platform)) {
      // Open manual invitation modal in create mode
      setManualInvitationPlatform(platform);
      setIsManualModalOpen(true);
    } else if (platform === 'meta') {
      void handleMetaConnect();
    } else {
      // Use OAuth flow
      initiateOAuth(platform);
    }
  };

  const handleEditEmail = (platform: Platform, currentEmail: string) => {
    clearErrorMessage();
    setCurrentEmail(currentEmail);
    setIsEditingEmail(true);
    // Open manual invitation modal in edit mode
    setManualInvitationPlatform(platform);
    setIsManualModalOpen(true);
  };

  const handleManualModalClose = () => {
    setIsManualModalOpen(false);
    setManualInvitationPlatform(null);
    setIsEditingEmail(false);
    setCurrentEmail('');
  };

  const handleManualSuccess = () => {
    // Refetch platforms to update the UI
    if (agencyId) {
      queryClient.invalidateQueries({ queryKey: ['available-platforms', agencyId] });
    }
  };

  const handleMetaConnect = async () => {
    if (!agencyId) {
      showErrorMessage('Agency not found. Please complete onboarding first.');
      return;
    }

    const userEmail = user?.primaryEmailAddress?.emailAddress || 'user@agency.com';
    setConnectingPlatform('meta');

    try {
      const authPayload = await launchMetaBusinessLogin({
        appId: process.env.NEXT_PUBLIC_META_APP_ID || '',
        configId: process.env.NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID || '',
      });

      await finalizeMetaBusinessLogin({
        agencyId,
        userEmail,
        getToken: getAuthToken,
        authPayload,
      });

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(`etag-available-platforms-${agencyId}`);
        window.localStorage.removeItem(`cached-platforms-${agencyId}`);
      }

      await queryClient.invalidateQueries({ queryKey: ['available-platforms', agencyId] });
      trackOAuthCallbackSuccess({
        platform: 'meta',
        auth_source: 'agency_meta_popup',
        agency_id: agencyId,
      });
      void capturePosthogEvent('platform_connected', {
        agency_id: agencyId,
        platform: 'meta',
        connection_source: 'meta_popup',
      });
      showSuccessMessage('Successfully connected Meta!');
    } catch (error) {
      trackOAuthCallbackFailure({
        platform: 'meta',
        error_code: 'META_POPUP_FAILED',
        error_message: error instanceof Error ? error.message : 'Failed to connect Meta',
        auth_source: 'agency_meta_popup',
        agency_id: agencyId,
      });
      showErrorMessage((error as Error).message);
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = (platform: Platform) => {
    clearErrorMessage();
    clearSuccessMessage();
    disconnectPlatform(platform);
  };

  return (
    <div className="flex-1 bg-paper p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink font-display">
            Connect your accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            To create a link, you'll need to connect your accounts
          </p>
        </div>

        {/* Loading Agency */}
        {!agencyId && !agencyData && (
          <div className="flex items-center justify-center py-12">
            <LogoSpinner size="md" />
            <span className="ml-2 text-muted-foreground">Loading agency...</span>
          </div>
        )}

        {/* Agency Not Found - Redirect to Onboarding */}
        {!agencyId && agencyData === null && user?.primaryEmailAddress?.emailAddress && (
          <div className="bg-accent border-2 border-black shadow-brutalist-sm rounded-lg p-6 text-center">
            <AlertCircle className="h-8 w-8 text-primary mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-ink mb-2">Agency not found</h2>
            <p className="text-muted-foreground mb-4">
              We couldn't find an agency associated with your account. Let's set one up.
            </p>
            <Button
              variant="primary"
              onClick={() => router.push('/onboarding/unified')}
            >
              Complete Onboarding
            </Button>
          </div>
        )}

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 bg-teal/10 border border-teal/30 rounded-lg p-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-ink flex-shrink-0" />
            <p className="text-ink">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-coral/10 border border-coral/30 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-danger-ink flex-shrink-0" />
            <p className="text-foreground">{errorMessage}</p>
          </div>
        )}

        {/* Query Error */}
        {error && (
          <div className="mb-6 bg-coral/10 border border-coral/30 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-danger-ink flex-shrink-0" />
            <div>
              <p className="text-foreground font-medium">Failed to load platforms</p>
              <p className="text-muted-foreground text-sm mt-1">{(error as Error).message}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && agencyId && (
          <div className="flex items-center justify-center py-12">
            <LogoSpinner size="md" />
            <span className="ml-2 text-muted-foreground">Loading platforms...</span>
          </div>
        )}

        {/* Empty State - No Platforms */}
        {!isLoading && agencyId && platforms.length === 0 && (
          <div className="clean-card rounded-lg p-6">
            <EmptyState
              icon={AlertCircle}
              title="No platforms available"
              description="No platforms are currently configured. Please contact support."
            />
          </div>
        )}

        {/* Recommended Platforms */}
        {!isLoading && recommended.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-ink font-display mb-1">Recommended</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Based on your agency's requirements
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommended.map((platformInfo) => (
                <div key={platformInfo.platform} className="lg:col-span-1">
                  <PlatformCard
                    platform={platformInfo.platform as Platform}
                    connected={platformInfo.connected}
                    connectedEmail={platformInfo.connectedEmail}
                    status={platformInfo.status}
                    isConnecting={connectingPlatform === platformInfo.platform}
                    isDisconnecting={disconnectingPlatform === platformInfo.platform}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    onManageAssets={platformInfo.platform === 'meta' ? handleManageMetaAssets : platformInfo.platform === 'google' ? handleManageGoogleAssets : undefined}
                    onEditEmail={handleEditEmail}
                    variant="featured"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Platforms */}
        {!isLoading && other.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-ink font-display mb-4">Other</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {other.map((platformInfo) => (
                <PlatformCard
                  key={platformInfo.platform}
                  platform={platformInfo.platform as Platform}
                  variant="other"
                  connected={platformInfo.connected}
                  connectedEmail={platformInfo.connectedEmail}
                  status={platformInfo.status}
                  isConnecting={connectingPlatform === platformInfo.platform}
                  isDisconnecting={disconnectingPlatform === platformInfo.platform}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onManageAssets={platformInfo.platform === 'meta' ? handleManageMetaAssets : platformInfo.platform === 'google' ? handleManageGoogleAssets : undefined}
                  onEditEmail={handleEditEmail}
                />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Meta Unified Settings Modal */}
      <AnimatePresence>
        {managingMetaAssets && agencyId && platforms.some(p => p.platform === 'meta' && p.connected) && (
          <ManageAssetsModalShell
            isOpen={managingMetaAssets}
            title="Meta connection settings"
            description="Control the Business Portfolio and Meta asset types your agency uses when managing delegated access."
            onClose={() => setManagingMetaAssets(false)}
          >
            <MetaUnifiedSettings agencyId={agencyId} />
          </ManageAssetsModalShell>
        )}
      </AnimatePresence>

      {/* Google Unified Settings Modal */}
      <AnimatePresence>
        {managingGoogleAssets && agencyId && platforms.some(p => p.platform === 'google' && p.connected) && (
          <ManageAssetsModalShell
            isOpen={managingGoogleAssets}
            title="Google connection settings"
            description="Choose which Google products and accounts are active for delegated access requests."
            onClose={() => setManagingGoogleAssets(false)}
          >
            <GoogleUnifiedSettings agencyId={agencyId} />
          </ManageAssetsModalShell>
        )}
      </AnimatePresence>

      {/* Manual Invitation Modal */}
      {manualInvitationPlatform && agencyId && (
        <ManualInvitationModal
          isOpen={isManualModalOpen}
          onClose={handleManualModalClose}
          platform={manualInvitationPlatform}
          agencyId={agencyId}
          onSuccess={handleManualSuccess}
          mode={isEditingEmail ? 'edit' : 'create'}
          currentValue={currentEmail}
        />
      )}
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <LogoSpinner size="lg" />
      </div>
    }>
      <ConnectionsPageContent />
    </Suspense>
  );
}
