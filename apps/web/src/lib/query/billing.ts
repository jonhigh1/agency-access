/**
 * Billing Query Hooks
 *
 * React Query hooks for subscription and billing management.
 */

import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BillingInterval, SubscriptionTier, TierLimits } from '@agency-platform/shared';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { trackAffiliateEvent } from '@/lib/analytics/affiliate';
import {
  buildCheckoutStartedProps,
  trackBillingCheckoutFailed,
  trackBillingCheckoutStarted,
  type BillingSurface,
} from '@/lib/analytics/billing';
import { getAffiliateClickTokenFromDocument } from '@/lib/affiliate-cookie';

function resolvePrincipalId(orgId: string | null | undefined, userId: string | null | undefined): string | null {
  return orgId ?? userId ?? null;
}

// ============================================================
// TYPES
// ============================================================

export interface SubscriptionData {
  id: string;
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' | 'expired';
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string;
}

export interface TierDetailsData {
  tier: SubscriptionTier | null;
  status: string;
  limits: TierLimits;
  features: string[];
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  invoiceDate: string;
  pdfUrl?: string;
}

export interface BillingDetails {
  name: string;
  email: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  taxId?: string;
}

export type UpdateBehavior = 'immediate' | 'next-cycle' | 'no-charge';

export interface UpgradeParams {
  newTier: SubscriptionTier;
  updateBehavior?: UpdateBehavior;
}

export interface CancelParams {
  cancelAtPeriodEnd?: boolean;
}

export interface UpgradeResponse {
  tier: SubscriptionTier;
  status: string;
  effectiveDate?: string;
}

export interface CancelResponse {
  status: string;
  cancelAtPeriodEnd: boolean;
  effectiveDate?: string;
}

interface UseSubscriptionOptions {
  enabled?: boolean;
}

// ============================================================
// QUERY HOOKS
// ============================================================

export function useSubscription(options: UseSubscriptionOptions = {}) {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);
  const enabled = options.enabled ?? true;

  return useQuery({
    queryKey: ['subscription', principalId],
    queryFn: async () => {
      if (!principalId) throw new Error('No authenticated principal ID');

      const payload = await authorizedApiFetch<{ data?: SubscriptionData | null }>(
        `/api/subscriptions/${principalId}`,
        { getToken }
      );
      return payload.data as SubscriptionData | null;
    },
    enabled: enabled && !!principalId,
  });
}

export function useTierDetails() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);

  return useQuery({
    queryKey: ['tier-details', principalId],
    queryFn: async () => {
      if (!principalId) throw new Error('No authenticated principal ID');

      const payload = await authorizedApiFetch<{ data?: TierDetailsData }>(
        `/api/subscriptions/${principalId}/tier`,
        { getToken }
      );
      return payload.data as TierDetailsData;
    },
    enabled: !!principalId,
  });
}

export function usePaymentMethods() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);

  return useQuery({
    queryKey: ['payment-methods', principalId],
    queryFn: async () => {
      if (!principalId) throw new Error('No authenticated principal ID');

      const payload = await authorizedApiFetch<{ data?: PaymentMethod[] }>(
        `/api/subscriptions/${principalId}/payment-methods`,
        { getToken }
      );
      return payload.data as PaymentMethod[];
    },
    enabled: !!principalId,
  });
}

export function useInvoices() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);

  return useQuery({
    queryKey: ['invoices', principalId],
    queryFn: async () => {
      if (!principalId) throw new Error('No authenticated principal ID');

      const payload = await authorizedApiFetch<{ data?: Invoice[] }>(
        `/api/subscriptions/${principalId}/invoices`,
        { getToken }
      );
      return payload.data as Invoice[];
    },
    enabled: !!principalId,
  });
}

export function useBillingDetails() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);

  return useQuery({
    queryKey: ['billing-details', principalId],
    queryFn: async () => {
      if (!principalId) throw new Error('No authenticated principal ID');

      const payload = await authorizedApiFetch<{ data?: BillingDetails }>(
        `/api/subscriptions/${principalId}/billing-details`,
        { getToken }
      );
      return payload.data as BillingDetails;
    },
    enabled: !!principalId,
  });
}

// ============================================================
// MUTATION HOOKS
// ============================================================

export function useOpenPortal() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);

  return useMutation({
    mutationFn: async (returnUrl: string) => {
      if (!principalId) throw new Error('No authenticated principal ID');

      const payload = await authorizedApiFetch<{ data?: { portalUrl: string } }>(
        '/api/subscriptions/portal',
        {
          getToken,
          method: 'POST',
          body: JSON.stringify({ agencyId: principalId, returnUrl }),
        }
      );
      return payload.data as { portalUrl: string };
    },
  });
}

export function useCreateCheckout() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);

  return useMutation({
    mutationFn: async (params: {
      tier: SubscriptionTier;
      billingInterval: BillingInterval;
      successUrl: string;
      cancelUrl: string;
      surface?: BillingSurface;
    }) => {
      if (!principalId) throw new Error('No authenticated principal ID');

      const surface = params.surface ?? 'checkout';
      const checkoutStartedProps = {
        ...buildCheckoutStartedProps(params.tier, params.billingInterval, surface),
        agency_id: principalId,
      };

      if (getAffiliateClickTokenFromDocument()) {
        trackAffiliateEvent('affiliate_checkout_started', {
          source: 'affiliate_cookie',
          surface: 'billing_checkout',
          targetTier: params.tier,
          interval: params.billingInterval,
        });
      }

      try {
        const payload = await authorizedApiFetch<{ data?: { checkoutUrl?: string } }>(
          '/api/subscriptions/checkout',
          {
            getToken,
            method: 'POST',
            body: JSON.stringify({
              agencyId: principalId,
              tier: params.tier,
              billingInterval: params.billingInterval,
              successUrl: params.successUrl,
              cancelUrl: params.cancelUrl,
            }),
          }
        );

        const checkoutUrl = payload?.data?.checkoutUrl;
        if (!checkoutUrl || typeof checkoutUrl !== 'string') {
          throw new Error('Checkout session did not return a valid URL. Please try again.');
        }

        trackBillingCheckoutStarted(checkoutStartedProps);

        return { checkoutUrl };
      } catch (error) {
        trackBillingCheckoutFailed({
          agency_id: principalId,
          plan: checkoutStartedProps.plan,
          billing_period: checkoutStartedProps.billing_period,
          surface,
          reason: error instanceof Error ? error.message : 'checkout_session_failed',
        });
        throw error;
      }
    },
  });
}

export function useUpdateBillingDetails() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (details: BillingDetails) => {
      if (!principalId) throw new Error('No authenticated principal ID');

      const payload = await authorizedApiFetch<{ data?: BillingDetails }>(
        `/api/subscriptions/${principalId}/billing-details`,
        {
          getToken,
          method: 'PUT',
          body: JSON.stringify(details),
        }
      );
      return payload.data as BillingDetails;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-details', principalId] });
    },
  });
}

// ============================================================
// SUBSCRIPTION MANAGEMENT MUTATIONS
// ============================================================

/**
 * Upgrade or downgrade subscription tier
 */
export function useUpgradeSubscription() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpgradeParams): Promise<UpgradeResponse> => {
      if (!principalId) throw new Error('No authenticated principal ID');

      // Map frontend behavior names to Creem API values
      const behaviorMap = {
        immediate: 'proration-charge-immediately',
        'next-cycle': 'proration-charge',
        'no-charge': 'proration-none',
      } as const;

      const payload = await authorizedApiFetch<{ data?: UpgradeResponse }>(
        `/api/subscriptions/${principalId}/upgrade`,
        {
          getToken,
          method: 'POST',
          body: JSON.stringify({
            newTier: params.newTier,
            updateBehavior: behaviorMap[params.updateBehavior || 'next-cycle'],
          }),
        }
      );
      return payload.data as UpgradeResponse;
    },
    onSuccess: () => {
      // Invalidate subscription queries to refetch
      queryClient.invalidateQueries({ queryKey: ['subscription', principalId] });
      queryClient.invalidateQueries({ queryKey: ['tier-details', principalId] });
    },
  });
}

/**
 * Cancel subscription
 */
export function useCancelSubscription() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CancelParams = {}): Promise<CancelResponse> => {
      if (!principalId) throw new Error('No authenticated principal ID');

      const payload = await authorizedApiFetch<{ data?: CancelResponse }>(
        `/api/subscriptions/${principalId}/cancel`,
        {
          getToken,
          method: 'POST',
          body: JSON.stringify({ cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? true }),
        }
      );
      return payload.data as CancelResponse;
    },
    onSuccess: () => {
      // Invalidate subscription queries to refetch
      queryClient.invalidateQueries({ queryKey: ['subscription', principalId] });
      queryClient.invalidateQueries({ queryKey: ['tier-details', principalId] });
    },
  });
}

export function usePrefetchBillingData() {
  const { orgId, userId, getToken } = useAuth();
  const principalId = resolvePrincipalId(orgId, userId);
  const queryClient = useQueryClient();

  return async () => {
    if (!principalId) return;

    // ponytail: authorizedApiFetch throws on null token; prefetch is best-effort, keep the skip.
    if (!(await getToken())) return;

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['subscription', principalId],
        queryFn: async () => {
          const payload = await authorizedApiFetch<{ data?: SubscriptionData | null }>(
            `/api/subscriptions/${principalId}`,
            { getToken }
          );
          return payload.data as SubscriptionData | null;
        },
      }),
      queryClient.prefetchQuery({
        queryKey: ['tier-details', principalId],
        queryFn: async () => {
          const payload = await authorizedApiFetch<{ data?: TierDetailsData }>(
            `/api/subscriptions/${principalId}/tier`,
            { getToken }
          );
          return payload.data as TierDetailsData;
        },
      }),
    ]);
  };
}
