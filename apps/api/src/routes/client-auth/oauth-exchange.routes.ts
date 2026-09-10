import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { auditService } from '../../services/audit.service.js';
import { oauthStateService } from '../../services/oauth-state.service.js';
import { getConnector, type PlatformConnector } from '../../services/connectors/factory.js';
import { infisical } from '../../lib/infisical.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../lib/env.js';
import { platformGroupOf, type Platform } from '@agency-platform/shared';
import { oauthExchangeSchema } from './schemas.js';
import { sanitizeOAuthError } from '../../lib/errors.js';
import { sendError } from '../../lib/response.js';

interface OAuthExchangeOptions {
  /**
   * Static endpoint (/client/oauth-exchange) has no token in the URL, so the
   * access request token MUST come from the OAuth state. The tokened endpoint
   * can fall back to the access request's uniqueToken.
   */
  requireStateToken: boolean;
}

/**
 * Snapchat identity lookup is best-effort. It must not fail the exchange: by
 * that point the Snap authorization code has already been consumed, so a
 * thrown identity error would 500 the flow and store no authorization.
 * Mirrors the agency callback (routes/agency-platforms/oauth.routes.ts),
 * which degrades the same failure into discoveryFailed metadata. Every other
 * platform keeps strict identity handling and rethrows.
 */
async function getUserInfoForExchange(
  platform: string,
  connector: PlatformConnector,
  accessToken: string
): Promise<any> {
  try {
    return await connector.getUserInfo(accessToken);
  } catch (error) {
    if (platform !== 'snapchat') {
      throw error;
    }
    console.error('Failed to fetch Snapchat organizations:', error);
    return {
      organizations: [],
      adAccountCount: 0,
      discoveryFailed: true,
    };
  }
}

/**
 * True when the access request actually requested this platform.
 *
 * Access requests are stored as flat rows ([{ platform, accessLevel }]) but
 * older rows and the service payload use the hierarchical shape
 * ([{ platformGroup, products }]). Both are accepted so the gate cannot
 * reject a platform the agency did request.
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

function buildOAuthExchangeHandler(fastify: FastifyInstance, options: OAuthExchangeOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const validated = oauthExchangeSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid OAuth exchange data', 400, validated.error.errors,);
    }

    const { code, state, platform: platformFromRequest } = validated.data;

    const stateResult = await oauthStateService.validateState(state);
    if (stateResult.error || !stateResult.data) {
      return sendError(reply, 'INVALID_STATE', 'Invalid or expired OAuth state token', 400);
    }

    const stateData = stateResult.data;
    const platform = stateData.platform;

    if (platformFromRequest && platformFromRequest !== platform) {
      return sendError(reply, 'PLATFORM_MISMATCH', 'Platform does not match OAuth state', 400);
    }

    if (options.requireStateToken && !stateData.accessRequestToken) {
      return sendError(reply, 'MISSING_TOKEN', 'Access request token not found in OAuth state', 400);
    }

    try {
      const connector = getConnector(platform as Platform);
      const redirectUri = stateData.redirectUrl || `${env.FRONTEND_URL}/invite/oauth-callback`;

      // Token exchange and the Prisma lookups are independent — run them in parallel.
      const [exchanged, accessRequest, existingConnection] = await Promise.all([
        (async () => {
          let tokens = await connector.exchangeCode(code, redirectUri);

          if ((platform === 'meta' || platform === 'meta_ads') && connector.getLongLivedToken) {
            tokens = await connector.getLongLivedToken(tokens.accessToken);
          }

          const userInfo = await getUserInfoForExchange(platform, connector, tokens.accessToken);
          return { tokens, userInfo };
        })(),
        prisma.accessRequest.findUnique({
          where: { id: stateData.accessRequestId! },
        }),
        prisma.clientConnection.findFirst({
          where: { accessRequestId: stateData.accessRequestId! },
        }),
      ]);

      if (!accessRequest) {
        return sendError(reply, 'ACCESS_REQUEST_NOT_FOUND', 'Access request not found', 404);
      }

      if (!isPlatformRequested(accessRequest.platforms, platform)) {
        return sendError(
          reply,
          'PLATFORM_NOT_REQUESTED',
          'Platform was not requested in this access request',
          400
        );
      }

      let clientConnection = existingConnection;

      if (!clientConnection) {
        clientConnection = await prisma.clientConnection.create({
          data: {
            accessRequestId: stateData.accessRequestId!,
            agencyId: accessRequest.agencyId,
            clientEmail: stateData.clientEmail!,
            status: 'active',
          },
        });
      }

      const secretName = infisical.generateSecretName(
        platform as Platform,
        clientConnection.id
      );

      await infisical.storeOAuthTokens(secretName, {
        accessToken: exchanged.tokens.accessToken,
        refreshToken: exchanged.tokens.refreshToken,
        expiresAt: exchanged.tokens.expiresAt,
      });

      const platformAuth = await prisma.platformAuthorization.upsert({
        where: {
          connectionId_platform: {
            connectionId: clientConnection.id,
            platform: platform as Platform,
          },
        },
        update: {
          secretId: secretName,
          expiresAt: exchanged.tokens.expiresAt,
          status: 'active',
          metadata: exchanged.userInfo,
        },
        create: {
          connectionId: clientConnection.id,
          platform: platform as Platform,
          secretId: secretName,
          expiresAt: exchanged.tokens.expiresAt,
          status: 'active',
          metadata: exchanged.userInfo,
        },
      });

      await auditService.createAuditLog({
        agencyId: accessRequest.agencyId,
        action: 'CLIENT_AUTHORIZED',
        userEmail: stateData.clientEmail!,
        resourceType: 'client_connection',
        resourceId: clientConnection.id,
        metadata: {
          platform,
          accessRequestId: stateData.accessRequestId!,
          platformAuthId: platformAuth.id,
        },
      });

      if (platform === 'tiktok' || platform === 'tiktok_ads') {
        await auditService.createAuditLog({
          agencyId: accessRequest.agencyId,
          action: 'TIKTOK_TOKEN_EXCHANGED',
          userEmail: stateData.clientEmail!,
          resourceType: 'client_connection',
          resourceId: clientConnection.id,
          metadata: {
            platform,
            platformAuthId: platformAuth.id,
          },
          request,
        });
      }

      // requireStateToken guarantees accessRequestToken is set for the static
      // endpoint, so the fallback only ever applies to the tokened endpoint.
      return reply.send({
        data: {
          connectionId: clientConnection.id,
          platform,
          token: stateData.accessRequestToken || accessRequest.uniqueToken,
        },
        error: null,
      });
    } catch (error) {
      const sanitized = sanitizeOAuthError(error);
      fastify.log.error({ error, sanitized }, 'OAuth exchange failed');
      return reply.code(500).send({
        data: null,
        error: sanitized,
      });
    }
  };
}

export async function registerOAuthExchangeRoutes(fastify: FastifyInstance) {
  // Exchange OAuth code for temporary session (token in path)
  fastify.post(
    '/client/:token/oauth-exchange',
    buildOAuthExchangeHandler(fastify, { requireStateToken: false })
  );

  // Static OAuth exchange endpoint (token extracted from state)
  fastify.post(
    '/client/oauth-exchange',
    buildOAuthExchangeHandler(fastify, { requireStateToken: true })
  );
}
