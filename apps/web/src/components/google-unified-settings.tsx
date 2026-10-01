'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { 
  getDefaultGoogleAssetSettings,
  GoogleAssetSettings,
  GoogleAccountsResponse
} from '@agency-platform/shared';
import { getGoogleAdsAccountLabel } from '@/lib/google-ads-account-label';
import { ManageAssetsSectionCard, ManageAssetsStatusPanel } from './manage-assets-ui';
import { GoogleAdsAccessMethod } from './google-ads-access-method';
import { Button } from './ui/button';
import { SingleSelect } from './ui/single-select';
import { BrutalistCheckbox } from './ui/brutalist-checkbox';
import {
  Loader2,
  AlertCircle,
  Info,
  CircleDollarSign,
  BarChart3,
  MapPin,
  Tags,
  Search,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveApiUrl } from '@/lib/api/api-env';

interface GoogleUnifiedSettingsProps {
  agencyId: string;
}

type GoogleSettingsProductKey = Exclude<keyof GoogleAssetSettings, 'googleAdsManagement'>;

function mergeGoogleSettings(settings: GoogleAssetSettings | null | undefined): GoogleAssetSettings | null {
  if (!settings) {
    return null;
  }

  const defaults = getDefaultGoogleAssetSettings();
  const mergedGoogleAdsManagement = {
    preferredGrantMode:
      settings.googleAdsManagement?.preferredGrantMode ||
      defaults.googleAdsManagement?.preferredGrantMode ||
      'user_invite',
    ...(defaults.googleAdsManagement?.inviteEmail
      ? { inviteEmail: defaults.googleAdsManagement.inviteEmail }
      : {}),
    ...(settings.googleAdsManagement?.inviteEmail
      ? { inviteEmail: settings.googleAdsManagement.inviteEmail }
      : {}),
    ...(settings.googleAdsManagement?.managerCustomerId
      ? { managerCustomerId: settings.googleAdsManagement.managerCustomerId }
      : {}),
    ...(settings.googleAdsManagement?.managerAccountLabel
      ? { managerAccountLabel: settings.googleAdsManagement.managerAccountLabel }
      : {}),
  };

  return {
    ...defaults,
    ...settings,
    googleAdsManagement: mergedGoogleAdsManagement,
    googleAds: {
      ...defaults.googleAds,
      ...settings.googleAds,
    },
    googleAnalytics: {
      ...defaults.googleAnalytics,
      ...settings.googleAnalytics,
    },
    googleBusinessProfile: {
      ...defaults.googleBusinessProfile,
      ...settings.googleBusinessProfile,
    },
    googleTagManager: {
      ...defaults.googleTagManager,
      ...settings.googleTagManager,
    },
    googleSearchConsole: {
      ...defaults.googleSearchConsole,
      ...settings.googleSearchConsole,
    },
    googleMerchantCenter: {
      ...defaults.googleMerchantCenter,
      ...settings.googleMerchantCenter,
    },
  };
}

export function GoogleUnifiedSettings({ agencyId }: GoogleUnifiedSettingsProps) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const [settings, setSettings] = useState<GoogleAssetSettings | null>(null);

  // Fetch all Google accounts across products
  const {
    data: accountsData,
    isLoading: isLoadingAccounts,
    error: accountsError,
    refetch: refetchAccounts,
  } = useQuery({
    queryKey: ['google-accounts', agencyId],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch(
        // Always refresh from Google APIs when opening Manage Assets so we don't rely on cached metadata.
        resolveApiUrl(`/agency-platforms/google/accounts?agencyId=${agencyId}&refresh=true`),
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch Google accounts');
      const result = await response.json();
      return result.data as GoogleAccountsResponse;
    },
    // Avoid hammering Google APIs on focus/re-mount.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch current asset settings
  const { data: initialSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['google-asset-settings', agencyId],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch(
        resolveApiUrl(`/agency-platforms/google/asset-settings?agencyId=${agencyId}`),
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch Google settings');
      const json = await response.json();
      return json.data as GoogleAssetSettings;
    },
  });

  useEffect(() => {
    if (initialSettings) {
      setSettings(mergeGoogleSettings(initialSettings));
    }
  }, [initialSettings]);

  // Save Settings Mutation
  const { mutate: saveSettings, isPending: isSavingSettings } = useMutation({
    mutationFn: async (newSettings: GoogleAssetSettings) => {
      const token = await getToken();
      const response = await fetch(resolveApiUrl('/agency-platforms/google/asset-settings'), {
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
      queryClient.invalidateQueries({ queryKey: ['google-asset-settings', agencyId] });
    },
  });

  // Save Account Selection Mutation
  const { mutate: saveAccount } = useMutation({
    mutationFn: async ({ product, accountId, accountName }: { product: string; accountId: string; accountName: string }) => {
      const token = await getToken();
      const response = await fetch(resolveApiUrl('/agency-platforms/google/account'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          agencyId,
          product,
          accountId,
          accountName,
        }),
      });
      if (!response.ok) throw new Error('Failed to save account selection');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-connections', agencyId] });
    },
  });

  const isLoading = isLoadingAccounts || isLoadingSettings;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 text-danger-ink text-center">
        <AlertCircle className="h-6 w-6 mx-auto mb-2" />
        Failed to load Google settings
      </div>
    );
  }

  if (accountsError) {
    return (
      <div className="p-8 text-danger-ink text-center">
        <AlertCircle className="h-6 w-6 mx-auto mb-2" />
        Failed to load Google accounts
        <Button type="button" variant="secondary" className="mx-auto mt-3" onClick={() => void refetchAccounts()}>
          Try again
        </Button>
      </div>
    );
  }

  const updateSetting = (key: GoogleSettingsProductKey, field: string, value: any) => {
    const newSettings = {
      ...settings,
      [key]: { ...settings[key], [field]: value }
    };
    setSettings(newSettings);
    // Auto-save on change
    saveSettings(newSettings);
  };

  const updateGoogleAdsManagement = (updates: Record<string, any>) => {
    if (!settings) return;

    const nextGoogleAdsManagement = {
      preferredGrantMode: settings.googleAdsManagement?.preferredGrantMode || 'user_invite',
      ...(settings.googleAdsManagement?.inviteEmail
        ? { inviteEmail: settings.googleAdsManagement.inviteEmail }
        : {}),
      ...(settings.googleAdsManagement?.managerCustomerId
        ? { managerCustomerId: settings.googleAdsManagement.managerCustomerId }
        : {}),
      ...(settings.googleAdsManagement?.managerAccountLabel
        ? { managerAccountLabel: settings.googleAdsManagement.managerAccountLabel }
        : {}),
      ...updates,
    };

    const newSettings: GoogleAssetSettings = {
      ...settings,
      googleAdsManagement: nextGoogleAdsManagement,
    };

    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const setAllProductsEnabled = (enabled: boolean) => {
    if (!settings) return;
    const newSettings: GoogleAssetSettings = {
      ...settings,
      googleAds: { ...settings.googleAds, enabled },
      googleAnalytics: { ...settings.googleAnalytics, enabled },
      googleBusinessProfile: { ...settings.googleBusinessProfile, enabled },
      googleTagManager: { ...settings.googleTagManager, enabled },
      googleSearchConsole: { ...settings.googleSearchConsole, enabled },
      googleMerchantCenter: { ...settings.googleMerchantCenter, enabled },
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleAccountSelect = (product: GoogleSettingsProductKey, accountId: string, accountName: string) => {
    const idField = product === 'googleAnalytics' ? 'propertyId' : 
                    product === 'googleBusinessProfile' ? 'locationId' :
                    product === 'googleTagManager' ? 'containerId' :
                    product === 'googleSearchConsole' ? 'siteUrl' : 'accountId';
    
    updateSetting(product, idField, accountId);
    saveAccount({ product, accountId, accountName });
  };

  const managerAccounts = (accountsData?.adsAccounts || []).filter((account) => account.isManager);
  const googleAdsManagement = settings.googleAdsManagement || getDefaultGoogleAssetSettings().googleAdsManagement!;

  return (
    <div className="space-y-6">
      <ManageAssetsSectionCard
        eyebrow="Product controls"
        title="Google products"
        description="Enable the products your agency actually uses, then map each one to the correct account or property."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAllProductsEnabled(true)}
              disabled={isSavingSettings}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAllProductsEnabled(false)}
              disabled={isSavingSettings}
            >
              Deselect all
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <ProductCard
            icon={<CircleDollarSign className="h-5 w-5 text-muted-foreground" />}
            label="Google Ads"
            description="Request Google Ads access. Account is chosen per request when you create an access link."
            enabled={settings.googleAds.enabled}
            onToggle={(val) => updateSetting('googleAds', 'enabled', val)}
            showAccountSelector={false}
            accounts={[]}
            selectedId={undefined}
            onAccountSelect={() => {}}
            placeholder=""
            customContent={
              <GoogleAdsAccessMethod
                preferredGrantMode={googleAdsManagement.preferredGrantMode}
                managerAccounts={managerAccounts}
                managerCustomerId={googleAdsManagement.managerCustomerId || ''}
                managerAccountLabel={googleAdsManagement.managerAccountLabel}
                inviteEmail={googleAdsManagement.inviteEmail || ''}
                onUpdate={updateGoogleAdsManagement}
                disabled={isSavingSettings}
              />
            }
          />

          <ProductCard
            icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
            label="Google Analytics Account"
            description="Connect the GA4 property your team needs for reporting and measurement."
            enabled={settings.googleAnalytics.enabled}
            onToggle={(val) => updateSetting('googleAnalytics', 'enabled', val)}
            accounts={accountsData?.analyticsProperties || []}
            selectedId={settings.googleAnalytics.propertyId}
            onAccountSelect={(id, name) => handleAccountSelect('googleAnalytics', id, name)}
            placeholder="Select GA4 Property..."
            requestManageUsers={settings.googleAnalytics.requestManageUsers}
            onRequestManageUsersToggle={(val) => updateSetting('googleAnalytics', 'requestManageUsers', val)}
            tooltip="Enable setting to request Administrator access (instead of Editor access)"
            onRetryAccounts={() => void refetchAccounts()}
            hasGoogleAccess={accountsData?.hasAccess ?? false}
          />

          <ProductCard
            icon={<MapPin className="h-5 w-5 text-muted-foreground" />}
            label="Google Business Profile Location"
            description="Choose the location your agency needs to manage in Business Profile."
            enabled={settings.googleBusinessProfile.enabled}
            onToggle={(val) => updateSetting('googleBusinessProfile', 'enabled', val)}
            accounts={accountsData?.businessAccounts || []}
            selectedId={settings.googleBusinessProfile.locationId}
            onAccountSelect={(id, name) => handleAccountSelect('googleBusinessProfile', id, name)}
            placeholder="Select Business Location..."
            requestManageUsers={settings.googleBusinessProfile.requestManageUsers}
            onRequestManageUsersToggle={(val) => updateSetting('googleBusinessProfile', 'requestManageUsers', val)}
            tooltip="Enable setting to request Owner access (instead of Manager access)"
            onRetryAccounts={() => void refetchAccounts()}
            hasGoogleAccess={accountsData?.hasAccess ?? false}
          />

          <ProductCard
            icon={<Tags className="h-5 w-5 text-muted-foreground" />}
            label="Google Tag Manager"
            description="Choose the GTM container your agency should maintain."
            enabled={settings.googleTagManager.enabled}
            onToggle={(val) => updateSetting('googleTagManager', 'enabled', val)}
            accounts={accountsData?.tagManagerContainers || []}
            selectedId={settings.googleTagManager.containerId}
            onAccountSelect={(id, name) => handleAccountSelect('googleTagManager', id, name)}
            placeholder="Select TGM Container..."
            requestManageUsers={settings.googleTagManager.requestManageUsers}
            onRequestManageUsersToggle={(val) => updateSetting('googleTagManager', 'requestManageUsers', val)}
            tooltip="Enable setting to request Administrator access (instead of User access)"
            onRetryAccounts={() => void refetchAccounts()}
            hasGoogleAccess={accountsData?.hasAccess ?? false}
          />

          <ProductCard
            icon={<Search className="h-5 w-5 text-muted-foreground" />}
            label="Google Search Console"
            description="Map Search Console access to the site your agency monitors."
            enabled={settings.googleSearchConsole.enabled}
            onToggle={(val) => updateSetting('googleSearchConsole', 'enabled', val)}
            accounts={accountsData?.searchConsoleSites || []}
            selectedId={settings.googleSearchConsole.siteUrl}
            onAccountSelect={(id, name) => handleAccountSelect('googleSearchConsole', id, name)}
            placeholder="Select Search Console Site..."
            requestManageUsers={settings.googleSearchConsole.requestManageUsers}
            onRequestManageUsersToggle={(val) => updateSetting('googleSearchConsole', 'requestManageUsers', val)}
            tooltip="Enable setting to request Owner access (instead of Full access)"
            onRetryAccounts={() => void refetchAccounts()}
            hasGoogleAccess={accountsData?.hasAccess ?? false}
          />

          <ProductCard
            icon={<ShoppingBag className="h-5 w-5 text-danger-ink" />}
            label="Google Merchant Center"
            description="Connect the Merchant Center account used for shopping feeds and commerce operations."
            enabled={settings.googleMerchantCenter.enabled}
            onToggle={(val) => updateSetting('googleMerchantCenter', 'enabled', val)}
            accounts={accountsData?.merchantCenterAccounts || []}
            selectedId={settings.googleMerchantCenter.accountId}
            onAccountSelect={(id, name) => handleAccountSelect('googleMerchantCenter', id, name)}
            placeholder="Select Merchant Account..."
            requestManageUsers={settings.googleMerchantCenter.requestManageUsers}
            onRequestManageUsersToggle={(val) => updateSetting('googleMerchantCenter', 'requestManageUsers', val)}
            tooltip="Enable setting to request Super Admin access (instead of Standard access)"
            onRetryAccounts={() => void refetchAccounts()}
            hasGoogleAccess={accountsData?.hasAccess ?? false}
          />
        </div>
      </ManageAssetsSectionCard>
    </div>
  );
}

interface ProductCardProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  accounts: any[];
  selectedId?: string;
  onAccountSelect: (id: string, name: string) => void;
  placeholder: string;
  showAccountSelector?: boolean;
  noAccountSelectorHelperText?: string;
  customContent?: React.ReactNode;
  requestManageUsers?: boolean;
  onRequestManageUsersToggle?: (val: boolean) => void;
  tooltip?: string;
  warningMessage?: string;
  hasGoogleAccess?: boolean;
  onRetryAccounts?: () => void;
}

function getAccountDisplayName(account: any): string {
  if (account?.type === 'google_ads') {
    return getGoogleAdsAccountLabel(account);
  }

  return account?.displayName || account?.name || account?.url || '';
}

function getAccountId(account: any): string {
  return account?.id || account?.url || '';
}

function getAccountOptionLabel(account: any): string {
  const id = getAccountId(account);
  const name = getAccountDisplayName(account);

  if (!id) {
    return name;
  }

  if (account?.type === 'google_ads') {
    return name;
  }

  return `${name} (${id})`;
}

function ProductCard({
  icon,
  label,
  description,
  enabled,
  onToggle,
  accounts,
  selectedId,
  onAccountSelect,
  placeholder,
  showAccountSelector = true,
  noAccountSelectorHelperText,
  customContent,
  requestManageUsers,
  onRequestManageUsersToggle,
  tooltip,
  warningMessage,
  hasGoogleAccess = false,
  onRetryAccounts = () => undefined,
}: ProductCardProps) {
  return (
    <div
      className={cn(
        'rounded-none border p-4 transition-colors duration-150',
        enabled
          ? 'border-border bg-paper hover:border-black hover:bg-paper/95'
          : 'border-border bg-card/70 opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <BrutalistCheckbox
          checked={enabled}
          onChange={onToggle}
          aria-label={`Enable ${label}`}
        />
        <div className="flex-1 space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-paper">
              {icon}
            </div>
            <div className="space-y-1">
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          {enabled && showAccountSelector && (
            <div className="space-y-3">
              {accounts.length === 0 ? (
                <div className="rounded-none border border-coral/40 bg-coral/5 px-4 py-3">
                  <p className="text-sm font-medium text-danger-ink">No accounts available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasGoogleAccess
                      ? `No ${label} assets were found in this connected Google account.`
                      : 'Google access is unavailable. Reconnect Google from Connections.'}
                  </p>
                  {hasGoogleAccess ? (
                    <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={onRetryAccounts}>
                      Refresh Google accounts
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="secondary" className="mt-3" asChild>
                      <Link href="/connections">Open Connections</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <SingleSelect
                    options={accounts.map((account) => {
                      const id = getAccountId(account);
                      return { value: id, label: getAccountOptionLabel(account) };
                    })}
                    value={selectedId || ''}
                    onChange={(id, label) => onAccountSelect(id, label)}
                    placeholder={placeholder}
                  />

                  {warningMessage && (
                    <ManageAssetsStatusPanel
                      label="Selection warning"
                      title="Saved account needs replacement"
                      description={warningMessage}
                      tone="warning"
                    />
                  )}
                </>
              )}
            </div>
          )}

          {enabled && !showAccountSelector && !customContent && noAccountSelectorHelperText && (
            <p className="text-xs text-muted-foreground">{noAccountSelectorHelperText}</p>
          )}

          {enabled && customContent && (
            <div className="pt-3 border-t border-border space-y-3">
              {customContent}
            </div>
          )}

          {enabled && showAccountSelector && onRequestManageUsersToggle && (
            <div className="rounded-none border border-border bg-paper px-3 py-3">
              <BrutalistCheckbox
                checked={requestManageUsers || false}
                onChange={onRequestManageUsersToggle}
                label={
                  <span className="flex items-center gap-1 text-xs text-foreground">
                    Request permission to manage users
                    {tooltip && (
                      <div className="group relative">
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-ink text-white text-[10px] rounded shadow-brutalist opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {tooltip}
                        </div>
                      </div>
                    )}
                  </span>
                }
                id={`manage-users-${label}`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
