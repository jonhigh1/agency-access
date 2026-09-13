import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CancelSubscriptionModal } from '../cancel-subscription-modal';

const mockMutateAsync = vi.fn();

vi.mock('@/lib/query/billing', () => ({
  useCancelSubscription: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ orgId: 'org_1', userId: 'user_1' }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});

describe('CancelSubscriptionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it('renders nothing when closed', () => {
    const { container } = render(<CancelSubscriptionModal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an accessible dialog labelled by its heading', () => {
    render(<CancelSubscriptionModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const heading = screen.getByRole('heading', { name: 'Cancel Subscription' });
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('cancels at the end of the period by default', async () => {
    render(<CancelSubscriptionModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({ cancelAtPeriodEnd: true }));
  });

  it('cancels immediately when that option is chosen', async () => {
    render(<CancelSubscriptionModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: /immediately/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({ cancelAtPeriodEnd: false }));
  });

  it('reveals the feedback textarea and swaps the confirm label once feedback is typed', () => {
    render(<CancelSubscriptionModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /tell us why/i }));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Too expensive' } });

    expect(screen.queryByRole('button', { name: /^confirm cancellation$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows the error with the danger ink token when the mutation fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Portal unavailable'));
    render(<CancelSubscriptionModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    const error = await screen.findByText('Portal unavailable');
    expect(error.className).toContain('text-danger-ink');
  });

  it('Keep Subscription closes without cancelling', () => {
    const onClose = vi.fn();
    render(<CancelSubscriptionModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /keep subscription/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
