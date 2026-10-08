import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewDemoScreen } from '../ReviewDemoScreen';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' }),
}));

vi.mock('@/lib/review-demo-api', () => ({
  fetchReviewDemoSession: vi.fn(async () => ({
    connected: true,
    identity: { id: '122095319343509372', name: 'Alex Reviewer' },
    grantedPermissions: ['pages_show_list', 'pages_read_engagement', 'ads_management', 'business_management'],
    activeStep: 'pages_show_list',
    stepIndex: 0,
    stepCount: 4,
    sandbox: {
      businessManagerId: '695982475048959',
      adAccountId: 'act_557538895783894',
      pageId: '1373353139192376',
      agencyBusinessId: '3808519629379919',
    },
    usesSandboxAssets: true,
  })),
  fetchReviewDemoStep: vi.fn(async () => ({
    stepId: 'pages_show_list',
    pages: [{ id: '1373353139192376', name: 'Ah-Review-Page' }],
    graphCaptions: ['GET /me/accounts'],
  })),
  initiateReviewDemoMetaOAuth: vi.fn(),
  checkReviewDemoAdAccountAccess: vi.fn(),
}));

describe('ReviewDemoScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the active permission label prominently for captions', async () => {
    render(<ReviewDemoScreen initialStep="pages_show_list" />);
    expect(await screen.findByTestId('review-demo-permission-banner')).toHaveTextContent('pages_show_list');
    expect(screen.getByTestId('review-demo-identity-name')).toHaveTextContent('Alex Reviewer');
    expect(screen.getByTestId('review-demo-pages-list')).toBeInTheDocument();
  });

  it('does not flash Not connected before the session fetch resolves', () => {
    render(<ReviewDemoScreen initialStep="pages_show_list" />);
    expect(screen.getByTestId('review-demo-identity-name')).toHaveTextContent('Loading session…');
    expect(screen.queryByTestId('review-demo-connect-meta')).not.toBeInTheDocument();
  });
});
