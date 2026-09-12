import { describe, it, expect, beforeEach, vi } from 'vitest';

const { capturePosthogEventMock } = vi.hoisted(() => ({
  capturePosthogEventMock: vi.fn(),
}));

vi.mock('../capture-posthog', () => ({
  capturePosthogEvent: capturePosthogEventMock,
}));

import {
  buildPlanSelectedProps,
  buildSubscriptionStartedProps,
  getCreemProductId,
  getListPriceCents,
  getMrrCents,
  subscriptionTierToPlanSlug,
  trackBillingCheckoutFailed,
  trackBillingCheckoutStarted,
  trackCapHit,
  trackPlanSelected,
  trackPricingViewed,
  trackSubscriptionStarted,
  trackTrialStarted,
} from '../billing';

describe('billing analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks pricing_viewed with billing_period', () => {
    trackPricingViewed({
      path: '/pricing',
      billing_period: 'yearly',
      agency_id: 'org_123',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('pricing_viewed', {
      path: '/pricing',
      billing_period: 'yearly',
      agency_id: 'org_123',
    });
  });

  it('tracks plan_selected with Growth baseline props', () => {
    trackPlanSelected({
      plan: 'growth',
      billing_period: 'monthly',
      price_cents: 7900,
      surface: 'compare',
      creem_product_id: getCreemProductId('GROWTH', 'monthly'),
      agency_id: 'org_123',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('plan_selected', {
      plan: 'growth',
      billing_period: 'monthly',
      price_cents: 7900,
      surface: 'compare',
      creem_product_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
      agency_id: 'org_123',
    });
  });

  it('builds list and MRR cents from shared pricing without changing amounts', () => {
    expect(getListPriceCents('starter', 'monthly')).toBe(2900);
    expect(getListPriceCents('starter', 'yearly')).toBe(29000);
    expect(getMrrCents('starter', 'yearly')).toBe(2417);
    expect(buildPlanSelectedProps('GROWTH', 'monthly', 'pricing')).toEqual({
      plan: 'growth',
      billing_period: 'monthly',
      price_cents: 7900,
      surface: 'pricing',
      creem_product_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
      creem_price_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
    });
  });

  it('tracks billing_checkout_started after checkout session is created', () => {
    trackBillingCheckoutStarted({
      ...buildPlanSelectedProps('STARTER', 'yearly', 'checkout'),
      agency_id: 'org_123',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith(
      'billing_checkout_started',
      expect.objectContaining({
        plan: 'starter',
        billing_period: 'yearly',
        price_cents: 29000,
        creem_product_id: 'prod_6Hyydvn6jh0numRxJecMol',
        surface: 'checkout',
        agency_id: 'org_123',
      })
    );
  });

  it('uses subscription_started as the primary checkout completion event', () => {
    trackSubscriptionStarted({
      ...buildSubscriptionStartedProps('SCALE', 'monthly'),
      agency_id: 'org_123',
      surface: 'checkout',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith(
      'subscription_started',
      expect.objectContaining({
        plan: 'scale',
        billing_period: 'monthly',
        price_cents: 14900,
        mrr_cents: 14900,
        agency_id: 'org_123',
        surface: 'checkout',
      })
    );
  });

  it('tracks billing_checkout_failed with reason', () => {
    trackBillingCheckoutFailed({
      agency_id: 'org_123',
      plan: 'growth',
      billing_period: 'monthly',
      surface: 'checkout',
      reason: 'user_cancelled',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('billing_checkout_failed', {
      agency_id: 'org_123',
      plan: 'growth',
      billing_period: 'monthly',
      surface: 'checkout',
      reason: 'user_cancelled',
    });
  });

  it('tracks trial_started and cap_hit optional events', () => {
    trackTrialStarted({
      plan: 'starter',
      billing_period: 'yearly',
      price_cents: 29000,
      mrr_cents: 2417,
      agency_id: 'org_123',
    });

    trackCapHit({
      agency_id: 'org_123',
      plan: subscriptionTierToPlanSlug('STARTER'),
      clients_used: 5,
      plan_cap: 5,
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('trial_started', expect.any(Object));
    expect(capturePosthogEventMock).toHaveBeenCalledWith('cap_hit', {
      agency_id: 'org_123',
      plan: 'starter',
      clients_used: 5,
      plan_cap: 5,
    });
  });
});
