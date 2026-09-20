import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequestActionsBar } from '../request-actions-bar';
import * as accessRequestsApi from '@/lib/api/access-requests';
import * as capturePosthog from '@/lib/analytics/capture-posthog';

const push = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('token-123'),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/api/access-requests', () => ({
  cancelAccessRequest: vi.fn(),
}));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: vi.fn().mockResolvedValue(undefined),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function openModalAndConfirm() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /cancel request/i }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: /^cancel request$/i }));
  return user;
}

describe('RequestActionsBar cancel flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes the modal and reports success when cancel succeeds', async () => {
    vi.mocked(accessRequestsApi.cancelAccessRequest).mockResolvedValue({ data: { success: true } });
    const onRevokeSuccess = vi.fn();

    renderWithProviders(
      <RequestActionsBar requestId="request-1" status="pending" onRevokeSuccess={onRevokeSuccess} />
    );

    await openModalAndConfirm();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onRevokeSuccess).toHaveBeenCalled();
  });

  it('surfaces the error and keeps the modal open when cancel fails', async () => {
    vi.mocked(accessRequestsApi.cancelAccessRequest).mockResolvedValue({
      error: { code: 'REQUEST_FAILED', message: 'Something went wrong on our side.' },
    });

    renderWithProviders(<RequestActionsBar requestId="request-1" status="pending" />);

    await openModalAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(capturePosthog.capturePosthogEvent).toHaveBeenCalledWith('cancel_request_failed', {
      access_request_id: 'request-1',
      error_code: 'REQUEST_FAILED',
    });
  });

  it('prompts re-authentication and redirects to sign-in on a 401', async () => {
    vi.mocked(accessRequestsApi.cancelAccessRequest).mockResolvedValue({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' },
    });

    renderWithProviders(<RequestActionsBar requestId="request-1" status="pending" />);

    await openModalAndConfirm();

    expect(await screen.findByRole('alert')).toHaveTextContent(/session has expired/i);
    expect(push).toHaveBeenCalledWith('/sign-in');
    expect(capturePosthog.capturePosthogEvent).toHaveBeenCalledWith('cancel_request_failed', {
      access_request_id: 'request-1',
      error_code: 'UNAUTHORIZED',
    });
  });
});
