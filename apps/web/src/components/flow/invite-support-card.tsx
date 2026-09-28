'use client';

import { LifeBuoy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InviteSupportCardProps {
  href?: string;
  title?: string;
  description?: string;
  linkLabel?: string;
  className?: string;
}

export function InviteSupportCard({
  href = '/contact',
  title = 'Need help?',
  description = 'Reach out if the link expires, the page stalls, or anything in the request looks wrong.',
  linkLabel = 'Visit support',
  className,
}: InviteSupportCardProps) {
  return (
    <div className={cn('border border-border bg-card p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-paper text-muted-foreground">
          <LifeBuoy className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          <a href={href} className="mt-3 inline-block text-sm font-semibold text-danger-ink hover:text-danger-ink">
            {linkLabel}
          </a>
        </div>
      </div>
    </div>
  );
}

export type { InviteSupportCardProps };
