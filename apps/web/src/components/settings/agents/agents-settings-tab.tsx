'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { getDocsUrl } from '@/lib/docs-url';
import { createAgentGrant, listAgentGrants, revokeAgentGrant, updateAgentGrant } from '@/lib/api/agents';
import type { AgentPermission } from '@agency-platform/shared';
import { Button } from '@/components/ui/button';
import { SettingsGroup, SettingsRow } from '../settings-row';
import { AgentGrantCard } from './agent-grant-card';

export function AgentsSettingsTab() {
  const { userId, orgId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const principalClerkId = orgId || userId;
  const { copied, copy } = useCopyToClipboard(1500);
  const endpoint = `${getApiBaseUrl()}/mcp`;
  const pendingOauthClientId = searchParams.get('connect');
  const agencyQuery = useQuery({
    queryKey: ['settings-agents-agency', principalClerkId], enabled: Boolean(principalClerkId),
    queryFn: async () => (await authorizedApiFetch<{ data: Array<{ id: string; name: string }> }>(`/api/agencies?clerkUserId=${encodeURIComponent(principalClerkId as string)}`, { getToken })).data[0] ?? null,
  });
  const agencyId = agencyQuery.data?.id;
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

  const grants = grantsQuery.data ?? [];
  const showEmpty = !grantsQuery.isLoading && !grantsQuery.isError && grants.length === 0;

  return (
    <div className="space-y-10">
      {/* The one dark surface on this view: the MCP endpoint strip. */}
      <div className="ink-panel p-6">
        <span className="label-micro block">MCP endpoint</span>
        <p className="mt-2 break-all text-sm">{endpoint}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={endpoint}
            className="label-micro inline-flex min-h-[44px] items-center"
            onClick={(event) => {
              event.preventDefault();
              void copyEndpoint();
            }}
          >
            {copied ? 'Copied' : 'Copy endpoint'}
          </a>
          <span className="label-nano">Provider sign-in and client authorization always remain human-only.</span>
        </div>
      </div>

      {pendingOauthClientId && agencyId && (
        <SettingsGroup
          title="Approve this personal agent?"
          description="A personal agent is asking for the conservative onboarding profile. Dispatches still require a separate approval."
        >
          <SettingsRow
            label="OAuth client"
            description="The client id the agent presented when it signed in."
          >
            <code className="break-all text-sm">{pendingOauthClientId}</code>
          </SettingsRow>
          <SettingsRow
            label="Requested permissions"
            description="You can narrow these from the agent's row after approval."
          >
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
              <li>Read agency setup, clients, templates, requests, and operation status</li>
              <li>Start human connection handoffs</li>
              <li>Prepare onboarding requests for your approval</li>
            </ul>
          </SettingsRow>
          <SettingsRow label="Decision" description="Approval takes effect immediately.">
            <Button
              variant="brutalist"
              disabled={connectMutation.isPending}
              onClick={() => connectMutation.mutate()}
            >
              {connectMutation.isPending ? 'Approving…' : 'Approve agent'}
            </Button>
            {connectMutation.isError && (
              <p role="alert" className="mt-3 text-sm text-danger-ink">
                This agent could not be connected. Confirm your agency is allowlisted.
              </p>
            )}
          </SettingsRow>
        </SettingsGroup>
      )}

      <SettingsGroup
        title="Connected agents"
        description="Point a compatible personal agent at the endpoint above. You will sign in and approve its agency permissions before it can read anything."
      >
        {grantsQuery.isLoading && (
          <div role="status" className="py-5">
            <span className="sr-only">Loading connected agents…</span>
            <div className="h-5 w-48 animate-pulse bg-muted" aria-hidden="true" />
            <div className="mt-3 h-4 w-72 animate-pulse bg-muted" aria-hidden="true" />
          </div>
        )}
        {grantsQuery.isError && (
          <p role="alert" className="py-5 text-sm text-danger-ink">
            Connected agents are unavailable. The feature may not be enabled for this agency.
          </p>
        )}
        {showEmpty && (
          <SettingsRow
            label="No agents connected"
            description="Until you approve one, no agent can read or prepare anything for this workspace."
          >
            <a
              href={getDocsUrl('/agents')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-danger-ink"
            >
              How to connect an agent
            </a>
          </SettingsRow>
        )}
        {grants.map((grant) => (
          <div key={grant.id} className="py-5 hairline-b last:border-b-0">
            <AgentGrantCard
              grant={grant}
              isRevoking={revokeMutation.isPending && revokeMutation.variables === grant.id}
              isUpdating={updateMutation.isPending && updateMutation.variables?.grantId === grant.id}
              onRevoke={(grantId) => revokeMutation.mutateAsync(grantId).then(() => undefined)}
              onUpdate={(grantId, input) => updateMutation.mutateAsync({ grantId, ...input }).then(() => undefined)}
            />
          </div>
        ))}
        {updateMutation.isError && <p role="alert" className="mt-3 text-sm text-danger-ink">The agent permissions could not be updated. Try again.</p>}
        {revokeMutation.isError && <p role="alert" className="mt-3 text-sm text-danger-ink">The agent could not be revoked. Try again.</p>}
      </SettingsGroup>
    </div>
  );
}
