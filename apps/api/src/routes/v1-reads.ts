/**
 * v1 Read Routes: catalog, cursor lists, usage.
 *
 * Registered inside the v1 plugin context, so the key preHandler already
 * ran. Each route carries the rest of the gate chain as preHandlers:
 * read-aware tier gate, rate peek, scope gate, then rate consume — so
 * scope-denied reads never touch the budget. Handlers
 * query new keyset paths — never the offset dashboard services — and every
 * query schema is strict: unknown parameters fail naming the parameter.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '@/lib/prisma';
import { requireKeyScope } from '@/middleware/api-key-auth.js';
import { v1RateConsumeHandler, v1RatePreCheckHandler, v1TierGate } from '@/middleware/v1-gate.js';
import {
  decodeKeysetCursor,
  catalogService,
} from '@/services/catalog.service.js';
import { quotaService } from '@/services/quota.service.js';
import { v1Error, v1Success } from '@/lib/v1-envelope.js';
import {
  decodeCursorOr400,
  principalOf,
  validationMessage,
} from '@/lib/v1-route-helpers.js';
import {
  v1ClientListQuerySchema,
  v1RequestListQuerySchema,
} from './v1-schemas.js';

function sendValidationError(reply: FastifyReply, message: string) {
  return v1Error(reply, 400, 'VALIDATION_ERROR', message);
}

export async function v1ReadsRoutes(fastify: FastifyInstance) {
  const tier = v1TierGate();
  const ratePre = v1RatePreCheckHandler();
  const rateConsume = v1RateConsumeHandler();

  /**
   * GET /api/v1/catalog/accounts
   * The agency's connected accounts in the form requests reference them.
   * Secret pointers never leave the service layer.
   */
  fastify.get(
    '/catalog/accounts',
    { preHandler: [tier, ratePre, requireKeyScope('catalog:read'), rateConsume] },
    async (request, reply) => {
      const accounts = await catalogService.listConnectedAccounts(principalOf(request).agencyId);
      return v1Success(reply, accounts);
    },
  );

  /**
   * GET /api/v1/catalog/services
   * Every requestable service with its roles and grant requirements.
   */
  fastify.get(
    '/catalog/services',
    { preHandler: [tier, ratePre, requireKeyScope('catalog:read'), rateConsume] },
    async (_request, reply) => {
      const services = catalogService.listServices();
      return v1Success(reply, services);
    },
  );

  /**
   * GET /api/v1/clients
   * Opaque keyset cursor over (createdAt, id); exact email filter.
   */
  fastify.get(
    '/clients',
    { preHandler: [tier, ratePre, requireKeyScope('clients:read'), rateConsume] },
    async (request, reply) => {
      const parsed = v1ClientListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendValidationError(reply, validationMessage(parsed.error));
      }
      const cursor = decodeCursorOr400(reply, decodeKeysetCursor, parsed.data.cursor);
      if (cursor === undefined) return;
      const page = await catalogService.listClientsKeyset({
        agencyId: principalOf(request).agencyId,
        limit: parsed.data.limit,
        cursor,
        email: parsed.data.email,
      });
      return v1Success(reply, page.rows, 200, {
        pagination: { nextCursor: page.nextCursor, hasMore: page.hasMore },
      });
    },
  );

  /**
   * GET /api/v1/requests
   * Opaque keyset cursor over (createdAt, id); exact status filter.
   */
  fastify.get(
    '/requests',
    { preHandler: [tier, ratePre, requireKeyScope('requests:read'), rateConsume] },
    async (request, reply) => {
      const parsed = v1RequestListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendValidationError(reply, validationMessage(parsed.error));
      }
      const cursor = decodeCursorOr400(reply, decodeKeysetCursor, parsed.data.cursor);
      if (cursor === undefined) return;
      const page = await catalogService.listRequestsKeyset({
        agencyId: principalOf(request).agencyId,
        limit: parsed.data.limit,
        cursor,
        status: parsed.data.status,
      });
      return v1Success(reply, page.rows, 200, {
        pagination: { nextCursor: page.nextCursor, hasMore: page.hasMore },
      });
    },
  );

  /**
   * GET /api/v1/usage
   * DB-backed usage internals remapped to the stable public schema:
   * plan, per-metric limits/used/remaining, and the period reset.
   */
  fastify.get(
    '/usage',
    { preHandler: [tier, ratePre, requireKeyScope('usage:read'), rateConsume] },
    async (request, reply) => {
      const agencyId = principalOf(request).agencyId;
      const [snapshot, subscription] = await Promise.all([
        quotaService.getUsage(agencyId),
        prisma.subscription.findUnique({
          where: { agencyId },
          select: { currentPeriodEnd: true },
        }),
      ]);
      if (!snapshot) {
        return v1Error(reply, 500, 'INTERNAL_ERROR', 'Unable to load usage');
      }
      const { currentTier, updatedAt: _updatedAt, ...metrics } = snapshot as unknown as Record<string, unknown>;
      void _updatedAt;
      return v1Success(reply, {
        plan: currentTier,
        metrics,
        resetAt: subscription?.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd).toISOString()
          : null,
      });
    },
  );
}
