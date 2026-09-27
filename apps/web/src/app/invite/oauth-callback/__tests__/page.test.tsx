import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ClientOAuthCallbackPage from '../page';

const { pushMock, replaceMock, searchParamGetMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  searchParamGetMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  useSearchParams: () => ({
    get: searchParamGetMock,
  }),
}));

vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/logo-spinner', () => ({
  LogoSpinner: () => <div>Loading</div>,
}));

describe('ClientOAuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
    searchParamGetMock.mockImplementation((param: string) => {
      if (param === 'code') return 'oauth-code';
      if (param === 'state') return 'oauth-state';
      return null;
    });
    global.fetch = vi.fn();
  });

  it('posts the oauth exchange to the configured API host', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            connectionId: 'conn-1',
            token: 'token-1',
            platform: 'google',
          },
          error: null,
        }),
    } as Response);

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/oauth-exchange',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ code: 'oauth-code', state: 'oauth-state' }),
        })
      );
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/invite/token-1?connectionId=conn-1&platform=google&step=2');
    });
  });

  it('posts only a safe completion message to the opener for popup OAuth', async () => {
    searchParamGetMock.mockImplementation((param: string) => {
      if (param === 'code') return 'oauth-code';
      if (param === 'state') return 'oauth-state';
      if (param === 'presentation') return 'popup';
      return null;
    });
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', { configurable: true, value: opener });
    vi.spyOn(window, 'close').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        data: { connectionId: 'conn-1', token: 'invite-secret', platform: 'meta' }, error: null,
      }),
    } as Response);

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith({
      type: 'authhub:oauth-result', success: true, connectionId: 'conn-1', platform: 'meta',
    }, window.location.origin));
    expect(JSON.stringify(opener.postMessage.mock.calls)).not.toContain('invite-secret');
    expect(window.close).toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('shows a controlled error when the oauth exchange returns non-JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '<!doctype html><html><body>Not JSON</body></html>',
    } as Response);

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/authorization service returned an unexpected response/i)).toBeInTheDocument();
    });
  });

  it('shows a recoverable message when the client declines provider access', async () => {
    searchParamGetMock.mockImplementation((param: string) => {
      if (param === 'error') return 'access_denied';
      if (param === 'error_reason') return 'user_denied';
      return null;
    });

    render(<ClientOAuthCallbackPage />);

    expect(await screen.findByText(/you declined or cancelled access/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a safe denial result to the opener for popup OAuth', async () => {
    searchParamGetMock.mockImplementation((param: string) => {
      if (param === 'error') return 'access_denied';
      if (param === 'error_reason') return 'user_denied';
      if (param === 'presentation') return 'popup';
      return null;
    });
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', { configurable: true, value: opener });
    vi.spyOn(window, 'close').mockImplementation(() => {});

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith({
      type: 'authhub:oauth-result', success: false, errorCode: 'OAUTH_DENIED',
    }, window.location.origin));
    expect(fetch).not.toHaveBeenCalled();
    expect(window.close).toHaveBeenCalled();
  });

  it.each([
    ['expired request', 404, 'INVITE_EXPIRED'],
    ['callback state mismatch', 400, 'INVALID_OAUTH_STATE'],
  ])('returns a recoverable result for %s in popup OAuth', async (_label, status, code) => {
    searchParamGetMock.mockImplementation((param: string) => {
      if (param === 'code') return 'oauth-code';
      if (param === 'state') return 'oauth-state';
      if (param === 'presentation') return 'popup';
      return null;
    });
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', { configurable: true, value: opener });
    vi.spyOn(window, 'close').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status,
      text: async () => JSON.stringify({ data: null, error: { code, message: 'Private failure detail' } }),
    } as Response);

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith({
      type: 'authhub:oauth-result', success: false, errorCode: 'OAUTH_EXCHANGE_FAILED',
    }, window.location.origin));
    expect(JSON.stringify(opener.postMessage.mock.calls)).not.toContain('Private failure detail');
    expect(window.close).toHaveBeenCalled();
  });
});
