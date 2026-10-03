'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/nextjs';
import { MetaAssetSettings } from '@agency-platform/shared';
import { MetaPagePermissionsModal } from './meta-page-permissions-modal';
import { ManageAssetsSectionCard, ManageAssetsStatusPanel } from './manage-assets-ui';
import { Button } from './ui/button';
import { SingleSelect } from '@/components/ui/single-select';
import { resolveApiUrl } from '@/lib/api/api-env';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { extractApiErrorMessage } from '@/lib/api/extract-error';
import { startAgencyMetaOAuth } from '@/lib/agency-meta-oauth';
import { Loader2, ChevronDown, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetaUnifiedSettingsProps {
  agencyId: string;
}

interface Business {
  id: string;
  name: string;
}

export function MetaUnifiedSettings({ agencyId }: MetaUnifiedSettingsProps) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [settings, setSettings] = useState<MetaAssetSettings | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [selectedBusinessName, setSelectedBusinessName] = useState<string>('');
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [isReauthenticating, setIsReauthenticating] = useState(false);

  // Fetch businesses
  const {
    data: businessesData,
    error: businessesError,
  } = useQuery({
    queryKey: ['meta-businesses', agencyId],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch(
        // Always refresh from Meta when opening Manage Assets so the portfolio dropdown
        // reflects current Business Manager access instead of stale connection metadata.
        resolveApiUrl(`/agency-platforms/meta/business-accounts?agencyId=${agencyId}&refresh=true`),
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, 'Failed to fetch businesses'));
      }
      const result = await response.json();
      return result.data as { businesses: Business[] };
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Fetch current settings and selected business
  const { data: initialData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['meta-asset-settings', agencyId],
    queryFn: async () => {
      const json = await authorizedApiFetch<{ data: MetaAssetSettings }>(
        `/agency-platforms/meta/asset-settings?agencyId=${agencyId}`,
        { getToken }
      );
      return json.data;
    },
  });

  // Fetch connection to get selected business
  const { data: connectionData } = useQuery({
    queryKey: ['platform-connections', agencyId],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch(
        resolveApiUrl(`/agency-platforms/available?agencyId=${agencyId}`),
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch connections');
      const result = await response.json();
      const metaConnection = result.data?.find((p: any) => p.platform === 'meta' && p.connected);
      return metaConnection;
    },
    enabled: !!agencyId,
  });

  useEffect(() => {
    if (initialData) {
      setSettings(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    if (connectionData?.metadata?.selectedBusinessId) {
      setSelectedBusinessId(connectionData.metadata.selectedBusinessId);
      setSelectedBusinessName(connectionData.metadata.selectedBusinessName || '');
    }
  }, [connectionData]);

  // Save Business Portfolio Mutation
  const { mutate: savePortfolio, isPending: isSavingPortfolio } = useMutation({
    mutationFn: async ({ businessId, businessName }: { businessId: string; businessName: string }) => {
      const token = await getToken();
      const response = await fetch(resolveApiUrl('/agency-platforms/meta/business'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          agencyId,
          businessId,
          businessName,
        }),
      });
      if (!response.ok) throw new Error('Failed to save portfolio');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections', agencyId] });
      queryClient.invalidateQueries({ queryKey: ['meta-businesses', agencyId] });
    },
  });

  // Save Settings Mutation
  const { mutate: saveSettings, isPending: isSavingSettings } = useMutation({
    mutationFn: async (newSettings: MetaAssetSettings) => {
      const token = await getToken();
      const response = await fetch(resolveApiUrl('/agency-platforms/meta/asset-settings'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          agencyId,
          settings: newSettings,
        }),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-asset-settings', agencyId] });
    },
  });

  const cachedBusinesses = (
    connectionData?.metadata?.metaBusinessAccounts?.businesses as Business[] | undefined
  ) || [];
  const refreshedBusinesses = businessesData?.businesses;
  const baseBusinesses = refreshedBusinesses ?? cachedBusinesses;
  const businesses = baseBusinesses.some((business) => business.id === selectedBusinessId) || !selectedBusinessId
    ? baseBusinesses
    : [
        ...baseBusinesses,
        {
          id: selectedBusinessId,
          name: selectedBusinessName || selectedBusinessId,
        },
      ];
  const isLoading = isLoadingSettings;
  const businessRefreshWarning = businessesError instanceof Error ? businessesError.message : null;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 text-center text-danger-ink">
        <AlertCircle className="h-6 w-6 mx-auto mb-2" />
        Failed to load Meta settings
      </div>
    );
  }

  const selectedPortfolioLabel = selectedBusinessName || 'No portfolio selected';

  const updateSetting = (key: keyof MetaAssetSettings, field: string, value: any) => {
    const newSettings = {
      ...settings,
      [key]: { ...settings[key], [field]: value }
    };
    setSettings(newSettings);
    // Auto-save on change
    saveSettings(newSettings);
  };

  const handleBusinessSelect = (businessId: string) => {
    const business = businesses.find(b => b.id === businessId);
    if (business) {
      setSelectedBusinessId(businessId);
      setSelectedBusinessName(business.name);
      savePortfolio({ businessId: businessId, businessName: business.name });
    }
  };

  const handleReauthenticate = async () => {
    const userEmail =
      user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    if (!userEmail) {
      setReauthError('Unable to resolve your account email.');
      return;
    }

    setReauthError(null);
    setIsReauthenticating(true);

    try {
      await startAgencyMetaOAuth({
        agencyId,
        userEmail,
        getToken,
      });
    } catch (error) {
      setReauthError((error as Error).message);
    } finally {
      setIsReauthenticating(false);
    }
  };

  return (
    <div className="space-y-6">
      <ManageAssetsSectionCard
        eyebrow="Primary control"
        title="Business Portfolio"
        description="The stored portfolio is the source of truth for Meta asset management and reauthentication."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isReauthenticating}
            onClick={() => void handleReauthenticate()}
            disabled={isSavingPortfolio}
          >
            {isReauthenticating ? 'Logging in again...' : 'Log in again'}
          </Button>
        }
      >
        <div className="space-y-4">
          <ManageAssetsStatusPanel
            label="Stored portfolio"
            title={selectedPortfolioLabel}
            description={
              selectedBusinessId
                ? 'This portfolio will be used to manage all selected Meta assets.'
                : 'No portfolio is stored yet.'
            }
            tone={selectedBusinessId ? 'default' : 'warning'}
          />

          <div className="rounded-[1rem] border border-border bg-paper p-4">
            <label htmlFor="meta-business-portfolio" className="mb-2 block text-sm font-semibold text-ink">
              Meta Business Portfolio
            </label>
            <SingleSelect
              options={businesses.map((b) => ({
                value: b.id,
                label: `${b.name} (${b.id})`,
              }))}
              value={selectedBusinessId}
              onChange={(id: string) => handleBusinessSelect(id)}
              placeholder="Select a portfolio..."
              disabled={isSavingPortfolio}
              ariaLabel="Meta Business Portfolio"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Changing this selection reconfigures the portfolio used for delegated system-user access.
            </p>
          </div>

          {businessRefreshWarning && cachedBusinesses.length > 0 ? (
            <ManageAssetsStatusPanel
              label="Refresh warning"
              title={businessRefreshWarning}
              description="Showing the last synced portfolios until Meta refresh succeeds."
              tone="warning"
            />
          ) : null}

          {reauthError ? (
            <ManageAssetsStatusPanel
              label="Reauthentication failed"
              title={reauthError}
              tone="danger"
            />
          ) : null}

        </div>
      </ManageAssetsSectionCard>

      <ManageAssetsSectionCard
        eyebrow="Asset access"
        title="Enabled asset types"
        description="Turn asset types on or off, then adjust permission-specific options where needed."
      >
        <div className="space-y-3">
          <AssetCard
            icon={<img src="/meta-color.svg" alt="Meta" className="h-5 w-5" />}
            label="Ad Account"
            description="Enable ad-account sharing for delegated access requests."
            enabled={settings.adAccount.enabled}
            onToggle={(val) => updateSetting('adAccount', 'enabled', val)}
          />

          <AssetCard
            icon={<img src="/meta-color.svg" alt="Meta" className="h-5 w-5" />}
            label="Page"
            description={
              settings.page.limitPermissions
                ? 'Requests only the selected page permissions.'
                : 'Requests the full default page permission set.'
            }
            enabled={settings.page.enabled}
            onToggle={(val) => updateSetting('page', 'enabled', val)}
            extraContent={
              settings.page.enabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!settings.page.limitPermissions) {
                      setIsPermissionsModalOpen(true);
                      return;
                    }

                    updateSetting('page', 'limitPermissions', false);
                    updateSetting('page', 'selectedPermissions', undefined);
                  }}
                  className="justify-start px-0 text-danger-ink hover:bg-transparent hover:text-danger-ink"
                >
                  {settings.page.limitPermissions ? 'Allow all permissions' : 'Limit permissions'}
                </Button>
              ) : null
            }
          />

          <AssetCard
            icon={<img src="/meta-color.svg" alt="Meta" className="h-5 w-5" />}
            label="Catalog"
            description="Enable catalog access for product and commerce workflows."
            enabled={settings.catalog.enabled}
            onToggle={(val) => updateSetting('catalog', 'enabled', val)}
          />

          <AssetCard
            icon={<img src="/meta-color.svg" alt="Meta" className="h-5 w-5" />}
            label="Dataset"
            description="Request dataset access when your reporting or conversion workflows depend on it."
            enabled={settings.dataset.enabled}
            onToggle={(val) => updateSetting('dataset', 'enabled', val)}
            extraContent={
              settings.dataset.enabled ? (
                <ManageAssetsStatusPanel
                  label="Optional escalation"
                  title="Request full Dataset access"
                  description="Enable this only when your agency needs full dataset control inside the selected Business Portfolio."
                >
                  <label htmlFor="dataset-full-access" className="flex items-start gap-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      id="dataset-full-access"
                      checked={settings.dataset.requestFullAccess}
                      onChange={(e) => updateSetting('dataset', 'requestFullAccess', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border text-danger-ink focus:ring-coral"
                    />
                    <span className="flex items-center gap-2">
                      Enable full Dataset access
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  </label>
                </ManageAssetsStatusPanel>
              ) : null
            }
          />

          <AssetCard
            icon={<img src="/meta-color.svg" alt="Meta" className="h-5 w-5" />}
            label="Instagram Account"
            description="Only enable the highest Instagram access level for commerce-specific workflows."
            enabled={settings.instagramAccount.enabled}
            onToggle={(val) => updateSetting('instagramAccount', 'enabled', val)}
            extraContent={
              settings.instagramAccount.enabled ? (
                <ManageAssetsStatusPanel
                  label="High access request"
                  title="Request full Instagram access"
                  description="This increases the chance clients must manually complete Instagram sharing in Business Portfolio."
                  tone="warning"
                >
                  <label htmlFor="instagram-full-access" className="flex items-start gap-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      id="instagram-full-access"
                      checked={settings.instagramAccount.requestFullAccess}
                      onChange={(e) => updateSetting('instagramAccount', 'requestFullAccess', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border text-danger-ink focus:ring-coral"
                    />
                    <span className="flex items-center gap-2">
                      Enable full Instagram access
                      <AlertTriangle className="h-3.5 w-3.5 text-danger-ink" />
                    </span>
                  </label>
                </ManageAssetsStatusPanel>
              ) : null
            }
          />
        </div>
      </ManageAssetsSectionCard>

      {/* Meta Page Permissions Modal */}
      <MetaPagePermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        selectedPermissions={settings.page.selectedPermissions || []}
        onSave={(permissions) => {
          updateSetting('page', 'limitPermissions', true);
          updateSetting('page', 'selectedPermissions', permissions);
          setIsPermissionsModalOpen(false);
        }}
        isSaving={isSavingSettings}
      />
    </div>
  );
}

function AssetCard({
  icon,
  label,
  description,
  enabled,
  onToggle,
  extraContent,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  extraContent?: React.ReactNode;
}) {
  // Match Google ProductCard: section card is the brutalist anchor; rows stay light.
  const toggleId = `meta-asset-${label.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <div
      className={cn(
        'rounded-[1rem] border p-4 transition-colors duration-150',
        enabled
          ? 'border-border bg-paper hover:border-black hover:bg-paper/95'
          : 'border-border bg-card/70 opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <input
          id={toggleId}
          aria-label={label}
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-border text-danger-ink focus:ring-coral"
        />
        <label htmlFor={toggleId} className="flex-1 cursor-pointer">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-paper text-muted-foreground">
              {icon}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </label>
      </div>
      {extraContent ? <div className="ml-8 mt-4 border-t border-border pt-4">{extraContent}</div> : null}
    </div>
  );
}
