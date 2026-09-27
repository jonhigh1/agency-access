import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogAccessGrant } from '../CatalogAccessGrant';

describe('CatalogAccessGrant', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('requires every returned recipient result to verify before marking the catalog complete', async () => {
    const onComplete = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: { success: true, partial: false, assetGrantResults: [
        { assetId: 'catalog-1', assetType: 'catalog', recipientType: 'business', status: 'verified' },
        { assetId: 'catalog-1', assetType: 'catalog', recipientType: 'system_user', status: 'verified' },
      ] } }),
    } as Response);

    render(<CatalogAccessGrant catalogs={[{ id: 'catalog-1', name: 'Shop' }]} connectionId="connection-1" accessRequestToken="invite-1" onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grant catalog access' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true));
    expect(await screen.findByRole('status')).toHaveTextContent('granted and verified');
  });

  it('does not claim completion when one recipient grant fails', async () => {
    const onComplete = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: { assetGrantResults: [
        { assetId: 'catalog-1', assetType: 'catalog', recipientType: 'business', status: 'verified' },
        { assetId: 'catalog-1', assetType: 'catalog', recipientType: 'human', status: 'failed' },
      ] } }),
    } as Response);

    render(<CatalogAccessGrant catalogs={[{ id: 'catalog-1', name: 'Shop' }]} connectionId="connection-1" accessRequestToken="invite-1" onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grant catalog access' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(false));
    expect(await screen.findByRole('status')).toHaveTextContent('could not be verified');
  });

  it('uses catalog results when the API marks an unrelated asset result partial', async () => {
    const onComplete = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: { success: false, partial: true, assetGrantResults: [
        { assetId: 'catalog-1', assetType: 'catalog', recipientType: 'business', status: 'verified' },
        { assetId: 'page-1', assetType: 'page', recipientType: 'business', status: 'failed' },
      ] } }),
    } as Response);

    render(<CatalogAccessGrant catalogs={[{ id: 'catalog-1', name: 'Shop' }]} connectionId="connection-1" accessRequestToken="invite-1" onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grant catalog access' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true));
    expect(await screen.findByRole('status')).toHaveTextContent('granted and verified');
  });

  it('ignores a catalog grant result after its selection component unmounts', async () => {
    const onComplete = vi.fn();
    let resolveGrant!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((resolve) => { resolveGrant = resolve; }));

    const view = render(<CatalogAccessGrant catalogs={[{ id: 'catalog-1', name: 'Shop' }]} connectionId="connection-1" accessRequestToken="invite-1" onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grant catalog access' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    view.unmount();

    await act(async () => resolveGrant({
      ok: true,
      text: async () => JSON.stringify({ data: { success: true, partial: false, assetGrantResults: [
        { assetId: 'catalog-1', assetType: 'catalog', status: 'verified' },
      ] } }),
    } as Response));

    expect(onComplete).not.toHaveBeenCalled();
  });
});
