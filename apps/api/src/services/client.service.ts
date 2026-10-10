/**
 * Client Service
 *
 * Business logic for client CRUD operations.
 * Part of Phase 5: Enhanced Access Request Creation.
 */

import { invalidateDashboardCache } from '@/lib/cache';
import { ASSET_SELECTING_PRODUCTS } from '@/lib/asset-selecting-products';
import {
  getSelectedAssetCount,
  hasNoAssetsSignal,
} from '@/lib/product-selection-signals';
import {
  resolveGoogleGrantLifecycle,
  type GoogleAgencyPlatformConnectionSummary,
} from '@/lib/google-grant-lifecycle-resolver';
import { prisma } from '@/lib/prisma';
import { connectionService } from '@/services/connection.service';
import { evaluateMetaProductFulfillment } from '@/lib/meta-product-fulfillment';
import {
  platformGroupOf,
  type ClientLanguage,
  type GoogleProductGrantLifecycle,
  type ClientDetailProductStatus,
  type ClientDetailPlatformGroupStatus,
} from '@agency-platform/shared';
import type { Prisma } from '@prisma/client';
import { EXTERNAL_ID_CONFLICT_CODE } from '@/services/idempotency.service.js';

type Client = Prisma.ClientGetPayload<{}>;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Error codes
export const ClientError = {
  EMAIL_EXISTS: 'CLIENT_EMAIL_EXISTS',
  INVALID_EMAIL: 'CLIENT_INVALID_EMAIL',
  NOT_FOUND: 'CLIENT_NOT_FOUND',
  /** Duplicate Client.externalClientId within one agency; settable at creation, immutable after. */
  EXTERNAL_ID_CONFLICT: EXTERNAL_ID_CONFLICT_CODE,
  /** Client.externalClientId is set at creation and immutable after. */
  EXTERNAL_ID_IMMUTABLE: 'EXTERNAL_ID_IMMUTABLE',
} as const;

/** True for Prisma unique-violation errors (P2002). */
function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** True when the P2002 target names the agency-scoped external-ID guard. */
function isExternalIdViolation(error: unknown): boolean {
  if (!isUniqueViolation(error)) return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target) && target.includes('externalClientId');
}

// Input types
export interface CreateClientDto {
  id?: string;
  agencyId: string;
  name: string;
  company: string;
  email: string;
  website?: string;
  language?: ClientLanguage;
  /**
   * Agency-scoped immutable CRM join key (KTD4; R6). Settable at creation
   * only; duplicates within the agency fail with EXTERNAL_ID_CONFLICT.
   */
  externalClientId?: string;
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
 * @throws {Error} EXTERNAL_ID_CONFLICT if externalClientId is taken in this agency
 */
export async function createClient(dto: CreateClientDto): Promise<Client> {
  const { id, agencyId, email, language = 'en', externalClientId, ...rest } = dto;

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

  // Create client; the composite guard maps in-agency external-ID
  // duplicates to EXTERNAL_ID_CONFLICT (KTD4). Cross-agency reuse succeeds.
  try {
    const client = await prisma.client.create({
      data: {
        ...rest,
        ...(id ? { id } : {}),
        agencyId,
        email,
        language,
        ...(externalClientId !== undefined ? { externalClientId } : {}),
      },
    });

    return client;
  } catch (error) {
    if (isExternalIdViolation(error)) {
      throw new Error(ClientError.EXTERNAL_ID_CONFLICT);
    }
    if (isUniqueViolation(error)) {
      throw new Error(ClientError.EMAIL_EXISTS);
    }
    throw error;
  }
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
  getClientByExternalId,
  updateClient,
  findClientByEmail,
  deleteClient,
  getClientsWithConnections,
  getClientDetail,
};

/**
 * Get a client by its agency-scoped immutable external ID (R6, R11).
 * Resolves the row directly; never falls back to a scan.
 */
export async function getClientByExternalId(
  agencyId: string,
  externalClientId: string
): Promise<Client | null> {
  return prisma.client.findFirst({
    where: { agencyId, externalClientId },
  });
}

/**
 * Update a client
 * @throws {Error} CLIENT_EMAIL_EXISTS if new email already exists for another client
 * @throws {Error} EXTERNAL_ID_IMMUTABLE if externalClientId is present (immutable, KTD4)
 * @returns Updated client or null if not found
 */
export async function updateClient(
  id: string,
  agencyId: string,
  dto: UpdateClientDto
): Promise<Client | null> {
  // External IDs are set at creation and immutable after: the field is
  // absent from UpdateClientDto, and this runtime guard rejects untyped
  // callers that smuggle it in.
  if ('externalClientId' in (dto as Record<string, unknown>)) {
    throw new Error(ClientError.EXTERNAL_ID_IMMUTABLE);
  }

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
  agencyId: string,
  auditContext?: { userEmail: string; ipAddress: string }
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

  // Revoke provider access and credentials before cascading away grant history.
  const connectionIds = new Set((existing.accessRequests ?? [])
    .map((request) => request.connection?.id)
    .filter((connectionId): connectionId is string => Boolean(connectionId)));
  for (const connectionId of connectionIds) {
    const result = await connectionService.revokeConnection(connectionId, undefined, auditContext);
    if (result.error) throw new Error(result.error.message);
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
        _count: { select: { accessRequests: true } },
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
      requestCount: client._count.accessRequests,
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
  metaAccessConfig?: unknown;
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
      authorizationEpoch?: number;
      expiresAt?: Date | null;
    }>;
    metaAssetGrants?: Array<Record<string, any>>;
  } | null;
};

function normalizePlatformGroup(platform: string): string {
  return platformGroupOf(platform);
}

function isActiveAuthorizationStatus(status?: string | null): boolean {
  return status === 'active';
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

function resolveProductSummary(
  request: ClientDetailAccessRequestRecord,
  requestedProduct: ClientDetailRequestedProduct,
  agencyPlatformConnections: GoogleAgencyPlatformConnectionSummary[] = []
): {
  status: ClientDetailProductStatus;
  note?: string;
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
    const manualGrant = grantedAssets?.[requestedProduct.product];
    const grantedPlatform =
      manualGrant && typeof manualGrant === 'object' && typeof (manualGrant as Record<string, unknown>).platform === 'string'
        ? (manualGrant as Record<string, unknown>).platform as string
        : null;

    if (
      grantedPlatform &&
      (grantedPlatform === requestedProduct.product ||
        normalizePlatformGroup(grantedPlatform) === requestedProduct.platformGroup)
    ) {
      return (manualGrant as Record<string, unknown>).verificationStatus === 'verified'
        ? { status: 'connected' }
        : { status: 'pending', note: 'Waiting for verification' };
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

  if (requestedProduct.platformGroup === 'meta') {
    const assets = (request.connection?.grantedAssets as Record<string, unknown> | null)?.[requestedProduct.product];
    const fulfillment = evaluateMetaProductFulfillment(
      requestedProduct,
      assets && typeof assets === 'object' ? assets as Record<string, any> : {},
      request.connection ? [request.connection as any] : [],
      request.metaAccessConfig
    );
    if (fulfillment.fulfilled) return { status: 'connected' };
    if (!matchingAuthorization) return { status: 'pending' };
    if (!isActiveAuthorizationStatus(matchingAuthorization.status) || fulfillment.reason === 'stale' || fulfillment.reason === 'revoked') {
      return { status: 'needs_reconnect', note: 'Reconnect Meta to verify access again' };
    }
    const note = fulfillment.reason === 'assignee_selection_required'
      ? 'Select at least one Meta person'
      : fulfillment.reason === 'manual_action_required'
        ? 'Finish the manual Meta access step'
        : 'Finish sharing and verify Meta access';
    return { status: 'selection_required', note };
  }

  const selectedAssets =
    request.connection?.grantedAssets &&
    typeof request.connection.grantedAssets === 'object' &&
    requestedProduct.product in (request.connection.grantedAssets as Record<string, unknown>)
      ? ((request.connection.grantedAssets as Record<string, unknown>)[requestedProduct.product] as Record<string, any> | null)
      : null;

  const authorizationMetadata =
    matchingAuthorization?.metadata && typeof matchingAuthorization.metadata === 'object'
      ? (matchingAuthorization.metadata as Record<string, unknown>)
      : null;

  const googleGrantLifecycle = resolveGoogleGrantLifecycle({
    product: requestedProduct.product,
    hasOAuthAuthorization: Boolean(
      matchingAuthorization && isActiveAuthorizationStatus(matchingAuthorization.status)
    ),
    selectedAssets,
    authorizationMetadata,
    agencyPlatformConnections,
  });

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
  accessRequests: ClientDetailAccessRequestRecord[],
  agencyPlatformConnections: GoogleAgencyPlatformConnectionSummary[] = []
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
          note?: string;
          latestRequestId?: string;
          latestRequestedAt?: Date;
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
              note?: string;
              latestRequestId?: string;
              latestRequestedAt?: Date;
              googleGrantLifecycle?: GoogleProductGrantLifecycle;
            }
          >(),
        };

      if (!groupedProducts.has(groupKey)) {
        groupedProducts.set(groupKey, currentGroup);
      } else if (
        currentGroup.latestRequestedAt &&
        request.createdAt > currentGroup.latestRequestedAt
      ) {
        currentGroup.latestRequestId = request.id;
        currentGroup.latestRequestName = request.clientName;
        currentGroup.latestRequestedAt = request.createdAt;
      }

      const nextProductSummary = resolveProductSummary(
        request,
        requestedProduct,
        agencyPlatformConnections
      );
      const existingProduct = currentGroup.products.get(requestedProduct.product);

      if (
        !existingProduct ||
        request.createdAt > (existingProduct.latestRequestedAt || new Date(0)) ||
        (request.createdAt.getTime() === existingProduct.latestRequestedAt?.getTime() &&
          getProductStatusPriority(nextProductSummary.status) >
            getProductStatusPriority(existingProduct.status))
      ) {
        currentGroup.products.set(requestedProduct.product, {
          status: nextProductSummary.status,
          note: nextProductSummary.note,
          latestRequestId: request.id,
          latestRequestedAt: request.createdAt,
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
        note: productSummary.note || getProductStatusNote(productSummary.status),
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
    where: { id: clientId, agencyId },
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
          metaAccessConfig: true,
          connection: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              revokedAt: true,
              grantedAssets: true,
              metaAssetGrants: {
                select: {
                  assetKind: true,
                  assetId: true,
                  status: true,
                  recipientType: true,
                  recipientId: true,
                  requestedTasks: true,
                  verifiedTasks: true,
                  verifiedAuthorizationEpoch: true,
                  authorization: { select: { authorizationEpoch: true, status: true, expiresAt: true } },
                  destination: {
                    select: {
                      businessId: true,
                      agencyConnection: { select: { status: true, businessId: true } },
                    },
                  },
                },
              },
              authorizations: {
                select: {
                  platform: true,
                  status: true,
                  metadata: true,
                  authorizationEpoch: true,
                  expiresAt: true,
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

  const agencyPlatformConnections = (await prisma.agencyPlatformConnection.findMany({
    where: { agencyId, platform: 'google' },
    select: { platform: true, metadata: true },
  })) as GoogleAgencyPlatformConnectionSummary[];

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
    client.accessRequests as ClientDetailAccessRequestRecord[],
    agencyPlatformConnections
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
