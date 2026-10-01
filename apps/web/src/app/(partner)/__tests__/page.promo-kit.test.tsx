import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import PartnerPortalPage from '../partners/page';

const useAffiliatePortalOverviewMock = vi.fn();
const useAffiliatePortalCommissionHistoryMock = vi.fn();
const useCreateAffiliatePortalLinkMock = vi.fn();
const writeTextMock = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  UserButton: () => <div>User Button</div>,
  useAuth: () => ({
    userId: 'user_123',
    isLoaded: true,
    getToken: vi.fn(),
  }),
}));

vi.mock('@/lib/dev-auth', () => ({
  useAuthOrBypass: () => ({
    userId: 'user_123',
    orgId: null,
    isLoaded: true,
    isDevelopmentBypass: false,
  }),
}));

vi.mock('@/lib/query/affiliate', () => ({
  useAffiliatePortalOverview: () => useAffiliatePortalOverviewMock(),
  useAffiliatePortalCommissionHistory: () => useAffiliatePortalCommissionHistoryMock(),
  useCreateAffiliatePortalLink: () => useCreateAffiliatePortalLinkMock(),
}));

describe('Partner portal promo kit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    useAffiliatePortalOverviewMock.mockReturnValue({
      data: {
        partner: {
          id: 'partner_1',
          name: 'Partner One',
          email: 'partner@example.com',
          status: 'approved',
          defaultCommissionBps: 3000,
          commissionDurationMonths: 12,
        },
        metrics: {
          clicks: 42,
          referrals: 5,
          customers: 2,
          pendingCommissionCents: 12500,
          paidCommissionCents: 6400,
        },
        primaryLink: {
          id: 'link_1',
          code: 'partner-one',
          status: 'active',
          destinationPath: '/pricing',
          campaign: null,
          url: 'https://www.authhub.co/r/partner-one',
        },
        links: [],
      },
      isLoading: false,
      error: null,
    });

    useAffiliatePortalCommissionHistoryMock.mockReturnValue({
      data: {
        commissions: [],
        payouts: [],
      },
      isLoading: false,
      error: null,
    });

    useCreateAffiliatePortalLinkMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('renders the partner enablement promo kit content', () => {
    render(<PartnerPortalPage />);

    expect(screen.getByText('Promo kit')).toBeInTheDocument();
    expect(screen.getByText('Email outreach swipe')).toBeInTheDocument();
    expect(screen.getByText('Social post swipe')).toBeInTheDocument();
    expect(screen.getByText('How to pitch AuthHub')).toBeInTheDocument();
  });

  it('copies the email swipe to the clipboard', async () => {
    writeTextMock.mockResolvedValue(undefined);

    render(<PartnerPortalPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy email swipe' }));
    });

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('Subject:'));
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('AuthHub'));
  });

  it('does not call service failures pending approval and offers retry', () => {
    const refetch = vi.fn();
    useAffiliatePortalOverviewMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: Object.assign(new Error('Service unavailable'), { status: 503 }),
      refetch,
    });

    render(<PartnerPortalPage />);

    expect(screen.getByRole('heading', { name: 'Unable to load partner portal' })).toBeInTheDocument();
    expect(screen.queryByText('Access pending approval')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('keeps approved partners in the portal when referral history is empty', () => {
    useAffiliatePortalOverviewMock.mockReturnValue({
      data: {
        partner: { id: 'partner_1', name: 'Partner One', email: 'partner@example.com', status: 'approved', defaultCommissionBps: 3000, commissionDurationMonths: 12 },
        metrics: { clicks: 0, referrals: 0, customers: 0, pendingCommissionCents: 0, paidCommissionCents: 0 },
        primaryLink: null,
        links: [],
      },
      isLoading: false,
      error: null,
    });

    render(<PartnerPortalPage />);

    expect(screen.getByRole('heading', { name: 'Partner Portal' })).toBeInTheDocument();
    expect(screen.getByText('No referral links yet. Your primary link will appear here once provisioned.')).toBeInTheDocument();
    expect(screen.queryByText('Access pending approval')).not.toBeInTheDocument();
  });

  it('does not label a generic authorization denial as pending approval', () => {
    useAffiliatePortalOverviewMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: Object.assign(new Error('Approved affiliate partner access is required'), { status: 403, code: 'FORBIDDEN' }),
      refetch: vi.fn(),
    });

    render(<PartnerPortalPage />);

    expect(screen.getByRole('heading', { name: 'Partner access unavailable' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.queryByText('Access pending approval')).not.toBeInTheDocument();
  });

  it('associates campaign validation with the field and announces it', () => {
    render(<PartnerPortalPage />);
    const input = screen.getByRole('textbox', { name: 'Campaign name' });

    fireEvent.change(input, { target: { value: ' ' } });
    act(() => fireEvent.submit(input.closest('form')!));

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'campaign-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a campaign name with at least 2 characters.');
  });

  it('associates server campaign validation with the field', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(
      Object.assign(new Error('Campaign name is invalid'), { status: 400, code: 'VALIDATION_ERROR' })
    );
    useCreateAffiliatePortalLinkMock.mockReturnValue({ mutateAsync, isPending: false });
    render(<PartnerPortalPage />);
    const input = screen.getByRole('textbox', { name: 'Campaign name' });

    fireEvent.change(input, { target: { value: 'Newsletter' } });
    await act(async () => fireEvent.submit(input.closest('form')!));

    expect(mutateAsync).toHaveBeenCalledOnce();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'campaign-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Campaign name is invalid');
  });

  it('renders full referral URLs without truncating them', () => {
    useAffiliatePortalOverviewMock.mockReturnValue({
      data: {
        partner: { id: 'partner_1', name: 'Partner One', email: 'partner@example.com', status: 'approved', defaultCommissionBps: 3000, commissionDurationMonths: 12 },
        metrics: { clicks: 0, referrals: 0, customers: 0, pendingCommissionCents: 0, paidCommissionCents: 0 },
        primaryLink: null,
        links: [{ id: 'link_2', code: 'campaign', status: 'active', destinationPath: '/pricing', campaign: 'campaign', url: 'https://www.authhub.co/r/campaign?utm_campaign=long-campaign-value' }],
      },
      isLoading: false,
      error: null,
    });

    render(<PartnerPortalPage />);

    expect(screen.getByText('https://www.authhub.co/r/campaign?utm_campaign=long-campaign-value')).not.toHaveClass('truncate');
  });
});
