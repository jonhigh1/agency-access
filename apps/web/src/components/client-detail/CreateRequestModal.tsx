'use client';

/**
 * CreateRequestModal Component
 *
 * Modal for creating a new access request for a specific client.
 * Simplified 2-step flow: Platform selection + Access level.
 */

import { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Link2, ChevronDown, Check, Minus, Clock } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PLATFORM_HIERARCHY, ACCESS_LEVEL_DESCRIPTIONS, type AccessLevel, type Platform } from '@agency-platform/shared';
import { Button, PlatformIcon } from '@/components/ui';
import { SingleSelect } from '@/components/ui/single-select';
import { buildInviteUrl } from '@/lib/app-url';
import { useQuotaCheck, QuotaExceededError } from '@/lib/query/quota';
import { UpgradeModal } from '@/components/upgrade-modal';
import { getGoogleAdsAccountLabel } from '@/lib/google-ads-account-label';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import type { GoogleAdsAccount } from '@agency-platform/shared';
import { cn } from '@/lib/utils';

interface CreateRequestModalProps {
  client: {
    id: string;
    name: string;
    email: string;
    company: string;
  };
  onClose: () => void;
  onSuccess?: (request: { id: string; uniqueToken: string }) => void;
}

interface SelectedPlatform {
  platformGroup: string;
  products: Array<{ product: string; accessLevel: AccessLevel; accountId?: string }>;
}

export function CreateRequestModal({ client, onClose, onSuccess }: CreateRequestModalProps) {
  const { orgId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const checkQuota = useQuotaCheck();

  const [globalAccessLevel, setGlobalAccessLevel] = useState<AccessLevel>('standard');
  const [externalReference, setExternalReference] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, string[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<{ id: string; uniqueToken: string } | null>(null);
  const success = createdRequest !== null;
  const [quotaError, setQuotaError] = useState<QuotaExceededError | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [googleAdsAccountId, setGoogleAdsAccountId] = useState<string>('');

  // Fetch Google accounts and asset settings for Google Ads account picker
  const { data: googleData } = useQuery({
    queryKey: ['google-accounts-and-settings', orgId],
    queryFn: async () => {
      if (!orgId || !getToken) return null;
      try {
        const [accountsPayload, settingsPayload] = await Promise.all([
          authorizedApiFetch<{ data?: { adsAccounts?: GoogleAdsAccount[] } }>(
            `/agency-platforms/google/accounts?agencyId=${orgId}&refresh=false`,
            { getToken }
          ),
          authorizedApiFetch<{ data?: any }>(
            `/agency-platforms/google/asset-settings?agencyId=${orgId}`,
            { getToken }
          ),
        ]);
        return {
          adsAccounts: accountsPayload?.data?.adsAccounts ?? [],
          settings: settingsPayload?.data ?? null,
        };
      } catch {
        // ponytail: the account picker is an enhancement; degrade to empty picker, never block request creation.
        return null;
      }
    },
    enabled: Boolean(orgId),
    staleTime: 2 * 60 * 1000,
  });

  const adsAccounts = googleData?.adsAccounts ?? [];
  const mccCustomerId = googleData?.settings?.googleAdsManagement?.preferredGrantMode === 'manager_link'
    ? (googleData?.settings?.googleAdsManagement?.managerCustomerId ?? '').replace(/\D/g, '')
    : '';

  // Default Google Ads account to MCC when user selects google_ads and MCC is configured
  useEffect(() => {
    if (!isProductSelected('google', 'google_ads') || !mccCustomerId || googleAdsAccountId) return;
    const norm = (s: string) => (s || '').replace(/\D/g, '');
    const match = adsAccounts.find(
      (a: { id: string }) => norm(a.id) === mccCustomerId || a.id === mccCustomerId
    );
    if (match) setGoogleAdsAccountId(match.id);
  }, [selectedPlatforms, mccCustomerId, adsAccounts, googleAdsAccountId]);

  // Toggle platform group expansion
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  // Toggle single product
  const toggleProduct = (groupKey: string, productId: string) => {
    const currentSelection = selectedPlatforms[groupKey] || [];
    const isSelected = currentSelection.includes(productId);

    setSelectedPlatforms(prev => ({
      ...prev,
      [groupKey]: isSelected
        ? currentSelection.filter(id => id !== productId)
        : [...currentSelection, productId],
    }));
  };

  // Toggle all products in a group
  const toggleGroupAll = (groupKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const products = PLATFORM_HIERARCHY[groupKey]?.products ?? [];
    const allProductIds = products.map(p => p.id);
    const currentSelection = selectedPlatforms[groupKey] || [];
    const allSelected = allProductIds.every(id => currentSelection.includes(id));

    setSelectedPlatforms(prev => ({
      ...prev,
      [groupKey]: allSelected ? [] : allProductIds,
    }));
  };

  // Check if product is selected
  const isProductSelected = (groupKey: string, productId: string) => {
    return selectedPlatforms[groupKey]?.includes(productId) || false;
  };

  // Get selection state for a group: 'none' | 'partial' | 'all'
  const getGroupSelectionState = (groupKey: string): 'none' | 'partial' | 'all' => {
    const products = PLATFORM_HIERARCHY[groupKey]?.products ?? [];
    const selected = selectedPlatforms[groupKey] || [];
    if (selected.length === 0) return 'none';
    if (selected.length === products.length) return 'all';
    return 'partial';
  };

  // Get total selected product count
  const totalSelected = Object.values(selectedPlatforms).reduce((sum, products) => sum + products.length, 0);

  // Transform selected platforms to API format
  const buildSelectedPlatforms = (): SelectedPlatform[] => {
    return Object.entries(selectedPlatforms)
      .filter(([, products]) => products.length > 0)
      .map(([groupKey, products]) => ({
        platformGroup: groupKey,
        products: products.map(product => ({
          product,
          accessLevel: globalAccessLevel,
          ...(product === 'google_ads' && googleAdsAccountId ? { accountId: googleAdsAccountId } : {}),
        })),
      }));
  };

  // Create access request mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const platforms = buildSelectedPlatforms();

      if (platforms.length === 0) {
        throw new Error('Please select at least one platform');
      }

      return authorizedApiFetch('/api/access-requests', {
        getToken,
        method: 'POST',
        body: JSON.stringify({
          agencyId: orgId,
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email,
          externalReference: externalReference.trim() || undefined,
          platforms,
          globalAccessLevel,
        }),
      });
    },
    onSuccess: (result) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['client-detail', client.id] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-connections'] });
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });

      setCreatedRequest(result.data);

      // Auto-close after 3 seconds to allow user to copy link
      setTimeout(() => {
        onSuccess?.(result.data);
        onClose();
      }, 3000);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  const handleQuotaCheck = async () => {
    try {
      const result = await checkQuota.mutateAsync({ metric: 'access_requests' });
      if (!result.allowed) {
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
        return false;
      }
      return true;
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        setQuotaError(error);
        setShowUpgradeModal(true);
        return false;
      }
      // Other errors - allow creation to proceed (will be caught by mutation)
      return true;
    }
  };

  const handleSubmitWithQuotaCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (totalSelected === 0) {
      setErrorMessage('Please select at least one platform');
      return;
    }

    if (isProductSelected('google', 'google_ads') && !googleAdsAccountId) {
      setErrorMessage('Please select a Google Ads account');
      return;
    }

    // Check quota first
    const quotaOk = await handleQuotaCheck();
    if (!quotaOk) return;

    createMutation.mutate();
  };

  const copyLinkToClipboard = () => {
    if (createdRequest) {
      const link = buildInviteUrl(createdRequest.uniqueToken);
      navigator.clipboard.writeText(link);
      // Could show a brief "copied" indicator here
    }
  };

  const inviteLink = createdRequest
    ? buildInviteUrl(createdRequest.uniqueToken)
    : null;

  return (
    <>
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
        onClick={onClose}
      >
        <m.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-lg shadow-brutalist max-w-2xl w-full my-8 border border-black/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
                <Link2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground font-display">Create Access Request</h2>
                <p className="text-sm text-muted-foreground">for {client.name}</p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              aria-label="Close modal"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          {/* Success state */}
          {success && createdRequest ? (
            <div className="p-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-coral/10 rounded-full mb-4">
                  <Clock className="h-8 w-8 text-danger-ink" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2 font-display">Pending — waiting on {client.name}</h3>
                <p className="text-muted-foreground">
                  Copy or email the link below. Connected when they finish Google.
                </p>
              </div>

              {/* Invite link */}
              <div className="bg-muted/10 border border-border rounded-lg p-4 mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Client Authorization Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink || ''}
                    className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground font-mono"
                  />
                  <Button
                    type="button"
                    onClick={copyLinkToClipboard}
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Copy Link
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Form */}
              <form onSubmit={handleSubmitWithQuotaCheck} className="max-h-[60vh] overflow-y-auto">
                {/* Client info (read-only) */}
                <div className="px-6 py-4 bg-muted/10 border-b border-border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2 font-medium text-foreground">{client.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <span className="ml-2 font-medium text-foreground">{client.email}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Company:</span>
                      <span className="ml-2 font-medium text-foreground">{client.company}</span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-b border-border">
                  <label
                    htmlFor="client-detail-external-reference"
                    className="block text-sm font-semibold text-foreground mb-1"
                  >
                    External Reference
                  </label>
                  <input
                    id="client-detail-external-reference"
                    type="text"
                    value={externalReference}
                    onChange={(event) => setExternalReference(event.target.value)}
                    maxLength={255}
                    placeholder="crm-123"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-coral"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional CRM or internal ID included in webhook payloads.
                  </p>
                </div>

                {/* Step 1: Platform Selection */}
                <div className="px-6 py-4 border-b border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      1. Select Platforms <span className="text-[rgb(var(--coral))]">*</span>
                    </h3>
                    {totalSelected > 0 && (
                      <m.span
                        key={totalSelected}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[rgb(var(--coral))]/10 text-[rgb(var(--coral))] border border-[rgb(var(--coral))]/20"
                      >
                        <Check className="h-3 w-3" />
                        {totalSelected} selected
                      </m.span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {Object.entries(PLATFORM_HIERARCHY).map(([groupKey, group]) => {
                      const isExpanded = expandedGroups[groupKey];
                      const products = group.products;
                      const selectionState = getGroupSelectionState(groupKey);
                      const selectedCount = selectedPlatforms[groupKey]?.length ?? 0;

                      return (
                        <div
                          key={groupKey}
                          className={cn(
                            'border rounded-xl overflow-hidden transition-all duration-200',
                            selectionState !== 'none'
                              ? 'border-[rgb(var(--coral))]/40 bg-[rgb(var(--coral))]/[0.03] shadow-sm'
                              : 'border-border bg-card hover:border-border/80'
                          )}
                        >
                          {/* Group header */}
                          <button
                            type="button"
                            onClick={() => toggleGroup(groupKey)}
                            className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left"
                            aria-expanded={isExpanded}
                          >
                            {/* Select-all checkbox */}
                            <button
                              type="button"
                              onClick={(e) => toggleGroupAll(groupKey, e)}
                              aria-label={`Select all ${group.name} products`}
                              className={cn(
                                'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-150',
                                selectionState === 'all'
                                  ? 'bg-[rgb(var(--coral))] border-[rgb(var(--coral))]'
                                  : selectionState === 'partial'
                                    ? 'bg-[rgb(var(--coral))]/20 border-[rgb(var(--coral))]'
                                    : 'bg-background border-border hover:border-[rgb(var(--coral))]/60'
                              )}
                            >
                              {selectionState === 'all' && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              {selectionState === 'partial' && <Minus className="h-3 w-3 text-[rgb(var(--coral))]" strokeWidth={3} />}
                            </button>

                            <PlatformIcon platform={groupKey as Platform} size="sm" />

                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-foreground text-sm">{group.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {selectedCount > 0
                                  ? `${selectedCount} of ${products.length} selected`
                                  : `${products.length} products`}
                              </span>
                            </div>

                            <ChevronDown
                              className={cn(
                                'h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
                                isExpanded && 'rotate-180'
                              )}
                            />
                          </button>

                          {/* Products (expanded) */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <m.div
                                key="products"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-3 pt-1 border-t border-border/50 grid grid-cols-2 gap-1">
                                  {products.map((product) => {
                                    const checked = isProductSelected(groupKey, product.id);
                                    return (
                                      <label
                                        key={product.id}
                                        className={cn(
                                          'flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-150 min-h-[44px]',
                                          checked
                                            ? 'bg-[rgb(var(--coral))]/8 text-foreground'
                                            : 'hover:bg-muted/40 text-foreground'
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150',
                                            checked
                                              ? 'bg-[rgb(var(--coral))] border-[rgb(var(--coral))]'
                                              : 'bg-background border-border'
                                          )}
                                        >
                                          {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                                        </div>
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleProduct(groupKey, product.id)}
                                          className="sr-only"
                                        />
                                        <PlatformIcon platform={product.id as Platform} size="sm" />
                                        <span className="text-sm font-medium leading-tight">{product.name}</span>
                                      </label>
                                    );
                                  })}
                                  {/* Google Ads account selector - show when google_ads is selected */}
                                  {groupKey === 'google' && isProductSelected('google', 'google_ads') && (
                                    <div className="col-span-2 mt-2 pt-2 border-t border-border/50 space-y-1.5">
                                      <label className="block text-xs font-medium text-foreground">
                                        Google Ads account
                                      </label>
                                      <SingleSelect
                                        value={googleAdsAccountId}
                                        onChange={(v) => setGoogleAdsAccountId(v)}
                                        options={adsAccounts.map((a: GoogleAdsAccount) => ({
                                          value: a.id,
                                          label: getGoogleAdsAccountLabel(a),
                                        }))}
                                        placeholder="Select account"
                                        disabled={adsAccounts.length === 0}
                                        ariaLabel="Select Google Ads account"
                                        className="w-full"
                                        triggerClassName="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm"
                                      />
                                      {adsAccounts.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                          Connect Google in Connections to see accounts.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </m.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>

                  {totalSelected === 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Click a platform to expand and select products, or use the checkbox to select all.
                    </p>
                  )}
                </div>

                {/* Step 2: Access Level */}
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-4">
                    2. Select Access Level <span className="text-danger-ink">*</span>
                  </h3>

                  <div className="space-y-3">
                    {(Object.keys(ACCESS_LEVEL_DESCRIPTIONS) as AccessLevel[]).map((level) => {
                      const info = ACCESS_LEVEL_DESCRIPTIONS[level];
                      return (
                        <label
                          key={level}
                          className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                            globalAccessLevel === level
                              ? 'border-primary bg-primary/10 ring-1 ring-primary'
                              : 'border-border hover:border-foreground/20'
                          }`}
                        >
                          <input
                            type="radio"
                            name="accessLevel"
                            value={level}
                            checked={globalAccessLevel === level}
                            onChange={(e) => setGlobalAccessLevel(e.target.value as AccessLevel)}
                            className="mt-0.5 w-4 h-4 text-primary border-border focus:ring-ring"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-foreground">{info.title}</div>
                            <div className="text-sm text-muted-foreground mt-1">{info.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Error message */}
                {errorMessage && (
                  <div className="mx-6 mb-4 p-3 bg-coral/10 border border-coral/40 rounded-lg">
                    <p className="text-sm text-danger-ink">{errorMessage}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10">
                  <Button
                    type="button"
                    onClick={onClose}
                    disabled={createMutation.isPending}
                    variant="secondary"
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || totalSelected === 0}
                    size="sm"
                    isLoading={createMutation.isPending}
                    leftIcon={!createMutation.isPending ? <Link2 className="h-4 w-4" /> : undefined}
                    className="disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create & Send Link'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </m.div>
      </m.div>
    </AnimatePresence>

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
  </>
  );
}
