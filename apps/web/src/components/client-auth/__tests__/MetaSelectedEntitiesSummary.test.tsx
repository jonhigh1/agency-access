import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetaSelectedEntitiesSummary } from '../MetaSelectedEntitiesSummary';

describe('MetaSelectedEntitiesSummary', () => {
  it('renders selected portfolio and assets with name and id', () => {
    render(
      <MetaSelectedEntitiesSummary
        clientBusiness={{ name: 'DogTimez Retail', id: 'biz_client_2' }}
        adAccounts={[{ name: 'DogTimez Ads', id: 'act_813104320370861' }]}
        pages={[{ name: 'DogTimez Facebook', id: 'page_1001' }]}
      />
    );

    expect(screen.getByRole('region', { name: /selected meta assets/i })).toBeInTheDocument();
    expect(screen.getByText(/DogTimez Retail · ID biz_client_2/)).toBeInTheDocument();
    expect(screen.getByText(/DogTimez Ads · ID act_813104320370861/)).toBeInTheDocument();
    expect(screen.getByText(/DogTimez Facebook · ID page_1001/)).toBeInTheDocument();
  });
});
