import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AutomaticPagesPartnerReadbackVisualQaPage from '../07-automatic-pages-partner-readback/page';
import PostGrantAutoAssignVisualQaPage from '../08-post-grant-auto-assign/page';

describe('Visual QA fixtures — CF-06 read-back (#114)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('route 07 simulate granted shows success read-back', async () => {
    render(<AutomaticPagesPartnerReadbackVisualQaPage />);

    fireEvent.click(screen.getByRole('button', { name: /simulate granted read-back/i }));

    await waitFor(() => {
      expect(screen.getByTestId('automatic-pages-readback-success')).toBeInTheDocument();
      expect(screen.getByText('Demo Page')).toBeInTheDocument();
    });
  });

  it('route 07 simulate failed shows failure read-back and next action', async () => {
    render(<AutomaticPagesPartnerReadbackVisualQaPage />);

    fireEvent.click(screen.getByRole('button', { name: /simulate failed read-back/i }));

    await waitFor(() => {
      expect(screen.getByTestId('automatic-pages-readback-failure')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try grant access again/i })).toBeEnabled();
    });
  });

  it('route 08 offers retry when Auto-Assign failed', async () => {
    const user = userEvent.setup();
    render(<PostGrantAutoAssignVisualQaPage />);

    expect(screen.getByTestId('meta-auto-assign-retry-failed')).toBeInTheDocument();
    await user.click(screen.getByTestId('meta-auto-assign-retry-failed'));
    await waitFor(() => {
      expect(screen.getByTestId('visual-qa-08-retry-status')).toHaveTextContent(/fixture retry queued/i);
    });
  });
});
