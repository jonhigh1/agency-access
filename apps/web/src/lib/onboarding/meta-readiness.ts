/**
 * Agency Meta Business Portfolio readiness for the onboarding platform step.
 *
 * Creating an access request that includes Meta needs an active agency Meta
 * connection with a selected Business Portfolio (the API answers
 * META_DESTINATION_NOT_READY otherwise). Onboarding uses this to gate
 * Continue and to show the inline "Connect Meta" panel instead of a dead-end
 * toast.
 */

import { platformGroupOf } from '@agency-platform/shared';

export type MetaPortfolioReadiness =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'not_connected' }
  | { status: 'needs_portfolio' }
  | { status: 'ready'; portfolioName?: string }
  | { status: 'error'; message: string };

export const META_DESTINATION_NOT_READY = 'META_DESTINATION_NOT_READY';

type SelectionLike = Record<string, readonly string[] | undefined> | null | undefined;

export function selectionIncludesMeta(selection: SelectionLike): boolean {
  if (!selection) return false;
  return Object.entries(selection).some(([group, platforms]) => {
    const list = (platforms ?? []).filter((p) => typeof p === 'string' && p.length > 0);
    if (list.length === 0) return false;
    return platformGroupOf(group) === 'meta' || list.some((platform) => platformGroupOf(platform) === 'meta');
  });
}

/** Where an agency without a Meta Business Portfolio can create one (opens in a new tab). */
export const META_CREATE_BUSINESS_PORTFOLIO_URL = 'https://business.facebook.com/overview';

/**
 * The selection with every Meta-group platform removed ("Skip Meta for now").
 * Groups left empty are dropped so the result never reads as including Meta.
 */
export function selectionWithoutMeta<T extends Record<string, readonly string[] | undefined>>(
  selection: T | null | undefined
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [group, platforms] of Object.entries(selection ?? {})) {
    if (platformGroupOf(group) === 'meta') continue;
    const kept = (platforms ?? []).filter(
      (platform) => typeof platform === 'string' && platform.length > 0 && platformGroupOf(platform) !== 'meta'
    );
    if (kept.length > 0) next[group] = kept;
  }
  return next;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Derive readiness from the `/agency-platforms/available` payload
 * (`[{ platform, connected, metadata }]`). Mirrors the API gate:
 * connection present plus a business id (column or metadata.selectedBusinessId).
 */
export function resolveMetaReadinessFromPlatforms(platforms: unknown): MetaPortfolioReadiness {
  if (!Array.isArray(platforms)) return { status: 'not_connected' };
  const meta = platforms.find(
    (entry) => entry && typeof entry === 'object' && (entry as { platform?: unknown }).platform === 'meta'
  ) as { connected?: unknown; businessId?: unknown; metadata?: unknown } | undefined;

  if (!meta || meta.connected !== true) return { status: 'not_connected' };

  const metadata = meta.metadata && typeof meta.metadata === 'object'
    ? (meta.metadata as Record<string, unknown>)
    : {};
  const businessId = nonEmptyString(meta.businessId) ?? nonEmptyString(metadata.selectedBusinessId);
  if (!businessId) return { status: 'needs_portfolio' };

  return { status: 'ready', portfolioName: nonEmptyString(metadata.selectedBusinessName) };
}

/**
 * True when Continue on the platform step must wait for the agency to connect
 * Meta. A failed status check does not block: the API stays the authority and
 * its error is surfaced inline.
 */
export function isMetaGateBlocking(selection: SelectionLike, readiness: MetaPortfolioReadiness): boolean {
  if (!selectionIncludesMeta(selection)) return false;
  return readiness.status !== 'ready' && readiness.status !== 'error';
}

export function metaGateMessage(readiness: MetaPortfolioReadiness): string {
  switch (readiness.status) {
    case 'needs_portfolio':
      return 'Choose your agency Meta Business Portfolio below to continue, or deselect Meta.';
    case 'idle':
    case 'loading':
      return 'Checking your agency Meta connection…';
    default:
      return 'Connect your agency Meta Business Portfolio below to continue, or deselect Meta.';
  }
}
