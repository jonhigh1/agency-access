import { FastifyInstance } from 'fastify';
import { prisma } from '@/lib/prisma';
import type { Platform } from '@agency-platform/shared';
import { PLATFORM_NAMES, MANUAL_PLATFORMS } from './constants.js';
import { assertAgencyAccess } from '@/lib/authorization.js';
import { CacheKeys, deleteCache, invalidateDashboardCache } from '@/lib/cache.js';
import { sendError, sendValidationError } from '../../lib/response.js';

export async function registerManualRoutes(fastify: FastifyInstance) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const pinterestBusinessIdRegex = /^\d{1,20}$/;

  /**
   * POST /agency-platforms/:platform/manual-connect
   * Create manual invitation connection (no OAuth tokens).
   */
  fastify.post('/agency-platforms/:platform/manual-connect', async (request, reply) => {
    const { platform } = request.params as { platform: string };
    const { agencyId, invitationEmail, businessId } = request.body as {
      agencyId?: string;
      invitationEmail?: string;
      businessId?: string;
    };

    if (!MANUAL_PLATFORMS.includes(platform as any)) {
      return sendError(reply, 'UNSUPPORTED_PLATFORM', `Platform "${platform}" does not support manual invitation flow. Supported platforms: ${MANUAL_PLATFORMS.join(', ')}`, 400);
    }

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }

    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(agencyId, principalAgencyId);
    if (accessError) {
      return reply.code(403).send({ data: null, error: accessError });
    }

    // Pinterest requires businessId. Shopify is enablement-only on agency-side;
    // client provides store details during invite flow.
    // other manual platforms require invitationEmail.
    const isPinterest = platform === 'pinterest';
    const isShopify = platform === 'shopify';

    if (isPinterest) {
      if (!businessId) {
        return sendValidationError(reply, 'businessId is required for Pinterest');
      }

      if (!pinterestBusinessIdRegex.test(businessId)) {
        return sendError(reply, 'INVALID_BUSINESS_ID', 'Pinterest Business ID must be 1-20 digits', 400);
      }
    } else if (!isShopify) {
      if (!invitationEmail) {
        return sendValidationError(reply, 'invitationEmail is required');
      }

      if (!emailRegex.test(invitationEmail)) {
        return sendError(reply, 'INVALID_EMAIL', 'Invalid email format', 400);
      }
    }

    const { agencyResolutionService } = await import('../../services/agency-resolution.service.js');
    const agencyResult = await agencyResolutionService.resolveAgency(agencyId, {
      createIfMissing: false,
    });

    if (agencyResult.error || !agencyResult.data) {
      return sendError(reply, 'AGENCY_NOT_FOUND', 'Agency not found', 404);
    }

    const actualAgencyId = agencyResult.data.agencyId;

    const existingConnection = await prisma.agencyPlatformConnection.findFirst({
      where: {
        agencyId: actualAgencyId,
        platform,
        status: 'active',
      },
    });

    if (existingConnection) {
      return sendError(reply, 'PLATFORM_ALREADY_CONNECTED', `${PLATFORM_NAMES[platform as Platform]} is already connected`, 409);
    }

    const connection = await prisma.agencyPlatformConnection.create({
      data: {
        agencyId: actualAgencyId,
        platform,
        connectionMode: 'manual_invitation',
        agencyEmail: isPinterest || isShopify ? null : invitationEmail!.toLowerCase(),
        secretId: null,
        status: 'active',
        verificationStatus: 'pending',
        connectedBy: 'agency',
        metadata: {
          authMethod: isPinterest
            ? 'manual_partnership'
            : isShopify
            ? 'manual_collaborator_request'
            : 'manual_team_invitation',
          ...(isPinterest ? { businessId } : {}),
          ...(isShopify ? {} : { invitationEmail: invitationEmail!.toLowerCase() }),
          invitationSentAt: new Date().toISOString(),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        agencyId: actualAgencyId,
        action: 'AGENCY_MANUAL_INVITATION_CONNECTED',
        userEmail: 'agency',
        agencyConnectionId: connection.id,
        metadata: {
          platform,
          connectionMode: 'manual_invitation',
          ...(isPinterest ? { businessId } : {}),
          ...(isShopify ? {} : { invitationEmail: invitationEmail!.toLowerCase() }),
        },
        ipAddress: '0.0.0.0',
        userAgent: 'unknown',
      },
    });

    await Promise.all([
      deleteCache(CacheKeys.agencyConnections(actualAgencyId)),
      invalidateDashboardCache(actualAgencyId),
    ]);

    return reply.code(201).send({
      data: {
        connectionId: connection.id,
        platform: connection.platform,
        agencyEmail: connection.agencyEmail,
        businessId: isPinterest ? businessId : undefined,
        status: connection.status,
        connectedAt: connection.connectedAt,
      },
      error: null,
    });
  });

  /**
   * PATCH /agency-platforms/:platform/manual-invitation
   * Update the invitation email for a manual invitation connection.
   */
  fastify.patch('/agency-platforms/:platform/manual-invitation', async (request, reply) => {
    const { platform } = request.params as { platform: string };
    const { agencyId, invitationEmail, businessId } = request.body as {
      agencyId?: string;
      invitationEmail?: string;
      businessId?: string;
    };

    if (!MANUAL_PLATFORMS.includes(platform as any)) {
      return sendError(reply, 'UNSUPPORTED_PLATFORM', `Platform "${platform}" does not support manual invitation flow. Supported platforms: ${MANUAL_PLATFORMS.join(', ')}`, 400);
    }

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }

    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(agencyId, principalAgencyId);
    if (accessError) {
      return reply.code(403).send({ data: null, error: accessError });
    }

    // Pinterest requires businessId.
    // Shopify details are client-owned and cannot be updated from agency settings.
    // other manual platforms require invitationEmail.
    const isPinterest = platform === 'pinterest';
    const isShopify = platform === 'shopify';
    if (isShopify) {
      return sendError(reply, 'UNSUPPORTED_OPERATION', 'Shopify store details are provided by the client during the access request flow.', 400);
    }

    if (isPinterest) {
      if (!businessId) {
        return sendValidationError(reply, 'businessId is required for Pinterest');
      }

      if (!pinterestBusinessIdRegex.test(businessId)) {
        return sendError(reply, 'INVALID_BUSINESS_ID', 'Pinterest Business ID must be 1-20 digits', 400);
      }
    } else {
      if (!invitationEmail) {
        return sendValidationError(reply, 'invitationEmail is required');
      }

      if (!emailRegex.test(invitationEmail)) {
        return sendError(reply, 'INVALID_EMAIL', 'Invalid email format', 400);
      }
    }

    const { agencyResolutionService } = await import('../../services/agency-resolution.service.js');
    const agencyResult = await agencyResolutionService.resolveAgency(agencyId, {
      createIfMissing: false,
    });

    if (agencyResult.error || !agencyResult.data) {
      return sendError(reply, 'AGENCY_NOT_FOUND', 'Agency not found', 404);
    }

    const actualAgencyId = agencyResult.data.agencyId;

    const existingConnection = await prisma.agencyPlatformConnection.findFirst({
      where: {
        agencyId: actualAgencyId,
        platform,
      },
    });

    if (!existingConnection) {
      return sendError(reply, 'CONNECTION_NOT_FOUND', `No connection found for ${PLATFORM_NAMES[platform as Platform]}`, 404);
    }

    const updatedConnection = await prisma.agencyPlatformConnection.update({
      where: { id: existingConnection.id },
      data: {
        agencyEmail: isPinterest || isShopify ? null : invitationEmail!.toLowerCase(),
        metadata: {
          ...((existingConnection.metadata as any) || {}),
          ...(isPinterest ? { businessId, businessIdUpdatedAt: new Date().toISOString() } : {}),
          ...(isPinterest
            ? {}
            : {
                invitationEmail: invitationEmail!.toLowerCase(),
                invitationEmailUpdatedAt: new Date().toISOString(),
              }),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        agencyId: actualAgencyId,
        action: 'AGENCY_MANUAL_INVITATION_UPDATED',
        userEmail: 'agency',
        agencyConnectionId: existingConnection.id,
        metadata: {
          platform,
          previousEmail: existingConnection.agencyEmail,
          newEmail: isPinterest || isShopify ? null : invitationEmail!.toLowerCase(),
          ...(isPinterest
            ? {
                previousBusinessId: (existingConnection.metadata as any)?.businessId,
                newBusinessId: businessId,
              }
            : {}),
        },
        ipAddress: '0.0.0.0',
        userAgent: 'unknown',
      },
    });

    await Promise.all([
      deleteCache(CacheKeys.agencyConnections(actualAgencyId)),
      invalidateDashboardCache(actualAgencyId),
    ]);

    return reply.send({
      data: {
        connectionId: updatedConnection.id,
        platform: updatedConnection.platform,
        agencyEmail: updatedConnection.agencyEmail,
        businessId: isPinterest ? businessId : undefined,
        status: updatedConnection.status,
        connectedAt: updatedConnection.connectedAt,
      },
      error: null,
    });
  });
}
