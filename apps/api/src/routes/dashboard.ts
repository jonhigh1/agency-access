/**
 * Dashboard Routes
 *
 * API endpoints for dashboard-specific data aggregation.
 * Protected by Clerk JWT verification.
 */

import { FastifyInstance } from 'fastify';
import { performance } from 'node:perf_hooks';
import { getDashboardStats } from '../services/connection-aggregation.service.js';
import { accessRequestService } from '../services/access-request.service.js';
import { connectionService } from '../services/connection.service.js';
import { agencyService } from '@/services/agency.service.js';
import { subscriptionService } from '@/services/subscription.service.js';
import { getCached, CacheKeys, CacheTTL } from '../lib/cache.js';
import { authenticate } from '@/middleware/auth.js';
import { assertAgencyAccess, resolvePrincipalAgency } from '@/lib/authorization.js';
import { env } from '@/lib/env.js';
import { recordPerformanceMark } from '@/middleware/performance.js';
import type { DashboardPayload } from '@agency-platform/shared';

const DASHBOARD_REQUESTS_LIMIT = 10;
const DASHBOARD_CONNECTIONS_LIMIT = 10;
const DASHBOARD_SUMMARY_TOTALS_DISABLED = { includeTotal: false } as const;

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate());

  /**
   * GET /api/dashboard
   *
   * Unified dashboard endpoint that returns all dashboard data in a single request.
   * Replaces multiple API calls for better performance.
   *
   * Returns:
   * - agency: Agency info (id, name, email)
   * - stats: Dashboard statistics (totalRequests, pendingRequests, activeConnections, totalPlatforms)
   * - requests: Recent access requests (limit 10)
   * - connections: Active client connections with authorizations
   */
  fastify.get('/dashboard', async (request, reply) => {
    const resolveAgencyStart = performance.now();
    const principalResult = await resolvePrincipalAgency(request);
    recordPerformanceMark(request, 'resolveAgency', performance.now() - resolveAgencyStart);

    if (principalResult.error || !principalResult.data) {
      const statusCode = principalResult.error?.code === 'UNAUTHORIZED' ? 401 : 403;
      return reply.code(statusCode).send({
        data: null,
        error: principalResult.error || {
          code: 'FORBIDDEN',
          message: 'Unable to resolve agency for authenticated user',
        },
      });
    }

    const agencyId = principalResult.data.agencyId;
    const agency = principalResult.data.agency;
    const useSummaryLimits = env.DASHBOARD_SUMMARY_LIMITS_ENABLED;
    const requestsLimit = useSummaryLimits ? DASHBOARD_REQUESTS_LIMIT : 1000;
    const connectionsLimit = useSummaryLimits ? DASHBOARD_CONNECTIONS_LIMIT : 1000;
    let dataFetchDurationMs = 0;

    // Use caching layer for dashboard data
    const cacheKey = CacheKeys.dashboard(agencyId);
    const cacheStart = performance.now();
    const cachedResult = await getCached<{
      payload: DashboardPayload;
    }>({
      key: cacheKey,
      ttl: CacheTTL.MEDIUM, // 5 minutes
      fetch: async () => {
        const dataFetchStart = performance.now();
        try {
          // Parallel fetch ALL dashboard data
          const [
            statsResult,
            requestsResult,
            connectionsResult,
            onboardingResult,
            subscriptionResult,
          ] = await Promise.all([
            getDashboardStats(agencyId),
            accessRequestService.getDashboardAccessRequestSummaries(
              agencyId,
              requestsLimit,
              DASHBOARD_SUMMARY_TOTALS_DISABLED
            ),
            connectionService.getDashboardConnectionSummaries(
              agencyId,
              connectionsLimit,
              DASHBOARD_SUMMARY_TOTALS_DISABLED
            ),
            agencyService.getOnboardingStatus(agencyId),
            subscriptionService.getSubscription(agencyId),
          ]);

          // Check for errors in any of the parallel requests
          if (statsResult.error) {
            return { data: null, error: statsResult.error };
          }

          if (requestsResult.error) {
            return { data: null, error: requestsResult.error };
          }

          if (connectionsResult.error) {
            return { data: null, error: connectionsResult.error };
          }

          if (onboardingResult.error) {
            return { data: null, error: onboardingResult.error };
          }

          if (subscriptionResult.error) {
            return { data: null, error: subscriptionResult.error };
          }

          const requests = (requestsResult.data?.items || []).slice(0, requestsLimit);
          const requestsTotal = statsResult.data?.totalRequests ?? requestsResult.data?.total ?? requests.length;
          const connections = (connectionsResult.data?.items || []).slice(0, connectionsLimit);
          const connectionsTotal =
            statsResult.data?.activeConnections ?? connectionsResult.data?.total ?? connections.length;
          const subscription = subscriptionResult.data;
          const trialBanner =
            subscription?.status === 'trialing' && subscription.trialEnd
              ? {
                  tier: subscription.tier,
                  trialEnd: subscription.trialEnd.toISOString(),
                }
              : null;

          const payload: DashboardPayload = {
            agency: {
              id: agency.id,
              name: agency.name,
              email: agency.email,
            },
            stats: statsResult.data!,
            requests,
            connections,
            meta: {
              requests: {
                limit: requestsLimit,
                returned: requests.length,
                total: requestsTotal,
                hasMore: requestsTotal > requests.length,
              },
              connections: {
                limit: connectionsLimit,
                returned: connections.length,
                total: connectionsTotal,
                hasMore: connectionsTotal > connections.length,
              },
            },
            onboardingStatus: onboardingResult.data,
            trialBanner,
          };

          return {
            data: {
              payload,
            },
            error: null,
          };
        } finally {
          dataFetchDurationMs = performance.now() - dataFetchStart;
        }
      },
    });
    recordPerformanceMark(request, 'cache', performance.now() - cacheStart);
    recordPerformanceMark(request, 'dataFetch', dataFetchDurationMs);

    // Handle errors from fetch function
    if (cachedResult.error || !cachedResult.data) {
      return reply.code(500).send({
        data: null,
        error: cachedResult.error || {
          code: 'DASHBOARD_FETCH_ERROR',
          message: 'Failed to fetch dashboard data',
        },
      });
    }

    const { payload } = cachedResult.data;

    // Add cache status header for monitoring
    reply.header('X-Cache', cachedResult.cached ? 'HIT' : 'MISS');

    // Dashboard state changes after request revokes and connections. Keep browser refreshes fresh.
    reply.header('Cache-Control', 'private, no-store');

    // Return consolidated dashboard data
    return reply.send({
      data: payload,
      error: null,
    });
  });

  /**
   * GET /api/dashboard/stats
   * Get aggregated statistics for the agency dashboard
   *
   * @deprecated Use GET /api/dashboard instead (returns stats + more data)
   */
  fastify.get('/dashboard/stats', async (request, reply) => {
    const { agencyId: queryAgencyId } = request.query as { agencyId?: string };
    const principalResult = await resolvePrincipalAgency(request);
    if (principalResult.error || !principalResult.data) {
      const statusCode = principalResult.error?.code === 'UNAUTHORIZED' ? 401 : 403;
      return reply.code(statusCode).send({
        data: null,
        error: principalResult.error || {
          code: 'FORBIDDEN',
          message: 'Unable to resolve agency for authenticated user',
        },
      });
    }
    const principalAgencyId = principalResult.data.agencyId;
    const targetAgencyId = queryAgencyId || principalAgencyId;
    const accessError = assertAgencyAccess(targetAgencyId, principalAgencyId);
    if (accessError) {
      return reply.code(403).send({ data: null, error: accessError });
    }

    const result = await getDashboardStats(targetAgencyId);

    if (result.error) {
      return reply.code(500).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });
}
