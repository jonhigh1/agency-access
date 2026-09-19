'use client';

import { useCallback, useMemo, useState } from 'react';
import { PendingNudgeBanner } from '@/components/pending-nudge-banner';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import {
  buildInviteReminderMailto,
  trackInviteLinkCopyAndSent,
  trackInviteReminderSent,
} from '@/lib/analytics/invite-events';
import { buildInviteUrl } from '@/lib/app-url';
import {
  dismissPendingNudge,
  isPendingNudgeDismissed,
  selectPendingNudgeTargets,
  type PendingNudgeRequest,
} from '@/lib/pending-cliff';
import type { PendingNudgeSurface } from '@/lib/analytics/pending-nudge-events';

interface PendingNudgeBannersProps {
  requests: PendingNudgeRequest[];
  surface: PendingNudgeSurface;
}

function PendingNudgeBannerItem({
  target,
  surface,
  onDismiss,
}: {
  target: ReturnType<typeof selectPendingNudgeTargets>[number];
  surface: PendingNudgeSurface;
  onDismiss: (requestId: string, cliff: typeof target.cliff) => void;
}) {
  const { copied, copy } = useCopyToClipboard();
  const { copied: reminderCopied, copy: copyReminderLink } = useCopyToClipboard();
  const authorizationUrl = buildInviteUrl(target.uniqueToken);

  const handleCopyLink = useCallback(async () => {
    await copy(authorizationUrl, () => {
      trackInviteLinkCopyAndSent({
        access_request_id: target.id,
        access_request_token: target.uniqueToken,
        status: target.status,
        surface,
      });
    });
  }, [authorizationUrl, copy, surface, target.id, target.status, target.uniqueToken]);

  const handleSendReminder = useCallback(async () => {
    const clientEmail = target.clientEmail?.trim();
    if (clientEmail) {
      const expirationText = target.expiresAt
        ? new Date(target.expiresAt).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : null;
      const mailtoHref = buildInviteReminderMailto({
        clientEmail,
        clientName: target.clientName,
        authorizationUrl,
        expirationText,
      });
      trackInviteReminderSent({
        access_request_id: target.id,
        access_request_token: target.uniqueToken,
        status: target.status,
        channel: 'email',
        surface,
      });
      window.location.assign(mailtoHref);
      return;
    }

    await copyReminderLink(authorizationUrl);
    trackInviteReminderSent({
      access_request_id: target.id,
      access_request_token: target.uniqueToken,
      status: target.status,
      channel: 'copy',
      surface,
    });
  }, [authorizationUrl, copyReminderLink, surface, target]);

  const canEmailReminder = Boolean(target.clientEmail?.trim());

  return (
    <PendingNudgeBanner
      accessRequestId={target.id}
      accessRequestToken={target.uniqueToken}
      clientName={target.clientName}
      clientEmail={target.clientEmail}
      cliff={target.cliff}
      surface={surface}
      copied={copied}
      reminderCopied={canEmailReminder ? false : reminderCopied}
      onCopyLink={() => {
        void handleCopyLink();
      }}
      onSendReminder={() => {
        void handleSendReminder();
      }}
      onDismiss={() => {
        onDismiss(target.id, target.cliff);
      }}
    />
  );
}

export function PendingNudgeBanners({ requests, surface }: PendingNudgeBannersProps) {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());

  const targets = useMemo(
    () =>
      selectPendingNudgeTargets(requests, new Date(), {
        isDismissed: (requestId, cliff) => {
          const key = `${requestId}:${cliff}`;
          return dismissedKeys.has(key) || isPendingNudgeDismissed(requestId, cliff);
        },
      }),
    [dismissedKeys, requests]
  );

  const handleDismiss = useCallback((requestId: string, cliff: (typeof targets)[number]['cliff']) => {
    dismissPendingNudge(requestId, cliff);
    setDismissedKeys((previous) => {
      const next = new Set(previous);
      next.add(`${requestId}:${cliff}`);
      return next;
    });
  }, []);

  if (targets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" data-testid="pending-nudge-banners">
      {targets.map((target) => (
        <PendingNudgeBannerItem
          key={`${target.id}:${target.cliff}`}
          target={target}
          surface={surface}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
