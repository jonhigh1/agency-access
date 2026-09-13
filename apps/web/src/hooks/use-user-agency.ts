'use client';

/**
 * Shared agency lookup + active platform-connections fetch.
 *
 * Single owner of the ['user-agency'] query key (cache dedupe contract across
 * pages) and of the `/agency-platforms?status=active` fetch that both the
 * access-request wizard and its edit page normalize differently.
 *
 * Deliberately NOT using `authorizedApiFetch` here: the agency lookup keeps an
 * optional Authorization header so dev-bypass/perf-harness sessions can
 * bootstrap an agency with the dev token, and callers pin plain-object headers
 * (see connections page tests). Degradation is intentional, not a bug.
 */

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { resolveApiUrl } from '@/lib/api/api-env';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { useAuthOrBypass } from '@/lib/dev-auth';

export const USER_AGENCY_QUERY_KEY = 'user-agency' as const;

export function userAgencyQueryKey(principalClerkId: string | null | undefined) {
  return [USER_AGENCY_QUERY_KEY, principalClerkId] as const;
}

export interface UserAgency {
  id: string;
  name?: string;
  email?: string;
  clerkUserId?: string;
  settings?: Record<string, unknown> | null;
}

export interface UseUserAgencyOptions {
  /** Principal used for the lookup; defaults to orgId || userId. */
  principalClerkId?: string | null;
  /** Token resolver; defaults to the Clerk token. May return a dev-bypass token. */
  getAuthToken?: () => Promise<string | null>;
  enabled?: boolean;
}

export function useUserAgency(options: UseUserAgencyOptions = {}) {
  const clerkAuth = useAuth();
  const { userId, orgId } = useAuthOrBypass(clerkAuth);
  const principalClerkId = options.principalClerkId ?? (orgId || userId);

  return useQuery({
    queryKey: userAgencyQueryKey(principalClerkId),
    queryFn: async () => {
      if (!principalClerkId) return null;

      const token = options.getAuthToken
        ? await options.getAuthToken()
        : await clerkAuth.getToken();

      const response = await fetch(
        resolveApiUrl(`/api/agencies?clerkUserId=${encodeURIComponent(principalClerkId)}`),
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch agency');
      const result = await response.json();
      return (result.data?.[0] as UserAgency | undefined) ?? null;
    },
    enabled: options.enabled ?? !!principalClerkId,
    staleTime: 30 * 60 * 1000, // agency data rarely changes
    gcTime: 60 * 60 * 1000,
  });
}

export interface AgencyPlatformConnection {
  platform: string;
  name?: string;
  status?: string;
  connected?: boolean;
  agencyEmail?: string;
  connectedBy?: string;
  connectedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fetch the agency's active platform connections from the uncached source.
 * Callers keep their own view normalization (raw platform vs platform group).
 */
export async function fetchActiveAgencyPlatformConnections(
  agencyId: string,
  getToken: () => Promise<string | null>
): Promise<AgencyPlatformConnection[]> {
  const payload = await authorizedApiFetch<{ data?: AgencyPlatformConnection[] | null }>(
    `/agency-platforms?agencyId=${agencyId}&status=active`,
    { getToken }
  );
  return Array.isArray(payload.data) ? payload.data : [];
}
