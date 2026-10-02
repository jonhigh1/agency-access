import type { ReactNode } from 'react';

interface AffiliateMetricCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
}

export function AffiliateMetricCard({
  label,
  value,
  description,
  icon,
}: AffiliateMetricCardProps) {
  return (
    <article className="border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-ink tabular-nums sm:text-3xl">{value}</p>
        </div>
        {icon ? (
          <div className="rounded-md border border-border bg-paper p-2 text-muted-foreground">
            {icon}
          </div>
        ) : null}
      </div>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
    </article>
  );
}
