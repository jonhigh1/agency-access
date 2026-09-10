import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SnapchatConnector, snapchatConnector } from '../snapchat.js';
import { ConnectorError } from '../base.connector.js';
import { getConnector } from '../factory.js';

vi.mock('../../../lib/env', () => ({
  env: {
    SNAPCHAT_CLIENT_ID: 'test-snapchat-client-id',
    SNAPCHAT_CLIENT_SECRET: 'test-snapchat-client-secret',
    API_URL: 'http://localhost:3001',
  },
}));

const SNAP_TOKEN_URL = 'https://accounts.snapchat.com/login/oauth2/access_token';

describe('SnapchatConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('authorization URL', () => {
    it('builds the Snap authorize URL with defaults from the registry', () => {
      const connector = new SnapchatConnector();

      const authUrl = connector.getAuthUrl('state-snap-1');

      const parsed = new URL(authUrl);
      expect(parsed.origin + parsed.pathname).toBe(
        'https://accounts.snapchat.com/login/oauth2/authorize'
      );
      expect(parsed.searchParams.get('client_id')).toBe('test-snapchat-client-id');
      expect(parsed.searchParams.get('state')).toBe('state-snap-1');
      expect(parsed.searchParams.get('scope')).toBe('snapchat-marketing-api');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3001/agency-platforms/snapchat/callback'
      );
    });

    it('joins multiple scopes with a space separator (not a comma)', () => {
      const connector = new SnapchatConnector();

      const parsed = new URL(connector.getAuthUrl('state-snap-2', ['scope.a', 'scope.b']));

      expect(parsed.searchParams.get('scope')).toBe('scope.a scope.b');
    });
  });

  describe('token exchange', () => {
    it('posts form-body credentials (no Basic auth) and normalizes the flat envelope', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'snap-access-token',
          refresh_token: 'snap-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      const tokens = await connector.exchangeCode('auth-code-snap');

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe(SNAP_TOKEN_URL);
      expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
        'application/x-www-form-urlencoded'
      );
      expect((init?.headers as Record<string, string>)['Authorization']).toBeUndefined();

      const body = new URLSearchParams(init?.body as string);
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('auth-code-snap');
      expect(body.get('client_id')).toBe('test-snapchat-client-id');
      expect(body.get('client_secret')).toBe('test-snapchat-client-secret');
      expect(body.get('redirect_uri')).toBe(
        'http://localhost:3001/agency-platforms/snapchat/callback'
      );

      expect(tokens.accessToken).toBe('snap-access-token');
      expect(tokens.refreshToken).toBe('snap-refresh-token');
      expect(tokens.expiresIn).toBe(3600);
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('records the registry default scope when the exchange response omits scope', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'snap-access-token',
          expires_in: 3600,
        }),
      } as Response);

      const tokens = await connector.exchangeCode('auth-code-snap');

      expect(tokens.scope).toBe('snapchat-marketing-api');
    });

    it('throws EXCHANGE_FAILED without leaking the client secret on non-2xx', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      } as Response);

      await expect(connector.exchangeCode('bad-code')).rejects.toMatchObject({
        code: 'EXCHANGE_FAILED',
      });
      await expect(connector.exchangeCode('bad-code')).rejects.toBeInstanceOf(ConnectorError);

      try {
        await connector.exchangeCode('bad-code');
        expect.unreachable('exchangeCode should have thrown');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).not.toContain('test-snapchat-client-secret');
      }
    });
  });

  describe('token refresh', () => {
    it('sends the Snap refresh form body without redirect_uri and maps the rotated token', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'snap-access-token-2',
          refresh_token: 'rotated-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      } as Response);

      const tokens = await connector.refreshToken('old-refresh-token');

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe(SNAP_TOKEN_URL);
      expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
        'application/x-www-form-urlencoded'
      );

      const body = new URLSearchParams(init?.body as string);
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('old-refresh-token');
      expect(body.get('client_id')).toBe('test-snapchat-client-id');
      expect(body.get('client_secret')).toBe('test-snapchat-client-secret');
      expect(body.has('redirect_uri')).toBe(false);

      expect(tokens.accessToken).toBe('snap-access-token-2');
      expect(tokens.refreshToken).toBe('rotated-refresh-token');
      expect(tokens.scope).toBe('snapchat-marketing-api');
    });

    it('classifies 429 as REFRESH_RETRYABLE', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      } as Response);

      await expect(connector.refreshToken('old-refresh-token')).rejects.toMatchObject({
        code: 'REFRESH_RETRYABLE',
      });
    });

    it('classifies 5xx as REFRESH_RETRYABLE', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'upstream unavailable',
      } as Response);

      await expect(connector.refreshToken('old-refresh-token')).rejects.toMatchObject({
        code: 'REFRESH_RETRYABLE',
      });
    });

    it('classifies 401 as terminal (not REFRESH_RETRYABLE)', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'invalid refresh token',
      } as Response);

      try {
        await connector.refreshToken('old-refresh-token');
        expect.unreachable('refreshToken should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConnectorError);
        expect((error as ConnectorError).code).not.toBe('REFRESH_RETRYABLE');
      }
    });
  });

  describe('user info and discovery', () => {
    const mePayload = {
      me: {
        id: 'user-snap-1',
        email: 'owner@client.com',
        display_name: 'Snap Owner',
        organization_id: 'org-1',
      },
    };

    const orgsPayload = {
      request_status: 'SUCCESS',
      organizations: [
        {
          sub_request_status: 'SUCCESS',
          organization: {
            id: 'org-1',
            name: 'Acme Org',
            state: 'ACTIVE',
            roles: ['ORGANIZATION_ADMIN'],
            is_agency: false,
            ad_accounts: [
              {
                id: 'acct-active',
                name: 'Active Account',
                status: 'ACTIVE',
                currency: 'USD',
                timezone: 'America/Los_Angeles',
                roles: ['AD_ACCOUNT_ADMIN'],
              },
              {
                id: 'acct-paused',
                name: 'Paused Account',
                status: 'PAUSED',
                currency: 'USD',
                timezone: 'America/Los_Angeles',
                roles: ['MEMBER'],
              },
            ],
          },
        },
      ],
    };

    it('unwraps identity from the `me` key and fetches organizations with ad accounts', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mePayload,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => orgsPayload,
        } as Response);

      const info = await connector.getUserInfo('snap-access-token');

      expect(fetch).toHaveBeenCalledTimes(2);
      const [meUrl, meInit] = vi.mocked(fetch).mock.calls[0];
      expect(meUrl).toBe('https://adsapi.snapchat.com/v1/me');
      expect((meInit?.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer snap-access-token'
      );
      const [orgsUrl] = vi.mocked(fetch).mock.calls[1];
      expect(orgsUrl).toBe(
        'https://adsapi.snapchat.com/v1/me/organizations?with_ad_accounts=true'
      );

      expect(info.id).toBe('user-snap-1');
      expect(info.email).toBe('owner@client.com');
      expect(info.name).toBe('Snap Owner');
      expect(info.discoveryFailed).toBe(false);
      expect(info.orgStatus).toBe('SUCCESS');
    });

    it('keeps only ACTIVE ad accounts and captures the user role', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => mePayload } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => orgsPayload } as Response);

      const info = await connector.getUserInfo('snap-access-token');

      expect(info.adAccountCount).toBe(1);
      expect(info.role).toBe('ORGANIZATION_ADMIN');
      expect(info.organizations).toHaveLength(1);

      const org = info.organizations[0];
      expect(org.id).toBe('org-1');
      expect(org.roles).toEqual(['ORGANIZATION_ADMIN']);
      expect(org.adAccounts).toHaveLength(1);
      expect(org.adAccounts[0]).toMatchObject({
        id: 'acct-active',
        status: 'ACTIVE',
        roles: ['AD_ACCOUNT_ADMIN'],
      });
    });

    it('yields adAccountCount 0 for an organization without ad accounts', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => mePayload } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            request_status: 'SUCCESS',
            organizations: [
              {
                sub_request_status: 'SUCCESS',
                organization: {
                  id: 'org-empty',
                  name: 'Empty Org',
                  state: 'ACTIVE',
                  roles: ['ORGANIZATION_MEMBER'],
                  is_agency: false,
                  ad_accounts: [],
                },
              },
            ],
          }),
        } as Response);

      const info = await connector.getUserInfo('snap-access-token');

      expect(info.adAccountCount).toBe(0);
      expect(info.organizations).toHaveLength(1);
      expect(info.discoveryFailed).toBe(false);
    });

    it('returns identity with discoveryFailed when the organizations fetch throws', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => mePayload } as Response)
        .mockRejectedValueOnce(new Error('network down'));

      const info = await connector.getUserInfo('snap-access-token');

      expect(info.id).toBe('user-snap-1');
      expect(info.email).toBe('owner@client.com');
      expect(info.discoveryFailed).toBe(true);
      expect(info.organizations).toEqual([]);
      expect(info.adAccountCount).toBe(0);
    });

    it('returns identity with discoveryFailed when the organizations fetch is non-ok', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => mePayload } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'boom',
        } as Response);

      const info = await connector.getUserInfo('snap-access-token');

      expect(info.discoveryFailed).toBe(true);
      expect(info.organizations).toEqual([]);
      expect(info.adAccountCount).toBe(0);
    });

    it('throws USER_INFO_FAILED when the `me` key is missing', async () => {
      const connector = new SnapchatConnector();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unexpected: true }),
      } as Response);

      await expect(connector.getUserInfo('snap-access-token')).rejects.toMatchObject({
        code: 'USER_INFO_FAILED',
      });
    });
  });

  describe('factory registration', () => {
    it('serves snapchat and snapchat_ads from the same singleton', () => {
      expect(getConnector('snapchat')).toBe(snapchatConnector);
      expect(getConnector('snapchat_ads')).toBe(snapchatConnector);
    });
  });
});
