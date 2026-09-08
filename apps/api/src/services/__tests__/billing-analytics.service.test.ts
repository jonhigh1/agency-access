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
    creemProductId: 'prod_11NeEMY6WtGEkdnvdd7obj',
    status: 'active',
  };

  const lifecycleProps = expect.objectContaining({
    agency_id: 'agency_123',
    plan: 'growth',
    billing_period: 'monthly',
    price_cents: 7900,
    mrr_cents: 7900,
    creem_price_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
    creem_product_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
    creem_subscription_id: 'sub_123',
    creem_customer_id: 'cus_123',
    subscription_status: 'active',
  });

  it('emits subscription_started for active subscription.created (checkout.completed primary)', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.created',
      context,
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledTimes(1);
    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'subscription_started',
      properties: lifecycleProps,
    });
  });

  it('emits subscription_started for subscription.active Creem dashboard events', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.active',
      context,
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'subscription_started',
      properties: lifecycleProps,
    });
  });

  it('emits subscription_started for checkout.completed when status is active', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'checkout.completed',
      context,
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'subscription_started',
      properties: lifecycleProps,
    });
  });

  it('includes creem_subscription_id and creem_product_id on all lifecycle events when present', async () => {
    const cases = [
      { eventType: 'subscription.active' as const, event: 'subscription_started' },
      { eventType: 'subscription.trialing' as const, event: 'trial_started', status: 'trialing' },
      { eventType: 'subscription.update' as const, event: 'subscription.active' },
      { eventType: 'subscription.past_due' as const, event: 'subscription.past_due', status: 'past_due' },
      { eventType: 'subscription.canceled' as const, event: 'subscription.canceled', status: 'canceled' },
    ];

    for (const testCase of cases) {
      captureServerPosthogEventMock.mockClear();
      await trackSubscriptionLifecycleFromWebhook({
        eventType: testCase.eventType,
        context: {
          ...context,
          status: testCase.status ?? context.status,
        },
      });

      expect(captureServerPosthogEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: testCase.event,
          properties: expect.objectContaining({
            creem_subscription_id: 'sub_123',
            creem_product_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
          }),
        })
      );
    }
  });

  it('keeps creem ids null only when absent from context', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.active',
      context: {
        ...context,
        creemSubscriptionId: null,
        creemProductId: null,
      },
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'subscription_started',
      properties: {
        agency_id: 'agency_123',
        creem_subscription_id: null,
        creem_customer_id: 'cus_123',
        creem_product_id: null,
        subscription_status: 'active',
      },
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
        creem_price_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
        creem_subscription_id: 'sub_123',
        creem_product_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
      }),
    });
  });

  it('emits subscription.active on subscription.updated when status is active', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.updated',
      context,
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'subscription.active',
      properties: lifecycleProps,
    });
  });

  it('emits subscription.active on subscription.update when status is active', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.update',
      context,
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'subscription.active',
      properties: lifecycleProps,
    });
  });

  it('emits subscription.past_due for past_due status', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.updated',
      context: { ...context, status: 'past_due' },
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'subscription.past_due',
      properties: expect.objectContaining({
        subscription_status: 'past_due',
        mrr_cents: 7900,
        creem_subscription_id: 'sub_123',
        creem_product_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
      }),
    });
  });

  it('emits subscription.canceled for canceled webhooks', async () => {
    await trackSubscriptionLifecycleFromWebhook({
      eventType: 'subscription.canceled',
      context: { ...context, status: 'canceled' },
    });

    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_123',
      event: 'subscription.canceled',
      properties: expect.objectContaining({
        subscription_status: 'canceled',
        creem_subscription_id: 'sub_123',
        creem_product_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
      }),
    });
  });
});
