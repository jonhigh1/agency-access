import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetaPartnerGrantNarrative } from '../MetaPartnerGrantNarrative';

describe('MetaPartnerGrantNarrative', () => {
  it('shows Partner language, agency Business ID, and Manual vs Automatic badges', () => {
    render(
      <MetaPartnerGrantNarrative
        agencyBusinessId="3808519629379919"
        agencyBusinessName="Outdoor DIY"
        clientBusinessId="biz_client_2"
        clientBusinessName="DogTimez Retail"
        selectedKinds={['page', 'ad_account']}
      />
    );

    expect(screen.getByRole('region', { name: /partner access/i })).toBeInTheDocument();
    expect(screen.getByText(/3808519629379919/)).toBeInTheDocument();
    expect(screen.getByText('Automatic')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText(/Partner share in Meta Business Settings/)).toBeInTheDocument();
    expect(screen.getByText(/business_management/i)).toBeInTheDocument();
    expect(screen.getByText(/orchestr/i)).toBeInTheDocument();
    expect(screen.getByText(/remove the Partner/i)).toBeInTheDocument();
  });
});
