import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuccessLinkScreen } from '../success-link-screen';

const mockCopy = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
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
      screen.getByText(/your access link is ready\. share it — you're done when they connect google\./i)
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
    expect(screen.getByText(/connected when they finish google/i)).toBeInTheDocument();
    expect(screen.getByText(/they open this link and connect google/i)).toBeInTheDocument();
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
});
