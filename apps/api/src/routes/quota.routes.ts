/** Quota endpoints resolve verified Clerk principals to internal agency IDs. */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MetricTypeSchema } from '@agency-platform/shared';
import { quotaService } from '@/services/quota.service';
import { authenticate } from '@/middleware/auth';
import { requirePrincipalAgency } from '@/lib/agency-guard';
import { sendError } from '@/lib/response';

const quotaCheckSchema = z.object({
  metric: MetricTypeSchema,
  requestedAmount: z.number().int().positive().optional(),
});

export async function quotaRoutes(fastify: FastifyInstance) {
  const onRequest = [authenticate(), requirePrincipalAgency];

  fastify.get('/api/quota', { onRequest }, async (request, reply) => {
    try {
      const usage = await quotaService.getUsage((request as any).principalAgencyId);
      if (!usage) return sendError(reply, 'NOT_FOUND', 'Agency not found', 404);
      return reply.send({ data: usage });
    } catch {
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch quota information', 500);
    }
  });

  fastify.post('/api/quota/check', { onRequest }, async (request, reply) => {
    const validated = quotaCheckSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid quota check input', 400, validated.error.errors);
    }

    try {
      const result = await quotaService.checkQuota({
        agencyId: (request as any).principalAgencyId,
        metric: validated.data.metric,
        action: 'create',
        requestedAmount: validated.data.requestedAmount ?? 1,
      });
      return reply.send({ data: result });
    } catch {
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to check quota', 500);
    }
  });
}
