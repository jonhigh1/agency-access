/**
 * Quota Enforcement Middleware
 *
 * Enforces subscription tier limits at the API level.
 * Blocks actions when quotas are exceeded, provides upgrade paths.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/lib/prisma.js';
import { clerkMetadataService } from '@/services/clerk-metadata.service.js';
import { quotaService } from '@/services/quota.service.js';
import { MetricType, QuotaCheckResult, TIER_LIMITS, SubscriptionTier, getNextTierForCheckout } from '@agency-platform/shared';
import { sendError } from '../lib/response.js';

export interface QuotaCheckOptions {
  metric: MetricType;
  agencyId: string;
  clerkUserId: string;
  requestedAmount?: number;
}

/**
 * Check if agency has remaining quota
 * Returns quota status with allowed flag (plus currentTier so the 402
 * handler does not need to re-fetch the tier from Clerk).
 */
export type QuotaCheckResultWithTier = QuotaCheckResult & { currentTier?: SubscriptionTier };

export async function checkQuota(options: QuotaCheckOptions): Promise<QuotaCheckResultWithTier> {
  const { metric, agencyId, clerkUserId, requestedAmount = 1 } = options;

  if (['access_requests', 'clients', 'members', 'templates'].includes(metric)) {
    const result = await quotaService.checkQuota({
      agencyId,
      metric,
      action: 'create',
      requestedAmount,
    });
    return {
      ...result,
      limit: result.limit === 'unlimited' ? -1 : result.limit,
      remaining: result.remaining === 'unlimited' ? -1 : result.remaining,
    };
  }

  try {
    const tierResult = await clerkMetadataService.getSubscriptionTier(clerkUserId);
    if (tierResult.error || !tierResult.data) {
      console.error('Failed to fetch tier:', tierResult.error);
      // Fail-CLOSED - deny request when quota service is unavailable
      throw new QuotaServiceUnavailableError('Unable to verify subscription tier');
    }

    const tier = tierResult.data.tier;
    const limits = TIER_LIMITS[tier];

    const period = metric === 'team_seats' ? 'all_time' : 'current_year';
    const counter = await prisma.agencyUsageCounter.findUnique({
      where: {
        agencyId_metricType_period: {
          agencyId,
          metricType: metric,
          period,
        },
      },
    });

    const used = counter?.count || 0;
    const limit = metric === 'client_onboards'
      ? limits.clientOnboards
      : metric === 'platform_audits'
        ? limits.platformAudits
        : limits.teamSeats;

    // Unlimited seats for PRO tier
    if (limit === -1) {
      return { allowed: true, metric, limit: -1, used, remaining: -1, currentTier: tier };
    }

    const remaining = Math.max(0, limit - used);
    return {
      allowed: used + requestedAmount <= limit,
      metric,
      limit,
      used,
      remaining,
      resetsAt: counter?.resetAt ?? undefined,
      currentTier: tier,
    };
  } catch (error: any) {
    // Re-throw if it's already a QuotaServiceUnavailableError
    if (error instanceof QuotaServiceUnavailableError) {
      throw error;
    }
    console.error('Quota check error:', error);
    // Fail-CLOSED on any error - deny the request
    throw new QuotaServiceUnavailableError('Quota service temporarily unavailable');
  }
}

/**
 * Error thrown when quota service is unavailable.
 * Results in 503 Service Unavailable response.
 */
export class QuotaServiceUnavailableError extends Error {
  code = 'QUOTA_SERVICE_UNAVAILABLE' as const;
  constructor(message: string) {
    super(message);
    this.name = 'QuotaServiceUnavailableError';
  }
}

/**
 * Increment usage counter atomically
 */
export async function incrementUsage(agencyId: string, metric: MetricType): Promise<void> {
  const period = metric === 'team_seats' ? 'all_time' : 'current_year';

  await prisma.agencyUsageCounter.upsert({
    where: {
      agencyId_metricType_period: { agencyId, metricType: metric, period },
    },
    update: { count: { increment: 1 }, lastIncrementedAt: new Date() },
    create: {
      agencyId,
      metricType: metric,
      period,
      count: 1,
      resetAt: period === 'current_year' ? new Date(new Date().getFullYear() + 1, 0, 1) : undefined,
    },
  });
}

/**
 * Quota enforcement middleware factory
 * Checks quota before allowing action
 */
export interface QuotaMiddlewareOptions {
  metric: MetricType;
  getAgencyId?: (request: FastifyRequest) => string | undefined;
  requestedAmount?: number | ((request: FastifyRequest) => number);
}

export function quotaEnforcementMiddleware(options: QuotaMiddlewareOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'GET') return;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.code(401).send({ data: null, error: { code: 'UNAUTHORIZED' } });
    }

    const agencyId = options.getAgencyId?.(request)
      || (request.body as any)?.agencyId
      || (request.params as any)?.agencyId;
    if (!agencyId) {
      return reply.code(400).send({ data: null, error: { code: 'MISSING_AGENCY_ID' } });
    }

    try {
      const requestedAmount = typeof options.requestedAmount === 'function'
        ? options.requestedAmount(request)
        : options.requestedAmount ?? 1;
      const result = await checkQuota({ metric: options.metric, agencyId, clerkUserId: userId, requestedAmount });

      if (!result.allowed) {
        // Tier comes from the checkQuota result — no second Clerk fetch.
        const currentTier = result.currentTier ?? 'STARTER';
        const suggestedTier = getNextTierForCheckout(currentTier);

        return reply.code(402).send({
          data: null,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: `You've reached your ${options.metric} limit (${result.used}/${result.limit})`,
            metric: options.metric,
            limit: result.limit,
          used: result.used,
          resetsAt: result.resetsAt,
          upgradeUrl: suggestedTier ? `/pricing?upgrade=${suggestedTier}` : '/pricing',
          currentTier,
          suggestedTier,
        },
        });
      }

      // Attach quota check result to request for later use
      (request as any).quotaCheck = result;
    } catch (error: any) {
      if (error.code === 'QUOTA_SERVICE_UNAVAILABLE') {
        console.error('[QUOTA_SERVICE] Service unavailable:', error.message);
        return sendError(reply, 'QUOTA_SERVICE_UNAVAILABLE', 'Unable to verify quota. Please try again later.', 503);
      }
      // Log other errors for alerting but still fail-closed
      console.error('[QUOTA_SERVICE] Unexpected error:', error);
      return sendError(reply, 'QUOTA_SERVICE_UNAVAILABLE', 'Service temporarily unavailable.', 503);
    }
  };
}

/**
 * Increment usage after successful action
 * Designed for Fastify's onSend hook
 */
export function incrementUsageMiddleware(metric: MetricType) {
  return async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    const agencyId = (request.body as any)?.agencyId || (request.params as any)?.agencyId;
    if (agencyId) {
      try {
        await incrementUsage(agencyId, metric);
      } catch (err) {
        console.error('Failed to increment usage:', err);
        // Don't fail the request if increment fails
      }
    }
    return payload;
  };
}

export const quotaEnforcement = {
  checkQuota,
  incrementUsage,
  enforcement: quotaEnforcementMiddleware,
  increment: incrementUsageMiddleware,
};
