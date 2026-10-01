'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ApprovalCard } from '@/components/agent-operations/approval-card';
import { useUserAgency } from '@/hooks/use-user-agency';
import { decideAgentOperation, getAgentOperation } from '@/lib/api/agents';

export default function AgentOperationApprovalPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { data: agency, isLoading: isAgencyLoading, isError: isAgencyError, refetch: refetchAgency } = useUserAgency();
  const agencyId = agency?.id;
  const operationQuery = useQuery({
    queryKey: ['agent-operation', agencyId, id], enabled: Boolean(agencyId && id),
    queryFn: () => getAgentOperation(agencyId as string, id, getToken), retry: false,
  });
  const decisionMutation = useMutation({
    mutationFn: (decision: 'approved' | 'declined') => decideAgentOperation(agencyId as string, id, decision, getToken),
    onSuccess: (operation) => {
      queryClient.setQueryData(['agent-operation', agencyId, id], operation);
      void queryClient.invalidateQueries({ queryKey: ['settings-agent-grants', agencyId] });
    },
  });
  if (isAgencyLoading || operationQuery.isLoading) return <div className="mx-auto max-w-3xl p-8"><p role="status">Loading approval…</p></div>;
  if (!agencyId || isAgencyError || operationQuery.isError || !operationQuery.data) return <div className="mx-auto max-w-3xl p-8"><div role="alert" className="border border-coral/30 bg-card p-6"><h1 className="text-xl font-semibold">Approval unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This operation may belong to another agency, be unavailable, or have been removed.</p><div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="secondary" onClick={() => void Promise.all([refetchAgency(), operationQuery.refetch()])}>Try again</Button><Button type="button" variant="ghost" asChild><Link href="/settings?tab=agents">Open agent settings</Link></Button></div></div></div>;
  return <div className="mx-auto max-w-3xl p-6 sm:p-10"><ApprovalCard operation={operationQuery.data} isSubmitting={decisionMutation.isPending} onDecision={(decision) => decisionMutation.mutateAsync(decision).then(() => undefined)} />{decisionMutation.isError && <p role="alert" className="mt-4 text-sm text-danger-ink">The decision was not saved. Refresh to see the current operation state.</p>}</div>;
}
