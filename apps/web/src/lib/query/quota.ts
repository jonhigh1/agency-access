/**
 * Quota Query Hooks
 *
 * React Query hooks for quota checking and usage tracking.
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { usage, isLoading } = useQuota();
 *   const checkQuota = useQuotaCheck();
 *
 *   const handleCreateClient = async () => {
 *     const result = await checkQuota({ metric: 'clients' });
 *     if (!result.allowed) {
 *       // Show upgrade modal
 *       setShowUpgradeModal(true);
 *       return;
 *     }
 *     // Proceed with creation
 *   };
 * }
 * ```
 */

import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SubscriptionTier, MetricType, TierLimits } from '@agency-platform/shared';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';

// ============================================================
// TYPES
// ============================================================

export interface QuotaCheckInput {
  metric: MetricType;
  requestedAmount?: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  limit: number | 'unlimited';
  used: number;
  remaining: number | 'unlimited';
  currentTier: SubscriptionTier;
  suggestedTier?: SubscriptionTier;
  upgradeUrl?: string;
  resetsAt?: Date;
}

export interface UsageSnapshot extends TierLimits {
  currentTier: SubscriptionTier;
  updatedAt: Date;
}

// ============================================================
// QUERY HOOKS
// ============================================================

/**
 * Get current usage snapshot for agency
 */
export function useQuota() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = orgId || userId;

  return useQuery({
    queryKey: ['quota', 'usage', principalId],
    queryFn: async () => {
      if (!principalId) throw new Error('No signed-in user');

      const payload = await authorizedApiFetch<{ data?: UsageSnapshot }>('/api/quota', {
        getToken,
      });
      return payload.data as UsageSnapshot;
    },
    enabled: !!principalId,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Check if an action is allowed under current quota
 */
export function useQuotaCheck() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = orgId || userId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: QuotaCheckInput): Promise<QuotaCheckResult> => {
      if (!principalId) throw new Error('No signed-in user');

      const payload = await authorizedApiFetch<{ data?: QuotaCheckResult }>('/api/quota/check', {
        getToken,
        method: 'POST',
        body: JSON.stringify(input),
      });
      return payload.data as QuotaCheckResult;
    },
    onSuccess: () => {
      // Invalidate usage query to get fresh data
      queryClient.invalidateQueries({ queryKey: ['quota', 'usage', principalId] });
    },
  });
}

// ============================================================
// ERROR CLASS
// ============================================================

export class QuotaExceededError extends Error {
  code: string;
  metric: MetricType;
  limit: number | 'unlimited';
  used: number;
  remaining: number | 'unlimited';
  currentTier: SubscriptionTier;
  suggestedTier?: SubscriptionTier;
  upgradeUrl?: string;

  constructor(errorResponse: any) {
    super(errorResponse.message || 'Quota exceeded');
    this.name = 'QuotaExceededError';
    this.code = errorResponse.code;
    this.metric = errorResponse.details?.metric;
    this.limit = errorResponse.details?.limit;
    this.used = errorResponse.details?.used;
    this.remaining = errorResponse.details?.remaining;
    this.currentTier = errorResponse.details?.currentTier;
    this.suggestedTier = errorResponse.details?.suggestedTier;
    this.upgradeUrl = errorResponse.details?.upgradeUrl;
  }
}

// ============================================================
// UTILITY HOOKS
// ============================================================

/**
 * Prefetch quota data for an agency
 */
export function usePrefetchQuota() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = orgId || userId;
  const queryClient = useQueryClient();

  return async () => {
    if (!principalId) return;

    // ponytail: authorizedApiFetch throws on null token; prefetch is best-effort, keep the skip.
    if (!(await getToken())) return;

    await queryClient.prefetchQuery({
      queryKey: ['quota', 'usage', principalId],
      queryFn: async () => {
        const payload = await authorizedApiFetch<{ data?: UsageSnapshot }>('/api/quota', {
          getToken,
        });
        return payload.data as UsageSnapshot;
      },
    });
  };
}
