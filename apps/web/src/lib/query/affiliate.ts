import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  AffiliatePartnerCommissionHistorySchema,
  AffiliateLinkSummarySchema,
  AffiliatePartnerPortalOverviewSchema,
  AffiliatePortalLinkCreateInputSchema,
  type AffiliateLinkSummary,
  type AffiliatePartnerCommissionHistory,
  type AffiliatePartnerPortalOverview,
  type AffiliatePortalLinkCreateInput,
} from '@agency-platform/shared';

import { resolveApiUrl } from '@/lib/api/api-env';
import { DEV_BYPASS_TOKEN, useAuthOrBypass } from '@/lib/dev-auth';

function isDevBypassEnabled() {
  return process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true' &&
    process.env.NODE_ENV === 'development';
}

async function fetchAffiliatePortal<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(resolveApiUrl(`/api/affiliate${path}`), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const payload = await response.json();
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || 'Affiliate portal request failed') as Error & {
      code?: string;
      status: number;
    };
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }

  return payload.data as T;
}

export function useAffiliatePortalOverview() {
  const clerkAuth = useAuth();
  const { userId } = useAuthOrBypass(clerkAuth);
  const { getToken } = clerkAuth;

  return useQuery({
    queryKey: ['affiliate', 'portal', 'overview', userId],
    queryFn: async () => {
      const token = await getToken();
      if (!token && !isDevBypassEnabled()) {
        throw new Error('No authentication token available');
      }

      const data = await fetchAffiliatePortal<AffiliatePartnerPortalOverview>(
        '/portal/overview',
        token || DEV_BYPASS_TOKEN,
      );
      return AffiliatePartnerPortalOverviewSchema.parse(data);
    },
    enabled: Boolean(userId),
  });
}

export function useAffiliatePortalCommissionHistory() {
  const clerkAuth = useAuth();
  const { userId } = useAuthOrBypass(clerkAuth);
  const { getToken } = clerkAuth;

  return useQuery({
    queryKey: ['affiliate', 'portal', 'commissions', userId],
    queryFn: async () => {
      const token = await getToken();
      if (!token && !isDevBypassEnabled()) {
        throw new Error('No authentication token available');
      }

      const data = await fetchAffiliatePortal<AffiliatePartnerCommissionHistory>(
        '/portal/commissions',
        token || DEV_BYPASS_TOKEN,
      );
      return AffiliatePartnerCommissionHistorySchema.parse(data);
    },
    enabled: Boolean(userId),
  });
}

export function useCreateAffiliatePortalLink() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AffiliatePortalLinkCreateInput) => {
      const validated = AffiliatePortalLinkCreateInputSchema.parse(input);
      const token = await getToken();
      if (!token && !isDevBypassEnabled()) {
        throw new Error('No authentication token available');
      }

      const data = await fetchAffiliatePortal<AffiliateLinkSummary>('/portal/links', token || DEV_BYPASS_TOKEN, {
        method: 'POST',
        body: JSON.stringify(validated),
      });

      return AffiliateLinkSummarySchema.parse(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['affiliate', 'portal', 'overview'],
      });
    },
  });
}
