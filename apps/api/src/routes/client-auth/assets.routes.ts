import { FastifyInstance } from 'fastify';
import { accessRequestService } from '../../services/access-request.service.js';
import { auditService } from '../../services/audit.service.js';
import {
  clientAssetsService,
  MetaPageReauthorizationError,
  MetaBusinessPortfolioUnavailableError,
  type MetaAssets,
} from '../../services/client-assets.service.js';
import { googleNativeAccessService } from '@/services/google-native-access.service';
import {
  mapAccessLevelToTikTokRole,
  tiktokPartnerService,
  type TikTokPartnerShareResultItem,
} from '@/services/tiktok-partner.service';
import { infisical } from '../../lib/infisical.js';
import { prisma } from '../../lib/prisma.js';
import { readMetaAuthorizationMetadata } from '../../lib/meta-authorization-metadata.js';
import {
  type MetaAssetKind,
  MetaAccessConfigSchema,
  type MetaAssetGrantResult,
  type MetaClientAuthorizationMetadata,
  platformGroupOf,
  type GooglePlatformProductId,
  type Platform,
  getDefaultMetaAccessTasks,
} from '@agency-platform/shared';
import type { GoogleProduct } from '../../services/connectors/google.js';
import {
  grantMetaAccessSchema,
  manualMetaAdAccountShareSchema,
  manualMetaDatasetVerifySchema,
  saveAssetsSchema,
  tiktokPartnerShareSchema,
  tiktokPartnerVerifySchema,
} from './schemas.js';
import { metaOBOService } from '@/services/meta-obo.service';
import { metaPartnerService } from '@/services/meta-partner.service';
import { MetaGrantAttemptSupersededError, metaAssetGrantService } from '@/services/meta-asset-grant.service';
import { metaAssetsService } from '@/services/meta-assets.service';
import { MetaConnector } from '@/services/connectors/meta';
import { sendError, sendSuccess, sendValidationError } from '../../lib/response.js';

type ShareResultWithVerification = TikTokPartnerShareResultItem & { verified?: boolean };

const GOOGLE_NATIVE_ACCESS_PRODUCTS = new Set<GoogleProduct>([
  'google_ads',
  'ga4',
  'google_business_profile',
  'google_tag_manager',
  'google_search_console',
  'google_merchant_center',
]);

function resolveAgencyTikTokBusinessCenterId(connection: {
  businessId?: string | null;
  metadata?: unknown;
} | null): string | null {
  if (!connection) return null;
  const metadata = (connection.metadata as Record<string, unknown> | null) || {};
  const tiktokMetadata =
    (metadata.tiktok as Record<string, unknown> | undefined) || {};

  const fromMetadata =
    tiktokMetadata.businessCenterId ??
    tiktokMetadata.selectedBusinessCenterId ??
    tiktokMetadata.bcId ??
    metadata.businessCenterId ??
    metadata.selectedBusinessCenterId ??
    metadata.bcId;

  const resolved = connection.businessId || (typeof fromMetadata === 'string' ? fromMetadata : null);
  return resolved ? String(resolved) : null;
}

function resolveRequestedTikTokAccessLevel(accessRequest: any): string {
  const platforms = Array.isArray(accessRequest?.platforms) ? accessRequest.platforms : [];

  for (const group of platforms) {
    if (group?.platformGroup !== 'tiktok' || !Array.isArray(group.products)) continue;
    const productLevels = group.products
      .map((product: any) => product?.accessLevel)
      .filter((value: unknown): value is string => typeof value === 'string');

    if (productLevels.includes('admin')) return 'admin';
    if (productLevels.includes('standard')) return 'standard';
    if (productLevels.includes('read_only')) return 'read_only';
    if (productLevels.includes('email_only')) return 'email_only';
  }

  for (const platform of platforms) {
    const platformName = platform?.platform;
    if (platformName !== 'tiktok' && platformName !== 'tiktok_ads') continue;
    if (platform?.accessLevel === 'manage') return 'admin';
    if (platform?.accessLevel === 'view_only') return 'read_only';
  }

  return 'standard';
}

function mergeTikTokShareResults(
  previous: unknown,
  current: ShareResultWithVerification[]
): ShareResultWithVerification[] {
  const map = new Map<string, ShareResultWithVerification>();

  if (Array.isArray(previous)) {
    for (const item of previous) {
      if (!item || typeof item !== 'object') continue;
      const advertiserId = String((item as any).advertiserId || '');
      if (!advertiserId) continue;
      map.set(advertiserId, {
        advertiserId,
        status: (item as any).status,
        error: (item as any).error,
        verified: (item as any).verified,
      });
    }
  }

  for (const item of current) {
    map.set(item.advertiserId, item);
  }

  return Array.from(map.values());
}

function normalizeStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function getSelectedMetaAssets(selectedAssets: unknown): Record<string, unknown> {
  if (!selectedAssets || typeof selectedAssets !== 'object' || Array.isArray(selectedAssets)) {
    return {};
  }

  const record = selectedAssets as Record<string, unknown>;
  const metaAdsAssets =
    record.meta_ads && typeof record.meta_ads === 'object' && !Array.isArray(record.meta_ads)
      ? (record.meta_ads as Record<string, unknown>)
      : null;
  const metaPagesAssets =
    record.meta_pages && typeof record.meta_pages === 'object' && !Array.isArray(record.meta_pages)
      ? (record.meta_pages as Record<string, unknown>)
      : null;

  const merged = { ...(metaPagesAssets || {}), ...(metaAdsAssets || {}) };
  for (const key of ['pages', 'adAccounts', 'selectedAdvertiserIds', 'advertisers', 'instagramAccounts']) {
    const values = [metaPagesAssets?.[key], metaAdsAssets?.[key]].flatMap((value) =>
      Array.isArray(value) ? value : []
    );
    if (values.length > 0) merged[key] = Array.from(new Set(values));
  }
  return merged;
}

const META_UNSUPPORTED_INSTAGRAM_MESSAGE =
  'Instagram account automated grants are not yet supported';
const META_MANUAL_AD_ACCOUNT_PENDING_MESSAGE =
  'Ad account has not been shared to the agency business portfolio yet';

function buildMetaGrantRequirements(
  platform: string,
  selectedAssets: Record<string, unknown>,
  pageTasks: string[],
  adAccountTasks: string[],
  catalogTasks: string[],
  datasetTasks: string[]
) {
  const requirements: Array<{
    assetId: string;
    assetKind: MetaAssetKind;
    assetName?: string;
    requestedTasks: string[];
  }> = [];
  const add = (assetKind: MetaAssetKind, ids: unknown, requestedTasks: string[], namedAssets?: unknown) => {
    const names = new Map(
      (Array.isArray(namedAssets) ? namedAssets : [])
        .filter((asset): asset is { id: string; name: string } =>
          !!asset && typeof asset === 'object' && typeof asset.id === 'string' && typeof asset.name === 'string'
        )
        .map((asset) => [asset.id, asset.name])
    );
    for (const assetId of normalizeStringIds(ids)) {
      requirements.push({ assetId, assetKind, assetName: names.get(assetId), requestedTasks });
    }
  };

  if (platform === 'meta_ads') {
    add('ad_account', selectedAssets.adAccounts, adAccountTasks, selectedAssets.selectedAdAccountsWithNames);
    add('page', selectedAssets.pages, pageTasks, selectedAssets.selectedPagesWithNames);
    add('instagram_account', selectedAssets.instagramAccounts, [], selectedAssets.selectedInstagramWithNames);
    add('catalog', selectedAssets.catalogs, catalogTasks, selectedAssets.selectedCatalogsWithNames);
    add('dataset', selectedAssets.datasets, datasetTasks, selectedAssets.selectedDatasetsWithNames);
  } else if (platform === 'meta_pages') {
    add('page', selectedAssets.pages, pageTasks, selectedAssets.selectedPagesWithNames);
  } else if (platform === 'instagram') {
    add('instagram_account', selectedAssets.instagramAccounts, [], selectedAssets.selectedInstagramWithNames);
  }

  return requirements;
}

type ManualMetaAdAccountSelection = {
  id: string;
  name: string;
};

type ManualMetaAdAccountVerificationResult = {
  assetId: string;
  assetName: string;
  status: 'waiting_for_manual_share' | 'verified' | 'unresolved' | 'failed';
  verifiedAt?: string;
  assignedTasks?: string[];
  errorCode?: string;
  errorMessage?: string;
};

function buildMetaGrantVerificationStatus(
  assetGrantResults: MetaAssetGrantResult[]
): 'verified' | 'partial' | 'failed' {
  const allVerified =
    assetGrantResults.length > 0 &&
    assetGrantResults.every((result) => result.status === 'verified');

  if (allVerified) {
    return 'verified';
  }

  const hasVerified = assetGrantResults.some((result) => result.status === 'verified');
  return hasVerified ? 'partial' : 'failed';
}

function extractSelectedMetaAdAccounts(selectedMetaAssets: Record<string, unknown>): ManualMetaAdAccountSelection[] {
  const selectedWithNames = Array.isArray(selectedMetaAssets.selectedAdAccountsWithNames)
    ? selectedMetaAssets.selectedAdAccountsWithNames
    : [];
  const selectedIds = normalizeStringIds(
    selectedMetaAssets.adAccounts ??
      selectedMetaAssets.selectedAdvertiserIds ??
      selectedMetaAssets.advertisers
  );

  if (selectedWithNames.length > 0) {
    return selectedWithNames
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const id = String((item as Record<string, unknown>).id || '');
        if (!id) return null;

        return {
          id,
          name: String((item as Record<string, unknown>).name || id),
        };
      })
      .filter((item): item is ManualMetaAdAccountSelection => Boolean(item));
  }

  return selectedIds.map((id) => ({ id, name: id }));
}

function mergeMetaAssetGrantResults(
  existingResults: MetaAssetGrantResult[] | undefined,
  nextResults: MetaAssetGrantResult[],
  assetType: MetaAssetKind
): MetaAssetGrantResult[] {
  const retained = (existingResults || []).filter((result) => result.assetType !== assetType);
  return [...retained, ...nextResults];
}

function sortMetaAssetGrantResults(assetGrantResults: MetaAssetGrantResult[]): MetaAssetGrantResult[] {
  const order: Partial<Record<MetaAssetKind, number>> = {
    page: 0,
    ad_account: 1,
    instagram_account: 2,
  };

  return [...assetGrantResults].sort(
    (left, right) => (order[left.assetType] ?? 99) - (order[right.assetType] ?? 99)
  );
}

const ASSET_OPERATION_CONCURRENCY = 5;

// Bounded fan-out, order preserved: each result lands at its input index.
async function mapInChunks<T, R>(items: T[], mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  for (let start = 0; start < items.length; start += ASSET_OPERATION_CONCURRENCY) {
    const chunk = items.slice(start, start + ASSET_OPERATION_CONCURRENCY);
    await Promise.all(
      chunk.map((item, index) =>
        mapper(item).then((result) => {
          results[start + index] = result;
        })
      )
    );
  }
  return results;
}

// True when the next discovery snapshot differs from the stored one only in
// refresh timestamps (discoveredAt/selectedAt) — the metadata write can be skipped.
function metaDiscoveryContentUnchanged(
  stored: MetaClientAuthorizationMetadata,
  next: MetaClientAuthorizationMetadata
): boolean {
  if (
    JSON.stringify(stored.discovery?.availableBusinesses ?? null) !==
    JSON.stringify(next.discovery?.availableBusinesses ?? null)
  ) {
    return false;
  }

  if (!next.selection) return true;

  return (
    stored.selection?.clientBusinessId === next.selection.clientBusinessId &&
    stored.selection?.clientBusinessName === next.selection.clientBusinessName &&
    stored.selection?.source === next.selection.source
  );
}

function resolveAgencyMetaBusinessDetails(connection: {
  businessId?: string | null;
  metadata?: unknown;
} | null): { businessId: string | null; businessName: string | null } {
  if (!connection) {
    return {
      businessId: null,
      businessName: null,
    };
  }

  const metadata = (connection.metadata as Record<string, unknown> | null) || {};
  const businessId =
    connection.businessId ||
    (typeof metadata.selectedBusinessId === 'string' ? metadata.selectedBusinessId : null) ||
    (typeof metadata.businessId === 'string' ? metadata.businessId : null);
  const businessName =
    (typeof metadata.selectedBusinessName === 'string' ? metadata.selectedBusinessName : null) ||
    (typeof metadata.businessName === 'string' ? metadata.businessName : null);

  return {
    businessId: businessId ? String(businessId) : null,
    businessName: businessName ? String(businessName) : null,
  };
}

function toMetaAdAccountGrantResults(
  verificationResults: ManualMetaAdAccountVerificationResult[],
  partnerBusinessId: string,
  requestedTasks: string[],
): MetaAssetGrantResult[] {
  return verificationResults.map((result) => ({
    assetId: result.assetId,
    assetType: 'ad_account',
    recipientType: 'business',
    recipientId: partnerBusinessId,
    requestedTasks,
    ...(result.assignedTasks ? { verifiedTasks: result.assignedTasks } : {}),
    status: result.status === 'waiting_for_manual_share' ? 'pending' : result.status,
    ...(result.status === 'verified' ? { grantedAt: result.verifiedAt, verifiedAt: result.verifiedAt } : {}),
    ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
  }));
}

function validateMetaAssetSelection(
  businessId: string,
  assets: MetaAssets,
  selected: Partial<Record<MetaAssetKind, string[]>>
): { code: string; message: string; statusCode: number } | null {
  if (assets.selectedBusinessId !== businessId) {
    return {
      code: 'META_BUSINESS_SELECTION_MISMATCH',
      message: 'Meta could not confirm the selected client Business Portfolio.',
      statusCode: 409,
    };
  }

  const availableByKind: Record<MetaAssetKind, Set<string>> = {
    unknown: new Set(),
    page: new Set(assets.pages.map((asset) => asset.id)),
    ad_account: new Set(assets.adAccounts.map((asset) => asset.id)),
    instagram_account: new Set(assets.instagramAccounts.map((asset) => asset.id)),
    catalog: new Set(assets.productCatalogs.map((asset) => asset.id)),
    dataset: new Set(assets.pixels.map((asset) => asset.id)),
  };
  const warningMarker: Partial<Record<MetaAssetKind, string>> = {
    instagram_account: 'instagram',
    catalog: 'catalog',
    dataset: 'pixel',
  };
  const warnings = (assets.assetLoadWarnings || []).map((warning) => warning.toLowerCase());

  for (const [assetKind, assetIds] of Object.entries(selected) as Array<[MetaAssetKind, string[]]>) {
    if (assetIds.length === 0) continue;
    const marker = warningMarker[assetKind];
    if (marker && warnings.some((warning) => warning.includes(marker))) {
      return {
        code: 'META_ASSET_DISCOVERY_INCOMPLETE',
        message: `Meta could not fully load selected ${assetKind} assets. Refresh discovery before continuing.`,
        statusCode: 502,
      };
    }
    if (assetIds.some((assetId) => !availableByKind[assetKind].has(assetId))) {
      return {
        code: 'META_ASSET_NOT_IN_SELECTED_BUSINESS',
        message: 'One or more selected assets do not belong to the selected client Business Portfolio.',
        statusCode: 403,
      };
    }
  }

  return null;
}

/** Pull the validated id list out of a selected*WithNames array (review #16):
 * the grant flow prefers these arrays over the flat id lists, so their ids
 * must pass the same membership gate as the flat ones. */
function extractWithNamesIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      return String((item as Record<string, unknown>).id || '');
    })
    .filter(Boolean);
}

/**
 * Shared save/grant scope validation (review #13): derive the selected asset
 * kinds, run the narrowed Meta discovery, and validate every selected id
 * against the discovered set. WithNames ids are unioned into their kind so a
 * client cannot smuggle an unvalidated id through the names arrays.
 */
async function scopedMetaAssetSelection(
  accessToken: string,
  businessId: string,
  selected: Partial<Record<MetaAssetKind, string[]>>,
  withNames: Partial<Record<MetaAssetKind, unknown[]>> = {},
): Promise<{ assets: MetaAssets } | { error: { code: string; message: string; statusCode: number } }> {
  const selectedKinds: MetaAssetKind[] = [];
  const merged: Partial<Record<MetaAssetKind, string[]>> = {};
  for (const [kind, ids] of Object.entries(selected) as Array<[MetaAssetKind, string[]]>) {
    const union = Array.from(new Set([...(ids || []), ...extractWithNamesIds(withNames[kind])]));
    merged[kind] = union;
    if (union.length > 0) selectedKinds.push(kind);
  }

  let assets: MetaAssets;
  try {
    assets = await clientAssetsService.fetchMetaAssets(
      accessToken,
      businessId,
      selectedKinds.length > 0 ? selectedKinds : undefined
    );
  } catch (error) {
    if (error instanceof MetaBusinessPortfolioUnavailableError) {
      return { error: { code: error.code, message: error.message, statusCode: error.statusCode } };
    }
    return {
      error: {
        code: 'META_ASSET_DISCOVERY_FAILED',
        message: 'Could not confirm selected assets belong to the selected client Business Portfolio.',
        statusCode: 502,
      },
    };
  }

  const selectionError = validateMetaAssetSelection(businessId, assets, merged);
  if (selectionError) {
    return { error: selectionError };
  }
  return { assets };
}

export async function registerAssetRoutes(fastify: FastifyInstance) {
  async function resolveAuthorizedConnection(token: string, connectionId: string) {
    const accessRequest = await accessRequestService.getAccessRequestByToken(token);
    if (accessRequest.error || !accessRequest.data) {
      return {
        accessRequest: null,
        connection: null,
        error: {
          code: 'ACCESS_REQUEST_NOT_FOUND',
          message: 'Access request not found',
        },
      };
    }

    const connection = await prisma.clientConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return {
        accessRequest: accessRequest.data,
        connection: null,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Client connection not found',
        },
      };
    }

    const isAuthorizedConnection =
      connection.accessRequestId === accessRequest.data.id &&
      connection.agencyId === accessRequest.data.agencyId;

    if (!isAuthorizedConnection) {
      return {
        accessRequest: accessRequest.data,
        connection: null,
        error: {
          code: 'FORBIDDEN',
          message: 'Connection does not belong to this access request',
        },
      };
    }

    return {
      accessRequest: accessRequest.data,
      connection,
      error: null,
    };
  }

  // Save selected assets for a platform
  fastify.post('/client/:token/save-assets', async (request, reply) => {
    const { token } = request.params as { token: string };

    const validated = saveAssetsSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid asset selection data', 400, validated.error.errors,);
    }

    const { connectionId, platform, selectedAssets } = validated.data;

    try {
      const authContext = await resolveAuthorizedConnection(token, connectionId);
      if (authContext.error || !authContext.connection) {
        const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
        return reply.code(statusCode).send({
          data: null,
          error: authContext.error,
        });
      }
      const connection = authContext.connection;
      let resolvedSelectedAssets = selectedAssets;

      if (GOOGLE_NATIVE_ACCESS_PRODUCTS.has(platform as GoogleProduct) && authContext.accessRequest) {
        const orchestrationResult = await googleNativeAccessService.planGoogleNativeGrants({
          accessRequest: authContext.accessRequest as any,
          connection,
          platform: platform as GooglePlatformProductId,
          selectedAssets,
        });

        if (orchestrationResult.error) {
          return sendError(reply, orchestrationResult.error.code, orchestrationResult.error.message, 500, orchestrationResult.error.details || undefined);
        }

        if (orchestrationResult.data?.selectedAssets) {
          resolvedSelectedAssets = orchestrationResult.data.selectedAssets as typeof selectedAssets;
        }
      }

      const platformStr = String(platform);
      const authPlatform = platformGroupOf(platformStr) as Platform;
      const existingAuth = await prisma.platformAuthorization.findUnique({
        where: { connectionId_platform: { connectionId, platform: authPlatform } },
      });
      let metaRequirementContext: Parameters<typeof metaAssetGrantService.syncRequirements>[0] | null = null;
      let selectedMetaBusinessId: string | null = null;

      if (authPlatform === 'meta') {
        if (!existingAuth || !authContext.accessRequest) {
          return sendError(reply, 'AUTHORIZATION_NOT_FOUND', 'Meta authorization not found', 409);
        }
        const { metaMetadata } = readMetaAuthorizationMetadata(existingAuth.metadata);
        const clientBusinessId = metaMetadata.selection?.clientBusinessId;
        if (!clientBusinessId) {
          return sendError(reply, 'META_BUSINESS_SELECTION_REQUIRED', 'Select a client Business Portfolio before selecting assets', 409);
        }
        selectedMetaBusinessId = clientBusinessId;
        const agencyConnection = await prisma.agencyPlatformConnection.findUnique({
          where: { agencyId_platform: { agencyId: connection.agencyId, platform: 'meta' } },
        });
        const { businessId, businessName } = resolveAgencyMetaBusinessDetails(agencyConnection);
        if (!agencyConnection || !businessId) {
          return sendError(reply, 'AGENCY_BUSINESS_ID_MISSING', 'Agency must set up its Meta Business Portfolio before assets can be selected', 409);
        }
        const parsedConfig = MetaAccessConfigSchema.safeParse(authContext.accessRequest.metaAccessConfig);
        if (!parsedConfig.success || !parsedConfig.data.recipients.some((recipient) => recipient.type === 'human')) {
          return sendError(reply, 'META_ASSIGNEE_SELECTION_REQUIRED', 'Agency must choose at least one Meta person before assets can be selected', 409);
        }
        const config = parsedConfig.data;
        const defaultTasks = getDefaultMetaAccessTasks(
          (authContext.accessRequest.platforms || []).map((item: { platform: string }) => item.platform)
        );
        const requirements = buildMetaGrantRequirements(
          platformStr,
          resolvedSelectedAssets,
          config.pageTasks.length > 0 ? config.pageTasks : defaultTasks.pageTasks,
          config.adAccountTasks.length > 0 ? config.adAccountTasks : defaultTasks.adAccountTasks,
          config.catalogTasks,
          config.datasetTasks?.length ? config.datasetTasks : defaultTasks.datasetTasks
        );
        if (requirements.length === 0) {
          return sendError(reply, 'NO_SELECTED_ASSETS', 'Select at least one Meta asset', 400);
        }

        // KTD5: the selection blob is client-controlled input. Before anything
        // is persisted, validate the claimed business and every asset ID
        // against what this connection's Meta token can actually see.
        const claimedBusinessId =
          typeof resolvedSelectedAssets.selectedBusinessId === 'string'
            ? resolvedSelectedAssets.selectedBusinessId
            : null;
        if (claimedBusinessId && claimedBusinessId !== clientBusinessId) {
          // Review #11: one code, one status — the grant path and the shared
          // validator both emit this mismatch as 409.
          return sendError(
            reply,
            'META_BUSINESS_SELECTION_MISMATCH',
            'Selected Business Portfolio does not match the client selection saved for this connection',
            409
          );
        }

        const scopeAudit = await auditService.createAuditLog({
          agencyId: connection.agencyId,
          action: 'META_TOKEN_READ',
          userEmail: connection.clientEmail,
          resourceType: 'client_connection',
          resourceId: connectionId,
          metadata: {
            platform: platformStr,
            source: 'save_assets_scope_validation',
            selectedBusinessId: clientBusinessId,
          },
          request,
        });
        if (scopeAudit?.error) {
          return sendError(reply, 'AUDIT_LOG_FAILED', 'Could not record Meta access before reading its token', 500);
        }

        const clientTokens = await infisical.getOAuthTokens(existingAuth.secretId);
        if (!clientTokens?.accessToken) {
          return sendError(reply, 'TOKEN_NOT_FOUND', 'OAuth tokens not found in secure storage', 500);
        }

        const scopeResult = await scopedMetaAssetSelection(
          clientTokens.accessToken,
          clientBusinessId,
          {
            page: normalizeStringIds(resolvedSelectedAssets.pages),
            ad_account: normalizeStringIds(resolvedSelectedAssets.adAccounts),
            instagram_account: normalizeStringIds(resolvedSelectedAssets.instagramAccounts),
            catalog: normalizeStringIds(resolvedSelectedAssets.catalogs),
            dataset: normalizeStringIds(resolvedSelectedAssets.datasets),
          },
          {
            page: resolvedSelectedAssets.selectedPagesWithNames,
            ad_account: resolvedSelectedAssets.selectedAdAccountsWithNames,
            instagram_account: resolvedSelectedAssets.selectedInstagramWithNames,
            catalog: resolvedSelectedAssets.selectedCatalogsWithNames,
            dataset: resolvedSelectedAssets.selectedDatasetsWithNames,
          }
        );
        if ('error' in scopeResult) {
          return sendError(reply, scopeResult.error.code, scopeResult.error.message, scopeResult.error.statusCode);
        }
        metaRequirementContext = {
          accessRequestId: authContext.accessRequest.id,
          connectionId,
          authorizationId: existingAuth.id,
          authorizationEpoch: existingAuth.authorizationEpoch || 1,
          clientBusinessId,
          destination: {
            agencyId: connection.agencyId,
            agencyConnectionId: agencyConnection.id,
            businessId,
            name: businessName,
          },
          requirements,
          recipients: [
            { type: 'business', id: businessId, grantMethod: 'manual_business_share' },
            ...config.recipients.map((recipient) => ({
              type: recipient.type,
              id: recipient.id,
              grantMethod: 'assigned_users',
            })),
          ],
        };
      }

      const currentGrantedAssets = (connection.grantedAssets as any) || {};
      const instagramSelection = platformStr === 'instagram'
        ? {
            instagramAccounts: resolvedSelectedAssets.instagramAccounts || [],
            selectedInstagramWithNames: resolvedSelectedAssets.selectedInstagramWithNames || [],
            selectedBusinessId: selectedMetaBusinessId,
          }
        : null;
      const priorMetaAdsAssets = currentGrantedAssets.meta_ads || {};
      const updatedGrantedAssets = {
        ...currentGrantedAssets,
        ...(instagramSelection ? {
          meta_ads: {
            ...(priorMetaAdsAssets.selectedBusinessId === selectedMetaBusinessId ? priorMetaAdsAssets : {}),
            ...instagramSelection,
          },
        } : {}),
        [platform]: resolvedSelectedAssets,
      };

      await prisma.clientConnection.update({
        where: { id: connectionId },
        data: { grantedAssets: updatedGrantedAssets },
      });

      if (existingAuth) {
        const existingMetadata = (existingAuth.metadata as any) || {};
        const priorMetaAdsMetadata = existingMetadata.selectedAssets?.meta_ads || {};
        const tiktokSelection =
          authPlatform === 'tiktok'
            ? {
                selectedAdvertiserIds:
                  resolvedSelectedAssets.selectedAdvertiserIds ||
                  resolvedSelectedAssets.adAccounts ||
                  resolvedSelectedAssets.advertisers ||
                  [],
                selectedBusinessCenterId: resolvedSelectedAssets.selectedBusinessCenterId || null,
                discoverySnapshot: {
                  advertisers: resolvedSelectedAssets.availableAdvertisers || [],
                  businessCenters: resolvedSelectedAssets.availableBusinessCenters || [],
                },
              }
            : undefined;

        const updatedMetadata = {
          ...existingMetadata,
          selectedAssets: {
            ...(existingMetadata.selectedAssets || {}),
            ...(instagramSelection ? {
              meta_ads: {
                ...(priorMetaAdsMetadata.selectedBusinessId === selectedMetaBusinessId ? priorMetaAdsMetadata : {}),
                ...instagramSelection,
              },
            } : {}),
            [platform]: resolvedSelectedAssets,
          },
          ...(tiktokSelection
            ? {
                tiktok: {
                  ...(existingMetadata.tiktok || {}),
                  ...tiktokSelection,
                },
              }
            : {}),
        };

        await prisma.platformAuthorization.update({
          where: { id: existingAuth.id },
          data: { metadata: updatedMetadata },
        });

        if (metaRequirementContext) {
          await metaAssetGrantService.syncRequirements(metaRequirementContext);
        }
      }

      await auditService.createAuditLog({
        agencyId: connection.agencyId,
        action: 'CLIENT_ASSETS_SELECTED',
        userEmail: connection.clientEmail,
        resourceType: 'client_connection',
        resourceId: connection.id,
        metadata: {
          platform,
          selectedAssets: resolvedSelectedAssets,
        },
      });

      return reply.send({
        data: { success: true },
        error: null,
      });
    } catch (error) {
      return sendError(reply, 'SAVE_ASSETS_ERROR', `Failed to save selected assets: ${error}`, 500);
    }
  });

  fastify.get('/client/:token/meta-page-proof', async (request, reply) => {
    const { token } = request.params as { token: string };
    const { connectionId, pageId } = request.query as {
      connectionId?: string;
      pageId?: string;
    };

    if (!connectionId || !pageId) {
      return sendError(reply, 'VALIDATION_ERROR', 'connectionId and pageId are required', 400);
    }

    try {
      const authContext = await resolveAuthorizedConnection(token, connectionId);
      if (authContext.error || !authContext.connection) {
        const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
        return reply.code(statusCode).send({
          data: null,
          error: authContext.error,
        });
      }

      const platformAuth = await prisma.platformAuthorization.findUnique({
        where: {
          connectionId_platform: {
            connectionId,
            platform: 'meta',
          },
        },
      });

      if (!platformAuth) {
        return sendError(reply, 'AUTHORIZATION_NOT_FOUND', 'Meta authorization not found', 404);
      }

      if (platformAuth.status !== 'active') {
        return sendError(reply, 'REAUTHORIZATION_REQUIRED', 'Meta authorization is inactive. Reconnect before reading Page content.', 403);
      }

      const { rootMetadata } = readMetaAuthorizationMetadata(platformAuth.metadata);
      const selectedMetaAssets = getSelectedMetaAssets(rootMetadata.selectedAssets);
      const selectedPageIds = normalizeStringIds(selectedMetaAssets.pages);

      if (!selectedPageIds.includes(pageId)) {
        return sendError(reply, 'PAGE_NOT_SELECTED', 'The requested Page was not selected for this access request', 403);
      }

      const audit = await auditService.createAuditLog({
        agencyId: authContext.accessRequest!.agencyId,
        action: 'META_PAGE_ENGAGEMENT_PROOF_READ',
        userEmail: authContext.connection.clientEmail,
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: {
          authorizationId: platformAuth.id,
          platform: 'meta',
          pageId,
          purpose: 'page_engagement_proof',
        },
        request,
      });
      if (audit?.error) {
        return sendError(reply, 'AUDIT_LOG_FAILED', 'Could not record Meta Page access before reading its token', 500);
      }

      const tokens = await infisical.getOAuthTokens(platformAuth.secretId);

      const proof = await clientAssetsService.fetchPageEngagementProof(tokens.accessToken, pageId);

      return sendSuccess(reply, proof);
    } catch (error) {
      if (error instanceof MetaPageReauthorizationError) {
        return sendError(reply, 'REAUTHORIZATION_REQUIRED', error.message, 403);
      }
      return sendError(
        reply,
        'META_PAGE_PROOF_UNAVAILABLE',
        error instanceof Error ? error.message : 'Failed to read Page content',
        403
      );
    }
  });

  fastify.post('/client/:token/grant-meta-access', async (request, reply) => {
    const { token } = request.params as { token: string };

    const validated = grantMetaAccessSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid request data', 400, validated.error.errors,);
    }

    const {
      connectionId,
      businessId: requestedBusinessId,
      assetTypes,
    } = validated.data;

    try {
      const authContext = await resolveAuthorizedConnection(token, connectionId);
      if (authContext.error || !authContext.connection || !authContext.accessRequest) {
        const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
        return reply.code(statusCode).send({
          data: null,
          error: authContext.error,
        });
      }
      const connection = authContext.connection;
      const accessRequest = authContext.accessRequest;

      const platformAuth = await prisma.platformAuthorization.findUnique({
        where: {
          connectionId_platform: {
            connectionId,
            platform: 'meta',
          },
        },
      });

      if (!platformAuth) {
        return sendError(reply, 'AUTHORIZATION_NOT_FOUND', 'Meta authorization not found', 404);
      }

      if (platformAuth.status !== 'active') {
        return sendError(reply, 'REAUTHORIZATION_REQUIRED', 'Meta authorization is inactive. Reconnect before granting access.', 403);
      }

      const requestedAssetTypes = new Set(assetTypes || ['page', 'ad_account', 'instagram_account']);
      const { rootMetadata, metaMetadata } = readMetaAuthorizationMetadata(platformAuth.metadata);
      const selectedMetaAssets = getSelectedMetaAssets(rootMetadata.selectedAssets);
      const selectedPageIds = requestedAssetTypes.has('page')
        ? normalizeStringIds(selectedMetaAssets.pages)
        : [];
      const selectedAdAccountIds = requestedAssetTypes.has('ad_account')
        ? normalizeStringIds(
            selectedMetaAssets.adAccounts ??
              selectedMetaAssets.selectedAdvertiserIds ??
              selectedMetaAssets.advertisers
          )
        : [];
      const selectedInstagramIds = requestedAssetTypes.has('instagram_account')
        ? normalizeStringIds(selectedMetaAssets.instagramAccounts)
        : [];
      const selectedCatalogIds = requestedAssetTypes.has('catalog')
        ? normalizeStringIds(selectedMetaAssets.catalogs)
        : [];
      const selectedDatasetIds = requestedAssetTypes.has('dataset')
        ? normalizeStringIds(selectedMetaAssets.datasets)
        : [];

      if (
        selectedPageIds.length === 0 &&
        selectedAdAccountIds.length === 0 &&
        selectedInstagramIds.length === 0
        && selectedCatalogIds.length === 0
        && selectedDatasetIds.length === 0
      ) {
        return sendError(reply, 'NO_SELECTED_ASSETS', 'No Meta assets have been selected for grant automation', 400);
      }

      const selectedBusinessId = metaMetadata.selection?.clientBusinessId;
      const selectedBusinessName = metaMetadata.selection?.clientBusinessName;

      if (!selectedBusinessId) {
        return sendError(reply, 'META_BUSINESS_SELECTION_REQUIRED', 'Client must select a Meta Business Portfolio before grants can run', 400);
      }
      if (requestedBusinessId && requestedBusinessId !== selectedBusinessId) {
        return sendError(reply, 'META_BUSINESS_SELECTION_MISMATCH', 'Requested Business Portfolio does not match the client selection', 409);
      }

      const agencyConnection = await prisma.agencyPlatformConnection.findUnique({
        where: {
          agencyId_platform: {
            agencyId: accessRequest.agencyId,
            platform: 'meta',
          },
        },
      });

      if (!agencyConnection) {
        return sendError(reply, 'AGENCY_BUSINESS_ID_MISSING', 'Agency must set up their Meta Business Manager ID before clients can grant access', 400);
      }

      if (agencyConnection.status !== 'active') {
        return sendError(reply, 'AGENCY_META_RECONNECT_REQUIRED', 'Agency Meta connection is inactive. Reconnect before granting access.', 409);
      }

      const agencyMetadata = (agencyConnection.metadata as Record<string, unknown> | null) || {};
      const partnerBusinessId =
        agencyConnection.businessId ||
        (typeof agencyMetadata.selectedBusinessId === 'string'
          ? agencyMetadata.selectedBusinessId
          : null);

      if (!partnerBusinessId) {
        return sendError(reply, 'AGENCY_BUSINESS_ID_MISSING', 'Agency must set up their Meta Business Manager ID before clients can grant access', 400);
      }

      const parsedAccessConfig = MetaAccessConfigSchema.safeParse(
        (accessRequest as any).metaAccessConfig
      );
      if (!parsedAccessConfig.success || parsedAccessConfig.data.recipients.length === 0) {
        return sendError(reply, 'META_ASSIGNEE_SELECTION_REQUIRED', 'Agency must choose at least one Meta person or system user before grants can run', 409);
      }
      const accessConfig = parsedAccessConfig.data;
      const defaults = getDefaultMetaAccessTasks(
        (accessRequest.platforms || []).map((item: { platform: string }) => item.platform)
      );
      const pageTasks = accessConfig.pageTasks.length > 0 ? accessConfig.pageTasks : defaults.pageTasks;
      const adAccountTasks = accessConfig.adAccountTasks.length > 0 ? accessConfig.adAccountTasks : defaults.adAccountTasks;
      const catalogTasks = accessConfig.catalogTasks;
      const datasetTasks = accessConfig.datasetTasks?.length ? accessConfig.datasetTasks : defaults.datasetTasks;
      const datasetPartnerTasks = datasetTasks.filter((task) => task !== 'AA_ANALYZE');
      if ((selectedPageIds.length > 0 && pageTasks.length === 0) ||
          (selectedAdAccountIds.length > 0 && adAccountTasks.length === 0)) {
        return sendError(reply, 'META_TASKS_REQUIRED', 'Select a Meta product that matches these assets, or choose explicit access tasks', 409);
      }
      const availableRecipients = await metaAssetsService.getAssignableRecipients(
        accessRequest.agencyId,
        request,
        undefined,
        'access_request_holder',
        accessRequest.id
      );
      if (availableRecipients.error || !availableRecipients.data) {
        return reply.code(502).send({ data: null, error: availableRecipients.error });
      }
      const allowedRecipients = new Set(
        availableRecipients.data.map((recipient) => `${recipient.type}:${recipient.id}`)
      );
      const invalidRecipient = accessConfig.recipients.find(
        (recipient) => !allowedRecipients.has(`${recipient.type}:${recipient.id}`)
      );
      if (invalidRecipient) {
        return sendError(reply, 'INVALID_META_ASSIGNEE', 'A selected Meta assignee no longer belongs to the agency Business Portfolio', 403);
      }

      const clientAccessTokenResult = await metaOBOService.getClientAccessTokenForOBO({
        authorizationId: platformAuth.id,
        connectionId,
        agencyId: accessRequest.agencyId,
        userEmail: connection.clientEmail,
        ipAddress: request.ip,
        purpose: 'meta_asset_grant',
        authorization: platformAuth,
      });

      if (clientAccessTokenResult.error || !clientAccessTokenResult.data) {
        return reply.code(500).send({
          data: null,
          error: clientAccessTokenResult.error || {
            code: 'TOKEN_READ_FAILED',
            message: 'Failed to read client Meta token',
          },
        });
      }

      const clientAccessToken = clientAccessTokenResult.data.accessToken;
      const grantScopeResult = await scopedMetaAssetSelection(clientAccessToken, selectedBusinessId, {
        page: selectedPageIds,
        ad_account: selectedAdAccountIds,
        instagram_account: selectedInstagramIds,
        catalog: selectedCatalogIds,
        dataset: selectedDatasetIds,
      });
      if ('error' in grantScopeResult) {
        return sendError(reply, grantScopeResult.error.code, grantScopeResult.error.message, grantScopeResult.error.statusCode);
      }
      const managedBusinessLinkResult = await metaOBOService.ensureManagedBusinessRelationship({
        authorizationId: platformAuth.id,
        connectionId,
        agencyId: accessRequest.agencyId,
        userEmail: connection.clientEmail,
        ipAddress: request.ip,
        partnerBusinessId,
        clientBusinessId: selectedBusinessId,
        clientBusinessAdminAccessToken: clientAccessToken,
      });

      if (managedBusinessLinkResult.error || !managedBusinessLinkResult.data) {
        return reply.code(400).send({
          data: null,
          error: managedBusinessLinkResult.error || {
            code: 'META_OBO_LINK_FAILED',
            message: 'Failed to establish the Meta OBO relationship',
          },
        });
      }

      const grantContext = {
        accessRequestId: accessRequest.id,
        connectionId,
        authorizationId: platformAuth.id,
        authorizationEpoch: platformAuth.authorizationEpoch || 1,
        clientBusinessId: selectedBusinessId,
        destination: {
          agencyId: accessRequest.agencyId,
          agencyConnectionId: agencyConnection.id,
          businessId: partnerBusinessId,
          name:
            typeof agencyMetadata.selectedBusinessName === 'string'
              ? agencyMetadata.selectedBusinessName
              : null,
        },
      };
      const grantRequirements = [
        ...selectedPageIds.map((assetId) => ({ assetId, assetKind: 'page' as const, requestedTasks: pageTasks })),
        ...selectedAdAccountIds.map((assetId) => ({ assetId, assetKind: 'ad_account' as const, requestedTasks: adAccountTasks })),
        ...selectedInstagramIds.map((assetId) => ({ assetId, assetKind: 'instagram_account' as const, requestedTasks: [] })),
        ...selectedCatalogIds.map((assetId) => ({ assetId, assetKind: 'catalog' as const, requestedTasks: catalogTasks })),
        ...selectedDatasetIds.map((assetId) => ({ assetId, assetKind: 'dataset' as const, requestedTasks: datasetTasks })),
      ];
      const currentRecipientGrantResults: MetaAssetGrantResult[] = [];
      let skippedExcludedGrant = false;

      for (const recipient of accessConfig.recipients) {
        const recipientRecord = { type: recipient.type, id: recipient.id, grantMethod: 'assigned_users' };
        const attemptVersions = await metaAssetGrantService.claimAttempts({
          ...grantContext,
          requirements: grantRequirements,
          recipient: recipientRecord,
        });
        skippedExcludedGrant ||= [...attemptVersions.values()].includes(0);
        const shouldRetry = (kind: string, id: string) => attemptVersions.get(`${kind}:${id}`) !== 0;
        const grantAsset = async (
          assetId: string,
          assetType: 'page' | 'ad_account' | 'catalog',
          requestedTasks: string[]
        ): Promise<MetaAssetGrantResult> => {
          const verifyAccess = () => assetType === 'page'
            ? metaPartnerService.verifyPageAccess(clientAccessToken, assetId, recipient.id, requestedTasks)
            : assetType === 'ad_account'
              ? metaPartnerService.verifyAdAccountAccess(clientAccessToken, assetId, recipient.id, requestedTasks)
              : metaPartnerService.verifyCatalogAccess(clientAccessToken, assetId, recipient.id, requestedTasks);
          const attemptVersion = attemptVersions.get(`${assetType}:${assetId}`);
          const grantedAt = new Date().toISOString();
          try {
            if (attemptVersion !== undefined && attemptVersion > 1) {
              let priorAttempt: Awaited<ReturnType<typeof verifyAccess>>;
              try {
                priorAttempt = await verifyAccess();
              } catch {
                return {
                  assetId,
                  assetType,
                  recipientType: recipient.type,
                  recipientId: recipient.id,
                  requestedTasks,
                  status: 'failed',
                  errorCode: 'META_PREVIOUS_ASSIGNMENT_UNVERIFIED',
                  errorMessage: 'Meta could not confirm the previous assignment. Retry access verification before another assignment is attempted.',
                };
              }
              if (priorAttempt.verified) {
                return {
                  assetId,
                  assetType,
                  recipientType: recipient.type,
                  recipientId: recipient.id,
                  requestedTasks,
                  verifiedTasks: priorAttempt.assignedTasks,
                  status: 'verified',
                  verifiedAt: new Date().toISOString(),
                };
              }
            }

            if (assetType === 'page') {
              await metaPartnerService.grantPageAccess(clientAccessToken, assetId, recipient.id, requestedTasks);
            } else if (assetType === 'ad_account') {
              await metaPartnerService.grantAdAccountAccess(clientAccessToken, assetId, recipient.id, requestedTasks);
            } else {
              await metaPartnerService.grantCatalogAccess(clientAccessToken, assetId, recipient.id, requestedTasks);
            }
            const verification = await verifyAccess();
            return {
              assetId,
              assetType,
              recipientType: recipient.type,
              recipientId: recipient.id,
              requestedTasks,
              verifiedTasks: verification.assignedTasks,
              status: verification.verified ? 'verified' : 'failed',
              grantedAt,
              ...(verification.verified
                ? { verifiedAt: new Date().toISOString() }
                : {
                    errorCode: 'META_ASSET_VERIFICATION_FAILED',
                    errorMessage: 'Meta returned fewer tasks than this request requires',
                  }),
            };
          } catch (error) {
            return {
              assetId,
              assetType,
              recipientType: recipient.type,
              recipientId: recipient.id,
              requestedTasks,
              status: 'failed',
              grantedAt,
              errorCode: 'META_ASSET_GRANT_FAILED',
              errorMessage: error instanceof Error ? error.message : 'Unknown Meta grant error',
            };
          }
        };

        const recipientResults = [
          ...await mapInChunks(selectedPageIds.filter((id) => shouldRetry('page', id)), (pageId) => grantAsset(pageId, 'page', pageTasks)),
          ...await mapInChunks(selectedAdAccountIds.filter((id) => shouldRetry('ad_account', id)), (adAccountId) => grantAsset(adAccountId, 'ad_account', adAccountTasks)),
          ...await mapInChunks(selectedCatalogIds.filter((id) => shouldRetry('catalog', id)), (catalogId) => grantAsset(catalogId, 'catalog', catalogTasks)),
          ...selectedInstagramIds.filter((id) => shouldRetry('instagram_account', id)).map((assetId): MetaAssetGrantResult => ({
            assetId,
            assetType: 'instagram_account',
            recipientType: recipient.type,
            recipientId: recipient.id,
            requestedTasks: [],
            status: 'unresolved',
            errorCode: 'UNSUPPORTED_META_ASSET_TYPE',
            errorMessage: META_UNSUPPORTED_INSTAGRAM_MESSAGE,
          })),
          ...selectedDatasetIds.filter((id) => shouldRetry('dataset', id)).map((assetId): MetaAssetGrantResult => ({
            assetId,
            assetType: 'dataset',
            recipientType: recipient.type,
            recipientId: recipient.id,
            requestedTasks: datasetTasks,
            status: 'unresolved',
            errorCode: 'MANUAL_SHARE_PENDING',
            errorMessage: 'Assign this Pixel or Dataset in Meta Business Settings. AuthHub has not verified recipient access.',
          })),
        ];
        currentRecipientGrantResults.push(...recipientResults);

        await metaAssetGrantService.recordOutcomes({
          ...grantContext,
          recipient: recipientRecord,
          results: recipientResults,
          attemptVersions,
        });
      }

      const businessRecipient = { type: 'business' as const, id: partnerBusinessId, grantMethod: 'manual_business_share' };
      const businessGrantRequirements = grantRequirements
        .filter((item) => item.assetKind !== 'catalog')
        .map((item) => ({ ...item, requestedTasks: [] }));
      const businessAttemptVersions = await metaAssetGrantService.claimAttempts({
        ...grantContext,
        requirements: businessGrantRequirements,
        recipient: businessRecipient,
      });
      skippedExcludedGrant ||= [...businessAttemptVersions.values()].includes(0);
      const shouldVerifyBusiness = (kind: string, id: string) => businessAttemptVersions.get(`${kind}:${id}`) !== 0;
      const businessAssetsNeedVerification = businessGrantRequirements.some((item) =>
        shouldVerifyBusiness(item.assetKind, item.assetId)
      );
      const [agencyAssets, agencyInstagramAssets] = businessAssetsNeedVerification
        ? await Promise.all([
            metaAssetsService.getAssetsForBusiness(
              accessRequest.agencyId, partnerBusinessId, request, 'access_request_holder', accessRequest.id,
              accessRequest.clientEmail
            ),
            selectedInstagramIds.length > 0
              ? metaAssetsService.getClientInstagramAssetsForBusiness(
                  accessRequest.agencyId, partnerBusinessId, request, accessRequest.id, accessRequest.clientEmail
                )
              : Promise.resolve(null),
          ])
        : [null, null];
      const visiblePageIds = new Set((agencyAssets?.data?.pages || []).map((asset) => String(asset.id)));
      const visibleAdAccountIds = new Set((agencyAssets?.data?.adAccounts || [])
        .filter((asset) => asset.sharedWithBusiness === true)
        .map((asset) => String(asset.id)));
      const visibleInstagramIds = new Set((agencyInstagramAssets?.data || []).map((asset) => String(asset.id)));
      const businessVerificationError = agencyAssets?.error?.message ||
        (managedBusinessLinkResult.data.status === 'manual_action_required'
          ? managedBusinessLinkResult.data.nextAction
          : 'Share this asset with the agency Business Portfolio, then verify again');
      const businessResults: MetaAssetGrantResult[] = [
        ...selectedPageIds.filter((id) => shouldVerifyBusiness('page', id)).map((assetId): MetaAssetGrantResult => ({
          assetId,
          assetType: 'page',
          recipientType: 'business',
          recipientId: partnerBusinessId,
          requestedTasks: [],
          status: visiblePageIds.has(assetId) ? 'verified' : 'unresolved',
          ...(visiblePageIds.has(assetId)
            ? { verifiedAt: new Date().toISOString() }
            : { errorCode: 'MANUAL_SHARE_PENDING', errorMessage: businessVerificationError }),
        })),
        ...selectedAdAccountIds.filter((id) => shouldVerifyBusiness('ad_account', id)).map((assetId): MetaAssetGrantResult => ({
          assetId,
          assetType: 'ad_account',
          recipientType: 'business',
          recipientId: partnerBusinessId,
          requestedTasks: [],
          status: visibleAdAccountIds.has(assetId) ? 'verified' : 'unresolved',
          ...(visibleAdAccountIds.has(assetId)
            ? { verifiedAt: new Date().toISOString() }
            : { errorCode: 'MANUAL_SHARE_PENDING', errorMessage: businessVerificationError }),
        })),
        ...selectedInstagramIds.filter((id) => shouldVerifyBusiness('instagram_account', id)).map((assetId): MetaAssetGrantResult => ({
          assetId,
          assetType: 'instagram_account',
          recipientType: 'business',
          recipientId: partnerBusinessId,
          requestedTasks: [],
          status: visibleInstagramIds.has(assetId) ? 'verified' : 'unresolved',
          ...(visibleInstagramIds.has(assetId)
            ? { verifiedAt: new Date().toISOString() }
            : {
                errorCode: agencyInstagramAssets?.error
                  ? 'META_CLIENT_INSTAGRAM_ASSETS_FAILED'
                  : 'MANUAL_SHARE_PENDING',
                errorMessage: agencyInstagramAssets?.error?.message ||
                  'Share this Instagram asset with the agency Business Portfolio, then verify again',
          }),
        })),
        ...selectedDatasetIds.filter((id) => shouldVerifyBusiness('dataset', id)).map((assetId): MetaAssetGrantResult => ({
          assetId,
          assetType: 'dataset',
          recipientType: 'business',
          recipientId: partnerBusinessId,
          requestedTasks: datasetPartnerTasks,
          status: 'unresolved',
          errorCode: 'MANUAL_SHARE_PENDING',
          errorMessage: 'Assign this Pixel or Dataset to the agency in Meta Business Settings. AuthHub has not verified partner access.',
        })),
      ];
      currentRecipientGrantResults.push(...businessResults);
      await metaAssetGrantService.recordOutcomes({
        ...grantContext,
        recipient: businessRecipient,
        results: businessResults,
        attemptVersions: businessAttemptVersions,
      });

      const catalogBusinessRecipient = {
        type: 'business' as const,
        id: partnerBusinessId,
        grantMethod: 'catalog_agencies',
      };
      const catalogBusinessRequirements = selectedCatalogIds.map((assetId) => ({
        assetId,
        assetKind: 'catalog' as const,
        requestedTasks: catalogTasks,
      }));
      const catalogBusinessAttempts = await metaAssetGrantService.claimAttempts({
        ...grantContext,
        requirements: catalogBusinessRequirements,
        recipient: catalogBusinessRecipient,
      });
      skippedExcludedGrant ||= [...catalogBusinessAttempts.values()].includes(0);
      const catalogBusinessResults = await mapInChunks(
        selectedCatalogIds.filter((id) => catalogBusinessAttempts.get(`catalog:${id}`) !== 0),
        async (catalogId): Promise<MetaAssetGrantResult> => {
          try {
            if ((catalogBusinessAttempts.get(`catalog:${catalogId}`) ?? 0) > 1) {
              let priorGrantVerified: boolean;
              try {
                priorGrantVerified = await metaPartnerService.verifyCatalogAgencyAccess(
                  clientAccessToken,
                  catalogId,
                  partnerBusinessId,
                  catalogTasks,
                );
              } catch {
                return {
                  assetId: catalogId,
                  assetType: 'catalog',
                  recipientType: 'business',
                  recipientId: partnerBusinessId,
                  requestedTasks: catalogTasks,
                  status: 'failed',
                  errorCode: 'META_PREVIOUS_ASSIGNMENT_UNVERIFIED',
                  errorMessage: 'Meta could not confirm the previous catalog assignment. Retry verification before another assignment is attempted.',
                };
              }
              if (priorGrantVerified) {
                return {
                  assetId: catalogId,
                  assetType: 'catalog',
                  recipientType: 'business',
                  recipientId: partnerBusinessId,
                  requestedTasks: catalogTasks,
                  verifiedTasks: catalogTasks,
                  status: 'verified',
                  verifiedAt: new Date().toISOString(),
                };
              }
            }

            await metaPartnerService.grantCatalogAgencyAccess(
              clientAccessToken,
              catalogId,
              partnerBusinessId,
              catalogTasks,
            );
            const verified = await metaPartnerService.verifyCatalogAgencyAccess(
              clientAccessToken,
              catalogId,
              partnerBusinessId,
              catalogTasks,
            );
            return {
              assetId: catalogId,
              assetType: 'catalog',
              recipientType: 'business',
              recipientId: partnerBusinessId,
              requestedTasks: catalogTasks,
              verifiedTasks: verified ? catalogTasks : [],
              status: verified ? 'verified' : 'failed',
              grantedAt: new Date().toISOString(),
              ...(verified
                ? { verifiedAt: new Date().toISOString() }
                : { errorCode: 'META_ASSET_VERIFICATION_FAILED', errorMessage: 'Meta did not confirm catalog agency access and requested tasks' }),
            };
          } catch (error) {
            return {
              assetId: catalogId,
              assetType: 'catalog',
              recipientType: 'business',
              recipientId: partnerBusinessId,
              requestedTasks: catalogTasks,
              status: 'failed',
              errorCode: 'META_ASSET_GRANT_FAILED',
              errorMessage: error instanceof Error ? error.message : 'Unknown Meta catalog grant error',
            };
          }
        },
      );
      currentRecipientGrantResults.push(...catalogBusinessResults);
      await metaAssetGrantService.recordOutcomes({
        ...grantContext,
        recipient: catalogBusinessRecipient,
        results: catalogBusinessResults,
        attemptVersions: catalogBusinessAttempts,
      });

      const requestedGrantResultsByType: Array<[MetaAssetKind, MetaAssetGrantResult[]]> = [
        ['page', currentRecipientGrantResults.filter((result) => result.assetType === 'page')],
        ['ad_account', currentRecipientGrantResults.filter((result) => result.assetType === 'ad_account')],
        ['instagram_account', currentRecipientGrantResults.filter((result) => result.assetType === 'instagram_account')],
        ['catalog', currentRecipientGrantResults.filter((result) => result.assetType === 'catalog')],
        ['dataset', currentRecipientGrantResults.filter((result) => result.assetType === 'dataset')],
      ];
      const mergedAssetGrantResults = sortMetaAssetGrantResults(
        requestedGrantResultsByType.reduce(
          (acc, [assetType, nextResults]) =>
          requestedAssetTypes.has(assetType)
            ? mergeMetaAssetGrantResults(acc, nextResults, assetType)
            : acc,
          metaMetadata.obo?.assetGrantResults || []
        )
      );
      const verificationStatus = skippedExcludedGrant
        ? 'partial'
        : buildMetaGrantVerificationStatus(mergedAssetGrantResults);
      const verificationCompletedAt = new Date().toISOString();
      await prisma.platformAuthorization.update({
        where: { id: platformAuth.id },
        data: {
          metadata: {
            ...rootMetadata,
            meta: {
              ...metaMetadata,
              obo: {
                ...(metaMetadata.obo || {}),
                managedBusinessLink: managedBusinessLinkResult.data,
                assetGrantResults: mergedAssetGrantResults,
                lastVerifiedAt: verificationCompletedAt,
              },
            },
          },
        },
      });

      const currentGrantedAssets = (connection.grantedAssets as Record<string, unknown> | null) || {};
      const currentMetaGrantedAssets =
        (currentGrantedAssets.meta as Record<string, unknown> | undefined) || {};
      const pageResults = mergedAssetGrantResults.filter((result) => result.assetType === 'page');
      const adAccountResults = mergedAssetGrantResults.filter(
        (result) => result.assetType === 'ad_account'
      );
      const pagesAccessGranted = !skippedExcludedGrant &&
        pageResults.length > 0 && pageResults.every((result) => result.status === 'verified');
      const adAccountsAccessGranted = !skippedExcludedGrant &&
        adAccountResults.length > 0 && adAccountResults.every((result) => result.status === 'verified');
      const pagesAccessGrantedAt =
        pagesAccessGranted
          ? requestedAssetTypes.has('page')
            ? verificationCompletedAt
            : typeof currentMetaGrantedAssets.pagesAccessGrantedAt === 'string'
              ? currentMetaGrantedAssets.pagesAccessGrantedAt
              : verificationCompletedAt
          : undefined;
      const adAccountsAccessGrantedAt =
        adAccountsAccessGranted
          ? requestedAssetTypes.has('ad_account')
            ? verificationCompletedAt
            : typeof currentMetaGrantedAssets.adAccountsAccessGrantedAt === 'string'
              ? currentMetaGrantedAssets.adAccountsAccessGrantedAt
              : verificationCompletedAt
          : undefined;

      await prisma.clientConnection.update({
        where: { id: connectionId },
        data: {
          grantedAssets: {
            ...currentGrantedAssets,
            meta: {
              ...currentMetaGrantedAssets,
              verifiedMetaAssetGrantStatus: verificationStatus,
              verifiedMetaAssetGrantResults: mergedAssetGrantResults,
              verifiedMetaAssetGrantAt: verificationCompletedAt,
              pagesAccessGranted,
              pagesAccessGrantedAt,
              adAccountsAccessGranted,
              adAccountsAccessGrantedAt,
            },
          },
        },
      });

      await auditService.createAuditLog({
        agencyId: accessRequest.agencyId,
        action: 'META_ASSET_ACCESS_VERIFIED',
        userEmail: connection.clientEmail,
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: {
          selectedBusinessId,
          requestedAssetTypes: Array.from(requestedAssetTypes),
          verificationStatus,
          assetGrantResults: mergedAssetGrantResults,
        },
        request,
      });

      return reply.send({
        data: {
          success: verificationStatus === 'verified',
          partial: verificationStatus === 'partial',
          selectedBusinessId,
          selectedBusinessName,
          managedBusinessLinkStatus: managedBusinessLinkResult.data.status,
          assetGrantResults: mergedAssetGrantResults,
        },
        error: null,
      });
    } catch (error) {
      if (error instanceof MetaGrantAttemptSupersededError) {
        return sendError(reply, 'META_GRANT_ATTEMPT_SUPERSEDED', error.message, 409);
      }
      return sendError(reply, 'META_GRANT_ACCESS_ERROR', error instanceof Error ? error.message : 'Failed to grant Meta asset access through OBO', 500);
    }
  });

  fastify.post('/client/:token/meta/manual-ad-account-share/start', async (request, reply) => {
    const { token } = request.params as { token: string };

    const validated = manualMetaAdAccountShareSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid request data', 400, validated.error.errors,);
    }

    const { connectionId } = validated.data;

    try {
      const authContext = await resolveAuthorizedConnection(token, connectionId);
      if (!authContext.error && authContext.connection && authContext.accessRequest) {
        const connection = authContext.connection;
        const accessRequest = authContext.accessRequest;

        const platformAuth = await prisma.platformAuthorization.findUnique({
          where: {
            connectionId_platform: {
              connectionId,
              platform: 'meta',
            },
          },
        });

        if (!platformAuth) {
          return sendError(reply, 'AUTHORIZATION_NOT_FOUND', 'Meta authorization not found', 404);
        }

        if (platformAuth.status !== 'active') {
          return sendError(reply, 'REAUTHORIZATION_REQUIRED', 'Meta authorization is inactive. Reconnect before sharing access.', 403);
        }

        const { rootMetadata } = readMetaAuthorizationMetadata(platformAuth.metadata);
        const selectedMetaAssets = getSelectedMetaAssets(rootMetadata.selectedAssets);
        const selectedAdAccounts = extractSelectedMetaAdAccounts(selectedMetaAssets);

        if (selectedAdAccounts.length === 0) {
          return sendError(reply, 'NO_SELECTED_AD_ACCOUNTS', 'No Meta ad accounts have been selected for manual sharing', 400);
        }

        const agencyConnection = await prisma.agencyPlatformConnection.findUnique({
          where: {
            agencyId_platform: {
              agencyId: accessRequest.agencyId,
              platform: 'meta',
            },
          },
        });

        if (agencyConnection && agencyConnection.status !== 'active') {
          return sendError(reply, 'AGENCY_META_RECONNECT_REQUIRED', 'Agency Meta connection is inactive. Reconnect before sharing access.', 409);
        }

        const { businessId: partnerBusinessId, businessName: partnerBusinessName } =
          resolveAgencyMetaBusinessDetails(agencyConnection);

        if (!partnerBusinessId) {
          return sendError(reply, 'AGENCY_BUSINESS_ID_MISSING', 'Agency must set up their Meta Business Manager ID before clients can share ad accounts', 400);
        }

        const startedAt = new Date().toISOString();
        const verificationResults: ManualMetaAdAccountVerificationResult[] = selectedAdAccounts.map(
          (account) => ({
            assetId: account.id,
            assetName: account.name,
            status: 'waiting_for_manual_share',
          })
        );
        const currentGrantedAssets = (connection.grantedAssets as Record<string, unknown> | null) || {};

        await prisma.clientConnection.update({
          where: { id: connectionId },
          data: {
            grantedAssets: {
              ...currentGrantedAssets,
              meta: {
                ...((currentGrantedAssets.meta as Record<string, unknown> | undefined) || {}),
                manualAdAccountShare: {
                  status: 'waiting_for_manual_share',
                  partnerBusinessId,
                  partnerBusinessName: partnerBusinessName || undefined,
                  selectedAdAccountIds: selectedAdAccounts.map((account) => account.id),
                  selectedAdAccounts,
                  startedAt,
                  verificationResults,
                },
              },
            },
          },
        });

        await auditService.createAuditLog({
          agencyId: accessRequest.agencyId,
          action: 'META_MANUAL_AD_ACCOUNT_SHARE_STARTED',
          userEmail: connection.clientEmail,
          resourceType: 'client_connection',
          resourceId: connectionId,
          metadata: {
            partnerBusinessId,
            partnerBusinessName: partnerBusinessName || undefined,
            selectedAdAccounts,
          },
          request,
        });

        return reply.send({
          data: {
            success: true,
            status: 'waiting_for_manual_share',
            partnerBusinessId,
            partnerBusinessName: partnerBusinessName || undefined,
            selectedAdAccounts,
            startedAt,
          },
          error: null,
        });
      }

      const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
      return reply.code(statusCode).send({
        data: null,
        error: authContext.error,
      });
    } catch (error) {
      return sendError(reply, 'META_MANUAL_SHARE_START_ERROR', error instanceof Error ? error.message : 'Failed to start manual Meta ad-account sharing', 500);
    }
  });

  fastify.post('/client/:token/meta/manual-ad-account-share/verify', async (request, reply) => {
    const { token } = request.params as { token: string };

    const validated = manualMetaAdAccountShareSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid request data', 400, validated.error.errors,);
    }

    const { connectionId } = validated.data;

    try {
      const authContext = await resolveAuthorizedConnection(token, connectionId);
      if (authContext.error || !authContext.connection || !authContext.accessRequest) {
        const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
        return reply.code(statusCode).send({
          data: null,
          error: authContext.error,
        });
      }
      const connection = authContext.connection;
      const accessRequest = authContext.accessRequest;

      const platformAuth = await prisma.platformAuthorization.findUnique({
        where: {
          connectionId_platform: {
            connectionId,
            platform: 'meta',
          },
        },
      });

      if (!platformAuth) {
        return sendError(reply, 'AUTHORIZATION_NOT_FOUND', 'Meta authorization not found', 404);
      }

      if (platformAuth.status !== 'active') {
        return sendError(reply, 'REAUTHORIZATION_REQUIRED', 'Meta authorization is inactive. Reconnect before verifying access.', 403);
      }

      const agencyConnection = await prisma.agencyPlatformConnection.findUnique({
        where: {
          agencyId_platform: {
            agencyId: accessRequest.agencyId,
            platform: 'meta',
          },
        },
      });

      if (agencyConnection && agencyConnection.status !== 'active') {
        return sendError(reply, 'AGENCY_META_RECONNECT_REQUIRED', 'Agency Meta connection is inactive. Reconnect before verifying access.', 409);
      }

      const { businessId: partnerBusinessId, businessName: resolvedPartnerBusinessName } =
        resolveAgencyMetaBusinessDetails(agencyConnection);

      if (!partnerBusinessId || !agencyConnection) {
        return sendError(reply, 'AGENCY_BUSINESS_ID_MISSING', 'Agency must set up their Meta Business Manager ID before manual ad-account sharing can be verified', 400);
      }

      const { rootMetadata, metaMetadata } = readMetaAuthorizationMetadata(platformAuth.metadata);
      const clientBusinessId = metaMetadata.selection?.clientBusinessId;
      if (!clientBusinessId) {
        return sendError(reply, 'META_BUSINESS_SELECTION_REQUIRED', 'Client must select a Meta Business Portfolio before manual sharing can be verified', 400);
      }
      const selectedMetaAssets = getSelectedMetaAssets(rootMetadata.selectedAssets);
      const selectedAdAccounts = extractSelectedMetaAdAccounts(selectedMetaAssets);

      if (selectedAdAccounts.length === 0) {
        return sendError(reply, 'NO_SELECTED_AD_ACCOUNTS', 'No Meta ad accounts have been selected for manual sharing', 400);
      }
      const defaults = getDefaultMetaAccessTasks(
        (accessRequest.platforms || []).map((item: { platform: string }) => item.platform)
      );
      const parsedMetaConfig = MetaAccessConfigSchema.safeParse(accessRequest.metaAccessConfig);
      const requestedAdAccountTasks = parsedMetaConfig.success && parsedMetaConfig.data.adAccountTasks.length > 0
        ? parsedMetaConfig.data.adAccountTasks
        : defaults.adAccountTasks;
      if (requestedAdAccountTasks.length === 0) {
        return sendError(reply, 'META_TASKS_REQUIRED', 'Choose the Meta Ads product and access tasks before verifying ad-account sharing', 409);
      }

      const currentGrantedAssets = (connection.grantedAssets as Record<string, unknown> | null) || {};
      const currentMetaGrantedAssets =
        (currentGrantedAssets.meta as Record<string, unknown> | undefined) || {};
      const existingManualShare =
        (currentMetaGrantedAssets.manualAdAccountShare as Record<string, unknown> | undefined) || {};
      const partnerBusinessName =
        (typeof existingManualShare.partnerBusinessName === 'string'
          ? existingManualShare.partnerBusinessName
          : null) || resolvedPartnerBusinessName;
      const grantContext = {
        accessRequestId: accessRequest.id,
        connectionId,
        authorizationId: platformAuth.id,
        authorizationEpoch: platformAuth.authorizationEpoch || 1,
        clientBusinessId,
        destination: {
          agencyId: accessRequest.agencyId,
          agencyConnectionId: agencyConnection.id,
          businessId: partnerBusinessId,
          name: partnerBusinessName,
        },
      };
      const businessRecipient = {
        type: 'business' as const,
        id: partnerBusinessId,
        grantMethod: 'manual_business_share',
      };

      const audit = await auditService.createAuditLog({
        agencyId: accessRequest.agencyId,
        action: 'META_TOKEN_READ',
        userEmail: connection.clientEmail,
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: {
          platform: 'meta',
          source: 'manual_ad_account_share_verification',
          partnerBusinessId,
        },
        request,
      });
      if (audit?.error) {
        return sendError(reply, 'AUDIT_LOG_FAILED', 'Could not record Meta access before reading its token', 500);
      }

      const clientTokens = await infisical.getOAuthTokens(platformAuth.secretId);
      let scopedClientAssets;
      try {
        scopedClientAssets = await clientAssetsService.fetchMetaAssets(
          clientTokens.accessToken,
          clientBusinessId,
          ['ad_account']
        );
      } catch {
        return sendError(reply, 'META_ASSET_DISCOVERY_FAILED', 'Could not confirm selected ad accounts belong to the selected client Business Portfolio.', 502);
      }
      const selectionError = validateMetaAssetSelection(
        clientBusinessId,
        scopedClientAssets,
        { ad_account: selectedAdAccounts.map((account) => account.id) }
      );
      if (selectionError) {
        return sendError(reply, selectionError.code, selectionError.message, selectionError.statusCode);
      }

      const attemptVersions = await metaAssetGrantService.claimAttempts({
        ...grantContext,
        recipient: businessRecipient,
        requirements: selectedAdAccounts.map((account) => ({
          assetId: account.id,
          assetKind: 'ad_account' as const,
          assetName: account.name,
          requestedTasks: requestedAdAccountTasks,
        })),
      });
      const retryableAdAccounts = selectedAdAccounts.filter(
        (account) => attemptVersions.get(`ad_account:${account.id}`) !== 0
      );
      const skippedExcludedGrant = retryableAdAccounts.length !== selectedAdAccounts.length;
      const verifiedAt = new Date().toISOString();
      const verificationResults: ManualMetaAdAccountVerificationResult[] = await mapInChunks(
        retryableAdAccounts,
        async (account) => {
          try {
            const access = await metaPartnerService.verifyAdAccountAgencyAccess(
              clientTokens.accessToken,
              account.id,
              partnerBusinessId,
              requestedAdAccountTasks
            );
            return {
              assetId: account.id,
              assetName: account.name,
              status: access.verified ? 'verified' : 'unresolved',
              ...(access.verified ? { verifiedAt } : {
                errorCode: 'MANUAL_SHARE_OR_TASKS_PENDING',
                errorMessage: `${META_MANUAL_AD_ACCOUNT_PENDING_MESSAGE}; Meta must report these tasks: ${requestedAdAccountTasks.join(', ')}.`,
              }),
              assignedTasks: access.assignedTasks,
            } satisfies ManualMetaAdAccountVerificationResult;
          } catch {
            return {
              assetId: account.id,
              assetName: account.name,
              status: 'failed',
              errorCode: 'META_ACCESS_CHECK_FAILED',
              errorMessage: 'Meta access could not be verified. Retry this check.',
            } satisfies ManualMetaAdAccountVerificationResult;
          }
        }
      );

      const adAccountGrantResults = toMetaAdAccountGrantResults(
        verificationResults,
        partnerBusinessId,
        requestedAdAccountTasks
      );
      const mergedGrantResults = sortMetaAssetGrantResults(
        mergeMetaAssetGrantResults(metaMetadata.obo?.assetGrantResults, adAccountGrantResults, 'ad_account')
      );
      const verificationStatus = skippedExcludedGrant
        ? 'partial'
        : buildMetaGrantVerificationStatus(mergedGrantResults);
      const verificationCompletedAt = new Date().toISOString();

      await metaAssetGrantService.recordOutcomes({
        ...grantContext,
        recipient: businessRecipient,
        results: adAccountGrantResults,
        attemptVersions,
      });
      const pageResults = mergedGrantResults.filter((result) => result.assetType === 'page');
      const mergedAdAccountResults = mergedGrantResults.filter(
        (result) => result.assetType === 'ad_account'
      );
      const pagesAccessGranted =
        pageResults.length > 0 && pageResults.every((result) => result.status === 'verified');
      const adAccountsAccessGranted = !skippedExcludedGrant &&
        mergedAdAccountResults.length > 0 &&
        mergedAdAccountResults.every((result) => result.status === 'verified');

      await prisma.platformAuthorization.update({
        where: { id: platformAuth.id },
        data: {
          metadata: {
            ...rootMetadata,
            meta: {
              ...metaMetadata,
              obo: {
                ...(metaMetadata.obo || {}),
                assetGrantResults: mergedGrantResults,
                lastVerifiedAt: verificationCompletedAt,
              },
            },
          } as any,
        },
      });

      await prisma.clientConnection.update({
        where: { id: connectionId },
        data: {
          grantedAssets: {
            ...currentGrantedAssets,
            meta: {
              ...currentMetaGrantedAssets,
              verifiedMetaAssetGrantStatus: verificationStatus,
              verifiedMetaAssetGrantResults: mergedGrantResults,
              verifiedMetaAssetGrantAt: verificationCompletedAt,
              pagesAccessGranted,
              pagesAccessGrantedAt: pagesAccessGranted ? verificationCompletedAt : undefined,
              adAccountsAccessGranted,
              adAccountsAccessGrantedAt: adAccountsAccessGranted
                ? verificationCompletedAt
                : undefined,
              manualAdAccountShare: {
                ...existingManualShare,
                status: verificationStatus,
                partnerBusinessId,
                partnerBusinessName: partnerBusinessName || undefined,
                selectedAdAccountIds: selectedAdAccounts.map((account) => account.id),
                selectedAdAccounts,
                verificationResults,
                lastVerifiedAt: verificationCompletedAt,
              },
            },
          },
        },
      });

      await auditService.createAuditLog({
        agencyId: accessRequest.agencyId,
        action: 'META_MANUAL_AD_ACCOUNT_SHARE_VERIFIED',
        userEmail: connection.clientEmail,
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: {
          partnerBusinessId,
          partnerBusinessName: partnerBusinessName || undefined,
          verificationStatus,
          verificationResults,
        },
        request,
      });

      return reply.send({
        data: {
          success: verificationStatus === 'verified',
          partial: verificationStatus === 'partial',
          status: verificationStatus,
          partnerBusinessId,
          partnerBusinessName: partnerBusinessName || undefined,
          verificationResults,
        },
        error: null,
      });
    } catch (error) {
      if (error instanceof MetaGrantAttemptSupersededError) {
        return sendError(reply, 'META_GRANT_ATTEMPT_SUPERSEDED', error.message, 409);
      }
      return sendError(reply, 'META_MANUAL_SHARE_VERIFY_ERROR', error instanceof Error ? error.message : 'Failed to verify manual Meta ad-account sharing', 500);
    }
  });

  // Get agency Business Manager ID for manual ad account sharing
  fastify.get('/client/:token/agency-business-id', async (request, reply) => {
    const { token } = request.params as { token: string };

    try {
      const accessRequest = await accessRequestService.getAccessRequestByToken(token);
      if (accessRequest.error || !accessRequest.data) {
        return sendError(reply, 'ACCESS_REQUEST_NOT_FOUND', 'Access request not found', 404);
      }

      const agencyConnection = await prisma.agencyPlatformConnection.findUnique({
        where: {
          agencyId_platform: {
            agencyId: accessRequest.data.agencyId,
            platform: 'meta',
          },
        },
      });

      if (!agencyConnection) {
        return sendError(reply, 'AGENCY_BUSINESS_ID_MISSING', 'Agency must set up their Meta Business Manager ID before clients can grant access', 404);
      }

      const metadata = (agencyConnection.metadata as any) || {};
      const businessId = agencyConnection.businessId || metadata.selectedBusinessId;
      const businessName = metadata.selectedBusinessName || metadata.businessName;

      if (!businessId) {
        return sendError(reply, 'AGENCY_BUSINESS_ID_MISSING', 'Agency must set up their Meta Business Manager ID before clients can grant access', 404);
      }

      return reply.send({
        data: {
          businessId: businessId,
          businessName: businessName || undefined,
        },
        error: null,
      });
    } catch (error) {
      return sendError(reply, 'FETCH_ERROR', `Failed to fetch agency Business Manager ID: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  });

  fastify.post('/client/:token/meta/datasets/verify', async (request, reply) => {
    const { token } = request.params as { token: string };
    const validated = manualMetaDatasetVerifySchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid Meta Dataset verification payload', 400, validated.error.errors);
    }

    const { connectionId } = validated.data;
    const datasetIds = normalizeStringIds(validated.data.datasetIds);
    try {
      const authContext = await resolveAuthorizedConnection(token, connectionId);
      if (authContext.error || !authContext.connection || !authContext.accessRequest) {
        const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
        return reply.code(statusCode).send({ data: null, error: authContext.error });
      }
      const { connection, accessRequest } = authContext;
      const platformAuth = await prisma.platformAuthorization.findUnique({
        where: { connectionId_platform: { connectionId, platform: 'meta' } },
      });
      if (!platformAuth) return sendError(reply, 'AUTHORIZATION_NOT_FOUND', 'Meta authorization not found', 404);
      if (platformAuth.status !== 'active') {
        return sendError(reply, 'REAUTHORIZATION_REQUIRED', 'Meta authorization is inactive. Reconnect before verifying Dataset access.', 403);
      }

      const agencyConnection = await prisma.agencyPlatformConnection.findUnique({
        where: { agencyId_platform: { agencyId: accessRequest.agencyId, platform: 'meta' } },
      });
      if (!agencyConnection || agencyConnection.status !== 'active') {
        return sendError(reply, 'AGENCY_META_RECONNECT_REQUIRED', 'Agency Meta connection is inactive. Reconnect before verifying Dataset access.', 409);
      }
      const { businessId: partnerBusinessId, businessName } = resolveAgencyMetaBusinessDetails(agencyConnection);
      if (!partnerBusinessId) {
        return sendError(reply, 'AGENCY_BUSINESS_ID_MISSING', 'Agency must set up its Meta Business Portfolio before Dataset access can be verified.', 400);
      }

      const { rootMetadata, metaMetadata } = readMetaAuthorizationMetadata(platformAuth.metadata);
      const clientBusinessId = metaMetadata.selection?.clientBusinessId;
      if (!clientBusinessId) return sendError(reply, 'META_BUSINESS_SELECTION_REQUIRED', 'Select the client Business Portfolio before verifying Dataset access.', 400);
      if (datasetIds.length === 0) return sendError(reply, 'NO_SELECTED_DATASETS', 'No Pixels or Datasets are selected for verification.', 400);

      const parsedConfig = MetaAccessConfigSchema.safeParse(accessRequest.metaAccessConfig);
      if (!parsedConfig.success || parsedConfig.data.recipients.length === 0) {
        return sendError(reply, 'META_ASSIGNEE_SELECTION_REQUIRED', 'Choose at least one Meta recipient before verifying Dataset access.', 409);
      }
      const defaults = getDefaultMetaAccessTasks((accessRequest.platforms || []).map((item: { platform: string }) => item.platform));
      const requestedTasks = parsedConfig.data.datasetTasks?.length ? parsedConfig.data.datasetTasks : defaults.datasetTasks;
      if (requestedTasks.length === 0) return sendError(reply, 'META_TASKS_REQUIRED', 'Choose Dataset tasks before verifying access.', 409);
      const partnerTasks = requestedTasks.filter((task) => task !== 'AA_ANALYZE');

      const availableRecipients = await metaAssetsService.getAssignableRecipients(
        accessRequest.agencyId, request, undefined, 'access_request_holder', accessRequest.id
      );
      if (availableRecipients.error || !availableRecipients.data) {
        return reply.code(502).send({ data: null, error: availableRecipients.error });
      }
      const allowedRecipients = new Set(availableRecipients.data.map((recipient) => `${recipient.type}:${recipient.id}`));
      if (parsedConfig.data.recipients.some((recipient) => !allowedRecipients.has(`${recipient.type}:${recipient.id}`))) {
        return sendError(reply, 'INVALID_META_ASSIGNEE', 'A selected Meta recipient no longer belongs to the agency Business Portfolio.', 403);
      }

      const audit = await auditService.createAuditLog({
        agencyId: accessRequest.agencyId,
        action: 'META_TOKEN_READ',
        userEmail: connection.clientEmail,
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: { platform: 'meta', source: 'manual_dataset_access_verification', selectedBusinessId: clientBusinessId },
        request,
      });
      if (audit?.error) return sendError(reply, 'AUDIT_LOG_FAILED', 'Could not record Meta access before reading its token.', 500);

      const clientTokenResult = await metaOBOService.getClientAccessTokenForOBO({
        authorizationId: platformAuth.id,
        connectionId,
        agencyId: accessRequest.agencyId,
        userEmail: connection.clientEmail,
        ipAddress: request.ip,
        purpose: 'meta_asset_grant',
        authorization: platformAuth,
      });
      if (clientTokenResult.error || !clientTokenResult.data) {
        return reply.code(500).send({ data: null, error: clientTokenResult.error || { code: 'TOKEN_READ_FAILED', message: 'Failed to read Meta authorization.' } });
      }

      let scopedClientAssets;
      try {
        scopedClientAssets = await clientAssetsService.fetchMetaAssets(
          clientTokenResult.data.accessToken,
          clientBusinessId,
          ['dataset']
        );
      } catch {
        return sendError(reply, 'META_ASSET_DISCOVERY_FAILED', 'Could not confirm selected Dataset belongs to the selected client Business Portfolio.', 502);
      }
      const selectionError = validateMetaAssetSelection(clientBusinessId, scopedClientAssets, { dataset: datasetIds });
      if (selectionError) return sendError(reply, selectionError.code, selectionError.message, selectionError.statusCode);

      const grantContext = {
        accessRequestId: accessRequest.id,
        connectionId,
        authorizationId: platformAuth.id,
        authorizationEpoch: platformAuth.authorizationEpoch || 1,
        clientBusinessId,
        destination: {
          agencyId: accessRequest.agencyId,
          agencyConnectionId: agencyConnection.id,
          businessId: partnerBusinessId,
          name: businessName,
        },
      };
      const results: MetaAssetGrantResult[] = [];
      const verify = async (
        datasetId: string,
        recipient: { type: 'business' | 'human' | 'system_user'; id: string; grantMethod: string },
        tasks: string[],
        verifyAccess: () => Promise<{ verified: boolean; assignedTasks: string[] }>
      ) => {
        const requirement = [{ assetId: datasetId, assetKind: 'dataset' as const, requestedTasks: tasks }];
        const attemptVersions = await metaAssetGrantService.claimAttempts({ ...grantContext, requirements: requirement, recipient });
        const attemptVersion = attemptVersions.get(`dataset:${datasetId}`);
        if (attemptVersion === 0) return;
        const grantedAt = new Date().toISOString();
        let result: MetaAssetGrantResult;
        try {
          const readBack = await verifyAccess();
          result = {
            assetId: datasetId,
            assetType: 'dataset',
            recipientType: recipient.type,
            recipientId: recipient.id,
            requestedTasks: tasks,
            verifiedTasks: readBack.assignedTasks,
            status: readBack.verified ? 'verified' : 'unresolved',
            grantedAt,
            ...(readBack.verified
              ? { verifiedAt: new Date().toISOString() }
              : { errorCode: 'MANUAL_SHARE_PENDING', errorMessage: 'Meta has not confirmed the selected recipient and required Dataset tasks.' }),
          };
        } catch {
          result = {
            assetId: datasetId,
            assetType: 'dataset',
            recipientType: recipient.type,
            recipientId: recipient.id,
            requestedTasks: tasks,
            verifiedTasks: [],
            status: 'unresolved',
            grantedAt,
            errorCode: 'META_DATASET_VERIFICATION_FAILED',
            errorMessage: 'Meta did not return Dataset access details. Access remains unverified.',
          };
        }
        results.push(result);
        await metaAssetGrantService.recordOutcomes({
          ...grantContext,
          recipient,
          results: [result],
          attemptVersions,
        });
      };

      const verificationJobs = datasetIds.flatMap((datasetId) => [
        ...parsedConfig.data.recipients.map((recipient) => () => verify(
          datasetId,
          { ...recipient, grantMethod: 'manual_assigned_users' },
          requestedTasks,
          () => metaPartnerService.verifyDatasetAccess(
            clientTokenResult.data!.accessToken, datasetId, recipient.id, requestedTasks, clientBusinessId
          ),
        )),
        () => verify(
          datasetId,
          { type: 'business', id: partnerBusinessId, grantMethod: 'manual_agency' },
          partnerTasks,
          () => metaPartnerService.verifyDatasetAgencyAccess(
            clientTokenResult.data!.accessToken, datasetId, partnerBusinessId, partnerTasks
          ),
        ),
      ]);
      // ponytail: cap Meta verification fan-out at five; tune with measured rate-limit and latency data.
      for (let index = 0; index < verificationJobs.length; index += 5) {
        const outcomes = await Promise.allSettled(verificationJobs.slice(index, index + 5).map((job) => job()));
        const failed = outcomes.find((outcome) => outcome.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
      }

      const mergedResults = sortMetaAssetGrantResults(
        mergeMetaAssetGrantResults(metaMetadata.obo?.assetGrantResults, results, 'dataset')
      );
      const allVerified = results.length === datasetIds.length * (parsedConfig.data.recipients.length + 1) &&
        results.every((result) => result.status === 'verified');
      const anyVerified = results.some((result) => result.status === 'verified');
      const status = allVerified ? 'verified' : anyVerified ? 'partial' : 'manual_action_required';
      const verifiedAt = new Date().toISOString();
      await prisma.platformAuthorization.update({
        where: { id: platformAuth.id },
        data: { metadata: {
          ...rootMetadata,
          meta: { ...metaMetadata, obo: { ...(metaMetadata.obo || {}), assetGrantResults: mergedResults, lastVerifiedAt: verifiedAt } },
        } },
      });
      const existingGranted = (connection.grantedAssets as Record<string, unknown> | null) || {};
      const existingMetaGranted = (existingGranted.meta as Record<string, unknown> | undefined) || {};
      await prisma.clientConnection.update({
        where: { id: connectionId },
        data: { grantedAssets: {
          ...existingGranted,
          meta: { ...existingMetaGranted, verifiedMetaAssetGrantStatus: buildMetaGrantVerificationStatus(mergedResults), verifiedMetaAssetGrantResults: mergedResults, verifiedMetaAssetGrantAt: verifiedAt },
        } },
      });
      await auditService.createAuditLog({
        agencyId: accessRequest.agencyId,
        action: 'META_ASSET_ACCESS_VERIFIED',
        userEmail: connection.clientEmail,
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: { platform: 'meta', assetKind: 'dataset', verificationStatus: status, results },
        request,
      });

      return reply.send({ data: { success: allVerified, partial: anyVerified && !allVerified, status, results }, error: null });
    } catch (error) {
      if (error instanceof MetaGrantAttemptSupersededError) {
        return sendError(reply, 'META_GRANT_ATTEMPT_SUPERSEDED', error.message, 409);
      }
      return sendError(reply, 'META_DATASET_VERIFICATION_ERROR', error instanceof Error ? error.message : 'Failed to verify Meta Dataset access.', 500);
    }
  });

  // Run TikTok Business Center partner sharing automation for selected advertisers
  fastify.post('/client/:token/tiktok/share-partner-access', async (request, reply) => {
    const { token } = request.params as { token: string };

    const validated = tiktokPartnerShareSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid TikTok partner-share payload', 400, validated.error.errors,);
    }

    const { connectionId, advertiserIds, selectedBusinessCenterId } = validated.data;

    try {
      const authContext = await resolveAuthorizedConnection(token, connectionId);
      if (authContext.error || !authContext.connection || !authContext.accessRequest) {
        const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
        return reply.code(statusCode).send({
          data: null,
          error: authContext.error,
        });
      }
      const connection = authContext.connection;

      const platformAuth = await prisma.platformAuthorization.findUnique({
        where: {
          connectionId_platform: {
            connectionId,
            platform: 'tiktok',
          },
        },
      });

      if (!platformAuth) {
        return sendError(reply, 'AUTHORIZATION_NOT_FOUND', 'TikTok authorization not found', 404);
      }

      if (platformAuth.status !== 'active') {
        return sendError(reply, 'AUTHORIZATION_INACTIVE', 'TikTok authorization is not active', 403);
      }

      const tokens = await infisical.getOAuthTokens(platformAuth.secretId);
      if (!tokens?.accessToken) {
        return sendError(reply, 'TOKEN_NOT_FOUND', 'OAuth tokens not found in secure storage', 500);
      }

      const authMetadata = (platformAuth.metadata as Record<string, any> | null) || {};
      const tiktokMetadata = (authMetadata.tiktok as Record<string, any> | undefined) || {};

      const effectiveAdvertiserIds = Array.from(
        new Set(
          normalizeStringIds(
            advertiserIds && advertiserIds.length > 0
              ? advertiserIds
              : tiktokMetadata.selectedAdvertiserIds
          )
        )
      );
      const clientBusinessCenterId = selectedBusinessCenterId || tiktokMetadata.selectedBusinessCenterId;

      if (!clientBusinessCenterId) {
        return sendValidationError(reply, 'selectedBusinessCenterId is required for TikTok partner sharing');
      }

      if (effectiveAdvertiserIds.length === 0) {
        return sendValidationError(reply, 'At least one advertiser must be selected before partner sharing');
      }

      const agencyConnection = await prisma.agencyPlatformConnection.findFirst({
        where: {
          agencyId: connection.agencyId,
          platform: 'tiktok',
          status: 'active',
        },
      });

      const agencyBusinessCenterId = resolveAgencyTikTokBusinessCenterId(agencyConnection);
      if (!agencyBusinessCenterId) {
        const failedResults: ShareResultWithVerification[] = effectiveAdvertiserIds.map((id) => ({
          advertiserId: id,
          status: 'failed',
          error: 'Agency TikTok Business Center ID is not configured',
          verified: false,
        }));

        const mergedResults = mergeTikTokShareResults(
          tiktokMetadata.partnerSharing?.results,
          failedResults
        );

        const updatedMetadata = {
          ...authMetadata,
          tiktok: {
            ...tiktokMetadata,
            selectedAdvertiserIds: effectiveAdvertiserIds,
            selectedBusinessCenterId: clientBusinessCenterId,
            partnerSharing: {
              ...(tiktokMetadata.partnerSharing || {}),
              agencyBusinessCenterId: null,
              clientBusinessCenterId,
              lastAttemptAt: new Date().toISOString(),
              results: mergedResults,
              partialFailure: true,
            },
          },
        };

        await prisma.platformAuthorization.update({
          where: { id: platformAuth.id },
          data: {
            metadata: updatedMetadata as any,
          },
        });

        await auditService.createAuditLog({
          agencyId: connection.agencyId,
          action: 'TIKTOK_PARTNER_SHARE_ATTEMPT',
          userEmail: connection.clientEmail,
          resourceType: 'client_connection',
          resourceId: connection.id,
          metadata: {
            advertiserCount: effectiveAdvertiserIds.length,
            successCount: 0,
            failedCount: failedResults.length,
            agencyBusinessCenterId: null,
            clientBusinessCenterId,
            requestedAccessLevel: resolveRequestedTikTokAccessLevel(authContext.accessRequest),
            advertiserRole: null,
            reason: 'AGENCY_BUSINESS_CENTER_MISSING',
          },
          request,
        });

        return reply.send({
          data: {
            success: false,
            partialFailure: true,
            results: failedResults,
            manualFallback: {
              required: true,
              reason: 'AGENCY_BUSINESS_CENTER_MISSING',
              agencyBusinessCenterId: null,
            },
          },
          error: null,
        });
      }

      const requestedAccessLevel = resolveRequestedTikTokAccessLevel(authContext.accessRequest);
      const advertiserRole = mapAccessLevelToTikTokRole(requestedAccessLevel);

      const previouslyGrantedAdvertiserIds = Array.isArray(tiktokMetadata.partnerSharing?.results)
        ? tiktokMetadata.partnerSharing.results
            .filter((item: any) => item?.status === 'granted' || item?.status === 'already_granted')
            .map((item: any) => String(item.advertiserId))
        : [];

      const shareOutcome = await tiktokPartnerService.shareAdvertiserAssets({
        accessToken: tokens.accessToken,
        clientBusinessCenterId,
        agencyBusinessCenterId,
        advertiserIds: effectiveAdvertiserIds,
        advertiserRole,
        alreadyGrantedAdvertiserIds: previouslyGrantedAdvertiserIds,
      });

      const verifiedResults: ShareResultWithVerification[] = await mapInChunks(
        shareOutcome.results,
        async (result) => {
          if (result.status === 'failed') {
            return { ...result, verified: false };
          }

          const verified = await tiktokPartnerService.verifyAdvertiserShare({
            accessToken: tokens.accessToken!,
            clientBusinessCenterId,
            agencyBusinessCenterId,
            advertiserId: result.advertiserId,
          });

          if (!verified) {
            return {
              advertiserId: result.advertiserId,
              status: 'failed',
              error: result.error || 'Unable to verify advertiser share',
              verified: false,
            };
          }

          return {
            ...result,
            verified: true,
          };
        }
      );

      const success = verifiedResults.every((item) => item.status !== 'failed');
      const mergedResults = mergeTikTokShareResults(
        tiktokMetadata.partnerSharing?.results,
        verifiedResults
      );

      const updatedMetadata = {
        ...authMetadata,
        tiktok: {
          ...tiktokMetadata,
          selectedAdvertiserIds: effectiveAdvertiserIds,
          selectedBusinessCenterId: clientBusinessCenterId,
          partnerSharing: {
            ...(tiktokMetadata.partnerSharing || {}),
            agencyBusinessCenterId,
            clientBusinessCenterId,
            advertiserRole,
            lastAttemptAt: new Date().toISOString(),
            results: mergedResults,
            partialFailure: !success,
          },
        },
      };

      await prisma.platformAuthorization.update({
        where: { id: platformAuth.id },
        data: {
          metadata: updatedMetadata as any,
        },
      });

      await auditService.createAuditLog({
        agencyId: connection.agencyId,
        action: 'TIKTOK_PARTNER_SHARE_ATTEMPT',
        userEmail: connection.clientEmail,
        resourceType: 'client_connection',
        resourceId: connection.id,
        metadata: {
          advertiserCount: effectiveAdvertiserIds.length,
          successCount: verifiedResults.filter((item) => item.status !== 'failed').length,
          failedCount: verifiedResults.filter((item) => item.status === 'failed').length,
          agencyBusinessCenterId,
          clientBusinessCenterId,
          requestedAccessLevel,
          advertiserRole,
        },
        request,
      });

      return reply.send({
        data: {
          success,
          partialFailure: !success,
          results: verifiedResults,
          manualFallback: {
            required: !success,
            reason: success ? null : 'PARTIAL_FAILURE',
            agencyBusinessCenterId,
          },
        },
        error: null,
      });
    } catch (error) {
      return sendError(reply, 'TIKTOK_PARTNER_SHARE_ERROR', `Failed to share TikTok partner access: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  });

  // Verify TikTok Business Center sharing for selected advertisers
  fastify.post('/client/:token/tiktok/verify-share', async (request, reply) => {
    const { token } = request.params as { token: string };

    const validated = tiktokPartnerVerifySchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid TikTok verify payload', 400, validated.error.errors,);
    }

    const { connectionId, advertiserIds } = validated.data;

    try {
      const authContext = await resolveAuthorizedConnection(token, connectionId);
      if (authContext.error || !authContext.connection) {
        const statusCode = authContext.error?.code === 'FORBIDDEN' ? 403 : 404;
        return reply.code(statusCode).send({
          data: null,
          error: authContext.error,
        });
      }

      const platformAuth = await prisma.platformAuthorization.findUnique({
        where: {
          connectionId_platform: {
            connectionId,
            platform: 'tiktok',
          },
        },
      });

      if (!platformAuth) {
        return sendError(reply, 'AUTHORIZATION_NOT_FOUND', 'TikTok authorization not found', 404);
      }

      const tokens = await infisical.getOAuthTokens(platformAuth.secretId);
      if (!tokens?.accessToken) {
        return sendError(reply, 'TOKEN_NOT_FOUND', 'OAuth tokens not found in secure storage', 500);
      }

      const authMetadata = (platformAuth.metadata as Record<string, any> | null) || {};
      const tiktokMetadata = (authMetadata.tiktok as Record<string, any> | undefined) || {};
      const shareMetadata = (tiktokMetadata.partnerSharing as Record<string, any> | undefined) || {};

      const clientBusinessCenterId =
        tiktokMetadata.selectedBusinessCenterId || shareMetadata.clientBusinessCenterId;
      const agencyBusinessCenterId =
        shareMetadata.agencyBusinessCenterId ||
        resolveAgencyTikTokBusinessCenterId(
          await prisma.agencyPlatformConnection.findFirst({
            where: {
              agencyId: authContext.connection.agencyId,
              platform: 'tiktok',
              status: 'active',
            },
          })
        );

      if (!clientBusinessCenterId || !agencyBusinessCenterId) {
        return sendValidationError(reply, 'TikTok business center IDs are required before verification');
      }

      const effectiveAdvertiserIds = Array.from(
        new Set(
          normalizeStringIds(
            advertiserIds && advertiserIds.length > 0
              ? advertiserIds
              : tiktokMetadata.selectedAdvertiserIds
          )
        )
      );

      if (effectiveAdvertiserIds.length === 0) {
        return sendValidationError(reply, 'At least one advertiser must be selected before verification');
      }

      const results: ShareResultWithVerification[] = await mapInChunks(
        effectiveAdvertiserIds,
        async (advertiserId) => {
          const verified = await tiktokPartnerService.verifyAdvertiserShare({
            accessToken: tokens.accessToken!,
            clientBusinessCenterId,
            agencyBusinessCenterId,
            advertiserId,
          });

          return {
            advertiserId,
            status: verified ? 'granted' : 'failed',
            verified,
            error: verified ? undefined : 'Advertiser is not shared with agency business center',
          };
        }
      );

      const success = results.every((item) => item.status !== 'failed');
      const mergedResults = mergeTikTokShareResults(shareMetadata.results, results);

      const updatedMetadata = {
        ...authMetadata,
        tiktok: {
          ...tiktokMetadata,
          partnerSharing: {
            ...shareMetadata,
            agencyBusinessCenterId,
            clientBusinessCenterId,
            lastVerifiedAt: new Date().toISOString(),
            results: mergedResults,
            partialFailure: !success,
          },
        },
      };

      await prisma.platformAuthorization.update({
        where: { id: platformAuth.id },
        data: {
          metadata: updatedMetadata as any,
        },
      });

      await auditService.createAuditLog({
        agencyId: authContext.connection.agencyId,
        action: 'TIKTOK_PARTNER_SHARE_VERIFIED',
        userEmail: authContext.connection.clientEmail,
        resourceType: 'client_connection',
        resourceId: authContext.connection.id,
        metadata: {
          advertiserCount: effectiveAdvertiserIds.length,
          successCount: results.filter((item) => item.status !== 'failed').length,
          failedCount: results.filter((item) => item.status === 'failed').length,
          agencyBusinessCenterId,
          clientBusinessCenterId,
        },
        request,
      });

      return reply.send({
        data: {
          success,
          partialFailure: !success,
          results,
        },
        error: null,
      });
    } catch (error) {
      return sendError(reply, 'TIKTOK_VERIFY_ERROR', `Failed to verify TikTok partner sharing: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  });

  // Fetch client assets using token-scoped connection authorization
  fastify.get('/client/:token/assets/:platform', async (request, reply) => {
    const { token, platform: platformParam } = request.params as {
      token: string;
      platform: string;
    };
    const { connectionId, businessId } = request.query as {
      connectionId?: string;
      businessId?: string;
    };

    if (!connectionId) {
      return sendValidationError(reply, 'connectionId query parameter is required');
    }

    const authContext = await resolveAuthorizedConnection(token, connectionId);
    if (authContext.error) {
      const statusCode = authContext.error.code === 'FORBIDDEN' ? 403 : 404;
      return reply.code(statusCode).send({ data: null, error: authContext.error });
    }

    const platform = platformParam as Platform;
    const authPlatform = platformGroupOf(platformParam) as Platform;

    const platformAuth = await prisma.platformAuthorization.findUnique({
      where: {
        connectionId_platform: {
          connectionId,
          platform: authPlatform,
        },
      },
    });

    if (!platformAuth) {
      return sendError(reply, 'AUTHORIZATION_NOT_FOUND', 'Platform authorization not found for this connection', 404);
    }

    if (platformAuth.status !== 'active') {
      return sendError(reply, 'AUTHORIZATION_INACTIVE', 'Platform authorization is not active', 403);
    }

    try {
      const tokenReadAction =
        authPlatform === 'tiktok'
          ? 'TIKTOK_TOKEN_READ'
          : authPlatform === 'google'
            ? 'GOOGLE_TOKEN_READ'
            : authPlatform === 'linkedin'
              ? 'LINKEDIN_TOKEN_READ'
              : authPlatform === 'meta'
                ? 'META_TOKEN_READ'
                : null;

      if (tokenReadAction) {
        if (!authContext.accessRequest) {
          return sendError(reply, 'AUDIT_CONTEXT_REQUIRED', 'Access request context is required before reading this platform token', 500);
        }
        const audit = await auditService.createAuditLog({
              agencyId: authContext.accessRequest.agencyId,
              action: tokenReadAction,
              userEmail: authContext.connection?.clientEmail,
              resourceType: 'client_connection',
              resourceId: connectionId,
              metadata: {
                platform: platformParam,
                source: 'client_assets_fetch',
                ...(authPlatform === 'meta' ? { businessId: businessId || null } : {}),
              },
              request,
            });
        if (audit?.error) {
          return sendError(reply, 'AUDIT_LOG_FAILED', 'Could not record platform access before reading its token', 500);
        }
      }

      const tokens = await infisical.getOAuthTokens(platformAuth.secretId);
      if (!tokens) {
        return sendError(reply, 'TOKEN_NOT_FOUND', 'OAuth tokens not found in secure storage', 500);
      }

      let assets;
      const platformStr = String(platform);

      if (platform === 'meta_ads' || platform === 'meta_pages') {
        const { rootMetadata, metaMetadata } = readMetaAuthorizationMetadata(
          platformAuth.metadata
        );
        const effectiveBusinessId =
          businessId || metaMetadata.selection?.clientBusinessId;

        assets = await clientAssetsService.fetchMetaAssets(
          tokens.accessToken,
          effectiveBusinessId
        );

        const discoveryTimestamp = new Date().toISOString();
        const nextMeta: MetaClientAuthorizationMetadata = {
          ...metaMetadata,
          discovery: {
            availableBusinesses: assets.businesses || [],
            discoveredAt: discoveryTimestamp,
          },
        };

        if (assets.selectedBusinessId) {
          nextMeta.selection = {
            clientBusinessId: assets.selectedBusinessId,
            clientBusinessName: assets.selectedBusinessName,
            selectedAt: discoveryTimestamp,
            source: businessId ? 'user_selection' : metaMetadata.selection?.source || 'auto_selected',
          };
        }

        if (!metaDiscoveryContentUnchanged(metaMetadata, nextMeta)) {
          await prisma.platformAuthorization.update({
            where: { id: platformAuth.id },
            data: {
              metadata: {
                ...rootMetadata,
                meta: nextMeta,
              } as any,
            },
          });
        }
      } else if (platform === 'linkedin_ads') {
        assets = await clientAssetsService.fetchLinkedInAdAccounts(tokens.accessToken);
      } else if (platform === 'linkedin_pages') {
        assets = await clientAssetsService.fetchLinkedInPages(tokens.accessToken);
      } else if (platform === 'mailchimp') {
        const metadata = (platformAuth.metadata as any) || {};
        const dc = metadata.dc;
        if (!dc) {
          return sendError(reply, 'MISSING_METADATA', 'Mailchimp data center (dc) not found in authorization metadata', 400);
        }
        assets = await clientAssetsService.fetchMailchimpAssets(tokens.accessToken, dc);
      } else if (platform === 'pinterest') {
        assets = await clientAssetsService.fetchPinterestAssets(tokens.accessToken);
      } else if (platform === 'klaviyo') {
        assets = await clientAssetsService.fetchKlaviyoAssets(tokens.accessToken);
      } else if (platform === 'shopify') {
        const metadata = (platformAuth.metadata as any) || {};
        const shop = metadata.shop;
        if (!shop) {
          return sendError(reply, 'MISSING_METADATA', 'Shopify shop name not found in authorization metadata', 400);
        }
        assets = await clientAssetsService.fetchShopifyAssets(tokens.accessToken, shop);
      } else if (platform === 'tiktok' || platform === 'tiktok_ads') {
        assets = await clientAssetsService.fetchTikTokAssets(tokens.accessToken);
      } else if (platform === 'google') {
        const { GoogleConnector } = await import('../../services/connectors/google.js');
        const googleConnector = new GoogleConnector();
        const allAccounts = await googleConnector.getAllGoogleAccounts(tokens.accessToken);
        assets = {
          adsAccounts: allAccounts.adsAccounts,
          analyticsProperties: allAccounts.analyticsProperties,
          businessAccounts: allAccounts.businessAccounts,
          tagManagerContainers: allAccounts.tagManagerContainers,
          searchConsoleSites: allAccounts.searchConsoleSites,
          merchantCenterAccounts: allAccounts.merchantCenterAccounts,
        };
      } else if (
        platformStr === 'google_ads' ||
        platformStr === 'ga4' ||
        platformStr === 'google_business_profile' ||
        platformStr === 'google_tag_manager' ||
        platformStr === 'google_search_console' ||
        platformStr === 'google_merchant_center'
      ) {
        const { GoogleConnector } = await import('../../services/connectors/google.js');
        const googleConnector = new GoogleConnector();
        assets = await googleConnector.getAccountsForProduct(platformStr as GoogleProduct, tokens.accessToken);
      } else {
        return sendError(reply, 'UNSUPPORTED_PLATFORM', `Platform ${platform} not yet supported for asset fetching`, 400);
      }

      return reply.send({
        data: assets,
        error: null,
      });
    } catch (error) {
      if (error instanceof MetaBusinessPortfolioUnavailableError) {
        return sendError(reply, error.code, error.message, error.statusCode);
      }

      return sendError(reply, 'ASSET_FETCH_ERROR', `Failed to fetch assets: ${error}`, 500);
    }
  });
}
