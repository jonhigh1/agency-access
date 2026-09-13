'use client';

/**
 * Plan strip — the General tab's ink panel.
 *
 * Plan name, subscription status, and tier limits in the mono data layer.
 * Reads principal-safe hooks (orgId ?? userId), so personal workspaces get
 * a live strip too. One shell across loading / loaded; unloaded values
 * render as "—". No button lives on the ink ground.
 */

import { SUBSCRIPTION_TIER_NAMES } from '@agency-platform/shared';
import type { TierLimits } from '@agency-platform/shared';
import { useSubscription, useTierDetails } from '@/lib/query/billing';
import { resolveBillingLifecycle } from '../billing/billing-lifecycle';

const UNLOADED = '—';

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  canceled: 'Cancelled',
  incomplete: 'Incomplete',
  expired: 'Expired',
};

function formatLimit(entry: TierLimits[keyof TierLimits] | undefined, noun: string): string | null {
  if (!entry) return null;
  return entry.limit === 'unlimited' ? `unlimited ${noun}` : `${entry.limit} ${noun}`;
}

export function PlanStrip() {
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription();
  const { data: tierDetails, isLoading: tierLoading } = useTierDetails();

  const lifecycle = resolveBillingLifecycle(subscription);
  const plan = subscriptionLoading
    ? UNLOADED
    : lifecycle === 'FREE' || !subscription?.tier
      ? 'Free'
      : SUBSCRIPTION_TIER_NAMES[subscription.tier];

  const status = subscriptionLoading
    ? UNLOADED
    : subscription
      ? (STATUS_LABELS[subscription.status] ?? subscription.status)
      : 'No subscription';

  const limits = tierDetails?.limits;
  const limitParts = tierLoading || !limits
    ? null
    : [
        formatLimit(limits.clients, 'clients'),
        formatLimit(limits.accessRequests, 'requests'),
        formatLimit(limits.members, 'members'),
      ].filter(Boolean);
  const limitLine = limitParts && limitParts.length > 0 ? limitParts.join(' · ') : UNLOADED;

  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="ink-panel p-6" data-testid="plan-strip">
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <span className="label-micro">Plan</span>
          <p className="mt-2 text-2xl font-bold" data-testid="plan-strip-plan">
            {plan}
          </p>
        </div>
        <div>
          <span className="label-micro">Status</span>
          <p className="mt-2 text-lg" data-testid="plan-strip-status">
            {status}
          </p>
          {periodEnd && lifecycle !== 'FREE' && (
            <p className="label-nano mt-1">
              {subscription?.status === 'trialing' ? 'Trial ends' : 'Renews'} {periodEnd}
            </p>
          )}
        </div>
        <div>
          <span className="label-micro">Limits</span>
          <p className="mt-2 text-sm leading-relaxed" data-testid="plan-strip-limits">
            {limitLine}
          </p>
        </div>
      </div>
    </div>
  );
}
