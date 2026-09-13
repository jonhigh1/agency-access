/**
 * Shared bounds for unbounded list endpoints.
 * Matches GET /clients (default 50, max 100).
 */

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export function resolveListLimit(limit?: number): number {
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return Math.min(Math.floor(limit), MAX_LIST_LIMIT);
  }
  return DEFAULT_LIST_LIMIT;
}

export function resolveListOffset(offset?: number): number {
  if (typeof offset === 'number' && Number.isFinite(offset) && offset > 0) {
    return Math.floor(offset);
  }
  return 0;
}
