/**
 * Access Request Service
 *
 * Business logic for creating and managing access requests.
 * Generates unique tokens for client authorization links.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import {
  PlatformSchema,
  type Platform,
  type AccessRequestStatus,
  type ConnectionStatus,
  type DashboardRequestSummary,
  GOOGLE_PLATFORM_PRODUCT_IDS,
  evaluateGoogleProductFulfillment,
  platformGroupOf,
  type GooglePlatformProductId,
  type GoogleProductFulfillmentMode,
  type GoogleProductGrantLifecycle,
  type WebhookAccessRequestLifecycleEventType,
} from '@agency-platform/shared';
import { invalidateDashboardCache } from '@/lib/cache.js';
import { env } from '@/lib/env.js';
import { logger } from '@/lib/logger.js';
import { webhookEventService } from '@/services/webhook-event.service.js';
import { normalizeCustomerId } from '@/services/connectors/google.js';
import { resolveListLimit, resolveListOffset } from '@/lib/list-pagination.js';

const LegacyPlatformSchema = z.enum([
  'whatsapp_business',
  'google_tag_manager',
  'google_merchant_center',
  'google_search_console',
  'youtube_studio',
  'google_business_profile',
  'display_video_360',
]);

const AccessRequestPlatformSchema = z.union([PlatformSchema, LegacyPlatformSchema]);

// Validation schemas
const createAccessRequestSchema = z.object({
  agencyId: z.string().min(1, 'Agency ID is required'),
  clientId: z.string().optional(),
  clientName: z.string().min(1, 'Client name is required'),
  clientEmail: z.string().email('Invalid email address'),
  externalReference: z.string().max(255, 'External reference must be 255 characters or less').optional(),
  platforms: z.array(
    z.object({
      platform: AccessRequestPlatformSchema,
      accessLevel: z.enum(['manage', 'view_only']),
      accountId: z.string().min(1).optional(), // Per-request override (e.g. google_ads)
    })
  ).min(1, 'At least one platform must be selected'),
  intakeFields: z.array(
    z.object({
      id: z.string().optional(), // Frontend may send id
      label: z.string(),
      type: z.enum(['text', 'email', 'phone', 'url', 'dropdown', 'textarea']),
      required: z.boolean(),
      options: z.array(z.string()).optional(), // For dropdown type
      order: z.number().optional(), // Frontend may not send order, we'll assign it
    })
  ).optional(),
  branding: z.object({
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').optional(),
    subdomain: z.string().min(3).max(63).regex(/^[a-z0-9-]+$/, 'Invalid subdomain').optional(),
  }).optional(),
});

const updateAccessRequestSchema = z.object({
  externalReference: z.string().max(255, 'External reference must be 255 characters or less').optional(),
  platforms: z.array(
    z.object({
      platform: AccessRequestPlatformSchema,
      accessLevel: z.enum(['manage', 'view_only']),
    })
  ).min(1).optional(),
  intakeFields: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string(),
      type: z.enum(['text', 'email', 'phone', 'url', 'dropdown', 'textarea']),
      required: z.boolean(),
      options: z.array(z.string()).optional(),
      order: z.number().optional(),
    })
  ).optional(),
  branding: z.object({
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').optional(),
    subdomain: z.string().min(3).max(63).regex(/^[a-z0-9-]+$/, 'Invalid subdomain').optional(),
  }).optional(),
  status: z.enum(['pending', 'partial', 'completed', 'expired', 'revoked']).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required to update an access request',
});

export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>;
export type UpdateAccessRequestInput = z.infer<typeof updateAccessRequestSchema>;

/**
 * Access level mapping - defined once at module load time
 * Maps backend access levels to frontend access levels
 */
const ACCESS_LEVEL_MAP: Record<string, 'admin' | 'standard' | 'read_only' | 'email_only'> = {
  'manage': 'admin',
  'view_only': 'read_only',
};

/**
 * Generate a unique 12-character token for access requests
 * Uses crypto.randomBytes for secure random generation
 */
export function generateUniqueToken(): string {
  const bytes = randomBytes(6); // 6 bytes = 12 hex characters
  return bytes.toString('hex').toLowerCase();
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Create a new access request
 */
export async function createAccessRequest(input: CreateAccessRequestInput) {
  try {
    const validated = createAccessRequestSchema.parse(input);

    // Verify agency exists
    const agency = await prisma.agency.findUnique({
      where: { id: validated.agencyId },
    });

    if (!agency) {
      return {
        data: null,
        error: {
          code: 'AGENCY_NOT_FOUND',
          message: 'Agency not found',
        },
      };
    }

    // Check if subdomain is already taken (if provided)
    if (validated.branding?.subdomain) {
      const existingSubdomain = await prisma.accessRequest.findFirst({
        where: {
          agencyId: validated.agencyId,
          branding: {
            path: ['subdomain'],
            equals: validated.branding.subdomain,
          },
        },
        select: { id: true },
      });

      if (existingSubdomain) {
        return {
          data: null,
          error: {
            code: 'SUBDOMAIN_TAKEN',
            message: 'This subdomain is already in use',
          },
        };
      }
    }

    // Normalize intakeFields - add order if missing
    const normalizedIntakeFields = validated.intakeFields?.map((field, index) => ({
      ...field,
      order: field.order ?? index,
    }));

    let accessRequest;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        accessRequest = await prisma.accessRequest.create({
          data: {
            agencyId: validated.agencyId,
            clientId: validated.clientId,
            clientName: validated.clientName,
            clientEmail: validated.clientEmail,
            externalReference: validated.externalReference,
            uniqueToken: generateUniqueToken(),
            platforms: validated.platforms as any,
            intakeFields: normalizedIntakeFields as any,
            branding: validated.branding as any,
            status: 'pending',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          },
        });
        break;
      } catch (error) {
        if (!isUniqueConstraintError(error) || attempt === 4) {
          if (isUniqueConstraintError(error)) {
            return {
              data: null,
              error: {
                code: 'TOKEN_COLLISION',
                message: 'Unable to generate unique token. Please try again.',
              },
            };
          }
          throw error;
        }
      }
    }

    if (!accessRequest) {
      return {
        data: null,
        error: {
          code: 'TOKEN_COLLISION',
          message: 'Unable to generate unique token. Please try again.',
        },
      };
    }

    // Invalidate dashboard cache for this agency
    await invalidateDashboardCache(validated.agencyId);

    return { data: accessRequest, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      };
    }

    // Log the actual error for debugging
    console.error('Failed to create access request:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create access request',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Transform flat platforms array to hierarchical format for frontend
 * Flat: [{ platform: 'google_ads', accessLevel: 'manage' }]
 * Hierarchical: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }]
 *
 * OPTIMIZED: Uses module-level constants instead of creating objects on every call
 */
function transformPlatformsToHierarchical(platforms: any[]): any[] {
  // Group platforms by platformGroup
  const grouped = platforms.reduce((acc, platform) => {
    const platformGroup = platformGroupOf(platform.platform);

    if (!acc[platformGroup]) {
      acc[platformGroup] = [];
    }

    acc[platformGroup].push({
      product: platform.platform,
      accessLevel: ACCESS_LEVEL_MAP[platform.accessLevel] || 'admin',
      accounts: [], // Empty for client_authorization flow
    });

    return acc;
  }, {} as Record<string, any[]>);

  // Convert to hierarchical format
  return Object.entries(grouped).map(([platformGroup, products]) => ({
    platformGroup,
    products,
  }));
}

function normalizePlatformGroup(platform: string): string {
  return platformGroupOf(platform);
}

function extractDashboardPlatformGroups(platforms: unknown): string[] {
  if (!Array.isArray(platforms)) {
    return [];
  }

  const groups = new Set<string>();
  for (const entry of platforms) {
    if (entry && typeof entry === 'object') {
      const maybeGroup = (entry as any).platformGroup;
      const maybeProduct = (entry as any).platform;

      if (typeof maybeGroup === 'string' && maybeGroup.length > 0) {
        groups.add(maybeGroup);
        continue;
      }

      if (typeof maybeProduct === 'string' && maybeProduct.length > 0) {
        groups.add(normalizePlatformGroup(maybeProduct));
      }
    }
  }

  return Array.from(groups);
}

const ASSET_SELECTING_PRODUCTS = new Set([
  'google_ads',
  'ga4',
  'google_business_profile',
  'google_tag_manager',
  'google_search_console',
  'google_merchant_center',
  'meta_ads',
  'meta_pages',
  'linkedin_ads',
  'linkedin_pages',
  'tiktok',
  'tiktok_ads',
]);

type RequestedProduct = {
  product: string;
  platformGroup: string;
};

type UnresolvedProduct = RequestedProduct & {
  reason: 'no_assets' | 'selection_required';
};

type AuthorizationProgressConnection = {
  grantedAssets: unknown;
  authorizations?: Array<{
    platform: string;
    status: string;
  }>;
};

type AgencyPlatformConnectionSummary = {
  platform: string;
  metadata?: unknown;
};

const GOOGLE_PRODUCT_ID_SET = new Set<string>(GOOGLE_PLATFORM_PRODUCT_IDS);

const GOOGLE_DEFAULT_FULFILLMENT_MODE: Record<
  GooglePlatformProductId,
  GoogleProductFulfillmentMode
> = {
  google_ads: 'user_invite',
  ga4: 'access_binding',
  google_business_profile: 'location_admin',
  google_tag_manager: 'user_permission',
  google_search_console: 'discovery',
  google_merchant_center: 'merchant_user',
};

function isActiveAuthorizationStatus(status: string): boolean {
  return status === 'active';
}

function isAssetSelectingProduct(product: string): boolean {
  return ASSET_SELECTING_PRODUCTS.has(product);
}

function isGooglePlatformProduct(product: string): product is GooglePlatformProductId {
  return GOOGLE_PRODUCT_ID_SET.has(product);
}

function extractRequestedProducts(platforms: unknown): RequestedProduct[] {
  if (!Array.isArray(platforms)) {
    return [];
  }

  const requestedProducts: RequestedProduct[] = [];

  for (const entry of platforms) {
    if (!entry || typeof entry !== 'object') continue;

    const maybeGroup = (entry as any).platformGroup;
    const maybeProducts = (entry as any).products;
    if (typeof maybeGroup === 'string' && Array.isArray(maybeProducts)) {
      for (const product of maybeProducts) {
        const maybeProduct = product?.product;
        if (typeof maybeProduct === 'string') {
          requestedProducts.push({
            product: maybeProduct,
            platformGroup: maybeGroup,
          });
        }
      }
      continue;
    }

    const maybeProduct = (entry as any).platform;
    if (typeof maybeProduct === 'string') {
      requestedProducts.push({
        product: maybeProduct,
        platformGroup: normalizePlatformGroup(maybeProduct),
      });
    }
  }

  return requestedProducts;
}

function getSelectedAssetCount(product: string, assets: Record<string, any>): number {
  switch (product) {
    case 'google_ads':
    case 'meta_ads':
    case 'linkedin_ads':
    case 'linkedin_pages':
      return (
        (assets.adAccounts?.length ?? 0) +
        (assets.pages?.length ?? 0) +
        (assets.instagramAccounts?.length ?? 0)
      );
    case 'meta_pages':
      return assets.pages?.length ?? 0;
    case 'ga4':
      return assets.properties?.length ?? 0;
    case 'google_business_profile':
      return assets.businessAccounts?.length ?? 0;
    case 'google_tag_manager':
      return assets.containers?.length ?? 0;
    case 'google_search_console':
      return assets.sites?.length ?? 0;
    case 'google_merchant_center':
      return assets.merchantAccounts?.length ?? 0;
    case 'tiktok':
    case 'tiktok_ads':
      return (
        (assets.selectedAdvertiserIds?.length ?? 0) ||
        (assets.adAccounts?.length ?? 0) ||
        (assets.advertisers?.length ?? 0) ||
        0
      );
    default:
      return 0;
  }
}

function hasNoAssetsSignal(product: string, assets: Record<string, any>): boolean {
  if (
    product === 'google_ads' ||
    product === 'ga4' ||
    product === 'google_business_profile' ||
    product === 'google_tag_manager' ||
    product === 'google_search_console' ||
    product === 'google_merchant_center' ||
    product === 'meta_pages' ||
    product === 'linkedin_ads' ||
    product === 'linkedin_pages'
  ) {
    return assets.availableAssetCount === 0;
  }

  if (product === 'tiktok' || product === 'tiktok_ads') {
    return Array.isArray(assets.availableAdvertisers) && assets.availableAdvertisers.length === 0;
  }

  return false;
}

function hasNonSelectingProductAccess(
  requestedProduct: RequestedProduct,
  connection: AuthorizationProgressConnection
): boolean {
  const grantedAssets =
    (connection.grantedAssets as Record<string, unknown> | null) || null;
  const grantedPlatform =
    grantedAssets && typeof grantedAssets.platform === 'string'
      ? grantedAssets.platform
      : null;

  if (
    grantedPlatform &&
    (grantedPlatform === requestedProduct.product ||
      normalizePlatformGroup(grantedPlatform) === requestedProduct.platformGroup)
  ) {
    return true;
  }

  return (connection.authorizations || []).some(
    (authorization) =>
      isActiveAuthorizationStatus(authorization.status) &&
      (authorization.platform === requestedProduct.product ||
        normalizePlatformGroup(authorization.platform) === requestedProduct.platformGroup)
  );
}

function extractSelectedAssets(
  requestedProduct: RequestedProduct,
  connection: AuthorizationProgressConnection
): Record<string, any> | null {
  const grantedAssets =
    (connection.grantedAssets as Record<string, unknown> | null) || null;

  if (!grantedAssets || !(requestedProduct.product in grantedAssets)) {
    return null;
  }

  const selectedAssets = grantedAssets[requestedProduct.product];
  return selectedAssets && typeof selectedAssets === 'object'
    ? (selectedAssets as Record<string, any>)
    : null;
}

function resolveGoogleDefaultFulfillmentMode(
  requestedProduct: RequestedProduct,
  agencyPlatformConnections: AgencyPlatformConnectionSummary[] = []
): GoogleProductFulfillmentMode {
  const defaultMode =
    GOOGLE_DEFAULT_FULFILLMENT_MODE[requestedProduct.product as GooglePlatformProductId];

  if (requestedProduct.product !== 'google_ads') {
    return defaultMode;
  }

  const googleConnection = agencyPlatformConnections.find(
    (connection) => connection.platform === 'google'
  );
  const metadata =
    googleConnection?.metadata && typeof googleConnection.metadata === 'object'
      ? (googleConnection.metadata as Record<string, any>)
      : null;
  const managementSettings =
    metadata?.googleAssetSettings &&
    typeof metadata.googleAssetSettings === 'object' &&
    metadata.googleAssetSettings.googleAdsManagement &&
    typeof metadata.googleAssetSettings.googleAdsManagement === 'object'
      ? (metadata.googleAssetSettings.googleAdsManagement as Record<string, any>)
      : null;

  if (managementSettings?.preferredGrantMode !== 'manager_link') {
    return defaultMode;
  }

  const managerCustomerId =
    typeof managementSettings.managerCustomerId === 'string'
      ? normalizeCustomerId(managementSettings.managerCustomerId)
      : '';

  if (!managerCustomerId) {
    return defaultMode;
  }

  const adsAccounts = Array.isArray(metadata?.googleAccounts?.adsAccounts)
    ? metadata.googleAccounts.adsAccounts
    : null;

  if (adsAccounts && adsAccounts.length > 0) {
    const selectedManager = adsAccounts.find(
      (account: any) => account?.id === managerCustomerId && account?.isManager
    );

    return selectedManager ? 'manager_link' : defaultMode;
  }

  return 'manager_link';
}

function buildGoogleGrantLifecycle(
  requestedProduct: RequestedProduct,
  hasOAuthAuthorization: boolean,
  selectedAssets: Record<string, any> | null,
  agencyPlatformConnections: AgencyPlatformConnectionSummary[] = []
): GoogleProductGrantLifecycle {
  const storedLifecycle =
    selectedAssets &&
    selectedAssets.googleGrantLifecycle &&
    typeof selectedAssets.googleGrantLifecycle === 'object'
      ? (selectedAssets.googleGrantLifecycle as Partial<GoogleProductGrantLifecycle>)
      : null;

  const fulfillmentMode =
    typeof storedLifecycle?.fulfillmentMode === 'string'
      ? (storedLifecycle.fulfillmentMode as GoogleProductFulfillmentMode)
      : resolveGoogleDefaultFulfillmentMode(requestedProduct, agencyPlatformConnections);

  const grantStatus =
    typeof storedLifecycle?.grantStatus === 'string' ? storedLifecycle.grantStatus : undefined;

  return evaluateGoogleProductFulfillment({
    productId: requestedProduct.product as GooglePlatformProductId,
    hasOAuthAuthorization,
    fulfillmentMode,
    grantStatus,
  });
}

function evaluateAuthorizationProgress(
  requestedProducts: RequestedProduct[],
  connections: AuthorizationProgressConnection[],
  agencyPlatformConnections: AgencyPlatformConnectionSummary[] = []
) {
  const fulfilledProducts: RequestedProduct[] = [];
  const unresolvedProducts: UnresolvedProduct[] = [];
  const googleProductFulfillment: GoogleProductGrantLifecycle[] = [];

  for (const requestedProduct of requestedProducts) {
    if (!isAssetSelectingProduct(requestedProduct.product)) {
      if (connections.some((connection) => hasNonSelectingProductAccess(requestedProduct, connection))) {
        fulfilledProducts.push(requestedProduct);
      }
      continue;
    }

    let hasAuthorization = false;
    let hasSelectedAssets = false;
    let hasNoAssets = false;
    let resolvedSelectedAssets: Record<string, any> | null = null;

    for (const connection of connections) {
      if (
        (connection.authorizations || []).some(
          (authorization) =>
            isActiveAuthorizationStatus(authorization.status) &&
            normalizePlatformGroup(authorization.platform) === requestedProduct.platformGroup
        )
      ) {
        hasAuthorization = true;
      }

      const selectedAssets = extractSelectedAssets(requestedProduct, connection);
      if (!selectedAssets) {
        continue;
      }

      resolvedSelectedAssets = selectedAssets;

      if (getSelectedAssetCount(requestedProduct.product, selectedAssets) > 0) {
        hasSelectedAssets = true;
      }

      if (hasNoAssetsSignal(requestedProduct.product, selectedAssets)) {
        hasNoAssets = true;
      }
    }

    if (isGooglePlatformProduct(requestedProduct.product)) {
      const lifecycle = buildGoogleGrantLifecycle(
        requestedProduct,
        hasAuthorization,
        resolvedSelectedAssets,
        agencyPlatformConnections
      );
      googleProductFulfillment.push(lifecycle);

      if (hasNoAssets) {
        unresolvedProducts.push({
          ...requestedProduct,
          reason: 'no_assets',
        });
        continue;
      }

      if (!hasSelectedAssets) {
        if (hasAuthorization) {
          unresolvedProducts.push({
            ...requestedProduct,
            reason: 'selection_required',
          });
        }
        continue;
      }

      if (lifecycle.isFulfilled) {
        fulfilledProducts.push(requestedProduct);
        continue;
      }

      unresolvedProducts.push({
        ...requestedProduct,
        reason: lifecycle.state as UnresolvedProduct['reason'],
      });
      continue;
    }

    if (hasSelectedAssets) {
      fulfilledProducts.push(requestedProduct);
      continue;
    }

    if (hasNoAssets) {
      unresolvedProducts.push({
        ...requestedProduct,
        reason: 'no_assets',
      });
      continue;
    }

    if (hasAuthorization) {
      unresolvedProducts.push({
        ...requestedProduct,
        reason: 'selection_required',
      });
    }
  }

  const fulfilledKeys = new Set(
    fulfilledProducts.map((product) => `${product.platformGroup}:${product.product}`)
  );
  const completedPlatforms = Array.from(
    new Set(requestedProducts.map((product) => product.platformGroup))
  ).filter((platformGroup) =>
    requestedProducts
      .filter((product) => product.platformGroup === platformGroup)
      .every((product) => fulfilledKeys.has(`${product.platformGroup}:${product.product}`))
  );

  return {
    fulfilledProducts,
    unresolvedProducts,
    googleProductFulfillment,
    completedPlatforms,
    isComplete:
      requestedProducts.length > 0 && fulfilledProducts.length === requestedProducts.length,
  };
}

function getAccessRequestLifecycleEventType(
  status: string
): WebhookAccessRequestLifecycleEventType | null {
  if (status === 'partial') {
    return 'access_request.partial';
  }

  if (status === 'completed') {
    return 'access_request.completed';
  }

  if (status === 'revoked') {
    return 'access_request.revoked';
  }

  if (status === 'expired') {
    return 'access_request.expired';
  }

  return null;
}

function buildConnectionSummaries(
  connections: Array<{
    id: string;
    status: string;
    grantedAssets: unknown;
    authorizations?: Array<{
      platform: string;
      status: string;
    }>;
  }>
) {
  const connectionSummaries = connections.map((connection) => {
    const connectionPlatforms = new Set<string>();

    for (const authorization of connection.authorizations || []) {
      if (isActiveAuthorizationStatus(authorization.status)) {
        const normalizedPlatform = normalizePlatformGroup(authorization.platform);
        connectionPlatforms.add(normalizedPlatform);
      }
    }

    const grantedAssets =
      (connection.grantedAssets as Record<string, unknown> | null) || null;
    if (grantedAssets && typeof grantedAssets.platform === 'string') {
      const normalizedPlatform = normalizePlatformGroup(grantedAssets.platform);
      connectionPlatforms.add(normalizedPlatform);
    }

    return {
      connectionId: connection.id,
      status: connection.status as ConnectionStatus,
      platforms: Array.from(connectionPlatforms),
      ...(grantedAssets ? { grantedAssetsSummary: grantedAssets } : {}),
    };
  });

  return connectionSummaries;
}

export async function emitAccessRequestLifecycleWebhook(input: {
  accessRequestId: string;
  previousStatus: string;
  nextStatus: string;
}) {
  const eventType = getAccessRequestLifecycleEventType(input.nextStatus);
  if (!eventType || input.previousStatus === input.nextStatus) {
    return;
  }

  try {
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id: input.accessRequestId },
      select: {
        id: true,
        agencyId: true,
        clientId: true,
        clientName: true,
        clientEmail: true,
        externalReference: true,
        platforms: true,
        status: true,
        uniqueToken: true,
        createdAt: true,
        authorizedAt: true,
        expiresAt: true,
        client: {
          select: {
            id: true,
            company: true,
          },
        },
      },
    });

    if (!accessRequest) {
      return;
    }

    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { agencyId: accessRequest.agencyId },
    });

    if (!endpoint || endpoint.status !== 'active') {
      return;
    }

    const subscribedEvents = Array.isArray(endpoint.subscribedEvents)
      ? endpoint.subscribedEvents
      : [];
    if (!subscribedEvents.includes(eventType)) {
      return;
    }

    const clientConnections = await prisma.clientConnection.findMany({
      where: { accessRequestId: accessRequest.id },
      select: {
        id: true,
        status: true,
        grantedAssets: true,
        createdAt: true,
        authorizations: {
          select: {
            platform: true,
            status: true,
          },
        },
      },
    });

    const requestedPlatforms = extractDashboardPlatformGroups(accessRequest.platforms);
    const requestedProducts = extractRequestedProducts(accessRequest.platforms);
    const progress = evaluateAuthorizationProgress(requestedProducts, clientConnections as any);
    const connections = buildConnectionSummaries(clientConnections as any);

    const apiVersion = (endpoint.preferredApiVersion as string) || '2026-03-08';

    // Build V2 connection data with raw grantedAssets for V2 payload builder
    const connectionsWithV2Data = connections.map((conn, idx) => ({
      ...conn,
      grantedAssets: (clientConnections[idx]?.grantedAssets as Record<string, unknown> | null) ?? null,
      grantedAt: clientConnections[idx]?.createdAt ?? null,
      authorizationStatuses: clientConnections[idx]?.authorizations,
    }));

    const payload = webhookEventService.buildAccessRequestWebhookEvent({
      type: eventType,
      apiVersion: apiVersion as '2026-03-08' | '2026-03-19',
      request: {
        id: accessRequest.id,
        status: accessRequest.status as AccessRequestStatus,
        createdAt: accessRequest.createdAt,
        authorizedAt: accessRequest.authorizedAt,
        expiresAt: accessRequest.expiresAt,
        externalReference: accessRequest.externalReference,
        uniqueToken: accessRequest.uniqueToken,
      },
      client: {
        id: accessRequest.client?.id ?? accessRequest.clientId ?? accessRequest.id,
        name: accessRequest.clientName,
        email: accessRequest.clientEmail,
        ...(accessRequest.client?.company
          ? { company: accessRequest.client.company }
          : {}),
      },
      authorizationProgress: {
        requestedPlatforms,
        completedPlatforms: progress.completedPlatforms,
      },
      connections: connectionsWithV2Data,
      requestUrl: `${env.FRONTEND_URL}/invite/${accessRequest.uniqueToken}`,
      ...(input.nextStatus === 'revoked'
        ? { revokedAt: new Date().toISOString(), revokedBy: 'system' }
        : {}),
      ...(input.nextStatus === 'expired'
        ? { expiredAt: new Date().toISOString() }
        : {}),
    });

    const eventRecord = await prisma.webhookEvent.create({
      data: {
        agencyId: accessRequest.agencyId,
        endpointId: endpoint.id,
        type: eventType,
        resourceType: 'access_request',
        resourceId: accessRequest.id,
        payload: payload as any,
      },
    });

    const { queueWebhookDelivery } = await import('@/lib/queue-helpers');
    await queueWebhookDelivery(eventRecord.id);
  } catch (error) {
    logger.warn('Failed to emit access request lifecycle webhook', {
      accessRequestId: input.accessRequestId,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function setAccessRequestLifecycleStatus(
  requestId: string,
  nextStatus: 'pending' | 'partial' | 'completed'
) {
  const existing = await prisma.accessRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      agencyId: true,
      authorizedAt: true,
    },
  });

  if (!existing) {
    return {
      data: null,
      error: {
        code: 'REQUEST_NOT_FOUND',
        message: 'Access request not found',
      },
    };
  }

  if (existing.status === nextStatus) {
    const currentRequest = await prisma.accessRequest.findUnique({
      where: { id: requestId },
    });

    return {
      data: currentRequest,
      error: null,
    };
  }

  const accessRequest = await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status: nextStatus,
      ...(nextStatus === 'completed' && !existing.authorizedAt
        ? { authorizedAt: new Date() }
        : {}),
    },
  });

  await invalidateDashboardCache(existing.agencyId);
  await emitAccessRequestLifecycleWebhook({
    accessRequestId: requestId,
    previousStatus: existing.status,
    nextStatus,
  });

  return {
    data: accessRequest,
    error: null,
  };
}

function getIdentityFromConnection(connection: {
  agencyEmail: string | null;
  businessId: string | null;
  connectedBy: string;
  metadata: unknown;
}) {
  const metadata = (connection.metadata as Record<string, unknown> | null) || null;

  const metadataEmail =
    typeof metadata?.email === 'string'
      ? metadata.email
      : typeof metadata?.userEmail === 'string'
      ? metadata.userEmail
      : typeof metadata?.businessEmail === 'string'
      ? metadata.businessEmail
      : undefined;

  const metadataBusinessId =
    typeof metadata?.businessId === 'string' ? metadata.businessId : undefined;
  const metadataShopDomain =
    typeof metadata?.shopDomain === 'string' ? metadata.shopDomain : undefined;

  return {
    agencyEmail: connection.agencyEmail || metadataEmail || connection.connectedBy,
    businessId: connection.businessId || metadataBusinessId,
    shopDomain: metadataShopDomain,
  };
}

/**
 * Get access request by ID
 */
export async function getAccessRequestById(id: string, agencyId?: string) {
  try {
    const accessRequest = agencyId
      ? await prisma.accessRequest.findFirst({ where: { id, agencyId } })
      : await prisma.accessRequest.findUnique({ where: { id } });

    if (!accessRequest) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Access request not found',
        },
      };
    }

    // Transform platforms from flat to hierarchical format for frontend
    const platforms = accessRequest.platforms as any[];
    const hierarchicalPlatforms = Array.isArray(platforms) && platforms.length > 0 && platforms[0]?.platform
      ? transformPlatformsToHierarchical(platforms)
      : platforms; // Already in hierarchical format or empty

    const requestedPlatformGroups = Array.isArray(hierarchicalPlatforms)
      ? hierarchicalPlatforms
          .map((group: any) => group?.platformGroup)
          .filter((group: unknown): group is string => typeof group === 'string')
      : [];
    const requestedProducts = extractRequestedProducts(hierarchicalPlatforms);

    let shopifySubmission:
      | {
          status: 'pending_client' | 'submitted' | 'legacy_unreadable';
          connectionId?: string;
          shopDomain?: string;
          collaboratorCode?: string;
          submittedAt?: string;
        }
      | undefined;

    if (requestedPlatformGroups.includes('shopify')) {
      const latestShopifyConnection = await prisma.clientConnection.findFirst({
        where: { accessRequestId: accessRequest.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          grantedAssets: true,
        },
      });

      const grantedAssets = (latestShopifyConnection?.grantedAssets as Record<string, unknown> | null) || null;
      const isShopifySubmission = grantedAssets?.platform === 'shopify';
      const shopDomain = typeof grantedAssets?.shopDomain === 'string' ? grantedAssets.shopDomain : undefined;
      const collaboratorCode =
        typeof grantedAssets?.collaboratorCode === 'string' ? grantedAssets.collaboratorCode : undefined;
      const collaboratorCodeHash =
        typeof grantedAssets?.collaboratorCodeHash === 'string'
          ? grantedAssets.collaboratorCodeHash
          : undefined;

      if (!latestShopifyConnection || !isShopifySubmission) {
        shopifySubmission = {
          status: 'pending_client',
        };
      } else if (shopDomain && collaboratorCode) {
        shopifySubmission = {
          status: 'submitted',
          connectionId: latestShopifyConnection.id,
          shopDomain,
          collaboratorCode,
          submittedAt: latestShopifyConnection.createdAt.toISOString(),
        };
      } else if (shopDomain && collaboratorCodeHash) {
        shopifySubmission = {
          status: 'legacy_unreadable',
          connectionId: latestShopifyConnection.id,
          shopDomain,
          submittedAt: latestShopifyConnection.createdAt.toISOString(),
        };
      } else {
        shopifySubmission = {
          status: 'pending_client',
        };
      }
    }

    const clientConnections = await prisma.clientConnection.findMany({
      where: { accessRequestId: accessRequest.id },
      select: {
        grantedAssets: true,
        authorizations: {
          select: {
            platform: true,
            status: true,
          },
        },
      },
    });
    const authorizationProgress = evaluateAuthorizationProgress(
      requestedProducts,
      clientConnections as any
    );

    return {
      data: {
        ...accessRequest,
        platforms: hierarchicalPlatforms,
        authorizationProgress,
        ...(shopifySubmission ? { shopifySubmission } : {}),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve access request',
      },
    };
  }
}

export async function findByAgentOperation(agencyId: string, operationId: string) {
  try {
    const accessRequest = await prisma.accessRequest.findFirst({
      where: { agencyId, externalReference: `agent-operation:${operationId}` },
    });
    return { data: accessRequest, error: null };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to locate agent access request' } };
  }
}

/**
 * Get access request by unique token (for client authorization flow)
 */
export async function getAccessRequestByToken(token: string) {
  try {
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { uniqueToken: token },
    });

    if (!accessRequest) {
      return {
        data: null,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Access request not found',
        },
      };
    }

    // Check if expired
    if (accessRequest.expiresAt < new Date()) {
      return {
        data: null,
        error: {
          code: 'REQUEST_EXPIRED',
          message: 'Access request has expired',
        },
      };
    }

    // Transform platforms from flat to hierarchical format for frontend.
    const platforms = accessRequest.platforms as any[];
    const hierarchicalPlatforms = Array.isArray(platforms) && platforms.length > 0 && platforms[0]?.platform
      ? transformPlatformsToHierarchical(platforms)
      : platforms; // Already in hierarchical format or empty

    const requestedPlatformGroups = Array.isArray(hierarchicalPlatforms)
      ? hierarchicalPlatforms
          .map((group: any) => group?.platformGroup)
          .filter((group: unknown): group is string => typeof group === 'string')
      : [];
    const requestedProducts = extractRequestedProducts(hierarchicalPlatforms);

    const [agency, platformConnections, clientConnections] = await Promise.all([
      prisma.agency.findUnique({
        where: { id: accessRequest.agencyId },
        select: { name: true },
      }),
      requestedPlatformGroups.length > 0
        ? prisma.agencyPlatformConnection.findMany({
            where: {
              agencyId: accessRequest.agencyId,
              platform: { in: requestedPlatformGroups },
              status: 'active',
            },
            select: {
              platform: true,
              agencyEmail: true,
              businessId: true,
              connectedBy: true,
              metadata: true,
            },
          })
        : Promise.resolve([]),
      prisma.clientConnection.findMany({
        where: { accessRequestId: accessRequest.id },
        select: {
          grantedAssets: true,
          authorizations: {
            select: {
              platform: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const manualInviteTargets = requestedPlatformGroups.reduce((acc, platform) => {
      acc[platform] = {};
      return acc;
    }, {} as Record<string, {
      agencyEmail?: string;
      businessId?: string;
      shopDomain?: string;
      collaboratorCode?: string;
    }>);

    for (const connection of platformConnections) {
      manualInviteTargets[connection.platform] = getIdentityFromConnection(connection);
    }

    const authorizationProgress = evaluateAuthorizationProgress(
      requestedProducts,
      clientConnections as any,
      platformConnections as any
    );

    return {
      data: {
        ...accessRequest,
        agencyName: agency?.name || 'Agency',
        platforms: hierarchicalPlatforms,
        manualInviteTargets,
        authorizationProgress,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve access request',
      },
    };
  }
}

/**
 * Get all access requests for an agency
 */
export async function getAgencyAccessRequests(
  agencyId: string,
  filters?: { status?: AccessRequestStatus; limit?: number; offset?: number }
) {
  try {
    const where: any = { agencyId };
    if (filters?.status) {
      where.status = filters.status;
    }

    const requests = await prisma.accessRequest.findMany({
      where,
      select: {
        id: true,
        agencyId: true,
        clientId: true,
        clientName: true,
        clientEmail: true,
        externalReference: true,
        platforms: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        authorizedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: resolveListLimit(filters?.limit),
      skip: resolveListOffset(filters?.offset),
    });

    // Transform platforms from flat to hierarchical format for frontend
    const transformedRequests = requests.map((request: any) => {
      const platforms = request.platforms as any[];
      const hierarchicalPlatforms = Array.isArray(platforms) && platforms.length > 0 && platforms[0]?.platform
        ? transformPlatformsToHierarchical(platforms)
        : platforms; // Already in hierarchical format or empty

      return {
        ...request,
        platforms: hierarchicalPlatforms,
      };
    });

    return { data: transformedRequests, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve access requests',
      },
    };
  }
}

/**
 * Get lightweight dashboard access request summaries.
 * Returns only the latest rows required for dashboard rendering.
 */
export async function getDashboardAccessRequestSummaries(
  agencyId: string,
  limit: number,
  options: { includeTotal?: boolean } = {}
): Promise<{ data: { items: DashboardRequestSummary[]; total: number } | null; error: any }> {
  try {
    const includeTotal = options.includeTotal ?? true;
    // Exclude orphaned requests (clientId null) and inactive requests (revoked, expired)
    // Dashboard should only show active requests: pending, partial, completed
    const where = {
      agencyId,
      clientId: { not: null },
      status: { in: ['pending', 'partial', 'completed'] },
    };
    const requestsPromise = prisma.accessRequest.findMany({
      where,
      select: {
        id: true,
        clientId: true,
        clientName: true,
        clientEmail: true,
        status: true,
        createdAt: true,
        uniqueToken: true,
        platforms: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const totalPromise = includeTotal
      ? prisma.accessRequest.count({ where })
      : Promise.resolve<number | null>(null);
    const [requests, total] = await Promise.all([requestsPromise, totalPromise]);

    const activeStatuses = new Set(['pending', 'partial', 'completed']);
    const items: DashboardRequestSummary[] = requests
      .filter((request) => request.clientId && activeStatuses.has(request.status))
      .map((request) => ({
        id: request.id,
        clientId: request.clientId,
        clientName: request.clientName,
        clientEmail: request.clientEmail,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
        uniqueToken: request.uniqueToken,
        platforms: extractDashboardPlatformGroups(request.platforms),
      }));

    return {
      data: {
        items,
        total: total ?? items.length,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve dashboard access request summaries',
      },
    };
  }
}

/**
 * Update access request
 */
export async function updateAccessRequest(
  id: string,
  input: UpdateAccessRequestInput
) {
  try {
    const existing = await prisma.accessRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        agencyId: true,
      },
    });

    if (!existing) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Access request not found',
        },
      };
    }

    if (existing.status !== 'pending' && existing.status !== 'partial') {
      return {
        data: null,
        error: {
          code: 'REQUEST_NOT_EDITABLE',
          message: 'Only pending or partial requests can be edited',
        },
      };
    }

    const validated = updateAccessRequestSchema.parse(input);
    const updateData: Record<string, unknown> = { ...validated };
    if (validated.status === 'completed') {
      updateData.authorizedAt = new Date();
    }

    const accessRequest = await prisma.accessRequest.update({
      where: { id },
      data: updateData,
    });

    await invalidateDashboardCache(existing.agencyId);
    await emitAccessRequestLifecycleWebhook({
      accessRequestId: id,
      previousStatus: existing.status,
      nextStatus: accessRequest.status,
    });

    return {
      data: {
        ...accessRequest,
        authorizationLinkChanged: false,
      },
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      };
    }

    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Access request not found',
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update access request',
      },
    };
  }
}

/**
 * Mark access request as authorized (when client completes OAuth)
 */
export async function markRequestAuthorized(requestId: string) {
  try {
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        platforms: true,
      },
    });

    if (!accessRequest) {
      return {
        data: null,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Access request not found',
        },
      };
    }

    const clientConnections = await prisma.clientConnection.findMany({
      where: { accessRequestId: requestId },
      select: {
        grantedAssets: true,
        authorizations: {
          select: {
            platform: true,
            status: true,
          },
        },
      },
    });

    const requestedProducts = extractRequestedProducts(accessRequest.platforms);
    const authorizationProgress = evaluateAuthorizationProgress(
      requestedProducts,
      clientConnections as any
    );

    return await setAccessRequestLifecycleStatus(
      requestId,
      authorizationProgress.isComplete ? 'completed' : 'partial'
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return {
        data: null,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Access request not found',
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update access request',
      },
    };
  }
}

/**
 * Cancel an access request
 */
export async function cancelAccessRequest(id: string) {
  try {
    const existing = await prisma.accessRequest.findUnique({
      where: { id },
      select: { agencyId: true, status: true },
    });

    await prisma.accessRequest.update({
      where: { id },
      data: { status: 'revoked' },
    });

    // Emit access_request.revoked webhook
    if (existing && existing.status !== 'revoked') {
      await emitAccessRequestLifecycleWebhook({
        accessRequestId: id,
        previousStatus: existing.status,
        nextStatus: 'revoked',
      });
    }

    if (existing?.agencyId) {
      await invalidateDashboardCache(existing.agencyId);
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Access request not found',
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cancel access request',
      },
    };
  }
}

/**
 * Delete expired access requests (cleanup job)
 */
export async function deleteExpiredRequests() {
  try {
    const result = await prisma.accessRequest.deleteMany({
      where: {
        status: 'expired',
        expiresAt: {
          lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Expired more than 90 days ago
        },
      },
    });

    return {
      data: {
        deleted: result.count,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete expired requests',
      },
    };
  }
}

/**
 * Access Request Service
 * Exports all access request-related service functions as a single object
 */
export const accessRequestService = {
  createAccessRequest,
  getAccessRequestById,
  findByAgentOperation,
  getAccessRequestByToken,
  getAgencyAccessRequests,
  getDashboardAccessRequestSummaries,
  updateAccessRequest,
  markRequestAuthorized,
  cancelAccessRequest,
  deleteExpiredRequests,
  generateUniqueToken,
};
