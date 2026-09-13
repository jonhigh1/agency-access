import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  resolveListLimit,
  resolveListOffset,
} from '@/lib/list-pagination.js';

describe('list pagination', () => {
  it('defaults an omitted limit to 50 and caps at 100', () => {
    expect(DEFAULT_LIST_LIMIT).toBe(50);
    expect(MAX_LIST_LIMIT).toBe(100);
    expect(resolveListLimit()).toBe(50);
    expect(resolveListLimit(Number.NaN)).toBe(50);
    expect(resolveListLimit(0)).toBe(50);
    expect(resolveListLimit(10)).toBe(10);
    expect(resolveListLimit(500)).toBe(100);
  });

  it('treats missing or non-positive offsets as 0', () => {
    expect(resolveListOffset()).toBe(0);
    expect(resolveListOffset(-4)).toBe(0);
    expect(resolveListOffset(25)).toBe(25);
  });
});
