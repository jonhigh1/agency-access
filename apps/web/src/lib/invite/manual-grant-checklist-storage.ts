/**
 * Manual-grant checklist storage (U9).
 *
 * The manual Meta partner-grant checklist persists per-row check state in
 * sessionStorage, keyed by (request token, agency business id, row id), so a
 * returning client in the same session picks up where they stopped.
 *
 * The state is selection-derived: switching business or changing a saved
 * selection must uncheck every row. The reset registration points in
 * MetaAssetSelector.resetSelectionDerivedState and
 * PlatformAuthWizard.resetSelectionDerivedState call
 * clearManualGrantChecklistStorage so every reset path clears it together.
 */

const MANUAL_GRANT_CHECKLIST_STORAGE_PREFIX = 'authhub:meta-manual-grant-checklist';

export const MANUAL_GRANT_CHECKLIST_ROW_IDS = [
  'step-1',
  'step-2',
  'step-2-1',
  'step-2-2',
  'step-2-3',
  'step-2-4',
  'step-2-5',
] as const;

export function manualGrantChecklistStorageKey(
  accessRequestToken: string,
  businessId: string,
  rowId: string
): string {
  return `${MANUAL_GRANT_CHECKLIST_STORAGE_PREFIX}:${accessRequestToken}:${businessId}:${rowId}`;
}

/** Clear every checklist key for this request, across all businesses. */
export function clearManualGrantChecklistStorage(accessRequestToken: string): void {
  if (typeof window === 'undefined') return;
  const prefix = `${MANUAL_GRANT_CHECKLIST_STORAGE_PREFIX}:${accessRequestToken}:`;
  try {
    const stale: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key && key.startsWith(prefix)) stale.push(key);
    }
    stale.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // sessionStorage unavailable (private mode, quota): nothing to clear.
  }
}

export function readManualGrantChecklistRows(
  accessRequestToken: string,
  businessId: string
): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  const checked: Record<string, boolean> = {};
  try {
    MANUAL_GRANT_CHECKLIST_ROW_IDS.forEach((rowId) => {
      checked[rowId] =
        window.sessionStorage.getItem(
          manualGrantChecklistStorageKey(accessRequestToken, businessId, rowId)
        ) === '1';
    });
  } catch {
    // sessionStorage unavailable: start from an unchecked checklist.
  }
  return checked;
}

export function writeManualGrantChecklistRow(
  accessRequestToken: string,
  businessId: string,
  rowId: string,
  checked: boolean
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      manualGrantChecklistStorageKey(accessRequestToken, businessId, rowId),
      checked ? '1' : '0'
    );
  } catch {
    // sessionStorage unavailable: check state stays in memory for this view.
  }
}
