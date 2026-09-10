import { Check, Circle, CircleAlert, Play } from 'lucide-react';

export type InviteStatus = 'complete' | 'active' | 'waiting' | 'attention';

const STATUS: Record<
  InviteStatus,
  { word: string; icon: React.ReactNode; className: string }
> = {
  complete: {
    word: 'Done',
    icon: <Check className="h-3.5 w-3.5" aria-hidden />,
    className: 'text-success-ink',
  },
  active: {
    word: 'In progress',
    icon: <Play className="h-3 w-3" aria-hidden />,
    className: 'text-ink',
  },
  waiting: {
    word: 'Waiting',
    icon: <Circle className="h-3 w-3" aria-hidden />,
    className: 'text-muted-foreground',
  },
  attention: {
    word: 'Needs you',
    icon: <CircleAlert className="h-3.5 w-3.5" aria-hidden />,
    className: 'text-danger-ink',
  },
};

/**
 * Status = icon + word + ink token. Never color alone (DESIGN_SYSTEM v2).
 */
export function InviteStatusChip({ status }: { status: InviteStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 ${s.className}`}>
      {s.icon}
      <span className="label-micro">{s.word}</span>
    </span>
  );
}
