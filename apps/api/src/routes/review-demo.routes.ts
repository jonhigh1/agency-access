import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ReviewDemoStepIdSchema } from '@agency-platform/shared';
import { authenticate } from '@/middleware/auth.js';
import { resolveAuthenticatedUserEmail } from '@/lib/authorization.js';
import { resolveLabReviewAccess } from '@/lib/lab-review-auth.js';
import { sendError, sendValidationError } from '@/lib/response.js';
import { extractClientIp, extractUserAgent } from '@/lib/ip.js';
import { reviewDemoService } from '@/services/review-demo.service.js';
import { z } from 'zod';

const exchangeBodySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const pauseBodySchema = z.object({
  adId: z.string().optional(),
});

async function requireLabReview(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const authMiddleware = authenticate();
  await authMiddleware(request, reply);
  if (reply.sent) return false;

  const labResult = await resolveLabReviewAccess((request as any).user);
  if (labResult.error) {
    const statusCode =
      labResult.error.code === 'UNAUTHORIZED'
        ? 401
        : labResult.error.code === 'FEATURE_DISABLED'
          ? 404
          : 403;
    return reply.code(statusCode).send({ data: null, error: labResult.error });
  }

  (request as any).labReviewUser = labResult.data;
  return true;
}

export async function reviewDemoRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    await requireLabReview(request, reply);
  });

  fastify.get('/review-demo/session', async (request, reply) => {
    const labUser = (request as any).labReviewUser as { userId: string };
    const query = request.query as { step?: string };
    const stepParsed = ReviewDemoStepIdSchema.safeParse(query.step ?? 'pages_show_list');
    if (!stepParsed.success) {
      return sendValidationError(reply, 'Invalid review demo step');
    }

    const session = await reviewDemoService.getSession(labUser.userId, stepParsed.data);
    return reply.send({ data: session, error: null });
  });

  fastify.get('/review-demo/steps/:stepId', async (request, reply) => {
    const labUser = (request as any).labReviewUser as { userId: string };
    const params = request.params as { stepId?: string };
    const stepParsed = ReviewDemoStepIdSchema.safeParse(params.stepId);
    if (!stepParsed.success) {
      return sendValidationError(reply, 'Invalid review demo step');
    }

    const userEmail = (await resolveAuthenticatedUserEmail((request as any).user)) ?? 'review-demo@unknown';
    try {
      const payload = await reviewDemoService.loadStepPayload({
        clerkUserId: labUser.userId,
        userEmail,
        stepId: stepParsed.data,
        ipAddress: extractClientIp(request),
        userAgent: extractUserAgent(request),
      });
      return reply.send({ data: payload, error: null });
    } catch (error) {
      return sendError(
        reply,
        'REVIEW_DEMO_STEP_FAILED',
        error instanceof Error ? error.message : 'Failed to load review demo step',
        502
      );
    }
  });

  fastify.get('/review-demo/meta/oauth-flow', async (request, reply) => {
    const query = request.query as { state?: string };
    if (!query.state?.trim()) {
      return sendValidationError(reply, 'Missing OAuth state');
    }

    const reviewDemo = await reviewDemoService.isReviewDemoOAuthState(query.state);
    return reply.send({ data: { reviewDemo }, error: null });
  });

  fastify.post('/review-demo/meta/initiate', async (request, reply) => {
    const labUser = (request as any).labReviewUser as { userId: string };
    const userEmail = (await resolveAuthenticatedUserEmail((request as any).user)) ?? 'review-demo@unknown';

    try {
      const result = await reviewDemoService.createMetaAuthUrl({
        clerkUserId: labUser.userId,
        userEmail,
        headers: request.headers,
      });
      return reply.send({ data: result, error: null });
    } catch (error) {
      return sendError(
        reply,
        'REVIEW_DEMO_OAUTH_INIT_FAILED',
        error instanceof Error ? error.message : 'Failed to start Meta OAuth',
        500
      );
    }
  });

  fastify.post('/review-demo/meta/exchange', async (request, reply) => {
    const labUser = (request as any).labReviewUser as { userId: string };
    const parsed = exchangeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(reply, 'Invalid OAuth exchange payload');
    }

    const userEmail = (await resolveAuthenticatedUserEmail((request as any).user)) ?? 'review-demo@unknown';
    try {
      const identity = await reviewDemoService.completeMetaOAuth({
        clerkUserId: labUser.userId,
        userEmail,
        code: parsed.data.code,
        state: parsed.data.state,
        ipAddress: extractClientIp(request),
        userAgent: extractUserAgent(request),
      });
      return reply.send({ data: { identity }, error: null });
    } catch (error) {
      return sendError(
        reply,
        'REVIEW_DEMO_OAUTH_EXCHANGE_FAILED',
        error instanceof Error ? error.message : 'Failed to complete Meta OAuth',
        400
      );
    }
  });

  fastify.post('/review-demo/steps/ads_management/pause', async (request, reply) => {
    const labUser = (request as any).labReviewUser as { userId: string };
    const parsed = pauseBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendValidationError(reply, 'Invalid pause payload');
    }

    const userEmail = (await resolveAuthenticatedUserEmail((request as any).user)) ?? 'review-demo@unknown';
    try {
      const result = await reviewDemoService.pauseTestAd({
        clerkUserId: labUser.userId,
        userEmail,
        adId: parsed.data.adId,
        ipAddress: extractClientIp(request),
        userAgent: extractUserAgent(request),
      });
      return reply.send({ data: result, error: null });
    } catch (error) {
      return sendError(
        reply,
        'REVIEW_DEMO_PAUSE_FAILED',
        error instanceof Error ? error.message : 'Failed to pause test ad',
        502
      );
    }
  });

  fastify.post('/review-demo/steps/ads_management/resume', async (request, reply) => {
    const labUser = (request as any).labReviewUser as { userId: string };
    const parsed = pauseBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendValidationError(reply, 'Invalid resume payload');
    }

    const userEmail = (await resolveAuthenticatedUserEmail((request as any).user)) ?? 'review-demo@unknown';
    try {
      const result = await reviewDemoService.resumeTestAd({
        clerkUserId: labUser.userId,
        userEmail,
        adId: parsed.data.adId,
        ipAddress: extractClientIp(request),
        userAgent: extractUserAgent(request),
      });
      return reply.send({ data: result, error: null });
    } catch (error) {
      return sendError(
        reply,
        'REVIEW_DEMO_RESUME_FAILED',
        error instanceof Error ? error.message : 'Failed to resume test ad',
        502
      );
    }
  });
}
