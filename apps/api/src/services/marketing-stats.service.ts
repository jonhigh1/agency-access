/**
 * Marketing Stats Service
 *
 * Public, aggregate, anonymous counters for the marketing site.
 * Counts only — no PII, no agency-scoped rows. Typed prisma counts
 * (not raw SQL) so table-name drift cannot break the aggregate.
 */

import { prisma } from '../lib/prisma.js';

export interface MarketingStats {
  agencies: number;
  activeClientConnections: number;
  activePlatformAuthorizations: number;
  completedAccessRequests: number;
  tokenRefreshes: number;
}

export async function getMarketingStats(): Promise<{ data: MarketingStats | null; error: any }> {
  try {
    const [
      agencies,
      activeClientConnections,
      activePlatformAuthorizations,
      completedAccessRequests,
      tokenRefreshes,
    ] = await Promise.all([
      prisma.agency.count(),
      prisma.clientConnection.count({ where: { status: 'active' } }),
      prisma.platformAuthorization.count({ where: { status: 'active' } }),
      prisma.accessRequest.count({ where: { status: 'completed' } }),
      prisma.auditLog.count({ where: { action: 'REFRESHED' } }),
    ]);

    return {
      data: {
        agencies,
        activeClientConnections,
        activePlatformAuthorizations,
        completedAccessRequests,
        tokenRefreshes,
      },
      error: null,
    };
  } catch (error) {
    console.error('Failed to get marketing stats:', error);
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve marketing stats',
      },
    };
  }
}
