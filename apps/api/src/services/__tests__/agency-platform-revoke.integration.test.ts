/**
 * Integration test: failed Infisical deletion blocks completed revocation
 *
 * Verifies the service calls the strict Infisical delete and keeps the
 * connection inactive and retryable when the SDK rejects.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import * as agencyPlatformService from '@/services/agency-platform.service';

const deleteSecretMock = vi.fn();
const { deleteCacheMock, invalidateDashboardCacheMock } = vi.hoisted(() => ({
  deleteCacheMock: vi.fn(async () => true),
  invalidateDashboardCacheMock: vi.fn(async () => {}),
}));

vi.mock('@infisical/sdk', () => ({
  InfisicalSDK: function () {
    return {
      auth: () => ({
        universalAuth: { login: vi.fn().mockResolvedValue(undefined) },
      }),
      secrets: () => ({ deleteSecret: deleteSecretMock }),
    };
  },
  SecretType: { Shared: 'shared' },
}));

vi.mock('@/lib/env', () => ({
  env: {
    INFISICAL_CLIENT_ID: 'test-id',
    INFISICAL_CLIENT_SECRET: 'test-secret',
    INFISICAL_PROJECT_ID: 'test-project',
    INFISICAL_ENVIRONMENT: 'dev',
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agencyPlatformConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('@/lib/cache', () => ({
  CacheKeys: { agencyConnections: (id: string) => `agency:${id}:connections` },
  deleteCache: deleteCacheMock,
  invalidateDashboardCache: invalidateDashboardCacheMock,
}));

vi.mock('@/services/token-lifecycle.service', () => ({
  ensureAgencyAccessToken: vi.fn(),
}));

describe('revokeConnection integration (Infisical delete failure)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not report revocation complete when Infisical deleteSecret rejects', async () => {
    deleteSecretMock.mockRejectedValue(new Error('Infisical service unavailable'));

    const mockConnection = {
      id: 'conn-1',
      agencyId: 'agency-1',
      platform: 'meta',
      secretId: 'meta_agency_agency-1',
      status: 'active',
      metadata: { providerRevokedAt: '2026-09-22T00:00:00.000Z' },
    };

    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(mockConnection as never);
    vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({ ...mockConnection, status: 'invalid' } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const result = await agencyPlatformService.revokeConnection(
      'agency-1',
      'meta',
      'admin@agency.com'
    );

    expect(result.error?.code).toBe('TOKEN_DELETION_FAILED');
    expect(result.data).toBeNull();
    expect(prisma.agencyPlatformConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { status: 'invalid' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'TOKEN_DELETION_FAILED' }),
    }));
  });
});
