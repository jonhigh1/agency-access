import { describe, expect, it } from 'vitest';
import { formatBlogDate } from '../blog-date';

describe('formatBlogDate', () => {
  it('formats publication dates in UTC for the same server and browser output', () => {
    const timestamp = '2026-09-30T00:30:00.000Z';

    expect(new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric' })).toBe('September 29, 2026');
    expect(formatBlogDate(timestamp, { month: 'long', day: 'numeric', year: 'numeric' })).toBe('September 30, 2026');
  });
});
