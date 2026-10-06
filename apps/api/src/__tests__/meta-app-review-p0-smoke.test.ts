import { describe, expect, it, vi, beforeEach } from 'vitest';
import { META_GRAPH_VERSION, META_PERMISSION_CONTRACT } from '@agency-platform/shared';
import { MetaConnector } from '../services/connectors/meta.js';

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    META_APP_ID: 'test-app-id',
    META_APP_SECRET: 'test-app-secret',
    META_LOGIN_FOR_BUSINESS_CONFIG_ID: undefined as string | undefined,
    API_URL: 'http://localhost:3001',
  },
}));

vi.mock('../lib/env.js', () => ({
  env: mockEnv,
}));

/**
 * Ticket 12 — Meta App Review P0 smoke (no live Meta).
 */
describe('Meta App Review P0 smoke — connector OAuth URL', () => {
  let connector: MetaConnector;

  beforeEach(() => {
    mockEnv.META_LOGIN_FOR_BUSINESS_CONFIG_ID = '1436589444014622';
    connector = new MetaConnector();
  });

  it('builds v25.0 dialog OAuth with explicit core scopes (never config_id-only)', () => {
    const authUrl = new URL(connector.getAuthUrl('state-smoke'));

    expect(`${authUrl.origin}${authUrl.pathname}`).toBe(
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
    );
    expect(authUrl.searchParams.get('config_id')).toBeNull();
    expect(authUrl.searchParams.get('scope')).toBe(
      META_PERMISSION_CONTRACT.core.permissions.join(','),
    );
    expect(authUrl.searchParams.get('scope')).not.toContain('ads_read');
    expect(authUrl.searchParams.get('scope')).not.toContain('catalog_management');
  });
});

describe('Meta App Review P0 smoke — zero-portfolio Page discovery edge', () => {
  let connector: MetaConnector;
  const accessToken = 'test-access-token';

  beforeEach(() => {
    connector = new MetaConnector();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('calls GET /me/accounts on Graph v25.0 for user Pages listing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'page-smoke', name: 'Smoke Page', category: 'Local Business' }],
      }),
    } as Response);

    const pages = await connector.getUserPages(accessToken);

    expect(pages).toEqual([
      { id: 'page-smoke', name: 'Smoke Page', category: 'Local Business' },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain(`graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`);
  });
});
