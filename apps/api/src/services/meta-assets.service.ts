import type { FastifyRequest } from 'fastify';
import { agencyPlatformService } from './agency-platform.service.js';
import { MetaConnector } from './connectors/meta.js';
import {
  META_PERMISSION_CONTRACT,
  type MetaAssetSelection,
  type MetaAllAssets,
  type MetaAssetSettings,
  type MetaAssignableRecipient,
} from '@agency-platform/shared';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/services/audit.service';
import { metaSystemUserService } from './meta-system-user.service.js';
import { META_GRAPH_VERSION } from '@/lib/meta-constants';
import { metaGraphGet } from '@/lib/meta-graph-request.js';
import { resolveUserEmail } from '@/lib/authorization.js';

function buildPartnerAdminSystemUserSecretName(agencyId: string, businessId: string): string {
  return `meta_partner_admin_system_user_${agencyId}_${businessId}`;
}

async function auditMetaAssetRead(
  agencyId: string,
  businessId: string,
  request: FastifyRequest | undefined,
  operation: string,
  actorType: 'authenticated_user' | 'access_request_holder',
  actorId?: string,
  actorEmail?: string
) {
  if (!request) {
    return { code: 'AUDIT_CONTEXT_REQUIRED', message: 'Request context is required to access Meta tokens' };
  }

  const connectionResult = await agencyPlatformService.getConnection(agencyId, 'meta');
  if (connectionResult.error || !connectionResult.data) {
    return connectionResult.error || { code: 'CONNECTION_NOT_FOUND', message: 'Meta connection not found' };
  }

  const user = (request as any).user;
  const audit = await createAuditLog({
    agencyId,
    userEmail: actorEmail || resolveUserEmail(user),
    action: 'ACCESSED',
    resourceType: 'connection',
    resourceId: connectionResult.data.id,
    agencyConnectionId: connectionResult.data.id,
    platform: 'meta',
    request,
    metadata: { operation, businessId, actorType, actorId: actorId || user?.sub },
  });
  return audit.error;
}

/**
 * Meta Assets Service
 *
 * Handles discovery and selection of Meta assets (ad accounts, pages, etc.)
 */
export const metaAssetsService = {
  async getAssignableRecipients(
    agencyId: string,
    request?: FastifyRequest,
    actorEmail?: string,
    actorType?: 'authenticated_user' | 'access_request_holder',
    actorId?: string
  ): Promise<{
    data: MetaAssignableRecipient[] | null;
    error: { code: string; message: string } | null;
  }> {
    if (!request) {
      return { data: null, error: { code: 'AUDIT_CONTEXT_REQUIRED', message: 'Request context is required to access Meta tokens' } };
    }

    const connectionResult = await agencyPlatformService.getConnection(agencyId, 'meta');
    const connection = connectionResult.data;
    const metadata = (connection?.metadata as Record<string, unknown> | null) || {};
    const businessId = connection?.businessId ||
      (typeof metadata.selectedBusinessId === 'string' ? metadata.selectedBusinessId : null);

    if (!connection || !businessId) {
      return {
        data: null,
        error: { code: 'META_DESTINATION_NOT_READY', message: 'Select and authenticate an agency Meta Business Portfolio first' },
      };
    }

    const userEmail = actorEmail || resolveUserEmail((request as any).user);
    const principal = (request as any).user;
    const audit = await createAuditLog({
      agencyId,
      userEmail,
      action: 'ACCESSED',
      resourceType: 'connection',
      resourceId: connection.id,
      agencyConnectionId: connection.id,
      platform: 'meta',
      request,
      metadata: {
        operation: 'list_assignable_recipients',
        actorType: actorType || (userEmail || principal?.sub || principal?.orgId ? 'authenticated_user' : 'unknown'),
        actorId: actorId || principal?.sub || principal?.orgId,
      },
    });
    if (audit.error) return { data: null, error: audit.error };

    const tokenResult = await agencyPlatformService.getValidToken(agencyId, 'meta');
    const accessToken = tokenResult.data;
    if (!accessToken) return { data: null, error: tokenResult.error };

    try {
      const humanUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${businessId}/business_users`);
      humanUrl.searchParams.set('fields', 'id,name,email,role');
      const [humanResult, systemUsersResult] = await Promise.all([
        (async () => {
          const humans: Array<{ id?: string; name?: string; email?: string; role?: string }> = [];
          let nextUrl: string | null = humanUrl.toString();
          while (nextUrl) {
            const response = await metaGraphGet(nextUrl, accessToken);
            if (!response.ok) {
              const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
              return {
                data: null,
                error: { code: 'META_BUSINESS_USERS_FAILED', message: payload.error?.message || 'Failed to list Meta business users' },
              };
            }
            const payload = await response.json() as {
              data?: Array<{ id?: string; name?: string; email?: string; role?: string }>;
              paging?: { next?: string };
            };
            humans.push(...(payload.data || []));
            nextUrl = payload.paging?.next || null;
          }
          return { data: humans, error: null };
        })(),
        metaSystemUserService.getSystemUsers(businessId, accessToken),
      ]);

      if (humanResult.error || !humanResult.data) return { data: null, error: humanResult.error };
      if (systemUsersResult.error || !systemUsersResult.data) {
        return {
          data: null,
          error: systemUsersResult.error || {
            code: 'SYSTEM_USER_LIST_FAILED',
            message: 'Failed to list Meta system users',
          },
        };
      }

      const humans: MetaAssignableRecipient[] = humanResult.data
        .filter((user): user is { id: string; name: string; email?: string; role?: string } =>
          Boolean(user.id && user.name)
        )
        .map((user) => ({ type: 'human', ...user }));
      const systemUsers: MetaAssignableRecipient[] = systemUsersResult.data.map((user) => ({
        type: 'system_user',
        id: user.id,
        name: user.name,
        role: user.role,
      }));

      return { data: [...humans, ...systemUsers], error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'META_ASSIGNEE_DISCOVERY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list Meta assignees',
        },
      };
    }
  },

  /**
   * Save selected Business Portfolio for a Meta connection
   * 
   * Stores the Business Manager ID in both:
   * 1. AgencyPlatformConnection.businessId (for client access granting)
   * 2. metadata.selectedBusinessId (for UI display)
   */
  async saveBusinessPortfolio(
    agencyId: string,
    businessId: string,
    businessName: string
  ): Promise<{
    data: any;
    error: any;
  }> {
    // First, update metadata
    const metadataResult = await agencyPlatformService.updateConnectionMetadata(agencyId, 'meta', {
      selectedBusinessId: businessId,
      selectedBusinessName: businessName,
    });

    if (metadataResult.error) {
      return metadataResult;
    }

    // Also update the businessId field on the connection record
    // This is needed for client access granting
    try {
      const connection = await agencyPlatformService.getConnection(agencyId, 'meta');
      
      if (connection.error || !connection.data) {
        return {
          data: null,
          error: {
            code: 'CONNECTION_NOT_FOUND',
            message: 'Meta connection not found',
          },
        };
      }

      const updatedConnection = await prisma.agencyPlatformConnection.update({
        where: { id: connection.data.id },
        data: {
          businessId: businessId,
        },
      });

      // After business ID is set, provision the partner admin system user token source.
      // We do this even if metadata already exists in case the agency switched business portfolios.
      try {
        const tokenResult = await agencyPlatformService.getValidToken(agencyId, 'meta');
        if (!tokenResult.error && tokenResult.data) {
          const systemUserResult = await metaSystemUserService.getOrCreateSystemUser(
            businessId,
            tokenResult.data,
            {
              name: metaSystemUserService.getDefaultPartnerAdminSystemUserName(),
              role: 'ADMIN',
            }
          );

          if (systemUserResult.error || !systemUserResult.data) {
            const latestMetadata = (updatedConnection.metadata as any) || {};
            const {
              partnerAdminSystemUserTokenSecretId,
              partnerAdminSystemUserScopes,
              partnerAdminSystemUserProvisionedAt,
              ...metadataWithoutReadyState
            } = latestMetadata;
            const failedAt = new Date().toISOString();

            await prisma.agencyPlatformConnection.update({
              where: { id: connection.data.id },
              data: {
                metadata: {
                  ...metadataWithoutReadyState,
                  partnerAdminSystemUserStatus: 'failed',
                  partnerAdminSystemUserLastAttemptAt: failedAt,
                  partnerAdminSystemUserLastErrorCode: systemUserResult.error?.code,
                  partnerAdminSystemUserLastErrorMessage: systemUserResult.error?.message,
                },
              },
            });

            await createAuditLog({
              agencyId,
              agencyConnectionId: connection.data.id,
              action: 'META_PARTNER_SYSTEM_USER_TOKEN_PROVISION_FAILED',
              userEmail: connection.data.connectedBy,
              metadata: {
                businessId,
                errorCode: systemUserResult.error?.code,
                errorMessage: systemUserResult.error?.message,
              },
            });
          } else {
            const tokenSecretResult = await metaSystemUserService.createSystemUserAccessToken({
              businessId,
              systemUserId: systemUserResult.data,
              accessToken: tokenResult.data,
              secretName: buildPartnerAdminSystemUserSecretName(agencyId, businessId),
            });

            const latestMetadata = (updatedConnection.metadata as any) || {};
            if (tokenSecretResult.error || !tokenSecretResult.data) {
              const {
                partnerAdminSystemUserTokenSecretId,
                partnerAdminSystemUserScopes,
                partnerAdminSystemUserProvisionedAt,
                ...metadataWithoutReadyState
              } = latestMetadata;
              const failedAt = new Date().toISOString();

              await prisma.agencyPlatformConnection.update({
                where: { id: connection.data.id },
                data: {
                  metadata: {
                    ...metadataWithoutReadyState,
                    systemUserId: systemUserResult.data,
                    partnerAdminSystemUserStatus: 'failed',
                    partnerAdminSystemUserLastAttemptAt: failedAt,
                    partnerAdminSystemUserLastErrorCode: tokenSecretResult.error?.code,
                    partnerAdminSystemUserLastErrorMessage: tokenSecretResult.error?.message,
                  },
                },
              });

              await createAuditLog({
                agencyId,
                agencyConnectionId: connection.data.id,
                action: 'META_PARTNER_SYSTEM_USER_TOKEN_PROVISION_FAILED',
                userEmail: connection.data.connectedBy,
                metadata: {
                  businessId,
                  systemUserId: systemUserResult.data,
                  errorCode: tokenSecretResult.error?.code,
                  errorMessage: tokenSecretResult.error?.message,
                },
              });
            } else {
              const {
                partnerAdminSystemUserLastAttemptAt,
                partnerAdminSystemUserLastErrorCode,
                partnerAdminSystemUserLastErrorMessage,
                ...metadataWithoutErrorState
              } = latestMetadata;
              const provisionedAt = new Date().toISOString();

              await prisma.agencyPlatformConnection.update({
                where: { id: connection.data.id },
                data: {
                  metadata: {
                    ...metadataWithoutErrorState,
                    systemUserId: systemUserResult.data,
                    partnerAdminSystemUserStatus: 'ready',
                    partnerAdminSystemUserTokenSecretId: tokenSecretResult.data.tokenSecretId,
                    partnerAdminSystemUserScopes:
                      tokenSecretResult.data.scopes.length > 0
                        ? tokenSecretResult.data.scopes
                        : META_PERMISSION_CONTRACT.systemUser.permissions,
                    partnerAdminSystemUserProvisionedAt: provisionedAt,
                  },
                },
              });

              await createAuditLog({
                agencyId,
                agencyConnectionId: connection.data.id,
                action: 'META_PARTNER_SYSTEM_USER_TOKEN_PROVISIONED',
                userEmail: connection.data.connectedBy,
                metadata: {
                  businessId,
                  systemUserId: systemUserResult.data,
                  tokenSecretId: tokenSecretResult.data.tokenSecretId,
                  scopes: tokenSecretResult.data.scopes,
                },
              });
            }
          }
        }
      } catch (error) {
        // Log but don't fail - token source can be provisioned later
        console.error('Failed to create system user when setting business ID:', error);
      }

      return { data: updatedConnection, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update Business Manager ID',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },

  /**
   * Save asset settings for a Meta connection
   */
  async saveAssetSettings(
    agencyId: string,
    settings: MetaAssetSettings
  ): Promise<{
    data: any;
    error: any;
  }> {
    return agencyPlatformService.updateConnectionMetadata(agencyId, 'meta', {
      assetSettings: settings,
    });
  },

  /**
   * Get current asset settings for a Meta connection
   */
  async getAssetSettings(agencyId: string): Promise<{
    data: MetaAssetSettings | null;
    error: any;
  }> {
    const connectionResult = await agencyPlatformService.getConnection(agencyId, 'meta');

    if (connectionResult.error || !connectionResult.data) {
      return {
        data: null,
        error: connectionResult.error || {
          code: 'NOT_FOUND',
          message: 'Meta connection not found',
        },
      };
    }

    const metadata = connectionResult.data.metadata as any;
    const settings = metadata?.assetSettings;

    // Return default settings if none exist
    if (!settings) {
      return {
        data: {
          adAccount: { enabled: true, permissionLevel: 'analyze' },
          page: { enabled: true, permissionLevel: 'analyze', limitPermissions: false },
          catalog: { enabled: true, permissionLevel: 'analyze' },
          dataset: { enabled: true, requestFullAccess: false },
          instagramAccount: { enabled: true, requestFullAccess: false },
        },
        error: null,
      };
    }

    return { data: settings, error: null };
  },

  /**
   * Get all assets for a Meta business
   */
  async getAssetsForBusiness(
    agencyId: string,
    businessId: string,
    request?: FastifyRequest,
    actorType: 'authenticated_user' | 'access_request_holder' = 'authenticated_user',
    actorId?: string,
    actorEmail?: string
  ): Promise<{
    data: MetaAllAssets | null;
    error: any;
  }> {
    try {
      const auditError = await auditMetaAssetRead(
        agencyId, businessId, request, 'list_business_assets', actorType, actorId, actorEmail
      );
      if (auditError) return { data: null, error: auditError };

      const tokenResult = await agencyPlatformService.getValidToken(agencyId, 'meta');

      if (tokenResult.error || !tokenResult.data) {
        return { data: null, error: tokenResult.error };
      }

      const connector = new MetaConnector();
      const assets = await connector.getAllAssets(tokenResult.data, businessId);

      return { data: assets, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch assets from Meta',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },

  async getClientInstagramAssetsForBusiness(
    agencyId: string,
    businessId: string,
    request?: FastifyRequest,
    actorId?: string,
    actorEmail?: string
  ) {
    const auditError = await auditMetaAssetRead(
      agencyId, businessId, request, 'list_client_instagram_assets', 'access_request_holder', actorId, actorEmail
    );
    if (auditError) return { data: null, error: auditError };

    const tokenResult = await agencyPlatformService.getValidToken(agencyId, 'meta');
    if (tokenResult.error || !tokenResult.data) return { data: null, error: tokenResult.error };
    try {
      const connector = new MetaConnector();
      return {
        data: await connector.getClientInstagramAccounts(tokenResult.data, businessId),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'META_CLIENT_INSTAGRAM_ASSETS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to read client Instagram assets',
        },
      };
    }
  },

  /**
   * Save granular asset selections for a Meta connection
   */
  async saveAssetSelections(agencyId: string, selections: MetaAssetSelection[]): Promise<{
    data: any;
    error: any;
  }> {
    return agencyPlatformService.updateConnectionMetadata(agencyId, 'meta', {
      assetSelections: selections,
    });
  },
};
