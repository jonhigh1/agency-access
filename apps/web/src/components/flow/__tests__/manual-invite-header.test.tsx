import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManualInviteHeader } from '../manual-invite-header';

describe('ManualInviteHeader', () => {
  it('names the platform, the agency, and the manual-invite promise', () => {
    render(
      <ManualInviteHeader
        agencyName="Demo Agency"
        platformName="Beehiiv"
        securityNote="Only you approve the invite."
      />
    );

    expect(screen.getByRole('heading', { name: /complete beehiiv access/i })).toBeInTheDocument();
    expect(screen.getByText(/demo agency/i)).toBeInTheDocument();
    expect(screen.getByText(/manual invite/i)).toBeInTheDocument();
  });
});
