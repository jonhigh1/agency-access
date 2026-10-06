import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MetaAssetCreator } from '../MetaAssetCreator';
import { MetaBusinessCreator } from '../MetaBusinessCreator';

function response(body: unknown): Response {
  return { ok: true, text: async () => JSON.stringify(body) } as Response;
}

describe('Meta creation recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
  });

  it('offers rediscovery after an ad-account creation has unknown outcome', async () => {
    const onReconcile = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      data: null,
      error: { code: 'CREATION_OUTCOME_UNKNOWN', message: 'Meta may have created this asset. Refresh asset discovery.' },
    })));

    render(
      <MetaAssetCreator
        connectionId="connection-1"
        businessId="business-1"
        accessRequestToken="token-1"
        onReconcile={onReconcile}
      />
    );

    fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Client Ads' } });
    fireEvent.click(screen.getByRole('button', { name: /create ad account/i }));
    fireEvent.click(await screen.findByRole('button', { name: /refresh asset list/i }));

    await waitFor(() => expect(onReconcile).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('offers Meta deep-link guidance when API ad-account creation lacks permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      data: null,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Your Meta account does not have permission to create ad accounts.',
      },
    })));

    render(
      <MetaAssetCreator
        connectionId="connection-1"
        businessId="business-1"
        accessRequestToken="token-1"
        manualCreationUrl="https://business.facebook.com/settings/business-1/ad_accounts"
      />
    );

    fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Client Ads' } });
    fireEvent.click(screen.getByRole('button', { name: /create ad account/i }));

    expect(await screen.findByText(/create an ad account in meta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open meta business manager/i })).toBeInTheDocument();
  });

  it('offers Business Portfolio rediscovery after unknown creation result', async () => {
    const onReconcile = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ data: { timezones: [{ id: '25', name: 'New York', offset: 'UTC-5' }] } }))
      .mockResolvedValueOnce(response({
        data: null,
        error: { code: 'CREATION_OUTCOME_UNKNOWN', message: 'Meta may have created this Business Portfolio. Refresh asset discovery.' },
      })));

    render(
      <MetaBusinessCreator
        connectionId="connection-1"
        accessRequestToken="token-1"
        userPages={[{ id: 'page-1', name: 'Client Page' }]}
        onReconcile={onReconcile}
      />
    );

    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: 'Client Business' } });
    fireEvent.click(screen.getByRole('button', { name: /create business$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /refresh business portfolios/i }));

    await waitFor(() => expect(onReconcile).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});
