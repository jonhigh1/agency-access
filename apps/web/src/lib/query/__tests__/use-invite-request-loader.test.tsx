import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInviteRequestLoader } from '../use-invite-request-loader';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: vi.fn(async () => {}),
}));

describe('useInviteRequestLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(capturePosthogEvent).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('transitions to delayed and timeout, then retries successfully', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise(() => {});
      }

      return {
        ok: true,
        json: async () => ({ data: { id: 'request-1' }, error: null }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useInviteRequestLoader<{ id: string }>({
        endpoint: 'http://localhost:3001/api/client/token',
        source: 'invite-core',
      })
    );

    expect(result.current.phase).toBe('loading');

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(result.current.phase).toBe('delayed');

    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(result.current.phase).toBe('timeout');

    act(() => {
      result.current.retry();
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.phase).toBe('ready');
    expect(result.current.data).toEqual({ id: 'request-1' });
  });

  it('surfaces the API error code alongside the message (U7)', async () => {
    const fetchMock = vi.fn(async () =>
      ({
        ok: false,
        json: async () => ({
          data: null,
          error: { code: 'REQUEST_EXPIRED', message: 'Access request has expired' },
        }),
      }) as unknown as Response
    );

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useInviteRequestLoader<{ id: string }>({
        endpoint: 'http://localhost:3001/api/client/token',
        source: 'invite-core',
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('Access request has expired');
    expect(result.current.errorCode).toBe('REQUEST_EXPIRED');
  });

  it('passes a server-invite error code through to the caller (U7)', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useInviteRequestLoader<{ id: string }>({
        endpoint: 'http://localhost:3001/api/client/token',
        source: 'invite-core',
        serverInviteResult: {
          status: 'error',
          message: 'Access request has been revoked',
          code: 'REQUEST_REVOKED',
        },
      })
    );

    expect(result.current.phase).toBe('error');
    expect(result.current.errorCode).toBe('REQUEST_REVOKED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries once in the browser when the server load failed without a terminal code', async () => {
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({ data: { id: 'request-1' }, error: null }),
      }) as Response
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useInviteRequestLoader<{ id: string }>({
        endpoint: 'http://localhost:3001/api/client/token',
        source: 'invite-core',
        serverInviteResult: { status: 'error', message: 'Failed to load authorization request.' },
      })
    );

    expect(result.current.phase).toBe('loading');
    expect(result.current.error).toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('ready');
    expect(result.current.data).toEqual({ id: 'request-1' });
    expect(capturePosthogEvent).toHaveBeenCalledWith('client_invite_load_failed', {
      source: 'invite-core',
      origin: 'server',
      error_code: null,
      auto_retry: true,
    });
  });

  it('records the first-load failure for a terminal server code without retrying', () => {
    renderHook(() =>
      useInviteRequestLoader<{ id: string }>({
        endpoint: 'http://localhost:3001/api/client/token',
        source: 'invite-core',
        serverInviteResult: {
          status: 'error',
          message: 'Access request has expired',
          code: 'REQUEST_EXPIRED',
        },
      })
    );

    expect(capturePosthogEvent).toHaveBeenCalledWith('client_invite_load_failed', {
      source: 'invite-core',
      origin: 'server',
      error_code: 'REQUEST_EXPIRED',
      auto_retry: false,
    });
  });

  it('shows the error and records a browser failure when the automatic retry also fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useInviteRequestLoader<{ id: string }>({
        endpoint: 'http://localhost:3001/api/client/token',
        source: 'invite-core',
        serverInviteResult: { status: 'error', message: 'Failed to load authorization request.' },
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('error');
    expect(result.current.errorCode).toBeNull();
    expect(capturePosthogEvent).toHaveBeenCalledWith('client_invite_load_failed', {
      source: 'invite-core',
      origin: 'browser',
      error_code: null,
      attempt: 1,
    });
  });
});
