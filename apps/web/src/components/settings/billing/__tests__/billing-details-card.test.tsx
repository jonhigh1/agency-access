import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingDetailsCard } from '../billing-details-card';

const { mutateAsync, billingDetails } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  billingDetails: { name: 'Acme', email: 'billing@acme.test', address: {} },
}));

vi.mock('@/lib/query/billing', () => ({
  useBillingDetails: () => ({ data: billingDetails, isLoading: false }),
  useUpdateBillingDetails: () => ({ mutateAsync, isPending: false }),
}));

describe('BillingDetailsCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps edited values and gives actionable feedback when save fails', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('offline'));
    render(<BillingDetailsCard />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), { target: { value: 'Acme West' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your changes are still here. Try again.');
    expect(screen.getByRole('textbox', { name: 'Company name' })).toHaveValue('Acme West');
  });

  it('confirms a successful save', async () => {
    mutateAsync.mockResolvedValueOnce({});
    render(<BillingDetailsCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Billing details saved.'));
  });
});
