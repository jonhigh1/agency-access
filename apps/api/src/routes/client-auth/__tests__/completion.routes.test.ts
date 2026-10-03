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

  it('returns 409 and does not notify when fulfillment is partial', async () => {
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

  it('returns success without notifying from the route when fulfillment completes', async () => {
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

    const response = await app.inject({ method: 'POST', url: '/client/token-1/complete' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.success).toBe(true);
    expect(notificationService.queueNotification).not.toHaveBeenCalled();
    await app.close();
  });

  it('never notifies from the route even when the request was already completed', async () => {
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
