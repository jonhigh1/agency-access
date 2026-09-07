import type { PendingCliff } from './pending-cliff';

const DISMISSAL_STORAGE_PREFIX = 'pending-nudge-dismissed:';

function dismissalKey(requestId: string, cliff: PendingCliff): string {
  return `${DISMISSAL_STORAGE_PREFIX}${requestId}:${cliff}`;
}

export function isPendingNudgeDismissed(requestId: string, cliff: PendingCliff): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return localStorage.getItem(dismissalKey(requestId, cliff)) === '1';
  } catch {
    return false;
  }
}

export function dismissPendingNudge(requestId: string, cliff: PendingCliff): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(dismissalKey(requestId, cliff), '1');
  } catch {
    // Non-blocking persistence path.
  }
}
