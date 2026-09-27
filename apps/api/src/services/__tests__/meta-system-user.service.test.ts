import { beforeEach, describe, expect, it, vi } from 'vitest';
import { META_GRAPH_VERSION, META_PERMISSION_CONTRACT } from '@agency-platform/shared';

vi.mock('@/lib/env', () => ({
  env: {
    META_APP_ID: 'test-meta-app-id',
  },
}));

vi.mock('@/lib/infisical', () => ({
  infisical: {
    storeOAuthTokens: vi.fn(),
  },
}));

import { infisical } from '@/lib/infisical';
import { metaSystemUserService } from '../meta-system-user.service.js';

describe('MetaSystemUserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('creates a partner admin system-user token and stores only its secret reference', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'partner-admin-system-user-token' }),
    } as Response);
    vi.mocked(infisical.storeOAuthTokens).mockResolvedValue(
      'meta_partner_admin_system_user_agency-1_biz-1'
    );

    const result = await metaSystemUserService.createSystemUserAccessToken({
      businessId: 'biz-1',
      systemUserId: 'sys-admin-1',
      accessToken: 'agency-admin-user-token',
      secretName: 'meta_partner_admin_system_user_agency-1_biz-1',
    });

    expect(result.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/sys-admin-1/access_tokens`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
    );

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const params = new URLSearchParams(request.body as string);

    expect(params.get('app_id')).toBe('test-meta-app-id');
    expect(params.get('scope')).toBe(
      META_PERMISSION_CONTRACT.systemUser.permissions.join(',')
    );
    expect(params.get('access_token')).toBe('agency-admin-user-token');
    expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
      'meta_partner_admin_system_user_agency-1_biz-1',
      { accessToken: 'partner-admin-system-user-token' }
    );
    expect(result.data).toEqual({
      tokenSecretId: 'meta_partner_admin_system_user_agency-1_biz-1',
      scopes: [...META_PERMISSION_CONTRACT.systemUser.permissions],
    });
  });

  it('revokes the system user access tokens through Meta before local secret removal', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => true } as Response);

    const result = await metaSystemUserService.revokeSystemUserAccessTokens({
      systemUserId: '12345',
      accessToken: 'agency-admin-user-token',
    });

    expect(result.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/12345/access_tokens`,
      expect.objectContaining({ method: 'DELETE', signal: expect.any(AbortSignal) }),
    );
    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(new URLSearchParams(request.body as string).get('access_token')).toBe('agency-admin-user-token');
  });

  it('lists system users without putting the agency token in the Graph URL', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response);

    const result = await metaSystemUserService.getSystemUsers('biz-1', 'agency-token');

    expect(result).toEqual({ data: [], error: null });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toContain('access_token');
    expect(options).toEqual({
      method: 'GET',
      headers: { Authorization: 'Bearer agency-token' },
      signal: expect.any(AbortSignal),
      redirect: 'error',
    });
  });

  it('loads all system users across Meta Graph pages', async () => {
    const secondPage = `https://graph.facebook.com/${META_GRAPH_VERSION}/biz-1/system_users?after=cursor`;
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'system-1', name: 'First', role: 'ADMIN' }], paging: { next: secondPage } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'system-2', name: 'Second', role: 'EMPLOYEE' }] }),
      } as Response);

    const result = await metaSystemUserService.getSystemUsers('biz-1', 'agency-token');

    expect(result).toEqual({
      data: [
        { id: 'system-1', name: 'First', role: 'ADMIN' },
        { id: 'system-2', name: 'Second', role: 'EMPLOYEE' },
      ],
      error: null,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stops when Meta repeats a system-user pagination URL', async () => {
    const firstPage = `https://graph.facebook.com/${META_GRAPH_VERSION}/biz-1/system_users`;
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'system-1', name: 'First', role: 'ADMIN' }],
        paging: { next: firstPage },
      }),
    } as Response);

    const result = await metaSystemUserService.getSystemUsers('biz-1', 'agency-token');

    expect(result).toEqual({
      data: null,
      error: {
        code: 'SYSTEM_USER_LIST_ERROR',
        message: 'Meta returned a repeated pagination URL',
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed Meta system user IDs without a provider request', async () => {
    const result = await metaSystemUserService.revokeSystemUserAccessTokens({
      systemUserId: 'not-an-id',
      accessToken: 'agency-admin-user-token',
    });

    expect(result.error?.code).toBe('SYSTEM_USER_ID_INVALID');
    expect(fetch).not.toHaveBeenCalled();
  });
});
