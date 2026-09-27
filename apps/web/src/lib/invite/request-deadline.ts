import { INVITE_REQUEST_TIMEOUT_MS } from '@/lib/query/use-invite-request-loader';

/**
 * One shared request deadline (the loader's own timeout): aborts a stalled
 * request so the client never wedges on a spinner with no exit. Extracted
 * from client-invite-page.tsx (review #1) so every fetch path shares it.
 */
export const beginRequestDeadline = () => {
  const abortController = new AbortController();
  const timeoutTimer = window.setTimeout(() => abortController.abort(), INVITE_REQUEST_TIMEOUT_MS);
  return {
    signal: abortController.signal,
    settle: () => window.clearTimeout(timeoutTimer),
  };
};
