/**
 * Client Routes
 *
 * API endpoints for client CRUD operations.
 * Part of Phase 5: Enhanced Access Request Creation.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  findClientByEmail,
  deleteClient,
  getClientsWithConnections,
  getClientDetail,
  ClientError,
} from '@/services/client.service';
import type { ClientLanguage } from '@agency-platform/shared';
import { prisma } from '@/lib/prisma';
import { quotaEnforcementMiddleware } from '@/middleware/quota-enforcement.js';
import { authenticate } from '@/middleware/auth.js';
import { resolvePrincipalAgency, resolveAuthenticatedUserEmail } from '@/lib/authorization.js';
import { extractClientIp } from '@/lib/ip.js';

// Validation schemas
const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().min(1, 'Company is required'),
  email: z.string().email('Invalid email format'),
  website: z.string().url('Invalid URL format').optional(),
  language: z.enum(['en', 'es', 'nl']).optional(),
});

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  language: z.enum(['en', 'es', 'nl']).optional(),
});

const getClientsSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function clientRoutes(fastify: FastifyInstance) {
  // Set 404 handler for this route scope
  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Client not found',
      },
    });
  });

  fastify.addHook('onRequest', authenticate());

  // Resolve principal agency from verified auth context
  fastify.addHook('onRequest', async (request, reply) => {
    const principalResult = await resolvePrincipalAgency(request);
    if (principalResult.error || !principalResult.data) {
      const statusCode = principalResult.error?.code === 'UNAUTHORIZED' ? 401 : 403;
      return reply.code(statusCode).send({
        error: principalResult.error || {
          code: 'FORBIDDEN',
          message: 'Unable to resolve agency for authenticated user',
        },
      });
    }

    (request as any).agencyId = principalResult.data.agencyId;
  });

  /**
   * POST /api/clients
   * Create a new client
   */
  fastify.post(
    '/clients',
    {
      onRequest: [quotaEnforcementMiddleware({
        metric: 'clients',
        getAgencyId: (request) => (request as any).agencyId,
      })],
    },
    async (request, reply) => {
    const agencyId = (request as any).agencyId;

    // Validate request body
    const validationResult = createClientSchema.safeParse(request.body);
    if (!validationResult.success) {
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.error.errors[0].message,
          details: validationResult.error.errors,
        },
      });
    }

    try {
      const client = await createClient({
        agencyId,
        ...validationResult.data,
      });
      return reply.code(201).send({ data: client });
    } catch (error) {
      if (error instanceof Error && error.message.includes('EMAIL_EXISTS')) {
        return reply.code(409).send({
          data: null,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'A client with this email already exists',
          },
        });
      }
      // For unexpected errors, let Fastify handle them (will result in 500)
      throw error;
    }
    },
  );

  /**
   * GET /api/clients
   * List clients with pagination and search
   */
  fastify.get('/clients', async (request, reply) => {
    const agencyId = (request as any).agencyId;

    // Validate query params
    const validationResult = getClientsSchema.safeParse(request.query);
    if (!validationResult.success) {
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.error.errors[0].message,
          details: validationResult.error.errors,
        },
      });
    }

    const result = await getClientsWithConnections({
      agencyId,
      ...validationResult.data,
    });

    return reply.send({ data: result });
  });

  /**
   * GET /api/clients/:id
   * Get a client by ID
   */
  fastify.get('/clients/:id', async (request, reply) => {
    const agencyId = (request as any).agencyId;
    const { id } = request.params as { id: string };

    const client = await getClientById(id, agencyId);

    if (!client) {
      return reply.code(404).send({
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Client not found',
        },
      });
    }

    return reply.send({ data: client });
  });

  /**
   * GET /api/clients/:id/detail
   * Get detailed client information including stats, access requests, and activity
   */
  fastify.get('/clients/:id/detail', async (request, reply) => {
    const agencyId = (request as any).agencyId;
    const { id } = request.params as { id: string };

    const detail = await getClientDetail({ clientId: id, agencyId });

    if (!detail) {
      return reply.code(404).send({
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Client not found',
        },
      });
    }

    return reply.send({ data: detail });
  });

  /**
   * PUT /api/clients/:id
   * Update a client
   */
  fastify.put('/clients/:id', async (request, reply) => {
    const agencyId = (request as any).agencyId;
    const { id } = request.params as { id: string };

    // Validate request body
    const validationResult = updateClientSchema.safeParse(request.body);
    if (!validationResult.success) {
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.error.errors[0].message,
          details: validationResult.error.errors,
        },
      });
    }

    try {
      const client = await updateClient(id, agencyId, validationResult.data);

      if (!client) {
        return reply.code(404).send({
          data: null,
          error: {
            code: 'NOT_FOUND',
            message: 'Client not found',
          },
        });
      }

      return reply.send({ data: client });
    } catch (error) {
      if (error instanceof Error && error.message.includes('EMAIL_EXISTS')) {
        return reply.code(409).send({
          data: null,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'A client with this email already exists',
          },
        });
      }
      // For unexpected errors, let Fastify handle them (will result in 500)
      throw error;
    }
    },
  );

  /**
   * DELETE /api/clients/:id
   * Delete a client
   */
  fastify.delete('/clients/:id', async (request, reply) => {
    const agencyId = (request as any).agencyId;
    const { id } = request.params as { id: string };
    // Session JWTs may not carry an email claim; fall back to the verified
    // Clerk record so the audit actor is always an authenticated identity.
    const userEmail = await resolveAuthenticatedUserEmail((request as any).user);
    if (!userEmail) return reply.code(401).send({ data: null, error: { code: 'USER_EMAIL_REQUIRED', message: 'Authenticated user email is required to delete a client' } });

    const deleted = await deleteClient(id, agencyId, {
      userEmail,
      ipAddress: extractClientIp(request),
    });

    if (!deleted) {
      return reply.code(404).send({
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Client not found',
        },
      });
    }

    return reply.code(204).send();
  });

  /**
   * GET /api/clients/search
   * Search for a client by email
   */
  fastify.get('/clients/search', async (request, reply) => {
    const agencyId = (request as any).agencyId;
    const { email } = request.query as { email?: string };

    if (!email) {
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email query parameter is required',
        },
      });
    }

    const client = await findClientByEmail(agencyId, email);

    if (!client) {
      return reply.code(404).send({
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Client not found',
        },
      });
    }

    return reply.send({ data: client });
  });
}
