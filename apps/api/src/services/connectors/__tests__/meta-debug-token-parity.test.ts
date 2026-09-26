import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaConnector } from '../meta.js';

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    META_APP_ID: 'test-app-id',
    META_APP_SECRET: 'test-app-secret',
    META_LOGIN_FOR_BUSINESS_CONFIG_ID: undefined as string | undefined,
    API_URL: 'http://localhost:3001',
  },
}));

vi.mock('../../../lib/env', () => ({
  env: mockEnv,
}));

// Recorded 2026-08-18 from the inline debug_token handling (pre-extraction).
const GRAPH_DEBUG_PAYLOAD = {
  data: {
    app_id: 'test-app-id',
    type: 'USER',
    application: 'Parity App',
    data_access_expires_at: 1750000000,
    expires_at: 1760000000,
    is_valid: true,
    scopes: ['ads_management', 'business_management'],
    user_id: '101',
  },
};

describe('MetaConnector debug_token parity', () => {
  let connector: MetaConnector;

  beforeEach(() => {
    connector = new MetaConnector();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('getTokenMetadata returns the same parsed metadata as the inline code', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(GRAPH_DEBUG_PAYLOAD),
    });

    const metadata = await connector.getTokenMetadata('user-token');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(
      'https://graph.facebook.com/v25.0/debug_token?input_token=user-token&access_token=test-app-id%7Ctest-app-secret'
    );
    expect(init.method).toBe('GET');

    expect(metadata).toEqual({
      scopes: ['ads_management', 'business_management'],
      expiresAt: new Date(1760000000 * 1000),
      dataAccessExpiresAt: new Date(1750000000 * 1000),
      userId: '101',
      isValid: true,
    });
  });

  it('verifyToken returns true for is_valid tokens', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(GRAPH_DEBUG_PAYLOAD),
    });

    await expect(connector.verifyToken('user-token')).resolves.toBe(true);
  });

  it('verifyToken returns false when Graph rejects or the token is invalid', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('{"error":{"message":"bad token","code":190}}'),
    });
    await expect(connector.verifyToken('user-token')).resolves.toBe(false);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { is_valid: false } }),
    });
    await expect(connector.verifyToken('user-token')).resolves.toBe(false);
  });

  it('getTokenMetadata keeps the recorded failure message when Graph errors', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('{"error":{"message":"boom","code":500}}'),
    });

    await expect(connector.getTokenMetadata('user-token')).rejects.toThrow(
      'Meta debug_token fetch failed: {"error":{"message":"boom","code":500}}'
    );
  });
});
