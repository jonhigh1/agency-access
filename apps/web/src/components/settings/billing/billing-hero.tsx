'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useCreateCheckout, useOpenPortal, useSubscription } from '@/lib/query/billing';
import { Button } from '@/components/ui/button';
import { buildPlanSelectedProps, trackPlanSelected } from '@/lib/analytics/billing';
import { getNextTierForCheckout } from '@agency-platform/shared';
import { persistBillingIntervalPreference, readBillingIntervalPreference } from './billing-interval';
import { resolveBillingLifecycle } from './billing-lifecycle';

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

  if (isLoading) {
    return (
      <section className="clean-card p-6">
        <div className="py-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        </div>
      </section>
    );
  }

  const trialEndDate = subscription?.trialEnd
    ? new Date(subscription.trialEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

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

  return (
    <section className="clean-card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{heroCopy.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{heroCopy.description}</p>
        </div>

        <Button
          variant="primary"
          onClick={heroCopy.onClick}
          disabled={createCheckout.isPending || openPortal.isPending}
        >
          {createCheckout.isPending || openPortal.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {heroCopy.buttonLabel}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-lg border border-coral/20 bg-coral/10 p-3 text-sm text-danger-ink">
          <AlertCircle className="mr-1 inline h-4 w-4" />
          {errorMessage}
        </div>
      )}
    </section>
  );
}
