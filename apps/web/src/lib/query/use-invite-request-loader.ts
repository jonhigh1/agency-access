'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';

export type InviteLoadPhase = 'loading' | 'delayed' | 'timeout' | 'ready' | 'error';

interface UseInviteRequestLoaderOptions<TData> {
  endpoint: string;
  source:
    | 'invite-core'
    | 'manual-beehiiv'
    | 'manual-kit'
    | 'manual-mailchimp'
    | 'manual-klaviyo'
    | 'manual-pinterest'
    | 'manual-shopify';
  delayedMs?: number;
  timeoutMs?: number;
  parseData?: (payload: any) => TData;
  /**
   * When set (e.g. from a Server Component fetch), skip the first client fetch so
   * the invite shell can paint immediately after hydration.
   */
  serverInviteResult?:
    | { status: 'ok'; payload: TData }
    | { status: 'error'; message: string };
}

interface UseInviteRequestLoaderResult<TData> {
  data: TData | null;
  error: string | null;
  phase: InviteLoadPhase;
  retry: () => void;
}

export function useInviteRequestLoader<TData>({
  endpoint,
  source,
  delayedMs = 8000,
  timeoutMs = 20000,
  parseData,
  serverInviteResult,
}: UseInviteRequestLoaderOptions<TData>): UseInviteRequestLoaderResult<TData> {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<TData | null>(() =>
    serverInviteResult?.status === 'ok' ? serverInviteResult.payload : null
  );
  const [error, setError] = useState<string | null>(() =>
    serverInviteResult?.status === 'error' ? serverInviteResult.message : null
  );
  const [phase, setPhase] = useState<InviteLoadPhase>(() => {
    if (!serverInviteResult) return 'loading';
    return serverInviteResult.status === 'ok' ? 'ready' : 'error';
  });

  const requestIdRef = useRef(0);

  const retry = useCallback(() => {
    void capturePosthogEvent('client_invite_load_retry', { source, attempt: attempt + 1 });
    setAttempt((prev) => prev + 1);
  }, [attempt, source]);

  useEffect(() => {
    if (serverInviteResult && attempt === 0) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const abortController = new AbortController();

    setPhase('loading');
    setError(null);
    setData(null);

    const delayedTimer = window.setTimeout(() => {
      if (requestIdRef.current !== requestId) return;
      setPhase((currentPhase) => {
        if (currentPhase !== 'loading') return currentPhase;
        void capturePosthogEvent('client_invite_load_delayed', { source, attempt: attempt + 1 });
        return 'delayed';
      });
    }, delayedMs);

    const timeoutTimer = window.setTimeout(() => {
      if (requestIdRef.current !== requestId) return;
      void capturePosthogEvent('client_invite_load_timed_out', { source, attempt: attempt + 1 });
      setPhase('timeout');
      setError('This is taking longer than expected.');
      abortController.abort();
    }, timeoutMs);

    const executeFetch = async () => {
      try {
        const response = await fetch(endpoint, { signal: abortController.signal });
        const payload = await response.json();

        if (requestIdRef.current !== requestId) return;

        if (!response.ok || payload.error || !payload.data) {
          throw new Error(payload.error?.message || 'Failed to load authorization request.');
        }

        const parsed = parseData ? parseData(payload.data) : payload.data;
        setData(parsed as TData);
        setPhase('ready');
      } catch (err) {
        if (requestIdRef.current !== requestId) return;

        if (abortController.signal.aborted) {
          return;
        }

        setPhase('error');
        setError(err instanceof Error ? err.message : 'Failed to load authorization request.');
      } finally {
        window.clearTimeout(delayedTimer);
        window.clearTimeout(timeoutTimer);
      }
    };

    executeFetch();

    return () => {
      abortController.abort();
      window.clearTimeout(delayedTimer);
      window.clearTimeout(timeoutTimer);
    };
  }, [attempt, delayedMs, endpoint, parseData, serverInviteResult, source, timeoutMs]);

  return {
    data,
    error,
    phase,
    retry,
  };
}
