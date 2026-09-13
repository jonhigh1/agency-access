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
import { getConnector } from '@/services/connectors/factory';
import { refreshClientPlatformAuthorization } from '@/services/token-lifecycle.service';
import {
  getPlatformTokenCapability,
  type Platform,
  type DashboardConnectionSummary,
  type HealthStatus,
} from '@agency-platform/shared';
import { z } from 'zod';
import { invalidateDashboardCache } from '@/lib/cache.js';
import { resolveListLimit, resolveListOffset } from '@/lib/list-pagination.js';

/**
 * Live-verify window for agency token-health sweeps (getAgencyTokenHealth).
 *
 * The dashboard flags a token as "expiring" 7 days out (getTokenHealth in
 * apps/web/src/lib/token-health.ts) and the token-refresh scan sweeps a 7-day
 * horizon, so a live platform call on a token further out cannot change any
 * status the UI acts on. The window is kept at 30 days — half the longest
 * common access-token lifetime (60-day Meta/LinkedIn long-lived tokens) — so
 * server-side revocations still surface well before the UI horizon; beyond
 * that, tokens are reported from their stored expiry only.
 */
const AGENCY_LIVE_VERIFY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** One day in milliseconds, used for the day-granular countdown field. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cap on concurrent platform live-verify calls per agency health sweep,
 * so one agency with many connections cannot fan out unbounded.
 */
const LIVE_VERIFY_CONCURRENCY = 5;

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

type TokenHealthAudit = {
  agencyId?: string;
  userEmail?: string;
  resourceId: string;
  resourceType: 'connection';
  action: 'TOKEN_HEALTH_CHECK';
  details: { platform: Platform; authorizationId?: string };
};

async function resolveTokenHealth(
  input: {
    authorizationId?: string;
    connectionId: string;
    platform: Platform;
    status: string;
    expiresAt: Date | null;
    secretId?: string;
    agencyId?: string;
    userEmail?: string;
  },
  options: { liveVerifyWindowMs?: number } = {}
): Promise<{ health: HealthStatus; daysUntilExpiry: number; audit?: TokenHealthAudit }> {
  const fallback = calculateHealthStatus(input.expiresAt, input.platform, input.status);
  const capability = getPlatformTokenCapability(input.platform);

  if (
    !input.secretId
    || (capability.healthStrategy !== 'live_verify' && capability.healthStrategy !== 'api_key_verify')
  ) {
    return fallback;
  }

  // Outside the live-verify window: report from the stored expiry only —
  // no Infisical read, no platform call, no audit row.
  if (
    options.liveVerifyWindowMs !== undefined
    && capability.expiryBehavior !== 'non_expiring'
    && (input.expiresAt === null || input.expiresAt.getTime() - Date.now() > options.liveVerifyWindowMs)
  ) {
    return fallback;
  }

  try {
    const tokens = await infisical.retrieveOAuthTokens(input.secretId);
    if (!tokens?.accessToken) {
      return { health: 'expired', daysUntilExpiry: -1 };
    }

    const audit: TokenHealthAudit = {
      agencyId: input.agencyId,
      userEmail: input.userEmail,
      resourceId: input.connectionId,
      resourceType: 'connection',
      action: 'TOKEN_HEALTH_CHECK',
      details: {
        platform: input.platform,
        authorizationId: input.authorizationId,
      },
    };

    try {
      const connector = getConnector(input.platform);
      const isValid = await connector.verifyToken(tokens.accessToken);

      if (!isValid) {
        return { health: 'expired', daysUntilExpiry: -1, audit };
      }

      return { ...fallback, audit };
    } catch (error) {
      if (fallback.health === 'expired') {
        return { ...fallback, audit };
      }

      return { health: 'unknown', daysUntilExpiry: fallback.daysUntilExpiry, audit };
    }
  } catch (error) {
    if (fallback.health === 'expired') {
      return fallback;
    }

    return { health: 'unknown', daysUntilExpiry: fallback.daysUntilExpiry };
  }
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
 * Get token health for a connection
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

    const healthRows = await Promise.all(authorizations.map(async (authorization) => {
      const { audit, ...health } = await resolveTokenHealth({
        authorizationId: authorization.id,
        connectionId: authorization.connectionId,
        platform: authorization.platform as Platform,
        status: authorization.status,
        expiresAt: authorization.expiresAt,
        secretId: authorization.secretId,
      });

      if (audit) {
        await auditService.createAuditLog(audit);
      }

      return {
        ...authorization,
        ...health,
      };
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
 * Get token health for all client authorizations in an agency
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
        secretId: true,
        connection: {
          select: {
            agencyId: true,
            clientEmail: true,
          },
        },
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });

    const audits: TokenHealthAudit[] = [];

    const verifyOne = async (authorization: (typeof authorizations)[number]) => {
      const capability = getPlatformTokenCapability(authorization.platform as Platform);

      const { audit, ...health } = await resolveTokenHealth(
        {
          authorizationId: authorization.id,
          connectionId: authorization.connectionId,
          platform: authorization.platform as Platform,
          status: authorization.status,
          expiresAt: authorization.expiresAt,
          secretId: authorization.secretId,
          agencyId: authorization.connection.agencyId,
          userEmail: authorization.connection.clientEmail,
        },
        { liveVerifyWindowMs: AGENCY_LIVE_VERIFY_WINDOW_MS }
      );

      if (audit) {
        audits.push(audit);
      }

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
        ...health,
      };
    };

    // Bounded fan-out: at most LIVE_VERIFY_CONCURRENCY verifications in flight,
    // result order preserved (chunks run in order, Promise.all keeps chunk order).
    const healthRows = [];
    for (let i = 0; i < authorizations.length; i += LIVE_VERIFY_CONCURRENCY) {
      const chunk = authorizations.slice(i, i + LIVE_VERIFY_CONCURRENCY);
      healthRows.push(...await Promise.all(chunk.map(verifyOne)));
    }

    // One batched audit insert for every token access in this sweep.
    await auditService.createAuditLogs(audits);

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
