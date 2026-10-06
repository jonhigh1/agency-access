import type { FastifyRequest } from 'fastify';
import {
  META_AUTO_ASSIGN_GRANT_METHOD,
  MetaAccessConfigSchema,
  MetaAssetKind,
  MetaAutoAssignPreferencesSchema,
  MetaAutoAssignResult,
  MetaAutoAssignResultSchema,
  defaultMetaAutoAssignPreferences,
  getDefaultMetaAccessTasks,
  type MetaAutoAssignPreferences,
} from '@agency-platform/shared';
import { prisma } from '@/lib/prisma';
import { agencyPlatformService } from '@/services/agency-platform.service.js';
import { metaAssetsService } from '@/services/meta-assets.service.js';
import { metaPartnerService } from '@/services/meta-partner.service.js';
import { metaAssetGrantService } from '@/services/meta-asset-grant.service.js';
import { createAuditLog } from '@/services/audit.service.js';
import { resolveAuthenticatedUserEmail, type AuthUserClaims } from '@/lib/authorization.js';

const PARTNER_VERIFIED_METHODS = new Set([
  'automatic_agency_partner',
  'manual_business_share',
  'manual_agency',
  'catalog_agencies',
]);

const AUTO_ASSIGN_ASSET_KINDS = new Set<MetaAssetKind>(['page', 'ad_account', 'catalog']);

function tasksForAssetKind(
  assetKind: MetaAssetKind,
  accessConfig: ReturnType<typeof MetaAccessConfigSchema.parse> | null,
  products: string[],
): string[] {
  if (accessConfig) {
    if (assetKind === 'page' || assetKind === 'instagram_account') return accessConfig.pageTasks;
    if (assetKind === 'ad_account') return accessConfig.adAccountTasks;
    if (assetKind === 'catalog') return accessConfig.catalogTasks;
    if (assetKind === 'dataset') return accessConfig.datasetTasks ?? [];
  }
  const defaults = getDefaultMetaAccessTasks(products);
  if (assetKind === 'page' || assetKind === 'instagram_account') return defaults.pageTasks;
  if (assetKind === 'ad_account') return defaults.adAccountTasks;
  if (assetKind === 'catalog') return ['MANAGE'];
  return [];
}

function flattenMetaProducts(platforms: unknown): string[] {
  if (!Array.isArray(platforms)) return [];
  const products: string[] = [];
  for (const entry of platforms) {
    if (entry && typeof entry === 'object' && Array.isArray((entry as { products?: unknown }).products)) {
      for (const product of (entry as { products: Array<{ product?: string }> }).products) {
        if (typeof product?.product === 'string') products.push(product.product);
      }
    } else if (typeof entry === 'object' && entry !== null && typeof (entry as { platform?: string }).platform === 'string') {
      products.push((entry as { platform: string }).platform);
    }
  }
  return products;
}

export const metaAutoAssignService = {
  async getPreferences(agencyId: string): Promise<{
    data: MetaAutoAssignPreferences | null;
    error: { code: string; message: string } | null;
  }> {
    const connectionResult = await agencyPlatformService.getConnection(agencyId, 'meta');
    if (connectionResult.error || !connectionResult.data) {
      return {
        data: null,
        error: connectionResult.error || { code: 'NOT_FOUND', message: 'Meta connection not found' },
      };
    }
    const metadata = (connectionResult.data.metadata as Record<string, unknown> | null) || {};
    const parsed = MetaAutoAssignPreferencesSchema.safeParse(metadata.autoAssignPreferences);
    return {
      data: parsed.success ? parsed.data : defaultMetaAutoAssignPreferences(),
      error: null,
    };
  },

  async savePreferences(
    agencyId: string,
    preferences: MetaAutoAssignPreferences,
    request: FastifyRequest,
  ): Promise<{ data: MetaAutoAssignPreferences | null; error: { code: string; message: string } | null }> {
    const parsed = MetaAutoAssignPreferencesSchema.safeParse(preferences);
    if (!parsed.success) {
      return {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid Auto-Assign preferences' },
      };
    }

    if (parsed.data.recipients.length > 0) {
      const assignees = await metaAssetsService.getAssignableRecipients(agencyId, request);
      if (assignees.error || !assignees.data) {
        return { data: null, error: assignees.error || { code: 'META_ASSIGNEE_VALIDATION_FAILED', message: 'Could not validate Auto-Assign recipients' } };
      }
      const allowed = new Set(assignees.data.map((recipient) => `${recipient.type}:${recipient.id}`));
      const invalid = parsed.data.recipients.find((recipient) => !allowed.has(`${recipient.type}:${recipient.id}`));
      if (invalid) {
        return {
          data: null,
          error: {
            code: 'INVALID_AUTO_ASSIGN_RECIPIENT',
            message: 'One or more Auto-Assign recipients are not in the agency Business Portfolio',
          },
        };
      }
    }

    const update = await agencyPlatformService.updateConnectionMetadata(agencyId, 'meta', {
      autoAssignPreferences: parsed.data,
    });
    if (update.error) return { data: null, error: update.error };
    return { data: parsed.data, error: null };
  },

  async runForAccessRequest(
    accessRequestId: string,
    agencyId: string,
    request: FastifyRequest,
  ): Promise<{ data: MetaAutoAssignResult[] | null; error: { code: string; message: string } | null }> {
    const preferencesResult = await this.getPreferences(agencyId);
    if (preferencesResult.error || !preferencesResult.data) {
      return { data: null, error: preferencesResult.error || { code: 'NOT_FOUND', message: 'Auto-Assign preferences unavailable' } };
    }
    const preferences = preferencesResult.data;
    if (!preferences.enabled || preferences.recipients.length === 0) {
      return {
        data: null,
        error: {
          code: 'AUTO_ASSIGN_DISABLED',
          message: 'Enable Auto-Assign and select at least one person or system user in Meta settings',
        },
      };
    }

    const accessRequest = await prisma.accessRequest.findFirst({
      where: { id: accessRequestId, agencyId },
      include: {
        connection: {
          include: {
            metaAssetGrants: {
              include: {
                destination: { include: { agencyConnection: true } },
                authorization: true,
              },
            },
            authorizations: { where: { platform: 'meta', status: 'active' }, take: 1 },
          },
        },
      },
    });

    if (!accessRequest?.connection) {
      return { data: null, error: { code: 'NOT_FOUND', message: 'Access request or Meta connection not found' } };
    }

    type PartnerGrantRow = (typeof accessRequest.connection.metaAssetGrants)[number];
    const partnerGrants = accessRequest.connection.metaAssetGrants.filter(
      (grant: PartnerGrantRow) =>
        grant.recipientType === 'business' &&
        grant.status === 'verified' &&
        PARTNER_VERIFIED_METHODS.has(grant.grantMethod) &&
        AUTO_ASSIGN_ASSET_KINDS.has(grant.assetKind as MetaAssetKind),
    );

    if (partnerGrants.length === 0) {
      return {
        data: null,
        error: {
          code: 'PARTNER_ACCESS_NOT_VERIFIED',
          message: 'Partner share is not verified yet. Complete Partner grant or Check access before Auto-Assign.',
        },
      };
    }

    const connectionResult = await agencyPlatformService.getConnection(agencyId, 'meta');
    const agencyConnection = connectionResult.data;
    const agencyMetadata = (agencyConnection?.metadata as Record<string, unknown> | null) || {};
    const agencyBusinessId =
      agencyConnection?.businessId ||
      (typeof agencyMetadata.selectedBusinessId === 'string' ? agencyMetadata.selectedBusinessId : null);

    if (!agencyBusinessId) {
      return {
        data: null,
        error: { code: 'META_DESTINATION_NOT_READY', message: 'Select an agency Meta Business Portfolio first' },
      };
    }

    const userEmail = await resolveAuthenticatedUserEmail((request as FastifyRequest & { user?: AuthUserClaims }).user);
    const audit = await createAuditLog({
      agencyId,
      userEmail,
      action: 'ACCESSED',
      resourceType: 'connection',
      resourceId: agencyConnection!.id,
      agencyConnectionId: agencyConnection!.id,
      platform: 'meta',
      request,
      metadata: { operation: 'meta_auto_assign', accessRequestId },
    });
    if (audit.error) return { data: null, error: audit.error };

    const tokenResult = await agencyPlatformService.getValidToken(agencyId, 'meta');
    const agencyAccessToken = tokenResult.data;
    if (!agencyAccessToken) return { data: null, error: tokenResult.error };

    const parsedConfig = MetaAccessConfigSchema.safeParse(accessRequest.metaAccessConfig);
    const accessConfig = parsedConfig.success ? parsedConfig.data : null;
    const products = flattenMetaProducts(accessRequest.platforms);

    const platformAuth = accessRequest.connection.authorizations[0];
    const grantContextBase = partnerGrants[0];
    const destination = grantContextBase.destination;
    const clientBusinessId = grantContextBase.clientBusinessId;

    const results: MetaAutoAssignResult[] = [];
    const attemptedAt = new Date().toISOString();

    for (const partnerGrant of partnerGrants) {
      const assetKind = partnerGrant.assetKind as MetaAssetKind;
      const requestedTasks = tasksForAssetKind(assetKind, accessConfig, products);
      if (requestedTasks.length === 0) continue;

      for (const recipient of preferences.recipients) {
        const recipientRecord = {
          type: recipient.type,
          id: recipient.id,
          grantMethod: META_AUTO_ASSIGN_GRANT_METHOD,
        };
        const requirement = {
          assetId: partnerGrant.assetId,
          assetKind,
          assetName: partnerGrant.assetName || partnerGrant.assetId,
          requestedTasks,
        };

        await metaAssetGrantService.claimAttempts({
          accessRequestId: accessRequest.id,
          connectionId: accessRequest.connection.id,
          authorizationId: platformAuth?.id,
          authorizationEpoch: platformAuth?.authorizationEpoch || 1,
          clientBusinessId,
          destination: {
            agencyId,
            agencyConnectionId: agencyConnection!.id,
            businessId: agencyBusinessId,
            name: destination.name,
          },
          requirements: [requirement],
          recipient: recipientRecord,
        });

        let status: MetaAutoAssignResult['status'] = 'failed';
        let verifiedTasks: string[] | undefined;
        let errorCode: string | undefined;
        let errorMessage: string | undefined;

        try {
          await metaPartnerService.assignAgencyRecipientToAsset({
            agencyAccessToken,
            tokenClass: recipient.type === 'system_user' ? 'system_user' : 'client_user',
            agencyBusinessId,
            assetId: partnerGrant.assetId,
            recipientId: recipient.id,
            tasks: requestedTasks,
          });
          const readBack = await metaPartnerService.verifyAgencyRecipientOnAsset({
            agencyAccessToken,
            tokenClass: recipient.type === 'system_user' ? 'system_user' : 'client_user',
            agencyBusinessId,
            assetId: partnerGrant.assetId,
            recipientId: recipient.id,
            expectedTasks: requestedTasks,
          });
          verifiedTasks = readBack.assignedTasks;
          status = readBack.verified ? 'verified' : 'failed';
          if (!readBack.verified) {
            errorCode = 'META_AUTO_ASSIGN_VERIFICATION_FAILED';
            errorMessage = 'Meta did not confirm every requested task for this team member.';
          }
        } catch (error) {
          errorCode = 'META_AUTO_ASSIGN_FAILED';
          errorMessage = error instanceof Error ? error.message : 'Auto-Assign failed';
        }

        const grantResult = {
          assetId: partnerGrant.assetId,
          assetType: assetKind,
          recipientType: recipient.type,
          recipientId: recipient.id,
          requestedTasks,
          verifiedTasks,
          status: status === 'verified' ? 'verified' as const : 'failed' as const,
          grantedAt: attemptedAt,
          ...(status === 'verified' ? { verifiedAt: attemptedAt } : { errorCode, errorMessage }),
        };

        await metaAssetGrantService.recordOutcomes({
          accessRequestId: accessRequest.id,
          connectionId: accessRequest.connection.id,
          authorizationId: platformAuth?.id,
          authorizationEpoch: platformAuth?.authorizationEpoch || 1,
          clientBusinessId,
          destination: {
            agencyId,
            agencyConnectionId: agencyConnection!.id,
            businessId: agencyBusinessId,
            name: destination.name,
          },
          recipient: recipientRecord,
          results: [grantResult],
          attemptVersions: new Map([[`${assetKind}:${partnerGrant.assetId}`, 1]]),
        });

        results.push(
          MetaAutoAssignResultSchema.parse({
            assetKind,
            assetId: partnerGrant.assetId,
            assetName: partnerGrant.assetName || partnerGrant.assetId,
            recipientType: recipient.type,
            recipientId: recipient.id,
            recipientName: recipient.name,
            requestedTasks,
            verifiedTasks,
            status,
            errorCode,
            errorMessage,
            attemptedAt,
          }),
        );
      }
    }

    return { data: results, error: null };
  },
};
