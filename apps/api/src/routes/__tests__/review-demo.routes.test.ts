import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewDemoRoutes } from '../review-demo.routes.js';

vi.mock('@/middleware/auth.js', () => ({
  authenticate: () => async (request: any) => {
    request.user = { sub: 'user_3KLeCX4cZ6OTWYjNm8Y9Z5dqdnC', email: 'jon.highmu+lab-reviewer@gmail.com' };
  },
}));

vi.mock('@/lib/lab-review-auth.js', () => ({
  resolveLabReviewAccess: vi.fn(async () => ({
    data: { userId: 'user_3KLeCX4cZ6OTWYjNm8Y9Z5dqdnC', email: 'jon.highmu+lab-reviewer@gmail.com' },
    error: null,
  })),
}));

vi.mock('@/lib/authorization.js', () => ({
  resolveAuthenticatedUserEmail: vi.fn(async () => 'jon.highmu+lab-reviewer@gmail.com'),
}));

vi.mock('@/services/review-demo.service.js', () => ({
  reviewDemoService: {
    getSession: vi.fn(async () => ({
      connected: true,
      identity: { id: '61595281164997', name: 'Alex Reviewer' },
      grantedPermissions: ['pages_show_list', 'pages_read_engagement', 'ads_management', 'business_management'],
      activeStep: 'pages_show_list',
      stepIndex: 0,
      stepCount: 4,
      sandbox: {
        businessManagerId: '695982475048959',
        adAccountId: 'act_557538895783894',
        pageId: '61595193599205',
        agencyBusinessId: '3808519629379919',
      },
    })),
    loadStepPayload: vi.fn(async () => ({
      stepId: 'pages_show_list',
      pages: [{ id: '61595193599205', name: 'Ah-Review-Page' }],
      graphCaptions: ['GET /me/accounts'],
    })),
  },
}));

describe('review-demo routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(reviewDemoRoutes, { prefix: '/api' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns session payload for lab users', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/review-demo/session?step=pages_show_list',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { connected: boolean } };
    expect(body.data.connected).toBe(true);
  });

  it('returns step proof payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/review-demo/steps/pages_show_list',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { stepId: string } };
    expect(body.data.stepId).toBe('pages_show_list');
  });
});
