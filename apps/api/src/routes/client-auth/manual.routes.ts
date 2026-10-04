import { FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { accessRequestService } from '../../services/access-request.service.js';
import { auditService } from '../../services/audit.service.js';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';
import { sendError } from '../../lib/response.js';
import { isPlatformRequested } from './platform-request.js';

export async function registerManualRoutes(fastify: FastifyInstance) {
  type EmailManualPlatform = 'beehiiv' | 'kit' | 'mailchimp' | 'klaviyo' | 'zapier';

  const normalizeShopDomain = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');

  const isValidShopifyDomain = (value: string): boolean =>
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value);

  const hashCollaboratorCode = (value: string): string =>
    createHash('sha256')
      .update(`shopify-collaborator-code:${value}`)
      .digest('hex');

  const saveManualConnection = async ({
    accessRequestId,
    agencyId,
    clientEmail,
    grantedAssets,
  }: {
    accessRequestId: string;
    agencyId: string;
    clientEmail: string;
    grantedAssets: Record<string, unknown>;
  }) => {
    const platform = grantedAssets.platform as string;
    const patch = JSON.stringify({ [platform]: grantedAssets });
    const updateExisting = () => prisma.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      UPDATE client_connections
      SET client_email = CASE
            WHEN granted_assets -> ${platform} ->> 'verificationStatus' = 'verified' THEN client_email
            ELSE ${clientEmail}
          END,
          status = CASE
            WHEN granted_assets -> ${platform} ->> 'verificationStatus' = 'verified' THEN status
            WHEN status = 'active' THEN 'active'
            ELSE 'pending_verification'
          END,
          granted_assets = CASE
            WHEN granted_assets -> ${platform} ->> 'verificationStatus' = 'verified' THEN granted_assets
            ELSE COALESCE(granted_assets, '{}'::jsonb) || ${patch}::jsonb
          END
      WHERE access_request_id = ${accessRequestId}
      RETURNING id, status
    `);
    const updated = await updateExisting();
    if (updated[0]) return { connection: updated[0], existed: true };
    try {
      const connection = await prisma.clientConnection.create({
        data: { accessRequestId, agencyId, clientEmail, status: 'pending_verification', grantedAssets: { [platform]: grantedAssets } as Prisma.InputJsonValue },
      });
      return { connection, existed: false };
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const concurrentUpdate = await updateExisting();
      if (concurrentUpdate[0]) return { connection: concurrentUpdate[0], existed: true };
      throw error;
    }
  };

  const createEmailManualConnectHandler = (
    platform: EmailManualPlatform,
    successMessage: string,
    logContext: string
  ) => {
    return async (
      request: FastifyRequest<{
        Params: { token: string };
        Body: {
          agencyEmail: string;
          clientEmail?: string;
          platform: EmailManualPlatform;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { token } = request.params;

      const manualConnectSchema = z.object({
        agencyEmail: z.string().email(),
        clientEmail: z.string().email().optional(),
        platform: z.literal(platform),
      });

      const validated = manualConnectSchema.safeParse(request.body);
      if (!validated.success) {
        return sendError(reply, 'VALIDATION_ERROR', 'Invalid request data', 400, validated.error.errors,);
      }

      const { agencyEmail, clientEmail } = validated.data;
      const accessRequest = await accessRequestService.getAccessRequestByToken(token);

      if (accessRequest.error || !accessRequest.data) {
        return sendError(reply, 'INVALID_TOKEN', 'Access request not found or expired', 404);
      }

      if (accessRequest.data.status === 'completed') {
        return sendError(reply, 'REQUEST_COMPLETED', 'Access request has already been completed', 409);
      }

      if (!isPlatformRequested(accessRequest.data.platforms, platform)) {
        return sendError(reply, 'PLATFORM_NOT_REQUESTED', 'Platform was not requested in this access request', 400);
      }

      const manualInviteTarget = (accessRequest.data as {
        manualInviteTargets?: Record<string, { agencyEmail?: string }>;
      }).manualInviteTargets?.[platform];
      if (manualInviteTarget && !manualInviteTarget.agencyEmail) {
        return sendError(
          reply,
          'MANUAL_INVITE_TARGET_UNAVAILABLE',
          'Your agency has not configured an invite email for this platform. Contact your agency and try again.',
          409
        );
      }

      try {
        const resolvedClientEmail = clientEmail || accessRequest.data.clientEmail || 'unknown';
        const grantedAssetsPayload = {
          platform,
          agencyEmail,
          clientEmail: clientEmail || accessRequest.data.clientEmail,
          invitationSentAt: new Date().toISOString(),
          authMethod: 'manual_team_invitation',
          verificationStatus: 'pending',
        };

        const { connection, existed } = await saveManualConnection({
          accessRequestId: accessRequest.data.id,
          agencyId: accessRequest.data.agencyId,
          clientEmail: resolvedClientEmail,
          grantedAssets: grantedAssetsPayload,
        });

        await auditService.createAuditLog({
          agencyId: accessRequest.data.agencyId,
          action: existed ? 'MANUAL_INVITATION_UPDATED' : 'MANUAL_INVITATION_INITIATED',
          resourceType: 'ClientConnection',
          resourceId: connection.id,
          platform,
          metadata: {
            connectionId: connection.id,
            clientEmail: clientEmail || accessRequest.data.clientEmail,
            agencyEmail,
            accessRequestId: accessRequest.data.id,
          },
        });

        return reply.send({
          data: {
            connectionId: connection.id,
            status: connection.status,
            agencyEmail,
            message: successMessage,
          },
          error: null,
        });
      } catch (error) {
        fastify.log.error({
          error,
          context: logContext,
          agencyEmail,
        });

        return sendError(reply, 'CONNECTION_CREATION_FAILED', 'Failed to create connection. Please try again.', 500);
      }
    };
  };

  // Manual connection endpoint for platforms that don't use OAuth (e.g., Beehiiv)
  fastify.post(
    '/client/:token/beehiiv/manual-connect',
    createEmailManualConnectHandler(
      'beehiiv',
      'Manual invitation initiated. Waiting for agency to accept Beehiiv team invite.',
      'Failed to create Beehiiv manual connection'
    )
  );

  // Kit manual connection endpoint (team invitation flow)
  fastify.post(
    '/client/:token/kit/manual-connect',
    createEmailManualConnectHandler(
      'kit',
      'Manual invitation initiated. Waiting for agency to accept Kit team invite.',
      'Failed to create Kit manual connection'
    )
  );

  fastify.post(
    '/client/:token/mailchimp/manual-connect',
    createEmailManualConnectHandler(
      'mailchimp',
      'Manual invitation initiated. Waiting for agency to accept Mailchimp team invite.',
      'Failed to create Mailchimp manual connection'
    )
  );

  fastify.post(
    '/client/:token/klaviyo/manual-connect',
    createEmailManualConnectHandler(
      'klaviyo',
      'Manual invitation initiated. Waiting for agency to accept Klaviyo team invite.',
      'Failed to create Klaviyo manual connection'
    )
  );

  fastify.post(
    '/client/:token/zapier/manual-connect',
    createEmailManualConnectHandler(
      'zapier',
      'Manual invitation initiated. Waiting for agency to accept Zapier team invite.',
      'Failed to create Zapier manual connection'
    )
  );

  // Pinterest manual connection endpoint (partnership flow)
  fastify.post('/client/:token/pinterest/manual-connect', async (request, reply) => {
  const { token } = request.params as { token: string };

  const manualConnectSchema = z.object({
    businessId: z.string().regex(/^\d{1,20}$/, 'Pinterest Business ID must be 1-20 digits'),
    clientEmail: z.string().email().optional(),
    platform: z.literal('pinterest'),
  });

  const validated = manualConnectSchema.safeParse(request.body);
  if (!validated.success) {
    return sendError(reply, 'VALIDATION_ERROR', 'Invalid request data', 400, validated.error.errors,);
  }

  const { businessId, clientEmail } = validated.data;

  const accessRequest = await accessRequestService.getAccessRequestByToken(token);

  if (accessRequest.error || !accessRequest.data) {
    return sendError(reply, 'INVALID_TOKEN', 'Access request not found or expired', 404);
  }

  if (accessRequest.data.status === 'completed') {
    return sendError(reply, 'REQUEST_COMPLETED', 'Access request has already been completed', 409);
  }

  if (!isPlatformRequested(accessRequest.data.platforms, 'pinterest')) {
    return sendError(reply, 'PLATFORM_NOT_REQUESTED', 'Platform was not requested in this access request', 400);
  }

  try {
    const resolvedClientEmail = clientEmail || accessRequest.data.clientEmail || 'unknown';
    const { connection, existed } = await saveManualConnection({
      accessRequestId: accessRequest.data.id,
      agencyId: accessRequest.data.agencyId,
      clientEmail: resolvedClientEmail,
      grantedAssets: {
        platform: 'pinterest',
        businessId,
        clientEmail: clientEmail || accessRequest.data.clientEmail,
        setupComplete: true,
        setupCompletedAt: new Date().toISOString(),
        authMethod: 'manual_partnership',
        verificationStatus: 'pending',
      },
    });

    await auditService.createAuditLog({
      agencyId: accessRequest.data.agencyId,
      action: existed ? 'MANUAL_INVITATION_UPDATED' : 'MANUAL_INVITATION_INITIATED',
      resourceType: 'ClientConnection',
      resourceId: connection.id,
      platform: 'pinterest',
      metadata: {
        connectionId: connection.id,
        clientEmail: clientEmail || accessRequest.data.clientEmail,
        businessId,
        accessRequestId: accessRequest.data.id,
      },
    });

    return reply.send({
      data: {
        connectionId: connection.id,
        status: connection.status,
        businessId,
        message: 'Pinterest partnership setup initiated. Please complete the partnership in Pinterest Business Manager.',
      },
      error: null,
    });
  } catch (error) {
    fastify.log.error({
      error,
      context: 'Failed to create Pinterest manual connection',
      businessId,
    });

    return sendError(reply, 'CONNECTION_CREATION_FAILED', 'Failed to create connection. Please try again.', 500);
  }
});

  // Shopify manual connection endpoint (collaborator request flow)
  fastify.post('/client/:token/shopify/manual-connect', async (request, reply) => {
    const { token } = request.params as { token: string };

    const manualConnectSchema = z.object({
      shopDomain: z
        .string()
        .transform(normalizeShopDomain)
        .refine(isValidShopifyDomain, 'Shopify domain must look like "store-name.myshopify.com"'),
      collaboratorCode: z.string().trim().regex(/^\d{4}$/, 'Collaborator code must be exactly 4 digits'),
      clientEmail: z.string().email().optional(),
      platform: z.literal('shopify'),
    });

    const validated = manualConnectSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid request data', 400, validated.error.errors,);
    }

    const { shopDomain, collaboratorCode, clientEmail } = validated.data;
    const collaboratorCodeHash = hashCollaboratorCode(collaboratorCode);

    const accessRequest = await accessRequestService.getAccessRequestByToken(token);
    if (accessRequest.error || !accessRequest.data) {
      return sendError(reply, 'INVALID_TOKEN', 'Access request not found or expired', 404);
    }

    if (accessRequest.data.status === 'completed') {
      return sendError(reply, 'REQUEST_COMPLETED', 'Access request has already been completed', 409);
    }

    if (!isPlatformRequested(accessRequest.data.platforms, 'shopify')) {
      return sendError(reply, 'PLATFORM_NOT_REQUESTED', 'Platform was not requested in this access request', 400);
    }

    try {
      const grantedAssetsPayload = {
        platform: 'shopify',
        shopDomain,
        collaboratorCode,
        collaboratorCodeHash,
        clientEmail: clientEmail || accessRequest.data.clientEmail,
        setupComplete: true,
        setupCompletedAt: new Date().toISOString(),
        authMethod: 'manual_collaborator_request',
        verificationStatus: 'pending',
      };

      const { connection, existed } = await saveManualConnection({
        accessRequestId: accessRequest.data.id,
        agencyId: accessRequest.data.agencyId,
        clientEmail: clientEmail || accessRequest.data.clientEmail || 'unknown',
        grantedAssets: grantedAssetsPayload,
      });

      await auditService.createAuditLog({
        agencyId: accessRequest.data.agencyId,
        action: existed ? 'MANUAL_INVITATION_UPDATED' : 'MANUAL_INVITATION_INITIATED',
        resourceType: 'ClientConnection',
        resourceId: connection.id,
        platform: 'shopify',
        metadata: {
          connectionId: connection.id,
          clientEmail: clientEmail || accessRequest.data.clientEmail,
          shopDomain,
          collaboratorCodeHash,
          accessRequestId: accessRequest.data.id,
        },
      });

      return reply.send({
        data: {
          connectionId: connection.id,
          status: connection.status,
          shopDomain,
          collaboratorCodeMasked: '****',
          message: 'Shopify collaborator details saved. Your agency can now request access in Shopify Partners.',
        },
        error: null,
      });
    } catch (error) {
      fastify.log.error({
        error,
        context: 'Failed to create Shopify manual connection',
        shopDomain,
      });

      return sendError(reply, 'CONNECTION_CREATION_FAILED', 'Failed to create connection. Please try again.', 500);
    }
  });
}
