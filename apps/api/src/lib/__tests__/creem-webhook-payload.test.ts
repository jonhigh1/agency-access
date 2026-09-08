import { describe, expect, it } from 'vitest';
import { getProductId } from '@/config/creem.config';
import {
  extractCreemProductId,
  extractCreemSubscriptionId,
  getSubscriptionPayload,
  normalizeCreemEvent,
} from '@/lib/creem-webhook-payload';

describe('normalizeCreemEvent', () => {
  it('maps eventType and top-level object to type and data', () => {
    const raw = {
      id: 'evt_123',
      eventType: 'subscription.active',
      object: { id: 'sub_123', object: 'subscription', status: 'active' },
    };

    expect(normalizeCreemEvent(raw)).toEqual({
      id: 'evt_123',
      type: 'subscription.active',
      data: raw.object,
    });
  });
});

describe('getSubscriptionPayload', () => {
  const growthProductId = getProductId('GROWTH', 'monthly');

  it('parses real Creem subscription.active payload shape', () => {
    const raw = {
      id: 'evt_6EptlmjazyGhEPiNQ5f4lz',
      eventType: 'subscription.active',
      object: {
        id: 'sub_21lfZb67szyvMiXnm6SVi0',
        object: 'subscription',
        product: {
          id: growthProductId,
          name: 'Growth Monthly',
        },
        customer: {
          id: 'cust_3biFPNt4Cz5YRDSdIqs7kc',
          email: 'customer@example.com',
        },
        status: 'active',
        current_period_start_date: '2024-10-12T11:58:38.000Z',
        current_period_end_date: '2024-11-12T11:58:38.000Z',
      },
    };

    const payload = getSubscriptionPayload(normalizeCreemEvent(raw));

    expect(payload).toEqual({
      id: 'sub_21lfZb67szyvMiXnm6SVi0',
      status: 'active',
      customer_id: 'cust_3biFPNt4Cz5YRDSdIqs7kc',
      price_id: growthProductId,
      current_period_start: '2024-10-12T11:58:38.000Z',
      current_period_end: '2024-11-12T11:58:38.000Z',
    });
  });

  it('parses checkout.completed nested subscription and product ids', () => {
    const raw = {
      id: 'evt_checkout',
      eventType: 'checkout.completed',
      object: {
        id: 'ch_123',
        object: 'checkout',
        product: { id: growthProductId },
        customer: { id: 'cust_checkout' },
        subscription: {
          id: 'sub_from_checkout',
          status: 'active',
          product: growthProductId,
          customer: 'cust_checkout',
        },
      },
    };

    const payload = getSubscriptionPayload(normalizeCreemEvent(raw));

    expect(payload).toMatchObject({
      id: 'sub_from_checkout',
      customer_id: 'cust_checkout',
      price_id: growthProductId,
      status: 'active',
    });
  });

  it('parses legacy AuthHub data.subscription shape', () => {
    const raw = {
      id: 'evt_legacy',
      type: 'subscription.created',
      data: {
        subscription: {
          id: 'sub_legacy',
          status: 'active',
          customer_id: 'cus_legacy',
          price_id: growthProductId,
          current_period_start: '2024-01-01T00:00:00.000Z',
          current_period_end: '2024-02-01T00:00:00.000Z',
        },
      },
    };

    const payload = getSubscriptionPayload(normalizeCreemEvent(raw));

    expect(payload).toEqual({
      id: 'sub_legacy',
      status: 'active',
      customer_id: 'cus_legacy',
      price_id: growthProductId,
      current_period_start: '2024-01-01T00:00:00.000Z',
      current_period_end: '2024-02-01T00:00:00.000Z',
    });
  });

  it('returns null when subscription or product ids are absent', () => {
    const raw = {
      id: 'evt_missing',
      eventType: 'subscription.active',
      object: {
        id: 'sub_no_product',
        object: 'subscription',
        customer: { id: 'cust_123' },
        status: 'active',
      },
    };

    expect(getSubscriptionPayload(normalizeCreemEvent(raw))).toBeNull();
  });
});

describe('extractCreemProductId', () => {
  it('reads product id from nested product object', () => {
    expect(
      extractCreemProductId({
        product: { id: 'prod_abc' },
      })
    ).toBe('prod_abc');
  });

  it('reads product id from string product field', () => {
    expect(extractCreemProductId({ product: 'prod_string' })).toBe('prod_string');
  });
});

describe('extractCreemSubscriptionId', () => {
  it('reads subscription id from subscription object', () => {
    expect(
      extractCreemSubscriptionId('subscription.active', {
        object: 'subscription',
        id: 'sub_abc',
      })
    ).toBe('sub_abc');
  });
});
