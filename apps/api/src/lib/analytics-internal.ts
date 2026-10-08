/**
 * Analytics exclusion verdict for invite/grant funnel events.
 *
 * The allowlist lives in env (ANALYTICS_INTERNAL_IDS, plus the internal admin
 * and Meta review-lab Clerk ids) so no internal ids are committed to this
 * public repo. Only the boolean verdict ever leaves the API.
 */

import { env } from '@/lib/env.js';

export function buildAnalyticsInternalIdSet(lists: ReadonlyArray<ReadonlyArray<string> | undefined>): Set<string> {
  const ids = new Set<string>();
  for (const list of lists) {
    for (const raw of list ?? []) {
      const id = raw.trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

export function matchesAnalyticsInternalIds(
  candidates: ReadonlyArray<string | null | undefined>,
  internalIds: ReadonlySet<string>
): boolean {
  if (internalIds.size === 0) return false;
  return candidates.some((candidate) => typeof candidate === 'string' && internalIds.has(candidate.trim()));
}

/** True when any candidate agency id / Clerk user id is on the internal allowlist. */
export function isAnalyticsInternal(candidates: ReadonlyArray<string | null | undefined>): boolean {
  const internalIds = buildAnalyticsInternalIdSet([
    env.ANALYTICS_INTERNAL_IDS,
    env.INTERNAL_ADMIN_USER_IDS,
    env.META_REVIEW_LAB_USER_IDS,
  ]);
  return matchesAnalyticsInternalIds(candidates, internalIds);
}
