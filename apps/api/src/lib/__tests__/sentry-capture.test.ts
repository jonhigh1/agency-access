import { describe, expect, it } from 'vitest';
import { shouldReportServerError } from '../sentry-capture.js';

describe('shouldReportServerError', () => {
  it('reports 500+ only when Sentry is initialized', () => {
    expect(shouldReportServerError(500, true)).toBe(true);
    expect(shouldReportServerError(503, true)).toBe(true);
    expect(shouldReportServerError(500, false)).toBe(false);
  });

  it('never reports client errors', () => {
    expect(shouldReportServerError(400, true)).toBe(false);
    expect(shouldReportServerError(404, true)).toBe(false);
    expect(shouldReportServerError(499, true)).toBe(false);
  });
});
