'use client';

import { Check, Clock, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AgentOperationRecord } from '@/lib/api/agents';
import { PLATFORM_NAMES, type Platform } from '@agency-platform/shared';

const terminalStates = new Set(['approved', 'declined', 'expired', 'canceled', 'executing', 'succeeded', 'failed_terminal']);

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function ApprovalCard({ operation, onDecision, isSubmitting = false }: {
  operation: AgentOperationRecord;
  onDecision: (decision: 'approved' | 'declined') => Promise<void> | void;
  isSubmitting?: boolean;
}) {
  const preview = operation.approvalPreview;
  const actionable = operation.status === 'pending_approval' && !terminalStates.has(operation.status);
  if (!preview) return <div role="alert" className="rounded-xl border border-coral/30 bg-card p-6">This operation has no approval preview and cannot be decided.</div>;
  return (
    <article className="rounded-xl border border-border bg-card p-6" aria-labelledby="approval-heading">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-lg bg-amber-100 text-amber-800"><ShieldAlert className="h-5 w-5" /></span><div>
        <p className="text-sm font-medium text-muted-foreground">Agent approval</p>
        <h1 id="approval-heading" className="text-2xl font-semibold">Review before AuthHub acts</h1>
      </div></div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agency</dt><dd className="mt-1 font-medium">{preview.agency.name}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</dt><dd className="mt-1 font-medium">{preview.client?.name ?? 'No client target'}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requesting agent</dt><dd className="mt-1 font-medium">{preview.requestingAgent.displayName}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval expires</dt><dd className="mt-1 flex items-center gap-2"><Clock className="h-4 w-4" />{formatDate(preview.expiresAt)}</dd></div>
      </dl>
      <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4"><h2 className="font-semibold">External effect</h2><p className="mt-1 text-sm">{preview.externalEffect}</p></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><h2 className="text-sm font-semibold">Platforms</h2><ul className="mt-2 flex flex-wrap gap-2">{preview.platforms.map((platform) => <li key={platform} className="rounded-md border border-border px-2 py-1 text-xs">{PLATFORM_NAMES[platform as Platform] ?? humanize(platform)}</li>)}</ul></div>
        <div><h2 className="text-sm font-semibold">Requested access</h2><ul className="mt-2 flex flex-wrap gap-2">{preview.permissions.map((permission) => <li key={permission} className="rounded-md border border-border px-2 py-1 text-xs">{humanize(permission.replace(':', ' '))}</li>)}</ul></div>
      </div>
      {preview.changes.length > 0 && <div className="mt-5"><h2 className="text-sm font-semibold">Changes from current state</h2><ul className="mt-2 divide-y divide-border rounded-lg border border-border">{preview.changes.map((change) => <li key={change.field} className="grid gap-1 p-3 text-sm sm:grid-cols-3"><span className="font-medium">{change.field}</span><span className="text-muted-foreground line-through">{change.before ?? 'Not set'}</span><span>{change.after ?? 'Removed'}</span></li>)}</ul></div>}
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-sm" aria-live="polite">Current status: <strong>{operation.status.replaceAll('_', ' ')}</strong></p>
        {actionable ? <div className="mt-4 flex flex-col gap-3 sm:flex-row"><Button variant="primary" isLoading={isSubmitting} disabled={isSubmitting} onClick={() => onDecision('approved')} leftIcon={<Check className="h-4 w-4" />}>Approve and allow execution</Button><Button variant="secondary" disabled={isSubmitting} onClick={() => onDecision('declined')} leftIcon={<X className="h-4 w-4" />}>Decline</Button></div> : <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">This operation is no longer awaiting a decision.</p>}
      </div>
    </article>
  );
}
