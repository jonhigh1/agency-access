import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerCompletionRoutes } from '../completion.routes.js';
import { accessRequestService } from '@/services/access-request.service';
import { notificationService } from '@/services/notification.service';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getAccessRequestByToken: vi.fn(),
    markRequestAuthorized: vi.fn(),
  },
}));

vi.mock('@/services/notification.service', () => ({
  notificationService: {
    queueNotification: vi.fn(),
  },
}));

describe('Client completion routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    app = Fastify();
    await registerCompletionRoutes(app);

    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        authorizationProgress: { completedPlatforms: ['meta'] },
      } as any,
      error: null,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('queues one agency notification on first completion', async () => {
    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: { id: 'request-1', status: 'completed' },
      error: null,
      previousStatus: 'partial',
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/complete',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: { success: true, message: 'Authorization complete' },
      error: null,
    });
    expect(notificationService.queueNotification).toHaveBeenCalledTimes(1);
    expect(notificationService.queueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        accessRequestId: 'request-1',
        clientEmail: 'client@example.com',
      })
    );
  });

  it('does not enqueue a second notification when the request was already completed', async () => {
    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: { id: 'request-1', status: 'completed' },
      error: null,
      previousStatus: 'completed',
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/complete',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: { success: true, message: 'Authorization complete' },
      error: null,
    });
    expect(notificationService.queueNotification).not.toHaveBeenCalled();
  });
});
