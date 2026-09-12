/**
 * Tests for Render deploy-status access (U2, R5, R13).
 *
 * All tests run against a fake `fetch` injected per-call — no network, no
 * global fetch mutation. Response objects implement only the surface this
 * module reads (ok, status, statusText, json, text).
 */

import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOG_EXCERPT_MAX_CHARS,
  RenderApiError,
  fetchRenderBuildLogs,
  listRenderDeploys,
  reduceRenderLogsToExcerpt,
  type RenderDeployListItem,
  type RenderFetch,
  type RenderLogEntry,
  type RenderLogsResponse,
} from '../render';

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

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): RenderFetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    handler(String(input), init)
  ) as unknown as RenderFetch;
}

describe('listRenderDeploys', () => {
  it('requests /v1/services/{id}/deploys with a Bearer token', async () => {
    const items: RenderDeployListItem[] = [
      {
        deploy: { id: 'dep-1', status: 'build_failed', commit: { id: 'abc', message: 'fix' } },
        cursor: 'cur-1',
      },
    ];
    let capturedUrl = '';
    let capturedAuth: string | undefined;
    const fetch = fakeFetch((url, init) => {
      capturedUrl = url;
      capturedAuth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return jsonResponse(200, items);
    });

    const result = await listRenderDeploys({ apiKey: 'rnd_123', serviceId: 'srv-abc', fetch });

    expect(result).toEqual([items[0].deploy]);
    expect(capturedUrl).toContain('/v1/services/srv-abc/deploys?');
    expect(capturedUrl).toContain('limit=20');
    expect(capturedAuth).toBe('Bearer rnd_123');
  });

  it('respects a custom limit', async () => {
    let capturedUrl = '';
    const fetch = fakeFetch((url) => {
      capturedUrl = url;
      return jsonResponse(200, []);
    });

    await listRenderDeploys({ apiKey: 'k', serviceId: 's', limit: 5, fetch });

    expect(capturedUrl).toContain('limit=5');
  });

  it('returns an empty array — a defined "no deployment found" result — rather than throwing', async () => {
    const fetch = fakeFetch(() => jsonResponse(200, []));

    const result = await listRenderDeploys({ apiKey: 'k', serviceId: 's', fetch });

    expect(result).toEqual([]);
  });

  it('surfaces a 401 as a typed RenderApiError identifying platform and status code', async () => {
    const fetch = fakeFetch(() => errorResponse(401, 'Unauthorized', 'invalid api key'));

    await expect(listRenderDeploys({ apiKey: 'bad', serviceId: 's', fetch })).rejects.toMatchObject({
      platform: 'render',
      statusCode: 401,
    });
    await expect(listRenderDeploys({ apiKey: 'bad', serviceId: 's', fetch })).rejects.toBeInstanceOf(
      RenderApiError
    );
  });
});

describe('fetchRenderBuildLogs', () => {
  it('requests /v1/logs with ownerId, resource, type=build, and the given startTime', async () => {
    let capturedUrl = '';
    const fetch = fakeFetch((url) => {
      capturedUrl = url;
      const body: RenderLogsResponse = { logs: [], hasMore: false };
      return jsonResponse(200, body);
    });

    await fetchRenderBuildLogs({
      apiKey: 'k',
      ownerId: 'own-1',
      serviceId: 'srv-1',
      startTime: '2026-09-01T00:00:00.000Z',
      fetch,
    });

    expect(capturedUrl).toContain('/v1/logs?');
    expect(capturedUrl).toContain('ownerId=own-1');
    expect(capturedUrl).toContain('resource=srv-1');
    expect(capturedUrl).toContain('type=build');
    expect(capturedUrl).toContain('startTime=2026-09-01T00%3A00%3A00.000Z');
  });

  it('paginates via nextStartTime/nextEndTime and terminates correctly when hasMore is false', async () => {
    const page1: RenderLogsResponse = {
      logs: [{ id: '1', message: 'first', timestamp: '2026-09-01T00:00:00.000Z' }],
      hasMore: true,
      nextStartTime: '2026-09-01T00:01:00.000Z',
      nextEndTime: '2026-09-01T01:00:00.000Z',
    };
    const page2: RenderLogsResponse = {
      logs: [{ id: '2', message: 'second', timestamp: '2026-09-01T00:02:00.000Z' }],
      hasMore: false,
    };
    let callCount = 0;
    const capturedStarts: string[] = [];
    const fetch = fakeFetch((url) => {
      callCount += 1;
      const start = new URL(url).searchParams.get('startTime');
      if (start) capturedStarts.push(start);
      return jsonResponse(200, callCount === 1 ? page1 : page2);
    });

    const logs = await fetchRenderBuildLogs({
      apiKey: 'k',
      ownerId: 'own-1',
      serviceId: 'srv-1',
      startTime: '2026-09-01T00:00:00.000Z',
      fetch,
    });

    expect(callCount).toBe(2);
    expect(logs.map((l) => l.id)).toEqual(['1', '2']);
    expect(capturedStarts).toEqual(['2026-09-01T00:00:00.000Z', '2026-09-01T00:01:00.000Z']);
  });

  it('terminates and does not hang when hasMore stays true past the iteration cap', async () => {
    let callCount = 0;
    const fetch = fakeFetch((url) => {
      callCount += 1;
      const start = new URL(url).searchParams.get('startTime') ?? '2026-09-01T00:00:00.000Z';
      const body: RenderLogsResponse = {
        logs: [{ id: `${callCount}`, message: `entry ${callCount}`, timestamp: start }],
        hasMore: true,
        nextStartTime: `2026-09-01T00:0${callCount}:00.000Z`,
      };
      return jsonResponse(200, body);
    });

    const logs = await fetchRenderBuildLogs({
      apiKey: 'k',
      ownerId: 'own-1',
      serviceId: 'srv-1',
      startTime: '2026-09-01T00:00:00.000Z',
      fetch,
      maxPages: 3,
    });

    expect(callCount).toBe(3);
    expect(logs).toHaveLength(3);
  });

  it('stops immediately if hasMore is true but nextStartTime is missing, rather than spinning', async () => {
    let callCount = 0;
    const fetch = fakeFetch(() => {
      callCount += 1;
      const body: RenderLogsResponse = {
        logs: [{ id: '1', message: 'entry', timestamp: '2026-09-01T00:00:00.000Z' }],
        hasMore: true,
        // no nextStartTime — malformed page, must not loop forever
      };
      return jsonResponse(200, body);
    });

    const logs = await fetchRenderBuildLogs({
      apiKey: 'k',
      ownerId: 'own-1',
      serviceId: 'srv-1',
      startTime: '2026-09-01T00:00:00.000Z',
      fetch,
      maxPages: 10,
    });

    expect(callCount).toBe(1);
    expect(logs).toHaveLength(1);
  });

  it('surfaces a 401 as a typed RenderApiError identifying platform and status code', async () => {
    const fetch = fakeFetch(() => errorResponse(401, 'Unauthorized'));

    await expect(
      fetchRenderBuildLogs({
        apiKey: 'bad',
        ownerId: 'o',
        serviceId: 's',
        startTime: '2026-09-01T00:00:00.000Z',
        fetch,
      })
    ).rejects.toMatchObject({ platform: 'render', statusCode: 401 });
  });
});

describe('reduceRenderLogsToExcerpt', () => {
  it('prefers error-marked entries and includes the error message', () => {
    const entries: RenderLogEntry[] = [
      { id: '1', message: 'Installing dependencies', timestamp: '2026-09-01T00:00:00.000Z' },
      { id: '2', message: 'Running build script', timestamp: '2026-09-01T00:00:01.000Z' },
      {
        id: '3',
        message: 'ERROR: Cannot find module "left-pad"',
        timestamp: '2026-09-01T00:00:02.000Z',
      },
    ];

    const excerpt = reduceRenderLogsToExcerpt(entries);

    expect(excerpt).toContain('Cannot find module "left-pad"');
    expect(excerpt).not.toContain('Installing dependencies');
  });

  it('falls back to the tail of the full log when nothing is error-marked', () => {
    const entries: RenderLogEntry[] = Array.from({ length: 50 }, (_, i) => ({
      id: `${i}`,
      message: `line ${i}`,
      timestamp: `2026-09-01T00:00:${String(i).padStart(2, '0')}.000Z`,
    }));

    const excerpt = reduceRenderLogsToExcerpt(entries, 50);

    expect(excerpt.length).toBeLessThanOrEqual(150);
    expect(excerpt).toContain('line 49');
  });

  it('bounds output length even for a very large error-marked log', () => {
    const entries: RenderLogEntry[] = [
      { id: '1', message: `FATAL: ${'x'.repeat(50_000)}`, timestamp: '2026-09-01T00:00:00.000Z' },
    ];

    const excerpt = reduceRenderLogsToExcerpt(entries, 1000);

    expect(excerpt.length).toBeLessThan(1200);
  });

  it('respects the default max length when none is given', () => {
    const entries: RenderLogEntry[] = [
      { id: '1', message: `error: ${'y'.repeat(20_000)}`, timestamp: '2026-09-01T00:00:00.000Z' },
    ];

    const excerpt = reduceRenderLogsToExcerpt(entries);

    expect(excerpt.length).toBeLessThan(DEFAULT_LOG_EXCERPT_MAX_CHARS + 200);
  });
});
