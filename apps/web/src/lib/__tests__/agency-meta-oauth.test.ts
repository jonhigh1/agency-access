import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAgencyMetaOAuth } from '../agency-meta-oauth';

describe('agency Meta OAuth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the agency identity to the server and redirects to the code-flow URL', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { origin: 'https://authhub.co', assign } });
    process.env.NEXT_PUBLIC_API_URL = 'https://api.authhub.co';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { authUrl: 'https://www.facebook.com/dialog/oauth?response_type=code' }, error: null }),
    }));

    await startAgencyMetaOAuth({ agencyId: 'agency-1', userEmail: 'owner@example.com', getToken: async () => 'clerk-token' });

    expect(fetch).toHaveBeenCalledWith('https://api.authhub.co/agency-platforms/meta/initiate', expect.objectContaining({
      method: 'POST',
      headers: expect.any(Headers),
      signal: expect.any(AbortSignal),
      body: JSON.stringify({ agencyId: 'agency-1', userEmail: 'owner@example.com', redirectUrl: 'https://authhub.co/platforms/callback' }),
    }));
    const headers = vi.mocked(fetch).mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer clerk-token');
    expect(assign).toHaveBeenCalledWith('https://www.facebook.com/dialog/oauth?response_type=code');
  });
});
