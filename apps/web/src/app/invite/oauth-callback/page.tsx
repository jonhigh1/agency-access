'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';
import {
  trackClientOAuthExchangeFailure,
  trackClientOAuthExchangeSuccess,
} from '@/lib/analytics/oauth-events';
import {
  clearInviteOAuthReturnToken,
  readInviteOAuthReturnToken,
} from '@/lib/client-invite-oauth';

function ClientOAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const apiBaseUrl = getApiBaseUrl();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [returnToken, setReturnToken] = useState<string | null>(null);

  useEffect(() => {
    setReturnToken(readInviteOAuthReturnToken());
  }, []);

  const code = searchParams.get('code') || searchParams.get('auth_code');
  const state = searchParams.get('state');

  useEffect(() => {
    async function handleCallback() {
      if (!code || !state) {
        const returnToken = readInviteOAuthReturnToken();
        trackClientOAuthExchangeFailure({
          error_code: 'MISSING_OAUTH_PARAMS',
          error_message: 'Missing OAuth parameters. Restart authorization from the invite link.',
          auth_source: 'client_redirect',
          access_request_token: returnToken,
        });
        setError('Missing OAuth parameters. Restart authorization from the invite link.');
        setIsProcessing(false);
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/client/oauth-exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });

        const json = await parseJsonResponse<{
          data: { connectionId: string; token: string; platform: string };
          error?: { message?: string; code?: string };
        }>(response, {
          fallbackErrorMessage: 'Failed to complete authorization',
        });
        if (!response.ok || json.error) {
          throw new Error(json.error?.message || 'Failed to complete authorization');
        }

        const { connectionId, token, platform: platformFromState } = json.data;
        if (!token) {
          throw new Error('Access request token missing from OAuth state');
        }

        trackClientOAuthExchangeSuccess({
          platform: platformFromState,
          access_request_token: token,
          connection_id: connectionId,
          auth_source: 'client_redirect',
        });

        clearInviteOAuthReturnToken();

        router.push(`/invite/${token}?connectionId=${connectionId}&platform=${platformFromState}&step=2`);
      } catch (err) {
        const returnToken = readInviteOAuthReturnToken();
        trackClientOAuthExchangeFailure({
          platform: searchParams.get('platform'),
          error_code: 'OAUTH_EXCHANGE_FAILED',
          error_message: err instanceof Error ? err.message : 'Authorization failed',
          auth_source: 'client_redirect',
          access_request_token: returnToken,
        });
        setError(err instanceof Error ? err.message : 'Authorization failed');
        setIsProcessing(false);
      }
    }

    handleCallback();
  }, [apiBaseUrl, code, router, searchParams, state]);

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border-2 border-black bg-card p-8 shadow-brutalist text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-coral bg-coral/10">
            <AlertCircle className="h-7 w-7 text-danger-ink" />
          </div>
          <h1 className="text-2xl font-semibold text-ink font-display">Authorization Failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button
            className="mt-6"
            onClick={() => {
              router.push(returnToken ? `/invite/${returnToken}` : '/');
            }}
          >
            {returnToken ? 'Return to authorization' : 'Return Home'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border-2 border-black bg-card p-8 shadow-brutalist text-center">
        <LogoSpinner size="xl" className="mx-auto mb-4" />
        <h1 className="text-2xl font-semibold text-ink font-display">Processing Authorization</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isProcessing ? 'Exchanging OAuth code securely...' : 'Redirecting...'}
        </p>
      </div>
    </div>
  );
}

export default function ClientOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <LogoSpinner size="lg" />
        </div>
      }
    >
      <ClientOAuthCallbackContent />
    </Suspense>
  );
}
