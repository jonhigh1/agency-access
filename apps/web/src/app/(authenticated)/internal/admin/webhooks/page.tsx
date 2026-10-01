'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Webhook } from 'lucide-react';
import { AdminTableShell } from '@/components/internal-admin';
import { SingleSelect } from '@/components/ui';
import {
  WebhookDeliveryInspector,
  WebhookStatusBadge,
} from '@/components/settings/webhooks';
import {
  useInternalAdminWebhookDetail,
  useInternalAdminWebhookEndpoints,
} from '@/lib/query/internal-admin';

const PAGE_SIZE = 50;

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function InternalAdminWebhooksPage() {
  const [status, setStatus] = useState<'' | 'active' | 'disabled'>('');
  const [search, setSearch] = useState('');
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

  const params = useMemo(() => ({
    status: status || undefined,
    search: search.trim() || undefined,
    limit: PAGE_SIZE,
  }), [search, status]);

  const { data, isLoading, error } = useInternalAdminWebhookEndpoints(params);

  useEffect(() => {
    if (!data || data.length === 0) {
      setSelectedAgencyId(null);
      return;
    }

    setSelectedAgencyId((current) => (
      current && data.some((endpoint) => endpoint.agencyId === current)
        ? current
        : data[0].agencyId
    ));
  }, [data]);

  const selectedEndpoint = useMemo(
    () => data?.find((endpoint) => endpoint.agencyId === selectedAgencyId) ?? null,
    [data, selectedAgencyId]
  );

  const {
    data: webhookDetail,
    isLoading: isLoadingDetail,
    error: detailError,
  } = useInternalAdminWebhookDetail(selectedEndpoint?.agencyId ?? null, 20);

  useEffect(() => {
    const firstDeliveryId = webhookDetail?.deliveries[0]?.id ?? null;
    setSelectedDeliveryId(firstDeliveryId);
  }, [webhookDetail?.deliveries]);

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
          <h1 className="font-display text-2xl font-semibold text-ink">Webhook Support</h1>
          <p className="text-sm text-danger-ink mt-2">
            {error instanceof Error ? error.message : 'Unable to load webhook support data.'}
          </p>
        </div>
      </div>
    );
  }

  const endpoints = data ?? [];
  const hasEndpoints = endpoints.length > 0;
  const hasSelectedFailure = Boolean(
    selectedEndpoint?.failureCount || selectedEndpoint?.lastFailedAt
  );

  return (
    <div className="flex-1 bg-paper p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">Webhook Support</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Search agency endpoints and inspect recent delivery attempts.
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <a href="/internal/admin" className="text-muted-foreground hover:text-foreground">Overview</a>
            <a href="/internal/admin/agencies" className="text-muted-foreground hover:text-foreground">Agencies</a>
            <a href="/internal/admin/subscriptions" className="text-muted-foreground hover:text-foreground">Subscriptions</a>
            <a href="/internal/admin/webhooks" className="text-ink font-semibold">Webhooks</a>
            <a href="/internal/admin/affiliates" className="text-muted-foreground hover:text-foreground">Affiliates</a>
          </nav>
        </header>

        <AdminTableShell
          title="Webhook Endpoints"
          description={`${endpoints.length} endpoint${endpoints.length === 1 ? '' : 's'} loaded`}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <label htmlFor="webhook-search" className="sr-only">Search webhook endpoints by agency name or email</label>
                <input
                  id="webhook-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search agency name or email"
                  className="min-h-[44px] px-3 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <SingleSelect
                options={[
                  { value: '', label: 'All status' },
                  { value: 'active', label: 'Active' },
                  { value: 'disabled', label: 'Disabled' },
                ]}
                value={status}
                onChange={(v) => setStatus(v as '' | 'active' | 'disabled')}
                placeholder="All status"
                ariaLabel="Filter by status"
                triggerClassName="h-10 min-w-[120px] px-3 rounded-md border border-border bg-background text-sm"
              />
            </div>
          )}
        >
          {!hasEndpoints ? (
            <div className="rounded-2xl border border-dashed border-border bg-paper/60 p-5 text-sm text-muted-foreground">
              No webhook endpoints matched the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Agency</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Events</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Failures</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Last Delivered</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((endpoint) => (
                    <tr key={endpoint.id} className="border-b border-border/50">
                      <td className="py-3">
                        <p className="text-ink font-medium">{endpoint.agency.name}</p>
                        <p className="text-xs text-muted-foreground">{endpoint.agency.email}</p>
                      </td>
                      <td className="py-3">
                        <WebhookStatusBadge status={endpoint.status} />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {endpoint.subscribedEvents.slice(0, 2).map((eventType) => (
                            <code
                              key={eventType}
                              className="rounded bg-ink px-2 py-1 text-[11px] font-semibold text-paper"
                            >
                              {eventType}
                            </code>
                          ))}
                          {endpoint.subscribedEvents.length > 2 ? (
                            <span className="text-xs text-muted-foreground">
                              +{endpoint.subscribedEvents.length - 2} more
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 text-right text-ink tabular-nums">{endpoint.failureCount}</td>
                      <td className="py-3 text-right text-ink">{formatDate(endpoint.lastDeliveredAt)}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedAgencyId(endpoint.agencyId)}
                          className="text-danger-ink hover:text-danger-ink font-semibold"
                        >
                          Inspect
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
          title="Webhook Detail"
          description={selectedEndpoint ? `${selectedEndpoint.agency.name} · ${selectedEndpoint.url}` : 'Select an endpoint'}
        >
          {!selectedEndpoint ? (
            <div className="rounded-2xl border border-dashed border-border bg-paper/60 p-5 text-sm text-muted-foreground">
              Select an endpoint to inspect delivery attempts.
            </div>
          ) : isLoadingDetail ? (
            <div className="py-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
            </div>
          ) : detailError ? (
            <div className="rounded-2xl border border-coral/30 bg-coral/5 p-5 text-sm text-danger-ink">
              {detailError instanceof Error ? detailError.message : 'Unable to load webhook detail.'}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
                <div className="rounded-2xl border border-border bg-card/60 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Webhook className="h-4 w-4 text-danger-ink" />
                    Endpoint summary
                  </div>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Destination</dt>
                      <dd className="mt-1 break-all text-ink">{selectedEndpoint.url}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Secret Ref</dt>
                      <dd className="mt-1 font-mono text-ink">
                        {selectedEndpoint.secretLastFour ? `••••${selectedEndpoint.secretLastFour}` : 'Not available'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Last Failure</dt>
                      <dd className="mt-1 text-ink">{formatDate(selectedEndpoint.lastFailedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Updated</dt>
                      <dd className="mt-1 text-ink">{formatDate(selectedEndpoint.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-2xl border border-border bg-gradient-to-br from-coral/10 via-paper to-warning/10 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <AlertTriangle className="h-4 w-4 text-danger-ink" />
                    Support triage
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <li>No endpoint + no deliveries: agency never configured webhooks.</li>
                    <li>Endpoint + no deliveries: no event generated yet or queue never ran.</li>
                    <li>Pending/failed deliveries: inspect response and retry posture.</li>
                    <li>Delivered entries with 4xx/5xx: endpoint accepted the request but app logic failed.</li>
                  </ul>
                  {hasSelectedFailure ? (
                    <p className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-ink">
                      This endpoint has recent failures. Inspect the latest delivery and confirm the receiver returns `2xx`.
                    </p>
                  ) : null}
                </div>
              </div>

              <WebhookDeliveryInspector
                deliveries={webhookDetail?.deliveries ?? []}
                selectedDeliveryId={selectedDeliveryId}
                onInspect={setSelectedDeliveryId}
              />
            </div>
          )}
        </AdminTableShell>
      </div>
    </div>
  );
}
