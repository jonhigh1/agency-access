import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { authenticate, optionalAuthenticate } from '../auth.js';
import { performanceOnRequest, performanceOnSend } from '../performance.js';
import { buildAuthenticatedRateLimitAllowList } from '../rate-limit-auth.js';

const { verifyTokenMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  verifyToken: verifyTokenMock,
}));

describe('authenticated rate-limit bypass', () => {
  beforeEach(() => {
    verifyTokenMock.mockReset();
  });

  it('verifies bearer auth once across pre-auth, rate-limit bypass, and route auth', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'user_verified' });

    const app = Fastify();
    app.addHook('onRequest', performanceOnRequest);
    app.addHook('onRequest', optionalAuthenticate());
    await app.register(rateLimit, {
      global: true,
      max: 10,
      timeWindow: 60_000,
      allowList: buildAuthenticatedRateLimitAllowList(),
    });
    app.addHook('onSend', performanceOnSend);

    app.get('/protected', {
      onRequest: [authenticate()],
    }, async (request) => ({
      data: { principalId: (request as any).user?.sub },
      error: null,
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer valid_token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.principalId).toBe('user_verified');
    expect(verifyTokenMock).toHaveBeenCalledTimes(1);

    const serverTiming = String(response.headers['server-timing'] || '');
    expect(serverTiming).toContain('auth;dur=');

    await app.close();
  });
});
