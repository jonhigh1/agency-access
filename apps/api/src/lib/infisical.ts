import { InfisicalSDK, SecretType } from '@infisical/sdk';
import { env } from './env.js';

/**
 * Infisical client singleton for managing OAuth tokens and secrets
 *
 * Security Pattern:
 * - OAuth tokens are NEVER stored in PostgreSQL
 * - Only Infisical secret references are stored in the database
 * - All token access is logged in the AuditLog table
 */

class InfisicalService {
  private client: InfisicalSDK | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize Infisical client with Machine Identity authentication
   */
  private async initialize(): Promise<void> {
    if (this.client) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.client = new InfisicalSDK();

        // Authenticate with Machine Identity (Universal Auth)
        await this.client.auth().universalAuth.login({
          clientId: env.INFISICAL_CLIENT_ID,
          clientSecret: env.INFISICAL_CLIENT_SECRET,
        });
      })();
    }

    await this.initPromise;
  }

  /**
   * Store OAuth tokens in Infisical (upsert - creates or updates)
   *
   * @param secretName - Unique identifier for the secret (e.g., "meta_token_conn_abc123")
   * @param tokens - OAuth tokens to store (accessToken, refreshToken, etc.)
   * @returns The secret name (to be stored in database as secretId)
   */
  async storeOAuthTokens(
    secretName: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: Date;
      scope?: string;
    }
  ): Promise<string> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Infisical client not initialized');
    }

    // Store tokens as a JSON string in Infisical
    const secretValue = JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt?.toISOString(),
      scope: tokens.scope,
      storedAt: new Date().toISOString(),
    });

    try {
      // Try to create the secret
      await this.client.secrets().createSecret(secretName, {
        projectId: env.INFISICAL_PROJECT_ID,
        environment: env.INFISICAL_ENVIRONMENT,
        secretValue,
        type: SecretType.Shared,
      });
    } catch (error: any) {
      // If secret already exists, update it instead
      if (error?.message?.includes('already exists') || error?.statusCode === 400) {
        await this.client.secrets().updateSecret(secretName, {
          projectId: env.INFISICAL_PROJECT_ID,
          environment: env.INFISICAL_ENVIRONMENT,
          secretValue,
          type: SecretType.Shared,
        });
      } else {
        throw error;
      }
    }

    return secretName;
  }

  /**
   * Store a plain secret value in Infisical (upsert).
   *
   * Intended for non-token credentials such as outbound webhook signing secrets.
   */
  async storePlainSecret(secretName: string, secretValue: string): Promise<string> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Infisical client not initialized');
    }

    try {
      await this.client.secrets().createSecret(secretName, {
        projectId: env.INFISICAL_PROJECT_ID,
        environment: env.INFISICAL_ENVIRONMENT,
        secretValue,
        type: SecretType.Shared,
      });
    } catch (error: any) {
      if (error?.message?.includes('already exists') || error?.statusCode === 400) {
        await this.client.secrets().updateSecret(secretName, {
          projectId: env.INFISICAL_PROJECT_ID,
          environment: env.INFISICAL_ENVIRONMENT,
          secretValue,
          type: SecretType.Shared,
        });
      } else {
        throw error;
      }
    }

    return secretName;
  }

  async getPlainSecret(secretName: string): Promise<string> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Infisical client not initialized');
    }

    const secret = await this.client.secrets().getSecret({
      projectId: env.INFISICAL_PROJECT_ID,
      environment: env.INFISICAL_ENVIRONMENT,
      secretName,
      type: SecretType.Shared,
    });

    return secret.secretValue;
  }

  /**
   * Retrieve OAuth tokens from Infisical
   *
   * @param secretName - The secret name (from database secretId field)
   * @returns The OAuth tokens
   */
  async getOAuthTokens(secretName: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
  }> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Infisical client not initialized');
    }

    const secret = await this.client.secrets().getSecret({
      projectId: env.INFISICAL_PROJECT_ID,
      environment: env.INFISICAL_ENVIRONMENT,
      secretName,
      type: SecretType.Shared,
    });

    const parsed = JSON.parse(secret.secretValue);

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
      scope: parsed.scope,
    };
  }

  /**
   * Alias for getOAuthTokens for backward compatibility
   */
  async retrieveOAuthTokens(secretName: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
  }> {
    return this.getOAuthTokens(secretName);
  }

  /**
   * Update existing OAuth tokens (e.g., after token refresh)
   *
   * @param secretName - The secret name
   * @param tokens - Updated tokens
   */
  async updateOAuthTokens(
    secretName: string,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: Date;
      scope?: string;
    }
  ): Promise<void> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Infisical client not initialized');
    }

    const secretValue = JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt?.toISOString(),
      scope: tokens.scope,
      updatedAt: new Date().toISOString(),
    });

    await this.client.secrets().updateSecret(secretName, {
      projectId: env.INFISICAL_PROJECT_ID,
      environment: env.INFISICAL_ENVIRONMENT,
      secretValue,
      type: SecretType.Shared,
    });
  }

  /**
   * Delete OAuth tokens from Infisical (when connection is revoked)
   *
   * Best-effort: never throws. If the secret doesn't exist or Infisical fails,
   * logs and returns so revoke can complete. The DB update is the source of
   * truth; orphaned secrets in Infisical are harmless.
   *
   * @param secretName - The secret name
   */
  async deleteOAuthTokens(secretName: string): Promise<void> {
    await this.initialize();

    if (!this.client) {
      console.warn('[Infisical] deleteOAuthTokens skipped: client not initialized');
      return;
    }

    try {
      await this.client.secrets().deleteSecret(secretName, {
        projectId: env.INFISICAL_PROJECT_ID,
        environment: env.INFISICAL_ENVIRONMENT,
        type: SecretType.Shared,
      });
    } catch (error: unknown) {
      const message = (error as Error)?.message ?? String(error);
      console.warn(`[Infisical] deleteOAuthTokens failed for ${secretName}: ${message}`);
    }
  }

  /** Delete a secret, reporting failures so callers can retain retryable state. */
  async deleteSecret(secretName: string): Promise<void> {
    await this.initialize();
    if (!this.client) throw new Error('Infisical client not initialized');

    try {
      await this.client.secrets().deleteSecret(secretName, {
        projectId: env.INFISICAL_PROJECT_ID,
        environment: env.INFISICAL_ENVIRONMENT,
        type: SecretType.Shared,
      });
    } catch (error) {
      if ((error as { statusCode?: number })?.statusCode === 404) return;
      throw error;
    }
  }

  /**
   * Generate a unique secret name for a platform authorization
   *
   * @param platform - Platform name (e.g., "meta", "google_ads")
   * @param connectionId - Database connection ID
   * @returns Unique secret name
   */
  generateSecretName(platform: string, connectionId: string): string {
    return `${platform}_token_${connectionId}`;
  }
}

// Export singleton instance
export const infisical = new InfisicalService();
