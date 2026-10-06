/**
 * Access Request Routes
 *
 * API endpoints for creating and managing access requests.
 * Protected by Clerk JWT verification.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ManualConfirmationPlatformSchema,
  ManualConfirmationRequestSchema,
} from '@agency-platform/shared';
import { accessRequestService } from '../services/access-request.service.js';
import {
  isManualConfirmationActorId,
  manualConfirmationService,
} from '../services/manual-confirmation.service.js';
import { agencyPlatformService } from '../services/agency-platform.service.js';
import { auditService } from '../services/audit.service.js';
import { accessRequestReminderService } from '../services/access-request-reminder.service.js';
import { quotaEnforcementMiddleware } from '../middleware/quota-enforcement.js';
import { authenticate } from '@/middleware/auth.js';
import { assertAgencyAccess, resolveAuthenticatedUserEmail } from '@/lib/authorization.js';
import { requirePrincipalAgency } from '@/lib/agency-guard.js';
import { sendError } from '../lib/response.js';
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from '@/lib/list-pagination.js';
import { extractClientIp } from '@/lib/ip.js';

const listAccessRequestsQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

const excludeMetaGrantSchema = z.object({
  reason: z.string().trim().min(10).max(500),
  confirmed: z.literal(true),
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
    const bodyValidation = z.record(z.unknown()).safeParse(request.body);
    if (!bodyValidation.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Request body must be a JSON object', 400);
    }
    const requestBody = bodyValidation.data;
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
    const result = await accessRequestService.createAccessRequest(transformedRequestBody, request);

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
        result.error.code === 'REQUEST_EXPIRED' ||
        result.error.code === 'REQUEST_REVOKED'
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

    const result = await accessRequestService.updateAccessRequest(id, transformedRequestBody as any, request);

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

  fastify.post('/access-requests/:id/manual-confirmations/:platform', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const params = z.object({
      id: z.string().min(1),
      platform: ManualConfirmationPlatformSchema,
    }).safeParse(request.params);
    const body = ManualConfirmationRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'A supported platform and explicit confirmation are required', 400);
    }

    const existing = await accessRequestService.getAccessRequestOwnershipById(params.data.id);
    if (existing.error || !existing.data) {
      const statusCode = existing.error?.code === 'NOT_FOUND' ? 404 : 500;
      return reply.code(statusCode).send(existing);
    }

    const agencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(existing.data.agencyId, agencyId);
    if (accessError) {
      return reply.code(403).send({ data: null, error: accessError });
    }

    const actorEmail = await resolveAuthenticatedUserEmail((request as any).user);
    if (!actorEmail) {
      return sendError(reply, 'USER_EMAIL_REQUIRED', 'Authenticated user email is required to confirm manual access', 401);
    }
    const actorId = (request as any).user?.sub;
    if (!isManualConfirmationActorId(actorId)) {
      return sendError(reply, 'AGENCY_USER_REQUIRED', 'A verified agency user is required to confirm manual access', 403);
    }

    const result = await manualConfirmationService.confirmManualAccess({
      accessRequestId: params.data.id,
      agencyId,
      platform: params.data.platform,
      actorId,
      actorEmail,
      ipAddress: extractClientIp(request),
      userAgent: (request.headers['user-agent'] as string | undefined) || 'unknown',
    });
    if (result.error) {
      const statusByCode: Record<string, number> = {
        NOT_FOUND: 404,
        REQUEST_REVOKED: 409,
        REQUEST_EXPIRED: 409,
        PLATFORM_NOT_REQUESTED: 400,
        MANUAL_EVIDENCE_NOT_FOUND: 409,
        MANUAL_EVIDENCE_ALREADY_VERIFIED: 409,
        MANUAL_CONNECTION_UNAVAILABLE: 409,
        AGENCY_USER_REQUIRED: 403,
      };
      return reply.code(statusByCode[result.error.code] ?? 500).send(result);
    }

    return reply.send(result);
  });

  // Send client invite reminder email (Resend)
  fastify.post('/access-requests/:id/remind', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const principalAgencyId = (request as any).principalAgencyId as string;

    const existing = await accessRequestService.getAccessRequestById(id);
    if (existing.error) {
      const statusCode = existing.error.code === 'NOT_FOUND' ? 404 : 500;
      return reply.code(statusCode).send({ data: null, error: existing.error });
    }
    if (!existing.error && existing.data) {
      const accessError = assertAgencyAccess((existing.data as any).agencyId, principalAgencyId);
      if (accessError) {
        return reply.code(403).send({
          data: null,
          error: accessError,
        });
      }
    }

    const result = await accessRequestReminderService.sendInviteReminder(id);

    if (result.error) {
      const statusByCode: Record<string, number> = {
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        INVALID_STATUS: 400,
        MISSING_CLIENT_EMAIL: 400,
        REMINDER_COOLDOWN: 429,
        EMAIL_NOT_CONFIGURED: 503,
        REMINDER_DELIVERY_FAILED: 502,
      };
      const statusCode = statusByCode[result.error.code] ?? 400;
      return reply.code(statusCode).send({
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
        action: 'ACCESS_REQUEST_REMINDER_SENT',
        resourceType: 'access_request',
        resourceId: id,
        metadata: {
          clientName: (existing.data as any).clientName,
          clientEmail: (existing.data as any).clientEmail,
          recipientEmail: result.data?.recipientEmail,
        },
        request,
      });
    }

    return reply.send(result);
  });

  // Exclude one Meta grant
  fastify.post('/access-requests/:id/meta-grants/:grantId/exclude', {
    onRequest: [authenticate(), requirePrincipalAgency],
  }, async (request, reply) => {
    const { id, grantId } = request.params as { id: string; grantId: string };
    const body = excludeMetaGrantSchema.safeParse(request.body);
    if (!body.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'A confirmed exclusion reason is required', 400);
    }

    const result = await accessRequestService.excludeMetaGrant({
      accessRequestId: id,
      grantId,
      agencyId: (request as any).principalAgencyId as string,
      ownerSubject: (request as any).user.sub as string,
      actorEmail:
        ((request as any).user?.email as string | undefined) ||
        ((request as any).user?.sub as string | undefined) ||
        'agency-owner',
      reason: body.data.reason,
    });
    if (result.error) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : result.error.code === 'INTERNAL_ERROR' ? 500 : 403;
      return reply.code(statusCode).send(result);
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
    if (existing.error) {
      const statusCode = existing.error.code === 'NOT_FOUND' ? 404 : 500;
      return reply.code(statusCode).send({
        data: null,
        error: existing.error,
      });
    }

    if (!existing.error && existing.data) {
      const accessError = assertAgencyAccess((existing.data as any).agencyId, principalAgencyId);
      if (accessError) {
        return reply.code(403).send({
          data: null,
          error: accessError,
        });
      }
    }

    const result = await accessRequestService.cancelAccessRequest(id, {
      userEmail:
        ((request as any).user?.email as string | undefined) ||
        ((request as any).user?.sub as string | undefined) ||
        'agency',
      ipAddress: request.ip || '0.0.0.0',
      userAgent: (request.headers['user-agent'] as string) || 'unknown',
    });

    if (result.error) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 500;
      return reply.code(statusCode).send({
        data: null,
        error: result.error,
      });
    }

    return reply.send({ data: { success: true }, error: null });
  });
}
