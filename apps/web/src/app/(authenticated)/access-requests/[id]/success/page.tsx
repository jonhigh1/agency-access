'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Check, Copy, ArrowLeft, Plus, ExternalLink, Mail } from 'lucide-react';
import { getAccessRequest, getAuthorizationUrl } from '@/lib/api/access-requests';
import {
  buildInviteSentMailto,
  trackInviteLinkCopyAndSent,
  trackInviteSent,
} from '@/lib/analytics/invite-events';
import { getPlatformCount } from '@/lib/transform-platforms';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui';
import { FlowShell } from '@/components/flow/flow-shell';
import type { AccessRequest } from '@/lib/api/access-requests';

interface SuccessPageProps {
  params: Promise<{ id: string }>;
}

export default function SuccessPage({ params }: SuccessPageProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccessRequest() {
      const resolvedParams = await params;
      const result = await getAccessRequest(resolvedParams.id, getToken);

      if (result.error) {
        setError(result.error.message);
      } else if (result.data) {
        setAccessRequest(result.data);
      }

      setLoading(false);
    }

    loadAccessRequest();
  }, [params, getToken]);

  const authorizationUrl = accessRequest ? getAuthorizationUrl(accessRequest) : '';

  const platformCount = useMemo(() => {
    if (!accessRequest) return 0;
    return getPlatformCount(
      accessRequest.platforms.reduce(
        (acc, group) => ({
          ...acc,
          [group.platformGroup]: group.products.map((p) => p.product),
        }),
        {}
      )
    );
  }, [accessRequest]);

  const expirationText = useMemo(() => {
    if (!accessRequest?.expiresAt) return null;
    const date = new Date(accessRequest.expiresAt);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [accessRequest]);

  const handleCopyLink = async () => {
    if (!authorizationUrl || !accessRequest) return;
    await copy(authorizationUrl, () => {
      trackInviteLinkCopyAndSent({
        access_request_id: accessRequest.id,
        access_request_token: accessRequest.uniqueToken,
        status: accessRequest.status,
        surface: 'success',
      });
    });
  };

  const handleEmailClient = () => {
    if (!accessRequest || !authorizationUrl) return;

    trackInviteSent({
      access_request_id: accessRequest.id,
      access_request_token: accessRequest.uniqueToken,
      channel: 'email',
      surface: 'success',
      status: accessRequest.status,
    });
    window.location.assign(
      buildInviteSentMailto({
        clientEmail: accessRequest.clientEmail,
        clientName: accessRequest.clientName,
        authorizationUrl,
        expirationText,
      })
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-coral border-t-transparent" />
      </div>
    );
  }

  if (error || !accessRequest) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border-2 border-black bg-card p-8 shadow-brutalist text-center">
          <h1 className="text-2xl font-semibold text-ink font-display">Request Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Could not load access request.'}</p>
          <Button className="mt-6" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FlowShell
      title="Access Request Created"
      description={`Share this link with ${accessRequest.clientName}. They authorize when ready — tokens are stored only after authorization completes.`}
      step={3}
      totalSteps={3}
      steps={['Build', 'Review', 'Send']}
    >
      <div className="space-y-6">
        <div className="rounded-lg border-2 border-black bg-card p-6 shadow-brutalist">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full border border-teal bg-teal/10 flex items-center justify-center">
                <Check className="h-6 w-6 text-success-ink" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Share Authorization Link</h2>
                <p className="text-sm text-muted-foreground">
                  Send this secure URL to your client. They complete authorization on their schedule.
                </p>
              </div>
            </div>
            <span className="rounded-full border border-border bg-muted/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {accessRequest.status}
            </span>
          </div>

          <div className="mt-5 rounded-lg border border-border bg-paper p-4">
            <code className="break-all text-xs text-ink">{authorizationUrl}</code>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button onClick={handleCopyLink} leftIcon={<Copy className="h-4 w-4" />}>
              {copied ? 'Copied' : 'Copy Link'}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<ExternalLink className="h-4 w-4" />}
              onClick={() => window.open(authorizationUrl, '_blank', 'noopener,noreferrer')}
            >
              Preview Link
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Mail className="h-4 w-4" />}
              onClick={handleEmailClient}
            >
              Email Client
            </Button>
            <Button
              variant="secondary"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Request Details</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="text-sm font-semibold text-ink">{accessRequest.clientName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-semibold text-ink">{accessRequest.clientEmail}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Products</p>
              <p className="text-sm font-semibold text-ink">{platformCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className="text-sm font-semibold text-ink">{expirationText}</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Link validity window is 7 days. Expiration date shown above.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => router.push('/access-requests/new')}
          >
            Create Another Request
          </Button>
        </div>
      </div>
    </FlowShell>
  );
}
