'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminTableShell } from '@/components/internal-admin';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatShortDate } from '@/lib/format';
import { useInternalAdminAgencies, useInternalAdminAgencyDetail } from '@/lib/query/internal-admin';

const PAGE_SIZE = 20;

export default function InternalAdminAgenciesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const queryParams = useMemo(() => ({
    search: search.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  }), [search, page]);

  const { data, isLoading, error } = useInternalAdminAgencies(queryParams);
  const { data: selectedAgency, isLoading: isLoadingAgency } = useInternalAdminAgencyDetail(selectedAgencyId);

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
          <h1 className="font-display text-2xl font-semibold text-ink">Agency Monitoring</h1>
          <p className="text-sm text-danger-ink mt-2">
            {error instanceof Error ? error.message : 'Unable to load agencies.'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const canGoBack = page > 1;
  const canGoForward = data.items.length === PAGE_SIZE && page * PAGE_SIZE < data.total;

  return (
    <div className="flex-1 bg-paper p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">Agency Monitoring</h1>
            <p className="text-sm text-muted-foreground mt-1">Search and inspect customer agencies</p>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <a href="/internal/admin" className="text-muted-foreground hover:text-foreground">Overview</a>
            <a href="/internal/admin/agencies" className="text-ink font-semibold">Agencies</a>
            <a href="/internal/admin/subscriptions" className="text-muted-foreground hover:text-foreground">Subscriptions</a>
            <a href="/internal/admin/webhooks" className="text-muted-foreground hover:text-foreground">Webhooks</a>
            <a href="/internal/admin/affiliates" className="text-muted-foreground hover:text-foreground">Affiliates</a>
          </nav>
        </header>

        <AdminTableShell
          title="Agencies"
          description={`${data.total} total`}
          actions={(
            <div>
              <label htmlFor="agency-search" className="sr-only">Search agencies by name or email</label>
              <input
                id="agency-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name or email"
                className="min-h-[44px] px-3 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Agency</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Tier</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Members</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Created</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No agencies found.
                    </td>
                  </tr>
                ) : (
                  data.items.map((agency) => (
                    <tr key={agency.id} className="border-b border-border/50">
                      <td className="py-3">
                        <p className="text-ink font-medium">{agency.name}</p>
                        <p className="text-xs text-muted-foreground">{agency.email}</p>
                      </td>
                      <td className="py-3 text-ink">{agency.subscriptionTier || 'FREE'}</td>
                      <td className="py-3">
                        {agency.subscriptionStatus ? (
                          <StatusBadge status={agency.subscriptionStatus as any} />
                        ) : (
                          <StatusBadge badgeVariant="default">No subscription</StatusBadge>
                        )}
                      </td>
                      <td className="py-3 text-right text-ink tabular-nums">{agency.memberCount}</td>
                      <td className="py-3 text-right text-ink">
                        {formatShortDate(agency.createdAt)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedAgencyId(agency.id)}
                          className="text-danger-ink hover:text-danger-ink font-semibold"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {data.page}
            </p>
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

        {selectedAgencyId ? (
          <AdminTableShell title="Agency Detail" description={selectedAgencyId}>
            {isLoadingAgency ? (
              <div className="py-6 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : selectedAgency ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="border border-border rounded-md p-3 bg-background">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Usage</p>
                  <p className="mt-2 text-ink">Onboards: {selectedAgency.usage.clientOnboards}</p>
                  <p className="text-ink">Audits: {selectedAgency.usage.platformAudits}</p>
                  <p className="text-ink">Team Seats: {selectedAgency.usage.teamSeats}</p>
                </div>
                <div className="border border-border rounded-md p-3 bg-background">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Subscription</p>
                  <p className="mt-2 text-ink">Tier: {selectedAgency.subscription?.tier || 'FREE'}</p>
                  <p className="text-ink">Status: {selectedAgency.subscription?.status || 'No subscription'}</p>
                </div>
                <div className="border border-border rounded-md p-3 bg-background">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Members</p>
                  <p className="mt-2 text-ink">{selectedAgency.members.length} member(s)</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select an agency to inspect details.</p>
            )}
          </AdminTableShell>
        ) : null}
      </div>
    </div>
  );
}
