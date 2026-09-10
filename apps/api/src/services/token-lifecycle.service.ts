import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { getConnector } from '@/services/connectors/factory';
import { ConnectorError } from '@/services/connectors/base.connector';
import {
  getPlatformTokenCapability,
  type Platform,
} from '@agency-platform/shared';
import type { ServiceError, ServiceResult } from '@/lib/service-result';

type RefreshOutcome = 'refreshed' | 'still_valid';

type RefreshSuccess = {
  outcome: RefreshOutcome;
  accessToken: string;
  expiresAt?: Date;
};

type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};

type AgencyTarget = {
  kind: 'agency';
  id: string;
  agencyId: string;
  platform: Platform;
  secretId: string;
  status: string;
};

type ClientTarget = {
  kind: 'client';
  id: string;
  connectionId: string;
  platform: Platform;
  secretId: string;
  status: string;
};

type LifecycleTarget = AgencyTarget | ClientTarget;

function isExpiring(expiresAt: Date | undefined, thresholdDays: number): boolean {
  if (!expiresAt) {
    return false;
  }

  const threshold = new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000);
  return expiresAt <= threshold;
}

function isExpired(expiresAt: Date | undefined): boolean {
  return !!expiresAt && expiresAt <= new Date();
}

async function updateTargetStatus(target: LifecycleTarget, status: 'active' | 'expired' | 'invalid') {
  if (target.kind === 'agency') {
    await prisma.agencyPlatformConnection.update({
      where: { id: target.id },
      data: {
        status,
      },
    });
    return;
  }

  await prisma.platformAuthorization.update({
    where: { id: target.id },
    data: {
      status,
    },
  });
}

async function persistRefreshedTokens(
  target: LifecycleTarget,
  tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }
) {
  await infisical.updateOAuthTokens(target.secretId, tokens);

  if (target.kind === 'agency') {
    await prisma.agencyPlatformConnection.update({
      where: { id: target.id },
      data: {
        expiresAt: tokens.expiresAt,
        lastRefreshedAt: new Date(),
        status: 'active',
      },
    });
    return;
  }

  await prisma.platformAuthorization.update({
    where: { id: target.id },
    data: {
      expiresAt: tokens.expiresAt,
      lastRefreshedAt: new Date(),
      status: 'active',
    },
  });
}

async function refreshTarget(
  target: LifecycleTarget,
  storedTokens: StoredTokens
): Promise<ServiceResult<RefreshSuccess>> {
  const capability = getPlatformTokenCapability(target.platform);

  if (capability.connectionMethod !== 'oauth') {
    return {
      data: null,
      error: {
        code: 'MANUAL_CONNECTION',
        message: `${target.platform} is not an OAuth refreshable connector`,
      },
    };
  }

  if (capability.refreshStrategy !== 'automatic') {
    if (isExpired(storedTokens.expiresAt)) {
      await updateTargetStatus(target, 'expired');
    }

    return {
      data: null,
      error: {
        code: 'RECONNECT_REQUIRED',
        message: `${target.platform} requires reconnect instead of automatic refresh`,
      },
    };
  }

  if (!storedTokens.refreshToken) {
    return {
      data: null,
      error: {
        code: 'NO_REFRESH_TOKEN',
        message: `No refresh token available for ${target.platform}`,
      },
    };
  }

  const connector = getConnector(target.platform);

  if (!connector.refreshToken) {
    return {
      data: null,
      error: {
        code: 'NOT_SUPPORTED',
        message: `${target.platform} does not support token refresh`,
      },
    };
  }

  try {
    const refreshed = await connector.refreshToken(storedTokens.refreshToken);
    const persisted = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || storedTokens.refreshToken,
      expiresAt: refreshed.expiresAt,
    };

    await persistRefreshedTokens(target, persisted);

    return {
      data: {
        outcome: 'refreshed',
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
      },
      error: null,
    };
  } catch (error) {
    // Transient refresh failures (e.g. Snapchat 429/5xx from the token endpoint)
    // must not strand the connection as invalid. Leave the row untouched so the
    // next token-refresh scan retries, and surface a distinguishable code.
    if (error instanceof ConnectorError && error.code === 'REFRESH_RETRYABLE') {
      return {
        data: null,
        error: {
          code: 'REFRESH_RETRYABLE',
          message: error.message,
        },
      };
    }

    await updateTargetStatus(target, 'invalid');

    return {
      data: null,
      error: {
        code: 'INVALID_TOKEN',
        message: error instanceof Error
          ? error.message
          : `Failed to refresh ${target.platform} token`,
      },
    };
  }
}

async function loadAgencyTarget(
  agencyId: string,
  platform: Platform
): Promise<ServiceResult<AgencyTarget>> {
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

  if (!connection.secretId) {
    return {
      data: null,
      error: {
        code: 'TOKEN_NOT_FOUND',
        message: 'No secret ID associated with this connection',
      },
    };
  }

  return {
    data: {
      kind: 'agency',
      id: connection.id,
      agencyId,
      platform,
      secretId: connection.secretId,
      status: connection.status,
    },
    error: null,
  };
}

async function loadClientTarget(
  connectionId: string,
  platform: Platform
): Promise<ServiceResult<ClientTarget>> {
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

  return {
    data: {
      kind: 'client',
      id: authorization.id,
      connectionId,
      platform,
      secretId: authorization.secretId,
      status: authorization.status,
    },
    error: null,
  };
}

export async function refreshAgencyPlatformConnection(
  agencyId: string,
  platform: Platform
): Promise<ServiceResult<RefreshSuccess>> {
  const targetResult = await loadAgencyTarget(agencyId, platform);
  if (targetResult.error || !targetResult.data) {
    return {
      data: null,
      error: targetResult.error,
    };
  }

  const tokens = await infisical.getOAuthTokens(targetResult.data.secretId);

  if (!tokens?.accessToken) {
    return {
      data: null,
      error: {
        code: 'TOKEN_NOT_FOUND',
        message: 'Access token not found for this connection',
      },
    };
  }

  return refreshTarget(targetResult.data, tokens);
}

export async function refreshClientPlatformAuthorization(
  connectionId: string,
  platform: Platform
): Promise<ServiceResult<RefreshSuccess>> {
  const targetResult = await loadClientTarget(connectionId, platform);
  if (targetResult.error || !targetResult.data) {
    return {
      data: null,
      error: targetResult.error,
    };
  }

  const capability = getPlatformTokenCapability(platform);
  if (capability.connectionMethod !== 'oauth') {
    return {
      data: null,
      error: {
        code: 'MANUAL_CONNECTION',
        message: `${platform} is not an OAuth refreshable connector`,
      },
    };
  }

  const tokens = await infisical.retrieveOAuthTokens(targetResult.data.secretId);

  if (!tokens?.accessToken) {
    return {
      data: null,
      error: {
        code: 'TOKENS_NOT_FOUND',
        message: 'Tokens not found in secure storage',
      },
    };
  }

  return refreshTarget(targetResult.data, tokens);
}

export async function ensureAgencyAccessToken(
  agencyId: string,
  platform: Platform,
  options: { refreshThresholdDays?: number } = {}
): Promise<ServiceResult<RefreshSuccess>> {
  const refreshThresholdDays = options.refreshThresholdDays ?? 5;
  const targetResult = await loadAgencyTarget(agencyId, platform);
  if (targetResult.error || !targetResult.data) {
    console.error('[ensureAgencyAccessToken] Failed to load agency target:', {
      agencyId,
      platform,
      error: targetResult.error,
    });
    return {
      data: null,
      error: targetResult.error,
    };
  }

  if (targetResult.data.status !== 'active') {
    console.error('[ensureAgencyAccessToken] Connection not active:', {
      agencyId,
      platform,
      status: targetResult.data.status,
    });
    return {
      data: null,
      error: {
        code: 'CONNECTION_NOT_ACTIVE',
        message: 'Platform connection is not active',
      },
    };
  }

  let tokens;
  try {
    tokens = await infisical.getOAuthTokens(targetResult.data.secretId);
  } catch (infisicalError) {
    console.error('[ensureAgencyAccessToken] Failed to get tokens from Infisical:', {
      agencyId,
      platform,
      secretId: targetResult.data.secretId,
      error: infisicalError instanceof Error ? infisicalError.message : String(infisicalError),
    });
    return {
      data: null,
      error: {
        code: 'TOKEN_NOT_FOUND',
        message: 'Failed to retrieve tokens from secure storage',
      },
    };
  }

  if (!tokens?.accessToken) {
    console.error('[ensureAgencyAccessToken] No access token in Infisical response:', {
      agencyId,
      platform,
      secretId: targetResult.data.secretId,
      hasTokens: !!tokens,
    });
    return {
      data: null,
      error: {
        code: 'TOKEN_NOT_FOUND',
        message: 'Access token not found for this connection',
      },
    };
  }

  const capability = getPlatformTokenCapability(platform);

  if (capability.connectionMethod === 'api_key' || capability.expiryBehavior === 'non_expiring') {
    return {
      data: {
        outcome: 'still_valid',
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
      },
      error: null,
    };
  }

  if (!tokens.expiresAt || !isExpiring(tokens.expiresAt, refreshThresholdDays)) {
    return {
      data: {
        outcome: 'still_valid',
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
      },
      error: null,
    };
  }

  if (capability.refreshStrategy === 'automatic') {
    const refreshResult = await refreshTarget(targetResult.data, tokens);

    if (!refreshResult.error) {
      return refreshResult;
    }

    if (!isExpired(tokens.expiresAt)) {
      return {
        data: {
          outcome: 'still_valid',
          accessToken: tokens.accessToken,
          expiresAt: tokens.expiresAt,
        },
        error: null,
      };
    }

    return refreshResult;
  }

  if (isExpired(tokens.expiresAt)) {
    await updateTargetStatus(targetResult.data, 'expired');
    return {
      data: null,
      error: {
        code: 'RECONNECT_REQUIRED',
        message: `${platform} authorization has expired and requires reconnect`,
      },
    };
  }

  return {
    data: {
      outcome: 'still_valid',
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
    },
    error: null,
  };
}
