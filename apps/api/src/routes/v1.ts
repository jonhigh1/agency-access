/**
 * Public API v1 plugin (KTD1)
 *
 * One encapsulated module owning the full v1 gate chain. It registers only
 * the API-key preHandler — never Clerk `authenticate()` — and carries its
 * own error handler preserving the v1 envelope. Child route files register
 * inside this plugin's context.
 */

import type { FastifyInstance } from 'fastify';
import { apiKeyPreHandler } from '@/middleware/api-key-auth.js';
import { prisma } from '@/lib/prisma';
import { v1ReadsRoutes } from './v1-reads.js';
import { v1WritesRoutes } from './v1-writes.js';
import { MAX_API_KEYS_PER_AGENCY } from '@/services/api-key.service.js';
import type { ApiKeyPrincipal } from '@/services/api-key.service';

export async function v1Routes(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: unknown, _request, reply) => {
    const err = error as { statusCode?: number; code?: string; message?: string };
    const statusCode = err.statusCode ?? 500;
    void reply.code(statusCode).send({
      data: null,
      error: {
        code: err?.code || 'INTERNAL_ERROR',
        message: err?.message || 'An unexpected error occurred',
      },
    });
  });

  fastify.addHook('onRequest', apiKeyPreHandler());

  // U3 read slice: catalog, cursor lists, usage. Each route carries the
  // tier gate + per-key rate limit + scope gate as its own preHandler chain.
  await fastify.register(v1ReadsRoutes);

  // U5 idempotent creates: clients, requests, external-ID lookups. Each
  // route carries the tier gate + per-key rate limit + scope gate as its
  // own preHandler chain.
  await fastify.register(v1WritesRoutes);

  /**
   * GET /api/v1/self-check (R4)
   * The only scopeless v1 endpoint: returns the key's agency and scopes
   * plus tier and limit hints. No plan details beyond entitlement.
   */
  fastify.get('/self-check', async (request, reply) => {
    const principal = (request as any).apiKey as ApiKeyPrincipal;
    try {
      const [agency, subscription, activeKeys] = await Promise.all([
        prisma.agency.findUnique({ where: { id: principal.agencyId } }),
        prisma.subscription.findUnique({ where: { agencyId: principal.agencyId } }),
        prisma.apiKey.count({
          where: { agencyId: principal.agencyId, revokedAt: null },
        }),
      ]);

      return reply.send({
        data: {
          agency: agency ? { id: agency.id, name: agency.name } : { id: principal.agencyId },
          keyPrefix: principal.keyPrefix,
          scopes: principal.scopes,
          tier: subscription?.tier ?? null,
          limits: { maxKeys: MAX_API_KEYS_PER_AGENCY, activeKeys },
        },
        error: null,
      });
    } catch {
      return reply.code(500).send({
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Self-check failed' },
      });
    }
  });
}
