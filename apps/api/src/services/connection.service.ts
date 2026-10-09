/**
 * Connection Service
 *
 * Business logic for managing client connections and platform authorizations.
 * Works with Infisical for token storage - never stores tokens directly in database.
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { auditService } from '@/services/audit.service';
import { refreshClientPlatformAuthorization } from '@/services/token-lifecycle.service';
import { getConnector } from '@/services/connectors/factory';
import { ConnectorError } from '@/services/connectors/base.connector';
import { metaPartnerService } from '@/services/meta-partner.service';
import { markRequestAuthorized } from '@/services/access-request.service';
import {
  getPlatformTokenCapability,
  type Platform,
  type DashboardConnectionSummary,
  type HealthStatus,
} from '@agency-platform/shared';
import { invalidateDashboardCache } from '@/lib/cache.js';
import { resolveListLimit, resolveListOffset } from '@/lib/list-pagination.js';
import { readPendingSecretDeletionIds } from '@/lib/meta-authorization-metadata.js';
import { updateAuthorizationMetadata } from '@/lib/authorization-metadata.js';

/** One day in milliseconds, used for the day-granular countdown field. */
const DAY_MS = 24 * 60 * 60 * 1000;

function isMetaPlatform(platform: string): platform is Platform {
  return platform === 'meta' || platform === 'meta_ads' || platform === 'meta_pages';
}

function isTikTokPlatform(platform: string): boolean {
  return platform === 'tiktok' || platform === 'tiktok_ads';
}

type AuditContext = { userEmail: string; ipAddress: string };

/**
 * Best-effort provider-side revoke for a TikTok long-term token.
 * Must run before the Infisical secret is deleted. Never throws: callers
 * always continue with local revocation, and the audit row records whether
 * TikTok actually confirmed the revoke.
 */
async function revokeTikTokProviderToken(
  authorization: { id: string; platform: string; secretId: string },
  connection: { id: string; agencyId?: string | null; clientEmail?: string | null },
  reason: 'connection_revoked' | 'platform_authorization_revoked',
  auditContext?: AuditContext
): Promise<boolean> {
  let failure: string | null = null;
  let providerCode: number | undefined;
  try {
    if (!auditContext?.userEmail || !auditContext.ipAddress) {
      failure = 'audit_context_missing';
    } else {
      const access = await auditService.logTokenAccess({
        connectionId: connection.id,
        platform: authorization.platform as Platform,
        userEmail: auditContext.userEmail,
        ipAddress: auditContext.ipAddress,
        details: { operation: 'tiktok_provider_revocation', authorizationId: authorization.id },
      });
      if (access.error) {
        failure = 'token_access_audit_failed';
      } else {
        const tokens = await infisical.getOAuthTokens(authorization.secretId);
        const connector = getConnector(authorization.platform as Platform);
        if (!tokens?.accessToken) failure = 'token_not_found';
        else if (!connector.revokeToken) failure = 'revoke_not_supported';
        else await connector.revokeToken.call(connector, tokens.accessToken);
      }
    }
  } catch (error) {
    failure = error instanceof ConnectorError ? error.code : 'provider_request_failed';
    if (error instanceof ConnectorError) {
      const detail = error.details?.code ?? error.details?.status;
      if (typeof detail === 'number') providerCode = detail;
    }
  }

  await auditService.createAuditLog({
    agencyId: connection.agencyId ?? undefined,
    userEmail: auditContext?.userEmail ?? connection.clientEmail ?? undefined,
    ...(auditContext?.ipAddress ? { ipAddress: auditContext.ipAddress } : {}),
    action: failure ? 'TIKTOK_PROVIDER_REVOKE_FAILED' : 'TIKTOK_TOKEN_REVOKED',
    resourceType: 'client_connection',
    resourceId: connection.id,
    metadata: {
      platform: authorization.platform,
      authorizationId: authorization.id,
      reason,
      providerRevoked: !failure,
      ...(failure ? { error: failure, localRevocation: 'continued' } : {}),
      ...(providerCode !== undefined ? { providerCode } : {}),
    },
  });
  return !failure;
}

/** Audit row for a completed local revoke of one platform authorization. */
async function logAuthorizationRevoked(
  authorization: { id: string; platform: string },
  connection: { id: string; agencyId?: string | null },
  reason: 'connection_revoked' | 'platform_authorization_revoked',
  auditContext?: AuditContext
): Promise<void> {
  await auditService.logTokenRevoke({
    connectionId: connection.id,
    platform: authorization.platform as Platform,
    userEmail: auditContext?.userEmail || 'system',
    ipAddress: auditContext?.ipAddress || '0.0.0.0',
    ...(connection.agencyId ? { agencyId: connection.agencyId } : {}),
    details: { authorizationId: authorization.id, reason },
  });
}

async function revokeMetaProviderAccess(authorization: {
  id: string;
  platform: string;
  secretId: string;
  metadata?: unknown;
}, connectionId: string, auditContext?: { userEmail: string; ipAddress: string }): Promise<string> {
  if (!isMetaPlatform(authorization.platform)) throw new Error('Expected a Meta authorization');
  const metadata = authorization.metadata && typeof authorization.metadata === 'object' && !Array.isArray(authorization.metadata)
    ? authorization.metadata as Record<string, unknown>
    : {};
  if (metadata.providerRevokedAt) return String(metadata.providerRevokedAt);

  const grants = await prisma.metaAssetGrant.findMany({
    where: {
      authorizationId: authorization.id,
      grantMethod: { in: ['assigned_users', 'manual_assigned_users', 'manual_business_share', 'manual_agency', 'catalog_agencies'] },
      recipientType: { in: ['human', 'system_user', 'business'] },
      assetKind: { in: ['page', 'ad_account', 'catalog', 'dataset'] },
      status: { notIn: ['selected', 'revoked'] },
    },
    select: { id: true, assetKind: true, assetId: true, recipientType: true, recipientId: true, grantMethod: true },
  });
  if (!auditContext?.userEmail || !auditContext.ipAddress) throw new Error('Meta token access audit context is required');
  const audit = await auditService.logTokenAccess({
    connectionId,
    platform: authorization.platform,
    userEmail: auditContext.userEmail,
    ipAddress: auditContext.ipAddress,
    details: { operation: 'meta_provider_revocation', authorizationId: authorization.id },
  });
  if (audit.error) throw new Error('Failed to audit Meta token access');
  const tokens = await infisical.getOAuthTokens(authorization.secretId);
  const assignments = new Map<string, typeof grants[number]>();

  for (const grant of grants) {
    assignments.set(`${grant.grantMethod}:${grant.assetKind}:${grant.assetId}:${grant.recipientType}:${grant.recipientId}`, grant);
  }
  const revocations = [...assignments.values()].map((grant) => async () => {
    if (grant.recipientType === 'business') {
      if (grant.assetKind === 'catalog') {
        await metaPartnerService.revokeCatalogAgencyAccess(tokens.accessToken, grant.assetId, grant.recipientId);
      } else {
        await metaPartnerService.revokeAgencyAccess(tokens.accessToken, grant.assetId, grant.recipientId);
      }
    } else {
      await metaPartnerService.revokeAssignedUserAccess(tokens.accessToken, grant.assetId, grant.recipientId);
    }
    await prisma.metaAssetGrant.updateMany({
      where: {
        authorizationId: authorization.id,
        assetKind: grant.assetKind,
        assetId: grant.assetId,
        grantMethod: grant.grantMethod,
        recipientType: grant.recipientType,
        recipientId: grant.recipientId,
        status: { notIn: ['selected', 'revoked'] },
      },
      data: { status: 'revoked', verifiedAt: null, verifiedAuthorizationEpoch: null },
    });
  });

  // ponytail: cap Meta revocation fan-out at five; tune with measured rate-limit and latency data.
  for (let index = 0; index < revocations.length; index += 5) {
    const outcomes = await Promise.allSettled(revocations.slice(index, index + 5).map((revoke) => revoke()));
    const failed = outcomes.find((outcome) => outcome.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }

  const connector = getConnector(authorization.platform);
  const revokeToken = connector.revokeToken;
  if (!revokeToken) throw new Error(`Meta connector cannot revoke authorization for ${authorization.platform}`);
  await revokeToken.call(connector, tokens.accessToken);
  const providerRevokedAt = new Date().toISOString();
  await updateAuthorizationMetadata(authorization.id, (current) => ({ ...current, providerRevokedAt }));
  return providerRevokedAt;
}

function calculateHealthStatus(
  expiresAt: Date | null,
  platform: Platform,
  status?: string
): { health: HealthStatus; daysUntilExpiry: number } {
  if (status && status !== 'active') {
    return { health: 'expired', daysUntilExpiry: -1 };
  }

  const capability = getPlatformTokenCapability(platform);
  if (capability.expiryBehavior === 'non_expiring') {
    return { health: 'healthy', daysUntilExpiry: 0 };
  }

  if (!expiresAt) {
    return { health: 'unknown', daysUntilExpiry: 0 };
  }

  // Expiry classification runs on milliseconds, matching getTokenHealth in
  // apps/web/src/lib/token-health.ts: an hourly token (Snapchat-class) that
  // died minutes ago must not round up to day 0 and read as merely "expiring".
  const msUntilExpiry = expiresAt.getTime() - Date.now();
  // Future horizons round up (conservative); past horizons round away from
  // zero so "12 minutes past expiry" reports day -1, not day 0.
  const daysUntilExpiry =
    msUntilExpiry > 0
      ? Math.ceil(msUntilExpiry / DAY_MS)
      : Math.floor(msUntilExpiry / DAY_MS);

  if (msUntilExpiry <= 0) {
    return { health: 'expired', daysUntilExpiry };
  }

  if (daysUntilExpiry <= 7) {
    return { health: 'expiring', daysUntilExpiry };
  }

  return { health: 'healthy', daysUntilExpiry };
}

/**
 * Create a new client connection with platform authorizations
 */
export async function createClientConnection(input: {
  requestId: string;
  platforms: Record<string, { accessToken: string; refreshToken?: string; expiresAt: Date }>;
}) {
  try {
    // Get the access request
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id: input.requestId },
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

    const connectionId = randomUUID();
    const storedSecrets: Array<{ platform: Platform; secretId: string; expiresAt: Date }> = [];

    try {
      for (const [platform, tokens] of Object.entries(input.platforms)) {
        const secretId = infisical.generateSecretName(platform as Platform, connectionId);
        await infisical.storeOAuthTokens(secretId, tokens);
        storedSecrets.push({
          platform: platform as Platform,
          secretId,
          expiresAt: tokens.expiresAt,
        });
      }
    } catch (error) {
      await Promise.allSettled(
        storedSecrets.map((secret) => infisical.deleteSecret(secret.secretId))
      );
      throw error;
    }

    let result;
    try {
      result = await prisma.$transaction(async (tx: any) => {
        const connection = await tx.clientConnection.create({
          data: {
            id: connectionId,
            accessRequestId: input.requestId,
            agencyId: accessRequest.agencyId,
            clientEmail: accessRequest.clientEmail,
            status: 'active',
          },
        });

        for (const secret of storedSecrets) {
          await tx.platformAuthorization.create({
            data: {
              connectionId: connection.id,
              platform: secret.platform,
              secretId: secret.secretId,
              expiresAt: secret.expiresAt,
              status: 'active',
            },
          });
        }

        return connection;
      });
    } catch (error) {
      await Promise.allSettled(
        storedSecrets.map((secret) => infisical.deleteSecret(secret.secretId))
      );
      throw error;
    }

    await auditService.createAuditLogs(
      storedSecrets.map((secret) => ({
        agencyId: accessRequest.agencyId,
        userEmail: accessRequest.clientEmail,
        action: 'GRANTED',
        resourceType: 'connection',
        resourceId: result.id,
        metadata: { platform: secret.platform },
      }))
    );

    await invalidateDashboardCache(accessRequest.agencyId);

    return { data: result, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create client connection',
      },
    };
  }
}

/**
 * Get a connection by ID
 */
export async function getConnection(connectionId: string) {
  try {
    const connection = await prisma.clientConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return {
        data: null,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Connection not found',
        },
      };
    }

    return { data: connection, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve connection',
      },
    };
  }
}

/**
 * Get all platform authorizations for a connection
 */
export async function getConnectionAuthorizations(connectionId: string) {
  try {
    const authorizations = await prisma.platformAuthorization.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'asc' },
    });

    return { data: authorizations, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve authorizations',
      },
    };
  }
}

/**
 * Get platform tokens from Infisical for a specific platform authorization
 */
export async function getPlatformTokens(connectionId: string, platform: Platform) {
  try {
    // Find the platform authorization
    const authorization = await prisma.platformAuthorization.findFirst({
      where: {
        connectionId,
        platform,
      },
    });

    if (!authorization) {
      return {
        data: null,
        error: {
          code: 'AUTHORIZATION_NOT_FOUND',
          message: 'Platform authorization not found',
        },
      };
    }

    if (authorization.status !== 'active') {
      return {
        data: null,
        error: { code: 'REAUTHORIZATION_REQUIRED', message: 'Platform authorization is inactive. Reconnect before using tokens.' },
      };
    }

    // Retrieve tokens from Infisical
    const tokens = await infisical.retrieveOAuthTokens(authorization.secretId);

    if (!tokens) {
      return {
        data: null,
        error: {
          code: 'TOKENS_NOT_FOUND',
          message: 'Tokens not found in secure storage',
        },
      };
    }

    return { data: tokens, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve platform tokens',
      },
    };
  }
}

/**
 * Update platform tokens in Infisical and database
 */
export async function updatePlatformTokens(
  connectionId: string,
  platform: Platform,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }
) {
  try {
    // Find the platform authorization
    const authorization = await prisma.platformAuthorization.findFirst({
      where: {
        connectionId,
        platform,
      },
    });

    if (!authorization) {
      return {
        data: null,
        error: {
          code: 'AUTHORIZATION_NOT_FOUND',
          message: 'Platform authorization not found',
        },
      };
    }

    if (authorization.status !== 'active') {
      return {
        data: null,
        error: { code: 'REAUTHORIZATION_REQUIRED', message: 'Platform authorization is inactive. Reconnect before updating tokens.' },
      };
    }

    // Update tokens in Infisical
    await infisical.updateOAuthTokens(authorization.secretId, tokens);

    // Update expiry in database
    const updated = await prisma.platformAuthorization.update({
      where: { id: authorization.id },
      data: { expiresAt: tokens.expiresAt },
    });

    return { data: updated, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update platform tokens',
      },
    };
  }
}

type ClientConnectionRow = NonNullable<Awaited<ReturnType<typeof prisma.clientConnection.findUnique>>>;

/**
 * Revoke a connection and delete all tokens from Infisical.
 * `preloadedConnection` lets callers that already fetched (and agency-scoped)
 * the row skip the duplicate read.
 */
export async function revokeConnection(
  connectionId: string,
  preloadedConnection?: ClientConnectionRow,
  auditContext?: { userEmail: string; ipAddress: string }
) {
  try {
    // Get connection with authorizations (or reuse the caller's fetch)
    const connection = preloadedConnection ?? await prisma.clientConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return {
        data: null,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Connection not found',
        },
      };
    }

    // Get all platform authorizations
    const authorizations = await prisma.platformAuthorization.findMany({
      where: { connectionId },
    });

    for (const auth of authorizations) {
      // Already-revoked authorizations have no live token to revoke upstream.
      if (isTikTokPlatform(auth.platform) && auth.status !== 'revoked') {
        await revokeTikTokProviderToken(auth, { ...connection, id: connectionId }, 'connection_revoked', auditContext);
      }

      let metaProviderStep = isMetaPlatform(auth.platform);
      try {
        if (metaProviderStep) await revokeMetaProviderAccess(auth, connectionId, auditContext);
        metaProviderStep = false;
        await infisical.deleteSecret(auth.secretId);
        for (const secretId of readPendingSecretDeletionIds(auth.metadata)) {
          await infisical.deleteSecret(secretId);
        }
        if (isMetaPlatform(auth.platform)) {
          const deletedIds = readPendingSecretDeletionIds(auth.metadata);
          await updateAuthorizationMetadata(auth.id, (current) => ({
            ...current,
            ...(deletedIds.length ? {
              pendingSecretDeletion: readPendingSecretDeletionIds(current)
                .filter((secretId) => !deletedIds.includes(secretId)),
            } : {}),
          }), 'revoked');
        } else {
          await prisma.platformAuthorization.update({ where: { id: auth.id }, data: { status: 'revoked' } });
        }
        if (auth.status !== 'revoked') {
          await logAuthorizationRevoked(auth, { ...connection, id: connectionId }, 'connection_revoked', auditContext);
        }
      } catch (error) {
        const metaFailure = metaProviderStep;
        await prisma.platformAuthorization.update({
          where: { id: auth.id },
          data: { status: 'invalid' },
        });
        if (connection.accessRequestId) await markRequestAuthorized(connection.accessRequestId);
        await auditService.createAuditLog({
          agencyId: connection.agencyId,
          userEmail: connection.clientEmail,
          action: metaFailure ? 'META_ACCESS_REVOCATION_FAILED' : 'TOKEN_DELETION_FAILED',
          resourceType: 'client_connection',
          resourceId: connectionId,
          metadata: {
            platform: auth.platform,
            secretId: auth.secretId,
            error: metaFailure ? 'Provider-side Meta revocation failed' : (error instanceof Error ? error.message : String(error)),
          },
        });
        await prisma.clientConnection.update({
          where: { id: connectionId },
          data: { status: 'partial' },
        });
        return {
          data: null,
          error: {
            code: metaFailure ? 'META_ACCESS_REVOCATION_FAILED' : 'TOKEN_DELETION_FAILED',
            message: 'Connection cleanup failed. Retry connection revocation.',
          },
          partialFailure: true,
        };
      }
    }

    if (connection.accessRequestId) await markRequestAuthorized(connection.accessRequestId);

    // Update connection status
    // revokedAt drives the "Access revoked" entry on the client Activity timeline.
    await prisma.clientConnection.update({
      where: { id: connectionId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: auditContext?.userEmail || 'system',
      },
    });

    return {
      data: connection,
      error: null,
      partialFailure: false,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revoke connection',
      },
    };
  }
}

/**
 * Get token health for a connection.
 *
 * Expiry-only: classify from stored `expiresAt` and authorization status.
 * Infisical reads and `verifyToken` belong in the token-refresh job.
 */
export async function getTokenHealth(connectionId: string) {
  try {
    const authorizations = await prisma.platformAuthorization.findMany({
      where: { connectionId },
      select: {
        id: true,
        connectionId: true,
        platform: true,
        status: true,
        expiresAt: true,
        lastRefreshedAt: true,
        secretId: true,
      },
    });

    const healthRows = authorizations.map((authorization) => ({
      ...authorization,
      ...calculateHealthStatus(
        authorization.expiresAt,
        authorization.platform as Platform,
        authorization.status
      ),
    }));

    return {
      data: healthRows,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get token health',
      },
    };
  }
}

/**
 * Get token health for all client authorizations in an agency.
 *
 * Expiry-only on the request path (GET /token-health and MCP workspace).
 * Live platform verify belongs in the token-refresh job.
 */
export async function getAgencyTokenHealth(agencyId: string) {
  try {
    const authorizations = await prisma.platformAuthorization.findMany({
      where: {
        connection: {
          agencyId,
          status: 'active',
        },
      },
      select: {
        id: true,
        connectionId: true,
        platform: true,
        status: true,
        expiresAt: true,
        lastRefreshedAt: true,
        connection: {
          select: {
            clientEmail: true,
          },
        },
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });

    const healthRows = authorizations.map((authorization) => {
      const platform = authorization.platform as Platform;
      const capability = getPlatformTokenCapability(platform);

      return {
        id: authorization.id,
        connectionId: authorization.connectionId,
        clientName: authorization.connection.clientEmail,
        platform: authorization.platform,
        status: authorization.status,
        expiresAt: authorization.expiresAt,
        lastRefreshedAt: authorization.lastRefreshedAt,
        canRefresh: capability.connectionMethod === 'oauth'
          && capability.refreshStrategy === 'automatic',
        ...calculateHealthStatus(authorization.expiresAt, platform, authorization.status),
      };
    });

    return {
      data: healthRows,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get agency token health',
      },
    };
  }
}

const CONNECTION_LIST_SELECT = {
  id: true,
  clientEmail: true,
  status: true,
  createdAt: true,
  authorizations: {
    select: {
      platform: true,
      status: true,
    },
  },
} as const;

/**
 * Get connections for an agency as summaries (no secretId / metadata JSON).
 */
export async function getAgencyConnections(
  agencyId: string,
  filters?: { limit?: number; offset?: number }
) {
  try {
    const connections = await prisma.clientConnection.findMany({
      where: { agencyId },
      select: CONNECTION_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: resolveListLimit(filters?.limit),
      skip: resolveListOffset(filters?.offset),
    });

    return { data: connections, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get agency connections',
      },
    };
  }
}

/**
 * Get lightweight connection summaries for dashboard
 * Returns only essential data (platform badges) without full authorization details
 * This reduces payload size significantly for agencies with many connections
 */
export async function getAgencyConnectionSummaries(
  agencyId: string,
  filters?: { limit?: number; offset?: number }
) {
  return getAgencyConnections(agencyId, filters);
}

/**
 * Get lightweight dashboard connection summaries.
 * Includes only active connections and active platform authorizations.
 */
export async function getDashboardConnectionSummaries(
  agencyId: string,
  limit: number,
  options: { includeTotal?: boolean } = {}
): Promise<{ data: { items: DashboardConnectionSummary[]; total: number } | null; error: any }> {
  try {
    const includeTotal = options.includeTotal ?? true;
    const where = {
      agencyId,
      status: 'active',
    };

    const connectionsPromise = prisma.clientConnection.findMany({
      where,
      select: {
        id: true,
        clientEmail: true,
        status: true,
        createdAt: true,
        accessRequest: {
          select: { clientId: true },
        },
        authorizations: {
          where: {
            status: 'active',
          },
          select: {
            platform: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const totalPromise = includeTotal
      ? prisma.clientConnection.count({
          where,
        })
      : Promise.resolve<number | null>(null);
    const [connections, total] = await Promise.all([connectionsPromise, totalPromise]);

    const items: DashboardConnectionSummary[] = connections.map((connection) => ({
      id: connection.id,
      clientId: connection.accessRequest?.clientId ?? null,
      clientEmail: connection.clientEmail,
      status: connection.status,
      createdAt: connection.createdAt.toISOString(),
      platforms: Array.from(new Set(connection.authorizations.map((auth) => auth.platform))),
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
        message: 'Failed to get dashboard connection summaries',
      },
    };
  }
}

/**
 * Refresh a platform authorization
 */
export async function refreshPlatformAuthorization(
  connectionId: string,
  platform: Platform
) {
  try {
    const refreshResult = await refreshClientPlatformAuthorization(connectionId, platform);

    if (refreshResult.error) {
      return {
        data: null,
        error: refreshResult.error,
      };
    }

    const authorization = await prisma.platformAuthorization.findFirst({
      where: { connectionId, platform },
    });

    if (!authorization) {
      return {
        data: null,
        error: {
          code: 'AUTHORIZATION_NOT_FOUND',
          message: 'Platform authorization not found',
        },
      };
    }

    return { data: authorization, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to refresh platform authorization',
      },
    };
  }
}

/**
 * Revoke a specific platform authorization
 */
export async function revokePlatformAuthorization(
  connectionId: string,
  platform: Platform,
  auditContext?: { userEmail: string; ipAddress: string }
) {
  try {
    const authorization = await prisma.platformAuthorization.findFirst({
      where: { connectionId, platform },
    });

    if (!authorization) {
      return {
        data: null,
        error: {
          code: 'AUTHORIZATION_NOT_FOUND',
          message: 'Platform authorization not found',
        },
      };
    }

    if (isTikTokPlatform(platform) && authorization.status !== 'revoked') {
      const owner = await prisma.clientConnection.findUnique({
        where: { id: connectionId },
        select: { agencyId: true, clientEmail: true },
      });
      await revokeTikTokProviderToken(
        authorization,
        { id: connectionId, agencyId: owner?.agencyId, clientEmail: owner?.clientEmail },
        'platform_authorization_revoked',
        auditContext
      );
    }

    let metaProviderStep = isMetaPlatform(platform);
    try {
      if (metaProviderStep) await revokeMetaProviderAccess(authorization, connectionId, auditContext);
      metaProviderStep = false;
      await infisical.deleteSecret(authorization.secretId);
      for (const secretId of readPendingSecretDeletionIds(authorization.metadata)) {
        await infisical.deleteSecret(secretId);
      }
    } catch (error) {
      const connection = await prisma.clientConnection.findUnique({
        where: { id: connectionId },
        select: { agencyId: true, clientEmail: true, accessRequestId: true },
      });
      await prisma.platformAuthorization.update({
        where: { id: authorization.id },
        data: { status: 'invalid' },
      });
      if (connection?.accessRequestId) await markRequestAuthorized(connection.accessRequestId);
      await auditService.createAuditLog({
        agencyId: connection?.agencyId,
        userEmail: connection?.clientEmail,
        action: metaProviderStep ? 'META_ACCESS_REVOCATION_FAILED' : 'TOKEN_DELETION_FAILED',
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: {
          platform,
          authorizationId: authorization.id,
          error: metaProviderStep ? 'Provider-side Meta revocation failed' : (error instanceof Error ? error.message : String(error)),
        },
      });
      return {
        data: null,
        error: {
          code: metaProviderStep ? 'META_ACCESS_REVOCATION_FAILED' : 'TOKEN_DELETION_FAILED',
          message: 'Authorization cleanup failed. Retry revocation.',
        },
      };
    }

    // Update authorization status
    const deletedIds = readPendingSecretDeletionIds(authorization.metadata);
    const updated = isMetaPlatform(platform)
      ? await updateAuthorizationMetadata(authorization.id, (current) => ({
          ...current,
          ...(deletedIds.length ? {
            pendingSecretDeletion: readPendingSecretDeletionIds(current)
              .filter((secretId) => !deletedIds.includes(secretId)),
          } : {}),
        }), 'revoked')
      : await prisma.platformAuthorization.update({
          where: { id: authorization.id },
          data: { status: 'revoked' },
        });

    const connection = await prisma.clientConnection.findUnique({
      where: { id: connectionId },
      select: { accessRequestId: true, agencyId: true },
    });
    await logAuthorizationRevoked(
      authorization,
      { id: connectionId, agencyId: connection?.agencyId },
      'platform_authorization_revoked',
      auditContext
    );
    if (connection?.accessRequestId) await markRequestAuthorized(connection.accessRequestId);

    return { data: updated, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revoke platform authorization',
      },
    };
  }
}

/**
 * Connection Service
 * Exports all connection-related service functions as a single object
 */
export const connectionService = {
  createClientConnection,
  getConnection,
  getConnectionAuthorizations,
  getPlatformTokens,
  updatePlatformTokens,
  revokeConnection,
  getTokenHealth,
  getAgencyTokenHealth,
  getAgencyConnections,
  getAgencyConnectionSummaries,
  getDashboardConnectionSummaries,
  refreshPlatformAuthorization,
  revokePlatformAuthorization,
};
