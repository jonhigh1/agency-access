/**
 * SuccessLinkCard
 *
 * Pending-state card for the generated access link after first link creation.
 * Primary actions: copy link and email the client.
 */

'use client';

import { useCallback } from 'react';
import { Clock, Copy, Mail, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui';

export interface SuccessLinkCardProps {
  link: string;
  clientName: string;
  platformCount: number;
  onCopy?: () => void;
  onEmail?: () => void;
}

export function SuccessLinkCard({
  link,
  clientName,
  platformCount,
  onCopy,
  onEmail,
}: SuccessLinkCardProps) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = useCallback(() => copy(link, onCopy), [copy, link, onCopy]);

  const handleEmail = useCallback(() => {
    if (onEmail) {
      onEmail();
      return;
    }

    const subject = encodeURIComponent(`Access Request for ${clientName}`);
    const body = encodeURIComponent(
      `Hi ${clientName},\n\nWhen you're ready, use this secure link to authorize platform access. Connected when they finish Google.\n\n${link}\n\nThanks!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }, [link, clientName, onEmail]);

  return (
    <div className="rounded-lg border-2 border-black bg-card p-8 shadow-brutalist">
      <div className="flex items-start gap-4 mb-6">
        <div className="h-12 w-12 rounded-full border border-coral/30 bg-coral/10 flex items-center justify-center flex-shrink-0">
          <Clock className="h-6 w-6 text-danger-ink" />
        </div>
        <div>
          <p className="label-micro text-muted-foreground mb-1">Status</p>
          <h2 className="text-2xl font-bold text-ink font-display mb-1">Pending</h2>
          <p className="text-sm text-muted-foreground">
            Waiting on {clientName} to authorize {platformCount} platform
            {platformCount === 1 ? '' : 's'}. Connected when they finish Google.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-paper p-4 mb-6">
        <p className="label-micro mb-2 text-muted-foreground">Authorization link</p>
        <code className="font-mono text-sm text-ink break-all">{link}</code>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={handleCopy} leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
          {copied ? 'Copied' : 'Copy Link'}
        </Button>
        <Button variant="primary" onClick={handleEmail} leftIcon={<Mail className="h-4 w-4" />}>
          Email Client
        </Button>
      </div>
    </div>
  );
}
