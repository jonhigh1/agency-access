import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstagramAccessGrant } from '../InstagramAccessGrant';

describe('InstagramAccessGrant', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('verifies agency Business Portfolio access without claiming recipient access', async () => {
    const onComplete = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: { assetGrantResults: [
        { assetId: 'ig-1', assetType: 'instagram_account', recipientType: 'business', recipientId: 'agency-bm', status: 'verified' },
        { assetId: 'ig-1', assetType: 'instagram_account', recipientType: 'system_user', recipientId: 'system-1', status: 'unresolved' },
      ] } }),
    } as Response);

    render(<InstagramAccessGrant
      accounts={[{ id: 'ig-1', name: '@client' }]}
      clientBusinessId="client-bm"
      agencyBusinessId="agency-bm"
      connectionId="connection-1"
      accessRequestToken="invite-1"
      onComplete={onComplete}
    />);

    expect(screen.getByRole('link', { name: 'Open Meta Business Settings' })).toHaveAttribute(
      'href', 'https://business.facebook.com/settings/client-bm'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Verify agency Instagram access' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true));
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/api/client/invite-1/grant-meta-access', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ connectionId: 'connection-1', assetTypes: ['instagram_account'] }),
    }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Meta confirmed agency Business Portfolio access. Individual people and system users are not verified here.'
    );
  });

  it('does not confirm access when the agency Business Portfolio is not verified', async () => {
    const onComplete = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: { assetGrantResults: [
        { assetId: 'ig-1', assetType: 'instagram_account', recipientType: 'business', recipientId: 'agency-bm', status: 'unresolved' },
      ] } }),
    } as Response);

    render(<InstagramAccessGrant
      accounts={[{ id: 'ig-1', name: '@client' }]}
      clientBusinessId="client-bm"
      agencyBusinessId="agency-bm"
      connectionId="connection-1"
      accessRequestToken="invite-1"
      onComplete={onComplete}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify agency Instagram access' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(false));
    expect(await screen.findByRole('status')).toHaveTextContent('Meta has not confirmed agency Business Portfolio access');
  });
});
