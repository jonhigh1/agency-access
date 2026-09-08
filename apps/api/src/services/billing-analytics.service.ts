import type { BillingInterval, SubscriptionTier } from '@agency-platform/shared';
import { PRICING_DISPLAY_TIER_DETAILS } from '@agency-platform/shared';
import {
  getIntervalFromProductId,
  getTierFromProductId,
} from '@/config/creem.config.js';
import { captureServerPosthogEvent } from '@/lib/posthog.js';

export type BillingPlanSlug = 'starter' | 'growth' | 'agency';
export type BillingPeriod = BillingInterval;

/** Creem webhook subscription.status values handled for lifecycle analytics. */
export type CreemSubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

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

/**
 * Creem webhooks expose `price_id`; in AuthHub this value is the Creem product id
 * (see getTierFromProductId). Both creem_price_id and creem_product_id are set from
 * the webhook field for HogQL joins — never Stripe IDs.
 */
function resolvePlanFromCreemPriceId(creemPriceId: string): {
  plan: BillingPlanSlug;
  billing_period: BillingPeriod;
  price_cents: number;
  mrr_cents: number;
  creem_price_id: string;
  creem_product_id: string;
} {
  const tier = getTierFromProductId(creemPriceId);
  const billingPeriod = getIntervalFromProductId(creemPriceId);
  const plan = toPlanSlug(tier);

  return {
    plan,
    billing_period: billingPeriod,
    price_cents: getListPriceCents(plan, billingPeriod),
    mrr_cents: getMrrCents(plan, billingPeriod),
    creem_price_id: creemPriceId,
    creem_product_id: creemPriceId,
  };
}

export type SubscriptionWebhookContext = {
  distinctId: string;
  agencyId: string;
  creemSubscriptionId: string;
  creemCustomerId: string;
  /** Raw Creem webhook `price_id` (product id in our integration). */
  creemPriceId: string;
  status: CreemSubscriptionStatus | string;
};

function lifecycleProps(context: SubscriptionWebhookContext): Record<string, unknown> {
  const planProps = resolvePlanFromCreemPriceId(context.creemPriceId);
  return {
    agency_id: context.agencyId,
    ...planProps,
    creem_subscription_id: context.creemSubscriptionId,
    creem_customer_id: context.creemCustomerId,
    subscription_status: context.status,
  };
}

async function captureLifecycleEvent(
  context: SubscriptionWebhookContext,
  event: string
): Promise<void> {
  await captureServerPosthogEvent({
    distinctId: context.distinctId,
    event,
    properties: lifecycleProps(context),
  });
}

/**
 * Maps Creem webhook events to Growth lifecycle captures.
 *
 * Primary checkout completion: `subscription_started` (not checkout_completed).
 * Status lifecycle (server): subscription.active | subscription.past_due | subscription.canceled
 */
export async function trackSubscriptionLifecycleFromWebhook(input: {
  eventType: 'subscription.created' | 'subscription.updated' | 'subscription.canceled';
  context: SubscriptionWebhookContext;
}): Promise<void> {
  const { eventType, context } = input;
  const status = context.status;

  if (eventType === 'subscription.canceled' || status === 'canceled') {
    await captureLifecycleEvent(context, 'subscription.canceled');
    return;
  }

  if (status === 'past_due') {
    await captureLifecycleEvent(context, 'subscription.past_due');
    return;
  }

  if (status === 'trialing') {
    await captureLifecycleEvent(context, 'trial_started');
    return;
  }

  if (status === 'active') {
    if (eventType === 'subscription.created') {
      // checkout.completed equivalent — primary conversion event
      await captureLifecycleEvent(context, 'subscription_started');
      return;
    }

    await captureLifecycleEvent(context, 'subscription.active');
  }
}
