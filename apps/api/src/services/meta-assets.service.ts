import { agencyPlatformService } from './agency-platform.service.js';
import { MetaConnector } from './connectors/meta.js';
import type { MetaAssetSelection, MetaAllAssets, MetaAssetSettings } from '@agency-platform/shared';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/services/audit.service';
import { metaSystemUserService } from './meta-system-user.service.js';

const META_PARTNER_ADMIN_SCOPES = ['ads_management', 'business_management'];

function buildPartnerAdminSystemUserSecretName(agencyId: string, businessId: string): string {
  return `meta_partner_admin_system_user_${agencyId}_${businessId}`;
}

/**
 * Meta Assets Service
 *
 * Handles discovery and selection of Meta assets (ad accounts, pages, etc.)
 */
export const metaAssetsService = {
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
                        : META_PARTNER_ADMIN_SCOPES,
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
  async getAssetsForBusiness(agencyId: string, businessId: string): Promise<{
    data: MetaAllAssets | null;
    error: any;
  }> {
    try {
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
