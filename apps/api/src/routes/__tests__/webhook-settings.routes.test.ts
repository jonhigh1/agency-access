import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { webhookRoutes } from '../webhooks';
import * as authorization from '@/lib/authorization.js';
import * as webhookEndpointService from '@/services/webhook-endpoint.service';
import * as webhookManagementService from '@/services/webhook-management.service';

vi.mock('@/lib/authorization.js');
vi.mock('@/services/webhook-endpoint.service');
vi.mock('@/services/webhook-management.service');
vi.mock('@/middleware/auth.js', () => ({
  authenticate: () => async (request: any, reply: any) => {
    if (!request.headers.authorization) {
      return reply.code(401).send({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Missing token' },
      });
    }

    request.user = { sub: 'user_123' };
  },
}));
vi.mock('@/middleware/quota-enforcement.js', () => ({
  quotaEnforcementMiddleware: () => async () => undefined,
}));
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
      update: vi.fn(),
    },
  },
}));
vi.mock('@/services/clerk-metadata.service', () => ({
  clerkMetadataService: {
    setSubscriptionTier: vi.fn(),
  },
}));
vi.mock('@/services/webhook.service', () => ({
  webhookService: {
    processInvoicePaid: vi.fn(),
    processInvoicePaymentFailed: vi.fn(),
  },
}));
vi.mock('@/lib/creem', () => ({
  creem: {
    verifyWebhookSignature: vi.fn(() => true),
  },
}));

describe('Webhook Settings Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(webhookRoutes, { prefix: '/api' });
    vi.clearAllMocks();

    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: { agencyId: 'agency-1', principalId: 'user_123' },
      error: null,
    });
    vi.mocked(authorization.assertAgencyAccess).mockImplementation((requested, principal) => {
      if (requested !== principal) {
        return {
          code: 'FORBIDDEN',
          message: 'You do not have access to this agency resource',
        };
      }

      return null;
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the webhook endpoint for the principal agency', async () => {
    vi.mocked(webhookEndpointService.getWebhookEndpoint).mockResolvedValue({
      data: {
        endpoint: {
          id: 'endpoint-1',
          agencyId: 'agency-1',
          url: 'https://example.com/webhooks',
          status: 'active',
          subscribedEvents: ['access_request.completed'],
          failureCount: 0,
          secretLastFour: '1234',
          lastDeliveredAt: null,
          lastFailedAt: null,
          createdAt: '2026-03-08T00:00:00.000Z',
          updatedAt: '2026-03-08T00:00:00.000Z',
        },
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/api/agencies/agency-1/webhook-endpoint',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        endpoint: expect.objectContaining({
          id: 'endpoint-1',
          url: 'https://example.com/webhooks',
        }),
      },
      error: null,
    });
  });

  it('returns 500 when fetching the webhook endpoint hits an internal error', async () => {
    vi.mocked(webhookEndpointService.getWebhookEndpoint).mockResolvedValue({
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch webhook endpoint',
      },
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/api/agencies/agency-1/webhook-endpoint',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch webhook endpoint',
      },
    });
  });

  it('creates a webhook endpoint when none exists', async () => {
    vi.mocked(webhookEndpointService.getWebhookEndpoint).mockResolvedValue({
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Webhook endpoint not found',
      },
    } as any);
    vi.mocked(webhookEndpointService.createWebhookEndpoint).mockResolvedValue({
      data: {
        endpoint: {
          id: 'endpoint-1',
          agencyId: 'agency-1',
          url: 'https://example.com/webhooks',
          status: 'active',
          subscribedEvents: ['webhook.test'],
          failureCount: 0,
          secretLastFour: '1234',
          lastDeliveredAt: null,
          lastFailedAt: null,
          createdAt: '2026-03-08T00:00:00.000Z',
          updatedAt: '2026-03-08T00:00:00.000Z',
        },
        signingSecret: 'secret_123',
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'PUT',
      url: '/api/agencies/agency-1/webhook-endpoint',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      payload: {
        url: 'https://example.com/webhooks',
        subscribedEvents: ['webhook.test'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(webhookEndpointService.createWebhookEndpoint).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      url: 'https://example.com/webhooks',
      subscribedEvents: ['webhook.test'],
      createdBy: expect.any(String),
    });
  });

  it('updates a webhook endpoint when one already exists', async () => {
    vi.mocked(webhookEndpointService.getWebhookEndpoint).mockResolvedValue({
      data: {
        endpoint: {
          id: 'endpoint-1',
          agencyId: 'agency-1',
        },
      },
      error: null,
    } as any);
    vi.mocked(webhookEndpointService.updateWebhookEndpoint).mockResolvedValue({
      data: {
        endpoint: {
          id: 'endpoint-1',
          agencyId: 'agency-1',
          url: 'https://example.com/new-webhooks',
          status: 'active',
          subscribedEvents: ['access_request.completed'],
          failureCount: 0,
          secretLastFour: '1234',
          lastDeliveredAt: null,
          lastFailedAt: null,
          createdAt: '2026-03-08T00:00:00.000Z',
          updatedAt: '2026-03-08T00:00:00.000Z',
        },
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'PUT',
      url: '/api/agencies/agency-1/webhook-endpoint',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      payload: {
        url: 'https://example.com/new-webhooks',
        subscribedEvents: ['access_request.completed'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(webhookEndpointService.updateWebhookEndpoint).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      url: 'https://example.com/new-webhooks',
      subscribedEvents: ['access_request.completed'],
      updatedBy: expect.any(String),
    });
  });

  it('rotates the webhook signing secret', async () => {
    vi.mocked(webhookEndpointService.rotateWebhookEndpointSecret).mockResolvedValue({
      data: {
        endpoint: {
          id: 'endpoint-1',
        },
        signingSecret: 'secret_rotated',
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/api/agencies/agency-1/webhook-endpoint/rotate-secret',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(webhookEndpointService.rotateWebhookEndpointSecret).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      rotatedBy: expect.any(String),
      // Dashboard preserves destructive rotation: old secret revoked at once.
      immediate: true,
    });
  });

  it('disables the webhook endpoint', async () => {
    vi.mocked(webhookEndpointService.disableWebhookEndpoint).mockResolvedValue({
      data: {
        endpoint: {
          id: 'endpoint-1',
          status: 'disabled',
        },
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/api/agencies/agency-1/webhook-endpoint/disable',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(webhookEndpointService.disableWebhookEndpoint).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      disabledBy: expect.any(String),
    });
  });

  it('queues a webhook test event', async () => {
    vi.mocked(webhookManagementService.sendWebhookTestEvent).mockResolvedValue({
      data: {
        eventId: 'event-1',
        queued: true,
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/api/agencies/agency-1/webhook-endpoint/test',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(webhookManagementService.sendWebhookTestEvent).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      requestedBy: expect.any(String),
    });
  });

  it('lists recent webhook deliveries for the principal agency', async () => {
    vi.mocked(webhookManagementService.listWebhookDeliveries).mockResolvedValue({
      data: {
        endpoint: {
          id: 'endpoint-1',
          status: 'active',
        },
        deliveries: [
          {
            id: 'delivery-1',
            eventId: 'event-1',
            eventType: 'access_request.completed',
            status: 'delivered',
            attemptNumber: 1,
            responseStatus: 200,
            errorMessage: null,
            createdAt: '2026-03-08T00:00:00.000Z',
            deliveredAt: '2026-03-08T00:00:01.000Z',
            nextAttemptAt: null,
          },
        ],
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/api/agencies/agency-1/webhook-deliveries?limit=10',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(webhookManagementService.listWebhookDeliveries).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      limit: 10,
    });
  });

  it('returns 500 when listing webhook deliveries hits an internal error', async () => {
    vi.mocked(webhookManagementService.listWebhookDeliveries).mockResolvedValue({
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list webhook deliveries',
      },
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/api/agencies/agency-1/webhook-deliveries?limit=8',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list webhook deliveries',
      },
    });
  });

  it('returns 403 when the requested agency does not match the principal agency', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/agencies/agency-2/webhook-endpoint',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(webhookEndpointService.getWebhookEndpoint).not.toHaveBeenCalled();
  });

  describe('preferredApiVersion', () => {
    it('passes preferredApiVersion to createWebhookEndpoint when provided', async () => {
      vi.mocked(webhookEndpointService.getWebhookEndpoint).mockResolvedValue({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      } as any);
      vi.mocked(webhookEndpointService.createWebhookEndpoint).mockResolvedValue({
        data: {
          endpoint: {
            id: 'endpoint-1',
            agencyId: 'agency-1',
            url: 'https://example.com/webhooks',
            status: 'active',
            subscribedEvents: ['access_request.completed'],
            preferredApiVersion: '2026-03-19',
            failureCount: 0,
            secretLastFour: 'abcd',
            createdAt: '2026-03-19T00:00:00.000Z',
            updatedAt: '2026-03-19T00:00:00.000Z',
          },
          signingSecret: 'secret_v2',
        },
        error: null,
      } as any);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/agencies/agency-1/webhook-endpoint',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        payload: {
          url: 'https://example.com/webhooks',
          subscribedEvents: ['access_request.completed'],
          preferredApiVersion: '2026-03-19',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(webhookEndpointService.createWebhookEndpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          agencyId: 'agency-1',
          preferredApiVersion: '2026-03-19',
        }),
      );
    });

    it('passes preferredApiVersion to updateWebhookEndpoint when provided', async () => {
      vi.mocked(webhookEndpointService.getWebhookEndpoint).mockResolvedValue({
        data: { endpoint: { id: 'endpoint-1', agencyId: 'agency-1' } },
        error: null,
      } as any);
      vi.mocked(webhookEndpointService.updateWebhookEndpoint).mockResolvedValue({
        data: {
          endpoint: {
            id: 'endpoint-1',
            agencyId: 'agency-1',
            url: 'https://example.com/webhooks',
            status: 'active',
            subscribedEvents: ['access_request.completed'],
            preferredApiVersion: '2026-03-19',
            failureCount: 0,
            secretLastFour: 'abcd',
            createdAt: '2026-03-19T00:00:00.000Z',
            updatedAt: '2026-03-19T00:00:00.000Z',
          },
        },
        error: null,
      } as any);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/agencies/agency-1/webhook-endpoint',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        payload: {
          url: 'https://example.com/webhooks',
          subscribedEvents: ['access_request.completed'],
          preferredApiVersion: '2026-03-19',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(webhookEndpointService.updateWebhookEndpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          agencyId: 'agency-1',
          preferredApiVersion: '2026-03-19',
        }),
      );
    });

    it('omits preferredApiVersion when not provided', async () => {
      vi.mocked(webhookEndpointService.getWebhookEndpoint).mockResolvedValue({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      } as any);
      vi.mocked(webhookEndpointService.createWebhookEndpoint).mockResolvedValue({
        data: {
          endpoint: {
            id: 'endpoint-1',
            agencyId: 'agency-1',
            url: 'https://example.com/webhooks',
            status: 'active',
            subscribedEvents: ['webhook.test'],
            preferredApiVersion: '2026-03-08',
            failureCount: 0,
            createdAt: '2026-03-08T00:00:00.000Z',
            updatedAt: '2026-03-08T00:00:00.000Z',
          },
          signingSecret: 'secret_v1',
        },
        error: null,
      } as any);

      await app.inject({
        method: 'PUT',
        url: '/api/agencies/agency-1/webhook-endpoint',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        payload: {
          url: 'https://example.com/webhooks',
          subscribedEvents: ['webhook.test'],
        },
      });

      expect(webhookEndpointService.createWebhookEndpoint).toHaveBeenCalledWith(
        expect.not.objectContaining({
          preferredApiVersion: expect.anything(),
        }),
      );
    });
  });
});
