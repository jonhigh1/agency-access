/**
 * v1 Read Routes (U3: R9–R12 — catalog, cursor lists, usage).
 *
 * Registered inside the v1 plugin context, so the key preHandler from
 * v1.ts already ran. Each route carries the rest of the gate chain as
 * preHandlers: read-aware tier gate, per-key rate limit, then the scope
 * gate (KTD8). Handlers query new keyset paths — never the offset
 * dashboard services — and every query schema is strict: unknown
 * parameters fail naming the parameter (R17).
 */

import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireKeyScope } from '@/middleware/api-key-auth.js';
import { v1RateLimitPreHandler, v1TierGate } from '@/middleware/v1-gate.js';
import type { ApiKeyPrincipal } from '@/services/api-key.service';
import {
  CursorError,
  catalogService,
  decodeKeysetCursor,
} from '@/services/catalog.service.js';
import { quotaService } from '@/services/quota.service.js';
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from '@/lib/list-pagination.js';

function principalOf(request: unknown): ApiKeyPrincipal {
  return (request as { apiKey: ApiKeyPrincipal }).apiKey;
}

function sendList(
  reply: import('fastify').FastifyReply,
  rows: unknown[],
  page: { nextCursor: string | null; hasMore: boolean },
) {
  return reply.send({
    data: rows,
    error: null,
    meta: {
      requestId: randomUUID(),
      pagination: { nextCursor: page.nextCursor, hasMore: page.hasMore },
    },
  });
}

function sendValidationError(
  reply: import('fastify').FastifyReply,
  message: string,
) {
  return reply.code(400).send({
    data: null,
    error: { code: 'VALIDATION_ERROR', message },
  });
}

const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_LIST_LIMIT)
  .default(DEFAULT_LIST_LIMIT);

const clientListQuerySchema = z
  .object({
    limit: limitSchema,
    cursor: z.string().optional(),
    email: z.string().email().optional(),
  })
  .strict();

const requestListQuerySchema = z
  .object({
    limit: limitSchema,
    cursor: z.string().optional(),
    status: z.enum(['pending', 'partial', 'completed', 'expired', 'revoked']).optional(),
  })
  .strict();

export async function v1ReadsRoutes(fastify: FastifyInstance) {
  const tier = v1TierGate();
  const rate = v1RateLimitPreHandler();

  /**
   * GET /api/v1/catalog/accounts (R9)
   * The agency's connected accounts in the form requests reference them.
   * Secret pointers (secretId) never leave the service layer.
   */
  fastify.get(
    '/catalog/accounts',
    { preHandler: [tier, rate, requireKeyScope('catalog:read')] },
    async (request, reply) => {
      const accounts = await catalogService.listConnectedAccounts(principalOf(request).agencyId);
      return reply.send({ data: accounts, error: null, meta: { requestId: randomUUID() } });
    },
  );

  /**
   * GET /api/v1/catalog/services (R10)
   * Every requestable service with its roles and grant requirements.
   */
  fastify.get(
    '/catalog/services',
    { preHandler: [tier, rate, requireKeyScope('catalog:read')] },
    async (_request, reply) => {
      const services = catalogService.listServices();
      return reply.send({ data: services, error: null, meta: { requestId: randomUUID() } });
    },
  );

  /**
   * GET /api/v1/clients (R11)
   * Opaque keyset cursor over (createdAt, id); exact email filter.
   * External-ID lookup arrives with U5.
   */
  fastify.get(
    '/clients',
    { preHandler: [tier, rate, requireKeyScope('clients:read')] },
    async (request, reply) => {
      const parsed = clientListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.errors[0]?.message ?? 'Invalid query');
      }
      let cursor;
      try {
        cursor = decodeKeysetCursor(parsed.data.cursor);
      } catch (error) {
        if (error instanceof CursorError) return sendValidationError(reply, error.message);
        throw error;
      }
      const page = await catalogService.listClientsKeyset({
        agencyId: principalOf(request).agencyId,
        limit: parsed.data.limit,
        cursor,
        email: parsed.data.email,
      });
      return sendList(reply, page.rows, page);
    },
  );

  /**
   * GET /api/v1/requests (R11)
   * Opaque keyset cursor over (createdAt, id); exact status filter.
   * External-ID filtering arrives with U5.
   */
  fastify.get(
    '/requests',
    { preHandler: [tier, rate, requireKeyScope('requests:read')] },
    async (request, reply) => {
      const parsed = requestListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error.errors[0]?.message ?? 'Invalid query');
      }
      let cursor;
      try {
        cursor = decodeKeysetCursor(parsed.data.cursor);
      } catch (error) {
        if (error instanceof CursorError) return sendValidationError(reply, error.message);
        throw error;
      }
      const page = await catalogService.listRequestsKeyset({
        agencyId: principalOf(request).agencyId,
        limit: parsed.data.limit,
        cursor,
        status: parsed.data.status,
      });
      return sendList(reply, page.rows, page);
    },
  );

  /**
   * GET /api/v1/usage (R12)
   * DB-backed usage internals remapped to the stable public schema:
   * plan, per-metric limits/used/remaining, and the period reset.
   */
  fastify.get(
    '/usage',
    { preHandler: [tier, rate, requireKeyScope('usage:read')] },
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
        return reply.code(500).send({
          data: null,
          error: { code: 'INTERNAL_ERROR', message: 'Unable to load usage' },
        });
      }
      const { currentTier, updatedAt: _updatedAt, ...metrics } = snapshot as unknown as Record<string, unknown>;
      void _updatedAt;
      return reply.send({
        data: {
          plan: currentTier,
          metrics,
          resetAt: subscription?.currentPeriodEnd
            ? new Date(subscription.currentPeriodEnd).toISOString()
            : null,
        },
        error: null,
        meta: { requestId: randomUUID() },
      });
    },
  );
}
