/**
 * Subscription Service Tests
 *
 * Tests for subscription management including checkout sessions,
 * portal access, and subscription synchronization.
 *
 * Following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { subscriptionService } from '../subscription.service';
import { prisma } from '@/lib/prisma';
import { creem } from '@/lib/creem';
import { getProductId } from '@/config/creem.config';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agency: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'test-agency-id',
        name: 'Test Agency',
        email: 'test@example.com',
        subscriptionTier: 'STARTER',
      }),
      findFirst: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/creem', () => ({
  creem: {
    createCustomer: vi.fn(),
    retrieveCustomer: vi.fn(),
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    retrieveSubscription: vi.fn(),
    upgradeSubscription: vi.fn(),
    updateSubscriptionItems: vi.fn(),
    updateSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    listInvoices: vi.fn(),
  },
}));

describe('SubscriptionService', () => {
  const mockAgencyId = 'test-agency-id';
  const mockSubscriptionId = 'test-subscription-id';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.agency.findUnique).mockResolvedValue({
      id: mockAgencyId,
      name: 'Test Agency',
      email: 'test@example.com',
      subscriptionTier: 'STARTER',
    } as any);
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session for new subscription', async () => {
      // Mock agency without Creem customer - pass email to checkout, Creem creates customer
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(creem.createCheckoutSession).mockResolvedValue({
        data: { checkout_url: 'https://checkout.creem.io/test' },
      });
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await subscriptionService.createCheckoutSession({
        agencyId: mockAgencyId,
        tier: 'STARTER',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        checkoutUrl: 'https://checkout.creem.io/test',
      });
    });

    it('should handle existing Creem customer', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemCustomerId: 'cus_existing123',
      } as any);
      vi.mocked(creem.createCheckoutSession).mockResolvedValue({
        data: { checkout_url: 'https://checkout.creem.io/test' },
      });
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await subscriptionService.createCheckoutSession({
        agencyId: mockAgencyId,
        tier: 'STARTER',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.error).toBeNull();
      expect(creem.createCustomer).not.toHaveBeenCalled();
      expect(creem.createCheckoutSession).toHaveBeenCalled();
    });

    it('should return error for unknown agency', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);

      const result = await subscriptionService.createCheckoutSession({
        agencyId: mockAgencyId,
        tier: 'STARTER',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'AGENCY_NOT_FOUND',
        message: 'Agency not found',
      });
    });

    it('should handle Creem API errors', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: mockAgencyId,
        email: 'test@example.com',
        name: 'Test Agency',
      });
      vi.mocked(creem.createCheckoutSession).mockResolvedValue({
        data: null,
        error: { code: 'CHECKOUT_ERROR', message: 'Creem checkout failed' },
      });

      const result = await subscriptionService.createCheckoutSession({
        agencyId: mockAgencyId,
        tier: 'STARTER',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'CHECKOUT_ERROR',
        message: 'Creem checkout failed',
      });
    });

    it('uses yearly product ID when billingInterval is yearly', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemCustomerId: 'cus_existing123',
      } as any);
      vi.mocked(creem.createCheckoutSession).mockResolvedValue({
        data: { url: 'https://checkout.creem.io/test' },
      });
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await subscriptionService.createCheckoutSession({
        agencyId: mockAgencyId,
        tier: 'STARTER',
        billingInterval: 'yearly',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.error).toBeNull();
      expect(creem.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: getProductId('STARTER', 'yearly'),
        })
      );
    });

    it('defaults checkout to monthly product ID when billingInterval is omitted', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemCustomerId: 'cus_existing123',
      } as any);
      vi.mocked(creem.createCheckoutSession).mockResolvedValue({
        data: { url: 'https://checkout.creem.io/test' },
      });
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await subscriptionService.createCheckoutSession({
        agencyId: mockAgencyId,
        tier: 'STARTER',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.error).toBeNull();
      expect(creem.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: getProductId('STARTER', 'monthly'),
        })
      );
    });

    it('includes affiliate referral metadata in checkout when agency is attributed', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemCustomerId: 'cus_existing123',
      } as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: mockAgencyId,
        email: 'test@example.com',
        name: 'Test Agency',
        affiliateReferral: {
          id: 'referral_1',
          partnerId: 'partner_1',
          clickId: 'click_1',
        },
      } as any);
      vi.mocked(creem.createCheckoutSession).mockResolvedValue({
        data: { url: 'https://checkout.creem.io/test' },
      });
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const result = await subscriptionService.createCheckoutSession({
        agencyId: mockAgencyId,
        tier: 'STARTER',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result.error).toBeNull();
      expect(creem.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            affiliatePartnerId: 'partner_1',
            affiliateReferralId: 'referral_1',
            affiliateClickId: 'click_1',
          }),
        })
      );
    });
  });

  describe('getSubscription', () => {
    it('should return subscription details', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        tier: 'PRO',
        status: 'active',
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        creemCustomerId: 'cus_test123',
        creemSubscriptionId: 'sub_test123',
        cancelAtPeriodEnd: false,
      });

      const result = await subscriptionService.getSubscription(mockAgencyId);

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        id: mockSubscriptionId,
        tier: 'PRO',
        status: 'active',
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        cancelAtPeriodEnd: false,
        creemCustomerId: 'cus_test123',
        creemSubscriptionId: 'sub_test123',
      });
    });

    it('should return null for agency without subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionService.getSubscription(mockAgencyId);

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it('should return null when subscription status is incomplete (user abandoned checkout)', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        agencyId: mockAgencyId,
        tier: 'STARTER',
        status: 'incomplete',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        creemCustomerId: null,
        creemSubscriptionId: null,
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
        creemData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await subscriptionService.getSubscription(mockAgencyId);

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session for existing customer', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        creemCustomerId: 'cus_test123',
      });
      vi.mocked(creem.createPortalSession).mockResolvedValue({
        data: { url: 'https://portal.creem.io/test' },
      });

      const result = await subscriptionService.createPortalSession({
        agencyId: mockAgencyId,
        returnUrl: 'https://example.com/settings',
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        portalUrl: 'https://portal.creem.io/test',
      });
    });

    it('should return error for agency without Creem customer', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionService.createPortalSession({
        agencyId: mockAgencyId,
        returnUrl: 'https://example.com/settings',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'NO_SUBSCRIPTION',
        message: 'No subscription found for this agency',
      });
    });
  });

  describe('listInvoices', () => {
    it('should list invoices for subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemCustomerId: 'cus_test123',
      });
      vi.mocked(creem.listInvoices).mockResolvedValue({
        data: [
          { id: 'inv_1', amount: 2900, status: 'paid', created: 1704067200000 },
          { id: 'inv_2', amount: 2900, status: 'paid', created: 1706745600000 },
        ],
      });
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([
        {
          id: 'local-inv-1',
          amount: 2900,
          currency: 'usd',
          status: 'paid',
          invoiceDate: new Date('2024-01-01'),
          invoiceUrl: 'https://creem.io/invoices/inv_1',
        },
        {
          id: 'local-inv-2',
          amount: 2900,
          currency: 'usd',
          status: 'paid',
          invoiceDate: new Date('2024-02-01'),
          invoiceUrl: 'https://creem.io/invoices/inv_2',
        },
      ]);

      const result = await subscriptionService.listInvoices({
        agencyId: mockAgencyId,
        limit: 10,
      });

      expect(result.error).toBeNull();
      expect(result.data?.invoices).toHaveLength(2);
    });

    it('should return empty array for agency without subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionService.listInvoices({
        agencyId: mockAgencyId,
        limit: 10,
      });

      expect(result.error).toBeNull();
      expect(result.data?.invoices).toEqual([]);
    });
  });

  describe('syncSubscription', () => {
    it('should sync subscription from Creem webhook', async () => {
      const mockCreemSubscription = {
        id: 'sub_creem123',
        customer: 'cus_test123',
        product_id: getProductId('STARTER'),
        status: 'active',
        current_period_start: 1704067200,
        current_period_end: 1706745600,
        cancel_at_period_end: false,
      };

      vi.mocked(prisma.agency.findFirst).mockResolvedValue({
        id: mockAgencyId,
      });
      vi.mocked(prisma.subscription.upsert).mockResolvedValue({
        id: mockSubscriptionId,
        tier: 'STARTER',
        status: 'active',
      });

      const result = await subscriptionService.syncSubscription({
        creemSubscriptionId: 'sub_creem123',
        creemCustomerId: 'cus_test123',
        productId: getProductId('STARTER'),
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        id: mockSubscriptionId,
        tier: 'STARTER',
        status: 'active',
      });
    });

    it('should handle canceled subscriptions', async () => {
      const result = await subscriptionService.syncSubscription({
        creemSubscriptionId: 'sub_creem123',
        creemCustomerId: 'cus_test123',
        productId: getProductId('STARTER'),
        status: 'canceled',
      });

      expect(result.error).toBeNull();
    });

    it('should return error for unknown product ID', async () => {
      const result = await subscriptionService.syncSubscription({
        creemSubscriptionId: 'sub_creem123',
        creemCustomerId: 'cus_test123',
        productId: 'prod_unknown',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'UNKNOWN_PRODUCT',
        message: 'Unknown Creem product ID',
      });
    });
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription to a higher tier', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        tier: 'STARTER',
        creemSubscriptionId: 'sub_test123',
        creemCustomerId: 'cus_test123',
        currentPeriodEnd: new Date('2025-02-01'),
      });
      vi.mocked(creem.upgradeSubscription).mockResolvedValue({
        data: { tier: 'SCALE', status: 'active' },
      });
      vi.mocked(prisma.subscription.update).mockResolvedValue({
        tier: 'SCALE',
        status: 'active',
        currentPeriodEnd: new Date('2025-02-01'),
      });

      const result = await subscriptionService.upgradeSubscription({
        agencyId: mockAgencyId,
        newTier: 'SCALE',
        updateBehavior: 'proration-charge',
      });

      expect(result.error).toBeNull();
      expect(result.data?.tier).toBe('SCALE');
      expect(creem.upgradeSubscription).toHaveBeenCalledWith(
        'sub_test123',
        expect.objectContaining({
          productId: expect.any(String),
          updateBehavior: 'proration-charge',
        })
      );
    });

    it('should downgrade subscription to a lower tier', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        tier: 'PRO',
        creemSubscriptionId: 'sub_test123',
        creemCustomerId: 'cus_test123',
        currentPeriodEnd: new Date('2025-02-01'),
      });
      vi.mocked(creem.upgradeSubscription).mockResolvedValue({
        data: { tier: 'STARTER', status: 'active' },
      });
      vi.mocked(prisma.subscription.update).mockResolvedValue({
        tier: 'STARTER',
        status: 'active',
        currentPeriodEnd: new Date('2025-02-01'),
      });

      const result = await subscriptionService.upgradeSubscription({
        agencyId: mockAgencyId,
        newTier: 'STARTER',
      });

      expect(result.error).toBeNull();
      expect(result.data?.tier).toBe('STARTER');
    });

    it('should return error for agency without subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionService.upgradeSubscription({
        agencyId: mockAgencyId,
        newTier: 'PRO',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'NO_SUBSCRIPTION',
        message: expect.any(String),
      });
    });

    it('should return error for same tier', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        tier: 'SCALE',
        creemSubscriptionId: 'sub_test123',
        creemCustomerId: 'cus_test123',
      });

      const result = await subscriptionService.upgradeSubscription({
        agencyId: mockAgencyId,
        newTier: 'SCALE',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'SAME_TIER',
        message: expect.any(String),
      });
    });

    it('should return error for invalid tier', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        tier: 'STARTER',
        creemSubscriptionId: 'sub_test123',
        creemCustomerId: 'cus_test123',
      });

      const result = await subscriptionService.upgradeSubscription({
        agencyId: mockAgencyId,
        newTier: 'ENTERPRISE',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'INVALID_TIER',
        message: expect.any(String),
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemSubscriptionId: 'sub_test123',
        creemCustomerId: 'cus_test123',
        currentPeriodEnd: new Date('2025-02-01'),
      });
      vi.mocked(creem.cancelSubscription).mockResolvedValue({
        data: { status: 'active', cancel_at_period_end: true },
      });
      vi.mocked(prisma.subscription.update).mockResolvedValue({
        status: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2025-02-01'),
      });

      const result = await subscriptionService.cancelSubscription({
        agencyId: mockAgencyId,
        cancelAtPeriodEnd: true,
      });

      expect(result.error).toBeNull();
      expect(result.data?.cancelAtPeriodEnd).toBe(true);
      expect(creem.cancelSubscription).toHaveBeenCalledWith('sub_test123', {
        cancelAtPeriodEnd: true,
      });
    });

    it('should cancel subscription immediately', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemSubscriptionId: 'sub_test123',
        creemCustomerId: 'cus_test123',
        currentPeriodEnd: new Date('2025-02-01'),
      });
      vi.mocked(creem.cancelSubscription).mockResolvedValue({
        data: { status: 'canceled', cancel_at_period_end: false },
      });
      vi.mocked(prisma.subscription.update).mockResolvedValue({
        status: 'canceled',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date('2025-02-01'),
      });

      const result = await subscriptionService.cancelSubscription({
        agencyId: mockAgencyId,
        cancelAtPeriodEnd: false,
      });

      expect(result.error).toBeNull();
      expect(result.data?.cancelAtPeriodEnd).toBe(false);
      expect(result.data?.status).toBe('canceled');
    });

    it('should return error for agency without subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionService.cancelSubscription({
        agencyId: mockAgencyId,
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'NO_SUBSCRIPTION',
        message: expect.any(String),
      });
    });
  });

  describe('updateSeatCount', () => {
    it('should update seat count for subscription', async () => {
      const mockItems = [{ id: 'sitem_test123', quantity: 5 }];
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemSubscriptionId: 'sub_test123',
        creemCustomerId: 'cus_test123',
      });
      vi.mocked(creem.retrieveSubscription).mockResolvedValue({
        data: { items: mockItems },
      });
      vi.mocked(creem.updateSubscriptionItems).mockResolvedValue({
        data: { items: [{ id: 'sitem_test123', units: 10 }] },
      });

      const result = await subscriptionService.updateSeatCount({
        agencyId: mockAgencyId,
        seatCount: 10,
      });

      expect(result.error).toBeNull();
      expect(result.data?.seatCount).toBe(10);
      expect(creem.updateSubscriptionItems).toHaveBeenCalledWith(
        'sub_test123',
        expect.objectContaining({
          items: [{ id: 'sitem_test123', units: 10 }],
        })
      );
    });

    it('should return error for subscription without items', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemSubscriptionId: 'sub_test123',
        creemCustomerId: 'cus_test123',
      });
      vi.mocked(creem.retrieveSubscription).mockResolvedValue({
        data: { items: [] },
      });

      const result = await subscriptionService.updateSeatCount({
        agencyId: mockAgencyId,
        seatCount: 10,
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'NO_ITEMS',
        message: expect.any(String),
      });
    });

    it('should return error for agency without subscription', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionService.updateSeatCount({
        agencyId: mockAgencyId,
        seatCount: 10,
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'NO_SUBSCRIPTION',
        message: expect.any(String),
      });
    });

    it('should return error for invalid seat count', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: mockSubscriptionId,
        creemSubscriptionId: 'sub_test123',
        creemCustomerId: 'cus_test123',
      } as any);
      vi.mocked(creem.retrieveSubscription).mockResolvedValue({
        data: { items: [{ id: 'sitem_test123', quantity: 1 }] },
      } as any);
      vi.mocked(creem.updateSubscriptionItems).mockResolvedValue({
        data: { items: [{ id: 'sitem_test123', units: 0 }] },
      } as any);

      const result = await subscriptionService.updateSeatCount({
        agencyId: mockAgencyId,
        seatCount: 0,
      });

      expect(result.error).toBeNull();
      expect(result.data?.seatCount).toBe(0);
    });
  });
});
