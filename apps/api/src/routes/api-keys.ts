/**
 * API Key Management Routes (dashboard plane, Clerk session auth)
 *
 * Agency admins issue, list, rotate, and revoke scoped v1 keys here.
 * Secrets are returned exactly once at issuance/rotation; listings carry
 * metadata only. This module never accepts API keys as credentials.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth.js';
import { requirePrincipalAgency } from '@/lib/agency-guard.js';
import {
  issueApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  revokeApiKeyFamily,
} from '@/services/api-key.service.js';
import { resolveAuthenticatedUserEmail, type AuthUserClaims } from '@/lib/authorization.js';
import type { ServiceResult } from '@/lib/service-result';

const IssueKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default([]),
});

const RotateKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

function statusFor(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'API_KEY_LIMIT_EXCEEDED':
    case 'API_KEY_FAMILY_LIMIT':
      return 403;
    case 'API_KEY_REVOKED':
      return 409;
    default:
      return 500;
  }
}

async function actorEmailOf(request: FastifyRequest): Promise<string> {
  const user = (request as unknown as { user?: AuthUserClaims }).user;
  return (await resolveAuthenticatedUserEmail(user)) ?? 'unknown';
}

function sendServiceResult<T>(reply: FastifyReply, result: ServiceResult<T>, successStatus: number): unknown {
  if (result.error || !result.data) {
    const code = result.error?.code ?? 'INTERNAL_ERROR';
    return reply
      .code(statusFor(code))
      .send({ data: null, error: result.error });
  }
  return reply.code(successStatus).send({ data: result.data, error: null });
}

export async function apiKeyRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate());
  fastify.addHook('onRequest', requirePrincipalAgency);

  fastify.post('/api-keys', async (request, reply) => {
    const agencyId = (request as any).principalAgencyId as string;
    const parsed = IssueKeySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid API key input' },
      });
    }

    const createdBy = await actorEmailOf(request);
    const result = await issueApiKey({ agencyId, ...parsed.data, createdBy });
    return sendServiceResult(reply, result, 201);
  });

  fastify.get('/api-keys', async (request, reply) => {
    const agencyId = (request as any).principalAgencyId as string;
    const result = await listApiKeys(agencyId);
    if (result.error || !result.data) {
      return reply.code(500).send({ data: null, error: result.error });
    }
    return reply.send({ data: result.data, error: null });
  });

  fastify.post('/api-keys/:id/revoke', async (request, reply) => {
    const agencyId = (request as any).principalAgencyId as string;
    const { id } = request.params as { id: string };
    const revokedBy = await actorEmailOf(request);
    const result = await revokeApiKey({ agencyId, keyId: id, revokedBy });
    return sendServiceResult(reply, result, 200);
  });

  fastify.post('/api-keys/:id/rotate', async (request, reply) => {
    const agencyId = (request as any).principalAgencyId as string;
    const { id } = request.params as { id: string };
    const parsed = RotateKeySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid rotation input' },
      });
    }
    const rotatedBy = await actorEmailOf(request);
    const result = await rotateApiKey({
      agencyId,
      keyId: id,
      rotatedBy,
      name: parsed.data.name,
    });
    return sendServiceResult(reply, result, 201);
  });

  fastify.post('/api-keys/families/:familyId/revoke', async (request, reply) => {
    const agencyId = (request as any).principalAgencyId as string;
    const { familyId } = request.params as { familyId: string };
    const revokedBy = await actorEmailOf(request);
    const result = await revokeApiKeyFamily({ agencyId, familyId, revokedBy });
    return sendServiceResult(reply, result, 200);
  });
}
