import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuccessPage from '../page';

const mockPush = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue('token');
const mockCopy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({ copied: false, copy: mockCopy }),
}));

vi.mock('@/lib/api/access-requests', () => ({
  getAccessRequest: vi.fn().mockResolvedValue({
    data: {
      id: 'request-123',
      uniqueToken: 'token-abc',
      status: 'pending',
      clientName: 'Acme Corp',
      clientEmail: 'client@acme.com',
      expiresAt: '2026-09-14T00:00:00.000Z',
      platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads' }] }],
    },
  }),
  getAuthorizationUrl: vi.fn(
    (request: { uniqueToken: string }) => `https://authhub.co/invite/${request.uniqueToken}`
  ),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteLinkCopied: vi.fn(),
  trackInviteSent: vi.fn(),
  buildInviteSentMailto: vi.fn(() => 'mailto:client@acme.com'),
}));

vi.mock('@/components/flow/flow-shell', () => ({
  FlowShell: ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}));

describe('Access request success page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows pending framing instead of completion copy', async () => {
    render(<SuccessPage params={Promise.resolve({ id: 'request-123' })} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /pending client authorization/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/connected when they finish google/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/waiting on acme corp/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/access request created/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/you're done/i)).not.toBeInTheDocument();
  });

  it('prioritizes copy link and email client actions', async () => {
    render(<SuccessPage params={Promise.resolve({ id: 'request-123' })} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /email client/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /preview link/i })).not.toBeInTheDocument();
  });

  it('tracks invite analytics when copy link is clicked', async () => {
    const inviteEvents = await import('@/lib/analytics/invite-events');
    const user = userEvent.setup();

    render(<SuccessPage params={Promise.resolve({ id: 'request-123' })} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /copy link/i }));

    expect(inviteEvents.trackInviteLinkCopied).toHaveBeenCalledWith({
      access_request_id: 'request-123',
      access_request_token: 'token-abc',
      status: 'pending',
      surface: 'success',
    });
    expect(inviteEvents.trackInviteSent).toHaveBeenCalledWith({
      access_request_id: 'request-123',
      access_request_token: 'token-abc',
      channel: 'copy',
      surface: 'success',
      status: 'pending',
    });
    expect(mockCopy).toHaveBeenCalledWith('https://authhub.co/invite/token-abc');
  });
});
