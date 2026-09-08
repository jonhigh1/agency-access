import type { BillingInterval, SubscriptionTier } from '@agency-platform/shared';
import { PRICING_DISPLAY_TIER_DETAILS } from '@agency-platform/shared';
import {
  getIntervalFromProductId,
  getTierFromProductId,
} from '@/config/creem.config.js';
import { captureServerPosthogEvent } from '@/lib/posthog.js';

export type BillingPlanSlug = 'starter' | 'growth' | 'agency';
export type BillingPeriod = BillingInterval;

function toPlanSlug(tier: SubscriptionTier): BillingPlanSlug {
  return tier.toLowerCase() as BillingPlanSlug;
}

function getListPriceCents(plan: BillingPlanSlug, billingPeriod: BillingPeriod): number {
  const displayTier = plan.toUpperCase() as keyof typeof PRICING_DISPLAY_TIER_DETAILS;
  const details = PRICING_DISPLAY_TIER_DETAILS[displayTier];
  const dollars = billingPeriod === 'yearly' ? details.yearlyPrice : details.monthlyPrice;
  return dollars * 100;
}

function getMrrCents(plan: BillingPlanSlug, billingPeriod: BillingPeriod): number {
  const displayTier = plan.toUpperCase() as keyof typeof PRICING_DISPLAY_TIER_DETAILS;
  const details = PRICING_DISPLAY_TIER_DETAILS[displayTier];
  if (billingPeriod === 'monthly') {
    return details.monthlyPrice * 100;
  }
  return Math.round((details.yearlyPrice / 12) * 100);
}

function resolvePlanFromProductId(productId: string): {
  plan: BillingPlanSlug;
  billing_period: BillingPeriod;
  price_cents: number;
  mrr_cents: number;
  creem_product_id: string;
} {
  const tier = getTierFromProductId(productId);
  const billingPeriod = getIntervalFromProductId(productId);
  const plan = toPlanSlug(tier);

  return {
    plan,
    billing_period: billingPeriod,
    price_cents: getListPriceCents(plan, billingPeriod),
    mrr_cents: getMrrCents(plan, billingPeriod),
    creem_product_id: productId,
  };
}

type SubscriptionWebhookContext = {
  distinctId: string;
  agencyId: string;
  creemSubscriptionId: string;
  creemCustomerId: string;
  productId: string;
  status: string;
};

function baseProps(context: SubscriptionWebhookContext): Record<string, unknown> {
  const planProps = resolvePlanFromProductId(context.productId);
  return {
    agency_id: context.agencyId,
    ...planProps,
    creem_subscription_id: context.creemSubscriptionId,
    creem_customer_id: context.creemCustomerId,
    subscription_status: context.status,
  };
}

export async function trackSubscriptionLifecycleFromWebhook(input: {
  eventType: 'subscription.created' | 'subscription.updated' | 'subscription.canceled';
  context: SubscriptionWebhookContext;
}): Promise<void> {
  const props = baseProps(input.context);

  if (input.eventType === 'subscription.canceled') {
    await captureServerPosthogEvent({
      distinctId: input.context.distinctId,
      event: 'subscription_canceled',
      properties: props,
    });
    return;
  }

  if (input.eventType === 'subscription.updated') {
    await captureServerPosthogEvent({
      distinctId: input.context.distinctId,
      event: 'subscription_updated',
      properties: props,
    });
    return;
  }

  if (input.context.status === 'trialing') {
    await captureServerPosthogEvent({
      distinctId: input.context.distinctId,
      event: 'trial_started',
      properties: props,
    });
    return;
  }

  if (input.context.status === 'active') {
    await captureServerPosthogEvent({
      distinctId: input.context.distinctId,
      event: 'subscription_started',
      properties: props,
    });
  }
}
