'use client';

import { useRef, useState } from 'react';
import { Button, Card, StatusBadge } from '@/components/ui';
import type { MetaAssetDecline, MetaFulfillmentDeclines } from '@agency-platform/shared';
import type { MetaFulfillmentResult } from '@/lib/api/access-requests';

interface MetaFulfillmentCardProps {
  results: MetaFulfillmentResult[];
  /** Client "we don't have / won't share this asset type" decisions. Absent on older payloads. */
  declines?: MetaFulfillmentDeclines;
  onExclude?: (grantId: string, reason: string) => Promise<string | null>;
}

const STATUS_LABELS: Record<MetaFulfillmentResult['status'], string> = {
  selected: 'Selected',
  sharing_attempted: 'Verification in progress',
  verified: 'Verified',
  manual_action_required: 'Manual action required',
  blocked: 'Blocked',
  stale: 'Reconnect required',
  revoked: 'Revoked',
  excluded: 'Excluded',
};

/** Client-voiced copy per declined kind. Declines are decisions, not statuses — no badges. */
const DECLINE_COPY: Record<MetaAssetDecline['assetKind'], string> = {
  ad_account: 'No ad accounts to share',
  page: 'No pages to share',
  instagram_account: 'No Instagram accounts to share',
  catalog: 'No catalogs to share',
  dataset: 'No pixels or datasets to share',
};

function badgeVariant(status: MetaFulfillmentResult['status']) {
  if (status === 'verified') return 'success' as const;
  if (status === 'blocked' || status === 'revoked') return 'danger' as const;
  if (status === 'excluded') return 'default' as const;
  return 'warning' as const;
}

function formatValue(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function MetaFulfillmentCard({ results, declines, onExclude }: MetaFulfillmentCardProps) {
  const [activeGrantId, setActiveGrantId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const resultRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const hasDeclines = Boolean(declines && declines.length > 0);

  if (results.length === 0 && !hasDeclines) return null;

  const submitExclusion = async (grantId: string) => {
    setSubmitting(true);
    setMessage('');
    try {
      if (!onExclude) return;
      const error = await onExclude(grantId, reason.trim());
      if (error) {
        setMessage(error);
        return;
      }

      setMessage('Requirement excluded. Request status was recalculated.');
      setActiveGrantId(null);
      setReason('');
      setConfirmed(false);
      resultRefs.current[grantId]?.focus();
    } catch {
      setMessage('Could not save exclusion. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openExclusion = (grantId: string) => {
    setActiveGrantId(grantId);
    setReason('');
    setConfirmed(false);
    setMessage('');
  };

  const closeExclusion = () => {
    setActiveGrantId(null);
    setReason('');
    setConfirmed(false);
  };

  return (
    <Card className="border-black/10">
      {hasDeclines ? (
        <div className="border-b border-border px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Client marked:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {(declines ?? []).map((decline) => (
              <li key={decline.assetKind}>{DECLINE_COPY[decline.assetKind]}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {results.length === 0 ? null : (
        <>
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-semibold text-ink">Meta Access Results</h2>
        <p className="text-sm text-muted-foreground">Verified separately for each asset and recipient</p>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{message}</p>
      <ul className="divide-y divide-border">
        {results.map((result) => {
          const canExclude = Boolean(onExclude) && !['verified', 'excluded', 'revoked'].includes(result.status);
          const isActive = activeGrantId === result.id;
          return (
            <li
              key={result.id}
              ref={(node) => { resultRefs.current[result.id] = node; }}
              tabIndex={-1}
              className="p-6 focus:outline-none focus:ring-2 focus:ring-coral/40"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-ink">{result.assetName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatValue(result.assetKind)} · {formatValue(result.recipientType)}: {result.recipientName}
                  </p>
                </div>
                <StatusBadge badgeVariant={badgeVariant(result.status)}>
                  {STATUS_LABELS[result.status]}
                </StatusBadge>
              </div>

              {result.requestedTasks.length > 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Requested tasks: {result.requestedTasks.map(formatValue).join(', ')}
                </p>
              ) : null}
              {result.nextAction ? (
                <p className="mt-2 text-sm text-ink">
                  Next: {result.nextAction}
                  {result.nextActor ? ` (${formatValue(result.nextActor)})` : ''}
                </p>
              ) : null}
              {result.exclusion ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {result.exclusion.actor}: {result.exclusion.reason} · {new Date(result.exclusion.excludedAt).toLocaleString()}
                </p>
              ) : null}

              {canExclude && !isActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 px-0 text-danger-ink hover:bg-transparent"
                  onClick={() => openExclusion(result.id)}
                >
                  Exclude requirement
                </Button>
              ) : null}

              {isActive ? (
                <fieldset className="mt-4 border border-border p-4">
                  <legend className="px-1 text-sm font-semibold text-ink">Confirm exclusion</legend>
                  <label className="block text-sm font-medium text-ink" htmlFor={`reason-${result.id}`}>
                    Reason
                  </label>
                  <textarea
                    id={`reason-${result.id}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-none border border-black bg-card px-3 py-2 text-sm"
                  />
                  <label className="mt-3 flex min-h-[44px] items-center gap-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    I confirm this requirement should not block completion.
                  </label>
                  <div className="mt-3 flex gap-3">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={submitting || !confirmed || reason.trim().length < 10}
                      onClick={() => void submitExclusion(result.id)}
                    >
                      {submitting ? 'Excluding...' : 'Confirm exclusion'}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={submitting} onClick={closeExclusion}>
                      Keep requirement
                    </Button>
                  </div>
                </fieldset>
              ) : null}
            </li>
          );
        })}
      </ul>
        </>
      )}
    </Card>
  );
}
