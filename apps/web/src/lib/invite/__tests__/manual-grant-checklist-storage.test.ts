import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearManualGrantChecklistStorage,
  manualGrantChecklistRowId,
  manualGrantChecklistStorageKey,
  readManualGrantChecklistRows,
  writeManualGrantChecklistRow,
} from '../manual-grant-checklist-storage';

/**
 * U9 persistence contract: per-(token, business, row) check state in
 * sessionStorage, cleared per-token on every selection-derived reset, and
 * inert when sessionStorage is unavailable (private mode, quota).
 */
describe('manual-grant-checklist-storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('builds row ids in one shape: step rows and substep rows', () => {
    expect(manualGrantChecklistRowId(1)).toBe('step-1');
    expect(manualGrantChecklistRowId(2)).toBe('step-2');
    expect(manualGrantChecklistRowId(2, 1)).toBe('step-2-1');
    expect(manualGrantChecklistRowId(2, 2)).toBe('step-2-2');
  });

  it('keys storage by token, business, and row id', () => {
    expect(manualGrantChecklistStorageKey('tok', 'biz_1', 'step-2-1')).toBe(
      'authhub:meta-manual-grant-checklist:tok:biz_1:step-2-1'
    );
  });

  it('round-trips checked state and keeps businesses separate', () => {
    writeManualGrantChecklistRow('tok', 'biz_1', 'step-1', true);
    writeManualGrantChecklistRow('tok', 'biz_1', 'step-2-1', true);
    writeManualGrantChecklistRow('tok', 'biz_2', 'step-1', false);

    expect(readManualGrantChecklistRows('tok', 'biz_1', ['step-1', 'step-2-1'])).toEqual({
      'step-1': true,
      'step-2-1': true,
    });
    expect(readManualGrantChecklistRows('tok', 'biz_2', ['step-1'])).toEqual({
      'step-1': false,
    });
  });

  it('treats missing rows as unchecked', () => {
    expect(readManualGrantChecklistRows('tok', 'biz_1', ['step-2-2'])).toEqual({
      'step-2-2': false,
    });
  });

  it('clears every row for the token across all businesses, and only that token', () => {
    writeManualGrantChecklistRow('tok', 'biz_1', 'step-1', true);
    writeManualGrantChecklistRow('tok', 'biz_2', 'step-2-1', true);
    writeManualGrantChecklistRow('other', 'biz_1', 'step-1', true);

    clearManualGrantChecklistStorage('tok');

    expect(readManualGrantChecklistRows('tok', 'biz_1', ['step-1'])).toEqual({ 'step-1': false });
    expect(readManualGrantChecklistRows('tok', 'biz_2', ['step-2-1'])).toEqual({ 'step-2-1': false });
    expect(readManualGrantChecklistRows('other', 'biz_1', ['step-1'])).toEqual({ 'step-1': true });
  });

  it('starts from unchecked and writes nothing when sessionStorage throws', () => {
    const throwing = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('private mode');
      },
      setItem: (key: string, value: string) => {
        throwing.set(key, value);
      },
      removeItem: () => {
        throw new Error('private mode');
      },
      key: () => {
        throw new Error('private mode');
      },
      get length() {
        throw new Error('private mode');
      },
    });

    expect(() => writeManualGrantChecklistRow('tok', 'biz_1', 'step-1', true)).not.toThrow();
    expect(readManualGrantChecklistRows('tok', 'biz_1', ['step-1'])).toEqual({ 'step-1': false });
    expect(() => clearManualGrantChecklistStorage('tok')).not.toThrow();
    expect(throwing.size).toBe(0);
  });
});
