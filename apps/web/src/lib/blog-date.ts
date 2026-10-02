export function formatBlogDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Invalid Date'
    : new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
}
