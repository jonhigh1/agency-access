'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { useAuth } from '@clerk/nextjs';
import { useAuthOrBypass } from '@/lib/dev-auth';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { getAccessRequest, getAuthorizationUrl } from '@/lib/api/access-requests';
import type { AccessRequest } from '@/lib/api/access-requests';
import {
  RequestActionsBar,
  RequestOverviewCard,
  RequestPlatformsCard,
  RequestStatusChip,
  nextActionLine,
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
    if (!authorizationUrl) {
      return;
    }

    void trackAction('copy_link');
    await copy(authorizationUrl);
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
        <div className="w-full max-w-md border-2 border-black bg-card p-8 text-center shadow-brutalist">
          <AlertCircle className="h-8 w-8 text-danger-ink mx-auto mb-3" />
          <h1 className="text-2xl font-semibold font-display text-ink">Request Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Could not load request.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b-2 border-black pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Access Request Details
            </h1>
            <RequestStatusChip status={accessRequest.status} />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {nextActionLine(accessRequest.status, accessRequest.clientName)}
          </p>
        </header>

        <RequestOverviewCard
          request={accessRequest}
          authorizationUrl={authorizationUrl}
          copied={copied}
          onCopyLink={handleCopyLink}
          onPreviewLink={handlePreviewLink}
        />

        <RequestPlatformsCard request={accessRequest} />

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
      </div>
    </div>
  );
}
