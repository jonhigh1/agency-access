import { Prisma } from '@prisma/client';
import type {
  AccessRequestStatus,
  ManualConfirmationPlatform,
  ManualConfirmationResponseData,
} from '@agency-platform/shared';
import { prisma } from '@/lib/prisma.js';
import { accessRequestService } from '@/services/access-request.service.js';

type ManualConfirmationError = {
  code: string;
  message: string;
};

type ConfirmManualAccessInput = {
  accessRequestId: string;
  agencyId: string;
  platform: ManualConfirmationPlatform;
  actorId: string;
  actorEmail: string;
  ipAddress: string;
  userAgent: string;
};

type LockedAccessRequest = {
  id: string;
  status: string;
  expires_at: Date;
  platforms: Prisma.JsonValue;
};

type LockedConnection = {
  id: string;
  status: string;
  granted_assets: Prisma.JsonValue | null;
};

const DEV_BYPASS_USER_ID = 'dev_user_test_123456789';

export function isManualConfirmationActorId(actorId: unknown): actorId is string {
  return typeof actorId === 'string' && (
    actorId.startsWith('user_') ||
    (process.env.NODE_ENV === 'development' && actorId === DEV_BYPASS_USER_ID)
  );
}

function isRequested(platforms: Prisma.JsonValue, platform: ManualConfirmationPlatform): boolean {
  if (!Array.isArray(platforms)) return false;

  return platforms.some((entry) => {
    if (typeof entry === 'string') return entry === platform;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;

    if (entry.platform === platform || entry.platformGroup === platform) return true;
    if (!Array.isArray(entry.products)) return false;

    return entry.products.some((product) =>
      typeof product === 'string'
        ? product === platform
        : Boolean(product && typeof product === 'object' && !Array.isArray(product) && product.product === platform)
    );
  });
}

function error(code: string, message: string) {
  return { data: null, error: { code, message } satisfies ManualConfirmationError };
}

export async function confirmManualAccess(input: ConfirmManualAccessInput): Promise<{
  data: ManualConfirmationResponseData | null;
  error: ManualConfirmationError | null;
}> {
  if (!isManualConfirmationActorId(input.actorId)) {
    return error('AGENCY_USER_REQUIRED', 'A verified agency user is required to confirm manual access');
  }

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      const [accessRequest] = await tx.$queryRaw<LockedAccessRequest[]>(Prisma.sql`
        SELECT id, status, expires_at, platforms
        FROM access_requests
        WHERE id = ${input.accessRequestId} AND agency_id = ${input.agencyId}
        FOR UPDATE
      `);

      if (!accessRequest) return error('NOT_FOUND', 'Access request not found');
      if (accessRequest.status === 'revoked') {
        return error('REQUEST_REVOKED', 'Access request has been revoked');
      }
      if (accessRequest.status === 'expired' || accessRequest.expires_at < new Date()) {
        return error('REQUEST_EXPIRED', 'Access request has expired');
      }
      if (!isRequested(accessRequest.platforms, input.platform)) {
        return error('PLATFORM_NOT_REQUESTED', 'Platform was not requested in this access request');
      }

      const [connection] = await tx.$queryRaw<LockedConnection[]>(Prisma.sql`
        SELECT id, status, granted_assets
        FROM client_connections
        WHERE access_request_id = ${input.accessRequestId} AND agency_id = ${input.agencyId}
        FOR UPDATE
      `);
      if (connection && ['revoked', 'expired'].includes(connection.status)) {
        return error('MANUAL_CONNECTION_UNAVAILABLE', 'This connection cannot receive manual confirmation');
      }
      const grantedAssets = connection?.granted_assets;
      const assets = grantedAssets && typeof grantedAssets === 'object' && !Array.isArray(grantedAssets)
        ? grantedAssets as Record<string, unknown>
        : null;
      const grantValue = assets?.[input.platform];
      const grant = grantValue && typeof grantValue === 'object' && !Array.isArray(grantValue)
        ? grantValue as Record<string, unknown>
        : null;

      if (!connection || !assets || !grant || grant.platform !== input.platform) {
        return error('MANUAL_EVIDENCE_NOT_FOUND', 'Pending manual access evidence was not found');
      }

      if (grant.verificationStatus === 'verified') {
        if (grant.verificationMethod !== 'manual_review' || typeof grant.verifiedAt !== 'string') {
          return error('MANUAL_EVIDENCE_ALREADY_VERIFIED', 'Manual access evidence was already verified');
        }
        return {
          data: {
            confirmation: {
              platform: input.platform,
              verificationStatus: 'verified' as const,
              verificationMethod: 'manual_review' as const,
              verifiedAt: grant.verifiedAt,
            },
          },
          error: null,
        };
      }

      if (grant.verificationStatus !== 'pending') {
        return error('MANUAL_EVIDENCE_NOT_FOUND', 'Pending manual access evidence was not found');
      }

      const verifiedAt = new Date().toISOString();
      await tx.clientConnection.update({
        where: { id: connection.id },
        data: {
          ...(connection.status === 'pending_verification' ? { status: 'active' } : {}),
          grantedAssets: {
            ...assets,
            [input.platform]: {
              ...grant,
              verificationStatus: 'verified',
              verificationMethod: 'manual_review',
              verifiedAt,
              verifiedBy: input.actorId,
            },
          } as Prisma.InputJsonObject,
        },
      });
      await tx.auditLog.create({
        data: {
          agencyId: input.agencyId,
          userEmail: input.actorEmail,
          action: 'MANUAL_ACCESS_CONFIRMED',
          resourceType: 'client_connection',
          resourceId: connection.id,
          actorType: 'agency_user',
          actorId: input.actorId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: {
            accessRequestId: input.accessRequestId,
            platform: input.platform,
            verificationMethod: 'manual_review',
          },
        },
      });

      return {
        data: {
          confirmation: {
            platform: input.platform,
            verificationStatus: 'verified' as const,
            verificationMethod: 'manual_review' as const,
            verifiedAt,
          },
        },
        error: null,
      };
    });

    if (transactionResult.error || !transactionResult.data) return transactionResult;

    const lifecycle = await accessRequestService.markRequestAuthorized(input.accessRequestId);
    if (lifecycle.error || !lifecycle.data) {
      return {
        data: null,
        error: lifecycle.error || {
          code: 'INTERNAL_ERROR',
          message: 'Failed to recompute access request status',
        },
      };
    }

    return {
      data: {
        confirmation: transactionResult.data.confirmation,
        requestStatus: lifecycle.data.status as AccessRequestStatus,
      },
      error: null,
    };
  } catch {
    return error('INTERNAL_ERROR', 'Failed to confirm manual access');
  }
}

export const manualConfirmationService = {
  confirmManualAccess,
};
