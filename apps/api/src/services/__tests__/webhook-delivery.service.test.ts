import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '@/lib/env';
import { infisical } from '@/lib/infisical';
import { prisma } from '@/lib/prisma';
import { signWebhookPayload } from '@/lib/webhook-signature';
import { deliverWebhookEvent } from '@/services/webhook-delivery.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: {
      findUnique: vi.fn(),
    },
    webhookDelivery: {
      create: vi.fn(),
      update: vi.fn(),
    },
    webhookEndpoint: {
      update: vi.fn(),
    },
    $transaction: vi.fn((ops: any) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
  },
}));

vi.mock('@/lib/infisical', () => ({
  infisical: {
    getPlainSecret: vi.fn(),
    deleteSecret: vi.fn(),
  },
}));

describe('webhook-delivery.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    vi.mocked(infisical.getPlainSecret).mockResolvedValue('whsec_outbound_secret');
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({
      id: 'event-1',
      type: 'access_request.completed',
      payload: {
        id: 'evt_test_1',
        type: 'access_request.completed',
        apiVersion: '2026-03-08',
        createdAt: '2026-03-08T00:00:00.000Z',
        data: {
          accessRequest: {
            id: 'request-1',
          },
        },
      },
      endpoint: {
        id: 'endpoint-1',
        agencyId: 'agency-1',
        url: 'https://example.com/webhooks',
        secretId: 'webhook_token_endpoint-1',
        status: 'active',
        failureCount: 0,
      },
    } as any);
    vi.mocked(prisma.webhookDelivery.create).mockImplementation(async ({ data }: any) => ({
      id: data.id,
      eventId: data.eventId,
      endpointId: data.endpointId,
      attemptNumber: data.attemptNumber,
      status: data.status,
      createdAt: new Date('2026-03-08T00:00:00.000Z'),
    }));
    vi.mocked(prisma.webhookDelivery.update).mockResolvedValue({
      id: 'delivery-1',
      status: 'delivered',
    } as any);
    vi.mocked(prisma.webhookEndpoint.update).mockResolvedValue({
      id: 'endpoint-1',
      status: 'active',
      failureCount: 0,
    } as any);
  });

  it('creates a delivery attempt, signs the payload, and marks 2xx responses as delivered', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => '',
    } as Response);

    const result = await deliverWebhookEvent({
      eventId: 'event-1',
      attemptNumber: 1,
    });

    expect(result.error).toBeNull();
    expect(prisma.webhookDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        endpointId: 'endpoint-1',
        eventId: 'event-1',
        attemptNumber: 1,
        status: 'pending',
        requestHeaders: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-AgencyAccess-Event': 'access_request.completed',
          'X-AgencyAccess-Delivery-Id': expect.any(String),
          'X-AgencyAccess-Signature': expect.stringMatching(/^v1=[a-f0-9]{64}$/),
          'X-AgencyAccess-Timestamp': expect.any(String),
        }),
      }),
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/webhooks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          id: 'evt_test_1',
          type: 'access_request.completed',
          apiVersion: '2026-03-08',
          createdAt: '2026-03-08T00:00:00.000Z',
          data: {
            accessRequest: {
              id: 'request-1',
            },
          },
        }),
      })
    );
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({
        status: 'delivered',
        responseStatus: 204,
        deliveredAt: expect.any(Date),
        nextAttemptAt: null,
      }),
    });
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
      where: { id: 'endpoint-1' },
      data: expect.objectContaining({
        failureCount: 0,
        status: 'active',
        lastDeliveredAt: expect.any(Date),
        disabledAt: null,
      }),
    });
  });

  it('marks 5xx responses as retryable failures and schedules another attempt', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'temporarily unavailable',
    } as Response);

    const result = await deliverWebhookEvent({
      eventId: 'event-1',
      attemptNumber: 2,
    });

    expect(result.data?.retryable).toBe(true);
    expect(result.error?.code).toBe('DELIVERY_FAILED');
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({
        status: 'failed',
        responseStatus: 503,
        responseBodySnippet: 'temporarily unavailable',
        nextAttemptAt: expect.any(Date),
      }),
    });
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
      where: { id: 'endpoint-1' },
      data: expect.objectContaining({
        failureCount: 1,
        status: 'active',
        lastFailedAt: expect.any(Date),
      }),
    });
  });

  it('disables the endpoint after repeated retryable failures reach the threshold', async () => {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({
      id: 'event-1',
      type: 'access_request.completed',
      payload: {
        id: 'evt_test_1',
      },
      endpoint: {
        id: 'endpoint-1',
        agencyId: 'agency-1',
        url: 'https://example.com/webhooks',
        secretId: 'webhook_token_endpoint-1',
        status: 'active',
        failureCount: env.WEBHOOK_FAILURE_DISABLE_THRESHOLD - 1,
      },
    } as any);
    vi.mocked(fetch).mockRejectedValue(new Error('connect ETIMEDOUT'));

    const result = await deliverWebhookEvent({
      eventId: 'event-1',
      attemptNumber: 1,
    });

    expect(result.error?.code).toBe('DELIVERY_FAILED');
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
      where: { id: 'endpoint-1' },
      data: expect.objectContaining({
        failureCount: env.WEBHOOK_FAILURE_DISABLE_THRESHOLD,
        status: 'disabled',
        disabledAt: expect.any(Date),
      }),
    });
  });

  it('records non-retryable 4xx responses without scheduling another attempt', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    } as Response);

    const result = await deliverWebhookEvent({
      eventId: 'event-1',
      attemptNumber: 1,
    });

    expect(result.data?.retryable).toBe(false);
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: expect.objectContaining({
        status: 'failed',
        responseStatus: 400,
        responseBodySnippet: 'bad request',
        nextAttemptAt: null,
      }),
    });
  });

  it('signs with both current and pending secrets during a live rotation overlap', async () => {
    const currentSecret = 'whsec_current';
    const pendingSecret = 'whsec_pending';
    vi.mocked(infisical.getPlainSecret).mockImplementation(async (secretId: string) => {
      if (secretId === 'webhook_token_endpoint-1') return currentSecret;
      if (secretId === 'webhook_token_endpoint-1_pending') return pendingSecret;
      throw new Error(`unknown secret ${secretId}`);
    });
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({
      id: 'event-1',
      type: 'access_request.completed',
      payload: { id: 'evt_test_1', type: 'access_request.completed' },
      endpoint: {
        id: 'endpoint-1',
        agencyId: 'agency-1',
        url: 'https://example.com/webhooks',
        secretId: 'webhook_token_endpoint-1',
        pendingSecretId: 'webhook_token_endpoint-1_pending',
        pendingSecretExpiresAt: new Date(Date.now() + 60_000),
        status: 'active',
        failureCount: 0,
      },
    } as any);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => '',
    } as Response);

    const result = await deliverWebhookEvent({ eventId: 'event-1', attemptNumber: 1 });

    expect(result.error).toBeNull();
    const headers = vi.mocked(prisma.webhookDelivery.create).mock.calls[0][0].data.requestHeaders;
    const payload = JSON.stringify({ id: 'evt_test_1', type: 'access_request.completed' });
    const timestamp = headers['X-AgencyAccess-Timestamp'];
    expect(headers['X-AgencyAccess-Signature']).toBe(
      signWebhookPayload(payload, currentSecret, timestamp),
    );
    expect(headers['X-AgencyAccess-Pending-Signature']).toBe(
      signWebhookPayload(payload, pendingSecret, timestamp),
    );
    expect(prisma.webhookEndpoint.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pendingSecretId: null }),
      }),
    );
  });

  it('promotes an expired pending secret to active and drops the superseded Infisical secret', async () => {
    const currentSecret = 'whsec_old';
    const pendingSecret = 'whsec_new';
    vi.mocked(infisical.getPlainSecret).mockImplementation(async (secretId: string) => {
      if (secretId === 'webhook_token_endpoint-1') return currentSecret;
      if (secretId === 'webhook_token_endpoint-1_pending') return pendingSecret;
      throw new Error(`unknown secret ${secretId}`);
    });
    vi.mocked(infisical.deleteSecret).mockResolvedValue(undefined as any);
    vi.mocked(prisma.webhookEndpoint.update).mockResolvedValue({
      id: 'endpoint-1',
      secretId: 'webhook_token_endpoint-1_pending',
      pendingSecretId: null,
      pendingSecretExpiresAt: null,
      status: 'active',
      failureCount: 0,
    } as any);
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({
      id: 'event-1',
      type: 'access_request.completed',
      payload: { id: 'evt_test_1', type: 'access_request.completed' },
      endpoint: {
        id: 'endpoint-1',
        agencyId: 'agency-1',
        url: 'https://example.com/webhooks',
        secretId: 'webhook_token_endpoint-1',
        pendingSecretId: 'webhook_token_endpoint-1_pending',
        pendingSecretExpiresAt: new Date(Date.now() - 1_000),
        status: 'active',
        failureCount: 0,
      },
    } as any);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => '',
    } as Response);

    const result = await deliverWebhookEvent({ eventId: 'event-1', attemptNumber: 1 });

    expect(result.error).toBeNull();
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
      where: { id: 'endpoint-1' },
      data: {
        secretId: 'webhook_token_endpoint-1_pending',
        pendingSecretId: null,
        pendingSecretExpiresAt: null,
      },
    });
    expect(infisical.deleteSecret).toHaveBeenCalledWith('webhook_token_endpoint-1');
    const headers = vi.mocked(prisma.webhookDelivery.create).mock.calls[0][0].data.requestHeaders;
    expect(headers['X-AgencyAccess-Pending-Signature']).toBeUndefined();
    expect(headers['X-AgencyAccess-Signature']).toMatch(/^v1=[a-f0-9]{64}$/);
  });
});
