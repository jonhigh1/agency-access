import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClientDetailHeader } from '../ClientDetailHeader';

describe('ClientDetailHeader narrow content', () => {
  it('keeps long client details readable within their text column', () => {
    const email = 'accounts-payable-and-marketing-operations@exceptionally-long-client-domain.example';
    render(<ClientDetailHeader client={{
      id: 'client-1', name: 'An exceptionally long client contact name', company: 'A very long company name',
      email, website: null, language: 'en', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    }} />);

    expect(screen.getByRole('heading', { name: 'An exceptionally long client contact name' })).toHaveClass('break-words');
    expect(screen.getByText(email)).toHaveClass('break-all');
  });
});
