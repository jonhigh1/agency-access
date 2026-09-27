import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInviteRequestLoader } from '../use-invite-request-loader';

describe('useInviteRequestLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
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
  });
});
