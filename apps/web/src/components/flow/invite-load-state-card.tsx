'use client';

import { RefreshCw } from 'lucide-react';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { Button } from '@/components/ui';
import { InviteSupportCard } from './invite-support-card';

export type InviteLoadState = 'loading' | 'delayed' | 'timeout' | 'error';

interface InviteLoadStateCardProps {
  phase: InviteLoadState;
  message: string;
  onRetry: () => void;
  supportHref?: string;
}

export function InviteLoadStateCard({
  phase,
  message,
  onRetry,
  supportHref = '/contact',
}: InviteLoadStateCardProps) {
  if (phase === 'loading' || phase === 'delayed') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <LogoSpinner size="lg" className="mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {phase === 'loading'
              ? 'Loading your authorization request...'
              : 'Still loading... this may take a few more seconds.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md border-2 border-black bg-card p-8 text-center shadow-brutalist">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {phase === 'timeout' ? 'Still working on it' : 'This link is not working'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <p className="mt-2 text-sm leading-6 text-ink">
          Nothing has been shared yet. You can safely close this page and try again later.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="primary" onClick={onRetry} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Try again
          </Button>
        </div>
        <InviteSupportCard
          href={supportHref}
          title="Need a new link?"
          description="Contact your agency or support if this authorization request is still unavailable after retrying."
          linkLabel="Contact support"
          className="mt-6 text-left"
        />
      </div>
    </div>
  );
}
