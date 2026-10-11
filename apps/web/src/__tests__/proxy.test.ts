import { beforeEach, describe, expect, it, vi } from 'vitest';

const protectMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => {
  const createRouteMatcher = (patterns: string[]) => {
    const regexes = patterns.map((pattern) => {
      const wildcardToken = '__WILDCARD__';
      const withToken = pattern.replace(/\(\.\*\)/g, wildcardToken);
      const escaped = withToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const source = `^${escaped.replace(wildcardToken, '.*')}$`;
      return new RegExp(source);
    });

    return (request: Request) => {
      const pathname = new URL(request.url).pathname;
      return regexes.some((regex) => regex.test(pathname));
    };
  };

  return {
    clerkMiddleware: (handler: any) => handler,
    createRouteMatcher,
  };
});

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => ({ redirectedTo: url.toString() }),
    next: () => ({ passedThrough: true }),
  },
}));

describe('proxy public route handling', () => {
  beforeEach(() => {
    protectMock.mockReset();
    delete process.env.NEXT_PUBLIC_BYPASS_AUTH;
    process.env.NODE_ENV = 'test';
  });

  it('does not protect the public affiliate page', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/affiliate'),
    );

    expect(protectMock).not.toHaveBeenCalled();
  });

  it.each([
    '/guides',
    '/guides/meta-ads-access',
    '/guides/google-ads-access',
    '/guides/ga4-access',
    '/guides/linkedin-ads-access',
    '/guides/tiktok-ads-access',
    '/guides/facebook-business-manager-access',
  ])('does not protect public guide route %s', async (path) => {
    const { default: proxy } = await import('../proxy');

    await proxy({ protect: protectMock }, new Request(`https://authhub.test${path}`));

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('does not protect the public stats page', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy({ protect: protectMock }, new Request('https://authhub.test/stats'));

    expect(protectMock).not.toHaveBeenCalled();
  });

  it.each(['/uses', '/uses/ppc-agencies', '/uses/seo-agencies', '/uses/freelancers', '/uses/in-house-teams'])(
    'does not protect public uses route %s',
    async (path) => {
      const { default: proxy } = await import('../proxy');

      await proxy({ protect: protectMock }, new Request(`https://authhub.test${path}`));

      expect(protectMock).not.toHaveBeenCalled();
    },
  );

  it.each(['/tools', '/tools/access-level'])('does not protect public tools route %s', async (path) => {
    const { default: proxy } = await import('../proxy');

    await proxy({ protect: protectMock }, new Request(`https://authhub.test${path}`));

    expect(protectMock).not.toHaveBeenCalled();
  });

  it.each(['/authors', '/authors/jon-high'])('does not protect public author route %s', async (path) => {
    const { default: proxy } = await import('../proxy');

    await proxy({ protect: protectMock }, new Request(`https://authhub.test${path}`));

    expect(protectMock).not.toHaveBeenCalled();
  });

  it.each(['/features', '/features/white-label'])('does not protect public features route %s', async (path) => {
    const { default: proxy } = await import('../proxy');

    await proxy({ protect: protectMock }, new Request(`https://authhub.test${path}`));

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('does not protect the public security page', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy({ protect: protectMock }, new Request('https://authhub.test/security'));

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('does not protect referral redirect routes', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/r/partner-code'),
    );

    expect(protectMock).not.toHaveBeenCalled();
  });

  it.each(['/invite/audit-token', '/authorize/audit-token', '/client/audit-token'])(
    'allows anonymous clients to reach invitation route %s',
    async (path) => {
      const { default: proxy } = await import('../proxy');

      await proxy({ protect: protectMock }, new Request(`https://authhub.test${path}`));

      expect(protectMock).not.toHaveBeenCalled();
    },
  );

  it('does not protect sitemap.xml (required for Google Search Console)', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/sitemap.xml'),
    );

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('does not protect robots.txt (required for crawler discovery)', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/robots.txt'),
    );

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('does not protect the sign-in flow', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/sign-in/factor-one'),
    );

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('does not protect the sign-in page', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/sign-in'),
    );

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('does not protect the sign-up flow', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/sign-up/verify-email-address'),
    );

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('does not protect the sign-up page', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/sign-up'),
    );

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('still protects partner portal routes', async () => {
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/partners'),
    );

    expect(protectMock).toHaveBeenCalledTimes(1);
  });

  it('does not protect dashboard routes for the local perf harness in development', async () => {
    process.env.NODE_ENV = 'development';
    const { default: proxy } = await import('../proxy');

    await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/dashboard', {
        headers: {
          'x-perf-harness': '1',
        },
      }),
    );

    expect(protectMock).not.toHaveBeenCalled();
  });

  it('returns 404 for internal harness routes in production', async () => {
    process.env.NODE_ENV = 'production';
    const { default: proxy } = await import('../proxy');

    const response = await proxy(
      { protect: protectMock },
      new Request('https://authhub.test/test/access-request'),
    );

    expect(response).toMatchObject({ status: 404 });
    expect(protectMock).not.toHaveBeenCalled();
  });
});

describe('proxy PostHog ingest handling', () => {
  beforeEach(() => {
    protectMock.mockReset();
    delete process.env.NEXT_PUBLIC_BYPASS_AUTH;
    process.env.NODE_ENV = 'test';
  });

  describe('middleware handler', () => {
    it.each([
      '/ingest/e/?ip=1&_=&v=1',
      '/ingest/batch/',
      '/ingest/decide?v=3',
      '/ingest/static/array.js',
    ])('does not protect PostHog beacon path %s for anonymous visitors', async (pathname) => {
      const { default: proxy } = await import('../proxy');

      const response = await proxy(
        { protect: protectMock },
        new Request(`https://authhub.test${pathname}`),
      );

      expect(response).toBeUndefined();
      expect(protectMock).not.toHaveBeenCalled();
    });

    it('still protects the dashboard for anonymous visitors (sign-in redirect path)', async () => {
      const { default: proxy } = await import('../proxy');

      await proxy({ protect: protectMock }, new Request('https://authhub.test/dashboard'));

      expect(protectMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('matcher config', () => {
    // Next.js compiles each matcher entry as a full-path match.
    const middlewareMatcher = async () => {
      const { config } = await import('../proxy');
      return new RegExp(`^${config.matcher[0]}$`);
    };

    it.each(['/ingest', '/ingest/e/', '/ingest/batch/', '/ingest/static/array.js'])(
      'excludes PostHog ingest path %s from middleware (rewrite serves the proxy)',
      async (pathname) => {
        expect((await middlewareMatcher()).test(pathname)).toBe(false);
      },
    );

    it.each(['/ingest-notes', '/dashboard/clients', '/settings'])(
      'keeps non-ingest app route %s inside middleware (auth still applies)',
      async (pathname) => {
        expect((await middlewareMatcher()).test(pathname)).toBe(true);
      },
    );

    it('keeps api routes excluded from the middleware as before', async () => {
      expect((await middlewareMatcher()).test('/api/projects')).toBe(false);
    });
  });
});
