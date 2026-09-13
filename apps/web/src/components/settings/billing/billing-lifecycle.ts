import type { SubscriptionData } from '@/lib/query/billing';

/** Plain-language subscription status, shared by every settings surface. */
export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceled: 'Cancelled',
  incomplete: 'Incomplete',
  expired: 'Expired',
};

/** True when the current period will not renew: cancelling at period end or already cancelled. */
export function isSubscriptionEnding(subscription: SubscriptionData | null | undefined): boolean {
  return Boolean(subscription?.cancelAtPeriodEnd) || subscription?.status === 'canceled';
}

export type BillingLifecycle = 'FREE' | 'TRIALING' | 'PAID';

export function resolveBillingLifecycle(subscription: SubscriptionData | null | undefined): BillingLifecycle {
  if (!subscription) {
    return 'FREE';
  }

  if (subscription.status === 'trialing') {
    return 'TRIALING';
  }

  if (subscription.status === 'active' || subscription.status === 'past_due' || subscription.status === 'canceled') {
    return 'PAID';
  }

  return 'FREE';
}
