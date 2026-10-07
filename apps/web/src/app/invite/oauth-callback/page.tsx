'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { LogoSpinner } from '@/components/ui/logo-spinner';
import { getApiBaseUrl } from '@/lib/api/api-env';
import { parseJsonResponse } from '@/lib/api/parse-json-response';
import {
  exchangeReviewDemoMetaOAuth,
  fetchReviewDemoOAuthFlowHint,
} from '@/lib/review-demo-api';
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
  const { getToken } = useAuth();
  const apiBaseUrl = getApiBaseUrl();
  const reviewDemoFlowQuery = searchParams.get('flow') === 'review-demo';
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [returnToken, setReturnToken] = useState<string | null>(null);

  useEffect(() => {
    setReturnToken(readInviteOAuthReturnToken());
  }, []);

  const code = searchParams.get('code') || searchParams.get('auth_code');
  const state = searchParams.get('state');
  const providerError = searchParams.get('error');
  const providerErrorReason = searchParams.get('error_reason');
  const presentation = searchParams.get('presentation');

  useEffect(() => {
    async function handleCallback() {
      const authSource = presentation === 'popup' ? 'client_meta_popup' : 'client_redirect';
      const finishPopup = (result: { success: boolean; connectionId?: string; platform?: string; errorCode?: string }) => {
        if (presentation !== 'popup') return false;
        window.opener?.postMessage({ type: 'authhub:oauth-result', ...result }, window.location.origin);
        window.close();
        return true;
      };

      if (providerError || providerErrorReason) {
        const denied = providerError === 'access_denied' || providerErrorReason === 'user_denied';
        const message = denied
          ? 'You declined or cancelled access. Return to the request to try again.'
          : 'The provider could not complete authorization. Return to the request and try again.';
        trackClientOAuthExchangeFailure({
          platform: searchParams.get('platform'),
          error_code: denied ? 'OAUTH_DENIED' : 'OAUTH_PROVIDER_ERROR',
          error_message: message,
          auth_source: authSource,
        });
        if (finishPopup({ success: false, errorCode: denied ? 'OAUTH_DENIED' : 'OAUTH_PROVIDER_ERROR' })) return;
        setError(message);
        setIsProcessing(false);
        return;
      }

      if (!code || !state) {
        trackClientOAuthExchangeFailure({
          error_code: 'MISSING_OAUTH_PARAMS',
          error_message: 'Missing OAuth parameters. Restart authorization from the invite link.',
          auth_source: authSource,
        });
        if (finishPopup({ success: false, errorCode: 'MISSING_OAUTH_PARAMS' })) return;
        setError('Missing OAuth parameters. Restart authorization from the invite link.');
        setIsProcessing(false);
        return;
      }

      try {
        const reviewDemoFlow =
          reviewDemoFlowQuery ||
          (state
            ? await fetchReviewDemoOAuthFlowHint(getToken, state).catch((error) => {
                console.warn(
                  'Review demo OAuth flow hint unavailable; continuing with client exchange.',
                  error
                );
                return false;
              })
            : false);

        if (reviewDemoFlow) {
          await exchangeReviewDemoMetaOAuth(getToken, { code, state });
          router.replace('/review-demo?connected=1');
          return;
        }

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
          connection_id: connectionId,
          auth_source: authSource,
        });

        clearInviteOAuthReturnToken();

        if (finishPopup({ success: true, connectionId, platform: platformFromState })) return;

        router.replace(`/invite/${token}?connectionId=${connectionId}&platform=${platformFromState}&step=2`);
      } catch (err) {
        trackClientOAuthExchangeFailure({
          platform: searchParams.get('platform'),
          error_code: 'OAUTH_EXCHANGE_FAILED',
          error_message: err instanceof Error ? err.message : 'Authorization failed',
          auth_source: authSource,
        });
        if (finishPopup({ success: false, errorCode: 'OAUTH_EXCHANGE_FAILED' })) return;
        setError(err instanceof Error ? err.message : 'Authorization failed');
        setIsProcessing(false);
      }
    }

    handleCallback();
  }, [
    apiBaseUrl,
    code,
    getToken,
    presentation,
    providerError,
    providerErrorReason,
    reviewDemoFlowQuery,
    router,
    searchParams,
    state,
  ]);

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-none border-2 border-black bg-card p-8 shadow-brutalist text-center">
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
      <div className="w-full max-w-md rounded-none border-2 border-black bg-card p-8 shadow-brutalist text-center">
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
