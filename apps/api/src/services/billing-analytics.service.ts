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
 * Creem webhooks expose product ids via product.id, price_id, or nested product fields.
 * Both creem_price_id and creem_product_id are set from the resolved product id for HogQL joins.
 */
function resolvePlanFromCreemProductId(creemProductId: string): {
  plan: BillingPlanSlug;
  billing_period: BillingPeriod;
  price_cents: number;
  mrr_cents: number;
  creem_price_id: string;
  creem_product_id: string;
} {
  const tier = getTierFromProductId(creemProductId);
  const billingPeriod = getIntervalFromProductId(creemProductId);
  const plan = toPlanSlug(tier);

  return {
    plan,
    billing_period: billingPeriod,
    price_cents: getListPriceCents(plan, billingPeriod),
    mrr_cents: getMrrCents(plan, billingPeriod),
    creem_price_id: creemProductId,
    creem_product_id: creemProductId,
  };
}

export type SubscriptionWebhookContext = {
  distinctId: string;
  agencyId: string;
  creemSubscriptionId: string | null;
  creemCustomerId: string | null;
  creemProductId: string | null;
  status: CreemSubscriptionStatus | string;
};

function lifecycleProps(context: SubscriptionWebhookContext): Record<string, unknown> {
  const base: Record<string, unknown> = {
    agency_id: context.agencyId,
    creem_subscription_id: context.creemSubscriptionId,
    creem_customer_id: context.creemCustomerId,
    creem_product_id: context.creemProductId,
    subscription_status: context.status,
  };

  if (!context.creemProductId) {
    return base;
  }

  const planProps = resolvePlanFromCreemProductId(context.creemProductId);
  return {
    ...base,
    ...planProps,
    creem_product_id: context.creemProductId,
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
 * Primary checkout completion: `subscription_started` (checkout.completed / subscription.active).
 * Status lifecycle (server): subscription.active | subscription.past_due | subscription.canceled
 */
export type CreemLifecycleWebhookEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.active'
  | 'subscription.trialing'
  | 'subscription.past_due'
  | 'subscription.update'
  | 'checkout.completed';

function isPrimaryConversionEvent(eventType: CreemLifecycleWebhookEventType): boolean {
  return (
    eventType === 'checkout.completed' ||
    eventType === 'subscription.active' ||
    eventType === 'subscription.created'
  );
}

function isSubscriptionUpdateEvent(eventType: CreemLifecycleWebhookEventType): boolean {
  return eventType === 'subscription.update' || eventType === 'subscription.updated';
}

export async function trackSubscriptionLifecycleFromWebhook(input: {
  eventType: CreemLifecycleWebhookEventType;
  context: SubscriptionWebhookContext;
}): Promise<void> {
  const { eventType, context } = input;
  const status = context.status;

  if (eventType === 'subscription.canceled' || status === 'canceled') {
    await captureLifecycleEvent(context, 'subscription.canceled');
    return;
  }

  if (eventType === 'subscription.past_due' || status === 'past_due') {
    await captureLifecycleEvent(context, 'subscription.past_due');
    return;
  }

  if (eventType === 'subscription.trialing' || status === 'trialing') {
    await captureLifecycleEvent(context, 'trial_started');
    return;
  }

  if (status === 'active') {
    if (isPrimaryConversionEvent(eventType)) {
      await captureLifecycleEvent(context, 'subscription_started');
      return;
    }

    if (isSubscriptionUpdateEvent(eventType)) {
      await captureLifecycleEvent(context, 'subscription.active');
    }
  }
}
