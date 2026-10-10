import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, infisicalMock, assertHostMock } = vi.hoisted(() => ({
  prismaMock: {
    webhookEvent: { findUnique: vi.fn() },
    webhookDelivery: { create: vi.fn(), update: vi.fn() },
    webhookEndpoint: { update: vi.fn() },
    $transaction: vi.fn((ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
  },
  infisicalMock: { getPlainSecret: vi.fn() },
  assertHostMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/infisical', () => ({ infisical: infisicalMock }));
vi.mock('@/lib/webhook-signature', () => ({
  signWebhookPayload: vi.fn(() => 'test-signature'),
}));
vi.mock('@/lib/env', () => ({
  env: {
    WEBHOOK_DELIVERY_TIMEOUT_MS: 40,
    WEBHOOK_MAX_ATTEMPTS: 3,
    WEBHOOK_FAILURE_DISABLE_THRESHOLD: 5,
  },
}));
vi.mock('@/services/webhook-endpoint.service.js', () => ({
  assertEndpointHostResolvable: assertHostMock,
}));

import { deliverWebhookEvent } from '../webhook-delivery.service.js';

const EVENT = {
  id: 'evt-1',
  type: 'lead.created',
  payload: { hello: 'world' },
  endpoint: {
    id: 'ep-1',
    status: 'active',
    url: 'https://example.com/webhooks',
    secretId: 'sec-1',
    failureCount: 0,
  },
};

describe('webhook delivery timeout', () => {
  let fetchInit: RequestInit | undefined;
  let capturedSignal: AbortSignal | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.webhookEvent.findUnique.mockResolvedValue(EVENT);
    prismaMock.webhookDelivery.create.mockResolvedValue({ id: 'del-1' });
    prismaMock.webhookDelivery.update.mockResolvedValue({});
    prismaMock.webhookEndpoint.update.mockResolvedValue({});
    infisicalMock.getPlainSecret.mockResolvedValue('secret');
    assertHostMock.mockResolvedValue({ allowed: true });

    fetchInit = undefined;
    capturedSignal = undefined;
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      fetchInit = init;
      capturedSignal = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => {
          reject(new Error('This operation was aborted'));
        });
      });
    }) as unknown as typeof fetch;
  });

  it('aborts the fetch at the configured delivery deadline', async () => {
    const startedAt = Date.now();

    const result = await deliverWebhookEvent({ eventId: 'evt-1', attemptNumber: 1 });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(true);
    // Deadline is honored: not aborted instantly, aborted within a sane window of 40ms.
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(35);
    expect(elapsed).toBeLessThan(5000);

    // Aborted fetch is classified as a retryable network failure.
    expect(result.data?.retryable).toBe(true);
    expect(result.data?.responseStatus).toBeNull();
    expect(result.error?.code).toBe('DELIVERY_FAILED');
    expect(prismaMock.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', errorCode: 'NETWORK_ERROR' }),
      })
    );
  });

  it('passes the timeout signal into the fetch request', async () => {
    await deliverWebhookEvent({ eventId: 'evt-1', attemptNumber: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/webhooks',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) })
    );
    expect(fetchInit?.signal).toBe(capturedSignal);
  });
});
