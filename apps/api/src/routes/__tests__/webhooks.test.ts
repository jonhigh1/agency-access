/**
 * Webhook Routes Tests
 *
 * Test-Driven Development for Creem.io webhook handler.
 * Following Red-Green-Refactor cycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyRawBody from 'fastify-raw-body';
import { webhookRoutes } from '../webhooks';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    agency: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    affiliateReferral: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    affiliateCommission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/services/clerk-metadata.service', () => ({
  clerkMetadataService: {
    setSubscriptionTier: vi.fn(),
  },
}));
vi.mock('@/lib/creem', () => ({
  creem: {
    verifyWebhookSignature: vi.fn(() => true),
  },
}));

vi.mock('@/services/billing-analytics.service', () => ({
  trackSubscriptionLifecycleFromWebhook: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { clerkMetadataService } from '@/services/clerk-metadata.service';
import { creem } from '@/lib/creem';
import { trackSubscriptionLifecycleFromWebhook } from '@/services/billing-analytics.service';

describe('Webhook Routes - TDD Tests', () => {
  let app: FastifyInstance;
  const signedHeaders = {
    'x-creem-signature': 't=1234567890,v1=test-signature',
  };

  const injectSigned = (options: Record<string, any>) =>
    app.inject({
      ...options,
      headers: {
        ...signedHeaders,
        ...(options.headers || {}),
      },
    });

  beforeEach(async () => {
    app = Fastify();
    await app.register(fastifyRawBody, {
      field: 'rawBody',
      global: false,
      encoding: 'utf8',
      runFirst: true,
    });
    await app.register(webhookRoutes, { prefix: '/api' });
    vi.clearAllMocks();

    // Default mock responses
    (prisma.auditLog.findFirst as any).mockResolvedValue(null);
    (prisma.auditLog.create as any).mockResolvedValue({ id: 'log-123' });
    (prisma.agency.findFirst as any).mockResolvedValue({
      id: 'agency-123',
      clerkUserId: 'clerk_user_123',
      settings: { creemCustomerId: 'cus_123' },
    });
    (prisma.subscription.findFirst as any).mockResolvedValue({
      id: 'subscription-123',
      agencyId: 'agency-123',
      status: 'active',
    });
    (prisma.invoice.upsert as any).mockResolvedValue({
      id: 'invoice-123',
      subscriptionId: 'subscription-123',
      creemInvoiceId: 'in_123',
    });
    (prisma.invoice.findUnique as any).mockResolvedValue(null);
    (prisma.affiliateReferral.findUnique as any).mockResolvedValue(null);
    (prisma.affiliateCommission.findUnique as any).mockResolvedValue(null);
    (prisma.affiliateCommission.create as any).mockResolvedValue({
      id: 'commission-123',
    });
    (clerkMetadataService.setSubscriptionTier as any).mockResolvedValue({
      data: { tier: 'AGENCY' },
      error: null,
    });
    (creem.verifyWebhookSignature as any).mockReturnValue(true);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/webhooks/creem', () => {
    const validPayload = {
      id: 'evt_123',
      type: 'subscription.created',
      data: {
        subscription: {
          id: 'sub_123',
          status: 'active',
          customer_id: 'cus_123',
          price_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
          current_period_start: '2024-01-01T00:00:00.000Z',
          current_period_end: '2024-02-01T00:00:00.000Z',
        },
      },
    };

    it('should handle subscription.created event', async () => {
      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.received).toBe(true);
      expect(payload.processed).toBe(true);
    });

    it('should return 401 when signature header is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when signature verification fails', async () => {
      (creem.verifyWebhookSignature as any).mockReturnValue(false);

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should verify signature using raw request body bytes', async () => {
      const rawPayload = `{
  "id": "evt_123",
  "type": "subscription.created",
  "data": {
    "subscription": {
      "id": "sub_123",
      "status": "active",
      "customer_id": "cus_123",
      "price_id": "prod_11NeEMY6WtGEkdnvdd7obj",
      "current_period_start": "2024-01-01T00:00:00.000Z",
      "current_period_end": "2024-02-01T00:00:00.000Z"
    }
  }
}`;

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: rawPayload,
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(creem.verifyWebhookSignature).toHaveBeenCalledWith(rawPayload, expect.any(String));
    });

    it('should handle subscription.updated event', async () => {
      const updatePayload = {
        ...validPayload,
        type: 'subscription.updated',
      };

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: updatePayload,
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.received).toBe(true);
      expect(payload.processed).toBe(true);
    });

    it('should handle real Creem subscription.active payload with product.id and customer.id', async () => {
      const creemPayload = {
        id: 'evt_creem_active',
        eventType: 'subscription.active',
        object: {
          id: 'sub_creem_real',
          object: 'subscription',
          status: 'active',
          product: {
            id: 'prod_11NeEMY6WtGEkdnvdd7obj',
            name: 'Growth Monthly',
          },
          customer: {
            id: 'cus_123',
            email: 'agency@example.com',
          },
          current_period_start_date: '2024-01-01T00:00:00.000Z',
          current_period_end_date: '2024-02-01T00:00:00.000Z',
        },
      };

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: creemPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(clerkMetadataService.setSubscriptionTier).toHaveBeenCalledWith(
        'clerk_user_123',
        'GROWTH',
        expect.objectContaining({
          subscriptionId: 'sub_creem_real',
          subscriptionStatus: 'active',
        })
      );
      expect(trackSubscriptionLifecycleFromWebhook).toHaveBeenCalledWith({
        eventType: 'subscription.active',
        context: expect.objectContaining({
          creemSubscriptionId: 'sub_creem_real',
          creemCustomerId: 'cus_123',
          creemProductId: 'prod_11NeEMY6WtGEkdnvdd7obj',
          status: 'active',
        }),
      });
    });

    it('should map prod_11NeEMY6WtGEkdnvdd7obj to GROWTH tier', async () => {
      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(clerkMetadataService.setSubscriptionTier).toHaveBeenCalledWith(
        'clerk_user_123',
        'GROWTH',
        expect.objectContaining({
          subscriptionId: 'sub_123',
          subscriptionStatus: 'active',
        })
      );
    });

    it('should map agency product IDs to AGENCY tier', async () => {
      const agencyPayload = {
        ...validPayload,
        data: {
          subscription: {
            ...validPayload.data.subscription,
            price_id: 'prod_5FEs6qBlwvbMWHHun95wkk',
          },
        },
      };

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: agencyPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(clerkMetadataService.setSubscriptionTier).toHaveBeenCalledWith(
        'clerk_user_123',
        'AGENCY',
        expect.anything()
      );
    });

    it('should return duplicate=true for idempotent requests', async () => {
      (prisma.auditLog.findFirst as any).mockResolvedValue({ id: 'existing-log' });

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.duplicate).toBe(true);
      expect(payload.received).toBe(true);
      // Should not process duplicates
      expect(clerkMetadataService.setSubscriptionTier).not.toHaveBeenCalled();
    });

    it('should treat Creem webhook marker unique conflicts as duplicate deliveries', async () => {
      (prisma.auditLog.findFirst as any).mockResolvedValue(null);
      (prisma.auditLog.create as any).mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      );

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toMatchObject({
        received: true,
        duplicate: true,
      });
      expect(clerkMetadataService.setSubscriptionTier).not.toHaveBeenCalled();
    });

    it('should write exactly one marker row for a new event', async () => {
      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toMatchObject({ received: true, processed: true });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREEM_WEBHOOK_subscription.created',
            resourceId: 'evt_123',
            resourceType: 'creem_webhook_marker',
          }),
        })
      );
    });

    it('should return 400 for unknown price ID', async () => {
      const invalidPayload = {
        ...validPayload,
        data: {
          subscription: {
            ...validPayload.data.subscription,
            price_id: 'price_unknown',
          },
        },
      };

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: invalidPayload,
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBeDefined();
    });

    it('should log webhook to audit log', async () => {
      await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CREEM_WEBHOOK_subscription.created',
          resourceId: 'evt_123',
          resourceType: 'creem_webhook_marker',
        }),
      });
    });

    it('should update agency subscriptionTier in database', async () => {
      await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(prisma.agency.update).toHaveBeenCalledWith({
        where: { id: 'agency-123' },
        data: { subscriptionTier: 'GROWTH' },
      });
    });

    it('should handle subscription.canceled event', async () => {
      const cancelPayload = {
        ...validPayload,
        type: 'subscription.canceled',
        data: {
          subscription: {
            ...validPayload.data.subscription,
            status: 'canceled',
            price_id: 'prod_4SUPfON3XwTo5SKOJzN2dH',
          },
        },
      };

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: cancelPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(clerkMetadataService.setSubscriptionTier).toHaveBeenCalledWith(
        'clerk_user_123',
        'STARTER',
        expect.objectContaining({
          subscriptionStatus: 'canceled',
        })
      );
    });

    it('should handle agency not found gracefully', async () => {
      (prisma.agency.findFirst as any).mockResolvedValue(null);

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.received).toBe(true);
      // Should not crash, just log and return
    });

    it('should handle trial_end in subscription', async () => {
      const trialPayload = {
        ...validPayload,
        data: {
          subscription: {
            ...validPayload.data.subscription,
            trial_end: '2024-01-15T00:00:00.000Z',
          },
        },
      };

      await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: trialPayload,
      });

      expect(clerkMetadataService.setSubscriptionTier).toHaveBeenCalledWith(
        'clerk_user_123',
        'GROWTH',
        expect.objectContaining({
          trialEndsAt: expect.any(Date),
        })
      );
    });

    it('should handle invoice.paid events through the live webhook route', async () => {
      const invoicePayload = {
        id: 'evt_invoice_paid',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            amount_paid: 9900,
            currency: 'usd',
            status: 'paid',
            created: 1704067200,
          },
        },
      };

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: invoicePayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        received: true,
        processed: true,
      });
      expect(prisma.invoice.upsert).toHaveBeenCalled();
    });

    it('should handle invoice.payment_failed events through the live webhook route', async () => {
      const invoicePayload = {
        id: 'evt_invoice_failed',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            amount_due: 9900,
            currency: 'usd',
            status: 'open',
            created: 1704067200,
          },
        },
      };

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: invoicePayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        received: true,
        processed: true,
      });
      expect(prisma.invoice.upsert).toHaveBeenCalled();
      expect(prisma.affiliateCommission.create).not.toHaveBeenCalled();
    });

    it('should handle invoice.refunded events through the live webhook route', async () => {
      const invoicePayload = {
        id: 'evt_invoice_refunded',
        type: 'invoice.refunded',
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            amount_due: 9900,
            currency: 'usd',
            status: 'void',
            created: 1704067200,
          },
        },
      };

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: invoicePayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        received: true,
        processed: true,
      });
      expect(prisma.invoice.upsert).toHaveBeenCalled();
    });

    it('should handle invoice.voided events through the live webhook route', async () => {
      const invoicePayload = {
        id: 'evt_invoice_voided',
        type: 'invoice.voided',
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            amount_due: 9900,
            currency: 'usd',
            status: 'void',
            created: 1704067200,
          },
        },
      };

      const response = await injectSigned({
        method: 'POST',
        url: '/api/webhooks/creem',
        payload: invoicePayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        received: true,
        processed: true,
      });
      expect(prisma.invoice.upsert).toHaveBeenCalled();
    });
  });

  describe('Price ID to Tier Mapping', () => {
    const baseValidPayload = {
      id: 'evt_123',
      type: 'subscription.created' as const,
      data: {
        subscription: {
          id: 'sub_123',
          status: 'active' as const,
          customer_id: 'cus_123',
          price_id: 'prod_11NeEMY6WtGEkdnvdd7obj',
          current_period_start: '2024-01-01T00:00:00.000Z',
          current_period_end: '2024-02-01T00:00:00.000Z',
        },
      },
    };

    it('should map all starter price IDs', async () => {
      const starterPrices = ['prod_4SUPfON3XwTo5SKOJzN2dH', 'prod_6Hyydvn6jh0numRxJecMol'];

      for (const priceId of starterPrices) {
        const payload = {
          ...baseValidPayload,
          data: {
            subscription: {
              ...baseValidPayload.data.subscription,
              price_id: priceId,
            },
          },
        };

        await injectSigned({
          method: 'POST',
          url: '/api/webhooks/creem',
          payload,
        });

        expect(clerkMetadataService.setSubscriptionTier).toHaveBeenCalledWith(
          'clerk_user_123',
          'STARTER',
          expect.anything()
        );
      }
    });

    it('should map all growth price IDs', async () => {
      const growthPrices = ['prod_11NeEMY6WtGEkdnvdd7obj', 'prod_4vNvJn99RTRwhkMeHgkBT7'];

      for (const priceId of growthPrices) {
        vi.clearAllMocks();
        const payload = {
          ...baseValidPayload,
          data: {
            subscription: {
              ...baseValidPayload.data.subscription,
              price_id: priceId,
            },
          },
        };

        await injectSigned({
          method: 'POST',
          url: '/api/webhooks/creem',
          payload,
        });

        expect(clerkMetadataService.setSubscriptionTier).toHaveBeenCalledWith(
          'clerk_user_123',
          'GROWTH',
          expect.anything()
        );
      }
    });

    it('should map all agency price IDs', async () => {
      const agencyPrices = ['prod_5FEs6qBlwvbMWHHun95wkk', 'prod_6w78r7ZbTUjkJl7mTkNfFr'];

      for (const priceId of agencyPrices) {
        vi.clearAllMocks();
        const payload = {
          ...baseValidPayload,
          data: {
            subscription: {
              ...baseValidPayload.data.subscription,
              price_id: priceId,
            },
          },
        };

        await injectSigned({
          method: 'POST',
          url: '/api/webhooks/creem',
          payload,
        });

        expect(clerkMetadataService.setSubscriptionTier).toHaveBeenCalledWith(
          'clerk_user_123',
          'AGENCY',
          expect.anything()
        );
      }
    });
  });
});
