import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRecordedMetaGraphOps, getRecordedMetaGraphOps } from '@/lib/meta-graph-instrumentation.js';
import {
  assertNoTokenMaterialInSerializedGraphOps,
  serializeMetaGraphOp,
} from '@agency-platform/shared';
import {
  MetaPageAccessTokenUnavailableError,
  metaPartnerService,
} from '../meta-partner.service.js';

describe('MetaPartnerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRecordedMetaGraphOps();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    clearRecordedMetaGraphOps();
  });

  it('grants page access with the documented user plus tasks mutation shape', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token-for-assigned-users' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

    await metaPartnerService.grantPageAccess(
      'client-system-user-token',
      'page_123',
      'system-user-42',
      ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE']
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/page_123/assigned_users',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      })
    );

    const request = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer page-token-for-assigned-users');
    const params = new URLSearchParams(request.body as string);

    expect(params.get('user')).toBe('system-user-42');
    expect(params.get('tasks')).toBe(
      JSON.stringify(['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'])
    );
    expect(params.get('business')).toBeNull();
    expect(params.get('access_token')).toBeNull();
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it('grants ad account access with the documented user plus tasks mutation shape', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await metaPartnerService.grantAdAccountAccess(
      'client-system-user-token',
      'act_123',
      'system-user-42',
      ['MANAGE', 'ADVERTISE', 'ANALYZE']
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/act_123/assigned_users',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      })
    );

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const params = new URLSearchParams(request.body as string);

    expect(params.get('user')).toBe('system-user-42');
    expect(params.get('tasks')).toBe(JSON.stringify(['MANAGE', 'ADVERTISE', 'ANALYZE']));
    expect(params.get('business')).toBeNull();
    expect(params.get('access_token')).toBeNull();
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer client-system-user-token');
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it('verifies page access by checking the assigned users list for the expected system user and tasks', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'system-user-42',
              tasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
            },
          ],
        }),
      } as Response);

    const result = await metaPartnerService.verifyPageAccess(
      'client-system-user-token',
      'page_123',
      'system-user-42',
      ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE']
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/page_123/assigned_users',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
      })
    );
    expect(result).toEqual({
      verified: true,
      assignedTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
    });
  });

  it('follows assigned-user pagination before verifying a recipient', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'other-user', tasks: ['MANAGE'] }],
          paging: { next: 'https://graph.facebook.com/v25.0/page_123/assigned_users?after=cursor-2' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'system-user-42', tasks: ['MANAGE', 'ADVERTISE'] }] }),
      } as Response);

    await expect(metaPartnerService.verifyPageAccess(
      'client-token', 'page_123', 'system-user-42', ['MANAGE', 'ADVERTISE']
    )).resolves.toEqual({ verified: true, assignedTasks: ['MANAGE', 'ADVERTISE'] });
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'https://graph.facebook.com/v25.0/page_123/assigned_users?after=cursor-2',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
    );
  });

  it('does not send the access token to a non-Meta pagination host', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], paging: { next: 'https://attacker.example/collect' } }),
      } as Response);

    await expect(metaPartnerService.verifyPageAccess(
      'client-token', 'page_123', 'system-user-42', ['MANAGE']
    )).rejects.toThrow('Meta returned an invalid pagination URL');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stops when Meta repeats an assigned-user pagination URL', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          paging: { next: 'https://graph.facebook.com/v25.0/page_123/assigned_users' },
        }),
      } as Response);

    await expect(metaPartnerService.verifyPageAccess(
      'client-token', 'page_123', 'system-user-42', ['MANAGE']
    )).rejects.toThrow('Meta returned a repeated pagination URL');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('assigns and verifies Leads Access as a separate Page task', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token' }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'person-42', tasks: ['MANAGE_LEADS'] }] }),
      } as Response);

    await metaPartnerService.grantPageAccess('client-token', 'page_123', 'person-42', ['MANAGE_LEADS']);
    const result = await metaPartnerService.verifyPageAccess(
      'client-token', 'page_123', 'person-42', ['MANAGE_LEADS']
    );

    const mutation = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit;
    expect(new URLSearchParams(mutation.body as string).get('tasks')).toBe(JSON.stringify(['MANAGE_LEADS']));
    expect(vi.mocked(fetch).mock.calls[3]?.[0]).toBe(
      'https://graph.facebook.com/v25.0/page_123/assigned_users'
    );
    expect(result).toEqual({ verified: true, assignedTasks: ['MANAGE_LEADS'] });
  });

  it('keeps Leads Access unverified when Meta read-back omits MANAGE_LEADS', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'person-42', tasks: ['ADVERTISE'] }] }),
      } as Response);

    const result = await metaPartnerService.verifyPageAccess(
      'client-token', 'page_123', 'person-42', ['MANAGE_LEADS']
    );

    expect(result).toEqual({ verified: false, assignedTasks: ['ADVERTISE'] });
  });

  it('verifies Page assigned_users when Meta returns PROFILE_PLUS_* tasks and extras', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'person-42',
              tasks: [
                'PROFILE_PLUS_MANAGE',
                'PROFILE_PLUS_CREATE_CONTENT',
                'PROFILE_PLUS_ADVERTISE',
                'PROFILE_PLUS_MODERATE',
                'PROFILE_PLUS_ANALYZE',
              ],
            },
          ],
        }),
      } as Response);

    const result = await metaPartnerService.verifyPageAccess(
      'client-token',
      'page_123',
      'person-42',
      ['MANAGE', 'CREATE_CONTENT', 'ADVERTISE']
    );

    expect(result.verified).toBe(true);
  });

  it('verifies a Pixel recipient against Meta assigned-user task read-back', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'person-42', tasks: ['ADVERTISE', 'ANALYZE'] }] }),
    } as Response);

    const result = await metaPartnerService.verifyDatasetAccess(
      'client-token', 'pixel-1', 'person-42', ['ADVERTISE', 'ANALYZE'], 'client-business-1'
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/pixel-1/assigned_users?business=client-business-1',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) })
    );
    expect(result).toEqual({ verified: true, assignedTasks: ['ADVERTISE', 'ANALYZE'] });
  });

  it('keeps a Pixel recipient unverified when Meta reports extra tasks', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'person-42', tasks: ['ADVERTISE', 'ANALYZE', 'MANAGE'] }] }),
    } as Response);

    const result = await metaPartnerService.verifyDatasetAccess(
      'client-token', 'pixel-1', 'person-42', ['ADVERTISE', 'ANALYZE'], 'client-business-1'
    );

    expect(result).toEqual({ verified: false, assignedTasks: ['ADVERTISE', 'ANALYZE', 'MANAGE'] });
  });

  it('verifies Pixel partner access and requested tasks from the agencies edge', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'agency-business-1', permitted_tasks: ['ADVERTISE'] }] }),
    } as Response);

    const result = await metaPartnerService.verifyDatasetAgencyAccess(
      'client-token', 'pixel-1', 'agency-business-1', ['ADVERTISE', 'ANALYZE']
    );

    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('/pixel-1/agencies');
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('permitted_tasks');
    expect(result).toEqual({ verified: false, assignedTasks: ['ADVERTISE'] });
  });

  it('returns unverified when the ad account assigned user is missing required tasks', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'system-user-42',
            tasks: ['ADVERTISE'],
          },
        ],
      }),
    } as Response);

    const result = await metaPartnerService.verifyAdAccountAccess(
      'client-system-user-token',
      'act_123',
      'system-user-42',
      ['MANAGE', 'ADVERTISE', 'ANALYZE']
    );

    expect(result).toEqual({
      verified: false,
      assignedTasks: ['ADVERTISE'],
    });
  });

  it('returns unverified when Meta read-back includes tasks beyond the requested set', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'system-user-42', tasks: ['MANAGE', 'ADVERTISE', 'ANALYZE', 'CREATE_CONTENT'] }],
      }),
    } as Response);

    const result = await metaPartnerService.verifyAdAccountAccess(
      'client-system-user-token',
      'act_123',
      'system-user-42',
      ['MANAGE', 'ADVERTISE', 'ANALYZE']
    );

    expect(result).toEqual({
      verified: false,
      assignedTasks: ['MANAGE', 'ADVERTISE', 'ANALYZE', 'CREATE_CONTENT'],
    });
  });

  it('grants catalog tasks to an assignee and verifies the same catalog assignment', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
        { id: 'system-user-42', tasks: ['ADVERTISE', 'AA_ANALYZE'] },
      ] }) } as Response);

    await metaPartnerService.grantCatalogAccess(
      'client-token',
      'catalog_123',
      'system-user-42',
      ['ADVERTISE', 'AA_ANALYZE'],
    );
    const result = await metaPartnerService.verifyCatalogAccess(
      'client-token',
      'catalog_123',
      'system-user-42',
      ['ADVERTISE', 'AA_ANALYZE'],
    );

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v25.0/catalog_123/assigned_users',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const params = new URLSearchParams(request.body as string);
    expect(params.get('user')).toBe('system-user-42');
    expect(params.get('tasks')).toBe(JSON.stringify(['ADVERTISE', 'AA_ANALYZE']));
    expect(result).toEqual({ verified: true, assignedTasks: ['ADVERTISE', 'AA_ANALYZE'] });
  });

  it('shares a Page with the agency portfolio via agencies edge using a Page access token', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'EAAFAKEPAGETOKEN1234567890' }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'EAAFAKEPAGETOKEN1234567890' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'agency-bm-1', permitted_tasks: ['MANAGE', 'ADVERTISE'] }],
        }),
      } as Response);

    await metaPartnerService.grantAgencyPartnerAccess(
      'client-token',
      'page_123',
      'agency-bm-1',
      ['MANAGE', 'ADVERTISE'],
      { assetKind: 'page' },
    );
    const result = await metaPartnerService.verifyAgencyPartnerAccess(
      'client-token',
      'page_123',
      'agency-bm-1',
      ['MANAGE', 'ADVERTISE'],
      { assetKind: 'page' },
    );

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v25.0/page_123?fields=access_token',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://graph.facebook.com/v25.0/page_123/agencies',
      expect.objectContaining({ method: 'POST' }),
    );
    const postRequest = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(postRequest.headers).get('Authorization')).toBe(
      'Bearer EAAFAKEPAGETOKEN1234567890'
    );
    const params = new URLSearchParams(postRequest.body as string);
    expect(params.get('business')).toBe('agency-bm-1');
    expect(params.get('permitted_tasks')).toBe(JSON.stringify(['MANAGE', 'ADVERTISE']));
    expect(result).toEqual({ verified: true, assignedTasks: ['MANAGE', 'ADVERTISE'] });
  });

  it('falls back to me/accounts when page fields returns no access_token', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'page_123' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'page_123', access_token: 'page-from-accounts-token' }],
        }),
      } as Response);

    const resolved = await metaPartnerService.obtainPageAccessTokenForAgencies(
      'client-token',
      'page_123'
    );

    expect(resolved.source).toBe('me_accounts');
    expect(resolved.accessToken).toBe('page-from-accounts-token');
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/me/accounts?fields='),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws a structured error when no Page access token can be resolved', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'page_123' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response);

    await expect(
      metaPartnerService.obtainPageAccessTokenForAgencies('client-token', 'page_123')
    ).rejects.toMatchObject({
      name: 'MetaPageAccessTokenUnavailableError',
      message:
        'Could not obtain a Page access token for Page page_123; grant pages_show_list and ensure this user manages the Page.',
    });
  });

  it('surfaces pages_show_list guidance when verifyPageAccess cannot resolve a token', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'page_123' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response);

    await expect(
      metaPartnerService.verifyPageAccess('client-token', 'page_123', 'person-1', ['MANAGE'])
    ).rejects.toThrow('pages_show_list');
  });

  it('surfaces pages_show_list guidance when verifyAgencyPartnerAccess cannot resolve a Page token', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'page_123' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response);

    await expect(
      metaPartnerService.verifyAgencyPartnerAccess(
        'client-token',
        'page_123',
        'agency-bm-1',
        ['MANAGE'],
        { assetKind: 'page' }
      )
    ).rejects.toThrow('pages_show_list');
  });

  it('verifies Page partner access when Meta returns PROFILE_PLUS_* permitted_tasks', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'agency-bm-1',
              permitted_tasks: [
                'PROFILE_PLUS_MANAGE_LEADS',
                'PROFILE_PLUS_MODERATE',
                'PROFILE_PLUS_MESSAGING',
                'PROFILE_PLUS_ANALYZE',
                'PROFILE_PLUS_ADVERTISE',
                'PROFILE_PLUS_CREATE_CONTENT',
                'PROFILE_PLUS_MANAGE',
              ],
            },
          ],
        }),
      } as Response);

    const result = await metaPartnerService.verifyAgencyPartnerAccess(
      'client-token',
      'page_123',
      'agency-bm-1',
      ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
      { assetKind: 'page' }
    );

    expect(result.verified).toBe(true);
    expect(result.assignedTasks).toContain('PROFILE_PLUS_MANAGE');
  });

  it('does not leak Page access token material in recorded meta_graph_op envelopes', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'EAAFAKEPAGETOKEN1234567890' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'agency-bm-1', permitted_tasks: ['MANAGE'] }] }),
      } as Response);

    await metaPartnerService.verifyAgencyPartnerAccess(
      'client-token',
      'page_123',
      'agency-bm-1',
      ['MANAGE'],
      { assetKind: 'page' },
    );

    const serialized = getRecordedMetaGraphOps().map(serializeMetaGraphOp).join('\n');
    assertNoTokenMaterialInSerializedGraphOps(serialized, [
      'EAAFAKEPAGETOKEN1234567890',
      'access_token=',
    ]);
    expect(getRecordedMetaGraphOps().some((op) => op.tokenClass === 'selected_page')).toBe(true);
  });

  it('shares a catalog with the agency portfolio and verifies the agency edge', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'agency-bm-1', permitted_tasks: ['ADVERTISE', 'AA_ANALYZE'] }] }) } as Response);

    await metaPartnerService.grantCatalogAgencyAccess(
      'client-token',
      'catalog_123',
      'agency-bm-1',
      ['ADVERTISE', 'AA_ANALYZE'],
    );
    const result = await metaPartnerService.verifyCatalogAgencyAccess(
      'client-token',
      'catalog_123',
      'agency-bm-1',
      ['ADVERTISE', 'AA_ANALYZE'],
    );

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v25.0/catalog_123/agencies',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain('/catalog_123/agencies');
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain('permitted_tasks');
    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const params = new URLSearchParams(request.body as string);
    expect(params.get('business')).toBe('agency-bm-1');
    expect(params.get('permitted_tasks')).toBe(JSON.stringify(['ADVERTISE', 'AA_ANALYZE']));
    expect(result).toBe(true);
  });

  it('follows agency pagination before deciding the agency has no access', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'other-agency', permitted_tasks: ['ADVERTISE'] }], paging: { next: 'https://graph.facebook.com/v25.0/catalog_1/agencies?after=cursor-2' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'agency-bm-1', permitted_tasks: ['ADVERTISE', 'AA_ANALYZE'] }] }),
      } as Response);

    await expect(metaPartnerService.verifyCatalogAgencyAccess(
      'client-token', 'catalog_1', 'agency-bm-1', ['ADVERTISE', 'AA_ANALYZE']
    )).resolves.toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://graph.facebook.com/v25.0/catalog_1/agencies?after=cursor-2',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
    );
  });

  it('verifies manual ad-account sharing against agency permitted tasks', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'agency-bm-1', permitted_tasks: ['ADVERTISE'] }] }),
    } as Response);

    const result = await metaPartnerService.verifyAdAccountAgencyAccess(
      'client-token', 'act_123', 'agency-bm-1', ['MANAGE', 'ADVERTISE']
    );

    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('/act_123/agencies');
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('permitted_tasks');
    expect(result).toEqual({ verified: false, assignedTasks: ['ADVERTISE'] });
  });

  it('revokes an assigned user and verifies that Meta no longer lists the user', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '42', tasks: ['MANAGE'] }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response);

    await metaPartnerService.revokeAssignedUserAccess('client-token', 'page_123', '42');

    expect(fetch).toHaveBeenNthCalledWith(2,
      'https://graph.facebook.com/v25.0/page_123/assigned_users',
      expect.objectContaining({ method: 'DELETE' }),
    );
    const request = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit;
    const params = new URLSearchParams(request.body as string);
    expect(params.get('user')).toBe('42');
    expect(params.get('access_token')).toBeNull();
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer client-token');
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not report revocation when Meta still lists the assigned user', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '42', tasks: ['MANAGE'] }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '42', tasks: ['MANAGE'] }] }) } as Response);

    await expect(metaPartnerService.revokeAssignedUserAccess('client-token', 'page_123', '42'))
      .rejects.toThrow('Meta still reports user 42 assigned to asset page_123');
  });

  it('removes an agency from a Page and verifies that Meta no longer lists it', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'page-revoke-token' }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'biz-agency' }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response);

    await metaPartnerService.revokeAgencyAccess('client-token', 'page_123', 'biz-agency', {
      assetKind: 'page',
    });

    expect(fetch).toHaveBeenNthCalledWith(3,
      'https://graph.facebook.com/v25.0/page_123/agencies',
      expect.objectContaining({ method: 'DELETE' }),
    );
    const request = vi.mocked(fetch).mock.calls[2]?.[1] as RequestInit;
    const params = new URLSearchParams(request.body as string);
    expect(params.get('business')).toBe('biz-agency');
    expect(params.get('access_token')).toBeNull();
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer page-revoke-token');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('removes an agency from a catalog and verifies catalog agency read-back', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'biz-agency', permitted_tasks: ['ADVERTISE'] }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response);

    await metaPartnerService.revokeCatalogAgencyAccess('client-token', 'catalog_123', 'biz-agency');

    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('/catalog_123/agencies');
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('permitted_tasks');
    expect(fetch).toHaveBeenNthCalledWith(2,
      'https://graph.facebook.com/v25.0/catalog_123/agencies',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain('/catalog_123/agencies');
    expect(String(vi.mocked(fetch).mock.calls[2]?.[0])).toContain('permitted_tasks');
    expect(new Headers(vi.mocked(fetch).mock.calls[1]?.[1]?.headers).get('Authorization')).toBe('Bearer client-token');
  });
});
