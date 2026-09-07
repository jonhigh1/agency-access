import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinalSuccessScreen } from '../final-success-screen';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
  },
}));

describe('FinalSuccessScreen', () => {
  it('shows pending activation framing instead of setup complete copy', () => {
    render(
      <FinalSuccessScreen
        agencyName="Growth Agency"
        clientName="Acme Corp"
        accessRequestId="request-123"
        teamInvitesSent={0}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /pending — waiting on acme corp/i })).toBeInTheDocument();
    expect(screen.getByText(/connected when they finish google/i)).toBeInTheDocument();
    expect(screen.getByText(/client authorization pending/i)).toBeInTheDocument();
    expect(screen.queryByText(/you're all set/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/setup complete/i)).not.toBeInTheDocument();
  });
});
