import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateRequestModal } from '../CreateRequestModal';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ orgId: null, userId: 'user_test', getToken: vi.fn() }),
}));
vi.mock('@/lib/api/authorized-api-fetch', () => ({ authorizedApiFetch: vi.fn() }));

const FLAG = 'NEXT_PUBLIC_META_PENDING_APPROVAL';
const original = process.env[FLAG];

afterEach(() => {
  if (original === undefined) delete process.env[FLAG];
  else process.env[FLAG] = original;
});

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateRequestModal
        client={{ id: 'client-1', name: 'Example Client', email: 'client@example.com', company: 'Example Co' }}
        onClose={vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe('CreateRequestModal: Meta pending approval flag', () => {
  it('flag on: Google is preselected and Meta is pending, not selectable', () => {
    process.env[FLAG] = 'true';
    renderModal();

    // Google products are preselected (Google group expanded).
    expect(screen.getByRole('checkbox', { name: /Google Ads/i })).toBeChecked();

    const meta = screen.getByTestId('platform-group-pending-meta');
    expect(meta).toHaveTextContent('Pending Meta approval (coming soon)');
    expect(meta).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: /Select all Meta products/i })).not.toBeInTheDocument();
  });

  it('flag off: nothing is preselected and Meta is a normal selectable group', () => {
    delete process.env[FLAG];
    renderModal();

    expect(screen.queryByTestId('platform-group-pending-meta')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Meta approval (coming soon)')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Google Ads/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Select all Meta products/i }));
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });
});
