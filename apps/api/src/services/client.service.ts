/**
 * Client Service
 *
 * Business logic for client CRUD operations.
 * Part of Phase 5: Enhanced Access Request Creation.
 */

import { invalidateDashboardCache } from '@/lib/cache';
import { infisical } from '@/lib/infisical';
import { prisma } from '@/lib/prisma';
import {
  GOOGLE_PLATFORM_PRODUCT_IDS,
  evaluateGoogleProductFulfillment,
  platformGroupOf,
  type ClientLanguage,
  type GooglePlatformProductId,
  type GoogleProductFulfillmentMode,
  type GoogleProductGrantLifecycle,
  type ClientDetailProductStatus,
  type ClientDetailPlatformGroupStatus,
} from '@agency-platform/shared';
import type { Prisma } from '@prisma/client';

type Client = Prisma.ClientGetPayload<{}>;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Error codes
export const ClientError = {
  EMAIL_EXISTS: 'CLIENT_EMAIL_EXISTS',
  INVALID_EMAIL: 'CLIENT_INVALID_EMAIL',
  NOT_FOUND: 'CLIENT_NOT_FOUND',
} as const;

// Input types
export interface CreateClientDto {
  id?: string;
  agencyId: string;
  name: string;
  company: string;
  email: string;
  website?: string;
  language?: ClientLanguage;
}

export interface GetClientsDto {
  agencyId: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateClientDto {
  name?: string;
  company?: string;
  email?: string;
  website?: string;
  language?: ClientLanguage;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Create a new client
 * @throws {Error} CLIENT_EMAIL_EXISTS if email already exists for this agency
 * @throws {Error} CLIENT_INVALID_EMAIL if email format is invalid
 */
export async function createClient(dto: CreateClientDto): Promise<Client> {
  const { id, agencyId, email, language = 'en', ...rest } = dto;

  // Validate email format
  if (!EMAIL_REGEX.test(email)) {
    throw new Error(ClientError.INVALID_EMAIL);
  }

  // Check for duplicate email within the agency
  const existing = await prisma.client.findFirst({
    where: {
      agencyId,
      email,
    },
  });

  if (existing) {
    throw new Error(ClientError.EMAIL_EXISTS);
  }

  // Create client
  const client = await prisma.client.create({
    data: {
      ...rest,
      ...(id ? { id } : {}),
      agencyId,
      email,
      language,
    },
  });

  return client;
}

/**
 * Get clients for an agency with optional search and pagination
 */
export async function getClients(
  dto: GetClientsDto
): Promise<PaginatedResult<Client>> {
  const { agencyId, search, limit = 50, offset = 0 } = dto;

  // Build where clause
  const where: any = { agencyId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Get clients and total count in parallel
  const [data, total] = await Promise.all([
    prisma.client.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.count({ where }),
  ]);

  return {
    data,
    pagination: {
      total,
      limit,
      offset,
    },
  };
}

/**
 * Get a client by ID
 * @returns Client or null if not found
 */
export async function getClientById(
  id: string,
  agencyId: string
): Promise<Client | null> {
  return prisma.client.findFirst({
    where: { id, agencyId },
  });
}

export const clientService = {
  createClient,
  getClients,
  getClientById,
  updateClient,
  findClientByEmail,
  deleteClient,
  getClientsWithConnections,
  getClientDetail,
};

/**
 * Update a client
 * @throws {Error} CLIENT_EMAIL_EXISTS if new email already exists for another client
 * @returns Updated client or null if not found
 */
export async function updateClient(
  id: string,
  agencyId: string,
  dto: UpdateClientDto
): Promise<Client | null> {
  // Check if client exists
  const existing = await prisma.client.findFirst({
    where: { id, agencyId },
  });

  if (!existing) {
    return null;
  }

  // If updating email, check for duplicates
  if (dto.email && dto.email !== existing.email) {
    // Validate email format
    if (!EMAIL_REGEX.test(dto.email)) {
      throw new Error(ClientError.INVALID_EMAIL);
    }

    const duplicate = await prisma.client.findFirst({
      where: {
        agencyId,
        email: dto.email,
        id: { not: id },
      },
    });

    if (duplicate) {
      throw new Error(ClientError.EMAIL_EXISTS);
    }
  }

  // Update client
  const updated = await prisma.client.update({
    where: { id },
    data: dto,
  });

  return updated;
}

/**
 * Find a client by email within an agency
 * @returns Client or null if not found
 */
export async function findClientByEmail(
  agencyId: string,
  email: string
): Promise<Client | null> {
  return prisma.client.findFirst({
    where: {
      agencyId,
      email,
    },
  });
}

/**
 * Delete a client and all associated access requests.
 * Cleans up Infisical secrets for any platform authorizations before cascade delete.
 * @returns true if deleted, false if not found or not in agency
 */
export async function deleteClient(
  id: string,
  agencyId: string
): Promise<boolean> {
  const existing = await prisma.client.findUnique({
    where: { id },
    include: {
      accessRequests: {
        include: {
          connection: {
            include: { authorizations: true },
          },
        },
      },
    },
  });

  if (!existing || existing.agencyId !== agencyId) {
    return false;
  }

  // Delete all Infisical secrets before the cascade. Fail closed if any delete
  // fails so the client row is not removed while secrets remain.
  const authorizations = (existing.accessRequests ?? []).flatMap((req) =>
    req.connection?.authorizations ?? [],
  );
  const deletionResults = await Promise.allSettled(
    authorizations.map((auth) => infisical.deleteSecret(auth.secretId)),
  );
  const deletionFailure = deletionResults.find((result) => result.status === 'rejected');
  if (deletionFailure) {
    throw deletionFailure.reason;
  }

  await prisma.client.delete({
    where: { id },
  });

  await invalidateDashboardCache(agencyId);

  return true;
}

/**
 * Get clients with enriched connection and platform data
 */
export async function getClientsWithConnections(
  dto: GetClientsDto
): Promise<PaginatedResult<any>> {
  const { agencyId, search, limit = 50, offset = 0 } = dto;

  // Build where clause
  const where: any = { agencyId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Get clients with only their latest access request (list view needs status/platforms from latest only)
  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        accessRequests: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            connection: {
              include: {
                authorizations: { select: { platform: true } },
              },
            },
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.count({ where }),
  ]);

  // Transform to enriched format (one request per client due to take: 1)
  const enrichedClients = clients.map((client) => {
    const requests = client.accessRequests || [];
    const latestRequest = requests[0];
    const connection = latestRequest?.connection;
    const authorizations = connection?.authorizations || [];

    // Determine status
    let status: 'active' | 'pending' | 'expired' | 'revoked' | 'none' = 'none';
    if (connection && connection.status === 'active') {
      status = 'active';
    } else if (latestRequest && latestRequest.status === 'pending') {
      status = 'pending';
    } else if (connection && connection.status === 'revoked') {
      status = 'revoked';
    } else if (latestRequest && latestRequest.status === 'expired') {
      status = 'expired';
    }

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      company: client.company,
      platforms: authorizations.map((auth) => auth.platform),
      status,
      connectionCount: connection ? 1 : 0,
      lastActivityAt: latestRequest?.createdAt || client.createdAt,
      createdAt: client.createdAt,
    };
  });

  return {
    data: enrichedClients,
    pagination: {
      total,
      limit,
      offset,
    },
  };
}

// ============================================================
// CLIENT DETAIL PAGE TYPES
// ============================================================

export interface ClientDetailDto {
  clientId: string;
  agencyId: string;
}

export interface ClientDetailResponse {
  client: {
    id: string;
    name: string;
    company: string;
    email: string;
    website: string | null;
    language: ClientLanguage;
    createdAt: Date;
    updatedAt: Date;
  };
  stats: {
    totalRequests: number;
    activeConnections: number;
    pendingConnections: number;
    expiredConnections: number;
  };
  platformGroups: Array<{
    platformGroup: string;
    status: ClientDetailPlatformGroupStatus;
    fulfilledCount: number;
    requestedCount: number;
    latestRequestId?: string;
    latestRequestName?: string;
    latestRequestedAt?: Date;
    products: Array<{
      product: string;
      status: ClientDetailProductStatus;
      note?: string;
      latestRequestId?: string;
    }>;
  }>;
  accessRequests: Array<{
    id: string;
    name: string;
    platforms: string[];
    status: string;
    createdAt: Date;
    authorizedAt?: Date | null;
    connectionId?: string | null;
    connectionStatus?: string | null;
  }>;
  activity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }>;
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

type ClientDetailRequestedProduct = {
  product: string;
  platformGroup: string;
};

type ClientDetailAccessRequestRecord = {
  id: string;
  clientName: string;
  status: string;
  createdAt: Date;
  authorizedAt?: Date | null;
  platforms: unknown;
  connection?: {
    id?: string;
    status?: string | null;
    createdAt?: Date;
    revokedAt?: Date | null;
    grantedAssets?: unknown;
    authorizations?: Array<{
      platform: string;
      status: string;
      metadata?: unknown;
    }>;
  } | null;
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

function normalizePlatformGroup(platform: string): string {
  return platformGroupOf(platform);
}

function isActiveAuthorizationStatus(status?: string | null): boolean {
  return status === 'active';
}

function isGooglePlatformProduct(product: string): product is GooglePlatformProductId {
  return GOOGLE_PRODUCT_ID_SET.has(product);
}

function extractRequestedProducts(platforms: unknown): ClientDetailRequestedProduct[] {
  const requestedProducts: ClientDetailRequestedProduct[] = [];

  if (Array.isArray(platforms)) {
    for (const entry of platforms) {
      if (!entry) continue;

      if (typeof entry === 'string') {
        requestedProducts.push({
          product: entry,
          platformGroup: normalizePlatformGroup(entry),
        });
        continue;
      }

      if (typeof entry !== 'object') continue;

      const maybeGroup = (entry as any).platformGroup;
      const maybeProducts = (entry as any).products;
      if (typeof maybeGroup === 'string' && Array.isArray(maybeProducts)) {
        for (const product of maybeProducts) {
          const maybeProduct =
            typeof product === 'string' ? product : typeof product?.product === 'string' ? product.product : null;
          if (maybeProduct) {
            requestedProducts.push({
              product: maybeProduct,
              platformGroup: maybeGroup,
            });
          }
        }
        continue;
      }

      const maybePlatform = (entry as any).platform;
      if (typeof maybePlatform === 'string') {
        requestedProducts.push({
          product: maybePlatform,
          platformGroup: normalizePlatformGroup(maybePlatform),
        });
      }
    }

    return requestedProducts;
  }

  if (platforms && typeof platforms === 'object') {
    for (const [platformGroup, products] of Object.entries(platforms as Record<string, unknown>)) {
      if (!Array.isArray(products)) continue;

      for (const product of products) {
        if (typeof product !== 'string') continue;
        requestedProducts.push({
          product,
          platformGroup,
        });
      }
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

function resolveGoogleGrantLifecycle(
  requestedProduct: ClientDetailRequestedProduct,
  matchingAuthorization:
    | {
        platform: string;
        status: string;
        metadata?: unknown;
      }
    | undefined,
  selectedAssets: Record<string, any> | null
): GoogleProductGrantLifecycle | undefined {
  if (!isGooglePlatformProduct(requestedProduct.product)) {
    return undefined;
  }

  const authorizationMetadata =
    matchingAuthorization?.metadata && typeof matchingAuthorization.metadata === 'object'
      ? (matchingAuthorization.metadata as Record<string, any>)
      : null;

  const storedLifecycleSource =
    (selectedAssets &&
      selectedAssets.googleGrantLifecycle &&
      typeof selectedAssets.googleGrantLifecycle === 'object'
      ? selectedAssets.googleGrantLifecycle
      : null) ||
    (authorizationMetadata &&
    authorizationMetadata.googleGrantLifecycle &&
    typeof authorizationMetadata.googleGrantLifecycle === 'object'
      ? authorizationMetadata.googleGrantLifecycle
      : null);

  const storedLifecycle = storedLifecycleSource as Partial<GoogleProductGrantLifecycle> | null;

  const fulfillmentMode =
    typeof storedLifecycle?.fulfillmentMode === 'string'
      ? (storedLifecycle.fulfillmentMode as GoogleProductFulfillmentMode)
      : GOOGLE_DEFAULT_FULFILLMENT_MODE[requestedProduct.product as GooglePlatformProductId];

  const grantStatus =
    typeof storedLifecycle?.grantStatus === 'string' ? storedLifecycle.grantStatus : undefined;

  return evaluateGoogleProductFulfillment({
    productId: requestedProduct.product as GooglePlatformProductId,
    hasOAuthAuthorization: Boolean(
      matchingAuthorization && isActiveAuthorizationStatus(matchingAuthorization.status)
    ),
    fulfillmentMode,
    grantStatus,
  });
}

function resolveProductSummary(
  request: ClientDetailAccessRequestRecord,
  requestedProduct: ClientDetailRequestedProduct
): {
  status: ClientDetailProductStatus;
  googleGrantLifecycle?: GoogleProductGrantLifecycle;
} {
  const connectionStatus = request.connection?.status;
  const authorizations = request.connection?.authorizations || [];

  if (request.status === 'revoked' || connectionStatus === 'revoked') {
    return { status: 'revoked' };
  }

  if (request.status === 'expired' || connectionStatus === 'expired') {
    return { status: 'expired' };
  }

  const matchingAuthorization = authorizations.find(
    (authorization) =>
      authorization.platform === requestedProduct.product ||
      normalizePlatformGroup(authorization.platform) === requestedProduct.platformGroup
  );

  if (!ASSET_SELECTING_PRODUCTS.has(requestedProduct.product)) {
    if (
      matchingAuthorization &&
      isActiveAuthorizationStatus(matchingAuthorization.status)
    ) {
      return { status: 'connected' };
    }

    const grantedAssets =
      (request.connection?.grantedAssets as Record<string, unknown> | null) || null;
    const grantedPlatform =
      grantedAssets && typeof grantedAssets.platform === 'string'
        ? grantedAssets.platform
        : null;

    if (
      grantedPlatform &&
      (grantedPlatform === requestedProduct.product ||
        normalizePlatformGroup(grantedPlatform) === requestedProduct.platformGroup)
    ) {
      return { status: 'connected' };
    }

    // The client DID authorize (rows are only created at token exchange), but
    // the grant is no longer active: the platform revoked it or the credential
    // died. That is lost access, not "waiting on the client" — report it as
    // needs_reconnect. Never-authorized products (no row) stay pending.
    if (matchingAuthorization) {
      return { status: 'needs_reconnect' };
    }

    return { status: 'pending' };
  }

  const selectedAssets =
    request.connection?.grantedAssets &&
    typeof request.connection.grantedAssets === 'object' &&
    requestedProduct.product in (request.connection.grantedAssets as Record<string, unknown>)
      ? ((request.connection.grantedAssets as Record<string, unknown>)[requestedProduct.product] as Record<string, any> | null)
      : null;

  const googleGrantLifecycle = resolveGoogleGrantLifecycle(
    requestedProduct,
    matchingAuthorization,
    selectedAssets
  );

  if (selectedAssets) {
    if (getSelectedAssetCount(requestedProduct.product, selectedAssets) > 0) {
      if (googleGrantLifecycle && !googleGrantLifecycle.isFulfilled) {
        return { status: 'pending', googleGrantLifecycle };
      }

      return { status: 'connected', ...(googleGrantLifecycle ? { googleGrantLifecycle } : {}) };
    }

    if (hasNoAssetsSignal(requestedProduct.product, selectedAssets)) {
      return { status: 'no_assets', ...(googleGrantLifecycle ? { googleGrantLifecycle } : {}) };
    }
  }

  if (matchingAuthorization && isActiveAuthorizationStatus(matchingAuthorization.status)) {
    const metadata =
      matchingAuthorization.metadata && typeof matchingAuthorization.metadata === 'object'
        ? (matchingAuthorization.metadata as Record<string, any>)
        : null;

    if (metadata && hasNoAssetsSignal(requestedProduct.product, metadata)) {
      return { status: 'no_assets', ...(googleGrantLifecycle ? { googleGrantLifecycle } : {}) };
    }

    return {
      status: 'selection_required',
      ...(googleGrantLifecycle ? { googleGrantLifecycle } : {}),
    };
  }

  return { status: 'pending', ...(googleGrantLifecycle ? { googleGrantLifecycle } : {}) };
}

function getProductStatusPriority(status: ClientDetailProductStatus): number {
  switch (status) {
    case 'revoked':
      return 7;
    case 'expired':
      return 6;
    case 'needs_reconnect':
      // Lost access outranks a live grant so a newer dead state wins over an
      // older connected summary for the same product.
      return 5;
    case 'connected':
      return 4;
    case 'no_assets':
      return 3;
    case 'selection_required':
      return 2;
    case 'pending':
    default:
      return 1;
  }
}

function getProductStatusNote(status: ClientDetailProductStatus): string | undefined {
  switch (status) {
    case 'selection_required':
      return 'Selection required';
    case 'no_assets':
      return 'No assets found';
    default:
      return undefined;
  }
}

function buildClientDetailPlatformGroups(
  accessRequests: ClientDetailAccessRequestRecord[]
): ClientDetailResponse['platformGroups'] {
  const groupedProducts = new Map<
    string,
    {
      latestRequestId?: string;
      latestRequestName?: string;
      latestRequestedAt?: Date;
      products: Map<
        string,
        {
          status: ClientDetailProductStatus;
          latestRequestId?: string;
          googleGrantLifecycle?: GoogleProductGrantLifecycle;
        }
      >;
    }
  >();

  for (const request of accessRequests) {
    const requestedProducts = extractRequestedProducts(request.platforms);

    for (const requestedProduct of requestedProducts) {
      const groupKey = requestedProduct.platformGroup;
      const currentGroup =
        groupedProducts.get(groupKey) ||
        {
          latestRequestId: request.id,
          latestRequestName: request.clientName,
          latestRequestedAt: request.createdAt,
          products: new Map<
            string,
            {
              status: ClientDetailProductStatus;
              latestRequestId?: string;
              googleGrantLifecycle?: GoogleProductGrantLifecycle;
            }
          >(),
        };

      if (!groupedProducts.has(groupKey)) {
        groupedProducts.set(groupKey, currentGroup);
      }

      const nextProductSummary = resolveProductSummary(request, requestedProduct);
      const existingProduct = currentGroup.products.get(requestedProduct.product);

      if (
        !existingProduct ||
        getProductStatusPriority(nextProductSummary.status) >
          getProductStatusPriority(existingProduct.status)
      ) {
        currentGroup.products.set(requestedProduct.product, {
          status: nextProductSummary.status,
          latestRequestId: request.id,
          ...(nextProductSummary.googleGrantLifecycle
            ? { googleGrantLifecycle: nextProductSummary.googleGrantLifecycle }
            : {}),
        });
      }
    }
  }

  return Array.from(groupedProducts.entries()).map(([platformGroup, group]) => {
    const products = Array.from(group.products.entries())
      .map(([product, productSummary]) => ({
        product,
        status: productSummary.status,
        note: getProductStatusNote(productSummary.status),
        latestRequestId: productSummary.latestRequestId,
        ...(productSummary.googleGrantLifecycle
          ? { googleGrantLifecycle: productSummary.googleGrantLifecycle }
          : {}),
      }))
      .sort((left, right) => left.product.localeCompare(right.product));

    const requestedCount = products.length;
    const fulfilledCount = products.filter((product) => product.status === 'connected').length;
    const hasRevoked = products.some((product) => product.status === 'revoked');
    const hasExpired = products.some((product) => product.status === 'expired');
    const hasFollowUp = products.some((product) =>
      product.status === 'selection_required' ||
      product.status === 'no_assets' ||
      product.status === 'needs_reconnect'
    );

    let status: ClientDetailPlatformGroupStatus = 'pending';

    if (requestedCount > 0 && fulfilledCount === requestedCount) {
      status = 'connected';
    } else if (hasRevoked && fulfilledCount === 0) {
      status = 'revoked';
    } else if (hasExpired && fulfilledCount === 0 && !hasFollowUp) {
      status = 'expired';
    } else if (hasFollowUp) {
      status = 'needs_follow_up';
    } else if (fulfilledCount > 0) {
      status = 'partial';
    } else {
      status = 'pending';
    }

    return {
      platformGroup,
      status,
      fulfilledCount,
      requestedCount,
      latestRequestId: group.latestRequestId,
      latestRequestName: group.latestRequestName,
      latestRequestedAt: group.latestRequestedAt,
      products,
    };
  });
}

/**
 * Get detailed client information including stats, access requests, and activity timeline
 * @returns Client detail response or null if client not found
 */
export async function getClientDetail(
  dto: ClientDetailDto
): Promise<ClientDetailResponse | null> {
  const { clientId, agencyId } = dto;

  // Fetch client with all related data
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      agencyId: true,
      name: true,
      company: true,
      email: true,
      website: true,
      language: true,
      createdAt: true,
      updatedAt: true,
      accessRequests: {
        select: {
          id: true,
          clientName: true,
          status: true,
          createdAt: true,
          authorizedAt: true,
          platforms: true,
          connection: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              revokedAt: true,
              grantedAssets: true,
              authorizations: {
                select: {
                  platform: true,
                  status: true,
                  metadata: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!client) {
    return null;
  }

  // Verify agency ownership
  if (client.agencyId !== agencyId) {
    return null;
  }

  // Parse platforms from each access request
  const accessRequestsWithPlatforms = client.accessRequests.map((request) => {
    // Parse platforms from JSON - handle both hierarchical and flat formats
    let platforms: string[] = [];
    const platformsData = request.platforms as any;

    if (platformsData) {
      if (typeof platformsData === 'object') {
        // Hierarchical format: { google: ['google_ads', 'ga4'], meta: ['meta_ads'] }
        for (const group in platformsData) {
          const groupPlatforms = platformsData[group];
          if (Array.isArray(groupPlatforms)) {
            platforms.push(...groupPlatforms);
          }
        }
      } else if (Array.isArray(platformsData)) {
        platforms = platformsData;
      }
    }

    const connection = request.connection;
    const connectionStatus = connection?.status || null;
    const authorizations = connection?.authorizations || [];

    // Override platforms with actual authorizations if connection exists
    if (authorizations.length > 0) {
      platforms = authorizations.map((auth) => auth.platform);
    }

    return {
      id: request.id,
      name: request.clientName,
      platforms,
      status: request.status,
      createdAt: request.createdAt,
      authorizedAt: request.authorizedAt,
      connectionId: connection?.id,
      connectionStatus,
    };
  });

  // Calculate stats
  const totalRequests = client.accessRequests.length;
  const activeConnections = client.accessRequests.filter(
    (r) => r.connection?.status === 'active'
  ).length;
  const pendingConnections = client.accessRequests.filter(
    (r) => r.status === 'pending' || r.status === 'partial'
  ).length;
  const expiredConnections = client.accessRequests.filter(
    (r) => r.status === 'expired' || r.connection?.status === 'expired'
  ).length;
  const platformGroups = buildClientDetailPlatformGroups(
    client.accessRequests as ClientDetailAccessRequestRecord[]
  );

  // Build activity timeline from request and connection events
  const activity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }> = [];

  for (const request of client.accessRequests) {
    // Request created
    activity.push({
      id: `request-${request.id}-created`,
      type: 'request_created',
      description: `Access request "${request.clientName}" was created`,
      timestamp: request.createdAt,
      metadata: {
        requestName: request.clientName,
        platforms: accessRequestsWithPlatforms.find((ar) => ar.id === request.id)?.platforms || [],
      },
    });

    // Connection created (when authorized)
    if (request.authorizedAt) {
      activity.push({
        id: `request-${request.id}-authorized`,
        type: 'request_completed',
        description: `Client authorized access for "${request.clientName}"`,
        timestamp: request.authorizedAt,
        metadata: {
          requestName: request.clientName,
          platforms: accessRequestsWithPlatforms.find((ar) => ar.id === request.id)?.platforms || [],
          status: request.status,
        },
      });
    }

    // Connection created
    if (request.connection) {
      activity.push({
        id: `connection-${request.connection.id}-created`,
        type: 'connection_created',
        description: `Connection established for "${request.clientName}"`,
        timestamp: request.connection.createdAt,
        metadata: {
          requestName: request.clientName,
          platforms: accessRequestsWithPlatforms.find((ar) => ar.id === request.id)?.platforms || [],
        },
      });
    }

    // Connection revoked
    if (request.connection?.revokedAt) {
      activity.push({
        id: `connection-${request.connection.id}-revoked`,
        type: 'connection_revoked',
        description: `Access revoked for "${request.clientName}"`,
        timestamp: request.connection.revokedAt,
        metadata: {
          requestName: request.clientName,
          platforms: accessRequestsWithPlatforms.find((ar) => ar.id === request.id)?.platforms || [],
          status: request.connection.status,
        },
      });
    }
  }

  // Client updated event
  if (client.updatedAt > client.createdAt) {
    activity.push({
      id: `client-${client.id}-updated`,
      type: 'client_updated',
      description: 'Client information was updated',
      timestamp: client.updatedAt,
    });
  }

  // Sort activity by timestamp descending (newest first)
  activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    client: {
      id: client.id,
      name: client.name,
      company: client.company,
      email: client.email,
      website: client.website,
      language: client.language as ClientLanguage,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    },
    stats: {
      totalRequests,
      activeConnections,
      pendingConnections,
      expiredConnections,
    },
    platformGroups,
    accessRequests: accessRequestsWithPlatforms,
    activity,
  };
}
