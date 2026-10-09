import { BaseConnector, ConnectorError, type NormalizedTokenResponse } from './base.connector.js';
import type { Platform } from '@agency-platform/shared';

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const LONG_TERM_TOKEN_TTL_SECONDS = 10 * 365 * 24 * 60 * 60; // 10 years

interface TikTokEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
  [key: string]: unknown;
}

/**
 * TikTok Business (Marketing API) OAuth connector.
 *
 * TikTok has two token exchange variants in production:
 * - /oauth/token/ (OAuth style: client_id/client_secret/code)
 * - /oauth2/access_token/ (Marketing style: app_id/secret/auth_code)
 *
 * This connector uses /oauth/token/ first and falls back to /oauth2/access_token/
 * for compatibility across app configurations.
 */
export class TikTokConnector extends BaseConnector {
  constructor() {
    super('tiktok' as Platform);
  }

  override getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string {
    const scopesToUse = scopes ?? this.config.defaultScopes;
    const scopeString = scopesToUse.join(this.config.scopeSeparator ?? ',');
    const clientId = this.getClientId();

    const params = new URLSearchParams({
      app_id: clientId,
      client_id: clientId,
      client_key: clientId,
      redirect_uri: redirectUri ?? this.getRedirectUri(),
      state,
      scope: scopeString,
      response_type: 'code',
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  override async exchangeCode(
    code: string,
    redirectUri?: string
  ): Promise<NormalizedTokenResponse> {
    try {
      return await this.exchangeWithOAuthTokenEndpoint(code, redirectUri);
    } catch (primaryError) {
      try {
        return await this.exchangeWithOAuth2AccessTokenEndpoint(code, redirectUri);
      } catch (fallbackError) {
        if (fallbackError instanceof ConnectorError) {
          throw fallbackError;
        }
        if (primaryError instanceof ConnectorError) {
          throw primaryError;
        }
        throw new ConnectorError(
          this.platform,
          'EXCHANGE_ERROR',
          fallbackError instanceof Error ? fallbackError.message : 'TikTok token exchange failed'
        );
      }
    }
  }

  normalizeResponse(data: any): NormalizedTokenResponse {
    const payload = this.unwrapPayload<Record<string, any>>(data, 'EXCHANGE_FAILED');
    const accessToken = payload.access_token ?? payload.accessToken;

    if (!accessToken || typeof accessToken !== 'string') {
      throw new ConnectorError(
        this.platform,
        'INVALID_RESPONSE',
        'TikTok token response missing access_token'
      );
    }

    const expiresRaw =
      payload.expires_in ??
      payload.expiresIn ??
      payload.access_token_expires_in;

    const expiresIn =
      typeof expiresRaw === 'number' && expiresRaw > 0
        ? expiresRaw
        : LONG_TERM_TOKEN_TTL_SECONDS;

    const scope = Array.isArray(payload.scope)
      ? payload.scope.join(',')
      : typeof payload.scope === 'string'
        ? payload.scope
        : undefined;

    const advertiserIds = Array.isArray(payload.advertiser_ids)
      ? payload.advertiser_ids
      : payload.advertiser_id
        ? [payload.advertiser_id]
        : [];

    return {
      accessToken,
      refreshToken: payload.refresh_token,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      tokenType: payload.token_type ?? 'Bearer',
      scope,
      metadata: {
        advertiserIds,
      },
    };
  }

  override async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${TIKTOK_API_BASE}/oauth2/advertiser/get/`,
        {
          method: 'GET',
          headers: {
            'Access-Token': accessToken,
          },
        }
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as TikTokEnvelope<unknown>;
      if (typeof data.code === 'number') {
        return data.code === 0;
      }

      return true;
    } catch {
      return false;
    }
  }

  override async getUserInfo(accessToken: string): Promise<{
    id: string;
    email?: string;
    name?: string;
    [key: string]: any;
  }> {
    const response = await fetch(
      `${TIKTOK_API_BASE}/oauth2/advertiser/get/`,
      {
        method: 'GET',
        headers: {
          'Access-Token': accessToken,
        },
      }
    );

    if (!response.ok) {
      throw new ConnectorError(
        this.platform,
        'USER_INFO_FAILED',
        'TikTok user info request failed',
        { status: response.status }
      );
    }

    const payload = this.unwrapPayload<{ list?: Array<Record<string, any>> }>(
      await response.json(),
      'USER_INFO_FAILED'
    );

    const advertisers = Array.isArray(payload.list) ? payload.list : [];
    const primary = advertisers[0] ?? {};

    return {
      id: String(primary.advertiser_id ?? primary.id ?? ''),
      name: primary.advertiser_name ?? primary.name,
      advertisers,
    };
  }

  /**
   * Revoke a long-term access token.
   * https://business-api.tiktok.com/portal/docs/revoke-a-long-term-access-token/v1.3
   */
  override async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(
      `${TIKTOK_API_BASE}/oauth2/revoke_token/`,
      {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: this.getClientId(),
          secret: this.getClientSecret(),
          access_token: accessToken,
        }),
      }
    );

    if (!response.ok) {
      throw new ConnectorError(
        this.platform,
        'REVOKE_FAILED',
        'TikTok token revoke failed',
        { status: response.status }
      );
    }

    const data = await response.json() as TikTokEnvelope<unknown>;
    if (typeof data.code === 'number' && data.code !== 0) {
      throw new ConnectorError(
        this.platform,
        'REVOKE_FAILED',
        data.message || 'TikTok token revoke failed',
        { code: data.code }
      );
    }
  }

  private async exchangeWithOAuthTokenEndpoint(
    code: string,
    redirectUri?: string
  ): Promise<NormalizedTokenResponse> {
    const body = new URLSearchParams({
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri ?? this.getRedirectUri(),
    });

    const response = await fetch(
      `${TIKTOK_API_BASE}/oauth/token/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    if (!response.ok) {
      throw new ConnectorError(
        this.platform,
        'EXCHANGE_FAILED',
        'TikTok token exchange failed',
        { status: response.status }
      );
    }

    return this.normalizeResponse(await response.json());
  }

  private async exchangeWithOAuth2AccessTokenEndpoint(
    code: string,
    redirectUri?: string
  ): Promise<NormalizedTokenResponse> {
    const response = await fetch(
      `${TIKTOK_API_BASE}/oauth2/access_token/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: this.getClientId(),
          secret: this.getClientSecret(),
          auth_code: code,
          redirect_uri: redirectUri ?? this.getRedirectUri(),
        }),
      }
    );

    if (!response.ok) {
      throw new ConnectorError(
        this.platform,
        'EXCHANGE_FAILED',
        'TikTok token exchange failed',
        { status: response.status }
      );
    }

    return this.normalizeResponse(await response.json());
  }

  private unwrapPayload<T>(
    raw: unknown,
    code: string
  ): T {
    if (!raw || typeof raw !== 'object') {
      throw new ConnectorError(this.platform, 'INVALID_RESPONSE', 'TikTok API returned invalid response');
    }

    const envelope = raw as TikTokEnvelope<T>;
    if (typeof envelope.code === 'number' && envelope.code !== 0) {
      throw new ConnectorError(
        this.platform,
        code,
        envelope.message || 'TikTok API returned an error',
        { code: envelope.code }
      );
    }

    return (envelope.data ?? (raw as T));
  }
}

export const tiktokConnector = new TikTokConnector();
