import { FastifyInstance } from 'fastify';
import { accessRequestService } from '../../services/access-request.service.js';
import { oauthStateService } from '../../services/oauth-state.service.js';
import { getConnector } from '../../services/connectors/factory.js';
import { env } from '../../lib/env.js';
import { resolveGoogleOAuthScopes, platformGroupOf, type Platform } from '@agency-platform/shared';
import { createOAuthStateSchema } from './schemas.js';
import { resolveClientInviteCallbackUrl } from './redirect-uri.js';
import { sendError } from '../../lib/response.js';

/**
 * True when the access request actually requested this platform.
 *
 * The service returns platforms in the hierarchical shape
 * ([{ platformGroup, products }]); raw flat rows ([{ platform, accessLevel }])
 * are also accepted so the gate cannot reject a platform the agency did
 * request. The exchange endpoint applies the same rule.
 */
function isPlatformRequested(accessRequestPlatforms: unknown, platform: string): boolean {
  if (!Array.isArray(accessRequestPlatforms)) {
    return false;
  }

  return accessRequestPlatforms.some((entry: any) => {
    const group = entry?.platformGroup;
    if (group === platform) {
      return true;
    }

    const rawPlatform = entry?.platform;
    if (rawPlatform === platform || (typeof rawPlatform === 'string' && platformGroupOf(rawPlatform) === platform)) {
      return true;
    }

    return Array.isArray(entry?.products)
      ? entry.products.some((product: any) =>
          (typeof product === 'string' ? product : product?.product) === platform
        )
      : false;
  });
}

export async function registerOAuthStateRoutes(fastify: FastifyInstance) {
  function getRequestedGroupProductIds(
    accessRequestPlatforms: unknown,
    platformGroup: string
  ): string[] {
    if (!Array.isArray(accessRequestPlatforms)) {
      return [];
    }

    return accessRequestPlatforms
      .filter((entry: any) => entry?.platformGroup === platformGroup)
      .flatMap((entry: any) => entry?.products || [])
      .map((product: any) => (typeof product === 'string' ? product : product?.product))
      .filter((productId: unknown): productId is string => typeof productId === 'string');
  }

  // Create OAuth state token for CSRF protection
  fastify.post('/client/:token/oauth-state', async (request, reply) => {
    const { token } = request.params as { token: string };

    const accessRequest = await accessRequestService.getAccessRequestByToken(token);

    if (accessRequest.error || !accessRequest.data) {
      return reply.code(404).send({
        data: null,
        error: accessRequest.error || {
          code: 'NOT_FOUND',
          message: 'Access request not found',
        },
      });
    }

    const validated = createOAuthStateSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid platform', 400, validated.error.errors,);
    }

    const { platform } = validated.data;

    const stateResult = await oauthStateService.createState({
      agencyId: accessRequest.data.agencyId,
      platform,
      userEmail: accessRequest.data.clientEmail,
      accessRequestId: accessRequest.data.id,
      clientEmail: accessRequest.data.clientEmail,
      timestamp: Date.now(),
    });

    if (stateResult.error || !stateResult.data) {
      fastify.log.error(
        {
          accessRequestId: accessRequest.data.id,
          platform,
          error: stateResult.error,
        },
        'Failed to create OAuth state token for client auth state endpoint'
      );
      return reply.code(500).send({
        data: null,
        error: stateResult.error || {
          code: 'STATE_CREATION_FAILED',
          message: 'Failed to create OAuth state token',
        },
      });
    }

    return reply.send({
      data: { state: stateResult.data },
      error: null,
    });
  });

  // Generate OAuth URL for a specific platform
  fastify.post('/client/:token/oauth-url', async (request, reply) => {
    const { token } = request.params as { token: string };

    const accessRequest = await accessRequestService.getAccessRequestByToken(token);

    if (accessRequest.error || !accessRequest.data) {
      return reply.code(404).send({
        data: null,
        error: accessRequest.error || {
          code: 'NOT_FOUND',
          message: 'Access request not found',
        },
      });
    }

    const validated = createOAuthStateSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid platform', 400, validated.error.errors,);
    }

    const { platform } = validated.data;

    if (!isPlatformRequested(accessRequest.data.platforms, platform)) {
      return sendError(
        reply,
        'PLATFORM_NOT_REQUESTED',
        'Platform was not requested in this access request',
        400
      );
    }

    const redirectUri = resolveClientInviteCallbackUrl(request.headers);

    // Create OAuth state token (include token for redirect after OAuth)
    const stateResult = await oauthStateService.createState({
      agencyId: accessRequest.data.agencyId,
      platform,
      userEmail: accessRequest.data.clientEmail,
      accessRequestId: accessRequest.data.id,
      accessRequestToken: token,
      clientEmail: accessRequest.data.clientEmail,
      redirectUrl: redirectUri,
      timestamp: Date.now(),
    });

    if (stateResult.error || !stateResult.data) {
      fastify.log.error(
        {
          accessRequestId: accessRequest.data.id,
          platform,
          error: stateResult.error,
        },
        'Failed to create OAuth state token for client auth URL endpoint'
      );
      return reply.code(500).send({
        data: null,
        error: stateResult.error || {
          code: 'STATE_CREATION_FAILED',
          message: 'Failed to create OAuth state token',
        },
      });
    }

    const state = stateResult.data;

    // Get connector and generate URL
    try {
      const connector = getConnector(platform as Platform);

      // For Google platform group, determine scopes based on requested products
      let scopes: string[] | undefined;
      if (platform === 'google') {
        const productIds = getRequestedGroupProductIds(accessRequest.data.platforms, 'google');
        scopes = resolveGoogleOAuthScopes(productIds);
      }

      if (platform === 'linkedin') {
        const productIds = getRequestedGroupProductIds(accessRequest.data.platforms, 'linkedin');

        scopes = ['openid', 'profile', 'email'];
        if (productIds.includes('linkedin_ads')) {
          scopes.push('rw_ads', 'r_ads_reporting');
        }
        if (productIds.includes('linkedin_pages')) {
          scopes.push('rw_organization_admin');
        }
      }

      if (platform === 'meta' || platform === 'meta_ads') {
        scopes = [
          'ads_management',
          'ads_read',
          'business_management',
          'pages_read_engagement',
        ];
      }

      const authUrl = connector.getAuthUrl(state, scopes, redirectUri);

      return reply.send({
        data: { authUrl, state },
        error: null,
      });
    } catch (error) {
      return sendError(reply, 'CONNECTOR_ERROR', error instanceof Error ? error.message : 'Failed to generate OAuth URL', 400);
    }
  });
}
