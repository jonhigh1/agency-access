/**
 * Infisical unit tests
 *
 * Verifies deleteOAuthTokens is best-effort: never throws so revoke flow
 * always completes even when the Infisical SDK fails.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const deleteSecretMock = vi.fn();
const mockSdkInstance = {
  auth: () => ({
    universalAuth: {
      login: vi.fn().mockResolvedValue(undefined),
    },
  }),
  secrets: () => ({
    deleteSecret: deleteSecretMock,
  }),
};

vi.mock('@infisical/sdk', () => ({
  InfisicalSDK: function (this: unknown) {
    return mockSdkInstance;
  },
  SecretType: { Shared: 'shared' },
}));

vi.mock('@/lib/env', () => ({
  env: {
    INFISICAL_CLIENT_ID: 'test-client-id',
    INFISICAL_CLIENT_SECRET: 'test-client-secret',
    INFISICAL_PROJECT_ID: 'test-project-id',
    INFISICAL_ENVIRONMENT: 'dev',
  },
}));

const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Infisical deleteOAuthTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockClear();
  });

  it('returns without throwing when Infisical SDK deleteSecret rejects', async () => {
    const { infisical } = await import('../infisical.js');
    deleteSecretMock.mockRejectedValue(new Error('Infisical unavailable'));

    await expect(infisical.deleteOAuthTokens('meta_agency_agency-1')).resolves.toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Infisical] deleteOAuthTokens failed for meta_agency_agency-1')
    );
  });

  it('returns without throwing when Infisical SDK returns 404', async () => {
    const { infisical } = await import('../infisical.js');
    const notFoundError = Object.assign(new Error('Secret not found'), { statusCode: 404 });
    deleteSecretMock.mockRejectedValue(notFoundError);

    await expect(infisical.deleteOAuthTokens('google_agency_agency-1')).resolves.toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('returns without throwing when deleteSecret succeeds', async () => {
    const { infisical } = await import('../infisical.js');
    deleteSecretMock.mockResolvedValue(undefined);

    await expect(infisical.deleteOAuthTokens('meta_agency_agency-1')).resolves.toBeUndefined();

    expect(deleteSecretMock).toHaveBeenCalledWith(
      'meta_agency_agency-1',
      expect.objectContaining({
        projectId: expect.any(String),
        environment: expect.any(String),
      })
    );
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('reports secret deletion failure but treats an absent secret as deleted', async () => {
    const { infisical } = await import('../infisical.js');
    deleteSecretMock.mockRejectedValueOnce(new Error('Infisical unavailable'));
    await expect(infisical.deleteSecret('meta_token_connection-1')).rejects.toThrow('Infisical unavailable');

    deleteSecretMock.mockRejectedValueOnce(Object.assign(new Error('Secret not found'), { statusCode: 404 }));
    await expect(infisical.deleteSecret('meta_token_connection-1')).resolves.toBeUndefined();
  });
});
