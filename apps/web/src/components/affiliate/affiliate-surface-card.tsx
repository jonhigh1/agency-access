import type { ReactNode } from 'react';

interface AffiliateSurfaceCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AffiliateSurfaceCard({
  title,
  description,
  actions,
  children,
  className,
}: AffiliateSurfaceCardProps) {
  return (
    <section className={`overflow-hidden border border-border bg-card ${className || ''}`.trim()}>
      <div className="flex flex-col gap-3 border-b border-border bg-paper px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
