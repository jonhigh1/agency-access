/**
 * Deployment skew recovery.
 *
 * After a deploy, a tab that is still open runs the previous client bundle. When
 * that bundle posts a Server Action, the new build no longer knows the action id
 * and Next.js throws (for example: `Server Action "..." was not found on the
 * server`). This is not a real fault — a reload fetches the current bundle and
 * the action works again.
 *
 * These helpers recognise that error class and drive a one-time hard reload, so
 * the user gets the fresh build instead of the global crash screen.
 */

/** sessionStorage key that records the last skew reload time. */
export const SKEW_RELOAD_KEY = 'authhub:deployment-skew-reload-at';

/** Do not reload again within this window, so a persistent error cannot loop. */
export const SKEW_RELOAD_WINDOW_MS = 30_000;

const SKEW_ERROR_PATTERNS = [
  /server action .* was not found/i,
  /failed to find server action/i,
  /this request might be from an older or newer deployment/i,
];

/** True when the error comes from a stale bundle posting an unknown Server Action. */
export function isDeploymentSkewError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : '';

  return SKEW_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Start a one-time hard reload to recover from deployment skew.
 *
 * Returns `true` when a reload was started, `false` when a reload already ran
 * inside {@link SKEW_RELOAD_WINDOW_MS} — the caller then shows the normal
 * fallback instead of looping.
 *
 * `now` and `reload` are injectable for tests.
 */
export function recoverFromDeploymentSkew(
  now: number = Date.now(),
  reload: () => void = () => window.location.reload(),
): boolean {
  try {
    const raw = sessionStorage.getItem(SKEW_RELOAD_KEY);
    const last = raw === null ? null : Number(raw);
    if (last !== null && Number.isFinite(last) && now - last < SKEW_RELOAD_WINDOW_MS) {
      return false;
    }
    sessionStorage.setItem(SKEW_RELOAD_KEY, String(now));
  } catch {
    // sessionStorage can be unavailable (private mode, blocked storage).
    // Fall through to a single reload attempt.
  }

  reload();
  return true;
}
