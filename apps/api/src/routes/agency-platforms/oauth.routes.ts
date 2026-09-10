import { FastifyInstance } from 'fastify';
import { agencyPlatformService } from '@/services/agency-platform.service';
import { oauthStateService } from '@/services/oauth-state.service';
import { MetaConnector } from '@/services/connectors/meta';
import { GoogleConnector } from '@/services/connectors/google';
import type { GoogleAccountsResponse } from '@/services/connectors/google';
import type { SnapchatUserInfo } from '@/services/connectors/snapchat';
import type { PlatformConnector } from '@/services/connectors/factory';
import { ConnectorError } from '@/services/connectors/base.connector.js';
import { env } from '@/lib/env';
import { PLATFORM_CONNECTORS, SUPPORTED_PLATFORMS, MANUAL_PLATFORMS } from './constants.js';
import { assertAgencyAccess } from '@/lib/authorization.js';
import { infisical } from '@/lib/infisical.js';
import { prisma } from '@/lib/prisma.js';
import { createAuditLog } from '@/services/audit.service.js';
import { sendError, sendValidationError } from '../../lib/response.js';

// Meta business accounts response type
interface MetaBusinessAccountsResponse {
  businesses: Array<{
    id: string;
    name: string;
    verticalName?: string;
    verificationStatus?: string;
  }>;
  hasAccess: boolean;
}

// Snapchat organization discovery payload persisted as connection metadata.
type SnapchatOrganizationsMetadata = Pick<
  SnapchatUserInfo,
  'organizations' | 'adAccountCount' | 'role' | 'discoveryFailed' | 'orgStatus'
>;

function sanitizeConnection(connection: Record<string, any>) {
  const { secretId, ...safeConnection } = connection;
  return safeConnection;
}

export async function registerOAuthRoutes(fastify: FastifyInstance) {
  /**
   * POST /agency-platforms/:platform/initiate
   * Start OAuth flow - generates auth URL and state token
   */
  fastify.post('/agency-platforms/:platform/initiate', async (request, reply) => {
    const { platform } = request.params as { platform: string };
    const { agencyId, userEmail, redirectUrl, ...extraParams } = request.body as {
      agencyId?: string;
      userEmail?: string;
      redirectUrl?: string;
      shop?: string; // For Shopify OAuth
      [key: string]: any; // Allow other platform-specific params
    };

    if (!SUPPORTED_PLATFORMS.includes(platform as any)) {
      return sendError(reply, 'UNSUPPORTED_PLATFORM', `Platform "${platform}" is not supported`, 400);
    }

    if (!agencyId || !userEmail) {
      return sendValidationError(reply, 'agencyId and userEmail are required');
    }

    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(agencyId, principalAgencyId);
    if (accessError) {
      return reply.code(403).send({ data: null, error: accessError });
    }

    if (platform === 'meta' && extraParams.useLegacyFallback !== true) {
      return sendError(reply, 'LEGACY_META_OAUTH_DISABLED', 'Meta now uses Business Login via the JS SDK. Reconnect from the app UI or pass useLegacyFallback=true only for rollback.', 410);
    }

    const stateResult = await oauthStateService.createState({
      agencyId,
      platform,
      userEmail,
      redirectUrl,
      timestamp: Date.now(),
      ...extraParams, // Include extra params (e.g., shop for Shopify)
    });

    if (stateResult.error) {
      fastify.log.error(
        {
          error: stateResult.error,
          agencyId,
          platform,
          userEmail,
        },
        'Failed to create OAuth state token during agency platform initiation'
      );
      return reply.code(500).send(stateResult);
    }

    if (MANUAL_PLATFORMS.includes(platform as any)) {
      return sendError(reply, 'MANUAL_INVITATION_PLATFORM', `${platform} uses manual invitation flow, not OAuth`, 400);
    }

    const ConnectorClass = PLATFORM_CONNECTORS[platform as keyof typeof PLATFORM_CONNECTORS];
    if (!ConnectorClass) {
      return sendError(reply, 'CONNECTOR_NOT_IMPLEMENTED', `OAuth connector for "${platform}" is not implemented yet`, 400);
    }

    const connector = new ConnectorClass() as PlatformConnector;

    try {
      // Handle platform-specific parameters (e.g., shop for Shopify)
      let authUrl: string;
      if (platform === 'shopify' && extraParams.shop) {
        authUrl = (connector as any).getAuthUrl(
          stateResult.data!,
          undefined, // scopes
          undefined, // redirectUri
          extraParams.shop // shop parameter for Shopify
        );
      } else {
        authUrl = connector.getAuthUrl(stateResult.data!);
      }

      return reply.send({
        data: {
          authUrl,
          state: stateResult.data,
        },
        error: null,
      });
    } catch (err) {
      if (err instanceof ConnectorError) {
        if (err.code === 'MISSING_CLIENT_ID' || err.code === 'MISSING_CLIENT_SECRET') {
          return sendError(reply, err.code, `${platform} integration is not configured. Add the required environment variables (e.g. ${platform.toUpperCase()}_CLIENT_ID, ${platform.toUpperCase()}_CLIENT_SECRET) to your .env file.`, 503);
        }
      }
      throw err;
    }
  });

  fastify.post('/agency-platforms/meta/business-login/finalize', async (request, reply) => {
    const {
      agencyId,
      userEmail,
      accessToken,
      userId,
      expiresIn,
      dataAccessExpirationTime,
      signedRequest,
    } = request.body as {
      agencyId?: string;
      userEmail?: string;
      accessToken?: string;
      userId?: string;
      expiresIn?: number;
      dataAccessExpirationTime?: number;
      signedRequest?: string;
    };

    if (!agencyId || !accessToken || !userEmail) {
      return sendValidationError(reply, 'agencyId, accessToken, and userEmail are required');
    }

    const principalAgencyId = (request as any).principalAgencyId as string;
    const accessError = assertAgencyAccess(agencyId, principalAgencyId);
    if (accessError) {
      return reply.code(403).send({ data: null, error: accessError });
    }

    const connector = new MetaConnector();

    const isValidToken = await connector.verifyToken(accessToken);
    if (!isValidToken) {
      return sendError(reply, 'INVALID_TOKEN', 'Meta Business Login token is invalid. Please try logging in again.', 401);
    }

    const [userInfo, tokenMetadata, longLivedTokens] = await Promise.all([
      connector.getUserInfo(accessToken),
      connector.getTokenMetadata(accessToken),
      connector.getLongLivedToken(accessToken),
    ]);
    const businessAccounts = await connector.getBusinessAccounts(longLivedTokens.accessToken);

    const connectionMetadata = {
      tokenType: longLivedTokens.tokenType,
      metaBusinessLogin: {
        authSource: 'js_sdk',
        userId: userId || tokenMetadata.userId || userInfo.id,
        userName: userInfo.name,
        expiresIn,
        dataAccessExpirationTime,
        dataAccessExpiresAt: tokenMetadata.dataAccessExpiresAt?.toISOString(),
        grantedScopes: tokenMetadata.scopes,
        signedRequest,
      },
      metaBusinessAccounts: {
        businesses: businessAccounts.businesses,
        hasAccess: businessAccounts.hasAccess,
      },
    };

    const existingConnectionResult = await agencyPlatformService.getConnection(agencyId, 'meta');
    let persistedConnection: Record<string, any> | null = null;

    if (existingConnectionResult.data) {
      const existingConnection = existingConnectionResult.data as Record<string, any>;
      const secretId =
        typeof existingConnection.secretId === 'string' && existingConnection.secretId.length > 0
          ? existingConnection.secretId
          : `meta_agency_${agencyId}`;

      await infisical.storeOAuthTokens(secretId, {
        accessToken: longLivedTokens.accessToken,
        expiresAt: longLivedTokens.expiresAt,
        scope: tokenMetadata.scopes.join(','),
      });

      persistedConnection = await prisma.agencyPlatformConnection.update({
        where: { id: existingConnection.id as string },
        data: {
          secretId,
          status: 'active',
          expiresAt: longLivedTokens.expiresAt,
          scope: tokenMetadata.scopes.join(','),
          metadata: {
            ...((existingConnection.metadata as Record<string, any> | undefined) || {}),
            ...connectionMetadata,
          },
          connectedBy: userEmail,
          connectedAt: new Date(),
          revokedAt: null,
          revokedBy: null,
          lastRefreshedAt: null,
        },
      }) as Record<string, any>;
    } else {
      const connectionResult = await agencyPlatformService.createConnection({
        agencyId,
        platform: 'meta',
        accessToken: longLivedTokens.accessToken,
        refreshToken: undefined,
        expiresAt: longLivedTokens.expiresAt,
        scope: tokenMetadata.scopes.join(','),
        connectedBy: userEmail,
        metadata: connectionMetadata,
      });

      if (connectionResult.error || !connectionResult.data) {
        return reply.code(500).send({
          data: null,
          error: connectionResult.error || {
            code: 'INTERNAL_ERROR',
            message: 'Failed to finalize Meta Business Login',
          },
        });
      }

      persistedConnection = connectionResult.data as Record<string, any>;
    }

    await createAuditLog({
      agencyId,
      userEmail,
      action: 'META_BUSINESS_LOGIN_FINALIZED',
      agencyConnectionId: persistedConnection.id as string,
      metadata: {
        userId: connectionMetadata.metaBusinessLogin.userId,
        grantedScopes: tokenMetadata.scopes,
        businessCount: businessAccounts.businesses.length,
      },
      request,
    });

    return reply.send({
      data: sanitizeConnection(persistedConnection),
      error: null,
    });
  });

  /**
   * GET /agency-platforms/:platform/callback
   * OAuth callback handler
   * Validates state, exchanges code for tokens, creates connection
   */
  fastify.get('/agency-platforms/:platform/callback', async (request, reply) => {
    const { platform } = request.params as { platform: string };
    const { code, auth_code: authCode, state } = request.query as {
      code?: string;
      auth_code?: string;
      state?: string;
    };

    try {
      const stateResult = await oauthStateService.validateState(state || '');

      if (stateResult.error || !stateResult.data) {
        const errorCode = stateResult.error?.code || 'INVALID_STATE';
        const redirectUrl = stateResult.data?.redirectUrl || env.FRONTEND_URL;
        return reply.redirect(`${redirectUrl}?error=${errorCode}`);
      }

      const stateData = stateResult.data;

      const { agencyResolutionService } = await import('../../services/agency-resolution.service.js');
      const agencyResult = await agencyResolutionService.getOrCreateAgency(stateData.agencyId, {
        userEmail: stateData.userEmail,
        agencyName: 'My Agency',
      });

      if (agencyResult.error) {
        const redirectUrl = stateData.redirectUrl || env.FRONTEND_URL;
        fastify.log.error({
          error: agencyResult.error,
          agencyId: stateData.agencyId,
          userEmail: stateData.userEmail,
        });
        return reply.redirect(`${redirectUrl}?error=AGENCY_RESOLUTION_FAILED`);
      }

      const actualAgencyId = agencyResult.data!.agencyId;

      if (MANUAL_PLATFORMS.includes(platform as any)) {
        const redirectUrl = stateData.redirectUrl || env.FRONTEND_URL;
        return reply.redirect(`${redirectUrl}?error=MANUAL_INVITATION_PLATFORM`);
      }

      const ConnectorClass = PLATFORM_CONNECTORS[platform as keyof typeof PLATFORM_CONNECTORS];
      if (!ConnectorClass) {
        const redirectUrl = stateData.redirectUrl || env.FRONTEND_URL;
        return reply.redirect(`${redirectUrl}?error=CONNECTOR_NOT_IMPLEMENTED`);
      }

      const connector = new ConnectorClass() as PlatformConnector;

      let tokens;
      try {
        // Handle platform-specific parameters (e.g., shop for Shopify)
        const shop = (stateData as unknown as Record<string, unknown>).shop as string | undefined;
        const authCodeToUse = code || authCode || '';
        if (platform === 'shopify' && shop) {
          tokens = await (connector as any).exchangeCode(authCodeToUse, undefined, shop);
        } else {
          tokens = await connector.exchangeCode(authCodeToUse);
        }

        if (platform === 'meta' && 'getLongLivedToken' in connector) {
          tokens = await (connector as any).getLongLivedToken(tokens.accessToken);
        }
      } catch (error) {
        const redirectUrl = stateData.redirectUrl || env.FRONTEND_URL;
        return reply.redirect(`${redirectUrl}?error=TOKEN_EXCHANGE_FAILED`);
      }

      let googleAccounts: GoogleAccountsResponse | undefined;
      if (platform === 'google' && connector instanceof GoogleConnector) {
        try {
          googleAccounts = await connector.getAllGoogleAccounts(tokens.accessToken);
        } catch (error) {
          console.error('Failed to fetch Google accounts:', error);
        }
      }

      let metaBusinessAccounts: MetaBusinessAccountsResponse | undefined;
      if (platform === 'meta' && connector instanceof MetaConnector) {
        try {
          metaBusinessAccounts = await connector.getBusinessAccounts(tokens.accessToken);
        } catch (error) {
          console.error('Failed to fetch Meta business accounts:', error);
        }
      }

      // One getUserInfo call yields identity plus best-effort organizations.
      // Discovery never blocks the connection: both an organizations failure
      // and an identity failure are recorded as discoveryFailed metadata and
      // the connection is still created.
      let snapchatOrganizations: SnapchatOrganizationsMetadata | undefined;
      if (platform === 'snapchat') {
        try {
          const snapUserInfo: SnapchatUserInfo = await connector.getUserInfo(tokens.accessToken);
          snapchatOrganizations = {
            organizations: snapUserInfo.organizations,
            adAccountCount: snapUserInfo.adAccountCount,
            ...(snapUserInfo.role ? { role: snapUserInfo.role } : {}),
            discoveryFailed: snapUserInfo.discoveryFailed,
            ...(snapUserInfo.orgStatus ? { orgStatus: snapUserInfo.orgStatus } : {}),
          };
        } catch (error) {
          console.error('Failed to fetch Snapchat organizations:', error);
          snapchatOrganizations = {
            organizations: [],
            adAccountCount: 0,
            discoveryFailed: true,
          };
        }
      }

      const connectionResult = await agencyPlatformService.createConnection({
        agencyId: actualAgencyId,
        platform: stateData.platform,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        connectedBy: stateData.userEmail,
        metadata: {
          tokenType: tokens.tokenType,
          ...(googleAccounts && {
            googleAccounts: {
              adsAccounts: googleAccounts.adsAccounts,
              analyticsProperties: googleAccounts.analyticsProperties,
              businessAccounts: googleAccounts.businessAccounts,
              tagManagerContainers: googleAccounts.tagManagerContainers,
              searchConsoleSites: googleAccounts.searchConsoleSites,
              merchantCenterAccounts: googleAccounts.merchantCenterAccounts,
              hasAccess: googleAccounts.hasAccess,
            },
          }),
          ...(metaBusinessAccounts && {
            metaBusinessAccounts: {
              businesses: metaBusinessAccounts.businesses,
              hasAccess: metaBusinessAccounts.hasAccess,
            },
          }),
          ...(snapchatOrganizations && { snapchatOrganizations }),
        },
      });

      if (connectionResult.error) {
        const redirectUrl = stateData.redirectUrl || env.FRONTEND_URL;
        return reply.redirect(`${redirectUrl}?error=${connectionResult.error.code}`);
      }

      if (platform === 'meta' && connectionResult.data) {
        const connection = connectionResult.data;
        const baseUrl = env.FRONTEND_URL;
        return reply.redirect(
          `${baseUrl}/platforms/callback?success=true&platform=meta&requireBusinessSelection=true&connectionId=${connection.id}&agencyId=${actualAgencyId}`
        );
      }

      const redirectUrl = stateData.redirectUrl || env.FRONTEND_URL;
      // Include identifiers so the frontend can invalidate caches and track events reliably.
      // The platform param mirrors the connected platform recorded in state,
      // so it stays consistent with the created connection.
      const redirectTarget = new URL(redirectUrl, env.FRONTEND_URL);
      redirectTarget.searchParams.set('success', 'true');
      redirectTarget.searchParams.set('platform', stateData.platform);
      if (connectionResult.data) {
        redirectTarget.searchParams.set('connectionId', connectionResult.data.id);
      }
      redirectTarget.searchParams.set('agencyId', actualAgencyId);
      return reply.redirect(redirectTarget.toString());
    } catch (error) {
      const redirectUrl = env.FRONTEND_URL;
      return reply.redirect(`${redirectUrl}?error=CALLBACK_FAILED`);
    }
  });
}
