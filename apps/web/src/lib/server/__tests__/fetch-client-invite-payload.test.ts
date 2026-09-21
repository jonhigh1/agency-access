import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchClientInvitePayload } from '../fetch-client-invite-payload';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/api/api-env', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

describe('fetchClientInvitePayload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a bounded API request and returns the invite payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'request-1', platforms: [] },
        error: null,
      }),
    } as Response);

    await expect(fetchClientInvitePayload('token-1')).resolves.toEqual({
      ok: true,
      payload: { id: 'request-1', platforms: [] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/client/token-1',
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('returns a visible error when the API cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unavailable'));

    await expect(fetchClientInvitePayload('token-1')).resolves.toEqual({
      ok: false,
      message: 'Failed to load authorization request.',
    });
  });
});
