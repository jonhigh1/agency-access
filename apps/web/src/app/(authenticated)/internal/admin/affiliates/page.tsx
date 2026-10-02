'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { AffiliateStatusChip } from '@/components/affiliate';
import { formatShortDate, formatUsdFromCents } from '@/lib/format';
import { AdminTableShell } from '@/components/internal-admin';
import { SingleSelect } from '@/components/ui';
import {
  useInternalAdminAdjustAffiliateCommission,
  useInternalAdminAffiliateFraudQueue,
  useInternalAdminAffiliatePayoutBatches,
  useInternalAdminAffiliatePartnerDetail,
  useInternalAdminAffiliatePartners,
  useInternalAdminDisableAffiliateLink,
  useInternalAdminDisqualifyAffiliateReferral,
  useInternalAdminExportAffiliatePayoutBatch,
  useInternalAdminGenerateAffiliatePayoutBatch,
  useInternalAdminResolveAffiliateReferralReview,
  useInternalAdminUpdateAffiliatePartner,
} from '@/lib/query/internal-admin';

const PAGE_SIZE = 20;
const PAYOUT_BATCH_PAGE_SIZE = 8;

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getDefaultPayoutWindow() {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));

  return {
    periodStart: toDateInputValue(periodStart),
    periodEnd: toDateInputValue(periodEnd),
  };
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not exported';
  return new Date(value).toLocaleString();
}

function formatPercentFromBps(value: number) {
  return `${value / 100}%`;
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export default function InternalAdminAffiliatesPage() {
  const defaultPayoutWindow = useMemo(() => getDefaultPayoutWindow(), []);
  const [status, setStatus] = useState('applied');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [payoutPeriodStart, setPayoutPeriodStart] = useState(defaultPayoutWindow.periodStart);
  const [payoutPeriodEnd, setPayoutPeriodEnd] = useState(defaultPayoutWindow.periodEnd);
  const [payoutNotes, setPayoutNotes] = useState('Monthly affiliate payout run');
  const [messages, setMessages] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const params = useMemo(() => ({
    status: status || undefined,
    search: search.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  }), [status, search, page]);

  const { data, isLoading, error } = useInternalAdminAffiliatePartners(params);
  const {
    data: payoutBatches,
    isLoading: isPayoutBatchLoading,
    error: payoutBatchError,
  } = useInternalAdminAffiliatePayoutBatches({ limit: PAYOUT_BATCH_PAGE_SIZE });
  const {
    data: fraudQueue,
    isLoading: isFraudQueueLoading,
    error: fraudQueueError,
  } = useInternalAdminAffiliateFraudQueue();
  const updatePartnerMutation = useInternalAdminUpdateAffiliatePartner();
  const disableLinkMutation = useInternalAdminDisableAffiliateLink();
  const disqualifyReferralMutation = useInternalAdminDisqualifyAffiliateReferral();
  const adjustCommissionMutation = useInternalAdminAdjustAffiliateCommission();
  const generatePayoutBatchMutation = useInternalAdminGenerateAffiliatePayoutBatch();
  const exportPayoutBatchMutation = useInternalAdminExportAffiliatePayoutBatch();
  const resolveReferralReviewMutation = useInternalAdminResolveAffiliateReferralReview();

  const selectedPartner = useMemo(
    () => data?.items.find((partner) => partner.id === selectedPartnerId) ?? data?.items[0] ?? null,
    [data?.items, selectedPartnerId]
  );
  const {
    data: partnerDetail,
    isLoading: isPartnerDetailLoading,
    error: partnerDetailError,
  } = useInternalAdminAffiliatePartnerDetail(selectedPartner?.id ?? null);

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
          <h1 className="font-display text-2xl font-semibold text-ink">Affiliate Review Queue</h1>
          <p className="text-sm text-danger-ink mt-2">
            {error instanceof Error ? error.message : 'Unable to load affiliate review queue.'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const canGoBack = page > 1;
  const canGoForward = data.items.length === PAGE_SIZE && page * PAGE_SIZE < data.total;

  /** Runs a mutation and surfaces its success text or a fallback error message. */
  async function runAdminAction(action: () => Promise<string>, fallbackError: string) {
    try {
      const text = await action();
      setMessages({ type: 'success', text });
    } catch (mutationError) {
      setMessages({
        type: 'error',
        text: mutationError instanceof Error ? mutationError.message : fallbackError,
      });
    }
  }

  async function handleReviewDecision(nextStatus: 'approved' | 'rejected') {
    if (!selectedPartner) return;

    const notes = window.prompt(
      nextStatus === 'approved'
        ? 'Optional approval notes for the audit trail'
        : 'Why is this application being rejected?',
      nextStatus === 'approved' ? 'Strong fit for pilot cohort' : ''
    );

    if (notes === null) {
      return;
    }

    await runAdminAction(async () => {
      await updatePartnerMutation.mutateAsync({
        partnerId: selectedPartner.id,
        status: nextStatus,
        defaultCommissionBps: selectedPartner.defaultCommissionBps,
        commissionDurationMonths: selectedPartner.commissionDurationMonths,
        internalNotes: notes || undefined,
      });
      return nextStatus === 'approved' ? 'Affiliate partner approved.' : 'Affiliate partner rejected.';
    }, 'Unable to update affiliate partner.');
  }

  async function handleDisableLink(linkId: string) {
    const internalNotes = window.prompt('Why is this partner link being disabled?', 'Campaign link was misleading');
    if (internalNotes === null) {
      return;
    }

    await runAdminAction(async () => {
      await disableLinkMutation.mutateAsync({
        linkId,
        internalNotes: internalNotes || undefined,
      });
      return 'Affiliate link disabled.';
    }, 'Unable to disable affiliate link.');
  }

  async function handleDisqualifyReferral(referralId: string) {
    const reason = window.prompt('Disqualification reason', 'self_referral_email');
    if (reason === null) {
      return;
    }
    if (!reason.trim()) {
      setMessages({
        type: 'error',
        text: 'A disqualification reason is required.',
      });
      return;
    }

    const internalNotes = window.prompt('Internal notes', 'Matched operator review evidence');
    if (internalNotes === null) {
      return;
    }
    if (!internalNotes.trim()) {
      setMessages({
        type: 'error',
        text: 'Internal notes are required.',
      });
      return;
    }

    await runAdminAction(async () => {
      await disqualifyReferralMutation.mutateAsync({
        referralId,
        reason: reason.trim(),
        internalNotes: internalNotes.trim(),
      });
      return 'Affiliate referral disqualified and unpaid commissions voided.';
    }, 'Unable to disqualify affiliate referral.');
  }

  async function handleAdjustCommissionAmount(commissionId: string, currentAmountCents: number) {
    const amountInput = window.prompt('Updated commission amount in cents', String(currentAmountCents));
    if (amountInput === null) {
      return;
    }

    const amountCents = Number.parseInt(amountInput, 10);
    if (Number.isNaN(amountCents) || amountCents < 0) {
      setMessages({
        type: 'error',
        text: 'Commission amount must be a non-negative integer.',
      });
      return;
    }

    const internalNotes = window.prompt('Internal notes', 'Restored amount after manual validation');
    if (internalNotes === null) {
      return;
    }
    if (!internalNotes.trim()) {
      setMessages({
        type: 'error',
        text: 'Internal notes are required.',
      });
      return;
    }

    await runAdminAction(async () => {
      await adjustCommissionMutation.mutateAsync({
        commissionId,
        amountCents,
        internalNotes: internalNotes.trim(),
      });
      return 'Affiliate commission amount updated.';
    }, 'Unable to adjust affiliate commission.');
  }

  async function handleAdjustCommissionStatus(commissionId: string, nextStatus: 'approved' | 'void') {
    const internalNotes = window.prompt(
      nextStatus === 'approved' ? 'Approval notes' : 'Void reason',
      nextStatus === 'approved' ? 'Validated after manual review' : 'Voided after internal review'
    );
    if (internalNotes === null) {
      return;
    }
    if (!internalNotes.trim()) {
      setMessages({
        type: 'error',
        text: 'Internal notes are required.',
      });
      return;
    }

    await runAdminAction(async () => {
      await adjustCommissionMutation.mutateAsync({
        commissionId,
        status: nextStatus,
        internalNotes: internalNotes.trim(),
      });
      return nextStatus === 'approved' ? 'Affiliate commission approved.' : 'Affiliate commission voided.';
    }, 'Unable to update affiliate commission.');
  }

  async function handleGeneratePayoutBatch() {
    if (!payoutPeriodStart || !payoutPeriodEnd) {
      setMessages({
        type: 'error',
        text: 'Payout period start and end dates are required.',
      });
      return;
    }

    await runAdminAction(async () => {
      const batch = await generatePayoutBatchMutation.mutateAsync({
        periodStart: `${payoutPeriodStart}T00:00:00.000Z`,
        periodEnd: `${payoutPeriodEnd}T23:59:59.999Z`,
        notes: payoutNotes.trim() || undefined,
      });
      return `Payout batch ${batch.id} generated and ready for export.`;
    }, 'Unable to generate payout batch.');
  }

  async function handleExportPayoutBatch(batchId: string) {
    await runAdminAction(async () => {
      const exportPayload = await exportPayoutBatchMutation.mutateAsync({ batchId });
      downloadCsv(exportPayload.fileName, exportPayload.csv);
      return `${exportPayload.fileName} exported for manual payout processing.`;
    }, 'Unable to export payout batch.');
  }

  async function handleResolveReferralReview(
    referralId: string,
    resolution: 'clear' | 'keep_review_required' | 'disqualify'
  ) {
    const reason = window.prompt(
      resolution === 'clear'
        ? 'Why is this referral safe to clear?'
        : resolution === 'keep_review_required'
          ? 'Why should this referral stay under review?'
          : 'Why is this referral being disqualified?',
      resolution === 'clear'
        ? 'validated billing owner match after manual review'
        : resolution === 'keep_review_required'
          ? 'waiting on additional identity verification'
          : 'self_referral_email'
    );

    if (reason === null) {
      return;
    }
    if (!reason.trim()) {
      setMessages({
        type: 'error',
        text: 'A fraud-review reason is required.',
      });
      return;
    }

    const internalNotes = window.prompt(
      'Internal notes for the audit log',
      resolution === 'clear'
        ? 'Matched purchaser identity and allowed payout flow to continue.'
        : resolution === 'keep_review_required'
          ? 'Waiting on supporting billing evidence before clearing.'
          : 'Matched operator review evidence.'
    );

    if (internalNotes === null) {
      return;
    }
    if (!internalNotes.trim()) {
      setMessages({
        type: 'error',
        text: 'Internal notes are required.',
      });
      return;
    }

    await runAdminAction(async () => {
      await resolveReferralReviewMutation.mutateAsync({
        referralId,
        resolution,
        reason: reason.trim(),
        internalNotes: internalNotes.trim(),
      });
      return resolution === 'clear'
        ? 'Referral cleared for normal payout flow.'
        : resolution === 'keep_review_required'
          ? 'Referral kept in the fraud review queue.'
          : 'Referral disqualified and unpaid commissions voided.';
    }, 'Unable to resolve fraud review.');
  }

  const isMutationPending =
    updatePartnerMutation.isPending ||
    disableLinkMutation.isPending ||
    disqualifyReferralMutation.isPending ||
    adjustCommissionMutation.isPending ||
    generatePayoutBatchMutation.isPending ||
    exportPayoutBatchMutation.isPending ||
    resolveReferralReviewMutation.isPending;

  return (
    <div className="flex-1 bg-paper p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">Affiliate Review Queue</h1>
            <p className="text-sm text-muted-foreground mt-1">Approve, reject, and tune pilot-partner economics.</p>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <a href="/internal/admin" className="text-muted-foreground hover:text-foreground">Overview</a>
            <a href="/internal/admin/agencies" className="text-muted-foreground hover:text-foreground">Agencies</a>
            <a href="/internal/admin/subscriptions" className="text-muted-foreground hover:text-foreground">Subscriptions</a>
            <a href="/internal/admin/webhooks" className="text-muted-foreground hover:text-foreground">Webhooks</a>
            <a href="/internal/admin/affiliates" className="text-ink font-semibold">Affiliates</a>
          </nav>
        </header>

        {messages ? (
          <div className={`clean-card p-3 text-sm ${messages.type === 'error' ? 'border-coral/40 bg-coral/5 text-danger-ink' : 'border-teal/40 bg-teal/5 text-success-ink'}`}>
            {messages.text}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <AdminTableShell
            title="Affiliate partners"
            description={`${data.total} total`}
            actions={(
              <div className="flex flex-col gap-2 sm:flex-row">
                <SingleSelect
                  options={[
                    { value: '', label: 'All status' },
                    { value: 'applied', label: 'Applied' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'rejected', label: 'Rejected' },
                    { value: 'disabled', label: 'Disabled' },
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
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, email, company"
                  className="h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground"
                />
              </div>
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Partner</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Applied</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Referrals</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        No affiliate partners found.
                      </td>
                    </tr>
                  ) : (
                    data.items.map((partner) => (
                      <tr key={partner.id} className="border-b border-border/50">
                        <td className="py-3">
                          <p className="text-ink font-medium">{partner.name}</p>
                          <p className="text-xs text-muted-foreground">{partner.email}</p>
                        </td>
                        <td className="py-3">
                          <AffiliateStatusChip status={partner.status} />
                        </td>
                        <td className="py-3 text-right text-ink">
                          {formatShortDate(partner.appliedAt)}
                        </td>
                        <td className="py-3 text-right text-ink tabular-nums">
                          {partner.referralCount}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPartnerId(partner.id)}
                            className="text-danger-ink hover:text-danger-ink font-semibold"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {data.page}</p>
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

          <AdminTableShell
            title="Application review"
            description={selectedPartner ? selectedPartner.email : 'Select a partner to review'}
          >
            {selectedPartner ? (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Company</p>
                    <p className="mt-2 text-ink">{selectedPartner.companyName || 'n/a'}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Audience size</p>
                    <p className="mt-2 text-ink">{selectedPartner.audienceSize || 'n/a'}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Default commission</p>
                    <p className="mt-2 text-ink">{formatPercentFromBps(selectedPartner.defaultCommissionBps)} for {selectedPartner.commissionDurationMonths} months</p>
                  </div>
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Website</p>
                    <p className="mt-2 break-all text-ink">{selectedPartner.websiteUrl || 'n/a'}</p>
                  </div>
                </div>

                {isPartnerDetailLoading ? (
                  <div className="rounded-md border border-border bg-background p-6 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-danger-ink" />
                  </div>
                ) : partnerDetailError ? (
                  <div className="rounded-md border border-coral/40 bg-coral/5 p-3 text-danger-ink">
                    {partnerDetailError instanceof Error ? partnerDetailError.message : 'Unable to load affiliate partner detail.'}
                  </div>
                ) : partnerDetail ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Clicks</p>
                        <p className="mt-2 text-lg font-semibold text-ink">{partnerDetail.metrics.clicks}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Referrals</p>
                        <p className="mt-2 text-lg font-semibold text-ink">{partnerDetail.metrics.referrals}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Commissions</p>
                        <p className="mt-2 text-lg font-semibold text-ink">{partnerDetail.metrics.commissions}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                        <p className="mt-2 text-lg font-semibold text-ink">{formatUsdFromCents(partnerDetail.metrics.pendingCommissionCents)}</p>
                      </div>
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid</p>
                        <p className="mt-2 text-lg font-semibold text-ink">{formatUsdFromCents(partnerDetail.metrics.paidCommissionCents)}</p>
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Partner links</p>
                        <p className="text-xs text-muted-foreground">{partnerDetail.links.length} link{partnerDetail.links.length === 1 ? '' : 's'}</p>
                      </div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-2 text-left text-muted-foreground font-medium">Link</th>
                              <th className="py-2 text-left text-muted-foreground font-medium">Status</th>
                              <th className="py-2 text-right text-muted-foreground font-medium">Clicks</th>
                              <th className="py-2 text-right text-muted-foreground font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {partnerDetail.links.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                                  No partner links created yet.
                                </td>
                              </tr>
                            ) : partnerDetail.links.map((link) => (
                              <tr key={link.id} className="border-b border-border/50">
                                <td className="py-3">
                                  <a href={link.url} target="_blank" rel="noreferrer" className="font-medium text-danger-ink hover:text-danger-ink">
                                    /r/{link.code}
                                  </a>
                                  <p className="text-xs text-muted-foreground">{link.destinationPath}{link.campaign ? ` · ${link.campaign}` : ''}</p>
                                </td>
                                <td className="py-3">
                                  <AffiliateStatusChip status={link.status} />
                                </td>
                                <td className="py-3 text-right tabular-nums">{link.clickCount}</td>
                                <td className="py-3 text-right">
                                  {link.status === 'active' ? (
                                    <button
                                      type="button"
                                      disabled={isMutationPending}
                                      onClick={() => handleDisableLink(link.id)}
                                      className="text-danger-ink hover:text-danger-ink font-semibold disabled:opacity-40"
                                    >
                                      Disable
                                    </button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No action</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Referrals</p>
                        <p className="text-xs text-muted-foreground">{partnerDetail.referrals.length} referral{partnerDetail.referrals.length === 1 ? '' : 's'}</p>
                      </div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-2 text-left text-muted-foreground font-medium">Agency</th>
                              <th className="py-2 text-left text-muted-foreground font-medium">Status</th>
                              <th className="py-2 text-left text-muted-foreground font-medium">Risk</th>
                              <th className="py-2 text-right text-muted-foreground font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {partnerDetail.referrals.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                                  No referrals attributed yet.
                                </td>
                              </tr>
                            ) : partnerDetail.referrals.map((referral) => (
                              <tr key={referral.id} className="border-b border-border/50">
                                <td className="py-3">
                                  <p className="font-medium text-ink">{referral.referredAgencyName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {referral.attributionSource} · {formatPercentFromBps(referral.commissionBps)} for {referral.commissionDurationMonths} months
                                  </p>
                                </td>
                                <td className="py-3">
                                  <AffiliateStatusChip status={referral.status as 'attributed' | 'qualified' | 'review_required' | 'disqualified'} />
                                </td>
                                <td className="py-3">
                                  {referral.riskReasons.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {referral.riskReasons.map((reason) => (
                                        <span key={reason} className="inline-flex rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-warning">
                                          {reason}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No risk flags</span>
                                  )}
                                </td>
                                <td className="py-3 text-right">
                                  {referral.status !== 'disqualified' ? (
                                    <button
                                      type="button"
                                      disabled={isMutationPending}
                                      onClick={() => handleDisqualifyReferral(referral.id)}
                                      className="text-danger-ink hover:text-danger-ink font-semibold disabled:opacity-40"
                                    >
                                      Disqualify
                                    </button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{referral.disqualificationReason || 'No action'}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-md border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Commission ledger</p>
                        <p className="text-xs text-muted-foreground">{partnerDetail.commissions.length} commission{partnerDetail.commissions.length === 1 ? '' : 's'}</p>
                      </div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-2 text-left text-muted-foreground font-medium">Customer</th>
                              <th className="py-2 text-left text-muted-foreground font-medium">Status</th>
                              <th className="py-2 text-right text-muted-foreground font-medium">Commission</th>
                              <th className="py-2 text-right text-muted-foreground font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {partnerDetail.commissions.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                                  No commissions created yet.
                                </td>
                              </tr>
                            ) : partnerDetail.commissions.map((commission) => (
                              <tr key={commission.id} className="border-b border-border/50 align-top">
                                <td className="py-3">
                                  <p className="font-medium text-ink">{commission.customerName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Revenue {formatUsdFromCents(commission.revenueAmountCents)} · Invoice {formatShortDate(commission.invoiceDate)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Hold {formatShortDate(commission.holdUntil)} · {formatPercentFromBps(commission.commissionBps)}
                                  </p>
                                  {commission.notes ? (
                                    <p className="mt-1 text-xs text-muted-foreground">{commission.notes}</p>
                                  ) : null}
                                </td>
                                <td className="py-3">
                                  <AffiliateStatusChip status={commission.status} />
                                </td>
                                <td className="py-3 text-right tabular-nums">
                                  {formatUsdFromCents(commission.amountCents)}
                                </td>
                                <td className="py-3 text-right">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      disabled={isMutationPending}
                                      onClick={() => handleAdjustCommissionAmount(commission.id, commission.amountCents)}
                                      className="text-foreground hover:text-danger-ink font-semibold disabled:opacity-40"
                                    >
                                      Adjust
                                    </button>
                                    {commission.status !== 'approved' && commission.status !== 'paid' ? (
                                      <button
                                        type="button"
                                        disabled={isMutationPending}
                                        onClick={() => handleAdjustCommissionStatus(commission.id, 'approved')}
                                        className="text-success-ink hover:text-success-ink font-semibold disabled:opacity-40"
                                      >
                                        Approve
                                      </button>
                                    ) : null}
                                    {commission.status !== 'void' && commission.status !== 'paid' ? (
                                      <button
                                        type="button"
                                        disabled={isMutationPending}
                                        onClick={() => handleAdjustCommissionStatus(commission.id, 'void')}
                                        className="text-danger-ink hover:text-danger-ink font-semibold disabled:opacity-40"
                                      >
                                        Void
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Application notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-ink">
                    {selectedPartner.applicationNotes || 'No application notes provided.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={isMutationPending}
                    onClick={() => handleReviewDecision('approved')}
                    className="px-4 py-2 rounded-md bg-teal text-white hover:bg-teal/90 disabled:opacity-40"
                  >
                    Approve partner
                  </button>
                  <button
                    type="button"
                    disabled={isMutationPending}
                    onClick={() => handleReviewDecision('rejected')}
                    className="px-4 py-2 rounded-md border border-coral/40 text-danger-ink hover:bg-coral/10 disabled:opacity-40"
                  >
                    Reject partner
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select an affiliate partner to inspect their application.</p>
            )}
          </AdminTableShell>
        </div>

        <AdminTableShell
          title="Payout operations"
          description="Freeze approved commissions into a payout batch, then export CSV for manual payout execution."
          actions={(
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="date"
                value={payoutPeriodStart}
                onChange={(event) => setPayoutPeriodStart(event.target.value)}
                className="h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground"
                aria-label="Payout period start"
              />
              <input
                type="date"
                value={payoutPeriodEnd}
                onChange={(event) => setPayoutPeriodEnd(event.target.value)}
                className="h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground"
                aria-label="Payout period end"
              />
              <input
                value={payoutNotes}
                onChange={(event) => setPayoutNotes(event.target.value)}
                placeholder="Batch notes"
                className="h-10 min-w-[14rem] px-3 rounded-md border border-border bg-background text-sm text-foreground"
                aria-label="Batch notes"
              />
              <button
                type="button"
                disabled={isMutationPending}
                onClick={() => void handleGeneratePayoutBatch()}
                className="h-10 px-4 rounded-md bg-ink text-white hover:bg-ink/90 disabled:opacity-40"
              >
                Generate batch
              </button>
            </div>
          )}
        >
          {isPayoutBatchLoading ? (
            <div className="rounded-md border border-border bg-background p-6 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-danger-ink" />
            </div>
          ) : payoutBatchError ? (
            <div className="rounded-md border border-coral/40 bg-coral/5 p-3 text-danger-ink">
              {payoutBatchError instanceof Error ? payoutBatchError.message : 'Unable to load payout batches.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left text-muted-foreground font-medium">Period</th>
                    <th className="py-2 text-left text-muted-foreground font-medium">Status</th>
                    <th className="py-2 text-right text-muted-foreground font-medium">Commissions</th>
                    <th className="py-2 text-right text-muted-foreground font-medium">Total</th>
                    <th className="py-2 text-right text-muted-foreground font-medium">Exported</th>
                    <th className="py-2 text-right text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!payoutBatches || payoutBatches.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        No payout batches yet. Generate one when the current commission hold window closes.
                      </td>
                    </tr>
                  ) : payoutBatches.items.map((batch) => (
                    <tr key={batch.id} className="border-b border-border/50 align-top">
                      <td className="py-3">
                        <p className="font-medium text-ink">
                          {formatShortDate(batch.periodStart)} to {formatShortDate(batch.periodEnd)}
                        </p>
                        <p className="text-xs text-muted-foreground">{batch.notes || 'No notes'}</p>
                      </td>
                      <td className="py-3">
                        <AffiliateStatusChip status={batch.status} />
                      </td>
                      <td className="py-3 text-right tabular-nums text-ink">{batch.commissionCount}</td>
                      <td className="py-3 text-right tabular-nums text-ink">{formatUsdFromCents(batch.totalAmount)}</td>
                      <td className="py-3 text-right text-muted-foreground">{formatDateTime(batch.exportedAt)}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={isMutationPending}
                          onClick={() => void handleExportPayoutBatch(batch.id)}
                          className="text-danger-ink hover:text-danger-ink font-semibold disabled:opacity-40"
                        >
                          {batch.exportedAt ? 'Re-export CSV' : 'Export CSV'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminTableShell>

        <AdminTableShell
          title="Fraud review queue"
          description="Flagged referrals stay here until an operator clears, keeps, or disqualifies them."
        >
          {isFraudQueueLoading ? (
            <div className="rounded-md border border-border bg-background p-6 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-danger-ink" />
            </div>
          ) : fraudQueueError ? (
            <div className="rounded-md border border-coral/40 bg-coral/5 p-3 text-danger-ink">
              {fraudQueueError instanceof Error ? fraudQueueError.message : 'Unable to load fraud review queue.'}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Flagged referrals</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{fraudQueue?.counts.flaggedReferrals ?? 0}</p>
                </div>
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Flagged commissions</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{fraudQueue?.counts.flaggedCommissions ?? 0}</p>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Flagged referrals</p>
                  <p className="text-xs text-muted-foreground">{fraudQueue?.referrals.length ?? 0} item(s)</p>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 text-left text-muted-foreground font-medium">Referral</th>
                        <th className="py-2 text-left text-muted-foreground font-medium">Risk</th>
                        <th className="py-2 text-right text-muted-foreground font-medium">Commissions</th>
                        <th className="py-2 text-right text-muted-foreground font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!fraudQueue || fraudQueue.referrals.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-muted-foreground">
                            No flagged referrals are waiting for review.
                          </td>
                        </tr>
                      ) : fraudQueue.referrals.map((referral) => (
                        <tr key={referral.id} className="border-b border-border/50 align-top">
                          <td className="py-3">
                            <p className="font-medium text-ink">{referral.referredAgencyName}</p>
                            <p className="text-xs text-muted-foreground">{referral.partnerName} · {formatShortDate(referral.createdAt)}</p>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1">
                              {referral.riskReasons.map((reason) => (
                                <span key={reason} className="inline-flex rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-warning">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 text-right tabular-nums text-ink">{referral.commissionCount}</td>
                          <td className="py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                disabled={isMutationPending}
                                onClick={() => void handleResolveReferralReview(referral.id, 'clear')}
                                className="text-success-ink hover:text-success-ink font-semibold disabled:opacity-40"
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                disabled={isMutationPending}
                                onClick={() => void handleResolveReferralReview(referral.id, 'keep_review_required')}
                                className="text-foreground hover:text-danger-ink font-semibold disabled:opacity-40"
                              >
                                Keep under review
                              </button>
                              <button
                                type="button"
                                disabled={isMutationPending}
                                onClick={() => void handleResolveReferralReview(referral.id, 'disqualify')}
                                className="text-danger-ink hover:text-danger-ink font-semibold disabled:opacity-40"
                              >
                                Disqualify
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Flagged commissions</p>
                  <p className="text-xs text-muted-foreground">{fraudQueue?.commissions.length ?? 0} item(s)</p>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 text-left text-muted-foreground font-medium">Commission</th>
                        <th className="py-2 text-left text-muted-foreground font-medium">Status</th>
                        <th className="py-2 text-right text-muted-foreground font-medium">Amount</th>
                        <th className="py-2 text-right text-muted-foreground font-medium">Hold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!fraudQueue || fraudQueue.commissions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-muted-foreground">
                            No flagged commissions are waiting for review.
                          </td>
                        </tr>
                      ) : fraudQueue.commissions.map((commission) => (
                        <tr key={commission.id} className="border-b border-border/50">
                          <td className="py-3">
                            <p className="font-medium text-ink">{commission.customerName}</p>
                            <p className="text-xs text-muted-foreground">{commission.partnerName}</p>
                          </td>
                          <td className="py-3">
                            <AffiliateStatusChip status={commission.status} />
                          </td>
                          <td className="py-3 text-right tabular-nums text-ink">{formatUsdFromCents(commission.amountCents)}</td>
                          <td className="py-3 text-right text-muted-foreground">{formatShortDate(commission.holdUntil)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </AdminTableShell>
      </div>
    </div>
  );
}
