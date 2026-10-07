import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureReviewDemoAdAccountPartner,
  exchangeReviewDemoMetaOAuth,
  fetchReviewDemoOAuthFlowHint,
  fetchReviewDemoSession,
  fetchReviewDemoStep,
  initiateReviewDemoMetaOAuth,
} from '../review-demo-api';

const authorizedApiFetchMock = vi.fn();

vi.mock('@/lib/api/authorized-api-fetch', () => ({
  authorizedApiFetch: (...args: unknown[]) => authorizedApiFetchMock(...args),
}));

describe('review-demo-api', () => {
  const getToken = async () => 'token';

  beforeEach(() => {
    vi.clearAllMocks();
    authorizedApiFetchMock.mockResolvedValue({ data: {} });
  });

  it('calls review demo endpoints under /api/review-demo', async () => {
    await fetchReviewDemoSession(getToken, 'pages_show_list');
    expect(authorizedApiFetchMock).toHaveBeenCalledWith(
      '/api/review-demo/session?step=pages_show_list',
      expect.any(Object)
    );

    await fetchReviewDemoStep(getToken, 'pages_show_list');
    expect(authorizedApiFetchMock).toHaveBeenCalledWith(
      '/api/review-demo/steps/pages_show_list',
      expect.any(Object)
    );

    await initiateReviewDemoMetaOAuth(getToken);
    expect(authorizedApiFetchMock).toHaveBeenCalledWith(
      '/api/review-demo/meta/initiate',
      expect.objectContaining({ method: 'POST' })
    );

    authorizedApiFetchMock.mockResolvedValueOnce({ data: { reviewDemo: true } });
    await fetchReviewDemoOAuthFlowHint(getToken, 'oauth-state');
    expect(authorizedApiFetchMock).toHaveBeenCalledWith(
      '/api/review-demo/meta/oauth-flow?state=oauth-state',
      expect.any(Object)
    );

    await exchangeReviewDemoMetaOAuth(getToken, { code: 'c', state: 's' });
    expect(authorizedApiFetchMock).toHaveBeenCalledWith(
      '/api/review-demo/meta/exchange',
      expect.objectContaining({ method: 'POST' })
    );

    await ensureReviewDemoAdAccountPartner(getToken);
    expect(authorizedApiFetchMock).toHaveBeenCalledWith(
      '/api/review-demo/steps/ads_management/ensure-partner',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
