/**
 * Access Request Routes
 *
 * API endpoints for creating and managing access requests.
 * Protected by Clerk JWT verification.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { accessRequestService } from '../services/access-request.service.js';
import { agencyPlatformService } from '../services/agency-platform.service.js';
import { auditService } from '../services/audit.service.js';
import { quotaEnforcementMiddleware } from '../middleware/quota-enforcement.js';
import { authenticate } from '@/middleware/auth.js';
import { assertAgencyAccess } from '@/lib/authorization.js';
import { requirePrincipalAgency } from '@/lib/agency-guard.js';
import { sendError } from '../lib/response.js';
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from '@/lib/list-pagination.js';

const listAccessRequestsQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

const ACCESS_LEVEL_MAP: Record<string, 'manage' | 'view_only'> = {
  admin: 'manage',
  standard: 'manage',
  read_only: 'view_only',
  email_only: 'view_only',
  manage: 'manage',
  view_only: 'view_only',
};

function normalizePlatformsPayload(platforms: any): Array<{ platform: string; accessLevel: 'manage' | 'view_only'; accountId?: string }> {
  if (Array.isArray(platforms)) {
    return platforms.flatMap((entry: any) => {
      if (entry?.platformGroup && Array.isArray(entry.products)) {
        return entry.products
          .filter((product: any) => typeof product?.product === 'string')
          .map((product: any) => {
            const base = {
              platform: product.product,
              accessLevel: ACCESS_LEVEL_MAP[product.accessLevel] || 'manage' as const,
            };
            if (typeof product.accountId === 'string' && product.accountId.trim().length > 0) {
              return { ...base, accountId: product.accountId.trim() };
            }
            return base;
          });
      }

      if (typeof entry?.platform === 'string') {
        const base = {
          platform: entry.platform,
          accessLevel: ACCESS_LEVEL_MAP[entry.accessLevel] || 'manage' as const,
        };
        if (typeof entry.accountId === 'string' && entry.accountId.trim().length > 0) {
          return [{ ...base, accountId: entry.accountId.trim() }];
        }
        return [base];
      }

      if (typeof entry === 'string') {
        return [{
          platform: entry,
          accessLevel: 'manage' as const,
        }];
      }

      return [];
    });
  }

  if (platforms && typeof platforms === 'object') {
    return Object.entries(platforms).flatMap(([_, products]) => {
      if (!Array.isArray(products)) return [];
      return products
        .filter((product) => typeof product === 'string')
        .map((product) => ({
          platform: product,
          accessLevel: 'manage' as const,
        }));
    });
  }

  return [];
}

export async function accessRequestRoutes(fastify: FastifyInstance) {

  // Create access request
  fastify.post(
    '/access-requests',
    {
      onRequest: [
        authenticate(),
        requirePrincipalAgency,
        quotaEnforcementMiddleware({
          metric: 'access_requests',
          getAgencyId: (request) => (request as any).agencyId,
        }),
      ],
    },
    async (request, reply) => {
    const requestBody = request.body as any;
    const originalPlatforms = requestBody.platforms ?? [];
    const transformedPlatforms = normalizePlatformsPayload(originalPlatforms);
    const principalAgencyId = (request as any).principalAgencyId as string;

    const resolvedAgencyId = principalAgencyId;
    // Update the request body with the resolved agencyId
    requestBody.agencyId = resolvedAgencyId;

    // Log transformation for debugging
    fastify.log.info({
      originalPlatforms,
      transformedPlatforms,
      platformCount: transformedPlatforms.length,
    });

    // Update request body with transformed platforms
    const transformedRequestBody = {
      ...requestBody,
      platforms: transformedPlatforms,
    };

    // Proceed with access request creation
    const result = await accessRequestService.createAccessRequest(transformedRequestBody);

    if (result.error) {
      const statusCode = result.error.code === 'SUBDOMAIN_TAKEN' ? 409 : 400;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.code(201).send(result);
    },
  );

  // Get access request by unique token (for client authorization flow - no auth required)
  fastify.get('/client/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    const result = await accessRequestService.getAccessRequestByToken(token);

    if (result.error) {
      const statusCode = (
        result.error.code === 'NOT_FOUND' ||
        result.error.code === 'EXPIRED' ||
        result.error.code === 'REQUEST_NOT_FOUND' ||
        result.error.code === 'REQUEST_EXPIRED'
      ) ? 404 : 400;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  // Get all access requests for an agency
  fastify.get('/agencies/:id/access-requests', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = listAccessRequestsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return sendError(
        reply,
        'VALIDATION_ERROR',
        query.error.errors[0]?.message || 'Invalid list query',
        400
      );
    }
    const principalAgencyId = (request as any).principalAgencyId as string;

    const accessError = assertAgencyAccess(id, principalAgencyId);
    if (accessError) {
      return reply.code(403).send({
        data: null,
        error: accessError,
      });
    }

    const result = await accessRequestService.getAgencyAccessRequests(id, {
      status: query.data.status as any,
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

  // Get single access request by ID
  fastify.get('/access-requests/:id', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;

    const result = await accessRequestService.getAccessRequestById(id);

    if (!result.error && result.data) {
      const accessError = assertAgencyAccess((result.data as any).agencyId, principalAgencyId);
      if (accessError) {
        return reply.code(403).send({
          data: null,
          error: accessError,
        });
      }
    }

    if (result.error) {
      return reply.code(404).send({
        data: null,
        error: result.error,
      });
    }

    const shopifySubmission = (result.data as any)?.shopifySubmission;
    if (
      shopifySubmission &&
      (shopifySubmission.status === 'submitted' || shopifySubmission.status === 'legacy_unreadable')
    ) {
      await auditService.createAuditLog({
        agencyId: (result.data as any).agencyId,
        userEmail:
          ((request as any).user?.email as string | undefined) ||
          ((request as any).user?.sub as string | undefined) ||
          'agency',
        action: 'SHOPIFY_SUBMISSION_VIEWED',
        resourceType: 'access_request',
        resourceId: id,
        metadata: {
          shopifySubmissionStatus: shopifySubmission.status,
          hasCollaboratorCode: typeof shopifySubmission.collaboratorCode === 'string',
          shopDomain: shopifySubmission.shopDomain,
          connectionId: shopifySubmission.connectionId,
        },
        request,
      });
    }

    return reply.send(result);
  });

  // Update access request
  fastify.patch('/access-requests/:id', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;
    const requestBody = request.body as any;

    const existing = await accessRequestService.getAccessRequestById(id);
    if (!existing.error && existing.data) {
      const accessError = assertAgencyAccess((existing.data as any).agencyId, principalAgencyId);
      if (accessError) {
        return reply.code(403).send({
          data: null,
          error: accessError,
        });
      }
    }

    const identityFields = ['clientName', 'clientEmail'].filter((field) => requestBody?.[field] !== undefined);
    if (identityFields.length > 0) {
      return sendError(reply, 'VALIDATION_ERROR', 'Client identity fields must be edited in client profile management', 400, { fields: identityFields });
    }

    const transformedRequestBody = {
      ...requestBody,
      ...(requestBody?.platforms !== undefined
        ? { platforms: normalizePlatformsPayload(requestBody.platforms) }
        : {}),
    };

    const result = await accessRequestService.updateAccessRequest(id, transformedRequestBody as any);

    if (result.error) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  // Mark request as authorized (called after successful OAuth)
  fastify.post('/access-requests/:id/authorize', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;

    const existing = await accessRequestService.getAccessRequestById(id);
    if (!existing.error && existing.data) {
      const accessError = assertAgencyAccess((existing.data as any).agencyId, principalAgencyId);
      if (accessError) {
        return reply.code(403).send({
          data: null,
          error: accessError,
        });
      }
    }

    const result = await accessRequestService.markRequestAuthorized(id);

    if (result.error) {
      return reply.code(404).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send(result);
  });

  // Cancel access request
  fastify.post('/access-requests/:id/cancel', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;

    const existing = await accessRequestService.getAccessRequestById(id);
    if (!existing.error && existing.data) {
      const accessError = assertAgencyAccess((existing.data as any).agencyId, principalAgencyId);
      if (accessError) {
        return reply.code(403).send({
          data: null,
          error: accessError,
        });
      }
    }

    const result = await accessRequestService.cancelAccessRequest(id);

    if (result.error) {
      return reply.code(404).send({
        data: null,
        error: result.error,
      });
    }

    if (existing.data) {
      await auditService.createAuditLog({
        agencyId: (existing.data as any).agencyId,
        userEmail:
          ((request as any).user?.email as string | undefined) ||
          ((request as any).user?.sub as string | undefined) ||
          'agency',
        action: 'ACCESS_REQUEST_REVOKED',
        resourceType: 'access_request',
        resourceId: id,
        metadata: {
          clientName: (existing.data as any).clientName,
          clientEmail: (existing.data as any).clientEmail,
        },
        request,
      });
    }

    return reply.send({ data: { success: true }, error: null });
  });
}
