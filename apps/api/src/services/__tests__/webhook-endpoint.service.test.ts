import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { lookup } from 'node:dns/promises';
import { infisical } from '@/lib/infisical';
import { auditService } from '@/services/audit.service';
import {
  createWebhookEndpoint,
  disableWebhookEndpoint,
  getWebhookEndpoint,
  rotateWebhookEndpointSecret,
  updateWebhookEndpoint,
} from '@/services/webhook-endpoint.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEndpoint: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

vi.mock('@/lib/infisical', () => ({
  infisical: {
    storePlainSecret: vi.fn(),
    deleteSecret: vi.fn().mockResolvedValue(undefined),
    generateSecretName: vi.fn((platform: string, id: string) => `${platform}_token_${id}`),
  },
}));

vi.mock('@/services/audit.service', () => ({
  auditService: {
    createAuditLog: vi.fn(),
  },
}));

describe('webhook-endpoint.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Creation/update URL checks fail open on resolver errors.
    vi.mocked(lookup).mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
  });

  it('creates a single webhook endpoint for an agency and stores the secret in Infisical', async () => {
    vi.mocked(prisma.webhookEndpoint.create).mockResolvedValue({
      id: 'endpoint-1',
      agencyId: 'agency-1',
      url: 'https://example.com/webhook',
      status: 'active',
      subscribedEvents: ['access_request.partial', 'access_request.completed'],
      failureCount: 0,
      secretId: 'webhook_token_endpoint-1',
      lastDeliveredAt: null,
      lastFailedAt: null,
      createdAt: new Date('2026-03-08T00:00:00.000Z'),
      updatedAt: new Date('2026-03-08T00:00:00.000Z'),
    } as any);

    const result = await createWebhookEndpoint({
      agencyId: 'agency-1',
      url: 'https://example.com/webhook',
      subscribedEvents: ['access_request.partial', 'access_request.completed'],
      createdBy: 'owner@example.com',
    });

    expect(result.error).toBeNull();
    expect(result.data?.endpoint.url).toBe('https://example.com/webhook');
    expect(result.data?.signingSecret).toHaveLength(64);
    expect(infisical.storePlainSecret).toHaveBeenCalledWith(
      expect.stringMatching(/^webhook_token_/),
      expect.any(String)
    );
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        action: 'WEBHOOK_ENDPOINT_CREATED',
        resourceType: 'webhook_endpoint',
        resourceId: 'endpoint-1',
      })
    );
  });

  it('rejects creating a second webhook endpoint for the same agency', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'endpoint-existing',
      agencyId: 'agency-1',
      url: 'https://example.com/webhook',
      secretId: 'webhook_token_endpoint-existing',
    } as any);

    const result = await createWebhookEndpoint({
      agencyId: 'agency-1',
      url: 'https://example.com/another-webhook',
      subscribedEvents: ['access_request.completed'],
      createdBy: 'owner@example.com',
    });

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      code: 'WEBHOOK_ENDPOINT_EXISTS',
      message: 'A webhook endpoint already exists for this agency',
    });
    expect(prisma.webhookEndpoint.create).not.toHaveBeenCalled();
    expect(infisical.storePlainSecret).not.toHaveBeenCalled();
    expect(auditService.createAuditLog).not.toHaveBeenCalled();
  });

  it('returns the existing endpoint summary without exposing secret material', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'endpoint-1',
      agencyId: 'agency-1',
      url: 'https://example.com/webhook',
      status: 'active',
      subscribedEvents: ['access_request.completed'],
      failureCount: 2,
      secretId: 'webhook_token_endpoint-1',
      lastDeliveredAt: new Date('2026-03-08T01:00:00.000Z'),
      lastFailedAt: new Date('2026-03-08T02:00:00.000Z'),
      createdAt: new Date('2026-03-08T00:00:00.000Z'),
      updatedAt: new Date('2026-03-08T02:00:00.000Z'),
    } as any);

    const result = await getWebhookEndpoint('agency-1');

    expect(result.error).toBeNull();
    expect(result.data?.signingSecret).toBeUndefined();
    expect(result.data?.endpoint.secretLastFour).toBe('nt-1');
  });

  it('returns INTERNAL_ERROR when endpoint lookup fails unexpectedly', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockRejectedValue(new Error('relation "webhook_endpoints" does not exist'));

    const result = await getWebhookEndpoint('agency-1');

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch webhook endpoint',
    });
  });

  it('updates the existing endpoint settings for an agency', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'endpoint-1',
      agencyId: 'agency-1',
      secretId: 'webhook_token_endpoint-1',
    } as any);
    vi.mocked(prisma.webhookEndpoint.update).mockResolvedValue({
      id: 'endpoint-1',
      agencyId: 'agency-1',
      url: 'https://example.com/new-webhook',
      status: 'active',
      subscribedEvents: ['webhook.test'],
      failureCount: 0,
      secretId: 'webhook_token_endpoint-1',
      lastDeliveredAt: null,
      lastFailedAt: null,
      createdAt: new Date('2026-03-08T00:00:00.000Z'),
      updatedAt: new Date('2026-03-08T03:00:00.000Z'),
    } as any);

    const result = await updateWebhookEndpoint({
      agencyId: 'agency-1',
      url: 'https://example.com/new-webhook',
      subscribedEvents: ['webhook.test'],
      updatedBy: 'owner@example.com',
    });

    expect(result.error).toBeNull();
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
      where: { id: 'endpoint-1' },
      data: expect.objectContaining({
        url: 'https://example.com/new-webhook',
        subscribedEvents: ['webhook.test'],
      }),
    });
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WEBHOOK_ENDPOINT_UPDATED',
      })
    );
  });

  it('rotates the endpoint signing secret and deletes the previous secret reference', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'endpoint-1',
      agencyId: 'agency-1',
      secretId: 'webhook_token_endpoint-1',
    } as any);
    vi.mocked(prisma.webhookEndpoint.update).mockResolvedValue({
      id: 'endpoint-1',
      agencyId: 'agency-1',
      url: 'https://example.com/webhook',
      status: 'active',
      subscribedEvents: ['access_request.completed'],
      failureCount: 0,
      secretId: 'webhook_token_endpoint-1_rotated',
      lastDeliveredAt: null,
      lastFailedAt: null,
      createdAt: new Date('2026-03-08T00:00:00.000Z'),
      updatedAt: new Date('2026-03-08T04:00:00.000Z'),
    } as any);

    const result = await rotateWebhookEndpointSecret({
      agencyId: 'agency-1',
      rotatedBy: 'owner@example.com',
      // Dashboard semantic: immediate revocation, as the dashboard route passes.
      immediate: true,
    });

    expect(result.error).toBeNull();
    expect(result.data?.signingSecret).toHaveLength(64);
    expect(infisical.storePlainSecret).toHaveBeenCalledWith(
      'webhook_token_endpoint-1_rotated',
      expect.any(String)
    );
    expect(infisical.deleteSecret).toHaveBeenCalledWith('webhook_token_endpoint-1');
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WEBHOOK_ENDPOINT_SECRET_ROTATED',
      })
    );
  });

  it('disables an existing endpoint', async () => {
    vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
      id: 'endpoint-1',
      agencyId: 'agency-1',
      secretId: 'webhook_token_endpoint-1',
    } as any);
    vi.mocked(prisma.webhookEndpoint.update).mockResolvedValue({
      id: 'endpoint-1',
      agencyId: 'agency-1',
      url: 'https://example.com/webhook',
      status: 'disabled',
      subscribedEvents: ['access_request.completed'],
      failureCount: 0,
      secretId: 'webhook_token_endpoint-1',
      disabledAt: new Date('2026-03-08T05:00:00.000Z'),
      lastDeliveredAt: null,
      lastFailedAt: null,
      createdAt: new Date('2026-03-08T00:00:00.000Z'),
      updatedAt: new Date('2026-03-08T05:00:00.000Z'),
    } as any);

    const result = await disableWebhookEndpoint({
      agencyId: 'agency-1',
      disabledBy: 'owner@example.com',
    });

    expect(result.error).toBeNull();
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({
      where: { id: 'endpoint-1' },
      data: expect.objectContaining({
        status: 'disabled',
        disabledAt: expect.any(Date),
      }),
    });
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WEBHOOK_ENDPOINT_DISABLED',
      })
    );
  });
});
