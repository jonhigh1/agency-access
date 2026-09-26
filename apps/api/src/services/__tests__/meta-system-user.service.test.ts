import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      scopes: ['ads_management', 'business_management'],
    });

    expect(result.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/sys-admin-1/access_tokens',
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
    expect(params.get('scope')).toBe('ads_management,business_management');
    expect(params.get('access_token')).toBe('agency-admin-user-token');
    expect(infisical.storeOAuthTokens).toHaveBeenCalledWith(
      'meta_partner_admin_system_user_agency-1_biz-1',
      { accessToken: 'partner-admin-system-user-token' }
    );
    expect(result.data).toEqual({
      tokenSecretId: 'meta_partner_admin_system_user_agency-1_biz-1',
      scopes: ['ads_management', 'business_management'],
    });
  });
});
