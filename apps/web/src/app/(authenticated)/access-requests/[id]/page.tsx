'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { useAuth } from '@clerk/nextjs';
import { useAuthOrBypass } from '@/lib/dev-auth';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import {
  buildInviteReminderMailto,
  trackInviteLinkCopied,
  trackInviteReminderSent,
  trackInviteSent,
} from '@/lib/analytics/invite-events';
import { getAccessRequest, getAuthorizationUrl } from '@/lib/api/access-requests';
import type { AccessRequest } from '@/lib/api/access-requests';
import {
  RequestActionsBar,
  RequestOverviewCard,
  RequestPlatformsCard,
} from '@/components/access-request-detail';

interface AccessRequestDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AccessRequestDetailPage({ params }: AccessRequestDetailPageProps) {
  const clerkAuth = useAuth();
  const { getToken } = clerkAuth;
  const { isDevelopmentBypass } = useAuthOrBypass(clerkAuth);
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const { copied: reminderCopied, copy: copyReminderLink } = useCopyToClipboard();

  const resolveApiToken = useMemo(
    () => async () => {
      if (isDevelopmentBypass) {
        return 'dev-bypass-token';
      }

      return getToken();
    },
    [getToken, isDevelopmentBypass]
  );

  useEffect(() => {
    async function load() {
      const resolved = await params;
      const result = await getAccessRequest(resolved.id, resolveApiToken);

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      if (!result.data) {
        setError('Could not load access request.');
        setLoading(false);
        return;
      }

      setAccessRequest(result.data);
      setLoading(false);
    }

    load();
  }, [params, resolveApiToken]);

  useEffect(() => {
    if (!accessRequest) {
      return;
    }

    const track = async () => {
      try {
        const { default: posthog } = await import('posthog-js');
        posthog.capture('access_request_detail_viewed', {
          access_request_id: accessRequest.id,
          status: accessRequest.status,
        });
      } catch {
        // Ignore analytics failures.
      }
    };

    void track();
  }, [accessRequest]);

  const trackAction = async (action: string) => {
    if (!accessRequest) {
      return;
    }

    try {
      const { default: posthog } = await import('posthog-js');
      posthog.capture('access_request_detail_action_clicked', {
        access_request_id: accessRequest.id,
        status: accessRequest.status,
        action,
      });
    } catch {
      // Ignore analytics failures.
    }
  };

  const authorizationUrl = useMemo(() => {
    if (!accessRequest) return '';
    return getAuthorizationUrl(accessRequest);
  }, [accessRequest]);

  const handleCopyLink = async () => {
    if (!authorizationUrl || !accessRequest) {
      return;
    }

    void trackAction('copy_link');
    await copy(authorizationUrl, () => {
      trackInviteLinkCopied({
        access_request_id: accessRequest.id,
        access_request_token: accessRequest.uniqueToken,
        status: accessRequest.status,
        surface: 'detail',
      });
      trackInviteSent({
        access_request_id: accessRequest.id,
        access_request_token: accessRequest.uniqueToken,
        channel: 'copy',
        surface: 'detail',
        status: accessRequest.status,
      });
    });
  };

  const handleSendReminder = async () => {
    if (!authorizationUrl || !accessRequest) {
      return;
    }

    void trackAction('send_reminder');
    await copyReminderLink(authorizationUrl);
    trackInviteReminderSent({
      access_request_id: accessRequest.id,
      access_request_token: accessRequest.uniqueToken,
      status: accessRequest.status,
      channel: 'copy',
      surface: 'detail',
    });
  };

  const handleEmailClient = () => {
    if (!authorizationUrl || !accessRequest) {
      return;
    }

    void trackAction('email_client');
    const expirationText = new Date(accessRequest.expiresAt).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const mailtoHref = buildInviteReminderMailto({
      clientEmail: accessRequest.clientEmail,
      clientName: accessRequest.clientName,
      authorizationUrl,
      expirationText,
    });
    trackInviteReminderSent({
      access_request_id: accessRequest.id,
      access_request_token: accessRequest.uniqueToken,
      status: accessRequest.status,
      channel: 'email',
      surface: 'detail',
    });
    window.location.assign(mailtoHref);
  };

  const handlePreviewLink = () => {
    if (!authorizationUrl) {
      return;
    }

    void trackAction('preview_link');
    window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <LogoSpinner size="lg" className="mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Loading request details...</p>
        </div>
      </div>
    );
  }

  if (!accessRequest || error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-coral/40 bg-card p-8 text-center shadow-sm">
          <AlertCircle className="h-8 w-8 text-danger-ink mx-auto mb-3" />
          <h1 className="text-2xl font-semibold font-display text-ink">Request Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Could not load request.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-ink font-display">Access Request Details</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review request configuration and lifecycle status before taking action.
          </p>
        </div>

        <RequestActionsBar
          requestId={accessRequest.id}
          requestName={accessRequest.clientName}
          status={accessRequest.status}
          onAction={(action) => {
            void trackAction(action);
          }}
          onRevokeSuccess={() => {
            setAccessRequest((prev) => (prev ? { ...prev, status: 'revoked' } : null));
          }}
        />

        <RequestOverviewCard
          request={accessRequest}
          authorizationUrl={authorizationUrl}
          copied={copied}
          reminderCopied={reminderCopied}
          onCopyLink={handleCopyLink}
          onPreviewLink={handlePreviewLink}
          onSendReminder={
            accessRequest.status === 'pending' || accessRequest.status === 'partial'
              ? handleSendReminder
              : undefined
          }
          onEmailClient={
            accessRequest.status === 'pending' || accessRequest.status === 'partial'
              ? handleEmailClient
              : undefined
          }
        />

        <RequestPlatformsCard request={accessRequest} />
      </div>
    </div>
  );
}
