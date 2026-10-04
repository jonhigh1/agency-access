import {
  evaluateGoogleProductFulfillment,
  getDefaultGoogleAssetSettings,
  type GoogleAssetSettings,
  type GoogleNativeGrantStatus,
  type GooglePlatformProductId,
  type GoogleProductFulfillmentMode,
  type GoogleProductGrantLifecycle,
} from '@agency-platform/shared';
import { prisma } from '@/lib/prisma';
import { updateGrantedAssets } from '@/lib/granted-assets';
import { resolveGoogleNativeGrantDispatchMode } from '@/lib/worker-runtime';
import { auditService } from '@/services/audit.service';
import { googleAdsConnector } from '@/services/connectors/google-ads';
import { googleNativeGrantService } from '@/services/google-native-grant.service';
import {
  ensureAgencyAccessToken,
  refreshClientPlatformAuthorization,
} from '@/services/token-lifecycle.service';
import type { Prisma } from '@prisma/client';
import type { ServiceError, ServiceResult } from '@/lib/service-result';

type NativeGrantExecutionError = {
  code: string;
  message: string;
  retryable: boolean;
};

const SAFE_MANAGER_LINK_FALLBACK_ERROR_CODES = new Set([
  'NOT_ADS_USER',
  'USER_PERMISSION_DENIED',
]);

const DEVELOPER_TOKEN_ACCESS_ERROR_CODES = new Set([
  'DEVELOPER_TOKEN_NOT_APPROVED',
  'DEVELOPER_TOKEN_NOT_ON_ALLOWLIST',
  'SERVICE_ACCESS_DENIED',
]);

type AccessRequestLike = {
  id: string;
  agencyId: string;
  platforms?: unknown;
};

type ClientConnectionLike = {
  id: string;
  agencyId: string;
  clientEmail?: string | null;
};

type PlanGoogleNativeGrantsInput = {
  accessRequest: AccessRequestLike;
  connection: ClientConnectionLike;
  platform: GooglePlatformProductId;
  selectedAssets: Record<string, unknown>;
};

type PlannedGrantMode = {
  mode: GoogleProductFulfillmentMode;
  recipientEmail?: string;
  managerCustomerId?: string;
  fallbackReason?: string;
  requestedMode?: GoogleProductFulfillmentMode;
};

function supportsQueuedExecution(
  product: GooglePlatformProductId,
  mode: GoogleProductFulfillmentMode
): boolean {
  return product === 'google_ads' && (mode === 'manager_link' || mode === 'user_invite');
}

type GoogleNativeGrantRecord = {
  id: string;
  connectionId: string;
  product: GooglePlatformProductId;
  assetId: string;
  grantMode: string;
  nativeGrantState: string;
  managerCustomerId?: string | null;
  recipientEmail?: string | null;
  providerExternalId?: string | null;
  providerResourceName?: string | null;
  metadata?: unknown;
  connection: {
    id: string;
    agencyId: string;
    clientEmail?: string | null;
    grantedAssets?: unknown;
  };
};

const DEFAULT_FULFILLMENT_MODE: Record<GooglePlatformProductId, GoogleProductFulfillmentMode> = {
  google_ads: 'user_invite',
  ga4: 'access_binding',
  google_business_profile: 'location_admin',
  google_tag_manager: 'user_permission',
  google_search_console: 'discovery',
  google_merchant_center: 'merchant_user',
};

const PRODUCT_ASSET_FIELD: Record<GooglePlatformProductId, string> = {
  google_ads: 'adAccounts',
  ga4: 'properties',
  google_business_profile: 'businessAccounts',
  google_tag_manager: 'containers',
  google_search_console: 'sites',
  google_merchant_center: 'merchantAccounts',
};

function mergeGoogleAssetSettings(
  connection: { agencyEmail?: string | null; connectedBy?: string | null; metadata?: unknown } | null
): GoogleAssetSettings {
  const inviteEmail = connection?.agencyEmail || connection?.connectedBy || undefined;
  const defaults = getDefaultGoogleAssetSettings(inviteEmail);
  const metadata =
    connection?.metadata && typeof connection.metadata === 'object' && !Array.isArray(connection.metadata)
      ? (connection.metadata as Record<string, unknown>)
      : {};
  const savedSettings =
    metadata.googleAssetSettings &&
    typeof metadata.googleAssetSettings === 'object' &&
    !Array.isArray(metadata.googleAssetSettings)
      ? (metadata.googleAssetSettings as Partial<GoogleAssetSettings>)
      : {};

  return {
    ...defaults,
    ...savedSettings,
    googleAdsManagement: {
      preferredGrantMode:
        savedSettings.googleAdsManagement?.preferredGrantMode ||
        defaults.googleAdsManagement?.preferredGrantMode ||
        'user_invite',
      inviteEmail:
        savedSettings.googleAdsManagement?.inviteEmail || defaults.googleAdsManagement?.inviteEmail,
      ...(savedSettings.googleAdsManagement?.managerCustomerId
        ? { managerCustomerId: savedSettings.googleAdsManagement.managerCustomerId }
        : {}),
      ...(savedSettings.googleAdsManagement?.managerAccountLabel
        ? { managerAccountLabel: savedSettings.googleAdsManagement.managerAccountLabel }
        : {}),
    },
  };
}

function getSelectedAssetIds(
  product: GooglePlatformProductId,
  selectedAssets: Record<string, unknown>
): string[] {
  const value = selectedAssets[PRODUCT_ASSET_FIELD[product]];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => String(entry)).filter(Boolean);
}

function resolveRequestedRole(platforms: unknown, product: GooglePlatformProductId): string | undefined {
  if (!Array.isArray(platforms)) {
    return undefined;
  }

  for (const group of platforms) {
    if (!group || typeof group !== 'object') continue;
    const maybeGroup = group as {
      platformGroup?: string;
      products?: Array<{ product?: string; accessLevel?: string }>;
    };

    if (maybeGroup.platformGroup !== 'google' || !Array.isArray(maybeGroup.products)) {
      continue;
    }

    const match = maybeGroup.products.find(entry => entry?.product === product);
    if (!match?.accessLevel) {
      continue;
    }

    if (match.accessLevel === 'admin' || match.accessLevel === 'manage') {
      return 'ADMIN';
    }

    if (match.accessLevel === 'read_only' || match.accessLevel === 'view_only') {
      return 'READ_ONLY';
    }

    if (match.accessLevel === 'email_only') {
      return 'EMAIL_ONLY';
    }

    return 'STANDARD';
  }

  return undefined;
}

function resolvePlannedGrantMode(
  product: GooglePlatformProductId,
  settings: GoogleAssetSettings
): PlannedGrantMode {
  const defaultMode = DEFAULT_FULFILLMENT_MODE[product];

  if (product !== 'google_ads') {
    return { mode: defaultMode };
  }

  const management = settings.googleAdsManagement;
  if (management?.preferredGrantMode !== 'manager_link') {
    return {
      mode: 'user_invite',
      recipientEmail: management?.inviteEmail,
    };
  }

  if (!management.managerCustomerId) {
    return {
      mode: 'user_invite',
      recipientEmail: management.inviteEmail,
      fallbackReason: 'missing_manager_customer_id',
      requestedMode: 'manager_link',
    };
  }

  return {
    mode: 'manager_link',
    managerCustomerId: management.managerCustomerId,
    recipientEmail: management.inviteEmail,
  };
}

async function queueGrantExecution(grantId: string): Promise<void> {
  const { queueGoogleNativeGrantExecution } = await import('@/lib/queue-helpers');
  await queueGoogleNativeGrantExecution(grantId);
}

function mergeMetadata(existing: unknown, patch: Record<string, unknown>) {
  const safeExisting =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};

  return {
    ...safeExisting,
    ...patch,
  };
}

function isGoogleNativeGrantStatus(value: string): value is GoogleNativeGrantStatus {
  return [
    'pending',
    'awaiting_client_acceptance',
    'awaiting_agency_acceptance',
    'verified',
    'failed',
    'follow_up_needed',
  ].includes(value);
}

function normalizeNativeGrantExecutionError(error: unknown): NativeGrantExecutionError {
  const errorLike =
    error && typeof error === 'object'
      ? (error as { code?: unknown; message?: unknown; retryable?: unknown })
      : {};

  return {
    code: typeof errorLike.code === 'string' ? errorLike.code : 'INTERNAL_ERROR',
    message:
      typeof errorLike.message === 'string'
        ? errorLike.message
        : error instanceof Error
          ? error.message
          : 'Failed to execute Google native grant',
    retryable: errorLike.retryable === true,
  };
}

function getSafeManagerLinkFallbackReason(input: {
  grant: {
    grantMode: string;
    recipientEmail?: string | null;
    providerExternalId?: string | null;
    providerResourceName?: string | null;
  };
  error: NativeGrantExecutionError;
}): string | null {
  if (input.grant.grantMode !== 'manager_link') {
    return null;
  }

  if (input.error.retryable) {
    return null;
  }

  if (!input.grant.recipientEmail) {
    return null;
  }

  if (input.grant.providerExternalId || input.grant.providerResourceName) {
    return null;
  }

  if (!SAFE_MANAGER_LINK_FALLBACK_ERROR_CODES.has(input.error.code)) {
    return null;
  }

  return `provider_error_${input.error.code.toLowerCase()}`;
}

async function persistGrantLifecycle(
  grant: GoogleNativeGrantRecord,
  grantStatus: GoogleNativeGrantStatus
): Promise<GoogleProductGrantLifecycle> {
  const lifecycle = evaluateGoogleProductFulfillment({
    productId: grant.product,
    hasOAuthAuthorization: true,
    fulfillmentMode: grant.grantMode as GoogleProductFulfillmentMode,
    grantStatus,
  });

  await updateGrantedAssets(grant.connectionId, (grantedAssets) => {
    const existingProductAssets =
      grantedAssets[grant.product] &&
      typeof grantedAssets[grant.product] === 'object' &&
      !Array.isArray(grantedAssets[grant.product])
        ? grantedAssets[grant.product] as Record<string, unknown>
        : {};
    return {
      ...grantedAssets,
      [grant.product]: {
        ...existingProductAssets,
        googleGrantLifecycle: lifecycle,
      },
    } as Prisma.InputJsonObject;
  });

  const platformAuthorization = await prisma.platformAuthorization.findUnique({
    where: {
      connectionId_platform: {
        connectionId: grant.connectionId,
        platform: 'google',
      },
    },
  });

  if (platformAuthorization) {
    const metadata =
      platformAuthorization.metadata &&
      typeof platformAuthorization.metadata === 'object' &&
      !Array.isArray(platformAuthorization.metadata)
        ? ({ ...(platformAuthorization.metadata as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const selectedAssets =
      metadata.selectedAssets &&
      typeof metadata.selectedAssets === 'object' &&
      !Array.isArray(metadata.selectedAssets)
        ? ({ ...(metadata.selectedAssets as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const existingSelectedAssets =
      selectedAssets[grant.product] &&
      typeof selectedAssets[grant.product] === 'object' &&
      !Array.isArray(selectedAssets[grant.product])
        ? ({ ...(selectedAssets[grant.product] as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    selectedAssets[grant.product] = {
      ...existingSelectedAssets,
      googleGrantLifecycle: lifecycle,
    };

    await prisma.platformAuthorization.update({
      where: { id: platformAuthorization.id },
      data: {
        metadata: {
          ...metadata,
          selectedAssets,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return lifecycle;
}

async function executeGoogleNativeGrant(
  grantId: string
): Promise<ServiceResult<{ grantId: string; nativeGrantState: string; googleGrantLifecycle?: GoogleProductGrantLifecycle; retryable?: boolean }>> {
  try {
    const grant = await prisma.googleNativeGrant.findUnique({
      where: { id: grantId },
      include: {
        connection: {
          select: {
            id: true,
            agencyId: true,
            clientEmail: true,
            grantedAssets: true,
          },
        },
      },
    });

    if (!grant?.connection) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Google native grant not found',
        },
      };
    }

    if (grant.product !== 'google_ads') {
      return {
        data: {
          grantId,
          nativeGrantState: grant.nativeGrantState,
        },
        error: null,
      };
    }

    // Validate Google Ads developer token is configured before attempting any API calls
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      console.error('[executeGoogleNativeGrant] GOOGLE_ADS_DEVELOPER_TOKEN not configured', {
        grantId,
        grantMode: grant.grantMode,
        assetId: grant.assetId,
      });
      return {
        data: null,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: 'Google Ads developer token is not configured. Please set GOOGLE_ADS_DEVELOPER_TOKEN environment variable.',
        },
      };
    }

    if (grant.grantMode === 'manager_link' && !grant.managerCustomerId) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Manager customer ID is required for Google Ads manager-link execution',
        },
      };
    }

    const tokenResult =
      grant.grantMode === 'manager_link'
        ? await ensureAgencyAccessToken(grant.connection.agencyId, 'google')
        : await refreshClientPlatformAuthorization(grant.connectionId, 'google');

    if (tokenResult.error || !tokenResult.data?.accessToken) {
      return {
        data: null,
        error: tokenResult.error || {
          code: 'TOKEN_NOT_FOUND',
          message:
            grant.grantMode === 'manager_link'
              ? 'Agency Google access token is unavailable'
              : 'Client Google access token is unavailable',
        },
      };
    }

    await auditService.createAuditLog({
      agencyId: grant.connection.agencyId,
      action: 'GOOGLE_TOKEN_READ',
      userEmail: grant.connection.clientEmail || undefined,
      resourceType: 'client_connection',
      resourceId: grant.connectionId,
      metadata: {
        platform: 'google_ads',
        source: 'google_native_grant_execute',
        grantId,
        grantMode: grant.grantMode,
      },
    });

    let nextNativeGrantState: GoogleNativeGrantStatus = 'pending';
    let providerResourceName = grant.providerResourceName || undefined;
    let providerExternalId = grant.providerExternalId || undefined;
    let latestProviderStatus: string | undefined;

    if (grant.grantMode === 'user_invite' && !grant.recipientEmail) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Recipient email is required for Google Ads user-invite execution',
        },
      };
    }

    const managerCustomerId = grant.managerCustomerId || undefined;
    const recipientEmail = grant.recipientEmail || undefined;
    try {
      if (grant.grantMode === 'manager_link' && grant.providerExternalId) {
        const verification = await googleAdsConnector.verifyManagerLink({
          accessToken: tokenResult.data.accessToken,
          managerCustomerId: managerCustomerId!,
          clientCustomerId: grant.assetId,
          managerLinkId: grant.providerExternalId,
        });

        providerExternalId = verification.managerLinkId || grant.providerExternalId;
        latestProviderStatus = verification.status;
        nextNativeGrantState = verification.isLinked ? 'verified' : 'awaiting_client_acceptance';
      } else if (grant.grantMode === 'manager_link' && grant.providerResourceName) {
        const link = await googleAdsConnector.findManagerLink({
          accessToken: tokenResult.data.accessToken,
          managerCustomerId: managerCustomerId!,
          clientCustomerId: grant.assetId,
        });

        if (link) {
          providerExternalId = link.managerLinkId;
          providerResourceName = link.resourceName;
          latestProviderStatus = link.status;
          nextNativeGrantState = link.status === 'ACTIVE' ? 'verified' : 'awaiting_client_acceptance';
        }
      } else if (grant.grantMode === 'manager_link') {
        const createResult = await googleAdsConnector.createManagerLinkInvitation({
          accessToken: tokenResult.data.accessToken,
          managerCustomerId: managerCustomerId!,
          clientCustomerId: grant.assetId,
        });

        providerResourceName = createResult.resourceName;

        const link = await googleAdsConnector.findManagerLink({
          accessToken: tokenResult.data.accessToken,
          managerCustomerId: managerCustomerId!,
          clientCustomerId: grant.assetId,
        });

        if (link) {
          providerExternalId = link.managerLinkId;
          providerResourceName = link.resourceName;
          latestProviderStatus = link.status;
          nextNativeGrantState = link.status === 'ACTIVE' ? 'verified' : 'awaiting_client_acceptance';
        }

        await auditService.createAuditLog({
          agencyId: grant.connection.agencyId,
          action: 'GOOGLE_NATIVE_GRANT_MUTATION',
          userEmail: grant.connection.clientEmail || undefined,
          resourceType: 'client_connection',
          resourceId: grant.connectionId,
          metadata: {
            platform: 'google_ads',
            source: 'google_ads_manager_link',
            grantId,
            managerCustomerId: grant.managerCustomerId,
            providerResourceName,
            providerExternalId,
            providerStatus: latestProviderStatus || null,
          },
        });
      } else if (grant.providerExternalId) {
        const verification = await googleAdsConnector.verifyUserAccess({
          accessToken: tokenResult.data.accessToken,
          clientCustomerId: grant.assetId,
          emailAddress: recipientEmail!,
        });

        latestProviderStatus = verification.hasAccess ? 'ACTIVE' : 'PENDING';
        nextNativeGrantState = verification.hasAccess ? 'verified' : 'awaiting_agency_acceptance';
      } else if (grant.providerResourceName) {
        const invitation = await googleAdsConnector.findUserAccessInvitation({
          accessToken: tokenResult.data.accessToken,
          clientCustomerId: grant.assetId,
          emailAddress: recipientEmail!,
        });

        if (invitation) {
          providerExternalId = invitation.invitationId;
          providerResourceName = invitation.resourceName;
          latestProviderStatus = 'PENDING';
          nextNativeGrantState = 'awaiting_agency_acceptance';
        }
      } else {
        const createResult = await googleAdsConnector.createUserAccessInvitation({
          accessToken: tokenResult.data.accessToken,
          clientCustomerId: grant.assetId,
          emailAddress: recipientEmail!,
          accessRole: 'ADMIN',
        });

        providerResourceName = createResult.resourceName;

        const invitation = await googleAdsConnector.findUserAccessInvitation({
          accessToken: tokenResult.data.accessToken,
          clientCustomerId: grant.assetId,
          emailAddress: recipientEmail!,
        });

        if (invitation) {
          providerExternalId = invitation.invitationId;
          providerResourceName = invitation.resourceName;
          latestProviderStatus = 'PENDING';
          nextNativeGrantState = 'awaiting_agency_acceptance';
        }

        await auditService.createAuditLog({
          agencyId: grant.connection.agencyId,
          action: 'GOOGLE_NATIVE_GRANT_MUTATION',
          userEmail: grant.connection.clientEmail || undefined,
          resourceType: 'client_connection',
          resourceId: grant.connectionId,
          metadata: {
            platform: 'google_ads',
            source: 'google_ads_user_invite',
            grantId,
            recipientEmail,
            providerResourceName,
            providerExternalId,
            providerStatus: latestProviderStatus || null,
          },
        });
      }
    } catch (error) {
      const normalizedError = normalizeNativeGrantExecutionError(error);

      if (DEVELOPER_TOKEN_ACCESS_ERROR_CODES.has(normalizedError.code)) {
        const failureMetadata = mergeMetadata(grant.metadata, {
          latestProviderStatus: latestProviderStatus || null,
          lastExecutionError: {
            code: normalizedError.code,
            message: normalizedError.message,
            retryable: false,
          },
          insufficientAccessLevel: true,
        });

        const updateResult = await googleNativeGrantService.updateGrantState(grant.id, {
          nativeGrantState: 'follow_up_needed',
          lastAttemptAt: new Date(),
          lastErrorCode: normalizedError.code,
          lastErrorMessage: normalizedError.message,
          ...(providerResourceName ? { providerResourceName } : {}),
          ...(providerExternalId ? { providerExternalId } : {}),
          metadata: failureMetadata as Prisma.InputJsonValue,
        });

        if (updateResult.error) {
          return {
            data: null,
            error: updateResult.error,
          };
        }

        await persistGrantLifecycle(
          {
            ...(grant as GoogleNativeGrantRecord),
            metadata: failureMetadata as Prisma.JsonValue,
          },
          'follow_up_needed'
        );

        return {
          data: {
            retryable: false,
            grantId,
            nativeGrantState: 'follow_up_needed',
          },
          error: {
            code: 'INSUFFICIENT_API_ACCESS',
            message: `Google Ads API operation failed: ${normalizedError.message}. Confirm that the developer token is approved for this service and that its permissible use includes user management in the Google Ads API Center.`,
            details: {
              retryable: false,
              originalCode: normalizedError.code,
              originalMessage: normalizedError.message,
              grantId,
              grantMode: grant.grantMode,
              assetId: grant.assetId,
            },
          },
        };
      }

      const fallbackReason = getSafeManagerLinkFallbackReason({
        grant,
        error: normalizedError,
      });

      if (fallbackReason) {
        const failedGrantMetadata = mergeMetadata(grant.metadata, {
          latestProviderStatus: latestProviderStatus || null,
          fallbackReason,
          fallbackGrantMode: 'user_invite',
          lastExecutionError: {
            code: normalizedError.code,
            message: normalizedError.message,
            retryable: normalizedError.retryable,
          },
        });

        const failManagerGrantResult = await googleNativeGrantService.updateGrantState(grant.id, {
          nativeGrantState: 'failed',
          lastAttemptAt: new Date(),
          lastErrorCode: normalizedError.code,
          lastErrorMessage: normalizedError.message,
          metadata: failedGrantMetadata as Prisma.InputJsonValue,
        });

        if (failManagerGrantResult.error) {
          return {
            data: null,
            error: failManagerGrantResult.error,
          };
        }

        const fallbackGrantMetadata = {
          requestedMode:
            (grant.metadata &&
            typeof grant.metadata === 'object' &&
            !Array.isArray(grant.metadata) &&
            typeof (grant.metadata as Record<string, unknown>).requestedMode === 'string'
              ? (grant.metadata as Record<string, string>).requestedMode
              : 'manager_link'),
          resolvedMode: 'user_invite',
          fallbackReason,
          fallbackFromGrantId: grant.id,
        };

        const fallbackGrantResult = await googleNativeGrantService.upsertGrant({
          accessRequestId: grant.accessRequestId,
          connectionId: grant.connectionId,
          product: grant.product,
          assetId: grant.assetId,
          assetName: (grant as { assetName?: string | null }).assetName || undefined,
          grantMode: 'user_invite',
          requestedRole: (grant as { requestedRole?: string | null }).requestedRole || undefined,
          recipientEmail: grant.recipientEmail || undefined,
          nativeGrantState: 'pending',
          metadata: fallbackGrantMetadata as Prisma.InputJsonValue,
        });

        if (fallbackGrantResult.error || !fallbackGrantResult.data?.id) {
          return {
            data: null,
            error:
              fallbackGrantResult.error || {
                code: 'INTERNAL_ERROR',
                message: 'Failed to create Google Ads user-invite fallback grant',
              },
          };
        }

        await queueGrantExecution(fallbackGrantResult.data.id);

        const lifecycle = await persistGrantLifecycle(
          {
            ...(grant as GoogleNativeGrantRecord),
            id: fallbackGrantResult.data.id,
            grantMode: 'user_invite',
            nativeGrantState: 'pending',
            recipientEmail: grant.recipientEmail,
            metadata: fallbackGrantMetadata as Prisma.JsonValue,
          },
          'pending'
        );

        return {
          data: {
            grantId: fallbackGrantResult.data.id,
            nativeGrantState: 'pending',
            googleGrantLifecycle: lifecycle,
          },
          error: null,
        };
      }

      const fallbackState: GoogleNativeGrantStatus =
        normalizedError.retryable
          ? (isGoogleNativeGrantStatus(grant.nativeGrantState) ? grant.nativeGrantState : 'pending')
          : 'follow_up_needed';
      const failureMetadata = mergeMetadata(grant.metadata, {
        latestProviderStatus: latestProviderStatus || null,
        lastExecutionError: {
          code: normalizedError.code,
          message: normalizedError.message,
          retryable: normalizedError.retryable,
        },
      });

      const updateResult = await googleNativeGrantService.updateGrantState(grant.id, {
        nativeGrantState: fallbackState,
        lastAttemptAt: new Date(),
        lastErrorCode: normalizedError.code,
        lastErrorMessage: normalizedError.message,
        ...(providerResourceName ? { providerResourceName } : {}),
        ...(providerExternalId ? { providerExternalId } : {}),
        metadata: failureMetadata as Prisma.InputJsonValue,
      });

      if (updateResult.error) {
        return {
          data: null,
          error: updateResult.error,
        };
      }

      if (!normalizedError.retryable) {
        await persistGrantLifecycle(
          {
            ...(grant as GoogleNativeGrantRecord),
            metadata: failureMetadata as Prisma.JsonValue,
          },
          fallbackState
        );
      }

      return {
        data: null,
        error: {
          code: normalizedError.code,
          message: normalizedError.message,
          details: {
            retryable: normalizedError.retryable,
          },
        },
      };
    }

    const metadata = mergeMetadata(grant.metadata, {
      latestProviderStatus: latestProviderStatus || null,
    });

    const updateResult = await googleNativeGrantService.updateGrantState(grant.id, {
      nativeGrantState: nextNativeGrantState,
      lastAttemptAt: new Date(),
      ...(nextNativeGrantState === 'verified' ? { verifiedAt: new Date() } : {}),
      ...(providerResourceName ? { providerResourceName } : {}),
      ...(providerExternalId ? { providerExternalId } : {}),
      metadata: metadata as Prisma.InputJsonValue,
    });

    if (updateResult.error) {
      return {
        data: null,
        error: updateResult.error,
      };
    }

    const lifecycle = await persistGrantLifecycle(grant as GoogleNativeGrantRecord, nextNativeGrantState);

    return {
      data: {
        grantId,
        nativeGrantState: nextNativeGrantState,
        googleGrantLifecycle: lifecycle,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to execute Google native grant',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function planGoogleNativeGrants(
  input: PlanGoogleNativeGrantsInput
): Promise<ServiceResult<{ selectedAssets: Record<string, unknown>; googleGrantLifecycle?: GoogleProductGrantLifecycle }>> {
  try {
    const selectedAssetIds = getSelectedAssetIds(input.platform, input.selectedAssets);
    let inlineGrantLifecycle: GoogleProductGrantLifecycle | undefined;

    if (selectedAssetIds.length === 0) {
      return {
        data: {
          selectedAssets: input.selectedAssets,
        },
        error: null,
      };
    }

    // Validate Google Ads developer token is configured before attempting to plan grants
    if (input.platform === 'google_ads') {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      if (!developerToken) {
        console.error('[planGoogleNativeGrants] GOOGLE_ADS_DEVELOPER_TOKEN not configured', {
          agencyId: input.accessRequest.agencyId,
          platform: input.platform,
        });
        return {
          data: null,
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'Google Ads developer token is not configured. Please set GOOGLE_ADS_DEVELOPER_TOKEN environment variable to enable Google Ads access grants.',
          },
        };
      }
    }

    const agencyGoogleConnection = await prisma.agencyPlatformConnection.findFirst({
      where: {
        agencyId: input.accessRequest.agencyId,
        platform: 'google',
        status: 'active',
      },
    });

    const settings = mergeGoogleAssetSettings(agencyGoogleConnection as any);
    const plannedMode = resolvePlannedGrantMode(input.platform, settings);
    const requestedRole = resolveRequestedRole(input.accessRequest.platforms, input.platform);

    if (plannedMode.mode === 'discovery') {
      const googleGrantLifecycle = evaluateGoogleProductFulfillment({
        productId: input.platform,
        hasOAuthAuthorization: true,
        fulfillmentMode: 'discovery',
      });

      return {
        data: {
          selectedAssets: {
            ...input.selectedAssets,
            googleGrantLifecycle,
          },
          googleGrantLifecycle,
        },
        error: null,
      };
    }

    for (const assetId of selectedAssetIds) {
      const grantResult = await googleNativeGrantService.upsertGrant({
        accessRequestId: input.accessRequest.id,
        connectionId: input.connection.id,
        product: input.platform,
        assetId,
        grantMode: plannedMode.mode,
        requestedRole,
        recipientEmail: plannedMode.recipientEmail,
        managerCustomerId: plannedMode.managerCustomerId,
        nativeGrantState: 'pending',
        metadata: {
          requestedMode: plannedMode.requestedMode || plannedMode.mode,
          resolvedMode: plannedMode.mode,
          ...(plannedMode.fallbackReason
            ? { fallbackReason: plannedMode.fallbackReason }
            : {}),
        },
      });

      if (grantResult.error || !grantResult.data?.id) {
        return {
          data: null,
          error:
            grantResult.error || {
              code: 'INTERNAL_ERROR',
              message: 'Failed to persist Google native grant',
            },
        };
      }

      if (supportsQueuedExecution(input.platform, plannedMode.mode)) {
        const dispatchMode = resolveGoogleNativeGrantDispatchMode(
          process.env.BACKGROUND_WORKERS_ENABLED
        );

        if (dispatchMode === 'inline') {
          const executionResult = await executeGoogleNativeGrant(grantResult.data.id);
          if (executionResult.error) {
            return {
              data: null,
              error: executionResult.error,
            };
          }
          inlineGrantLifecycle = executionResult.data?.googleGrantLifecycle;
        } else {
          await queueGrantExecution(grantResult.data.id);
        }
      }
    }

    const googleGrantLifecycle =
      inlineGrantLifecycle ||
      evaluateGoogleProductFulfillment({
        productId: input.platform,
        hasOAuthAuthorization: true,
        fulfillmentMode: plannedMode.mode,
        grantStatus: 'pending',
      });

    return {
      data: {
        selectedAssets: {
          ...input.selectedAssets,
          googleGrantLifecycle,
        },
        googleGrantLifecycle,
      },
      error: null,
    };
  } catch (error) {
    console.error('[planGoogleNativeGrants] failed', {
      accessRequestId: input.accessRequest.id,
      connectionId: input.connection.id,
      platform: input.platform,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to plan Google native grants',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export const googleNativeAccessService = {
  planGoogleNativeGrants,
  executeGoogleNativeGrant,
};
