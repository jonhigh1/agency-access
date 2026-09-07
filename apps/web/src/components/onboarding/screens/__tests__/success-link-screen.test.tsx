import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuccessLinkScreen } from '../success-link-screen';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteLinkCopied: vi.fn(),
  trackInviteSent: vi.fn(),
  buildInviteSentMailto: vi.fn(),
}));

describe('SuccessLinkScreen', () => {
  it('uses pending framing instead of celebration copy', () => {
    render(
      <SuccessLinkScreen
        accessLink="https://authhub.co/authorize/token-123"
        clientName="Acme Corp"
        clientEmail="client@acme.com"
        accessRequestId="request-123"
        selectedPlatforms={['google_ads'] as never[]}
      />
    );

    expect(screen.getByRole('heading', { name: /pending — waiting on acme corp/i })).toBeInTheDocument();
    expect(screen.getAllByText(/connected when they finish google/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/celebrate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/congratulations/i)).not.toBeInTheDocument();
  });
});
