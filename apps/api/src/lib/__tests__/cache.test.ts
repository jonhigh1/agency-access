import { describe, expect, it, vi } from 'vitest';
import { cacheStats, deleteCache, getCached, invalidateCache } from '../cache.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('getCached concurrent reads', () => {
  it('fetches once for concurrent misses and reports each as a miss', async () => {
    const key = 'test:coalesce';
    await deleteCache(key);
    const before = cacheStats.getStats();
    const pending = deferred<{ data: string; error: null }>();
    const fetch = vi.fn(() => pending.promise);
    const reads = Array.from({ length: 20 }, () => getCached({ key, fetch }));

    expect(fetch).toHaveBeenCalledTimes(1);
    pending.resolve({ data: 'value', error: null });
    expect(await Promise.all(reads)).toEqual(Array.from({ length: 20 }, () => ({ data: 'value', error: null, cached: false })));
    expect(await getCached({ key, fetch })).toEqual({ data: 'value', error: null, cached: true });
    const after = cacheStats.getStats();
    expect(after.misses - before.misses).toBe(20);
    expect(after.hits - before.hits).toBe(1);
  });

  it('keeps tenant keys independent', async () => {
    const first = deferred<{ data: string; error: null }>();
    const second = deferred<{ data: string; error: null }>();
    const firstFetch = vi.fn(() => first.promise);
    const secondFetch = vi.fn(() => second.promise);
    const firstRead = getCached({ key: 'test:tenant:a', fetch: firstFetch });
    const secondRead = getCached({ key: 'test:tenant:b', fetch: secondFetch });

    expect(firstFetch).toHaveBeenCalledTimes(1);
    expect(secondFetch).toHaveBeenCalledTimes(1);
    first.resolve({ data: 'a', error: null });
    second.resolve({ data: 'b', error: null });
    expect((await firstRead).data).toBe('a');
    expect((await secondRead).data).toBe('b');
  });

  it('does not cache errors and retries on the next read', async () => {
    const key = 'test:error';
    await deleteCache(key);
    const pending = deferred<{ data: null; error: string }>();
    const fetch = vi.fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue({ data: 'recovered', error: null });
    const reads = [getCached({ key, fetch }), getCached({ key, fetch })];

    expect(fetch).toHaveBeenCalledTimes(1);
    pending.resolve({ data: null, error: 'failed' });
    expect((await Promise.all(reads)).map((result) => result.error)).toEqual(['failed', 'failed']);
    expect(await getCached({ key, fetch })).toEqual({ data: 'recovered', error: null, cached: false });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('clears a rejected fetch so the next read can retry', async () => {
    const key = 'test:rejection';
    await deleteCache(key);
    const pending = deferred<{ data: string; error: null }>();
    const fetch = vi.fn()
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValue({ data: 'recovered', error: null });
    const reads = [getCached({ key, fetch }), getCached({ key, fetch })];

    expect(fetch).toHaveBeenCalledTimes(1);
    pending.reject(new Error('source unavailable'));
    expect((await Promise.allSettled(reads)).map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(await getCached({ key, fetch })).toEqual({ data: 'recovered', error: null, cached: false });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['exact', async (key: string) => { await deleteCache(key); }],
    ['prefix', async (key: string) => { await invalidateCache(`${key.slice(0, key.lastIndexOf(':') + 1)}*`); }],
  ])('detaches pending reads after %s invalidation', async (_kind, invalidate) => {
    const key = `test:invalidate:${_kind}`;
    await deleteCache(key);
    const old = deferred<{ data: string; error: null }>();
    const oldRead = getCached({ key, fetch: () => old.promise });
    await invalidate(key);

    const fresh = deferred<{ data: string; error: null }>();
    const freshFetch = vi.fn(() => fresh.promise);
    const freshRead = getCached({ key, fetch: freshFetch });
    old.resolve({ data: 'stale', error: null });
    expect((await oldRead).data).toBe('stale');
    const joinedFreshRead = getCached({ key, fetch: freshFetch });
    expect(freshFetch).toHaveBeenCalledTimes(1);
    fresh.resolve({ data: 'fresh', error: null });
    expect(await freshRead).toEqual({ data: 'fresh', error: null, cached: false });
    expect(await joinedFreshRead).toEqual({ data: 'fresh', error: null, cached: false });
    expect(await getCached({ key, fetch: freshFetch })).toEqual({ data: 'fresh', error: null, cached: true });
    expect(freshFetch).toHaveBeenCalledTimes(1);
  });
});
