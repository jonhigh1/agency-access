import { beforeEach, describe, expect, it, vi } from 'vitest';

import { metaPartnerService } from '../meta-partner.service.js';

describe('MetaPartnerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('grants page access with the documented user plus tasks mutation shape', async () => {
    vi.mocked(fetch).mockResolvedValue({
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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
    );

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const params = new URLSearchParams(request.body as string);

    expect(params.get('user')).toBe('system-user-42');
    expect(params.get('tasks')).toBe(
      JSON.stringify(['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'])
    );
    expect(params.get('business')).toBeNull();
    expect(params.get('access_token')).toBe('client-system-user-token');
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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
    );

    const request = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const params = new URLSearchParams(request.body as string);

    expect(params.get('user')).toBe('system-user-42');
    expect(params.get('tasks')).toBe(JSON.stringify(['MANAGE', 'ADVERTISE', 'ANALYZE']));
    expect(params.get('business')).toBeNull();
    expect(params.get('access_token')).toBe('client-system-user-token');
  });

  it('verifies page access by checking the assigned users list for the expected system user and tasks', async () => {
    vi.mocked(fetch).mockResolvedValue({
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
      'https://graph.facebook.com/v25.0/page_123/assigned_users?access_token=client-system-user-token',
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(result).toEqual({
      verified: true,
      assignedTasks: ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'],
    });
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
});
