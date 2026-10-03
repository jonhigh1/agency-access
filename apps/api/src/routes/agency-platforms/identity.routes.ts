import { FastifyInstance } from 'fastify';
import { identityVerificationService } from '@/services/identity-verification.service';
import { SUPPORTED_PLATFORMS } from './constants.js';
import { assertAgencyAccess, resolveAuthenticatedUserEmail } from '@/lib/authorization.js';
import { sendError, sendValidationError } from '../../lib/response.js';

export async function registerIdentityRoutes(fastify: FastifyInstance) {
  /**
   * POST /agency-platforms/identity
   * Create identity-only connection (no OAuth tokens).
   */
  fastify.post('/agency-platforms/identity', async (request, reply) => {
    const { agencyId, platform, agencyEmail, businessId } = request.body as {
      agencyId?: string;
      platform?: string;
      agencyEmail?: string;
      businessId?: string;
    };

    if (!agencyId || !platform) {
      return sendValidationError(reply, 'agencyId and platform are required');
    }

    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(agencyId, principalAgencyId);
    if (accessError) {
      return reply.code(403).send({ data: null, error: accessError });
    }

    const connectedBy = await resolveAuthenticatedUserEmail((request as any).user);
    if (!connectedBy) {
      return sendError(reply, 'USER_EMAIL_REQUIRED', 'Authenticated user email is required to add a platform identity', 401);
    }

    if (!SUPPORTED_PLATFORMS.includes(platform as any)) {
      return sendError(reply, 'UNSUPPORTED_PLATFORM', `Platform "${platform}" is not supported`, 400);
    }

    if (platform === 'meta_ads' && !businessId) {
      return sendValidationError(reply, 'businessId is required for Meta platform');
    }

    if (
      (platform === 'google' ||
        platform === 'google_ads' ||
        platform === 'ga4' ||
        platform === 'linkedin') &&
      !agencyEmail
    ) {
      return sendValidationError(reply, 'agencyEmail is required for Google and LinkedIn platforms');
    }

    const result = await identityVerificationService.createIdentityConnection({
      agencyId,
      platform: platform as 'google' | 'meta' | 'meta_ads' | 'google_ads' | 'ga4' | 'linkedin',
      agencyEmail,
      businessId,
      connectedBy,
    });

    if (result.error) {
      const statusCode = result.error.code === 'DUPLICATE_IDENTITY' ? 409 : 400;
      return reply.code(statusCode).send(result);
    }

    return reply.code(201).send(result);
  });

}
