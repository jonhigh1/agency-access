'use client';

/**
 * Shared agency lookup + active platform-connections fetch.
 *
 * Single owner of the ['user-agency'] query key (cache dedupe contract across
 * pages) and of the `/agency-platforms?status=active` fetch that both the
 * access-request wizard and its edit page normalize differently.
 *
 * Both requests use the bounded API helper. The agency query keeps an optional
 * token resolver for dev-bypass and performance-harness sessions.
 */

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { DEV_BYPASS_TOKEN, useAuthOrBypass } from '@/lib/dev-auth';

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
  const auth = useAuthOrBypass(clerkAuth);
  const { userId, orgId } = auth;
  const principalClerkId = options.principalClerkId ?? (orgId || userId);

  return useQuery({
    queryKey: userAgencyQueryKey(principalClerkId),
    queryFn: async () => {
      if (!principalClerkId) return null;

      const payload = await authorizedApiFetch<{ data?: UserAgency[] | null }>(
        `/api/agencies?clerkUserId=${encodeURIComponent(principalClerkId)}`,
        {
          getToken: async () => (await (options.getAuthToken || clerkAuth.getToken)()) ??
            (auth.isDevelopmentBypass ? DEV_BYPASS_TOKEN : null),
        }
      );
      return payload.data?.[0] ?? null;
    },
    enabled: auth.isLoaded && !!principalClerkId && options.enabled !== false,
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
