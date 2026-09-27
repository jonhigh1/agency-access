import { env } from '@/lib/env';
import { infisical } from '@/lib/infisical';
import { META_GRAPH_VERSION } from '@/lib/meta-constants';
import { metaGraphGet } from '@/lib/meta-graph-request.js';
import { META_PERMISSION_CONTRACT } from '@agency-platform/shared';

interface CreateSystemUserResponse {
  id: string; // App-scoped System User ID
}

interface CreateSystemUserAccessTokenResponse {
  access_token?: string;
}

interface SystemUser {
  id: string;
  name: string;
  role: string;
}

type SystemUserRole = 'EMPLOYEE' | 'ADMIN';

const DEFAULT_SYSTEM_USER_NAME = 'Agency Platform System User';
const DEFAULT_PARTNER_ADMIN_SYSTEM_USER_NAME = 'Agency Platform Admin System User';

class MetaSystemUserService {
  private readonly META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
  private readonly REQUEST_TIMEOUT_MS = 15_000;

  private async readGraphError(
    response: Response,
    fallbackCode: string,
    fallbackMessage: string
  ): Promise<{ code: string; message: string }> {
    try {
      const errorData: any = await response.json();
      const errorCode = errorData.error?.code?.toString() || fallbackCode;
      const errorMessage = errorData.error?.message || fallbackMessage;

      return {
        code: `${fallbackCode}_${errorCode}`,
        message: errorMessage,
      };
    } catch {
      const errorText = await response.text();
      return {
        code: fallbackCode,
        message: errorText || fallbackMessage,
      };
    }
  }

  /**
   * Create a system user for an agency's Business Manager
   * 
   * @param businessId - Agency's Business Manager ID
   * @param accessToken - Admin user or admin system user access token
   * @param name - Name for the system user
   * @param role - Role for the system user
   * @returns App-scoped System User ID
   */
  async createSystemUser(
    businessId: string,
    accessToken: string,
    name: string = DEFAULT_SYSTEM_USER_NAME,
    role: SystemUserRole = 'EMPLOYEE'
  ): Promise<{ data: string | null; error: { code: string; message: string } | null }> {
    try {
      const url = `${this.META_GRAPH_URL}/${businessId}/system_users`;

      const formData = new URLSearchParams();
      formData.append('name', name);
      formData.append('role', role);
      formData.append('access_token', accessToken);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        const errorMessage = errorData.error?.message || 'Failed to create system user';
        const errorCode = errorData.error?.code?.toString() || 'UNKNOWN_ERROR';
        
        return {
          data: null,
          error: {
            code: `SYSTEM_USER_CREATE_FAILED_${errorCode}`,
            message: errorMessage,
          },
        };
      }

      const data: CreateSystemUserResponse = await response.json() as CreateSystemUserResponse;
      return { data: data.id, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'SYSTEM_USER_CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error creating system user',
        },
      };
    }
  }

  /**
   * Get existing system users for a Business Manager
   * 
   * @param businessId - Agency's Business Manager ID
   * @param accessToken - Admin user or admin system user access token
   * @returns List of system users with their app-scoped IDs
   */
  async getSystemUsers(
    businessId: string,
    accessToken: string
  ): Promise<{ data: SystemUser[] | null; error: { code: string; message: string } | null }> {
    try {
      let nextUrl: string | null = `${this.META_GRAPH_URL}/${businessId}/system_users`;
      const users: SystemUser[] = [];
      const visitedUrls = new Set<string>();

      while (nextUrl) {
        if (visitedUrls.has(nextUrl)) throw new Error('Meta returned a repeated pagination URL');
        visitedUrls.add(nextUrl);
        const response = await metaGraphGet(nextUrl, accessToken);
        if (!response.ok) {
          const errorData: any = await response.json();
          return {
            data: null,
            error: {
              code: 'SYSTEM_USER_LIST_FAILED',
              message: errorData.error?.message || 'Failed to list system users',
            },
          };
        }

        const payload = await response.json() as {
          data?: SystemUser[];
          paging?: { next?: string };
        };
        users.push(...(payload.data || []));
        nextUrl = payload.paging?.next || null;
      }

      return { data: users, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'SYSTEM_USER_LIST_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error listing system users',
        },
      };
    }
  }

  /**
   * Find or create a system user for the agency
   * 
   * @param businessId - Agency's Business Manager ID
   * @param accessToken - Admin user access token
   * @returns App-scoped System User ID
   */
  async getOrCreateSystemUser(
    businessId: string,
    accessToken: string,
    options?: {
      name?: string;
      role?: SystemUserRole;
    }
  ): Promise<{ data: string | null; error: { code: string; message: string } | null }> {
    const name = options?.name ?? DEFAULT_SYSTEM_USER_NAME;
    const role = options?.role ?? 'EMPLOYEE';
    
    // 1. Try to find existing system user
    const listResult = await this.getSystemUsers(businessId, accessToken);
    if (!listResult.error && listResult.data) {
      const existingUser = listResult.data.find(u => u.name === name);
      if (existingUser) {
        return { data: existingUser.id, error: null };
      }
    }

    // 2. If not found, create new one
    return this.createSystemUser(businessId, accessToken, name, role);
  }

  async createSystemUserAccessToken(input: {
    businessId: string;
    systemUserId: string;
    accessToken: string;
    secretName?: string;
  }): Promise<{
    data: {
      tokenSecretId: string;
      scopes: string[];
    } | null;
    error: { code: string; message: string } | null;
  }> {
    try {
      const scopes = [...META_PERMISSION_CONTRACT.systemUser.permissions];
      const secretName =
        input.secretName ??
        `meta_partner_admin_system_user_${input.businessId}_${input.systemUserId}`;
      const url = `${this.META_GRAPH_URL}/${input.systemUserId}/access_tokens`;

      const formData = new URLSearchParams();
      formData.append('app_id', env.META_APP_ID);
      formData.append('scope', scopes.join(','));
      formData.append('access_token', input.accessToken);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const error = await this.readGraphError(
          response,
          'SYSTEM_USER_TOKEN_CREATE_FAILED',
          'Failed to create system user token'
        );

        return {
          data: null,
          error,
        };
      }

      const payload = (await response.json()) as CreateSystemUserAccessTokenResponse;
      if (!payload.access_token) {
        return {
          data: null,
          error: {
            code: 'SYSTEM_USER_TOKEN_CREATE_FAILED_INVALID_RESPONSE',
            message: 'Meta did not return a system user access token',
          },
        };
      }

      const tokenSecretId = await infisical.storeOAuthTokens(secretName, {
        accessToken: payload.access_token,
      });

      return {
        data: {
          tokenSecretId,
          scopes,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'SYSTEM_USER_TOKEN_CREATE_ERROR',
          message:
            error instanceof Error ? error.message : 'Unknown error creating system user token',
        },
      };
    }
  }

  async revokeSystemUserAccessTokens(input: {
    systemUserId: string;
    accessToken: string;
  }): Promise<{ error: { code: string; message: string } | null }> {
    if (!/^\d+$/.test(input.systemUserId)) {
      return { error: { code: 'SYSTEM_USER_ID_INVALID', message: 'Meta system user ID must be numeric' } };
    }

    try {
      const response = await fetch(`${this.META_GRAPH_URL}/${input.systemUserId}/access_tokens`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ access_token: input.accessToken }).toString(),
        signal: AbortSignal.timeout(this.REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        return { error: await this.readGraphError(response, 'SYSTEM_USER_TOKEN_REVOKE_FAILED', 'Failed to revoke Meta system user tokens') };
      }
      if (await response.json() !== true) {
        return { error: { code: 'SYSTEM_USER_TOKEN_REVOKE_FAILED', message: 'Meta did not confirm system user token revocation' } };
      }
      return { error: null };
    } catch (error) {
      return {
        error: {
          code: 'SYSTEM_USER_TOKEN_REVOKE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error revoking Meta system user tokens',
        },
      };
    }
  }

  getDefaultPartnerAdminSystemUserName(): string {
    return DEFAULT_PARTNER_ADMIN_SYSTEM_USER_NAME;
  }
}

export const metaSystemUserService = new MetaSystemUserService();
