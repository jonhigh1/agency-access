'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { PendingNudgeBanner } from '@/components/pending-nudge-banner';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useAuthOrBypass } from '@/lib/dev-auth';
import { trackInviteLinkCopyAndSent } from '@/lib/analytics/invite-events';
import { buildInviteUrl } from '@/lib/app-url';
import { executeSendInviteReminder } from '@/lib/invite-reminder';
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
  resolveApiToken,
}: {
  target: ReturnType<typeof selectPendingNudgeTargets>[number];
  surface: PendingNudgeSurface;
  onDismiss: (requestId: string, cliff: typeof target.cliff) => void;
  resolveApiToken: () => Promise<string | null>;
}) {
  const { copied, copy } = useCopyToClipboard();
  const { copied: reminderCopied, copy: copyReminderLink } = useCopyToClipboard();
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderStatusMessage, setReminderStatusMessage] = useState<string | null>(null);
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
    setReminderLoading(true);
    setReminderStatusMessage(null);

    const expirationText = target.expiresAt
      ? new Date(target.expiresAt).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    try {
      const result = await executeSendInviteReminder({
        accessRequestId: target.id,
        accessRequestToken: target.uniqueToken,
        status: target.status,
        surface,
        clientEmail: target.clientEmail,
        clientName: target.clientName,
        authorizationUrl,
        expirationText,
        getToken: resolveApiToken,
        copyReminderLink: async (url) => {
          await copyReminderLink(url);
        },
      });

      if (result.outcome === 'sent') {
        setReminderStatusMessage('Reminder sent to client.');
      } else if (result.outcome === 'cooldown') {
        setReminderStatusMessage(result.message);
      } else if (result.outcome === 'error') {
        setReminderStatusMessage(result.message);
      }
    } finally {
      setReminderLoading(false);
    }
  }, [authorizationUrl, copyReminderLink, resolveApiToken, surface, target]);

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
      reminderLoading={reminderLoading}
      reminderStatusMessage={reminderStatusMessage}
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
  const clerkAuth = useAuth();
  const { getToken } = clerkAuth;
  const { isDevelopmentBypass } = useAuthOrBypass(clerkAuth);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());

  const resolveApiToken = useCallback(async () => {
    if (isDevelopmentBypass) {
      return 'dev-bypass-token';
    }
    return getToken();
  }, [getToken, isDevelopmentBypass]);

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
          resolveApiToken={resolveApiToken}
        />
      ))}
    </div>
  );
}
