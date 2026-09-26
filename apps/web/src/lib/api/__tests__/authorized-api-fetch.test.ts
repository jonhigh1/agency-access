import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthorizedApiError, authorizedApiFetch } from '../authorized-api-fetch';

describe('authorizedApiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).fetch = fetchMock;
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
  });

  it('throws when token is missing', async () => {
    await expect(
      authorizedApiFetch('/api/agencies', {
        getToken: async () => null,
      })
    ).rejects.toThrow('Missing authentication token');
  });

  it('adds bearer token and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'agency-1' }], error: null }),
    });

    const result = await authorizedApiFetch<{ data: Array<{ id: string }>; error: null }>(
      '/api/agencies?clerkUserId=user_123',
      {
        getToken: async () => 'token-123',
      }
    );

    const [url, requestOptions] = fetchMock.mock.calls[0];
    const headers = requestOptions.headers as Headers;
    expect(url).toBe('https://api.example.com/api/agencies?clerkUserId=user_123');
    expect(requestOptions.method).toBe('GET');
    expect(headers.get('Authorization')).toBe('Bearer token-123');

    expect(result.data[0].id).toBe('agency-1');
  });

  it('parses backend error payload for non-2xx responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header',
        },
      }),
    });

    await expect(
      authorizedApiFetch('/api/agencies', {
        getToken: async () => 'token-123',
      })
    ).rejects.toThrow('Missing or invalid Authorization header');
  });

  it('fails with a bounded timeout when the request never resolves', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    );

    const request = authorizedApiFetch('/api/access-requests/request-1/cancel', {
      method: 'POST',
      getToken: async () => 'token-123',
    });
    const expectation = expect(request).rejects.toMatchObject<Partial<AuthorizedApiError>>({
      code: 'TIMEOUT',
      status: 408,
      message: 'Request timed out. Please try again.',
    });

    await vi.advanceTimersByTimeAsync(15_000);

    await expectation;
    vi.useRealTimers();
  });

  it('fails with a bounded timeout when token resolution never resolves', async () => {
    vi.useFakeTimers();

    const request = authorizedApiFetch('/api/agencies', {
      getToken: () => new Promise(() => {}),
    });
    const expectation = expect(request).rejects.toMatchObject<Partial<AuthorizedApiError>>({
      code: 'TIMEOUT',
      status: 408,
    });

    await vi.advanceTimersByTimeAsync(15_000);

    await expectation;
    vi.useRealTimers();
  });

  it('fails with a bounded timeout when JSON parsing never resolves', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => new Promise(() => {}),
    });

    const request = authorizedApiFetch('/api/agencies', {
      getToken: async () => 'token-123',
    });
    const expectation = expect(request).rejects.toMatchObject<Partial<AuthorizedApiError>>({
      code: 'TIMEOUT',
      status: 408,
    });

    await vi.advanceTimersByTimeAsync(15_000);

    await expectation;
    vi.useRealTimers();
  });
});
