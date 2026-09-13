'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Copy, ExternalLink } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useUserAgency } from '@/hooks/use-user-agency';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { createAgentGrant, listAgentGrants, revokeAgentGrant, updateAgentGrant } from '@/lib/api/agents';
import type { AgentPermission } from '@agency-platform/shared';
import { AgentGrantCard } from './agent-grant-card';

export function AgentsSettingsTab() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: agency } = useUserAgency();
  const { copied, copy } = useCopyToClipboard(1500);
  const endpoint = `${getApiBaseUrl()}/mcp`;
  const pendingOauthClientId = searchParams.get('connect');
  const agencyId = agency?.id;
  const grantsQuery = useQuery({
    queryKey: ['settings-agent-grants', agencyId], enabled: Boolean(agencyId),
    queryFn: () => listAgentGrants(agencyId as string, getToken),
  });
  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => revokeAgentGrant(agencyId as string, grantId, getToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-agent-grants', agencyId] }),
  });
  const updateMutation = useMutation({
    mutationFn: (input: { grantId: string; displayName: string; permissions: AgentPermission[] }) =>
      updateAgentGrant(agencyId as string, input.grantId, {
        displayName: input.displayName,
        permissions: input.permissions,
      }, getToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-agent-grants', agencyId] }),
  });
  const connectMutation = useMutation({
    mutationFn: () => createAgentGrant(agencyId as string, {
      oauthClientId: pendingOauthClientId as string,
      displayName: 'Personal agent',
      permissions: ['workspace:read', 'clients:read', 'templates:read', 'connections:read', 'connections:handoff', 'requests:read', 'requests:prepare', 'requests:dispatch', 'operations:read'],
    }, getToken),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-agent-grants', agencyId] });
      const params = new URLSearchParams(searchParams.toString());
      params.delete('connect');
      router.replace(`?${params.toString()}`, { scroll: false });
    },
  });
  const copyEndpoint = () => copy(endpoint);

  return (
    <section className="space-y-6" aria-labelledby="agents-heading">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3"><Bot className="mt-1 h-5 w-5 text-danger-ink" /><div>
          <h2 id="agents-heading" className="text-xl font-semibold">Personal agents</h2>
          <p className="mt-1 text-sm text-muted-foreground">Point a compatible personal agent at this endpoint. You will sign in and approve its agency permissions before it can read anything.</p>
        </div></div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-muted px-4 py-3 text-sm">{endpoint}</code>
          <button type="button" onClick={copyEndpoint} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold"><Copy className="h-4 w-4" />{copied ? 'Copied' : 'Copy endpoint'}</button>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><ExternalLink className="h-3.5 w-3.5" />Provider sign-in and client authorization always remain human-only.</p>
      </div>
      {pendingOauthClientId && agencyId && (
        <div className="rounded-xl border-2 border-coral bg-card p-6" role="region" aria-labelledby="connect-agent-heading">
          <h2 id="connect-agent-heading" className="text-lg font-semibold">Approve this personal agent?</h2>
          <p className="mt-2 text-sm text-muted-foreground">OAuth client <code>{pendingOauthClientId}</code> is requesting the conservative onboarding profile. Dispatches still require a separate approval.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm"><li>Read agency setup, clients, templates, requests, and operation status</li><li>Start human connection handoffs</li><li>Prepare onboarding requests for your approval</li></ul>
          <button type="button" disabled={connectMutation.isPending} onClick={() => connectMutation.mutate()} className="mt-4 min-h-11 rounded-lg bg-coral px-5 font-semibold text-white disabled:opacity-50">{connectMutation.isPending ? 'Connecting…' : 'Connect agent'}</button>
          {connectMutation.isError && <p role="alert" className="mt-3 text-sm text-danger-ink">This agent could not be connected. Confirm your agency is allowlisted.</p>}
        </div>
      )}
      {grantsQuery.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading connected agents…</p>}
      {grantsQuery.isError && <p role="alert" className="rounded-lg border border-coral/30 bg-coral/5 p-4 text-sm">Connected agents are unavailable. The feature may not be enabled for this agency.</p>}
      {!grantsQuery.isLoading && !grantsQuery.isError && (grantsQuery.data?.length ?? 0) === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center"><h3 className="font-semibold">No agents connected</h3><p className="mt-1 text-sm text-muted-foreground">Use the endpoint above from your personal agent to begin.</p></div>}
      <div className="space-y-3">{grantsQuery.data?.map((grant) => <AgentGrantCard
        key={grant.id}
        grant={grant}
        isRevoking={revokeMutation.isPending && revokeMutation.variables === grant.id}
        isUpdating={updateMutation.isPending && updateMutation.variables?.grantId === grant.id}
        onRevoke={(grantId) => revokeMutation.mutateAsync(grantId).then(() => undefined)}
        onUpdate={(grantId, input) => updateMutation.mutateAsync({ grantId, ...input }).then(() => undefined)}
      />)}</div>
      {updateMutation.isError && <p role="alert" className="text-sm text-danger-ink">The agent permissions could not be updated. Try again.</p>}
      {revokeMutation.isError && <p role="alert" className="text-sm text-danger-ink">The agent could not be revoked. Try again.</p>}
    </section>
  );
}
