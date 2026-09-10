/**
 * Tests for the token-refresh job handler's audit mapping.
 *
 * The handler is reached through the exported registration
 * (startTokenRefreshHandlers) with a mocked registerHandler, so the real
 * closure is captured and invoked with a fake pg-boss job — no live queue.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registerHandlerMock } = vi.hoisted(() => ({
  registerHandlerMock: vi.fn(),
}));

vi.mock('@/lib/pg-boss', () => ({
  registerHandler: registerHandlerMock,
  enqueueJob: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    platformAuthorization: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/services/audit.service', () => ({
  auditService: {
    createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
}));

vi.mock('@/services/token-lifecycle.service', () => ({
  refreshClientPlatformAuthorization: vi.fn(),
}));

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    deleteExpiredRequests: vi.fn(),
  },
}));

vi.mock('@/services/webhook-delivery.service', () => ({
  webhookDeliveryService: {
    deliverWebhookEvent: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { auditService } from '@/services/audit.service';
import { refreshClientPlatformAuthorization } from '@/services/token-lifecycle.service';
import { startTokenRefreshHandlers } from '../job-handlers.js';

type RefreshResult = Awaited<ReturnType<typeof refreshClientPlatformAuthorization>>;

const AUTH_FIXTURE = {
  connectionId: 'conn-1',
  platform: 'google',
  status: 'active',
  connection: {
    id: 'conn-1',
    agencyId: 'agency-1',
    clientEmail: 'client@example.com',
  },
};

async function getTokenRefreshHandler(): Promise<
  (job: { data: { connectionId: string; platform: string }; id: string; retryCount?: number }) => Promise<void>
> {
  await startTokenRefreshHandlers();

  const registration = registerHandlerMock.mock.calls.find(([name]) => name === 'token-refresh');
  if (!registration) {
    throw new Error('token-refresh handler was not registered');
  }

  return registration[1] as never;
}

describe('token-refresh handler audit mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerHandlerMock.mockResolvedValue(undefined);
    vi.mocked(prisma.platformAuthorization.findFirst).mockResolvedValue(AUTH_FIXTURE as never);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({ data: {}, error: null } as never);
  });

  async function runHandlerWithResult(refreshResult: RefreshResult): Promise<void> {
    vi.mocked(refreshClientPlatformAuthorization).mockResolvedValue(refreshResult);

    const handler = await getTokenRefreshHandler();

    await handler({
      data: { connectionId: 'conn-1', platform: 'google' },
      id: 'job-1',
    });
  }

  it('records REFRESH_RECONNECT_REQUIRED for RECONNECT_REQUIRED', async () => {
    await runHandlerWithResult({
      data: null,
      error: { code: 'RECONNECT_REQUIRED', message: 'Google revoked the grant' },
    });

    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        resourceId: 'conn-1',
        resourceType: 'connection',
        action: 'REFRESH_RECONNECT_REQUIRED',
        userEmail: 'client@example.com',
      })
    );
  });

  it('records REFRESH_RECONNECT_REQUIRED for INVALID_TOKEN', async () => {
    await runHandlerWithResult({
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Refresh token rejected' },
    });

    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        resourceId: 'conn-1',
        resourceType: 'connection',
        action: 'REFRESH_RECONNECT_REQUIRED',
      })
    );
  });

  it('records FAILED (not reconnect) for REFRESH_RETRYABLE', async () => {
    await runHandlerWithResult({
      data: null,
      error: { code: 'REFRESH_RETRYABLE', message: 'Transient upstream error' },
    });

    const call = vi.mocked(auditService.createAuditLog).mock.calls[0][0];
    expect(call).toMatchObject({
      agencyId: 'agency-1',
      resourceId: 'conn-1',
      resourceType: 'connection',
      action: 'FAILED',
    });
    expect(call.action).not.toBe('REFRESH_RECONNECT_REQUIRED');
  });

  it('records REFRESHED on success', async () => {
    const expiresAt = new Date('2026-10-01T00:00:00.000Z');

    await runHandlerWithResult({
      data: { outcome: 'refreshed', accessToken: 'new-access-token', expiresAt },
      error: null,
    });

    expect(refreshClientPlatformAuthorization).toHaveBeenCalledWith('conn-1', 'google');
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        resourceId: 'conn-1',
        resourceType: 'connection',
        action: 'REFRESHED',
        userEmail: 'client@example.com',
        details: expect.objectContaining({
          platform: 'google',
          jobId: 'job-1',
          outcome: 'refreshed',
          expiresAt,
        }),
      })
    );
  });
});
