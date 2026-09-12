/**
 * Tests for the PostHog `plan = agency` filter rewriter.
 *
 * The SCALE rename changed the `plan` event property emitted by
 * apps/web/src/lib/analytics/billing.ts from 'agency' to 'scale'. Events
 * already captured keep 'agency' forever, so any saved PostHog object still
 * filtering on `plan = 'agency'` silently under-counts from the deploy onward.
 *
 * Everything here runs against an in-memory fake fetch. No network, no key.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROJECT_ID,
  OBJECT_DESCRIPTORS,
  findPlanMatches,
  main,
  parseArgs,
  rewritePlanFilters,
  runPlanFilterRewrite,
  type PosthogFetch,
  type RewriteMode,
} from '../posthog-rename-plan-filters';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HOST = 'https://us.posthog.com';
const API_KEY = 'phx_super_secret_personal_api_key_do_not_print';

/** A modern query-based insight whose TrendsQuery filters on plan = agency. */
function queryInsight(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    short_id: `sh${id}`,
    name: `Subscriptions started — agency ${id}`,
    derived_name: null,
    deleted: false,
    dashboards: [],
    dashboard_tiles: [],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        interval: 'day',
        series: [{ kind: 'EventsNode', event: 'subscription_started', properties: [] }],
        properties: [
          { key: 'plan', value: ['agency'], operator: 'exact', type: 'event' },
        ],
      },
    },
    ...overrides,
  };
}

/** A legacy insight that still carries the pre-HogQL `filters` blob. */
function legacyInsight(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    short_id: `sh${id}`,
    name: `Cap hits by plan ${id}`,
    deleted: false,
    dashboards: [],
    dashboard_tiles: [],
    filters: {
      insight: 'TRENDS',
      events: [{ id: 'cap_hit', type: 'events', order: 0 }],
      properties: [{ key: 'plan', value: 'agency', operator: 'exact', type: 'event' }],
    },
    ...overrides,
  };
}

/** An insight backed by a raw HogQL string. */
function hogqlInsight(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    short_id: `sh${id}`,
    name: `MRR by plan ${id}`,
    deleted: false,
    dashboards: [],
    dashboard_tiles: [],
    query: {
      kind: 'DataTableNode',
      source: {
        kind: 'HogQLQuery',
        query:
          "SELECT count() FROM events WHERE event = 'subscription_started' AND properties.plan = 'agency'",
      },
    },
    ...overrides,
  };
}

function dashboard(id: number, tiles: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Billing dashboard ${id}`,
    deleted: false,
    filters: { date_from: '-30d', properties: [] },
    tiles,
    ...overrides,
  };
}

/**
 * A dashboard whose own `filters.properties` carries the legacy scalar exact
 * match — the same node shape the pre-HogQL insight `filters` blob used, and
 * the one field of that shape the API actually lets you PATCH.
 */
function legacyFiltersDashboard(id: number) {
  return dashboard(id, [], {
    name: `Cap hits by plan ${id}`,
    filters: {
      date_from: '-30d',
      properties: [{ key: 'plan', value: 'agency', operator: 'exact', type: 'event' }],
    },
  });
}

function cohort(id: number) {
  return {
    id,
    name: 'Agency plan customers',
    deleted: false,
    is_static: false,
    filters: {
      properties: {
        type: 'OR',
        values: [
          {
            type: 'AND',
            values: [{ key: 'plan', value: ['agency'], operator: 'exact', type: 'event' }],
          },
        ],
      },
    },
  };
}

function action(id: number) {
  return {
    id,
    name: 'Agency checkout started',
    deleted: false,
    steps: [
      {
        event: 'billing_checkout_started',
        properties: [{ key: 'plan', value: ['agency'], operator: 'exact', type: 'event' }],
      },
    ],
  };
}

function featureFlag(id: number) {
  return {
    id,
    key: 'agency-only-beta',
    name: 'Agency only beta',
    active: true,
    deleted: false,
    filters: {
      groups: [
        {
          properties: [{ key: 'plan', value: ['agency'], operator: 'exact', type: 'person' }],
          rollout_percentage: 100,
        },
      ],
    },
  };
}

function experiment(id: number) {
  return {
    id,
    name: 'Agency pricing experiment',
    feature_flag_key: 'agency-pricing',
    deleted: false,
    parameters: { recommended_sample_size: 100 },
    exposure_criteria: {
      exposure_config: {
        kind: 'ExposureConfig',
        properties: [{ key: 'plan', value: ['agency'], operator: 'exact', type: 'event' }],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Fake PostHog
// ---------------------------------------------------------------------------

type Store = Partial<Record<string, unknown[]>>;

type FakeOptions = {
  /** Objects per page. Anything beyond it is served through `next`. */
  pageSize?: number;
  /** Return a non-2xx PATCH for the matching resource/id. */
  patchFailure?: (resource: string, id: string) => { status: number; body: string } | null;
};

function createFakePosthog(store: Store, options: FakeOptions = {}) {
  const pageSize = options.pageSize ?? 100;
  const requests: Array<{ method: string; url: string; body?: string; headers: Record<string, string> }> = [];
  /** Live copy, so a PATCH is visible to the verification re-fetch. */
  const state: Record<string, Array<Record<string, unknown>>> = {};
  for (const [resource, rows] of Object.entries(store)) {
    state[resource] = (rows ?? []).map((row) => structuredClone(row) as Record<string, unknown>);
  }

  const fetchImpl: PosthogFetch = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    requests.push({ method, url, body: init.body, headers: init.headers ?? {} });

    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    // ['api','projects',':id',resource] or [...,resource,':objectId']
    const resource = segments[3];
    const objectId = segments[4];
    const rows = state[resource] ?? [];

    const respond = (status: number, payload: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });

    if (objectId) {
      const row = rows.find((entry) => String(entry.id) === objectId);
      if (!row) return respond(404, { detail: 'Not found.' });

      if (method === 'PATCH') {
        const failure = options.patchFailure?.(resource, objectId) ?? null;
        if (failure) {
          return {
            ok: false,
            status: failure.status,
            json: async () => JSON.parse(failure.body) as unknown,
            text: async () => failure.body,
          };
        }
        Object.assign(row, JSON.parse(init.body ?? '{}') as Record<string, unknown>);
        return respond(200, structuredClone(row));
      }

      return respond(200, structuredClone(row));
    }

    const offset = Number(parsed.searchParams.get('offset') ?? '0');
    const page = rows.slice(offset, offset + pageSize);
    const nextOffset = offset + pageSize;
    const next =
      nextOffset < rows.length
        ? `${parsed.origin}${parsed.pathname}?limit=${pageSize}&offset=${nextOffset}`
        : null;

    // Mirror the real API: the dashboards LIST serializer returns neither
    // `tiles` nor `filters`. Only the retrieve endpoint does.
    const results = page.map((row) => {
      const copy = structuredClone(row);
      if (resource === 'dashboards') {
        delete copy.tiles;
        delete copy.filters;
        delete copy.variables;
      }
      return copy;
    });

    return respond(200, { count: rows.length, next, previous: null, results });
  });

  return { fetch: fetchImpl, requests, state };
}

function createDeps(store: Store, options: FakeOptions = {}) {
  const posthog = createFakePosthog(store, options);
  const logs: string[] = [];
  const written: Array<{ path: string; contents: string }> = [];

  return {
    ...posthog,
    logs,
    written,
    deps: {
      fetch: posthog.fetch,
      apiKey: API_KEY,
      host: HOST,
      projectId: DEFAULT_PROJECT_ID,
      log: (message: string) => logs.push(message),
      writeFile: async (path: string, contents: string) => {
        written.push({ path, contents });
      },
    },
  };
}

function patchRequests(requests: Array<{ method: string; url: string }>) {
  return requests.filter((request) => request.method === 'PATCH');
}

// ---------------------------------------------------------------------------
// Pure rewriting
// ---------------------------------------------------------------------------

describe('rewritePlanFilters', () => {
  const widen = (value: unknown, mode: RewriteMode = 'widen') => rewritePlanFilters(value, { mode });

  it('widens a scalar exact match into an array that keeps history', () => {
    const result = widen({ properties: [{ key: 'plan', value: 'agency', operator: 'exact', type: 'event' }] });

    expect(result.changed).toBe(true);
    expect(result.value).toEqual({
      properties: [{ key: 'plan', value: ['agency', 'scale'], operator: 'exact', type: 'event' }],
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].path).toBe('properties[0]');
    expect(result.matches[0].kind).toBe('property-filter');
  });

  it('widens an array exact match by appending scale', () => {
    const result = widen({ key: 'plan', value: ['agency'], operator: 'exact', type: 'event' });
    expect(result.value).toEqual({ key: 'plan', value: ['agency', 'scale'], operator: 'exact', type: 'event' });
  });

  it('widens an is_not match so the exclusion still covers both labels', () => {
    const result = widen({ key: 'plan', value: 'agency', operator: 'is_not', type: 'event' });
    expect(result.value).toEqual({ key: 'plan', value: ['agency', 'scale'], operator: 'is_not', type: 'event' });
  });

  it('treats a property filter with no operator as exact', () => {
    const result = widen({ key: 'plan', value: 'agency', type: 'event' });
    expect(result.value).toEqual({ key: 'plan', value: ['agency', 'scale'], type: 'event' });
  });

  it('replaces rather than widens in replace mode', () => {
    const result = widen({ key: 'plan', value: 'agency', operator: 'exact', type: 'event' }, 'replace');
    expect(result.value).toEqual({ key: 'plan', value: ['scale'], operator: 'exact', type: 'event' });
  });

  it('rewrites HogQL strings in both modes', () => {
    const sql = "SELECT 1 FROM events WHERE properties.plan = 'agency' AND plan = 'agency'";

    expect(widen(sql).value).toBe(
      "SELECT 1 FROM events WHERE properties.plan IN ('agency', 'scale') AND plan IN ('agency', 'scale')"
    );
    expect(widen(sql, 'replace').value).toBe(
      "SELECT 1 FROM events WHERE properties.plan = 'scale' AND plan = 'scale'"
    );
  });

  it('rewrites HogQL written with double quotes, == or bracket access', () => {
    expect(widen(`WHERE properties['plan'] == "agency"`).value).toBe(
      `WHERE properties['plan'] IN ('agency', 'scale')`
    );
  });

  it('leaves plan values other than agency untouched', () => {
    const untouched = {
      properties: [
        { key: 'plan', value: ['growth'], operator: 'exact', type: 'event' },
        { key: 'plan', value: ['scale'], operator: 'exact', type: 'event' },
        { key: 'plan', value: 'starter', operator: 'exact', type: 'event' },
      ],
      sql: "WHERE properties.plan = 'growth'",
    };

    const result = widen(structuredClone(untouched));
    expect(result.changed).toBe(false);
    expect(result.matches).toEqual([]);
    expect(result.value).toEqual(untouched);
  });

  it('never touches agency values stored under a different property key', () => {
    const other = {
      properties: [
        { key: 'tier', value: 'agency', operator: 'exact', type: 'event' },
        { key: 'utm_campaign', value: ['agency'], operator: 'exact', type: 'event' },
      ],
      sql: "WHERE properties.tier = 'agency'",
      name: 'Agency dashboard',
    };

    const result = widen(structuredClone(other));
    expect(result.changed).toBe(false);
    expect(result.value).toEqual(other);
  });

  it('is idempotent: an already widened filter is not a match', () => {
    const widened = { key: 'plan', value: ['agency', 'scale'], operator: 'exact', type: 'event' };
    expect(findPlanMatches(widened, { mode: 'widen' })).toEqual([]);

    const widenedSql = "WHERE properties.plan IN ('agency', 'scale')";
    expect(findPlanMatches(widenedSql, { mode: 'widen' })).toEqual([]);
  });

  it('reports a non-widenable operator as a match that needs a human', () => {
    const matches = findPlanMatches(
      { key: 'plan', value: 'agency', operator: 'icontains', type: 'event' },
      { mode: 'widen' }
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].rewritable).toBe(false);
    expect(matches[0].note).toContain('icontains');
  });

  it('records the exact JSON path of every match', () => {
    const result = widen({
      query: {
        source: {
          series: [{ properties: [{ key: 'plan', value: 'agency', operator: 'exact' }] }],
          properties: { type: 'AND', values: [{ key: 'plan', value: 'agency' }] },
        },
      },
    });

    expect(result.matches.map((match) => match.path)).toEqual([
      'query.source.series[0].properties[0]',
      'query.source.properties.values[0]',
    ]);
  });

  it('honours a skip predicate so embedded subtrees can be pruned', () => {
    const value = {
      tiles: [{ insight: { query: { properties: [{ key: 'plan', value: 'agency' }] } } }],
      filters: { properties: [{ key: 'plan', value: 'agency' }] },
    };

    const result = rewritePlanFilters(value, {
      mode: 'widen',
      skip: (path) => /^tiles\[\d+\]\.insight$/.test(path),
    });

    expect(result.matches.map((match) => match.path)).toEqual(['filters.properties[0]']);
  });
});

// ---------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------

describe('object descriptors', () => {
  it('covers every REST collection the rollout plan names', () => {
    expect(OBJECT_DESCRIPTORS.map((descriptor) => descriptor.resource)).toEqual([
      'insights',
      'dashboards',
      'cohorts',
      'actions',
      'feature_flags',
      'experiments',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

describe('runPlanFilterRewrite', () => {
  it('finds matches and issues no PATCH in the default dry run', async () => {
    const harness = createDeps({
      insights: [queryInsight(1), hogqlInsight(3)],
    });

    const report = await runPlanFilterRewrite(harness.deps, { reportPath: '/tmp/report.json' });

    expect(report.mode).toBe('dry-run');
    expect(report.rewriteMode).toBe('widen');
    expect(report.matched).toHaveLength(2);
    expect(patchRequests(harness.requests)).toHaveLength(0);
    expect(report.changed).toHaveLength(0);
    expect(report.failed).toHaveLength(0);
  });

  it("reports an insight's legacy filters blob as manual, because PATCH ignores it", async () => {
    const harness = createDeps({ insights: [legacyInsight(2)] });

    const report = await runPlanFilterRewrite(harness.deps, { apply: true });

    expect(report.matched).toHaveLength(0);
    expect(report.manual).toHaveLength(1);
    expect(report.manual[0].matches[0].rewritable).toBe(false);
    expect(report.manual[0].matches[0].note).toContain('not a PATCH parameter');
    expect(patchRequests(harness.requests)).toHaveLength(0);
  });

  it('writes the JSON report to the requested path in a dry run', async () => {
    const harness = createDeps({ insights: [queryInsight(1)] });

    await runPlanFilterRewrite(harness.deps, { reportPath: '/tmp/custom-report.json' });

    expect(harness.written).toHaveLength(1);
    expect(harness.written[0].path).toBe('/tmp/custom-report.json');
    const parsed = JSON.parse(harness.written[0].contents) as { matched: unknown[] };
    expect(parsed.matched).toHaveLength(1);
  });

  it('widens a legacy filters.properties exact match and verifies the re-fetch', async () => {
    const harness = createDeps({ dashboards: [legacyFiltersDashboard(7)] });

    const report = await runPlanFilterRewrite(harness.deps, { apply: true });

    expect(report.changed).toHaveLength(1);
    expect(report.failed).toHaveLength(0);

    const patch = patchRequests(harness.requests);
    expect(patch).toHaveLength(1);
    expect(patch[0].url).toBe(`${HOST}/api/projects/${DEFAULT_PROJECT_ID}/dashboards/7/`);

    // Minimal payload: only the one top-level field that changed.
    const body = JSON.parse((patch[0] as { body: string }).body) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['filters']);
    expect((body.filters as { properties: unknown[] }).properties).toEqual([
      { key: 'plan', value: ['agency', 'scale'], operator: 'exact', type: 'event' },
    ]);

    // A GET after the PATCH proves the run re-fetched to confirm.
    const order = harness.requests.map((request) => request.method);
    expect(order[order.length - 1]).toBe('GET');
  });

  it('re-reads each dashboard, because the list serializer omits tiles and filters', async () => {
    const harness = createDeps({ dashboards: [legacyFiltersDashboard(8)] });

    await runPlanFilterRewrite(harness.deps, {});

    const gets = harness.requests
      .filter((request) => request.method === 'GET' && request.url.includes('/dashboards/'))
      .map((request) => request.url);
    expect(gets[0]).toContain('/dashboards/?limit=');
    expect(gets[1]).toBe(`${HOST}/api/projects/${DEFAULT_PROJECT_ID}/dashboards/8/`);
  });

  it('widens both a JSON property node and a HogQL string inside query', async () => {
    const harness = createDeps({ insights: [queryInsight(1), hogqlInsight(2)] });

    const report = await runPlanFilterRewrite(harness.deps, { apply: true });

    expect(report.changed).toHaveLength(2);

    const node = harness.state.insights[0].query as { source: { properties: unknown[] } };
    expect(node.source.properties).toEqual([
      { key: 'plan', value: ['agency', 'scale'], operator: 'exact', type: 'event' },
    ]);

    const sql = harness.state.insights[1].query as { source: { query: string } };
    expect(sql.source.query).toContain("properties.plan IN ('agency', 'scale')");
    expect(sql.source.query).not.toContain("= 'agency'");
  });

  it('swaps agency for scale outright in replace mode', async () => {
    const harness = createDeps({
      insights: [hogqlInsight(6)],
      dashboards: [legacyFiltersDashboard(5)],
    });

    await runPlanFilterRewrite(harness.deps, { apply: true, rewriteMode: 'replace' });

    const legacy = harness.state.dashboards[0].filters as { properties: unknown[] };
    expect(legacy.properties).toEqual([
      { key: 'plan', value: ['scale'], operator: 'exact', type: 'event' },
    ]);

    const sql = harness.state.insights[0].query as { source: { query: string } };
    expect(sql.source.query).toContain("properties.plan = 'scale'");
  });

  it('patches an insight once, through the insights endpoint, never through its dashboard', async () => {
    const onDashboard = queryInsight(11, { dashboards: [40], dashboard_tiles: [{ id: 900, dashboard_id: 40 }] });
    const harness = createDeps({
      insights: [onDashboard],
      dashboards: [
        dashboard(40, [
          { id: 900, order: 0, insight: structuredClone(onDashboard) },
          { id: 901, order: 1, text: { body: 'Agency revenue' } },
        ]),
      ],
    });

    const report = await runPlanFilterRewrite(harness.deps, { apply: true });

    expect(report.matched).toHaveLength(1);
    expect(report.matched[0].type).toBe('insight');
    expect(report.matched[0].dashboards).toEqual([40]);

    const patch = patchRequests(harness.requests);
    expect(patch).toHaveLength(1);
    expect(patch[0].url).toContain('/insights/11/');
    expect(patch.some((request) => request.url.includes('/dashboards/'))).toBe(false);
  });

  it('still patches a dashboard whose own filters match', async () => {
    const harness = createDeps({
      dashboards: [
        dashboard(50, [], {
          filters: {
            date_from: '-30d',
            properties: [{ key: 'plan', value: 'agency', operator: 'exact', type: 'event' }],
          },
        }),
      ],
    });

    const report = await runPlanFilterRewrite(harness.deps, { apply: true });

    expect(report.changed).toHaveLength(1);
    expect(report.changed[0].type).toBe('dashboard');
    const filters = harness.state.dashboards[0].filters as { properties: unknown[] };
    expect(filters.properties).toEqual([
      { key: 'plan', value: ['agency', 'scale'], operator: 'exact', type: 'event' },
    ]);
  });

  it('reaches cohorts, actions, feature flags and experiments', async () => {
    const harness = createDeps({
      cohorts: [cohort(60)],
      actions: [action(61)],
      feature_flags: [featureFlag(62)],
      experiments: [experiment(63)],
    });

    const report = await runPlanFilterRewrite(harness.deps, { apply: true });

    expect(report.changed.map((entry) => entry.type).sort()).toEqual([
      'action',
      'cohort',
      'experiment',
      'feature_flag',
    ]);
    expect(report.failed).toHaveLength(0);

    const cohortFilters = harness.state.cohorts[0].filters as {
      properties: { values: Array<{ values: unknown[] }> };
    };
    expect(cohortFilters.properties.values[0].values).toEqual([
      { key: 'plan', value: ['agency', 'scale'], operator: 'exact', type: 'event' },
    ]);

    const flagFilters = harness.state.feature_flags[0].filters as {
      groups: Array<{ properties: unknown[] }>;
    };
    expect(flagFilters.groups[0].properties).toEqual([
      { key: 'plan', value: ['agency', 'scale'], operator: 'exact', type: 'person' },
    ]);
  });

  it('follows the next link until the collection is exhausted', async () => {
    const insights = Array.from({ length: 5 }, (_, index) => queryInsight(index + 1));
    const harness = createDeps({ insights }, { pageSize: 2 });

    const report = await runPlanFilterRewrite(harness.deps, {});

    expect(report.matched).toHaveLength(5);
    expect(report.pages.insights).toBe(3);
    const listCalls = harness.requests.filter(
      (request) => request.method === 'GET' && request.url.includes('/insights/?')
    );
    expect(listCalls).toHaveLength(3);
    expect(listCalls[1].url).toContain('offset=2');
  });

  it('caps the number of objects changed with --limit', async () => {
    const insights = Array.from({ length: 4 }, (_, index) => queryInsight(index + 1));
    const harness = createDeps({ insights });

    const report = await runPlanFilterRewrite(harness.deps, { apply: true, limit: 2 });

    expect(report.limitReached).toBe(true);
    expect(report.changed).toHaveLength(2);
    expect(report.skipped).toHaveLength(2);
    expect(patchRequests(harness.requests)).toHaveLength(2);
  });

  it('collects a failed PATCH per object and keeps going', async () => {
    const harness = createDeps(
      { insights: [queryInsight(1), queryInsight(2), queryInsight(3)] },
      {
        patchFailure: (resource, id) =>
          resource === 'insights' && id === '2'
            ? { status: 403, body: '{"detail":"You do not have edit permission."}' }
            : null,
      }
    );

    const report = await runPlanFilterRewrite(harness.deps, { apply: true });

    expect(report.changed.map((entry) => entry.id)).toEqual([1, 3]);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0].id).toBe(2);
    expect(report.failed[0].error).toContain('403');
    expect(patchRequests(harness.requests)).toHaveLength(3);
  });

  it('fails an object whose re-fetch still shows the legacy filter', async () => {
    // A field the API silently ignores on PATCH: the state never changes.
    const harness = createDeps({ dashboards: [legacyFiltersDashboard(9)] });
    const original = harness.fetch;
    const deps = {
      ...harness.deps,
      fetch: (async (url: string, init: Parameters<PosthogFetch>[1] = {}) => {
        if ((init.method ?? 'GET') === 'PATCH') {
          return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
        }
        return original(url, init);
      }) as PosthogFetch,
    };

    const report = await runPlanFilterRewrite(deps, { apply: true });

    expect(report.changed).toHaveLength(0);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0].error).toMatch(/verif/i);
  });

  it('sends the key as a bearer header and never elsewhere', async () => {
    const harness = createDeps({ insights: [queryInsight(1)] });

    await runPlanFilterRewrite(harness.deps, { apply: true });

    for (const request of harness.requests) {
      expect(request.headers.Authorization).toBe(`Bearer ${API_KEY}`);
      expect(request.url).not.toContain(API_KEY);
    }
  });

  it('never prints the API key, only names and ids', async () => {
    const harness = createDeps(
      { insights: [queryInsight(1)] },
      { patchFailure: () => ({ status: 401, body: `{"detail":"Bad key ${API_KEY}"}` }) }
    );

    const report = await runPlanFilterRewrite(harness.deps, { apply: true });

    const printed = [...harness.logs, ...harness.written.map((file) => file.contents)].join('\n');
    expect(printed).not.toContain(API_KEY);
    expect(printed).toContain('Subscriptions started');
    expect(JSON.stringify(report)).not.toContain(API_KEY);
  });

  it('skips deleted objects', async () => {
    const harness = createDeps({ insights: [queryInsight(1, { deleted: true })] });

    const report = await runPlanFilterRewrite(harness.deps, { apply: true });

    expect(report.matched).toHaveLength(0);
    expect(patchRequests(harness.requests)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

describe('cli', () => {
  it('parses flags with dry run and widen as the defaults', () => {
    expect(parseArgs([])).toEqual({
      apply: false,
      rewriteMode: 'widen',
      limit: null,
      reportPath: './posthog-plan-filter-report.json',
    });

    expect(parseArgs(['--dry-run'])).toMatchObject({ apply: false });
    expect(parseArgs(['--apply'])).toMatchObject({ apply: true });
    expect(parseArgs(['--mode=replace'])).toMatchObject({ rewriteMode: 'replace' });
    expect(parseArgs(['--mode', 'replace'])).toMatchObject({ rewriteMode: 'replace' });
    expect(parseArgs(['--mode', 'nonsense'])).toMatchObject({ rewriteMode: 'widen' });
    expect(parseArgs(['--limit', '3'])).toMatchObject({ limit: 3 });
    expect(parseArgs(['--limit=3'])).toMatchObject({ limit: 3 });
    expect(parseArgs(['--limit', '0'])).toMatchObject({ limit: null });
    expect(parseArgs(['--report', '/tmp/x.json'])).toMatchObject({ reportPath: '/tmp/x.json' });
    expect(parseArgs(['--report=/tmp/x.json'])).toMatchObject({ reportPath: '/tmp/x.json' });
  });

  it('exits 1 with a clear message when no personal API key is set', async () => {
    const logs: string[] = [];
    const harness = createDeps({ insights: [] });

    const code = await main([], {
      ...harness.deps,
      apiKey: '',
      log: (message: string) => logs.push(message),
    });

    expect(code).toBe(1);
    expect(logs.join('\n')).toContain('POSTHOG_PERSONAL_API_KEY');
  });

  it('exits 0 on a clean dry run and 1 when any object failed', async () => {
    const clean = createDeps({ insights: [queryInsight(1)] });
    expect(await main(['--report', '/tmp/a.json'], clean.deps)).toBe(0);
    expect(patchRequests(clean.requests)).toHaveLength(0);

    const broken = createDeps(
      { insights: [queryInsight(1)] },
      { patchFailure: () => ({ status: 500, body: '{"detail":"boom"}' }) }
    );
    expect(await main(['--apply', '--report', '/tmp/b.json'], broken.deps)).toBe(1);
  });

  it('prints a before -> after table row for every match', async () => {
    const harness = createDeps({ dashboards: [legacyFiltersDashboard(12)] });

    await main(['--report', '/tmp/c.json'], harness.deps);

    const printed = harness.logs.join('\n');
    expect(printed).toContain('dashboard');
    expect(printed).toContain('id=12');
    expect(printed).toContain('Cap hits by plan');
    expect(printed).toContain('filters.properties[0]');
    expect(printed).toContain('->');
  });
});
