import { env } from '../../lib/env.js';
import type { Platform } from '@agency-platform/shared';
import type { AccessLevel } from '@agency-platform/shared';
import { getPlatformConfig, type PlatformOAuthConfig } from './registry.config.js';
import type { PlatformConnector } from './factory.js';

/**
 * Normalized OAuth Token Response
 *
 * All connectors return tokens in this consistent format.
 * This abstracts away platform-specific response differences.
 */
export interface NormalizedTokenResponse {
  /** Access token for API calls */
  accessToken: string;

  /** Refresh token (if supported by platform) */
  refreshToken?: string;

  /** Token lifetime in seconds */
  expiresIn: number;

  /** Token expiration timestamp */
  expiresAt: Date;

  /** Token type (usually "Bearer") */
  tokenType?: string;

  /** Granted scopes */
  scope?: string;

  /** Any additional metadata from token response */
  metadata?: Record<string, any>;
}

/**
 * OAuth Token Exchange Error
 *
 * Thrown when token exchange or refresh fails.
 */
export class ConnectorError extends Error {
  constructor(
    public platform: string,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(`${platform} connector error [${code}]: ${message}`);
    this.name = 'ConnectorError';
  }
}

/**
 * Base OAuth Connector
 *
 * Abstract class that provides standard OAuth 2.0 flow implementation.
 * All platform connectors should extend this class.
 *
 * For standard OAuth 2.0 platforms (Google, LinkedIn, TikTok, Snapchat),
 * you only need to implement `normalizeResponse()` to handle response format differences.
 *
 * For special-case platforms (Meta with long-lived tokens, custom auth flows),
 * you can override the methods you need to customize.
 *
 * @example Standard OAuth platform
 * ```typescript
 * export class LinkedInConnector extends BaseConnector {
 *   constructor() {
 *     super('linkedin');
 *   }
 *
 *   normalizeResponse(data: any): NormalizedTokenResponse {
 *     return {
 *       accessToken: data.access_token,
 *       refreshToken: data.refresh_token,
 *       expiresIn: data.expires_in,
 *       expiresAt: new Date(Date.now() + data.expires_in * 1000)
 *     };
 *   }
 * }
 * ```
 *
 * @example Special-case platform (Meta with long-lived tokens)
 * ```typescript
 * export class MetaConnector extends BaseConnector {
 *   constructor() {
 *     super('meta');
 *   }
 *
 *   // Override for Meta-specific 2-step token exchange
 *   override async exchangeCode(code: string): Promise<NormalizedTokenResponse> {
 *     const tokens = await super.exchangeCode(code);
 *     return this.getLongLivedToken(tokens.accessToken);
 *   }
 *
 *   normalizeResponse(data: any): NormalizedTokenResponse { ... }
 * }
 * ```
 */
export abstract class BaseConnector {
  protected readonly config: PlatformOAuthConfig;
  protected readonly platform: Platform;

  /**
   * Create a new connector instance
   *
   * @param platform - Platform identifier (must exist in PLATFORM_CONFIGS)
   * @throws Error if platform config doesn't exist
   */
  constructor(platform: Platform) {
    this.config = getPlatformConfig(platform);
    this.platform = platform;
  }

  // ==========================================================================
  // REQUIRED METHODS (PlatformConnector Interface)
  // ==========================================================================

  /**
   * Generate OAuth authorization URL
   *
   * Creates the URL that users are redirected to for OAuth authorization.
   * Includes all standard OAuth 2.0 parameters plus any platform-specific params.
   *
   * Override this method only if the platform has a non-standard auth flow.
   *
   * @param state - CSRF protection token (managed by OAuthStateService)
   * @param scopes - Optional scopes to request (uses config defaultScopes if not provided)
   * @param redirectUri - Optional override for redirect URI (for client-side OAuth)
   * @returns Authorization URL to redirect user to
   *
   * @example
   * ```typescript
   * const state = await oauthStateService.createState(userId);
   * const authUrl = connector.getAuthUrl(state);
   * // Redirect user to authUrl
   * ```
   */
  getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string {
    const scopesToUse = scopes ?? this.config.defaultScopes;
    const scopeString = scopesToUse.join(this.config.scopeSeparator ?? ' ');

    const params = new URLSearchParams({
      client_id: this.getClientId(),
      redirect_uri: redirectUri ?? this.getRedirectUri(),
      state,
      scope: scopeString,
      response_type: 'code',
      ...(this.config.authParams || {}),
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   *
   * After user authorizes, the platform redirects back with an authorization code.
   * This method exchanges that code for an access token.
   *
   * For standard OAuth 2.0 platforms, this method handles the entire flow.
   * For special-case platforms (e.g., Meta's long-lived token exchange),
   * override this method and call `super.exchangeCode()` first.
   *
   * @param code - Authorization code from OAuth callback
   * @param redirectUri - Optional override for redirect URI (must match auth URL)
   * @returns Normalized token response
   *
   * @example Standard platform (uses default implementation)
   * ```typescript
   * const tokens = await connector.exchangeCode(code);
   * // Store tokens in Infisical
   * ```
   *
   * @example Special-case platform (Meta with long-lived tokens)
   * ```typescript
   * override async exchangeCode(code: string): Promise<NormalizedTokenResponse> {
   *   // First get short-lived token
   *   const shortLived = await super.exchangeCode(code);
   *   // Then exchange for long-lived token
   *   return this.getLongLivedToken(shortLived.accessToken);
   * }
   * ```
   */
  async exchangeCode(
    code: string,
    redirectUri?: string
  ): Promise<NormalizedTokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      redirect_uri: redirectUri ?? this.getRedirectUri(),
      grant_type: 'authorization_code',
      ...(this.config.tokenParams || {}),
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
        throw new ConnectorError(
          this.platform,
          'EXCHANGE_FAILED',
          `Token exchange failed: ${error}`,
          { status: response.status, body: error }
        );
      }

      const data = await response.json();

      // Allow post-processing hook (e.g., for Meta's long-lived token exchange)
      const normalized = this.normalizeResponse(data);
      return this.postExchange ? this.postExchange(normalized) : normalized;
    } catch (error) {
      if (error instanceof ConnectorError) {
        throw error;
      }
      throw new ConnectorError(
        this.platform,
        'EXCHANGE_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Normalize token response to standard format
   *
   * Different platforms return tokens in different formats.
   * This method converts platform-specific responses to our normalized format.
   *
   * @abstract Must be implemented by each connector
   * @param data - Raw response from platform's token endpoint
   * @returns Normalized token response
   *
   * @example
   * ```typescript
   * normalizeResponse(data: any): NormalizedTokenResponse {
   *   return {
   *     accessToken: data.access_token,
   *     refreshToken: data.refresh_token,
   *     expiresIn: data.expires_in,
   *     expiresAt: new Date(Date.now() + data.expires_in * 1000),
   *     tokenType: data.token_type
   *   };
   * }
   * ```
   */
  abstract normalizeResponse(data: any): NormalizedTokenResponse;

  /**
   * Refresh access token using refresh token
   *
   * Only works if platform supports refresh tokens (check config.supportsRefreshTokens).
   * If platform doesn't support refresh, this throws an error.
   *
   * @param refreshToken - Refresh token from initial exchange
   * @returns New access token
   *
   * @example
   * ```typescript
   * const newTokens = await connector.refreshToken(refreshToken);
   * // Update tokens in Infisical
   * ```
   */
  async refreshToken(refreshToken: string): Promise<NormalizedTokenResponse> {
    if (!this.config.supportsRefreshTokens) {
      throw new ConnectorError(
        this.platform,
        'REFRESH_NOT_SUPPORTED',
        `${this.config.name} does not support token refresh. Re-authorization required.`
      );
    }

    try {
      // Built inside the try so missing-credential ConnectorErrors from
      // getClientId/getClientSecret reach `classifyRefreshCatch`.
      const body = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        grant_type: 'refresh_token',
      });

      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: this.refreshSignal(),
      });

      if (!response.ok) {
        const error = await response.text();
        const failure = this.classifyRefreshFailure(response.status, error);
        throw new ConnectorError(this.platform, failure.code, failure.message, {
          status: response.status,
          body: error,
        });
      }

      const data = await response.json();
      return this.normalizeResponse(data);
    } catch (error) {
      throw this.classifyRefreshCatch(error);
    }
  }

  /**
   * Verify token is still valid
   *
   * Makes a lightweight API call to check if token is valid.
   * Uses config.verifyUrl or config.userInfoUrl if available.
   *
   * @param accessToken - Token to verify
   * @returns Whether token is valid
   *
   * @example
   * ```typescript
   * const isValid = await connector.verifyToken(accessToken);
   * if (!isValid) {
   *   // Trigger re-authorization flow
   * }
   * ```
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      // Prefer dedicated verify endpoint if available
      const verifyUrl = this.config.verifyUrl ?? this.config.userInfoUrl;

      if (!verifyUrl) {
        // No verification endpoint - assume valid (not ideal, but some platforms don't provide this)
        console.warn(`${this.platform}: No verify URL configured, assuming token is valid`);
        return true;
      }

      const response = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...(this.config.apiHeaders || {}),
        },
      });

      return response.ok;
    } catch (error) {
      console.error(`${this.platform} token verification failed:`, error);
      return false;
    }
  }

  /**
   * Get user info from platform
   *
   * Fetches user profile information after OAuth authorization.
   * Uses config.userInfoUrl endpoint.
   *
   * @param accessToken - Valid access token
   * @returns User profile data (id, email, name, etc.)
   *
   * @example
   * ```typescript
   * const userInfo = await connector.getUserInfo(accessToken);
   * // Store in PlatformAuthorization.metadata
   * await prisma.platformAuthorization.update({
   *   data: { metadata: { userId: userInfo.id, email: userInfo.email } }
   * });
   * ```
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string;
    email?: string;
    name?: string;
    [key: string]: any;
  }> {
    if (!this.config.userInfoUrl) {
      throw new ConnectorError(
        this.platform,
        'NO_USER_INFO_URL',
        'User info endpoint not configured for this platform'
      );
    }

    const response = await fetch(this.config.userInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...(this.config.apiHeaders || {}),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ConnectorError(
        this.platform,
        'USER_INFO_FAILED',
        `User info fetch failed: ${error}`,
        { status: response.status, body: error }
      );
    }

    const userInfo = await response.json() as {
      id: string;
      email?: string;
      name?: string;
      [key: string]: any;
    };
    return userInfo;
  }

  // ==========================================================================
  // OPTIONAL HOOK METHODS (Override for special-case platforms)
  // ==========================================================================

  /**
   * Post-exchange processing hook
   *
   * Called after token exchange, allows for additional processing.
   * Override this for platforms that need multi-step token flows.
   *
   * Common use cases:
   * - Meta: Exchange short-lived token for long-lived token
   * - Any platform that requires token upgrade/extension
   *
   * @param tokens - Tokens from initial exchange
   * @returns Processed tokens (default: no-op, returns as-is)
   *
   * @example Meta long-lived token exchange
   * ```typescript
   * protected async postExchange(tokens: NormalizedTokenResponse): Promise<NormalizedTokenResponse> {
   *   if (this.config.requiresLongLivedExchange) {
   *     return this.getLongLivedToken(tokens.accessToken);
   *   }
   *   return tokens;
   * }
   * ```
   */
  protected async postExchange?(tokens: NormalizedTokenResponse): Promise<NormalizedTokenResponse>;

  /**
   * Classify a non-2xx token refresh response
   *
   * Called from refreshToken when the token endpoint answers with a non-ok
   * status. refreshToken attaches the standard `details` ({ status, body });
   * this hook only decides the ConnectorError code and message.
   *
   * Default: 'REFRESH_FAILED' with the endpoint body appended, matching the
   * historical refreshToken behavior byte-for-byte. Override for platforms
   * with retry-vs-terminal semantics (e.g. Snapchat maps 429/5xx to
   * 'REFRESH_RETRYABLE').
   *
   * @param status - HTTP status returned by the token endpoint
   * @param body - Raw response body returned by the token endpoint
   * @returns ConnectorError code and message for this failure
   */
  protected classifyRefreshFailure(
    status: number,
    body: string
  ): { code: string; message: string } {
    return { code: 'REFRESH_FAILED', message: `Token refresh failed: ${body}` };
  }

  /**
   * Classify an error caught during token refresh
   *
   * Called from refreshToken's catch for every failure: ConnectorErrors thrown
   * inside the flow (including the one built by classifyRefreshFailure) and
   * anything else thrown while building the request, fetching, or normalizing.
   *
   * Default: ConnectorErrors pass through untouched; any other error is
   * wrapped as a transport-level 'REFRESH_ERROR', matching the historical
   * refreshToken behavior byte-for-byte. Override to re-classify transport
   * failures as retryable without duplicating the fetch itself.
   *
   * @param error - Error caught during the refresh flow
   * @returns The ConnectorError to throw
   */
  protected classifyRefreshCatch(error: unknown): ConnectorError {
    if (error instanceof ConnectorError) {
      return error;
    }
    return new ConnectorError(
      this.platform,
      'REFRESH_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  /**
   * Abort signal for the token refresh request
   *
   * Default: undefined (the request is not aborted). Override to bound the
   * outbound call, e.g. `return AbortSignal.timeout(15_000)`.
   */
  protected refreshSignal(): AbortSignal | undefined {
    return undefined;
  }

  /**
   * Verify agency has access to client's assets (for delegated access model)
   *
   * OPTIONAL: Only implement if using delegated access authorization model.
   *
   * Default implementation throws NOT_IMPLEMENTED error.
   * Override this method for platforms that support client access verification.
   *
   * @param agencyAccessToken - Agency's OAuth access token
   * @param clientEmail - Client's email (for validation)
   * @param requiredAccessLevel - Minimum access level required
   * @returns Verification result with granted access details
   */
  async verifyClientAccess?(
    agencyAccessToken: string,
    clientEmail: string,
    ...args: any[]
  ): Promise<{
    hasAccess: boolean;
    accessLevel: AccessLevel;
    assets?: Array<{
      type: string;
      id: string;
      name: string;
      permissions: string[];
    }>;
    error?: string;
  }>;

  /**
   * Revoke access token (when user disconnects)
   *
   * OPTIONAL: Implement if platform supports token revocation.
   * Called when user disconnects their platform account.
   *
   * Default implementation is a no-op.
   *
   * @param accessToken - Token to revoke
   */
  async revokeToken?(accessToken: string): Promise<void>;

  /**
   * Get long-lived token from short-lived token
   *
   * OPTIONAL: Only implement if platform supports this flow (e.g., Meta).
   * Meta exchanges 2-hour tokens for 60-day tokens.
   *
   * Default implementation throws NOT_SUPPORTED error.
   *
   * @param shortLivedToken - Short-lived access token
   * @returns Long-lived access token
   */
  async getLongLivedToken?(shortLivedToken: string): Promise<NormalizedTokenResponse>;

  // ==========================================================================
  // PROTECTED HELPER METHODS (Internal use)
  // ==========================================================================

  /**
   * Get OAuth client ID from environment
   *
   * Uses Zod-validated env object for type safety.
   * Pattern: `{PLATFORM}_CLIENT_ID`
   *
   * @throws Error if env var not configured
   */
  protected getClientId(): string {
    const envVar = `${this.platform.toUpperCase()}_CLIENT_ID`;
    // Use type assertion since we know this env var exists
    const value = (env as any)[envVar];
    if (!value) {
      throw new ConnectorError(
        this.platform,
        'MISSING_CLIENT_ID',
        `Environment variable ${envVar} is not configured`
      );
    }
    return value;
  }

  /**
   * Get OAuth client secret from environment
   *
   * Uses Zod-validated env object for type safety.
   * Pattern: `{PLATFORM}_CLIENT_SECRET`
   *
   * @throws Error if env var not configured
   */
  protected getClientSecret(): string {
    const envVar = `${this.platform.toUpperCase()}_CLIENT_SECRET`;
    const value = (env as any)[envVar];
    if (!value) {
      throw new ConnectorError(
        this.platform,
        'MISSING_CLIENT_SECRET',
        `Environment variable ${envVar} is not configured`
      );
    }
    return value;
  }

  /**
   * Get OAuth redirect URI
   *
   * Constructs the callback URL for OAuth flow.
   * Pattern: `{API_URL}/agency-platforms/{platform}/callback`
   *
   * Override this for platforms with non-standard callback paths.
   */
  protected getRedirectUri(): string {
    return `${env.API_URL}/agency-platforms/${this.platform}/callback`;
  }
}
