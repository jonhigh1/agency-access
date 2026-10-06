import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MetaPageEngagementProof } from '../MetaPageEngagementProof';

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: captureMock,
}));

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
            page: {
              id: 'page_1',
              name: 'Main Page',
              category: 'Local business',
              managedTasks: ['MANAGE', 'ADVERTISE'],
              followerCount: 150,
            },
            connectedInstagram: { id: 'ig_1', username: 'mainpage' },
            posts: [{ id: 'post_1', createdTime: '2026-09-21T00:00:00+0000' }],
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

    fireEvent.click(screen.getByRole('button', { name: /validate page access/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/meta-page-proof?connectionId=conn-1&pageId=page_1',
        { signal: expect.any(AbortSignal) }
      );
    });

    expect(await screen.findByText(/page access validated for main page/i)).toBeInTheDocument();
    expect(screen.getByText('MANAGE, ADVERTISE')).toBeInTheDocument();
    expect(screen.getByText('@mainpage')).toBeInTheDocument();
    expect(screen.getByText('Recent public post date')).toBeInTheDocument();
    expect(screen.getByText(/does not grant your agency page management rights/i)).toBeInTheDocument();
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-21T00:00:00+0000');
    expect(captureMock).toHaveBeenCalledWith('client_meta_page_proof_started', {
      connection_id: 'conn-1',
      page_id: 'page_1',
    });
    expect(captureMock).toHaveBeenCalledWith('client_meta_page_proof_succeeded', {
      connection_id: 'conn-1',
      page_id: 'page_1',
      post_count: 1,
      has_connected_instagram: true,
    });
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

    fireEvent.click(screen.getByRole('button', { name: /validate page access/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/requires pages_read_engagement/i);
    expect(screen.queryByText(/page access validated/i)).not.toBeInTheDocument();
    expect(captureMock).toHaveBeenCalledWith('client_meta_page_proof_failed', {
      connection_id: 'conn-1',
      page_id: 'page_1',
      error_code: 'API_RESPONSE_ERROR',
      failure_reason: 'api_response',
    });
    expect(JSON.stringify(captureMock.mock.calls)).not.toContain('pages_read_engagement');
  });

  it('shows successful validation when Meta returns no recent public posts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({
          data: {
            page: { id: 'page_1', name: 'Main Page', managedTasks: [] },
            posts: [],
          },
          error: null,
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

    fireEvent.click(screen.getByRole('button', { name: /validate page access/i }));

    expect(await screen.findByText(/page access validated for main page/i)).toBeInTheDocument();
    expect(screen.getByText('No recent public posts were returned.')).toBeInTheDocument();
    expect(screen.queryByText('Recent Page post')).not.toBeInTheDocument();
  });

  it('never renders post message or story text when the API mistakenly includes them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              page: { id: 'page_1', name: 'Main Page', managedTasks: ['MANAGE'] },
              posts: [
                {
                  id: 'post_1',
                  createdTime: '2026-09-21T00:00:00+0000',
                  message: 'This caption must never appear',
                  story: 'This story must never appear',
                },
              ],
            },
            error: null,
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

    fireEvent.click(screen.getByRole('button', { name: /validate page access/i }));

    expect(await screen.findByText(/page access validated for main page/i)).toBeInTheDocument();
    expect(screen.getByText('Recent public post date')).toBeInTheDocument();
    expect(screen.queryByText(/this caption must never appear/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/this story must never appear/i)).not.toBeInTheDocument();
    expect(screen.getByText(/partner page manage grants are separate/i)).toBeInTheDocument();
  });

  it('shows a reconnect instruction when Meta rejects the user or Page token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => JSON.stringify({
          data: null,
          error: {
            code: 'REAUTHORIZATION_REQUIRED',
            message: 'Meta access expired or the Page token is invalid. Reconnect Meta and try again.',
          },
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

    fireEvent.click(screen.getByRole('button', { name: /validate page access/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/reconnect meta and try again/i);
    expect(screen.queryByText(/page access validated/i)).not.toBeInTheDocument();
    expect(captureMock).toHaveBeenCalledWith('client_meta_page_proof_failed', {
      connection_id: 'conn-1',
      page_id: 'page_1',
      error_code: 'REAUTHORIZATION_REQUIRED',
      failure_reason: 'api_response',
    });
  });
});
