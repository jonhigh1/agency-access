import { BaseConnector, ConnectorError, type NormalizedTokenResponse } from './base.connector.js';
import type { Platform } from '@agency-platform/shared';

const SNAPCHAT_API_BASE = 'https://adsapi.snapchat.com';
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60; // Snap access tokens live ~1 hour

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
   * Refresh with Snap's exact form body: NO redirect_uri.
   *
   * Retry classification contract (consumed by the token lifecycle):
   * - HTTP 429 and 5xx -> 'REFRESH_RETRYABLE' (transient, safe to retry)
   * - HTTP 401 and every other non-ok status -> terminal codes (never 'REFRESH_RETRYABLE')
   */
  override async refreshToken(refreshToken: string): Promise<NormalizedTokenResponse> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      grant_type: 'refresh_token',
    });

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        const retryable = response.status === 429 || response.status >= 500;
        throw new ConnectorError(
          this.platform,
          retryable ? 'REFRESH_RETRYABLE' : 'INVALID_REFRESH',
          'Snapchat token refresh failed',
          { status: response.status, body: error }
        );
      }

      return this.normalizeResponse(await response.json());
    } catch (error) {
      if (error instanceof ConnectorError) {
        throw error;
      }
      throw new ConnectorError(
        this.platform,
        'REFRESH_ERROR',
        error instanceof Error ? error.message : 'Snapchat token refresh failed'
      );
    }
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
    const meResponse = await fetch(`${SNAPCHAT_API_BASE}/v1/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
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
