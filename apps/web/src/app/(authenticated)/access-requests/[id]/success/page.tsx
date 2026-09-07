'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Check, Copy, ExternalLink, Mail } from 'lucide-react';
import { getAccessRequest, getAuthorizationUrl } from '@/lib/api/access-requests';
import { getPlatformCount } from '@/lib/transform-platforms';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { FlowShell } from '@/components/flow/flow-shell';
import { RequestStatusChip } from '@/components/access-request-detail';
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

  const handleCopyLink = () => {
    if (!authorizationUrl) return;
    void copy(authorizationUrl);
  };

  const emailHref = accessRequest
    ? `mailto:${encodeURIComponent(accessRequest.clientEmail)}?subject=${encodeURIComponent(
        `Authorize platform access for ${accessRequest.clientName}`
      )}&body=${encodeURIComponent(
        `Hi ${accessRequest.clientName},\n\nPlease use this secure link to authorize platform access:\n${authorizationUrl}\n\nThis link expires on ${expirationText}.`
      )}`
    : '#';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <LogoSpinner size="lg" />
      </div>
    );
  }

  if (error || !accessRequest) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-md border-2 border-black bg-card p-8 text-center shadow-brutalist">
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
      description={`Share this link with ${accessRequest.clientName} to authorize ${platformCount} platform${platformCount !== 1 ? 's' : ''}.`}
      step={3}
      totalSteps={3}
      steps={['Build', 'Review', 'Send']}
    >
      <div className="space-y-6">
        <section className="border-2 border-black bg-card p-6 shadow-brutalist">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-black">
                <Check className="h-6 w-6 text-success-ink" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Share Authorization Link</h2>
                <p className="text-sm text-muted-foreground">
                  One action left: send it to {accessRequest.clientName}.
                </p>
              </div>
            </div>
            <RequestStatusChip status={accessRequest.status} />
          </div>

          <div className="mt-5 flex items-stretch gap-2 border border-black bg-paper p-3">
            <code className="min-w-0 flex-1 break-all self-center text-xs text-ink">
              {authorizationUrl}
            </code>
            <Button size="sm" onClick={handleCopyLink} leftIcon={<Copy className="h-4 w-4" />}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <Button
            className="mt-4 min-h-[44px] w-full"
            leftIcon={<Mail className="h-4 w-4" />}
            onClick={() => window.location.assign(emailHref)}
          >
            Email Client
          </Button>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => window.open(authorizationUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Preview what your client sees
            </button>
            <p className="label-nano">Expires {expirationText}</p>
          </div>
        </section>

        <section className="border border-black/25 bg-card p-5">
          <p className="label-micro">Request details</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="label-nano">Client</p>
              <p className="text-sm font-semibold text-ink">{accessRequest.clientName}</p>
            </div>
            <div>
              <p className="label-nano">Email</p>
              <p className="break-all text-sm font-semibold text-ink">{accessRequest.clientEmail}</p>
            </div>
            <div>
              <p className="label-nano">Products</p>
              <p className="text-sm font-semibold text-ink">{platformCount}</p>
            </div>
          </div>
          <p className="label-nano mt-4">Link validity window is 7 days. Expiration date shown above.</p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-black pt-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
          >
            Back to Dashboard
          </button>
          <button
            type="button"
            onClick={() => router.push('/access-requests/new')}
            className="text-sm font-semibold text-ink underline-offset-4 hover:underline"
          >
            Create another request
          </button>
        </div>
      </div>
    </FlowShell>
  );
}
