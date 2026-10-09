/**
 * Public API v1 plugin.
 *
 * One encapsulated module owning the full v1 gate chain. It registers only
 * the API-key preHandler — never Clerk `authenticate()` — and carries its
 * own error handler preserving the v1 envelope. Child route files register
 * inside this plugin's context.
 */

import type { FastifyInstance } from 'fastify';
import { apiKeyPreHandler } from '@/middleware/api-key-auth.js';
import { prisma } from '@/lib/prisma';
import { v1Error, v1Success } from '@/lib/v1-envelope.js';
import { V1_ERROR_REGISTRY, isRegisteredV1Code, type V1ErrorCode } from '@/lib/v1-errors.js';
import { v1ReadsRoutes } from './v1-reads.js';
import { v1WebhooksRoutes } from './v1-webhooks.js';
import { v1WritesRoutes } from './v1-writes.js';
import { MAX_API_KEYS_PER_AGENCY } from '@/services/api-key.service.js';

export async function v1Routes(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: unknown, _request, reply) => {
    const err = error as { statusCode?: number; code?: string; message?: string };
    const statusCode = err.statusCode ?? 500;
    // Unregistered codes (e.g. FST_ERR_*) never leak verbatim: 4xx maps to
    // VALIDATION_ERROR, everything else to INTERNAL_ERROR with the generic
    // registry message — never err.message.
    if (err?.code && isRegisteredV1Code(err.code)) {
      return v1Error(reply, statusCode, err.code, V1_ERROR_REGISTRY[err.code].message);
    }
    const code: V1ErrorCode = statusCode >= 400 && statusCode < 500 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
    return v1Error(reply, statusCode, code, V1_ERROR_REGISTRY[code].message);
  });

  fastify.addHook('onRequest', apiKeyPreHandler());

  // Read slice: catalog, cursor lists, usage. Each route carries the
  // tier gate + per-key rate limit + scope gate as its own preHandler chain.
  await fastify.register(v1ReadsRoutes);

  // Idempotent creates: clients, requests, external-ID lookups. Each
  // route carries the tier gate + per-key rate limit + scope gate as its
  // own preHandler chain.
  await fastify.register(v1WritesRoutes);

  // Webhooks: multi-endpoint CRUD, rotation, deliveries log. Same gate
  // chain as the read and write slices.
  await fastify.register(v1WebhooksRoutes);

  /**
   * GET /api/v1/self-check
   * The only scopeless v1 endpoint: returns the key's agency and scopes
   * plus tier and limit hints. No plan details beyond entitlement.
   */
  fastify.get('/self-check', async (request, reply) => {
    const principal = request.apiKey!;
    try {
      const [agency, subscription, activeKeys] = await Promise.all([
        prisma.agency.findUnique({ where: { id: principal.agencyId }, select: { id: true, name: true } }),
        prisma.subscription.findUnique({ where: { agencyId: principal.agencyId }, select: { tier: true } }),
        prisma.apiKey.count({
          where: {
            agencyId: principal.agencyId,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
      ]);

      return v1Success(reply, {
        agency: agency ? { id: agency.id, name: agency.name } : { id: principal.agencyId },
        keyPrefix: principal.keyPrefix,
        scopes: principal.scopes,
        tier: subscription?.tier ?? null,
        limits: { maxKeys: MAX_API_KEYS_PER_AGENCY, activeKeys },
      });
    } catch {
      return v1Error(reply, 500, 'INTERNAL_ERROR', 'Self-check failed');
    }
  });
}
