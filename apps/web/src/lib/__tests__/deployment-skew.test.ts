import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SKEW_RELOAD_KEY,
  SKEW_RELOAD_WINDOW_MS,
  isDeploymentSkewError,
  recoverFromDeploymentSkew,
} from '@/lib/deployment-skew';

describe('isDeploymentSkewError', () => {
  it('matches the unknown Server Action error from a stale bundle', () => {
    expect(
      isDeploymentSkewError(
        new Error('Server Action "0048f65a" was not found on the server')
      )
    ).toBe(true);
  });

  it('matches the Next.js older/newer deployment message', () => {
    expect(
      isDeploymentSkewError(
        new Error(
          'Failed to find Server Action "abc". This request might be from an older or newer deployment.'
        )
      )
    ).toBe(true);
  });

  it('matches a named error class', () => {
    const error = new Error('Server Action "x" was not found on the server');
    error.name = 'UnrecognizedActionError';
    expect(isDeploymentSkewError(error)).toBe(true);
  });

  it('matches a plain string message', () => {
    expect(isDeploymentSkewError('Server Action "x" was not found')).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isDeploymentSkewError(new Error('Network request failed'))).toBe(false);
    expect(isDeploymentSkewError(undefined)).toBe(false);
    expect(isDeploymentSkewError(null)).toBe(false);
  });
});

describe('recoverFromDeploymentSkew', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('starts a reload and records the time on first skew error', () => {
    const reload = vi.fn();

    expect(recoverFromDeploymentSkew(1_000, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(SKEW_RELOAD_KEY)).toBe('1000');
  });

  it('does not reload again inside the guard window', () => {
    const reload = vi.fn();
    recoverFromDeploymentSkew(1_000, reload);

    expect(recoverFromDeploymentSkew(1_000 + SKEW_RELOAD_WINDOW_MS - 1, reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again once the guard window has passed', () => {
    const reload = vi.fn();
    recoverFromDeploymentSkew(1_000, reload);

    expect(recoverFromDeploymentSkew(1_000 + SKEW_RELOAD_WINDOW_MS, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('still reloads when sessionStorage is unavailable', () => {
    const reload = vi.fn();
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(recoverFromDeploymentSkew(1_000, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    getItem.mockRestore();
  });
});
