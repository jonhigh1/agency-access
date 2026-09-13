'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Unplug,
} from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button } from '@/components/ui';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  type OffboardingItem,
  type OffboardingItemStatus,
  type OffboardingRun,
  type PrepareOffboardingResponse,
  prepareOffboarding,
  confirmOffboarding,
  getOffboardingRun,
  retryOffboardingRun,
  attestOffboardingItem,
} from '@/lib/api/client-offboarding';

type ItemClassification = OffboardingItem['classification'];
type ItemStatus = OffboardingItemStatus['status'];
type RunStatus = OffboardingRun['status'];

const CLASSIFICATION_BADGE: Record<ItemClassification, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  eligible_automatic: { label: 'Automatic', variant: 'success' },
  manual_action_required: { label: 'Manual action required', variant: 'warning' },
  reconnect_required: { label: 'Reconnect required', variant: 'warning' },
  not_safely_reversible: { label: 'Not safely reversible', variant: 'warning' },
};

function ClassificationBadge({ classification }: { classification: ItemClassification }) {
  const config = CLASSIFICATION_BADGE[classification];
  return <StatusBadge badgeVariant={config.variant} size="sm">{config.label}</StatusBadge>;
}

const ITEM_STATUS_BADGE: Record<ItemStatus, { label: string; variant: 'success' | 'warning' | 'default'; icon: React.ReactNode }> = {
  pending: { label: 'Pending', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  revoked_verified: { label: 'Revoked & verified', variant: 'success', icon: <CheckCircle2 className="h-3 w-3" /> },
  already_absent: { label: 'Already absent', variant: 'success', icon: <CheckCircle2 className="h-3 w-3" /> },
  awaiting_client_approval: { label: 'Pending approval', variant: 'warning', icon: <Clock className="h-3 w-3" /> },
  manual_action_required: { label: 'Manual action required', variant: 'warning', icon: <AlertCircle className="h-3 w-3" /> },
  reconnect_required: { label: 'Reconnect required', variant: 'warning', icon: <AlertCircle className="h-3 w-3" /> },
  not_safely_reversible: { label: 'Not safely reversible', variant: 'warning', icon: <ShieldAlert className="h-3 w-3" /> },
  failed_retryable: { label: 'Failed (retryable)', variant: 'warning', icon: <AlertCircle className="h-3 w-3" /> },
  failed_terminal: { label: 'Failed', variant: 'default', icon: <AlertCircle className="h-3 w-3" /> },
  attestation_recorded: { label: 'Attested', variant: 'success', icon: <CheckCircle2 className="h-3 w-3" /> },
};

function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const config = ITEM_STATUS_BADGE[status] ?? ITEM_STATUS_BADGE.pending;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm font-mono font-medium uppercase tracking-wider border bg-teal/10 text-success-ink border-teal/30 px-2 py-0.5 text-xs">
      {config.icon}
      {config.label}
    </span>
  );
}

function ItemStatusIcon({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'revoked_verified':
    case 'already_absent':
    case 'attestation_recorded':
      return <CheckCircle2 className="h-4 w-4 text-success-ink" />;
    case 'awaiting_client_approval':
      return <Clock className="h-4 w-4 text-warning" />;
    case 'failed_retryable':
      return <AlertCircle className="h-4 w-4 text-danger-ink" />;
    case 'failed_terminal':
      return <AlertCircle className="h-4 w-4 text-danger-ink" />;
    case 'not_safely_reversible':
      return <ShieldAlert className="h-4 w-4 text-danger-ink" />;
    case 'pending':
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function isTerminalRunStatus(status: RunStatus): boolean {
  return ['completed', 'completed_with_manual_follow_up', 'incomplete', 'canceled'].includes(status);
}

const POLL_INTERVAL_MS = 3000;

export function GoogleOffboardingPanel({
  agencyId,
  connectionId,
  connectionLabel,
}: {
  agencyId: string;
  connectionId: string;
  connectionLabel: string;
}) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<'selection' | 'preview' | 'confirming' | 'progress' | 'receipt' | 'error'>('selection');
  const [previewData, setPreviewData] = useState<PrepareOffboardingResponse | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tokenProvider = useCallback(() => getToken(), [getToken]);
  const runQueryKey = ['offboarding-run', agencyId, connectionId, activeRunId];

  const { data: runData, error: runError } = useQuery({
    queryKey: runQueryKey,
    queryFn: () => getOffboardingRun(agencyId, connectionId, activeRunId!, tokenProvider),
    enabled: !!activeRunId,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (!run || 'error' in run) return false;
      if (isTerminalRunStatus(run.data.status)) return false;
      return POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    if (!runData) return;
    if ('error' in runData) {
      setError(runData.error.message);
      return;
    }
    const run = runData.data;
    if (isTerminalRunStatus(run.status)) {
      setPhase('receipt');
    }
  }, [runData]);

  const prepareMutation = useMutation({
    mutationFn: () => prepareOffboarding(agencyId, connectionId, tokenProvider),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      setPreviewData(result.data);
      setPhase('preview');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (capabilityToken: string) =>
      confirmOffboarding(agencyId, connectionId, capabilityToken, tokenProvider),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error.message);
        setPhase('preview');
        return;
      }
      setActiveRunId(result.data.id);
      setPhase('progress');
      queryClient.invalidateQueries({ queryKey: runQueryKey });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () =>
      retryOffboardingRun(agencyId, connectionId, activeRunId!, tokenProvider),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: runQueryKey });
    },
  });

  const attestMutation = useMutation({
    mutationFn: (itemId: string) =>
      attestOffboardingItem(agencyId, connectionId, activeRunId!, itemId, tokenProvider),
    onSuccess: (result) => {
      if ('error' in result) {
        setError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: runQueryKey });
    },
  });

  const handleBegin = () => {
    setError(null);
    prepareMutation.mutate();
  };

  const handleConfirm = () => {
    if (!previewData) return;
    setError(null);
    setPhase('confirming');
  };

  const handleConfirmExecute = () => {
    if (!previewData) return;
    confirmMutation.mutate(previewData.capabilityToken);
  };

  const handleRetry = () => {
    setError(null);
    retryMutation.mutate();
  };

  const handleAttest = (itemId: string) => {
    setError(null);
    attestMutation.mutate(itemId);
  };

  const handleReset = () => {
    setPhase('selection');
    setPreviewData(null);
    setActiveRunId(null);
    setError(null);
  };

  if (error && !prepareMutation.isPending && !confirmMutation.isPending) {
    return (
      <Card className="p-6 border-2 border-coral/30 bg-peach">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Something went wrong</p>
            <p className="text-sm text-ink/70 mt-1">{error}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3 cursor-pointer"
              onClick={handleReset}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === 'selection') {
    return (
      <Card className="p-6 border-2 border-border-hard">
        <div className="flex items-start gap-3">
          <Unplug className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink">Google Offboarding</h3>
            <p className="text-sm text-ink/60 mt-1">
              Revoke access and clean up secrets for this Google connection ({connectionLabel}).
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="mt-4 cursor-pointer"
              onClick={handleBegin}
              disabled={prepareMutation.isPending}
            >
              {prepareMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
              Begin Offboarding
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === 'preview' && previewData) {
    return (
      <Card className="p-6 border-2 border-border-hard">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Offboarding Preview — {connectionLabel}
              </h3>
              <p className="text-sm text-ink/60 mt-1">
                Review all items before confirming. This action is irreversible.
              </p>
            </div>
          </div>

          <ul className="divide-y divide-border" role="list">
            {previewData.items.map((item) => (
              <li key={item.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{item.productName}</p>
                  <p className="text-xs text-ink/60 mt-0.5">{item.description}</p>
                </div>
                <ClassificationBadge classification={item.classification} />
              </li>
            ))}
          </ul>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="cursor-pointer"
              onClick={handleReset}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="cursor-pointer"
              onClick={handleConfirm}
            >
              Confirm Offboarding
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === 'confirming' && previewData) {
    return (
      <Card className="p-6 border-2 border-coral/30 bg-peach">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Confirm Offboarding — {connectionLabel}
              </h3>
              <p className="text-sm text-ink/70 mt-1">
                This will permanently revoke access and clean up secrets for all items listed below.
                This action cannot be undone.
              </p>
            </div>
          </div>

          <ul className="divide-y divide-coral/20" role="list">
            {previewData.items.map((item) => (
              <li key={item.id} className="py-2 flex items-center gap-2">
                <span className="text-sm text-ink">{item.productName}</span>
                <ClassificationBadge classification={item.classification} />
              </li>
            ))}
          </ul>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="cursor-pointer"
              onClick={() => setPhase('preview')}
            >
              Go back
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="cursor-pointer"
              onClick={handleConfirmExecute}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
              Confirm Offboarding
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === 'progress') {
    const run = runData && !('error' in runData) ? runData.data : null;

    if (runError || (runData && 'error' in runData)) {
      const msg = (runData && 'error' in runData) ? runData.error.message : 'Failed to fetch run status';
      return (
        <Card className="p-6 border-2 border-coral/30 bg-peach">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-danger-ink flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Offboarding progress unavailable</p>
              <p className="text-sm text-ink/70 mt-1">{msg}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3 cursor-pointer"
                onClick={() => queryClient.invalidateQueries({ queryKey: runQueryKey })}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    if (!run) {
      return (
        <Card className="p-6 border-2 border-border-hard">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-ink/60">Loading offboarding status...</span>
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-6 border-2 border-border-hard">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Unplug className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Offboarding in Progress — {connectionLabel}
              </h3>
              <p className="text-xs text-ink/60 mt-0.5">
                Run ID: {run.id}
              </p>
            </div>
          </div>

          <ul className="divide-y divide-border" role="list">
            {run.items.map((item) => (
              <li key={item.id} className="py-3 flex items-center gap-3">
                {ItemStatusIcon({ status: item.status })}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-ink">
                      {item.productName}
                    </span>
                    <ItemStatusBadge status={item.status} />
                  </div>
                  {item.status === 'awaiting_client_approval' && (
                    <p className="text-xs text-ink/60 mt-0.5">
                      Pending external approval
                    </p>
                  )}
                  {item.status === 'failed_retryable' && (
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="cursor-pointer"
                        onClick={handleRetry}
                        disabled={retryMutation.isPending}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    );
  }

  if (phase === 'receipt') {
    const run = runData && !('error' in runData) ? runData.data : null;

    if (!run) {
      return (
        <Card className="p-6 border-2 border-border-hard">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-ink/60">Loading receipt...</span>
          </div>
        </Card>
      );
    }

    const runStatusLabel: Record<RunStatus, string> = {
      prepared: 'Prepared',
      awaiting_approval: 'Awaiting Approval',
      queued: 'Queued',
      executing: 'In Progress',
      receipt_pending: 'Receipt Pending',
      completed: 'Offboarding Complete',
      completed_with_manual_follow_up: 'Offboarding Complete — Follow-up Required',
      incomplete: 'Offboarding Incomplete',
      canceled: 'Canceled',
    };

    const runStatusIcon: Record<RunStatus, React.ReactNode> = {
      prepared: <Clock className="h-5 w-5 text-muted-foreground" />,
      awaiting_approval: <Clock className="h-5 w-5 text-warning" />,
      queued: <Clock className="h-5 w-5 text-warning" />,
      executing: <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />,
      receipt_pending: <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />,
      completed: <CheckCircle2 className="h-5 w-5 text-success-ink" />,
      completed_with_manual_follow_up: <CheckCircle2 className="h-5 w-5 text-warning" />,
      incomplete: <AlertCircle className="h-5 w-5 text-danger-ink" />,
      canceled: <AlertCircle className="h-5 w-5 text-muted-foreground" />,
    };

    return (
      <Card className="p-6 border-2 border-border-hard">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            {runStatusIcon[run.status]}
            <div>
              <h3 className="text-sm font-semibold text-ink">
                {runStatusLabel[run.status]} — {connectionLabel}
              </h3>
              {run.completedAt && (
                <p className="text-xs text-ink/60 mt-0.5">
                  Completed at {new Date(run.completedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <ul className="divide-y divide-border" role="list">
            {run.items.map((item) => (
              <li key={item.id} className="py-3">
                <div className="flex items-center gap-3">
                  {ItemStatusIcon({ status: item.status })}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink">
                        {item.productName}
                      </span>
                      <ItemStatusBadge status={item.status} />
                      {item.verificationMethod === 'human_reported' && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium uppercase tracking-wider rounded-sm border bg-muted/10 text-muted-foreground border-border">
                          Human-reported
                        </span>
                      )}
                    </div>
                    {item.outcome && (
                      <p className="text-xs text-ink/60 mt-0.5">{item.outcome}</p>
                    )}
                    {item.nextAction && (
                      <p className="text-xs text-ink/80 mt-0.5 font-medium">
                        Next: {item.nextAction}
                      </p>
                    )}
                    {item.secretCleanupResult && (
                      <p className="text-xs text-ink/60 mt-0.5">
                        Secret cleanup:{' '}
                        {item.secretCleanupResult === 'deleted'
                          ? 'Deleted'
                          : item.secretCleanupResult === 'already_absent'
                            ? 'Already absent'
                            : 'Failed'}
                      </p>
                    )}
                    {item.status === 'awaiting_client_approval' && (
                      <p className="text-xs text-ink/60 mt-0.5">
                        Pending external approval
                      </p>
                    )}
                  </div>
                  {item.verificationMethod === 'human_reported' &&
                    run.status === 'completed_with_manual_follow_up' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => handleAttest(item.id)}
                        disabled={attestMutation.isPending}
                      >
                        {attestMutation.isPending ? 'Recording...' : 'Attest'}
                      </Button>
                    )}
                </div>
              </li>
            ))}
          </ul>

          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="cursor-pointer"
              onClick={handleReset}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Start new offboarding
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
