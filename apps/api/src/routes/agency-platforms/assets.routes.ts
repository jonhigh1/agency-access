import { FastifyInstance } from 'fastify';
import { prisma } from '@/lib/prisma';
import { agencyPlatformService } from '@/services/agency-platform.service';
import { metaAssetsService } from '@/services/meta-assets.service';
import { metaAutoAssignService } from '@/services/meta-auto-assign.service.js';
import { googleAssetsService } from '@/services/google-assets.service';
import { MetaConnector } from '@/services/connectors/meta';
import { GoogleConnector } from '@/services/connectors/google';
import type { GoogleAccountsResponse } from '@/services/connectors/google';
import { assertAgencyAccess } from '@/lib/authorization.js';
import { sendError, sendValidationError } from '../../lib/response.js';

interface MetaBusinessAccountsResponse {
  businesses: Array<{
    id: string;
    name: string;
    verticalName?: string;
    verificationStatus?: string;
  }>;
  hasAccess: boolean;
}

export async function registerAssetRoutes(fastify: FastifyInstance) {
  const ensureAgencyAccess = (request: any, reply: any, agencyId: string): boolean => {
    const principalAgencyId = request.principalAgencyId as string;
    const accessError = assertAgencyAccess(agencyId, principalAgencyId);
    if (accessError) {
      reply.code(403).send({ data: null, error: accessError });
      return false;
    }
    return true;
  };

  const resolveTokenError = (
    tokenError?: { code?: string; message?: string; details?: unknown } | null
  ): { statusCode: number; error: { code: string; message: string; details?: unknown } } => {
    const fallbackError = {
      code: 'TOKEN_ERROR',
      message: 'Failed to get valid access token',
    };

    if (!tokenError?.code || !tokenError?.message) {
      return { statusCode: 500, error: fallbackError };
    }

    if (tokenError.code === 'INVALID_TOKEN' || tokenError.code === 'TOKEN_NOT_FOUND') {
      return {
        statusCode: 401,
        error: tokenError as { code: string; message: string; details?: unknown },
      };
    }

    if (tokenError.code === 'CONNECTION_NOT_FOUND') {
      return {
        statusCode: 404,
        error: tokenError as { code: string; message: string; details?: unknown },
      };
    }

    if (tokenError.code === 'CONNECTION_NOT_ACTIVE') {
      return {
        statusCode: 409,
        error: tokenError as { code: string; message: string; details?: unknown },
      };
    }

    return {
      statusCode: 500,
      error: tokenError as { code: string; message: string; details?: unknown },
    };
  };

  /**
   * GET /agency-platforms/google/accounts
   * Fetch all Google accounts for an agency's Google connection
   */
  fastify.get('/agency-platforms/google/accounts', async (request, reply) => {
    const { agencyId, refresh } = request.query as {
      agencyId?: string;
      refresh?: string;
    };

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const connectionResult = await agencyPlatformService.getConnection(agencyId, 'google');

    if (connectionResult.error || !connectionResult.data) {
      return sendError(reply, 'GOOGLE_NOT_CONNECTED', 'Google is not connected. Please connect your Google account first.', 404);
    }

    const connection = connectionResult.data;

    if (refresh === 'true') {
      try {
        const tokenResult = await agencyPlatformService.getValidToken(agencyId, 'google');

        if (tokenResult.error || !tokenResult.data) {
          const { statusCode, error } = resolveTokenError(tokenResult.error);
          return reply.code(statusCode).send({
            data: null,
            error,
          });
        }

        const googleConnector = new GoogleConnector();
        const googleAccounts = await googleConnector.getAllGoogleAccounts(tokenResult.data);

        await agencyPlatformService.updateConnectionMetadata(agencyId, 'google', {
          googleAccounts: {
            adsAccounts: googleAccounts.adsAccounts,
            analyticsProperties: googleAccounts.analyticsProperties,
            businessAccounts: googleAccounts.businessAccounts,
            tagManagerContainers: googleAccounts.tagManagerContainers,
            searchConsoleSites: googleAccounts.searchConsoleSites,
            merchantCenterAccounts: googleAccounts.merchantCenterAccounts,
            hasAccess: googleAccounts.hasAccess,
          },
        });

        return reply.send({
          data: googleAccounts,
          error: null,
        });
      } catch (error) {
        // Log the full error for debugging
        fastify.log.error({
          msg: 'Failed to fetch Google accounts',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          agencyId,
        });

        return sendError(reply, 'FETCH_FAILED', 'Failed to fetch Google accounts', 500, error instanceof Error ? error.message : 'Unknown error',);
      }
    }

    const meta = connection.metadata as Record<string, any> | undefined;
    const googleAccounts = meta?.googleAccounts as GoogleAccountsResponse | undefined;

    if (!googleAccounts) {
      return sendError(reply, 'NO_ACCOUNTS_FOUND', 'No Google accounts found. Try refreshing with ?refresh=true', 404);
    }

    return reply.send({
      data: googleAccounts,
      error: null,
    });
  });

  /**
   * GET /agency-platforms/meta/business-accounts
   * Fetch all Meta Business Manager accounts for an agency's Meta connection
   */
  fastify.get('/agency-platforms/meta/business-accounts', async (request, reply) => {
    const { agencyId, refresh } = request.query as {
      agencyId?: string;
      refresh?: string;
    };

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const connectionResult = await agencyPlatformService.getConnection(agencyId, 'meta');

    if (connectionResult.error || !connectionResult.data) {
      return sendError(reply, 'META_NOT_CONNECTED', 'Meta is not connected. Please connect your Meta account first.', 404);
    }

    const connection = connectionResult.data;

    if (refresh === 'true') {
      try {
        const tokenResult = await agencyPlatformService.getValidToken(agencyId, 'meta');

        if (tokenResult.error || !tokenResult.data) {
          const { statusCode, error } = resolveTokenError(tokenResult.error);
          return reply.code(statusCode).send({
            data: null,
            error,
          });
        }

        const metaConnector = new MetaConnector();
        const businessAccounts = await metaConnector.getBusinessAccounts(tokenResult.data);

        await agencyPlatformService.updateConnectionMetadata(agencyId, 'meta', {
          metaBusinessAccounts: {
            businesses: businessAccounts.businesses,
            hasAccess: businessAccounts.hasAccess,
          },
        });

        return reply.send({
          data: businessAccounts,
          error: null,
        });
      } catch (error) {
        return sendError(reply, 'FETCH_FAILED', 'Failed to fetch Meta business accounts', 500, error instanceof Error ? error.message : 'Unknown error',);
      }
    }

    const meta = connection.metadata as Record<string, any> | undefined;
    const businessAccounts = meta?.metaBusinessAccounts as MetaBusinessAccountsResponse | undefined;

    if (!businessAccounts) {
      return sendError(reply, 'NO_ACCOUNTS_FOUND', 'No Meta business accounts found. Try refreshing with ?refresh=true', 404);
    }

    return reply.send({
      data: businessAccounts,
      error: null,
    });
  });

  /**
   * POST /agency-platforms/meta/complete-oauth
   * Complete Meta OAuth by selecting a Business Portfolio and creating a system user
   */
  fastify.post('/agency-platforms/meta/complete-oauth', async (request, reply) => {
    const { agencyId, businessId, businessName, connectionId } = request.body as {
      agencyId?: string;
      businessId?: string;
      businessName?: string;
      connectionId?: string;
    };

    if (!agencyId || !businessId || !businessName || !connectionId) {
      return sendValidationError(reply, 'agencyId, businessId, businessName, and connectionId are required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    try {
      const result = await metaAssetsService.saveBusinessPortfolio(agencyId, businessId, businessName);

      if (result.error) {
        return reply.code(result.error.code === 'NOT_FOUND' ? 404 : 500).send(result);
      }

      const connection = await prisma.agencyPlatformConnection.findFirst({
        where: {
          id: connectionId,
          agencyId,
          platform: 'meta',
        },
      });

      if (!connection) {
        return sendError(reply, 'CONNECTION_NOT_FOUND', 'Meta connection not found for this agency', 404);
      }

      const safeConnection = {
        id: connection.id,
        agencyId: connection.agencyId,
        platform: connection.platform,
        connectionMode: connection.connectionMode,
        status: connection.status,
        expiresAt: connection.expiresAt,
        lastRefreshedAt: connection.lastRefreshedAt,
        scope: connection.scope,
        agencyEmail: connection.agencyEmail,
        businessId: connection.businessId,
        verificationStatus: connection.verificationStatus,
        lastVerifiedAt: connection.lastVerifiedAt,
        metadata: connection.metadata,
        connectedBy: connection.connectedBy,
        connectedAt: connection.connectedAt,
        revokedAt: connection.revokedAt,
        revokedBy: connection.revokedBy,
      };

      return reply.send({
        data: safeConnection,
        error: null,
      });
    } catch (error) {
      fastify.log.error({
        msg: 'Failed to complete Meta OAuth',
        error: error instanceof Error ? error.message : String(error),
        agencyId,
        businessId,
      });
      return sendError(reply, 'INTERNAL_ERROR', 'Failed to complete Meta OAuth flow', 500);
    }
  });

  /**
   * PATCH /agency-platforms/meta/business
   * Save selected Business Portfolio for a Meta connection
   */
  fastify.patch('/agency-platforms/meta/business', async (request, reply) => {
    const { agencyId, businessId, businessName } = request.body as {
      agencyId?: string;
      businessId?: string;
      businessName?: string;
    };

    if (!agencyId || !businessId || !businessName) {
      return sendValidationError(reply, 'agencyId, businessId, and businessName are required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await metaAssetsService.saveBusinessPortfolio(agencyId, businessId, businessName);

    if (result.error) {
      return reply.code(result.error.code === 'NOT_FOUND' ? 404 : 500).send(result);
    }

    return reply.send(result);
  });

  /**
   * GET /agency-platforms/meta/auto-assign-preferences
   * Agency defaults for post-Partner Auto-Assign (ticket 08).
   */
  fastify.get('/agency-platforms/meta/auto-assign-preferences', async (request, reply) => {
    const { agencyId } = request.query as { agencyId?: string };

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await metaAutoAssignService.getPreferences(agencyId);
    if (result.error) {
      return reply.code(result.error.code === 'NOT_FOUND' ? 404 : 500).send(result);
    }

    return reply.send({ data: result.data, error: null });
  });

  /**
   * PATCH /agency-platforms/meta/auto-assign-preferences
   */
  fastify.patch('/agency-platforms/meta/auto-assign-preferences', async (request, reply) => {
    const { agencyId, preferences } = request.body as {
      agencyId?: string;
      preferences?: unknown;
    };

    if (!agencyId || preferences === undefined) {
      return sendValidationError(reply, 'agencyId and preferences are required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await metaAutoAssignService.savePreferences(agencyId, preferences as any, request);
    if (result.error) {
      const statusCode =
        result.error.code === 'VALIDATION_ERROR' || result.error.code === 'INVALID_AUTO_ASSIGN_RECIPIENT'
          ? 400
          : result.error.code === 'NOT_FOUND'
            ? 404
            : 502;
      return reply.code(statusCode).send({ data: null, error: result.error });
    }

    return reply.send({ data: result.data, error: null });
  });

  /**
   * GET /agency-platforms/meta/assignees
   * List people and system users from the selected agency Business Portfolio.
   */
  fastify.get('/agency-platforms/meta/assignees', async (request, reply) => {
    const { agencyId } = request.query as { agencyId?: string };

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await metaAssetsService.getAssignableRecipients(agencyId, request);
    if (result.error) {
      return reply.code(result.error.code === 'META_DESTINATION_NOT_READY' ? 400 : 502).send(result);
    }

    return reply.send(result);
  });

  /**
   * PATCH /agency-platforms/meta/asset-settings
   * Save asset settings for a Meta connection
   */
  fastify.patch('/agency-platforms/meta/asset-settings', async (request, reply) => {
    const { agencyId, settings } = request.body as {
      agencyId?: string;
      settings?: any;
    };

    if (!agencyId || !settings) {
      return sendValidationError(reply, 'agencyId and settings are required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await metaAssetsService.saveAssetSettings(agencyId, settings);

    if (result.error) {
      return reply.code(result.error.code === 'NOT_FOUND' ? 404 : 500).send(result);
    }

    return reply.send(result);
  });

  /**
   * GET /agency-platforms/meta/asset-settings
   * Get current asset settings for a Meta connection
   */
  fastify.get('/agency-platforms/meta/asset-settings', async (request, reply) => {
    const { agencyId } = request.query as { agencyId?: string };

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await metaAssetsService.getAssetSettings(agencyId);

    if (result.error) {
      return reply.code(result.error.code === 'NOT_FOUND' ? 404 : 500).send(result);
    }

    return reply.send(result);
  });

  /**
   * GET /agency-platforms/meta/assets/:businessId
   * Fetch all assets for a specific Meta business
   */
  fastify.get('/agency-platforms/meta/assets/:businessId', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const { agencyId } = request.query as { agencyId?: string };

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await metaAssetsService.getAssetsForBusiness(agencyId, businessId, request);

    if (result.error) {
      return reply.code(500).send(result);
    }

    return reply.send(result);
  });

  /**
   * GET /agency-platforms/meta/assets/summary
   * Returns summary of all businesses and their asset counts
   */
  fastify.get('/agency-platforms/meta/assets/summary', async (request, reply) => {
    const { agencyId } = request.query as { agencyId?: string };

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const connectionResult = await agencyPlatformService.getConnection(agencyId, 'meta');
    if (connectionResult.error || !connectionResult.data) {
      return sendError(reply, 'META_NOT_CONNECTED', 'Meta is not connected', 404);
    }

    const meta = connectionResult.data.metadata as any;
    const businesses = meta?.metaBusinessAccounts?.businesses || [];

    const summaries = await Promise.all(
      businesses.map(async (business: any) => {
        const result = await metaAssetsService.getAssetsForBusiness(agencyId, business.id, request);
        if (result.data) {
          return {
            businessId: business.id,
            businessName: business.name,
            adAccountsCount: result.data.adAccounts.length,
            pagesCount: result.data.pages.length,
            instagramAccountsCount: result.data.instagramAccounts.length,
            productCatalogsCount: result.data.productCatalogs.length,
          };
        }
        return {
          businessId: business.id,
          businessName: business.name,
          error: result.error,
        };
      })
    );

    return reply.send({ data: summaries, error: null });
  });

  /**
   * PATCH /agency-platforms/meta/selections
   * Save granular asset selections for a Meta connection
   */
  fastify.patch('/agency-platforms/meta/selections', async (request, reply) => {
    const { agencyId, selections } = request.body as {
      agencyId?: string;
      selections?: any[];
    };

    if (!agencyId || !selections) {
      return sendValidationError(reply, 'agencyId and selections are required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await metaAssetsService.saveAssetSelections(agencyId, selections);

    if (result.error) {
      return reply.code(500).send(result);
    }

    return reply.send(result);
  });

  /**
   * GET /agency-platforms/google/asset-settings
   * Get current asset settings for a Google connection
   */
  fastify.get('/agency-platforms/google/asset-settings', async (request, reply) => {
    const { agencyId } = request.query as { agencyId?: string };

    if (!agencyId) {
      return sendValidationError(reply, 'agencyId is required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await googleAssetsService.getAssetSettings(agencyId);

    if (result.error) {
      return reply.code(result.error.code === 'NOT_FOUND' ? 404 : 500).send(result);
    }

    return reply.send(result);
  });

  /**
   * PATCH /agency-platforms/google/asset-settings
   * Save asset settings for a Google connection
   */
  fastify.patch('/agency-platforms/google/asset-settings', async (request, reply) => {
    const { agencyId, settings } = request.body as {
      agencyId?: string;
      settings?: any;
    };

    if (!agencyId || !settings) {
      return sendValidationError(reply, 'agencyId and settings are required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await googleAssetsService.saveAssetSettings(agencyId, settings);

    if (result.error) {
      return reply
        .code(
          result.error.code === 'NOT_FOUND'
            ? 404
            : result.error.code === 'VALIDATION_ERROR'
              ? 400
              : 500
        )
        .send(result);
    }

    return reply.send(result);
  });

  /**
   * PATCH /agency-platforms/google/account
   * Save selected account for a Google product
   */
  fastify.patch('/agency-platforms/google/account', async (request, reply) => {
    const { agencyId, product, accountId, accountName } = request.body as {
      agencyId?: string;
      product?: string;
      accountId?: string;
      accountName?: string;
    };

    if (!agencyId || !product || !accountId || !accountName) {
      return sendValidationError(reply, 'agencyId, product, accountId, and accountName are required');
    }
    if (!ensureAgencyAccess(request, reply, agencyId)) return;

    const result = await googleAssetsService.saveAccountSelection(
      agencyId,
      product,
      accountId,
      accountName
    );

    if (result.error) {
      return reply.code(result.error.code === 'NOT_FOUND' ? 404 : 500).send(result);
    }

    return reply.send(result);
  });
}
