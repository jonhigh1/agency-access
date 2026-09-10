import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { getConnector } from '@/services/connectors/factory';
import { ConnectorError } from '@/services/connectors/base.connector';
import {
  ensureAgencyAccessToken,
  refreshAgencyPlatformConnection,
  refreshClientPlatformAuthorization,
} from '@/services/token-lifecycle.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agencyPlatformConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    platformAuthorization: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    clientConnection: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/infisical', () => ({
  infisical: {
    getOAuthTokens: vi.fn(),
    retrieveOAuthTokens: vi.fn(),
    updateOAuthTokens: vi.fn(),
  },
}));

vi.mock('@/services/connectors/factory', () => ({
  getConnector: vi.fn(),
}));

describe('tokenLifecycleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes an agency connection for refreshable OAuth platforms', async () => {
    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
      id: 'agency-conn-1',
      agencyId: 'agency-1',
      platform: 'google',
      secretId: 'google_agency_agency-1',
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60_000),
    });

    vi.mocked(getConnector).mockReturnValue({
      refreshToken: vi.fn().mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    } as any);

    vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({
      id: 'agency-conn-1',
    } as any);

    const result = await refreshAgencyPlatformConnection('agency-1', 'google');

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      outcome: 'refreshed',
      accessToken: 'new-token',
    });
    expect(infisical.updateOAuthTokens).toHaveBeenCalledWith(
      'google_agency_agency-1',
      expect.objectContaining({
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
      })
    );
  });

  it('returns reconnect_required for expired non-refreshable OAuth platforms', async () => {
    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
      id: 'agency-conn-2',
      agencyId: 'agency-1',
      platform: 'meta',
      secretId: 'meta_agency_agency-1',
      status: 'active',
      expiresAt: new Date(Date.now() - 60_000),
    } as any);

    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'expired-meta-token',
      expiresAt: new Date(Date.now() - 60_000),
    });

    const result = await ensureAgencyAccessToken('agency-1', 'meta');

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: 'RECONNECT_REQUIRED',
    });
    expect(getConnector).not.toHaveBeenCalled();
  });

  it('does not attempt refresh for manual-only connectors', async () => {
    vi.mocked(prisma.platformAuthorization.findFirst).mockResolvedValue({
      id: 'auth-1',
      connectionId: 'connection-1',
      platform: 'klaviyo',
      secretId: 'oauth_klaviyo_connection-1',
      status: 'active',
      expiresAt: null,
    } as any);

    const result = await refreshClientPlatformAuthorization('connection-1', 'klaviyo' as any);

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: 'MANUAL_CONNECTION',
    });
    expect(getConnector).not.toHaveBeenCalled();
  });
});

describe('tokenLifecycleService — refresh token rotation invariant', () => {
  const CONNECTION_ID = 'conn-snap-1';
  const SECRET_ID = 'oauth_snapchat_conn-snap-1';
  const AUTH_ID = 'auth-snap-1';
  const STORED_REFRESH = 'stored-refresh-token';
  const NEW_EXPIRY = new Date(Date.now() + 3_600_000);

  function mockClientTarget() {
    vi.mocked(prisma.platformAuthorization.findFirst).mockResolvedValue({
      id: AUTH_ID,
      connectionId: CONNECTION_ID,
      platform: 'snapchat',
      secretId: SECRET_ID,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    vi.mocked(infisical.retrieveOAuthTokens).mockResolvedValue({
      accessToken: 'old-access-token',
      refreshToken: STORED_REFRESH,
      expiresAt: new Date(Date.now() + 60_000),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientTarget();
  });

  it('persists the rotated refresh token when the refresh response returns one', async () => {
    vi.mocked(getConnector).mockReturnValue({
      refreshToken: vi.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'rotated-refresh-token',
        expiresAt: NEW_EXPIRY,
      }),
    } as any);

    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: AUTH_ID } as any);

    const result = await refreshClientPlatformAuthorization(CONNECTION_ID, 'snapchat');

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      outcome: 'refreshed',
      accessToken: 'new-access-token',
    });
    // Exact payload: the rotated token must be written, not dropped.
    expect(infisical.updateOAuthTokens).toHaveBeenCalledWith(SECRET_ID, {
      accessToken: 'new-access-token',
      refreshToken: 'rotated-refresh-token',
      expiresAt: NEW_EXPIRY,
    });
    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith({
      where: { id: AUTH_ID },
      data: expect.objectContaining({ status: 'active' }),
    });
  });

  it('persists the stored refresh token unchanged when the refresh response omits one', async () => {
    vi.mocked(getConnector).mockReturnValue({
      refreshToken: vi.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: undefined,
        expiresAt: NEW_EXPIRY,
      }),
    } as any);

    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: AUTH_ID } as any);

    const result = await refreshClientPlatformAuthorization(CONNECTION_ID, 'snapchat');

    expect(result.error).toBeNull();
    // Infisical updateOAuthTokens rewrites the whole secret JSON, so the stored
    // refresh token must be carried forward or rotation would erase it.
    expect(infisical.updateOAuthTokens).toHaveBeenCalledWith(SECRET_ID, {
      accessToken: 'new-access-token',
      refreshToken: STORED_REFRESH,
      expiresAt: NEW_EXPIRY,
    });
  });

  it('leaves the connection untouched for a retryable refresh failure', async () => {
    vi.mocked(getConnector).mockReturnValue({
      refreshToken: vi
        .fn()
        .mockRejectedValue(
          new ConnectorError('snapchat', 'REFRESH_RETRYABLE', 'Token endpoint returned 503')
        ),
    } as any);

    const result = await refreshClientPlatformAuthorization(CONNECTION_ID, 'snapchat');

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({ code: 'REFRESH_RETRYABLE' });
    // Status must not flip to invalid: the token-refresh scan only picks up
    // active authorizations, so an untouched row retries on the next scan.
    expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
    expect(infisical.updateOAuthTokens).not.toHaveBeenCalled();
  });

  it('marks the connection invalid for a terminal refresh failure', async () => {
    vi.mocked(getConnector).mockReturnValue({
      refreshToken: vi
        .fn()
        .mockRejectedValue(
          new ConnectorError('snapchat', 'INVALID_REFRESH', 'invalid_grant: refresh token revoked')
        ),
    } as any);

    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: AUTH_ID } as any);

    const result = await refreshClientPlatformAuthorization(CONNECTION_ID, 'snapchat');

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({ code: 'INVALID_TOKEN' });
    expect(prisma.platformAuthorization.update).toHaveBeenCalledWith({
      where: { id: AUTH_ID },
      data: { status: 'invalid' },
    });
  });
});
