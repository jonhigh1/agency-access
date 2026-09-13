'use client';

/**
 * Usage Limits
 *
 * One row per metric with a square progress bar, plus an upgrade nudge row
 * at 80% of any limit.
 */

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { getNextTierForCheckout } from '@agency-platform/shared';
import { useTierDetails, useCreateCheckout } from '@/lib/query/billing';
import { Button } from '@/components/ui/button';
import { buildPlanSelectedProps, trackPlanSelected } from '@/lib/analytics/billing';
import { SettingsGroup, SettingsRow } from '../settings-row';
import { readBillingIntervalPreference } from './billing-interval';

const USAGE_ROWS = ['access requests', 'clients', 'team members', 'templates'] as const;

export function UsageLimitsCard() {
  const { orgId, userId } = useAuth();
  const agencyId = orgId ?? userId ?? null;
  const { data: tierDetails, isLoading } = useTierDetails();
  const createCheckout = useCreateCheckout();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const renderUsageRow = (
    used: number,
    limit: number | 'unlimited',
    label: string
  ) => {
    const isUnlimited = limit === 'unlimited' || limit === -1;
    const numericLimit = isUnlimited ? 0 : (limit as number);
    const percentage = isUnlimited ? 0 : Math.min((used / numericLimit) * 100, 100);
    const isNearLimit = !isUnlimited && percentage >= 80;
    const isAtLimit = !isUnlimited && used >= numericLimit;

    const note = !isUnlimited && isNearLimit
      ? isAtLimit
        ? 'Limit reached. Upgrade to continue.'
        : `${numericLimit - used} remaining. Consider upgrading soon.`
      : undefined;

    return (
      <SettingsRow
        key={label}
        label={label.charAt(0).toUpperCase() + label.slice(1)}
        description={
          note ? <span className={isAtLimit ? 'text-danger-ink' : 'text-warning'}>{note}</span> : undefined
        }
      >
        <div className="space-y-2">
          <p
            className={`font-mono text-sm font-medium ${
              isAtLimit ? 'text-danger-ink' : isNearLimit ? 'text-warning' : 'text-ink'
            }`}
          >
            {isUnlimited ? 'Unlimited' : `${used} / ${numericLimit}`}
          </p>
          <div className="h-2 w-full overflow-hidden bg-muted">
            <div
              className={`h-full ${isAtLimit ? 'bg-coral' : isNearLimit ? 'bg-warning' : 'bg-teal'}`}
              style={{ width: isUnlimited ? '0%' : `${percentage}%` }}
            />
          </div>
        </div>
      </SettingsRow>
    );
  };

  const isScaleTier = currentTier === 'SCALE';
  const showUpgradeNudge =
    limits &&
    ((limits.accessRequests.limit !== 'unlimited' &&
      limits.accessRequests.used / (limits.accessRequests.limit as number) >= 0.8) ||
      (limits.clients.limit !== 'unlimited' &&
        limits.clients.used / (limits.clients.limit as number) >= 0.8));

  return (
    <SettingsGroup title="Usage this month" description="Track your plan usage">
      {isLoading &&
        USAGE_ROWS.map((label) => (
          <SettingsRow key={label} label={label.charAt(0).toUpperCase() + label.slice(1)}>
            <div className="space-y-2">
              <div aria-hidden="true" className="h-5 w-20 bg-muted animate-pulse" />
              <div aria-hidden="true" className="h-2 w-full bg-muted animate-pulse" />
            </div>
          </SettingsRow>
        ))}

      {!isLoading && limits && (
        <>
          {renderUsageRow(limits.accessRequests.used, limits.accessRequests.limit, 'access requests')}
          {renderUsageRow(limits.clients.used, limits.clients.limit, 'clients')}
          {renderUsageRow(limits.members.used, limits.members.limit, 'team members')}
          {renderUsageRow(limits.templates.used, limits.templates.limit, 'templates')}
        </>
      )}

      {errorMessage && (
        <SettingsRow label="Checkout error">
          <p className="flex items-start gap-2 text-sm text-danger-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </p>
        </SettingsRow>
      )}

      {showUpgradeNudge && (
        <SettingsRow
          label="Running low on limits?"
          description="Upgrade to get more capacity and unlock premium features."
        >
          {isScaleTier ? (
            <Button variant="secondary" size="sm" onClick={handleContactSales}>
              Contact Sales
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUpgrade}
              disabled={createCheckout.isPending}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Upgrade
            </Button>
          )}
        </SettingsRow>
      )}
    </SettingsGroup>
  );
}
