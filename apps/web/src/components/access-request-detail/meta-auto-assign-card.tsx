'use client';

import { useState } from 'react';
import { Button, Card, StatusBadge } from '@/components/ui';
import type { MetaAutoAssignResult } from '@agency-platform/shared';

interface MetaAutoAssignCardProps {
  results: MetaAutoAssignResult[];
  partnerVerified: boolean;
  autoAssignEnabled: boolean;
  onRunAutoAssign?: () => Promise<string | null>;
}

const STATUS_LABELS: Record<MetaAutoAssignResult['status'], string> = {
  verified: 'Team can work',
  failed: 'Assignment failed',
  skipped: 'Skipped',
};

function badgeVariant(status: MetaAutoAssignResult['status']) {
  if (status === 'verified') return 'success' as const;
  return 'warning' as const;
}

function formatValue(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function MetaAutoAssignCard({
  results,
  partnerVerified,
  autoAssignEnabled,
  onRunAutoAssign,
}: MetaAutoAssignCardProps) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!autoAssignEnabled && results.length === 0) {
    return null;
  }

  const run = async () => {
    if (!onRunAutoAssign) return;
    setRunning(true);
    setMessage(null);
    try {
      const error = await onRunAutoAssign();
      setMessage(error ?? 'Auto-Assign finished. Review team assignment results below.');
    } catch {
      setMessage('Auto-Assign could not complete. Try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-black/10">
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-semibold text-ink">Team assignment (Auto-Assign)</h2>
        <p className="text-sm text-muted-foreground">
          Partner share proves the agency Business Portfolio received access. Auto-Assign is a separate step so your
          people and system users can work in Meta — it never substitutes for Partner share.
        </p>
      </div>

      <div className="space-y-4 px-6 py-4">
        {!partnerVerified ? (
          <p className="text-sm text-muted-foreground">
            Complete verified Partner share or Check access on ad accounts before running Auto-Assign.
          </p>
        ) : null}

        {onRunAutoAssign ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={running || !partnerVerified || !autoAssignEnabled}
            isLoading={running}
            onClick={() => void run()}
          >
            {running ? 'Assigning team…' : 'Run Auto-Assign'}
          </Button>
        ) : null}

        {message ? (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}

        {results.length > 0 ? (
          <ul className="divide-y divide-border rounded-[1rem] border border-border">
            {results.map((result) => (
              <li key={`${result.assetId}:${result.recipientType}:${result.recipientId}`} className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">{result.assetName || result.assetId}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatValue(result.assetKind)} · {formatValue(result.recipientType)}:{' '}
                      {result.recipientName || result.recipientId}
                    </p>
                  </div>
                  <StatusBadge badgeVariant={badgeVariant(result.status)}>
                    {STATUS_LABELS[result.status]}
                  </StatusBadge>
                </div>
                {result.errorMessage ? (
                  <p className="mt-2 text-sm text-danger-ink">{result.errorMessage}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No Auto-Assign attempts yet.</p>
        )}
      </div>
    </Card>
  );
}
