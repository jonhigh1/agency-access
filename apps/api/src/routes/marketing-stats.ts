/**
 * Marketing Stats Routes
 *
 * Public aggregate counters for the marketing site. No auth by design:
 * the payload is anonymous counts. Responses are cached at the route
 * layer (in-memory LRU) and revalidated hourly by the web tier.
 */

import { FastifyInstance } from 'fastify';
import { getMarketingStats } from '../services/marketing-stats.service.js';
import { getCached, CacheKeys } from '../lib/cache.js';

const MARKETING_STATS_TTL_SECONDS = 3600;

export async function marketingStatsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/marketing-stats
   *
   * Aggregate, anonymous counters: agencies, active client connections,
   * active platform authorizations, completed access requests, token
   * refreshes. No auth, cached 1 hour.
   */
  fastify.get('/marketing-stats', async (_request, reply) => {
    const result = await getCached({
      key: CacheKeys.marketingStats(),
      ttl: MARKETING_STATS_TTL_SECONDS,
      fetch: async () => getMarketingStats(),
    });

    if (result.error) {
      return reply.code(500).send({ data: null, error: result.error });
    }

    return reply.send(result);
  });
}
