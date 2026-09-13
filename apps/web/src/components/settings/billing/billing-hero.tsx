'use client';

/**
 * Billing Hero
 *
 * The Billing tab's one ink-panel strip (plan, status, next bill or trial
 * end in mono) plus one row beneath it holding the lifecycle action as the
 * tab's single brutalist button. One shell across loading, error, and
 * loaded states — unloaded values render as "—" and the CTA is disabled.
 */

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useCreateCheckout, useOpenPortal, useSubscription } from '@/lib/query/billing';
import { Button } from '@/components/ui/button';
import { buildPlanSelectedProps, trackPlanSelected } from '@/lib/analytics/billing';
import { getNextTierForCheckout, SUBSCRIPTION_TIER_NAMES } from '@agency-platform/shared';
import { SettingsRow } from '../settings-row';
import { persistBillingIntervalPreference, readBillingIntervalPreference } from './billing-interval';
import { resolveBillingLifecycle } from './billing-lifecycle';

const EMPTY_VALUE = '—';

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  expired: 'Expired',
};

function formatLongDate(value: string | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function BillingHero() {
  const { orgId, userId } = useAuth();
  const agencyId = orgId ?? userId ?? null;
  const { data: subscription, isLoading } = useSubscription();
  const createCheckout = useCreateCheckout();
  const openPortal = useOpenPortal();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lifecycle = resolveBillingLifecycle(subscription);
  const defaultInterval = lifecycle === 'PAID' ? 'monthly' : 'yearly';
  const billingInterval = useMemo(() => readBillingIntervalPreference(defaultInterval), [defaultInterval]);

  const startCheckout = async (tier: 'STARTER' | 'GROWTH' | 'SCALE', surface: string) => {
    setErrorMessage(null);

    persistBillingIntervalPreference(billingInterval);

    trackPlanSelected({
      ...buildPlanSelectedProps(tier, billingInterval, 'checkout'),
      agency_id: agencyId,
    });

    try {
      const result = await createCheckout.mutateAsync({
        tier,
        billingInterval,
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
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create checkout session');
    }
  };

  const openBillingPortal = async () => {
    setErrorMessage(null);

    try {
      const result = await openPortal.mutateAsync(window.location.href);
      window.location.href = result.portalUrl;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to open billing portal');
    }
  };

  const focusManageSubscription = () => {
    document.getElementById('manage-subscription-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const trialEndDate = formatLongDate(subscription?.trialEnd);
  const nextBillDate = formatLongDate(subscription?.currentPeriodEnd);

  const heroCopy =
    lifecycle === 'FREE'
      ? {
          title: 'Unlock Growth with a Free Trial',
          description: 'Start your 14-day Growth trial and convert more clients without billing friction.',
          buttonLabel: 'Start Free Trial',
          onClick: () => startCheckout('STARTER', 'billing_hero_free'),
        }
      : lifecycle === 'TRIALING'
        ? {
            title: 'Keep Your Trial Momentum',
            description: trialEndDate
              ? `Your trial ends on ${trialEndDate}. Activate your paid plan to keep all features live.`
              : 'Activate your paid plan now to keep your trial features without interruption.',
            buttonLabel: 'Activate Paid Plan',
            onClick: () => startCheckout(subscription?.tier === 'SCALE' ? 'SCALE' : 'STARTER', 'billing_hero_trialing'),
          }
        : subscription?.status === 'past_due'
          ? {
              title: 'Resolve Billing to Avoid Access Issues',
              description: 'Update your payment details in the billing portal to keep your plan active.',
              buttonLabel: 'Manage in Billing Portal',
              onClick: openBillingPortal,
            }
          : {
              title: 'Scale When You’re Ready',
              description: (() => {
              const nextTier = getNextTierForCheckout(subscription?.tier);
              const hasCheckout = !!nextTier;
              return hasCheckout
                ? 'Upgrade to the next tier for more capacity and premium features.'
                : 'Review upgrade options and increase limits as your agency grows.';
            })(),
              buttonLabel: (() => {
              const nextTier = getNextTierForCheckout(subscription?.tier);
              return nextTier ? 'Upgrade' : 'Review Upgrade Options';
            })(),
              onClick: (() => {
              const nextTier = getNextTierForCheckout(subscription?.tier);
              return nextTier
                ? () => startCheckout(nextTier as 'STARTER' | 'GROWTH' | 'SCALE', 'billing_hero_paid')
                : focusManageSubscription;
            })(),
            };

  // Panel values: "—" until the subscription has loaded (KTD4).
  const planName = isLoading
    ? EMPTY_VALUE
    : subscription?.tier
      ? SUBSCRIPTION_TIER_NAMES[subscription.tier]
      : 'Free';
  const statusLabel = isLoading
    ? EMPTY_VALUE
    : subscription
      ? STATUS_LABELS[subscription.status] ?? subscription.status
      : 'No subscription';
  const dateLabel = lifecycle === 'TRIALING' ? 'Trial ends' : 'Next bill';
  const dateValue = isLoading ? EMPTY_VALUE : (lifecycle === 'TRIALING' ? trialEndDate : nextBillDate) ?? EMPTY_VALUE;

  const isPending = createCheckout.isPending || openPortal.isPending;

  return (
    <div>
      <div className="ink-panel p-6">
        <span className="label-micro">Subscription</span>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="label-nano">Plan</dt>
            <dd className="mt-1 text-lg font-semibold [overflow-wrap:anywhere]">{planName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="label-nano">Status</dt>
            <dd className="mt-1 text-lg font-semibold [overflow-wrap:anywhere]">{statusLabel}</dd>
          </div>
          <div className="min-w-0">
            <dt className="label-nano">{dateLabel}</dt>
            <dd className="mt-1 text-lg font-semibold [overflow-wrap:anywhere]">{dateValue}</dd>
          </div>
        </dl>
      </div>

      <SettingsRow
        label={isLoading ? 'Plan actions' : heroCopy.title}
        description={isLoading ? 'Loading your subscription.' : heroCopy.description}
      >
        <div className="flex flex-col items-start gap-3 md:items-end">
          <Button
            variant="brutalist"
            onClick={heroCopy.onClick}
            disabled={isLoading || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {isLoading ? 'Loading' : heroCopy.buttonLabel}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {errorMessage && (
            <p className="flex items-start gap-1 text-sm text-danger-ink">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}
        </div>
      </SettingsRow>
    </div>
  );
}
