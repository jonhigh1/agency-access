'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { Button } from '@/components/ui';
import { useAuth } from '@clerk/nextjs';
import { useAuthOrBypass } from '@/lib/dev-auth';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import {
  buildInviteSentMailto,
  trackInviteLinkCopyAndSent,
  trackInviteSent,
} from '@/lib/analytics/invite-events';
import { excludeMetaGrant, getAccessRequest, getAuthorizationUrl } from '@/lib/api/access-requests';
import { executeSendInviteReminder } from '@/lib/invite-reminder';
import type { AccessRequest } from '@/lib/api/access-requests';
import {
  RequestActionsBar,
  MetaFulfillmentCard,
  RequestOverviewCard,
  RequestPlatformsCard,
} from '@/components/access-request-detail';
import { PendingNudgeBanners } from '@/components/pending-nudge-banners';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';
import { getPendingCliff } from '@/lib/pending-cliff';

interface AccessRequestDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AccessRequestDetailPage({ params }: AccessRequestDetailPageProps) {
  const router = useRouter();
  const clerkAuth = useAuth();
  const { getToken } = clerkAuth;
  const { isDevelopmentBypass } = useAuthOrBypass(clerkAuth);
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const { copied: reminderCopied, copy: copyReminderLink } = useCopyToClipboard();
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderStatusMessage, setReminderStatusMessage] = useState<string | null>(null);

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
      setLoading(true);
      setError(null);
      setErrorCode(null);
      const resolved = await params;
      const result = await getAccessRequest(resolved.id, resolveApiToken);

      if (result.error) {
        setError(result.error.message);
        setErrorCode(result.error.code);
        setLoading(false);
        return;
      }

      if (!result.data) {
        setError('Could not load access request.');
        setErrorCode('REQUEST_NOT_FOUND');
        setLoading(false);
        return;
      }

      setAccessRequest(result.data);
      setLoading(false);
    }

    load();
  }, [params, resolveApiToken, loadAttempt]);

  useEffect(() => {
    if (!accessRequest) {
      return;
    }

    const track = async () => {
      await capturePosthogEvent('access_request_detail_viewed', {
        access_request_id: accessRequest.id,
        status: accessRequest.status,
      });
    };

    void track();
  }, [accessRequest]);

  const trackAction = async (action: string) => {
    if (!accessRequest) {
      return;
    }

    await capturePosthogEvent('access_request_detail_action_clicked', {
      access_request_id: accessRequest.id,
      status: accessRequest.status,
      action,
    });
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
      trackInviteLinkCopyAndSent({
        access_request_id: accessRequest.id,
        access_request_token: accessRequest.uniqueToken,
        status: accessRequest.status,
        surface: 'detail',
      });
    });
  };

  const handleSendReminder = async () => {
    if (!authorizationUrl || !accessRequest) {
      return;
    }

    void trackAction('send_reminder');
    setReminderLoading(true);
    setReminderStatusMessage(null);

    const expirationText = new Date(accessRequest.expiresAt).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    try {
      const result = await executeSendInviteReminder({
        accessRequestId: accessRequest.id,
        accessRequestToken: accessRequest.uniqueToken,
        status: accessRequest.status,
        surface: 'detail',
        clientEmail: accessRequest.clientEmail,
        clientName: accessRequest.clientName,
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
    const mailtoHref = buildInviteSentMailto({
      clientEmail: accessRequest.clientEmail,
      clientName: accessRequest.clientName,
      authorizationUrl,
      expirationText,
    });
    trackInviteSent({
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

  const handleExcludeMetaGrant = async (grantId: string, reason: string) => {
    if (!accessRequest) return 'Could not load access request.';
    const result = await excludeMetaGrant(accessRequest.id, grantId, reason, resolveApiToken);
    if (result.error) return result.error.message;

    const refreshed = await getAccessRequest(accessRequest.id, resolveApiToken);
    if (!refreshed.data) return refreshed.error?.message || 'Could not refresh access results.';
    setAccessRequest(refreshed.data);
    return null;
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
    const terminal = ['NOT_FOUND', 'REQUEST_NOT_FOUND', 'ACCESS_REQUEST_NOT_FOUND', 'REQUEST_EXPIRED', 'REQUEST_REVOKED'].includes(errorCode || '');
    const unauthorized = ['UNAUTHORIZED', 'FORBIDDEN', 'AUTHENTICATION_REQUIRED'].includes(errorCode || '');
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-coral/40 bg-card p-8 text-center shadow-sm">
          <AlertCircle className="h-8 w-8 text-danger-ink mx-auto mb-3" />
          <h1 className="text-2xl font-semibold font-display text-ink">
            {terminal ? 'Request Not Found' : unauthorized ? 'Request Access Denied' : 'Could Not Load Request'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {terminal
              ? 'This request is unavailable. Return to the dashboard to review your requests.'
              : unauthorized
                ? 'Your account cannot view this request. Return to the dashboard or contact your agency administrator.'
                : 'The request service did not respond. Try again to reload this request.'}
          </p>
          {!terminal && !unauthorized ? (
            <Button className="mt-5" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
              Try again
            </Button>
          ) : null}
          <Button className="mt-5" variant="secondary" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
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

        <PendingNudgeBanners
          requests={[
            {
              id: accessRequest.id,
              clientName: accessRequest.clientName,
              clientEmail: accessRequest.clientEmail,
              expiresAt: accessRequest.expiresAt,
              status: accessRequest.status,
              createdAt: accessRequest.createdAt,
              uniqueToken: accessRequest.uniqueToken,
            },
          ]}
          surface="detail"
        />

        <RequestOverviewCard
          request={accessRequest}
          authorizationUrl={authorizationUrl}
          copied={copied}
          reminderCopied={reminderCopied}
          reminderLoading={reminderLoading}
          reminderStatusMessage={reminderStatusMessage}
          onCopyLink={handleCopyLink}
          onPreviewLink={handlePreviewLink}
          showAwaitingClientCallout={
            (accessRequest.status === 'pending' || accessRequest.status === 'partial') &&
            getPendingCliff(accessRequest.createdAt) === null
          }
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

        <MetaFulfillmentCard
          results={accessRequest.metaFulfillment || []}
          declines={accessRequest.metaDeclines}
          onExclude={handleExcludeMetaGrant}
        />
      </div>
    </div>
  );
}
