import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuccessLinkScreen } from '../success-link-screen';

const mockCopy = vi.fn();

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({ copied: false, copy: mockCopy }),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteLinkCopyAndSent: vi.fn(),
  trackInviteLinkCopied: vi.fn(),
  trackInviteSent: vi.fn(),
  trackInviteEmailSent: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'token-123') }),
}));

describe('SuccessLinkScreen (wizard Success step)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Growth A copy — pending headline and subhead, no celebration', () => {
    render(
      <SuccessLinkScreen
        accessLink="https://authhub.co/authorize/token-123"
        agencyName="Growth Agency"
        accessRequestId="request-123"
      />
    );

    expect(screen.getByRole('heading', { name: /waiting on your client/i })).toBeInTheDocument();
    expect(
      screen.getByText(/your access link is ready\. share it so your client can authorize the requested platforms\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/setup complete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/you're all set/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/onboarding complete/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/congratulations/i)).not.toBeInTheDocument();
  });

  it('renders B1 client preview and B2 connected example', () => {
    render(
      <SuccessLinkScreen
        accessLink="https://authhub.co/authorize/token-123"
        agencyName="Growth Agency"
        accessRequestId="request-123"
      />
    );

    expect(screen.getByRole('heading', { name: /what your client sees/i })).toBeInTheDocument();
    expect(screen.getByText(/client authorization pending/i)).toBeInTheDocument();
    expect(screen.getByText(/they open this link and authorize the requested platforms/i)).toBeInTheDocument();
    expect(screen.getByText('https://authhub.co/authorize/token-123')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /when they connect, you'll see/i })).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText("That's the finish line — not creating the link.")).toBeInTheDocument();
  });

  it('fires invite copy/send analytics after successful clipboard write', async () => {
    const inviteEvents = await import('@/lib/analytics/invite-events');
    const user = userEvent.setup();
    mockCopy.mockImplementation(async (_text, onCopy) => {
      onCopy?.();
      return true;
    });

    render(
      <SuccessLinkScreen
        accessLink="https://authhub.co/authorize/token-123"
        agencyName="Growth Agency"
        accessRequestId="request-123"
      />
    );

    await user.click(screen.getByRole('button', { name: /copy link/i }));

    expect(mockCopy).toHaveBeenCalledWith(
      'https://authhub.co/authorize/token-123',
      expect.any(Function)
    );
    expect(inviteEvents.trackInviteLinkCopyAndSent).toHaveBeenCalledWith({
      access_request_id: 'request-123',
      access_request_token: 'token-123',
      status: 'pending',
      surface: 'onboarding',
    });
    expect(inviteEvents.trackInviteLinkCopied).not.toHaveBeenCalled();
    expect(inviteEvents.trackInviteSent).not.toHaveBeenCalled();
  });

  it('reports clipboard failure instead of claiming the link was copied', async () => {
    mockCopy.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(
      <SuccessLinkScreen
        accessLink="https://authhub.co/authorize/token-123"
        accessRequestId="request-123"
      />
    );

    await user.click(screen.getByRole('button', { name: /copy link/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not copy the link/i);
  });
  it('offers Send invite with the client email next to Copy Link', () => {
    render(
      <SuccessLinkScreen
        accessLink="https://authhub.co/invite/token-123"
        agencyName="Growth Agency"
        accessRequestId="request-123"
        clientEmail="client@example.com"
      />
    );

    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Client email')).toHaveValue('client@example.com');
    expect(screen.getByRole('button', { name: /send invite/i })).toBeInTheDocument();
  });
});
