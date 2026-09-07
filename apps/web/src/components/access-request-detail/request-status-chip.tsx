import { CircleCheck, CircleDashed, CircleSlash, TriangleAlert } from 'lucide-react';

export type RequestStatus = 'pending' | 'partial' | 'completed' | 'expired' | 'revoked';

const STATUS: Record<
  RequestStatus,
  { word: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    word: 'Waiting for client',
    icon: <CircleDashed className="h-3.5 w-3.5" aria-hidden />,
    className: 'text-muted-foreground',
  },
  partial: {
    word: 'Partially authorized',
    icon: <TriangleAlert className="h-3.5 w-3.5" aria-hidden />,
    className: 'text-danger-ink',
  },
  completed: {
    word: 'Complete',
    icon: <CircleCheck className="h-3.5 w-3.5" aria-hidden />,
    className: 'text-success-ink',
  },
  expired: {
    word: 'Expired',
    icon: <CircleSlash className="h-3.5 w-3.5" aria-hidden />,
    className: 'text-danger-ink',
  },
  revoked: {
    word: 'Revoked',
    icon: <CircleSlash className="h-3.5 w-3.5" aria-hidden />,
    className: 'text-danger-ink',
  },
};

/**
 * Request lifecycle = icon + word + ink token. Never the raw enum, never color alone.
 */
export function RequestStatusChip({ status }: { status: RequestStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 ${s.className}`}>
      {s.icon}
      <span className="label-micro">{s.word}</span>
    </span>
  );
}

export function nextActionLine(status: RequestStatus, clientName: string): string {
  switch (status) {
    case 'pending':
      return `Waiting for ${clientName} to authorize the request.`;
    case 'partial':
      return `${clientName} finished some platforms. Waiting for the rest.`;
    case 'completed':
      return 'Authorization is complete. Nothing left to do.';
    case 'expired':
      return 'The link expired. Create a new request to continue.';
    case 'revoked':
      return 'This request was revoked. The link no longer works.';
  }
}
