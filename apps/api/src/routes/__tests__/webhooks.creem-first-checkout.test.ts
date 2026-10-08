/**
 * Regression: a first-time Creem checkout never reached PostHog.
 *
 * Checkout sessions for new customers are created with customerEmail only, so
 * the agency's Subscription row has no creemCustomerId. The webhook looked the
 * agency up by creemCustomerId alone, matched nothing, and returned 200 without
 * syncing the tier or capturing subscription_started / trial_started /
 * subscription.canceled.
 *
 * These tests drive the real route, real signature verification (Creem's
 * HMAC-SHA256 hex `creem-signature`), real payload normalization and the real
 * lifecycle mapper, with Creem-docs-shaped payloads and an in-memory DB.
 */

import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyRawBody from 'fastify-raw-body';

const TEST_WEBHOOK_SECRET = 'whsec_test_only_not_a_real_secret';
const STARTER_YEARLY = 'prod_6Hyydvn6jh0numRxJecMol';

type SubscriptionRow = {
  id: string;
  agencyId: string;
  creemCustomerId: string | null;
  creemSubscriptionId: string | null;
  status: string;
  tier: string;
};
type AgencyRow = { id: string; clerkUserId: string | null; subscriptionTier: string | null };

const db = vi.hoisted(() => ({
  agencies: [] as AgencyRow[],
  subscriptions: [] as SubscriptionRow[],
  markers: [] as Array<{ action: string; resourceId: string }>,
}));

const { captureServerPosthogEventMock } = vi.hoisted(() => ({
  captureServerPosthogEventMock: vi.fn(),
}));

function withSubscription(agency: AgencyRow | undefined) {
  if (!agency) return null;
  return {
    ...agency,
    subscription: db.subscriptions.find((row) => row.agencyId === agency.id) ?? null,
  };
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      findFirst: vi.fn(async ({ where }: any) =>
        db.markers.find((m) => m.action === where.action && m.resourceId === where.resourceId) ?? null
      ),
      create: vi.fn(async ({ data }: any) => {
        db.markers.push({ action: data.action, resourceId: data.resourceId });
        return { id: db.markers.length };
      }),
    },
    agency: {
      findFirst: vi.fn(async ({ where }: any) => {
        const filter = where?.subscription ?? {};
        const subscription = db.subscriptions.find((row) =>
          Object.entries(filter).every(
            ([key, value]) => value != null && (row as any)[key] === value
          )
        );
        return subscription
          ? withSubscription(db.agencies.find((a) => a.id === subscription.agencyId))
          : null;
      }),
      findUnique: vi.fn(async ({ where }: any) =>
        withSubscription(db.agencies.find((a) => a.id === where.id))
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const agency = db.agencies.find((a) => a.id === where.id)!;
        Object.assign(agency, data);
        return agency;
      }),
    },
    subscription: {
      update: vi.fn(async ({ where, data }: any) => {
        const row = db.subscriptions.find((s) => s.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
  },
}));

vi.mock('@/services/clerk-metadata.service', () => ({
  clerkMetadataService: { setSubscriptionTier: vi.fn(async () => ({ data: null, error: null })) },
}));

vi.mock('@/lib/creem', async () => {
  const { verifyCreemWebhookSignature } = await import('@/lib/creem-signature');
  return {
    creem: {
      verifyWebhookSignature: (payload: string, signature: string) =>
        verifyCreemWebhookSignature(payload, signature, TEST_WEBHOOK_SECRET),
    },
  };
});

vi.mock('@/lib/posthog.js', () => ({
  captureServerPosthogEvent: captureServerPosthogEventMock,
}));

import { webhookRoutes } from '../webhooks';

function sign(body: string): string {
  return createHmac('sha256', TEST_WEBHOOK_SECRET).update(body, 'utf8').digest('hex');
}

const customer = {
  id: 'cust_test_first_checkout',
  object: 'customer',
  email: 'owner@example.com',
  name: 'Test Owner',
  country: 'GB',
  mode: 'test',
};

function checkoutCompletedTrial() {
  return {
    id: 'evt_test_checkout_completed',
    eventType: 'checkout.completed',
    created_at: 1759690000000,
    object: {
      id: 'ch_test_1',
      object: 'checkout',
      order: { id: 'ord_test_1', customer: customer.id, product: STARTER_YEARLY, amount: 0, status: 'paid' },
      product: { id: STARTER_YEARLY, billing_type: 'recurring', billing_period: 'every-year' },
      customer,
      subscription: {
        id: 'sub_test_1',
        object: 'subscription',
        product: STARTER_YEARLY,
        customer: customer.id,
        status: 'trialing',
        metadata: { agencyId: 'agency-first', tier: 'STARTER', billingInterval: 'yearly' },
        mode: 'test',
      },
      status: 'completed',
      metadata: { agencyId: 'agency-first', tier: 'STARTER', billingInterval: 'yearly' },
      mode: 'test',
    },
  };
}

function subscriptionEvent(eventType: string, status: string, eventId: string, metadata?: object) {
  return {
    id: eventId,
    eventType,
    created_at: 1759690100000,
    object: {
      id: 'sub_test_1',
      object: 'subscription',
      product: { id: STARTER_YEARLY, billing_type: 'recurring', billing_period: 'every-year' },
      customer,
      status,
      current_period_start_date: '2026-10-05T12:00:00.000Z',
      current_period_end_date: '2026-10-12T12:00:00.000Z',
      ...(metadata ? { metadata } : {}),
      mode: 'test',
    },
  };
}

describe('Creem webhook: first-time checkout reaches PostHog', () => {
  let app: FastifyInstance;

  const deliver = (payload: object) => {
    const body = JSON.stringify(payload);
    return app.inject({
      method: 'POST',
      url: '/api/webhooks/creem',
      payload: body,
      headers: { 'content-type': 'application/json', 'creem-signature': sign(body) },
    });
  };

  const capturedEvents = () => captureServerPosthogEventMock.mock.calls.map(([call]) => call.event);

  beforeEach(async () => {
    vi.clearAllMocks();
    db.markers = [];
    // State right after POST /subscriptions/checkout for a new customer:
    // row exists, status incomplete, NO creemCustomerId yet.
    db.agencies = [{ id: 'agency-first', clerkUserId: 'user_first_owner', subscriptionTier: null }];
    db.subscriptions = [
      {
        id: 'subrow-first',
        agencyId: 'agency-first',
        creemCustomerId: null,
        creemSubscriptionId: null,
        status: 'incomplete',
        tier: 'STARTER',
      },
    ];

    app = Fastify();
    await app.register(fastifyRawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true });
    await app.register(webhookRoutes, { prefix: '/api' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects a body that was not signed with the webhook secret', async () => {
    const body = JSON.stringify(checkoutCompletedTrial());
    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/creem',
      payload: body,
      headers: { 'content-type': 'application/json', 'creem-signature': 'deadbeef' },
    });
    expect(response.statusCode).toBe(401);
    expect(captureServerPosthogEventMock).not.toHaveBeenCalled();
  });

  it('trial checkout: captures subscription_started (is_trial) and links the Creem customer', async () => {
    const response = await deliver(checkoutCompletedTrial());

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ received: true, processed: true });
    expect(captureServerPosthogEventMock).toHaveBeenCalledTimes(1);
    expect(captureServerPosthogEventMock).toHaveBeenCalledWith({
      distinctId: 'user_first_owner',
      event: 'subscription_started',
      properties: expect.objectContaining({
        agency_id: 'agency-first',
        plan: 'starter',
        billing_period: 'yearly',
        creem_subscription_id: 'sub_test_1',
        creem_customer_id: customer.id,
        subscription_status: 'trialing',
        is_trial: true,
      }),
    });
    expect(db.subscriptions[0]).toMatchObject({
      creemCustomerId: customer.id,
      creemSubscriptionId: 'sub_test_1',
      status: 'trialing',
    });
  });

  it('full trial lifecycle: checkout, trialing, cancel 6 minutes later all reach PostHog', async () => {
    await deliver(checkoutCompletedTrial());
    // subscription.* events after linking resolve by customer id.
    await deliver(subscriptionEvent('subscription.trialing', 'trialing', 'evt_test_trialing'));
    await deliver(subscriptionEvent('subscription.canceled', 'canceled', 'evt_test_canceled'));

    expect(capturedEvents()).toEqual(['subscription_started', 'trial_started', 'subscription.canceled']);
  });

  it('subscription.* arriving before checkout.completed resolves via checkout metadata', async () => {
    const response = await deliver(
      subscriptionEvent('subscription.active', 'active', 'evt_test_active_first', {
        agencyId: 'agency-first',
      })
    );

    expect(response.statusCode).toBe(200);
    expect(capturedEvents()).toEqual(['subscription_started']);
    expect(db.subscriptions[0].creemCustomerId).toBe(customer.id);
  });

  it('does not relink a subscription already tied to a different Creem customer', async () => {
    db.subscriptions[0].creemCustomerId = 'cust_previous';
    await deliver(checkoutCompletedTrial());

    expect(db.subscriptions[0].creemCustomerId).toBe('cust_previous');
    // Signed metadata still identifies the agency, so analytics are not lost.
    expect(capturedEvents()).toEqual(['subscription_started']);
  });

  it('logs and skips (200, processed=false) when no agency can be resolved', async () => {
    db.agencies = [];
    db.subscriptions = [];
    const response = await deliver(checkoutCompletedTrial());

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ processed: false, reason: 'agency_not_found' });
    expect(captureServerPosthogEventMock).not.toHaveBeenCalled();
  });

  it('duplicate deliveries capture once', async () => {
    await deliver(checkoutCompletedTrial());
    await deliver(checkoutCompletedTrial());
    expect(capturedEvents()).toEqual(['subscription_started']);
  });
});
