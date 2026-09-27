import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    META_APP_ID: 'test-meta-app-id',
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    platformAuthorization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/infisical', () => ({
  infisical: {
    getOAuthTokens: vi.fn(),
    storeOAuthTokens: vi.fn(),
  },
}));

vi.mock('@/services/audit.service', () => ({
  createAuditLog: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { createAuditLog } from '@/services/audit.service';
import { metaOBOService } from '../meta-obo.service.js';

describe('MetaOBOService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('reads the client Meta token from Infisical and writes an OBO audit log', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      connectionId: 'conn-1',
      secretId: 'meta_client_secret',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: { adAccounts: ['act_1'] },
        },
      },
    } as any);
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'client-user-token',
    });
    vi.mocked(createAuditLog).mockResolvedValue({ data: {}, error: null } as any);

    const result = await metaOBOService.getClientAccessTokenForOBO({
      authorizationId: 'auth-1',
      connectionId: 'conn-1',
      agencyId: 'agency-1',
      userEmail: 'owner@agency.test',
      ipAddress: '127.0.0.1',
      purpose: 'managed_business_link',
    });

    expect(result.error).toBeNull();
    expect(result.data?.accessToken).toBe('client-user-token');
    expect(infisical.getOAuthTokens).toHaveBeenCalledWith('meta_client_secret');
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        userEmail: 'owner@agency.test',
        action: 'META_OBO_TOKEN_READ',
        resourceType: 'connection',
        resourceId: 'conn-1',
        ipAddress: '127.0.0.1',
        metadata: expect.objectContaining({
          authorizationId: 'auth-1',
          secretId: 'meta_client_secret',
          purpose: 'managed_business_link',
          platform: 'meta',
        }),
      })
    );
  });

  it('does not read a token for an inactive Meta authorization', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1', connectionId: 'conn-1', secretId: 'meta_client_secret', status: 'invalid', metadata: {},
    } as any);

    const result = await metaOBOService.getClientAccessTokenForOBO({
      authorizationId: 'auth-1', connectionId: 'conn-1', purpose: 'meta_asset_grant',
    });

    expect(result.error?.code).toBe('REAUTHORIZATION_REQUIRED');
    expect(infisical.getOAuthTokens).not.toHaveBeenCalled();
  });

  it('does not return a client token when its audit event cannot be recorded', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      connectionId: 'conn-1',
      secretId: 'meta_client_secret',
      status: 'active',
      metadata: {},
    } as any);
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({ accessToken: 'client-user-token' });
    vi.mocked(createAuditLog).mockResolvedValue({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create audit log' },
    } as any);

    const result = await metaOBOService.getClientAccessTokenForOBO({
      authorizationId: 'auth-1',
      connectionId: 'conn-1',
      purpose: 'meta_asset_grant',
    });

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('TOKEN_READ_FAILED');
    expect(infisical.getOAuthTokens).toHaveBeenCalledWith('meta_client_secret');
  });

  it('returns a manual partner-business action without calling managed_businesses', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
      id: 'auth-1',
      connectionId: 'conn-1',
      secretId: 'meta_client_secret',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: { adAccounts: ['act_1'] },
        },
      },
    } as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);
    vi.mocked(createAuditLog).mockResolvedValue({ data: {}, error: null } as any);
    const result = await metaOBOService.ensureManagedBusinessRelationship({
      authorizationId: 'auth-1',
      connectionId: 'conn-1',
      agencyId: 'agency-1',
      userEmail: 'owner@agency.test',
      ipAddress: '127.0.0.1',
      partnerBusinessId: 'partner-bm-1',
      clientBusinessId: 'client-bm-1',
      clientBusinessAdminAccessToken: 'client-user-token',
    });

    expect(result).toEqual({
      data: {
        status: 'manual_action_required',
        partnerBusinessId: 'partner-bm-1',
        clientBusinessId: 'client-bm-1',
        nextAction:
          'In Meta Business Settings, add partner business portfolio partner-bm-1 to client business portfolio client-bm-1, then retry access verification in AuthHub.',
      },
      error: null,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(prisma.platformAuthorization.update).not.toHaveBeenCalled();
  });

  it('uses a pre-fetched authorization without another database read', async () => {
    const authorization = {
      id: 'auth-1',
      connectionId: 'conn-1',
      secretId: 'meta_client_secret',
      status: 'active',
      metadata: {
        selectedAssets: {
          meta_ads: { adAccounts: ['act_1'] },
        },
      },
    };

    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(authorization as any);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({ id: 'auth-1' } as any);
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({ accessToken: 'client-user-token' });
    vi.mocked(createAuditLog).mockResolvedValue({ data: {}, error: null } as any);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const tokenResult = await metaOBOService.getClientAccessTokenForOBO({
      authorizationId: 'auth-1',
      connectionId: 'conn-1',
      purpose: 'meta_asset_grant',
      authorization,
    } as any);
    expect(tokenResult.error).toBeNull();
    expect(tokenResult.data?.accessToken).toBe('client-user-token');
    expect(infisical.getOAuthTokens).toHaveBeenCalledWith('meta_client_secret');

    const linkResult = await metaOBOService.ensureManagedBusinessRelationship({
      authorizationId: 'auth-1',
      connectionId: 'conn-1',
      partnerBusinessId: 'partner-bm-1',
      clientBusinessId: 'client-bm-1',
      clientBusinessAdminAccessToken: 'client-user-token',
    });
    expect(linkResult.error).toBeNull();

    expect(prisma.platformAuthorization.findUnique).not.toHaveBeenCalled();
  });
});
