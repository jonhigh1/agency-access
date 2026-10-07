import type { ReviewDemoSession, ReviewDemoStepId, ReviewDemoStepPayload } from '@agency-platform/shared';
import { authorizedApiFetch } from '@/lib/api/authorized-api-fetch';

export async function fetchReviewDemoSession(
  getToken: () => Promise<string | null>,
  step: ReviewDemoStepId
): Promise<ReviewDemoSession> {
  const json = await authorizedApiFetch<{ data: ReviewDemoSession }>(
    `/api/review-demo/session?step=${encodeURIComponent(step)}`,
    { getToken }
  );
  return json.data;
}

export async function fetchReviewDemoStep(
  getToken: () => Promise<string | null>,
  stepId: ReviewDemoStepId
): Promise<ReviewDemoStepPayload> {
  const json = await authorizedApiFetch<{ data: ReviewDemoStepPayload }>(
    `/api/review-demo/steps/${encodeURIComponent(stepId)}`,
    { getToken }
  );
  return json.data;
}

export async function initiateReviewDemoMetaOAuth(
  getToken: () => Promise<string | null>
): Promise<{ authUrl: string }> {
  const json = await authorizedApiFetch<{ data: { authUrl: string } }>(
    '/api/review-demo/meta/initiate',
    { getToken, method: 'POST', body: JSON.stringify({}) }
  );
  return json.data;
}

export async function fetchReviewDemoOAuthFlowHint(
  getToken: () => Promise<string | null>,
  state: string
): Promise<boolean> {
  const json = await authorizedApiFetch<{ data: { reviewDemo: boolean } }>(
    `/review-demo/meta/oauth-flow?state=${encodeURIComponent(state)}`,
    { getToken }
  );
  return json.data.reviewDemo;
}

export async function exchangeReviewDemoMetaOAuth(
  getToken: () => Promise<string | null>,
  input: { code: string; state: string }
): Promise<void> {
  await authorizedApiFetch('/api/review-demo/meta/exchange', {
    getToken,
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function pauseReviewDemoTestAd(
  getToken: () => Promise<string | null>,
  adId?: string
): Promise<{ adId: string; effectiveStatus: string }> {
  const json = await authorizedApiFetch<{ data: { adId: string; effectiveStatus: string } }>(
    '/api/review-demo/steps/ads_management/pause',
    {
      getToken,
      method: 'POST',
      body: JSON.stringify(adId ? { adId } : {}),
    }
  );
  return json.data;
}

export async function resumeReviewDemoTestAd(
  getToken: () => Promise<string | null>,
  adId?: string
): Promise<{ adId: string; effectiveStatus: string }> {
  const json = await authorizedApiFetch<{ data: { adId: string; effectiveStatus: string } }>(
    '/api/review-demo/steps/ads_management/resume',
    {
      getToken,
      method: 'POST',
      body: JSON.stringify(adId ? { adId } : {}),
    }
  );
  return json.data;
}
