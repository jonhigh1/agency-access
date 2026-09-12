#!/usr/bin/env node
/**
 * Rewrite PostHog saved objects that still filter on `plan = 'agency'`.
 *
 * WHY
 * The SCALE rename changed the `plan` property emitted by
 * apps/web/src/lib/analytics/billing.ts (`BillingPlanSlug`) from 'agency' to
 * 'scale'. It is sent on pricing_viewed, plan_selected,
 * billing_checkout_started, subscription_started, billing_checkout_failed,
 * trial_started and cap_hit. Events captured before the deploy keep 'agency'
 * forever — no code change can rewrite history in ClickHouse. So every saved
 * insight, dashboard, cohort, action, feature flag or experiment that filters
 * on `plan = 'agency'` starts silently under-counting at the deploy boundary,
 * with no error anywhere. This is KTD7 / unit U10 of
 * docs/plans/2026-09-11-1316-refactor-agency-to-scale-tier-rollout-plan.md.
 *
 * WHAT IT DOES
 * Pages every object in the six REST collections below, walks its filter
 * definition recursively, and finds two shapes:
 *
 *   1. A property-filter node: `{ key: 'plan', value: 'agency' | ['agency'],
 *      operator?: 'exact' | 'is_not', type?: 'event' | 'person' | ... }`.
 *      These appear in legacy `filters.properties`, in modern
 *      `query.source.properties` / `query.source.series[].properties`, in
 *      cohort `filters.properties.values[].values[]`, in action
 *      `steps[].properties[]` and in flag `filters.groups[].properties[]`.
 *      One walker handles all of them, because the leaf node shape is shared.
 *
 *   2. A HogQL string anywhere in the object containing `plan = 'agency'`,
 *      `properties.plan = 'agency'` or `properties['plan'] == "agency"`.
 *
 * MODES
 *   --mode=widen (default, recommended)
 *       `plan exact 'agency'`  ->  `plan exact ['agency','scale']`
 *       `plan = 'agency'`      ->  `plan IN ('agency', 'scale')`
 *     The series stays continuous across the deploy, which is what U10's
 *     verification asks for. PostHog property filters accept an array for
 *     `exact` and `is_not`, so this is a legal filter, not a hack.
 *
 *   --mode=replace
 *       `plan exact 'agency'`  ->  `plan exact ['scale']`
 *       `plan = 'agency'`      ->  `plan = 'scale'`
 *     Correct only for an object that must describe the world after the
 *     rename and should deliberately drop pre-deploy events.
 *
 * SAFETY PROPERTIES
 *  - Dry run by default. Writes only with --apply.
 *  - Idempotent. A widened filter no longer matches, so a second run is a
 *    no-op. The same holds in replace mode.
 *  - Scoped to the property key `plan`. An 'agency' value stored under any
 *    other key (tier, utm_campaign, a dashboard's name) is never touched.
 *  - An insight that also appears embedded in a dashboard tile is patched once,
 *    through /insights/:id/. The dashboard walk prunes `tiles[*].insight`, so
 *    the same insight can never be written twice through two endpoints.
 *  - Each PATCH sends only the top-level fields that actually changed, then
 *    re-fetches the object and re-runs detection. If the API silently ignored
 *    the field, the object is reported as a verification failure, not a
 *    success.
 *  - A failed object is recorded and the run continues with the next one.
 *  - An operator this script cannot safely widen (icontains, regex, ...) is
 *    reported under `manual` and never guessed at. So is a match in a field the
 *    documented PATCH body does not accept — notably an insight's legacy
 *    `filters` blob, which GET returns but PATCH ignores.
 *  - The personal API key is sent only in the Authorization header. It is
 *    scrubbed from every log line, every error message and the JSON report.
 *
 * OPERATOR-GATED: this writes to a live analytics project. Run the dry run,
 * read ./posthog-plan-filter-report.json, run a --limit 1 canary, then apply.
 *
 * Usage:
 *   cd apps/api
 *   export POSTHOG_PERSONAL_API_KEY=...        # never commit this
 *   npx tsx scripts/posthog-rename-plan-filters.ts                        # dry run
 *   npx tsx scripts/posthog-rename-plan-filters.ts --report ./ph.json     # dry run, custom report
 *   npx tsx scripts/posthog-rename-plan-filters.ts --apply --limit 1      # canary: changes 1
 *   npx tsx scripts/posthog-rename-plan-filters.ts --apply                # changes all
 *   npx tsx scripts/posthog-rename-plan-filters.ts --mode=replace --apply # swap outright
 *
 * Flags:
 *   --apply            Perform writes. Without it nothing is written.
 *   --dry-run          Explicit no-op default, for runbooks. Never enables writes.
 *   --mode <m>         'widen' (default) or 'replace'. --mode=<m> also works.
 *   --limit N          Change at most N objects. N must be > 0. The rest are
 *                      listed under `skipped` so a canary is auditable.
 *   --report <file>    JSON report path. Default ./posthog-plan-filter-report.json.
 *
 * Environment (read straight from process.env — deliberately NOT added to
 * apps/api/src/lib/env.ts, because this is an operator tool, not runtime code):
 *   POSTHOG_PERSONAL_API_KEY   required. A personal API key, not a project key.
 *                              Needs scopes: insight, dashboard, cohort,
 *                              action, feature_flag, experiment (read+write).
 *   POSTHOG_HOST               default https://us.posthog.com
 *   POSTHOG_PROJECT_ID         default 309879 (AuthHub, US cloud)
 *
 * Exit code 0 when nothing failed. Exit code 1 when the key is missing, or any
 * object failed its PATCH or its post-PATCH verification.
 */

import { writeFile as writeFileAsync } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DEFAULT_POSTHOG_HOST = 'https://us.posthog.com';
/** AuthHub's PostHog project on US cloud: https://us.posthog.com/project/309879 */
export const DEFAULT_PROJECT_ID = '309879';
export const DEFAULT_REPORT_PATH = './posthog-plan-filter-report.json';
/** PostHog's list endpoints page at 100 by default; this is the documented max-safe page. */
export const PAGE_SIZE = 100;

/** The event property whose values were renamed. Nothing else is considered. */
export const PLAN_PROPERTY_KEY = 'plan';
export const LEGACY_PLAN_VALUE = 'agency';
export const CURRENT_PLAN_VALUE = 'scale';

/**
 * Operators whose value may legally be an array of exact strings. Widening
 * anything else (icontains, regex, gt, ...) would change what the filter means,
 * so those are reported for a human instead.
 */
export const WIDENABLE_OPERATORS: readonly string[] = ['exact', 'is_not'];

export type RewriteMode = 'widen' | 'replace';

export type PosthogObjectType =
  | 'insight'
  | 'dashboard'
  | 'cohort'
  | 'action'
  | 'feature_flag'
  | 'experiment';

// ---------------------------------------------------------------------------
// Injectable transport
// ---------------------------------------------------------------------------

export type PosthogResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export type PosthogRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

/** Structurally satisfied by the global `fetch`; tests pass an in-memory double. */
export type PosthogFetch = (url: string, init?: PosthogRequestInit) => Promise<PosthogResponse>;

export type RunDeps = {
  fetch: PosthogFetch;
  apiKey: string;
  host: string;
  projectId: string;
  log: (message: string) => void;
  writeFile: (path: string, contents: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Matching and rewriting
// ---------------------------------------------------------------------------

export type PlanMatchKind = 'property-filter' | 'hogql-string';

export type PlanMatch = {
  /** JSON path inside the object, e.g. `query.source.series[0].properties[1]`. */
  path: string;
  kind: PlanMatchKind;
  before: string;
  after: string | null;
  /** False when this script will not touch it; see `note`. */
  rewritable: boolean;
  note?: string;
};

export type RewriteOptions = {
  mode: RewriteMode;
  /** Path prefix for reported matches, e.g. the top-level field name. */
  basePath?: string;
  /** Return true to prune a subtree, e.g. an insight embedded in a dashboard tile. */
  skip?: (path: string) => boolean;
};

/**
 * Left-hand sides this script recognises in HogQL. `properties.plan`,
 * `properties['plan']` and a bare `plan` column. The lookbehind stops a bare
 * `plan` from matching inside `properties.plan` or a word like `myplan`.
 */
const HOGQL_PLAN_LHS = String.raw`(?:properties\.plan|properties\[(?:'plan'|"plan")\]|(?<![\w$.\[])plan)`;

/** `plan = 'agency'`, `properties.plan == "agency"`, and the bracket form. */
const HOGQL_PLAN_EQ_AGENCY = new RegExp(
  String.raw`(${HOGQL_PLAN_LHS})\s*(?:==|=)\s*(?:'${LEGACY_PLAN_VALUE}'|"${LEGACY_PLAN_VALUE}")`,
  'g'
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalise a property filter's `value` to a list of strings, or null when it
 * is not a shape this script understands (a number, an object, a mixed array).
 */
function readStringValues(value: unknown): string[] | null {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    return value as string[];
  }
  return null;
}

/** True when the node is a `plan` property filter that still references 'agency'. */
function isPlanAgencyFilter(node: Record<string, unknown>, mode: RewriteMode): boolean {
  if (node.key !== PLAN_PROPERTY_KEY) return false;
  const values = readStringValues(node.value);
  if (!values || !values.includes(LEGACY_PLAN_VALUE)) return false;
  // Widening is a no-op once 'scale' is already there, which keeps re-runs safe.
  if (mode === 'widen' && values.includes(CURRENT_PLAN_VALUE)) return false;
  return true;
}

function rewritePlanValues(values: string[], mode: RewriteMode): string[] {
  const next =
    mode === 'widen'
      ? [...values, CURRENT_PLAN_VALUE]
      : values.map((entry) => (entry === LEGACY_PLAN_VALUE ? CURRENT_PLAN_VALUE : entry));
  return [...new Set(next)];
}

function rewriteHogql(sql: string, mode: RewriteMode): string {
  return sql.replace(HOGQL_PLAN_EQ_AGENCY, (_full, lhs: string) =>
    mode === 'widen'
      ? `${lhs} IN ('${LEGACY_PLAN_VALUE}', '${CURRENT_PLAN_VALUE}')`
      : `${lhs} = '${CURRENT_PLAN_VALUE}'`
  );
}

function joinPath(base: string, segment: string): string {
  return base ? `${base}.${segment}` : segment;
}

/**
 * Walk any JSON value, rewriting every `plan = agency` reference it contains.
 *
 * Returns a new value (the input is never mutated), every match with its exact
 * path, and whether anything changed.
 */
export function rewritePlanFilters(
  value: unknown,
  options: RewriteOptions
): { value: unknown; matches: PlanMatch[]; changed: boolean } {
  const matches: PlanMatch[] = [];
  let changed = false;

  const walk = (node: unknown, path: string): unknown => {
    if (options.skip?.(path)) return node;

    if (typeof node === 'string') {
      HOGQL_PLAN_EQ_AGENCY.lastIndex = 0;
      if (!HOGQL_PLAN_EQ_AGENCY.test(node)) return node;
      const rewritten = rewriteHogql(node, options.mode);
      matches.push({
        path,
        kind: 'hogql-string',
        before: node,
        after: rewritten,
        rewritable: true,
      });
      if (rewritten !== node) changed = true;
      return rewritten;
    }

    if (Array.isArray(node)) {
      return node.map((entry, index) => walk(entry, `${path}[${index}]`));
    }

    if (!isPlainObject(node)) return node;

    if (isPlanAgencyFilter(node, options.mode)) {
      const operator = typeof node.operator === 'string' ? node.operator : undefined;
      if (operator !== undefined && !WIDENABLE_OPERATORS.includes(operator)) {
        matches.push({
          path,
          kind: 'property-filter',
          before: JSON.stringify(node),
          after: null,
          rewritable: false,
          note:
            `operator '${operator}' cannot be rewritten as a value list without ` +
            'changing what the filter means. Fix this one in the PostHog UI.',
        });
        return node;
      }

      const values = readStringValues(node.value) ?? [];
      const rewrittenNode = { ...node, value: rewritePlanValues(values, options.mode) };
      matches.push({
        path,
        kind: 'property-filter',
        before: JSON.stringify(node),
        after: JSON.stringify(rewrittenNode),
        rewritable: true,
      });
      changed = true;
      return rewrittenNode;
    }

    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) {
      next[key] = walk(child, joinPath(path, key));
    }
    return next;
  };

  const rewritten = walk(value, options.basePath ?? '');
  return { value: rewritten, matches, changed };
}

/** Detection only. Used for the post-PATCH verification re-fetch. */
export function findPlanMatches(value: unknown, options: RewriteOptions): PlanMatch[] {
  return rewritePlanFilters(value, options).matches;
}

// ---------------------------------------------------------------------------
// The six REST collections
// ---------------------------------------------------------------------------

export type ObjectDescriptor = {
  type: PosthogObjectType;
  /** Path segment under /api/projects/:project_id/ */
  resource: string;
  /** Top-level fields that can hold a filter definition. Only these are walked. */
  fields: string[];
  /**
   * The subset of `fields` the documented PATCH request accepts. A match in a
   * field outside this list is reported for a human instead of being written,
   * because the API would accept the request and silently drop the field.
   */
  writableFields: string[];
  /**
   * True when the list endpoint omits the filter-bearing fields, so each object
   * has to be re-read individually. Dashboards do this: the list serializer
   * returns no `tiles` and no `filters`.
   */
  detailFetch?: boolean;
  /** Prune predicate applied to paths inside a walked field. */
  skip?: (path: string) => boolean;
  displayName: (raw: Record<string, unknown>) => string;
  dashboardsOf?: (raw: Record<string, unknown>) => Array<string | number>;
};

const stringField = (raw: Record<string, unknown>, key: string): string | null =>
  typeof raw[key] === 'string' && (raw[key] as string).length > 0 ? (raw[key] as string) : null;

/**
 * A dashboard tile embeds the whole insight object. Walking it would find the
 * same filter a second time and tempt a second PATCH through the wrong
 * endpoint, so the subtree is pruned; /insights/ already covers it.
 */
const DASHBOARD_TILE_INSIGHT = /^tiles\[\d+\]\.insight(\.|$)/;

export const OBJECT_DESCRIPTORS: readonly ObjectDescriptor[] = [
  {
    type: 'insight',
    resource: 'insights',
    // Modern insights are `query` (InsightVizNode / HogQLQuery). `filters` is
    // the pre-HogQL blob still present on older saved insights — it is returned
    // by GET but is NOT in the documented PATCH request body, so a match there
    // is reported rather than written. (docs/api/insights, PATCH parameters:
    // name, derived_name, query, order, deleted, dashboards, description,
    // tags, favorited.)
    fields: ['query', 'filters'],
    writableFields: ['query'],
    displayName: (raw) =>
      stringField(raw, 'name') ?? stringField(raw, 'derived_name') ?? stringField(raw, 'short_id') ?? '(unnamed)',
    dashboardsOf: (raw) => (Array.isArray(raw.dashboards) ? (raw.dashboards as Array<string | number>) : []),
  },
  {
    type: 'dashboard',
    resource: 'dashboards',
    // The dashboards LIST serializer returns neither `tiles` nor `filters`, so
    // every dashboard is re-read individually. A dashboard's own `filters` are
    // the date/property overrides applied to every tile; `tiles` is walked for
    // text tiles and per-tile `filters_overrides`, with the embedded insight
    // pruned. `variables` is returned but is not a PATCH parameter.
    fields: ['filters', 'tiles', 'variables'],
    writableFields: ['filters', 'tiles'],
    detailFetch: true,
    skip: (path) => DASHBOARD_TILE_INSIGHT.test(path),
    displayName: (raw) => stringField(raw, 'name') ?? '(unnamed)',
  },
  {
    type: 'cohort',
    resource: 'cohorts',
    // filters.properties is `{type:'AND'|'OR', values:[...]}`; the docs show one
    // level, the product nests groups, and the walker handles either.
    // `query` covers cohorts defined by HogQL.
    fields: ['filters', 'query', 'groups'],
    writableFields: ['filters', 'query', 'groups'],
    displayName: (raw) => stringField(raw, 'name') ?? '(unnamed)',
  },
  {
    type: 'action',
    resource: 'actions',
    // steps[].properties[] = {key, type, value, operator}.
    fields: ['steps'],
    writableFields: ['steps'],
    displayName: (raw) => stringField(raw, 'name') ?? '(unnamed)',
  },
  {
    type: 'feature_flag',
    resource: 'feature_flags',
    // The reference page renders `filters` as an opaque `{}`, so the inner
    // shape is not contractual. The walker does not depend on it: it finds
    // `{key:'plan', value:'agency'}` wherever it sits, including the
    // release-condition path filters.groups[].properties[].
    fields: ['filters'],
    writableFields: ['filters'],
    displayName: (raw) => stringField(raw, 'key') ?? stringField(raw, 'name') ?? '(unnamed)',
  },
  {
    type: 'experiment',
    resource: 'experiments',
    // Modern targeting lives in exposure_criteria.exposure_config.properties[]
    // and in metrics[].*.properties. `filters`/`secondary_metrics` are the
    // legacy fields, still accepted on PATCH. `saved_metrics` is read-only —
    // its writable counterpart, saved_metrics_ids, holds ids, not filters.
    fields: [
      'filters',
      'parameters',
      'exposure_criteria',
      'metrics',
      'metrics_secondary',
      'secondary_metrics',
      'saved_metrics',
    ],
    writableFields: [
      'filters',
      'parameters',
      'exposure_criteria',
      'metrics',
      'metrics_secondary',
      'secondary_metrics',
    ],
    displayName: (raw) => stringField(raw, 'name') ?? '(unnamed)',
  },
];

// ---------------------------------------------------------------------------
// Report shapes
// ---------------------------------------------------------------------------

export type ScanEntry = {
  type: PosthogObjectType;
  resource: string;
  id: string | number;
  name: string;
  /** Dashboards this object belongs to. Empty for types with no membership. */
  dashboards: Array<string | number>;
  matches: PlanMatch[];
  /** Minimal PATCH body: only the top-level fields that changed. */
  patch: Record<string, unknown>;
};

export type FailedEntry = Omit<ScanEntry, 'patch'> & { error: string };

/** Drop the patch body (it can be large) and attach why the object failed. */
function toFailed(entry: ScanEntry, error: string): FailedEntry {
  return {
    type: entry.type,
    resource: entry.resource,
    id: entry.id,
    name: entry.name,
    dashboards: entry.dashboards,
    matches: entry.matches,
    error,
  };
}

export type RunReport = {
  generatedAt: string;
  mode: 'dry-run' | 'apply';
  rewriteMode: RewriteMode;
  host: string;
  projectId: string;
  limit: number | null;
  limitReached: boolean;
  reportPath: string;
  /** Objects read per collection. */
  scanned: Record<string, number>;
  /** List pages fetched per collection. */
  pages: Record<string, number>;
  /** Collections the key could not read; they are reported, never guessed at. */
  unavailable: Array<{ resource: string; error: string }>;
  matched: ScanEntry[];
  changed: ScanEntry[];
  /** Beyond --limit. Listed so a canary shows what is still outstanding. */
  skipped: ScanEntry[];
  failed: FailedEntry[];
  /** Matched, but no rule this script trusts. Fix these in the UI. */
  manual: ScanEntry[];
};

export type RunOptions = {
  apply?: boolean;
  rewriteMode?: RewriteMode;
  limit?: number | null;
  reportPath?: string;
};

// ---------------------------------------------------------------------------
// Transport helpers
// ---------------------------------------------------------------------------

/** Replace the API key with a placeholder anywhere it could reach output. */
export function redact(text: string, apiKey: string): string {
  if (!apiKey) return text;
  return text.split(apiKey).join('***REDACTED***');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function collectionUrl(deps: RunDeps, resource: string): string {
  return `${deps.host}/api/projects/${deps.projectId}/${resource}/?limit=${PAGE_SIZE}`;
}

function objectUrl(deps: RunDeps, resource: string, id: string | number): string {
  return `${deps.host}/api/projects/${deps.projectId}/${resource}/${id}/`;
}

async function requestJson(
  deps: RunDeps,
  url: string,
  init: PosthogRequestInit = {}
): Promise<unknown> {
  const response = await deps.fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${deps.apiKey}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      redact(`${init.method ?? 'GET'} ${url} -> HTTP ${response.status} ${body.slice(0, 300)}`, deps.apiKey)
    );
  }

  return response.json();
}

/** Page a collection until PostHog stops returning a `next` URL. */
async function listAll(
  deps: RunDeps,
  resource: string
): Promise<{ rows: Array<Record<string, unknown>>; pages: number }> {
  const rows: Array<Record<string, unknown>> = [];
  let url: string | null = collectionUrl(deps, resource);
  let pages = 0;

  while (url) {
    const body = (await requestJson(deps, url)) as {
      results?: unknown;
      next?: unknown;
    };
    pages += 1;
    if (Array.isArray(body.results)) {
      for (const row of body.results) {
        if (isPlainObject(row)) rows.push(row);
      }
    }
    url = typeof body.next === 'string' && body.next.length > 0 ? body.next : null;
  }

  return { rows, pages };
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

/** Walk one object's filter-bearing fields and build its minimal patch. */
export function scanObject(
  descriptor: ObjectDescriptor,
  raw: Record<string, unknown>,
  mode: RewriteMode
): ScanEntry | null {
  const matches: PlanMatch[] = [];
  const patch: Record<string, unknown> = {};

  for (const field of descriptor.fields) {
    if (!(field in raw) || raw[field] === null || raw[field] === undefined) continue;
    const result = rewritePlanFilters(raw[field], {
      mode,
      basePath: field,
      skip: descriptor.skip,
    });
    if (result.matches.length === 0) continue;

    if (!descriptor.writableFields.includes(field)) {
      // Detected, but the documented PATCH body has no such field. Writing it
      // would return 200 and change nothing, so it is reported instead.
      for (const match of result.matches) {
        matches.push({
          ...match,
          after: null,
          rewritable: false,
          note:
            `'${field}' is not a PATCH parameter on /${descriptor.resource}/, so this ` +
            'cannot be rewritten through the API. Fix it in the PostHog UI.',
        });
      }
      continue;
    }

    matches.push(...result.matches);
    if (result.changed) patch[field] = result.value;
  }

  if (matches.length === 0) return null;

  return {
    type: descriptor.type,
    resource: descriptor.resource,
    id: (raw.id as string | number) ?? (raw.short_id as string) ?? '(unknown)',
    name: descriptor.displayName(raw),
    dashboards: descriptor.dashboardsOf?.(raw) ?? [],
    matches,
    patch,
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export async function runPlanFilterRewrite(
  deps: RunDeps,
  options: RunOptions = {}
): Promise<RunReport> {
  const apply = options.apply === true;
  const mode: RewriteMode = options.rewriteMode ?? 'widen';
  const limit = options.limit ?? null;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const scanned: Record<string, number> = {};
  const pages: Record<string, number> = {};
  const unavailable: Array<{ resource: string; error: string }> = [];
  const matched: ScanEntry[] = [];
  const manual: ScanEntry[] = [];

  for (const descriptor of OBJECT_DESCRIPTORS) {
    let rows: Array<Record<string, unknown>>;
    try {
      const page = await listAll(deps, descriptor.resource);
      rows = page.rows;
      pages[descriptor.resource] = page.pages;
    } catch (error) {
      unavailable.push({ resource: descriptor.resource, error: redact(errorMessage(error), deps.apiKey) });
      scanned[descriptor.resource] = 0;
      pages[descriptor.resource] = 0;
      continue;
    }

    scanned[descriptor.resource] = rows.length;

    for (const listRow of rows) {
      if (listRow.deleted === true) continue;

      // Dashboards: the list serializer omits `tiles` and `filters`, so the
      // object has to be re-read before there is anything to scan.
      let raw = listRow;
      if (descriptor.detailFetch) {
        try {
          const detail = await requestJson(deps, objectUrl(deps, descriptor.resource, listRow.id as string | number));
          if (isPlainObject(detail)) raw = detail;
        } catch (error) {
          unavailable.push({
            resource: `${descriptor.resource}/${String(listRow.id)}`,
            error: redact(errorMessage(error), deps.apiKey),
          });
          continue;
        }
      }

      const entry = scanObject(descriptor, raw, mode);
      if (!entry) continue;
      if (Object.keys(entry.patch).length === 0) {
        // Every match needs a human (an operator this script will not widen).
        manual.push(entry);
        continue;
      }
      matched.push(entry);
    }
  }

  const selected = limit === null ? matched : matched.slice(0, limit);
  const skipped = limit === null ? [] : matched.slice(limit);
  const limitReached = limit !== null && matched.length > limit;

  const changed: ScanEntry[] = [];
  const failed: FailedEntry[] = [];

  if (apply) {
    // Sequential on purpose: one object, one PATCH, one verification re-fetch.
    for (const entry of selected) {
      const url = objectUrl(deps, entry.resource, entry.id);
      try {
        await requestJson(deps, url, { method: 'PATCH', body: JSON.stringify(entry.patch) });
      } catch (error) {
        failed.push(toFailed(entry, redact(errorMessage(error), deps.apiKey)));
        continue;
      }

      try {
        const refetched = (await requestJson(deps, url)) as Record<string, unknown>;
        const remaining = OBJECT_DESCRIPTORS.find((d) => d.resource === entry.resource)!.fields
          .filter((field) => field in entry.patch)
          .flatMap((field) =>
            findPlanMatches(refetched[field], { mode, basePath: field, skip: descriptorSkip(entry.resource) })
          )
          .filter((match) => match.rewritable);

        if (remaining.length > 0) {
          failed.push(
            toFailed(
              entry,
              `verification failed after PATCH: ${remaining.length} plan='${LEGACY_PLAN_VALUE}' ` +
                `reference(s) still present at ${remaining.map((match) => match.path).join(', ')}. ` +
                'The API likely ignored the field; fix this object in the PostHog UI.'
            )
          );
          continue;
        }
      } catch (error) {
        failed.push(
          toFailed(entry, redact(`verification re-fetch failed: ${errorMessage(error)}`, deps.apiKey))
        );
        continue;
      }

      changed.push(entry);
    }
  }

  const report: RunReport = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    rewriteMode: mode,
    host: deps.host,
    projectId: deps.projectId,
    limit,
    limitReached,
    reportPath,
    scanned,
    pages,
    unavailable,
    matched: selected,
    changed,
    skipped,
    failed,
    manual,
  };

  await deps.writeFile(reportPath, `${redact(JSON.stringify(report, null, 2), deps.apiKey)}\n`);

  return report;
}

function descriptorSkip(resource: string): ((path: string) => boolean) | undefined {
  return OBJECT_DESCRIPTORS.find((descriptor) => descriptor.resource === resource)?.skip;
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

function truncate(text: string, max = 90): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function printReport(report: RunReport, log: (message: string) => void): void {
  const totalScanned = Object.values(report.scanned).reduce((sum, count) => sum + count, 0);

  log(
    `\n[posthog-plan-filters] mode=${report.mode} rewrite=${report.rewriteMode} ` +
      `project=${report.projectId} scanned=${totalScanned} matched=${report.matched.length} ` +
      `changed=${report.changed.length} skipped=${report.skipped.length} ` +
      `failed=${report.failed.length} manual=${report.manual.length}`
  );
  log(
    `Collections: ${OBJECT_DESCRIPTORS.map(
      (descriptor) =>
        `${descriptor.resource}=${report.scanned[descriptor.resource] ?? 0}` +
        `(${report.pages[descriptor.resource] ?? 0}p)`
    ).join(' ')}`
  );

  for (const entry of report.unavailable) {
    log(`  UNAVAILABLE: ${entry.resource} — ${entry.error}`);
  }

  if (report.matched.length === 0 && report.manual.length === 0) {
    log(`No saved object filters on plan='${LEGACY_PLAN_VALUE}'. Nothing to do.`);
  }

  const rows = [...report.matched, ...report.skipped];
  for (const entry of rows) {
    const failure = report.failed.find(
      (candidate) => candidate.resource === entry.resource && candidate.id === entry.id
    );
    const isSkipped = report.skipped.includes(entry);
    const status = isSkipped
      ? 'SKIPPED (over --limit)'
      : report.mode === 'dry-run'
        ? 'would change'
        : failure
          ? 'FAILED'
          : 'changed';

    const dashboards = entry.dashboards.length > 0 ? ` dashboards=[${entry.dashboards.join(',')}]` : '';
    log(`  ${status}: ${entry.type} id=${entry.id} "${truncate(entry.name, 60)}"${dashboards}`);
    for (const match of entry.matches) {
      log(`      ${match.path}: ${truncate(match.before)} -> ${truncate(match.after ?? '(unchanged)')}`);
    }
    if (failure) log(`      error: ${failure.error}`);
  }

  for (const entry of report.manual) {
    log(`  MANUAL: ${entry.type} id=${entry.id} "${truncate(entry.name, 60)}"`);
    for (const match of entry.matches) {
      log(`      ${match.path}: ${truncate(match.before)} — ${match.note ?? 'needs a human'}`);
    }
  }

  log(`Report written to ${report.reportPath}`);

  if (report.mode === 'dry-run') {
    log(
      'Dry run only — nothing changed. Read the report, then re-run with ' +
        '--apply --limit 1 as a canary before the full --apply.'
    );
    return;
  }

  if (report.limitReached) {
    log(`--limit ${report.limit} reached. ${report.skipped.length} object(s) still carry the old filter.`);
  }

  if (report.failed.length > 0) {
    log(`${report.failed.length} object(s) failed. They are unchanged or partially changed — see the report.`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export type ParsedArgs = {
  apply: boolean;
  rewriteMode: RewriteMode;
  limit: number | null;
  reportPath: string;
};

function readFlagValue(argv: string[], name: string): string | undefined {
  let value: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === `--${name}`) value = argv[index + 1];
    else if (arg.startsWith(`--${name}=`)) value = arg.slice(name.length + 3);
  }
  return value;
}

export function parseArgs(argv: string[]): ParsedArgs {
  // Dry run unless --apply is passed. --dry-run exists so operators can be
  // explicit in runbooks; it never enables writes.
  const apply = argv.includes('--apply');

  const rawMode = readFlagValue(argv, 'mode');
  const rewriteMode: RewriteMode = rawMode === 'replace' ? 'replace' : 'widen';

  const rawLimit = readFlagValue(argv, 'limit');
  const parsedLimit = rawLimit === undefined ? Number.NaN : Number(rawLimit);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;

  const rawReport = readFlagValue(argv, 'report');
  const reportPath = rawReport && rawReport.length > 0 ? rawReport : DEFAULT_REPORT_PATH;

  return { apply, rewriteMode, limit, reportPath };
}

function depsFromEnv(): RunDeps {
  return {
    fetch: globalThis.fetch as unknown as PosthogFetch,
    apiKey: process.env.POSTHOG_PERSONAL_API_KEY ?? '',
    host: (process.env.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST).replace(/\/+$/, ''),
    projectId: process.env.POSTHOG_PROJECT_ID ?? DEFAULT_PROJECT_ID,
    log: (message: string) => console.log(message),
    writeFile: (path: string, contents: string) => writeFileAsync(path, contents, 'utf8'),
  };
}

/**
 * CLI entry point. Returns the process exit code so tests can call it without
 * exiting the vitest process.
 */
export async function main(
  argv: string[] = process.argv.slice(2),
  depsOverride?: RunDeps
): Promise<number> {
  const { apply, rewriteMode, limit, reportPath } = parseArgs(argv);
  const deps = depsOverride ?? depsFromEnv();

  if (!deps.apiKey) {
    deps.log(
      'POSTHOG_PERSONAL_API_KEY is not set. Export a PostHog personal API key ' +
        '(not a project key) with read+write scopes for insight, dashboard, ' +
        'cohort, action, feature_flag and experiment, then re-run.'
    );
    return 1;
  }

  try {
    const report = await runPlanFilterRewrite(deps, { apply, rewriteMode, limit, reportPath });
    printReport(report, (message) => deps.log(redact(message, deps.apiKey)));
    return report.failed.length > 0 ? 1 : 0;
  } catch (error) {
    deps.log(`[posthog-plan-filters] Fatal error: ${redact(errorMessage(error), deps.apiKey)}`);
    return 1;
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      console.error(
        '[posthog-plan-filters] Fatal error:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    });
}
