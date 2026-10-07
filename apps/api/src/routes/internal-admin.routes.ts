import type { FastifyInstance } from 'fastify';
import {
  AffiliateAdminCommissionAdjustmentSchema,
  AffiliateAdminPartnerMutationSchema,
  AffiliateAdminReferralDisqualificationSchema,
  AffiliateAdminReferralReviewResolutionSchema,
} from '@agency-platform/shared';
import { sendError, sendSuccess, sendValidationError } from '@/lib/response.js';
import { authenticate } from '@/middleware/auth.js';
import { requireInternalAdmin } from '@/middleware/internal-admin.js';
import { internalAdminService } from '@/services/internal-admin.service.js';
import { subscriptionService } from '@/services/subscription.service.js';
import { SubscriptionTierSchema, type SubscriptionTier } from '@agency-platform/shared';
import { agentTelemetryService } from '@/services/agent-telemetry.service.js';

interface InternalAdminRouteOptions {
  allowlist?: {
    userIds: string[];
    emails: string[];
  };
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function internalAdminRoutes(
  fastify: FastifyInstance,
  options: InternalAdminRouteOptions = {},
) {
  fastify.addHook('onRequest', authenticate());
  fastify.addHook('onRequest', requireInternalAdmin(options.allowlist));

  fastify.get('/internal-admin/overview', async (_request, reply) => {
    try {
      const result = await internalAdminService.getOverview();
      if (result.error || !result.data) {
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to fetch overview', 500);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/overview');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch overview', 500);
    }
  });

  fastify.get('/internal-admin/agent-metrics', async (_request, reply) => {
    return sendSuccess(reply, agentTelemetryService.snapshot());
  });

  fastify.get('/internal-admin/agencies', async (request, reply) => {
    try {
      const query = request.query as { search?: string; page?: string; limit?: string; includeSynthetic?: string };
      const page = parsePositiveInt(query.page);
      const limit = parsePositiveInt(query.limit);
      const includeSynthetic = parseOptionalBoolean(query.includeSynthetic);

      if (query.page && (!page || page < 1)) {
        return sendValidationError(reply, 'page must be a positive integer');
      }
      if (query.limit && (!limit || limit < 1)) {
        return sendValidationError(reply, 'limit must be a positive integer');
      }
      if (query.includeSynthetic !== undefined && includeSynthetic === undefined) {
        return sendValidationError(reply, 'includeSynthetic must be true or false');
      }

      const result = await internalAdminService.listAgencies({
        search: query.search,
        page,
        limit,
        includeSynthetic,
      });

      if (result.error || !result.data) {
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to fetch agencies', 500);
      }

      fastify.log.info({
        requestId: request.id,
        page: result.data.page,
        limit: result.data.limit,
        total: result.data.total,
        itemCount: result.data.items.length,
      }, 'GET /internal-admin/agencies response');

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/agencies');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch agencies', 500);
    }
  });

  fastify.get('/internal-admin/agencies/:agencyId', async (request, reply) => {
    try {
      const { agencyId } = request.params as { agencyId: string };
      if (!agencyId) {
        return sendValidationError(reply, 'agencyId is required');
      }

      const result = await internalAdminService.getAgencyDetail(agencyId);
      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 500;
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to fetch agency detail', statusCode);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/agencies/:agencyId');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch agency detail', 500);
    }
  });

  fastify.get('/internal-admin/webhooks', async (request, reply) => {
    try {
      const query = request.query as {
        status?: 'active' | 'disabled';
        search?: string;
        limit?: string;
      };
      const limit = parsePositiveInt(query.limit);

      if (query.limit && (!limit || limit < 1)) {
        return sendValidationError(reply, 'limit must be a positive integer');
      }

      if (query.status && query.status !== 'active' && query.status !== 'disabled') {
        return sendValidationError(reply, 'status must be active or disabled');
      }

      const result = await internalAdminService.listWebhookEndpoints({
        status: query.status,
        search: query.search,
        limit,
      });

      if (result.error || !result.data) {
        return sendError(
          reply,
          result.error?.code || 'INTERNAL_ERROR',
          result.error?.message || 'Failed to fetch webhook endpoints',
          500
        );
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/webhooks');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch webhook endpoints', 500);
    }
  });

  fastify.get('/internal-admin/webhooks/:agencyId', async (request, reply) => {
    try {
      const { agencyId } = request.params as { agencyId: string };
      const query = request.query as { limit?: string };
      const limit = parsePositiveInt(query.limit);

      if (!agencyId) {
        return sendValidationError(reply, 'agencyId is required');
      }

      if (query.limit && (!limit || limit < 1)) {
        return sendValidationError(reply, 'limit must be a positive integer');
      }

      const result = await internalAdminService.getWebhookDetail(agencyId, limit);
      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 500;
        return sendError(
          reply,
          result.error?.code || 'INTERNAL_ERROR',
          result.error?.message || 'Failed to fetch webhook detail',
          statusCode
        );
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/webhooks/:agencyId');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch webhook detail', 500);
    }
  });

  fastify.get('/internal-admin/subscriptions', async (request, reply) => {
    try {
      const query = request.query as { status?: string; tier?: string; page?: string; limit?: string };
      const page = parsePositiveInt(query.page);
      const limit = parsePositiveInt(query.limit);

      if (query.page && (!page || page < 1)) {
        return sendValidationError(reply, 'page must be a positive integer');
      }
      if (query.limit && (!limit || limit < 1)) {
        return sendValidationError(reply, 'limit must be a positive integer');
      }

      const result = await internalAdminService.listSubscriptions({
        status: query.status,
        tier: query.tier,
        page,
        limit,
      });

      if (result.error || !result.data) {
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to fetch subscriptions', 500);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/subscriptions');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch subscriptions', 500);
    }
  });

  fastify.post('/internal-admin/subscriptions/:agencyId/upgrade', async (request, reply) => {
    try {
      const { agencyId } = request.params as { agencyId: string };
      const body = request.body as {
        newTier?: SubscriptionTier;
        updateBehavior?: 'proration-charge-immediately' | 'proration-charge' | 'proration-none';
      };

      if (!agencyId) {
        return sendValidationError(reply, 'agencyId is required');
      }

      if (!body.newTier) {
        return sendValidationError(reply, 'newTier is required');
      }

      const validTiers: SubscriptionTier[] = SubscriptionTierSchema.options;
      if (!validTiers.includes(body.newTier)) {
        return sendValidationError(reply, 'Invalid subscription tier');
      }

      const result = await subscriptionService.upgradeSubscription({
        agencyId,
        newTier: body.newTier,
        updateBehavior: body.updateBehavior,
      });

      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NO_SUBSCRIPTION' ? 404 : 400;
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to upgrade subscription', statusCode);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/subscriptions/:agencyId/upgrade');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to upgrade subscription', 500);
    }
  });

  fastify.post('/internal-admin/subscriptions/:agencyId/cancel', async (request, reply) => {
    try {
      const { agencyId } = request.params as { agencyId: string };
      const body = request.body as { cancelAtPeriodEnd?: boolean };

      if (!agencyId) {
        return sendValidationError(reply, 'agencyId is required');
      }

      const result = await subscriptionService.cancelSubscription({
        agencyId,
        cancelAtPeriodEnd: body.cancelAtPeriodEnd,
      });

      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NO_SUBSCRIPTION' ? 404 : 400;
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to cancel subscription', statusCode);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/subscriptions/:agencyId/cancel');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to cancel subscription', 500);
    }
  });

  fastify.get('/internal-admin/affiliate/payout-batches', async (request, reply) => {
    try {
      const query = request.query as { status?: string; page?: string; limit?: string };
      const page = parsePositiveInt(query.page);
      const limit = parsePositiveInt(query.limit);

      if (query.page && (!page || page < 1)) {
        return sendValidationError(reply, 'page must be a positive integer');
      }
      if (query.limit && (!limit || limit < 1)) {
        return sendValidationError(reply, 'limit must be a positive integer');
      }

      const result = await internalAdminService.listAffiliatePayoutBatches({
        status: query.status,
        page,
        limit,
      });

      if (result.error || !result.data) {
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to fetch affiliate payout batches', 500);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/affiliate/payout-batches');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch affiliate payout batches', 500);
    }
  });

  fastify.post('/internal-admin/affiliate/payout-batches', async (request, reply) => {
    try {
      const body = request.body as {
        periodStart?: string;
        periodEnd?: string;
        notes?: string;
      };

      if (!body.periodStart || !body.periodEnd) {
        return sendValidationError(reply, 'periodStart and periodEnd are required');
      }

      const periodStart = new Date(body.periodStart);
      const periodEnd = new Date(body.periodEnd);

      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        return sendValidationError(reply, 'periodStart and periodEnd must be valid ISO date strings');
      }

      const result = await internalAdminService.generateAffiliatePayoutBatch({
        periodStart,
        periodEnd,
        notes: body.notes,
        userEmail: (request as any).user?.email,
      });

      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'VALIDATION_ERROR'
          ? 400
          : result.error?.code === 'NOT_FOUND'
            ? 404
            : 500;
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to generate affiliate payout batch', statusCode);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/affiliate/payout-batches');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to generate affiliate payout batch', 500);
    }
  });

  fastify.post('/internal-admin/affiliate/payout-batches/:batchId/export', async (request, reply) => {
    try {
      const { batchId } = request.params as { batchId: string };

      if (!batchId) {
        return sendValidationError(reply, 'batchId is required');
      }

      const result = await internalAdminService.exportAffiliatePayoutBatch(batchId, {
        userEmail: (request as any).user?.email,
      });

      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 500;
        return sendError(
          reply,
          result.error?.code || 'INTERNAL_ERROR',
          result.error?.message || 'Failed to export affiliate payout batch',
          statusCode
        );
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/affiliate/payout-batches/:batchId/export');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to export affiliate payout batch', 500);
    }
  });

  fastify.get('/internal-admin/affiliate/fraud-queue', async (_request, reply) => {
    try {
      const result = await internalAdminService.listAffiliateFraudQueue();

      if (result.error || !result.data) {
        return sendError(
          reply,
          result.error?.code || 'INTERNAL_ERROR',
          result.error?.message || 'Failed to fetch affiliate fraud queue',
          500
        );
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/affiliate/fraud-queue');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch affiliate fraud queue', 500);
    }
  });

  fastify.get('/internal-admin/affiliate/partners', async (request, reply) => {
    try {
      const query = request.query as { status?: string; search?: string; page?: string; limit?: string };
      const page = parsePositiveInt(query.page);
      const limit = parsePositiveInt(query.limit);

      if (query.page && (!page || page < 1)) {
        return sendValidationError(reply, 'page must be a positive integer');
      }
      if (query.limit && (!limit || limit < 1)) {
        return sendValidationError(reply, 'limit must be a positive integer');
      }

      const result = await internalAdminService.listAffiliatePartners({
        status: query.status,
        search: query.search,
        page,
        limit,
      });

      if (result.error || !result.data) {
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to fetch affiliate partners', 500);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/affiliate/partners');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch affiliate partners', 500);
    }
  });

  fastify.post('/internal-admin/affiliate/partners/:partnerId', async (request, reply) => {
    try {
      const { partnerId } = request.params as { partnerId: string };
      if (!partnerId) {
        return sendValidationError(reply, 'partnerId is required');
      }

      const validated = AffiliateAdminPartnerMutationSchema.safeParse(request.body);
      if (!validated.success) {
        return sendError(
          reply,
          'VALIDATION_ERROR',
          'Invalid affiliate partner review update',
          400,
          validated.error.flatten()
        );
      }

      const result = await internalAdminService.updateAffiliatePartner(partnerId, {
        ...validated.data,
        userEmail: (request as any).user?.email,
      });

      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 400;
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to update affiliate partner', statusCode);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/affiliate/partners/:partnerId');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to update affiliate partner', 500);
    }
  });

  fastify.get('/internal-admin/affiliate/partners/:partnerId', async (request, reply) => {
    try {
      const { partnerId } = request.params as { partnerId: string };
      if (!partnerId) {
        return sendValidationError(reply, 'partnerId is required');
      }

      const result = await internalAdminService.getAffiliatePartnerDetail(partnerId);
      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 500;
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to fetch affiliate partner detail', statusCode);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in GET /internal-admin/affiliate/partners/:partnerId');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to fetch affiliate partner detail', 500);
    }
  });

  fastify.post('/internal-admin/affiliate/links/:linkId/disable', async (request, reply) => {
    try {
      const { linkId } = request.params as { linkId: string };
      const body = request.body as { internalNotes?: string };

      if (!linkId) {
        return sendValidationError(reply, 'linkId is required');
      }

      const result = await internalAdminService.disableAffiliateLink(linkId, {
        internalNotes: body.internalNotes,
        userEmail: (request as any).user?.email,
      });

      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 400;
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to disable affiliate link', statusCode);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/affiliate/links/:linkId/disable');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to disable affiliate link', 500);
    }
  });

  fastify.post('/internal-admin/affiliate/referrals/:referralId/disqualify', async (request, reply) => {
    try {
      const { referralId } = request.params as { referralId: string };
      if (!referralId) {
        return sendValidationError(reply, 'referralId is required');
      }

      const validated = AffiliateAdminReferralDisqualificationSchema.safeParse(request.body);
      if (!validated.success) {
        return sendError(
          reply,
          'VALIDATION_ERROR',
          'Invalid affiliate referral disqualification payload',
          400,
          validated.error.flatten()
        );
      }

      const result = await internalAdminService.disqualifyAffiliateReferral(referralId, {
        ...validated.data,
        userEmail: (request as any).user?.email,
      });

      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 400;
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to disqualify affiliate referral', statusCode);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/affiliate/referrals/:referralId/disqualify');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to disqualify affiliate referral', 500);
    }
  });

  fastify.post('/internal-admin/affiliate/referrals/:referralId/review', async (request, reply) => {
    try {
      const { referralId } = request.params as { referralId: string };
      if (!referralId) {
        return sendValidationError(reply, 'referralId is required');
      }

      const parsed = AffiliateAdminReferralReviewResolutionSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.flatten().formErrors.join(', ') || 'Invalid referral review resolution');
      }

      const result = await internalAdminService.resolveAffiliateReferralReview(referralId, {
        ...parsed.data,
        userEmail: (request as any).user?.email,
      });

      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 500;
        return sendError(
          reply,
          result.error?.code || 'INTERNAL_ERROR',
          result.error?.message || 'Failed to resolve affiliate referral review',
          statusCode
        );
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/affiliate/referrals/:referralId/review');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to resolve affiliate referral review', 500);
    }
  });

  fastify.post('/internal-admin/affiliate/commissions/:commissionId/adjust', async (request, reply) => {
    try {
      const { commissionId } = request.params as { commissionId: string };
      if (!commissionId) {
        return sendValidationError(reply, 'commissionId is required');
      }

      const validated = AffiliateAdminCommissionAdjustmentSchema.safeParse(request.body);
      if (!validated.success) {
        return sendError(
          reply,
          'VALIDATION_ERROR',
          'Invalid affiliate commission adjustment payload',
          400,
          validated.error.flatten()
        );
      }

      const result = await internalAdminService.adjustAffiliateCommission(commissionId, {
        ...validated.data,
        userEmail: (request as any).user?.email,
      });

      if (result.error || !result.data) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 400;
        return sendError(reply, result.error?.code || 'INTERNAL_ERROR', result.error?.message || 'Failed to adjust affiliate commission', statusCode);
      }

      return sendSuccess(reply, result.data);
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/affiliate/commissions/:commissionId/adjust');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to adjust affiliate commission', 500);
    }
  });

  fastify.post('/internal-admin/meta/seed-tier-cron-token', async (_request, reply) => {
    try {
      const { seedMetaTierCronTokenFromReviewDemo } = await import(
        '@/services/meta-tier-cron-token.service.js'
      );
      const result = await seedMetaTierCronTokenFromReviewDemo();
      return sendSuccess(reply, {
        seeded: result.seeded,
        alreadyPresent: result.alreadyPresent,
        sourceClerkUserId: result.sourceClerkUserId,
        ...(result.reason ? { reason: result.reason } : {}),
      });
    } catch (error) {
      fastify.log.error({ error }, 'Error in POST /internal-admin/meta/seed-tier-cron-token');
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to seed meta tier cron token', 500);
    }
  });
}
