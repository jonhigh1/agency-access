/**
 * Render deploy-status access (U2, R5, R13).
 *
 * Render's free plan has no outgoing webhooks (Pro+ only) and `/health` is
 * unreliable as a failure signal — free instances spin down after ~15
 * minutes idle and take ~1 minute to wake, and `live` is already
 * health-check-gated by Render (KTD2). So detection here is polling-based:
 * `GET /v1/services/{id}/deploys`. Free-plan states that are not code
 * failures (`canceled`, `deactivated`, spin-down) must never be treated as
 * failures by a caller of this module — see classify.ts, which maps both
 * to 'non-actionable' (R5).
 *
 * Every exported function takes an injected `fetch` (default
 * `globalThis.fetch`) so tests can pass a fake instead of hitting the
 * network. Nothing here runs at module load time.
 */

const RENDER_API_BASE = 'https://api.render.com';

/** Default cap on returned log-excerpt length (bytes, ASCII-approximate). */
export const DEFAULT_LOG_EXCERPT_MAX_CHARS = 4000;

/** Safety cap on log-pagination iterations so a misbehaving API can't hang the caller. */
export const DEFAULT_MAX_LOG_PAGES = 10;

/** The Render deploy `status` values documented for this unit. */
export type RenderDeployStatus =
  | 'created'
  | 'queued'
  | 'build_in_progress'
  | 'update_in_progress'
  | 'live'
  | 'deactivated'
  | 'build_failed'
  | 'update_failed'
  | 'canceled'
  | 'pre_deploy_in_progress'
  | 'pre_deploy_failed';

/** Only the deploy fields this library actually reads. */
export type RenderDeploy = {
  id: string;
  commit?: { id: string; message: string };
  trigger?: string;
  status: RenderDeployStatus | (string & {});
  startedAt?: string | null;
  finishedAt?: string | null;
};

/** One item from `GET /v1/services/{id}/deploys`. */
export type RenderDeployListItem = {
  deploy: RenderDeploy;
  cursor: string;
};

/** One entry from `GET /v1/logs`. */
export type RenderLogEntry = {
  id: string;
  message: string;
  timestamp: string;
  labels?: Record<string, string>;
};

/** The `GET /v1/logs` response shape, paginated by timestamp (not cursor). */
export type RenderLogsResponse = {
  logs: RenderLogEntry[];
  hasMore: boolean;
  nextStartTime?: string | null;
  nextEndTime?: string | null;
};

/**
 * Thrown for any non-OK response from the Render API, so callers can
 * distinguish "Render said no" from a generic thrown string and branch on
 * platform + statusCode (e.g. 401 → credentials problem, not a build bug).
 */
export class RenderApiError extends Error {
  readonly platform = 'render' as const;
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(`Render API error (${statusCode}): ${message}`);
    this.name = 'RenderApiError';
    this.statusCode = statusCode;
  }
}

export type RenderFetch = typeof globalThis.fetch;

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text || response.statusText || 'unknown error';
  } catch {
    return response.statusText || 'unknown error';
  }
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

export type ListRenderDeploysOptions = {
  apiKey: string;
  serviceId: string;
  /** Defaults to 20, matching Render's documented default page size. */
  limit?: number;
  fetch?: RenderFetch;
};

/**
 * List recent deploys for a service. Wraps
 * `GET /v1/services/{serviceId}/deploys?limit=20`.
 *
 * Returns an empty array (never throws) when Render reports no deploys —
 * "no deployment found" is a normal, defined result here, not an error.
 */
export async function listRenderDeploys(options: ListRenderDeploysOptions): Promise<RenderDeploy[]> {
  const { apiKey, serviceId, limit = 20, fetch = globalThis.fetch } = options;

  const params = new URLSearchParams({ limit: String(limit) });

  const response = await fetch(
    `${RENDER_API_BASE}/v1/services/${encodeURIComponent(serviceId)}/deploys?${params.toString()}`,
    { headers: authHeaders(apiKey) }
  );

  if (!response.ok) {
    throw new RenderApiError(response.status, await readErrorBody(response));
  }

  const body = (await response.json()) as RenderDeployListItem[] | null;
  return (body ?? []).map((item) => item.deploy);
}

export type FetchRenderBuildLogsOptions = {
  apiKey: string;
  ownerId: string;
  serviceId: string;
  /**
   * ISO timestamp to start from. Required here even though Render defaults
   * to now-1h server-side: older deploys need an explicit startTime or
   * their logs fall outside the default window.
   */
  startTime: string;
  endTime?: string;
  fetch?: RenderFetch;
  /** Iteration cap so a misbehaving API (hasMore always true) can't hang the caller. */
  maxPages?: number;
};

/**
 * Fetch build logs for a service, paginating via `nextStartTime`/
 * `nextEndTime` (not cursor) until `hasMore` is false or `maxPages` is
 * reached. Wraps `GET /v1/logs?ownerId=<id>&resource=<serviceId>&type=build`.
 *
 * Terminates in at most `maxPages` requests even if the API keeps
 * reporting `hasMore: true` — it does not loop forever.
 */
export async function fetchRenderBuildLogs(
  options: FetchRenderBuildLogsOptions
): Promise<RenderLogEntry[]> {
  const {
    apiKey,
    ownerId,
    serviceId,
    startTime,
    endTime,
    fetch = globalThis.fetch,
    maxPages = DEFAULT_MAX_LOG_PAGES,
  } = options;

  const allLogs: RenderLogEntry[] = [];
  let currentStart = startTime;
  let currentEnd = endTime;
  let hasMore = true;
  let pages = 0;

  while (hasMore && pages < maxPages) {
    pages += 1;

    const params = new URLSearchParams({
      ownerId,
      resource: serviceId,
      type: 'build',
      startTime: currentStart,
    });
    if (currentEnd) params.set('endTime', currentEnd);

    const response = await fetch(`${RENDER_API_BASE}/v1/logs?${params.toString()}`, {
      headers: authHeaders(apiKey),
    });

    if (!response.ok) {
      throw new RenderApiError(response.status, await readErrorBody(response));
    }

    const body = (await response.json()) as RenderLogsResponse;
    allLogs.push(...(body.logs ?? []));

    // Only continue if Render both says there's more AND gives us a
    // cursor to continue from; a malformed hasMore:true with no
    // nextStartTime would otherwise spin on the same page forever.
    hasMore = body.hasMore === true && Boolean(body.nextStartTime);
    if (hasMore) {
      currentStart = body.nextStartTime as string;
      currentEnd = body.nextEndTime ?? currentEnd;
    }
  }

  return allLogs;
}

const ERROR_MARKER_PATTERN = /\b(error|fail(?:ed|ure)?|fatal|exception)\b/i;

function isErrorMarkedLogEntry(entry: RenderLogEntry): boolean {
  if (ERROR_MARKER_PATTERN.test(entry.message)) return true;
  const labelValues = entry.labels ? Object.values(entry.labels) : [];
  return labelValues.some((value) => ERROR_MARKER_PATTERN.test(value));
}

/**
 * Reduce a raw build-log-entries array to a bounded log excerpt. Render log
 * entries carry no explicit stderr/fatal type tag (unlike Vercel's build
 * events), so "error-tagged" here means the message or a label value
 * matches a common error marker (error/fail/fatal/exception). Prefers that
 * text; when nothing matches, falls back to the tail of the full log,
 * since build failures are usually the last thing printed.
 *
 * Bounded so the result is safe to embed in a GitHub issue body and an LLM
 * prompt — never returns megabytes.
 */
export function reduceRenderLogsToExcerpt(
  entries: RenderLogEntry[],
  maxLength: number = DEFAULT_LOG_EXCERPT_MAX_CHARS
): string {
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const errorText = sorted
    .filter(isErrorMarkedLogEntry)
    .map((entry) => entry.message)
    .filter((text) => text.length > 0)
    .join('\n');

  if (errorText.length > 0) {
    return boundHead(errorText, maxLength);
  }

  const fullText = sorted
    .map((entry) => entry.message)
    .filter((text) => text.length > 0)
    .join('\n');

  return boundTail(fullText, maxLength);
}

function boundHead(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const omitted = text.length - maxLength;
  return `${text.slice(0, maxLength)}\n... [truncated, ${omitted} more characters]`;
}

function boundTail(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const omitted = text.length - maxLength;
  return `... [truncated, ${omitted} earlier characters]\n${text.slice(-maxLength)}`;
}
