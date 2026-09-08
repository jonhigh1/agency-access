'use client';

/**
 * Billing Tab
 *
 * Orchestrates all billing-related cards:
 * - Current plan with status
 * - Manage subscription (upgrade/downgrade/cancel)
 * - Usage limits with progress bars
 * - Plan comparison for upgrades
 * - Payment methods
 * - Invoices history
 * - Billing details form
 */

import { useAuth } from '@clerk/nextjs';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useSubscription } from '@/lib/query/billing';
import {
  buildSubscriptionStartedProps,
  subscriptionTierToPlanSlug,
  trackBillingCheckoutFailed,
  trackPricingViewed,
  trackSubscriptionStarted,
  trackTrialStarted,
} from '@/lib/analytics/billing';
import { readBillingIntervalPreference } from './billing-interval';
import { BillingHero } from './billing-hero';
import { resolveBillingLifecycle } from './billing-lifecycle';
import { CurrentPlanCard } from './current-plan-card';
import { ManageSubscriptionCard } from './manage-subscription-card';
import { UsageLimitsCard } from './usage-limits-card';
import { PlanComparison } from './plan-comparison';
import { PaymentMethodsCard } from './payment-methods-card';
import { InvoicesCard } from './invoices-card';
import { BillingDetailsCard } from './billing-details-card';
import { CheckoutSuccessToast } from './checkout-success-toast';

export function BillingTab() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get('checkout');
  const { orgId, userId } = useAuth();
  const agencyId = orgId ?? userId ?? null;
  const { data: subscription } = useSubscription();
  const lifecycle = resolveBillingLifecycle(subscription);
  const isBillingV2Enabled = process.env.NEXT_PUBLIC_BILLING_V2_ENABLED !== 'false';
  const billingPath = `${pathname}?tab=billing`;

  useEffect(() => {
    trackPricingViewed({
      path: billingPath,
      billing_period: readBillingIntervalPreference(lifecycle === 'PAID' ? 'monthly' : 'yearly'),
      agency_id: agencyId,
    });
  }, [agencyId, billingPath, lifecycle]);

  useEffect(() => {
    if (!checkoutStatus || !subscription?.tier) {
      return;
    }

    const billingPeriod = readBillingIntervalPreference(lifecycle === 'PAID' ? 'monthly' : 'yearly');
    const baseProps = buildSubscriptionStartedProps(subscription.tier, billingPeriod, {
      agency_id: agencyId,
      surface: 'checkout',
    });

    if (checkoutStatus === 'success') {
      if (subscription.status === 'trialing') {
        trackTrialStarted(baseProps);
      } else {
        trackSubscriptionStarted(baseProps);
      }
      return;
    }

    if (checkoutStatus === 'cancel') {
      trackBillingCheckoutFailed({
        agency_id: agencyId,
        plan: subscriptionTierToPlanSlug(subscription.tier),
        billing_period: billingPeriod,
        surface: 'checkout',
        reason: 'user_cancelled',
      });
    }
  }, [agencyId, checkoutStatus, lifecycle, subscription?.status, subscription?.tier]);

  if (!isBillingV2Enabled) {
    return (
      <>
        {checkoutStatus === 'success' && <CheckoutSuccessToast />}

        <div className="space-y-6">
          <CurrentPlanCard />
          <ManageSubscriptionCard />
          <UsageLimitsCard />
          <PlanComparison />
          <PaymentMethodsCard />
          <InvoicesCard />
          <BillingDetailsCard />
        </div>
      </>
    );
  }

  const showFreeOrTrialLayout = lifecycle === 'FREE' || lifecycle === 'TRIALING';

  return (
    <>
      {checkoutStatus === 'success' && <CheckoutSuccessToast />}

      <div className="space-y-6">
        <BillingHero />
        {showFreeOrTrialLayout ? (
          <>
            <PlanComparison />
            <UsageLimitsCard />
          </>
        ) : (
          <>
            <CurrentPlanCard />
            <UsageLimitsCard />
            <ManageSubscriptionCard />
            <PaymentMethodsCard />
            <InvoicesCard />
            <BillingDetailsCard />
          </>
        )}
      </div>
    </>
  );
}
