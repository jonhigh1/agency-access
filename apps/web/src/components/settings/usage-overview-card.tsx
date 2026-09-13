'use client';

/**
 * Usage overview — one row per quota metric on the General tab.
 *
 * Flat rows, no card. Links to /settings?tab=billing for the full picture.
 * `useQuota` needs an organization; a personal principal sees one row that
 * says so instead of an empty section.
 */

import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import type { TierLimits } from '@agency-platform/shared';
import { useQuota } from '@/lib/query/quota';
import { SettingsGroup, SettingsRow } from './settings-row';

type MetricKey = keyof TierLimits;

const METRICS: Array<{ key: MetricKey; label: string; description: string }> = [
  { key: 'clients', label: 'Clients', description: 'Client profiles you can create.' },
  { key: 'accessRequests', label: 'Requests', description: 'Access requests this period.' },
  { key: 'members', label: 'Members', description: 'Team members on this agency.' },
  { key: 'templates', label: 'Templates', description: 'Saved access request templates.' },
];

function UsageMeter({ used, limit }: { used: number; limit: number | 'unlimited' }) {
  if (limit === 'unlimited') {
    return <p className="font-mono text-sm text-ink">{used} used · unlimited</p>;
  }

  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barClass = percentage >= 100 ? 'bg-danger-ink' : percentage >= 80 ? 'bg-warning' : 'bg-ink';

  return (
    <div className="max-w-lg">
      <p className="font-mono text-sm text-ink">
        {used} of {limit}
      </p>
      <div className="mt-2 h-1.5 w-full bg-border" role="presentation">
        <div className={`h-full ${barClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function UsageOverviewCard() {
  const { orgId } = useAuth();
  const { data: quota, isLoading, isError } = useQuota();

  const billingLink = (
    <Link href="/settings?tab=billing" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-danger-ink">
      Manage billing
    </Link>
  );

  return (
    <SettingsGroup title="Usage" description="What this agency has used against its plan." aside={billingLink}>
      {isLoading && (
        <div className="space-y-4 py-5">
          <div className="h-4 w-48 bg-muted animate-pulse" />
          <div className="h-4 w-40 bg-muted animate-pulse" />
          <div className="h-4 w-44 bg-muted animate-pulse" />
        </div>
      )}

      {!isLoading && !orgId && (
        <SettingsRow label="Quota" description="Usage data requires an active organization context.">
          <p className="text-sm text-muted-foreground">Switch to an organization to see quota usage.</p>
        </SettingsRow>
      )}

      {!isLoading && orgId && isError && (
        <SettingsRow label="Quota">
          <p className="text-sm text-danger-ink">Failed to load usage data. Reload the page to try again.</p>
        </SettingsRow>
      )}

      {!isLoading && quota &&
        METRICS.map(({ key, label, description }) => {
          const entry = quota[key];
          if (!entry) return null;
          if (key === 'templates' && entry.limit === 'unlimited') return null;
          return (
            <SettingsRow key={key} label={label} description={description}>
              <UsageMeter used={entry.used} limit={entry.limit} />
            </SettingsRow>
          );
        })}
    </SettingsGroup>
  );
}
