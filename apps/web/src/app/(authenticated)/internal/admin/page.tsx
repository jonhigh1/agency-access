'use client';

import { LogoSpinner } from '@/components/ui/logo-spinner';
import { AdminStatCard, AdminTableShell } from '@/components/internal-admin';
import { useInternalAdminOverview } from '@/lib/query/internal-admin';

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function formatUsd(value: number) {
  return USD_FORMATTER.format(value);
}

export default function InternalAdminOverviewPage() {
  const { data, isLoading, error } = useInternalAdminOverview();

  if (isLoading) {
    return (
      <div className="flex-1 bg-paper p-8 flex items-center justify-center">
        <LogoSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-paper p-8">
        <div className="max-w-6xl mx-auto clean-card p-6 border border-coral/40 bg-coral/5">
          <h1 className="font-display text-2xl font-semibold text-ink">Internal Admin</h1>
          <p className="text-sm text-danger-ink mt-2">
            {error instanceof Error ? error.message : 'Unable to load internal admin overview.'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex-1 bg-paper p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">Internal Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Cross-agency operational overview</p>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <a href="/internal/admin" className="text-ink font-semibold">Overview</a>
            <a href="/internal/admin/agencies" className="text-muted-foreground hover:text-foreground">Agencies</a>
            <a href="/internal/admin/subscriptions" className="text-muted-foreground hover:text-foreground">Subscriptions</a>
            <a href="/internal/admin/webhooks" className="text-muted-foreground hover:text-foreground">Webhooks</a>
            <a href="/internal/admin/affiliates" className="text-muted-foreground hover:text-foreground">Affiliates</a>
          </nav>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <AdminStatCard label="Booked MRR" value={formatUsd(data.mrr.booked)} />
          <AdminStatCard label="Active Subs" value={data.subscriptions.active} />
          <AdminStatCard label="Trialing" value={data.subscriptions.trialing} />
          <AdminStatCard label="Past Due" value={data.subscriptions.pastDue} />
          <AdminStatCard label="Collected 30d" value={formatUsd(data.mrr.collectedLast30Days)} />
        </section>

        <AdminTableShell
          title="Top Usage Agencies"
          description="Sorted by combined usage counters."
          actions={
            <a
              href="/internal/admin/agencies"
              className="text-sm font-semibold text-danger-ink hover:text-danger-ink"
            >
              View all agencies
            </a>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Agency</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Tier</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Onboards</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Audits</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Seats</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.topUsageAgencies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No usage data available.
                    </td>
                  </tr>
                ) : (
                  data.topUsageAgencies.map((agency) => (
                    <tr key={agency.agencyId} className="border-b border-border/50">
                      <td className="py-3">
                        <p className="text-ink font-medium">{agency.name}</p>
                        <p className="text-xs text-muted-foreground">{agency.email}</p>
                      </td>
                      <td className="py-3 text-ink">{agency.tier || 'STARTER'}</td>
                      <td className="py-3 text-right text-ink tabular-nums">{agency.clientOnboards}</td>
                      <td className="py-3 text-right text-ink tabular-nums">{agency.platformAudits}</td>
                      <td className="py-3 text-right text-ink tabular-nums">{agency.teamSeats}</td>
                      <td className="py-3 text-right text-ink tabular-nums">{agency.usageScore}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      </div>
    </div>
  );
}
