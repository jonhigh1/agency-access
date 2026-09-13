/**
 * Audit Service
 *
 * Business logic for security audit logging.
 * All token access events must be logged for compliance.
 */

import { prisma } from '@/lib/prisma';
import type { Platform } from '@agency-platform/shared';
import type { FastifyRequest } from 'fastify';
import { extractClientIp, extractUserAgent } from '@/lib/ip.js';

/**
 * Log token access event
 */
export async function logTokenAccess(input: {
  connectionId: string;
  platform: Platform;
  userEmail: string;
  ipAddress: string;
  details?: Record<string, any>;
}) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        resourceId: input.connectionId,
        resourceType: 'connection',
        action: 'ACCESSED',
        userEmail: input.userEmail,
        ipAddress: input.ipAddress,
        metadata: { platform: input.platform, ...(input.details || {}) },
      },
    });

    return { data: auditLog, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to log token access',
      },
    };
  }
}

/**
 * Log token grant event
 */
export async function logTokenGrant(input: {
  connectionId: string;
  platform: Platform;
  userEmail: string;
  ipAddress: string;
  details?: Record<string, any>;
}) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        resourceId: input.connectionId,
        resourceType: 'connection',
        action: 'GRANTED',
        userEmail: input.userEmail,
        ipAddress: input.ipAddress,
        metadata: { platform: input.platform, ...(input.details || {}) },
      },
    });

    return { data: auditLog, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to log token grant',
      },
    };
  }
}

/**
 * Log token revoke event
 */
export async function logTokenRevoke(input: {
  connectionId: string;
  platform: Platform;
  userEmail: string;
  ipAddress: string;
  details?: Record<string, any>;
}) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        resourceId: input.connectionId,
        resourceType: 'connection',
        action: 'REVOKED',
        userEmail: input.userEmail,
        ipAddress: input.ipAddress,
        metadata: { platform: input.platform, ...(input.details || {}) },
      },
    });

    return { data: auditLog, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to log token revoke',
      },
    };
  }
}

/**
 * Log token refresh event
 */
export async function logTokenRefresh(input: {
  connectionId: string;
  platform: Platform;
  userEmail: string;
  ipAddress: string;
  details?: Record<string, any>;
}) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        resourceId: input.connectionId,
        resourceType: 'connection',
        action: 'REFRESHED',
        userEmail: input.userEmail,
        ipAddress: input.ipAddress,
        metadata: { platform: input.platform, ...(input.details || {}) },
      },
    });

    return { data: auditLog, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to log token refresh',
      },
    };
  }
}

/**
 * Log failure event
 */
export async function logFailure(input: {
  connectionId: string;
  platform: Platform;
  details: {
    error: string;
    code?: string;
    statusCode?: number;
  };
}) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        resourceId: input.connectionId,
        resourceType: 'connection',
        action: 'FAILED',
        metadata: { platform: input.platform, ...input.details },
      },
    });

    return { data: auditLog, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to log failure',
      },
    };
  }
}

/**
 * Get audit trail for a connection
 */
export async function getConnectionAuditTrail(
  connectionId: string,
  platform?: Platform,
  limit?: number
) {
  try {
    const where: any = {
      resourceId: connectionId,
      resourceType: 'connection',
    };

    if (platform) {
      where.metadata = {
        path: ['platform'],
        equals: platform,
      };
    }

    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { data: auditLogs, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve audit trail',
      },
    };
  }
}

/**
 * Create a general audit log entry
 * For flexible logging when specific methods don't fit
 */
export type AuditLogInput = {
  agencyId?: string;
  userEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  agencyConnectionId?: string;
  platform?: Platform | string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  request?: FastifyRequest;
};

export async function createAuditLog(input: AuditLogInput) {
  try {
    // Extract IP and user agent from request if provided
    const ipAddress = input.ipAddress || (input.request ? extractClientIp(input.request) : '0.0.0.0');
    const userAgent = input.userAgent || (input.request ? extractUserAgent(input.request) : 'unknown');

    const auditLog = await prisma.auditLog.create({
      data: {
        agencyId: input.agencyId,
        userEmail: input.userEmail,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        agencyConnectionId: input.agencyConnectionId,
        metadata: input.details || input.metadata || {},
        ipAddress,
        userAgent,
      },
    });

    return { data: auditLog, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create audit log',
      },
    };
  }
}

/**
 * Create several audit log entries in a single insert.
 * Same row shape as createAuditLog; use for batched writes.
 */
export async function createAuditLogs(inputs: AuditLogInput[]) {
  if (inputs.length === 0) {
    return { data: { count: 0 }, error: null };
  }

  try {
    const result = await prisma.auditLog.createMany({
      data: inputs.map((input) => ({
        agencyId: input.agencyId,
        userEmail: input.userEmail,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        agencyConnectionId: input.agencyConnectionId,
        metadata: input.details || input.metadata || {},
        ipAddress: input.ipAddress || (input.request ? extractClientIp(input.request) : '0.0.0.0'),
        userAgent: input.userAgent || (input.request ? extractUserAgent(input.request) : 'unknown'),
      })),
    });

    return { data: result, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create audit logs',
      },
    };
  }
}

/**
 * Get security events for an agency
 */
export async function getSecurityEvents(agencyId: string, days: number) {
  try {
    // Get all connections for this agency
    const connections = await prisma.clientConnection.findMany({
      where: { agencyId },
      select: { id: true },
    });

    const connectionIds = connections.map((c: any) => c.id);

    // Calculate date threshold
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get security events (failures and revokes) for the time period
    const securityEvents = await prisma.auditLog.findMany({
      where: {
        resourceId: { in: connectionIds },
        resourceType: 'connection',
        action: { in: ['FAILED', 'REVOKED'] },
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: securityEvents, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve security events',
      },
    };
  }
}

/**
 * Audit Service
 * Exports all audit-related service functions as a single object
 */
export const auditService = {
  logTokenAccess,
  logTokenGrant,
  logTokenRevoke,
  logTokenRefresh,
  logFailure,
  createAuditLog,
  createAuditLogs,
  getConnectionAuditTrail,
  getSecurityEvents,
};
