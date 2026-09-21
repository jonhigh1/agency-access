import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MetaPageEngagementProof } from '../MetaPageEngagementProof';

describe('MetaPageEngagementProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('reads and displays Page content for the selected Page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            page: { id: 'page_1', name: 'Main Page' },
            posts: [{ id: 'post_1', message: 'Hello from the Page' }],
          },
          error: null,
        }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MetaPageEngagementProof
        selectedPage={{ id: 'page_1', name: 'Main Page' }}
        connectionId="conn-1"
        accessRequestToken="token-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /read page content/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/meta-page-proof?connectionId=conn-1&pageId=page_1',
        { signal: expect.any(AbortSignal) }
      );
    });

    expect(await screen.findByText(/page content returned for main page/i)).toBeInTheDocument();
    expect(screen.getByText('Hello from the Page')).toBeInTheDocument();
  });

  it('shows the Meta permission error instead of claiming success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () =>
          JSON.stringify({
            data: null,
            error: { message: 'This endpoint requires pages_read_engagement' },
          }),
      } as Response)
    );

    render(
      <MetaPageEngagementProof
        selectedPage={{ id: 'page_1', name: 'Main Page' }}
        connectionId="conn-1"
        accessRequestToken="token-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /read page content/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/requires pages_read_engagement/i);
    expect(screen.queryByText(/page content returned/i)).not.toBeInTheDocument();
  });
});
