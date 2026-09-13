'use client';

/**
 * Current Plan
 *
 * Rows for the current subscription tier, price, next billing date, and the
 * billing-portal link. Flat rows on the page ground — no card, no shadow.
 */

import { AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useSubscription, useOpenPortal } from '@/lib/query/billing';
import type { SubscriptionTier } from '@agency-platform/shared';
import { PRICING_DISPLAY_TIER_DETAILS, SUBSCRIPTION_TIER_NAMES, TIER_LIMITS } from '@agency-platform/shared';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { SettingsGroup, SettingsRow } from '../settings-row';

function formatMonthlyPrice(tier: SubscriptionTier | null): string {
  if (!tier) return 'Free';
  const limits = TIER_LIMITS[tier];
  if (!limits) return 'Free';
  return `$${limits.priceMonthly}`;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`bg-muted animate-pulse ${className}`} />;
}

export function CurrentPlanCard() {
  const { data: subscription, isLoading } = useSubscription();
  const openPortal = useOpenPortal();

  const handleManageSubscription = async () => {
    const result = await openPortal.mutateAsync(window.location.href);
    window.location.href = result.portalUrl;
  };

  const currentTier: SubscriptionTier | null = subscription?.tier ?? null;
  const tierName = currentTier ? SUBSCRIPTION_TIER_NAMES[currentTier] : 'Free';
  const monthlyPrice = formatMonthlyPrice(currentTier);

  const getStatusBadge = () => {
    if (!subscription) return null;

    const badges: Record<string, React.ReactNode> = {
      active: <StatusBadge status="active" />,
      past_due: <StatusBadge status="past_due" />,
      canceled: <StatusBadge status="cancelled" />,
    };

    return (
      badges[subscription.status] || (
        <StatusBadge badgeVariant="default">{subscription.status}</StatusBadge>
      )
    );
  };

  const nextBilling = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  return (
    <SettingsGroup title="Current plan" description="Your subscription details" aside={isLoading ? null : getStatusBadge()}>
      <SettingsRow
        label="Plan"
        description={
          isLoading
            ? undefined
            : currentTier
              ? PRICING_DISPLAY_TIER_DETAILS[currentTier].description
              : 'Try before you commit'
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">{tierName} Plan</h3>
            <p className="font-mono text-sm text-ink">
              <span className="text-lg font-semibold">{monthlyPrice}</span>
              <span className="text-muted-foreground"> {!currentTier ? 'forever' : '/month'}</span>
            </p>
          </div>
        )}
      </SettingsRow>

      {subscription?.cancelAtPeriodEnd && (
        <SettingsRow label="Scheduled change">
          <p className="flex items-start gap-2 border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Your subscription will cancel at the end of the current billing period.</span>
          </p>
        </SettingsRow>
      )}

      <SettingsRow label="Next billing" description="The date your next invoice is issued.">
        {isLoading ? <Skeleton className="h-5 w-32" /> : <p className="font-mono text-sm text-ink">{nextBilling}</p>}
      </SettingsRow>

      <SettingsRow label="Billing portal" description="Update payment details, view invoices, and manage your plan.">
        <Button
          variant="secondary"
          onClick={handleManageSubscription}
          disabled={openPortal.isPending || !subscription}
        >
          {openPortal.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening...
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4" />
              Manage in Billing Portal
            </>
          )}
        </Button>
      </SettingsRow>
    </SettingsGroup>
  );
}
