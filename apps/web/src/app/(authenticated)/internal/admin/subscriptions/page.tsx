'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { SubscriptionTier } from '@agency-platform/shared';
import { AdminTableShell } from '@/components/internal-admin';
import { SingleSelect } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatShortDate } from '@/lib/format';
import {
  useInternalAdminCancelSubscription,
  useInternalAdminSubscriptions,
  useInternalAdminUpgradeSubscription,
} from '@/lib/query/internal-admin';

const PAGE_SIZE = 20;
const TIER_OPTIONS: SubscriptionTier[] = ['STARTER', 'GROWTH', 'SCALE'];

export default function InternalAdminSubscriptionsPage() {
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(1);
  const [messages, setMessages] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [targetTiers, setTargetTiers] = useState<Record<string, SubscriptionTier>>({});

  const params = useMemo(() => ({
    status: status || undefined,
    tier: tier || undefined,
    page,
    limit: PAGE_SIZE,
  }), [status, tier, page]);

  const { data, isLoading, error } = useInternalAdminSubscriptions(params);
  const upgradeMutation = useInternalAdminUpgradeSubscription();
  const cancelMutation = useInternalAdminCancelSubscription();

  if (isLoading) {
    return (
      <div className="flex-1 bg-paper p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-danger-ink" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-paper p-8">
        <div className="max-w-6xl mx-auto clean-card p-6 border border-coral/40 bg-coral/5">
          <h1 className="font-display text-2xl font-semibold text-ink">Subscription Monitoring</h1>
          <p className="text-sm text-danger-ink mt-2">
            {error instanceof Error ? error.message : 'Unable to load subscriptions.'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const canGoBack = page > 1;
  const canGoForward = data.items.length === PAGE_SIZE && page * PAGE_SIZE < data.total;
  const isMutating = upgradeMutation.isPending || cancelMutation.isPending;

  return (
    <div className="flex-1 bg-paper p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">Subscription Monitoring</h1>
            <p className="text-sm text-muted-foreground mt-1">Filter and manage subscription lifecycle</p>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <a href="/internal/admin" className="text-muted-foreground hover:text-foreground">Overview</a>
            <a href="/internal/admin/agencies" className="text-muted-foreground hover:text-foreground">Agencies</a>
            <a href="/internal/admin/subscriptions" className="text-danger-ink font-semibold">Subscriptions</a>
            <a href="/internal/admin/webhooks" className="text-muted-foreground hover:text-foreground">Webhooks</a>
            <a href="/internal/admin/affiliates" className="text-muted-foreground hover:text-foreground">Affiliates</a>
          </nav>
        </header>

        {messages ? (
          <div className={`clean-card p-3 text-sm ${messages.type === 'error' ? 'border-coral/40 bg-coral/5 text-danger-ink' : 'border-teal/40 bg-teal/5 text-success-ink'}`}>
            {messages.text}
          </div>
        ) : null}

        <AdminTableShell
          title="Subscriptions"
          description={`${data.total} total`}
          actions={(
            <div className="flex items-center gap-2">
              <SingleSelect
                options={[
                  { value: '', label: 'All status' },
                  { value: 'active', label: 'Active' },
                  { value: 'trialing', label: 'Trialing' },
                  { value: 'past_due', label: 'Past due' },
                  { value: 'canceled', label: 'Canceled' },
                ]}
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
                placeholder="All status"
                ariaLabel="Filter by status"
                triggerClassName="h-10 min-w-[120px] px-3 rounded-md border border-border bg-background text-sm"
              />
              <SingleSelect
                options={[
                  { value: '', label: 'All tiers' },
                  ...TIER_OPTIONS.map((o) => ({ value: o, label: o })),
                ]}
                value={tier}
                onChange={(v) => {
                  setTier(v);
                  setPage(1);
                }}
                placeholder="All tiers"
                ariaLabel="Filter by tier"
                triggerClassName="h-10 min-w-[120px] px-3 rounded-md border border-border bg-background text-sm"
              />
            </div>
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Agency</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Tier</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Period End</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No subscriptions found.
                    </td>
                  </tr>
                ) : (
                  data.items.map((subscription) => {
                    const targetTier = targetTiers[subscription.id] || (subscription.tier as SubscriptionTier);
                    return (
                      <tr key={subscription.id} className="border-b border-border/50">
                        <td className="py-3">
                          <p className="text-ink font-medium">{subscription.agencyName}</p>
                          <p className="text-xs text-muted-foreground">{subscription.agencyEmail}</p>
                        </td>
                        <td className="py-3">
                          <SingleSelect
                            options={TIER_OPTIONS.map((o) => ({ value: o, label: o }))}
                            value={targetTier}
                            onChange={(v) =>
                              setTargetTiers((current) => ({
                                ...current,
                                [subscription.id]: v as SubscriptionTier,
                              }))
                            }
                            ariaLabel="Target tier"
                            triggerClassName="h-9 min-w-[100px] px-2 rounded-md border border-border bg-background text-sm"
                          />
                        </td>
                        <td className="py-3">
                          <StatusBadge status={subscription.status as any} />
                        </td>
                        <td className="py-3 text-right text-ink">
                          {formatShortDate(subscription.currentPeriodEnd)}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={async () => {
                                if (!confirm(`Upgrade ${subscription.agencyName} to ${targetTier}?`)) return;
                                try {
                                  await upgradeMutation.mutateAsync({
                                    agencyId: subscription.agencyId,
                                    newTier: targetTier,
                                  });
                                  setMessages({ type: 'success', text: 'Subscription updated successfully.' });
                                } catch (mutationError) {
                                  setMessages({
                                    type: 'error',
                                    text: mutationError instanceof Error ? mutationError.message : 'Failed to update subscription.',
                                  });
                                }
                              }}
                              className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted/40 disabled:opacity-40"
                            >
                              Update
                            </button>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={async () => {
                                if (!confirm(`Cancel ${subscription.agencyName} at period end?`)) return;
                                try {
                                  await cancelMutation.mutateAsync({
                                    agencyId: subscription.agencyId,
                                    cancelAtPeriodEnd: true,
                                  });
                                  setMessages({ type: 'success', text: 'Subscription cancelation scheduled.' });
                                } catch (mutationError) {
                                  setMessages({
                                    type: 'error',
                                    text: mutationError instanceof Error ? mutationError.message : 'Failed to cancel subscription.',
                                  });
                                }
                              }}
                              className="px-3 py-1.5 rounded-md border border-coral/40 text-danger-ink hover:bg-coral/10 disabled:opacity-40"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {data.page}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canGoBack}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="px-3 py-1.5 rounded-md border border-border text-sm text-foreground disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canGoForward}
                onClick={() => setPage((value) => value + 1)}
                className="px-3 py-1.5 rounded-md border border-border text-sm text-foreground disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </AdminTableShell>
      </div>
    </div>
  );
}
