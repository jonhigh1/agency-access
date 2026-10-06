import { describe, expect, it, vi, afterEach } from 'vitest';
import { clearRecordedMetaGraphOps } from './meta-graph-instrumentation.js';
import { metaGraphGet } from './meta-graph-request.js';

describe('metaGraphGet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearRecordedMetaGraphOps();
  });

  it('sends the token in the bearer header, strips query tokens, and bounds the request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await metaGraphGet(
      'https://graph.facebook.com/v25.0/me?fields=id&access_token=old-token',
      'user-token'
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.has('access_token')).toBe(false);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer user-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not send the bearer token to a non-Graph host', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      metaGraphGet('https://attacker.example/path', 'user-token')
    ).rejects.toThrow('Meta Graph request URL must use graph.facebook.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
