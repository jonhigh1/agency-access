import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Homepage section labels alternate ink and coral in reading order. */
export function SectionBadge({ children, variant, icon: Icon }: {
  children: React.ReactNode;
  variant: 'ink' | 'coral';
  icon: LucideIcon;
}) {
  return (
    <div
      data-section-badge={variant}
      className={cn(
        'inline-flex items-center gap-2 rounded-none border-2 border-ink px-4 sm:px-6 py-2 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-brutalist mb-6 sm:mb-8',
        variant === 'ink' ? 'bg-ink text-paper' : 'bg-coral text-ink',
      )}
    >
      <Icon size={14} className="shrink-0" aria-hidden="true" />
      {children}
    </div>
  );
}
