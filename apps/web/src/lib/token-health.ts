/**
 * Token Health Utility
 *
 * Calculates the health status of OAuth tokens based on expiration dates.
 * Used throughout the application to determine if tokens need refreshing.
 */

export type TokenHealthStatus = 'healthy' | 'expiring' | 'expired' | 'unknown';

export interface TokenHealth {
  status: TokenHealthStatus;
  daysUntilExpiry: number;
  /** Exact whole minutes until expiry; negative once the token is past expiry. */
  minutesUntilExpiry: number;
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Calculate token health based on expiration date.
 *
 * @param expiresAt - The expiration date of the token (Date, ISO string, or null)
 * @param now - Reference clock; defaults to the current time (tests pass a fixed clock)
 * @returns TokenHealth object with status and time until expiry
 *
 * Status thresholds:
 * - unknown: No expiration date provided
 * - expired: Past expiration, measured in milliseconds — hourly tokens that
 *   died minutes ago must not read as "expiring" (a day-ceil rounding made -12m
 *   round up to day 0)
 * - expiring: Expires within 7 days
 * - healthy: More than 7 days until expiration
 */
export function getTokenHealth(expiresAt: Date | string | null, now: Date = new Date()): TokenHealth {
  if (!expiresAt) {
    return { status: 'unknown', daysUntilExpiry: 0, minutesUntilExpiry: 0 };
  }

  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const msUntilExpiry = expiryDate.getTime() - now.getTime();
  // Future horizons round up (conservative); past horizons round away from
  // zero so "12 minutes past expiry" reports day -1, not day 0.
  const daysUntilExpiry =
    msUntilExpiry > 0
      ? Math.ceil(msUntilExpiry / DAY_MS)
      : Math.floor(msUntilExpiry / DAY_MS);
  const minutesUntilExpiry = Math.floor(msUntilExpiry / MINUTE_MS);

  if (msUntilExpiry <= 0) {
    return { status: 'expired', daysUntilExpiry, minutesUntilExpiry };
  }

  if (daysUntilExpiry <= 7) {
    return { status: 'expiring', daysUntilExpiry, minutesUntilExpiry };
  }

  return { status: 'healthy', daysUntilExpiry, minutesUntilExpiry };
}

/**
 * Check if a token is expired.
 */
export function isTokenExpired(expiresAt: Date | string | null): boolean {
  return getTokenHealth(expiresAt).status === 'expired';
}

/**
 * Check if a token is expiring soon (within 7 days).
 */
export function isTokenExpiringSoon(expiresAt: Date | string | null): boolean {
  const health = getTokenHealth(expiresAt);
  return health.status === 'expiring' || health.status === 'expired';
}

/**
 * Format expiration date as a human-readable string.
 */
export function formatExpirationDate(expiresAt: Date | string | null): string {
  if (!expiresAt) return 'Unknown';

  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return expiryDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format days until expiry as a human-readable string.
 */
export function formatDaysUntilExpiry(days: number): string {
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days < 7) return `Expires in ${days} days`;
  return `${days} days remaining`;
}

/**
 * Format time until expiry with minute-level truth for sub-day horizons.
 *
 * Snapchat-class tokens live about an hour, so day-granular copy lies twice:
 * a token that dies in 42 minutes reads "Expires tomorrow", and one that died
 * 12 minutes ago reads "Expires today". Horizons of a day or more keep the
 * existing day copy.
 */
export function formatTimeUntilExpiry(
  expiresAt: Date | string | null,
  now: Date = new Date()
): string {
  if (!expiresAt) return 'Unknown';

  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const msUntilExpiry = expiryDate.getTime() - now.getTime();
  if (Number.isNaN(msUntilExpiry)) return 'Unknown';

  if (msUntilExpiry > DAY_MS) {
    return formatDaysUntilExpiry(Math.ceil(msUntilExpiry / DAY_MS));
  }

  const minutes = Math.floor(msUntilExpiry / MINUTE_MS);
  if (msUntilExpiry > 0) {
    // Inside the hour show minutes; inside the day show whole hours.
    if (minutes < 60) return `Expires in ${Math.max(minutes, 1)}m`;
    return `Expires in ${Math.floor(msUntilExpiry / (60 * MINUTE_MS))}h`;
  }

  const overdueMinutes = Math.floor(-msUntilExpiry / MINUTE_MS);
  if (overdueMinutes < 60) return `Expired ${Math.max(overdueMinutes, 1)}m ago`;
  if (-msUntilExpiry <= DAY_MS) {
    return `Expired ${Math.floor(-msUntilExpiry / (60 * MINUTE_MS))}h ago`;
  }
  return 'Expired';
}
