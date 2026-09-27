'use client';

import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InviteTrustNoteProps {
  title?: string;
  description: string;
  className?: string;
  density?: 'default' | 'compact';
}

export function InviteTrustNote({
  title = 'You stay in control',
  description,
  className,
  density = 'default',
}: InviteTrustNoteProps) {
  const isCompact = density === 'compact';

  return (
    <div className={cn(`border border-border bg-paper/80 ${isCompact ? 'p-3' : 'p-4'}`, className)}>
      <div className={`flex items-start ${isCompact ? 'gap-2.5' : 'gap-3'}`}>
        <div
          className={`mt-0.5 flex shrink-0 items-center justify-center border border-border bg-card text-muted-foreground ${isCompact ? 'h-8 w-8' : 'h-9 w-9'}`}
        >
          <Lock className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className={`text-sm text-muted-foreground ${isCompact ? 'mt-0.5 leading-5' : 'mt-1 leading-6'}`}>{description}</p>
        </div>
      </div>
    </div>
  );
}

export type { InviteTrustNoteProps };
