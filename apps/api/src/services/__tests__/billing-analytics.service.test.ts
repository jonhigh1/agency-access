import { describe, it, expect, beforeEach, vi } from 'vitest';

const { captureServerPosthogEventMock } = vi.hoisted(() => ({
  captureServerPosthogEventMock: vi.fn(),
}));

vi.mock('@/lib/posthog.js', () => ({
  captureServerPosthogEvent: captureServerPosthogEventMock,
}));

import { trackSubscriptionLifecycleFromWebhook } from '../billing-analytics.service';

describe('billing-analytics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const context = {
    distinctId: 'user_123',
    agencyId: 'agency_123',
    creemSubscriptionId: 'sub_123',
    creemCustomerId: 'cus_123',
    productId: 'prod_11NeEMY6WtGEkdnvdd7obj',
    status: 'active',
  };

  it('emits subscription_started for active subscription.created webhooks', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.created',
      context,
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'subscription_started',
      properties: expect.objectContaining({
        agency_id: 'agency_123',
        plan: 'growth',
        billing_period: 'monthly',
        price_cents: 7900,
        mrr_cents: 7900,
        creem_product_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
        creem_subscription_id: 'sub_123',
        creem_customer_id: 'cus_123',
        subscription_status: 'active',
      }),
    });
  });

  it('emits trial_started for trialing subscription.created webhooks', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.created',
      context: { ...context, status: 'trialing' },
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'trial_started',
      properties: expect.objectContaining({
        plan: 'growth',
        subscription_status: 'trialing',
      }),
    });
  });

  it('emits subscription_updated and subscription_canceled lifecycle events', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.updated',
      context: { ...context, status: 'past_due' },
    });

    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.canceled',
      context: { ...context, status: 'canceled' },
    });

    expect(captureServerPosthogEventMock).toHaveBeenNthCalledWith(1, {
      distinctId: 'user_123',
      event: 'subscription_updated',
      properties: expect.objectContaining({
        subscription_status: 'past_due',
      }),
    });

    expect(captureServerPosthogEventMock).toHaveBeenNthCalledWith(2, {
      distinctId: 'user_123',
      event: 'subscription_canceled',
      properties: expect.objectContaining({
        subscription_status: 'canceled',
      }),
    });
  });
});
