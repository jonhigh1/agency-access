/**
 * Tests for Vercel deploy-status access (U2, R4, R13).
 *
 * All tests run against a fake `fetch` injected per-call — no network, no
 * global fetch mutation. Response objects implement only the surface this
 * module reads (ok, status, statusText, json, text).
 */

import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOG_EXCERPT_MAX_CHARS,
  VercelApiError,
  getVercelBuildLogExcerpt,
  getVercelDeployment,
  listVercelDeployments,
  reduceVercelEventsToExcerpt,
  type VercelDeployment,
  type VercelDeploymentEvent,
  type VercelFetch,
} from '../vercel';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(status: number, statusText: string, bodyText = ''): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => {
      throw new Error('not json');
    },
    text: async () => bodyText,
  } as unknown as Response;
}

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): VercelFetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    handler(String(input), init)
  ) as unknown as VercelFetch;
}

describe('listVercelDeployments', () => {
  it('requests /v7/deployments filtered by projectId, target=production, and state', async () => {
    const deployments: VercelDeployment[] = [
      { uid: 'dpl_1', url: 'my-app-abc.vercel.app', readyState: 'ERROR', errorCode: 'BUILD_FAILED' },
    ];
    let capturedUrl = '';
    let capturedAuth: string | undefined;
    const fetch = fakeFetch((url, init) => {
      capturedUrl = url;
      capturedAuth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return jsonResponse(200, { deployments });
    });

    const result = await listVercelDeployments({
      token: 'tok_123',
      projectId: 'prj_abc',
      state: 'ERROR',
      fetch,
    });

    expect(result).toEqual(deployments);
    expect(capturedUrl).toContain('/v7/deployments?');
    expect(capturedUrl).toContain('projectId=prj_abc');
    expect(capturedUrl).toContain('target=production');
    expect(capturedUrl).toContain('state=ERROR');
    expect(capturedAuth).toBe('Bearer tok_123');
  });

  it('includes teamId only when provided', async () => {
    let capturedUrl = '';
    const fetch = fakeFetch((url) => {
      capturedUrl = url;
      return jsonResponse(200, { deployments: [] });
    });

    await listVercelDeployments({ token: 't', projectId: 'p', fetch });
    expect(capturedUrl).not.toContain('teamId');

    await listVercelDeployments({ token: 't', projectId: 'p', teamId: 'team_1', fetch });
    expect(capturedUrl).toContain('teamId=team_1');
  });

  it('returns an empty array — a defined "no deployment found" result — rather than throwing', async () => {
    const fetch = fakeFetch(() => jsonResponse(200, { deployments: [] }));

    const result = await listVercelDeployments({ token: 't', projectId: 'p', fetch });

    expect(result).toEqual([]);
  });

  it('surfaces a 401 as a typed VercelApiError identifying platform and status code', async () => {
    const fetch = fakeFetch(() => errorResponse(401, 'Unauthorized', 'invalid token'));

    await expect(listVercelDeployments({ token: 'bad', projectId: 'p', fetch })).rejects.toMatchObject(
      {
        platform: 'vercel',
        statusCode: 401,
      }
    );
    await expect(listVercelDeployments({ token: 'bad', projectId: 'p', fetch })).rejects.toBeInstanceOf(
      VercelApiError
    );
  });
});

describe('getVercelDeployment', () => {
  it('fetches a single deployment by id or url', async () => {
    const deployment: VercelDeployment = { uid: 'dpl_1', url: 'my-app.vercel.app', readyState: 'READY' };
    let capturedUrl = '';
    const fetch = fakeFetch((url) => {
      capturedUrl = url;
      return jsonResponse(200, deployment);
    });

    const result = await getVercelDeployment({ token: 't', idOrUrl: 'my-app.vercel.app', fetch });

    expect(result).toEqual(deployment);
    expect(capturedUrl).toContain('/v13/deployments/my-app.vercel.app');
  });

  it('returns null — a defined "not found" result — for a 404 rather than throwing', async () => {
    const fetch = fakeFetch(() => errorResponse(404, 'Not Found'));

    const result = await getVercelDeployment({ token: 't', idOrUrl: 'dpl_missing', fetch });

    expect(result).toBeNull();
  });

  it('surfaces a 401 as a typed VercelApiError identifying platform and status code', async () => {
    const fetch = fakeFetch(() => errorResponse(401, 'Unauthorized'));

    await expect(getVercelDeployment({ token: 'bad', idOrUrl: 'dpl_1', fetch })).rejects.toMatchObject({
      platform: 'vercel',
      statusCode: 401,
    });
  });
});

describe('reduceVercelEventsToExcerpt', () => {
  it('prefers stderr/fatal-tagged text and includes the error message', () => {
    const events: VercelDeploymentEvent[] = [
      { type: 'command', payload: { text: '$ npm run build' } },
      { type: 'stdout', payload: { text: 'Installing dependencies...' } },
      { type: 'stdout', payload: { text: 'Compiling...' } },
      { type: 'stderr', payload: { text: 'TypeError: Cannot read properties of undefined' } },
      { type: 'exit', payload: { text: 'Exit code 1' } },
    ];

    const excerpt = reduceVercelEventsToExcerpt(events);

    expect(excerpt).toContain('TypeError: Cannot read properties of undefined');
    expect(excerpt).not.toContain('Installing dependencies');
    expect(excerpt.length).toBeLessThanOrEqual(DEFAULT_LOG_EXCERPT_MAX_CHARS + 100);
  });

  it('includes fatal-tagged events alongside stderr', () => {
    const events: VercelDeploymentEvent[] = [
      { type: 'stdout', payload: { text: 'building...' } },
      { type: 'fatal', payload: { text: 'FATAL: out of memory' } },
    ];

    const excerpt = reduceVercelEventsToExcerpt(events);

    expect(excerpt).toContain('FATAL: out of memory');
  });

  it('falls back to the tail of the full log when nothing is error-tagged', () => {
    const events: VercelDeploymentEvent[] = Array.from({ length: 50 }, (_, i) => ({
      type: 'stdout' as const,
      payload: { text: `line ${i}` },
    }));

    const excerpt = reduceVercelEventsToExcerpt(events, 50);

    // Bounded and biased toward the tail (later lines), not the head.
    expect(excerpt.length).toBeLessThanOrEqual(150);
    expect(excerpt).toContain('line 49');
    expect(excerpt).not.toContain('line 0\n');
  });

  it('bounds output length even for a very large error-tagged log', () => {
    const bigText = 'x'.repeat(50_000);
    const events: VercelDeploymentEvent[] = [{ type: 'stderr', payload: { text: bigText } }];

    const excerpt = reduceVercelEventsToExcerpt(events, 1000);

    expect(excerpt.length).toBeLessThan(1200);
  });

  it('handles events with no text payload without throwing', () => {
    const events: VercelDeploymentEvent[] = [
      { type: 'deployment-state' },
      { type: 'stderr', payload: {} },
      { type: 'stderr', payload: { text: 'real error' } },
    ];

    const excerpt = reduceVercelEventsToExcerpt(events);

    expect(excerpt).toContain('real error');
  });
});

describe('getVercelBuildLogExcerpt', () => {
  it('fetches events and reduces them to a bounded excerpt', async () => {
    const events: VercelDeploymentEvent[] = [
      { type: 'stdout', payload: { text: 'noise' } },
      { type: 'stderr', payload: { text: 'the real error' } },
    ];
    let capturedUrl = '';
    const fetch = fakeFetch((url) => {
      capturedUrl = url;
      return jsonResponse(200, events);
    });

    const excerpt = await getVercelBuildLogExcerpt({ token: 't', idOrUrl: 'dpl_1', fetch });

    expect(excerpt).toContain('the real error');
    expect(capturedUrl).toContain('/v3/deployments/dpl_1/events');
    expect(capturedUrl).toContain('limit=-1');
  });

  it('surfaces a 401 as a typed VercelApiError identifying platform and status code', async () => {
    const fetch = fakeFetch(() => errorResponse(401, 'Unauthorized'));

    await expect(
      getVercelBuildLogExcerpt({ token: 'bad', idOrUrl: 'dpl_1', fetch })
    ).rejects.toMatchObject({ platform: 'vercel', statusCode: 401 });
  });
});
