'use client';

/**
 * Onboarding Platforms Page
 *
 * First-time platform connection flow.
 * Allows agencies to connect their OAuth platforms for delegated access.
 *
 * Now with unified Google connector - one OAuth gives access to all Google products.
 * Also supports manual invitation platforms (Kit, Mailchimp, Beehiiv, Klaviyo, Shopify).
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ManualInvitationModal } from '@/components/manual-invitation-modal';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { getGoogleAdsAccountLabel } from '@/lib/google-ads-account-label';
import { finalizeMetaBusinessLogin, launchMetaBusinessLogin } from '@/lib/meta-business-login';
import { isManualInvitePlatform } from '@/lib/client-invite-platforms';
import {
  trackOAuthCallbackFailure,
  trackOAuthCallbackSuccess,
} from '@/lib/analytics/oauth-events';

// Google account types
interface GoogleAdsAccount {
  id: string;
  name: string;
  formattedId?: string;
  isManager?: boolean;
  nameSource?: 'hierarchy' | 'direct' | 'fallback';
  type: 'google_ads';
  status: string;
}

interface GoogleAnalyticsProperty {
  id: string;
  name: string;
  displayName: string;
  type: 'ga4';
  accountName: string;
}

interface GoogleBusinessAccount {
  id: string;
  name: string;
  type: 'google_business';
  locationCount?: number;
}

interface GoogleTagManagerContainer {
  id: string;
  name: string;
  type: 'google_tag_manager';
  accountId: string;
  accountName: string;
}

interface GoogleSearchConsoleSite {
  id: string;
  url: string;
  type: 'google_search_console';
  permissionLevel: string;
}

interface GoogleMerchantCenterAccount {
  id: string;
  name: string;
  type: 'google_merchant_center';
  websiteUrl?: string;
}

interface GoogleAccountsResponse {
  adsAccounts: GoogleAdsAccount[];
  analyticsProperties: GoogleAnalyticsProperty[];
  businessAccounts: GoogleBusinessAccount[];
  tagManagerContainers: GoogleTagManagerContainer[];
  searchConsoleSites: GoogleSearchConsoleSite[];
  merchantCenterAccounts: GoogleMerchantCenterAccount[];
  hasAccess: boolean;
}

// Google account sections rendered when the agency has Google access.
const GOOGLE_ACCOUNT_SECTIONS: Array<{
  key: string;
  title: string;
  items: (google: GoogleAccountsResponse) => Array<{ id: string; body: ReactNode }>;
}> = [
  {
    key: 'adsAccounts',
    title: 'Google Ads Accounts',
    items: (google) =>
      google.adsAccounts.map((account) => ({
        id: account.id,
        body: (
          <>
            <p className="font-medium">{getGoogleAdsAccountLabel(account)}</p>
            <p className="text-sm text-gray-600">ID: {account.id}</p>
            <span className="inline-block bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs mt-1">
              {account.status}
            </span>
          </>
        ),
      })),
  },
  {
    key: 'analyticsProperties',
    title: 'Google Analytics Properties',
    items: (google) =>
      google.analyticsProperties.map((property) => ({
        id: property.id,
        body: (
          <>
            <p className="font-medium">{property.displayName}</p>
            <p className="text-sm text-gray-600">Account: {property.accountName}</p>
            <p className="text-sm text-gray-600">ID: {property.id}</p>
          </>
        ),
      })),
  },
  {
    key: 'businessAccounts',
    title: 'Google Business Profiles',
    items: (google) =>
      google.businessAccounts.map((account) => ({
        id: account.id,
        body: (
          <>
            <p className="font-medium">{account.name}</p>
            <p className="text-sm text-gray-600">ID: {account.id}</p>
            {account.locationCount && (
              <p className="text-sm text-gray-600">{account.locationCount} locations</p>
            )}
          </>
        ),
      })),
  },
  {
    key: 'tagManagerContainers',
    title: 'Google Tag Manager Containers',
    items: (google) =>
      google.tagManagerContainers.map((container) => ({
        id: container.id,
        body: (
          <>
            <p className="font-medium">{container.name}</p>
            <p className="text-sm text-gray-600">Account: {container.accountName}</p>
            <p className="text-sm text-gray-600">Container ID: {container.id}</p>
          </>
        ),
      })),
  },
  {
    key: 'searchConsoleSites',
    title: 'Search Console Sites',
    items: (google) =>
      google.searchConsoleSites.map((site) => ({
        id: site.id,
        body: (
          <>
            <p className="font-medium text-sm break-all">{site.url}</p>
            <span className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs mt-1">
              {site.permissionLevel}
            </span>
          </>
        ),
      })),
  },
  {
    key: 'merchantCenterAccounts',
    title: 'Merchant Center Accounts',
    items: (google) =>
      google.merchantCenterAccounts.map((account) => ({
        id: account.id,
        body: (
          <>
            <p className="font-medium">{account.name}</p>
            <p className="text-sm text-gray-600">ID: {account.id}</p>
            {account.websiteUrl && <p className="text-sm text-gray-600">{account.websiteUrl}</p>}
          </>
        ),
      })),
  },
];

// Meta business account types
interface MetaBusinessAccount {
  id: string;
  name: string;
  verticalName?: string;
  verificationStatus?: string;
}

interface MetaBusinessAccountsResponse {
  businesses: MetaBusinessAccount[];
  hasAccess: boolean;
}

// Platform definitions
const SUPPORTED_PLATFORMS = [
  { id: 'google', name: 'Google', description: 'Google Ads, Analytics, Business, Tag Manager, Search Console, Merchant Center', type: 'oauth' },
  { id: 'meta', name: 'Meta', description: 'Facebook & Instagram Ads', type: 'oauth' },
  { id: 'linkedin', name: 'LinkedIn Ads', description: 'LinkedIn Ads', type: 'oauth' },
  { id: 'snapchat', name: 'Snapchat', description: 'Snapchat Ads - manual business sharing', type: 'manual' },
  { id: 'pinterest', name: 'Pinterest', description: 'Pinterest Ads - manual partnership', type: 'manual' },
  { id: 'kit', name: 'Kit', description: 'Email marketing - team invitation', type: 'manual' },
  { id: 'mailchimp', name: 'Mailchimp', description: 'Email marketing - team invitation', type: 'manual' },
  { id: 'beehiiv', name: 'Beehiiv', description: 'Newsletter platform - team invitation', type: 'manual' },
  { id: 'klaviyo', name: 'Klaviyo', description: 'Email marketing & automation - team invitation', type: 'manual' },
  { id: 'shopify', name: 'Shopify', description: 'Store access - collaborator request details', type: 'manual' },
];

interface Platform {
  platform: string;
  name: string;
  connected: boolean;
  status?: string;
  connectedAt?: string;
  expiresAt?: string;
}

export default function PlatformsPage() {
  const router = useRouter();
  const { orgId, getToken } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showGoogleAccounts, setShowGoogleAccounts] = useState(false);
  const [showMetaBusinesses, setShowMetaBusinesses] = useState(false);
  const [isMetaConnecting, setIsMetaConnecting] = useState(false);

  // Manual invitation modal state
  const [manualInvitationPlatform, setManualInvitationPlatform] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Fetch agency platform connections
  const {
    data: connectedPlatforms = [],
    isLoading,
    error: fetchError,
  } = useQuery<Platform[]>({
    queryKey: ['agency-platforms', orgId],
    queryFn: async () => {
      const result = await authorizedApiFetch<{ data: Platform[]; error: null }>(
        `/agency-platforms/available?agencyId=${orgId}`,
        { getToken }
      );
      return result.data || [];
    },
    enabled: !!orgId,
  });

  // Fetch Google accounts if Google is connected
  const googleConnection = connectedPlatforms?.find((p) => p.platform === 'google');
  const {
    data: googleAccounts,
    isLoading: isLoadingGoogleAccounts,
    refetch: refetchGoogleAccounts,
  } = useQuery<GoogleAccountsResponse>({
    queryKey: ['google-accounts', orgId],
    queryFn: async () => {
      const result = await authorizedApiFetch<{ data: GoogleAccountsResponse; error: null }>(
        `/agency-platforms/google/accounts?agencyId=${orgId}`,
        { getToken }
      );
      return result.data;
    },
    enabled: !!orgId && !!googleConnection?.connected && showGoogleAccounts,
  });

  // Fetch Meta business accounts if Meta is connected
  const metaConnection = connectedPlatforms?.find((p) => p.platform === 'meta');
  const {
    data: metaBusinessAccounts,
    isLoading: isLoadingMetaBusinesses,
    refetch: refetchMetaBusinesses,
  } = useQuery<MetaBusinessAccountsResponse>({
    queryKey: ['meta-business-accounts', orgId],
    queryFn: async () => {
      const result = await authorizedApiFetch<{ data: MetaBusinessAccountsResponse; error: null }>(
        `/agency-platforms/meta/business-accounts?agencyId=${orgId}&refresh=true`,
        { getToken }
      );
      return result.data;
    },
    enabled: !!orgId && !!metaConnection?.connected && showMetaBusinesses,
  });

  // OAuth initiation mutation
  const { mutate: initiatePlatform, isPending } = useMutation({
    mutationFn: async (platform: string) => {
      const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
      if (!userEmail) {
        throw new Error('Unable to resolve your account email.');
      }

      const result = await authorizedApiFetch<{ data: { authUrl: string }; error: null }>(
        `/agency-platforms/${platform}/initiate`,
        {
          method: 'POST',
          getToken,
          body: JSON.stringify({
            agencyId: orgId,
            userEmail,
            redirectUrl: `${window.location.origin}/platforms/callback`,
          }),
        }
      );
      return result.data;
    },
    onSuccess: (data) => {
      // Redirect to OAuth provider
      window.location.href = data.authUrl;
    },
    onError: () => {
      setError('Failed to connect platform. Please try again.');
    },
  });

  const handleMetaConnect = async () => {
    if (!orgId) {
      setError('Agency not found. Please refresh and try again.');
      return;
    }

    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    if (!userEmail) {
      setError('Unable to resolve your account email.');
      return;
    }

    setIsMetaConnecting(true);

    try {
      const authPayload = await launchMetaBusinessLogin({
        appId: process.env.NEXT_PUBLIC_META_APP_ID || '',
        configId: process.env.NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID || '',
      });

      await finalizeMetaBusinessLogin({
        agencyId: orgId,
        userEmail,
        getToken,
        authPayload,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agency-platforms', orgId] }),
        queryClient.invalidateQueries({ queryKey: ['meta-business-accounts', orgId] }),
      ]);
      trackOAuthCallbackSuccess({
        platform: 'meta',
        auth_source: 'agency_meta_popup',
        agency_id: orgId,
      });
      setShowMetaBusinesses(true);
    } catch (err) {
      trackOAuthCallbackFailure({
        platform: 'meta',
        error_code: 'META_POPUP_FAILED',
        error_message: err instanceof Error ? err.message : 'Failed to connect Meta',
        auth_source: 'agency_meta_popup',
        agency_id: orgId,
      });
      const message =
        err instanceof Error ? err.message : 'Failed to connect Meta. Please try again.';
      setError(message);
    } finally {
      setIsMetaConnecting(false);
    }
  };

  const handleConnect = (platform: string, platformType?: string) => {
    setError(null);

    // Check if this is a manual invitation platform
    if (isManualInvitePlatform(platform)) {
      // Open manual invitation modal
      setManualInvitationPlatform(platform);
      setIsManualModalOpen(true);
    } else if (platform === 'meta') {
      void handleMetaConnect();
    } else {
      // Use OAuth flow
      initiatePlatform(platform);
    }
  };

  const handleManualModalClose = () => {
    setIsManualModalOpen(false);
    setManualInvitationPlatform(null);
  };

  const handleManualSuccess = () => {
    // Refetch platforms to update the UI
    queryClient.invalidateQueries({ queryKey: ['agency-platforms', orgId] });
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  const handleContinue = () => {
    router.push('/dashboard');
  };

  const hasConnectedPlatforms = connectedPlatforms?.some((p) => p.connected) || false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading platforms...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">Failed to load platforms. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Connect Platforms</h1>

      {/* Explanation of authorization models */}
      <div className="mb-8 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Delegated Access</h3>
          <p className="text-sm text-blue-800">
            Manage client accounts through your own platform connection. You control access and can
            act on behalf of clients.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">Client Authorization</h3>
          <p className="text-sm text-green-800">
            Client authorizes access to their own platform accounts. They maintain ownership and
            grant you specific permissions.
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Platform grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {SUPPORTED_PLATFORMS.map((platform) => {
          const connection = connectedPlatforms.find((p) => p.platform === platform.id);
          const isConnected = connection?.connected || false;

          return (
            <div
              key={platform.id}
              className="border rounded-lg p-6 flex flex-col items-center justify-between"
            >
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">{platform.name}</h3>
                <p className="text-sm text-gray-600">{platform.description}</p>
              </div>

              {isConnected ? (
                <div className="text-center">
                  <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Connected
                  </span>
                  {connection?.connectedAt && (
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(connection.connectedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(platform.id)}
                  disabled={isPending || isMetaConnecting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isPending || (platform.id === 'meta' && isMetaConnecting) ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Google Accounts Section - shows when Google is connected */}
      {googleConnection?.connected && (
        <div className="mb-8 border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Your Google Accounts</h2>
            <div className="flex gap-2">
              {!showGoogleAccounts ? (
                <button
                  onClick={() => setShowGoogleAccounts(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  View Accounts
                </button>
              ) : (
                <>
                  <button
                    onClick={() => refetchGoogleAccounts()}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => setShowGoogleAccounts(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Hide
                  </button>
                </>
              )}
            </div>
          </div>

          {showGoogleAccounts && (
            <>
              {isLoadingGoogleAccounts ? (
                <p className="text-gray-600">Loading Google accounts...</p>
              ) : googleAccounts && googleAccounts.hasAccess ? (
                <div className="space-y-6">
                  {GOOGLE_ACCOUNT_SECTIONS.map((section) => {
                    const items = section.items(googleAccounts);
                    if (items.length === 0) return null;

                    return (
                      <div key={section.key}>
                        <h3 className="font-semibold text-blue-900 mb-2">
                          {section.title} ({items.length})
                        </h3>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="bg-gray-50 p-3 rounded border">
                              {item.body}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* No accounts message */}
                  {GOOGLE_ACCOUNT_SECTIONS.every(
                    (section) => section.items(googleAccounts).length === 0
                  ) && (
                    <div className="text-center py-8 bg-gray-50 rounded">
                      <p className="text-gray-600">No Google accounts found.</p>
                      <p className="text-sm text-gray-500 mt-1">
                        You may need to grant access to specific Google products through your Google account settings.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded">
                  <p className="text-gray-600">No Google accounts found.</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Try connecting to Google again or check your Google account permissions.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Meta Business Accounts Section - shows when Meta is connected */}
      {metaConnection?.connected && (
        <div className="mb-8 border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Your Meta Business Manager Accounts</h2>
            <div className="flex gap-2">
              {!showMetaBusinesses ? (
                <button
                  onClick={() => setShowMetaBusinesses(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  View Business Accounts
                </button>
              ) : (
                <>
                  <button
                    onClick={() => refetchMetaBusinesses()}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => setShowMetaBusinesses(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Hide
                  </button>
                </>
              )}
            </div>
          </div>

          {showMetaBusinesses && (
            <>
              {isLoadingMetaBusinesses ? (
                <p className="text-gray-600">Loading Meta Business Manager accounts...</p>
              ) : metaBusinessAccounts && metaBusinessAccounts.hasAccess ? (
                <div className="space-y-4">
                  {metaBusinessAccounts.businesses.length > 0 ? (
                    metaBusinessAccounts.businesses.map((business) => (
                      <div key={business.id} className="bg-gray-50 p-4 rounded border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-lg">{business.name}</p>
                            <p className="text-sm text-gray-600">Business ID: {business.id}</p>
                            {business.verticalName && (
                              <p className="text-xs text-gray-500 mt-1">Industry: {business.verticalName}</p>
                            )}
                          </div>
                          {business.verificationStatus && (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              business.verificationStatus === 'verified'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {business.verificationStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded">
                      <p className="text-gray-600">No Business Manager accounts found.</p>
                      <p className="text-sm text-gray-500 mt-1">
                        You may need to create a Business Manager account or ensure you have access to one.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded">
                  <p className="text-gray-600">No Meta Business Manager accounts found.</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Try connecting to Meta again or check your Business Manager permissions.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          onClick={handleSkip}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Skip for now
        </button>

        {hasConnectedPlatforms && (
          <button
            onClick={handleContinue}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Continue
          </button>
        )}
      </div>

      {/* Manual Invitation Modal */}
      {manualInvitationPlatform && (
        <ManualInvitationModal
          isOpen={isManualModalOpen}
          onClose={handleManualModalClose}
          platform={manualInvitationPlatform}
          agencyId={orgId || ''}
          onSuccess={handleManualSuccess}
        />
      )}
    </div>
  );
}
