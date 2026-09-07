'use client';

import { useEffect, useRef } from 'react';
import { Bell, Clipboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  trackPendingNudgeBannerCta,
  trackPendingNudgeBannerShown,
  type PendingNudgeCliff,
  type PendingNudgeSurface,
} from '@/lib/analytics/pending-nudge-events';

interface PendingNudgeBannerProps {
  accessRequestId: string;
  accessRequestToken: string;
  clientName: string;
  cliff: PendingNudgeCliff;
  surface: PendingNudgeSurface;
  copied?: boolean;
  reminderCopied?: boolean;
  onCopyLink: () => void;
  onSendReminder: () => void;
  onDismiss: () => void;
}

function cliffMessage(cliff: PendingNudgeCliff, clientName: string): string {
  if (cliff === '72h') {
    return `${clientName} is still pending after 3 days. Follow up with a reminder or resend the link.`;
  }

  return `${clientName} is still pending after 24 hours. Follow up with a reminder or resend the link.`;
}

export function PendingNudgeBanner({
  accessRequestId,
  accessRequestToken,
  clientName,
  cliff,
  surface,
  copied = false,
  reminderCopied = false,
  onCopyLink,
  onSendReminder,
  onDismiss,
}: PendingNudgeBannerProps) {
  const hasTrackedShown = useRef(false);

  useEffect(() => {
    if (hasTrackedShown.current) {
      return;
    }

    hasTrackedShown.current = true;
    trackPendingNudgeBannerShown({
      access_request_id: accessRequestId,
      access_request_token: accessRequestToken,
      cliff,
      surface,
    });
  }, [accessRequestId, accessRequestToken, cliff, surface]);

  const handleCopyLink = () => {
    trackPendingNudgeBannerCta({
      access_request_id: accessRequestId,
      access_request_token: accessRequestToken,
      cliff,
      surface,
      cta: 'copy_link',
    });
    onCopyLink();
  };

  const handleSendReminder = () => {
    trackPendingNudgeBannerCta({
      access_request_id: accessRequestId,
      access_request_token: accessRequestToken,
      cliff,
      surface,
      cta: 'send_reminder',
    });
    onSendReminder();
  };

  const handleDismiss = () => {
    trackPendingNudgeBannerCta({
      access_request_id: accessRequestId,
      access_request_token: accessRequestToken,
      cliff,
      surface,
      cta: 'dismiss',
    });
    onDismiss();
  };

  return (
    <div
      className="rounded-lg border border-coral/40 bg-coral/10 p-4"
      role="status"
      aria-live="polite"
      data-testid={`pending-nudge-banner-${cliff}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Pending invite needs follow-up</p>
          <p className="mt-1 text-sm text-muted-foreground">{cliffMessage(cliff, clientName)}</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-ink"
          aria-label="Dismiss pending invite follow-up banner"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Clipboard className="h-4 w-4" />}
          onClick={handleCopyLink}
        >
          {copied ? 'Copied' : 'Copy Link'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Bell className="h-4 w-4" />}
          onClick={handleSendReminder}
          aria-label="Send reminder to client"
        >
          {reminderCopied ? 'Link copied — send when ready' : 'Send Reminder'}
        </Button>
      </div>
    </div>
  );
}
