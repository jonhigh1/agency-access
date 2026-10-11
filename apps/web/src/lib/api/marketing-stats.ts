/**
 * Server-side fetch of the public marketing aggregate counters.
 *
 * Used by marketing Server Components (homepage, pricing). The response is
 * cached by the Next data cache for one hour; a failed or unreachable API
 * returns null so pages prerender without counters instead of failing.
 */

import { resolveApiUrl } from './api-env';

export interface MarketingStats {
  agencies: number;
  activeClientConnections: number;
  activePlatformAuthorizations: number;
  completedAccessRequests: number;
  tokenRefreshes: number;
}

export async function getMarketingStats(): Promise<MarketingStats | null> {
  try {
    const response = await fetch(resolveApiUrl('/api/marketing-stats'), {
      next: { revalidate: 3600, tags: ['marketing-stats'] },
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    return body?.data ?? null;
  } catch {
    return null;
  }
}
