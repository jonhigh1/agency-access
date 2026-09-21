import 'server-only';

import type { ClientAccessRequestPayload } from '@agency-platform/shared';
import { getApiBaseUrl } from '@/lib/api/api-env';

export type FetchClientInviteResult =
  | { ok: true; payload: ClientAccessRequestPayload }
  | { ok: false; message: string };

/**
 * Loads public client invite payload on the server so HTML can ship meaningful content
 * before client JS runs (LCP). Must not be cached across users/tokens.
 */
export async function fetchClientInvitePayload(token: string): Promise<FetchClientInviteResult> {
  const base = getApiBaseUrl();
  const url = `${base}/api/client/${encodeURIComponent(token)}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    const body = (await response.json()) as {
      data?: ClientAccessRequestPayload;
      error?: { message?: string; code?: string };
    };

    if (!response.ok || body.error || !body.data) {
      return {
        ok: false,
        message: body.error?.message || 'Failed to load authorization request.',
      };
    }

    return { ok: true, payload: body.data };
  } catch {
    return {
      ok: false,
      message: 'Failed to load authorization request.',
    };
  }
}
