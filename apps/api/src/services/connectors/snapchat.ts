import { BaseConnector, ConnectorError, type NormalizedTokenResponse } from './base.connector.js';
import type { Platform } from '@agency-platform/shared';

const SNAPCHAT_API_BASE = 'https://adsapi.snapchat.com';
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60; // Snap access tokens live ~1 hour
const REQUEST_TIMEOUT_MS = 15_000; // Bound every outbound Snap HTTP call

/**
 * Snap Marketing API roles, ordered most-capable first.
 * Used to pick a single human-readable `role` from the role arrays Snap returns.
 */
const ROLE_PRIORITY = [
  'ORGANIZATION_ADMIN',
  'BILLING_ADMIN',
  'MEMBER_ADMIN',
  'AD_ACCOUNT_ADMIN',
  'ORGANIZATION_MEMBER',
  'MEMBER',
  'VIEWER',
];

interface SnapAdAccount {
  id?: string;
  name?: string;
  status?: string;
  currency?: string;
  timezone?: string;
  roles?: string[];
  [key: string]: unknown;
}

interface SnapOrganization {
  id?: string;
  name?: string;
  state?: string;
  roles?: string[];
  is_agency?: boolean;
  ad_accounts?: SnapAdAccount[];
  [key: string]: unknown;
}

interface SnapOrganizationEntry {
  sub_request_status?: string;
  organization?: SnapOrganization;
  [key: string]: unknown;
}

interface SnapOrganizationsEnvelope {
  request_status?: string;
  organizations?: SnapOrganizationEntry[];
  [key: string]: unknown;
}

interface NormalizedOrganization {
  id: string;
  name?: string;
  state?: string;
  roles: string[];
  isAgency: boolean;
  adAccounts: Array<{
    id: string;
    name?: string;
    status?: string;
    currency?: string;
    timezone?: string;
    roles: string[];
  }>;
}

export interface SnapchatUserInfo {
  id: string;
  email?: string;
  name?: string;
  organizations: NormalizedOrganization[];
  adAccountCount: number;
  role?: string;
  discoveryFailed: boolean;
  orgStatus?: string;
  [key: string]: unknown;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((role): role is string => typeof role === 'string') : [];
}

function pickPrimaryRole(roles: string[]): string | undefined {
  for (const candidate of ROLE_PRIORITY) {
    if (roles.includes(candidate)) {
      return candidate;
    }
  }
  return roles[0];
}

/**
 * Snapchat (Snap Marketing API) OAuth connector.
 *
 * Snap follows standard OAuth 2.0 with form-body credentials, so the
 * BaseConnector defaults provide getAuthUrl, exchangeCode, and verifyToken.
 * Overrides here cover only Snap-specific response shapes:
 *
 * - Token endpoint credentials go in the FORM BODY (client_id/client_secret),
 *   never an Authorization: Basic header (BaseConnector default).
 * - Exchange body includes redirect_uri; refresh body must NOT (BaseConnector defaults).
 * - Refresh runs the BaseConnector flow; only failure classification
 *   (classifyRefreshFailure / classifyRefreshCatch) and a 15s request timeout
 *   are Snap-specific.
 * - Token responses are a flat envelope: { access_token, refresh_token, expires_in, token_type, scope }.
 *   The authorization_code response OMITS `scope` — the registry default is recorded instead.
 * - Refresh returns a NEW refresh_token (rotation) which normalizeResponse maps through.
 *
 * Discovery is best-effort: /v1/me is required, organizations are not.
 */
export class SnapchatConnector extends BaseConnector {
  constructor() {
    super('snapchat' as Platform);
  }

  override normalizeResponse(data: any): NormalizedTokenResponse {
    const payload = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

    const accessToken = payload.access_token;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new ConnectorError(
        this.platform,
        'INVALID_RESPONSE',
        'Snapchat token response missing access_token'
      );
    }

    const expiresRaw = payload.expires_in;
    const expiresIn =
      typeof expiresRaw === 'number' && expiresRaw > 0 ? expiresRaw : DEFAULT_TOKEN_TTL_SECONDS;

    // Snap's authorization_code response omits `scope`; record the registry default.
    const scope =
      typeof payload.scope === 'string' && payload.scope.length > 0
        ? payload.scope
        : Array.isArray(payload.scope)
          ? payload.scope.join(',')
          : this.config.defaultScopes.join(',');

    return {
      accessToken,
      refreshToken:
        typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      tokenType: typeof payload.token_type === 'string' ? payload.token_type : 'Bearer',
      scope,
    };
  }

  /**
   * Refresh inherits the BaseConnector flow unchanged: the form body it builds
   * (refresh_token, client_id, client_secret, grant_type — no redirect_uri)
   * matches Snap's contract exactly. Only failure classification and the
   * request timeout are overridden here.
   *
   * Retry classification contract (consumed by the token lifecycle):
   * - HTTP 429 and 5xx -> 'REFRESH_RETRYABLE' (transient, safe to retry)
   * - HTTP 401 and every other non-ok status -> 'INVALID_REFRESH' (terminal)
   * - Transport failure (fetch rejects, incl. the 15s timeout) ->
   *   'REFRESH_RETRYABLE' — a network blip must not invalidate the grant
   * - MISSING_CLIENT_ID / MISSING_CLIENT_SECRET -> 'REFRESH_RETRYABLE' — a
   *   config gap on our side must not strand the client's authorization
   */
  protected override classifyRefreshFailure(status: number): { code: string; message: string } {
    return {
      code: status === 429 || status >= 500 ? 'REFRESH_RETRYABLE' : 'INVALID_REFRESH',
      message: 'Snapchat token refresh failed',
    };
  }

  protected override refreshSignal(): AbortSignal {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }

  protected override classifyRefreshCatch(error: unknown): ConnectorError {
    if (error instanceof ConnectorError) {
      const isConfigGap =
        error.code === 'MISSING_CLIENT_ID' || error.code === 'MISSING_CLIENT_SECRET';
      if (isConfigGap) {
        return new ConnectorError(this.platform, 'REFRESH_RETRYABLE', error.message);
      }
      return error;
    }
    return new ConnectorError(
      this.platform,
      'REFRESH_RETRYABLE',
      error instanceof Error ? error.message : 'Snapchat token refresh failed'
    );
  }

  /**
   * Two-phase discovery.
   *
   * Phase 1 (required): GET /v1/me — unwrap the `me` key for identity.
   * Phase 2 (best-effort): GET /v1/me/organizations?with_ad_accounts=true —
   * organizations and ACTIVE ad accounts. Any failure here is recorded as
   * discoveryFailed and never thrown.
   */
  override async getUserInfo(accessToken: string): Promise<SnapchatUserInfo> {
    // Identity endpoint is registry-owned (registry.config.ts sets it for
    // snapchat); the cast only satisfies the config type's optional field.
    const meUrl = this.config.userInfoUrl as string;
    const meResponse = await fetch(meUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!meResponse.ok) {
      const error = await meResponse.text();
      throw new ConnectorError(
        this.platform,
        'USER_INFO_FAILED',
        'Snapchat user info request failed',
        { status: meResponse.status, body: error }
      );
    }

    const meEnvelope = (await meResponse.json()) as { me?: Record<string, unknown> };
    const me = meEnvelope && typeof meEnvelope === 'object' ? meEnvelope.me : undefined;

    if (!me || typeof me !== 'object' || typeof me.id !== 'string' || me.id.length === 0) {
      throw new ConnectorError(
        this.platform,
        'USER_INFO_FAILED',
        'Snapchat user info response missing `me` payload'
      );
    }

    let organizations: NormalizedOrganization[] = [];
    let adAccountCount = 0;
    let orgStatus: string | undefined;
    let discoveryFailed = false;

    try {
      const orgResponse = await fetch(
        `${SNAPCHAT_API_BASE}/v1/me/organizations?with_ad_accounts=true`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }
      );

      if (!orgResponse.ok) {
        discoveryFailed = true;
      } else {
        const envelope = (await orgResponse.json()) as SnapOrganizationsEnvelope;
        orgStatus = typeof envelope.request_status === 'string' ? envelope.request_status : undefined;
        const result = this.normalizeOrganizations(envelope.organizations);
        organizations = result.organizations;
        adAccountCount = result.adAccountCount;
      }
    } catch {
      discoveryFailed = true;
    }

    const allRoles = organizations.flatMap((org) => [
      ...org.roles,
      ...org.adAccounts.flatMap((account) => account.roles),
    ]);

    return {
      id: me.id,
      email: typeof me.email === 'string' ? me.email : undefined,
      name:
        typeof me.display_name === 'string'
          ? me.display_name
          : typeof me.username === 'string'
            ? me.username
            : undefined,
      organizationId: typeof me.organization_id === 'string' ? me.organization_id : undefined,
      organizations,
      adAccountCount,
      role: pickPrimaryRole(allRoles),
      discoveryFailed,
      orgStatus,
    };
  }

  private normalizeOrganizations(
    entries: SnapOrganizationEntry[] | undefined
  ): { organizations: NormalizedOrganization[]; adAccountCount: number } {
    if (!Array.isArray(entries)) {
      return { organizations: [], adAccountCount: 0 };
    }

    const organizations: NormalizedOrganization[] = [];
    let adAccountCount = 0;

    for (const entry of entries) {
      const organization = entry?.organization;
      if (!organization || typeof organization !== 'object') {
        continue;
      }

      const adAccounts = (Array.isArray(organization.ad_accounts) ? organization.ad_accounts : [])
        .filter((account) => account?.status === 'ACTIVE')
        .map((account) => ({
          id: String(account.id ?? ''),
          name: typeof account.name === 'string' ? account.name : undefined,
          status: account.status,
          currency: typeof account.currency === 'string' ? account.currency : undefined,
          timezone: typeof account.timezone === 'string' ? account.timezone : undefined,
          roles: asStringArray(account.roles),
        }));

      adAccountCount += adAccounts.length;

      organizations.push({
        id: String(organization.id ?? ''),
        name: typeof organization.name === 'string' ? organization.name : undefined,
        state: typeof organization.state === 'string' ? organization.state : undefined,
        roles: asStringArray(organization.roles),
        isAgency: organization.is_agency === true,
        adAccounts,
      });
    }

    return { organizations, adAccountCount };
  }
}

export const snapchatConnector = new SnapchatConnector();
