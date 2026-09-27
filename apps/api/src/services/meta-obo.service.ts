import {
  type MetaClientAuthorizationMetadata,
  type MetaManagedBusinessLinkState,
} from '@agency-platform/shared';

import { infisical } from '@/lib/infisical';
import { readMetaAuthorizationMetadata } from '@/lib/meta-authorization-metadata';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/services/audit.service';
import type { ServiceError, ServiceResult } from '@/lib/service-result';

type PlatformAuthorizationRecord = {
  id: string;
  connectionId: string;
  secretId: string;
  status: string;
  metadata: unknown;
};

type OBOAuditContext = {
  agencyId?: string;
  connectionId: string;
  ipAddress?: string;
  userEmail?: string;
};

function createServiceError(code: string, message: string, details?: unknown): ServiceError {
  return { code, message, details };
}

async function writeAuditLog(
  context: OBOAuditContext,
  action: string,
  metadata: Record<string, unknown>
) {
  const result = await createAuditLog({
    agencyId: context.agencyId,
    userEmail: context.userEmail,
    action,
    resourceType: 'connection',
    resourceId: context.connectionId,
    ipAddress: context.ipAddress,
    metadata,
  });
  if (result.error) {
    throw new Error('Failed to record Meta token access audit event');
  }
}

class MetaOBOService {
  private async getAuthorization(authorizationId: string): Promise<ServiceResult<PlatformAuthorizationRecord>> {
    const authorization = await prisma.platformAuthorization.findUnique({
      where: { id: authorizationId },
    });

    if (!authorization) {
      return {
        data: null,
        error: createServiceError('NOT_FOUND', 'Meta platform authorization not found'),
      };
    }

    return {
      data: authorization as PlatformAuthorizationRecord,
      error: null,
    };
  }

  private async updateAuthorizationMeta(
    authorizationId: string,
    updater: (currentMeta: MetaClientAuthorizationMetadata) => MetaClientAuthorizationMetadata
  ): Promise<ServiceResult<void>> {
    const authorizationResult = await this.getAuthorization(authorizationId);
    if (authorizationResult.error || !authorizationResult.data) {
      return {
        data: null,
        error: authorizationResult.error,
      };
    }

    const { rootMetadata, metaMetadata } = readMetaAuthorizationMetadata(authorizationResult.data.metadata);
    const nextMeta = updater(metaMetadata);

    await prisma.platformAuthorization.update({
      where: { id: authorizationId },
      data: {
        metadata: {
          ...rootMetadata,
          meta: nextMeta,
        },
      },
    });

    return { data: null, error: null };
  }

  async getClientAccessTokenForOBO(input: {
    authorizationId: string;
    connectionId: string;
    agencyId?: string;
    userEmail?: string;
    ipAddress?: string;
    purpose: string;
    // Pre-fetched authorization row (same id). Status must still be active.
    authorization?: PlatformAuthorizationRecord;
  }): Promise<ServiceResult<{ accessToken: string }>> {
    const authorization = input.authorization ?? (await this.getAuthorization(input.authorizationId)).data;
    if (!authorization) {
      return {
        data: null,
        error: createServiceError('NOT_FOUND', 'Meta platform authorization not found'),
      };
    }

    if (authorization.status !== 'active') {
      return {
        data: null,
        error: createServiceError('REAUTHORIZATION_REQUIRED', 'Meta authorization is inactive. Reconnect before granting access.'),
      };
    }

    try {
      const tokens = await infisical.getOAuthTokens(authorization.secretId);

      await writeAuditLog(
        {
          agencyId: input.agencyId,
          connectionId: input.connectionId,
          ipAddress: input.ipAddress,
          userEmail: input.userEmail,
        },
        'META_OBO_TOKEN_READ',
        {
          authorizationId: input.authorizationId,
          platform: 'meta',
          purpose: input.purpose,
          secretId: authorization.secretId,
        }
      );

      return {
        data: {
          accessToken: tokens.accessToken,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: createServiceError(
          'TOKEN_READ_FAILED',
          error instanceof Error ? error.message : 'Failed to read Meta token'
        ),
      };
    }
  }

  async ensureManagedBusinessRelationship(input: {
    authorizationId: string;
    connectionId: string;
    agencyId?: string;
    userEmail?: string;
    ipAddress?: string;
    partnerBusinessId: string;
    clientBusinessId: string;
    clientBusinessAdminAccessToken: string;
  }): Promise<ServiceResult<MetaManagedBusinessLinkState>> {
    const manualState: MetaManagedBusinessLinkState = {
      status: 'manual_action_required',
      partnerBusinessId: input.partnerBusinessId,
      clientBusinessId: input.clientBusinessId,
      nextAction: `In Meta Business Settings, add partner business portfolio ${input.partnerBusinessId} to client business portfolio ${input.clientBusinessId}, then retry access verification in AuthHub.`,
    };

    return {
      data: manualState,
      error: null,
    };
  }
}

export const metaOBOService = new MetaOBOService();
