'use client';

import { UserButton, useAuth } from '@clerk/nextjs';
import { SignInButton } from '@/components/lazy-clerk-auth-buttons';
import type {
  AffiliateCommissionLedgerEntry,
  AffiliateLinkSummary,
  AffiliatePayoutBatchSummary,
} from '@agency-platform/shared';
import { Copy, Link2, MousePointerClick, Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  AffiliateLedgerTable,
  AffiliateMetricCard,
  AffiliatePageShell,
  AffiliateStatusChip,
  AffiliateSurfaceCard,
} from '@/components/affiliate';
import { Button } from '@/components/ui/button';
import {
  useAffiliatePortalCommissionHistory,
  useAffiliatePortalOverview,
  useCreateAffiliatePortalLink,
} from '@/lib/query/affiliate';
import { useAuthOrBypass } from '@/lib/dev-auth';
import { formatShortDate, formatUsdFromCents } from '@/lib/format';
import {
  AFFILIATE_PROMO_KIT,
  buildAffiliateEmailSwipeText,
  buildAffiliatePositioningText,
  buildAffiliateSocialSwipeText,
} from '@/lib/affiliate-promo-kit';

export default function PartnerPortalPage() {
  const clerkAuth = useAuth();
  const { userId, isLoaded, isDevelopmentBypass } = useAuthOrBypass(clerkAuth);
  const { data, isLoading, error } = useAffiliatePortalOverview();
  const {
    data: history,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useAffiliatePortalCommissionHistory();
  const createLinkMutation = useCreateAffiliatePortalLink();
  const [campaign, setCampaign] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const linkRows = useMemo<AffiliateLinkSummary[]>(
    () => data?.links ?? [],
    [data?.links]
  );
  const commissionRows = useMemo<AffiliateCommissionLedgerEntry[]>(
    () => history?.commissions ?? [],
    [history?.commissions]
  );
  const payoutRows = useMemo<AffiliatePayoutBatchSummary[]>(
    () => history?.payouts ?? [],
    [history?.payouts]
  );

  async function copyToClipboard(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      setCopiedKey(null);
    }
  }

  async function handleCreateVariant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    try {
      await createLinkMutation.mutateAsync({
        campaign: campaign.trim(),
        destinationPath: data?.primaryLink?.destinationPath || '/pricing',
      });
      setCampaign('');
    } catch (mutationError) {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Unable to create link variant');
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-muted-foreground">Loading partner portal…</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className="clean-card max-w-lg p-8 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-danger-ink">Partner Portal</p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-ink">
            Sign in to access your affiliate dashboard.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Approved partners can use their regular Clerk account. We match access by approved partner email.
          </p>
          <div className="mt-6">
            <SignInButton mode="modal">
              <Button className="bg-coral text-white hover:bg-coral/90">Sign in</Button>
            </SignInButton>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-muted-foreground">Loading partner portal…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className="clean-card max-w-2xl p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-danger-ink">Partner Portal</p>
              <h1 className="mt-3 font-display text-3xl font-semibold text-ink">
                Access pending approval
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : 'This account is not approved for affiliate portal access yet.'}
              </p>
            </div>
            {isDevelopmentBypass ? (
              <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-mono uppercase tracking-wide text-warning">
                Dev Mode
              </span>
            ) : (
              <UserButton />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AffiliatePageShell
      title="Partner Portal"
      description="Track clicks, signups, customers, and launch campaign-ready referral links."
      actions={(
        <div className="flex items-center gap-3">
          <AffiliateStatusChip status={data.partner.status} />
          {isDevelopmentBypass ? (
            <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-mono uppercase tracking-wide text-warning">
              Dev Mode
            </span>
          ) : (
            <UserButton />
          )}
        </div>
      )}
    >
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AffiliateMetricCard
          label="Clicks"
          value={data.metrics.clicks}
          description="Tracked referral visits"
          icon={<MousePointerClick className="h-4 w-4" />}
        />
        <AffiliateMetricCard
          label="Signups"
          value={data.metrics.referrals}
          description="Attributed agencies"
          icon={<Users className="h-4 w-4" />}
        />
        <AffiliateMetricCard
          label="Customers"
          value={data.metrics.customers}
          description="Paid or trialing customers"
          icon={<Users className="h-4 w-4" />}
        />
        <AffiliateMetricCard
          label="Pending"
          value={formatUsdFromCents(data.metrics.pendingCommissionCents)}
          description="Unpaid commission balance"
          icon={<Wallet className="h-4 w-4" />}
        />
        <AffiliateMetricCard
          label="Paid"
          value={formatUsdFromCents(data.metrics.paidCommissionCents)}
          description="Commission paid to date"
          icon={<Wallet className="h-4 w-4" />}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AffiliateSurfaceCard
          title="Your primary referral link"
          description="Use this as your default CTA. It carries first-party attribution for 90 days."
        >
          {data.primaryLink ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Primary URL</p>
                <p className="mt-2 break-all text-sm text-foreground">{data.primaryLink.url}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => copyToClipboard(`link:${data.primaryLink?.url || ''}`, data.primaryLink?.url || '')}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {copiedKey === `link:${data.primaryLink.url}` ? 'Copied' : 'Copy link'}
                </Button>
                <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  {data.partner.defaultCommissionBps / 100}% recurring for {data.partner.commissionDurationMonths} months
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Your primary link will appear after approval provisioning finishes.</p>
          )}
        </AffiliateSurfaceCard>

        <AffiliateSurfaceCard
          title="Create a campaign variant"
          description="Spin up a lightweight tracking code for a newsletter, webinar, or channel-specific CTA."
        >
          <form className="space-y-4" onSubmit={handleCreateVariant}>
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">Campaign name</span>
              <input
                className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/15"
                value={campaign}
                onChange={(event) => setCampaign(event.target.value)}
                placeholder="Newsletter, webinar, LinkedIn post"
                minLength={2}
                required
              />
            </label>
            <Button
              type="submit"
              className="bg-coral text-white hover:bg-coral/90"
              disabled={createLinkMutation.isPending}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {createLinkMutation.isPending ? 'Creating…' : 'Create campaign link'}
            </Button>
            {formError ? (
              <p className="text-sm text-danger-ink">{formError}</p>
            ) : null}
          </form>
        </AffiliateSurfaceCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <AffiliateSurfaceCard
          title="Promo kit"
          description="Core positioning and CTA framing you can use in emails, posts, webinars, or customer conversations."
          actions={(
            <Button
              type="button"
              variant="secondary"
              onClick={() => copyToClipboard('promo-positioning', buildAffiliatePositioningText())}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copiedKey === 'promo-positioning' ? 'Copied' : 'Copy positioning'}
            </Button>
          )}
        >
          <div className="space-y-4">
            <p className="text-sm text-foreground">{AFFILIATE_PROMO_KIT.positioningSummary}</p>
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">CTA variants</p>
              <div className="flex flex-wrap gap-2">
                {AFFILIATE_PROMO_KIT.ctaVariants.map((item) => (
                  <span
                    key={item}
                    className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Objection handling</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {AFFILIATE_PROMO_KIT.objectionHandling.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </AffiliateSurfaceCard>

        <AffiliateSurfaceCard
          title={AFFILIATE_PROMO_KIT.emailSwipe.title}
          description="A lightweight outreach template for partners with newsletter, community, or customer email distribution."
          actions={(
            <Button
              type="button"
              variant="secondary"
              onClick={() => copyToClipboard('promo-email', buildAffiliateEmailSwipeText())}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copiedKey === 'promo-email' ? 'Copied' : 'Copy email swipe'}
            </Button>
          )}
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Subject</p>
              <p className="mt-2 text-sm font-medium text-foreground">{AFFILIATE_PROMO_KIT.emailSwipe.subject}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Body</p>
              <p className="mt-2 text-sm text-muted-foreground">{AFFILIATE_PROMO_KIT.emailSwipe.body}</p>
            </div>
          </div>
        </AffiliateSurfaceCard>

        <AffiliateSurfaceCard
          title={AFFILIATE_PROMO_KIT.socialSwipe.title}
          description="Use this when promoting AuthHub on LinkedIn, X, workshop recaps, or community posts."
          actions={(
            <Button
              type="button"
              variant="secondary"
              onClick={() => copyToClipboard('promo-social', buildAffiliateSocialSwipeText())}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copiedKey === 'promo-social' ? 'Copied' : 'Copy social swipe'}
            </Button>
          )}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-sm text-muted-foreground">{AFFILIATE_PROMO_KIT.socialSwipe.body}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">How to pitch AuthHub</p>
              <ol className="space-y-2 text-sm text-foreground">
                {AFFILIATE_PROMO_KIT.launchChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
        </AffiliateSurfaceCard>
      </section>

      <AffiliateLedgerTable<AffiliateLinkSummary>
        title="Referral links"
        rows={linkRows}
        emptyState="No referral links yet. Your primary link will appear here once provisioned."
        columns={[
          {
            key: 'campaign',
            header: 'Campaign',
            render: (value, row) => (
              <div>
                <p className="font-medium text-ink">{String(value || 'Primary link')}</p>
                <p className="text-xs text-muted-foreground">{row.code}</p>
              </div>
            ),
          },
          {
            key: 'url',
            header: 'URL',
            render: (value) => (
              <span className="block max-w-[28rem] truncate text-muted-foreground">
                {String(value || '')}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (value) => <AffiliateStatusChip status={String(value) as any} />,
          },
          {
            key: 'destinationPath',
            header: 'Destination',
          },
          {
            key: 'code',
            header: 'Action',
            align: 'right',
            render: (_value, row) => (
              <Button
                type="button"
                variant="ghost"
                className="h-auto px-0 text-danger-ink hover:bg-transparent hover:text-danger-ink"
                onClick={() => row.url && copyToClipboard(`link:${row.url}`, row.url)}
              >
                {copiedKey === `link:${row.url}` ? 'Copied' : 'Copy'}
              </Button>
            ),
          },
        ]}
      />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <AffiliateSurfaceCard
          title="Commission history"
          description="Track each qualifying invoice, hold window, and final payout state."
          actions={historyError ? (
            <span className="text-xs text-danger-ink">
              {historyError instanceof Error ? historyError.message : 'Unable to load commission history.'}
            </span>
          ) : null}
        >
          {isHistoryLoading ? (
            <p className="text-sm text-muted-foreground">Loading commission history…</p>
          ) : (
            <AffiliateLedgerTable<AffiliateCommissionLedgerEntry>
              title="Commissions"
              rows={commissionRows}
              emptyState="No commissions yet. Your first paid referral will appear here after billing clears."
              columns={[
                {
                  key: 'customerName',
                  header: 'Customer',
                  render: (value, row) => (
                    <div>
                      <p className="font-medium text-ink">{String(value)}</p>
                      <p className="text-xs text-muted-foreground">{formatShortDate(row.invoiceDate)}</p>
                    </div>
                  ),
                },
                {
                  key: 'revenueAmountCents',
                  header: 'Revenue',
                  align: 'right',
                  render: (value) => formatUsdFromCents(Number(value || 0)),
                },
                {
                  key: 'amountCents',
                  header: 'Commission',
                  align: 'right',
                  render: (value, row) => (
                    <div className="space-y-1">
                      <p>{formatUsdFromCents(Number(value || 0))}</p>
                      <p className="text-xs text-muted-foreground">{row.commissionBps / 100}% share</p>
                    </div>
                  ),
                },
                {
                  key: 'holdUntil',
                  header: 'Hold Until',
                  render: (value) => formatShortDate(String(value)),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (value) => <AffiliateStatusChip status={String(value) as any} audience="partner" />,
                },
              ]}
            />
          )}
        </AffiliateSurfaceCard>

        <AffiliateSurfaceCard
          title="Payout batches"
          description="See when approved commissions move into export and payment batches."
        >
          {isHistoryLoading ? (
            <p className="text-sm text-muted-foreground">Loading payout batches…</p>
          ) : (
            <AffiliateLedgerTable<AffiliatePayoutBatchSummary>
              title="Payouts"
              rows={payoutRows}
              emptyState="No payout batches yet. Eligible commissions will group into monthly payout runs."
              columns={[
                {
                  key: 'periodStart',
                  header: 'Period',
                  render: (value, row) => `${formatShortDate(String(value))} to ${formatShortDate(row.periodEnd)}`,
                },
                {
                  key: 'totalAmountCents',
                  header: 'Amount',
                  align: 'right',
                  render: (value) => formatUsdFromCents(Number(value || 0)),
                },
                {
                  key: 'commissionCount',
                  header: 'Commissions',
                  align: 'right',
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (value) => <AffiliateStatusChip status={String(value) as any} audience="partner" />,
                },
              ]}
            />
          )}
        </AffiliateSurfaceCard>
      </section>
    </AffiliatePageShell>
  );
}
