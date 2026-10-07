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

function mockOAuthCallbackFetch(options?: {
  reviewDemoHint?: boolean;
  clientExchangeBody?: unknown;
  clientExchangeOk?: boolean;
}) {
  const reviewDemoHint = options?.reviewDemoHint ?? false;
  const clientExchangeOk = options?.clientExchangeOk ?? true;
  const clientExchangeBody =
    options?.clientExchangeBody ??
    ({
      data: {
        connectionId: 'conn-1',
        token: 'token-1',
        platform: 'google',
      },
      error: null,
    } as const);

  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/review-demo/meta/oauth-flow')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: { reviewDemo: reviewDemoHint } }),
      } as Response);
    }
    if (url.includes('/api/review-demo/meta/exchange')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: {} }),
      } as Response);
    }
    if (url.includes('/api/client/oauth-exchange')) {
      return Promise.resolve({
        ok: clientExchangeOk,
        text: async () => JSON.stringify(clientExchangeBody),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  });
}

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
    mockOAuthCallbackFetch({ reviewDemoHint: false });

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/review-demo/meta/oauth-flow?state=oauth-state',
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );
    });

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

  it('uses review-demo meta exchange when oauth-flow hint returns reviewDemo true', async () => {
    mockOAuthCallbackFetch({ reviewDemoHint: true });

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/review-demo/meta/oauth-flow?state=oauth-state',
        expect.any(Object)
      );
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/review-demo/meta/exchange',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ code: 'oauth-code', state: 'oauth-state' }),
        })
      );
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/review-demo?connected=1');
    });

    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/api/client/oauth-exchange'))
    ).toBe(false);
  });

  it('falls through to client oauth exchange when oauth-flow hint returns reviewDemo false', async () => {
    mockOAuthCallbackFetch({ reviewDemoHint: false });

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/oauth-exchange',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/api/review-demo/meta/exchange'))
    ).toBe(false);
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
    mockOAuthCallbackFetch({
      reviewDemoHint: false,
      clientExchangeBody: {
        data: { connectionId: 'conn-1', token: 'invite-secret', platform: 'meta' },
        error: null,
      },
    });

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith({
      type: 'authhub:oauth-result', success: true, connectionId: 'conn-1', platform: 'meta',
    }, window.location.origin));
    expect(JSON.stringify(opener.postMessage.mock.calls)).not.toContain('invite-secret');
    expect(window.close).toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('shows a controlled error when the oauth exchange returns non-JSON', async () => {
    mockOAuthCallbackFetch({ reviewDemoHint: false });
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/review-demo/meta/oauth-flow')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { reviewDemo: false } }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '<!doctype html><html><body>Not JSON</body></html>',
      } as Response);
    });

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
    mockOAuthCallbackFetch({
      reviewDemoHint: false,
      clientExchangeOk: false,
      clientExchangeBody: { data: null, error: { code, message: 'Private failure detail' } },
    });
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/review-demo/meta/oauth-flow')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { reviewDemo: false } }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status,
        text: async () => JSON.stringify({ data: null, error: { code, message: 'Private failure detail' } }),
      } as Response);
    });

    render(<ClientOAuthCallbackPage />);

    await waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith({
      type: 'authhub:oauth-result', success: false, errorCode: 'OAUTH_EXCHANGE_FAILED',
    }, window.location.origin));
    expect(JSON.stringify(opener.postMessage.mock.calls)).not.toContain('Private failure detail');
    expect(window.close).toHaveBeenCalled();
  });
});
