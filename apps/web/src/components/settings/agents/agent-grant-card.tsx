'use client';

import { useState } from 'react';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AgentGrantRecord } from '@/lib/api/agents';
import type { AgentPermission } from '@agency-platform/shared';

const permissionOptions: Array<{ value: AgentPermission; label: string }> = [
  { value: 'workspace:read', label: 'Read workspace context' },
  { value: 'agency:write', label: 'Update agency profile' },
  { value: 'clients:read', label: 'Read clients' },
  { value: 'clients:write', label: 'Create and update clients' },
  { value: 'templates:read', label: 'Read templates' },
  { value: 'connections:read', label: 'Read connection health' },
  { value: 'connections:handoff', label: 'Start human connection handoffs' },
  { value: 'requests:read', label: 'Read access requests' },
  { value: 'requests:prepare', label: 'Prepare onboarding requests' },
  { value: 'requests:dispatch', label: 'Request approved dispatches' },
  { value: 'requests:cancel', label: 'Request approved cancellations' },
  { value: 'operations:read', label: 'Read agent operations and activity' },
];

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function AgentGrantCard({ grant, onRevoke, onUpdate, isRevoking = false, isUpdating = false }: {
  grant: AgentGrantRecord;
  onRevoke: (grantId: string) => Promise<void> | void;
  onUpdate: (grantId: string, input: { displayName: string; permissions: AgentPermission[] }) => Promise<void> | void;
  isRevoking?: boolean;
  isUpdating?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [managing, setManaging] = useState(false);
  const [displayName, setDisplayName] = useState(grant.displayName);
  const [permissions, setPermissions] = useState<AgentPermission[]>(grant.permissions);
  const togglePermission = (permission: AgentPermission) => {
    setPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };
  return (
    <article className="min-w-0" aria-label={`${grant.displayName} agent connection`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{grant.displayName}</h3>
          <p className="text-sm text-muted-foreground">Last used {formatDate(grant.lastUsedAt)}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${grant.state === 'active' ? 'border-teal/30 bg-teal/10 text-success-ink' : 'border-border bg-muted/10 text-muted-foreground'}`}>{grant.state}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Granted permissions">
        {grant.permissions.map((permission) => <code key={permission} className="border border-border px-2 py-1 text-xs text-muted-foreground">{permission}</code>)}
      </div>
      {grant.state === 'active' && !confirming && !managing && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setManaging(true)}>Manage access</Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirming(true)} leftIcon={<ShieldX className="h-4 w-4" />}>Revoke access</Button>
        </div>
      )}
      {managing && (
        <form className="mt-5 space-y-4 border border-border p-4" onSubmit={async (event) => {
          event.preventDefault();
          await onUpdate(grant.id, { displayName: displayName.trim(), permissions });
          setManaging(false);
        }}>
          <div>
            <label htmlFor={`agent-name-${grant.id}`} className="text-sm font-semibold">Agent name</label>
            <input id={`agent-name-${grant.id}`} value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} required className="mt-1 min-h-11 w-full max-w-lg rounded-none border border-border bg-background px-3 text-sm" />
          </div>
          <fieldset>
            <legend className="text-sm font-semibold">Allowed capabilities</legend>
            <p className="mt-1 text-xs text-muted-foreground">Dispatches and cancellations still require a separate owner approval.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {permissionOptions.map((option) => <label key={option.value} className="flex min-h-11 items-center gap-3 border border-border bg-background px-3 py-2 text-sm">
                <input type="checkbox" checked={permissions.includes(option.value)} onChange={() => togglePermission(option.value)} />
                <span className="min-w-0"><span className="block font-medium">{option.label}</span><code className="break-all text-xs text-muted-foreground">{option.value}</code></span>
              </label>)}
            </div>
          </fieldset>
          {permissions.length === 0 && <p role="alert" className="text-sm text-danger-ink">Select at least one capability.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" isLoading={isUpdating} disabled={isUpdating || permissions.length === 0 || displayName.trim().length === 0}>Save access</Button>
            <Button type="button" size="sm" variant="ghost" disabled={isUpdating} onClick={() => { setDisplayName(grant.displayName); setPermissions(grant.permissions); setManaging(false); }}>Cancel</Button>
          </div>
        </form>
      )}
      {confirming && (
        <div className="mt-5 border border-coral/30 bg-coral/10 p-4" role="alert">
          <p className="font-medium">Revoke this agent immediately?</p>
          <p className="mt-1 text-sm text-muted-foreground">New calls will fail and pending unapproved operations will be canceled.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" isLoading={isRevoking} onClick={() => onRevoke(grant.id)}>Confirm revoke</Button>
            <Button size="sm" variant="ghost" disabled={isRevoking} onClick={() => setConfirming(false)}>Keep connected</Button>
          </div>
        </div>
      )}
    </article>
  );
}
