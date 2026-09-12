import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import type {
  BillingInterval,
  PricingDisplayTier,
  SubscriptionTier,
} from '@agency-platform/shared';
import {
  PRICING_DISPLAY_TIER_DETAILS,
  PRICING_DISPLAY_TIER_TO_SUBSCRIPTION_TIER,
  getPricingDisplayTierFromSubscriptionTier,
} from '@agency-platform/shared';

export type BillingPlanSlug = 'starter' | 'growth' | 'scale';
export type BillingPeriod = BillingInterval;
export type BillingSurface = 'pricing' | 'compare' | 'checkout';

/**
 * Creem product IDs — must stay in sync with apps/api/src/config/creem.config.ts.
 * Growth maps these as `creem_product_id` (Creem uses product IDs, not Stripe price IDs).
 */
const CREEM_PRODUCT_IDS: Record<SubscriptionTier, Record<BillingPeriod, string>> = {
  STARTER: {
    monthly: 'prod_4SUPfON3XwTo5SKOJzN2dH',
    yearly: 'prod_6Hyydvn6jh0numRxJecMol',
  },
  GROWTH: {
    monthly: 'prod_11NeEMY6WtGEkdnvdd7obj',
    yearly: 'prod_4vNvJn99RTRwhkMeHgkBT7',
  },
  SCALE: {
    monthly: 'prod_5FEs6qBlwvbMWHHun95wkk',
    yearly: 'prod_6w78r7ZbTUjkJl7mTkNfFr',
  },
};

type AgencyJoinProps = {
  agency_id?: string | null;
};

export type PricingViewedProps = AgencyJoinProps & {
  path: string;
  billing_period?: BillingPeriod | null;
};

export type PlanSelectedProps = AgencyJoinProps & {
  plan: BillingPlanSlug;
  billing_period: BillingPeriod;
  price_cents: number;
  surface: BillingSurface;
  creem_product_id?: string;
  creem_price_id?: string;
};

export type BillingCheckoutStartedProps = AgencyJoinProps &
  Omit<PlanSelectedProps, 'surface'> & {
    surface: BillingSurface;
  };

export type SubscriptionStartedProps = AgencyJoinProps & {
  plan: BillingPlanSlug;
  billing_period: BillingPeriod;
  price_cents: number;
  mrr_cents: number;
  creem_subscription_id?: string | null;
  creem_customer_id?: string | null;
  surface?: BillingSurface;
};

export type BillingCheckoutFailedProps = AgencyJoinProps & {
  plan?: BillingPlanSlug | null;
  billing_period?: BillingPeriod | null;
  surface?: BillingSurface;
  reason: string;
};

export type TrialStartedProps = AgencyJoinProps &
  Pick<SubscriptionStartedProps, 'plan' | 'billing_period' | 'price_cents' | 'mrr_cents'> & {
    creem_subscription_id?: string | null;
    creem_customer_id?: string | null;
  };

export type CapHitProps = AgencyJoinProps & {
  plan: BillingPlanSlug;
  clients_used: number;
  plan_cap: number;
};

function captureBillingEvent(eventName: string, properties: Record<string, unknown>): void {
  void capturePosthogEvent(eventName, properties);
}

export function toPlanSlug(tier: SubscriptionTier | PricingDisplayTier): BillingPlanSlug {
  const normalized = tier.toLowerCase();
  if (normalized === 'starter' || normalized === 'growth' || normalized === 'scale') {
    return normalized;
  }
  return 'starter';
}

export function subscriptionTierToPlanSlug(
  tier: SubscriptionTier | null | undefined
): BillingPlanSlug {
  if (!tier) return 'starter';
  return toPlanSlug(getPricingDisplayTierFromSubscriptionTier(tier));
}

export function getListPriceCents(plan: BillingPlanSlug, billingPeriod: BillingPeriod): number {
  const displayTier = plan.toUpperCase() as PricingDisplayTier;
  const details = PRICING_DISPLAY_TIER_DETAILS[displayTier];
  const dollars = billingPeriod === 'yearly' ? details.yearlyPrice : details.monthlyPrice;
  return dollars * 100;
}

export function getMrrCents(plan: BillingPlanSlug, billingPeriod: BillingPeriod): number {
  const displayTier = plan.toUpperCase() as PricingDisplayTier;
  const details = PRICING_DISPLAY_TIER_DETAILS[displayTier];
  if (billingPeriod === 'monthly') {
    return details.monthlyPrice * 100;
  }
  return Math.round((details.yearlyPrice / 12) * 100);
}

export function getCreemProductId(
  tier: SubscriptionTier | PricingDisplayTier,
  billingPeriod: BillingPeriod
): string {
  const subscriptionTier =
    tier in PRICING_DISPLAY_TIER_TO_SUBSCRIPTION_TIER
      ? (PRICING_DISPLAY_TIER_TO_SUBSCRIPTION_TIER[tier as PricingDisplayTier] as SubscriptionTier)
      : (tier as SubscriptionTier);
  return CREEM_PRODUCT_IDS[subscriptionTier][billingPeriod];
}

/** Creem checkout uses product ids; webhook field is `price_id` — same value in our integration. */
export function getCreemPriceId(
  tier: SubscriptionTier | PricingDisplayTier,
  billingPeriod: BillingPeriod
): string {
  return getCreemProductId(tier, billingPeriod);
}

export function buildPlanSelectedProps(
  tier: SubscriptionTier | PricingDisplayTier,
  billingPeriod: BillingPeriod,
  surface: BillingSurface
): Omit<PlanSelectedProps, 'agency_id'> {
  const plan = toPlanSlug(tier);
  const creemId = getCreemProductId(tier, billingPeriod);
  return {
    plan,
    billing_period: billingPeriod,
    price_cents: getListPriceCents(plan, billingPeriod),
    surface,
    creem_product_id: creemId,
    creem_price_id: creemId,
  };
}

export function buildCheckoutStartedProps(
  tier: SubscriptionTier | PricingDisplayTier,
  billingPeriod: BillingPeriod,
  surface: BillingSurface
): Omit<BillingCheckoutStartedProps, 'agency_id'> {
  return buildPlanSelectedProps(tier, billingPeriod, surface);
}

export function buildSubscriptionStartedProps(
  tier: SubscriptionTier | PricingDisplayTier,
  billingPeriod: BillingPeriod,
  extras?: Partial<SubscriptionStartedProps>
): Omit<SubscriptionStartedProps, 'agency_id'> {
  const plan = toPlanSlug(tier);
  return {
    plan,
    billing_period: billingPeriod,
    price_cents: getListPriceCents(plan, billingPeriod),
    mrr_cents: getMrrCents(plan, billingPeriod),
    ...extras,
  };
}

export function trackPricingViewed(properties: PricingViewedProps): void {
  captureBillingEvent('pricing_viewed', properties);
}

export function trackPlanSelected(properties: PlanSelectedProps): void {
  captureBillingEvent('plan_selected', properties);
}

export function trackBillingCheckoutStarted(properties: BillingCheckoutStartedProps): void {
  captureBillingEvent('billing_checkout_started', properties);
}

/** Primary checkout completion event (chosen over checkout_completed for HogQL baseline). */
export function trackSubscriptionStarted(properties: SubscriptionStartedProps): void {
  captureBillingEvent('subscription_started', properties);
}

export function trackBillingCheckoutFailed(properties: BillingCheckoutFailedProps): void {
  captureBillingEvent('billing_checkout_failed', properties);
}

export function trackTrialStarted(properties: TrialStartedProps): void {
  captureBillingEvent('trial_started', properties);
}

export function trackCapHit(properties: CapHitProps): void {
  captureBillingEvent('cap_hit', properties);
}
