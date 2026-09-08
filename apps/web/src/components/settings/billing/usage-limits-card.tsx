'use client';

/**
 * Usage Limits Card
 *
 * Shows usage progress bars with upgrade nudges at 80%.
 */

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle, TrendingUp, Loader2 } from 'lucide-react';
import { getNextTierForCheckout } from '@agency-platform/shared';
import { useTierDetails, useCreateCheckout } from '@/lib/query/billing';
import { Button } from '@/components/ui/button';
import { buildPlanSelectedProps, trackPlanSelected } from '@/lib/analytics/billing';
import { readBillingIntervalPreference } from './billing-interval';

export function UsageLimitsCard() {
  const { orgId, userId } = useAuth();
  const agencyId = orgId ?? userId ?? null;
  const { data: tierDetails, isLoading } = useTierDetails();
  const createCheckout = useCreateCheckout();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (isLoading) {
    return (
      <section className="clean-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-coral/10 rounded-lg">
            <TrendingUp className="h-5 w-5 text-danger-ink" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Usage This Month</h2>
            <p className="text-sm text-muted-foreground">Track your plan usage</p>
          </div>
        </div>
        <div className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        </div>
      </section>
    );
  }

  const limits = tierDetails?.limits;
  const currentTier = tierDetails?.tier;
  const lifecycle = !currentTier
    ? 'FREE'
    : tierDetails?.status === 'trialing'
      ? 'TRIALING'
      : 'PAID';
  const preferredInterval = readBillingIntervalPreference(lifecycle === 'PAID' ? 'monthly' : 'yearly');

  const handleUpgrade = async () => {
    const nextTier = getNextTierForCheckout(currentTier ?? undefined);

    if (!nextTier) return;

    setErrorMessage(null);

    trackPlanSelected({
      ...buildPlanSelectedProps(nextTier, preferredInterval, 'checkout'),
      agency_id: agencyId,
    });

    try {
      const result = await createCheckout.mutateAsync({
        tier: nextTier,
        billingInterval: preferredInterval,
        surface: 'checkout',
        successUrl: `${window.location.origin}/settings?tab=billing&checkout=success`,
        cancelUrl: `${window.location.origin}/settings?tab=billing&checkout=cancel`,
      });
      if (result?.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      } else {
        setErrorMessage('Checkout session did not return a valid URL. Please try again.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
    }
  };

  const handleContactSales = () => {
    const supportLocalPart = 'support';
    const supportDomainPart = 'authhub.co';
    const at = String.fromCharCode(64); // '@'
    const email = `${supportLocalPart}${at}${supportDomainPart}`;
    const subject = encodeURIComponent('AuthHub Scale Expansion');
    window.location.href = `mailto:${email}?subject=${subject}`;
  };

  const renderProgressBar = (
    used: number,
    limit: number | 'unlimited',
    label: string
  ) => {
    const isUnlimited = limit === 'unlimited' || limit === -1;
    const numericLimit = isUnlimited ? 0 : (limit as number);
    const percentage = isUnlimited ? 0 : Math.min((used / numericLimit) * 100, 100);
    const isNearLimit = !isUnlimited && percentage >= 80;
    const isAtLimit = !isUnlimited && used >= numericLimit;

    return (
      <div key={label} className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground capitalize">{label}</span>
          <span
            className={`font-medium ${
              isAtLimit
                ? 'text-danger-ink'
                : isNearLimit
                  ? 'text-warning'
                  : 'text-ink'
            }`}
          >
            {isUnlimited ? 'Unlimited' : `${used} / ${numericLimit}`}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit
                ? 'bg-coral'
                : isNearLimit
                  ? 'bg-warning'
                  : 'bg-teal'
            }`}
            style={{ width: isUnlimited ? '0%' : `${percentage}%` }}
          />
        </div>
        {!isUnlimited && isNearLimit && (
          <p className={`text-xs ${isAtLimit ? 'text-danger-ink' : 'text-warning'}`}>
            {isAtLimit
              ? 'Limit reached. Upgrade to continue.'
              : `${numericLimit - used} remaining. Consider upgrading soon.`}
          </p>
        )}
      </div>
    );
  };

  const isAgencyTier = currentTier === 'AGENCY';
  const showUpgradeNudge =
    limits &&
    ((limits.accessRequests.limit !== 'unlimited' &&
      limits.accessRequests.used / (limits.accessRequests.limit as number) >= 0.8) ||
      (limits.clients.limit !== 'unlimited' &&
        limits.clients.used / (limits.clients.limit as number) >= 0.8));

  return (
    <section className="clean-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-coral/10 rounded-lg">
          <TrendingUp className="h-5 w-5 text-danger-ink" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">Usage This Month</h2>
          <p className="text-sm text-muted-foreground">Track your plan usage</p>
        </div>
      </div>

      {limits && (
        <div className="space-y-4">
          {renderProgressBar(
            limits.accessRequests.used,
            limits.accessRequests.limit,
            'access requests'
          )}
          {renderProgressBar(limits.clients.used, limits.clients.limit, 'clients')}
          {renderProgressBar(limits.members.used, limits.members.limit, 'team members')}
          {renderProgressBar(limits.templates.used, limits.templates.limit, 'templates')}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 p-3 bg-coral/10 border border-coral/20 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-ink">{errorMessage}</p>
        </div>
      )}

      {showUpgradeNudge && (
        <div className="mt-4 p-3 bg-coral/10 border border-coral/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">
                Running low on limits?
              </p>
              <p className="text-xs text-muted-foreground">
                Upgrade to get more capacity and unlock premium features.
              </p>
            </div>
            {isAgencyTier ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleContactSales}
              >
                Contact Sales
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpgrade}
                disabled={createCheckout.isPending}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Upgrade
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
