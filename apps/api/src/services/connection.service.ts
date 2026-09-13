/**
 * Connection Service
 *
 * Business logic for managing client connections and platform authorizations.
 * Works with Infisical for token storage - never stores tokens directly in database.
 */

import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { auditService } from '@/services/audit.service';
import { refreshClientPlatformAuthorization } from '@/services/token-lifecycle.service';
import {
  getPlatformTokenCapability,
  type Platform,
  type DashboardConnectionSummary,
  type HealthStatus,
} from '@agency-platform/shared';
import { invalidateDashboardCache } from '@/lib/cache.js';

/** One day in milliseconds, used for the day-granular countdown field. */
const DAY_MS = 24 * 60 * 60 * 1000;

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

    // Create connection and platform authorizations in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Create the connection
      const connection = await tx.clientConnection.create({
        data: {
          accessRequestId: input.requestId,
          agencyId: accessRequest.agencyId,
          clientEmail: accessRequest.clientEmail,
          status: 'active',
        },
      });

      // Create platform authorizations
      for (const [platform, tokens] of Object.entries(input.platforms)) {
        const secretId = infisical.generateSecretName(platform as Platform, connection.id);

        // Store tokens in Infisical
        await infisical.storeOAuthTokens(secretId, tokens);

        // Create database record with only secretId
        await tx.platformAuthorization.create({
          data: {
            connectionId: connection.id,
            platform: platform as Platform,
            secretId,
            expiresAt: tokens.expiresAt,
            status: 'active',
          },
        });
      }

      return connection;
    });

    // Invalidate dashboard cache for this agency
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
  preloadedConnection?: ClientConnectionRow
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

    // Delete all tokens from Infisical in parallel. The connection can still be
    // revoked when one provider secret is already missing or unavailable.
    const deletionResults = await Promise.allSettled(
      authorizations.map((auth) => infisical.deleteSecret(auth.secretId)),
    );

    for (const [index, auth] of authorizations.entries()) {
      if (auth.platform === 'tiktok' || auth.platform === 'tiktok_ads') {
        await auditService.createAuditLog({
          agencyId: connection.agencyId,
          userEmail: connection.clientEmail,
          action: 'TIKTOK_TOKEN_REVOKED',
          resourceType: 'client_connection',
          resourceId: connectionId,
          metadata: {
            platform: auth.platform,
            reason: 'connection_revoked',
          },
        });
      }

      const deletion = deletionResults[index];
      if (deletion.status === 'rejected') {
        await auditService.createAuditLog({
          agencyId: connection.agencyId,
          userEmail: connection.clientEmail,
          action: 'TOKEN_DELETION_FAILED',
          resourceType: 'client_connection',
          resourceId: connectionId,
          metadata: {
            platform: auth.platform,
            secretId: auth.secretId,
            error: deletion.reason instanceof Error ? deletion.reason.message : String(deletion.reason),
          },
        });
      }
    }

    // Update connection status
    await prisma.clientConnection.update({
      where: { id: connectionId },
      data: { status: 'revoked' },
    });

    // Update all authorizations to revoked
    await prisma.platformAuthorization.updateMany({
      where: { connectionId },
      data: { status: 'revoked' },
    });

    return {
      data: connection,
      error: null,
      partialFailure: deletionResults.some((result) => result.status === 'rejected'),
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

/**
 * Get all connections for an agency
 */
export async function getAgencyConnections(agencyId: string) {
  try {
    const connections = await prisma.clientConnection.findMany({
      where: { agencyId },
      include: {
        authorizations: true,
      },
      orderBy: { createdAt: 'desc' },
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
export async function getAgencyConnectionSummaries(agencyId: string) {
  try {
    const connections = await prisma.clientConnection.findMany({
      where: { agencyId },
      select: {
        id: true,
        clientEmail: true,
        status: true,
        createdAt: true,
        // Only select platform from authorizations, not full details
        authorizations: {
          select: {
            platform: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: connections, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get agency connection summaries',
      },
    };
  }
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
  platform: Platform
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

    // Delete tokens from Infisical
    await infisical.deleteOAuthTokens(authorization.secretId);

    if (platform === 'tiktok' || platform === 'tiktok_ads') {
      const connection = await prisma.clientConnection.findUnique({
        where: { id: connectionId },
        select: {
          agencyId: true,
          clientEmail: true,
        },
      });

      await auditService.createAuditLog({
        agencyId: connection?.agencyId,
        userEmail: connection?.clientEmail,
        action: 'TIKTOK_TOKEN_REVOKED',
        resourceType: 'client_connection',
        resourceId: connectionId,
        metadata: {
          platform,
          reason: 'platform_authorization_revoked',
        },
      });
    }

    // Update authorization status
    const updated = await prisma.platformAuthorization.update({
      where: { id: authorization.id },
      data: { status: 'revoked' },
    });

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
