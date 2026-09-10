/**
 * Agency Platform Service
 *
 * Business logic for managing agency platform connections.
 * Agencies connect their own platform accounts to enable delegated access model.
 * All OAuth tokens stored in Infisical, never in database.
 */

import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { logger } from '@/lib/logger.js';
import { CacheKeys, deleteCache, invalidateDashboardCache } from '@/lib/cache';
import { ensureAgencyAccessToken } from '@/services/token-lifecycle.service';
import type { Platform } from '@agency-platform/shared';
import { z } from 'zod';

// Validation schemas
const createConnectionSchema = z.object({
  agencyId: z.string().min(1),
  platform: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.date().optional(),
  scope: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  connectedBy: z.string().email(),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

/**
 * Get all platform connections for an agency
 */
export async function getConnections(
  agencyId: string,
  filters?: { status?: string }
) {
  try {
    const where: any = { agencyId };
    if (filters?.status) {
      where.status = filters.status;
    }

    const connections = await prisma.agencyPlatformConnection.findMany({
      where,
      orderBy: { connectedAt: 'desc' },
    });

    return { data: connections, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve platform connections',
      },
    };
  }
}

/**
 * Get a specific platform connection
 */
export async function getConnection(agencyId: string, platform: string) {
  try {
    const connection = await prisma.agencyPlatformConnection.findFirst({
      where: { agencyId, platform },
    });

    return { data: connection, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve platform connection',
      },
    };
  }
}

/**
 * Create a new platform connection
 */
export async function createConnection(input: CreateConnectionInput) {
  try {
    const validated = createConnectionSchema.parse(input);

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

    // Check if platform already connected (only active connections block reconnect)
    const existingConnection = await prisma.agencyPlatformConnection.findFirst({
      where: {
        agencyId: validated.agencyId,
        platform: validated.platform,
        status: 'active', // Only check for active connections
      },
    });

    if (existingConnection) {
      return {
        data: null,
        error: {
          code: 'PLATFORM_ALREADY_CONNECTED',
          message: 'Platform is already connected for this agency',
        },
      };
    }

    // Check if there's a previous non-active connection to reuse in place.
    // Revoked, expired, and invalid rows all occupy the same (agencyId, platform)
    // slot, so reconnecting must update the row instead of creating a duplicate
    // (a create would violate the unique constraint).
    const reusableConnection = await prisma.agencyPlatformConnection.findFirst({
      where: {
        agencyId: validated.agencyId,
        platform: validated.platform,
        status: { in: ['revoked', 'expired', 'invalid'] },
      },
    });

    // Generate secret name for Infisical
    const secretId = `${validated.platform}_agency_${validated.agencyId}`;

    // Store tokens in Infisical
    await infisical.storeOAuthTokens(secretId, {
      accessToken: validated.accessToken,
      refreshToken: validated.refreshToken,
      expiresAt: validated.expiresAt,
      scope: validated.scope,
    });

    let connection;

    // If reusing a non-active connection, update it; otherwise create new
    if (reusableConnection) {
      connection = await prisma.agencyPlatformConnection.update({
        where: { id: reusableConnection.id },
        data: {
          status: 'active',
          secretId,
          expiresAt: validated.expiresAt,
          scope: validated.scope,
          metadata: validated.metadata,
          connectedBy: validated.connectedBy,
          connectedAt: new Date(), // Reset connected time
          revokedAt: null, // Clear revoked fields
          revokedBy: null,
          lastRefreshedAt: null,
          // A row reconnected through OAuth that was not already OAuth-shaped
          // (e.g. a legacy manual_invitation row) records its new mode.
          ...(reusableConnection.connectionMode !== 'oauth' && { connectionMode: 'oauth' }),
        },
      });
    } else {
      // Create database record
      connection = await prisma.agencyPlatformConnection.create({
        data: {
          agencyId: validated.agencyId,
          platform: validated.platform,
          secretId,
          status: 'active',
          expiresAt: validated.expiresAt,
          scope: validated.scope,
          metadata: validated.metadata,
          connectedBy: validated.connectedBy,
        },
      });
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        agencyId: validated.agencyId,
        action: 'AGENCY_CONNECTED',
        userEmail: validated.connectedBy,
        agencyConnectionId: connection.id,
        metadata: {
          platform: validated.platform,
          scope: validated.scope,
        },
        ipAddress: '0.0.0.0', // Will be populated by API route
        userAgent: 'unknown', // Will be populated by API route
      },
    });

    // Invalidate caches that power the Connections UI and dashboard widgets.
    await Promise.all([
      deleteCache(CacheKeys.agencyConnections(validated.agencyId)),
      invalidateDashboardCache(validated.agencyId),
    ]);

    return { data: connection, error: null };
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

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create platform connection',
      },
    };
  }
}

/**
 * Revoke a platform connection
 */
export async function revokeConnection(
  agencyId: string,
  platform: string,
  revokedBy: string
) {
  try {
    // Find the connection
    const connection = await prisma.agencyPlatformConnection.findFirst({
      where: { agencyId, platform },
    });

    if (!connection) {
      return {
        data: null,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Platform connection not found',
        },
      };
    }

    // Delete tokens from Infisical
    if (connection.secretId) {
      await infisical.deleteOAuthTokens(connection.secretId);
    }

    // Update database record
    const updatedConnection = await prisma.agencyPlatformConnection.update({
      where: { id: connection.id },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy,
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        agencyId,
        action: 'AGENCY_DISCONNECTED',
        userEmail: revokedBy,
        agencyConnectionId: connection.id,
        metadata: {
          platform,
        },
        ipAddress: '0.0.0.0',
        userAgent: 'unknown',
      },
    });

    await Promise.all([
      deleteCache(CacheKeys.agencyConnections(agencyId)),
      invalidateDashboardCache(agencyId),
    ]);

    return { data: updatedConnection, error: null };
  } catch (error) {
    logger.error('Failed to revoke platform connection', {
      agencyId,
      platform,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to revoke platform connection',
      },
    };
  }
}

/**
 * Refresh connection tokens
 */
export async function refreshConnection(
  agencyId: string,
  platform: string,
  newTokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
  }
) {
  try {
    // Find the connection
    const connection = await prisma.agencyPlatformConnection.findFirst({
      where: { agencyId, platform },
    });

    if (!connection) {
      return {
        data: null,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Platform connection not found',
        },
      };
    }

    // Update tokens in Infisical
    if (connection.secretId) {
      await infisical.updateOAuthTokens(connection.secretId, newTokens);
    }

    // Update database record
    const updatedConnection = await prisma.agencyPlatformConnection.update({
      where: { id: connection.id },
      data: {
        expiresAt: newTokens.expiresAt,
        lastRefreshedAt: new Date(),
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        agencyId,
        action: 'AGENCY_TOKEN_REFRESHED',
        userEmail: connection.connectedBy,
        agencyConnectionId: connection.id,
        metadata: {
          platform,
        },
        ipAddress: '0.0.0.0',
        userAgent: 'unknown',
      },
    });

    await Promise.all([
      deleteCache(CacheKeys.agencyConnections(agencyId)),
      invalidateDashboardCache(agencyId),
    ]);

    return { data: updatedConnection, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to refresh platform connection',
      },
    };
  }
}

/**
 * Get valid access token (auto-refresh if needed)
 */
export async function getValidToken(agencyId: string, platform: string) {
  try {
    const result = await ensureAgencyAccessToken(agencyId, platform as Platform);

    if (result.error || !result.data) {
      return {
        data: null,
        error: result.error,
      };
    }

    return { data: result.data.accessToken, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve access token',
      },
    };
  }
}

/**
 * Validate a connection is active and not expired
 */
export async function validateConnection(connectionId: string) {
  try {
    const connection = await prisma.agencyPlatformConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return { data: false, error: null };
    }

    // Check if revoked or expired
    if (connection.status !== 'active') {
      return { data: false, error: null };
    }

    // Check expiry date
    if (connection.expiresAt && connection.expiresAt < new Date()) {
      return { data: false, error: null };
    }

    return { data: true, error: null };
  } catch (error) {
    return {
      data: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate connection',
      },
    };
  }
}

/**
 * Update connection metadata
 */
export async function updateConnectionMetadata(
  agencyId: string,
  platform: string,
  metadata: Record<string, any>
) {
  try {
    // Find the connection
    const connection = await prisma.agencyPlatformConnection.findFirst({
      where: { agencyId, platform },
    });

    if (!connection) {
      return {
        data: null,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Platform connection not found',
        },
      };
    }

    // Merge existing metadata with new metadata
    const existingMetadata = (connection.metadata as Record<string, any>) || {};
    const updatedMetadata = { ...existingMetadata, ...metadata };

    // Update database record
    const updatedConnection = await prisma.agencyPlatformConnection.update({
      where: { id: connection.id },
      data: {
        metadata: updatedMetadata,
      },
    });

    await Promise.all([
      deleteCache(CacheKeys.agencyConnections(agencyId)),
      invalidateDashboardCache(agencyId),
    ]);

    return { data: updatedConnection, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update connection metadata',
      },
    };
  }
}

/**
 * Agency Platform Service
 * Exports all agency platform-related service functions
 */
export const agencyPlatformService = {
  getConnections,
  getConnection,
  createConnection,
  revokeConnection,
  refreshConnection,
  getValidToken,
  validateConnection,
  updateConnectionMetadata,
};
