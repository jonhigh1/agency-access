/**
 * Token Health Routes
 *
 * API endpoints for monitoring and managing token health.
 * Protected by Clerk JWT verification.
 */

import { FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Platform } from '@agency-platform/shared';
import { connectionService } from '../services/connection.service.js';
import { authenticate } from '@/middleware/auth.js';
import { resolvePrincipalAgency, type AuthorizationError } from '@/lib/authorization.js';
import { prisma } from '@/lib/prisma.js';
import { sendError, sendValidationError } from '../lib/response.js';
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from '@/lib/list-pagination.js';

const listConnectionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

function sendRouteError(reply: FastifyReply, error: AuthorizationError, statusCode: number) {
  return reply.code(statusCode).send({
    data: null,
    error,
  });
}

async function resolveAgencyIdOrReply(request: FastifyRequest, reply: FastifyReply) {
  const principal = await resolvePrincipalAgency(request);
  if (principal.error || !principal.data) {
    return {
      agencyId: null,
      sent: sendRouteError(
        reply,
        principal.error ?? {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user context is required',
        },
        principal.error?.code === 'FORBIDDEN' ? 403 : 401
      ),
    };
  }

  return { agencyId: principal.data.agencyId, sent: null };
}

/**
 * Agency-scoped connection fetch shared by the ownership guard and the
 * handler, so a request reads the connection row once. Returns null when the
 * connection does not exist or belongs to another agency.
 */
async function findAgencyConnection(connectionId: string, agencyId: string) {
  return prisma.clientConnection.findFirst({
    where: {
      id: connectionId,
      agencyId,
    },
  });
}

function connectionNotFound() {
  return {
    code: 'CONNECTION_NOT_FOUND',
    message: 'Connection not found',
  };
}

async function findAuthorizationForAgency(authorizationId: string, agencyId: string) {
  const authorization = await prisma.platformAuthorization.findUnique({
    where: { id: authorizationId },
    select: {
      id: true,
      connectionId: true,
      platform: true,
      connection: {
        select: {
          agencyId: true,
        },
      },
    },
  });

  if (!authorization || authorization.connection.agencyId !== agencyId) {
    return {
      data: null,
      error: {
        code: 'AUTHORIZATION_NOT_FOUND',
        message: 'Platform authorization not found',
      },
    };
  }

  return { data: authorization, error: null };
}

export async function tokenHealthRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate());

  // Get token health for all connections
  fastify.get('/token-health', async (request, reply) => {
    const { agencyId, sent } = await resolveAgencyIdOrReply(request, reply);
    if (!agencyId) return sent;

    const result = await connectionService.getAgencyTokenHealth(agencyId);

    if (result.error) {
      return reply.code(500).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  // Get connections for an agency
  fastify.get('/connections', async (request, reply) => {
    const { agencyId, sent } = await resolveAgencyIdOrReply(request, reply);
    if (!agencyId) return sent;

    const query = listConnectionsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return sendError(
        reply,
        'VALIDATION_ERROR',
        query.error.errors[0]?.message || 'Invalid list query',
        400
      );
    }

    const result = await connectionService.getAgencyConnectionSummaries(agencyId, {
      limit: query.data.limit,
      offset: query.data.offset,
    });

    if (result.error) {
      return reply.code(500).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  // Get single connection
  fastify.get('/connections/:id', async (request, reply) => {
    const { agencyId, sent } = await resolveAgencyIdOrReply(request, reply);
    if (!agencyId) return sent;

    const { id } = request.params as { id: string };
    // Single fetch: ownership check + response row.
    const connection = await findAgencyConnection(id, agencyId);
    if (!connection) {
      return sendRouteError(reply, connectionNotFound(), 404);
    }

    return reply.send({ data: connection, error: null });
  });

  // Revoke connection
  fastify.post('/connections/:id/revoke', async (request, reply) => {
    const { agencyId, sent } = await resolveAgencyIdOrReply(request, reply);
    if (!agencyId) return sent;

    const { id } = request.params as { id: string };
    // Single fetch: ownership check + the row revokeConnection needs.
    const connection = await findAgencyConnection(id, agencyId);
    if (!connection) {
      return sendRouteError(reply, connectionNotFound(), 404);
    }

    const result = await connectionService.revokeConnection(id, connection);

    if (result.error) {
      return reply.code(result.error.code === 'NOT_FOUND' ? 404 : 500).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  // Refresh platform token
  fastify.post('/token-refresh', async (request, reply) => {
    const { agencyId, sent } = await resolveAgencyIdOrReply(request, reply);
    if (!agencyId) return sent;

    const { connectionId, platform } = request.body as { connectionId: string; platform: Platform };

    if (!connectionId || !platform) {
      return sendValidationError(reply, 'connectionId and platform are required');
    }

    const connection = await findAgencyConnection(connectionId, agencyId);
    if (!connection) {
      return sendRouteError(reply, connectionNotFound(), 404);
    }

    const result = await connectionService.refreshPlatformAuthorization(connectionId, platform);

    if (result.error) {
      return reply.code(400).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  // Revoke platform authorization
  fastify.post('/authorizations/:id/revoke', async (request, reply) => {
    const { agencyId, sent } = await resolveAgencyIdOrReply(request, reply);
    if (!agencyId) return sent;

    const { id } = request.params as { id: string };

    const authResult = await findAuthorizationForAgency(id, agencyId);
    const auth = authResult.data;

    if (authResult.error || !auth) {
      return reply.code(404).send({
        data: null,
        error: authResult.error,
      });
    }

    const result = await connectionService.revokePlatformAuthorization(auth.connectionId, auth.platform as Platform);

    if (result.error) {
      return reply.code(result.error.code === 'NOT_FOUND' ? 404 : 500).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send({ data: { success: true }, error: null });
  });
}
