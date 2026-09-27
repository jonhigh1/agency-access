import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getAccessRequestByToken: vi.fn(),
    markRequestAuthorized: vi.fn(),
  },
}));
vi.mock('@/services/notification.service', () => ({
  notificationService: { queueNotification: vi.fn() },
}));

import { accessRequestService } from '@/services/access-request.service';
import { notificationService } from '@/services/notification.service';
import { registerCompletionRoutes } from '../completion.routes';

describe('client completion routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not claim completion or notify when fulfillment is partial', async () => {
    const app = Fastify();
    await registerCompletionRoutes(app);
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: { id: 'request-1', agencyId: 'agency-1', clientEmail: 'client@example.com' } as any,
      error: null,
    });
    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: { id: 'request-1', status: 'partial' } as any,
      error: null,
    });

    const response = await app.inject({ method: 'POST', url: '/client/token-1/complete' });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('FULFILLMENT_INCOMPLETE');
    expect(notificationService.queueNotification).not.toHaveBeenCalled();
    await app.close();
  });

  it('notifies only after the fulfillment evaluator returns completed', async () => {
    const app = Fastify();
    await registerCompletionRoutes(app);
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        authorizationProgress: { fulfilledProducts: [{ product: 'meta_ads' }] },
      } as any,
      error: null,
    });
    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: { id: 'request-1', status: 'completed' } as any,
      error: null,
    });
    vi.mocked(notificationService.queueNotification).mockResolvedValue({ data: true, error: null });

    const response = await app.inject({ method: 'POST', url: '/client/token-1/complete' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.success).toBe(true);
    expect(notificationService.queueNotification).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('does not notify again after completion', async () => {
    const app = Fastify();
    await registerCompletionRoutes(app);
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: { id: 'request-1', agencyId: 'agency-1', clientEmail: 'client@example.com' } as any,
      error: null,
    });
    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: { id: 'request-1', status: 'completed' } as any,
      error: null,
      previousStatus: 'completed',
    } as any);

    const response = await app.inject({ method: 'POST', url: '/client/token-1/complete' });

    expect(response.statusCode).toBe(200);
    expect(notificationService.queueNotification).not.toHaveBeenCalled();
    await app.close();
  });
});
