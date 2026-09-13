'use client';

/**
 * ManageSubscriptionCard Component
 *
 * Allows users to upgrade/downgrade their subscription tier
 * and cancel their subscription with proration options.
 * Rendered as a settings group of rows; "Cancel Subscription" is the
 * group's one danger button.
 */

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Info,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useCreateCheckout, useSubscription, useUpgradeSubscription } from '@/lib/query/billing';
import { buildPlanSelectedProps, trackPlanSelected } from '@/lib/analytics/billing';
import {
  SUBSCRIPTION_TIER_DESCRIPTIONS,
  getPricingTierNameFromSubscriptionTier,
  type SubscriptionTier,
} from '@agency-platform/shared';
import { CancelSubscriptionModal } from './cancel-subscription-modal';
import { Button } from '@/components/ui/button';
import { SettingsGroup, SettingsRow } from '../settings-row';
import { readBillingIntervalPreference } from './billing-interval';
import { resolveBillingLifecycle } from './billing-lifecycle';
import { useTransientMessage } from '@/hooks/use-transient-message';

type ManageableTier = 'STARTER' | 'GROWTH' | 'SCALE';
type CurrentTier = 'FREE' | ManageableTier;

const MANAGEABLE_TIERS: ManageableTier[] = ['STARTER', 'GROWTH', 'SCALE'];
const TIER_RANK: Record<CurrentTier, number> = {
  FREE: -1,
  STARTER: 0,
  GROWTH: 1,
  SCALE: 2,
};

function normalizeCurrentTier(tier: SubscriptionTier | null | undefined): CurrentTier {
  // Default to STARTER for null/undefined (defensive coding for pre-launch)
  if (!tier) return 'STARTER';
  if (tier === 'STARTER' || tier === 'GROWTH' || tier === 'SCALE') return tier;
  // Legacy FREE tier maps to STARTER for UI
  if (tier === 'FREE') return 'STARTER';
  // Fallback for any other tier
  return 'STARTER';
}

export function ManageSubscriptionCard() {
  const { orgId, userId } = useAuth();
  const agencyId = orgId ?? userId ?? null;
  const { data: subscription, isLoading } = useSubscription();
  const upgradeMutation = useUpgradeSubscription();
  const createCheckoutMutation = useCreateCheckout();

  const [showTierSelector, setShowTierSelector] = useState(false);
  const [selectedTier, setSelectedTier] = useState<ManageableTier | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [updateBehavior, setUpdateBehavior] = useState<'immediate' | 'next-cycle'>('next-cycle');
  const [successMessage, showSuccessMessage, clearSuccessMessage] = useTransientMessage<string>();
  const [errorMessage, showErrorMessage, clearErrorMessage] = useTransientMessage<string>();

  const currentTier = normalizeCurrentTier(subscription?.tier);
  const lifecycle = resolveBillingLifecycle(subscription);
  const currentTierRank = TIER_RANK[currentTier];
  const isUpgrade = selectedTier ? TIER_RANK[selectedTier] > currentTierRank : false;
  const canCancelSubscription = !!subscription;
  const preferredInterval = readBillingIntervalPreference(lifecycle === 'PAID' ? 'monthly' : 'yearly');

  const handleTierChange = async () => {
    if (!selectedTier || selectedTier === currentTier) return;

    clearErrorMessage();
    clearSuccessMessage();

    try {
      if (currentTier === 'FREE') {
        trackPlanSelected({
          ...buildPlanSelectedProps(selectedTier, preferredInterval, 'checkout'),
          agency_id: agencyId,
        });

        const result = await createCheckoutMutation.mutateAsync({
          tier: selectedTier,
          billingInterval: preferredInterval,
          surface: 'checkout',
          successUrl: `${window.location.origin}/settings?tab=billing&checkout=success`,
          cancelUrl: `${window.location.origin}/settings?tab=billing&checkout=cancel`,
        });
        window.location.href = result.checkoutUrl;
        return;
      }

      await upgradeMutation.mutateAsync({
        newTier: selectedTier,
        updateBehavior,
      });

      showSuccessMessage(
        `Successfully ${isUpgrade ? 'upgraded' : 'downgraded'} to ${getPricingTierNameFromSubscriptionTier(selectedTier)}`
      );
      setShowTierSelector(false);
      setSelectedTier(null);

    } catch (error) {
      showErrorMessage(error instanceof Error ? error.message : 'Failed to update subscription');
    }
  };

  const getProrationExplanation = () => {
    if (updateBehavior === 'immediate') {
      return 'The prorated difference will be charged immediately, and your new billing cycle starts today.';
    }
    return 'The change will take effect at your next billing date. Any credit or charge will be applied to your next invoice.';
  };

  const isPending = upgradeMutation.isPending || createCheckoutMutation.isPending;

  const behaviorOptionClass = (active: boolean) =>
    `flex cursor-pointer items-start gap-3 border p-3 transition-colors duration-150 ${
      active ? 'border-coral bg-coral/10' : 'border-border hover:border-muted-foreground'
    }`;

  return (
    <div id="manage-subscription-card">
      <SettingsGroup title="Manage subscription" description="Upgrade, downgrade, or cancel your plan">
        {successMessage && (
          <SettingsRow label="Plan updated">
            <div className="flex items-start gap-2 border border-teal/30 bg-teal/10 p-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-ink" />
              <p className="text-sm text-success-ink">{successMessage}</p>
              <button
                type="button"
                onClick={clearSuccessMessage}
                aria-label="Dismiss"
                className="ml-auto p-1 transition-colors duration-150 hover:bg-teal/20"
              >
                <X className="h-4 w-4 text-success-ink" />
              </button>
            </div>
          </SettingsRow>
        )}

        {errorMessage && (
          <SettingsRow label="Update failed">
            <div className="flex items-start gap-2 border border-coral/30 bg-coral/10 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-ink" />
              <p className="text-sm text-danger-ink">{errorMessage}</p>
              <button
                type="button"
                onClick={clearErrorMessage}
                aria-label="Dismiss"
                className="ml-auto p-1 transition-colors duration-150 hover:bg-coral/20"
              >
                <X className="h-4 w-4 text-danger-ink" />
              </button>
            </div>
          </SettingsRow>
        )}

        {isLoading ? (
          <SettingsRow label="Change plan">
            <div aria-hidden="true" className="h-11 w-40 bg-muted animate-pulse" />
          </SettingsRow>
        ) : !showTierSelector ? (
          <SettingsRow
            label="Change plan"
            description="Change your subscription plan at any time. Prorated charges or credits will apply."
          >
            <Button variant="secondary" onClick={() => setShowTierSelector(true)}>
              <ArrowUp className="h-4 w-4" />
              Change Plan
            </Button>
          </SettingsRow>
        ) : (
          <>
            <SettingsRow label="Select new plan" description="Pick the tier you want to move to.">
              <div className="space-y-2">
                {MANAGEABLE_TIERS.map((tier) => {
                  const isSelected = selectedTier === tier;
                  const isCurrent = tier === currentTier;
                  const tierName = getPricingTierNameFromSubscriptionTier(tier);
                  const tierInfo = SUBSCRIPTION_TIER_DESCRIPTIONS[tier];
                  const isUpgradeOption = TIER_RANK[tier] > currentTierRank;
                  const isDowngradeOption = TIER_RANK[tier] < currentTierRank;

                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => !isCurrent && setSelectedTier(tier)}
                      disabled={isCurrent}
                      className={`w-full border p-3 text-left transition-colors duration-150 ${
                        isCurrent
                          ? 'cursor-not-allowed border-border bg-muted opacity-60'
                          : isSelected
                            ? isUpgradeOption
                              ? 'border-teal bg-teal/10'
                              : 'border-warning bg-warning/10'
                            : 'border-border bg-card hover:border-coral'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink">{tierName}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                Current
                              </span>
                            )}
                            {isUpgradeOption && !isCurrent && (
                              <span className="flex items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-xs text-success-ink">
                                <ArrowUp className="h-3 w-3" />
                                Upgrade
                              </span>
                            )}
                            {isDowngradeOption && !isCurrent && (
                              <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
                                <ArrowDown className="h-3 w-3" />
                                Downgrade
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">${tierInfo.price.monthly}/month</p>
                        </div>
                        {isSelected && (
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              isUpgradeOption ? 'border-teal' : 'border-warning'
                            }`}
                          >
                            <div className={`h-3 w-3 rounded-full ${isUpgradeOption ? 'bg-teal' : 'bg-warning'}`} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowTierSelector(false);
                    setSelectedTier(null);
                    clearErrorMessage();
                  }}
                >
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>
            </SettingsRow>

            {selectedTier && selectedTier !== currentTier && (
              <SettingsRow
                label="When should this change take effect?"
                description={
                  <span className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <strong className="text-ink">
                        {isUpgrade ? 'Upgrade' : 'Downgrade'} to {getPricingTierNameFromSubscriptionTier(selectedTier)}.
                      </strong>{' '}
                      {getProrationExplanation()}
                    </span>
                  </span>
                }
              >
                <div className="space-y-2">
                  <label className={behaviorOptionClass(updateBehavior === 'next-cycle')}>
                    <input
                      type="radio"
                      name="updateBehavior"
                      value="next-cycle"
                      checked={updateBehavior === 'next-cycle'}
                      onChange={(e) => setUpdateBehavior(e.target.value as 'immediate' | 'next-cycle')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-ink">Next billing cycle (Recommended)</p>
                      <p className="text-sm text-muted-foreground">
                        The change will take effect at your next billing date. Any credit or charge will be applied to your next invoice.
                      </p>
                    </div>
                  </label>
                  <label className={behaviorOptionClass(updateBehavior === 'immediate')}>
                    <input
                      type="radio"
                      name="updateBehavior"
                      value="immediate"
                      checked={updateBehavior === 'immediate'}
                      onChange={(e) => setUpdateBehavior(e.target.value as 'immediate' | 'next-cycle')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-ink">Immediately</p>
                      <p className="text-sm text-muted-foreground">
                        The prorated difference will be charged immediately, and your new billing cycle starts today.
                      </p>
                    </div>
                  </label>
                </div>
              </SettingsRow>
            )}

            {selectedTier && selectedTier !== currentTier && (
              <SettingsRow label="Confirm change">
                <div className="flex flex-wrap gap-3">
                  <Button variant="ghost" onClick={() => setSelectedTier(null)} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button variant="secondary" onClick={handleTierChange} disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : isUpgrade ? (
                      <>
                        <ArrowUp className="h-4 w-4" />
                        Upgrade Now
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-4 w-4" />
                        Downgrade Now
                      </>
                    )}
                  </Button>
                </div>
              </SettingsRow>
            )}
          </>
        )}

        {!isLoading && canCancelSubscription && (
          <SettingsRow
            label="Cancel subscription"
            description="Cancel at the end of the billing period or immediately. You can reactivate later."
          >
            <Button variant="danger" onClick={() => setShowCancelModal(true)}>
              Cancel Subscription
            </Button>
          </SettingsRow>
        )}
      </SettingsGroup>

      {/* Cancel Subscription Modal */}
      {subscription && (
        <CancelSubscriptionModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          currentTier={subscription.tier}
        />
      )}
    </div>
  );
}
