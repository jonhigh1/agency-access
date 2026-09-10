/**
 * Token health lib tests
 *
 * Snapchat-class tokens live about an hour. Day-granular math renders a token
 * that died 12 minutes ago as "Expires today" and one that dies in 42 minutes
 * as "Expires tomorrow". These tests pin minute-level truth for sub-day
 * horizons while keeping day rendering for horizons of a day or more.
 */

import { describe, it, expect } from 'vitest';
import {
  getTokenHealth,
  formatTimeUntilExpiry,
  formatDaysUntilExpiry,
  isTokenExpired,
} from '../token-health';

const NOW = new Date('2026-09-10T12:00:00.000Z');
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

describe('getTokenHealth', () => {
  it('classifies a token that expired 12 minutes ago as expired', () => {
    const health = getTokenHealth(new Date(NOW.getTime() - 12 * MINUTE_MS), NOW);

    expect(health.status).toBe('expired');
    expect(health.daysUntilExpiry).toBe(-1);
  });

  it('classifies a token expiring in 42 minutes as expiring with minute precision', () => {
    const health = getTokenHealth(new Date(NOW.getTime() + 42 * MINUTE_MS), NOW);

    expect(health.status).toBe('expiring');
  });

  it('keeps day-level classification for horizons of a day or more', () => {
    expect(getTokenHealth(new Date(NOW.getTime() + 5 * DAY_MS), NOW).status).toBe('expiring');
    expect(getTokenHealth(new Date(NOW.getTime() + 30 * DAY_MS), NOW).status).toBe('healthy');
  });

  it('still reports unknown without an expiry date', () => {
    expect(getTokenHealth(null, NOW)).toEqual({
      status: 'unknown',
      daysUntilExpiry: 0,
    });
  });

  it('treats a sub-day-past token as expired for refresh decisions', () => {
    expect(isTokenExpired(new Date(NOW.getTime() - 12 * MINUTE_MS))).toBe(true);
  });
});

describe('formatTimeUntilExpiry', () => {
  it('renders minutes for a token expiring within the hour', () => {
    expect(formatTimeUntilExpiry(new Date(NOW.getTime() + 42 * MINUTE_MS), NOW)).toBe(
      'Expires in 42m'
    );
  });

  it('renders hours for a token expiring within the day', () => {
    expect(formatTimeUntilExpiry(new Date(NOW.getTime() + 5 * HOUR_MS), NOW)).toBe(
      'Expires in 5h'
    );
  });

  it('renders past minutes for a token that just died', () => {
    expect(formatTimeUntilExpiry(new Date(NOW.getTime() - 12 * MINUTE_MS), NOW)).toBe(
      'Expired 12m ago'
    );
  });

  it('renders past hours for a token that died within the day', () => {
    expect(formatTimeUntilExpiry(new Date(NOW.getTime() - 2 * HOUR_MS), NOW)).toBe(
      'Expired 2h ago'
    );
  });

  it('keeps day copy for horizons of a day or more', () => {
    expect(formatTimeUntilExpiry(new Date(NOW.getTime() + 3 * DAY_MS), NOW)).toBe(
      'Expires in 3 days'
    );
    expect(formatTimeUntilExpiry(new Date(NOW.getTime() + 30 * DAY_MS), NOW)).toBe(
      '30 days remaining'
    );
    expect(formatTimeUntilExpiry(new Date(NOW.getTime() - 2 * DAY_MS), NOW)).toBe('Expired');
  });

  it('never renders "Expires tomorrow" for a token that dies within hours', () => {
    const copy = formatTimeUntilExpiry(new Date(NOW.getTime() + 3 * HOUR_MS), NOW);

    expect(copy).not.toBe('Expires tomorrow');
    expect(copy).toBe('Expires in 3h');
  });

  it('reports unknown without an expiry date', () => {
    expect(formatTimeUntilExpiry(null, NOW)).toBe('Unknown');
  });
});

describe('formatDaysUntilExpiry', () => {
  it('keeps its existing day-granular copy', () => {
    expect(formatDaysUntilExpiry(-1)).toBe('Expired');
    expect(formatDaysUntilExpiry(0)).toBe('Expires today');
    expect(formatDaysUntilExpiry(7)).toBe('7 days remaining');
  });
});
