import { describe, expect, it, vi, afterEach } from 'vitest';
import { metaGraphGet } from './meta-graph-request.js';

describe('metaGraphGet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the token in the bearer header, strips query tokens, and bounds the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await metaGraphGet('https://graph.facebook.com/v25.0/me?fields=id&access_token=old-token', 'user-token');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.has('access_token')).toBe(false);
    expect(init.headers).toEqual({ Authorization: 'Bearer user-token' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not send the bearer token to a non-Graph host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(() => metaGraphGet('https://attacker.example/path', 'user-token')).toThrow(
      'Meta Graph request URL must use graph.facebook.com'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
