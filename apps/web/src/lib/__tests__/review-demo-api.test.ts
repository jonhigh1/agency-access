import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkReviewDemoAdAccountAccess,
  exchangeReviewDemoMetaOAuth,
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

    await exchangeReviewDemoMetaOAuth(getToken, { code: 'c', state: 's' });
    expect(authorizedApiFetchMock).toHaveBeenCalledWith(
      '/api/review-demo/meta/exchange',
      expect.objectContaining({ method: 'POST' })
    );

    await checkReviewDemoAdAccountAccess(getToken);
    expect(authorizedApiFetchMock).toHaveBeenCalledWith(
      '/api/review-demo/steps/ads_management/check-access',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
