/**
 * Shared date and currency formatters.
 *
 * Each helper preserves the exact behavior of the inline formatters it replaced.
 * `formatShortDate` intentionally uses the runtime default locale (no explicit
 * locale), matching the originals.
 */

/**
 * Format a date-ish value with the default locale.
 * Null/undefined/empty inputs return the fallback (default 'n/a').
 */
export function formatShortDate(
  value: string | Date | null | undefined,
  fallback = 'n/a'
): string {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString();
}

/**
 * Format a date as e.g. "Aug 18, 2026" (en-US, stable).
 */
export function formatMediumDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date as e.g. "August 18, 2026" (en-US, stable).
 */
export function formatLongDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a USD currency amount from an integer cents value.
 */
export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
