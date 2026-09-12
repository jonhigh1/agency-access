/**
 * Vercel deploy-status access (U2, R4, R13).
 *
 * Vercel production-deploy failures are detected event-driven via
 * `repository_dispatch` (KTD2) — the payload carries the failed
 * deployment's `url`, which callers pass into getVercelDeployment /
 * getVercelBuildLogExcerpt to look up state and logs. listVercelDeployments
 * additionally supports a state-filtered listing (`GET /v7/deployments`)
 * for reconciliation/backfill use cases.
 *
 * Every exported function takes an injected `fetch` (default
 * `globalThis.fetch`) so tests can pass a fake instead of hitting the
 * network. Nothing here runs at module load time.
 */

import { authHeaders, boundHead, boundTail, readErrorBody, DEFAULT_LOG_EXCERPT_MAX_CHARS } from './http-utils';

export { DEFAULT_LOG_EXCERPT_MAX_CHARS } from './http-utils';

const VERCEL_API_BASE = 'https://api.vercel.com';

/** The Vercel deployment `readyState` values documented for this unit. */
export type VercelReadyState =
  | 'BLOCKED'
  | 'BUILDING'
  | 'CANCELED'
  | 'DELETED'
  | 'ERROR'
  | 'INITIALIZING'
  | 'QUEUED'
  | 'READY';

/** Only the deployment fields this library actually reads. */
export type VercelDeployment = {
  uid: string;
  url: string;
  name?: string;
  readyState: VercelReadyState | (string & {});
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: number;
  target?: string | null;
};

/** One event from `GET /v3/deployments/{id}/events`. */
export type VercelDeploymentEvent = {
  type: 'stdout' | 'stderr' | 'fatal' | 'command' | 'exit' | 'deployment-state' | (string & {});
  payload?: {
    text?: string;
  };
};

/**
 * Thrown for any non-OK response from the Vercel API, so callers can
 * distinguish "Vercel said no" from a generic thrown string and branch on
 * platform + statusCode (e.g. 401 → credentials problem, not a build bug).
 */
export class VercelApiError extends Error {
  readonly platform = 'vercel' as const;
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(`Vercel API error (${statusCode}): ${message}`);
    this.name = 'VercelApiError';
    this.statusCode = statusCode;
  }
}

export type VercelFetch = typeof globalThis.fetch;

export type ListVercelDeploymentsOptions = {
  token: string;
  projectId: string;
  /** Defaults to 'production' — this library only cares about prod deploys (R4). */
  target?: string;
  /** Filter to a single readyState, e.g. 'ERROR' to list failed prod deploys. */
  state?: VercelReadyState | (string & {});
  /** Only needed for account/team-scoped tokens; project-scoped tokens omit it. */
  teamId?: string;
  fetch?: VercelFetch;
};

/**
 * List production deployments, optionally filtered by readyState. Wraps
 * `GET /v7/deployments?projectId=<id>&target=production&state=ERROR`.
 *
 * Returns an empty array (never throws) when Vercel reports no matching
 * deployments — "no deployment found" is a normal, defined result here,
 * not an error condition.
 */
export async function listVercelDeployments(
  options: ListVercelDeploymentsOptions
): Promise<VercelDeployment[]> {
  const { token, projectId, target = 'production', state, teamId, fetch = globalThis.fetch } =
    options;

  const params = new URLSearchParams({ projectId, target });
  if (state) params.set('state', state);
  if (teamId) params.set('teamId', teamId);

  const response = await fetch(`${VERCEL_API_BASE}/v7/deployments?${params.toString()}`, {
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new VercelApiError(response.status, await readErrorBody(response));
  }

  const body = (await response.json()) as { deployments?: VercelDeployment[] } | null;
  return body?.deployments ?? [];
}

export type GetVercelDeploymentOptions = {
  token: string;
  /** Deployment id (dpl_...) or the deployment URL from the dispatch payload. */
  idOrUrl: string;
  teamId?: string;
  fetch?: VercelFetch;
};

/**
 * Fetch a single deployment's state. Wraps `GET /v13/deployments/{idOrUrl}`
 * — the lookup callers use for the `url` carried in a
 * `vercel.deployment.error` / `vercel.deployment.failed` repository_dispatch
 * payload (KTD2, R4).
 *
 * Returns null (never throws) for a 404 — "no deployment found" is a
 * defined result, not an error.
 */
export async function getVercelDeployment(
  options: GetVercelDeploymentOptions
): Promise<VercelDeployment | null> {
  const { token, idOrUrl, teamId, fetch = globalThis.fetch } = options;

  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const qs = params.toString();

  const response = await fetch(
    `${VERCEL_API_BASE}/v13/deployments/${encodeURIComponent(idOrUrl)}${qs ? `?${qs}` : ''}`,
    { headers: authHeaders(token) }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new VercelApiError(response.status, await readErrorBody(response));
  }

  return (await response.json()) as VercelDeployment;
}

const ERROR_EVENT_TYPES = new Set(['stderr', 'fatal']);

function eventText(event: VercelDeploymentEvent): string {
  return event.payload?.text ?? '';
}

/**
 * Reduce a raw build-events array to a bounded log excerpt. Prefers
 * stderr/fatal-tagged text (the first error signal plus surrounding
 * context); when nothing is explicitly error-tagged, falls back to the
 * tail of the full log, since build failures are usually the last thing
 * printed.
 *
 * Bounded so the result is safe to embed in a GitHub issue body and an LLM
 * prompt — never returns megabytes.
 */
export function reduceVercelEventsToExcerpt(
  events: VercelDeploymentEvent[],
  maxLength: number = DEFAULT_LOG_EXCERPT_MAX_CHARS
): string {
  const errorText = events
    .filter((event) => ERROR_EVENT_TYPES.has(event.type))
    .map(eventText)
    .filter((text) => text.length > 0)
    .join('\n');

  if (errorText.length > 0) {
    return boundHead(errorText, maxLength);
  }

  const fullText = events
    .map(eventText)
    .filter((text) => text.length > 0)
    .join('\n');

  return boundTail(fullText, maxLength);
}

export type GetVercelBuildLogExcerptOptions = {
  token: string;
  idOrUrl: string;
  teamId?: string;
  fetch?: VercelFetch;
  maxLength?: number;
};

/**
 * Fetch build events and reduce them to a bounded log excerpt. Wraps
 * `GET /v3/deployments/{idOrUrl}/events?limit=-1`.
 */
export async function getVercelBuildLogExcerpt(
  options: GetVercelBuildLogExcerptOptions
): Promise<string> {
  const {
    token,
    idOrUrl,
    teamId,
    fetch = globalThis.fetch,
    maxLength = DEFAULT_LOG_EXCERPT_MAX_CHARS,
  } = options;

  const params = new URLSearchParams({ limit: '-1' });
  if (teamId) params.set('teamId', teamId);

  const response = await fetch(
    `${VERCEL_API_BASE}/v3/deployments/${encodeURIComponent(idOrUrl)}/events?${params.toString()}`,
    { headers: authHeaders(token) }
  );

  if (!response.ok) {
    throw new VercelApiError(response.status, await readErrorBody(response));
  }

  const events = ((await response.json()) as VercelDeploymentEvent[] | null) ?? [];
  return reduceVercelEventsToExcerpt(events, maxLength);
}
