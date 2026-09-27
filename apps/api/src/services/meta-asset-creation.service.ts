/**
 * Meta Asset Creation Service
 *
 * Handles creation of Meta assets (ad accounts, product catalogs) for client connections.
 * Follows the security pattern of retrieving tokens from Infisical (never stored in DB).
 * All creation events are logged for audit purposes.
 */

import { logger } from '../lib/logger.js';
import { createHash } from 'node:crypto';
import { infisical } from '../lib/infisical.js';
import { readMetaAuthorizationMetadata } from '../lib/meta-authorization-metadata.js';
import { prisma } from '../lib/prisma.js';
import { auditService } from './audit.service.js';
import { MetaGraphMutationError, metaConnector } from './connectors/meta.js';

const CREATION_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

export interface CreateAdAccountParams {
  accessRequestId: string;
  name: string;
  currency: string;
  timezoneId: string;
}

export interface CreateProductCatalogParams {
  accessRequestId: string;
  name: string;
}

export interface CreateBusinessParams {
  accessRequestId: string;
  name: string;
  vertical: string;
  primaryPageId: string;
  timezoneId: string;
}

export interface CreatedAdAccount {
  id: string;
  name: string;
  currency: string;
  timezoneId: string;
  accountId: string;
}

export interface CreatedProductCatalog {
  id: string;
  name: string;
  catalogType: string;
}

export interface CreatedBusiness {
  id: string;
  name: string;
  timezoneId: string;
}

export interface AssetCreationLinks {
  pageCreationUrl: string;
  pixelCreationUrl: string;
  businessVerificationUrl: string;
  paymentMethodUrl: string;
}

type MetaPlatformAuthorization = NonNullable<
  Awaited<ReturnType<typeof prisma.platformAuthorization.findUnique>>
>;

function isDefiniteMetaRejection(error: unknown): error is MetaGraphMutationError {
  return error instanceof MetaGraphMutationError &&
    error.status >= 400 && error.status < 500 &&
    typeof error.metaCode === 'number';
}

class MetaAssetCreationService {
  private async claimCreation<T>(input: {
    accessRequestId: string;
    connectionId: string;
    authorizationId: string;
    assetType: 'ad_account' | 'catalog' | 'business';
    parentAssetId: string;
    intent: unknown;
  }): Promise<{ id: string; replay?: T } | { error: { code: string; message: string } }> {
    const intentHash = createHash('sha256')
      .update(JSON.stringify({
        assetType: input.assetType,
        parentAssetId: input.parentAssetId,
        intent: input.intent,
      }))
      .digest('hex');
    const idempotencyKey = intentHash;
    const where = {
      accessRequestId_idempotencyKey: {
        accessRequestId: input.accessRequestId,
        idempotencyKey,
      },
    };

    let existing = await prisma.metaAssetCreation.findUnique({ where });
    if (!existing) {
      try {
        const claimed = await prisma.metaAssetCreation.create({
          data: {
            accessRequestId: input.accessRequestId,
            connectionId: input.connectionId,
            authorizationId: input.authorizationId,
            assetType: input.assetType,
            parentAssetId: input.parentAssetId,
            idempotencyKey,
            intentHash,
            status: 'in_progress',
          },
        });
        return { id: claimed.id };
      } catch (error) {
        if ((error as { code?: string })?.code !== 'P2002') throw error;
        existing = await prisma.metaAssetCreation.findUnique({ where });
      }
    }

    if (!existing) throw new Error('Meta asset creation claim was not stored');
    if (
      existing.connectionId !== input.connectionId ||
      existing.authorizationId !== input.authorizationId ||
      existing.assetType !== input.assetType ||
      existing.parentAssetId !== input.parentAssetId ||
      existing.intentHash !== intentHash
    ) {
      return { error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'This creation key is already bound to a different Meta asset request.' } };
    }
    if (existing.status === 'created' && existing.result) {
      return { id: existing.id, replay: existing.result as T };
    }
    if (existing.status === 'outcome_unknown') {
      return { error: { code: 'CREATION_OUTCOME_UNKNOWN', message: 'Meta may have created this asset. Refresh asset discovery and select it before starting another creation.' } };
    }
    if (existing.status === 'failed') {
      const retried = await prisma.metaAssetCreation.updateMany({
        where: { id: existing.id, status: 'failed' },
        data: { status: 'in_progress', lastErrorCode: null },
      });
      if (retried.count === 1) return { id: existing.id };
      existing = await prisma.metaAssetCreation.findUnique({ where });
      if (existing?.status === 'in_progress') {
        return { error: { code: 'CREATION_IN_PROGRESS', message: 'This Meta creation is already running or needs reconciliation. Do not submit it again.' } };
      }
    }
    if (existing?.status === 'in_progress' && existing.updatedAt.getTime() <= Date.now() - CREATION_CLAIM_TIMEOUT_MS) {
      const markedUnknown = await prisma.metaAssetCreation.updateMany({
        where: { id: existing.id, status: 'in_progress', updatedAt: { lte: existing.updatedAt } },
        data: { status: 'outcome_unknown', lastErrorCode: 'CREATION_WORKER_ABANDONED' },
      });
      if (markedUnknown.count === 1) {
        return { error: { code: 'CREATION_OUTCOME_UNKNOWN', message: 'This Meta creation may have completed before its worker stopped. Refresh asset discovery and select it before starting another creation.' } };
      }
      existing = await prisma.metaAssetCreation.findUnique({ where });
    }
    if (existing?.status === 'in_progress') {
      return { error: { code: 'CREATION_IN_PROGRESS', message: 'This Meta creation is already running or needs reconciliation. Do not submit it again.' } };
    }
    return { error: { code: 'CREATION_RESULT_UNAVAILABLE', message: 'Stored Meta creation result is unavailable. Refresh asset discovery before creating again.' } };
  }

  private async finishCreation(id: string, result: unknown) {
    await prisma.metaAssetCreation.update({
      where: { id },
      data: { status: 'created', result: result as any, lastErrorCode: null },
    });
  }

  private async markCreationUnknown(id: string) {
    await prisma.metaAssetCreation.updateMany({
      where: { id, status: 'in_progress' },
      data: { status: 'outcome_unknown', lastErrorCode: 'PROVIDER_OUTCOME_UNKNOWN' },
    });
  }

  private async markCreationRejected(id: string, errorCode: string) {
    await prisma.metaAssetCreation.updateMany({
      where: { id, status: 'in_progress' },
      data: { status: 'failed', lastErrorCode: errorCode },
    });
  }

  /**
   * Resolve the active client Meta OAuth access token for a connection.
   * Shared guard for every creation path: authorization exists, is active,
   * and its Infisical token is present and unexpired.
   */
  private async getActiveClientAccessToken(
    connectionId: string
  ): Promise<{ platformAuth: MetaPlatformAuthorization; accessToken: string } | { error: { code: string; message: string } }> {
    const platformAuth = await prisma.platformAuthorization.findUnique({
      where: {
        connectionId_platform: {
          connectionId,
          platform: 'meta',
        },
      },
    });

    if (!platformAuth) {
      return {
        error: {
          code: 'AUTHORIZATION_NOT_FOUND',
          message: 'Meta authorization not found for this connection',
        },
      };
    }

    if (platformAuth.status !== 'active') {
      return {
        error: {
          code: 'AUTHORIZATION_INACTIVE',
          message: 'Meta authorization is not active',
        },
      };
    }

    let tokens;
    try {
      tokens = await infisical.getOAuthTokens(platformAuth.secretId);
    } catch (tokenError) {
      logger.error('Failed to retrieve Meta tokens from Infisical', {
        connectionId,
        secretId: platformAuth.secretId,
        error: tokenError,
      });
      return {
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'OAuth tokens not found in secure storage',
        },
      };
    }

    if (!tokens || !tokens.accessToken) {
      return {
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'OAuth tokens not found in secure storage',
        },
      };
    }

    if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
      return {
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Your authorization has expired. Please reconnect your Meta account.',
        },
      };
    }

    return { platformAuth, accessToken: tokens.accessToken };
  }

  /**
   * Create a new Meta ad account for a client connection
   *
   * @param connectionId - Client connection ID
   * @param businessId - Meta Business Manager ID
   * @param params - Ad account creation parameters
   * @param userEmail - User email for audit logging
   * @param agencyId - Agency ID for audit logging
   * @returns Created ad account details
   */
  async createAdAccount(
    connectionId: string,
    businessId: string,
    params: CreateAdAccountParams,
    userEmail: string,
    agencyId: string
  ): Promise<{ data: CreatedAdAccount | null; error: { code: string; message: string; details?: any } | null }> {
    let creationId: string | undefined;
    try {
      logger.info('Creating Meta ad account', {
        connectionId,
        businessId,
        accountName: params.name,
        currency: params.currency,
      });

      const token = await this.getActiveClientAccessToken(connectionId);
      if ('error' in token) {
        return { data: null, error: token.error };
      }
      const { platformAuth, accessToken } = token;

      const claim = await this.claimCreation<CreatedAdAccount>({
        accessRequestId: params.accessRequestId,
        connectionId,
        authorizationId: platformAuth.id,
        assetType: 'ad_account',
        parentAssetId: businessId,
        intent: { name: params.name, currency: params.currency, timezoneId: params.timezoneId },
      });
      if ('error' in claim) return { data: null, error: claim.error };
      creationId = claim.id;
      if (claim.replay) return { data: claim.replay, error: null };

      // Step 5: Create ad account via Meta API
      const createdAccount = await metaConnector.createAdAccount(
        accessToken,
        businessId,
        { name: params.name, currency: params.currency, timezoneId: params.timezoneId }
      );

      logger.info('Meta ad account created successfully', {
        connectionId,
        accountId: createdAccount.id,
        accountName: createdAccount.name,
      });

      // Step 6: Update connection metadata with created asset
      const connection = await prisma.clientConnection.findUnique({
        where: { id: connectionId },
      });

      if (connection) {
        const currentGrantedAssets = (connection.grantedAssets as any) || {};
        const createdAdAccounts = currentGrantedAssets.meta?.createdAdAccounts || [];

        await prisma.clientConnection.update({
          where: { id: connectionId },
          data: {
            grantedAssets: {
              ...currentGrantedAssets,
              meta: {
                ...(currentGrantedAssets.meta || {}),
                createdAdAccounts: [
                  ...createdAdAccounts,
                  {
                    id: createdAccount.id,
                    accountId: createdAccount.accountId,
                    name: createdAccount.name,
                    currency: createdAccount.currency,
                    timezoneId: createdAccount.timezoneId,
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            },
          },
        });
      }

      // Step 7: Create audit log
      await auditService.createAuditLog({
        agencyId,
        userEmail,
        action: 'META_AD_ACCOUNT_CREATED',
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: {
          platform: 'meta',
          businessId,
          accountId: createdAccount.id,
          accountName: createdAccount.name,
          currency: createdAccount.currency,
          timezoneId: createdAccount.timezoneId,
        },
      });

      await this.finishCreation(creationId, createdAccount);

      return { data: createdAccount, error: null };
    } catch (error) {
      logger.error('Failed to create Meta ad account', {
        connectionId,
        businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Check for specific Meta API errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (creationId && isDefiniteMetaRejection(error)) {
        await this.markCreationRejected(creationId, 'META_REJECTED_CREATION');
      } else if (creationId) {
        await this.markCreationUnknown(creationId);
        return {
          data: null,
          error: {
            code: 'CREATION_OUTCOME_UNKNOWN',
            message: 'Meta did not confirm whether it created this ad account. Refresh asset discovery and select it before starting another creation.',
          },
        };
      }

      if (errorMessage.includes('permission') || errorMessage.includes('scope')) {
        return {
          data: null,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Your Meta account does not have permission to create ad accounts. Please ensure you have ads_management scope.',
          },
        };
      }

      if (errorMessage.includes('limit') || errorMessage.includes('maximum')) {
        return {
          data: null,
          error: {
            code: 'LIMIT_EXCEEDED',
            message: 'You have reached the maximum number of ad accounts for this Business Manager.',
          },
        };
      }

      return {
        data: null,
        error: {
          code: 'CREATION_FAILED',
          message: `Failed to create ad account: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Create a new Meta product catalog for a client connection
   *
   * @param connectionId - Client connection ID
   * @param businessId - Meta Business Manager ID
   * @param params - Product catalog creation parameters
   * @param userEmail - User email for audit logging
   * @param agencyId - Agency ID for audit logging
   * @returns Created product catalog details
   */
  async createProductCatalog(
    connectionId: string,
    businessId: string,
    params: CreateProductCatalogParams,
    userEmail: string,
    agencyId: string
  ): Promise<{ data: CreatedProductCatalog | null; error: { code: string; message: string; details?: any } | null }> {
    let creationId: string | undefined;
    try {
      logger.info('Creating Meta product catalog', {
        connectionId,
        businessId,
        catalogName: params.name,
      });

      const token = await this.getActiveClientAccessToken(connectionId);
      if ('error' in token) {
        return { data: null, error: token.error };
      }
      const { platformAuth, accessToken } = token;

      const claim = await this.claimCreation<CreatedProductCatalog>({
        accessRequestId: params.accessRequestId,
        connectionId,
        authorizationId: platformAuth.id,
        assetType: 'catalog',
        parentAssetId: businessId,
        intent: { name: params.name },
      });
      if ('error' in claim) return { data: null, error: claim.error };
      creationId = claim.id;
      if (claim.replay) return { data: claim.replay, error: null };

      // Step 5: Create product catalog via Meta API
      const createdCatalog = await metaConnector.createProductCatalog(
        accessToken,
        businessId,
        params.name
      );

      logger.info('Meta product catalog created successfully', {
        connectionId,
        catalogId: createdCatalog.id,
        catalogName: createdCatalog.name,
      });

      // Step 6: Update connection metadata with created asset
      const connection = await prisma.clientConnection.findUnique({
        where: { id: connectionId },
      });

      if (connection) {
        const currentGrantedAssets = (connection.grantedAssets as any) || {};
        const createdProductCatalogs = currentGrantedAssets.meta?.createdProductCatalogs || [];

        await prisma.clientConnection.update({
          where: { id: connectionId },
          data: {
            grantedAssets: {
              ...currentGrantedAssets,
              meta: {
                ...(currentGrantedAssets.meta || {}),
                createdProductCatalogs: [
                  ...createdProductCatalogs,
                  {
                    id: createdCatalog.id,
                    name: createdCatalog.name,
                    catalogType: createdCatalog.catalogType,
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            },
          },
        });
      }

      // Step 7: Create audit log
      await auditService.createAuditLog({
        agencyId,
        userEmail,
        action: 'META_PRODUCT_CATALOG_CREATED',
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: {
          platform: 'meta',
          businessId,
          catalogId: createdCatalog.id,
          catalogName: createdCatalog.name,
          catalogType: createdCatalog.catalogType,
        },
      });

      await this.finishCreation(creationId, createdCatalog);

      return { data: createdCatalog, error: null };
    } catch (error) {
      logger.error('Failed to create Meta product catalog', {
        connectionId,
        businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Check for specific Meta API errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (creationId && isDefiniteMetaRejection(error)) {
        await this.markCreationRejected(creationId, 'META_REJECTED_CREATION');
      } else if (creationId) {
        await this.markCreationUnknown(creationId);
        return {
          data: null,
          error: {
            code: 'CREATION_OUTCOME_UNKNOWN',
            message: 'Meta did not confirm whether it created this catalog. Refresh asset discovery and select it before starting another creation.',
          },
        };
      }

      if (errorMessage.includes('permission') || errorMessage.includes('scope')) {
        return {
          data: null,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Your Meta account does not have permission to create product catalogs. Please ensure you have catalog_management scope.',
          },
        };
      }

      if (errorMessage.includes('limit') || errorMessage.includes('maximum')) {
        return {
          data: null,
          error: {
            code: 'LIMIT_EXCEEDED',
            message: 'You have reached the maximum number of product catalogs for this Business Manager.',
          },
        };
      }

      return {
        data: null,
        error: {
          code: 'CREATION_FAILED',
          message: `Failed to create product catalog: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * List the client user's own Facebook Pages (guided Page prerequisite check)
   *
   * An empty list is a valid result: it means the user owns no Page and must
   * create one before a Business Portfolio can be created.
   *
   * @param connectionId - Client connection ID
   * @returns Pages the user administers, or an error
   */
  async getUserPages(
    connectionId: string
  ): Promise<{
    data: Array<{ id: string; name: string; category?: string }> | null;
    error: { code: string; message: string } | null;
  }> {
    try {
      const token = await this.getActiveClientAccessToken(connectionId);
      if ('error' in token) {
        return { data: null, error: token.error };
      }
      const { platformAuth, accessToken } = token;

      const pages = await metaConnector.getUserPages(accessToken);

      return { data: pages, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch client user pages', { connectionId, error: errorMessage });

      return {
        data: null,
        error: {
          code: 'USER_PAGES_FETCH_FAILED',
          message: `Failed to fetch your Facebook Pages: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Create a Business Portfolio owned by the client user
   *
   * After a successful Graph call this PERSISTS the business selection into
   * PlatformAuthorization.metadata.meta (source: 'created') so the existing
   * grant-meta-access flow works on the new business immediately — save-assets
   * never carries the business selection.
   *
   * @param connectionId - Client connection ID
   * @param params - Business creation parameters
   * @param userEmail - User email for audit logging
   * @param agencyId - Agency ID for audit logging
   * @returns Created business details
   */
  async createBusiness(
    connectionId: string,
    params: CreateBusinessParams,
    userEmail: string,
    agencyId: string
  ): Promise<{ data: CreatedBusiness | null; error: { code: string; message: string; details?: any } | null }> {
    let creationId: string | undefined;
    try {
      logger.info('Creating Meta business', {
        connectionId,
        businessName: params.name,
        vertical: params.vertical,
        primaryPageId: params.primaryPageId,
      });

      const token = await this.getActiveClientAccessToken(connectionId);
      if ('error' in token) {
        return { data: null, error: token.error };
      }
      const { platformAuth, accessToken } = token;

      const claim = await this.claimCreation<CreatedBusiness>({
        accessRequestId: params.accessRequestId,
        connectionId,
        authorizationId: platformAuth.id,
        assetType: 'business',
        parentAssetId: params.primaryPageId,
        intent: {
          name: params.name,
          vertical: params.vertical,
          primaryPageId: params.primaryPageId,
          timezoneId: params.timezoneId,
        },
      });
      if ('error' in claim) return { data: null, error: claim.error };
      creationId = claim.id;
      if (claim.replay) return { data: claim.replay, error: null };

      const createdBusiness = await metaConnector.createBusiness(accessToken, {
        name: params.name,
        vertical: params.vertical,
        primaryPageId: params.primaryPageId,
        timezoneId: params.timezoneId,
      });

      logger.info('Meta business created successfully', {
        connectionId,
        businessId: createdBusiness.id,
        businessName: createdBusiness.name,
      });

      // Persist selection + discovery into PlatformAuthorization.metadata.meta so
      // grant-meta-access can run against the new business without a re-selection.
      const { rootMetadata, metaMetadata: currentMeta } = readMetaAuthorizationMetadata(
        platformAuth.metadata
      );

      const existingBusinesses = currentMeta.discovery?.availableBusinesses ?? [];
      const alreadyListed = existingBusinesses.some((b) => b.id === createdBusiness.id);
      const availableBusinesses = alreadyListed
        ? existingBusinesses
        : [
            ...existingBusinesses,
            { id: createdBusiness.id, name: createdBusiness.name, verificationStatus: 'unverified' },
          ];

      await prisma.platformAuthorization.update({
        where: { id: platformAuth.id },
        data: {
          metadata: {
            ...rootMetadata,
            meta: {
              ...currentMeta,
              discovery: {
                availableBusinesses,
                discoveredAt: new Date().toISOString(),
              },
              selection: {
                clientBusinessId: createdBusiness.id,
                clientBusinessName: createdBusiness.name,
                selectedAt: new Date().toISOString(),
                source: 'created',
              },
            },
          },
        },
      });

      // Append to ClientConnection.grantedAssets (mirrors createdAdAccounts)
      const connection = await prisma.clientConnection.findUnique({
        where: { id: connectionId },
      });

      if (connection) {
        const currentGrantedAssets = (connection.grantedAssets as any) || {};
        const createdBusinesses = currentGrantedAssets.meta?.createdBusinesses || [];

        await prisma.clientConnection.update({
          where: { id: connectionId },
          data: {
            grantedAssets: {
              ...currentGrantedAssets,
              meta: {
                ...(currentGrantedAssets.meta || {}),
                createdBusinesses: [
                  ...createdBusinesses,
                  {
                    id: createdBusiness.id,
                    name: createdBusiness.name,
                    timezoneId: createdBusiness.timezoneId,
                    vertical: params.vertical,
                    primaryPageId: params.primaryPageId,
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            },
          },
        });
      }

      await auditService.createAuditLog({
        agencyId,
        userEmail,
        action: 'META_BUSINESS_CREATED',
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: {
          platform: 'meta',
          businessId: createdBusiness.id,
          businessName: createdBusiness.name,
          vertical: params.vertical,
          primaryPageId: params.primaryPageId,
          timezoneId: createdBusiness.timezoneId,
        },
      });

      await this.finishCreation(creationId, createdBusiness);

      return { data: createdBusiness, error: null };
    } catch (error) {
      logger.error('Failed to create Meta business', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (creationId && isDefiniteMetaRejection(error)) {
        await this.markCreationRejected(creationId, 'META_REJECTED_CREATION');
      } else if (creationId) {
        await this.markCreationUnknown(creationId);
        return {
          data: null,
          error: {
            code: 'CREATION_OUTCOME_UNKNOWN',
            message: 'Meta did not confirm whether it created this Business Portfolio. Refresh asset discovery and select it before starting another creation.',
          },
        };
      }
      const normalizedError = errorMessage.toLowerCase();

      if (normalizedError.includes('permission') || normalizedError.includes('scope')) {
        return {
          data: null,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message:
              'Your Meta account does not have permission to create a Business Portfolio. Reconnect your Meta account if you just granted the permission.',
          },
        };
      }

      if (normalizedError.includes('limit') || normalizedError.includes('maximum')) {
        return {
          data: null,
          error: {
            code: 'LIMIT_EXCEEDED',
            message:
              'Meta limits how many Business Portfolios one person can create. Use an existing portfolio or contact Meta support.',
          },
        };
      }

      if (normalizedError.includes('primary_page')) {
        return {
          data: null,
          error: {
            code: 'INVALID_PRIMARY_PAGE',
            message:
              "The selected Page cannot be used as the Business Portfolio's primary Page. Make sure you are an admin of the Page.",
          },
        };
      }

      return {
        data: null,
        error: {
          code: 'CREATION_FAILED',
          message: `Failed to create Business Portfolio: ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Get asset creation links for manual asset creation (pages, pixels)
   *
   * @param businessId - Meta Business Manager ID
   * @returns URLs for page and pixel creation
   */
  getAssetCreationLinks(businessId: string): AssetCreationLinks {
    return {
      pageCreationUrl: metaConnector.getPageCreationUrl(businessId),
      pixelCreationUrl: metaConnector.getPixelCreationUrl(businessId),
      businessVerificationUrl: metaConnector.getBusinessVerificationUrl(businessId),
      paymentMethodUrl: metaConnector.getPaymentMethodUrl(businessId),
    };
  }

  /**
   * Get supported currencies for ad account creation
   *
   * @returns Array of supported currency codes
   */
  getSupportedCurrencies(): string[] {
    return metaConnector.getSupportedCurrencies();
  }

  /**
   * Get supported timezones for ad account creation
   *
   * @returns Array of supported timezone IDs with names
   */
  getSupportedTimezones(): Array<{ id: string; name: string; offset: string }> {
    return metaConnector.getSupportedTimezones();
  }
}

// Export singleton instance
export const metaAssetCreationService = new MetaAssetCreationService();
